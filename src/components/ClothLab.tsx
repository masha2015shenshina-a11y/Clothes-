import {BodyMap,DEFAULT_PARTS,type BodyPart,type BodyParts} from './BodyMap';
import {DEFAULT_BODY,type BodySettings,type Side} from "@/lib/cloth/mannequin";
import {Icon} from "./Icon";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ClothEngine, webglAvailable, DEFAULT_DIFFUSE, DEFAULT_DIRECTIONAL, type LightSettings, type Selection, type EngineSettings } from "@/lib/cloth/engine";
import {
  DEFAULT_SKIRT, DEFAULT_LEGS, type SkirtSettings, type LegsSettings, type LegPose, MATERIALS, DEFAULT_SLEEVE, type SleeveSettings,
  PIN_LABELS,
  PRESETS,
  type ClothBuild,
  type ColliderState,
  type MaterialId,
  type PinMode,
  type PresetId,
} from "@/lib/cloth/presets";

const SWATCHES = ["#c0603d", "#8e3b2e", "#d9a35b", "#4f6b5a", "#2f4a6b", "#e8e1d4", "#2b2724"];

type PanelTab='clothes'|'pose'|'scene'|'physics';
const PanelContext=createContext<PanelTab>('clothes');
const SECTION_TAB:Record<string,PanelTab>={"Одежда туловища":"clothes","Юбка":"clothes","Брюки":"clothes","Рукав":"clothes","Материал":"clothes","Туловище":"pose","Руки":"pose","Ноги":"pose","Таз":"pose","Плечо":"pose","Физика":"physics","Качество":"physics"};
function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  const tab=useContext(PanelContext);
  if((SECTION_TAB[title]??'scene')!==tab)return null;
  return (
    <section data-section={title} className="lab-section px-3 py-3">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="lab-label">{title}</h3>
        {aside}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Slider(p: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void; digits?: number }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between text-[12.5px]">
        <span className="text-foreground/80">{p.label}</span>
        <span className="font-mono text-[11.5px] text-muted-foreground">
          {p.value.toFixed(p.digits ?? 2)}
          {p.unit ?? ""}
        </span>
      </div>
      <input type="range" className="lab-range" min={p.min} max={p.max} step={p.step} value={p.value} onChange={(e) => p.onChange(parseFloat(e.target.value))} />
    </label>
  );
}

function Seg<T extends string>({ options, value, onChange, disabled }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className={`lab-options grid grid-cols-2 gap-1 ${disabled ? "opacity-40" : ""}`}>
      {options.map((o) => (
        <button key={o.id} type="button" disabled={disabled} onClick={() => onChange(o.id)} className="lab-seg" data-active={value === o.id}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className="lab-switch" data-on={checked}>
      <span />
    </button>
  );
}

function ColliderControls({ c, set, sizeLabel, max }: { c: ColliderState; set: (c: ColliderState) => void; sizeLabel: string; max: number }) {
  return (
    <div className={c.on ? "space-y-2.5" : "pointer-events-none space-y-2.5 opacity-40"}>
      <Slider label="X" value={c.x} min={-3} max={3} step={0.01} unit=" м" onChange={(x) => set({ ...c, x })} />
      <Slider label="Y" value={c.y} min={0} max={3.5} step={0.01} unit=" м" onChange={(y) => set({ ...c, y })} />
      <Slider label="Z" value={c.z} min={-3} max={3} step={0.01} unit=" м" onChange={(z) => set({ ...c, z })} />
      {sizeLabel!=="Ребро" && <Slider label={sizeLabel} value={c.size} min={0.1} max={max} step={0.01} unit=" м" onChange={(size) => set({ ...c, size })} />}
      {sizeLabel==="Ребро"&&(["width","height","depth"] as const).map((axis,i)=><Slider key={axis} label={["Ширина","Высота","Глубина"][i]} value={c[axis]??c.size} min={.1} max={3} step={.01} unit=" м" onChange={v=>set({...c,[axis]:v})}/>)}
    </div>
  );
}

function LimbButtons({kind,side,linked,onSelect}:{kind:"Leg"|"BodyArm";side:Side;linked:boolean;onSelect:(mode:Side|"both")=>void}){
 return <div className="flex gap-1">{(["left","both","right"] as const).map(mode=><button key={mode} type="button" className="lab-btn icon-btn" title={mode==="both"?"ВМЕСТЕ":`${mode==="left"?"ЛЕВАЯ":"ПРАВАЯ"} ${kind==="Leg"?"НОГА":"РУКА"}`} aria-label={mode==="both"?"Вместе":`${mode==="left"?"Левая":"Правая"} ${kind==="Leg"?"нога":"рука"}`} aria-pressed={mode==="both"?linked:!linked&&side===mode} data-selected={mode==="both"?linked:!linked&&side===mode} onClick={()=>onSelect(mode)}><Icon name={mode==="both"?`both${kind}`:`${mode}${kind}`}/></button>)}</div>;
}

export function ClothLab({active=true,onWorkspace}:{active?:boolean;onWorkspace?:()=>void}) {
  const activeRef=useRef(active);activeRef.current=active;
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ClothEngine | null>(null);
  const [glError, setGlError] = useState<string | null>(null);
  useEffect(()=>{if(glError)window.dispatchEvent(new CustomEvent("cloth-failed",{detail:glError.toUpperCase()}));},[glError]);
  const [panelTab,setPanelTab]=useState<PanelTab>('clothes');
  const [panelOpen, setPanelOpen] = useState(false);
  const [theme,setTheme]=useState<"light"|"dark">(()=>{try{return localStorage.getItem("cloth-theme")==="dark"?"dark":"light";}catch{return "light";}});
  useEffect(()=>{document.documentElement.dataset.theme=theme;try{localStorage.setItem("cloth-theme",theme);}catch{}},[theme]);
  const [showMannequin,setShowMannequin]=useState(true);
  const [parts,setParts]=useState<BodyParts>({...DEFAULT_PARTS});
  const [rotateMode,setRotateMode]=useState(false);
  const [quality,setQuality]=useState(.8);
  const [meshCount,setMeshCount]=useState(0);
  const [preset, setPreset] = useState<PresetId>("wide");
  const [pin, setPin] = useState<PinMode>("two");
  const [material, setMaterial] = useState<MaterialId>("cotton");
  const [color, setColor] = useState("#c0603d");
  const [windEnabled,setWindEnabled]=useState(true);
  const [wind, setWind] = useState(2.2);
  const [windAngle, setWindAngle] = useState(15);
  const [windHeight,setWindHeight]=useState(1.05);
  const [diffuse,setDiffuse]=useState<LightSettings>({...DEFAULT_DIFFUSE});
  const [directional,setDirectional]=useState<LightSettings>({...DEFAULT_DIRECTIONAL});
  const [windElevation,setWindElevation]=useState(0);
  const [selfCollision,setSelfCollision]=useState(true);
  const [body,setBody]=useState<BodySettings>(structuredClone(DEFAULT_BODY));
  const [armSide,setArmSide]=useState<Side>("left");
  const [skirt,setSkirt]=useState<SkirtSettings>({...DEFAULT_SKIRT});
  const [legs,setLegs]=useState<LegsSettings>(structuredClone(DEFAULT_LEGS));
  const [legSide,setLegSide]=useState<"left"|"right">("left");
  const [sleeve,setSleeve]=useState<SleeveSettings>(DEFAULT_SLEEVE);
  const [selected,setSelected]=useState<Selection>("cloth");
  const [dragPlane,setDragPlane]=useState<"view"|"floor">("view");
  const [gravity, setGravity] = useState(9.81);
  const [stiffness, setStiffness] = useState(1);
  const [wireframe, setWireframe] = useState(false);
  const [paused, setPaused] = useState(false);
  const [sphere, setSphere] = useState<ColliderState>(PRESETS.find(p=>p.id==="wide")!.sphere);
  const [box, setBox] = useState<ColliderState>(PRESETS.find(p=>p.id==="wide")!.box);
  const fpsRef=useRef<HTMLSpanElement>(null);
  const [,refreshControls]=useState(0);
  const [resetTick, setResetTick] = useState(0);
  const [released, setReleased] = useState(false);
  const [preparing,setPreparing]=useState(true);
  const [buildError,setBuildError]=useState('');
  const buildWorker=useRef<Worker|null>(null);
  const buildSequence=useRef(0);
  const centerAfterBuild=useRef(false);
  const preparingRef=useRef(true);

  const mannequin=preset==="skirt"||preset==="pants"||preset==="body";
  const def = PRESETS.find((p) => p.id === preset)!;
  const settings: EngineSettings = useMemo(
    () => ({ parts,mannequin:mannequin&&showMannequin,body:{...body,on:body.on&&mannequin},windEnabled,skirt,legs,legsEnabled:mannequin&&legs.on&&showMannequin, windHeight, theme, diffuse, directional, gravity, wind, windAngle, stiffness, material, color, wireframe, sphere, box, paused:paused||!active, windElevation, selfCollision, sleeve, selected, dragPlane, armEnabled:preset==="sleeve" }),
    [parts,active,body,mannequin,showMannequin,windEnabled,skirt,legs,wind,windHeight, theme, diffuse, directional, gravity, windAngle, stiffness, material, color, wireframe, sphere, box, paused, windElevation, selfCollision, sleeve, selected, dragPlane, preset],
  );
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  type Snapshot = {quality:number;settings:EngineSettings;preset:PresetId;pin:PinMode;released:boolean;runtime:ReturnType<ClothEngine["captureRuntime"]>};
  const restorePending=useRef<ReturnType<ClothEngine["captureRuntime"]>>(null);
  const past=useRef<{before:Snapshot;after:Snapshot}[]>([]),future=useRef<{before:Snapshot;after:Snapshot}[]>([]);
  const pending=useRef<Snapshot|null>(null);
  const activePointer=useRef(false);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const [historyCount,setHistoryCount]=useState([0,0]);
  const captureRef=useRef<()=>Snapshot>(()=>({quality,settings,preset,pin,released,runtime:null}));
  captureRef.current=()=>({quality,settings:structuredClone(settings),preset,pin,released,runtime:engineRef.current?.captureRuntime()??null});
  const commit=()=>{
    if(timer.current)clearTimeout(timer.current);timer.current=null;
    const before=pending.current;if(!before)return;pending.current=null;const after=captureRef.current();
    const key=(s:Snapshot)=>JSON.stringify([s.quality,s.settings,s.preset,s.pin,s.released,s.runtime?.camera,s.runtime?.target,s.runtime?.revision]);
    if(key(before)===key(after))return;
    past.current.push({before,after});
    const bytes=(s:Snapshot)=>s.runtime?s.runtime.x.byteLength+s.runtime.p.byteLength+s.runtime.baseW.byteLength:0;
    let total=past.current.reduce((sum,e)=>sum+bytes(e.before)+bytes(e.after),0);
    while(past.current.length>1&&(past.current.length>30||total>12*1024*1024)){const removed=past.current.shift()!;total-=bytes(removed.before)+bytes(removed.after);}
    future.current=[];setHistoryCount([past.current.length,0]);
  };
  const begin=(e:React.SyntheticEvent)=>{
    if((e.target as HTMLElement).closest?.('[data-history]'))return;
    if(e.type==="pointerdown")activePointer.current=true;
    if(pending.current)commit();pending.current=captureRef.current();
  };
  const end=()=>{activePointer.current=false;if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>{commit();refreshControls(v=>v+1);},60);};
  const restore=(v:Snapshot)=>{
    setQuality(v.quality);if(["body","skirt","pants"].includes(v.preset))setShowMannequin(v.settings.mannequin);
    const s=v.settings;setParts(s.parts??{...DEFAULT_PARTS});restorePending.current=v.runtime;
    setBody(structuredClone(s.body));setTheme(s.theme);setSkirt({...s.skirt});setLegs(structuredClone(s.legs));
    setPreset(v.preset);setPin(v.pin);setReleased(v.released);setMaterial(s.material);setColor(s.color);
    setWindEnabled(s.windEnabled);setWindHeight(s.windHeight);setWind(s.wind);setWindAngle(s.windAngle);setWindElevation(s.windElevation);setGravity(s.gravity);setStiffness(s.stiffness);
    setSelfCollision(s.selfCollision);setSleeve({...s.sleeve});setSphere({...s.sphere});setBox({...s.box});
    setWireframe(s.wireframe);setPaused(s.paused);setSelected(s.selected);setDragPlane(s.dragPlane);
    setDiffuse({...s.diffuse});setDirectional({...s.directional});setResetTick(t=>t+1);
  };
  const undo=()=>{commit();const entry=past.current.pop();if(!entry)return;future.current.push(entry);restore(entry.before);setHistoryCount([past.current.length,future.current.length]);};
  const redo=()=>{commit();const entry=future.current.pop();if(!entry)return;past.current.push(entry);restore(entry.after);setHistoryCount([past.current.length,future.current.length]);};
  const deletePin=()=>{if(!pending.current)pending.current=captureRef.current();engineRef.current?.removePin();end();};
  const historyKeys=useRef({undo,redo,deletePin});historyKeys.current={undo,redo,deletePin};
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(!activeRef.current)return;if((e.key==="Delete"||e.key==="Backspace")&&!(e.target as HTMLElement).closest("input,textarea,select")){e.preventDefault();historyKeys.current.deletePin();return;}if(!(e.ctrlKey||e.metaKey))return;if(e.key.toLowerCase()==="z"){e.preventDefault();e.shiftKey?historyKeys.current.redo():historyKeys.current.undo();}else if(e.key.toLowerCase()==="y"){e.preventDefault();historyKeys.current.redo();}};window.addEventListener("keydown",key);return()=>{window.removeEventListener("keydown",key);if(timer.current)clearTimeout(timer.current);};},[]);

  useEffect(() => {
    if (!hostRef.current) return;
    if (!webglAvailable()) {
      setGlError("Ваш браузер или устройство не поддерживает WebGL, поэтому 3D-сцена не может быть показана.");
      return;
    }
    try {
      engineRef.current = new ClothEngine(hostRef.current, settingsRef.current, (f) => {if(fpsRef.current)fpsRef.current.textContent=f.toFixed(0);}, (p)=>{
        if(p.body)setBody(p.body);if(p.legs)setLegs(p.legs);if(p.windHeight!==undefined)setWindHeight(p.windHeight);
        if(p.diffuse)setDiffuse(p.diffuse);if(p.directional)setDirectional(p.directional);
        if(p.sphere)setSphere(p.sphere);if(p.box)setBox(p.box);
        if(p.windAngle!==undefined)setWindAngle(p.windAngle);
        if(p.windElevation!==undefined)setWindElevation(p.windElevation);
        if(p.sleeve)setSleeve(p.sleeve);if(p.selected){setSelected(p.selected);if(p.selected==="leftLeg"||p.selected==="rightLeg")setLegSide(p.selected==="leftLeg"?"left":"right");if(p.selected==="leftBodyArm"||p.selected==="rightBodyArm")setArmSide(p.selected==="leftBodyArm"?"left":"right");}
      });
    } catch (e) {
      console.error(e);
      setGlError("Не удалось инициализировать WebGL. Попробуйте обновить страницу или включить аппаратное ускорение.");
    }
    return () => {
      buildWorker.current?.terminate();buildWorker.current=null;
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.applySettings(preparingRef.current?{...settings,paused:true}:settings);
  }, [settings]);

  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;
    setRotateMode(false);
    const id=++buildSequence.current;
    let cancelled=false,finishFrame=0;
    preparingRef.current=true;setPreparing(true);setBuildError('');
    eng.applySettings({...settingsRef.current,paused:true});
    const fail=()=>{if(cancelled)return;preparingRef.current=false;setPreparing(false);setBuildError('Не удалось подготовить одежду. Попробуйте ещё раз.');eng.applySettings(settingsRef.current);buildWorker.current?.terminate();buildWorker.current=null;};
    // Coalesce rapid slider changes and let the loading indicator paint first.
    const timer=window.setTimeout(()=>{
      try {
        const worker=buildWorker.current??(buildWorker.current=new Worker(new URL('../lib/cloth/build.worker.ts',import.meta.url),{type:'module'}));
        worker.onerror=fail;
        worker.onmessage=(event:MessageEvent<{id:number;build:ClothBuild;error?:string}>)=>{
          if(cancelled||event.data.id!==id)return;
          if(event.data.error){fail();return;}
          const build=event.data.build,current=settingsRef.current;
          // A root change while preparing must not leave clothes at the old pelvis.
          if(current.mannequin){const delta=[current.legs.x-legs.x,current.legs.y-legs.y,current.legs.z-legs.z];for(let i=0;i<build.x.length;i++)build.x[i]+=delta[i%3];}
          try {eng.load(build,{legs,body});setMeshCount(build.index.length/3);
            if(centerAfterBuild.current){eng.resetCamera();centerAfterBuild.current=false;}
            if(restorePending.current){eng.restoreRuntime(restorePending.current);restorePending.current=null;}
            else setReleased(false);
            finishFrame=requestAnimationFrame(()=>{if(cancelled)return;preparingRef.current=false;eng.applySettings(settingsRef.current);setPreparing(false);});
          }catch{fail();}
        };
        worker.postMessage({id,args:[preset,pin,sleeve,skirt,legs,body,quality]});
      }catch{fail();}
    },60);
    return ()=>{cancelled=true;clearTimeout(timer);cancelAnimationFrame(finishFrame);};
  }, [quality,preset, pin, resetTick, glError, sleeve.length, sleeve.ease, skirt.length,skirt.width,skirt.style,skirt.folds,legs.length,legs.ease,body.on,body.sleeves,body.arms,body.tunic,body.length,body.ease,body.cape,body.capeLength,body.hood]);

  const choosePreset = (id: PresetId) => {
    setRotateMode(false);engineRef.current?.setRotationMode(false);
    const p = PRESETS.find((x) => x.id === id)!;
    setPreset(id);if(id==="body")setBody(b=>({...b,on:true}));
    setSelected(id==="sleeve"?"arm":"cloth");
    setPin(p.defaultPin);
    setSphere(p.sphere);
    setBox(p.box);
    setResetTick((t) => t + 1);
  };

  const resetAll = () => {
    setParts({...DEFAULT_PARTS});setRotateMode(false);engineRef.current?.setRotationMode(false);
    const standard = PRESETS.find(p => p.id === "wide")!;
    setBody(structuredClone(DEFAULT_BODY));setTheme("light");setSkirt({...DEFAULT_SKIRT});setLegs(structuredClone(DEFAULT_LEGS));
    setPreset("wide"); setPin("two"); setMaterial("cotton");
    setWindEnabled(true);setWindHeight(1.05);setColor("#c0603d"); setWind(2.2); setWindAngle(15); setWindElevation(0);
    setGravity(9.81); setStiffness(1); setSelfCollision(true);
    setSleeve({...DEFAULT_SLEEVE}); setSphere({...standard.sphere}); setBox({...standard.box});
    setWireframe(false); setPaused(false); setReleased(false);
    setDiffuse({...DEFAULT_DIFFUSE});setDirectional({...DEFAULT_DIRECTIONAL});
    setSelected("cloth"); setDragPlane("view"); setPanelOpen(false);
    setResetTick(t => t + 1);
    engineRef.current?.resetCamera();
  };

  const selectLeg=(mode:Side|"both")=>{const side=mode==="both"?legSide:mode;setLegSide(side);setLegs(l=>({...l,linked:mode==="both"}));setSelected(side==="left"?"leftLeg":"rightLeg");};
  const selectArm=(mode:Side|"both")=>{const side=mode==="both"?armSide:mode;setArmSide(side);setBody(b=>({...b,linked:mode==="both"}));setSelected(side==="left"?"leftBodyArm":"rightBodyArm");};
  useEffect(()=>{if(["leftLeg","rightLeg","leftBodyArm","rightBodyArm","torso","head","legs","shoulder","arm"].includes(selected))setPanelTab("pose");else if(["diffuse","directional","sphere","box","wind","pins"].includes(selected))setPanelTab("scene");else setPanelTab("clothes");},[selected]);

  const visibleParts=Object.fromEntries(Object.keys(parts).map(k=>[k,mannequin&&showMannequin&&parts[k as BodyPart]&&(k.includes('Leg')?legs.on:k==='pelvis'?true:k.includes('Arm')?body.on&&body.arms:body.on)])) as BodyParts;
  const setBodyParts=(next:BodyParts)=>{setParts(next);setShowMannequin(true);setLegs(l=>({...l,on:true}));setBody(b=>({...b,on:true,arms:true}));if(!mannequin)choosePreset('body');};
  const togglePart=(part:BodyPart)=>setBodyParts({...visibleParts,[part]:!visibleParts[part]});
  useEffect(()=>{engineRef.current?.setRotationMode(rotateMode);},[rotateMode,selected]);
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground" onPointerDownCapture={begin} onPointerUpCapture={end} onPointerCancelCapture={end} onInputCapture={e=>{if(!pending.current)begin(e);if(!activePointer.current)end();}} onKeyDownCapture={e=>{if(!e.ctrlKey&&!e.metaKey)begin(e);}} onKeyUpCapture={end}>
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[17px] font-semibold tracking-tight">Складка</span>
          <img src="./icon.svg" width="25" height="25" alt="" className="order-first self-center"/>
        </div>
        <div className="flex items-center gap-3">
          <button className="lab-btn" onClick={onWorkspace}>Композиция</button>
          <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
            {def.label} · {MATERIALS[material].label}
          </span>
          <button type="button" className="lab-btn icon-btn" title={theme==="dark"?"СВЕТЛАЯ ТЕМА":"ТЁМНАЯ ТЕМА"} aria-label="Тёмная тема" aria-pressed={theme==="dark"} onClick={()=>setTheme(t=>t==="light"?"dark":"light")}><Icon name={theme==="dark"?"sun":"moon"}/></button>
          <button type="button" className="lab-btn icon-btn lab-reset" title="СБРОСИТЬ ВСЁ" aria-label="Сбросить всё" onClick={resetAll}><Icon name="resetScene"/></button>
          <button type="button" className="lab-btn icon-btn lg:hidden" title="ПАРАМЕТРЫ" aria-label="Параметры" onClick={() => setPanelOpen((v) => !v)} aria-expanded={panelOpen}>
            <Icon name="settings"/>
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <div ref={hostRef} className="absolute inset-0" aria-busy={preparing} />
            {preparing&&!glError&&<div className="absolute inset-0 z-30 cursor-progress"><div className="scene-loading" role="status" aria-live="polite"><span className="scene-spinner" aria-hidden="true"/>Подготавливаем сцену</div></div>}
            {buildError&&<div className="scene-loading z-30" role="alert">{buildError}<button className="lab-btn" onClick={()=>setResetTick(t=>t+1)}>Повторить</button></div>}
            {glError && (
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="max-w-sm rounded-lg border border-border bg-card p-5 text-sm">
                  <h2 className="mb-2 font-display text-base font-semibold">3D недоступно</h2>
                  <p className="text-muted-foreground">{glError}</p>
                </div>
              </div>
            )}
            <div className="absolute left-3 top-3 flex max-w-[calc(100%-24px)] flex-wrap gap-1 bg-card/95 p-1">
              {([{id:"cloth",label:"Ткань"},{id:"pins",label:"Крепления"},{id:"sphere",label:"Шар"},{id:"box",label:"Куб"},{id:"wind",label:"Ветер"},{id:"diffuse",label:"Рассеянный свет"},{id:"directional",label:"Направленный свет"},...(mannequin?[{id:"legs",label:"Таз"}]:[]),...(preset==="sleeve"?[{id:"shoulder",label:"Плечо"},{id:"arm",label:"Локоть"}]:[])] as {id:Selection;label:string}[]).map(o=><button key={o.id} className={`lab-btn ${["diffuse","directional","legs"].includes(o.id)?"icon-btn":""}`} title={o.label.toUpperCase()} aria-label={o.label} data-selected={selected===o.id} onClick={()=>{setSelected(o.id);if(o.id==="sphere")setSphere({...sphere,on:true});if(o.id==="box")setBox({...box,on:true});}}>{["diffuse","directional","legs"].includes(o.id)?<Icon name={o.id==="legs"?"pelvis":o.id}/>:o.label}</button>)}
              {["cloth","box","sphere"].includes(selected)&&<button className="lab-btn icon-btn" title="ВРАЩАТЬ ВЫБРАННЫЙ ОБЪЕКТ" aria-label="Вращать выбранный объект" aria-pressed={rotateMode} data-selected={rotateMode} onClick={()=>setRotateMode(v=>!v)}><Icon name="rotate"/></button>}
              {(preset==="skirt"||preset==="pants")&&<LimbButtons kind="Leg" side={legSide} linked={legs.linked} onSelect={selectLeg}/>}
              <button className="lab-btn icon-btn" title="ЧАСТИ МАНЕКЕНА" aria-label="Части манекена" data-selected={panelTab==="pose"} onClick={()=>{setPanelOpen(true);setPanelTab("pose");}}><Icon name="body"/></button>
              {mannequin&&body.on&&body.arms&&<LimbButtons kind="BodyArm" side={armSide} linked={body.linked} onSelect={selectArm}/>}
              <button className="lab-btn icon-btn" title={windEnabled?"ВЫКЛЮЧИТЬ ВЕТЕР":"ВКЛЮЧИТЬ ВЕТЕР"} aria-label={windEnabled?"Выключить ветер":"Включить ветер"} aria-pressed={windEnabled} data-selected={windEnabled} onClick={()=>setWindEnabled(v=>!v)}><Icon name="windPower"/></button>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-t border-border bg-card px-3 py-2">
            <button type="button" className="lab-btn icon-btn" title="ОТМЕНИТЬ" aria-label="Отменить" data-history disabled={!historyCount[0]} onClick={undo}><Icon name="undo"/></button>
            <button type="button" className="lab-btn icon-btn" title="ВЕРНУТЬ" aria-label="Вернуть" data-history disabled={!historyCount[1]} onClick={redo}><Icon name="redo"/></button>
            <button type="button" className="lab-btn icon-btn" title={paused?"ПРОДОЛЖИТЬ":"ПАУЗА"} aria-label={paused?"Продолжить":"Пауза"} data-primary onClick={() => setPaused((p) => !p)}>
              <Icon name={paused?"play":"pause"}/>
            </button>
            <button type="button" className="lab-btn icon-btn" aria-label="Один кадр" disabled={!paused} onClick={() => engineRef.current?.stepOnce()} title="ДОСТУПНО НА ПАУЗЕ">
              <Icon name="step"/>
            </button>
            <button type="button" className="lab-btn icon-btn" title="ПЕРЕЗАПУСТИТЬ ТКАНЬ" aria-label="Перезапустить ткань" onClick={() => setResetTick((t) => t + 1)}>
              <Icon name="resetCloth"/>
            </button>
            <button type="button" className="lab-btn icon-btn" title="ОТПУСТИТЬ ВСЕ ОПОРЫ" aria-label="Отпустить все опоры" disabled={released} onClick={() => { engineRef.current?.releasePins(); setReleased(true); }}>
              <Icon name="release"/>
            </button>
            <button type="button" className="lab-btn icon-btn" title="ЦЕНТРИРОВАТЬ КАМЕРУ" aria-label="Центрировать камеру" onClick={() => engineRef.current?.resetCamera()}>
              <Icon name="camera"/>
            </button>
            <button type="button" className="lab-btn icon-btn" title="НА ПОЛ · ВЫБРАННЫЙ ОБЪЕКТ" aria-label="Опустить выбранный объект на пол" onClick={()=>engineRef.current?.floorSelected()}><Icon name="floor"/></button>
            <button type="button" className="lab-btn icon-btn" title="СОХРАНИТЬ PNG" aria-label="Сохранить PNG" onClick={() => engineRef.current?.snapshot()}>
              <Icon name="save"/>
            </button>
            <div className="ml-auto flex items-center gap-3 font-mono text-[11px] text-muted-foreground">

              <span>
                <span ref={fpsRef} className="text-foreground">0</span> FPS
              </span>
            </div>
          </div>
        </main>

        <PanelContext.Provider value={panelTab}><aside
          className={`${panelOpen ? "flex" : "hidden"} absolute inset-y-0 right-0 z-20 w-[300px] max-w-[90vw] flex-col overflow-y-auto border-l border-border bg-card lg:static lg:flex`}
        >
          <div className="sticky top-0 z-10 border-b border-border bg-card p-3 space-y-2">
            <BodyMap parts={visibleParts} onToggle={togglePart} onAll={on=>on?setBodyParts({...DEFAULT_PARTS}):setShowMannequin(false)}/>
            <div className="grid grid-cols-4 gap-1" role="tablist" aria-label="Настройки">{([{id:"clothes",label:"Одежда"},{id:"pose",label:"Поза"},{id:"scene",label:"Сцена"},{id:"physics",label:"Физика"}] as const).map(t=><button key={t.id} role="tab" aria-selected={panelTab===t.id} className="lab-btn" data-selected={panelTab===t.id} onClick={()=>setPanelTab(t.id)}>{t.label}</button>)}</div>
            {panelTab==="pose"&&mannequin&&body.on&&<button className="lab-btn w-full" onClick={()=>setBody({...body,torsoPitch:0,torsoLean:0,headPitch:0,headLean:0,left:{...DEFAULT_BODY.left},right:{...DEFAULT_BODY.right}})}>Сбросить позу туловища</button>}
          </div>
          {panelTab==='scene'&&<div className="px-3 pt-3"><p className="lab-label mb-2">Освещение</p><div className="grid grid-cols-2 gap-1"><button className="lab-btn" data-selected={selected==='diffuse'} onClick={()=>setSelected('diffuse')}>Рассеянный</button><button className="lab-btn" data-selected={selected==='directional'} onClick={()=>setSelected('directional')}>Направленный</button></div></div>}
          {rotateMode&&selected==='cloth'&&mannequin&&<p className="px-3 py-2 text-xs text-muted-foreground">Поворот отделяет ткань от креплений к телу. Сброс ткани возвращает посадку.</p>}
          <Section title="Качество"><Seg options={[{id:"0.6",label:"Лёгкая"},{id:"0.8",label:"Средняя"},{id:"1",label:"Детальная"}]} value={String(quality)} onChange={v=>setQuality(Number(v))}/><p className="text-xs text-muted-foreground">{meshCount.toLocaleString("ru-RU")} треугольников</p></Section>
          {selected==="wind" && <Section title="Направление ветра" aside={<Toggle checked={windEnabled} onChange={setWindEnabled} label="Ветер"/>}>
            <Slider label="Наклон ветра" value={windElevation} min={-90} max={90} step={1} unit="°" digits={0} onChange={setWindElevation}/>
            <Slider label="Высота указателя" value={windHeight} min={0} max={3} step={.05} unit=" м" onChange={setWindHeight}/>
            <div className="wind-arrows">
              {[{id:"up",icon:"↑",label:"Вверх"},{id:"left",icon:"←",label:"Влево"},{id:"right",icon:"→",label:"Вправо"},{id:"down",icon:"↓",label:"Вниз"},{id:"toward",icon:"⊙",label:"К себе"},{id:"away",icon:"⊗",label:"От себя"}].map(d=><button key={d.id} className={`wind-direction wind-${d.id}`} aria-label={d.label} aria-pressed={engineRef.current?.isWindDirection(d.id)??false} onClick={()=>engineRef.current?.windDirection(d.id)}><span aria-hidden="true">{d.icon}</span><small>{d.label}</small></button>)}
            </div>
          </Section>}
          {selected==="pins" && <Section title="Крепления">
            {(engineRef.current?.pinGroups??[]).map((g,i)=><div className="flex items-center justify-between" key={i}>
              <button className="lab-btn" data-selected={engineRef.current?.selectedPin===i} onClick={()=>{if(engineRef.current){engineRef.current.selectedPin=i;engineRef.current.invalidate();}refreshControls(v=>v+1);}}>Опора {i+1}</button>
              <button className="lab-btn icon-btn" title="УДАЛИТЬ ОПОРУ" aria-label={`Удалить опору ${i+1}`} onClick={()=>engineRef.current?.removePin(i)}><Icon name="trash"/></button>
            </div>)}
          </Section>}
          {(selected==="diffuse"||selected==="directional") && <Section title={selected==="diffuse"?"Рассеянный свет":"Направленный свет"}>
            {(()=>{const light=selected==="diffuse"?diffuse:directional;const set=selected==="diffuse"?setDiffuse:setDirectional;return <>
              <div className="flex justify-between items-center"><Toggle checked={light.on} onChange={on=>set({...light,on})} label="Свет"/><input type="color" aria-label="Цвет света" value={light.color} onChange={e=>set({...light,color:e.target.value})}/></div>
              <Slider label="Яркость" value={light.intensity} min={0} max={6} step={.1} digits={1} onChange={intensity=>set({...light,intensity})}/>
              {(["x","y","z"] as const).map(axis=><Slider key={axis} label={axis} value={light[axis]} min={axis==="y"?0:-5} max={axis==="y"?6:5} step={.05} onChange={v=>set({...light,[axis]:v})}/>)}
            </>;})()}
          </Section>}
          <div className="px-3 py-2 border-b border-border"><label className="lab-label" htmlFor="garment-preset">Форма</label><select id="garment-preset" className="w-full mt-1 rounded border border-border bg-card px-2 py-2 text-sm" value={preset} onChange={e=>choosePreset(e.target.value as PresetId)}>{PRESETS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></div>

          {preset==="skirt"&&<Section title="Юбка">
            <Seg options={[{id:"pencil",label:"Карандаш"},{id:"half",label:"Полусолнце"},{id:"pleated",label:"Плиссе"}]} value={skirt.style} onChange={style=>setSkirt({...skirt,style})}/>
            <Slider label="Длина" value={skirt.length} min={.3} max={2} step={.01} unit=" м" onChange={length=>setSkirt({...skirt,length})}/>
            <Slider label="Ширина" value={skirt.width} min={.85} max={1.8} step={.01} unit="×" onChange={width=>setSkirt({...skirt,width})}/>
            {skirt.style==="pleated"&&<Slider label="Складки" value={skirt.folds} min={6} max={32} step={1} digits={0} onChange={folds=>setSkirt({...skirt,folds})}/>}
          </Section>}
          {mannequin&&<>
            <Section title="Ноги">
              <LimbButtons kind="Leg" side={legSide} linked={legs.linked} onSelect={selectLeg}/>
              {(["hip","knee","spread"] as const).map((key,i)=><Slider key={key} label={["Бедро","Колено","В сторону"][i]} value={legs[legSide][key]} min={key==="hip"?-70:0} max={key==="hip"?100:key==="knee"?135:35} step={1} unit="°" digits={0} onChange={v=>{const pose:LegPose={...legs[legSide],[key]:v};setLegs({...legs,[legSide]:pose,...(legs.linked?{left:pose,right:{...pose}}:{})});}}/>)}
              {(["x","y","z"] as const).map(axis=><Slider key={axis} label={`Таз · ${axis}`} value={legs[axis]} min={axis==="y"?.4:-3} max={3.5} step={.01} unit=" м" onChange={v=>setLegs({...legs,[axis]:v})}/>)}
            </Section>
            {preset==="pants"&&<Section title="Брюки">
              <Slider label="Длина" value={legs.length} min={.5} max={1.85} step={.01} unit=" м" onChange={length=>setLegs({...legs,length})}/>
              <Slider label="Свобода облегания" value={legs.ease} min={.015} max={.22} step={.01} unit=" м" onChange={ease=>setLegs({...legs,ease})}/>
            </Section>}
          </>}
          {mannequin&&body.on&&<>
            <Section title="Туловище">
              {(["torsoPitch","torsoLean","headPitch","headLean"] as const).map((key,i)=><Slider key={key} label={["Туловище · вперёд","Туловище · в сторону","Голова · вперёд","Голова · в сторону"][i]} value={body[key]} min={i%2?-35:-45} max={i%2?35:55} step={1} unit="°" digits={0} onChange={v=>setBody({...body,[key]:v})}/>)}
            </Section>
            <Section title="Одежда туловища">
              <div className="grid grid-cols-3 gap-1">{([{key:"tunic",label:"Кофта"},{key:"sleeves",label:"Рукава"},{key:"cape",label:"Плащ"}] as const).map(item=><button className="lab-btn" key={item.key} aria-pressed={body[item.key]} data-selected={body[item.key]} onClick={()=>setBody({...body,[item.key]:!body[item.key],...(item.key==="sleeves"&&!body.sleeves?{tunic:true,arms:true}:{})})}>{item.label}</button>)}</div>
              {body.tunic&&<><Slider label="Длина кофты" value={body.length} min={.45} max={1.8} step={.01} unit=" м" onChange={length=>setBody({...body,length})}/><Slider label="Свобода облегания" value={body.ease} min={.025} max={.28} step={.005} unit=" м" onChange={ease=>setBody({...body,ease})}/></>}
              {body.cape&&<><Slider label="Длина плаща" value={body.capeLength} min={.45} max={2.5} step={.01} unit=" м" onChange={capeLength=>setBody({...body,capeLength})}/><Seg options={[{id:"up",label:"Капюшон надет"},{id:"down",label:"Опущен"}]} value={body.hood} onChange={hood=>setBody({...body,hood})}/></>}
            </Section>
            <Section title="Руки">
              <LimbButtons kind="BodyArm" side={armSide} linked={body.linked} onSelect={selectArm}/>
              {(["raise","forward","elbow"] as const).map((key,i)=><Slider key={key} label={["В сторону","Вперёд","Локоть"][i]} value={body[armSide][key]} min={key==="forward"?-80:0} max={key==="elbow"?140:key==="forward"?120:100} step={1} unit="°" digits={0} onChange={v=>{const pose={...body[armSide],[key]:v};setBody({...body,[armSide]:pose,...(body.linked?{left:pose,right:{...pose}}:{})});}}/>)}
            </Section>
            {preset==="body"&&<Section title="Таз">{(["x","y","z"] as const).map(axis=><Slider key={axis} label={axis} value={legs[axis]} min={axis==="y"?.4:-3} max={3.5} step={.01} onChange={v=>setLegs({...legs,[axis]:v})}/>)}</Section>}
          </>}
          {def.rect && <Section title="Крепление">
            <Seg options={(Object.keys(PIN_LABELS) as PinMode[]).map((id) => ({ id, label: PIN_LABELS[id] }))} value={pin} onChange={setPin} />
          </Section>}
          {preset==="sleeve" && <Section title="Плечо">
            {(["X","Y","Z"] as const).map(axis=>{const key=`shoulder${axis}` as "shoulderX"|"shoulderY"|"shoulderZ";return <Slider key={axis} label={axis} value={sleeve[key]??(axis==="X"?-.85:axis==="Y"?1.65:0)} min={axis==="Y"?.5:-3} max={3.5} step={.01} onChange={v=>setSleeve({...sleeve,[key]:v})}/>;})}
            <Slider label="Подъём плеча" value={sleeve.shoulderPitch??0} min={-80} max={80} step={1} unit="°" digits={0} onChange={shoulderPitch=>setSleeve({...sleeve,shoulderPitch})}/>
            <Slider label="Разворот плеча" value={sleeve.shoulderYaw??0} min={-180} max={180} step={1} unit="°" digits={0} onChange={shoulderYaw=>setSleeve({...sleeve,shoulderYaw})}/>
          </Section>}
          {preset==="sleeve" && <Section title="Рукав">
            <Slider label="Длина" value={sleeve.length} min={.5} max={2.1} step={.01} unit=" м" onChange={length=>setSleeve({...sleeve,length})}/>
            <Slider label="Свобода облегания" value={sleeve.ease} min={.04} max={.35} step={.01} unit=" м" onChange={ease=>setSleeve({...sleeve,ease})}/>
            <Slider label="Локоть" value={sleeve.angle} min={-65} max={140} step={1} digits={0} unit="°" onChange={angle=>setSleeve({...sleeve,angle})}/>
          </Section>}
          {(selected==="sphere"||selected==="box") && <Section title="Перемещение">
            <Seg options={[{id:"view",label:"По экрану"},{id:"floor",label:"По полу"}]} value={dragPlane} onChange={setDragPlane}/>
          </Section>}

          <Section title="Материал">
            <Seg options={(Object.keys(MATERIALS) as MaterialId[]).map((id) => ({ id, label: MATERIALS[id].label }))} value={material} onChange={setMaterial} />
            <div className="flex items-center gap-1.5 pt-1">
              {SWATCHES.map((c) => (
                <button key={c} type="button" aria-label={`Цвет ${c}`} className="lab-swatch" data-active={color === c} style={{ background: c }} onClick={() => setColor(c)} />
              ))}
              <input type="color" aria-label="Свой цвет" value={color} onChange={(e) => setColor(e.target.value)} className="lab-color ml-auto" />
            </div>
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="text-foreground/80">Каркас</span>
              <Toggle checked={wireframe} onChange={setWireframe} label="Каркас" />
            </div>
          </Section>

          <Section title="Физика">
            <div className="flex items-center justify-between text-[12.5px]"><span>Самоколлизия</span><Toggle checked={selfCollision} onChange={setSelfCollision} label="Самоколлизия" /></div>
            <div className="flex items-center justify-between"><span>Ветер</span><Toggle checked={windEnabled} onChange={setWindEnabled} label="Ветер"/></div>
            <Slider label="Скорость ветра" value={wind} min={0} max={20} step={0.1} unit=" м/с" digits={1} onChange={setWind} />
            <Slider label="Азимут" value={windAngle} min={-180} max={180} step={1} unit="°" digits={0} onChange={setWindAngle} />
            <Slider label="Наклон ветра" value={windElevation} min={-90} max={90} step={1} unit="°" digits={0} onChange={setWindElevation} />
            <Slider label="Гравитация" value={gravity} min={0} max={20} step={0.01} unit=" м/с²" onChange={setGravity} />
            <Slider label="Жёсткость" value={stiffness} min={0.2} max={3} step={0.01} unit="×" onChange={setStiffness} />
          </Section>

          <Section title="Шар" aside={<Toggle checked={sphere.on} onChange={(on) => setSphere({ ...sphere, on })} label="Шар" />}>
            <ColliderControls c={sphere} set={setSphere} sizeLabel="Радиус" max={1.2} />
          </Section>

          <Section title="Куб" aside={<Toggle checked={box.on} onChange={(on) => setBox({ ...box, on })} label="Куб" />}>
            <ColliderControls c={box} set={setBox} sizeLabel="Ребро" max={1.6} />
          </Section>


        </aside></PanelContext.Provider>
      </div>
    </div>
  );
}


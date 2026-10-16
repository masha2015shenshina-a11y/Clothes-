import { LanguageSwitch } from './LanguageSwitch';
import { t as tr, useLanguage } from '../lib/i18n';
import { useEffect, useRef, useState } from 'react';
import { CompositionWorkspace, DEFAULT_WORKSPACE_LIGHTING, PARTS, type Part, type ItemInfo } from '../lib/cloth/workspace';
import { DEFAULT_SHEET, MATERIALS, type MaterialId, type PresetId } from '../lib/cloth/presets';
export default function Workspace({ active, onLab }: {
    active: boolean;
    onLab: () => void;
}) {
 useLanguage();
    const host = useRef<HTMLDivElement>(null), engine = useRef<CompositionWorkspace | null>(null), fps = useRef<HTMLSpanElement>(null);
    const [items, setItems] = useState<ItemInfo[]>([]), [selected, setSelected] = useState(0), [part, setPart] = useState<Part>('root');
    const [preset, setPreset] = useState<PresetId>('two'), [material, setMaterial] = useState<MaterialId>('cotton'), [color, setColor] = useState('#c0603d');
    const [sheet,setSheet]=useState({...DEFAULT_SHEET});
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [paused, setPaused] = useState(false), [wind, setWind] = useState(false), [mode, setMode] = useState<'translate' | 'rotate'>('translate'), [panel, setPanel] = useState(() => window.innerWidth >= 1024);
    useEffect(() => { if (!host.current)
        return; try {
        engine.current = new CompositionWorkspace(host.current, (list, id, p) => { setItems(list); setSelected(id); setPart(p); }, v => { if (fps.current)
            fps.current.textContent = v.toFixed(0); });
    }
    catch {
        setError('Не удалось открыть 3D-стол.');
    } return () => { engine.current?.dispose(); engine.current = null; }; }, []);
    useEffect(() => { const e = engine.current; if (e) {
        e.paused = paused || !active;
        e.wind = wind ? 5 : 0;
        e.invalidate();
    } }, [paused, active, wind]);
    const [lighting,setLighting]=useState({...DEFAULT_WORKSPACE_LIGHTING});
    const [lightingOpen,setLightingOpen]=useState(false);
    useEffect(()=>{engine.current?.setLighting(lighting);},[lighting]);
    const item = items.find(i => i.id === selected);
    const addCloth = async () => { setBusy(true); setError(''); try {
        await engine.current?.addCloth(preset, material, color,sheet);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Не удалось добавить ткань');
    }
    finally {
        setBusy(false);
    } };
    const addBody = () => { setError(''); try {
        engine.current?.addBody();
    }
    catch (e) {
        setError((e as Error).message);
    } };
    const addSolid=(kind:'box'|'sphere')=>{setError('');try{engine.current?.addSolid(kind);}catch(e){setError((e as Error).message);}};
    const materialOptions = Object.entries(MATERIALS).map(([id, m]) => <option value={id} key={id}>{tr(m.label)}</option>);
    return <div className="flex h-dvh flex-col bg-background text-foreground">
  <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border px-3"><img src="./icon.svg" width="25" height="25" alt=""/><b className="font-display">Skladka</b><button className="lab-btn" onClick={onLab}>{tr("Лаборатория")}</button><span className="text-xs">{tr("Композиция")}</span><button className="lab-btn ml-auto" onClick={() => setPanel(v => !v)} aria-expanded={panel}>{tr("Объекты · ")}{tr(items.length)}</button><LanguageSwitch/></header>
  <div className="relative flex min-h-0 flex-1">
   <main className="relative min-w-0 flex-1"><div ref={host} className="absolute inset-0"/>
    <div className="absolute left-3 top-3 flex flex-wrap gap-1 bg-card/95 p-1"><button className="lab-btn" onClick={() => setPaused(v => !v)}>{tr(paused ? 'Продолжить' : 'Пауза')}</button><button className="lab-btn" aria-pressed={wind} data-selected={wind} onClick={() => setWind(v => !v)}>{tr("Ветер ")}{tr(wind ? 'вкл' : 'выкл')}</button>{tr(item && (item.kind === 'cloth'||part==='root') && (['translate', 'rotate'] as const).map(m => <button key={m} className="lab-btn" data-selected={mode === m} onClick={() => { setMode(m); engine.current?.setMode(m); }}>{tr(m === 'translate' ? 'Перемещение' : 'Поворот')}</button>))}<button className="lab-btn" onClick={()=>{setPanel(true);setLightingOpen(v=>!v);}}>{tr("Свет")}</button></div>
    {tr(!items.length && !busy && <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="max-w-xs bg-card/90 p-5 text-center"><h2 className="font-display text-xl">{tr("Рабочий стол")}</h2><p className="mt-2 text-sm text-muted-foreground">{tr("Добавьте ткани и манекен. Выберите объект или часть тела, затем потяните цветную ось.")}</p></div></div>)}
    {tr(busy && <div className="scene-loading" role="status"><span className="scene-spinner"/>{tr("Готовим ткань")}</div>)}
    <div className="absolute bottom-3 left-3 bg-card/90 px-3 py-2 text-xs text-muted-foreground">X <span style={{ color: '#c44339' }}>●</span> · Y <span style={{ color: '#4c9838' }}>●</span> · Z <span style={{ color: '#3875c9' }}>●</span> <span className="ml-3" ref={fps}>0</span> FPS</div>
   </main>
   {tr(panel && <aside className="absolute right-0 inset-y-0 z-20 w-[270px] max-w-[85vw] overflow-y-auto border-l border-border bg-card p-3 lg:static">
    <h2 className="lab-label mb-3">{tr("Добавить на стол")}</h2>
    <div className="space-y-2">
     <label className="block text-xs">{tr("Форма")}<select aria-label={tr("Форма ткани")} className="workspace-select" value={preset} onChange={e => setPreset(e.target.value as PresetId)}><option value="two">{tr("Полотно")}</option><option value="ribbons">{tr("Ленты")}</option><option value="tube">{tr("Цилиндр")}</option></select></label>
     {preset==='two'&&<div className="space-y-2">{(['width','length'] as const).map(key=><label className="block text-xs" key={key}>{tr(key==='width'?'Ширина':'Длина')} · {sheet[key].toFixed(2)} {tr('м')}<input className="lab-range" type="range" min=".3" max="4" step=".05" value={sheet[key]} onChange={e=>setSheet({...sheet,[key]:+e.target.value})}/></label>)}</div>}
     <div className="flex gap-2"><select aria-label={tr("Материал новой ткани")} className="workspace-select" value={material} onChange={e => setMaterial(e.target.value as MaterialId)}>{tr(materialOptions)}</select><input aria-label={tr("Цвет новой ткани")} type="color" className="h-8 w-10" value={color} onChange={e => setColor(e.target.value)}/></div>
     <button className="lab-btn w-full" disabled={busy || items.filter(i => i.kind === 'cloth').length >= 6} onClick={addCloth}>{tr("+ Ткань")}</button><button className="lab-btn w-full" disabled={items.filter(i => i.kind === 'body').length >= 3} onClick={addBody}>{tr("+ Отдельный манекен")}</button>
     <div className="flex gap-2"><button className="lab-btn flex-1" onClick={()=>addSolid('box')}>+ {tr('Куб')}</button><button className="lab-btn flex-1" onClick={()=>addSolid('sphere')}>+ {tr('Шар')}</button></div>
    </div>
    {tr(error && <p className="my-3 text-xs text-red-700" role="alert">{tr(error)}</p>)}
    <details className="my-4 border-y border-border py-3" open={lightingOpen} onToggle={e=>setLightingOpen(e.currentTarget.open)}><summary className="lab-label cursor-pointer">{tr("Освещение")}</summary><div className="mt-3 space-y-3">
      {tr((['ambient','key'] as const).map(id=><div key={id}><div className="flex items-center gap-2 text-xs"><input type="checkbox" aria-label={tr(id==='ambient'?'Рассеянный свет':'Направленный свет')} checked={lighting[id==='ambient'?'ambientOn':'keyOn']} onChange={e=>setLighting({...lighting,[id==='ambient'?'ambientOn':'keyOn']:e.target.checked})}/><span>{tr(id==='ambient'?'Рассеянный':'Направленный')}</span><input type="color" className="ml-auto h-6 w-8" aria-label={tr("Цвет света")} value={lighting[id==='ambient'?'ambientColor':'keyColor']} onChange={e=>setLighting({...lighting,[id==='ambient'?'ambientColor':'keyColor']:e.target.value})}/></div><label className="block mt-2 text-xs">{tr("Яркость · ")}{tr(lighting[id].toFixed(1))}<input className="lab-range" type="range" min="0" max="6" step=".1" value={lighting[id]} onChange={e=>setLighting({...lighting,[id]:+e.target.value})}/></label></div>))}
      {tr((['azimuth','elevation'] as const).map(id=><label className="block text-xs" key={id}>{tr(id==='azimuth'?'Направление':'Высота')} · {tr(lighting[id])}°<input className="lab-range" type="range" min={id==='azimuth'?-180:5} max={id==='azimuth'?180:90} value={lighting[id]} onChange={e=>setLighting({...lighting,[id]:+e.target.value})}/></label>))}
    </div></details>
    <h2 className="lab-label mb-2 mt-5">{tr("Объекты")}</h2><div className="space-y-1">{tr(items.map(i => <button key={i.id} className="lab-btn flex w-full justify-between" data-selected={selected === i.id} onClick={() => engine.current?.select(i.id)}><span>{tr(i.name)}</span>{tr(i.color && <span className="h-3 w-3 rounded-full" style={{ background: i.color }}/>)}</button>))}</div>
    {tr(item && <section className="mt-4 border-t border-border pt-3"><h3 className="lab-label mb-2">{tr(item.name)}</h3>{tr(item.kind === 'body' ? <><label className="text-xs">{tr("Часть тела")}<select className="workspace-select" value={part} onChange={e => engine.current?.select(item.id, e.target.value as Part)}>{tr(Object.entries(PARTS).map(([id, label]) => <option value={id} key={id}>{tr(label)}</option>))}</select></label><p className="my-2 text-xs text-muted-foreground">{tr(part === 'root' ? 'Выберите перемещение или поворот в верхней панели.' : 'Кольца вращают выбранный сустав. Можно выбрать часть тела прямо на сцене.')}</p></> : item.kind==='box'||item.kind==='sphere' ? <div className="space-y-3">{(item.kind==='sphere'?['Диаметр']:['Ширина','Высота','Глубина']).map((label,axis)=><label key={axis} className="block text-xs">{tr(label)} · {item.dimensions?.[axis].toFixed(2)} {tr('м')}<input className="lab-range" type="range" min=".1" max="4" step=".01" value={item.dimensions?.[axis]??1} onChange={e=>{const d=[...item.dimensions!] as [number,number,number];d[axis]=+e.target.value;engine.current?.setDimensions(d);}}/></label>)}</div> : <><div className="flex gap-2"><select aria-label={tr("Материал выбранной ткани")} className="workspace-select" value={item.material} onChange={e => engine.current?.setMaterial(e.target.value as MaterialId)}>{tr(materialOptions)}</select><input aria-label={tr("Цвет выбранной ткани")} className="h-8 w-10" type="color" value={item.color} onChange={e => engine.current?.setMaterial(item.material!, e.target.value)}/></div><button className="lab-btn my-2 w-full" onClick={() => engine.current?.release()}>{tr("Отпустить крепления")}</button></>)}
     <button className="lab-btn w-full" onClick={() => engine.current?.remove()}>{tr("Удалить объект")}</button>
    </section>)}
    <p className="mt-5 text-[11px] text-muted-foreground">{tr("До 6 тканей и 3 манекенов. Сцена сохраняется при переключении режимов до перезагрузки страницы. Контакт между полотнами приближённый; начинайте без глубоких пересечений.")}</p>
   </aside>)}
  </div>
 </div>;
}

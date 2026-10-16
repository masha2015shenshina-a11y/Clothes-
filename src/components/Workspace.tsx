import { useEffect, useRef, useState } from 'react';
import { CompositionWorkspace, DEFAULT_WORKSPACE_LIGHTING, PARTS, type Part, type ItemInfo } from '../lib/cloth/workspace';
import { MATERIALS, type MaterialId, type PresetId } from '../lib/cloth/presets';
export default function Workspace({ active, onLab }: {
    active: boolean;
    onLab: () => void;
}) {
    const host = useRef<HTMLDivElement>(null), engine = useRef<CompositionWorkspace | null>(null), fps = useRef<HTMLSpanElement>(null);
    const [items, setItems] = useState<ItemInfo[]>([]), [selected, setSelected] = useState(0), [part, setPart] = useState<Part>('root');
    const [preset, setPreset] = useState<PresetId>('two'), [material, setMaterial] = useState<MaterialId>('cotton'), [color, setColor] = useState('#c0603d');
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
        await engine.current?.addCloth(preset, material, color);
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
    const materialOptions = Object.entries(MATERIALS).map(([id, m]) => <option value={id} key={id}>{m.label}</option>);
    return <div className="flex h-dvh flex-col bg-background text-foreground">
  <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border px-3"><img src="./icon.svg" width="25" height="25" alt=""/><b className="font-display">Складка</b><button className="lab-btn" onClick={onLab}>Лаборатория</button><span className="text-xs">Композиция</span><button className="lab-btn ml-auto" onClick={() => setPanel(v => !v)} aria-expanded={panel}>Объекты · {items.length}</button></header>
  <div className="relative flex min-h-0 flex-1">
   <main className="relative min-w-0 flex-1"><div ref={host} className="absolute inset-0"/>
    <div className="absolute left-3 top-3 flex flex-wrap gap-1 bg-card/95 p-1"><button className="lab-btn" onClick={() => setPaused(v => !v)}>{paused ? 'Продолжить' : 'Пауза'}</button><button className="lab-btn" aria-pressed={wind} data-selected={wind} onClick={() => setWind(v => !v)}>Ветер {wind ? 'вкл' : 'выкл'}</button>{item && (item.kind === 'cloth'||part==='root') && (['translate', 'rotate'] as const).map(m => <button key={m} className="lab-btn" data-selected={mode === m} onClick={() => { setMode(m); engine.current?.setMode(m); }}>{m === 'translate' ? 'Перемещение' : 'Поворот'}</button>)}<button className="lab-btn" onClick={()=>{setPanel(true);setLightingOpen(v=>!v);}}>Свет</button></div>
    {!items.length && !busy && <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="max-w-xs bg-card/90 p-5 text-center"><h2 className="font-display text-xl">Рабочий стол</h2><p className="mt-2 text-sm text-muted-foreground">Добавьте ткани и манекен. Выберите объект или часть тела, затем потяните цветную ось.</p></div></div>}
    {busy && <div className="scene-loading" role="status"><span className="scene-spinner"/>Готовим ткань</div>}
    <div className="absolute bottom-3 left-3 bg-card/90 px-3 py-2 text-xs text-muted-foreground">X <span style={{ color: '#c44339' }}>●</span> · Y <span style={{ color: '#4c9838' }}>●</span> · Z <span style={{ color: '#3875c9' }}>●</span> <span className="ml-3" ref={fps}>0</span> FPS</div>
   </main>
   {panel && <aside className="absolute right-0 inset-y-0 z-20 w-[270px] max-w-[85vw] overflow-y-auto border-l border-border bg-card p-3 lg:static">
    <h2 className="lab-label mb-3">Добавить на стол</h2>
    <div className="space-y-2">
     <label className="block text-xs">Форма<select aria-label="Форма ткани" className="workspace-select" value={preset} onChange={e => setPreset(e.target.value as PresetId)}><option value="two">Полотно</option><option value="wide">Широкое полотно</option><option value="narrow">Узкая ткань</option><option value="ribbons">Ленты</option><option value="free">Свободная ткань</option><option value="tube">Цилиндр</option></select></label>
     <div className="flex gap-2"><select aria-label="Материал новой ткани" className="workspace-select" value={material} onChange={e => setMaterial(e.target.value as MaterialId)}>{materialOptions}</select><input aria-label="Цвет новой ткани" type="color" className="h-8 w-10" value={color} onChange={e => setColor(e.target.value)}/></div>
     <button className="lab-btn w-full" disabled={busy || items.filter(i => i.kind === 'cloth').length >= 6} onClick={addCloth}>+ Ткань</button><button className="lab-btn w-full" disabled={items.filter(i => i.kind === 'body').length >= 3} onClick={addBody}>+ Отдельный манекен</button>
    </div>
    {error && <p className="my-3 text-xs text-red-700" role="alert">{error}</p>}
    <details className="my-4 border-y border-border py-3" open={lightingOpen} onToggle={e=>setLightingOpen(e.currentTarget.open)}><summary className="lab-label cursor-pointer">Освещение</summary><div className="mt-3 space-y-3">
      {(['ambient','key'] as const).map(id=><div key={id}><div className="flex items-center gap-2 text-xs"><input type="checkbox" aria-label={id==='ambient'?'Рассеянный свет':'Направленный свет'} checked={lighting[id==='ambient'?'ambientOn':'keyOn']} onChange={e=>setLighting({...lighting,[id==='ambient'?'ambientOn':'keyOn']:e.target.checked})}/><span>{id==='ambient'?'Рассеянный':'Направленный'}</span><input type="color" className="ml-auto h-6 w-8" aria-label="Цвет света" value={lighting[id==='ambient'?'ambientColor':'keyColor']} onChange={e=>setLighting({...lighting,[id==='ambient'?'ambientColor':'keyColor']:e.target.value})}/></div><label className="block mt-2 text-xs">Яркость · {lighting[id].toFixed(1)}<input className="lab-range" type="range" min="0" max="6" step=".1" value={lighting[id]} onChange={e=>setLighting({...lighting,[id]:+e.target.value})}/></label></div>)}
      {(['azimuth','elevation'] as const).map(id=><label className="block text-xs" key={id}>{id==='azimuth'?'Направление':'Высота'} · {lighting[id]}°<input className="lab-range" type="range" min={id==='azimuth'?-180:5} max={id==='azimuth'?180:90} value={lighting[id]} onChange={e=>setLighting({...lighting,[id]:+e.target.value})}/></label>)}
    </div></details>
    <h2 className="lab-label mb-2 mt-5">Объекты</h2><div className="space-y-1">{items.map(i => <button key={i.id} className="lab-btn flex w-full justify-between" data-selected={selected === i.id} onClick={() => engine.current?.select(i.id)}><span>{i.name}</span>{i.color && <span className="h-3 w-3 rounded-full" style={{ background: i.color }}/>}</button>)}</div>
    {item && <section className="mt-4 border-t border-border pt-3"><h3 className="lab-label mb-2">{item.name}</h3>{item.kind === 'body' ? <><label className="text-xs">Часть тела<select className="workspace-select" value={part} onChange={e => engine.current?.select(item.id, e.target.value as Part)}>{Object.entries(PARTS).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label><p className="my-2 text-xs text-muted-foreground">{part === 'root' ? 'Выберите перемещение или поворот в верхней панели.' : 'Кольца вращают выбранный сустав. Можно выбрать часть тела прямо на сцене.'}</p></> : <><div className="flex gap-2"><select aria-label="Материал выбранной ткани" className="workspace-select" value={item.material} onChange={e => engine.current?.setMaterial(e.target.value as MaterialId)}>{materialOptions}</select><input aria-label="Цвет выбранной ткани" className="h-8 w-10" type="color" value={item.color} onChange={e => engine.current?.setMaterial(item.material!, e.target.value)}/></div><button className="lab-btn my-2 w-full" onClick={() => engine.current?.release()}>Отпустить крепления</button></>}
     <button className="lab-btn w-full" onClick={() => engine.current?.remove()}>Удалить объект</button>
    </section>}
    <p className="mt-5 text-[11px] text-muted-foreground">До 6 тканей и 3 манекенов. Сцена сохраняется при переключении режимов до перезагрузки страницы. Контакт между полотнами приближённый; начинайте без глубоких пересечений.</p>
   </aside>}
  </div>
 </div>;
}

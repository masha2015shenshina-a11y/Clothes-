import { QuickGuide } from './QuickGuide';
import { t as tr, useLanguage } from '../lib/i18n';
import { lazy, Suspense, useState } from 'react';
import { ClothLab } from './ClothLab';
const Workspace = lazy(() => import('./Workspace'));
export function App() {
 useLanguage();
    const [mode, setMode] = useState<'lab' | 'workspace'>('lab'), [opened, setOpened] = useState(false);
    return <><QuickGuide/><div hidden={mode !== 'lab'}><ClothLab active={mode === 'lab'} onWorkspace={() => { setOpened(true); setMode('workspace'); }}/></div>{tr(opened && <div hidden={mode !== 'workspace'}><Suspense fallback={<div className="flex h-dvh items-center justify-center bg-background text-foreground"><span className="scene-spinner"/>{tr("Открываем стол")}</div>}><Workspace active={mode === 'workspace'} onLab={() => setMode('lab')}/></Suspense></div>)}</>;
}

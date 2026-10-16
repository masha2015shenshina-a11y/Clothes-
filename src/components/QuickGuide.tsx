import { useState } from 'react';
import { t, useLanguage } from '../lib/i18n';
export function QuickGuide() {
  useLanguage();
  const [open,setOpen]=useState(()=>{try{return localStorage.getItem('skladka-guide-v1')!=='done';}catch{return true;}});
  const close=()=>{setOpen(false);try{localStorage.setItem('skladka-guide-v1','done');}catch{}};
  if(!open)return <button type="button" className="lab-btn fixed bottom-12 left-3 z-40 !rounded-full" aria-label={t('Подсказки')} title={t('Подсказки')} onClick={()=>setOpen(true)}>?</button>;
  return <aside className="fixed bottom-12 left-3 z-40 w-64 max-w-[calc(100vw-24px)] rounded-xl border border-border bg-card/95 p-4 text-foreground shadow-lg" aria-label={t('Быстрый старт')}>
    <div className="flex items-center justify-between"><b className="text-sm">{t('Быстрый старт')}</b><button className="lab-btn !px-2" aria-label={t('Закрыть подсказки')} onClick={close}>×</button></div>
    <ol className="my-3 space-y-2 text-xs text-muted-foreground"><li>{t('1. Выберите ткань или добавьте объект.')}</li><li>{t('2. Вращайте вид за свободное место. Масштаб - колесом или двумя пальцами.')}</li><li>{t('3. Тяните ткань, а объекты - за цветные оси. Двойное нажатие удаляет опору.')}</li></ol>
    <button className="lab-btn w-full" onClick={close}>{t('Понятно')}</button>
  </aside>;
}

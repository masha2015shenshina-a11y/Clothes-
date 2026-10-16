import { setLanguage, useLanguage } from '../lib/i18n';
export function LanguageSwitch() {
  const language = useLanguage();
  return <div className="flex shrink-0 gap-0.5" role="group" aria-label="Language / Язык">
    {(['ru', 'en'] as const).map(value => <button key={value} type="button" className="lab-btn !px-2" lang={value} aria-label={value === 'ru' ? 'Русский' : 'English'} aria-pressed={language === value} data-selected={language === value} onClick={() => setLanguage(value)}>{value.toUpperCase()}</button>)}
  </div>;
}

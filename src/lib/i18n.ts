import { useSyncExternalStore } from 'react';
import { EN } from './translations';
export type Language = 'ru' | 'en';
const KEY = 'skladka-language';
function initialLanguage(): Language {
  try { const saved = localStorage.getItem(KEY); if (saved === 'en' || saved === 'ru') return saved; } catch { /* Storage may be blocked. */ }
  return 'ru';
}
let language = initialLanguage();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useLanguage() { return useSyncExternalStore(subscribe, () => language, () => 'ru' as Language); }
export function setLanguage(next: Language) {
  if (next === language) return;
  language = next;
  try { localStorage.setItem(KEY, next); } catch { /* Keep the selection for this session. */ }
  document.documentElement.lang = next;
  listeners.forEach(listener => listener());
}
const lower = new Map(Object.entries(EN).map(([ru, en]) => [ru.toLowerCase(), en]));
/** Translate display strings only; simulation IDs and state stay language-independent. */
export function t<T>(value: T): T {
  if (language !== 'en' || typeof value !== 'string') return value;
  const key = value.trim().replace(/\s+/g, ' ');
  const exact = EN[key] ?? lower.get(key.toLowerCase());
  if (exact) return value.replace(value.trim(), key === key.toUpperCase() ? exact.toUpperCase() : exact) as T;
  // Dynamic labels such as "Pin 3" and "Head: enable".
  return value.replace(/[А-Яа-яЁё]+(?:[ \t]+[А-Яа-яЁё]+)*/g, phrase => {
    const translated = EN[phrase] ?? lower.get(phrase.toLowerCase());
    return translated ? (phrase === phrase.toUpperCase() ? translated.toUpperCase() : translated) : phrase;
  }) as T;
}

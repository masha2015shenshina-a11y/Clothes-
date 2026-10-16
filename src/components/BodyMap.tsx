import { t as tr, useLanguage } from '../lib/i18n';
export const DEFAULT_PARTS = { head: true, torso: true, pelvis: true, leftArm: true, rightArm: true, leftLeg: true, rightLeg: true };
export type BodyPart = keyof typeof DEFAULT_PARTS;
export type BodyParts = typeof DEFAULT_PARTS;
const shapes: Record<BodyPart, string> = { head: 'M50 5a10 10 0 1 1 0 20a10 10 0 1 1 0-20', torso: 'M35 30Q50 25 65 30L61 64Q50 70 39 64Z', pelvis: 'M39 69L61 69L65 84L50 91L35 84Z', leftArm: 'M30 31L22 35L11 69L18 73L34 45Z', rightArm: 'M70 31L78 35L89 69L82 73L66 45Z', leftLeg: 'M36 89L47 94L44 133L40 151L29 151L33 132Z', rightLeg: 'M64 89L53 94L56 133L60 151L71 151L67 132Z' };
const labels: Record<BodyPart, string> = { head: 'Голова', torso: 'Туловище', pelvis: 'Таз', leftArm: 'Левая рука', rightArm: 'Правая рука', leftLeg: 'Левая нога', rightLeg: 'Правая нога' };
export function BodyMap({ parts, onToggle, onAll }: {
    parts: BodyParts;
    onToggle: (part: BodyPart) => void;
    onAll: (on: boolean) => void;
}) {
 useLanguage();
    return <div className="body-map"><svg viewBox="0 0 100 158" aria-label={tr("Включение частей манекена")}>{tr((Object.keys(shapes) as BodyPart[]).map(part => <path key={part} d={shapes[part]} role="button" tabIndex={0} aria-label={tr(labels[part])} aria-pressed={parts[part]} data-on={parts[part]} onClick={() => onToggle(part)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onToggle(part);
    } }}><title>{tr(`${labels[part]}: ${parts[part] ? 'выключить' : 'включить'}`)}</title></path>))}</svg><div><p className="lab-label">{tr("Манекен")}</p><p className="my-2 text-xs text-muted-foreground">{tr("Нажмите на часть тела")}</p><div className="flex flex-wrap gap-1"><button className="lab-btn" onClick={() => onAll(true)}>{tr("Весь")}</button><button className="lab-btn" onClick={() => onAll(false)}>{tr("Скрыть")}</button></div></div></div>;
}

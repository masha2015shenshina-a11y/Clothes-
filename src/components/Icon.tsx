import type { ReactNode } from 'react';
const paths:Record<string,ReactNode>={
rotate:<><ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(-35 12 12)"/><path d="m17 3 4 1-1 4M12 4v16"/></>,
resetCloth:<><path d="M4 4h12v7l-4 5H4ZM12 16v-5h4M17 14a4 4 0 1 1-1 7m1-7v4h4"/></>,
resetScene:<><path d="M3 3h7M3 3v7m18 11h-7m7 0v-7M7 8l5-3 5 3v7l-5 3-5-3ZM7 8l5 3 5-3M12 11v7"/></>,
leftLeg:<><path d="M8 3v8L6 20h5"/><path opacity=".25" d="M16 3v8l2 9h-5"/></>,
rightLeg:<><path opacity=".25" d="M8 3v8L6 20h5"/><path d="M16 3v8l2 9h-5"/></>,
bothLeg:<><path d="M8 3v8L6 20h5m5-17v8l2 9h-5M9 6h6"/></>,
leftBodyArm:<><path d="m10 4-5 3-2 12 3 1 3-9"/><path opacity=".25" d="m14 4 5 3 2 12-3 1-3-9"/></>,
rightBodyArm:<><path opacity=".25" d="m10 4-5 3-2 12 3 1 3-9"/><path d="m14 4 5 3 2 12-3 1-3-9"/></>,
bothBodyArm:<><path d="m10 4-5 3-2 12 3 1 3-9m5-7 5 3 2 12-3 1-3-9M9 8h6"/></>,
body:<><circle cx="12" cy="4" r="2"/><path d="m8 8-4 3 3 4 1 7h8l1-7 3-4-4-3Z"/></>,
pelvis:<><path d="M3 5c5-3 5 4 9 4s4-7 9-4l-2 10-7 5-7-5ZM12 9v11"/></>,

windPower:<><path d="M3 7h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 17h5"/><path d="M20 2v5"/></>,
diffuse:<><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/></>,
directional:<><path d="m5 3 7 7-5 5-7-7Z"/><path d="m12 12 8 8m-8-4 1 6m3-10 6 1M17 20h3v-3"/></>,
floor:<><path d="M4 21h16M12 3v13m-5-5 5 5 5-5"/></>,
undo:<><path d="M9 5 4 10l5 5M4 10h10a6 6 0 0 1 0 12"/></>,redo:<><path d="m15 5 5 5-5 5m5-5H10a6 6 0 0 0 0 12"/></>,
play:<path d="m8 5 11 7-11 7Z"/>,pause:<><path d="M8 5v14M16 5v14"/></>,step:<><path d="m5 5 10 7-10 7ZM19 5v14"/></>,
save:<><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></>,reset:<><path d="M4 5v6h6M4 11a8 8 0 1 1 2 7"/></>,
sun:<><circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/></>,
moon:<path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/>,
trash:<><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/></>,
camera:<><path d="M3 3h5M3 3v5m18-5h-5m5 0v5M3 21h5m-5 0v-5m18 5h-5m5 0v-5"/><circle cx="12" cy="12" r="4"/></>,
release:<><path d="m7 4 4 4-5 5-4-4m12 2 4 4-5 5-4-4M8 8l8 8M16 3l5 5M3 16l5 5"/></>,
settings:<><path d="M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-7 0v6"/></>
};
export function Icon({name}:{name:string}){return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>}

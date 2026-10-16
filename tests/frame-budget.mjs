import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {FramePacer}=createRequire(import.meta.url)('/tmp/cloth-v11-test/pacing.js');
import {ClothEngine} from '/tmp/cloth-engine-v11.mjs';
let next=0;const queued=new Map();globalThis.document={hidden:false};globalThis.requestAnimationFrame=cb=>{queued.set(++next,cb);return next;};globalThis.cancelAnimationFrame=id=>queued.delete(id);
const e=Object.create(ClothEngine.prototype);Object.assign(e,{raf:0,last:0,acc:0,pacer:new FramePacer(),lastDraw:-Infinity,lastSimFrame:0,disposed:false,frames:0,fpsT:0,frameCost:0,slowFrames:0,pixelRatio:1,lastHealthCheck:0,settings:{paused:false},sim:{hasNaN:()=>false},geometryDirty:false,renderDirty:true,loop:t=>e.tick(t),onFps:()=>{},renderer:{setPixelRatio(){}}});
let steps=0,renders=0;e.advance=()=>{steps++;e.geometryDirty=true;e.invalidate();};e.syncGeometry=()=>{e.geometryDirty=false;e.invalidate();};e.renderFrame=()=>renders++;
function run(t){const entries=[...queued];queued.clear();for(const [,cb] of entries)cb(t);}
e.invalidate();for(let i=0;i<60;i++)run(1000+i*1000/60);assert(steps>=29&&steps<=31,`physics steps ${steps}`);assert.equal(renders,steps);
e.settings.paused=true;e.invalidate();run(2100);assert.equal(queued.size,0,'paused scene must stop scheduling');
e.invalidate();run(2150);assert.equal(queued.size,0,'camera update must render once on pause');
e.settings.paused=false;e.invalidate();let oldSteps=steps;run(5000);assert.equal(steps-oldSteps,1,'late frame must not execute catch-up burst');
document.hidden=true;run(5100);assert.equal(queued.size,0,'hidden tab must stop scheduling');
document.hidden=false;e.settings.paused=true;e.invalidate();run(6000);
const rendered=renders;
for(let i=1;i<=120;i++){e.invalidate();run(6000+i*1000/120);}
assert(renders-rendered<=60,'drawing must never exceed 60 fps on a 120 Hz display');
console.log('Adaptive scheduler: pause, no catch-up, hidden tab and 60 FPS render cap passed.');

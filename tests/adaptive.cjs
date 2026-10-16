const assert=require('node:assert/strict');
const {FramePacer}=require('/tmp/cloth-v11-test/pacing.js');const {ClothSim}=require('/tmp/cloth-v11-test/solver.js');const {buildPreset,DEFAULT_SKIRT,DEFAULT_SLEEVE,MATERIALS}=require('/tmp/cloth-v11-test/presets.js');
const p=new FramePacer();for(let i=0;i<100;i++)p.observe(7,1000/p.fps);assert.equal(p.fps,60);for(let i=0;i<6;i++)p.observe(20,30);assert.equal(p.fps,30);for(let i=0;i<6;i++)p.observe(38,45);assert.equal(p.fps,25);for(let i=0;i<200;i++)p.observe(38,45);assert.equal(p.fps,25);for(let i=0;i<250;i++)p.observe(6,1000/p.fps);assert.equal(p.fps,60);
const params={gravity:9.81,windX:0,windY:0,windZ:1,windStrength:20,stretch:0,...MATERIALS.cotton,selfCollision:true,sphere:{on:false,r:1,x:0,y:0,z:0},box:{on:false,s:1,x:0,y:0,z:0}};
for(const id of ['wide','sleeve','pants','skirt']){const s=new ClothSim(buildPreset(id,'top',DEFAULT_SLEEVE,{...DEFAULT_SKIRT,style:'pleated',folds:32}),params);for(let i=0;i<100;i++){s.step(1/[60,30,25,30][Math.floor(i/25)]);assert(!s.hasNaN());}for(let i=0;i<s.n;i++)assert(s.x[i*3+1]>=.013);console.log(id,'60/30/25 Hz transitions stable');}
const empty={x:new Float32Array([0,2,0]),pinned:new Uint8Array(1),cons:new Int32Array(),rest:new Float32Array(),ctype:new Uint8Array(),index:new Uint32Array(),map:new Uint32Array([0])};
const moving=new ClothSim(empty,{...params,gravity:0,damping:0,windStrength:0});moving.p[0]=-moving.lastH;
for(const fps of [60,30,25,60]){moving.step(1/fps);const speed=(moving.x[0]-moving.p[0])/moving.lastH;assert(speed>.9&&speed<1.01,'rate change must preserve velocity');}
const calm=new ClothSim(buildPreset('wide','top'),{...params,windStrength:0,gravity:0});calm.computeForces();assert(calm.acc.every(v=>v===0),'disabled wind has no force at rest');
console.log('Adaptive thresholds, sustained overload, velocity continuity and wind-off passed.');

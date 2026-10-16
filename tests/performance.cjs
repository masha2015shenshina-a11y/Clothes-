const assert=require('node:assert/strict');
const {buildPreset,DEFAULT_SLEEVE,DEFAULT_SKIRT,DEFAULT_LEGS,MATERIALS,PRESETS}=require('/tmp/cloth-v10-test/presets.js');
const {ClothSim}=require('/tmp/cloth-v10-test/solver.js');
const {ClothSim:OldSim}=require('/tmp/cloth-baseline/js/solver.js');
const params=()=>({gravity:9.81,windX:0,windY:0,windZ:1,windStrength:4,stretch:0,...MATERIALS.cotton,selfCollision:true,sphere:{on:false,r:1,x:0,y:0,z:0},box:{on:false,s:1,x:0,y:0,z:0}});
for(const id of ['wide','pants','skirt']){
 const b=buildPreset(id,'top',DEFAULT_SLEEVE,{...DEFAULT_SKIRT,style:'pleated',folds:32,length:2},DEFAULT_LEGS);
 const measure=(C,dt,count)=>{const s=new C(b,params());for(let i=0;i<10;i++)s.step(dt);const t=performance.now();for(let i=0;i<count;i++)s.step(dt);assert(!s.hasNaN());for(let i=0;i<s.n;i++)assert(s.x[i*3+1]>=.013);return (performance.now()-t)/count;};
 const before=measure(OldSim,1/60,45),after=measure(ClothSim,1/30,45);
 console.log(JSON.stringify({preset:id,beforeMsPerStep:+before.toFixed(2),afterMsPerStep:+after.toFixed(2),cpuMsPerSimulatedSecondBefore:Math.round(before*60),cpuMsPerSimulatedSecondAfter:Math.round(after*30)}));
}
// Isolated pairs across every neighbouring-cell orientation remain separated.
for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(let c=-1;c<=1;c++){
 const mesh={x:new Float32Array([.5+a*.001,.5+b*.001,.5+c*.001,.5-a*.001,.5-b*.001,.5-c*.001]),pinned:new Uint8Array(2),cons:new Int32Array(),rest:new Float32Array(),ctype:new Uint8Array(),index:new Uint32Array(),map:new Uint32Array([0,1])};
 const s=new ClothSim(mesh,params());s.selfCollide();assert(Math.hypot(s.x[0]-s.x[3],s.x[1]-s.x[4],s.x[2]-s.x[5])>=s.selfDistance-1e-6);
}
for(const def of PRESETS){const s=new ClothSim(buildPreset(def.id,def.defaultPin),{...params(),windStrength:20});for(let i=0;i<60;i++)s.step(1/30);assert(!s.hasNaN(),def.id);for(let i=0;i<s.n;i++)assert(s.x[i*3+1]>=.013,def.id);}
console.log('30 Hz strong-wind stability and neighbour-pair separation passed.');

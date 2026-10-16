const assert=require('node:assert/strict');const root=process.argv[2];
const {DEFAULT_BODY,bodyEllipsoids,bodyArmPoints,upperTransform}=require(root+'/mannequin.js');
const {DEFAULT_LEGS,DEFAULT_SLEEVE,DEFAULT_SKIRT,buildPreset,MATERIALS}=require(root+'/presets.js');const {ClothSim}=require(root+'/solver.js');const {followUpperPose,updateUpperGuides}=require(process.env.UPPER_HELPER||'/tmp/upperCloth-v21.cjs');
const r=structuredClone(DEFAULT_LEGS),body={...structuredClone(DEFAULT_BODY),on:true,cape:true,sleeves:true,hood:process.env.HOOD_UP?"up":"down"};
const params=b=>({...MATERIALS.cotton,stretch:0,gravity:9.81,windX:0,windZ:1,windStrength:0,selfCollision:true,ellipsoids:bodyEllipsoids(r,true,b),capsules:['left','right'].flatMap(side=>{const [a,c,d]=bodyArmPoints(r,b,side);const collar=upperTransform([r.x+(side==="left"?-.13:.13),r.y+.83,r.z],r,b);return [{a,b:c,r:.105},{a:c,b:d,r:.09},{a:collar,b:a,r:.105}]}),sphere:{on:false,r:1,x:0,y:0,z:0},box:{on:false,s:1,x:0,y:0,z:0}});
const a=buildPreset('body','top',DEFAULT_SLEEVE,DEFAULT_SKIRT,r,body),wide=buildPreset('body','top',DEFAULT_SLEEVE,DEFAULT_SKIRT,r,{...body,ease:.28});
for(let i=0;i<a.upper.capeStart;i++)if(a.locked[i])assert.deepEqual(a.x.slice(i*3,i*3+3),wide.x.slice(i*3,i*3+3),'shoulder moved with ease');
const sim=new ClothSim(a,params(body));let before=body;const start=performance.now();
for(let f=0;f<150;f++){const next={...body,torsoPitch:30*Math.sin(f/150*Math.PI/2),torsoLean:15*Math.sin(f/150*Math.PI/2),headPitch:-20*Math.sin(f/150*Math.PI/2),left:{raise:Math.min(85,12+f*.6),forward:20,elbow:60}};followUpperPose(sim,a,r,before,next);sim.params=params(next);updateUpperGuides(sim,a,r,next);sim.step(1/30);assert(!sim.hasNaN());before=next;}
assert(Math.max(...sim.x)<10);console.log('Upper pose, sleeves, cape:',((performance.now()-start)/150).toFixed(2),'ms/step');
for(const p of [[.2,3,.1],[-.4,2.8,-.2]]){const q=upperTransform(upperTransform(p,r,before,false,true),r,before,true,true);q.forEach((v,i)=>assert(Math.abs(v-p[i])<1e-8));}

let penetration=0,contacts=0;for(let i=a.upper.capeStart;i<a.upper.hoodStart;i++){if(a.pinned[i])continue;const o=i*3;for(const c of sim.params.capsules){const v=c.b.map((n,k)=>n-c.a[k]),t=Math.max(0,Math.min(1,v.reduce((sum,n,k)=>sum+n*(sim.x[o+k]-c.a[k]),0)/v.reduce((sum,n)=>sum+n*n,0))),d=Math.hypot(...v.map((n,k)=>sim.x[o+k]-c.a[k]-n*t));penetration=Math.max(penetration,c.r-d);contacts++;}}assert(penetration<.005);console.log('Cape arm penetration',penetration,'in',contacts,'checks');
if(process.env.CLOTH_DIAGNOSTIC)require('node:fs').writeFileSync(process.env.CLOTH_DIAGNOSTIC,JSON.stringify({upper:a.upper,x:Array.from(sim.x),map:Array.from(a.map),index:Array.from(a.index),capsules:sim.params.capsules,ellipsoids:sim.params.ellipsoids}));

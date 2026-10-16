const assert=require('node:assert/strict');
const rootPath=process.argv[2]||'/tmp/cloth-v14-test';
const {buildPreset,DEFAULT_SKIRT,DEFAULT_SLEEVE,DEFAULT_LEGS,legPoints,LEG_RADIUS,MATERIALS}=require(rootPath+'/presets.js');
const {DEFAULT_BODY,bodyArmPoints,bodyEllipsoids,BODY_ARM_RADIUS}=require(rootPath+'/mannequin.js');
const {ClothSim}=require(rootPath+'/solver.js');
const root=structuredClone(DEFAULT_LEGS);
const params=body=>({gravity:9.81,windX:0,windY:0,windZ:1,windStrength:3,stretch:0,...MATERIALS.cotton,selfCollision:true,sphere:{on:false,r:1,x:0,y:0,z:0},box:{on:false,s:1,x:0,y:0,z:0},ellipsoids:bodyEllipsoids(root,body.on),capsules:['left','right'].flatMap(side=>{const [a,b,c]=bodyArmPoints(root,body,side);return [{a,b,r:BODY_ARM_RADIUS},{a:b,b:c,r:BODY_ARM_RADIUS}];})});
for(const id of ['body','skirt','pants'])for(const hood of ['up','down']){
 const body={...structuredClone(DEFAULT_BODY),on:true,cape:true,hood};const b=buildPreset(id,'top',DEFAULT_SLEEVE,DEFAULT_SKIRT,root,body);assert(b.x.every(Number.isFinite));assert(b.map.every(i=>i<b.pinned.length));assert(b.cons.every(i=>i<b.pinned.length));
 const fullParams=()=>{const p=params(body);if(id!=="body")p.capsules.push(...["left","right"].flatMap(side=>{const [a,b,c]=legPoints(root,side);return [{a,b,r:LEG_RADIUS},{a:b,b:c,r:LEG_RADIUS}];}));return p;};const s=new ClothSim(b,fullParams());const t=performance.now();for(let f=0;f<60;f++){body.left.elbow=f;body.left.raise=f/2;s.params.capsules=fullParams().capsules;s.step(1/(f<20?60:f<40?30:25));}
 assert(!s.hasNaN());for(let i=0;i<s.n;i++){assert(s.x[i*3+1]>=.013);if(b.pinned[i])assert.deepEqual(Array.from(s.x.slice(i*3,i*3+3)),Array.from(b.x.slice(i*3,i*3+3)));}
 let energy=0;for(let i=0;i<s.x.length;i++)energy=Math.max(energy,Math.abs(s.x[i]-s.p[i]));assert(energy<1,'explosive movement');
 console.log(id,hood,s.n,'particles',((performance.now()-t)/60).toFixed(1),'ms/step');
}
// Upper-body attachment follows the same root as skirt and pants.
const body={...structuredClone(DEFAULT_BODY),on:true,cape:true};const a=buildPreset('pants','top',DEFAULT_SLEEVE,DEFAULT_SKIRT,root,body),b=buildPreset('pants','top',DEFAULT_SLEEVE,DEFAULT_SKIRT,{...root,x:1,y:root.y+.5,z:-1},body);
for(let i=0;i<a.x.length;i++)assert(Math.abs(b.x[i]-a.x[i]-[1,.5,-1][i%3])<1e-5);
const before=bodyArmPoints(root,body,'right');body.left.elbow=100;assert.deepEqual(bodyArmPoints(root,body,'right'),before);
const disabled=buildPreset('body','top',DEFAULT_SLEEVE,DEFAULT_SKIRT,root,{...body,on:false});assert.equal(disabled.x.length,0);
console.log('Garment combinations, fixed collars, shared pelvis root and independent arm poses passed.');

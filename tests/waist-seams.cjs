const assert=require('node:assert/strict'),root=process.argv[2];
const {buildPreset,DEFAULT_LEGS,DEFAULT_SKIRT,DEFAULT_SLEEVE,MATERIALS,legPoints,LEG_RADIUS}=require(root+'/presets.js');
const {DEFAULT_BODY,bodyEllipsoids}=require(root+'/mannequin.js');
const {ClothSim}=require(root+'/solver.js');
const {followLegPose,updateLegGuides}=require(process.env.LEG_HELPER||'/tmp/legCloth-v23.cjs');
const params={...MATERIALS.cotton,stretch:0,gravity:9.81,windX:0,windZ:1,windStrength:0,selfCollision:true,sphere:{on:false,r:1,x:0,y:0,z:0},box:{on:false,s:1,x:0,y:0,z:0}};
for(const kind of ['pants','skirt']){
 const pose=structuredClone(DEFAULT_LEGS),build=buildPreset(kind,'top',DEFAULT_SLEEVE,DEFAULT_SKIRT,pose,DEFAULT_BODY,.8),sim=new ClothSim(build,params);
 assert(build.waist);assert(build.waist.indices.length>=20);assert(build.ctype.includes(3));assert(build.ctype.includes(4));
 for(let j=0;j<build.waist.indices.length;j++)assert(Math.abs(build.waist.reference[j*3+1]-.1)<1e-5,'waist is too low');
 const unique=new Set();for(let k=0;k<build.rest.length;k++){const a=build.cons[k*2],b=build.cons[k*2+1];assert.notEqual(a,b);const key=Math.min(a,b)+':'+Math.max(a,b)+':'+build.ctype[k];assert(!unique.has(key),'duplicate constraint');unique.add(key);}
 for(let k=0;k<build.index.length;k+=3)assert.equal(new Set([0,1,2].map(j=>build.map[build.index[k+j]])).size,3,'collapsed render face');
 let maxTravel=0,backDrop=0,sideDrop=0;
 for(let f=0;f<120;f++){
   const before=structuredClone(pose);pose.left.hip=Math.min(70,f);pose.left.knee=Math.min(100,f);followLegPose(sim,build,before,pose);updateLegGuides(sim,build,pose,true);
   sim.waist.setPose(pose.x,pose.y,pose.z,Math.min(55,f),0);
   sim.params={...params,capsules:['left','right'].flatMap(side=>{const[a,b,c]=legPoints(pose,side);return[{a,b,r:LEG_RADIUS},{a:b,b:c,r:LEG_RADIUS}]}),ellipsoids:bodyEllipsoids(pose,false)};
   sim.step(1/(f<60?30:25));assert(!sim.hasNaN());
   for(let j=0;j<build.waist.indices.length;j++){const o=build.waist.indices[j]*3,t=j*3;maxTravel=Math.max(maxTravel,Math.hypot(sim.x[o]-sim.waist.targets[t],sim.x[o+1]-sim.waist.targets[t+1],sim.x[o+2]-sim.waist.targets[t+2]));}
 }
 for(let j=0;j<build.waist.indices.length;j++){const t=j*3,drop=pose.y+.1-sim.waist.targets[t+1];if(build.waist.reference[t+2]<-.14)backDrop=Math.max(backDrop,drop);if(Math.abs(build.waist.reference[t+2])<.03)sideDrop=Math.max(sideDrop,drop);}
 assert(backDrop>.015&&backDrop<.03);assert(sideDrop<.005);assert(maxTravel<.04,'waist escaped support: '+maxTravel);
 sim.releasePins();assert.equal(sim.waist.enabled,false);
 console.log(kind,{seamVertices:build.waist.indices.length,maxTravel,backDrop,sideDrop});
}
// Real load response: front/back supports yield more than the iliac support.
const b=buildPreset('skirt','top'),s=new ClothSim(b,params);let side=-1,back=-1;
for(let j=0;j<b.waist.indices.length;j++){const z=b.waist.reference[j*3+2];if(Math.abs(z)<1e-5)side=j;if(z<-.17)back=j;}
assert(side>=0&&back>=0);
for(const j of [side,back]){const i=b.waist.indices[j];s.x[i*3+1]-=.06;s.p[i*3+1]-=.06;}
s.waist.solve(s,1/240);
const residual=j=>s.waist.targets[j*3+1]-s.x[b.waist.indices[j]*3+1];assert(residual(back)>residual(side)*2);
console.log('Waist yields under load, side support remains firmer, release works');

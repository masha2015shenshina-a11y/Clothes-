const assert=require('node:assert/strict'),root=process.argv[2]||'/tmp/cloth-v20-test';
const {buildPreset,DEFAULT_LEGS,DEFAULT_SKIRT,DEFAULT_SLEEVE,MATERIALS,legPoints,LEG_RADIUS}=require(root+'/presets.js'),{DEFAULT_BODY,bodyEllipsoids}=require(root+'/mannequin.js'),{ClothSim}=require(root+'/solver.js');
const {followLegPose,updateLegGuides}=require(process.env.LEG_HELPER||'/tmp/legCloth-v21.cjs');
const caps=p=>['left','right'].flatMap(side=>{const[a,b,c]=legPoints(p,side);return[{a,b,r:LEG_RADIUS},{a:b,b:c,r:LEG_RADIUS}];});
for(const linked of [false,true]){
 let pose=structuredClone(DEFAULT_LEGS);const build=buildPreset('pants','top',DEFAULT_SLEEVE,DEFAULT_SKIRT,pose,{...DEFAULT_BODY,on:true});assert.equal(build.legSkin.length,build.pinned.length*2);
 const sim=new ClothSim(build,{...MATERIALS.cotton,stretch:0,gravity:9.81,windX:0,windZ:1,windStrength:0,selfCollision:true,capsules:caps(pose),ellipsoids:bodyEllipsoids(pose,true),sphere:{on:false,r:1,x:0,y:0,z:0},box:{on:false,s:1,x:0,y:0,z:0}});
 updateLegGuides(sim,build,pose,true);let maxHem=0;const start=performance.now();
 for(let f=0;f<210;f++){
  const previous=structuredClone(pose);pose.left.hip=Math.min(90,f);pose.left.knee=Math.min(120,f);if(linked)pose.right={...pose.left};
  followLegPose(sim,build,previous,pose);updateLegGuides(sim,build,pose,true);sim.params.capsules=caps(pose);sim.step(1/(f<60?60:f<120?30:25));assert(!sim.hasNaN());
  if(f>120)for(const side of [-1,1]){const hem=[];for(let i=0;i<sim.n;i++)if(build.legSkin[i*2]===side&&build.legSkin[i*2+1]>pose.length-.01)hem.push(i);const center=[0,0,0];for(const i of hem)for(let k=0;k<3;k++)center[k]+=sim.x[i*3+k]/hem.length;const ankle=legPoints(pose,side<0?'left':'right')[2];maxHem=Math.max(maxHem,Math.hypot(...center.map((v,k)=>v-ankle[k])));}
 }
 assert(maxHem<.4,'trouser hem detached from bent leg: '+maxHem);for(let i=0;i<sim.n;i++)if(build.pinned[i])assert.deepEqual(sim.x.slice(i*3,i*3+3),build.x.slice(i*3,i*3+3));console.log({linked,particles:sim.n,maxHemOffset:maxHem,ms:(performance.now()-start)/210});
 // A paused pose change moves only the selected leg's cloth, including Verlet history.
 const prev=structuredClone(pose),snapshot=sim.x.slice();pose.left.knee=40;followLegPose(sim,build,prev,pose);for(let i=0;i<sim.n;i++)if(build.legSkin[i*2]===1)assert.deepEqual(sim.x.slice(i*3,i*3+3),snapshot.slice(i*3,i*3+3));
 updateLegGuides(sim,build,pose,false);assert.equal(sim.legGuides,null);
}
console.log('Bent knees, ankle-following hems, independent legs, fixed waist and paused pose changes passed.');

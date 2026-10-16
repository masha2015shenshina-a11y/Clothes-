const assert=require('node:assert/strict'),root=process.argv[2]||'/tmp/cloth-v15-test';
const {capsuleEntry}=require(root+'/contact.js');
const {ClothSim}=require(root+'/solver.js');
const {buildPreset,DEFAULT_SKIRT,DEFAULT_LEGS,DEFAULT_SLEEVE,MATERIALS,legPoints,LEG_RADIUS}=require(root+'/presets.js');
const {DEFAULT_BODY,bodyEllipsoids}=require(root+'/mannequin.js');
assert(Math.abs(capsuleEntry(-1,0,0,1,0,0,[0,-1,0],[0,1,0],.2)-.4)<1e-8);
assert.equal(capsuleEntry(-1,0,.3,1,0,.3,[0,-1,0],[0,1,0],.2),1);
assert(Math.abs(capsuleEntry(0,2,0,0,0,0,[0,-1,0],[0,1,0],.2)-.4)<1e-8);
const capsules=legs=>['left','right'].flatMap(side=>{const[a,b,c]=legPoints(legs,side);return[{a,b,r:LEG_RADIUS},{a:b,b:c,r:LEG_RADIUS}];});
const params=legs=>({...MATERIALS.cotton,stretch:0,gravity:9.81,windX:0,windZ:1,windStrength:0,selfCollision:true,capsules:capsules(legs),ellipsoids:bodyEllipsoids(legs,false),sphere:{on:false,r:1,x:0,y:0,z:0},box:{on:false,s:1,x:0,y:0,z:0}});
for(const style of ['pencil','half','pleated']){
 const legs=structuredClone(DEFAULT_LEGS),body={...DEFAULT_BODY,on:false};
 for(const length of [.55,1.45,2.1]){
  legs.left={hip:65,knee:110,spread:10};legs.right={hip:0,knee:0,spread:0};
  const build=buildPreset('skirt','top',DEFAULT_SLEEVE,{...DEFAULT_SKIRT,style,length},legs,body),s=new ClothSim(build,params(legs));
  let peak=0;const start=performance.now();
  for(let frame=0;frame<100;frame++){
   legs.left.knee=110-Math.min(frame,90);legs.left.hip=65-Math.min(frame,60);s.params.capsules=capsules(legs);s.step(1/(frame<30?60:frame<60?30:25));
   assert(!s.hasNaN());for(let i=0;i<s.n;i++){const o=i*3;assert(Math.abs(s.x[o])<4&&Math.abs(s.x[o+2])<4&&s.x[o+1]<5,'cloth escaped');peak=Math.max(peak,Math.hypot(s.x[o]-s.p[o],s.x[o+1]-s.p[o+1],s.x[o+2]-s.p[o+2])/s.lastH);if(build.pinned[i])assert.deepEqual(s.x.slice(o,o+3),build.x.slice(o,o+3));}
  }
  assert(peak<25.001,'unbounded constraint impulse');
  console.log(style,length,'peak speed',peak.toFixed(2),'ms/step',((performance.now()-start)/100).toFixed(1));
 }
}
console.log('Swept capsule contact, bent-pose skirt construction, moving knees and bounded motion passed.');

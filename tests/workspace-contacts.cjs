const assert=require('node:assert/strict');
const root=process.argv[2]||'/tmp/cloth-v24-test';
const {BoxContacts}=require(root+'/boxContact.js'),{GarmentContacts}=require(root+'/layers.js');
const {ClothSim}=require(root+'/solver.js');
const {buildPreset,DEFAULT_SLEEVE,ARM_RADIUS,MATERIALS,armTransform}=require(root+'/presets.js');
const params={...MATERIALS.cotton,stretch:0,gravity:9.81,windX:0,windZ:1,windStrength:0,selfCollision:false,sphere:{on:false,r:1,x:0,y:0,z:0},box:{on:false,s:1,x:0,y:1,z:0}};
// All vertices are outside but an edge clips the cube top corner.
const fixture=()=>({x:Float32Array.from([-.8,1.48,.2,.8,1.48,.2,0,1.48,.9]),p:Float32Array.from([-.8,1.48,.2,.8,1.48,.2,0,1.48,.9]),w:Float32Array.from([1,1,1]),tris:Uint32Array.from([0,1,2]),thickness:.014,params:{box:{on:true,s:1,x:0,y:1,z:0}}});
const sim=fixture(),box=new BoxContacts();assert(sim.x[0]<-.5&&sim.x[3]>.5&&sim.x[8]>.5);let depth=box.solve(sim);assert(depth>0);for(let i=0;i<10;i++)depth=box.solve(sim);assert(depth<1e-5);assert(sim.x[1]>=1.514);assert.deepEqual(sim.x,sim.p);
const pinned=fixture();pinned.w.fill(0);const before=pinned.x.slice();box.solve(pinned);assert.deepEqual(before,pinned.x);
// No contact with a distant cube; nonuniform dimensions supported.
const far=fixture();far.params.box.x=10;assert.equal(box.solve(far),0);far.params.box.x=0;far.params.box.width=.2;far.params.box.height=.2;assert.equal(box.solve(far),0);
// Cross-object face/vertex contact, with static supports staying static.
const x=Float32Array.from([-.1,1,-.1,.1,1,-.1,0,1,.1,0,1.005,0]),p=x.slice(),w=Float32Array.from([0,0,0,1]);
const b={pinned:new Uint8Array(4),map:Uint32Array.from([0,1,2,3]),index:Uint32Array.from([0,1,2])};
const contacts=new GarmentContacts(b,Uint8Array.from([1,1,1,2]));const state={x,p,w,params:{},upperGuides:null};for(let i=0;i<5;i++)contacts.solve(state);assert(x[10]>1.02);assert.deepEqual(x.slice(0,9),b.original??Float32Array.from([-.1,1,-.1,.1,1,-.1,0,1,.1]));assert.deepEqual(x,p);
// Sleeve opening stays at the shoulder regardless of ease and only shifts in strong wind.
for(const ease of [.02,.12,.4]){
 const sleeve={...DEFAULT_SLEEVE,ease,shoulderPitch:25,shoulderYaw:35};const b=buildPreset('sleeve','top',sleeve),s=new ClothSim(b,{...params,shoulder:sleeve});const {count,radius}=b.sleeveSupport;assert.equal(radius,ARM_RADIUS+.025);
 for(const wind of [0,7,20,0]){s.params.windStrength=wind;s.step(1/30);for(let i=0;i<count;i++){const a=i/count*Math.PI*2,target=armTransform([-.85,1.65+radius*Math.cos(a),radius*Math.sin(a)],sleeve),shift=Math.min(.025,Math.max(0,wind-8)*.002);assert(Math.abs(s.x[i*3]-target[0])<1e-6);assert(Math.abs(s.x[i*3+2]-target[2]-shift)<1e-6);}assert(!s.hasNaN());}
}
console.log('Triangle/cube corner, pinned points, nonuniform boxes, cloth layering, shoulder support and strong-wind threshold passed.');
// Falling cloth settles on the cube without triangles cutting through its top.
const falling=new ClothSim(buildPreset('free','none'),{...params,box:{on:true,s:1,x:0,y:.5,z:0},selfCollision:true});const started=performance.now();
for(let frame=0;frame<150;frame++)falling.step(1/30);
assert(!falling.hasNaN());const residual=falling.boxContacts.solve(falling);assert(residual<.006,'remaining triangle/box penetration '+residual);
console.log('Falling cloth/cube:',residual.toFixed(5),'m padded overlap,',((performance.now()-started)/150).toFixed(2),'ms physics/step');

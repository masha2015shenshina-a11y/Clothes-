const assert=require('node:assert/strict');
const {tunicPanel,capeProfile}=require(process.argv[2]+'/garmentProfile.js');
const eps=1e-5;
function continuous(fn,at,label){
 const a=fn(at-eps),b=fn(at),c=fn(at+eps);
 for(let k=0;k<a.length;k++){
   assert(Math.abs(c[k]-a[k])<.0001,label+' has a step');
   assert(Math.abs((c[k]-b[k])/eps-(b[k]-a[k])/eps)<.01,label+' has a sharp derivative change');
 }
}
for(const ease of [.025,.045,.28])for(const u of [-1,-.85,-.6,0,.6,.85,1])for(const face of [-1,1]){
 const point=d=>tunicPanel(u,d,1.05,ease,face);
 for(const d of [.18,.25,.28,.30,.53])continuous(point,d,'tunic');
 // Fixed top is independent of ease and its central neckline is straight.
 assert.deepEqual(tunicPanel(u,0,1.05,ease,face),tunicPanel(u,0,1.05,.045,face));
}
for(const d of [.22,.28,.34])continuous(t=>{const p=capeProfile(t);return [p.width,p.depth,p.height,p.collarWeight]},d,'cape');
const top=capeProfile(0);assert.equal(top.width,.13);assert.equal(top.depth,.14);assert.equal(top.height,.99);assert.equal(top.collarWeight,1);
console.log('Chest/armhole/cape profiles have continuous position and tangent; fixed neckline unchanged');

const assert=require('node:assert/strict'),{GarmentContacts}=require(process.argv[2]+'/layers.js');
const x=new Float32Array([-.3,0,.2,.3,0,.2,0,.6,.2, 0,.2,.19]);
const b={pinned:new Uint8Array(4),upper:{start:0,capeStart:3,hoodStart:4,sleevesStart:-1},index:new Uint32Array([0,1,2]),map:new Uint32Array([0,1,2,3])};
const contacts=new GarmentContacts(b),sim={x,p:x.slice(),w:new Float32Array([0,0,0,1]),params:{ellipsoids:[{}, {},{x:0,y:0,z:0}]}};
for(let i=0;i<12;i++)contacts.solve(sim);
assert(sim.x[11]>.219,'cape did not stay outside the inner face');assert(Math.abs(sim.x[11]-sim.p[11])<1e-7,'contact injected velocity');
assert.deepEqual(Array.from(sim.x.slice(0,9)),Array.from(x.slice(0,9)),'inner layer changed');
console.log('Vertex/face layer separation, fixed inner layer and energy-neutral correction passed');

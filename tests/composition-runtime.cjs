const assert=require('node:assert/strict');const root=process.argv[2];
const {buildPreset,DEFAULT_SLEEVE,DEFAULT_SKIRT,DEFAULT_LEGS,MATERIALS,legPoints,LEG_RADIUS}=require(root+'/presets.js'),{DEFAULT_BODY,bodyArmPoints,bodyEllipsoids}=require(root+'/mannequin.js'),{ClothSim}=require(root+'/solver.js');
const {CompositionWorkspace}=require('/tmp/cloth-workspace-v24.cjs');
const e=Object.create(CompositionWorkspace.prototype);e.wind=0;e.items=[];const body={...DEFAULT_BODY,on:true},r=DEFAULT_LEGS;
e.colliders={ellipsoids:bodyEllipsoids(r,true,body),capsules:['left','right'].flatMap(side=>{const a=bodyArmPoints(r,body,side),l=legPoints(r,side);return [{a:a[0],b:a[1],r:.105},{a:a[1],b:a[2],r:.09},{a:l[0],b:l[1],r:LEG_RADIUS},{a:l[1],b:l[2],r:LEG_RADIUS}];})};
for(const [k,id] of ['two','narrow','ribbons'].entries()){const b=buildPreset(id,'top',DEFAULT_SLEEVE,DEFAULT_SKIRT,DEFAULT_LEGS,DEFAULT_BODY,.6);for(let j=2;j<b.x.length;j+=3)b.x[j]+=.3+k*.1;const material=['cotton','silk','denim'][k];e.items.push({kind:'cloth',sim:new ClothSim(b,e.params(material)),build:b});}
e.rebuildContacts();const start=performance.now();for(let f=0;f<90;f++){for(const i of e.items)i.sim.step(1/30);e.crossContacts();for(const i of e.items)assert(!i.sim.hasNaN());}
console.log('Three materials and one mannequin:',e.items.reduce((n,i)=>n+i.sim.n,0),'particles,',((performance.now()-start)/90).toFixed(2),'ms physics/frame');
assert.notEqual(e.items[0].sim.params.density,e.items[1].sim.params.density);e.items.splice(1);e.rebuildContacts();assert.equal(e.contacts,null);assert.equal(e.contactState,null);
console.log('Removed composition objects release combined contact buffers.');

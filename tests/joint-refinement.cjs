const assert=require('node:assert/strict');
const root=process.argv[2];
const {buildPreset,DEFAULT_LEGS,DEFAULT_SKIRT,DEFAULT_SLEEVE,LEG_SEGMENT}=require(root+'/presets.js');
const {DEFAULT_BODY}=require(root+'/mannequin.js');
for(const quality of [.6,.8,1]) {
  const legs=structuredClone(DEFAULT_LEGS),body={...DEFAULT_BODY,on:true,cape:true,sleeves:true};
  const b=buildPreset('pants','top',DEFAULT_SLEEVE,DEFAULT_SKIRT,legs,body,quality);
  assert.equal(b.legAngles.length,b.pinned.length);
  assert.equal(b.upper.reference.length,(b.pinned.length-b.upper.start)*3);
  assert.equal(b.pinned.length-b.upper.sleevesStart,2*b.upper.sleeveCols*b.upper.sleeveDistances.length);
  assert(b.cons.every(i=>i>=0&&i<b.pinned.length));
  assert(b.x.every(Number.isFinite));assert(b.rest.every(Number.isFinite));
  // A neutral pattern must not start with mismatched rest lengths. This catches
  // the old cylindrical rest state under the dipped trouser crotch.
  for(let k=0;k<b.rest.length;k++) {
    const a=b.cons[k*2],c=b.cons[k*2+1];if(a>=b.upper.start||c>=b.upper.start)continue;
    const actual=Math.hypot(b.x[a*3]-b.x[c*3],b.x[a*3+1]-b.x[c*3+1],b.x[a*3+2]-b.x[c*3+2]);
    assert(Math.abs(actual-b.rest[k])<1e-5,'trouser rest-shape mismatch');
  }
  // Along each straight trouser column, rows must descend monotonically even at the crotch.
  const columns=new Map();
  for(let i=0;i<b.upper.start;i++) {
    const side=b.legSkin[i*2];if(!side)continue;
    const key=side+':'+b.legAngles[i].toFixed(5),list=columns.get(key)||[];
    list.push([b.legSkin[i*2+1],b.x[i*3+1]]);columns.set(key,list);
  }
  for(const rows of columns.values()) {rows.sort((a,b)=>a[0]-b[0]);for(let j=1;j<rows.length;j++)assert(rows[j][1]<rows[j-1][1]+1e-6,'inside-out trouser row');}
  const distances=[...new Set(Array.from(b.legSkin).filter((_,i)=>i%2===1))].sort((a,b)=>a-b);
  const near=[],far=[];for(let i=1;i<distances.length;i++){const mid=(distances[i]+distances[i-1])/2,gap=distances[i]-distances[i-1];(Math.abs(mid-LEG_SEGMENT)<.18?near:far).push(gap);}
  assert(Math.min(...near)<Math.max(...far)*.7,'knee region was not refined');
  const wide=buildPreset('pants','top',DEFAULT_SLEEVE,DEFAULT_SKIRT,legs,{...body,ease:.28},quality);
  for(let i=b.upper.start;i<b.upper.capeStart;i++)if(b.locked[i])assert.deepEqual(b.x.slice(i*3,i*3+3),wide.x.slice(i*3,i*3+3),'fixed shoulder moved');
  console.log('quality',quality,'particles',b.pinned.length,'triangles',b.index.length/3,'topology/rest shape passed');
}
// Passing the arm through vertical must not flip a sleeve's circumferential frame.
const {bodyArmPoints,sleeveRing}=require(root+'/mannequin.js');
for(const side of ['left','right']) {
  let previous;
  for(let forward=85;forward<=95;forward+=.5){
    const body={...DEFAULT_BODY,[side]:{raise:12,forward,elbow:0}};
    const ring=sleeveRing(bodyArmPoints(DEFAULT_LEGS,body,side),.4,body[side],side);
    if(previous)assert(previous.reduce((sum,v,k)=>sum+v*ring.radial[k],0)>.99,'sleeve frame flipped at vertical');
    previous=ring.radial;
  }
}
const trousers=buildPreset('pants','top');
for(let i=0;i<trousers.pinned.length;i++)if(trousers.pinned[i]){
  const q=((trousers.x[i*3]-DEFAULT_LEGS.x)/.354)**2+((trousers.x[i*3+1]-(DEFAULT_LEGS.y-.05))/.214)**2+((trousers.x[i*3+2]-DEFAULT_LEGS.z)/.234)**2;
  assert(q>=1-1e-5,'fixed waistband is inside pelvis collider');
}
console.log('Sleeve frame continuity and fixed waistband clearance passed');

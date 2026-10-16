const assert=require('node:assert/strict');
const root=process.argv[2]||'/tmp/cloth-v7-test';
const {buildPreset,DEFAULT_SKIRT,DEFAULT_LEGS,DEFAULT_SLEEVE,MATERIALS,legPoints,LEG_RADIUS}=require(root+'/presets.js');
const {ClothSim}=require(root+'/solver.js');
const params=()=>({gravity:9.81,windX:0,windY:0,windZ:1,windStrength:4,stretch:0,...MATERIALS.cotton,selfCollision:true,sphere:{on:false,r:1,x:0,y:0,z:0},box:{on:false,s:1,x:0,y:0,z:0}});
function checkMesh(b,loops){
 const edges=new Map(),adj=Array.from({length:b.x.length/3},()=>new Set());
 for(let j=0;j<b.index.length;j+=3){const t=[0,1,2].map(k=>b.map[b.index[j+k]]);assert.equal(new Set(t).size,3);for(let k=0;k<3;k++){const a=t[k],c=t[(k+1)%3],key=[Math.min(a,c),Math.max(a,c)].join(':');edges.set(key,(edges.get(key)||0)+1);adj[a].add(c);adj[c].add(a);}}
 const seen=new Set([0]),stack=[0];while(stack.length)for(const j of adj[stack.pop()])if(!seen.has(j)){seen.add(j);stack.push(j);}assert.equal(seen.size,b.x.length/3,'mesh must be connected without unused particles');
 const boundary=new Map();for(const [key,count] of edges){assert(count<=2,'manifold');if(count===1){const [a,c]=key.split(':').map(Number);for(const [u,v] of [[a,c],[c,a]]){if(!boundary.has(u))boundary.set(u,[]);boundary.get(u).push(v);}}}
 for(const v of boundary.values())assert.equal(v.length,2,'closed boundary loop');let n=0;const walked=new Set();for(const a of boundary.keys())if(!walked.has(a)){n++;const q=[a];walked.add(a);while(q.length)for(const b of boundary.get(q.pop()))if(!walked.has(b)){walked.add(b);q.push(b);}}assert.equal(n,loops);
}
let worst=0;
for(const style of ['pencil','half','pleated'])for(const length of [.3,2]){
 const skirt={...DEFAULT_SKIRT,style,length,folds:32};const b=buildPreset('skirt','top',DEFAULT_SLEEVE,skirt);checkMesh(b,2);const sim=new ClothSim(b,params());const start=performance.now();for(let f=0;f<50;f++)sim.step(1/60);worst=Math.max(worst,(performance.now()-start)/50);assert(!sim.hasNaN());for(let i=0;i<sim.n;i++)assert(sim.x[i*3+1]>=.013);console.log(style,length,b.x.length/3);
}
for(const length of [.5,1.85])for(const ease of [.05,.22]){
 const legs=structuredClone(DEFAULT_LEGS);legs.length=length;legs.ease=ease;
 const b=buildPreset('pants','top',DEFAULT_SLEEVE,DEFAULT_SKIRT,legs);checkMesh(b,3);const sim=new ClothSim(b,params());
 for(let f=0;f<80;f++){legs.left.hip=f*.6;legs.left.knee=f*1.2;legs.right.spread=f*.3;sim.params.capsules=['left','right'].flatMap(side=>{const [a,b,c]=legPoints(legs,side);return [{a,b,r:LEG_RADIUS},{a:b,b:c,r:LEG_RADIUS}];});sim.step(1/60);}assert(!sim.hasNaN());for(let i=0;i<sim.n;i++)assert(sim.x[i*3+1]>=.013);console.log('pants',length,ease,'moving legs passed');
}
const b=buildPreset('two','none'),s=new ClothSim(b,params());s.params.box={on:true,x:0,y:1,z:0,s:1,width:2,height:.4,depth:.6};s.x.set([.8,1,0],0);s.collide();assert(Math.abs(s.x[1]-1)>=.213||Math.abs(s.x[2])>=.313||Math.abs(s.x[0])>=1.013,'non-cubic collider');console.log('Garment topology, moving legs, box extents passed; max skirt step ms',worst.toFixed(1));

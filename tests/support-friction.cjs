const assert=require('node:assert/strict'),esbuild=require('esbuild'),T=require('three');
for(const n of ['solver','presets','rotationTool'])esbuild.buildSync({entryPoints:[`src/lib/cloth/${n}.ts`],bundle:true,packages:'external',platform:'node',format:'cjs',outfile:`/tmp/support-${n}.cjs`,logLevel:'silent'});
const {ClothSim}=require('/tmp/support-solver.cjs'),{buildPreset,MATERIALS}=require('/tmp/support-presets.cjs');
const p={...MATERIALS.cotton,stretch:0,gravity:9.81,windX:0,windZ:1,windStrength:0,selfCollision:true,sphere:{on:false,r:.7,x:0,y:.7,z:0},box:{on:false,s:1.4,x:0,y:.4,z:0,height:.8}};
for(const kind of ['box','sphere','capsule']){
 const b=buildPreset('free','none',undefined,undefined,undefined,undefined,.6);for(let i=1;i<b.x.length;i+=3)b.x[i]=2;
 const sim=new ClothSim(b,{...p,...(kind==='capsule'?{capsules:[{a:[0,.7,0],b:[0,.7,0],r:.7}]}:{[kind]:{...p[kind],on:true}})});let before;
 const center=()=>{const c=[0,0,0];for(let i=0;i<sim.n;i++)for(let k=0;k<3;k++)c[k]+=sim.x[i*3+k]/sim.n;return c;};
 for(let f=0;f<360;f++){sim.step(1/30);if(f===179)before=center();}assert(!sim.hasNaN());const after=center(),drift=Math.hypot(after[0]-before[0],after[2]-before[2]);let supported=0;for(let i=1;i<sim.x.length;i+=3)if(sim.x[i]>.6)supported++;
 console.log({kind,drift,supported,total:sim.n});assert(supported>sim.n*.1);assert(drift<.08);
}
const stub=Object.create(ClothSim.prototype);Object.assign(stub,{params:{friction:.5,gravity:9.81},lastH:1/240,x:Float32Array.from([.00001,1,0]),p:Float32Array.from([0,1,0]),contactStart:Float32Array.from([0,1,0])});stub.supportFriction(0,0,1,0,.0001);assert(Math.abs(stub.x[0])<1e-10);stub.x[0]=.1;stub.supportFriction(0,0,1,0,.0001);assert(stub.x[0]>.09);stub.x[0]=.00001;stub.supportFriction(0,0,0,1,.1);assert(stub.x[0]>0);
const {RotationTool}=require('/tmp/support-rotationTool.cjs');const tool=Object.create(RotationTool.prototype);let mode,change;Object.assign(tool,{enabled:false,proxy:new T.Object3D(),last:new T.Matrix4(),control:{setMode(m){mode=m},attach(){},detach(){}},engine:{settings:{selected:'box',box:{x:0,y:1,z:0}},change(v){change=v},invalidate(){}}});tool.sync();assert.equal(mode,'translate');tool.dragging=true;tool.proxy.position.set(2,3,4);tool.changed();assert.deepEqual([change.box.x,change.box.y,change.box.z],[2,3,4]);
console.log('Supported cloth stays on cube/sphere; small drift sticks, large pulls and vertical faces slip; box axes translate.');

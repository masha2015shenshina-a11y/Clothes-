const assert=require('node:assert/strict'),esbuild=require('esbuild');for(const n of ['presets','solver','soloSleeve'])esbuild.buildSync({entryPoints:[`src/lib/cloth/${n}.ts`],bundle:true,platform:'node',format:'cjs',outfile:`/tmp/solo-${n}.cjs`,logLevel:'silent'});
const {buildPreset,DEFAULT_SLEEVE,ARM_RADIUS,armPoints,armTransform,MATERIALS}=require('/tmp/solo-presets.cjs'),{ClothSim}=require('/tmp/solo-solver.cjs'),{updateSoloSleeve,followSoloSleeve}=require('/tmp/solo-soloSleeve.cjs');
for(const ease of [.025,.15,.4]){
 const pose={...DEFAULT_SLEEVE,length:2.4,ease,angle:0},b=buildPreset('sleeve','top',pose,undefined,undefined,undefined,.6),meta=b.sleeveSupport;
 assert.equal(meta.radius,ARM_RADIUS+ease);assert(Math.abs(b.x[1]-(1.65+ARM_RADIUS+.025))<1e-6);
 const params={...MATERIALS.silk,stretch:0,shoulder:pose,gravity:9.81,windX:0,windZ:1,windStrength:0,selfCollision:true,sphere:{on:false,r:1,x:0,y:0,z:0},box:{on:false,s:1,x:0,y:0,z:0}};
 const sim=new ClothSim(b,params);let angle=0;
 for(let f=0;f<160;f++){
  const next=f<80?Math.min(120,angle+1.5):Math.max(0,angle-1.5);followSoloSleeve(sim,pose,angle,next);angle=next;pose.angle=angle;const [a,c,d]=armPoints(angle,pose);sim.params.capsules=[{a,b:c,r:ARM_RADIUS},{a:c,b:d,r:ARM_RADIUS}];updateSoloSleeve(sim,pose);sim.step(1/30);assert(!sim.hasNaN());
 }
 for(let i=0;i<meta.count;i++){const a=i/meta.count*Math.PI*2,target=armTransform([-.85,1.65+meta.offset+meta.radius*Math.cos(a),meta.radius*Math.sin(a)],pose);for(let k=0;k<3;k++)assert(Math.abs(sim.x[i*3+k]-target[k])<1e-6);}
 let penetration=0;for(let i=0;i<sim.n;i++){if(!sim.w[i])continue;for(const c of sim.params.capsules){const v=c.b.map((v,k)=>v-c.a[k]),p=c.a.map((v,k)=>sim.x[i*3+k]-v),t=Math.max(0,Math.min(1,p.reduce((s,v,k)=>s+v*c.b.map((v,k)=>v-c.a[k])[k],0)/v.reduce((s,v)=>s+v*v,0)));const d=Math.hypot(...p.map((p,k)=>p-v[k]*t));penetration=Math.max(penetration,ARM_RADIUS-d);}}
 assert(penetration<.002);console.log({ease,particles:sim.n,penetration});
}
console.log('Variable shoulder opening, fixed top, long silk sleeve through elbow bend and return passed.');

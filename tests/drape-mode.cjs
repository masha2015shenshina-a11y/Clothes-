const assert=require('node:assert/strict'),esbuild=require('esbuild'),T=require('three');
for(const name of ['solver','presets','rotationTool','workspace'])esbuild.buildSync({entryPoints:[`src/lib/cloth/${name}.ts`],bundle:true,packages:'external',platform:'node',format:'cjs',outfile:`/tmp/drape-${name}.cjs`,logLevel:'silent'});
const {ClothSim}=require('/tmp/drape-solver.cjs'),{buildPreset,MATERIALS}=require('/tmp/drape-presets.cjs');
const b=buildPreset('two','two',undefined,undefined,undefined,undefined,.6),params={...MATERIALS.cotton,stretch:0,gravity:9.81,windX:0,windZ:1,windStrength:0,selfCollision:true,sphere:{on:false,r:1,x:0,y:0,z:0},box:{on:false,s:1,x:0,y:0,z:0}};
const normal=new ClothSim(b,{...params}),styled=new ClothSim(b,{...params,drapeMode:'exaggerated'});
for(let f=0;f<180;f++){normal.step(1/30);styled.step(1/30);}
assert(!normal.hasNaN()&&!styled.hasNaN());assert(styled.drapeBlend>.99);
for(let i=0;i<b.pinned.length;i++)if(b.pinned[i])assert.deepEqual(styled.x.slice(i*3,i*3+3),b.x.slice(i*3,i*3+3));
const row=Math.round(Math.sqrt(b.pinned.length)),middle=Math.floor(row/2)*3+1;
console.log('Top-edge height normal/stylized:',normal.x[middle],styled.x[middle]);assert(styled.x[middle]<normal.x[middle]-.04,'More sag between unchanged anchors');
const originalRest=styled.rest.slice();styled.params.drapeMode='normal';for(let f=0;f<120;f++)styled.step(1/30);assert(styled.drapeBlend<.001);assert.deepEqual(styled.rest,originalRest);assert(!styled.hasNaN());
const {RotationTool}=require('/tmp/drape-rotationTool.cjs');const r=Object.create(RotationTool.prototype);let mode,changed;r.control={setMode(v){mode=v},attach(){},detach(){throw Error('Sphere must retain translation axes')}};r.proxy=new T.Object3D();r.last=new T.Matrix4();r.enabled=false;r.engine={settings:{selected:'sphere',sphere:{x:1,y:2,z:3,size:.5}},invalidate(){},change(v){changed=v}};r.sync();assert.equal(mode,'translate');r.dragging=true;r.proxy.position.x=4;r.changed();assert.equal(changed.sphere.x,4);assert.equal(changed.sphere.rotation,undefined);
console.log('Drape sag, pinned anchors, reversible mode transition and sphere translation passed.');

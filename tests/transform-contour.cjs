const assert=require('node:assert/strict'),esbuild=require('esbuild'),T=require('three');
for(const n of ['engine','workspace','rotationTool','contour','boxContact'])esbuild.buildSync({entryPoints:[`src/lib/cloth/${n}.ts`],bundle:true,packages:'external',platform:'node',format:'cjs',outfile:`/tmp/edit-${n}.cjs`,logLevel:'silent'});
const {ClothEngine}=require('/tmp/edit-engine.cjs'),{CompositionWorkspace}=require('/tmp/edit-workspace.cjs'),{RotationTool}=require('/tmp/edit-rotationTool.cjs');
const e=Object.create(ClothEngine.prototype);let mode;
Object.assign(e,{rotationTool:{control:{object:{},axis:null},setEnabled(v){mode=v;this.control.object=v===null?undefined:{}}},acc:1,last:20,onTransformMode(v){assert.equal(v,mode)},invalidate(){},settings:{paused:true}});
// No kinematics or solver access while editing, including between pointer drags.
e.advance();e.pointerDown({button:0,clientX:10,clientY:20});e.pointerUp({clientX:11,clientY:21});assert.equal(mode,null);assert.equal(e.settings.paused,true);assert.equal(e.acc,0);
e.setRotationMode(false);e.pointerDown({button:0,clientX:0,clientY:0});e.pointerUp({clientX:30,clientY:0});assert.equal(mode,false,'Orbit gesture is not an exit click');e.pointerDown({button:2,preventDefault(){}});assert.equal(mode,null);
const r=Object.create(RotationTool.prototype);let detached=0;r.enabled=null;r.control={detach(){detached++}};r.engine={settings:{selected:'cloth'}};r.sync();assert.equal(detached,1);
const w=Object.create(CompositionWorkspace.prototype);Object.assign(w,{mode:'rotate',gizmo:{dragging:false},orbit:{enabled:true},paused:true,accumulator:1,last:9,attach(){},emit(){},invalidate(){}});w.setMode(null);assert.equal(w.paused,true);assert.equal(w.accumulator,0);assert.equal(w.last,0);
// Outline rendering restores scene state and reuses its render target.
const {ContourView}=require('/tmp/edit-contour.cjs'),view=new ContourView(),scene=new T.Scene(),camera=new T.PerspectiveCamera();const line=new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial());scene.add(line);const background=new T.Color('red');scene.background=background;let calls=0,target=null;
const renderer={getDrawingBufferSize(v){v.set(100,80)},getRenderTarget(){return target},setRenderTarget(t){target=t},clear(){},render(s){calls++;if(s===scene){assert(!line.visible);assert(scene.overrideMaterial instanceof T.MeshNormalMaterial)}}};
view.render(renderer,scene,camera);const texture=view.target.texture;view.render(renderer,scene,camera);assert.equal(calls,4);assert.equal(view.target.texture,texture);assert.equal(scene.background,background);assert.equal(scene.overrideMaterial,null);assert(line.visible);assert.equal(target,null);view.dispose();
// A vertex already above a contact plane receives less correction than the penetrating vertex.
const {BoxContacts}=require('/tmp/edit-boxContact.cjs');const x=Float32Array.from([-.8,1.48,.2,.8,1.48,.2,0,1.65,.9]);const sim={x,p:x.slice(),w:Float32Array.from([1,1,1]),tris:Uint32Array.from([0,1,2]),thickness:.014,params:{box:{on:true,s:1,x:0,y:1,z:0}}};const before=x.slice();new BoxContacts().solve(sim);assert(x[7]-before[7]<x[1]-before[1]);
console.log('Transform exit, paused physics, manual pause preservation, contour target reuse/state restoration and weighted cube correction passed.');

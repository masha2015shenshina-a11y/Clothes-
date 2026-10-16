const assert=require('node:assert/strict'),T=require('three'),esbuild=require('esbuild');
esbuild.buildSync({entryPoints:['src/lib/cloth/workspace.ts'],bundle:true,packages:'external',platform:'node',format:'cjs',outfile:'/tmp/cloth-workspace-v24.cjs',logLevel:'silent'});
const {CompositionWorkspace}=require('/tmp/cloth-workspace-v24.cjs');
const root=process.argv[2],{DEFAULT_BODY}=require(root+'/mannequin.js'),{DEFAULT_LEGS}=require(root+'/presets.js');
const e=Object.create(CompositionWorkspace.prototype);e.proxy=new T.Object3D();e.lastMatrix=new T.Matrix4();e.dragging=true;e.selected=1;e.part='leftElbow';e.items=[1,2].map(id=>({id,kind:'body',root:structuredClone(DEFAULT_LEGS),body:structuredClone(DEFAULT_BODY)}));e.updateBody=()=>{};e.refreshColliders=()=>{};e.invalidate=()=>{};
e.proxy.rotation.x=1;e.transform();assert(Math.abs(e.items[0].body.left.elbow-180/Math.PI)<1e-7);assert.equal(e.items[0].body.right.elbow,DEFAULT_BODY.right.elbow);assert.deepEqual(e.items[1].body,DEFAULT_BODY);
e.part='rightKnee';e.proxy.rotation.x=-1;e.transform();assert.equal(e.items[0].root.right.knee,0);e.proxy.rotation.x=3;e.transform();assert.equal(e.items[0].root.right.knee,140);
e.part='head';e.proxy.rotation.set(.5,0,.2);e.transform();assert(Math.abs(e.items[0].body.headPitch-T.MathUtils.radToDeg(.5))<1e-7);assert.equal(e.items[0].body.torsoPitch,0);
e.part='root';e.proxy.position.set(2,3,-1);e.transform();assert.equal(e.items[0].root.x,2);assert.equal(e.items[0].root.y,3);assert.equal(e.items[1].root.x,DEFAULT_LEGS.x);
// Cloth transform updates both histories, preserving rest lengths and zero initial velocity.
const x=Float32Array.from([0,1,0,1,1,0]),p=x.slice(),sim={x,p,syncColliderHistory(){},normalsDirty:false};const cloth={id:3,kind:'cloth',sim,anchor:new T.Object3D()};e.items.push(cloth);e.selected=3;e.proxy.rotation.set(0,0,0);e.proxy.position.set(1,2,3);e.lastMatrix.identity();e.syncCloth=()=>{};e.transform();assert.deepEqual(x,Float32Array.from([1,3,3,2,3,3]));assert.deepEqual(x,p);
// Removal disposes rendering resources and rebuilds contact storage without the deleted object.
let geometries=0,materials=0,rebuild=0;const geometry=new T.BufferGeometry(),material=new T.MeshStandardMaterial();geometry.dispose=()=>geometries++;material.dispose=()=>materials++;cloth.mesh=new T.Mesh(geometry,material);e.scene=new T.Scene();e.scene.add(cloth.mesh);e.gizmo={detach(){}};e.rebuildContacts=()=>rebuild++;e.select=()=>{};e.remove();assert.equal(geometries,1);assert.equal(materials,1);assert.equal(rebuild,1);assert(!e.items.includes(cloth));
console.log('Independent body axes, angle limits, cloth transforms and resource disposal passed.');

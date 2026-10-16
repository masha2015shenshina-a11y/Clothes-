import assert from 'node:assert/strict';
import * as T from '../node_modules/three/build/three.module.js';
import {ClothEngine} from '/tmp/cloth-engine-v8.mjs';
const e=Object.create(ClothEngine.prototype);
e.camera=new T.PerspectiveCamera(45,800/600,.1,100);e.camera.position.set(0,1,5);e.camera.lookAt(0,1,0);e.camera.updateMatrixWorld();
e.scene={};e.renderer={render(scene,camera){camera.updateMatrixWorld();}};
e.viewportWidth=800;e.viewportHeight=600;e.labelPoint=new T.Vector3();e.pinGroups=[[0],[1]];e.selectedPin=0;
let writes=0;
e.pinLabels=[0,1].map(()=>({style:new Proxy({},{set(obj,key,value){writes++;obj[key]=value;return true;}}),dataset:{}}));
e.pins={geometry:new T.BufferGeometry()};e.pins.geometry.setAttribute('position',new T.Float32BufferAttribute([-1,2,0,1,2,0],3));
e.pinCenter=()=>{throw Error('Labels must reuse the marker buffer');};
for(const pos of [[3,2,4],[-2,3,2],[0,1,1],[1,4,-3]]){
 e.camera.position.set(...pos);e.camera.lookAt(0,1,0); // matrixWorld intentionally stale until render
 e.renderFrame();
 for(let i=0;i<2;i++){const p=new T.Vector3(i?1:-1,2,0).project(e.camera);assert.equal(e.pinLabels[i].style.transform,`translate3d(${(p.x+1)*400}px,${(1-p.y)*300}px,0) translate(-50%,-50%)`);}
}
const lastWrites=writes;e.renderFrame();assert.equal(writes,lastWrites,'unchanged labels must not write styles');
e.viewportWidth=1200;e.viewportHeight=400;e.camera.aspect=3;e.camera.updateProjectionMatrix();e.renderFrame();
const p=new T.Vector3(-1,2,0).project(e.camera);assert.equal(e.pinLabels[0].style.transform,`translate3d(${(p.x+1)*600}px,${(1-p.y)*200}px,0) translate(-50%,-50%)`);
console.log('Pin labels: same-frame camera projection, resize, cached centers and unchanged-style writes passed.');

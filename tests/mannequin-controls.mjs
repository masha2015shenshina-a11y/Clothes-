import assert from 'node:assert/strict';
import * as T from '../node_modules/three/build/three.module.js';
import {createRequire} from 'node:module';
import {ClothEngine} from '/tmp/cloth-engine-v17.mjs';
const require=createRequire(import.meta.url),{DEFAULT_BODY}=require('/tmp/cloth-v17-test/mannequin.js'),{DEFAULT_LEGS}=require('/tmp/cloth-v17-test/presets.js');
function stub(){const e=Object.create(ClothEngine.prototype);Object.assign(e,{sim:{endGrab(){}},settings:{selected:'leftBodyArm',body:{...structuredClone(DEFAULT_BODY),on:true},legs:{...structuredClone(DEFAULT_LEGS),linked:false}},dragId:1,pinPress:null,pinDrag:null,editRevision:0,offset:new T.Vector3(),plane:new T.Plane(),ray:{ray:{intersectPlane(plane,out){out.set(-.7,2.5,.4);return out;}}},setNdc(){},invalidate(){},change(p){this.settings={...this.settings,...p};}});return e;}
let e=stub();e.objectDrag='leftBodyArm';const right=structuredClone(e.settings.body.right);e.pointerMove({pointerId:1});assert.deepEqual(e.settings.body.right,right);assert.notDeepEqual(e.settings.body.left,right);
e.settings.body.linked=true;e.pointerMove({pointerId:1});assert.deepEqual(e.settings.body.left,e.settings.body.right);
e=stub();e.objectDrag='leftLeg';const other=structuredClone(e.settings.legs.right);e.pointerMove({pointerId:1});assert.deepEqual(e.settings.legs.right,other);e.settings.legs.linked=true;e.pointerMove({pointerId:1});assert.deepEqual(e.settings.legs.left,e.settings.legs.right);
e=stub();e.dragId=null;e.settings.selected='pins';e.pinGroups=[[13,14]];e.pickPin=()=>0;e.lastPinTap={id:13,time:100,x:10,y:10};let removed=-1;e.removePin=i=>removed=i;e.onChange=()=>{};
e.pointerDown({button:0,timeStamp:250,clientX:12,clientY:11,preventDefault(){},stopImmediatePropagation(){}});assert.equal(removed,0);
e=stub();e.objectDrag='pins';e.pinPress={id:1,time:0,x:0,y:0,moved:true};e.controls={enabled:false};e.renderer={domElement:{hasPointerCapture:()=>false,style:{}}};e.lastPinTap={id:1,time:0,x:0,y:0};e.pointerUp({pointerId:1,timeStamp:100,clientX:30,clientY:0});assert.equal(e.lastPinTap.id,-1,'a drag cannot become a double tap');
console.log('Independent and linked arm/leg gestures, double-tap removal and drag exclusion passed.');

// Fixed shoulder supports never enter the editable pin groups.
e=stub();e.pinLabels=[];e.geometryDirty=false;e.sim={n:3,baseW:new Float32Array([0,0,0]),locked:new Uint8Array([1,1,0]),neighbours:[new Set([1,2]),new Set([0]),new Set([0])]};e.rebuildPinGroups();assert.deepEqual(e.pinGroups,[[2]]);
console.log('Fixed shoulders excluded from editable supports.');

import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {ClothEngine} from '/tmp/cloth-engine-v17.mjs';
import {mannequinGeometries,limbGeometry} from '/tmp/mannequin-geometry-v17.mjs';
const require=createRequire(import.meta.url),{DEFAULT_BODY,UPPER_ARM,FOREARM,bodyEllipsoids}=require('/tmp/cloth-v17-test/mannequin.js'),{DEFAULT_LEGS,DEFAULT_SLEEVE,DEFAULT_SKIRT,buildPreset,MATERIALS}=require('/tmp/cloth-v17-test/presets.js'),{ClothSim}=require('/tmp/cloth-v17-test/solver.js');
const engine=Object.create(ClothEngine.prototype);engine.settings={mannequin:true,legsEnabled:true,armEnabled:false,body:{...structuredClone(DEFAULT_BODY),on:true,cape:true},legs:structuredClone(DEFAULT_LEGS)};engine.legPose=structuredClone(engine.settings.legs);engine.bodyPose=structuredClone(engine.settings.body);
assert(UPPER_ARM>FOREARM);assert.equal(engine.allCapsules().length,12);
const right=engine.extremityCapsules().at(-1);engine.bodyPose.left.elbow=95;assert.deepEqual(engine.extremityCapsules().at(-1),right,'left arm moved right palm');
const geometry=mannequinGeometries();for(const g of [...geometry.body,geometry.hand,geometry.foot,limbGeometry(.85,.145)]){assert(Array.from(g.attributes.position.array).every(Number.isFinite));assert(Array.from(g.index.array).every(i=>i<g.attributes.position.count));}
const sim=new ClothSim(buildPreset('pants','top',DEFAULT_SLEEVE,DEFAULT_SKIRT,engine.settings.legs,engine.settings.body),{...MATERIALS.cotton,stretch:0,gravity:9.81,windX:0,windZ:1,windStrength:0,selfCollision:true,capsules:engine.allCapsules(),ellipsoids:bodyEllipsoids(engine.settings.legs,true),sphere:{on:false,r:1,x:0,y:0,z:0},box:{on:false,s:1,x:0,y:0,z:0}});
const start=performance.now();for(let i=0;i<90;i++){engine.bodyPose.left.elbow=i;engine.legPose.left.knee=i;sim.params.capsules=engine.allCapsules();sim.step(1/30);assert(!sim.hasNaN());}console.log('Full outfit with palms/feet:',((performance.now()-start)/90).toFixed(1),'ms/step; independent parts and finite mesh data passed.');
engine.settings.mannequin=false;engine.settings.legsEnabled=false;assert.equal(engine.allCapsules().length,0,'hidden mannequin retained collisions');

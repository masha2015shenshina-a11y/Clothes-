// Run with --expose-gc: catch retained solver buffers across garment rebuilds.
const assert = require('node:assert/strict');
const root = process.argv[2];
const {buildPreset, DEFAULT_LEGS, DEFAULT_SLEEVE, DEFAULT_SKIRT, MATERIALS} = require(root + '/presets.js');
const {DEFAULT_BODY} = require(root + '/mannequin.js');
const {ClothSim} = require(root + '/solver.js');
assert(global.gc, 'Run node --expose-gc');
function batch() {
  for (let i = 0; i < 20; i++) {
    const build = buildPreset(i % 2 ? 'body' : 'pants', 'top', DEFAULT_SLEEVE, DEFAULT_SKIRT, DEFAULT_LEGS,
      {...DEFAULT_BODY, on:true, cape:i%3!==0, sleeves:i%2===0}, .8);
    const sim = new ClothSim(build, {...MATERIALS.cotton, gravity:9.81, stretch:0, windX:0, windZ:1, windStrength:0,
      selfCollision:false, sphere:{on:false,r:1,x:0,y:0,z:0}, box:{on:false,s:1,x:0,y:0,z:0}});
    sim.step(1/30);
    assert(!sim.hasNaN());
  }
}
batch(); global.gc(); const initial = process.memoryUsage();
for(let i=0;i<4;i++) batch();
global.gc(); const final = process.memoryUsage();
const retained = final.heapUsed + final.arrayBuffers - initial.heapUsed - initial.arrayBuffers;
assert(retained < 8*1024*1024, 'Solver rebuilds retained excessive memory');
console.log('100 rebuilds: retained heap/buffers delta', (retained/1024/1024).toFixed(2), 'MiB (excludes GPU/browser)');

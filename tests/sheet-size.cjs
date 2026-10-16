const assert=require('node:assert/strict'),esbuild=require('esbuild');
esbuild.buildSync({entryPoints:['src/lib/cloth/presets.ts'],bundle:true,platform:'node',format:'cjs',outfile:'/tmp/sheet-size.cjs',logLevel:'silent'});
const {buildPreset,PRESETS}=require('/tmp/sheet-size.cjs');
assert(!PRESETS.some(p=>['one','wide','narrow','free'].includes(p.id)));
for(const width of [.3,2,4])for(const length of [.3,2,4]){
 const b=buildPreset('two','two',undefined,undefined,undefined,undefined,1,{width,length});
 assert(b.pinned.length<=2400);assert.equal([...b.pinned].filter(Boolean).length,2);
 const xs=[],ys=[];for(let i=0;i<b.x.length;i+=3){xs.push(b.x[i]);ys.push(b.x[i+1]);}
 assert(Math.abs(Math.max(...xs)-Math.min(...xs)-width*.8)<1e-5);
 assert(Math.abs(Math.max(...ys)-Math.min(...ys)-length)<1e-5);assert(Math.min(...ys)>.14);
 assert([...b.rest].every(v=>Number.isFinite(v)&&v>0));
}
console.log('Unified sheet dimensions, two initial pins, floor clearance and mesh budget passed.');

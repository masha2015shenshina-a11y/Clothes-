const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {resolve}=require('node:path');
function loadPhysics(entry){
  const filename=resolve('src/lib/cloth',entry+'.ts');
  const bundle=buildSync({entryPoints:[filename],bundle:true,write:false,platform:'node',format:'cjs',packages:'external'});
  const mod=new Module(filename,module);mod.paths=module.paths;
  mod._compile(bundle.outputFiles[0].text,filename);
  return mod.exports;
}
const {buildPreset,DEFAULT_LEGS,MATERIALS,legPoints}=loadPhysics('presets');
const {DEFAULT_BODY}=loadPhysics('mannequin');
const {ClothSim}=loadPhysics('solver');
const {tableParts}=loadPhysics('studioTools');
const legs=structuredClone(DEFAULT_LEGS);
legs.left={hip:20,knee:12,spread:-20};legs.right={hip:-5,knee:2,spread:-8};
assert(legPoints(legs,'left')[2][0]>legPoints(legs,'right')[2][0]);
const shirt={...DEFAULT_BODY,on:true,sleeves:true,belted:true};
const pattern=ease=>buildPreset('body','top',undefined,undefined,legs,{...shirt,ease},.6);
const fitted=pattern(.03),wide=pattern(.24);
assert(fitted.beltVertices.length>0);
assert.deepEqual(fitted.x.slice(3*fitted.upper.sleevesStart),wide.x.slice(3*wide.upper.sleevesStart));
assert(fitted.index.every(i=>i<fitted.map.length));
const sheet=buildPreset('two','none',undefined,undefined,undefined,undefined,.6);
for(let o=0;o<sheet.x.length;o+=3){
  const y=sheet.x[o+1];sheet.x[o+1]=1.55+sheet.x[o+2];sheet.x[o+2]=y-1.6;
}
const off={on:false,x:0,y:0,z:0,r:1,s:1};
for(const material of ['cotton','silk']){
  const sim=new ClothSim(sheet,{...MATERIALS[material],stretch:0,gravity:9.81,windX:.25,windZ:.97,windStrength:2.2,sphere:off,box:off,boxes:tableParts,tabletop:tableParts[0]});
  const center=()=>{let x=0,z=0;for(let o=0;o<sim.x.length;o+=3){x+=sim.x[o];z+=sim.x[o+2];}return [x/sim.n,z/sim.n];};
  for(let i=0;i<120;i++)sim.step(1/30);
  const start=center();
  for(let i=0;i<240;i++)sim.step(1/30);
  const end=center(),drift=Math.hypot(end[0]-start[0],end[1]-start[1]);
  let supported=0;
  for(let o=0;o<sim.x.length;o+=3)if(Math.abs(sim.x[o])<.69&&Math.abs(sim.x[o+2])<.48&&Math.abs(sim.x[o+1]-.964)<.028)supported++;
  console.log(material,{supported,particles:sim.n,drift});
  assert(!sim.hasNaN()&&supported>sim.n*.10&&drift<.10);
}

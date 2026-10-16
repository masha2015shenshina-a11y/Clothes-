const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];assert(html.indexOf('background:#15191e')<html.indexOf('/src/main.tsx'));
function boot(){const nodes={boot:{hidden:false},'boot-message':{textContent:''},'boot-retry':{hidden:true,addEventListener(){}}};const listeners={};let cleared=0;vm.runInNewContext(script,{document:{getElementById:id=>nodes[id]},window:{addEventListener:(name,fn)=>listeners[name]=fn},setTimeout:()=>1,clearTimeout:()=>cleared++,location:{reload(){}}});return {nodes,listeners};}
let b=boot();b.listeners['cloth-ready']();assert(b.nodes.boot.hidden);b.listeners['cloth-failed']({detail:'CONTEXT LOST'});assert(!b.nodes.boot.hidden);assert(!b.nodes['boot-retry'].hidden);b.listeners['cloth-ready']();assert(b.nodes.boot.hidden);
b=boot();b.listeners.error();assert(!b.nodes.boot.hidden);assert(!b.nodes['boot-retry'].hidden);
b=boot();b.listeners.unhandledrejection();assert(!b.nodes['boot-retry'].hidden);
console.log('Dark boot shell, first-frame reveal, asset failure and context recovery passed.');

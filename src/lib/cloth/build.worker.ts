import {buildPreset} from './presets';
// Only typed mesh buffers cross the thread boundary; no duplicate geometry cache.
self.onmessage=(event:MessageEvent<{id:number;args:Parameters<typeof buildPreset>}>)=>{
 const {id,args}=event.data;
 try {const build=buildPreset(...args);self.postMessage({id,build},{transfer:[...Object.values(build).filter(ArrayBuffer.isView).map(a=>(a as ArrayBufferView).buffer as ArrayBuffer),...(build.upper?[build.upper.reference.buffer as ArrayBuffer]:[]),...(build.waist?[build.waist.indices.buffer as ArrayBuffer,build.waist.reference.buffer as ArrayBuffer]:[])]});}
 catch(error){self.postMessage({id,error:error instanceof Error?error.message:'Не удалось подготовить одежду'});}
};

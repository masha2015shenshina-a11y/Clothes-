import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import type { SimParams, ClothSim } from './solver';

type Box = SimParams['box'];
export const tableParts: Box[] = [
  {on:true,x:0,y:.91,z:0,s:1,width:1.38,height:.08,depth:.96},
  ...[-.59,.59].flatMap(x=>[-.38,.38].map(z=>({on:true,x,y:.435,z,s:.075,width:.075,height:.87,depth:.075})))
];

export function makeTable(){
  const group=new Group(), geometry=new BoxGeometry(), material=new MeshStandardMaterial({color:'#94745a',roughness:.85});
  for(const part of tableParts){
    const piece=new Mesh(geometry,material);
    piece.scale.set(part.width!,part.height!,part.depth!);
    piece.position.set(part.x,part.y,part.z);
    piece.castShadow=piece.receiveShadow=true;
    group.add(piece);
  }
  return group;
}

// Transfer friction for a kinematic edit. Moving both Verlet
// buffers gathers the cloth without injecting a velocity spike on release.
export function carryContact(sim:ClothSim,box:Box,dx:number,dy:number,dz:number){
  if(!box.on||!(dx||dy||dz))return;
  const hx=(box.width??box.s)/2,hy=(box.height??box.s)/2,hz=(box.depth??box.s)/2;
  const b=box.basis;
  for(let i=0;i<sim.n;i++){
    if(!sim.w[i])continue;
    const o=i*3,x=sim.x[o]-box.x,y=sim.x[o+1]-box.y,z=sim.x[o+2]-box.z;
    const lx=b?x*b[0]+y*b[1]+z*b[2]:x,ly=b?x*b[3]+y*b[4]+z*b[5]:y,lz=b?x*b[6]+y*b[7]+z*b[8]:z;
    const distance=Math.max(Math.abs(lx)-hx,Math.abs(ly)-hy,Math.abs(lz)-hz);
    if(distance>.045)continue;
    sim.releaseTableGrip(i);
    const grip=Math.min(.95,.5+sim.params.friction)*(1-Math.max(0,distance)/.045);
    for(const buffer of [sim.x,sim.p]){
      buffer[o]+=dx*grip;buffer[o+1]+=dy*grip;buffer[o+2]+=dz*grip;
    }
  }
  sim.normalsDirty=true;
}

export function downloadFrame(canvas:HTMLCanvasElement){
  canvas.toBlob(blob=>{
    if(!blob)return;
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='skladka-'+Date.now()+'.png';
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches)
      canvas.animate([{opacity:.32},{opacity:1}],{duration:180});
  },'image/png');
}

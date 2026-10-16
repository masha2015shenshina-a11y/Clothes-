import {armPoints,armTransform,ARM_RADIUS,type SleeveSettings} from './presets';
import {limbRing} from './jointMesh';
import type {ClothSim} from './solver';
/** Update only when the arm pose changes, never in the per-particle collision loop. */
export function updateSoloSleeve(sim:ClothSim,pose:SleeveSettings){
 const meta=sim.sleeveSupport;if(!meta)return;
 const guides=sim.upperGuides??(sim.upperGuides=new Float32Array(sim.n*4));
 const sectors=sim.upperSectors??(sim.upperSectors=new Float32Array(sim.n*7));
 guides.fill(0);sectors.fill(0);
 const points=armPoints(pose.angle,pose);
 const origin=armTransform([-.85,1.65,0],pose),up=armTransform([-.85,2.65,0],pose).map((v,k)=>v-origin[k]) as [number,number,number];
 for(let row=1;row<meta.distances.length;row++){
  const d=meta.distances[row];if(d>1.7||d<.3)continue;
  const ring=limbRing(points,d,.85,.85,.16,up);
  const allowance=ARM_RADIUS+pose.ease+.14+.1*Math.sin(pose.angle*Math.PI/360)*Math.exp(-(((d-.85)/.2)**2));
  for(let col=0;col<meta.count;col++){
   const i=row*meta.count+col,g=i*4,s=i*7,a=col/meta.count*Math.PI*2;
   for(let k=0;k<3;k++){guides[g+k]=sectors[s+k]=ring.center[k];sectors[s+3+k]=ring.radial[k]*Math.cos(a)+ring.normal[k]*Math.sin(a);}
   guides[g+3]=allowance;sectors[s+6]=ARM_RADIUS*.3;
  }
 }
}
/** Carry both Verlet positions through elbow motion so collision does not have to pull the arm out of the cloth. */
export function followSoloSleeve(sim:ClothSim,pose:SleeveSettings,before:number,after:number){
 const meta=sim.sleeveSupport;if(!meta)return;
 const delta=(after-before)*Math.PI/180;
 for(let row=1;row<meta.distances.length;row++){
  const u=Math.max(0,Math.min(1,(meta.distances[row]-.65)/.4)),angle=delta*u*u*(3-2*u),c=Math.cos(angle),s=Math.sin(angle);
  if(!angle)continue;
  for(let col=0;col<meta.count;col++){const i=row*meta.count+col;if(!sim.baseW[i])continue;const o=i*3;
   for(const buffer of [sim.x,sim.p]){const p=armTransform([buffer[o],buffer[o+1],buffer[o+2]],pose,true),x=p[0],y=p[1]-1.65;buffer.set(armTransform([c*x-s*y,1.65+s*x+c*y,p[2]],pose),o);}
  }
 }
 sim.normalsDirty=true;
}

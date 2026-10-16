import {limbRing} from './jointMesh';
import {Matrix4,Quaternion,Vector3} from 'three';
import {legPoints,LEG_SEGMENT,LEG_RADIUS,type LegsSettings,type ClothBuild} from './presets';
import type {ClothSim} from './solver';
export function updateLegGuides(sim:ClothSim,build:ClothBuild,pose:LegsSettings,enabled:boolean){
 if(!enabled||!build.legSkin.some((v,i)=>i%2===0&&v!==0)){sim.legGuides=null;sim.legSectors=null;return;}
 const g=sim.legGuides??(sim.legGuides=new Float32Array(sim.n*4)),points=[legPoints(pose,'left'),legPoints(pose,'right')];
 const sectors=sim.legSectors??(sim.legSectors=new Float32Array(sim.n*7));sectors.fill(0);
 const rows=new Map<string,ReturnType<typeof limbRing>>();
 for(let i=0;i<sim.n;i++){const side=build.legSkin[i*2],d=build.legSkin[i*2+1],o=i*4;if(!side||d<.30){g[o+3]=0;continue;}const p=points[side<0?0:1],segment=d<LEG_SEGMENT?0:1,t=(d-segment*LEG_SEGMENT)/LEG_SEGMENT;for(let k=0;k<3;k++)g[o+k]=p[segment][k]+(p[segment+1][k]-p[segment][k])*t;const knee=pose[side<0?"left":"right"].knee*Math.PI/180;g[o+3]=LEG_RADIUS+pose.ease+.055+.07*Math.sin(knee/2)*Math.exp(-(((d-LEG_SEGMENT)/.18)**2));
 // Preserve the circumferential side through a knee bend; allow tangential sliding.
 const key=side+":"+d;let ring=rows.get(key);if(!ring){ring=limbRing(p,d,LEG_SEGMENT,LEG_SEGMENT,.17,'x');rows.set(key,ring);}
 const angle=build.legAngles?.[i];if(angle===undefined)continue;
 const k=i*7;sectors[k]=g[o];sectors[k+1]=g[o+1];sectors[k+2]=g[o+2];
 for(let axis=0;axis<3;axis++)sectors[k+3+axis]=ring.radial[axis]*Math.cos(angle)+ring.normal[axis]*Math.sin(angle);
 sectors[k+6]=LEG_RADIUS*.3;
 }

}
export function followLegPose(sim:ClothSim,build:ClothBuild,before:LegsSettings,after:LegsSettings){
 if(!(['left','right'] as const).some(s=>(['hip','knee','spread'] as const).some(k=>before[s][k]!==after[s][k])))return;
 const matrices:Matrix4[]=[];
 for(const side of ['left','right'] as const){const a=legPoints({...before,x:after.x,y:after.y,z:after.z},side).map(p=>new Vector3(...p)),b=legPoints(after,side).map(p=>new Vector3(...p));for(let j=0;j<2;j++){const q=new Quaternion().setFromUnitVectors(a[j+1].clone().sub(a[j]).normalize(),b[j+1].clone().sub(b[j]).normalize());matrices.push(new Matrix4().makeTranslation(...b[j].toArray()).multiply(new Matrix4().makeRotationFromQuaternion(q)).multiply(new Matrix4().makeTranslation(-a[j].x,-a[j].y,-a[j].z)));}}
 const v=new Vector3(),u=new Vector3();
 for(let i=0;i<sim.n;i++){const side=build.legSkin[i*2],d=build.legSkin[i*2+1];if(!side||!sim.baseW[i])continue;const base=side<0?0:2,t=Math.max(0,Math.min(1,(d-.68)/.34)),blend=t*t*(3-2*t),weight=Math.min(1,d/.35),o=i*3;for(let history=0;history<2;history++){const buffer=history?sim.p:sim.x;v.fromArray(buffer,o).applyMatrix4(matrices[base]);u.fromArray(buffer,o).applyMatrix4(matrices[base+1]);v.lerp(u,blend);for(let k=0;k<3;k++)buffer[o+k]+=(v.getComponent(k)-buffer[o+k])*weight;}}
 sim.normalsDirty=true;
}

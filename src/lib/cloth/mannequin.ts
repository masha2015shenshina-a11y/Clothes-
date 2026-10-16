import {neckline,tunicPanel,capeProfile} from './garmentProfile';
import {jointRows,limbRing} from './jointMesh';
import type {Builder,LegsSettings,V3} from './presets';
export type Side='left'|'right';
export interface ArmPose {raise:number;forward:number;elbow:number;}
export interface BodySettings {on:boolean;sleeves:boolean;torsoPitch:number;torsoLean:number;headPitch:number;headLean:number;arms:boolean;linked:boolean;left:ArmPose;right:ArmPose;tunic:boolean;length:number;ease:number;cape:boolean;capeLength:number;hood:'up'|'down';}
export const DEFAULT_BODY:BodySettings={on:false,sleeves:false,torsoPitch:0,torsoLean:0,headPitch:0,headLean:0,arms:true,linked:false,left:{raise:12,forward:0,elbow:12},right:{raise:12,forward:0,elbow:12},tunic:true,length:1.05,ease:.045,cape:false,capeLength:1.5,hood:'down'};
export const UPPER_ARM=.63,FOREARM=.56,BODY_ARM_RADIUS=.09;
export function bodyArmPoints(root:LegsSettings,body:BodySettings,side:Side):[V3,V3,V3]{
 const sign=side==='left'?-1:1,p=body[side],r=p.raise*Math.PI/180,f=p.forward*Math.PI/180,e=(p.forward+p.elbow)*Math.PI/180;
 const a:V3=[root.x+sign*.37,root.y+.80,root.z];
 const v=(angle:number,len:number):V3=>[sign*Math.sin(r)*len,-Math.cos(r)*Math.cos(angle)*len,Math.cos(r)*Math.sin(angle)*len];
 const u=v(f,UPPER_ARM),w=v(e,FOREARM),b:V3=[a[0]+u[0],a[1]+u[1],a[2]+u[2]];
 return [a,b,[b[0]+w[0],b[1]+w[1],b[2]+w[2]]].map(p=>upperTransform(p as V3,root,body)) as [V3,V3,V3];
}
/** Stable sleeve frame, including forward angles passing through vertical. */
export function sleeveRing(points:[V3,V3,V3],distance:number,pose:ArmPose,side:Side){
 const u=Math.max(0,Math.min(1,(distance-UPPER_ARM+.13)/.26)),blend=u*u*(3-2*u);
 const raise=pose.raise*Math.PI/180,angle=(pose.forward+pose.elbow*blend)*Math.PI/180,sign=side==='left'?-1:1;
 const hint:V3=[Math.cos(raise),sign*Math.sin(raise)*Math.cos(angle),-sign*Math.sin(raise)*Math.sin(angle)];
 return limbRing(points,distance,UPPER_ARM,FOREARM,.13,hint);
}
export function rotateUpper(p:V3,pitch=0,lean=0,inverse=false):V3{
 const a=pitch*Math.PI/180,b=-lean*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);
 const [x,y,z]=p;if(inverse){const u=cb*x+sb*y,v=-sb*x+cb*y;return [u,ca*v+sa*z,-sa*v+ca*z];}
 const v=ca*y-sa*z,w=sa*y+ca*z;return [cb*x-sb*v,sb*x+cb*v,w];
}
export function upperTransform(p:V3,r:LegsSettings,s:BodySettings,inverse=false,head=false):V3{
 let v:V3=[p[0]-r.x,p[1]-r.y,p[2]-r.z];
 if(inverse){v=rotateUpper(v,s.torsoPitch,s.torsoLean,true);if(head){v[1]-=1.03;v=rotateUpper(v,s.headPitch,s.headLean,true);v[1]+=1.03;}}
 else {if(head){v[1]-=1.03;v=rotateUpper(v,s.headPitch,s.headLean);v[1]+=1.03;}v=rotateUpper(v,s.torsoPitch,s.torsoLean);}
 return [v[0]+r.x,v[1]+r.y,v[2]+r.z];
}
export function bodyEllipsoids(root:LegsSettings,upper:boolean,body:BodySettings=DEFAULT_BODY){
 const at=(dy:number,rx:number,ry:number,rz:number)=>({x:root.x,y:root.y+dy,z:root.z,rx,ry,rz,basis:undefined as number[]|undefined});
 const all=[at(-.05,.34,.20,.22),...(upper?[at(.28,.235,.32,.17),at(.60,.36,.36,.225),at(1.03,.10,.17,.10),at(1.30,.19,.25,.20)]:[])];
 for(let i=1;i<all.length;i++){const e=all[i],q=upperTransform([e.x,e.y,e.z],root,body,false,i===4);e.x=q[0];e.y=q[1];e.z=q[2];e.basis=([ [1,0,0],[0,1,0],[0,0,1]] as V3[]).flatMap(v=>rotateUpper(i===4?rotateUpper(v,body.headPitch,body.headLean):v,body.torsoPitch,body.torsoLean));}
 return all;
}
export function addUpperGarments(b:Builder,s:BodySettings,r:LegsSettings){
 if(!s.on)return;
 const upperStart=b.pos.length/3;let capeStart=-1,hoodStart=-1,sleevesStart=-1;
 const top=r.y+.90;
 const sleeveCols=20,sleeveDistances=jointRows(UPPER_ARM+FOREARM-.06,17,[[.10,.12],[UPPER_ARM,.18]],6);
 if(s.tunic){
 const columns=Array.from({length:21},(_,i)=>(i-10)/10).concat([-.95,-.85,.85,.95]).sort((a,b)=>a-b);
 const drops=jointRows(s.length,b.resolution(Math.ceil(s.length/.10)+1),[[.16,.20]],4);
 const C=columns.length,R=drops.length,base=b.pos.length/3,w=.385,depth=.25;
 for(const face of [1,-1])b.grid({cols:C,rows:R,wrap:false,at:(i,j)=>{
 const p=tunicPanel(columns[i],drops[j],s.length,s.ease,face);
 return [r.x+p[0],top+p[1],r.z+p[2]];},uvAt:(i,j)=>[(columns[i]+1)/2,drops[j]],pin:(_i,j)=>j===0});
 for(let i=base;i<b.pinned.length;i++)b.locked[i]=b.pinned[i];
 const weld=new Map<number,number>();
 for(let j=0;j<R;j++)if(drops[j]>.28)for(const i of [0,C-1]){weld.set(base+C*R+j*C+i,base+j*C+i);b.seam[base+j*C+i]=1;}
 // Rounded shoulder saddles bridge front and back without collapsing a row into triangles.
 for(const sign of [-1,1]){
   const start=b.pinned.length;
   const shoulder=[.6,.7,.8,.85,.9,.95,1],S=shoulder.length;
   b.grid({cols:S,rows:5,wrap:false,at:(i,j)=>{const u=sign*shoulder[i],angle=j/4*Math.PI,waist=Math.exp(-((.6/.23)**2));return [r.x+u*(w-.035*waist),top-neckline(u)+.06*Math.sin(angle)*Math.sqrt(Math.max(0,1-u*u)),r.z+(depth-.018*waist)*Math.sqrt(Math.max(0,1-u*u))*Math.cos(angle)];},uvAt:(i,j)=>[i/(S-1),j/4*.2],pin:()=>true});
   for(let i=start;i<b.pinned.length;i++)b.locked[i]=1;
   for(let i=0;i<S;i++){const col=columns.findIndex(u=>Math.abs(u-sign*shoulder[i])<1e-6);weld.set(start+i,base+col);weld.set(start+4*S+i,base+C*R+col);}
   const edge=sign<0?0:C-1;weld.set(base+C*R+edge,base+edge);
   for(let j=0;j<5;j++)weld.set(start+j*S+S-1,base+edge);
 }
 const keep=b.pinned.map((_,i)=>i).filter(i=>!weld.has(i)),indices=new Map(keep.map((v,i)=>[v,i])),remap=(i:number)=>{while(weld.has(i))i=weld.get(i)!;return indices.get(i)!;};
 b.cons=b.cons.map(remap);b.map=b.map.map(remap);b.pos=keep.flatMap(i=>b.pos.slice(i*3,i*3+3));b.pinned=keep.map(i=>b.pinned[i]);b.locked=keep.map(i=>b.locked[i]);b.legSkin=keep.flatMap(i=>b.legSkin.slice(i*2,i*2+2));b.legAngles=keep.map(i=>b.legAngles[i]);b.seam=keep.map(i=>b.seam[i]);
 b.restPos=keep.flatMap(i=>i<base?b.restPos.slice(i*3,i*3+3):b.pos.slice(indices.get(i)!*3,indices.get(i)!*3+3));
 }
 if(s.cape){const N=32,drops=jointRows(s.capeLength,b.resolution(Math.ceil(s.capeLength/.09)+1),[[.20,.22]],3),rows=drops.length,capeBase=b.pos.length/3;
 capeStart=capeBase;
 const collar=(a:number):V3=>[r.x+Math.sin(a)*.13,r.y+.99-.025*Math.cos(a),r.z+Math.cos(a)*.14];
 b.grid({cols:N,rows,wrap:false,at:(i,j)=>{const a=.48+i/(N-1)*(2*Math.PI-.96),profile=capeProfile(drops[j]);
 if(j===0)return collar(a);return [r.x+Math.sin(a)*profile.width,r.y+profile.height-.025*Math.cos(a)*profile.collarWeight,r.z+Math.cos(a)*profile.depth];},uvAt:(i,j)=>[i/(N-1)*2,drops[j]],pin:(_i,j)=>j===0});
 // Neck ring stays fixed in both poses. Hood is changed as a preset, not pulled through the head.
 hoodStart=b.pos.length/3;
 const up=s.hood==='up',C=N,R=10,hoodBase=b.pos.length/3,obstacles=bodyEllipsoids(r,true);
 const outside=(p:V3):V3=>{for(const e of obstacles){const dx=p[0]-e.x,dy=p[1]-e.y,dz=p[2]-e.z,rx=e.rx+.025,ry=e.ry+.025,rz=e.rz+.025,q=Math.sqrt((dx/rx)**2+(dy/ry)**2+(dz/rz)**2);if(q>0&&q<1){p=[e.x+dx/q,e.y+dy/q,e.z+dz/q];}}return p;};
 b.grid({cols:C,rows:R,wrap:false,at:(i,j)=>{const a=.48+i/(C-1)*(2*Math.PI-.96),t=j/(R-1);
 if(j===0)return collar(a);
 if(up){const rad=.13+.17*Math.sin(t*Math.PI)-.08*t;return outside([r.x+Math.sin(a)*rad,r.y+.99+t*.60,r.z+Math.cos(a)*rad]);}
 const rad=.13+.15*Math.sin(t*Math.PI);return outside([r.x+Math.sin(a)*rad,r.y+.99-.22*t+.02*Math.cos(a)*t,r.z+Math.cos(a)*.14*(1-t)-.32*t]);},uvAt:(i,j)=>[i/(C-1),j/(R-1)],pin:(_i,j)=>j===0});
 const weld=new Map<number,number>();for(let i=0;i<C;i++)weld.set(hoodBase+i,capeBase+i);
 const keep=b.pinned.map((_,i)=>i).filter(i=>!weld.has(i)),indices=new Map(keep.map((v,i)=>[v,i])),remap=(i:number)=>indices.get(weld.get(i)??i)!;
 b.cons=b.cons.map(remap);b.map=b.map.map(remap);b.pos=keep.flatMap(i=>b.pos.slice(i*3,i*3+3));b.restPos=keep.flatMap(i=>b.restPos.slice(i*3,i*3+3));b.pinned=keep.map(i=>b.pinned[i]);b.locked=keep.map(i=>b.locked[i]);b.legSkin=keep.flatMap(i=>b.legSkin.slice(i*2,i*2+2));b.legAngles=keep.map(i=>b.legAngles[i]);b.seam=keep.map(i=>b.seam[i]);
 }
 if(capeStart>=0){for(let i=capeStart;i<capeStart+32;i++)b.locked[i]=1;}
 if(s.tunic&&s.sleeves&&s.arms){
 sleevesStart=b.pos.length/3;
 const neutral={...s,torsoPitch:0,torsoLean:0};
 for(const side of ['left','right'] as const){const points=bodyArmPoints(r,neutral,side),start=b.pos.length/3,N=sleeveCols,R=sleeveDistances.length;
 const rings=sleeveDistances.map(d=>sleeveRing(points,d,s[side],side));
 b.grid({cols:N,rows:R,wrap:true,at:(i,j)=>{const d=sleeveDistances[j],ring=rings[j],angle=i/N*Math.PI*2;
 const bend=.025*Math.sin(s[side].elbow*Math.PI/360)*Math.exp(-(((d-UPPER_ARM)/.16)**2));
 const rad=.115+s.ease*.25+bend;
 return ring.center.map((q,k)=>q+rad*(ring.radial[k]*Math.cos(angle)+ring.normal[k]*Math.sin(angle))) as V3;},uvAt:(i,j)=>[i/N,sleeveDistances[j]],pin:()=>false});
 // Sew the sleeve mouth to the tunic instead of rotating a fixed ring through the chest.
 const tunicEnd=capeStart>=0?capeStart:sleevesStart;
 for(let i=start;i<start+N;i++){
  const o=i*3;let nearest=upperStart,best=Infinity;
  for(let k=upperStart;k<tunicEnd;k++){const q=k*3,dx=b.pos[o]-b.pos[q],dy=b.pos[o+1]-b.pos[q+1],dz=b.pos[o+2]-b.pos[q+2],d=dx*dx+dy*dy+dz*dz;if(d<best){best=d;nearest=k;}}
  b.cons.push(i,nearest);b.ctype.push(3);b.seam[i]=b.seam[nearest]=1;
 }

 }
 }
 b.upper={start:upperStart,capeStart,hoodStart,sleevesStart,sleeveCols,sleeveDistances,reference:new Float32Array(b.pos.slice(upperStart*3).map((v,i)=>v-[r.x,r.y,r.z][i%3]))};
 for(let i=upperStart;i<b.pos.length/3;i++){const p=upperTransform(b.pos.slice(i*3,i*3+3) as V3,r,s,false,hoodStart>=0&&i>=hoodStart&&(sleevesStart<0||i<sleevesStart)&&s.hood==='up');for(let k=0;k<3;k++)b.pos[i*3+k]=p[k];}

}

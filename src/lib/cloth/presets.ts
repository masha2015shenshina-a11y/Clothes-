import {jointRows} from './jointMesh';
import {addUpperGarments,DEFAULT_BODY,type BodySettings} from "./mannequin";
export type PinMode = "two" | "one" | "top" | "none";
export type PresetId =
  | "two"
  | "one"
  | "wide"
  | "narrow"
  | "ribbons"
  | "skirt"
  | "pants"
  | "body"
  | "free"
  | "tube"
  | "sleeve";
export type MaterialId = "cotton" | "silk" | "linen" | "denim";

export interface ColliderState {
  rotation?:[number,number,number];
  on: boolean;
  x: number;
  y: number;
  z: number;
  size: number;
  width?: number; height?: number; depth?: number;
}

export interface PresetDef {
  id: PresetId;
  label: string;
  rect: boolean;
  defaultPin: PinMode;
  sphere: ColliderState;
  box: ColliderState;
}

const boxOff: ColliderState = { on: false, x: 0.9, y: 0.35, z: 0.5, size: 0.7 };

export interface SleeveSettings { length: number; ease: number; angle: number; shoulderX?:number; shoulderY?:number; shoulderZ?:number; shoulderPitch?:number; shoulderYaw?:number; }
export const DEFAULT_SLEEVE: SleeveSettings = {length: 1.65, ease: 0.10, angle: 35, shoulderX:-.85,shoulderY:1.65,shoulderZ:0,shoulderPitch:0,shoulderYaw:0};
export const ARM_RADIUS = 0.13;
export const ARM_SEGMENT = 0.85;
export function armTransform(p: number[],s: SleeveSettings,inverse=false): V3 {
 const a=(s.shoulderPitch??0)*Math.PI/180,b=(s.shoulderYaw??0)*Math.PI/180;
 const sx=s.shoulderX??-.85,sy=s.shoulderY??1.65,sz=s.shoulderZ??0;
 if(inverse){const x=p[0]-sx,y=p[1]-sy,z=p[2]-sz;const u=Math.cos(b)*x-Math.sin(b)*z,w=Math.sin(b)*x+Math.cos(b)*z;return [Math.cos(a)*u+Math.sin(a)*y-.85,-Math.sin(a)*u+Math.cos(a)*y+1.65,w];}
 const x=p[0]+.85,y=p[1]-1.65,z=p[2];const u=Math.cos(a)*x-Math.sin(a)*y,v=Math.sin(a)*x+Math.cos(a)*y;
 return [sx+Math.cos(b)*u+Math.sin(b)*z,sy+v,sz-Math.sin(b)*u+Math.cos(b)*z];
}
export function armPoints(angle: number,s: SleeveSettings=DEFAULT_SLEEVE) {
 const a=angle*Math.PI/180;
 return [[-0.85,1.65,0],[0,1.65,0],[0.85*Math.cos(a),1.65+0.85*Math.sin(a),0]].map(p=>armTransform(p,s)) as [V3,V3,V3];
}
export const PRESETS: PresetDef[] = [
  {id:"body",label:"Туловище",rect:false,defaultPin:"top",sphere:{on:false,x:0,y:.5,z:0,size:.4},box:boxOff},
  {id:"sleeve",label:"Рука с рукавом",rect:false,defaultPin:"top",sphere:{on:false,x:0,y:.5,z:0,size:.4},box:boxOff},
  { id: "two", label: "Полотно", rect: true, defaultPin: "two", sphere: { on: true, x: 0, y: 0.55, z: 0.55, size: 0.45 }, box: boxOff },
  { id: "ribbons", label: "Отдельные ленты", rect: true, defaultPin: "top", sphere: { on: true, x: 0, y: 0.5, z: 0.5, size: 0.45 }, box: boxOff },
  { id:"skirt",label:"Юбка",rect:false,defaultPin:"top",sphere:{on:false,x:0,y:.5,z:.9,size:.4},box:boxOff },
  { id:"pants",label:"Брюки",rect:false,defaultPin:"top",sphere:{on:false,x:0,y:.5,z:.9,size:.4},box:boxOff },
  { id: "tube", label: "Тканевый цилиндр", rect: false, defaultPin: "none", sphere: { on: true, x: 0, y: 0.55, z: 0, size: 0.55 }, box: boxOff },
];

export const PIN_LABELS: Record<PinMode, string> = {
  two: "Два угла",
  one: "Один угол",
  top: "Верхний край",
  none: "Без креплений",
};

export interface MaterialDef {
  label: string;
  shear: number;
  bend: number;
  damping: number;
  density: number;
  friction: number;
  roughness: number;
  sheen: number;
  bump: number;
  weave: "plain" | "fine" | "slub" | "twill";
  texScale: number;
}

export const MATERIALS: Record<MaterialId, MaterialDef> = {
  cotton: { label: "Хлопок", shear: 2e-7, bend: 3e-6, damping: 0.6, density: 1, friction: 0.45, roughness: 0.85, sheen: 0.45, bump: 0.6, weave: "plain", texScale: 28 },
  silk: { label: "Шёлк", shear: 1e-6, bend: 4e-5, damping: 0.25, density: 0.45, friction: 0.12, roughness: 0.45, sheen: 1, bump: 0.12, weave: "fine", texScale: 60 },
  linen: { label: "Лён", shear: 1e-7, bend: 1.2e-6, damping: 0.8, density: 1.2, friction: 0.55, roughness: 0.95, sheen: 0.2, bump: 1, weave: "slub", texScale: 18 },
  denim: { label: "Деним", shear: 2e-8, bend: 2.5e-7, damping: 1.2, density: 2.2, friction: 0.65, roughness: 0.9, sheen: 0.15, bump: 1.3, weave: "twill", texScale: 22 },
};

export interface WaistBuild {kind:'pants'|'skirt';indices:Uint32Array;reference:Float32Array;origin:V3;}
export interface ClothBuild {
  sleeveSupport?: {count:number;radius:number};
  waist?: WaistBuild;
  upper?: {start:number;capeStart:number;hoodStart:number;sleevesStart:number;sleeveCols:number;sleeveDistances:number[];reference:Float32Array};
  skirt?: {cols:number;rows:number;length:number;width:number;style:string;folds:number};
  x: Float32Array;
  pinned: Uint8Array;
  locked: Uint8Array;
  legAngles: Float32Array; // Rest-pattern circumference, independent of mesh resolution
  legSkin: Float32Array; // side (-1/1), distance from hip; zero side means unbound
  cons: Int32Array;
  rest: Float32Array;
  ctype: Uint8Array; // 0 structural, 1 shear, 2 bend, 3 seam stretch, 4 seam bend
  map: Uint32Array; // render vertex -> particle
  uv: Float32Array;
  index: Uint32Array; // render triangles
}

export type V3 = [number, number, number];

interface GridOpts {
  cols: number;
  rows: number;
  wrap: boolean;
  at: (i: number, j: number) => V3;
  restAt?: (i: number, j: number) => V3;
  uvAt: (i: number, j: number) => [number, number];
  pin: (i: number, j: number) => boolean;
}

export class Builder {
  density=1;
  resolution(n:number,multiple=1){return Math.max(multiple*2,Math.round(n*this.density/multiple)*multiple);}
  upper?: ClothBuild["upper"];
  skirt?: ClothBuild["skirt"];
  sleeveSupport?: {count:number;radius:number};
  waist?: WaistBuild;
  seam: number[] = [];
  pos: number[] = [];
  restPos: number[] = [];
  pinned: number[] = [];
  locked: number[] = [];
  legSkin: number[] = [];
  legAngles: number[] = [];
  cons: number[] = [];
  ctype: number[] = [];
  map: number[] = [];
  uv: number[] = [];
  index: number[] = [];

  grid(o: GridOpts) {
    const base = this.pos.length / 3;
    const { cols, rows, wrap } = o;
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const p = o.at(i, j);
        const r = o.restAt ? o.restAt(i, j) : p;
        this.pos.push(...p);
        this.restPos.push(...r);
        this.pinned.push(o.pin(i, j) ? 1 : 0);
        this.locked.push(0);
        this.legSkin.push(0,0);
        this.legAngles.push(0);
        this.seam.push(0);
      }
    const idx = (i: number, j: number) => {
      if (j < 0 || j >= rows) return -1;
      if (wrap) i = ((i % cols) + cols) % cols;
      else if (i < 0 || i >= cols) return -1;
      return base + j * cols + i;
    };
    const add = (a: number, b: number, t: number) => {
      if (a < 0 || b < 0 || a === b) return;
      this.cons.push(a, b);
      this.ctype.push(t);
    };
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const a = idx(i, j);
        add(a, idx(i + 1, j), 0);
        add(a, idx(i, j + 1), 0);
        add(a, idx(i + 1, j + 1), 1);
        add(idx(i + 1, j), idx(i, j + 1), 1);
        add(a, idx(i + 2, j), 2);
        add(a, idx(i, j + 2), 2);
      }
    const rcols = wrap ? cols + 1 : cols;
    const rbase = this.map.length;
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < rcols; i++) {
        this.map.push(idx(i, j));
        this.uv.push(...o.uvAt(i, j));
      }
    for (let j = 0; j < rows - 1; j++)
      for (let i = 0; i < rcols - 1; i++) {
        const a = rbase + j * rcols + i;
        const b = a + 1;
        const c = a + rcols;
        const d = c + 1;
        this.index.push(a, c, b, b, c, d);
      }
  }

  finish(): ClothBuild {
    // Welds can leave duplicate constraints and collapsed render faces. Remove
    // them once in the worker instead of paying for them in every solver pass.
    const pairs:number[]=[],types:number[]=[],seen=new Set<string>();
    for(let k=0;k<this.cons.length/2;k++){
      const a=this.cons[k*2],c=this.cons[k*2+1];if(a===c)continue;
      let type=this.ctype[k];
      if(this.seam[a]&&this.seam[c]){if(type===0)type=3;else if(type===2)type=4;}
      const key=Math.min(a,c)+':'+Math.max(a,c)+':'+type;
      if(seen.has(key))continue;seen.add(key);pairs.push(a,c);types.push(type);
    }
    this.cons=pairs;this.ctype=types;
    const m=pairs.length/2,rest=new Float32Array(m),R=this.restPos;
    for(let k=0;k<m;k++){const a=pairs[k*2]*3,c=pairs[k*2+1]*3;rest[k]=Math.hypot(R[a]-R[c],R[a+1]-R[c+1],R[a+2]-R[c+2]);}
    const triangles:number[]=[];
    for(let k=0;k<this.index.length;k+=3){const a=this.index[k],c=this.index[k+1],d=this.index[k+2];if(this.map[a]!==this.map[c]&&this.map[a]!==this.map[d]&&this.map[c]!==this.map[d])triangles.push(a,c,d);}
    return {
      sleeveSupport:this.sleeveSupport,
      waist:this.waist,
      upper:this.upper,
      skirt:this.skirt,
      x: new Float32Array(this.pos),
      pinned: new Uint8Array(this.pinned),
      locked: new Uint8Array(this.locked),
      legSkin:new Float32Array(this.legSkin),
      legAngles:new Float32Array(this.legAngles),
      cons: new Int32Array(this.cons),
      rest,
      ctype: new Uint8Array(this.ctype),
      map: new Uint32Array(this.map),
      uv: new Float32Array(this.uv),
      index: new Uint32Array(triangles),
    };
  }
}

const TOP = 2.6;

function rectPin(pin: PinMode, cols: number) {
  return (i: number, j: number) => {
    if (j !== 0) return false;
    if (pin === "top") return true;
    if (pin === "two") return i === 0 || i === cols - 1;
    if (pin === "one") return i === 0;
    return false;
  };
}

function hangingRect(b: Builder, w: number, h: number, cols: number, rows: number, pin: PinMode, ox = 0) {
 cols=b.resolution(cols);rows=b.resolution(rows);
  const top=Math.max(TOP,h+.15);
  const pinch = pin === "two" ? 0.8 : pin === "top" ? 0.92 : 1;
  b.grid({
    cols,
    rows,
    wrap: false,
    at: (i, j) => {
      const u = i / (cols - 1);
      const v = j / (rows - 1);
      const x0 = (u - 0.5) * w;
      const z = pinch < 1 ? 0.03 * Math.sin(u * Math.PI * 9) * (0.3 + v) : 0.01 * Math.sin(u * 13 + v * 7);
      return [ox + x0 * pinch, top - v * h, z];
    },
    restAt: (i, j) => [ox + (i / (cols - 1) - 0.5) * w, top - (j / (rows - 1)) * h, 0],
    uvAt: (i, j) => [(i / (cols - 1)) * w, (1 - j / (rows - 1)) * h],
    pin: rectPin(pin, cols),
  });
}

export interface SkirtSettings { length:number; width:number; style:"pencil"|"half"|"pleated"; folds:number; }
export const DEFAULT_SKIRT:SkirtSettings={length:1.45,width:1,style:"half",folds:16};
export interface LegPose { hip:number; knee:number; spread:number; }
export interface LegsSettings { on:boolean; linked:boolean; x:number;y:number;z:number; length:number;ease:number; left:LegPose;right:LegPose; }
export const DEFAULT_LEGS:LegsSettings={on:true,linked:false,x:0,y:2.1,z:0,length:1.75,ease:.025,left:{hip:0,knee:0,spread:0},right:{hip:0,knee:0,spread:0}};
export const LEG_RADIUS=.145, LEG_SEGMENT=.85;
export function legPoints(s:LegsSettings,side:"left"|"right"): [V3,V3,V3] {
 const p=s[side], sign=side==="left"?-1:1,h=p.hip*Math.PI/180,k=(p.hip-p.knee)*Math.PI/180,r=p.spread*Math.PI/180;
 const a:V3=[s.x+sign*.20,s.y-.18,s.z];
 const v=(t:number):V3=>[sign*Math.sin(r)*LEG_SEGMENT,-Math.cos(t)*Math.cos(r)*LEG_SEGMENT,Math.sin(t)*Math.cos(r)*LEG_SEGMENT];
 const u=v(h),w=v(k),b:V3=[a[0]+u[0],a[1]+u[1],a[2]+u[2]];
 return [a,b,[b[0]+w[0],b[1]+w[1],b[2]+w[2]]];
}
function skirt(b:Builder,s:SkirtSettings,legs:LegsSettings) {
 const folds=s.style==="pleated"?s.folds:0,N=Math.max(b.resolution(72,4),folds*4),rows=Math.max(10,b.resolution(Math.ceil(s.length/.075)+1));
 b.skirt={cols:N,rows,length:s.length,width:s.width,style:s.style,folds:s.folds};
 const rTop=.26, rBot=s.style==="pencil"?.34*s.width:s.style==="half"?rTop+s.length*.55*s.width:rTop+.38*s.width;
 const point=(i:number,j:number):V3=>{const a=i/N*Math.PI*2,t=j/(rows-1),amp=folds?Math.min(.09,s.width*.7/folds)*(t*t):.014*t;
 const r=rTop+(rBot-rTop)*t+amp*Math.cos(a*(folds||12));return [legs.x+Math.cos(a)*r,legs.y+.10-t*s.length,legs.z+Math.sin(a)*(r-.080*(1-t))];};
 // Start outside the posed legs, including bent knees, while retaining the pattern's rest lengths.
 const reach=new Float32Array(rows);
 if(legs.on)for(const side of ['left','right'] as const){const pts=legPoints(legs,side);for(let seg=0;seg<2;seg++)for(let k=0;k<=24;k++){const t=k/24,a=pts[seg],c=pts[seg+1],cx=a[0]+(c[0]-a[0])*t-legs.x,cy=a[1]+(c[1]-a[1])*t,cz=a[2]+(c[2]-a[2])*t-legs.z;for(let j=1;j<rows;j++){const dy=legs.y+.10-j/(rows-1)*s.length-cy,r=LEG_RADIUS+.035;if(Math.abs(dy)<r)reach[j]=Math.max(reach[j],Math.hypot(cx,cz)+Math.sqrt(r*r-dy*dy));}}}
 b.grid({cols:N,rows,wrap:true,restAt:point,at:(i,j)=>{const p=point(i,j),dx=p[0]-legs.x,dz=p[2]-legs.z,r=Math.hypot(dx,dz);if(reach[j]>r){p[0]=legs.x+dx/r*reach[j];p[2]=legs.z+dz/r*reach[j];}return p;},uvAt:(i,j)=>[i/N*2*Math.PI*(rTop+rBot)/2,j/(rows-1)*s.length],pin:()=>false});
 for(let i=0;i<N;i++)b.seam[i]=1;
 b.waist={kind:'skirt',indices:Uint32Array.from({length:N},(_,i)=>i),reference:Float32Array.from(b.pos.slice(0,N*3).map((v,i)=>v-[legs.x,legs.y,legs.z][i%3])),origin:[legs.x,legs.y,legs.z]};
}
function pants(b:Builder,s:LegsSettings) {
 const N=b.resolution(28,4),distances=jointRows(s.length,b.resolution(Math.ceil(s.length/.075)+1),[[LEG_SEGMENT,.20]],4),rows=distances.length,r=LEG_RADIUS+s.ease;
 const distance=(j:number)=>distances[j];
 for(const side of ["left","right"] as const){
 const sign=side==="left"?-1:1,pts=legPoints(s,side);
 const straight=legPoints({...s,left:{hip:0,knee:0,spread:0},right:{hip:0,knee:0,spread:0}},side);
 const point=(i:number,j:number,points:[V3,V3,V3],knee:number):V3=>{
 const d=distance(j),t=i/N*Math.PI*2,seg=d<LEG_SEGMENT?0:1,v=(d-seg*LEG_SEGMENT)/LEG_SEGMENT,a=points[seg],c=points[seg+1];
 const blend=Math.max(0,Math.min(1,(d-.68)/.34)),smooth=blend*blend*(3-2*blend);
 const tangent=points[1].map((q,k)=>(q-points[0][k])*(1-smooth)+(points[2][k]-q)*smooth),len=Math.hypot(...tangent)||1;
 for(let k=0;k<3;k++)tangent[k]/=len;
 const radial=[1-tangent[0]*tangent[0],-tangent[0]*tangent[1],-tangent[0]*tangent[2]],rl=Math.hypot(...radial)||1;for(let k=0;k<3;k++)radial[k]/=rl;
 const binormal=[tangent[1]*radial[2]-tangent[2]*radial[1],tangent[2]*radial[0]-tangent[0]*radial[2],tangent[0]*radial[1]-tangent[1]*radial[0]];
 const kneeAllowance=.02*Math.sin(knee*Math.PI/360)*Math.exp(-(((d-LEG_SEGMENT)/.18)**2)),radius=r+kneeAllowance;
 const p=a.map((q,k)=>q+(c[k]-q)*v+radius*(radial[k]*Math.cos(t)+binormal[k]*Math.sin(t))) as V3;
 // Fade the shaped waistband into the thigh. Previously only row zero dipped at
 // the crotch, reversing the first faces; its rest lengths still described a cylinder.
 const u=Math.min(1,d/.48),waist=1-u*u*(3-2*u),inner=sign*Math.cos(t)<0;
 p[0]+=waist*(s.x+(inner?0:Math.cos(t)*(.26+s.ease*.15))-p[0]);
 p[1]+=waist*(.28-(inner?.48*Math.abs(Math.cos(t)):0));
 p[2]+=waist*(s.z+Math.sin(t)*(.18+s.ease*.1)-p[2]);
 return p;
 };
 b.grid({cols:N,rows,wrap:true,at:(i,j)=>point(i,j,pts,s[side].knee),
 restAt:(i,j)=>point(i,j,straight,0),uvAt:(i,j)=>[i/N*2*Math.PI*r,distance(j)],pin:()=>false});
 }
 for(let side=0;side<2;side++)for(let j=1;j<rows;j++)for(let i=0;i<N;i++){const v=(side*N*rows+j*N+i)*2;b.legSkin[v]=side?1:-1;b.legSkin[v+1]=distance(j);b.legAngles[v/2]=i/N*Math.PI*2;}
 // Close the crotch between the two open inner top arcs with shared vertices.
 const base=N*rows;
 const waistIndices:number[]=[];
 for(let side=0;side<2;side++)for(let i=0;i<N;i++){
   const index=side*base+i; b.seam[index]=1;
   if((side?1:-1)*Math.cos(i/N*Math.PI*2)>=-1e-8)waistIndices.push(index);
 }
 const weld=new Map<number,number>();
 for(let i=0;i<=N/2;i++){const left=(i+N*3/4)%N,right=(N*3/4-i+N)%N;
 const a=left*3,c=(base+right)*3;
 for(let k=0;k<3;k++){const v=(b.pos[a+k]+b.pos[c+k])/2;b.pos[a+k]=b.pos[c+k]=v;const rest=(b.restPos[a+k]+b.restPos[c+k])/2;b.restPos[a+k]=b.restPos[c+k]=rest;}
 weld.set(base+right,left);
 }
 // The shaped waistband (including the welded front/back seam) must start
 // outside the pelvis collider. Pinned points cannot be repaired by collision passes.
 for(const buffer of [b.pos,b.restPos])for(let i=0;i<buffer.length;i+=3){
   const y=(buffer[i+1]-(s.y-.05))/.218;if(Math.abs(y)>=1)continue;
   const x=buffer[i]-s.x,z=buffer[i+2]-s.z,q=Math.hypot(x/.358,z/.238),boundary=Math.sqrt(1-y*y);
   if(q>1e-8&&q<boundary){buffer[i]=s.x+x*boundary/q;buffer[i+2]=s.z+z*boundary/q;}
 }
 // Compact welded particles so hidden duplicate points cannot collide with the seam.
 const keep=b.pinned.map((_,i)=>i).filter(i=>!weld.has(i)),map=new Map(keep.map((v,i)=>[v,i]));
 const remap=(i:number)=>map.get(weld.get(i)??i)!;
 b.cons=b.cons.map(remap);b.map=b.map.map(remap);
 b.pos=keep.flatMap(i=>b.pos.slice(i*3,i*3+3));b.pinned=keep.map(i=>b.pinned[i]);b.locked=keep.map(i=>b.locked[i]);b.legSkin=keep.flatMap(i=>b.legSkin.slice(i*2,i*2+2));b.legAngles=keep.map(i=>b.legAngles[i]);b.seam=keep.map(i=>b.seam[i]);b.restPos=keep.flatMap(i=>b.restPos.slice(i*3,i*3+3));
 const indices=Uint32Array.from(new Set(waistIndices.map(remap)));
 b.waist={kind:'pants',indices,reference:Float32Array.from(Array.from(indices).flatMap(i=>[b.pos[i*3]-s.x,b.pos[i*3+1]-s.y,b.pos[i*3+2]-s.z])),origin:[s.x,s.y,s.z]};
}

export interface SheetSettings { width:number; length:number; }
export const DEFAULT_SHEET:SheetSettings={width:2,length:2};
export function buildPreset(id: PresetId, pin: PinMode, sleeve: SleeveSettings = DEFAULT_SLEEVE, skirtSettings:SkirtSettings=DEFAULT_SKIRT, legs:LegsSettings=DEFAULT_LEGS, body:BodySettings=DEFAULT_BODY,quality=1,sheet:SheetSettings=DEFAULT_SHEET): ClothBuild {
  const b = new Builder();b.density=Math.max(.6,Math.min(1,quality));
  switch (id) {
    case "body": break;
    case "sleeve": {
      const N=b.resolution(36,4), rows=b.resolution(Math.ceil(sleeve.length/.045)+1), radius=ARM_RADIUS+sleeve.ease;
      const shoulderRadius=ARM_RADIUS+.025;
      const radiusAt=(j:number)=>{const t=Math.min(1,j/(rows-1)*sleeve.length/.35);return shoulderRadius+(radius-shoulderRadius)*t*t*(3-2*t);};
      b.sleeveSupport={count:N,radius:shoulderRadius};
      b.grid({cols:N,rows,wrap:true,
        at:(i,j)=>{
          const radius=radiusAt(j),d=j/(rows-1)*sleeve.length, a=sleeve.angle*Math.PI/180;
          const blend=Math.max(0,Math.min(1,(d-.65)/.4));
          const turn=a*blend*blend*(3-2*blend), phi=i/N*Math.PI*2;
          const cx=d<=.85?-.85+d:(d-.85)*Math.cos(a);
          const cy=d<=.85?1.65:1.65+(d-.85)*Math.sin(a);
          return armTransform([cx-Math.sin(turn)*radius*Math.cos(phi),cy+Math.cos(turn)*radius*Math.cos(phi),radius*Math.sin(phi)],sleeve);
        },
        restAt:(i,j)=>[-.85+j/(rows-1)*sleeve.length,1.65+radiusAt(j)*Math.cos(i/N*Math.PI*2),radiusAt(j)*Math.sin(i/N*Math.PI*2)],
        uvAt:(i,j)=>[i/N*2*Math.PI*radius,j/(rows-1)*sleeve.length],pin:(_i,j)=>j===0});
      break;
    }
    case "two":
    case "one":
      {const width=Math.max(.3,Math.min(4,Number.isFinite(sheet.width)?sheet.width:2)),length=Math.max(.3,Math.min(4,Number.isFinite(sheet.length)?sheet.length:2));
      const cols=Math.ceil(width/.05)+1,rows=Math.ceil(length/.05)+1,scale=Math.min(1,Math.sqrt(2400/(cols*rows)));
      hangingRect(b,width,length,Math.max(4,Math.floor(cols*scale)),Math.max(4,Math.floor(rows*scale)),pin);}

      break;
    case "wide":
      hangingRect(b, 3.2, 2, 60, 38, pin);
      break;
    case "narrow":
      hangingRect(b, 0.9, 2.3, 18, 46, pin);
      break;
    case "ribbons": {
      const count = 5;
      const w = 0.22;
      const gap = 0.2;
      const total = count * w + (count - 1) * gap;
      for (let k = 0; k < count; k++) {
        const ox = -total / 2 + w / 2 + k * (w + gap);
        hangingRect(b, w, 2.2 - (k % 2) * 0.3, 6, 44 - (k % 2) * 6, pin, ox);
      }
      break;
    }
    case "skirt": skirt(b,skirtSettings,legs); break;
    case "pants": pants(b,legs); break;
    case "free": {
      const cols = b.resolution(36);
      const rows = b.resolution(36);
      const s = 2.2;
      b.grid({
        cols,
        rows,
        wrap: false,
        at: (i, j) => {
          const u = i / (cols - 1) - 0.5;
          const v = j / (rows - 1) - 0.5;
          return [u * s, 2.2 + u * 0.15 + v * 0.08, v * s];
        },
        restAt: (i, j) => [(i / (cols - 1) - 0.5) * s, 2.2, (j / (rows - 1) - 0.5) * s],
        uvAt: (i, j) => [(i / (cols - 1)) * s, (j / (rows - 1)) * s],
        pin: rectPin(pin, cols),
      });
      break;
    }
    case "tube": {
      const N = b.resolution(28,4);
      const rows = b.resolution(21);
      const r = 0.42;
      const len = 1.6;
      b.grid({
        cols: N,
        rows,
        wrap: true,
        at: (i, j) => {
          const a = (i / N) * Math.PI * 2;
          const t = j / (rows - 1);
          return [(t - 0.5) * len, 2.0 + Math.cos(a) * r, Math.sin(a) * r];
        },
        uvAt: (i, j) => [(i / N) * Math.PI * 2 * r, (j / (rows - 1)) * len],
        pin: () => false,
      });
      break;
    }
  }
  if(id==="body"||id==="skirt"||id==="pants")addUpperGarments(b,body,legs);
  return b.finish();
}


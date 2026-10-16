import {BoxContacts} from './boxContact';
import {armTransform,type SleeveSettings} from './presets';
import {WaistSupport} from './waist';
import {SurfaceContacts} from './surfaceContacts';
import {GarmentContacts} from './layers';
import {capsuleEntry} from './contact';
import type { ClothBuild } from "./presets";

export interface SimParams {
  shoulder?:SleeveSettings;
  gravity: number;
  windX: number;
  windY?: number;
  selfCollision?: boolean;
  capsules?: {a:number[]; b:number[]; r:number}[];
  ellipsoids?:{x:number;y:number;z:number;rx:number;ry:number;rz:number;basis?:number[];enabled?:boolean}[];
  windZ: number;
  windStrength: number;
  stretch: number;
  shear: number;
  bend: number;
  damping: number;
  density: number;
  friction: number;
  sphere: { on: boolean; x: number; y: number; z: number; r: number };
  boxes?: SimParams['box'][];
  box: { on: boolean; x: number; y: number; z: number; s: number; width?:number;height?:number;depth?:number;basis?:number[] };
}

/** XPBD particle/constraint cloth solver with substeps. */
export class ClothSim {
  waist:WaistSupport|null=null;
  sleeveSupport?:ClothBuild["sleeveSupport"];
  readonly boxContacts=new BoxContacts();
  n: number;
  m: number;
  x: Float32Array;
  p: Float32Array;
  w: Float32Array;
  baseW: Float32Array;
  acc: Float32Array;
  nrm: Float32Array;
  cons: Int32Array;
  rest: Float32Array;
  ctype: Uint8Array;
  tris: Uint32Array;
  substeps = 8;
  iterations = 2;
  thickness = 0.014;
  time = 0;
  lastH = 1 / 600;
  grab = -1;
  g = [0, 0, 0];
  params: SimParams;
  neighbours: Set<number>[];
  hashHeads = new Int32Array(16384);
  hashNext: Int32Array;
  cells: Int32Array;
  selfDistance: number;
  selfSpacing: Float32Array;
  locked: Uint8Array;
  legGuides:Float32Array|null=null;
  upperGuides:Float32Array|null=null;
  upperSectors:Float32Array|null=null;
  legSectors:Float32Array|null=null;
  private strainEnd=0;
  private stretchEdges:Int32Array;
  capeStart=-1;capeEnd=-1;capeArmClearance=0;
  normalsDirty=true;
  readonly surfaceContacts=new SurfaceContacts();
  garmentContacts:GarmentContacts|null=null;
  private previousCapsules: NonNullable<SimParams['capsules']>=[];
  private movingCapsules: NonNullable<SimParams['capsules']>=[];
  private contactStart: Float32Array;
  syncColliderHistory(){
    this.previousCapsules=(this.params.capsules??[]).map(c=>({a:[...c.a],b:[...c.b],r:c.r}));
    this.movingCapsules=this.previousCapsules.map(c=>({a:[...c.a],b:[...c.b],r:c.r}));
  }

  constructor(b: ClothBuild, params: SimParams) {
    this.n = b.x.length / 3;
    this.sleeveSupport=b.sleeveSupport;
    if(b.waist)this.waist=new WaistSupport(b.waist);
    this.strainEnd=(b.upper?.capeStart??-1)>=0?b.upper!.capeStart:(b.upper?.sleevesStart??-1)>=0?b.upper!.sleevesStart:this.n;
    if(b.upper&&b.upper.capeStart>b.upper.start)this.garmentContacts=new GarmentContacts(b);
    this.capeStart=b.upper?.capeStart??-1;this.capeEnd=b.upper?.hoodStart??-1;this.capeArmClearance=(b.upper?.sleevesStart??-1)>=0?.045:0;
    this.locked=b.locked?.slice()??new Uint8Array(this.n);
    this.m = b.rest.length;
    this.x = b.x.slice();
    this.p = b.x.slice();
    this.contactStart=b.x.slice();
    this.w = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) this.w[i] = b.pinned[i] ? 0 : 1;
    this.baseW = this.w.slice();
    this.acc = new Float32Array(this.n * 3);
    this.nrm = new Float32Array(this.n * 3);
    this.cons = b.cons;
    this.rest = b.rest;
    this.ctype = b.ctype;
    this.stretchEdges=Int32Array.from(Array.from(b.ctype).flatMap((type,k)=>type===0||type===3?[k]:[]));
    this.tris = new Uint32Array(b.index.length);
    for (let k = 0; k < b.index.length; k++) this.tris[k] = b.map[b.index[k]];
    this.params = params;
    this.syncColliderHistory();
    this.neighbours=Array.from({length:this.n},()=>new Set<number>());
    let spacing=0,count=0;
    // Local edge spacing prevents dense hood folds from fighting a garment-wide gap.
    this.selfSpacing=new Float32Array(this.n).fill(.062);
    for(let k=0;k<this.m;k++) {const a=this.cons[2*k],c=this.cons[2*k+1];this.neighbours[a].add(c);this.neighbours[c].add(a);if(this.ctype[k]===0||this.ctype[k]===3){spacing+=this.rest[k];count++;if(this.rest[k]>1e-6){const gap=this.rest[k]*.8;this.selfSpacing[a]=Math.min(this.selfSpacing[a],gap);this.selfSpacing[c]=Math.min(this.selfSpacing[c],gap);}}}
    this.selfDistance=Math.min(this.thickness*2,spacing/Math.max(1,count)*.8);
    this.hashNext=new Int32Array(this.n);this.cells=new Int32Array(this.n*3);
    this.computeNormals();
  }

  step(dt: number) {
    const h = dt / this.substeps;
    if(this.sleeveSupport&&this.params.shoulder){
      const {count,radius}=this.sleeveSupport,P=this.params;
      const shift=Math.min(.025,Math.max(0,P.windStrength-8)*.002);
      for(let i=0;i<count;i++){if(this.w[i])continue;const a=i/count*Math.PI*2,q=armTransform([-.85,1.65+radius*Math.cos(a),radius*Math.sin(a)],P.shoulder!);const o=i*3;
        this.x[o]=this.p[o]=q[0]+shift*P.windX;this.x[o+1]=this.p[o+1]=q[1]+shift*(P.windY??0);this.x[o+2]=this.p[o+2]=q[2]+shift*P.windZ;
      }
    }
    // Preserve velocity when adaptive frame pacing changes the Verlet time step.
    if(Math.abs(h-this.lastH)>1e-10){const ratio=h/this.lastH;for(let i=0;i<this.x.length;i++)this.p[i]=this.x[i]-(this.x[i]-this.p[i])*ratio;this.lastH=h;}
    this.computeNormals();
    this.computeForces();
    const target=this.params.capsules??[];
    if(target.length!==this.previousCapsules.length)this.syncColliderHistory();
    for (let s = 0; s < this.substeps; s++) {
      const blend=(s+1)/this.substeps;
      for(let c=0;c<target.length;c++){const from=this.previousCapsules[c],to=target[c],active=this.movingCapsules[c];for(let k=0;k<3;k++){active.a[k]=from.a[k]+(to.a[k]-from.a[k])*blend;active.b[k]=from.b[k]+(to.b[k]-from.b[k])*blend;}active.r=to.r;}
      this.params.capsules=this.movingCapsules;
      this.contactStart.set(this.x);
      this.integrate(h);
      for (let it = 0; it < this.iterations; it++) this.solve(h);
      if(this.params.selfCollision !== false && (s % 3 === 2 || s === this.substeps-1)) this.selfCollide();
      for(const guides of [this.legGuides,this.upperGuides])if(guides)for(let i=0;i<this.n;i++){const g=i*4,r=guides[g+3];if(!r||!this.w[i])continue;const o=i*3,dx=this.x[o]-guides[g],dy=this.x[o+1]-guides[g+1],dz=this.x[o+2]-guides[g+2],d2=dx*dx+dy*dy+dz*dz;if(d2>r*r){const scale=1-r/Math.sqrt(d2);this.x[o]-=dx*scale;this.x[o+1]-=dy*scale;this.x[o+2]-=dz*scale;this.p[o]-=dx*scale;this.p[o+1]-=dy*scale;this.p[o+2]-=dz*scale;}}
      this.waist?.solve(this,h);
      this.solveSectors();
      this.collide();
      if(this.garmentContacts&&(s===3||s===this.substeps-1)){this.garmentContacts.solve(this);this.collide();}
      if(s===this.substeps-1&&((this.params.capsules?.length??0)||(this.params.ellipsoids?.length??0))){for(let pass=0;pass<3;pass++){this.surfaceContacts.solve(this);this.limitContactStretch();this.waist?.solve(this,h);this.collide();if(this.surfaceContacts.maxPenetration<.004)break;}}
      if(s===3||s===this.substeps-1){const boxes=this.params.boxes;for(let k=0;k<(boxes?.length??1);k++){const box=boxes?boxes[k]:this.params.box;if(!box.on)continue;for(let pass=0;pass<3;pass++){const depth=this.boxContacts.solve(this,box);this.collide();if(depth<.002)break;}}}
      // Constraint/contact corrections must not become an unbounded Verlet impulse.
      const limit=25*h;
      for(let i=0;i<this.n;i++){if(!this.w[i])continue;const o=i*3,dx=this.x[o]-this.p[o],dy=this.x[o+1]-this.p[o+1],dz=this.x[o+2]-this.p[o+2],d2=dx*dx+dy*dy+dz*dz;if(d2>limit*limit){const scale=limit/Math.sqrt(d2);this.p[o]=this.x[o]-dx*scale;this.p[o+1]=this.x[o+1]-dy*scale;this.p[o+2]=this.x[o+2]-dz*scale;}}
    }
    this.params.capsules=target;
    for(let c=0;c<target.length;c++){for(let k=0;k<3;k++){this.previousCapsules[c].a[k]=target[c].a[k];this.previousCapsules[c].b[k]=target[c].b[k];}this.previousCapsules[c].r=target[c].r;}
    this.lastH = h;
    this.time += dt;this.normalsDirty=true;
  }

  /** Contact projection must not stretch a small face into a long spike. */
  private limitContactStretch() {
    for(let edge=0;edge<this.stretchEdges.length;edge++){
      const k=this.stretchEdges[edge];if(this.rest[k]<1e-5)continue;
      const a=this.cons[k*2],b=this.cons[k*2+1];if(a>=this.strainEnd||b>=this.strainEnd)continue;const wa=this.w[a],wb=this.w[b],sum=wa+wb;if(!sum)continue;
      const o=a*3,q=b*3,dx=this.x[q]-this.x[o],dy=this.x[q+1]-this.x[o+1],dz=this.x[q+2]-this.x[o+2];
      const d2=dx*dx+dy*dy+dz*dz,max=this.rest[k]*1.5;if(d2<=max*max)continue;
      const scale=(1-max/Math.sqrt(d2))/sum;
      for(let axis=0;axis<3;axis++){
        const delta=(axis===0?dx:axis===1?dy:dz)*scale;
        this.x[o+axis]+=delta*wa;this.p[o+axis]+=delta*wa;
        this.x[q+axis]-=delta*wb;this.p[q+axis]-=delta*wb;
      }
    }
  }

  /** Keep sleeve particles on their original side of a limb, with ample sliding freedom.
   * A radial collision alone cannot stop neighbouring rows swapping around an elbow. */
  private solveSectors() {
    for(const g of [this.upperSectors,this.legSectors]){if(!g)continue;
    for(let i=0;i<this.n;i++){
      const k=i*7;if(!g[k+6]||!this.w[i])continue;
      const o=i*3,nx=g[k+3],ny=g[k+4],nz=g[k+5];
      const depth=g[k+6]-((this.x[o]-g[k])*nx+(this.x[o+1]-g[k+1])*ny+(this.x[o+2]-g[k+2])*nz);
      if(depth<=0)continue;
      const correction=Math.min(.035,depth);
      this.x[o]+=nx*correction;this.x[o+1]+=ny*correction;this.x[o+2]+=nz*correction;
      this.p[o]+=nx*correction;this.p[o+1]+=ny*correction;this.p[o+2]+=nz*correction;
    }
    }
  }

  computeNormals(force=false) {
    if(!force&&!this.normalsDirty)return;this.normalsDirty=false;
    const { x, nrm, tris } = this;
    nrm.fill(0);
    for (let k = 0; k < tris.length; k += 3) {
      const a = tris[k] * 3, b = tris[k + 1] * 3, c = tris[k + 2] * 3;
      const ux = x[b] - x[a], uy = x[b + 1] - x[a + 1], uz = x[b + 2] - x[a + 2];
      const vx = x[c] - x[a], vy = x[c + 1] - x[a + 1], vz = x[c + 2] - x[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      nrm[a] += nx; nrm[a + 1] += ny; nrm[a + 2] += nz;
      nrm[b] += nx; nrm[b + 1] += ny; nrm[b + 2] += nz;
      nrm[c] += nx; nrm[c + 1] += ny; nrm[c + 2] += nz;
    }
    for (let i = 0; i < nrm.length; i += 3) {
      const l = Math.hypot(nrm[i], nrm[i + 1], nrm[i + 2]) || 1;
      nrm[i] /= l; nrm[i + 1] /= l; nrm[i + 2] /= l;
    }
  }

  computeForces() {
    const P = this.params;
    const { x, p, nrm, acc, time: t } = this;
    const dl = Math.hypot(P.windX, P.windY ?? 0, P.windZ) || 1;
    const dx = P.windX / dl, dy=(P.windY ?? 0)/dl, dz = P.windZ / dl;
    const gust = P.windStrength>0?0.75 + 0.25 * Math.sin(t * 1.1) + 0.15 * Math.sin(t * 2.7 + 1.3):0;
    const k = 1.4 / P.density;
    const inv = 1 / this.lastH;
    for (let i = 0; i < this.n; i++) {
      const o = i * 3;
      const local = P.windStrength>0?1 + 0.3 * Math.sin(t * 1.7 + x[o] * 1.3 + x[o + 1] * 0.9 + x[o + 2]):1;
      const W = P.windStrength * gust * local;
      const rx = dx * W - (x[o] - p[o]) * inv;
      const ry = dy * W - (x[o + 1] - p[o + 1]) * inv;
      const rz = dz * W - (x[o + 2] - p[o + 2]) * inv;
      const d = rx * nrm[o] + ry * nrm[o + 1] + rz * nrm[o + 2];
      const pressure = d * Math.abs(d) * k;
      const clamp=(v:number)=>Math.max(-90,Math.min(90,v));
      acc[o] = clamp(nrm[o] * pressure + rx * .25);
      acc[o + 1] = clamp(nrm[o + 1] * pressure + ry * .25) - P.gravity;
      acc[o + 2] = clamp(nrm[o + 2] * pressure + rz * .25);
    }
  }

  integrate(h: number) {
    const { x, p, w, acc } = this;
    const damp = Math.exp(-this.params.damping * h);
    const h2 = h * h;
    const maxStep = 25 * h;
    for (let i = 0; i < this.n; i++) {
      if (w[i] === 0) continue;
      const o = i * 3;
      let vx = (x[o] - p[o]) * damp, vy = (x[o + 1] - p[o + 1]) * damp, vz = (x[o + 2] - p[o + 2]) * damp;
      if(x[o+1]<this.thickness+.10&&this.params.friction>0){const contactDamping=Math.exp(-45*this.params.friction*h);vx*=contactDamping;vy*=contactDamping;vz*=contactDamping;}
      const l = Math.hypot(vx, vy, vz);
      if (l > maxStep) { const s = maxStep / l; vx *= s; vy *= s; vz *= s; }
      p[o] = x[o]; p[o + 1] = x[o + 1]; p[o + 2] = x[o + 2];
      x[o] += vx + acc[o] * h2;
      x[o + 1] += vy + acc[o + 1] * h2;
      x[o + 2] += vz + acc[o + 2] * h2;
    }
    if (this.grab >= 0) {
      const o = this.grab * 3;
      p[o] = x[o]; p[o + 1] = x[o + 1]; p[o + 2] = x[o + 2];
      x[o] += (this.g[0] - x[o]) * 0.5;
      x[o + 1] += (this.g[1] - x[o + 1]) * 0.5;
      x[o + 2] += (this.g[2] - x[o + 2]) * 0.5;
    }
  }

  solve(h: number) {
    const { x, w, cons, rest, ctype } = this;
    const P = this.params;
    const ih2 = 1 / (h * h);
    const stretch=P.stretch*ih2,shear=P.shear*ih2,bend=P.bend*ih2,seamStretch=Math.min(stretch*.15,2e-8*ih2),seamBend=bend*.35;
    for (let k = 0; k < this.m; k++) {
      const a = cons[2 * k], b = cons[2 * k + 1];
      const wa = w[a], wb = w[b];
      const ws = wa + wb;
      if (ws === 0) continue;
      const ao = a * 3, bo = b * 3;
      const dx = x[ao] - x[bo], dy = x[ao + 1] - x[bo + 1], dz = x[ao + 2] - x[bo + 2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len < 1e-9) continue;
      const s = -(len - rest[k]) / ((ws + (ctype[k]===0?stretch:ctype[k]===1?shear:ctype[k]===3?seamStretch:ctype[k]===4?seamBend:bend)) * len);
      x[ao] += wa * s * dx; x[ao + 1] += wa * s * dy; x[ao + 2] += wa * s * dz;
      x[bo] -= wb * s * dx; x[bo + 1] -= wb * s * dy; x[bo + 2] -= wb * s * dz;
    }
  }

  selfCollide() {
    const {x,p,w,n,hashHeads:heads,hashNext:next,cells,selfDistance:d}=this;
    const hash=(a:number,b:number,c:number)=>((a*73856093)^(b*19349663)^(c*83492791))&16383;
    heads.fill(-1);
    for(let i=0;i<n;i++) {const o=i*3,a=Math.floor(x[o]/d),b=Math.floor(x[o+1]/d),c=Math.floor(x[o+2]/d);cells[o]=a;cells[o+1]=b;cells[o+2]=c;const h=hash(a,b,c);next[i]=heads[h];heads[h]=i;}
    for(let i=0;i<n;i++) {
      const o=i*3, cx=cells[o],cy=cells[o+1],cz=cells[o+2];
      // One half of the cell neighbourhood visits every unordered pair once.
      for(let a=cx;a<=cx+1;a++) for(let b=a===cx?cy:cy-1;b<=cy+1;b++) for(let c=a===cx&&b===cy?cz:cz-1;c<=cz+1;c++) {
        for(let j=heads[hash(a,b,c)];j>=0;j=next[j]) {
          if(a===cx&&b===cy&&c===cz&&j<=i)continue;
          const q=j*3;if(cells[q]!==a||cells[q+1]!==b||cells[q+2]!==c)continue;
          const ws=w[i]+w[j];if(!ws)continue;
          let dx=x[o]-x[q],dy=x[o+1]-x[q+1],dz=x[o+2]-x[q+2];
          const separation=Math.min(d,this.selfSpacing[i],this.selfSpacing[j]);
          const l2=dx*dx+dy*dy+dz*dz;if(l2>=separation*separation || this.neighbours[i].has(j))continue;
          let l=Math.sqrt(l2);
          if(l<1e-8){dx=this.nrm[o]||1;dy=this.nrm[o+1];dz=this.nrm[o+2];l=Math.hypot(dx,dy,dz);dx/=l;dy/=l;dz/=l;l=0;}
          else{dx/=l;dy/=l;dz/=l;}

          const ca=(separation-l)*w[i]/ws,cb=(separation-l)*w[j]/ws;
          x[o]+=dx*ca;x[o+1]+=dy*ca;x[o+2]+=dz*ca;
          x[q]-=dx*cb;x[q+1]-=dy*cb;x[q+2]-=dz*cb;
          // Shift history with positional correction to avoid injecting bounce energy.
          p[o]+=dx*ca;p[o+1]+=dy*ca;p[o+2]+=dz*ca;
          p[q]-=dx*cb;p[q+1]-=dy*cb;p[q+2]-=dz*cb;
        }
      }
    }
  }

  collide() {
    const { x, p, w } = this;
    const P = this.params;
    const th = this.thickness;
    const keep = 1 - P.friction;
    const S = P.sphere, B = P.box;
    const R = S.r + th;

    for (let i = 0; i < this.n; i++) {
      if (w[i] === 0) continue;
      const o = i * 3;
      const th=i>=this.capeStart&&i<this.capeEnd?.035:this.thickness;
      if (x[o + 1] < th+.001) {
        const penetration=Math.max(0,th-x[o+1]);x[o+1]=th;
        const dx=x[o]-this.contactStart[o],dz=x[o+2]-this.contactStart[o+2],distance=Math.hypot(dx,dz);
        const frictionDistance=P.friction*(penetration+P.gravity*this.lastH*this.lastH)*2;
        // Small tangential constraint corrections stick; real pulls exceed this slip threshold.
        const staticDistance=P.friction*.012;
        const amount=distance<=staticDistance?1:distance>0?Math.min(1,frictionDistance/distance):0;
        x[o]-=dx*amount;x[o+2]-=dz*amount;
        p[o]=x[o]-(x[o]-this.contactStart[o])*keep;p[o+2]=x[o+2]-(x[o+2]-this.contactStart[o+2])*keep;p[o+1]=th;
      }
      if (S.on) {
        let dx = x[o] - S.x, dy = x[o + 1] - S.y, dz = x[o + 2] - S.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < R * R) {
          let d = Math.sqrt(d2);
          if (d < 1e-6) { dx = 0; dy = 1; dz = 0; d = 1; }
          const nx = dx / d, ny = dy / d, nz = dz / d;
          x[o] = S.x + nx * R; x[o + 1] = S.y + ny * R; x[o + 2] = S.z + nz * R;
          this.friction(o, nx, ny, nz, keep);
        }
      }
      for(const C of P.capsules ?? []) {
        const clearance=i>=this.capeStart&&i<this.capeEnd?this.capeArmClearance:0;
        const bound=C.r+th+clearance,oldX=x[o],oldY=x[o+1],oldZ=x[o+2];
        const sx=this.contactStart[o],sy=this.contactStart[o+1],sz=this.contactStart[o+2];
        if(Math.max(sx,x[o])<Math.min(C.a[0],C.b[0])-bound||Math.min(sx,x[o])>Math.max(C.a[0],C.b[0])+bound||Math.max(sy,x[o+1])<Math.min(C.a[1],C.b[1])-bound||Math.min(sy,x[o+1])>Math.max(C.a[1],C.b[1])+bound||Math.max(sz,x[o+2])<Math.min(C.a[2],C.b[2])-bound||Math.min(sz,x[o+2])>Math.max(C.a[2],C.b[2])+bound)continue;
        const hit=capsuleEntry(sx,sy,sz,x[o],x[o+1],x[o+2],C.a,C.b,bound);
        if(hit<1){const t=Math.max(0,hit-1e-5);x[o]=sx+(x[o]-sx)*t;x[o+1]=sy+(x[o+1]-sy)*t;x[o+2]=sz+(x[o+2]-sz)*t;}
        const ax=C.a[0],ay=C.a[1],az=C.a[2],vx=C.b[0]-ax,vy=C.b[1]-ay,vz=C.b[2]-az;
        const t=Math.max(0,Math.min(1,((x[o]-ax)*vx+(x[o+1]-ay)*vy+(x[o+2]-az)*vz)/Math.max(1e-16,vx*vx+vy*vy+vz*vz)));
        const qx=ax+t*vx,qy=ay+t*vy,qz=az+t*vz;
        let dx=x[o]-qx,dy=x[o+1]-qy,dz=x[o+2]-qz,l=Math.hypot(dx,dy,dz);const r=C.r+th+clearance;
        if(l<r||hit<1){if(l<1e-8){dx=0;dy=0;dz=1;l=1;}dx/=l;dy/=l;dz/=l;x[o]=qx+dx*r;x[o+1]=qy+dy*r;x[o+2]=qz+dz*r;p[o]+=x[o]-oldX;p[o+1]+=x[o+1]-oldY;p[o+2]+=x[o+2]-oldZ;this.friction(o,dx,dy,dz,keep);}
      }
      for(const E of P.ellipsoids??[]){
        if(E.enabled===false)continue;
        const basis=E.basis,wx=x[o]-E.x,wy=x[o+1]-E.y,wz=x[o+2]-E.z;
        const lx=basis?wx*basis[0]+wy*basis[1]+wz*basis[2]:wx,ly=basis?wx*basis[3]+wy*basis[4]+wz*basis[5]:wy,lz=basis?wx*basis[6]+wy*basis[7]+wz*basis[8]:wz;
        const rx=E.rx+th,ry=E.ry+th,rz=E.rz+th;if(Math.abs(lx)>rx||Math.abs(ly)>ry||Math.abs(lz)>rz)continue;
        const q=(lx/rx)**2+(ly/ry)**2+(lz/rz)**2;
        if(q<1){const inv=q>1e-12?1/Math.sqrt(q):0,cx=lx*inv-lx,cy=ly*inv-ly,cz=q>1e-12?lz*inv-lz:rz;
         const dx=basis?cx*basis[0]+cy*basis[3]+cz*basis[6]:cx,dy=basis?cx*basis[1]+cy*basis[4]+cz*basis[7]:cy,dz=basis?cx*basis[2]+cy*basis[5]+cz*basis[8]:cz;
         x[o]+=dx;x[o+1]+=dy;x[o+2]+=dz;p[o]+=dx;p[o+1]+=dy;p[o+2]+=dz;
         const nl=Math.hypot(dx,dy,dz)||1;this.friction(o,dx/nl,dy/nl,dz/nl,keep);
        }
      }
      for(let k=0;k<(P.boxes?.length??1);k++){
        const B=P.boxes?P.boxes[k]:P.box;if(!B.on)continue;
        const hx=(B.width??B.s)/2+th,hy=(B.height??B.s)/2+th,hz=(B.depth??B.s)/2+th;
        const basis=B.basis,wx=x[o]-B.x,wy=x[o+1]-B.y,wz=x[o+2]-B.z;
        const lx=basis?wx*basis[0]+wy*basis[1]+wz*basis[2]:wx,ly=basis?wx*basis[3]+wy*basis[4]+wz*basis[5]:wy,lz=basis?wx*basis[6]+wy*basis[7]+wz*basis[8]:wz;
        const px = hx - Math.abs(lx), py = hy - Math.abs(ly), pz = hz - Math.abs(lz);
        if (px > 0 && py > 0 && pz > 0) {
          let nx=0,ny=0,nz=0,depth=0;
          if(px<py&&px<pz){nx=Math.sign(lx||1);depth=px;}else if(py<pz){ny=Math.sign(ly||1);depth=py;}else{nz=Math.sign(lz||1);depth=pz;}
          const dx=basis?nx*basis[0]+ny*basis[3]+nz*basis[6]:nx,dy=basis?nx*basis[1]+ny*basis[4]+nz*basis[7]:ny,dz=basis?nx*basis[2]+ny*basis[5]+nz*basis[8]:nz;
          x[o]+=dx*depth;x[o+1]+=dy*depth;x[o+2]+=dz*depth;p[o]+=dx*depth;p[o+1]+=dy*depth;p[o+2]+=dz*depth;this.friction(o,dx,dy,dz,keep);
        }
      }
    }
  }

  private friction(o: number, nx: number, ny: number, nz: number, keep: number) {
    const { x, p } = this;
    const vx = x[o] - p[o], vy = x[o + 1] - p[o + 1], vz = x[o + 2] - p[o + 2];
    const vn = vx * nx + vy * ny + vz * nz;
    const tx = vx - vn * nx, ty = vy - vn * ny, tz = vz - vn * nz;
    const vnp = Math.max(vn, 0);
    p[o] = x[o] - (tx * keep + vnp * nx);
    p[o + 1] = x[o + 1] - (ty * keep + vnp * ny);
    p[o + 2] = x[o + 2] - (tz * keep + vnp * nz);
  }

  startGrab(i: number, gx: number, gy: number, gz: number) {
    this.endGrab();
    if(this.locked[i])return;
    this.grab = i;
    this.g = [gx, gy, gz];
    this.w[i] = 0;
  }
  moveGrab(gx: number, gy: number, gz: number) {
    this.g = [gx, Math.max(gy, this.thickness), gz];
  }
  endGrab() {
    if (this.grab >= 0) this.w[this.grab] = this.baseW[this.grab];
    this.grab = -1;
  }
  releasePins() {
    if(this.waist)this.waist.enabled=false;
    for (let i = 0; i < this.n; i++) {this.baseW[i]=this.locked[i]?0:1;if(i!==this.grab)this.w[i]=this.baseW[i];}
  }
  hasNaN() {
    for (let i = 0; i < this.x.length; i++) if (!Number.isFinite(this.x[i])) return true;
    return false;
  }
}


import type {ClothBuild} from './presets';
import type {ClothSim} from './solver';
/** Local vertex/face contacts between garments. Fixed hash storage is reused every pass. */
export class GarmentContacts {
 readonly layer:Uint8Array;readonly triangles:Uint32Array;
 private heads=new Int32Array(8192);private next:Int32Array;private cells:Int32Array;
 private edges:number[][];
 private start:number;private end:number;
 constructor(b:ClothBuild,private objectLayers?:Uint8Array){
  const n=b.pinned.length,m=b.upper;this.layer=new Uint8Array(n);this.edges=Array.from({length:n},()=>[]);this.next=new Int32Array(n);this.cells=new Int32Array(n*3);this.start=m?.start??n;this.end=n;
  if(m)for(let i=m.start;i<n;i++)this.layer[i]=m.sleevesStart>=0&&i>=m.sleevesStart?2:m.capeStart>=0&&i>=m.capeStart?3:1;
  if(objectLayers){this.layer.set(objectLayers);this.start=0;}
  const tris:number[]=[];for(let t=0;t<b.index.length;t+=3){const a=b.map[b.index[t]],c=b.map[b.index[t+1]],d=b.map[b.index[t+2]];if((objectLayers||!(m&&m.hoodStart>=0&&a>=m.hoodStart&&this.layer[a]===3))&&this.layer[a]&&this.layer[a]===this.layer[c]&&this.layer[a]===this.layer[d])tris.push(a,c,d);}
  this.triangles=new Uint32Array(tris);
  for(let t=0;t<tris.length;t+=3)for(let j=0;j<3;j++){const a=tris[t+j],c=tris[t+(j+1)%3];if(!this.edges[a].includes(c))this.edges[a].push(c);if(!this.edges[c].includes(a))this.edges[c].push(a);}

 }
 solve(sim:Pick<ClothSim,'x'|'p'|'w'|'params'|'upperGuides'>){
  const {x,p,w}=sim,cell=.14,pad=.07,gap=.022,hash=(a:number,b:number,c:number)=>((a*73856093)^(b*19349663)^(c*83492791))&8191;
  this.heads.fill(-1);
  for(let i=this.start;i<this.end;i++){const o=i*3,a=Math.floor(x[o]/cell),b=Math.floor(x[o+1]/cell),c=Math.floor(x[o+2]/cell);this.cells[o]=a;this.cells[o+1]=b;this.cells[o+2]=c;const h=hash(a,b,c);this.next[i]=this.heads[h];this.heads[h]=i;}
  const chest=sim.params.ellipsoids?.[2];
  for(let t=0;t<this.triangles.length;t+=3){
   const ia=this.triangles[t],ib=this.triangles[t+1],ic=this.triangles[t+2],a=ia*3,b=ib*3,c=ic*3,layer=this.layer[ia];
   const ux=x[b]-x[a],uy=x[b+1]-x[a+1],uz=x[b+2]-x[a+2],vx=x[c]-x[a],vy=x[c+1]-x[a+1],vz=x[c+2]-x[a+2];
   let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const nl=Math.hypot(nx,ny,nz);if(nl<1e-8)continue;nx/=nl;ny/=nl;nz/=nl;
   const cx=(x[a]+x[b]+x[c])/3,cy=(x[a+1]+x[b+1]+x[c+1])/3,cz=(x[a+2]+x[b+2]+x[c+2])/3;
   let rx=cx-(chest?.x??0),ry=cy-(chest?.y??0),rz=cz-(chest?.z??0);
   if(layer===2&&sim.upperGuides){rx=cx-(sim.upperGuides[ia*4]+sim.upperGuides[ib*4]+sim.upperGuides[ic*4])/3;ry=cy-(sim.upperGuides[ia*4+1]+sim.upperGuides[ib*4+1]+sim.upperGuides[ic*4+1])/3;rz=cz-(sim.upperGuides[ia*4+2]+sim.upperGuides[ib*4+2]+sim.upperGuides[ic*4+2])/3;}
   else {const axis=chest?.basis,ax=axis?.[3]??0,ay=axis?.[4]??1,az=axis?.[5]??0,d=rx*ax+ry*ay+rz*az;rx-=d*ax;ry-=d*ay;rz-=d*az;}
   if(nx*rx+ny*ry+nz*rz<0){nx=-nx;ny=-ny;nz=-nz;}
   const uu=ux*ux+uy*uy+uz*uz,uv=ux*vx+uy*vy+uz*vz,vv=vx*vx+vy*vy+vz*vz,den=uu*vv-uv*uv;if(den<1e-12)continue;
   const loX=Math.floor((Math.min(x[a],x[b],x[c])-pad)/cell),hiX=Math.floor((Math.max(x[a],x[b],x[c])+pad)/cell),loY=Math.floor((Math.min(x[a+1],x[b+1],x[c+1])-pad)/cell),hiY=Math.floor((Math.max(x[a+1],x[b+1],x[c+1])+pad)/cell),loZ=Math.floor((Math.min(x[a+2],x[b+2],x[c+2])-pad)/cell),hiZ=Math.floor((Math.max(x[a+2],x[b+2],x[c+2])+pad)/cell);
   // Degenerate stretched faces cannot cause an unbounded broad-phase scan.
   if((hiX-loX+1)*(hiY-loY+1)*(hiZ-loZ+1)>216)continue;
   for(let hx=loX;hx<=hiX;hx++)for(let hy=loY;hy<=hiY;hy++)for(let hz=loZ;hz<=hiZ;hz++)for(let i=this.heads[hash(hx,hy,hz)];i>=0;i=this.next[i]){
    const o=i*3,other=this.layer[i];if(!other||other===layer||this.cells[o]!==hx||this.cells[o+1]!==hy||this.cells[o+2]!==hz)continue;
    // Tunic/sleeve sewing is handled by their attachment constraints, not layered repulsion.
    if(this.objectLayers){
     const dx=x[o]-x[a],dy=x[o+1]-x[a+1],dz=x[o+2]-x[a+2],signed=dx*nx+dy*ny+dz*nz;
     if(Math.abs(signed)>=gap)continue;
     const du=dx*ux+dy*uy+dz*uz,dv=dx*vx+dy*vy+dz*vz,beta=(vv*du-uv*dv)/den,gamma=(uu*dv-uv*du)/den,alpha=1-beta-gamma;
     if(alpha<0||beta<0||gamma<0)continue;
     const mass=w[i]+w[ia]*alpha*alpha+w[ib]*beta*beta+w[ic]*gamma*gamma;if(mass<1e-9)continue;
     const old=(p[o]-p[a])*nx+(p[o+1]-p[a+1])*ny+(p[o+2]-p[a+2])*nz;
     const sign=Math.abs(old)>1e-6?Math.sign(old):signed<0?-1:1,q=Math.min(.008,gap-Math.abs(signed))*sign/mass;
     for(let j=0;j<4;j++){const id=j===0?i:j===1?ia:j===2?ib:ic,v=id*3,k=q*w[id]*(j===0?1:j===1?-alpha:j===2?-beta:-gamma);x[v]+=nx*k;x[v+1]+=ny*k;x[v+2]+=nz*k;p[v]+=nx*k;p[v+1]+=ny*k;p[v+2]+=nz*k;}
     continue;
    }
    if(other<3&&layer<3)continue;
    const dx=x[o]-x[a],dy=x[o+1]-x[a+1],dz=x[o+2]-x[a+2],signed=dx*nx+dy*ny+dz*nz,depth=other>layer?signed:-signed;
    if(depth>=gap||depth< -pad)continue;
    const du=dx*ux+dy*uy+dz*uz,dv=dx*vx+dy*vy+dz*vz;let beta=(vv*du-uv*dv)/den,gamma=(uu*dv-uv*du)/den,alpha=1-beta-gamma;
    if(alpha<0||beta<0||gamma<0){
     let crossing=false;
     if(other>layer&&signed<0)for(const neighbour of this.edges[i]){const e=neighbour*3,ex=x[e]-x[a],ey=x[e+1]-x[a+1],ez=x[e+2]-x[a+2],end=ex*nx+ey*ny+ez*nz;if(end<=0)continue;
      const f=-signed/(end-signed),qx=dx+(ex-dx)*f,qy=dy+(ey-dy)*f,qz=dz+(ez-dz)*f,qu=qx*ux+qy*uy+qz*uz,qv=qx*vx+qy*vy+qz*vz,bb=(vv*qu-uv*qv)/den,gg=(uu*qv-uv*qu)/den;
      if(bb>=0&&gg>=0&&bb+gg<=1){crossing=true;break;}
     }
     if(!crossing)continue;
    }
    const correction=Math.min(.012,gap-depth)*.4;
    if(other>layer){if(!w[i])continue;const q=correction;x[o]+=nx*q;x[o+1]+=ny*q;x[o+2]+=nz*q;p[o]+=nx*q;p[o+1]+=ny*q;p[o+2]+=nz*q;}
    else {const mass=w[ia]*alpha*alpha+w[ib]*beta*beta+w[ic]*gamma*gamma;if(mass<1e-9)continue;for(let j=0;j<3;j++){const id=this.triangles[t+j],v=id*3,q=Math.min(.025,correction*w[id]*(j===0?alpha:j===1?beta:gamma)/mass);x[v]+=nx*q;x[v+1]+=ny*q;x[v+2]+=nz*q;p[v]+=nx*q;p[v+1]+=ny*q;p[v+2]+=nz*q;}}
   }
  }
 }
}

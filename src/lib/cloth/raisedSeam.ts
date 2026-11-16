import * as T from 'three';

/** A narrow piping mesh follows the welded pattern edge, including in outline view. */
export class RaisedSeam extends T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>{
  private tangent=new T.Vector3();
  private across=new T.Vector3();
  private normal=new T.Vector3();
  constructor(private path:number[],color:string){
    const geometry=new T.BufferGeometry();
    const material=new T.MeshStandardMaterial({color,roughness:.95,side:T.DoubleSide});
    super(geometry,material);
    this.frustumCulled=false;
    const indices:number[]=[];
    for(let i=0;i<path.length-1;i++)for(let j=0;j<4;j++){
      const a=i*4+j,b=i*4+(j+1)%4;
      indices.push(a,b,a+4,b,b+4,a+4);
    }
    geometry.setIndex(indices);
    for(const key of ['position','normal'])geometry.setAttribute(key,new T.BufferAttribute(new Float32Array(path.length*12),3).setUsage(T.DynamicDrawUsage));
    this.tint(color);
  }
  tint(color:string){this.material.color.set(color).multiplyScalar(.53);}
  update(x:Float32Array,n:Float32Array){
    const pos=this.geometry.attributes.position,nor=this.geometry.attributes.normal;
    for(let i=0;i<this.path.length;i++){
      const o=this.path[i]*3,a=this.path[Math.max(0,i-1)]*3,b=this.path[Math.min(this.path.length-1,i+1)]*3;
      this.tangent.set(x[b]-x[a],x[b+1]-x[a+1],x[b+2]-x[a+2]).normalize();
      this.normal.fromArray(n,o);
      this.across.crossVectors(this.tangent,this.normal).normalize();
      this.normal.crossVectors(this.across,this.tangent).normalize();
      for(let j=0;j<4;j++){
        const u=j===0?1:j===2?-1:0,v=j===1?1:j===3?-1:0;
        const nx=this.across.x*u+this.normal.x*v,ny=this.across.y*u+this.normal.y*v,nz=this.across.z*u+this.normal.z*v;
        pos.setXYZ(i*4+j,x[o]+nx*.006,x[o+1]+ny*.006,x[o+2]+nz*.006);
        nor.setXYZ(i*4+j,nx,ny,nz);
      }
    }
    pos.needsUpdate=nor.needsUpdate=true;
  }
  dispose(){this.geometry.dispose();this.material.dispose();}
}

import type { WaistBuild } from './presets';
import type { ClothSim } from './solver';

/** Small compliant support loop: lateral pelvis support is firm, front/back can slide.
 * Only the seam vertices are visited; no additional collision mesh or remeshing. */
export class WaistSupport {
  enabled = true;
  readonly targets: Float32Array;
  private slack: Float32Array;
  private compliance: Float32Array;
  constructor(readonly pattern: WaistBuild) {
    this.targets = new Float32Array(pattern.reference.length);
    this.slack = new Float32Array(pattern.indices.length);
    this.compliance = new Float32Array(pattern.indices.length);
    this.setPose(...pattern.origin, 0, 0);
  }
  setPose(x: number, y: number, z: number, pitch: number, lean: number) {
    const p = Math.sin(pitch * Math.PI / 180), l = Math.sin(lean * Math.PI / 180);
    const ref = this.pattern.reference;
    for(let j=0;j<this.pattern.indices.length;j++) {
      const o=j*3, rx=ref[o], rz=ref[o+2];
      const center = Math.min(1,Math.abs(rz)/.205);
      const back = Math.max(0,-rz/.205),front=Math.max(0,rz/.205);
      // Small downward travel at the back of a forward bend. Side support stays high.
      const slip=.025*Math.max(0,p)*back+.015*Math.max(0,-p)*front;
      this.targets[o]=x+rx;
      this.targets[o+1]=y+ref[o+1]-slip-.006*l*rx/.30;
      this.targets[o+2]=z+rz;
      this.slack[j]=.003+.012*center*center;
      this.compliance[j]=2e-8+5e-7*center*center;
    }
  }
  solve(sim: ClothSim, h: number) {
    if(!this.enabled)return;
    const {x,p,w}=sim,invH2=1/(h*h);
    for(let j=0;j<this.pattern.indices.length;j++) {
      const i=this.pattern.indices[j];if(!w[i])continue;
      const o=i*3,t=j*3,dx=x[o]-this.targets[t],dy=x[o+1]-this.targets[t+1],dz=x[o+2]-this.targets[t+2];
      const d2=dx*dx+dy*dy+dz*dz,slack=this.slack[j];if(d2<=slack*slack)continue;
      const d=Math.sqrt(d2),scale=(1-slack/d)*w[i]/(w[i]+this.compliance[j]*invH2);
      // Translate history too: seam corrections should not launch the cloth.
      x[o]-=dx*scale;x[o+1]-=dy*scale;x[o+2]-=dz*scale;
      p[o]-=dx*scale;p[o+1]-=dy*scale;p[o+2]-=dz*scale;
    }
  }
}

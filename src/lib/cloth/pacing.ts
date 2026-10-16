/** Hysteresis avoids chasing 60 Hz during an expensive collision sequence. */
export class FramePacer {
  fps: 25|30|60=30;
  averageMs=0;
  private good=0;
  private bad=0;
  observe(costMs:number,intervalMs:number) {
    this.averageMs=this.averageMs?this.averageMs*.85+costMs*.15:costMs;
    const overloaded=this.fps===60?(this.averageMs>14||intervalMs>24):(this.averageMs>29||intervalMs>42);
    this.bad=overloaded?this.bad+1:0;
    if(this.bad>=6&&this.fps!==25){this.fps=this.fps===60?30:25;this.good=0;this.bad=0;return;}
    const headroom=this.fps===25?this.averageMs<23&&intervalMs<46:this.fps===30&&this.averageMs<10&&intervalMs<38;
    this.good=headroom?this.good+1:0;
    if(this.good>=this.fps*3){this.fps=this.fps===25?30:60;this.good=0;this.bad=0;}
  }
}

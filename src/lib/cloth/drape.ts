import type {ClothBuild} from './presets';
export function preserveSkirtDrape(build:ClothBuild,previous:ClothBuild,positions:Float32Array){
    const oldSkirt=previous.skirt,nextSkirt=build.skirt;
    // Keep the settled upper part when trimming/extending a skirt instead of spawning it through bent legs.
    if(oldSkirt&&nextSkirt&&oldSkirt.cols===nextSkirt.cols&&oldSkirt.width===nextSkirt.width&&oldSkirt.style===nextSkirt.style&&oldSkirt.folds===nextSkirt.folds&&oldSkirt.length!==nextSkirt.length){
      const cols=nextSkirt.cols,oldX=positions;
      for(let j=1;j<nextSkirt.rows;j++){
        const distance=j/(nextSkirt.rows-1)*nextSkirt.length,row=Math.min(oldSkirt.rows-1,distance/oldSkirt.length*(oldSkirt.rows-1)),lo=Math.min(oldSkirt.rows-2,Math.floor(row)),f=row-lo;
        for(let i=0;i<cols;i++)for(let k=0;k<3;k++){const a=(lo*cols+i)*3+k,c=((lo+1)*cols+i)*3+k,o=(j*cols+i)*3+k;build.x[o]=oldX[a]+(oldX[c]-oldX[a])*f;
          if(distance>oldSkirt.length){if(k===1)build.x[o]-=distance-oldSkirt.length;}
        }
      }
    }
}

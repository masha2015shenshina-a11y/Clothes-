import * as THREE from 'three';
// Sparse octagonal cross sections: broad planes, with bevels only where the silhouette needs them.
function sectionMesh(rows:number[][],sides=8,depth=1,square=.85){
 const p:number[]=[],indices:number[]=[];
 for(const [y,r] of rows)for(let i=0;i<sides;i++){const a=(i+.5)/sides*Math.PI*2,c=Math.cos(a),s=Math.sin(a);p.push(Math.sign(c)*Math.abs(c)**square*r,y,Math.sign(s)*Math.abs(s)**square*r*depth);}
 for(let j=0;j<rows.length-1;j++)for(let i=0;i<sides;i++){const a=j*sides+i,b=j*sides+(i+1)%sides,c=a+sides,d=b+sides;indices.push(a,c,b,b,c,d);}
 const bottom=p.length/3;p.push(0,rows[0][0],0);const top=p.length/3;p.push(0,rows.at(-1)![0],0);
 for(let i=0;i<sides;i++){const j=(i+1)%sides;indices.push(bottom,i,j,top,(rows.length-1)*sides+j,(rows.length-1)*sides+i);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function limbGeometry(length:number,radius:number,lower=false){
 return sectionMesh([[-.5,.48],[-.42,.78],[-.25,1],[-.02,lower?.84:.94],[.27,.64],[.43,.48],[.46,.38]].map(([y,r])=>[y*length,r*radius]),8,.88);
}
export function mannequinGeometries(){return {
 body:[
  sectionMesh([[-.8,.48],[-.55,.79],[-.1,.92],[.38,.86],[.75,.59]],8,1,.7),
  sectionMesh([[-.8,.38],[-.5,.53],[.45,.54],[.8,.38]],8,1,.7),
  sectionMesh([[-.86,.43],[-.62,.64],[-.2,.86],[.22,.94],[.54,.80],[.8,.54]],8,1,.85),
  sectionMesh([[-.8,.5],[-.6,.77],[.5,.77],[.8,.5]],8),
  sectionMesh([[-.91,.30],[-.72,.56],[-.3,.77],[.23,.96],[.65,.75],[.91,.36],[1,0]],12,1,1),
 ],
 joint:new THREE.SphereGeometry(1,8,6),
 hand:sectionMesh([[-.12,.033],[-.08,.053],[.02,.067],[.085,.053],[.12,.015]],8,.42),
 foot:sectionMesh([[-.18,.035],[-.13,.085],[.07,.105],[.19,.087],[.23,.032]],8,.55).rotateX(Math.PI/2),
 };}

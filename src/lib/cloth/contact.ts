/** First entry of a moving point into a capsule, including both round ends. */
export function capsuleEntry(px:number,py:number,pz:number,x:number,y:number,z:number,a:number[],b:number[],r:number):number {
 const dx=x-px,dy=y-py,dz=z-pz,vx=b[0]-a[0],vy=b[1]-a[1],vz=b[2]-a[2];
 const ox=px-a[0],oy=py-a[1],oz=pz-a[2],vv=vx*vx+vy*vy+vz*vz,dd=dx*dx+dy*dy+dz*dz;
 if(dd<1e-16)return 1;
 const vd=vx*dx+vy*dy+vz*dz,vo=vx*ox+vy*oy+vz*oz,od=ox*dx+oy*dy+oz*dz;
 let hit=1;
 const A=vv*dd-vd*vd,B=vv*od-vo*vd,C=vv*(ox*ox+oy*oy+oz*oz-r*r)-vo*vo,D=B*B-A*C;
 if(A>1e-16&&D>1e-16){const t=(-B-Math.sqrt(D))/A,h=vo+t*vd;if(t>=0&&t<hit&&h>=0&&h<=vv)hit=t;}
 for(let end=0;end<2;end++){const q=end===0?a:b;const ux=px-q[0],uy=py-q[1],uz=pz-q[2],k=ux*dx+uy*dy+uz*dz,c=ux*ux+uy*uy+uz*uz-r*r,d=k*k-dd*c;
 if(d>1e-16){const t=(-k-Math.sqrt(d))/dd;if(t>=0&&t<hit)hit=t;}}
 return hit;
}

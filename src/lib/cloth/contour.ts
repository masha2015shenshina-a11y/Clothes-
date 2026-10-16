import * as T from 'three';
/** Screen-space normal/depth outline. Allocated only when requested, reused on
 * subsequent frames, and bypassed completely in the normal rendering mode. */
export class ContourView {
  private size = new T.Vector2();
  private background=new T.Color(0);
  private target = new T.WebGLRenderTarget(1,1,{depthTexture:new T.DepthTexture(1,1)});
  private normals = new T.MeshNormalMaterial({side:T.DoubleSide});
  private scene = new T.Scene();
  private camera = new T.OrthographicCamera(-1,1,1,-1,0,1);
  private material = new T.ShaderMaterial({
    depthTest:false,depthWrite:false,
    uniforms:{normals:{value:this.target.texture},depth:{value:this.target.depthTexture},pixel:{value:new T.Vector2()},near:{value:.1},far:{value:100}},
    vertexShader:'varying vec2 uv0;void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`
      varying vec2 uv0;
      uniform sampler2D normals,depth;
      uniform vec2 pixel;
      uniform float near,far;
      float distanceAt(vec2 uv){float d=texture2D(depth,uv).x;return near*far/(far-d*(far-near));}
      void main(){
        vec3 n=texture2D(normals,uv0).xyz;
        float z=distanceAt(uv0),edge=0.;
        for(int i=0;i<4;i++){
          vec2 dir=i==0?vec2(1.,0.):i==1?vec2(-1.,0.):i==2?vec2(0.,1.):vec2(0.,-1.);
          vec2 q=uv0+dir*pixel;
          float ne=length(n-texture2D(normals,q).xyz);
          float de=abs(z-distanceAt(q))/max(z,.1);
          edge=max(edge,max(smoothstep(.10,.30,ne),smoothstep(.008,.025,de)));
        }
        gl_FragColor=vec4(mix(vec3(.98,.975,.96),vec3(.12,.14,.16),edge),1.);
      }`
  });
  private quad = new T.Mesh(new T.PlaneGeometry(2,2),this.material);
  constructor(){this.scene.add(this.quad);}
  render(renderer:T.WebGLRenderer,scene:T.Scene,camera:T.PerspectiveCamera){
    renderer.getDrawingBufferSize(this.size);
    if(this.target.width!==this.size.x||this.target.height!==this.size.y)this.target.setSize(this.size.x,this.size.y);
    this.material.uniforms.pixel.value.set(1/this.size.x,1/this.size.y);
    this.material.uniforms.near.value=camera.near;this.material.uniforms.far.value=camera.far;
    const oldTarget=renderer.getRenderTarget(),override=scene.overrideMaterial,background=scene.background;
    const hidden:T.Object3D[]=[];
    scene.traverse(o=>{if(o.visible&&(o instanceof T.Line||o instanceof T.Sprite)){hidden.push(o);o.visible=false;}});
    scene.overrideMaterial=this.normals;scene.background=this.background;
    try{renderer.setRenderTarget(this.target);renderer.clear();renderer.render(scene,camera);}
    finally{scene.overrideMaterial=override;scene.background=background;hidden.forEach(o=>o.visible=true);renderer.setRenderTarget(oldTarget);}
    renderer.render(this.scene,this.camera);
  }
  dispose(){this.target.dispose();this.normals.dispose();this.material.dispose();this.quad.geometry.dispose();}
}

import { t as translate } from '../i18n';
import {RotationTool} from './rotationTool';
import type {BodyParts,BodyPart} from '../../components/BodyMap';
import {followLegPose,updateLegGuides} from './legCloth';
import {limbGeometry,mannequinGeometries} from './mannequinGeometry';
import {preserveSkirtDrape} from './drape';
import * as THREE from "three";
import {followUpperPose,updateUpperGuides} from "./upperCloth";
import {upperTransform,bodyArmPoints,bodyEllipsoids,DEFAULT_BODY,BODY_ARM_RADIUS,UPPER_ARM,FOREARM,type BodySettings} from "./mannequin";
import {FramePacer} from "./pacing";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { ClothSim, type SimParams } from "./solver";
import { legPoints, LEG_RADIUS, LEG_SEGMENT, DEFAULT_LEGS, type LegsSettings, type SkirtSettings, armTransform, armPoints, ARM_RADIUS, type SleeveSettings, MATERIALS, type ClothBuild, type ColliderState, type MaterialDef, type MaterialId } from "./presets";

export interface EngineSettings {
  parts?:BodyParts;
  body:BodySettings; mannequin:boolean;
  skirt:SkirtSettings; legs:LegsSettings; legsEnabled:boolean;
  theme: "light" | "dark";
  windHeight:number;
  diffuse: LightSettings;
  directional: LightSettings;
  gravity: number;
  wind: number;
  windEnabled:boolean;
  windElevation: number;
  selfCollision: boolean;
  sleeve: SleeveSettings;
  armEnabled: boolean;
  selected: Selection;
  dragPlane: "view" | "floor";
  windAngle: number; // degrees
  drapeMode?: 'normal'|'exaggerated';
  stiffness: number; // 0.2..3
  material: MaterialId;
  color: string;
  wireframe: boolean;
  sphere: ColliderState;
  box: ColliderState;
  paused: boolean;
}

export interface LightSettings {on:boolean;intensity:number;color:string;x:number;y:number;z:number;}
export const DEFAULT_DIFFUSE: LightSettings={on:true,intensity:1.1,color:"#fff6ea",x:-1.6,y:2.7,z:.4};
export const DEFAULT_DIRECTIONAL: LightSettings={on:true,intensity:2.4,color:"#fff2e2",x:1.7,y:2.8,z:1.4};
export type Selection = "cloth" | "sphere" | "box" | "wind" | "arm" | "pins" | "diffuse" | "directional" | "shoulder" | "legs" | "leftLeg" | "rightLeg" | "torso" | "head" | "leftBodyArm" | "rightBodyArm";

const DT = 1 / 30;
const CAM_POS = new THREE.Vector3(0.6, 1.9, 5.4);
const CAM_TARGET = new THREE.Vector3(0, 1.1, 0);

export function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    const context=c.getContext("webgl2");
    if(!context)return false;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function weaveTexture(kind: MaterialDef["weave"]) {
  const s = 128;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  const img = g.createImageData(s, s);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const rows = new Array(s).fill(0).map(() => rnd());
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      let v = 0.5;
      if (kind === "plain" || kind === "slub") {
        const n = 16, cx = Math.floor(x / (s / n)), cy = Math.floor(y / (s / n));
        const fx = (x % (s / n)) / (s / n), fy = (y % (s / n)) / (s / n);
        const over = (cx + cy) % 2 === 0;
        v = over ? Math.sin(fx * Math.PI) * 0.8 + 0.1 : Math.sin(fy * Math.PI) * 0.8 + 0.1;
        if (kind === "slub") v *= 0.75 + 0.5 * rows[y] * (0.6 + 0.4 * Math.sin(x * 0.05 + rows[y] * 9));
      } else if (kind === "twill") {
        const d = ((x + y) % 16) / 16;
        v = 0.5 + 0.45 * Math.sin(d * Math.PI * 2) + (rnd() - 0.5) * 0.15;
      } else {
        v = 0.5 + 0.3 * Math.sin((y / s) * Math.PI * 64) + (rnd() - 0.5) * 0.05;
      }
      const o = (y * s + x) * 4;
      const b = Math.max(0, Math.min(255, v * 255));
      img.data[o] = img.data[o + 1] = img.data[o + 2] = b;
      img.data[o + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function floorTexture() {
  const s = 512;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  g.fillStyle = "#e9e2d6";
  g.fillRect(0, 0, s, s);
  g.strokeStyle = "rgba(60,50,40,0.10)";
  g.lineWidth = 1;
  for (let i = 0; i <= 8; i++) {
    g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, s); g.stroke();
    g.beginPath(); g.moveTo(0, i * 64); g.lineTo(s, i * 64); g.stroke();
  }
  g.strokeStyle = "rgba(60,50,40,0.22)";
  g.lineWidth = 2;
  g.strokeRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 5);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Three tapered bands form a lightweight windsock, flowing from wide to narrow.
function makeWindSock() {
  const group=new THREE.Group();
  const orange=new THREE.MeshBasicMaterial({color:0xdba262,side:THREE.DoubleSide});
  const pale=new THREE.MeshBasicMaterial({color:0xf3e9d5,side:THREE.DoubleSide});
  for(let i=0;i<3;i++){
    const bottom=.13-i*.03,top=bottom-.03;
    const band=new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,.22,12,1,true),i===1?pale:orange);
    band.position.y=.11+i*.22;group.add(band);
  }
  const ring=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({length:24},(_,i)=>new THREE.Vector3(Math.cos(i/24*Math.PI*2)*.135,0,Math.sin(i/24*Math.PI*2)*.135))),new THREE.LineBasicMaterial({color:0x78858d}));
  group.add(ring);return group;
}

// A camera-facing icon costs two triangles and stays readable from every angle.
function diffuseMarker() {
  const canvas=document.createElement("canvas");canvas.width=canvas.height=64;
  const ctx=canvas.getContext("2d")!;
  ctx.strokeStyle="#e2c786";ctx.lineWidth=5;
  ctx.beginPath();ctx.arc(32,32,18,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle="#e2c786";ctx.beginPath();ctx.arc(32,32,4,0,Math.PI*2);ctx.fill();
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const marker=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,depthWrite:false,toneMapped:false}));
  marker.scale.set(.36,.36,1);marker.renderOrder=30;
  return marker;
}

export class ClothEngine {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  sim: ClothSim | null = null;
  build: ClothBuild | null = null;
  mesh: THREE.Mesh | null = null;
  geom: THREE.BufferGeometry | null = null;
  clothMat: THREE.MeshPhysicalMaterial;
  pins: THREE.Points;
  sphereMesh: THREE.Mesh;
  boxMesh: THREE.Mesh;
  settings: EngineSettings;
  textures = new Map<string, THREE.Texture>();
  raf = 0;
  disposed=false;
  contextLost=false;
  firstFrame=true;
  environmentTarget:THREE.WebGLRenderTarget|null=null;
  pixelRatio=1;
  pacer=new FramePacer();
  lastDraw=-Infinity;
  lastSimFrame=0;
  frameCost=0;
  slowFrames=0;
  last = 0;
  acc = 0;
  frames = 0;
  fpsT = 0;
  ro: ResizeObserver;
  ray = new THREE.Raycaster();
  ndc = new THREE.Vector2();
  plane = new THREE.Plane();
  dragId: number | null = null;
  onFps: (fps: number) => void;
  onChange: (patch: Partial<EngineSettings>) => void;
  objectDrag: Selection | null = null;
  offset = new THREE.Vector3();
  windOrigin = new THREE.Vector3(-1.75, 1.05, .3);
  windSock=makeWindSock();
  armGroup = new THREE.Group();
  armSegments: THREE.Mesh[] = [];
  elbow = new THREE.Mesh(new THREE.SphereGeometry(ARM_RADIUS*1.08,16,12),new THREE.MeshStandardMaterial({color:0x37342f,metalness:.4,roughness:.3}));
  wrist = new THREE.Mesh(new THREE.IcosahedronGeometry(.11,0),new THREE.MeshBasicMaterial({color:0xd5a041,depthTest:false}));
  armAngle = 35;
  shoulder=new THREE.Mesh(new THREE.IcosahedronGeometry(.12,0),new THREE.MeshBasicMaterial({color:0x66a6b8,depthTest:false}));
  legPose:LegsSettings=structuredClone(DEFAULT_LEGS);
  poseHandles:THREE.Mesh[]=[];
  bodyPose:BodySettings=structuredClone(DEFAULT_BODY);
  bodyGroup=new THREE.Group();pelvisGroup=new THREE.Group();
  bodyDetails:THREE.Mesh[]=[];legDetails:THREE.Mesh[]=[];soloHand!:THREE.Mesh;
  bodyShapes:THREE.Mesh[]=[];bodyArmMeshes:THREE.Mesh[]=[];handHandles:THREE.Mesh[]=[];
  lastPinTap={id:-1,time:0,x:0,y:0};pinPress:{id:number;time:number;x:number;y:number;moved:boolean}|null=null;
  legGroup=new THREE.Group();
  legMeshes:THREE.Mesh[]=[];
  footHandles:THREE.Mesh[]=[];
  hipHandle=new THREE.Mesh(new THREE.IcosahedronGeometry(.12,0),new THREE.MeshBasicMaterial({color:0x66a6b8,depthTest:false}));
  pinLabels:HTMLButtonElement[]=[];
  labelPoint=new THREE.Vector3();
  viewportWidth=1;
  viewportHeight=1;
  labelLayer=document.createElement("div");
  geometryDirty=true;
  renderDirty=true;
  floorMat:THREE.MeshStandardMaterial|null=null;
  windAxes: {direction:THREE.Vector3;arrow:THREE.ArrowHelper;hit:THREE.Mesh;dot:THREE.Mesh}[]=[];
  editRevision=0;
  diffuseLight=new THREE.HemisphereLight(0xffffff,0x70685c,1);
  directionalLight=new THREE.DirectionalLight(0xffffff,2.4);
  lightHandles = {
    diffuse:diffuseMarker(),
    directional:new THREE.Mesh(new THREE.OctahedronGeometry(.18),new THREE.MeshBasicMaterial({color:0xe6ac40,depthTest:false}))
  };
  lightAim=new THREE.ArrowHelper(new THREE.Vector3(0,-1,0),new THREE.Vector3(),.8,0xe6ac40);
  pinGroups:number[][]=[];
  pinDrag:number[]|null=null;
  pinStart:number[]=[];
  pinOrigin=new THREE.Vector3();
  selectedPin=-1;
  pointerStart={x:0,y:0,angle:0,elevation:0};

  constructor(private container: HTMLElement, settings: EngineSettings, onFps: (fps: number) => void, onChange: (patch: Partial<EngineSettings>) => void) {
    this.settings = settings;
    this.onFps = onFps;
    this.onChange=onChange;
    this.armAngle=settings.sleeve.angle;this.legPose=structuredClone(settings.legs);this.bodyPose=structuredClone(settings.body);
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.pixelRatio=Math.min(window.devicePixelRatio,1.5);
    r.setPixelRatio(this.pixelRatio);
    r.shadowMap.enabled = true;
    r.shadowMap.autoUpdate=false;r.shadowMap.needsUpdate=true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = r;
    container.appendChild(r.domElement);
    this.labelLayer.style.cssText="position:absolute;inset:0;pointer-events:none;overflow:hidden";
    container.appendChild(this.labelLayer);
    const anatomy=mannequinGeometries(),wood=()=>new THREE.MeshStandardMaterial({color:0xb9a184,roughness:.83,metalness:0});
    const mesh=(g:THREE.BufferGeometry,material:THREE.Material|THREE.Material[],group:THREE.Group,selection?:Selection)=>{const m=new THREE.Mesh(g,material);m.castShadow=true;m.receiveShadow=false;if(selection)m.userData.selection=selection;group.add(m);return m;};
    const thigh=limbGeometry(LEG_SEGMENT,LEG_RADIUS),shin=limbGeometry(LEG_SEGMENT,LEG_RADIUS*.83,true);
    for(let i=0;i<4;i++)this.legMeshes.push(mesh(i%2?shin:thigh,wood(),this.legGroup));
    for(let side=0;side<2;side++){
      const selection=side?'rightLeg':'leftLeg',mat=this.legMeshes[side*2].material;
      for(const radius of [.12,.10,.075]){const m=mesh(anatomy.joint,mat,this.legGroup,selection);m.scale.setScalar(radius);this.legDetails.push(m);}
      this.legDetails.push(mesh(anatomy.foot,mat,this.legGroup,selection));
      const handle=new THREE.Mesh(new THREE.IcosahedronGeometry(.09,0),new THREE.MeshBasicMaterial({color:0xd5a041,depthTest:false}));this.footHandles.push(handle);this.legGroup.add(handle);
    }
    for(const id of ["torso","head"]){const handle=new THREE.Mesh(new THREE.IcosahedronGeometry(.065,0),new THREE.MeshBasicMaterial({color:0x66a6b8,depthTest:false}));handle.userData.selection=id;handle.renderOrder=35;this.poseHandles.push(handle);this.bodyGroup.add(handle);}
    this.pelvisGroup.add(this.hipHandle);this.scene.add(this.legGroup,this.pelvisGroup,this.bodyGroup);
    for(let i=0;i<5;i++){const mat=wood();mat.flatShading=i<3;this.bodyShapes.push(mesh(anatomy.body[i],mat,i===0?this.pelvisGroup:this.bodyGroup));}
    // Angular iliac guides retain the pelvis landmarks without transparent nested meshes.
    const pelvicLines:number[]=[];for(const sign of [-1,1]){const pts=[[sign*.065,-.14,.20],[sign*.22,-.07,.20],[sign*.24,.025,.17]];for(let i=0;i<2;i++)pelvicLines.push(...pts[i],...pts[i+1]);}
    const pelvicGeometry=new THREE.BufferGeometry();pelvicGeometry.setAttribute('position',new THREE.Float32BufferAttribute(pelvicLines,3));this.pelvisGroup.add(new THREE.LineSegments(pelvicGeometry,new THREE.LineBasicMaterial({color:0x756149})));
    const upper=limbGeometry(UPPER_ARM,BODY_ARM_RADIUS),lower=limbGeometry(FOREARM,BODY_ARM_RADIUS*.83,true);
    for(let i=0;i<4;i++)this.bodyArmMeshes.push(mesh(i%2?lower:upper,wood(),this.bodyGroup));
    for(let side=0;side<2;side++){
      const selection=side?'rightBodyArm':'leftBodyArm',mat=this.bodyArmMeshes[side*2].material;
      for(const radius of [.105,.073,.053]){const m=mesh(anatomy.joint,mat,this.bodyGroup,selection);m.scale.setScalar(radius);this.bodyDetails.push(m);}
      this.bodyDetails.push(mesh(anatomy.hand,mat,this.bodyGroup,selection));
      const handle=new THREE.Mesh(new THREE.IcosahedronGeometry(.075,0),new THREE.MeshBasicMaterial({color:0xd5a041,depthTest:false}));handle.renderOrder=30;this.handHandles.push(handle);this.bodyGroup.add(handle);
    }

    r.domElement.style.display = "block";
    r.domElement.style.touchAction = "none";

    const bg = new THREE.Color("#efe8dd");
    this.scene.background = bg;
    this.scene.fog = new THREE.Fog(bg, 9, 22);
    const pmrem = new THREE.PMREMGenerator(r);
    const room=new RoomEnvironment();
    this.environmentTarget=pmrem.fromScene(room,.04);
    this.scene.environment=this.environmentTarget.texture;
    room.dispose();pmrem.dispose();
    this.scene.environmentIntensity = 0.55;

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.05, 60);
    this.camera.position.copy(CAM_POS);
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.target.copy(CAM_TARGET);
    this.controls.enableDamping = false;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning=true;
    this.controls.zoomToCursor=true;
    this.controls.addEventListener("change",()=>{this.invalidate();});
    this.controls.minDistance = .25;
    this.controls.maxDistance = 35;
    this.controls.maxPolarAngle = Math.PI-.03;
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    this.controls.update();

    this.scene.add(this.diffuseLight);
    const sun=this.directionalLight;
    sun.castShadow=true;sun.shadow.mapSize.set(512,512);
    const sc=sun.shadow.camera;sc.left=-5;sc.right=5;sc.top=5;sc.bottom=-5;sc.near=.1;sc.far=20;
    sun.shadow.bias=-.0004;sun.shadow.normalBias=.02;
    sun.target.position.set(0,1.2,0);this.scene.add(sun,sun.target);
    this.scene.add(this.lightHandles.diffuse,this.lightHandles.directional,this.lightAim);
    this.lightHandles.diffuse.renderOrder=30;this.lightHandles.directional.renderOrder=30;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.95 }),
    );
    (floor.material as THREE.MeshStandardMaterial).map!.repeat.set(40, 40);
    this.floorMat=floor.material as THREE.MeshStandardMaterial;
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const objMat = new THREE.MeshStandardMaterial({ color: "#d9d3c9", roughness: 0.4 });
    this.sphereMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), objMat);
    this.sphereMesh.castShadow = this.sphereMesh.receiveShadow = true;
    this.boxMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: "#5b5650", roughness: 0.55 }));
    this.boxMesh.castShadow = this.boxMesh.receiveShadow = true;
    this.scene.add(this.sphereMesh, this.boxMesh);
    for(let i=0;i<2;i++) {
      const m=new THREE.Mesh(limbGeometry(.85,ARM_RADIUS*(i?.83:1),!!i),wood());
      m.castShadow=m.receiveShadow=true;this.armSegments.push(m);this.armGroup.add(m);
    }
    (this.elbow.material as THREE.MeshStandardMaterial).color.set(0xb9a184);(this.elbow.material as THREE.MeshStandardMaterial).metalness=0;(this.elbow.material as THREE.MeshStandardMaterial).roughness=.83;
    this.soloHand=mesh(anatomy.hand,wood(),this.armGroup,'arm');
    this.shoulder.renderOrder=30;this.armGroup.add(this.elbow,this.wrist,this.shoulder);this.scene.add(this.armGroup);
    this.wrist.renderOrder=30;
    this.scene.add(this.windSock);
    const dotGeometry=new THREE.IcosahedronGeometry(.045,0),hitGeometry=new THREE.SphereGeometry(.18,8,6),hitMaterial=new THREE.MeshBasicMaterial({visible:false});
    for(const v of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) {
      const direction=new THREE.Vector3(...v);
      const arrow=new THREE.ArrowHelper(direction,this.windOrigin,.58,0x8b939b,.01,.01);
      arrow.cone.visible=false;
      const dot=new THREE.Mesh(dotGeometry,new THREE.MeshBasicMaterial({color:0x8b939b,depthTest:false}));dot.renderOrder=30;
      const hit=new THREE.Mesh(hitGeometry,hitMaterial);
      hit.position.copy(this.windOrigin).addScaledVector(direction,.6);
      this.scene.add(arrow,hit,dot);this.windAxes.push({direction,arrow,hit,dot});
    }

    this.clothMat = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, sheenColor: new THREE.Color("#ffffff") });
    this.pins = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({ color: "#c47b29", size: 20, sizeAttenuation: false, depthTest: false }),
    );
    this.pins.renderOrder = 10;
    this.pins.frustumCulled = false;
    this.scene.add(this.pins);

    const el = r.domElement;
    el.addEventListener("webglcontextlost",this.contextLostHandler);
    el.addEventListener("webglcontextrestored",this.contextRestoredHandler);
    el.addEventListener("pointerdown", this.onDown, { capture: true });
    el.addEventListener("pointermove", this.onMove);
    el.addEventListener("pointerup", this.onUp);
    el.addEventListener("pointercancel", this.onUp);
    el.addEventListener("lostpointercapture", this.onUp);
    el.addEventListener("contextmenu", this.prevent);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.applySettings(settings);
    document.addEventListener("visibilitychange",this.visibilityChanged);
    this.invalidate();
  }

  private prevent = (e: Event) => e.preventDefault();

  resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.viewportWidth=w;this.viewportHeight=h;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.invalidate();
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  simParams(s: EngineSettings): SimParams {
    const M = MATERIALS[s.material];
    const a = (s.windAngle * Math.PI) / 180;
    return {
      shoulder:s.armEnabled?s.sleeve:undefined,
      gravity: s.gravity,
      windX: Math.sin(a)*Math.cos(s.windElevation*Math.PI/180),
      windY: Math.sin(s.windElevation*Math.PI/180),
      selfCollision: s.selfCollision,
      capsules: this.allCapsules(),
      ellipsoids:this.activeEllipsoids(),
      windZ: Math.cos(a)*Math.cos(s.windElevation*Math.PI/180),
      windStrength: s.windEnabled?s.wind:0,
      drapeMode:s.drapeMode,
      stretch: 0,
      shear: M.shear / s.stiffness,
      bend: M.bend / (s.stiffness * s.stiffness),
      damping: M.damping,
      density: M.density,
      friction: M.friction,
      sphere: { on: s.sphere.on, x: s.sphere.x, y: s.sphere.y, z: s.sphere.z, r: s.sphere.size },
      box: { on: s.box.on, x: s.box.x, y: s.box.y, z: s.box.z, s: s.box.size, width:s.box.width,height:s.box.height,depth:s.box.depth,basis:this.boxBasis(s.box) },
    };
  }

  bodyCapsules(){return this.settings.mannequin&&this.settings.body.on&&this.settings.body.arms?(["left","right"] as const).filter(side=>this.partOn(side==="left"?"leftArm":"rightArm")).flatMap(side=>{const [a,b,c]=bodyArmPoints(this.settings.legs,this.bodyPose,side);const collar=upperTransform([this.settings.legs.x+(side==="left"?-.13:.13),this.settings.legs.y+.83,this.settings.legs.z],this.settings.legs,this.bodyPose);return [{a,b,r:BODY_ARM_RADIUS},{a:b,b:c,r:BODY_ARM_RADIUS},{a:collar,b:a,r:.105}];}):[];}
  extremityCapsules(){
    const result:NonNullable<SimParams['capsules']>=[];
    if(this.settings.legsEnabled)for(const side of ['left','right'] as const){if(!this.partOn(side==='left'?'leftLeg':'rightLeg'))continue;const [,knee,ankle]=legPoints(this.legPose,side),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,-1,0),new THREE.Vector3(...ankle).sub(new THREE.Vector3(...knee)).normalize()),at=(z:number)=>new THREE.Vector3(0,-.07,z).applyQuaternion(q).add(new THREE.Vector3(...ankle)).toArray();result.push({a:at(-.03),b:at(.23),r:.085});}
    const palm=(points:number[][])=>{const elbow=points[1],wrist=points[2],d=wrist.map((v,k)=>v-elbow[k]),length=Math.hypot(...d);result.push({a:wrist.map((v,k)=>v+d[k]/length*.05),b:wrist.map((v,k)=>v+d[k]/length*.20),r:.065});};
    if(this.settings.mannequin&&this.settings.body.on&&this.settings.body.arms)for(const side of ['left','right'] as const)if(this.partOn(side==='left'?'leftArm':'rightArm'))palm(bodyArmPoints(this.settings.legs,this.bodyPose,side));
    if(this.settings.armEnabled)palm(armPoints(this.armAngle,this.settings.sleeve));
    return result;
  }
  allCapsules(){return [...(this.settings.armEnabled?this.armCapsules():[]),...(this.settings.legsEnabled?this.legCapsules().filter((_,i)=>this.partOn(i<2?"leftLeg":"rightLeg")):[]),...this.bodyCapsules(),...this.extremityCapsules()];}
  updateBody(){
    const s=this.settings,r=s.legs;
    this.pelvisGroup.visible=s.mannequin&&(s.body.on||s.legsEnabled)&&this.partOn("pelvis");this.bodyGroup.visible=s.body.on&&s.mannequin;
    this.pelvisGroup.position.set(r.x,r.y,r.z);this.hipHandle.position.set(0,.12,.30);this.hipHandle.visible=s.selected==="legs"||s.selected==="torso";
    bodyEllipsoids(r,true,this.bodyPose).forEach((e,i)=>{const m=this.bodyShapes[i];m.visible=this.partOn(i===0?"pelvis":i===4?"head":"torso");m.position.set(i?e.x:0,i?e.y:e.y-r.y,i?e.z:0);m.scale.set(e.rx,e.ry,e.rz);if(e.basis)m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...e.basis.slice(0,3)),new THREE.Vector3(...e.basis.slice(3,6)),new THREE.Vector3(...e.basis.slice(6,9))));(m.material as THREE.MeshStandardMaterial).emissive.set(s.selected==="torso"&&i>0?0x344e5a:0);});
    for(const [index,side] of (["left","right"] as const).entries()){
      const points=bodyArmPoints(r,this.bodyPose,side).map(p=>new THREE.Vector3(...p));
      const active=(s.selected==="leftBodyArm"||s.selected==="rightBodyArm")&&(s.body.linked||s.selected===(side==="left"?"leftBodyArm":"rightBodyArm"));
      for(let k=0;k<2;k++){const m=this.bodyArmMeshes[index*2+k];m.visible=s.body.arms&&this.partOn(side==="left"?"leftArm":"rightArm");m.position.copy(points[k]).add(points[k+1]).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),points[k+1].clone().sub(points[k]).normalize());(m.material as THREE.MeshStandardMaterial).emissive.set(active?0x745227:0);}
      for(let j=0;j<4;j++){const part=this.bodyDetails[index*4+j];part.visible=s.body.arms&&this.partOn(side==="left"?"leftArm":"rightArm");if(j<3)part.position.copy(points[j]);else{const direction=points[2].clone().sub(points[1]).normalize();part.position.copy(points[2]).addScaledVector(direction,.13);part.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);}}
      this.handHandles[index].visible=s.body.arms&&active&&this.partOn(side==="left"?"leftArm":"rightArm");this.handHandles[index].position.copy(points[2]);(this.handHandles[index].material as THREE.MeshBasicMaterial).color.set(active?0xe6bc75:0x9aabb6);
    }
    this.bodyShapes[4].userData.selection="head";
    this.poseHandles.forEach((h,i)=>{h.position.set(...upperTransform([r.x,r.y+(i?1.48:.80),r.z+.26],r,this.bodyPose,false,!!i));h.visible=this.partOn(i?"head":"torso");});
    if(this.sim&&this.build&&!this.clothDetached)updateUpperGuides(this.sim,this.build,r,this.bodyPose);
    this.maskGuides();
    this.sim?.waist?.setPose(r.x,r.y,r.z,s.body.on?this.bodyPose.torsoPitch:0,s.body.on?this.bodyPose.torsoLean:0);
    if(this.sim){this.sim.params.capsules=this.allCapsules();this.sim.params.ellipsoids=this.activeEllipsoids();}
  }
  legCapsules(s=this.legPose) {return (["left","right"] as const).flatMap(side=>{const [a,b,c]=legPoints(s,side);return [{a,b,r:LEG_RADIUS},{a:b,b:c,r:LEG_RADIUS}];});}
  updateLegs() {
    this.legGroup.visible=this.settings.legsEnabled;
    const caps=this.legCapsules();
    caps.forEach((c,i)=>{const a=new THREE.Vector3(...c.a),b=new THREE.Vector3(...c.b),m=this.legMeshes[i];m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.sub(a).normalize());});
    for(let i=0;i<2;i++){
      const points=legPoints(this.legPose,i?'right':'left').map(p=>new THREE.Vector3(...p)),selected=this.settings.selected,active=(selected==='leftLeg'||selected==='rightLeg')&&(this.settings.legs.linked||selected===(i?'rightLeg':'leftLeg'));
      this.footHandles[i].position.copy(points[2]);this.footHandles[i].visible=active&&this.partOn(i?"rightLeg":"leftLeg");
      for(let j=0;j<4;j++)this.legDetails[i*4+j].visible=this.partOn(i?"rightLeg":"leftLeg");
      for(let j=0;j<2;j++)this.legMeshes[i*2+j].visible=this.partOn(i?"rightLeg":"leftLeg");
      for(let j=0;j<3;j++)this.legDetails[i*4+j].position.copy(points[j]);
      const foot=this.legDetails[i*4+3];foot.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),points[2].clone().sub(points[1]).normalize());foot.position.copy(points[2]).add(new THREE.Vector3(0,-.07,.09).applyQuaternion(foot.quaternion));
    }
    for(let i=0;i<4;i++){const selected=this.settings.selected,active=(selected==="leftLeg"||selected==="rightLeg")&&(this.settings.legs.linked||selected===(i<2?"leftLeg":"rightLeg"));(this.legMeshes[i].material as THREE.MeshStandardMaterial).emissive.set(active?0x745227:0);}

    if(this.sim){this.sim.params.capsules=this.allCapsules();if(this.build&&!this.clothDetached)updateLegGuides(this.sim,this.build,this.legPose,this.settings.legsEnabled);this.maskGuides();}
  }
  floorSelected() {
    const s=this.settings,k=s.selected;
    if(k==="sphere"||k==="box"){const c=s[k];this.change({[k]:{...c,y:k==="sphere"?c.size:(()=>{const b=this.boxBasis(c);return b?(Math.abs(b[1])*(c.width??c.size)+Math.abs(b[4])*(c.height??c.size)+Math.abs(b[7])*(c.depth??c.size))/2:(c.height??c.size)/2;})()}});}
    else if(k==="arm"||k==="shoulder") {const pts=armPoints(this.armAngle,s.sleeve),min=Math.min(...pts.map(p=>p[1]))-ARM_RADIUS;this.change({sleeve:{...s.sleeve,shoulderY:(s.sleeve.shoulderY??1.65)-min}});}
    else if(k==="legs"||k==="leftLeg"||k==="rightLeg"||k==="torso"||k==="leftBodyArm"||k==="rightBodyArm"){const min=Math.min(...[...(s.legsEnabled?this.legCapsules():[]),...this.bodyCapsules(),{a:[0,s.legs.y-.25,0],b:[0,s.legs.y-.25,0],r:0}].flatMap(c=>[c.a[1]-c.r,c.b[1]-c.r]));this.change({legs:{...s.legs,y:s.legs.y-min}});}
    else if(k==="wind")this.change({windHeight:0});
    else if(k==="diffuse"||k==="directional")this.change({[k]:{...s[k],y:0}});
    else if(this.sim){const ids=k==="pins"&&this.selectedPin>=0?this.pinGroups[this.selectedPin]:Array.from({length:this.sim.n},(_,i)=>i).filter(i=>!this.sim!.locked[i]);let min=Infinity;for(const i of ids)min=Math.min(min,this.sim.x[i*3+1]);for(const i of ids)for(const b of [this.sim.x,this.sim.p])b[i*3+1]+=.014-min;this.geometryDirty=true;this.invalidate();}
    this.editRevision++;this.invalidate();
  }
  armCapsules() {
    const [a,b,c]=armPoints(this.armAngle,this.settings.sleeve);return [{a,b,r:ARM_RADIUS},{a:b,b:c,r:ARM_RADIUS}];
  }
  updateArm() {
    const pts=armPoints(this.armAngle,this.settings.sleeve).map(p=>new THREE.Vector3(...p));
    for(let i=0;i<2;i++) {const a=pts[i],b=pts[i+1],m=this.armSegments[i];m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());}
    const direction=pts[2].clone().sub(pts[1]).normalize();this.soloHand.position.copy(pts[2]).addScaledVector(direction,.13);this.soloHand.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);
    this.shoulder.position.copy(pts[0]);this.elbow.position.copy(pts[1]);this.wrist.position.copy(pts[2]);this.armGroup.visible=this.settings.armEnabled;
    if(this.sim)this.sim.params.capsules=this.allCapsules();
  }
  pointWind(direction:THREE.Vector3) {
    const d=direction.clone().normalize();
    this.change({windAngle:Math.atan2(d.x,d.z)*180/Math.PI,windElevation:Math.asin(THREE.MathUtils.clamp(d.y,-1,1))*180/Math.PI});this.editRevision++;
  }
  windDirectionVector(id:string) {
    const forward=this.camera.getWorldDirection(new THREE.Vector3());forward.y=0;
    if(forward.lengthSq()<.001)forward.set(0,0,-1);forward.normalize();
    const right=forward.clone().cross(new THREE.Vector3(0,1,0));
    return id==="up"?new THREE.Vector3(0,1,0):id==="down"?new THREE.Vector3(0,-1,0):id==="right"?right:id==="left"?right.negate():id==="away"?forward:forward.negate();
  }
  windDirection(id:string) {this.pointWind(this.windDirectionVector(id));}
  isWindDirection(id:string) {const a=this.settings.windAngle*Math.PI/180,e=this.settings.windElevation*Math.PI/180;return this.windDirectionVector(id).dot(new THREE.Vector3(Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e)))>.99;}
  updateWind() {
    this.windOrigin.y=this.settings.windHeight;
    this.windSock.position.copy(this.windOrigin);
    for(const v of this.windAxes){v.arrow.position.copy(this.windOrigin);v.hit.position.copy(this.windOrigin).addScaledVector(v.direction,.6);v.dot.position.copy(v.hit.position);}
    const a=this.settings.windAngle*Math.PI/180,e=this.settings.windElevation*Math.PI/180;
    const d=new THREE.Vector3(Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e));
    for(const a of this.windAxes){a.arrow.visible=this.settings.windEnabled&&this.settings.selected==="wind";a.hit.visible=a.dot.visible=a.arrow.visible;const active=d.dot(a.direction)>.98;const color=active?0xe2bd82:this.settings.theme==="dark"?0x8b939b:0x555e68;a.arrow.setColor(color);(a.dot.material as THREE.MeshBasicMaterial).color.setHex(color);a.dot.scale.setScalar(active?1.5:1);}
    this.windSock.visible=this.settings.windEnabled;
    this.windSock.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d);

  }
  change(patch: Partial<EngineSettings>) {this.applySettings({...this.settings,...patch});this.onChange(patch);}

  rotationTool?:RotationTool;
  clothDetached=false;
  setRotationMode(on:boolean){this.rotationTool??=new RotationTool(this);this.rotationTool.setEnabled(on);}
  detachClothFromBody(){if(!this.sim||this.clothDetached)return;this.clothDetached=true;this.sim.sleeveSupport=undefined;if(this.sim.waist)this.sim.waist.enabled=false;this.sim.upperGuides=this.sim.legGuides=this.sim.upperSectors=this.sim.legSectors=null;}
  maskGuides(){
    const sim=this.sim,b=this.build;if(!sim||!b||this.clothDetached)return;
    for(let i=0;i<sim.n;i++){const side=b.legSkin[i*2];if(side&&!this.partOn(side<0?'leftLeg':'rightLeg')){if(sim.legGuides)sim.legGuides[i*4+3]=0;if(sim.legSectors)sim.legSectors[i*7+6]=0;}}
    const m=b.upper;if(m&&m.sleevesStart>=0){const count=m.sleeveCols*m.sleeveDistances.length;for(let i=m.sleevesStart;i<sim.n;i++)if(!this.partOn(i-m.sleevesStart<count?'leftArm':'rightArm')){if(sim.upperGuides)sim.upperGuides[i*4+3]=0;if(sim.upperSectors)sim.upperSectors[i*7+6]=0;}}
  }
  partOn(part:BodyPart){return this.settings.parts?.[part]!==false;}
  activeEllipsoids(){const s=this.settings;return s.mannequin&&(s.body.on||s.legsEnabled)?bodyEllipsoids(s.legs,s.body.on,this.bodyPose).map((e,i)=>({...e,enabled:this.partOn(i===0?'pelvis':i===4?'head':'torso')})):[];}
  boxBasis(s:ColliderState){if(!s.rotation)return undefined;const m=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...s.rotation)).elements;return [m[0],m[1],m[2],m[4],m[5],m[6],m[8],m[9],m[10]];}
  applySettings(s: EngineSettings) {
    const previous=this.settings,previousLegPose=this.legPose,previousBodyPose=this.bodyPose;
    if(this.sim&&!this.clothDetached&&previous.armEnabled&&s.armEnabled&&["shoulderX","shoulderY","shoulderZ","shoulderPitch","shoulderYaw"].some(k=>previous.sleeve[k as keyof SleeveSettings]!==s.sleeve[k as keyof SleeveSettings])) {
      for(const buf of [this.sim.x,this.sim.p])for(let i=0;i<buf.length;i+=3){const p=armTransform(armTransform([buf[i],buf[i+1],buf[i+2]],previous.sleeve,true),s.sleeve);buf.set(p,i);}
      this.geometryDirty=true;this.invalidate();
    }
    if(this.sim&&!this.clothDetached&&previous.mannequin&&s.mannequin){const dx=s.legs.x-previous.legs.x,dy=s.legs.y-previous.legs.y,dz=s.legs.z-previous.legs.z;if(dx||dy||dz){for(const b of [this.sim.x,this.sim.p])for(let i=0;i<b.length;i+=3){b[i]+=dx;b[i+1]+=dy;b[i+2]+=dz;}this.geometryDirty=true;this.invalidate();}}
    this.invalidate();
    this.settings = s;
    if(s.paused){this.geometryDirty=true;this.bodyPose=structuredClone(s.body);if(this.sim&&this.build&&!this.clothDetached)followUpperPose(this.sim,this.build,s.legs,previousBodyPose,this.bodyPose);}
    this.renderer.shadowMap.needsUpdate=true;
    this.legPose=s.paused?structuredClone(s.legs):{...s.legs,left:this.legPose.left,right:this.legPose.right};
    if(this.sim&&this.build&&!this.clothDetached)followLegPose(this.sim,this.build,previousLegPose,this.legPose);
    const background=s.theme==="dark"?"#15191e":"#efe8dd";
    (this.scene.background as THREE.Color).set(background);
    if(this.scene.fog instanceof THREE.Fog)this.scene.fog.color.set(background);
    this.floorMat?.color.set(s.theme==="dark"?"#343c46":"#ffffff");
    if (this.sim) this.sim.params = this.simParams(s);
    if(previous.material!==s.material||previous.color!==s.color||previous.wireframe!==s.wireframe||!this.clothMat.version){
    const M = MATERIALS[s.material];
    let tex = this.textures.get(M.weave);
    if (!tex) { tex = weaveTexture(M.weave); this.textures.set(M.weave, tex); }
    tex.repeat.set(M.texScale, M.texScale);
    const m = this.clothMat;
    m.color.set(s.color);
    m.roughness = M.roughness;
    m.sheen = M.sheen;
    m.sheenRoughness = s.material === "silk" ? 0.55 : 0.8;
    m.sheenColor.set(s.color).lerp(new THREE.Color("#ffffff"), 0.55);
    m.bumpMap = s.material === "silk" ? null : tex;
    m.bumpScale = M.bump * 0.004;
    m.specularIntensity = s.material === "silk" ? 0.55 : 0.35;
    m.wireframe = s.wireframe;
    if(previous.material!==s.material||previous.wireframe!==s.wireframe||!m.version)m.needsUpdate = true;
    }
    this.sphereMesh.visible = s.sphere.on;
    this.sphereMesh.position.set(s.sphere.x, s.sphere.y, s.sphere.z);
    this.sphereMesh.scale.setScalar(s.sphere.size);
    this.boxMesh.visible = s.box.on;
    this.boxMesh.rotation.set(...(s.box.rotation??[0,0,0]));this.sphereMesh.rotation.set(...(s.sphere.rotation??[0,0,0]));
    this.rotationTool?.sync();
    this.boxMesh.position.set(s.box.x, s.box.y, s.box.z);
    this.boxMesh.scale.set(s.box.width??s.box.size,s.box.height??s.box.size,s.box.depth??s.box.size);
    (this.sphereMesh.material as THREE.MeshPhysicalMaterial).emissive.set(s.selected==="sphere"?"#654120":"#000000");
    (this.boxMesh.material as THREE.MeshPhysicalMaterial).emissive.set(s.selected==="box"?"#654120":"#000000");
    this.updateWind();this.updateArm();this.updateLegs();this.updateBody();
    if(this.sim&&((previous.legs.x!==s.legs.x||previous.legs.y!==s.legs.y||previous.legs.z!==s.legs.z)||previous.sleeve.shoulderX!==s.sleeve.shoulderX||previous.sleeve.shoulderY!==s.sleeve.shoulderY||previous.sleeve.shoulderZ!==s.sleeve.shoulderZ))this.sim.syncColliderHistory();
    const D=s.diffuse,L=s.directional;
    this.diffuseLight.color.set(D.color);this.diffuseLight.intensity=D.on?D.intensity*1.8:0;
    this.diffuseLight.position.set(D.x,D.y,D.z);
    this.diffuseLight.groundColor.set(D.color).multiplyScalar(.32);
    this.scene.environmentIntensity=D.on?Math.sqrt(D.intensity)*.6:0;
    this.directionalLight.color.set(L.color);this.directionalLight.intensity=L.on?L.intensity:0;
    this.directionalLight.position.set(L.x,L.y,L.z);
    this.renderer.shadowMap.enabled=L.on&&L.intensity>0;
    for(const id of ["diffuse","directional"] as const){const v=s[id],h=this.lightHandles[id];h.position.set(v.x,v.y,v.z);h.visible=s.selected===id;}
    this.lightAim.visible=s.selected==="directional";
    this.lightAim.position.copy(this.directionalLight.position);
    this.lightAim.setDirection(new THREE.Vector3(0,1.2,0).sub(this.directionalLight.position).normalize());
  }

  load(build: ClothBuild, sourcePose?:{legs:LegsSettings;body:BodySettings}) {
    this.clothDetached=false;this.rotationTool?.setEnabled(false);
    this.editRevision++;
    this.sim?.endGrab();
    this.controls.enabled = true;
    if(this.build&&this.sim)preserveSkirtDrape(build,this.build,this.sim.x);
    this.build = build;
    this.dragId = null;
    this.objectDrag=null;
    this.armAngle=this.settings.sleeve.angle;this.legPose=structuredClone(this.settings.legs);this.bodyPose=structuredClone(this.settings.body);this.updateLegs();this.updateBody();
    this.updateArm();
    this.sim = new ClothSim(build, this.simParams(this.settings));
    if(sourcePose){followLegPose(this.sim,build,sourcePose.legs,this.legPose);followUpperPose(this.sim,build,this.settings.legs,sourcePose.body,this.bodyPose);}

    updateLegGuides(this.sim,build,this.legPose,this.settings.legsEnabled);
    updateUpperGuides(this.sim,build,this.settings.legs,this.bodyPose);
    {const r=this.settings.legs;this.sim.waist?.setPose(r.x,r.y,r.z,this.settings.body.on?this.bodyPose.torsoPitch:0,this.settings.body.on?this.bodyPose.torsoLean:0);}
    if (this.mesh) { this.scene.remove(this.mesh); this.geom?.dispose(); }
    const g = new THREE.BufferGeometry();
    const rc = build.map.length;
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(rc * 3), 3));
    g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(rc * 3), 3));
    g.setAttribute("uv", new THREE.BufferAttribute(build.uv, 2));
    g.setIndex(new THREE.BufferAttribute(build.index, 1));
    this.geom = g;
    this.mesh = new THREE.Mesh(g, this.clothMat);
    this.mesh.castShadow = this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
    this.acc = 0;
    this.rebuildPinGroups();
    this.syncGeometry();
  }

  refreshPinText(){this.pinLabels.forEach((el,i)=>{el.title=translate(`ОПОРА ${i+1} · ДВОЙНОЕ НАЖАТИЕ: УДАЛИТЬ`);el.setAttribute("aria-label",translate(`Опора ${i+1}`));});}

  get counts() {
    return { particles: this.sim?.n ?? 0, constraints: this.sim?.m ?? 0 };
  }

  syncGeometry() {
    if (!this.sim || !this.geom || !this.build) return;
    const pos = this.geom.attributes.position.array as Float32Array;
    const nor = this.geom.attributes.normal.array as Float32Array;
    const { x } = this.sim;
    this.sim.computeNormals(true);
    const nr = this.sim.nrm;
    const map = this.build.map;
    for (let r = 0; r < map.length; r++) {
      const o = map[r] * 3, t = r * 3;
      pos[t] = x[o]; pos[t + 1] = x[o + 1]; pos[t + 2] = x[o + 2];
      nor[t] = nr[o]; nor[t + 1] = nr[o + 1]; nor[t + 2] = nr[o + 2];
    }
    this.renderer.shadowMap.needsUpdate=true;
    this.geom.attributes.position.needsUpdate = true;
    this.geom.attributes.normal.needsUpdate = true;
    const count=this.pinGroups.length+(this.sim.grab>=0?1:0);
    let attribute=this.pins.geometry.getAttribute("position") as THREE.BufferAttribute|undefined;
    if(!attribute||attribute.count<count){attribute=new THREE.BufferAttribute(new Float32Array(Math.max(8,count)*3),3);attribute.setUsage(THREE.DynamicDrawUsage);this.pins.geometry.dispose();this.pins.geometry=new THREE.BufferGeometry();this.pins.geometry.setAttribute("position",attribute);}
    const points=attribute.array as Float32Array;
    let cursor=0;
    for(const group of this.pinGroups){let a=0,b=0,c=0;for(const i of group){a+=x[i*3];b+=x[i*3+1];c+=x[i*3+2];}points[cursor++]=a/group.length;points[cursor++]=b/group.length;points[cursor++]=c/group.length;}
    if(this.sim.grab>=0){const o=this.sim.grab*3;points[cursor++]=x[o];points[cursor++]=x[o+1];points[cursor++]=x[o+2];}
    attribute.needsUpdate=true;this.pins.geometry.setDrawRange(0,count);
    this.geometryDirty=false;this.invalidate();
  }

  invalidate() {
    this.renderDirty=true;
    if(!this.disposed&&!this.contextLost&&!document.hidden&&!this.raf)this.raf=requestAnimationFrame(this.loop);
  }
  private visibilityChanged=()=>{
    if(document.hidden){cancelAnimationFrame(this.raf);this.raf=0;}
    else {this.last=0;this.lastSimFrame=0;this.acc=0;this.invalidate();}
  };
  loop = (t:number) => this.tick(t);
  tick(t:number) {
    this.raf=0;
    if(this.disposed||this.contextLost||document.hidden)return;
    const started=performance.now(),now=t/1000;
    const stepDt=1/this.pacer.fps;
    const fd=this.last?Math.min(now-this.last,.1):stepDt;this.last=now;
    let stepped=false;
    if(!this.settings.paused&&this.sim){
      this.acc+=fd;
      // No catch-up burst: keep the UI responsive when a device misses its budget.
      if(this.acc+1e-6>=stepDt){this.advance(stepDt);stepped=true;this.acc=Math.max(0,Math.min(this.acc-stepDt,stepDt*.5));}
      if(now-this.lastHealthCheck>=1){this.lastHealthCheck=now;if(this.sim.hasNaN()&&this.build)this.load(this.build);}
    } else {this.acc=0;this.lastSimFrame=0;}
    if(this.geometryDirty)this.syncGeometry();
    if(this.renderDirty&&now-this.lastDraw>=1/60-1e-6){
      this.lastDraw=now;
      this.renderFrame();this.renderDirty=false;this.frames++;
      const cost=performance.now()-started;
      this.frameCost=this.frameCost*.9+cost*.1;
      if(stepped){this.pacer.observe(cost,this.lastSimFrame?(now-this.lastSimFrame)*1000:stepDt*1000);this.lastSimFrame=now;}
      if(this.frameCost>28||(!this.settings.paused&&fd>.04))this.slowFrames++;else this.slowFrames=0;
      // Lower raster resolution only, without changing cloth topology or resetting it.
      if(this.slowFrames>=30&&this.pixelRatio>.75){this.pixelRatio=Math.max(.75,this.pixelRatio-.25);this.renderer.setPixelRatio(this.pixelRatio);this.slowFrames=0;this.invalidate();}
    }
    if(now-this.fpsT>=1){this.onFps(this.fpsT?this.frames/(now-this.fpsT):0);this.frames=0;this.fpsT=now;}
    if((!this.settings.paused||this.renderDirty)&&!this.raf)this.raf=requestAnimationFrame(this.loop);
    else if(this.settings.paused&&!this.renderDirty&&this.raf){cancelAnimationFrame(this.raf);this.raf=0;}
  };
  lastHealthCheck=0;

  advance(dt=DT) {
    // Bound motion of the kinematic elbow so the sleeve can follow its collider.
    const d=this.settings.sleeve.angle-this.armAngle;
    if(this.settings.armEnabled&&Math.abs(d)>.00001){this.armAngle+=Math.max(-90*dt,Math.min(90*dt,d));this.updateArm();}
    if(this.settings.legsEnabled&&(["left","right"] as const).some(side=>(["hip","knee","spread"] as const).some(key=>Math.abs(this.settings.legs[side][key]-this.legPose[side][key])>1e-5))){const before=structuredClone(this.legPose);let changed=false;for(const side of ["left","right"] as const)for(const key of ["hip","knee","spread"] as const){const delta=this.settings.legs[side][key]-this.legPose[side][key];if(Math.abs(delta)>1e-5){this.legPose[side][key]+=Math.max(-90*dt,Math.min(90*dt,delta));changed=true;}}if(changed){if(this.sim&&this.build&&!this.clothDetached)followLegPose(this.sim,this.build,before,this.legPose);this.updateLegs();}}
    if(this.settings.body.on&&((["torsoPitch","torsoLean","headPitch","headLean"] as const).some(key=>Math.abs(this.settings.body[key]-this.bodyPose[key])>1e-5)||(["left","right"] as const).some(side=>(["raise","forward","elbow"] as const).some(key=>Math.abs(this.settings.body[side][key]-this.bodyPose[side][key])>1e-5)))){const before=structuredClone(this.bodyPose);let changed=false;for(const key of ["torsoPitch","torsoLean","headPitch","headLean"] as const){const delta=this.settings.body[key]-this.bodyPose[key];if(Math.abs(delta)>1e-5){this.bodyPose[key]+=Math.max(-60*dt,Math.min(60*dt,delta));changed=true;}}for(const side of ["left","right"] as const)for(const key of ["raise","forward","elbow"] as const){const delta=this.settings.body[side][key]-this.bodyPose[side][key];if(Math.abs(delta)>1e-5){this.bodyPose[side][key]+=Math.max(-90*dt,Math.min(90*dt,delta));changed=true;}}if(changed){if(this.sim&&this.build&&!this.clothDetached)followUpperPose(this.sim,this.build,this.settings.legs,before,this.bodyPose);this.updateBody();}}
    if(this.rotationTool?.dragging)return;
    this.sim?.step(dt);this.geometryDirty=true;this.invalidate();
  }
  stepOnce() { this.advance(); this.editRevision++; }
  releasePins() {
    this.geometryDirty=true;this.invalidate();this.sim?.releasePins();this.rebuildPinGroups();this.editRevision++;
  }
  resetCamera() {
    if(this.settings.mannequin){const r=this.settings.legs;this.camera.position.set(r.x+2.8,r.y+1.5,r.z+6.5);this.controls.target.set(r.x,r.y+.10,r.z);this.controls.update();return;}
    this.camera.position.copy(CAM_POS);
    this.controls.target.copy(CAM_TARGET);
    this.controls.update();
  }
  snapshot() {
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `skladka-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
    a.click();
  }

  private setNdc(e: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
  }

  private pick(e: PointerEvent): { i: number; p: THREE.Vector3 } | null {
    if (!this.mesh || !this.sim || !this.build || !this.geom) return null;
    this.setNdc(e);
    this.geom.computeBoundingSphere();
    const hit = this.ray.intersectObject(this.mesh, false)[0];
    if (!hit || !hit.face) return null;
    const x = this.sim.x;
    let best = -1, bd = Infinity;
    for (const r of [hit.face.a, hit.face.b, hit.face.c]) {
      const i = this.build.map[r];
      const d = hit.point.distanceToSquared(new THREE.Vector3(x[i * 3], x[i * 3 + 1], x[i * 3 + 2]));
      if (d < bd) { bd = d; best = i; }
    }
    return { i: best, p: hit.point };
  }

  rebuildPinGroups() {
    this.pinGroups=[];this.selectedPin=-1;
    if(!this.sim)return;const sim=this.sim,seen=new Set<number>();
    for(let i=0;i<sim.n;i++)if(sim.baseW[i]===0&&!sim.locked[i]&&!seen.has(i)){
      const group=[i];seen.add(i);for(let j=0;j<group.length;j++)for(const k of sim.neighbours[group[j]])if(sim.baseW[k]===0&&!sim.locked[k]&&!seen.has(k)){seen.add(k);group.push(k);}
      this.pinGroups.push(group);
    }
  }
  renderFrame() {
    // Rendering refreshes camera.matrixWorldInverse before projecting the overlay.
    // Both WebGL and labels now use exactly the same camera for this frame.
    this.renderer.render(this.scene,this.camera);
    this.updatePinLabels();
    if(this.firstFrame){this.firstFrame=false;window.dispatchEvent(new Event("cloth-ready"));}
  }
  updatePinLabels() {
    while(this.pinLabels.length>this.pinGroups.length)this.pinLabels.pop()!.remove();
    while(this.pinLabels.length<this.pinGroups.length){const i=this.pinLabels.length,el=document.createElement("button");el.className="pin-number";el.textContent=String(i+1);el.title=translate(`ОПОРА ${i+1} · ДВОЙНОЕ НАЖАТИЕ: УДАЛИТЬ`);el.setAttribute("aria-label",translate(`Опора ${i+1}`));el.style.pointerEvents="none";this.labelLayer.appendChild(el);this.pinLabels.push(el);}
    const positions=this.pins.geometry.getAttribute("position");
    if(!positions)return;
    const w=this.viewportWidth,h=this.viewportHeight,p=this.labelPoint;
    for(let i=0;i<this.pinGroups.length;i++){
      // syncGeometry already calculated the anchor centers for the visible markers.
      p.fromBufferAttribute(positions,i).project(this.camera);
      const el=this.pinLabels[i],display=p.z>=-1&&p.z<=1?"block":"none";
      if(el.style.display!==display)el.style.display=display;
      if(display==="block"){
        const transform=`translate3d(${(p.x+1)*w/2}px,${(1-p.y)*h/2}px,0) translate(-50%,-50%)`;
        if(el.style.transform!==transform)el.style.transform=transform;
      }
      const active=String(this.selectedPin===i);if(el.dataset.active!==active)el.dataset.active=active;
    }
  }
  pinCenter(group:number[]) {const c=new THREE.Vector3();if(!this.sim)return c;const x=this.sim.x;for(const i of group){c.x+=x[i*3];c.y+=x[i*3+1];c.z+=x[i*3+2];}return c.multiplyScalar(1/group.length);}
  pickPin(e:PointerEvent) {this.camera.updateMatrixWorld();const r=this.renderer.domElement.getBoundingClientRect();let best=-1,dist=e.pointerType==="touch"?38:28;
    this.pinGroups.forEach((g,i)=>{const v=this.pinCenter(g).project(this.camera);if(v.z < -1||v.z>1)return;const d=Math.hypot((v.x+1)*r.width/2+r.left-e.clientX,(1-v.y)*r.height/2+r.top-e.clientY);if(d<dist){best=i;dist=d;}});return best;}
  removePin(index=this.selectedPin) {if(!this.sim||index<0||!this.pinGroups[index])return;this.geometryDirty=true;this.invalidate();for(const i of this.pinGroups[index])this.sim.baseW[i]=this.sim.w[i]=1;this.rebuildPinGroups();this.editRevision++;}
  captureRuntime() {if(!this.sim)return null;return {clothDetached:this.clothDetached,waistEnabled:this.sim.waist?.enabled??false,x:this.sim.x.slice(),p:this.sim.p.slice(),baseW:this.sim.baseW.slice(),time:this.sim.time,lastH:this.sim.lastH,armAngle:this.armAngle,legPose:structuredClone(this.legPose),bodyPose:structuredClone(this.bodyPose),camera:this.camera.position.toArray(),target:this.controls.target.toArray(),revision:this.editRevision,selectedPin:this.selectedPin};}
  restoreRuntime(v:NonNullable<ReturnType<ClothEngine["captureRuntime"]>>) {
    if(!this.sim||v.x.length!==this.sim.x.length)return;
    if(this.sim.waist)this.sim.waist.enabled=v.waistEnabled;
    this.clothDetached=false;if(v.clothDetached)this.detachClothFromBody();
    this.sim.endGrab();this.sim.x.set(v.x);this.sim.p.set(v.p);this.sim.baseW.set(v.baseW);this.sim.w.set(v.baseW);this.sim.time=v.time;this.sim.lastH=v.lastH;
    this.armAngle=v.armAngle;this.legPose=structuredClone(v.legPose);this.bodyPose=structuredClone(v.bodyPose);this.updateLegs();this.updateBody();this.editRevision=v.revision;this.updateArm();this.sim.syncColliderHistory();
    this.camera.position.fromArray(v.camera);this.controls.target.fromArray(v.target);this.controls.update();this.rebuildPinGroups();this.selectedPin=v.selectedPin;this.syncGeometry();
  }

  private onDown = (e:PointerEvent) => this.pointerDown(e);
  pointerDown(e:PointerEvent) {
    if(this.rotationTool?.control.object)return;
    if(e.button!==0 || e.shiftKey || e.ctrlKey || e.metaKey || !this.sim || this.dragId!==null)return;
    this.setNdc(e);
    const pg=this.pickPin(e);
    if(pg>=0&&(this.settings.selected==="cloth"||this.settings.selected==="pins")){
      const tap=this.lastPinTap,id=this.pinGroups[pg][0];
      if(tap.id===id&&e.timeStamp-tap.time<350&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)<24){this.removePin(pg);this.lastPinTap.id=-1;e.preventDefault();e.stopImmediatePropagation();this.onChange({});return;}
      this.pinPress={id,time:e.timeStamp,x:e.clientX,y:e.clientY,moved:false};
    }

    if(pg>=0 && (this.settings.selected==="cloth"||this.settings.selected==="pins")) {
      this.selectedPin=pg;this.pinDrag=this.pinGroups[pg];this.pinStart=this.pinDrag.flatMap(i=>Array.from(this.sim!.x.slice(i*3,i*3+3)));
      this.pinOrigin.copy(this.pinCenter(this.pinDrag));this.plane.setFromNormalAndCoplanarPoint(this.camera.getWorldDirection(new THREE.Vector3()),this.pinOrigin);
      this.ray.ray.intersectPlane(this.plane,this.offset);this.offset.sub(this.pinOrigin);
      this.change({selected:"pins"});this.objectDrag="pins";this.beginDrag(e);return;
    }
    if(this.settings.selected==="wind"&&this.settings.windEnabled) {
      const hit=this.ray.intersectObjects(this.windAxes.map(a=>a.hit),false)[0];
      if(hit){const axis=this.windAxes.find(a=>a.hit===hit.object)!;this.pointWind(axis.direction);e.stopImmediatePropagation();e.preventDefault();return;}
    }
    const candidates: THREE.Object3D[]=[];
    for(const id of ["diffuse","directional"] as const)if(this.lightHandles[id].visible)candidates.push(this.lightHandles[id]);
    if(this.settings.sphere.on)candidates.push(this.sphereMesh);
    if(this.settings.box.on)candidates.push(this.boxMesh);
    if(this.pelvisGroup.visible)candidates.push(this.hipHandle,this.bodyShapes[0]);
    if(this.settings.legsEnabled)candidates.push(...this.footHandles,...this.legMeshes,...this.legDetails);
    if(this.settings.body.on&&this.settings.mannequin){candidates.push(...this.poseHandles,...this.bodyShapes.slice(1));if(this.settings.body.arms)candidates.push(...this.handHandles,...this.bodyArmMeshes,...this.bodyDetails);}
    if(this.settings.armEnabled)candidates.push(this.shoulder,this.wrist,...this.armSegments,this.elbow,this.soloHand);
    this.ray.params.Line.threshold=.07;
    const hits=this.ray.intersectObjects(candidates.filter(o=>{for(let p:THREE.Object3D|null=o;p;p=p.parent)if(!p.visible)return false;return true;}),false);
    const hit=hits[0];
    let kind: Selection|null=null;
    if(hit)kind=hit.object.userData.selection??(this.bodyShapes.slice(1).includes(hit.object as THREE.Mesh)?"torso":(hit.object===this.handHandles[0]||this.bodyArmMeshes.slice(0,2).includes(hit.object as THREE.Mesh))?"leftBodyArm":(hit.object===this.handHandles[1]||this.bodyArmMeshes.slice(2,4).includes(hit.object as THREE.Mesh))?"rightBodyArm":(hit.object===this.hipHandle||hit.object===this.bodyShapes[0])?"legs":(hit.object===this.footHandles[0]||this.legMeshes.slice(0,2).includes(hit.object as THREE.Mesh))?"leftLeg":(hit.object===this.footHandles[1]||this.legMeshes.slice(2,4).includes(hit.object as THREE.Mesh))?"rightLeg":hit.object===this.shoulder?"shoulder":hit.object===this.lightHandles.diffuse?"diffuse":hit.object===this.lightHandles.directional?"directional":hit.object===this.sphereMesh?"sphere":hit.object===this.boxMesh?"box":(hit.object===this.wrist||hit.object===this.elbow||this.armSegments.includes(hit.object as THREE.Mesh))?"arm":"wind");
    const cloth=this.pick(e);
    // Explicit object selection also lets the user reach a collider underneath cloth.
    const explicit=kind===this.settings.selected || kind==="wind" || kind==="arm" || kind==="shoulder" || kind==="legs" || kind==="leftLeg" || kind==="rightLeg" || kind==="torso" || kind==="head" || kind==="leftBodyArm" || kind==="rightBodyArm";
    if(kind && (explicit || !cloth || hit.distance<this.camera.position.distanceTo(cloth.p))) {
      this.change({selected:kind});this.objectDrag=kind;
      if(kind==="wind"){e.stopImmediatePropagation();return;}
      let origin:THREE.Vector3;
      if(kind==="sphere"||kind==="box") origin=(kind==="sphere"?this.sphereMesh:this.boxMesh).position.clone();
      else if(kind==="legs")origin=this.hipHandle.getWorldPosition(new THREE.Vector3());
      else if(kind==="torso"||kind==="head")origin=this.poseHandles[kind==="head"?1:0].position.clone();
      else if(kind==="leftBodyArm"||kind==="rightBodyArm")origin=this.handHandles[kind==="leftBodyArm"?0:1].position.clone();
      else if(kind==="leftLeg"||kind==="rightLeg")origin=this.footHandles[kind==="leftLeg"?0:1].position.clone();
      else origin=(kind==="diffuse"||kind==="directional")?this.lightHandles[kind].position.clone():kind==="shoulder"?this.shoulder.position.clone():this.wrist.position.clone();
      const normal=kind==="arm"?new THREE.Vector3(Math.sin((this.settings.sleeve.shoulderYaw??0)*Math.PI/180),0,Math.cos((this.settings.sleeve.shoulderYaw??0)*Math.PI/180)):this.settings.dragPlane==="floor"?new THREE.Vector3(0,1,0):this.camera.getWorldDirection(new THREE.Vector3());
      this.plane.setFromNormalAndCoplanarPoint(normal,origin);
      const point=new THREE.Vector3();this.ray.ray.intersectPlane(this.plane,point);this.offset.copy(origin).sub(point);
    } else if(cloth) {
      if(this.sim.locked[cloth.i])return;
      if(this.settings.selected==="pins") {this.sim.baseW[cloth.i]=this.sim.w[cloth.i]=0;this.rebuildPinGroups();this.geometryDirty=true;this.invalidate();this.editRevision++;e.stopImmediatePropagation();return;}
      this.change({selected:"cloth"});this.objectDrag=null;
      const o=cloth.i*3, x=this.sim.x,pt=new THREE.Vector3(x[o],x[o+1],x[o+2]);
      this.plane.setFromNormalAndCoplanarPoint(this.camera.getWorldDirection(new THREE.Vector3()),pt);
      this.sim.startGrab(cloth.i,pt.x,pt.y,pt.z);
    } else return;
    this.beginDrag(e);
  };

  private beginDrag(e:PointerEvent) {
    e.stopImmediatePropagation();e.preventDefault();
    this.controls.enabled=false;this.dragId=e.pointerId;
    this.renderer.domElement.setPointerCapture(e.pointerId);this.renderer.domElement.style.cursor="grabbing";
  };

  private onMove = (e:PointerEvent) => this.pointerMove(e);
  pointerMove(e:PointerEvent) {
    if(this.dragId!==e.pointerId || !this.sim)return;
    if(this.objectDrag==="wind"){
      const start=this.pointerStart;
      this.change({windAngle:(((start.angle+(e.clientX-start.x)*.6+180)%360+360)%360)-180,windElevation:THREE.MathUtils.clamp(start.elevation-(e.clientY-start.y)*.5,-85,85)});this.editRevision++;return;
    }
    if(this.pinPress&&Math.hypot(e.clientX-this.pinPress.x,e.clientY-this.pinPress.y)>8)this.pinPress.moved=true;
    this.geometryDirty=true;this.invalidate();
    this.setNdc(e);const out=new THREE.Vector3();if(!this.ray.ray.intersectPlane(this.plane,out))return;
    const kind=this.objectDrag;
    if(kind==="pins"&&this.pinDrag){const delta=out.clone().sub(this.offset).sub(this.pinOrigin);this.pinDrag.forEach((i,k)=>{for(let axis=0;axis<3;axis++){const v=this.pinStart[k*3+axis]+delta.getComponent(axis);this.sim!.x[i*3+axis]=this.sim!.p[i*3+axis]=v;}});this.editRevision++;return;}
    this.editRevision++;
    if(!kind){this.sim.moveGrab(out.x,out.y,out.z);return;}
    out.add(this.offset);
    if(kind==="sphere"||kind==="box"){
      const c=this.settings[kind],floor=kind==="sphere"?c.size:(c.height??c.size)/2;
      const next={...c,x:THREE.MathUtils.clamp(out.x,-3,3),y:THREE.MathUtils.clamp(out.y,floor,3.5),z:THREE.MathUtils.clamp(out.z,-3,3)};
      this.change(kind==="sphere"?{sphere:next}:{box:next});
    }else if(kind==="diffuse"||kind==="directional"){
      this.change({[kind]:{...this.settings[kind],x:THREE.MathUtils.clamp(out.x,-5,5),y:THREE.MathUtils.clamp(out.y,.2,6),z:THREE.MathUtils.clamp(out.z,-5,5)}});
    }else if(kind==="torso"||kind==="head"){
      const r=this.settings.legs,b=this.settings.body,head=kind==="head",local=head?upperTransform(out.toArray(),r,b,true):out.toArray(),dy=local[1]-r.y-(head?1.03:0),dx=local[0]-r.x,dz=local[2]-r.z-.26;
      const pitch=THREE.MathUtils.clamp(Math.atan2(dz,Math.max(.1,dy))*180/Math.PI,-45,55),lean=THREE.MathUtils.clamp(Math.atan2(dx,Math.max(.1,dy))*180/Math.PI,-35,35);
      this.change({body:{...b,...(head?{headPitch:pitch,headLean:lean}:{torsoPitch:pitch,torsoLean:lean})}});
    }else if(kind==="legs"){
      this.change({legs:{...this.settings.legs,x:out.x,y:Math.max(.4,out.y-.12),z:out.z-.30}});
    }else if(kind==="leftBodyArm"||kind==="rightBodyArm"){
      const side=kind==="leftBodyArm"?"left":"right",s=this.settings.body,a=bodyArmPoints(this.settings.legs,{...s,torsoPitch:0,torsoLean:0},side)[0],sign=side==="left"?-1:1;
      const target=upperTransform(out.toArray(),this.settings.legs,s,true),dx=target[0]-a[0],dy=target[1]-a[1],dz=target[2]-a[2],reach=Math.min(UPPER_ARM+FOREARM,Math.hypot(dx,dy,dz));
      const elbow=Math.acos(THREE.MathUtils.clamp((reach*reach-UPPER_ARM*UPPER_ARM-FOREARM*FOREARM)/(2*UPPER_ARM*FOREARM),-1,1))*180/Math.PI;
      const pose={raise:THREE.MathUtils.clamp(Math.atan2(sign*dx,Math.hypot(dy,dz))*180/Math.PI,0,100),forward:THREE.MathUtils.clamp(Math.atan2(dz,-dy)*180/Math.PI-elbow*.45,-80,120),elbow:Math.min(140,elbow)};
      this.change({body:{...s,[side]:pose,...(s.linked?{left:pose,right:{...pose}}:{})}});
    }else if(kind==="leftLeg"||kind==="rightLeg"){
      const side=kind==="leftLeg"?"left":"right",s=this.settings.legs,a=legPoints(s,side)[0],dy=out.y-a[1],dz=out.z-a[2];
      const reach=Math.min(LEG_SEGMENT*2,Math.hypot(dy,dz)),knee=2*Math.acos(reach/(2*LEG_SEGMENT))*180/Math.PI;
      const pose={...s[side],spread:THREE.MathUtils.clamp((side==="left"?-1:1)*Math.asin(THREE.MathUtils.clamp((out.x-a[0])/(2*LEG_SEGMENT),-1,1))*180/Math.PI,0,35),knee:Math.min(135,knee),hip:THREE.MathUtils.clamp(Math.atan2(dz,-dy)*180/Math.PI+knee/2,-70,100)};
      this.change({legs:{...s,[side]:pose,...(s.linked?{left:pose,right:{...pose}}:{})}});
    }else if(kind==="shoulder"){
      this.change({sleeve:{...this.settings.sleeve,shoulderX:THREE.MathUtils.clamp(out.x,-3,3),shoulderY:THREE.MathUtils.clamp(out.y,.5,3.5),shoulderZ:THREE.MathUtils.clamp(out.z,-3,3)}});
    }else if(kind==="arm"){
      const local=armTransform(out.toArray(),this.settings.sleeve,true);
      const angle=THREE.MathUtils.clamp(Math.atan2(local[1]-1.65,local[0])*180/Math.PI,-65,140);
      this.change({sleeve:{...this.settings.sleeve,angle}});
    }
  };

  private onUp = (e:PointerEvent) => this.pointerUp(e);
  pointerUp(e:PointerEvent) {
    if(this.dragId!==e.pointerId)return;
    if(this.pinPress&&!this.pinPress.moved&&e.timeStamp-this.pinPress.time<300)this.lastPinTap={id:this.pinPress.id,time:e.timeStamp,x:e.clientX,y:e.clientY};else this.lastPinTap.id=-1;this.pinPress=null;
    this.dragId=null;this.objectDrag=null;this.pinDrag=null;this.controls.enabled=true;this.sim?.endGrab();
    if(this.renderer.domElement.hasPointerCapture(e.pointerId))this.renderer.domElement.releasePointerCapture(e.pointerId);
    this.renderer.domElement.style.cursor="default";
  };

  private contextLostHandler=(event:Event)=>{
    event.preventDefault();this.contextLost=true;cancelAnimationFrame(this.raf);this.raf=0;
    window.dispatchEvent(new CustomEvent("cloth-failed",{detail:"СОЕДИНЕНИЕ С ГРАФИКОЙ ПРЕРВАНО"}));
  };
  private contextRestoredHandler=()=>{
    this.contextLost=false;this.firstFrame=true;this.last=0;this.acc=0;
    this.geometryDirty=true;this.renderer.shadowMap.needsUpdate=true;this.invalidate();
  };
  dispose() {
    cancelAnimationFrame(this.raf);
    this.disposed=true;document.removeEventListener("visibilitychange",this.visibilityChanged);
    this.ro.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener("webglcontextlost",this.contextLostHandler);
    el.removeEventListener("webglcontextrestored",this.contextRestoredHandler);
    el.removeEventListener("pointerdown", this.onDown, { capture: true });
    el.removeEventListener("pointermove", this.onMove);
    el.removeEventListener("pointerup", this.onUp);
    el.removeEventListener("pointercancel", this.onUp);
    el.removeEventListener("lostpointercapture", this.onUp);
    el.removeEventListener("contextmenu", this.prevent);
    this.rotationTool?.dispose();this.rotationTool=undefined;
    this.controls.dispose();
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>(this.textures.values());
    this.scene.traverse(object=>{const o=object as THREE.Mesh; if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});
    for(const m of materials){for(const v of Object.values(m))if(v instanceof THREE.Texture)textures.add(v);m.dispose();}
    for(const g of geometries)g.dispose();for(const texture of textures)texture.dispose();
    this.textures.clear();this.environmentTarget?.dispose();this.environmentTarget=null;
    this.directionalLight.shadow.map?.dispose();this.scene.clear();this.renderer.dispose();this.renderer.forceContextLoss();
    this.sim=null;this.build=null;this.mesh=null;this.geom=null;this.pinGroups=[];this.pinLabels=[];
    el.remove();this.labelLayer.remove();
  }
}


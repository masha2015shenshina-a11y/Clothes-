import * as T from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { ClothSim, type SimParams } from './solver';
import { GarmentContacts } from './layers';
import { FramePacer } from './pacing';
import { DEFAULT_SHEET, type SheetSettings, type PinMode, MATERIALS, DEFAULT_LEGS, DEFAULT_SKIRT, DEFAULT_SLEEVE, legPoints, LEG_RADIUS, type MaterialId, type PresetId, type ClothBuild, type LegsSettings } from './presets';
import { DEFAULT_BODY, bodyEllipsoids, bodyArmPoints, upperTransform, type BodySettings, type Side } from './mannequin';
import { mannequinGeometries, limbGeometry } from './mannequinGeometry';
export type Part = 'root' | 'torso' | 'head' | 'leftArm' | 'rightArm' | 'leftElbow' | 'rightElbow' | 'leftLeg' | 'rightLeg' | 'leftKnee' | 'rightKnee';
export const PARTS: Record<Part, string> = { root: 'Весь манекен', torso: 'Туловище', head: 'Голова', leftArm: 'Левое плечо', rightArm: 'Правое плечо', leftElbow: 'Левый локоть', rightElbow: 'Правый локоть', leftLeg: 'Левое бедро', rightLeg: 'Правое бедро', leftKnee: 'Левое колено', rightKnee: 'Правое колено' };
export interface ItemInfo {
    id: number;
    name: string;
    kind: 'cloth' | 'body' | 'box' | 'sphere';
    dimensions?: [number, number, number];
    drapeMode?: 'normal'|'exaggerated';
    material?: MaterialId;
    color?: string;
}
interface ClothItem extends ItemInfo {
    kind: 'cloth';
    sim: ClothSim;
    build: ClothBuild;
    mesh: T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>;
    anchor: T.Object3D;
    material: MaterialId;
    color: string;
}
interface BodyItem extends ItemInfo {
    kind: 'body';
    root: LegsSettings;
    body: BodySettings;
    orientation?:T.Quaternion;
    group: T.Group;
    meshes: T.Mesh[];
}
interface SolidItem extends ItemInfo { kind: 'box' | 'sphere'; mesh: T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>; dimensions: [number,number,number]; }
type Item = ClothItem | BodyItem | SolidItem;
const off = { on: false, x: 0, y: 0, z: 0, r: 1, s: 1 };
const rad = T.MathUtils.degToRad, deg = T.MathUtils.radToDeg;
export interface WorkspaceLighting {ambient:number;ambientColor:string;ambientOn:boolean;key:number;keyColor:string;keyOn:boolean;azimuth:number;elevation:number;}
export const DEFAULT_WORKSPACE_LIGHTING:WorkspaceLighting={ambient:2.5,ambientColor:'#fff8eb',ambientOn:true,key:3,keyColor:'#fff1df',keyOn:true,azimuth:37,elevation:50};
export class CompositionWorkspace {
    readonly ambientLight=new T.HemisphereLight('#fff8eb','#82786c',2.5);
    readonly keyLight=new T.DirectionalLight('#fff1df',3);
    setLighting(s:WorkspaceLighting){this.ambientLight.intensity=s.ambientOn?s.ambient:0;this.ambientLight.color.set(s.ambientColor);this.keyLight.intensity=s.keyOn?s.key:0;this.keyLight.color.set(s.keyColor);const a=rad(s.azimuth),e=rad(s.elevation);this.keyLight.position.set(6*Math.sin(a)*Math.cos(e),6*Math.sin(e),6*Math.cos(a)*Math.cos(e));this.invalidate();}
    private worldPoint(item:BodyItem,p:number[]){const r=item.root;return new T.Vector3(...p).sub(new T.Vector3(r.x,r.y,r.z)).applyQuaternion(item.orientation??new T.Quaternion()).add(new T.Vector3(r.x,r.y,r.z));}

    readonly renderer: T.WebGLRenderer;
    readonly scene = new T.Scene();
    readonly camera = new T.PerspectiveCamera(40, 1, .05, 80);
    readonly orbit: OrbitControls;
    readonly gizmo: TransformControls;
    private proxy = new T.Object3D();
    private lastMatrix = new T.Matrix4();
    private items: Item[] = [];
    private sequence = 0;
    selected = 0;
    part: Part = 'root';
    mode: 'translate' | 'rotate' = 'translate';
    paused = false;
    wind = 0;
    private raf = 0;
    private last = 0;
    private accumulator = 0;
    private disposed = false;
    private dragging = false;
    private dirty = true;
    private ro: ResizeObserver;
    private pacer = new FramePacer();
    private frameCount = 0;
    private fpsTime = 0;
    private ray = new T.Raycaster();
    private pointer = new T.Vector2();
    private down = [0, 0];
    private worker: Worker;
    private jobs = new Map<number, {
        resolve: (b: ClothBuild) => void;
        reject: (e: Error) => void;
    }>();
    private jobId = 0;
    private jobTimeouts = new Map<number, ReturnType<typeof setTimeout>>();
    private contacts: GarmentContacts | null = null;
    private contactState: {
        x: Float32Array;
        p: Float32Array;
        w: Float32Array;
        params: SimParams;
        upperGuides: null;
    } | null = null;
    private colliders: {
        capsules: NonNullable<SimParams['capsules']>;
        ellipsoids: NonNullable<SimParams['ellipsoids']>;
        boxes: NonNullable<SimParams['boxes']>;
    } = { capsules: [], ellipsoids: [], boxes: [] };
    constructor(private host: HTMLElement, private changed: (items: ItemInfo[], id: number, part: Part) => void, private fps: (n: number) => void) {
        this.renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setPixelRatio(Math.min(1.5, devicePixelRatio));
        this.renderer.setClearColor('#edeae3');
        this.renderer.outputColorSpace = T.SRGBColorSpace;
        this.host.appendChild(this.renderer.domElement);
        this.camera.position.set(5, 3.5, 7);
        this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
        this.orbit.target.set(0, 1.2, 0);
        this.orbit.update();
        this.orbit.addEventListener('change', this.invalidate);
        this.scene.add(this.ambientLight,this.keyLight);this.keyLight.position.set(3,6,4);
        const floor = new T.Mesh(new T.PlaneGeometry(40, 40), new T.MeshStandardMaterial({ color: '#ded9cf', roughness: 1 }));
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -.015;
        this.scene.add(floor, new T.GridHelper(16, 32, '#b8afa0', '#d1c9bb'));
        this.gizmo = new TransformControls(this.camera, this.renderer.domElement);
        this.gizmo.setSize(.85);
        this.scene.add(this.gizmo.getHelper(), this.proxy);
        this.gizmo.addEventListener('dragging-changed', e => { this.dragging = !!e.value; this.orbit.enabled = !this.dragging; if (!this.dragging) {
            this.attach();
            this.emit();
        } this.invalidate(); });
        this.gizmo.addEventListener('objectChange', () => this.transform());
        this.gizmo.addEventListener('change', this.invalidate);
        this.worker = new Worker(new URL('./build.worker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = e => { const j = this.jobs.get(e.data.id); if (!j)
            return; clearTimeout(this.jobTimeouts.get(e.data.id)); this.jobTimeouts.delete(e.data.id); this.jobs.delete(e.data.id); e.data.error ? j.reject(new Error(e.data.error)) : j.resolve(e.data.build); };
        this.worker.onerror = () => { for (const j of this.jobs.values())
            j.reject(new Error('Не удалось построить ткань')); this.jobs.clear(); for (const t of this.jobTimeouts.values())
            clearTimeout(t); this.jobTimeouts.clear(); };
        this.ro = new ResizeObserver(() => this.resize());
        this.ro.observe(host);
        this.resize();
        this.renderer.domElement.addEventListener('pointerdown', this.pointerDown);
        this.renderer.domElement.addEventListener('pointerup', this.pointerUp);
        document.addEventListener('visibilitychange', this.visibility);
        this.invalidate();
        window.dispatchEvent(new Event('cloth-ready'));
    }
    private emit() { this.changed(this.items.map(({ id, name, kind, ...item }) => ({ id, name, kind, ...(kind === 'cloth' ? { drapeMode: (item as ClothItem).sim.params.drapeMode??'normal', material: (item as ClothItem).material, color: (item as ClothItem).color } : kind==='box'||kind==='sphere'?{dimensions:[...(item as SolidItem).dimensions] as [number,number,number]}:{}) })), this.selected, this.part); }
    private params(material: MaterialId): SimParams { return { ...MATERIALS[material], stretch: 0, gravity: 9.81, windX: .3, windZ: 1, windStrength: this.wind, selfCollision: true, ...this.colliders, sphere: off, box: off }; }
    async addCloth(preset: PresetId, material: MaterialId, color: string, sheet:SheetSettings=DEFAULT_SHEET, pin:PinMode='two', drapeMode:'normal'|'exaggerated'='normal') {
        if (this.items.filter(i => i.kind === 'cloth').length >= 6)
            throw new Error('На столе можно разместить до 6 тканей.');
        const id = ++this.jobId;
        const build = await new Promise<ClothBuild>((resolve, reject) => { this.jobs.set(id, { resolve, reject }); this.jobTimeouts.set(id, setTimeout(() => { this.jobs.delete(id); this.jobTimeouts.delete(id); reject(new Error("Подготовка заняла слишком долго. Попробуйте снова.")); }, 15000)); this.worker.postMessage({ id, args: [preset, preset === 'tube' ? 'none' : preset==='two'?pin:'top', DEFAULT_SLEEVE, DEFAULT_SKIRT, DEFAULT_LEGS, DEFAULT_BODY, .6,sheet] }); });
        if (this.disposed)
            return;
        const total = this.items.reduce((n, i) => n + (i.kind === 'cloth' ? i.sim.n : 0), 0) + build.pinned.length;
        if (total > 7500)
            throw new Error('Достигнут бюджет сетки. Удалите одну из тканей.');
        const offset = this.items.filter(i => i.kind === 'cloth').length * .35;
        for (let o = 0; o < build.x.length; o += 3) {
            build.x[o] += offset;
            build.x[o + 2] += offset;
        }
        const sim = new ClothSim(build, {...this.params(material),drapeMode}), geometry = new T.BufferGeometry();
        geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(build.map.length * 3), 3).setUsage(T.DynamicDrawUsage));
        geometry.setAttribute('normal', new T.BufferAttribute(new Float32Array(build.map.length * 3), 3).setUsage(T.DynamicDrawUsage));
        geometry.setIndex(new T.BufferAttribute(build.index, 1));
        const mat = new T.MeshStandardMaterial({ color, side: T.DoubleSide, roughness: MATERIALS[material].roughness });
        const mesh = new T.Mesh(geometry, mat);
        mesh.frustumCulled = false;
        const item: ClothItem = { id: ++this.sequence, name: `Ткань ${this.sequence}`, kind: 'cloth', sim, build, mesh, anchor: new T.Object3D(), material, color };
        item.anchor.position.set(offset, 1.5, offset);
        mesh.userData.item = item.id;
        this.items.push(item);
        this.scene.add(mesh);
        this.syncCloth(item);
        this.rebuildContacts();
        this.select(item.id);
        this.invalidate();
    }
    addSolid(kind: 'box' | 'sphere') {
        if(this.items.filter(i=>i.kind==='box'||i.kind==='sphere').length>=8) throw new Error('До 8 объёмных объектов.');
        const mesh=new T.Mesh(kind==='box'?new T.BoxGeometry(1,1,1):new T.SphereGeometry(.5,24,16),new T.MeshStandardMaterial({color:'#938b7d',roughness:.7}));
        const id=++this.sequence;
        const item:SolidItem={id,name:`${kind==='box'?'Куб':'Шар'} ${id}`,kind,mesh,dimensions:[1,1,1]};
        mesh.position.set(0,.5,0);mesh.userData.item=id;
        this.items.push(item);this.scene.add(mesh);this.refreshColliders();this.select(id);this.invalidate();
    }
    setDimensions(values: [number,number,number]) {
        const item=this.items.find(i=>i.id===this.selected);
        if(!item||(item.kind!=='box'&&item.kind!=='sphere'))return;
        const d=values.map(v=>T.MathUtils.clamp(Number.isFinite(v)?v:1,.1,4)) as [number,number,number];
        item.dimensions=item.kind==='sphere'?[d[0],d[0],d[0]]:d;
        item.mesh.scale.fromArray(item.dimensions);
        this.refreshColliders();this.emit();this.invalidate();
    }
    addBody() {
        if (this.items.filter(i => i.kind === 'body').length >= 3)
            throw new Error('На столе можно разместить до 3 манекенов.');
        const root = structuredClone(DEFAULT_LEGS);
        root.x = this.items.filter(i => i.kind === 'body').length * 1.5;
        const body = { ...structuredClone(DEFAULT_BODY), on: true, tunic: false, cape: false, sleeves: false };
        const item: BodyItem = { id: ++this.sequence, name: `Манекен ${this.sequence}`, kind: 'body', root, body, group: new T.Group(), meshes: [] };
        const geometries = mannequinGeometries();
        const add = (g: T.BufferGeometry, part: Part) => { const mesh = new T.Mesh(g, new T.MeshStandardMaterial({ color: '#ddd2b9', roughness: .8 })); mesh.userData = { item: item.id, part }; item.meshes.push(mesh); item.group.add(mesh); };
        geometries.body.forEach((g, i) => add(g, i === 0 ? 'root' : i === 4 ? 'head' : 'torso'));
        for (const side of ['left', 'right'] as const) {
            add(limbGeometry(1, .115), `${side}Arm`);
            add(limbGeometry(1, .095, true), `${side}Elbow`);
            add(limbGeometry(1, .145), `${side}Leg`);
            add(limbGeometry(1, .12, true), `${side}Knee`);
        }
        for (const side of ['left', 'right'] as const) {
            add(geometries.hand.clone(), `${side}Elbow`);
            add(geometries.foot.clone(), `${side}Knee`);
        }
        geometries.joint.dispose();
        geometries.hand.dispose();
        geometries.foot.dispose();
        this.items.push(item);
        this.scene.add(item.group);
        this.updateBody(item);
        this.refreshColliders();
        this.select(item.id);
        this.invalidate();
    }
    private updateBody(item: BodyItem) {
        const E = bodyEllipsoids(item.root, true, item.body);
        for (let i = 0; i < 5; i++) {
            const e = E[i], mesh = item.meshes[i];
            mesh.position.set(e.x, e.y, e.z);
            mesh.scale.set(e.rx, e.ry, e.rz);
            mesh.quaternion.identity();
            if (e.basis) {
                mesh.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3(...e.basis.slice(0, 3)), new T.Vector3(...e.basis.slice(3, 6)), new T.Vector3(...e.basis.slice(6, 9))));
            }
        }
        const segment = (mesh: T.Mesh, a: number[], b: number[]) => { const A = new T.Vector3(...a), B = new T.Vector3(...b); mesh.position.copy(A).add(B).multiplyScalar(.5); mesh.scale.set(1, A.distanceTo(B), 1); mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), B.sub(A).normalize()); };
        for (let s = 0; s < 2; s++) {
            const side = s ? 'right' : 'left', arm = bodyArmPoints(item.root, item.body, side), leg = legPoints(item.root, side);
            segment(item.meshes[5 + s * 4], arm[0], arm[1]);
            segment(item.meshes[6 + s * 4], arm[1], arm[2]);
            segment(item.meshes[7 + s * 4], leg[0], leg[1]);
            segment(item.meshes[8 + s * 4], leg[1], leg[2]);
            const hand = item.meshes[13 + s * 2], foot = item.meshes[14 + s * 2], armDirection = new T.Vector3(...arm[2]).sub(new T.Vector3(...arm[1])).normalize();
            hand.position.fromArray(arm[2]).addScaledVector(armDirection, .12);
            hand.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), armDirection);
            foot.position.fromArray(leg[2]).add(new T.Vector3(0, -.07, .07));foot.quaternion.identity();
        }
        if(item.orientation)for(const mesh of item.meshes){mesh.position.copy(this.worldPoint(item,mesh.position.toArray()));mesh.quaternion.premultiply(item.orientation);}
    }
    private refreshColliders() {
        const capsules: NonNullable<SimParams['capsules']> = [], ellipsoids: NonNullable<SimParams['ellipsoids']> = [], boxes: NonNullable<SimParams['boxes']>=[];
        for (const i of this.items)
            if (i.kind === 'body') {
                ellipsoids.push(...bodyEllipsoids(i.root,true,i.body).map(e=>{const p=this.worldPoint(i,[e.x,e.y,e.z]),q=i.orientation??new T.Quaternion();const basis=e.basis??[1,0,0,0,1,0,0,0,1];return {...e,x:p.x,y:p.y,z:p.z,basis:[0,3,6].flatMap(k=>new T.Vector3(...basis.slice(k,k+3)).applyQuaternion(q).toArray())};}));
                for (const side of ['left', 'right'] as const) {
                    const a = bodyArmPoints(i.root, i.body, side).map(p=>this.worldPoint(i,p).toArray()), l = legPoints(i.root, side).map(p=>this.worldPoint(i,p).toArray());
                    capsules.push({ a: a[0], b: a[1], r: .105 }, { a: a[1], b: a[2], r: .09 }, { a: l[0], b: l[1], r: LEG_RADIUS }, { a: l[1], b: l[2], r: LEG_RADIUS });
                }
            }
        for(const i of this.items) {
            if(i.kind==='sphere'){const p=i.mesh.position,r=i.dimensions[0]/2;capsules.push({a:p.toArray(),b:p.toArray(),r});}
            if(i.kind==='box'){const p=i.mesh.position,q=i.mesh.quaternion;boxes.push({on:true,x:p.x,y:p.y,z:p.z,s:1,width:i.dimensions[0],height:i.dimensions[1],depth:i.dimensions[2],basis:[new T.Vector3(1,0,0),new T.Vector3(0,1,0),new T.Vector3(0,0,1)].flatMap(v=>v.applyQuaternion(q).toArray())});}
        }
        this.colliders = { capsules, ellipsoids, boxes };
        for (const i of this.items)
            if (i.kind === 'cloth')
                Object.assign(i.sim.params, this.colliders);
    }
    select(id: number, part: Part = 'root') { this.selected = id; this.part = part; this.attach(); this.emit(); this.invalidate(); }
    setMode(mode: 'translate' | 'rotate') { this.mode = mode; this.attach(); this.invalidate(); }
    private attach() {
        const item = this.items.find(i => i.id === this.selected);
        if (!item) {
            this.gizmo.detach();
            return;
        }
        this.proxy.rotation.set(0, 0, 0);
        this.gizmo.setSpace('world');
        this.gizmo.showX = this.gizmo.showY = this.gizmo.showZ = true;
        if (item.kind === 'cloth') {
            this.proxy.position.copy(item.anchor.position);
            this.proxy.quaternion.copy(item.anchor.quaternion);
            this.gizmo.setMode(this.mode);
        }
        else if(item.kind==='box'||item.kind==='sphere'){this.proxy.position.copy(item.mesh.position);this.proxy.quaternion.copy(item.mesh.quaternion);this.gizmo.setMode(item.kind==='sphere'?'translate':this.mode);}
        else if(item.kind==='body') {
            const r = item.root, b = item.body, part = this.part, side: Side = part.startsWith('left') ? 'left' : 'right';
            let position: number[] = [r.x, r.y, r.z];
            this.gizmo.setMode(part === 'root' ? this.mode : 'rotate');
            if (part === 'torso') {
                this.proxy.rotation.set(rad(b.torsoPitch), 0, rad(-b.torsoLean));
            }
            else if (part === 'head') {
                position = upperTransform([r.x, r.y + 1.03, r.z], r, b);
                this.proxy.rotation.set(rad(b.headPitch), 0, rad(-b.headLean));
            }
            else if (part.includes('Arm') || part.includes('Elbow')) {
                position = bodyArmPoints(r, b, side)[part.includes('Elbow') ? 1 : 0];
                this.proxy.rotation.set(rad(part.includes('Elbow') ? b[side].elbow : b[side].forward), 0, rad(b[side].raise));
            }
            else if (part.includes('Leg') || part.includes('Knee')) {
                position = legPoints(r, side)[part.includes('Knee') ? 1 : 0];
                this.proxy.rotation.set(rad(part.includes('Knee') ? r[side].knee : r[side].hip), 0, rad(r[side].spread));
            }
            this.proxy.position.copy(this.worldPoint(item,position));
            if(item.orientation)this.proxy.quaternion.premultiply(item.orientation);
            if(part!=='root')this.gizmo.setSpace('local');
            if (part !== 'root') {
                this.gizmo.showY = false;
                this.gizmo.showZ = !part.includes('Elbow') && !part.includes('Knee');
            }
        }
        this.proxy.updateMatrixWorld();
        this.lastMatrix.copy(this.proxy.matrixWorld);
        this.gizmo.attach(this.proxy);
        for (const i of this.items) {
            if (i.kind !== 'body')
                i.mesh.material.emissive.set(i.id === item.id ? '#24180b' : '#000000');
            else
                for (const m of i.meshes)
                    (m.material as T.MeshStandardMaterial).emissive.set(i.id === item.id && (this.part === 'root' || m.userData.part === this.part) ? '#543b16' : '#000000');
        }
    }
    private transform() {
        if (!this.dragging)
            return;
        const item = this.items.find(i => i.id === this.selected);
        if (!item)
            return;
        if (item.kind === 'cloth') {
            this.proxy.updateMatrixWorld();
            const delta = new T.Matrix4().copy(this.lastMatrix).invert().premultiply(this.proxy.matrixWorld), v = new T.Vector3();
            for (const buf of [item.sim.x, item.sim.p])
                for (let o = 0; o < buf.length; o += 3) {
                    v.fromArray(buf, o).applyMatrix4(delta).toArray(buf, o);
                }
            this.lastMatrix.copy(this.proxy.matrixWorld);
            item.anchor.position.copy(this.proxy.position);
            item.anchor.quaternion.copy(this.proxy.quaternion);
            item.sim.normalsDirty = true;
            item.sim.syncColliderHistory();
            this.syncCloth(item);
        }
        else if(item.kind==='box'||item.kind==='sphere'){item.mesh.position.copy(this.proxy.position);item.mesh.quaternion.copy(this.proxy.quaternion);this.refreshColliders();}
        else if(item.kind==='body') {
            const localRotation=new T.Euler().setFromQuaternion((item.orientation??new T.Quaternion()).clone().invert().multiply(this.proxy.quaternion));
            const b = item.body, r = item.root, p = this.part, side: Side = p.startsWith('left') ? 'left' : 'right', x = deg(localRotation.x), z = deg(localRotation.z), clamp = T.MathUtils.clamp;
            if(p==='root'&&this.mode==='rotate'){item.orientation=this.proxy.quaternion.clone();}
            else if (p === 'root') {
                r.x = this.proxy.position.x;
                r.y = clamp(this.proxy.position.y, .7, 4);
                r.z = this.proxy.position.z;
            }
            else if (p === 'torso') {
                b.torsoPitch = clamp(x, -60, 80);
                b.torsoLean = clamp(-z, -45, 45);
            }
            else if (p === 'head') {
                b.headPitch = clamp(x, -55, 55);
                b.headLean = clamp(-z, -40, 40);
            }
            else if (p.includes('Elbow'))
                b[side].elbow = clamp(x, 0, 140);
            else if (p.includes('Arm')) {
                b[side].forward = clamp(x, -70, 150);
                b[side].raise = clamp(z, -10, 160);
            }
            else if (p.includes('Knee'))
                r[side].knee = clamp(x, 0, 140);
            else {
                r[side].hip = clamp(x, -70, 120);
                r[side].spread = clamp(z, -20, 75);
            }
            this.updateBody(item);
            this.refreshColliders();
        }
        this.invalidate();
    }
    setDrapeMode(mode:'normal'|'exaggerated'){const i=this.items.find(i=>i.id===this.selected);if(i?.kind!=='cloth')return;i.sim.params.drapeMode=mode;this.emit();this.invalidate();}
    setMaterial(material: MaterialId, color?: string) { const i = this.items.find(i => i.id === this.selected); if (i?.kind !== 'cloth')
        return; i.material = material; if (color)
        i.color = color; Object.assign(i.sim.params, MATERIALS[material], { stretch: 0 }); i.mesh.material.color.set(i.color); i.mesh.material.roughness = MATERIALS[material].roughness; this.emit(); this.invalidate(); }
    release() { const i = this.items.find(i => i.id === this.selected); if (i?.kind === 'cloth') {
        i.sim.releasePins();
        this.invalidate();
    } }
    remove() { const k = this.items.findIndex(i => i.id === this.selected); if (k < 0)
        return; this.gizmo.detach(); const i = this.items.splice(k, 1)[0], object = i.kind === 'body' ? i.group : i.mesh; this.scene.remove(object); object.traverse(o => { if (o instanceof T.Mesh) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
            m.dispose();
    } }); this.refreshColliders(); this.rebuildContacts(); this.select(this.items.at(-1)?.id ?? 0); }
    private rebuildContacts() {
        const cloth = this.items.filter((i): i is ClothItem => i.kind === 'cloth');
        this.contacts = null;
        this.contactState = null;
        if (cloth.length < 2)
            return;
        const n = cloth.reduce((n, i) => n + i.sim.n, 0), layers = new Uint8Array(n), triangles: number[] = [];
        let offset = 0;
        cloth.forEach((i, k) => { layers.fill(k + 1, offset, offset + i.sim.n); for (const v of i.sim.tris)
            triangles.push(v + offset); offset += i.sim.n; });
        const b = { pinned: new Uint8Array(n), map: Uint32Array.from({ length: n }, (_, i) => i), index: Uint32Array.from(triangles) } as ClothBuild;
        this.contacts = new GarmentContacts(b, layers);
        this.contactState = { x: new Float32Array(n * 3), p: new Float32Array(n * 3), w: new Float32Array(n), params: this.params('cotton'), upperGuides: null };
    }
    private crossContacts() {
        const state = this.contactState;
        if (!state || !this.contacts)
            return;
        let o = 0;
        for (const i of this.items)
            if (i.kind === 'cloth') {
                state.x.set(i.sim.x, o * 3);
                state.p.set(i.sim.p, o * 3);
                state.w.set(i.sim.w, o);
                o += i.sim.n;
            }
        this.contacts.solve(state);
        o = 0;
        for (const i of this.items)
            if (i.kind === 'cloth') {
                i.sim.x.set(state.x.subarray(o * 3, (o + i.sim.n) * 3));
                i.sim.p.set(state.p.subarray(o * 3, (o + i.sim.n) * 3));
                i.sim.collide();
                i.sim.normalsDirty = true;
                o += i.sim.n;
            }
    }
    private syncCloth(i: ClothItem) { const pos = i.mesh.geometry.attributes.position, normal = i.mesh.geometry.attributes.normal; i.sim.computeNormals(); for (let j = 0; j < i.build.map.length; j++) {
        const o = i.build.map[j] * 3;
        pos.setXYZ(j, i.sim.x[o], i.sim.x[o + 1], i.sim.x[o + 2]);
        normal.setXYZ(j, i.sim.nrm[o], i.sim.nrm[o + 1], i.sim.nrm[o + 2]);
    } pos.needsUpdate = normal.needsUpdate = true; }
    private pointerDown = (e: PointerEvent) => { this.down = [e.clientX, e.clientY]; };
    private pointerUp = (e: PointerEvent) => { if (this.dragging || this.gizmo.axis || Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]) > 4)
        return; const r = this.renderer.domElement.getBoundingClientRect(); this.pointer.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); this.ray.setFromCamera(this.pointer, this.camera); const meshes = this.items.flatMap(i => i.kind === 'body' ? i.meshes : [i.mesh]); for (const m of meshes)
        m.geometry.computeBoundingSphere(); const hit = this.ray.intersectObjects(meshes, false)[0]; if (hit)
        this.select(hit.object.userData.item, hit.object.userData.part ?? 'root'); };
    private resize() { this.renderer.setSize(Math.max(1, this.host.clientWidth), Math.max(1, this.host.clientHeight)); this.camera.aspect = Math.max(1, this.host.clientWidth) / Math.max(1, this.host.clientHeight); this.camera.updateProjectionMatrix(); this.invalidate(); }
    invalidate = () => { this.dirty = true; if (!this.raf && !this.disposed && !document.hidden)
        this.raf = requestAnimationFrame(this.tick); };
    private visibility = () => { cancelAnimationFrame(this.raf); this.raf = 0; this.last = 0; this.accumulator = 0; if (!document.hidden)
        this.invalidate(); };
    private tick = (time: number) => {
        this.raf = 0;
        if (this.disposed || document.hidden)
            return;
        const start = performance.now(), dt = 1 / this.pacer.fps, elapsed = this.last ? Math.min(.1, (time - this.last) / 1000) : dt;
        this.last = time;
        let step = false;
        if (!this.paused && !this.dragging && this.items.some(i => i.kind === 'cloth')) {
            this.accumulator += elapsed;
            if (this.accumulator >= dt) {
                this.accumulator = Math.min(dt * .5, this.accumulator - dt);
                for (const i of this.items)
                    if (i.kind === 'cloth') {
                        i.sim.params.windStrength = this.wind;
                        i.sim.step(dt);
                    }
                this.crossContacts();
                for (const i of this.items)
                    if (i.kind === 'cloth')
                        this.syncCloth(i);
                this.dirty = true;
                step = true;
            }
        }
        else
            this.accumulator = 0;
        if (this.dirty) {
            this.renderer.render(this.scene, this.camera);
            this.dirty = false;
            this.frameCount++;
        }
        if (step)
            this.pacer.observe(performance.now() - start, dt * 1000);
        if (time - this.fpsTime > 1000) {
            this.fps(this.frameCount * 1000 / (time - this.fpsTime));
            this.frameCount = 0;
            this.fpsTime = time;
        }
        if (!this.paused && this.items.some(i => i.kind === 'cloth') || this.dragging)
            this.raf = requestAnimationFrame(this.tick);
    };
    dispose() { this.disposed = true; cancelAnimationFrame(this.raf); this.worker.terminate(); for (const j of this.jobs.values())
        j.reject(new Error('Стол закрыт')); this.jobs.clear(); for (const t of this.jobTimeouts.values())
        clearTimeout(t); this.jobTimeouts.clear(); this.ro.disconnect(); document.removeEventListener('visibilitychange', this.visibility); this.renderer.domElement.removeEventListener('pointerdown', this.pointerDown); this.renderer.domElement.removeEventListener('pointerup', this.pointerUp); this.gizmo.dispose(); this.orbit.dispose(); this.scene.traverse(o => { if (o instanceof T.Mesh || o instanceof T.LineSegments) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
            m.dispose();
    } }); this.scene.clear(); this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove(); this.items = []; this.contacts = null; this.contactState = null; }
}

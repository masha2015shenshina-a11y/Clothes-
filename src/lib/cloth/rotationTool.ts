import * as T from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import type { ClothEngine } from './engine';
/** Rotation uses the same world coordinates as the solver, including its history. */
export class RotationTool {
    readonly control: TransformControls;
    readonly proxy = new T.Object3D();
    enabled: boolean | null = null;
    dragging = false;
    private last = new T.Matrix4();
    private attached = '';
    constructor(private engine: ClothEngine) {
        const e = engine;
        this.control = new TransformControls(e.camera, e.renderer.domElement);
        this.control.setMode('rotate');
        this.control.setSpace('world');
        this.control.setSize(.9);
        e.scene.add(this.control.getHelper(), this.proxy);
        this.control.addEventListener('dragging-changed', event => { this.dragging = !!event.value; e.controls.enabled = !this.dragging; if (!this.dragging) {
            e.editRevision++;
            e.onChange({});
        } e.invalidate(); });
        this.control.addEventListener('objectChange', () => this.changed());
        this.control.addEventListener('change', () => e.invalidate());
    }
    setEnabled(on: boolean | null) { this.enabled = on;if(on===null){this.dragging=false;this.control.dragging=false;this.engine.controls.enabled=true;} this.attached = ''; this.sync(); }
    sync() {
        if (this.dragging)
            return;
        const e = this.engine, k = e.settings.selected;
        if (this.enabled === null || !['cloth','sphere','box'].includes(k)||(k==='cloth'&&!e.sim)) {
            this.control.detach();
            this.attached = '';
            return;
        }
        if (k === this.attached && k === 'cloth')
            return;
        this.attached = k;
        this.control.setMode(k==='sphere'||!this.enabled?'translate':'rotate');
        this.proxy.rotation.set(0, 0, 0);
        if (k === 'cloth' && e.sim) {
            const bounds = new T.Box3();
            const v = new T.Vector3();
            for (let i = 0; i < e.sim.x.length; i += 3)
                bounds.expandByPoint(v.fromArray(e.sim.x, i));
            bounds.getCenter(this.proxy.position);
        }
        else if (k === 'sphere' || k === 'box') {
            const s = e.settings[k];
            this.proxy.position.set(s.x, s.y, s.z);
            this.proxy.rotation.fromArray([...(s.rotation ?? [0, 0, 0]), 'XYZ']);
        }
        this.proxy.updateMatrixWorld();
        this.last.copy(this.proxy.matrixWorld);
        this.control.attach(this.proxy);
        e.invalidate();
    }
    private changed() {
        if (!this.dragging)
            return;
        const e = this.engine, k = e.settings.selected;
        if (k === 'cloth' && e.sim) {
            e.detachClothFromBody();
            this.proxy.updateMatrixWorld();
            const delta = new T.Matrix4().copy(this.last).invert().premultiply(this.proxy.matrixWorld), v = new T.Vector3();
            for (const buffer of [e.sim.x, e.sim.p])
                for (let i = 0; i < buffer.length; i += 3)
                    v.fromArray(buffer, i).applyMatrix4(delta).toArray(buffer, i);
            this.last.copy(this.proxy.matrixWorld);
            e.sim.normalsDirty = true;
            e.syncGeometry();
        }
        else if(k==='sphere')e.change({sphere:{...e.settings.sphere,x:this.proxy.position.x,y:this.proxy.position.y,z:this.proxy.position.z}});
        else if (k === 'box')
            e.change({box:{...e.settings.box,...(this.enabled?{rotation:[this.proxy.rotation.x,this.proxy.rotation.y,this.proxy.rotation.z] as [number,number,number]}:{x:this.proxy.position.x,y:this.proxy.position.y,z:this.proxy.position.z})}});
        e.invalidate();
    }
    dispose() { this.control.dispose(); this.engine.scene.remove(this.proxy, this.control.getHelper()); }
}

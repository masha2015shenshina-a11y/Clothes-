import { Matrix4, Quaternion, Vector3 } from 'three';
import { bodyArmPoints, upperTransform, rotateUpper, sleeveRing, type BodySettings } from './mannequin';
import type { ClothBuild, LegsSettings, V3 } from './presets';
import type { ClothSim } from './solver';
function armMatrices(root: LegsSettings, from: BodySettings, to: BodySettings) {
    const result: Matrix4[] = [];
    for (const side of ['left', 'right'] as const) {
        const a = bodyArmPoints(root, { ...from, torsoPitch: 0, torsoLean: 0 }, side).map(p => new Vector3(...p)), b = bodyArmPoints(root, { ...to, torsoPitch: 0, torsoLean: 0 }, side).map(p => new Vector3(...p));
        for (let j = 0; j < 2; j++) {
            const q = new Quaternion().setFromUnitVectors(a[j + 1].clone().sub(a[j]).normalize(), b[j + 1].clone().sub(b[j]).normalize());
            result.push(new Matrix4().makeTranslation(...b[j].toArray()).multiply(new Matrix4().makeRotationFromQuaternion(q)).multiply(new Matrix4().makeTranslation(-a[j].x, -a[j].y, -a[j].z)));
        }
    }
    return result;
}
export function followUpperPose(sim: ClothSim, build: ClothBuild, root: LegsSettings, before: BodySettings, after: BodySettings) {
    const meta = build.upper;
    if (!meta)
        return;
    if (!(["torsoPitch", "torsoLean", "headPitch", "headLean"] as const).some(k => before[k] !== after[k]) && !(["left", "right"] as const).some(side => (["raise", "forward", "elbow"] as const).some(k => before[side][k] !== after[side][k])))
        return;
    const armsChanged=(["left","right"] as const).some(side=>(["raise","forward","elbow"] as const).some(k=>before[side][k]!==after[side][k]));
    const matrices = armsChanged?armMatrices(root, before, after):null, v = matrices?new Vector3():null, w = matrices?new Vector3():null;
    for (let i = meta.start; i < sim.n; i++) {
        const o = i * 3, q = (i - meta.start) * 3, rx = meta.reference[q], ry = meta.reference[q + 1];
        const sleeve = meta.sleevesStart >= 0 && i >= meta.sleevesStart;
        const hood = meta.hoodStart >= 0 && i >= meta.hoodStart && !sleeve;
        const cape = meta.capeStart >= 0 && i >= meta.capeStart && !hood && !sleeve;
        let weight = 0, side = rx < 0 ? 0 : 2, blend = 0;
        if (sleeve) {
            const offset = i - meta.sleevesStart;
            const count=meta.sleeveCols*meta.sleeveDistances.length;
            side = offset < count ? 0 : 2;
            const d = meta.sleeveDistances[Math.floor((offset % count) / meta.sleeveCols)];
            blend = Math.max(0, Math.min(1, (d - .53) / .2));
            weight = Math.min(1, d / .24);
        }
        else if (cape && !build.pinned[i])
            weight = Math.min(1, Math.max(0, (Math.abs(rx) - .16) / .30)) * Math.max(0, Math.min(1, (ry + .2) / .9));
        for (const buffer of [sim.x, sim.p]) {
            let p = upperTransform([buffer[o], buffer[o + 1], buffer[o + 2]], root, before, true, hood && before.hood === 'up');
            if (weight && matrices && v && w) {
                v.set(...p).applyMatrix4(matrices[side]);
                w.set(...p).applyMatrix4(matrices[side + 1]);
                v.lerp(w, blend);
                p = p.map((n, k) => n + (v.getComponent(k) - n) * weight) as V3;
            }
            p = upperTransform(p, root, after, false, hood && after.hood === 'up');
            if(!sleeve&&!cape&&!hood&&!build.pinned[i]){
                // Let the lower tunic lag behind the torso so compression becomes folds,
                // rather than rigidly rotating the whole garment through the pelvis.
                const t=Math.max(0,Math.min(1,(ry+.10)/.75)),follow=.15+.85*t*t*(3-2*t);
                for(let k=0;k<3;k++)p[k]=buffer[o+k]+(p[k]-buffer[o+k])*follow;
            }
            buffer.set(p, o);
        }
    }
    sim.normalsDirty = true;
}
// Loose guides prevent narrow arms from escaping between cape/sleeve triangles.
export function updateUpperGuides(sim: ClothSim, build: ClothBuild, root: LegsSettings, body: BodySettings) {
    const m = build.upper;
    if (!m || m.sleevesStart<0 || !body.arms) {
        sim.upperGuides = null;
        sim.upperSectors = null;
        return;
    }
    const g = sim.upperGuides ?? (sim.upperGuides = new Float32Array(sim.n * 4));
    g.fill(0);
    const sectors=sim.upperSectors??(sim.upperSectors=new Float32Array(sim.n*7));
    sectors.fill(0);
    const neutral={...body,torsoPitch:0,torsoLean:0};
    const points = [bodyArmPoints(root, body, 'left'), bodyArmPoints(root, body, 'right')];
    const localPoints=[bodyArmPoints(root,neutral,'left'),bodyArmPoints(root,neutral,'right')];
    const rings=localPoints.map((p,i)=>m.sleeveDistances.map(d=>sleeveRing(p,d,body[i?'right':'left'],i?'right':'left')));
    if (m.sleevesStart >= 0)
        for (let i = m.sleevesStart; i < sim.n; i++) {
            const count=m.sleeveCols*m.sleeveDistances.length,offset = i - m.sleevesStart, d = m.sleeveDistances[Math.floor(offset % count / m.sleeveCols)], p = points[offset < count ? 0 : 1], seg = d < .63 ? 0 : 1, t = (d - seg * .63) / (seg ? .56 : .63), o = i * 4;
            if (d < .10)
                continue;
            for (let k = 0; k < 3; k++)
                g[o + k] = p[seg][k] + (p[seg + 1][k] - p[seg][k]) * t;
            const elbow=body[offset<count?"left":"right"].elbow*Math.PI/180;
            const bendAllowance=.10*Math.sin(elbow/2)*Math.exp(-(((d-.63)/.18)**2));
            g[o + 3] = .15 + body.ease * .25 + bendAllowance;
            const row=Math.floor(offset%count/m.sleeveCols),ring=rings[offset<count?0:1][row],angle=offset%m.sleeveCols/m.sleeveCols*Math.PI*2;
            const direction=ring.radial.map((v,k)=>v*Math.cos(angle)+ring.normal[k]*Math.sin(angle)) as V3;
            const normal=rotateUpper(direction,body.torsoPitch,body.torsoLean),k=i*7;
            sectors[k]=g[o];sectors[k+1]=g[o+1];sectors[k+2]=g[o+2];
            sectors[k+3]=normal[0];sectors[k+4]=normal[1];sectors[k+5]=normal[2];sectors[k+6]=.04;
        }
}

import type { ClothSim } from './solver';
/** Closest point on a triangle; returns barycentric coordinates in a reused buffer. */
function barycentricClosest(px: number, py: number, pz: number, x: Float32Array, a: number, b: number, c: number, out: Float64Array) {
    const abx = x[b] - x[a], aby = x[b + 1] - x[a + 1], abz = x[b + 2] - x[a + 2], acx = x[c] - x[a], acy = x[c + 1] - x[a + 1], acz = x[c + 2] - x[a + 2];
    const apx = px - x[a], apy = py - x[a + 1], apz = pz - x[a + 2];
    const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
    if (d1 <= 0 && d2 <= 0) {
        out[0] = 1;
        out[1] = out[2] = 0;
        return;
    }
    const bpx = px - x[b], bpy = py - x[b + 1], bpz = pz - x[b + 2], d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
    if (d3 >= 0 && d4 <= d3) {
        out[1] = 1;
        out[0] = out[2] = 0;
        return;
    }
    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) {
        const v = d1 / (d1 - d3);
        out[0] = 1 - v;
        out[1] = v;
        out[2] = 0;
        return;
    }
    const cpx = px - x[c], cpy = py - x[c + 1], cpz = pz - x[c + 2], d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
    if (d6 >= 0 && d5 <= d6) {
        out[2] = 1;
        out[0] = out[1] = 0;
        return;
    }
    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) {
        const v = d2 / (d2 - d6);
        out[0] = 1 - v;
        out[1] = 0;
        out[2] = v;
        return;
    }
    const va = d3 * d6 - d5 * d4;
    if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
        const v = (d4 - d3) / (d4 - d3 + d5 - d6);
        out[0] = 0;
        out[1] = 1 - v;
        out[2] = v;
        return;
    }
    const den = va + vb + vc;
    if (Math.abs(den) < 1e-16) {
        out[0] = out[1] = out[2] = 1 / 3;
        return;
    }
    out[1] = vb / den;
    out[2] = vc / den;
    out[0] = 1 - out[1] - out[2];
}
/** Exact static triangle/capsule contact. No per-face arrays or geometry allocations. */
export class SurfaceContacts {
    private weights = new Float64Array(3);
    private bestWeights = new Float64Array(3);
    private local = new Float32Array(9);
    private best = Infinity;
    private qx = 0;
    private qy = 0;
    private qz = 0;
    contacts = 0;
    maxPenetration = 0;
    worstFace = new Int32Array(3);
    private resolving = true;
    private consider(x: Float32Array, a: number, b: number, c: number, qx: number, qy: number, qz: number) {
        const w = this.weights, px = x[a] * w[0] + x[b] * w[1] + x[c] * w[2], py = x[a + 1] * w[0] + x[b + 1] * w[1] + x[c + 1] * w[2], pz = x[a + 2] * w[0] + x[b + 2] * w[1] + x[c + 2] * w[2], d = (px - qx) ** 2 + (py - qy) ** 2 + (pz - qz) ** 2;
        if (d < this.best) {
            this.best = d;
            this.qx = qx;
            this.qy = qy;
            this.qz = qz;
            this.bestWeights.set(w);
        }
    }
    private capsule(x: Float32Array, a: number, b: number, c: number, A: number[], B: number[]) {
        this.best = Infinity;
        for (let j = 0; j < 2; j++) {
            const q = j ? B : A;
            barycentricClosest(q[0], q[1], q[2], x, a, b, c, this.weights);
            this.consider(x, a, b, c, q[0], q[1], q[2]);
        }
        const vx = B[0] - A[0], vy = B[1] - A[1], vz = B[2] - A[2], vv = vx * vx + vy * vy + vz * vz;
        // Segment piercing the face interior is a zero-distance contact.
        const ux = x[b] - x[a], uy = x[b + 1] - x[a + 1], uz = x[b + 2] - x[a + 2], wx = x[c] - x[a], wy = x[c + 1] - x[a + 1], wz = x[c + 2] - x[a + 2], nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, den = nx * vx + ny * vy + nz * vz;
        if (Math.abs(den) > 1e-10) {
            const t = ((x[a] - A[0]) * nx + (x[a + 1] - A[1]) * ny + (x[a + 2] - A[2]) * nz) / den;
            if (t >= 0 && t <= 1) {
                const qx = A[0] + vx * t, qy = A[1] + vy * t, qz = A[2] + vz * t;
                barycentricClosest(qx, qy, qz, x, a, b, c, this.weights);
                this.consider(x, a, b, c, qx, qy, qz);
            }
        }
        for (let edge = 0; edge < 3; edge++) {
            const i = edge === 0 ? a : edge === 1 ? b : c, j = edge === 0 ? b : edge === 1 ? c : a, ex = x[j] - x[i], ey = x[j + 1] - x[i + 1], ez = x[j + 2] - x[i + 2], rx = x[i] - A[0], ry = x[i + 1] - A[1], rz = x[i + 2] - A[2], ee = ex * ex + ey * ey + ez * ez, ev = ex * vx + ey * vy + ez * vz, er = ex * rx + ey * ry + ez * rz, vr = vx * rx + vy * ry + vz * rz, d = ee * vv - ev * ev;
            let s = d > 1e-12 ? Math.max(0, Math.min(1, (ev * vr - er * vv) / d)) : 0, t = vv > 1e-12 ? (ev * s + vr) / vv : 0;
            if (t < 0) {
                t = 0;
                s = ee > 1e-12 ? Math.max(0, Math.min(1, -er / ee)) : 0;
            }
            else if (t > 1) {
                t = 1;
                s = ee > 1e-12 ? Math.max(0, Math.min(1, (ev - er) / ee)) : 0;
            }
            this.weights.fill(0);
            this.weights[edge] = 1 - s;
            this.weights[(edge + 1) % 3] = s;
            this.consider(x, a, b, c, A[0] + vx * t, A[1] + vy * t, A[2] + vz * t);
        }
    }
    private push(sim: ClothSim, a: number, b: number, c: number, dx: number, dy: number, dz: number) {
        this.contacts++;
        const depth = Math.hypot(dx, dy, dz);
        if (depth > this.maxPenetration) {
            this.maxPenetration = depth;
            this.worstFace[0] = a / 3;
            this.worstFace[1] = b / 3;
            this.worstFace[2] = c / 3;
        }
        if (!this.resolving)
            return;
        const w = this.bestWeights, mass = sim.w[a / 3] * w[0] ** 2 + sim.w[b / 3] * w[1] ** 2 + sim.w[c / 3] * w[2] ** 2;
        if (mass < 1e-9)
            return;
        // Cap one correction, resolving severe overlap across substeps without an impulse.
        const len = Math.hypot(dx, dy, dz), scale = len > .025 ? .025 / len : 1;
        for (let j = 0; j < 3; j++) {
            const o = j === 0 ? a : j === 1 ? b : c, f = Math.min(.025 / Math.max(len, 1e-12), sim.w[o / 3] * w[j] / mass * scale);
            sim.x[o] += dx * f;
            sim.x[o + 1] += dy * f;
            sim.x[o + 2] += dz * f;
            sim.p[o] += dx * f;
            sim.p[o + 1] += dy * f;
            sim.p[o + 2] += dz * f;
        }
    }
    solve(sim: ClothSim, resolve = true) {
        const { x, tris } = sim;
        this.contacts = 0;
        this.maxPenetration = 0;
        this.resolving = resolve;
        for (let f = 0; f < tris.length; f += 3) {
            const a = tris[f] * 3, b = tris[f + 1] * 3, c = tris[f + 2] * 3;
            if (resolve && !sim.w[a / 3] && !sim.w[b / 3] && !sim.w[c / 3])
                continue;
            const minX = Math.min(x[a], x[b], x[c]), maxX = Math.max(x[a], x[b], x[c]), minY = Math.min(x[a + 1], x[b + 1], x[c + 1]), maxY = Math.max(x[a + 1], x[b + 1], x[c + 1]), minZ = Math.min(x[a + 2], x[b + 2], x[c + 2]), maxZ = Math.max(x[a + 2], x[b + 2], x[c + 2]);
            const cape = a / 3 >= sim.capeStart && a / 3 < sim.capeEnd, padding = cape ? .035 + sim.capeArmClearance : sim.thickness;
            for (const C of sim.params.capsules ?? []) {
                const r = C.r + padding;
                if (maxX < Math.min(C.a[0], C.b[0]) - r || minX > Math.max(C.a[0], C.b[0]) + r || maxY < Math.min(C.a[1], C.b[1]) - r || minY > Math.max(C.a[1], C.b[1]) + r || maxZ < Math.min(C.a[2], C.b[2]) - r || minZ > Math.max(C.a[2], C.b[2]) + r)
                    continue;
                this.capsule(x, a, b, c, C.a, C.b);
                if (this.best >= r * r)
                    continue;
                const w = this.bestWeights;
                let dx = x[a] * w[0] + x[b] * w[1] + x[c] * w[2] - this.qx, dy = x[a + 1] * w[0] + x[b + 1] * w[1] + x[c + 1] * w[2] - this.qy, dz = x[a + 2] * w[0] + x[b + 2] * w[1] + x[c + 2] * w[2] - this.qz, d = Math.sqrt(this.best);
                if (d < 1e-6) {
                    const ux = x[b] - x[a], uy = x[b + 1] - x[a + 1], uz = x[b + 2] - x[a + 2], vx = x[c] - x[a], vy = x[c + 1] - x[a + 1], vz = x[c + 2] - x[a + 2];
                    dx = uy * vz - uz * vy;
                    dy = uz * vx - ux * vz;
                    dz = ux * vy - uy * vx;
                    const body = sim.params.ellipsoids?.[2], cx = (x[a] + x[b] + x[c]) / 3 - (body?.x ?? 0), cz = (x[a + 2] + x[b + 2] + x[c + 2]) / 3 - (body?.z ?? 0);
                    if (dx * cx + dz * cz < 0) {
                        dx = -dx;
                        dy = -dy;
                        dz = -dz;
                    }
                    const l = Math.hypot(dx, dy, dz);
                    if (l < 1e-8) {
                        dx = 0;
                        dy = 0;
                        dz = 1;
                    }
                    else {
                        dx /= l;
                        dy /= l;
                        dz /= l;
                    }
                    d = 0;
                }
                else {
                    dx /= d;
                    dy /= d;
                    dz /= d;
                }
                this.push(sim, a, b, c, dx * (r - d), dy * (r - d), dz * (r - d));
            }
            for (const E of sim.params.ellipsoids ?? []) {
                if(E.enabled===false)continue;
                const r = Math.max(E.rx, E.ry, E.rz) + padding;
                if (maxX < E.x - r || minX > E.x + r || maxY < E.y - r || minY > E.y + r || maxZ < E.z - r || minZ > E.z + r)
                    continue;
                const basis = E.basis, rx = E.rx + sim.thickness, ry = E.ry + sim.thickness, rz = E.rz + sim.thickness;
                for (let j = 0; j < 3; j++) {
                    const o = j === 0 ? a : j === 1 ? b : c, dx = x[o] - E.x, dy = x[o + 1] - E.y, dz = x[o + 2] - E.z, k = j * 3;
                    this.local[k] = (basis ? dx * basis[0] + dy * basis[1] + dz * basis[2] : dx) / rx;
                    this.local[k + 1] = (basis ? dx * basis[3] + dy * basis[4] + dz * basis[5] : dy) / ry;
                    this.local[k + 2] = (basis ? dx * basis[6] + dy * basis[7] + dz * basis[8] : dz) / rz;
                }
                barycentricClosest(0, 0, 0, this.local, 0, 3, 6, this.bestWeights);
                const w = this.bestWeights;
                let dx = this.local[0] * w[0] + this.local[3] * w[1] + this.local[6] * w[2], dy = this.local[1] * w[0] + this.local[4] * w[1] + this.local[7] * w[2], dz = this.local[2] * w[0] + this.local[5] * w[1] + this.local[8] * w[2], d = Math.hypot(dx, dy, dz);
                if (d >= 1 || d < 1e-7)
                    continue;
                const k = 1 / d - 1;
                dx *= k * rx;
                dy *= k * ry;
                dz *= k * rz;
                this.push(sim, a, b, c, basis ? dx * basis[0] + dy * basis[3] + dz * basis[6] : dx, basis ? dx * basis[1] + dy * basis[4] + dz * basis[7] : dy, basis ? dx * basis[2] + dy * basis[5] + dz * basis[8] : dz);
            }
        }
    }
}

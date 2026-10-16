import type { ClothSim } from './solver';
/** Triangle/AABB SAT. Detects an edge cutting a face even when all vertices are outside.
 * Scratch vectors are retained, and the broad phase avoids SAT away from the box. */
export class BoxContacts {
    private v = new Float64Array(9);
    private depth = Infinity;
    private nx = 0;
    private ny = 0;
    private nz = 0;
    private hx = 0;
    private hy = 0;
    private hz = 0;
    private axis(nx: number, ny: number, nz: number) {
        const len = Math.hypot(nx, ny, nz);
        if (len < 1e-10)
            return true;
        nx /= len;
        ny /= len;
        nz /= len;
        const v = this.v;
        const a = v[0] * nx + v[1] * ny + v[2] * nz, b = v[3] * nx + v[4] * ny + v[5] * nz, c = v[6] * nx + v[7] * ny + v[8] * nz;
        const lo = Math.min(a, b, c), hi = Math.max(a, b, c), r = this.hx * Math.abs(nx) + this.hy * Math.abs(ny) + this.hz * Math.abs(nz);
        if (lo >= r || hi <= -r)
            return false;
        const positive = r - lo, negative = r + hi, sign = positive < negative ? 1 : -1, d = Math.min(positive, negative);
        if (d < this.depth) {
            this.depth = d;
            this.nx = nx * sign;
            this.ny = ny * sign;
            this.nz = nz * sign;
        }
        return true;
    }
    solve(sim: ClothSim) {
        const B = sim.params.box;
        if (!B.on)
            return 0;
        this.hx = (B.width ?? B.s) / 2 + sim.thickness;
        this.hy = (B.height ?? B.s) / 2 + sim.thickness;
        this.hz = (B.depth ?? B.s) / 2 + sim.thickness;
        const { x, p, tris, w } = sim, v = this.v;
        let max = 0;
        for (let f = 0; f < tris.length; f += 3) {
            const a = tris[f] * 3, b = tris[f + 1] * 3, c = tris[f + 2] * 3;
            if (!w[a / 3] && !w[b / 3] && !w[c / 3])
                continue;
            for (let j = 0; j < 3; j++) {
                const o = j === 0 ? a : j === 1 ? b : c;
                const basis=B.basis,dx=x[o]-B.x,dy=x[o+1]-B.y,dz=x[o+2]-B.z;
                v[j*3]=basis?dx*basis[0]+dy*basis[1]+dz*basis[2]:dx;
                v[j*3+1]=basis?dx*basis[3]+dy*basis[4]+dz*basis[5]:dy;
                v[j*3+2]=basis?dx*basis[6]+dy*basis[7]+dz*basis[8]:dz;
            }
            this.depth = Infinity;
            if (!this.axis(1, 0, 0) || !this.axis(0, 1, 0) || !this.axis(0, 0, 1))
                continue;
            const ux = v[3] - v[0], uy = v[4] - v[1], uz = v[5] - v[2], vx = v[6] - v[0], vy = v[7] - v[1], vz = v[8] - v[2];
            if (!this.axis(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx))
                continue;
            let hit = true;
            for (let e = 0; e < 3; e++) {
                const i = e * 3, j = ((e + 1) % 3) * 3, ex = v[j] - v[i], ey = v[j + 1] - v[i + 1], ez = v[j + 2] - v[i + 2];
                if (!this.axis(0, ez, -ey) || !this.axis(-ez, 0, ex) || !this.axis(ey, -ex, 0)) {
                    hit = false;
                    break;
                }
            }
            if (!hit)
                continue;
            max = Math.max(max, this.depth);
            const d = Math.min(.025, this.depth + 1e-5);
            for (let j = 0; j < 3; j++) {
                const o = j === 0 ? a : j === 1 ? b : c;
                if (!w[o / 3])
                    continue;
                const basis=B.basis,nx=this.nx,ny=this.ny,nz=this.nz;
                const dx=(basis?nx*basis[0]+ny*basis[3]+nz*basis[6]:nx)*d,dy=(basis?nx*basis[1]+ny*basis[4]+nz*basis[7]:ny)*d,dz=(basis?nx*basis[2]+ny*basis[5]+nz*basis[8]:nz)*d;
                x[o] += dx;
                x[o + 1] += dy;
                x[o + 2] += dz;
                p[o] += dx;
                p[o + 1] += dy;
                p[o + 2] += dz;
            }
        }
        return max;
    }
}

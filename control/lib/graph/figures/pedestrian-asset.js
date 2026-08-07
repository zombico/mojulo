/**
 * pedestrian-asset — the fractal-city "pedestrian": a posed protoform human baked at
 * LOW density into the shared `{corners,fill}` face currency and cheaply transformed
 * per placement. The human-seeder (see human-seeder.plan.md) scatters these in groups
 * (solo / duo / family) onto a city's walkable surfaces.
 *
 * It is the cyclist (cyclist-asset.js) MINUS the bike: same buildPosedFigure → LOD
 * re-mesh → bake-once → scale/rotate/translate pipeline, the proven figure↔city
 * composition. Two differences:
 *   - parameterized by ARCHETYPE (adult ♂ / ♀ / child) × POSE (idle / stroll), so the
 *     seeder draws a varied cast — `headScale` makes the child a real child, not a
 *     shrunk adult (see figure-proto.js headScale).
 *   - the GEOMETRY (corners + region + normal) is baked per (archetype,pose); the COLOUR
 *     is applied per instance from a clothing PALETTE, so one bake → many-coloured people.
 *
 * Coordinates: figure-render world units, rotated so the figure FRONT is +x (a heading
 * rotation about z then faces it), centred on x/y, feet at z=0 — so heading-rotate +
 * translate drops it standing on the ground plane. FIG_UNIT scales render-units → city
 * units (an adult ≈ 0.62 units tall, matching the cyclist's rider).
 */
import { buildPosedFigure } from '../polygonizer/figure-render.js';
import { makeLight, shadeHex, dot3, sub3, centroid } from '../polygonizer/vexar.js';

// figure-render world transform (matches cyclist-asset.js / figure-render.js).
const PROTO_SCALE = 12, S = 1.95;
// render-units → fractal-city units. An adult (~1.85 render-units tall) → ~0.62 units.
const FIG_UNIT = 0.335;
const FIG_LIGHT = makeLight({ direction: [0.42, -0.5, -0.76], ambient: 0.40, diffuse: 0.76 }); // == figure-render LIGHT
const FIG_MAX_RINGS = 5, FIG_MAX_SAMPLES = 7;   // LOD: ~140 quads vs ~50k (invisible at ~40px)

// ── archetypes (proto configs) ────────────────────────────────────────────────────
// The child leans on `headScale` (bigger cranium = fewer "heads tall" = younger) plus a
// low height and slim limbs — the 80% child read without any armature change.
export const ARCHETYPES = {
  adultM: { sex: 'male',   height: 1.0 },
  adultF: { sex: 'female', height: 0.94, gluteSize: 1.1 },
  child:  { sex: 'male',   height: 0.6, headScale: 1.5, chestWidth: 0.9, bicep: 0.9, quad: 0.9, calf: 0.9, gluteSize: 0.9 },
};

// ── poses (pose DOF specs; same vocabulary as create_figure `pose`) ─────────────────
// A small library so a crowd doesn't read as cloned: two idle (contrapposto weight-
// shift, mirrored) and two stroll (mid-stride, opposite legs leading).
export const POSES = {
  idleL:   { kneeL: 6, kneeR: 6, elbowL: 14, elbowR: 12, spine: { lateral: 0.12, axial: 0.05 }, hipL: { roll: 4 }, head: { yaw: -8 } },
  idleR:   { kneeL: 6, kneeR: 6, elbowL: 10, elbowR: 16, spine: { lateral: -0.10, axial: -0.04 }, hipR: { roll: 4 }, head: { yaw: 10 } },
  strollL: { elbowL: 20, elbowR: 16, shL: { pitch: 16 }, shR: { pitch: -14 }, hipL: { pitch: 20 }, hipR: { pitch: -14 }, kneeL: 8, kneeR: 30, ankleL: 6, ankleR: -12, spine: { axial: 0.12, sagittal: 0.06 }, head: { yaw: 6 } },
  strollR: { elbowL: 16, elbowR: 20, shL: { pitch: -14 }, shR: { pitch: 16 }, hipL: { pitch: -14 }, hipR: { pitch: 20 }, kneeL: 30, kneeR: 8, ankleL: -12, ankleR: 6, spine: { axial: -0.12, sagittal: 0.06 }, head: { yaw: -6 } },
};
export const IDLE_POSES = ['idleL', 'idleR'];
export const STROLL_POSES = ['strollL', 'strollR'];

// ── clothing palettes (per-instance colour over the bare LOD mesh) ──────────────────
// region → colour. The bare protoform is tinted by body region (no garment stacks), the
// same trick the cyclist uses (a jersey/tights tint), generalised to shirt/pants/shoe.
export const PALETTES = [
  { skin: '#c8836a', shirt: '#3a6ea5', pants: '#2c3038', shoe: '#1c1c1c' },
  { skin: '#a8694f', shirt: '#b5483f', pants: '#33363d', shoe: '#241c14' },
  { skin: '#e0a487', shirt: '#d9b65a', pants: '#4a5a3a', shoe: '#2a2018' },
  { skin: '#8f5a40', shirt: '#4f9a78', pants: '#22252b', shoe: '#15140f' },
  { skin: '#d2926f', shirt: '#7a5aa0', pants: '#3a3a40', shoe: '#201a1a' },
  { skin: '#bb7a5c', shirt: '#e0e0e0', pants: '#5a6068', shoe: '#2c2c2c' },
];

// body-region classifier (by ring-stack id) → palette key.
const SKIN_IDS = ['headEgg', 'faceMask', 'neck', 'forearm', 'hand'];
const PANTS_IDS = ['leg', 'glute', 'diaper', 'groin', 'hip', 'quad', 'calf'];
const FOOT_IDS = ['foot'];
function regionOf(id) {
  if (FOOT_IDS.some((s) => id.startsWith(s))) return 'shoe';
  if (SKIN_IDS.some((s) => id.startsWith(s))) return 'skin';
  if (PANTS_IDS.some((s) => id.startsWith(s))) return 'pants';
  return 'shirt';   // torso, chest, scapula, shoulder, upper arm
}

const newell = (pts) => {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]); }
  const l = Math.hypot(nx, ny, nz) || 1; return [nx / l, ny / l, nz / l];
};
const stride = (n, max) => Math.max(1, Math.floor(n / max));

// ── geometry bake (memoized per archetype+pose) ─────────────────────────────────────
// Re-mesh the posed protoform at LOD from its ring-stacks, in render units rotated so
// the FRONT is +x (figure front is +y; (x,y)→(y,-x) is a −90° turn), centred on x/y,
// feet at z=0. Stores {corners, region, normal} — colour is deferred to the instance.
const _geomCache = new Map();
function bakeGeometry(archetypeKey, poseKey) {
  const key = `${archetypeKey}:${poseKey}`;
  const hit = _geomCache.get(key);
  if (hit) return hit;
  const proto = ARCHETYPES[archetypeKey] || ARCHETYPES.adultM;
  const pose = POSES[poseKey] || POSES.idleL;
  const stacks = buildPosedFigure(pose, proto, null);   // bare protoform; clothing is a per-region tint

  // figure-render world, front +y → +x: (x,y)→(y,-x).
  let minZ = Infinity;
  for (const st of stacks) for (const rg of st.rings) for (const q of rg.polyline) { const z = q.z / PROTO_SCALE; if (z < minZ) minZ = z; }
  const V = (q) => [(q.y / PROTO_SCALE) * S, -(q.x / PROTO_SCALE) * S, ((q.z / PROTO_SCALE) - minZ) * S + 0.02];

  // collect faces, then re-centre on the x/y bbox so a heading rotation spins in place.
  const raw = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const st of stacks) {
    const rings = st.rings; if (rings.length < 2) continue;
    const region = regionOf(st.id);
    const rs = stride(rings.length - 1, FIG_MAX_RINGS);
    const idx = [];
    for (let i = 0; i < rings.length; i += rs) idx.push(i);
    if (idx[idx.length - 1] !== rings.length - 1) idx.push(rings.length - 1);
    for (let k = 0; k < idx.length - 1; k++) {
      const ra = rings[idx[k]], rb = rings[idx[k + 1]];
      const a = ra.polyline, b = rb.polyline, m = Math.min(a.length, b.length); if (m < 2) continue;
      const ss = stride(m - 1, FIG_MAX_SAMPLES);
      const c0 = ra.center, c1 = rb.center;
      const cw = V({ x: (c0.x + c1.x) / 2, y: (c0.y + c1.y) / 2, z: (c0.z + c1.z) / 2 });
      for (let j = 0; j + 1 < m; j += ss) {
        const j2 = Math.min(j + ss, m - 1); if (j2 === j) continue;
        const wpts = [V(a[j]), V(a[j2]), V(b[j2]), V(b[j])];
        let n = newell(wpts); const cen = centroid(wpts);
        if (dot3(n, sub3(cen, cw)) < 0) n = [-n[0], -n[1], -n[2]];
        for (const [x, y] of wpts) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
        raw.push({ corners: wpts, region, normal: n });
      }
    }
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const baked = raw.map((f) => ({
    region: f.region,
    normal: f.normal,
    corners: f.corners.map(([x, y, z]) => [x - cx, y - cy, z]),   // centre x/y, feet already at z≈0
  }));
  _geomCache.set(key, baked);
  return baked;
}

/**
 * Build a pedestrian instance as fractal-city faces: the baked LOD figure coloured from
 * a palette, scaled to city units, rotated to its heading, and placed at (cx,cy) on the
 * ground. Lighting uses the baked (pre-heading) normal — the same fixed-bake shading the
 * cyclist uses; imperceptible at city scale.
 * @returns {Array<{corners:number[][], fill:string, doubleSided:boolean}>}
 */
export function pedestrianFaces({ cx = 0, cy = 0, heading = 0, scale = 1, archetype = 'adultM', pose = 'idleL', palette = PALETTES[0] } = {}) {
  const baked = bakeGeometry(archetype, pose);
  const u = FIG_UNIT * scale;
  const ct = Math.cos(heading), st = Math.sin(heading);
  return baked.map((f) => ({
    fill: shadeHex(palette[f.region] || palette.shirt, f.normal, FIG_LIGHT),
    doubleSided: true,
    corners: f.corners.map(([x, y, z]) => {
      const px = x * u, py = y * u;
      return [cx + px * ct - py * st, cy + px * st + py * ct, z * u];
    }),
  }));
}

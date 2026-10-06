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
import { SM, mathKey } from '../../util/math-scope.js';
import { smoothCorners } from './smooth-corners.js';

// figure-render world transform (matches cyclist-asset.js / figure-render.js).
const PROTO_SCALE = 12, S = 1.95;
// render-units → fractal-city units. An adult (~1.85 render-units tall) → ~0.62 units.
const FIG_UNIT = 0.335;
const FIG_LIGHT = makeLight({ direction: [0.42, -0.5, -0.76], ambient: 0.40, diffuse: 0.76 }); // == figure-render LIGHT
const FIG_MAX_RINGS = 5, FIG_MAX_SAMPLES = 7;   // LOD: ~1.8k quads vs ~50k (invisible at ~40px)
// named LODs: `city` is the fractal city's (the default, unchanged); `mini` is the historic miniatures' (~280 quads), a
// figure a few metres off in a town of hundreds: at most `rings` × `samples` quads a stack (`cap`: the stride rounds
// up, so a long stack never runs over), the leg one ring more so the knee still bends, and the small patches over the
// joints and the chest (`skip`) left out — the trunk and the limbs close over where they were
export const LODS = {
  city: { rings: FIG_MAX_RINGS, samples: FIG_MAX_SAMPLES },
  mini: { rings: 3, samples: 5, cap: true, legRings: 4, skip: /^(clavicle|pec|scapula|scapBun|dantien|elbowCap|hipCap|coreSide|deltoid|groin|glute)/ },
};

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
  // work poses (the historic miniatures' field hands; the city never draws them): bent over the crop with both hands
  // low (reaping, weeding), leaning into a hoe or mattock, and walking with a load hoisted on the right shoulder
  stoop: { hinge: 55, kneeL: 22, kneeR: 30, elbowL: 20, elbowR: 30, shL: { pitch: 40 }, shR: { pitch: 55 }, head: { yaw: 6 } },
  hoe: { hinge: 28, kneeL: 12, kneeR: 18, elbowL: 40, elbowR: 30, shL: { pitch: 55 }, shR: { pitch: 45 }, hipL: { pitch: 14 }, hipR: { pitch: -6 } },
  carry: { elbowL: 16, elbowR: 150, shL: { pitch: -10 }, shR: { pitch: 150 }, hipL: { pitch: 16 }, hipR: { pitch: -12 }, kneeL: 8, kneeR: 24, spine: { lateral: 0.1 } },
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
const SKIN_IDS = ['headEgg', 'neck', 'forearm', 'hand'];
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
  const l = SM.hypot(nx, ny, nz) || 1; return [nx / l, ny / l, nz / l];
};
const strideFloor = (n, max) => Math.max(1, Math.floor(n / max));

// ── cuts: a skirt of cloth from the waist to a hem (a tunic, a kilt, a robe, a stola) ──────────────────────────────
// `hem` is how far down the leg it falls (0 the hip, 1 the ankle), `flare` how much wider the hem stands than the
// hips. The skirt is fitted to the POSED figure. Its top is the trunk's own cross-section at the waist (`WAIST` up the
// trunk from the pelvis), so it tilts as the trunk does when the figure bends. Each ring below is the support of the
// hips and legs at its height round one centre (the widest the body reaches in each of `SIDES` directions, plus the
// cloth's ease), never narrowing on the way down, so the cloth hangs from the hips and a striding leg or a bent knee
// pushes it out instead of poking through. The legs and pelvis under it are not drawn.
export const CUTS = {
  knee:  { hem: 0.5, flare: 0.08, levels: 3 },
  shin:  { hem: 0.74, flare: 0.14, levels: 4 },
  ankle: { hem: 0.94, flare: 0.18, levels: 4 },
};
const SIDES = 10, EASE = 0.03, WAIST = 0.2;
const PELVIS = /^(leg|diaper|glute|hipCap|groin)/;
function skirtFaces(stacks, V, cut) {
  const legs = stacks.filter((st) => /^leg[LR]$/.test(st.id)), trunk = stacks.find((st) => st.id === 'trunk');
  if (!legs.length || !trunk) return null;
  const dirs = Array.from({ length: SIDES }, (_, i) => { const a = (i / SIDES) * 2 * Math.PI; return [SM.cos(a), SM.sin(a)]; });
  const hem = Math.max(0.06, legs.reduce((a, st) => a + V(st.rings[Math.round(cut.hem * (st.rings.length - 1))].center)[2], 0) / legs.length);
  // the waist: the trunk's ring a little above the pelvis, its point furthest out in each direction, eased
  const wr = trunk.rings[Math.round(WAIST * (trunk.rings.length - 1))], wc = V(wr.center), wpts = wr.polyline.map(V);
  const top = dirs.map(([dx, dy]) => {
    let best = wpts[0], m = -Infinity;
    for (const p of wpts) { const d = (p[0] - wc[0]) * dx + (p[1] - wc[1]) * dy; if (d > m) { m = d; best = p; } }
    return [best[0] + dx * EASE, best[1] + dy * EASE, best[2]];
  });
  const waistZ = Math.min(...top.map((p) => p[2]));
  // the hips and legs between the waist and a hand below the hem: the body the cloth hangs over, round one centre
  const pts = [];
  for (const st of stacks) if (PELVIS.test(st.id)) for (const rg of st.rings) for (const q of rg.polyline) { const p = V(q); if (p[2] >= hem - 0.08 && p[2] <= waistZ) pts.push(p); }
  if (!pts.length) return null;
  const c = [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
  let reach = top.map((p, i) => (p[0] - c[0]) * dirs[i][0] + (p[1] - c[1]) * dirs[i][1]);
  const rings = [top], n = cut.levels, band = Math.max(0.1, (waistZ - hem) / (n - 1) / 2 + 0.02);
  for (let k = 1; k < n; k++) {
    const t = k / (n - 1), z = waistZ + (hem - waistZ) * t, near = pts.filter((p) => Math.abs(p[2] - z) <= band), use = near.length ? near : pts;
    reach = dirs.map(([dx, dy], i) => { let m = reach[i]; for (const p of use) { const d = (p[0] - c[0]) * dx + (p[1] - c[1]) * dy + EASE; if (d > m) m = d; } return m; });
    rings.push(dirs.map(([dx, dy], i) => { const r = reach[i] * (1 + cut.flare * t); return [c[0] + dx * r, c[1] + dy * r, z]; }));
  }
  const out = [];
  for (let k = 0; k + 1 < n; k++) {
    const A = rings[k], B = rings[k + 1], axis = [c[0], c[1], (A[0][2] + B[0][2]) / 2];
    for (let i = 0; i < SIDES; i++) {
      const j = (i + 1) % SIDES, wpts = [A[i], A[j], B[j], B[i]];
      let nrm = newell(wpts);
      if (dot3(nrm, sub3(centroid(wpts), axis)) < 0) nrm = [-nrm[0], -nrm[1], -nrm[2]];
      out.push({ corners: wpts, region: 'shirt', part: 'skirt', normal: nrm, group: 'skirt' });
    }
  }
  return { faces: out, hem };
}

// ── geometry bake (memoized per archetype+pose) ─────────────────────────────────────
// Re-mesh the posed protoform at LOD from its ring-stacks, in render units rotated so
// the FRONT is +x (figure front is +y; (x,y)→(y,-x) is a −90° turn), centred on x/y,
// feet at z=0. Stores {corners, region, normal} — colour is deferred to the instance.
const _geomCache = new Map();
function bakeGeometry(archetypeKey, poseKey, lod = 'city', cutKey = null) {
  const key = `${archetypeKey}:${poseKey}:${lod}:${cutKey}${mathKey()}`;
  const cut = cutKey ? CUTS[cutKey] : null;
  const L = LODS[lod] || LODS.city;
  const stride = L.cap ? (n, max) => Math.max(1, Math.ceil(n / max)) : strideFloor;
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
  const skirt = cut ? skirtFaces(stacks, V, cut) : null;
  for (const st of stacks) {
    const rings = st.rings; if (rings.length < 2 || (L.skip && L.skip.test(st.id))) continue;
    if (skirt && /^(diaper|glute|groin|hipCap)/.test(st.id)) continue;   // under the skirt
    const region = regionOf(st.id), leg = st.id.startsWith('leg'), forearm = st.id.startsWith('forearm');
    const rs = stride(rings.length - 1, leg && L.legRings ? L.legRings : L.rings);
    const idx = [];
    for (let i = 0; i < rings.length; i += rs) idx.push(i);
    if (idx[idx.length - 1] !== rings.length - 1) idx.push(rings.length - 1);
    for (let k = 0; k < idx.length - 1; k++) {
      const ra = rings[idx[k]], rb = rings[idx[k + 1]];
      const a = ra.polyline, b = rb.polyline, m = Math.min(a.length, b.length); if (m < 2) continue;
      const ss = stride(m - 1, L.samples);
      // a leg's rings run hip → ankle: its upper half is the thigh (a tunic's hem covers it), the lower the shin
      // (and a forearm its own part, so a long sleeve can cover it)
      const part = leg ? (idx[k] < (rings.length - 1) / 2 ? 'thigh' : 'shin') : forearm ? 'forearm' : null;
      if (skirt && leg && V(rb.center)[2] > skirt.hem + 0.05) continue;   // a leg quad wholly under the skirt
      const c0 = ra.center, c1 = rb.center;
      const cw = V({ x: (c0.x + c1.x) / 2, y: (c0.y + c1.y) / 2, z: (c0.z + c1.z) / 2 });
      for (let j = 0; j + 1 < m; j += ss) {
        const j2 = Math.min(j + ss, m - 1); if (j2 === j) continue;
        const wpts = [V(a[j]), V(a[j2]), V(b[j2]), V(b[j])];
        let n = newell(wpts); const cen = centroid(wpts);
        if (dot3(n, sub3(cen, cw)) < 0) n = [-n[0], -n[1], -n[2]];
        for (const [x, y] of wpts) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
        raw.push({ corners: wpts, region, part, normal: n, group: st.id });
      }
    }
  }
  if (skirt) for (const f of skirt.faces) { for (const [x, y] of f.corners) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; } raw.push(f); }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const vn = smoothCorners(raw);   // the corner normals, for a `smooth` instance
  const baked = raw.map((f, i) => ({
    region: f.region,
    part: f.part,
    normal: f.normal,
    vn: vn[i],
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
export function pedestrianFaces({ cx = 0, cy = 0, heading = 0, scale = 1, archetype = 'adultM', pose = 'idleL', palette = PALETTES[0], lod = 'city', cut = null, smooth = false } = {}) {
  const baked = bakeGeometry(archetype, pose, lod, cut);
  const u = FIG_UNIT * scale;
  const ct = SM.cos(heading), st = SM.sin(heading);
  return baked.map((f) => {
    // a palette may dress the thigh and shin apart, the forearm (a long sleeve) and the skirt of a `cut`; one that does
    // not dresses the leg as `pants`, the forearm as skin and the skirt as the shirt
    const hex = (f.part && palette[f.part]) || palette[f.region] || palette.shirt;
    return {
    fill: shadeHex(hex, f.normal, FIG_LIGHT),
    // `smooth`: each corner shaded by its averaged normal (./smooth-corners.js), so the form reads rounded, not faceted
    ...(smooth ? { cornerFills: f.vn.map((n) => shadeHex(hex, n, FIG_LIGHT)) } : {}),
    doubleSided: true,
    corners: f.corners.map(([x, y, z]) => {
      const px = x * u, py = y * u;
      return [cx + px * ct - py * st, cy + px * st + py * ct, z * u];
    }),
    };
  });
}

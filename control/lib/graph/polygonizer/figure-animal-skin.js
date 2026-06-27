/**
 * figure-animal-skin — the WELDED single-skin upgrade (v2 of the flesh model).
 *
 * The overlap-union flesh (figure-animal-flesh.js) draws each bone/joint/skull as a
 * separate part that the renderer depth-sorts — fast, but the parts intersect with
 * hard seams. This wraps the WHOLE figure (skull, legs, body) in ONE coherent skin:
 *
 *   1. assemble a global signed-distance FIELD — every bone a round cone, every joint
 *      a sphere, the torso masses + skull as more cones/spheres — smooth-unioned
 *      (`smin`) so junctions get CONCAVE fillets (limbs melt into the body), and
 *   2. surface it by marching each axis's cross-sections out to the iso-surface, so
 *      every ring sits on the one global surface → a single welded skin.
 *
 * Reuses the substrate's `sdRoundCone` + `smin` (vajra.js). Heavier than the overlap
 * model (ray-marches the field), so it's the "hero" path; the cheap overlap model
 * stays for lineups/iteration. Same knob set as the flesh, plus `blend` (fillet
 * softness) and march resolution. Returns render parts `{polylines, stroke}` in
 * STAND space. Chains (tail/neck) join as their own tubes (their roots are in the
 * field, so the body blends to them at the attachment).
 */
import { smin, sdRoundCone } from './vajra.js';
import { normalize3, sub3, cross3, FIGURE_EDGES } from './figure-vajra.js';

const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const lerp3 = (a, b, t) => add(a, mul(sub3(b, a), t));
const mid = (a, b) => lerp3(a, b, 0.5);
const vlen = (a) => Math.hypot(a.x, a.y, a.z);
const sdSphere = (p, c, r) => vlen(sub3(p, c)) - r;

export const SKIN_DEFAULT = {
  flesh: 1.2, thorax: 1.9, belly: 2.1, bellyDrop: 0.30, rump: 1.9, jointFill: 1.15, taper: 0.45,
  blend: 0.05,    // smin width (STAND) — joint fillet softness
  bound: 0.22,    // max march radius (STAND) — caps the through-body blowup at junctions
  N: 18, M: 26,   // rings per axis, points per ring (skin resolution)
  stroke: '#c8836a',
};

const boneKey = (a, b) => [a, b].sort().join('|');
const BODY_BONES = FIGURE_EDGES.flatMap(({ tri: [p, c, d] }) => [[p, c], [c, d]]);
const THORAX = boneKey('neckHub', 'navel'), BELLY = boneKey('navel', 'pelvisHub'), SKULLB = boneKey('headTop', 'headBase');
const HIP = new Set([boneKey('hipL', 'pelvisHub'), boneKey('pelvisHub', 'hipR')]);
const LEAF = new Set(['wristL', 'wristR', 'ankleL', 'ankleR', 'headTop']);
// The girdle cross-connectors run laterally THROUGH the body; marching their
// cross-sections balloons (the ray stays inside across the whole torso). Keep them
// in the FIELD (they carry shoulder/hip width) but don't surface along them — the
// spine + limb axes already wrap that volume.
const GIRDLE = new Set([boneKey('shoulderL', 'neckHub'), boneKey('neckHub', 'shoulderR'), boneKey('hipL', 'pelvisHub'), boneKey('pelvisHub', 'hipR')]);

function frameOf(t) {
  let up = { x: 0, y: 0, z: 1 }, side = cross3(up, t);
  if (vlen(side) < 1e-6) { up = { x: 1, y: 0, z: 0 }; side = cross3(up, t); }
  side = normalize3(side);
  return { side, up: normalize3(cross3(t, side)) };
}

// The skull as a few field primitives (cranium sphere + muzzle/jaw/beak cones).
function skullPrims(skull, w0) {
  const { anchor, cfg } = skull, dir = normalize3(skull.dir), { up } = frameOf(dir);
  const L = cfg.length, w = cfg.width, tip = add(anchor, mul(dir, L)), prims = [];
  prims.push({ c: add(anchor, add(mul(dir, L * 0.18), mul(up, w * 0.15 * cfg.dome))), r: w });            // cranium
  prims.push({ a: add(anchor, mul(dir, L * 0.30)), b: add(tip, mul(up, -w * cfg.muzzleDrop)), ra: w * 0.62, rb: w * cfg.snout });   // muzzle
  if (cfg.jaw > 0) {                                                                                       // lower jaw
    const drop = mul(up, -(w * (0.5 + 0.5 * cfg.jaw)));
    prims.push({ a: add(add(anchor, mul(dir, L * 0.18)), drop), b: add(add(tip, mul(dir, -L * 0.06)), drop), ra: w * 0.42 * cfg.jaw, rb: w * Math.max(cfg.snout * 0.7, 0.18) });
  }
  if (cfg.beak > 0) prims.push({ a: tip, b: add(tip, add(mul(dir, L * cfg.beak), mul(up, -w * cfg.beak * 0.5))), ra: w * cfg.snout, rb: w * 0.07 });   // beak
  return prims;
}

// Assemble the global field primitives + the axes to surface along.
function buildField(nodes, radii, chains, skull, c) {
  const rOf = (k) => radii[k] * c.flesh * (LEAF.has(k) ? c.taper : 1);
  const prims = [], axes = [];
  for (const [a, b] of BODY_BONES) {
    if (!nodes[a] || !nodes[b]) continue;
    const k = boneKey(a, b);
    if (k === SKULLB) continue;                       // skull provides the cranium
    const mult = k === THORAX ? c.thorax : k === BELLY ? c.belly : HIP.has(k) ? c.rump : 1;
    const seg = { a: nodes[a], b: nodes[b], ra: rOf(a) * mult, rb: rOf(b) * mult };
    prims.push(seg);
    if (!GIRDLE.has(k)) axes.push(seg);               // surface long axes only; girdles stay in the field
  }
  const navelFill = 1 + ((c.thorax + c.belly) / 2 - 1) * 0.5;
  const NF = { navel: navelFill, pelvisHub: c.rump, hipL: c.rump, hipR: c.rump };
  for (const k of Object.keys(radii)) {
    if (!nodes[k] || k === 'headTop') continue;
    prims.push({ c: nodes[k], r: rOf(k) * c.jointFill * (NF[k] || 1) });
  }
  // a dropped belly mass (the gut hangs below the spine)
  prims.push({ c: add(mid(nodes.navel, nodes.pelvisHub), { x: 0, y: 0, z: -c.bellyDrop * rOf('navel') * c.belly }), r: rOf('navel') * c.belly });
  for (const ch of chains) for (const s of ch.spheres) prims.push({ c: s.pos, r: s.r });   // chain volume / root blend
  if (skull) {
    prims.push(...skullPrims(skull));
    const dir = normalize3(skull.dir);
    axes.push({ a: skull.anchor, b: add(skull.anchor, mul(dir, skull.cfg.length)) });      // surface the head too
  }
  return { prims, axes };
}

function makeField(prims, k) {
  return (p) => {
    let d = Infinity, first = true;
    for (const pr of prims) {
      const dd = pr.r !== undefined ? sdSphere(p, pr.c, pr.r) : sdRoundCone(p, pr.a, pr.b, pr.ra, pr.rb);
      d = first ? dd : smin(d, dd, k); first = false;
    }
    return d;
  };
}

// March outward from `o` along `dir` to the first iso-surface crossing (≤ bound).
function marchRadius(field, o, dir, bound) {
  const at = (s) => field(add(o, mul(dir, s)));
  const coarse = 48, step = bound / coarse;
  let lo = 0, hi = bound, found = false;
  for (let i = 1; i <= coarse; i++) { const s = i * step; if (at(s) > 0) { lo = (i - 1) * step; hi = s; found = true; break; } }
  if (!found) return bound;
  for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (at(m) > 0) hi = m; else lo = m; }
  return (lo + hi) / 2;
}

function marchAxis(field, a, b, c) {
  const t = sub3(b, a);
  if (vlen(t) < 1e-6) return null;
  const T = normalize3(t), { side, up } = frameOf(T), rings = [];
  for (let i = 0; i < c.N; i++) {
    const center = lerp3(a, b, i / (c.N - 1)), poly = [];
    for (let j = 0; j <= c.M; j++) {
      const ang = (j / c.M) * Math.PI * 2, dir = add(mul(side, Math.cos(ang)), mul(up, Math.sin(ang)));
      poly.push(add(center, mul(dir, marchRadius(field, center, dir, c.bound))));
    }
    rings.push(poly);
  }
  return { polylines: rings, stroke: c.stroke };
}

/**
 * Wrap the whole figure (skull + legs + body) in one welded skin. Chains pass in
 * for field blending at their roots; render them as their own tubes alongside.
 * @returns {{polylines:{x,y,z}[][], stroke:string}[]}  STAND-space skin parts
 */
export function animalSkin(nodes, radii, chains = [], skull = null, cfg = {}) {
  const c = { ...SKIN_DEFAULT, ...cfg };
  const { prims, axes } = buildField(nodes, radii, chains, skull, c);
  const field = makeField(prims, c.blend);
  return axes.map((seg) => marchAxis(field, seg.a, seg.b, c)).filter(Boolean);
}

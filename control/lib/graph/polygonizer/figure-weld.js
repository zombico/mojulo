/**
 * figure-weld — the SEAMLESS upgrade of the fluff body. The fluff builder
 * (figure-fluff.js) emits each bulb/pipe as its own ring-stack shell; overlapping
 * shells intersect with hard seams (visible once tessellation is high). This welds
 * them: assemble a signed-distance FIELD (every bulb an ellipsoid, every pipe a
 * round cone), smooth-union them (`smin` → concave fillets so parts melt together),
 * and surface the field by MARCHING each shape's axis out to the iso-surface — every
 * ring lands on the ONE global surface, so overlapping parts fuse into a single skin.
 *
 * Fluffs are grouped BY COLOUR first, so each material (skin / vest / shorts / hair /
 * shoes) is its own welded field → one seamless surface per colour, with clean
 * boundaries where colours meet (a sleeve hem over skin). Reuses vajra's smin +
 * sdRoundCone — the same core as the animal welded skin (figure-animal-skin.js).
 *
 * Output is the fluff/proto ring-stack currency ({ id, hex, rings:[{center,polyline}] },
 * world = STAND × scale), so buildPosedFigure's warp/garment/mesher path eats it
 * unchanged.
 */
import { smin, sdRoundCone } from './vajra.js';
import { normalize3, sub3, cross3 } from './figure-vajra.js';

const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const lerp3 = (a, b, t) => add(a, mul(sub3(b, a), t));
const vlen = (a) => Math.hypot(a.x, a.y, a.z);
const biasOf = (b) => ({ x: b?.x || 0, y: b?.y || 0, z: b?.z || 0 });

// squashed-sphere (ellipsoid, z-scaled) iso-field: zero on the surface. Not a true
// distance but the sign + zero-set are right, which is all the marcher/smin need.
function sdEllip(p, c, r, sq) {
  const dz = (p.z - c.z) / (sq || 1);
  return Math.hypot(p.x - c.x, p.y - c.y, dz) - r;
}

// an orthonormal frame perpendicular to a unit tangent T (for the ring around an axis)
function frameOf(T) {
  const up0 = Math.abs(T.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
  const side = normalize3(cross3(T, up0));
  const up = normalize3(cross3(side, T));
  return { side, up };
}

// prims: { kind:'sphere', c, r, sq } | { kind:'cone', a, b, ra, rb }. smin-unioned.
function makeField(prims, k) {
  return (p) => {
    let d = Infinity;
    for (const pr of prims) {
      const dd = pr.kind === 'cone' ? sdRoundCone(p, pr.a, pr.b, pr.ra, pr.rb) : sdEllip(p, pr.c, pr.r, pr.sq);
      d = d === Infinity ? dd : smin(d, dd, k);
    }
    return d;
  };
}

// march outward from o along dir to the first iso crossing (≤ bound)
function marchRadius(field, o, dir, bound) {
  const at = (s) => field(add(o, mul(dir, s)));
  const coarse = 40, step = bound / coarse;
  let lo = 0, hi = bound, found = false;
  for (let i = 1; i <= coarse; i++) { const s = i * step; if (at(s) > 0) { lo = (i - 1) * step; hi = s; found = true; break; } }
  if (!found) return bound;
  for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; if (at(m) > 0) hi = m; else lo = m; }
  return (lo + hi) / 2;
}

// surface the field along the axis a→b: N cross-sections, each M rays marched to the
// surface. `inflate` pushes the shell outward (outer layers sit proud of the skin
// beneath → clean material boundaries instead of z-fight teeth at hems).
function marchAxis(field, a, b, N, M, bound, inflate = 0) {
  const t = sub3(b, a);
  if (vlen(t) < 1e-6) return null;
  const T = normalize3(t), { side, up } = frameOf(T), rings = [];
  for (let i = 0; i < N; i++) {
    const center = lerp3(a, b, i / (N - 1)), poly = [];
    for (let j = 0; j <= M; j++) {
      const ang = (j / M) * Math.PI * 2, dir = add(mul(side, Math.cos(ang)), mul(up, Math.sin(ang)));
      poly.push(add(center, mul(dir, marchRadius(field, center, dir, bound) + inflate)));
    }
    rings.push({ center, polyline: poly });
  }
  return rings;
}

// resolve a segment shape → a round-cone prim (+ a belly sphere for a football)
function segPrims(spec, a, b) {
  const g = spec.girth ?? 0.03;
  if (spec.shape === 'cone') return [{ kind: 'cone', a, b, ra: g, rb: Math.max(1e-3, g * (spec.taper ?? 0.55)) }];
  if (spec.shape === 'football') {
    const peak = spec.peak ?? 0.5;
    return [{ kind: 'cone', a, b, ra: g * 0.5, rb: g * 0.5 }, { kind: 'sphere', c: lerp3(a, b, peak), r: g, sq: 1 }];
  }
  if (spec.shape === 'bell') return [{ kind: 'cone', a, b, ra: g, rb: spec.mouth ?? g * 2 }];
  // slab → a rounded capsule (loses the box cross-section; a rounder torso reads fine welded)
  return [{ kind: 'cone', a, b, ra: g, rb: Math.max(1e-3, g * (spec.taper ?? 1)) }];
}

/**
 * Weld fluff specs into per-colour single skins.
 * @param {object} positions  armature landmark map (STAND space)
 * @param {Array}  fluffs      structural fluff specs (face/detail overlays excluded)
 * @param {object} opts        { scale=12, blend=0.02, N=12, M=32, bound=0.42, headN=14 }
 * @returns {Array<{id,hex,rings}>}  welded ring-stacks, world = STAND × scale
 */
export function weldFluffs(positions, fluffs, opts = {}) {
  const { scale = 12, blend = 0.02, N = 12, M = 32, bound = 0.42, beadN = 14, inflate = 0, inflateColors = [] } = opts;
  const toWorld = (q) => ({ x: q.x * scale, y: q.y * scale, z: q.z * scale });
  const centroid = (poly) => { let x = 0, y = 0, z = 0; for (const p of poly) { x += p.x; y += p.y; z += p.z; } const n = poly.length || 1; return { x: x / n, y: y / n, z: z / n }; };

  // group by colour → one welded field per material
  const groups = new Map();
  for (const f of fluffs) { const key = f.hex || '#c8836a'; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(f); }

  const out = [];
  for (const [hex, specs] of groups) {
    const prims = [], marches = [];   // marches: { a, b, n } axes to surface (segment axis, or a bead's own z-axis)
    for (const f of specs) {
      if (f.node) {
        const c = add(positions[f.node], biasOf(f.bias)), r = f.r ?? 0.03, sq = f.squash ?? 1;
        prims.push({ kind: 'sphere', c, r, sq });
        const half = r * sq;
        marches.push({ a: { x: c.x, y: c.y, z: c.z - half }, b: { x: c.x, y: c.y, z: c.z + half }, n: beadN });   // surface the ball via its own vertical axis
      } else {
        const a = positions[f.segment[0]], b = positions[f.segment[1]];
        prims.push(...segPrims(f, a, b));
        marches.push({ a, b, n: N });
      }
    }
    const field = makeField(prims, blend);
    const inf = inflateColors.includes(hex) ? inflate : 0;   // outer layers (clothing/hair) sit proud of skin
    let i = 0;
    for (const m of marches) {
      const rings = marchAxis(field, m.a, m.b, m.n, M, bound, inf);
      if (!rings || rings.length < 2) continue;
      out.push({ id: `weld:${hex}:${i++}`, hex, rings: rings.map((rg) => ({ center: toWorld(rg.center), polyline: rg.polyline.map(toWorld) })) });
    }
  }
  return out;
}

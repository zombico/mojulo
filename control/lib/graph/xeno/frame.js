/**
 * THE XENO FRAME: where a make-up appliance sits on whichever head the hero wears, found on that head's own skin.
 *
 * Every hero head is a carrier rigged to the head (the landmark and the anime heads' `cranium`, the realistic head's
 * `headSkin`) with what it shows pinned to it. The frame compiles the head's visible skin (the landmark head's cranium
 * and jaw, the anime head's `face`, the realistic `headSkin`) into the hero's metres, reads its measures off it (the
 * crown, the chin, the brow line from the brows the head carries, the nose's tip, its width, its front and its back),
 * and answers where a point on it is: a ray cast onto the skin from outside, its normal outward. An appliance built from
 * those points is pinned to the carrier where the head bone alone carries it, so it turns, talks and exports with the
 * head (polygonizer/hero-head-layers.js pins the realistic head's jewellery and hair the same way).
 *
 *   xenoFrame(recipe) → { head, carrier, centre, crownZ, chinZ, browZ, noseTip, halfWidth, height, frontY, backY,
 *                         front(x, z), back(x, z), sagittal(phi, x), backOfBodyAt(z), pinNear(p), frameOf(pin) } | null
 *
 * Front is +y, up is +z, metres (the hero's native frame). Pure, deterministic.
 */
import { compileLayered, pinFrame } from '../polygonizer/station-loft.js';

/** each head, by the parts that make it: its carrier, the parts its visible skin is, the brows it carries */
const HEADS = Object.freeze([
  Object.freeze({ head: 'realistic', carrier: 'headSkin', skin: ['headSkin'], brows: ['hairBrows'] }),
  Object.freeze({ head: 'anime', carrier: 'cranium', skin: ['face'], brows: ['browR', 'browL'] }),
  Object.freeze({ head: 'landmark', carrier: 'cranium', skin: ['cranium', 'jaw'], brows: ['browR', 'browL'] }),
]);

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** the parts to compile: the named ones and every part they are pinned to, down to an L1 */
function withParents(parts, names) {
  const out = {}, add1 = (n) => { const P = parts[n]; if (!P || out[n]) return; out[n] = P; if (P.pin?.parent) add1(P.pin.parent); };
  names.forEach(add1);
  return out;
}

/** The frame of the head a recipe carries, or null when it carries none the frame knows (a blank trunk, a beast's skull). */
export function xenoFrame(recipe) {
  const R = recipe?.parts || {};
  const H = HEADS.find((h) => R[h.carrier] && h.skin.every((n) => R[n]));
  if (!H) return null;
  const brows = H.brows.filter((n) => R[n]);
  const body = ['neck', 'torso'].filter((n) => R[n]);
  const comp = compileLayered({ parts: withParents(R, [H.carrier, ...H.skin, ...brows, ...body]), dials: {}, creases: {} }).parts;
  const tris = [];
  for (const n of H.skin) { const P = comp[n]; if (!P) continue; for (const f of Object.values(P.faces)) tris.push(f.map((id) => P.points[id])); }
  if (!tris.length) return null;
  const pts = tris.flat(), lo = [0, 1, 2].map((k) => Math.min(...pts.map((p) => p[k]))), hi = [0, 1, 2].map((k) => Math.max(...pts.map((p) => p[k])));
  const centre = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2], height = hi[2] - lo[2];
  const browPts = brows.flatMap((n) => Object.values(comp[n]?.points || {}));
  const browZ = browPts.length ? browPts.reduce((s, p) => s + p[2], 0) / browPts.length : lo[2] + 0.6 * height;
  const mid = pts.filter((p) => Math.abs(p[0] - centre[0]) < 0.004 && p[2] < browZ);
  const noseTip = mid.length ? mid.reduce((b, p) => (p[1] > b[1] ? p : b)) : [centre[0], hi[1], lo[2] + 0.35 * height];

  // a ray onto the skin: the first hit from `origin` along `dir`, its normal turned away from the head's centre
  const cast = (origin, dir) => {
    let best = Infinity, hit = null;
    for (const [a, b, c] of tris) {
      const e1 = sub(b, a), e2 = sub(c, a), pv = cross(dir, e2), det = dot(e1, pv);
      if (Math.abs(det) < 1e-12) continue;
      const inv = 1 / det, tv = sub(origin, a), u = dot(tv, pv) * inv; if (u < 0 || u > 1) continue;
      const qv = cross(tv, e1), v = dot(dir, qv) * inv; if (v < 0 || u + v > 1) continue;
      const t = dot(e2, qv) * inv; if (t > 1e-9 && t < best) { best = t; hit = [a, b, c]; }
    }
    if (!hit) return null;
    const p = add(origin, mul(dir, best));
    let n = unit(cross(sub(hit[1], hit[0]), sub(hit[2], hit[0])));
    if (dot(n, sub(p, centre)) < 0) n = mul(n, -1);
    return { p, n };
  };
  const reach = 2 * height + 1;
  const front = (x, z) => cast([centre[0] + x, hi[1] + reach, z], [0, -1, 0]);
  const back = (x, z) => cast([centre[0] + x, lo[1] - reach, z], [0, 1, 0]);
  // in the head's middle plane (offset `x`), at `phi` from the front (0) over the crown (90°) to the back (180°)
  const sagittal = (phi, x = 0) => { const d = [0, Math.cos(phi), Math.sin(phi)], o = add(add(centre, [x, 0, 0]), mul(d, reach)); return cast(o, mul(d, -1)); };

  // the body under the head: the back's surface at a height (the least y of the neck's and the torso's points near it)
  const bodyPts = body.flatMap((n) => Object.values(comp[n]?.points || {}));
  const backOfBodyAt = (z, band = 0.03) => { let m = Infinity; for (const p of bodyPts) if (Math.abs(p[2] - z) < band && p[1] < m) m = p[1]; return Number.isFinite(m) ? m : null; };

  // the pin: the carrier's face nearest a point that the head bone alone carries (a blended face, the jaw's, is passed by)
  const carrier = comp[H.carrier], blend = R[H.carrier].bind?.blend || null;
  const onlyHead = (pid) => { if (!blend) return true; const b = blend[pid.slice(pid.indexOf('/') + 1)] ?? { head: 1 }; return (b.head ?? 0) >= 0.999; };
  const faces = Object.entries(carrier.faces).filter(([, f]) => f.every(onlyHead)).map(([id, f]) => [id, f, [0, 1, 2].map((k) => f.reduce((s, q) => s + carrier.points[q][k], 0) / 3)]);
  const pinNear = (p) => {
    let best = null, bd = Infinity;
    for (const [id, f, c] of faces) { const d = Math.hypot(c[0] - p[0], c[1] - p[1], c[2] - p[2]); if (d < bd) { bd = d; best = { parent: H.carrier, face: id, weights: [0.25, 0.25, 0.5], tangentEdge: [f[0], f[1]], handedness: 1 }; } }
    return best;
  };
  const frameOf = (pin) => pinFrame(carrier, pin);

  return {
    head: H.head, carrier: H.carrier, centre, crownZ: hi[2], chinZ: lo[2], browZ, noseTip, halfWidth: (hi[0] - lo[0]) / 2, height, frontY: hi[1], backY: lo[1],
    front, back, sagittal, backOfBodyAt, pinNear, frameOf,
  };
}

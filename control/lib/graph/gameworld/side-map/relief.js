/**
 * THE DRAWN RELIEF (docs/side-map-principles.md "The look"): the cake's painted pieces drawn with their depth, as a
 * pixel artist shades relief, never built: each piece a hair proud of its face takes a lit edge toward the light and a
 * crisp shadow away from it, so the world reads carved, riveted and coursed without a face more of geometry. The light
 * is the shadows' (shadow.js): from up the lane's start and above (the frame's upper left), its shadow down the lane and
 * down (the lower right).
 *
 *   PROUD    a panel, a conduit, a rib, a bracket, a label, a pipe, the icing's cap, a rivet: a lit band along its top
 *            and its left, and a DROP SHADOW on what is behind it, its own shape offset down and right (a bigger piece
 *            stands prouder: its offset a share of its smaller side, within `drop`)
 *   GROOVE   a mortar line, a cap's joint (thin, sunk): the stone over it and left of it in shade, the stone under it and
 *            right of it catching the light (each stone reads raised from its mortar)
 *   RECESS   a vent, a niche, a crack: its lip's shadow inside along its top and left, a lit band inside along its bottom
 *            and right
 *
 *   RELIEF                    the numbers
 *   reliefFaces(faces) → the faces the pieces' relief adds (each a quad toward the camera in a piece's or its backing's
 *     colour lightened or darkened, group `sidemap:paint-relief-hi` | `-lo`), lit by the map's light as any face is
 *
 * Pure and deterministic: the same faces, the same relief.
 */
export const RELIEF = Object.freeze({ hi: 0.03, lo: 0.035, drop: Object.freeze([0.025, 0.07]), dropK: 0.22, light: 1.22, dark: 0.55, lift: 0.002 });

const PROUD = /^sidemap:paint-(cap|cake-panel|cake-conduit|cake-bracket|cake-label|cake-rib|cake-light|pipes|lamp-panel|cap-rivet|cap-hazard)$/;
const GROOVE = /^sidemap:paint-(course|stone|cap-joint)$/;
const RECESS = /^sidemap:paint-(cake-vent|niche|break)$/;
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const hexMul = (h, k, white = 0) => `#${[1, 3, 5].map((i) => { const v = parseInt(h.slice(i, i + 2), 16) / 255; return Math.round(255 * Math.min(1, v * k + white)).toString(16).padStart(2, '0'); }).join('')}`;

// a face toward the camera as a rectangle on the frame: { x, s0, s1, z0, z1 }, or null
const rectOf = (f) => {
  if (!f || !Array.isArray(f.corners) || f.corners.length !== 4 || !f.normal || f.normal[0] < 0.9) return null;
  const ss = f.corners.map((c) => c[1]), zs = f.corners.map((c) => c[2]);
  return { x: f.corners[0][0], s0: Math.min(...ss), s1: Math.max(...ss), z0: Math.min(...zs), z1: Math.max(...zs) };
};
const quad = (x, s0, s1, z0, z1, fill, group) => ({ corners: [[r4(x), r4(s0), r4(z0)], [r4(x), r4(s1), r4(z0)], [r4(x), r4(s1), r4(z1)], [r4(x), r4(s0), r4(z1)]], normal: [1, 0, 0], fill, group });

/** The relief the painted pieces add. */
export function reliefFaces(faces) {
  const R = RELIEF, out = [], rects = faces.map((f) => [f, rectOf(f)]).filter(([, r]) => r);
  // (what is behind a point: the face toward the camera nearest under a piece at x, holding (s, z))
  const behind = (x, s, z) => { let best = null; for (const [f, r] of rects) if (r.x < x - 1e-4 && s >= r.s0 && s <= r.s1 && z >= r.z0 && z <= r.z1 && (!best || r.x > best[1].x)) best = [f, r]; return best; };
  const HI = 'sidemap:paint-relief-hi', LO = 'sidemap:paint-relief-lo';
  for (const [f, r] of rects) {
    const w = r.s1 - r.s0, h = r.z1 - r.z0, small = Math.min(w, h);
    if (small < 1e-3) continue;
    if (PROUD.test(f.group)) {
      // its lit edges, on it
      const b = Math.min(R.hi, small / 3);
      out.push(quad(r.x + R.lift, r.s0, r.s1, r.z1 - b, r.z1, hexMul(f.fill, R.light, 0.02), HI));
      out.push(quad(r.x + R.lift, r.s0, r.s0 + b, r.z0, r.z1 - b, hexMul(f.fill, R.light, 0.02), HI));
      // its drop shadow, behind it, on what it stands on: its shape offset down and right, cut to that face
      const d = Math.max(R.drop[0], Math.min(R.drop[1], small * R.dropK)), ds = d * 0.73, dz = d;
      const back = behind(r.x, Math.min(r.s1 + ds * 0.5, r.s1), Math.max(r.z0 - dz * 0.5, r.z0));
      if (!back) continue;
      const [bf, br] = back, s0 = Math.max(br.s0, r.s0 + ds), s1 = Math.min(br.s1, r.s1 + ds), z0 = Math.max(br.z0, r.z0 - dz), z1 = Math.min(br.z1, r.z1 - dz);
      // (only the rim it shows past the piece, an L down its right and along its foot: never under the piece, where a
      // depth a hair apart would show through it)
      const fillLo = hexMul(bf.fill, R.dark), x = r.x - R.lift;
      if (s1 - Math.max(s0, r.s1) > 1e-3 && z1 - z0 > 1e-3) out.push(quad(x, Math.max(s0, r.s1), s1, z0, z1, fillLo, LO));
      if (Math.min(s1, r.s1) - s0 > 1e-3 && Math.min(z1, r.z0) - z0 > 1e-3) out.push(quad(x, s0, Math.min(s1, r.s1), z0, Math.min(z1, r.z0), fillLo, LO));
    } else if (GROOVE.test(f.group)) {
      // the stones round it: over and left in shade, under and right lit (the groove is thin: its bands lie beside it)
      const horiz = w >= h, b = R.lo, x = r.x + R.lift;
      const near = behind(r.x, (r.s0 + r.s1) / 2, (r.z0 + r.z1) / 2);
      const base = near ? near[0].fill : f.fill;
      if (horiz) { out.push(quad(x, r.s0, r.s1, r.z1, r.z1 + b, hexMul(base, R.dark + 0.2), LO)); out.push(quad(x, r.s0, r.s1, r.z0 - b, r.z0, hexMul(base, R.light, 0.02), HI)); }
      else { out.push(quad(x, r.s0 - b, r.s0, r.z0, r.z1, hexMul(base, R.dark + 0.2), LO)); out.push(quad(x, r.s1, r.s1 + b, r.z0, r.z1, hexMul(base, R.light, 0.02), HI)); }
    } else if (RECESS.test(f.group)) {
      // its lip's shadow inside, top and left; its far walls lit inside, bottom and right
      const b = Math.min(R.lo, small / 3), x = r.x + R.lift;
      out.push(quad(x, r.s0, r.s1, r.z1 - b, r.z1, hexMul(f.fill, R.dark), LO));
      out.push(quad(x, r.s0, r.s0 + b, r.z0, r.z1 - b, hexMul(f.fill, R.dark), LO));
      out.push(quad(x, r.s0 + b, r.s1, r.z0, r.z0 + b, hexMul(f.fill, R.light, 0.03), HI));
      out.push(quad(x, r.s1 - b, r.s1, r.z0 + b, r.z1 - b, hexMul(f.fill, R.light, 0.03), HI));
    }
  }
  return out;
}

/**
 * head-ear — the EAR worn by the landmark and the anime head: a side shape, not an egg, and the volume inside it.
 *
 * The SIDE SHAPE is an outline in the ear's own plane (unit height; `u` forward, `v` up, the bowl's centre at the
 * origin): the helix arching over the top and down the back, wider above, into a narrower rounded lobe, the front edge
 * with the tragus and the notch under it. The ear's long axis leans back (`tilt`).
 *
 * The ear is a thin PLATE (a leaf, a petal) hinged at its front and angled off the head toward its back, its relief on
 * the front face: the helix rim, the fold inside the rim, the antihelix ridge (the western ear only), and the bowl (the
 * concha) dipping toward the head at the centre, the cap. The lobe stays solid. The bowl's faces carry the inner group
 * (the landmark head's darker `EarInner`), so the light, the ink and the tone read its depth.
 *
 * Closed by construction (a tube of rings with a cap at each end), outward by its signed volume; the left ear is the
 * right's mirror.
 */
import * as dmath from '../../util/dmath.js';

const add = (a, b) => a.map((x, i) => x + b[i]); const mul = (a, s) => a.map((x) => x * s);
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** the outline, traced from the operator's sketch (unit height, `u` forward, `v` up, about the bowl): the helix root
 * over the face, the broad top, the back nearly straight, the lower back on a diagonal into a broad lobe, the front up
 * past the tragus. `open` marks the front points where the rim stops (the bowl opens to the face there). */
const OUTLINE = [[0.196, 0.212], [0.148, 0.36], [0.085, 0.481], [-0.106, 0.519], [-0.365, 0.492], [-0.413, 0.307],
  [-0.402, 0.074], [-0.418, 0.011], [-0.37, -0.138], [-0.286, -0.243], [-0.222, -0.312], [-0.106, -0.423], [0.021, -0.481],
  [0.138, -0.471], [0.196, -0.434], [0.185, -0.328], [0.175, -0.201, 'open'], [0.153, -0.127, 'open'], [0.164, 0, 'open'], [0.169, 0.106, 'open']];
/** The ear is a PLATE, thin as a leaf (`thick`), hinged at its front edge (u = HINGE) and angled off the head toward
 * its back (`angle`); `lift` raises the whole plate (× height) so it stands clear of the hair over the side of the head.
 * Its front face carries the relief, each ring [the scale toward the bowl, the relief off the plate (× height), a fold
 * ring (in the lobe kept at the rim's relief near the outline; past the open front kept flat)]: the edge, the rim, the
 * fold inside it (the scapha), the antihelix ridge, the bowl's wall and its floor, and the cap (the bowl, dipping toward
 * the head). Its back face is the outline at the plate's back; it sinks into the head toward the front, where the ear
 * joins it, and its cap (behind the bowl) is on the head. Below `lobe` the ear is solid. */
const HINGE = 0.19;
const FORM = {
  western: { rings: [[1, 0, false], [0.95, 0.05, false], [0.84, 0.015, true], [0.64, 0.04, true], [0.44, 0.005, true], [0.2, -0.03, true]], bowl: [0.06, -0.02, -0.035], lobe: -0.26, inner: 3 },
  // the anime ear: the rim, one fold, the bowl's wall and floor
  anime: { rings: [[1, 0, false], [0.94, 0.05, false], [0.72, 0.02, true], [0.48, -0.005, true], [0.22, -0.03, true]], bowl: [0.06, -0.02, -0.035], lobe: -0.26, inner: 2 },
};

/** earMesh({ origin, side, height, width, style, tilt, angle, thick, lift, inner, sparse }) → { points, faces, groups }:
 * the ear in hero metres. `origin` is the root's centre on the head, `side` +1 (right) or −1 (left), `height` the ear's
 * height, `width` its width over its height's outline width (1: the outline's own), `tilt` the lean back (radians),
 * `angle` the plate's angle off the head (radians), `thick` and `lift` (× height) the plate's thickness and its rise off
 * the head, `inner` the bowl's group, `sparse` every other outline point (a lighter register). */
export function earMesh({ origin, side = 1, height, width = 1, style = 'western', tilt = 0.2, angle = 0.45, thick = 0.07, lift = 0.12, inner = 'Skin', skin = 'Skin', sparse = false }) {
  const F = FORM[style]; if (!F) throw new Error(`head-ear: unknown style '${style}'`);
  const outline = sparse ? OUTLINE.filter((_, i) => i % 2 === 0) : OUTLINE, n = outline.length;
  const ct = dmath.cos(tilt), st = dmath.sin(tilt);
  // the ear's frame (the right ear): out +x, forward +y, up +z leaning back by `tilt`
  const ta = dmath.tan(angle), plate = (u) => lift + Math.max(0, HINGE - u) * ta;
  const at = ([u, v], h) => {
    const y = u * ct - v * st, z = u * st + v * ct;
    return add(origin, [side * h * height, y * width * height, z * height]);
  };
  const [bu, bv, bd] = F.bowl, centre = [bu, bv];
  const points = {}, faces = [], groups = [];
  const rim = F.rings[1][1];
  // the back face: the plate's back, sinking into the head over the front third (where the ear joins it)
  outline.forEach((p, k) => { const w = Math.max(0, Math.min(1, (p[0] + 0.05) / 0.2)); points[`r0_${k}`] = at(p, (1 - w) * (plate(p[0]) - thick) + w * -0.03); });
  F.rings.forEach(([s, relief, fold], r) => outline.forEach((p, k) => {
    // inside the lobe a fold ring keeps the rim's relief near the outline (the lobe is solid); past the open front a ring
    // stays near the outline and flat (no rim there: the bowl runs out to the face)
    const inLobe = fold && p[1] < F.lobe, open = p[2] === 'open' && r >= 1;
    // (each such ring a step further in than the last, so no two rings meet: no degenerate faces)
    const q = lerp2(centre, p, inLobe ? Math.max(s, 0.92 - 0.03 * r) : open ? Math.max(s, 0.88 - 0.04 * r) : s), rr = open ? Math.min(relief, 0) : inLobe ? rim : relief;
    points[`r${r + 1}_${k}`] = at(q, plate(q[0]) + rr);
  }));
  points.root = at(centre, -0.05); points.bowl = at(centre, plate(bu) + bd);
  const R = F.rings.length + 1, tri = (a, b, c, g) => { faces.push([a, b, c]); groups.push(g); };
  for (let r = 0; r < R - 1; r++) for (let k = 0; k < n; k++) {
    const k1 = (k + 1) % n, g = r >= R - 2 ? inner : skin;
    tri(`r${r}_${k}`, `r${r}_${k1}`, `r${r + 1}_${k1}`, g); tri(`r${r}_${k}`, `r${r + 1}_${k1}`, `r${r + 1}_${k}`, g);
  }
  for (let k = 0; k < n; k++) { const k1 = (k + 1) % n; tri(`r0_${k1}`, `r0_${k}`, 'root', skin); tri(`r${R - 1}_${k}`, `r${R - 1}_${k1}`, 'bowl', inner); }
  // outward: the signed volume about the centroid positive (the left ear, a mirror, comes out reversed and is flipped)
  const P = Object.values(points), c = [0, 1, 2].map((i) => P.reduce((t, p) => t + p[i], 0) / P.length);
  const sub = (a, b) => a.map((x, i) => x - b[i]), cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const vol = faces.reduce((t, f) => { const [a, b, d] = f.map((id) => sub(points[id], c)); const x = cross(b, d); return t + a[0] * x[0] + a[1] * x[1] + a[2] * x[2]; }, 0);
  if (vol < 0) for (const f of faces) f.reverse();
  return { points, faces, groups };
}

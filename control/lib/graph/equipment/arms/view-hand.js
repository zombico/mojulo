/**
 * THE HAND IN THE VIEW — the figures' own hand (polygonizer/hero-hand.js: a palm and five jointed digits) as a first
 * person's view draws it on a gun: one mesh, built at a run of curls from open to a fist by the hand's own rule (the
 * rig's links and their shares), so the page closes it by blending between them and solves nothing.
 *
 *   VIEW_HAND                the palm's length (m), how many curls, the pose words it runs between
 *   viewHand()               → { tris: [i…], curls: [[x, y, z, …] a curl], n } the right hand in the view's hand frame:
 *                              +x its thumb side, +y wrist to knuckles, the palm toward +z; a left hand is its mirror in z
 *
 * Pure, no dice: a function of the hand's form.
 */
import { heroHand, HAND_POSES, DIGITS } from '../../polygonizer/hero-hand.js';

// (a little over life, as a view held this near the eye draws its hands: they read past the sleeve and the gun)
export const VIEW_HAND = Object.freeze({ len: 0.112, curls: 6, from: 'open', to: 'fist' });
const r4 = (v) => Math.round(v * 10000) / 10000;

// one hand at a curl (0 open … 1 a fist), its rings as points in the view's frame
function handAt(t) {
  const a = HAND_POSES[VIEW_HAND.from], b = HAND_POSES[VIEW_HAND.to];
  const curl = Object.fromEntries(DIGITS.map((d) => [d, a[d] + (b[d] - a[d]) * t]));
  // (built along +x from a wrist at the origin: across toward the thumb is +y, out of the palm -z; the view's frame is
  // that turned: its x the thumb side, its y along the hand, its z out of the palm)
  return heroHand({ wrist: [0, 0, 0], elbow: [-0.26, 0, 0], len: VIEW_HAND.len, X: VIEW_HAND.len / 0.098, group: 'Glove', curl }).segments;
}
const toView = (p) => [r4(p[1]), r4(p[0]), r4(-p[2])];

let memo = null;
/** The view's hand (see the header). */
export function viewHand() {
  if (memo) return memo;
  const tris = [], curls = [];
  for (let k = 0; k < VIEW_HAND.curls; k++) {
    const segs = handAt(k / (VIEW_HAND.curls - 1)), pos = [];
    let base = 0;
    for (const S of segs) {
      const slots = Object.keys(S.stations[0].points), n = slots.length, rings = S.stations.length;
      for (const st of S.stations) for (const sl of slots) pos.push(...toView(st.points[sl]));
      pos.push(...toView(S.caps.back), ...toView(S.caps.tip));
      if (k === 0) {
        const at = (r, q) => base + r * n + (q % n), back = base + rings * n, tip = back + 1;
        for (let r = 0; r + 1 < rings; r++) for (let q = 0; q < n; q++) tris.push(at(r, q), at(r, q + 1), at(r + 1, q + 1), at(r, q), at(r + 1, q + 1), at(r + 1, q));
        for (let q = 0; q < n; q++) tris.push(at(rings - 1, q), at(rings - 1, q + 1), tip, at(0, q + 1), at(0, q), back);
      }
      base += rings * n + 2;
    }
    curls.push(pos);
  }
  memo = Object.freeze({ tris, curls, n: curls[0].length / 3 });
  return memo;
}

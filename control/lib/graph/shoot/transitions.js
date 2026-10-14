/**
 * Shoot plan — transitions, made of set pieces. A shot's `in: { type, duration, color?, dir? }` is how the cut into it
 * plays; it expands into keyed pieces on the outgoing camera over the last half of the duration and on the incoming
 * camera over the first half, sized from each lens at that moment to cover the frame:
 *
 *   cut    nothing (the default)
 *   fade   a flat just past the lens goes to `color` (default black) and comes back
 *   wipe   a flat slides across the lens and off the far side; `dir`: 'left' (enters from frame left) | 'right' | 'up' | 'down'
 *   iris   a frame closes its round hole on the lens and opens it again
 *   pipe   the camera flies into a ringed tube laid along its own path, capped past the cut, and the next shot flies
 *          out of one laid along its path (`profile: 'box'` makes it a corridor); a camera that barely moves over
 *          the half gets a straight tube slid over its lens instead
 *
 * The first shot's `in` plays only its incoming half (a fade up from black, an iris out). The pieces are ordinary
 * pieces (`generated: '<shot>'`): nothing renders a transition that a piece could not. Pure.
 */
import { compileCamera, cameraAt } from './sample.js';

export const TRANSITIONS = ['cut', 'fade', 'wipe', 'iris', 'pipe'];
const NEAR = 0.25;          // a transition flat sits this far down the lens (the page's near plane is 0.1)
const COVER = 1.8;          // and this much wider than the frame at the lens's field of view, for any aspect ≥ 0.6

/** `'fade'`, `{ type: 'wipe', duration: 1, dir: 'right' }` → a canonical transition, or null for a plain cut. */
export function normalizeTransition(v) {
  if (v == null) return null;
  const o = typeof v === 'string' ? { type: v } : v;
  const type = String(o.type || '').toLowerCase();
  if (!TRANSITIONS.includes(type) || type === 'cut') return null;
  const duration = Number.isFinite(o.duration) && o.duration > 0 ? Math.min(o.duration, 10) : (type === 'pipe' ? 1.6 : 0.8);
  return {
    type, duration,
    ...(typeof o.color === 'string' && /^#[0-9a-f]{6}$/i.test(o.color) ? { color: o.color.toLowerCase() } : {}),
    ...(type === 'wipe' && ['left', 'right', 'up', 'down'].includes(o.dir) ? { dir: o.dir } : {}),
    ...(type === 'pipe' && Number.isFinite(o.radius) && o.radius > 0 ? { radius: o.radius } : {}),
    ...(type === 'pipe' && o.profile === 'box' ? { profile: 'box' } : {}),
  };
}

// the two halves of one transition: the pieces a side wears, keyed closed→ or →open over [t0, t1]
function sidePieces(tr, side, w) {
  const { t0, t1, closing } = side;
  const [from, to] = closing ? [0, 1] : [1, 0];           // 0 = the picture clear, 1 = covered
  const ease = closing ? 'easy_ease_in' : 'easy_ease_out';
  const color = tr.color || '#000000';
  const key = (t, extra) => ({ t, ease, ...extra });
  const base = { attach: side.camera, shots: [side.shot], visible: [t0, t1 + (closing ? 1e-3 : 0)], generated: side.shotIn };
  if (tr.type === 'fade') {
    return [{ ...base, id: `${side.id}:fade`, kind: 'wall', size: [w, w], color,
      keys: [key(t0, { at: [NEAR, 0, 0], opacity: from }), key(t1, { at: [NEAR, 0, 0], opacity: to })] }];
  }
  if (tr.type === 'wipe') {
    const axis = { left: [0, 1], right: [0, -1], up: [-1, 0], down: [1, 0] }[tr.dir || 'left'];   // [z, y] the flat enters from
    const off = (k) => [NEAR, axis[1] * w * k, axis[0] * w * k];
    // closing: from the entry side onto the lens; opening: off the lens to the far side
    const [a, b] = closing ? [off(1), off(0)] : [off(0), off(-1)];
    return [{ ...base, id: `${side.id}:wipe`, kind: 'wall', size: [w, w], color, keys: [key(t0, { at: a }), key(t1, { at: b })] }];
  }
  if (tr.type === 'iris') {
    return [{ ...base, id: `${side.id}:iris`, kind: 'frame', shape: 'round', size: [w, w], color,
      keys: [key(t0, { at: [NEAR, 0, 0], open: 1 - from }), key(t1, { at: [NEAR, 0, 0], open: 1 - to })] }];
  }
  const R = tr.radius || 1, L = 12 * R;
  // pipe ALONG the path: the camera's own route through the half, the closing one starting a third of the way in (its
  // mouth ahead, flown into) and carried 6R past the cut to a cap; the opening one from 6R behind the cut (capped)
  // to two thirds of the way through the half (its mouth, flown out of)
  if (side.travel >= 2 * R) {
    const span = closing ? [t0 + (t1 - t0) / 3, t1] : [t0, t0 + (t1 - t0) * 2 / 3];
    const shape = tr.profile === 'box' ? { profile: 'box', size: [2.4 * R, 2 * R] } : { radius: R };
    return [{ ...base, id: `${side.id}:pipe`, kind: 'pipe', along: side.camera, attach: undefined, ...shape, span,
      extend: closing ? [0, 6 * R] : [6 * R, 0], cap: closing ? 'far' : 'near', color: tr.color || '#14161c', color2: '#f5a524',
      keys: [{ t: t0, opacity: closing ? 0 : 1 }, { t: t0 + (t1 - t0) * 0.25, opacity: 1 }] }];
  }
  // pipe on the LENS (a camera that barely moves): closing slides a straight tube back over the camera until it is a
  // third of the way in, looking at its capped far end; opening starts there and slides it back past the camera
  const [cx0, cx1] = closing ? [L / 2 + 3 * R, L * 0.15] : [-L * 0.15, -L / 2 - 3 * R];
  return [{ ...base, id: `${side.id}:pipe`, kind: 'pipe', radius: R, length: L, rings: 18, cap: closing ? 'far' : 'near',
    color: tr.color || '#14161c', color2: '#f5a524',
    keys: [{ t: t0, at: [cx0, 0, 0], ease: closing ? 'easy_ease_in' : 'linear' }, { t: t1, at: [cx1, 0, 0], ease: closing ? 'linear' : 'easy_ease_out' }] }];
}

/** The pieces every shot's `in` expands into, for a normalized plan. */
export function transitionPieces(plan, { subjects = null } = {}) {
  const out = [];
  const hfovAt = (camId, t) => cameraAt(compileCamera(plan.cameras.find((c) => c.id === camId), { subjects }), t).hfov;
  plan.shots.forEach((B, i) => {
    const tr = B.in;
    if (!tr) return;
    const half = tr.duration / 2;
    const sides = [];
    const A = i > 0 ? plan.shots[i - 1] : null;
    if (A) sides.push({ id: `in${i}:out`, shot: A.name, shotIn: B.name, camera: A.camera, t0: Math.max(A.span[0], A.span[1] - half), t1: A.span[1], closing: true });
    sides.push({ id: `in${i}:in`, shot: B.name, shotIn: B.name, camera: B.camera, t0: B.span[0], t1: Math.min(B.span[1], B.span[0] + half), closing: false });
    for (const side of sides) {
      if (!(side.t1 > side.t0)) continue;
      if (tr.type === 'pipe') {   // how far the camera travels over its half: enough to fly a tube along?
        const cam = compileCamera(plan.cameras.find((c) => c.id === side.camera), { subjects });
        side.travel = 0;
        for (let j = 1, prev = cameraAt(cam, side.t0).pos; j <= 12; j++) {
          const q = cameraAt(cam, side.t0 + (side.t1 - side.t0) * j / 12).pos;
          side.travel += Math.hypot(q[0] - prev[0], q[1] - prev[1], q[2] - prev[2]); prev = q;
        }
      }
      const h = hfovAt(side.camera, side.closing ? side.t1 : side.t0);
      out.push(...sidePieces(tr, side, 2 * NEAR * Math.tan(h * Math.PI / 360) * COVER));
    }
  });
  return out;
}

/**
 * THE GREAT BELL — a castle boss no door makes (docs/metroidvania-map.md "Bosses"): a bell hung by its yoke from chains,
 * built from a few primitives as a CARD and delivered as a rig figure (vehicle-designer/vehicle-rig.js packVehicleFigure,
 * as the worker bots are: workbots/), a bone a part: the chains and the yoke its ROOT, the bell on the AXLE (`bell`, its
 * head at the yoke's axle), the clapper on its own bone hung from the bell's crown (`clapper`). Seen from the side it
 * swings along the lane, about its axle.
 *
 *   THE BELL     a bell's profile turned round its axis (lip, waist, shoulder, crown), bronze with a darker patina band and
 *                a gold lip; its mouth's inside dark; the clapper an iron rod and ball inside it, below its lip
 *   ITS MOVES    clips by the pattern each of its moves draws (boss/looks.js ATTACK_LOOKS), the names the page's wind-up
 *                plays (`wind_<pattern>`, `strike_<pattern>`, scene/channels/controllable/index.js __bossWind): two keys
 *                each, the swing back and the swing through, the clapper lagging the bell
 *
 *   BELL_CARDS             { <card>: { mouth, height, chain, bronze, patina, lip, iron, swings } }   a new bell is a card
 *   readBellSpec(spec)     → { card } or throws
 *   bellFigure(spec)       → the rig figure a level stands it as (a figures-map `bell: { card }`, world-scene.js)
 *   bellHeight(spec)       → its height from its lip to its chains' top (m)
 *
 * Pure and deterministic: the same card, the same bell.
 */
import { packVehicleFigure } from '../../vehicle-designer/vehicle-rig.js';

const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;
/** each move's swing (radians about the axle: + swings its mouth ahead): its wind-up back, its strike through */
const SWING = Object.freeze({ toll: [-0.62, 0.7], toss: [-0.3, 0.35], quake: [0.18, -0.12], cleave: [-0.5, 0.55], lunge: [-0.4, 0.6] });
export const BELL_CARDS = Object.freeze({
  // the spire's great bell: bronze gone green at its waist, its lip gilded, swung by its dead on chains out of sight
  'great-bell': Object.freeze({ mouth: 1.05, height: 2.1, chain: 1.6, bronze: '#8a6a32', patina: '#4f6a5a', lip: '#c9a75a', iron: '#2a2624', inside: '#1a120c', swings: SWING }),
});
export function readBellSpec(spec) {
  const card = spec?.card;
  if (!BELL_CARDS[card]) throw new Error(`bell: card is one of ${Object.keys(BELL_CARDS).join(', ')}`);
  return { card };
}

// (a key light, ahead and above and the camera's side, baked into each face: the castle's bodies are lit flat)
const KEY = [0.45, -0.35, 0.82];
const shade = (hex, n) => { const k = 0.55 + 0.45 * Math.max(0, n[0] * KEY[0] + n[1] * KEY[1] + n[2] * KEY[2]); const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return '#' + c.map((v) => Math.min(255, Math.round(v * k)).toString(16).padStart(2, '0')).join(''); };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const quad = (out, P, fill, flip = false) => { const c = flip ? [...P].reverse() : P, n = unit(cross(sub(c[1], c[0]), sub(c[2], c[0]))); out.push({ corners: c.map((p) => p.map(r4)), normal: n.map(r4), fill: shade(fill, n) }); };
// a profile [[r, z], …] turned round +z at `n` steps, its rings' fills by band
function lathe(out, prof, n, fillOf, { inside = null } = {}) {
  for (let i = 0; i < prof.length - 1; i++) for (let k = 0; k < n; k++) {
    const a0 = (k / n) * 2 * Math.PI, a1 = ((k + 1) / n) * 2 * Math.PI, [ra, za] = prof[i], [rb, zb] = prof[i + 1];
    const P = [[ra * Math.cos(a0), ra * Math.sin(a0), za], [ra * Math.cos(a1), ra * Math.sin(a1), za], [rb * Math.cos(a1), rb * Math.sin(a1), zb], [rb * Math.cos(a0), rb * Math.sin(a0), zb]];
    quad(out, P, fillOf(i), true);
    if (inside) quad(out, P.map(([x, y, z]) => [x * 0.94, y * 0.94, z]), inside);
  }
}
const box = (out, [x0, y0, z0], [x1, y1, z1], fill) => {
  const v = (x, y, z) => [x, y, z];
  quad(out, [v(x1, y0, z0), v(x1, y1, z0), v(x1, y1, z1), v(x1, y0, z1)], fill); quad(out, [v(x0, y1, z0), v(x0, y0, z0), v(x0, y0, z1), v(x0, y1, z1)], fill);
  quad(out, [v(x0, y0, z0), v(x1, y0, z0), v(x1, y0, z1), v(x0, y0, z1)], fill); quad(out, [v(x1, y1, z0), v(x0, y1, z0), v(x0, y1, z1), v(x1, y1, z1)], fill);
  quad(out, [v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1)], fill); quad(out, [v(x0, y1, z0), v(x1, y1, z0), v(x1, y0, z0), v(x0, y0, z0)], fill);
};

/** The bell's faces by bone, its bones and its height (its lip at z 0.3 over its feet: it hangs clear of the floor). */
function bellParts(spec) {
  const C = BELL_CARDS[readBellSpec(spec).card], R = C.mouth, H = C.height, lift = 0.3, axle = lift + H + 0.12;
  const root = [], bell = [], clapper = [];
  // THE BELL: lip, flare, waist, shoulder, crown; its bands bronze, patina at the waist, gold at the lip
  const prof = [[R, lift], [R * 0.96, lift + H * 0.08], [R * 0.78, lift + H * 0.3], [R * 0.62, lift + H * 0.55], [R * 0.58, lift + H * 0.78], [R * 0.48, lift + H * 0.93], [R * 0.2, lift + H], [0.001, lift + H]];
  lathe(bell, prof, 18, (i) => (i === 0 ? C.lip : i === 2 || i === 3 ? C.patina : C.bronze), { inside: C.inside });
  // its CANONS (the loops it hangs by) and the YOKE's stub on the axle
  box(bell, [-0.12, -0.18, lift + H], [0.12, 0.18, axle], C.iron);
  // THE CLAPPER: a rod and a ball, hung from the crown
  box(clapper, [-0.05, -0.05, lift - 0.25], [0.05, 0.05, lift + H - 0.1], C.iron);
  lathe(clapper, [[0.001, lift - 0.45], [0.16, lift - 0.38], [0.2, lift - 0.28], [0.16, lift - 0.18], [0.001, lift - 0.1]], 10, () => C.iron);
  // THE ROOT: the yoke across the axle (a beam across the lane) and two chains rising out of the frame
  box(root, [-0.7, -0.22, axle - 0.12], [0.7, 0.22, axle + 0.2], '#3a2a1c');
  for (const x of [-0.55, 0.55]) for (let k = 0; k < Math.round(C.chain / 0.22); k++) { const z = axle + 0.2 + k * 0.22, w = k % 2 ? 0.06 : 0.12; box(root, [x - w / 2, -0.06, z], [x + w / 2, 0.06, z + 0.2], C.iron); }
  const bones = [{ id: 'root', head: [0, 0, 0] }, { id: 'bell', head: [0, 0, r4(axle)] }, { id: 'clapper', head: [0, 0, r4(lift + H - 0.1)] }];
  return { C, bones, buckets: new Map([['root', root], ['bell', bell], ['clapper', clapper]]), height: r4(axle + 0.2 + C.chain), axle };
}

export const bellHeight = (spec) => bellParts(spec).height;

/** The bell as a rig figure, its moves its clips (see the header). */
export function bellFigure(spec) {
  const { C, bones, buckets, height, axle } = bellParts(spec), F = packVehicleFigure(bones, buckets, { keys: 2, rolls: [] });
  // (a key: per bone [qx, qy, qz, qw, hx, hy, hz]; the bell turned about the axle (+x: the lane is +y), the clapper hung
  // from the crown as the bell carries it and lagging it)
  const key = (a, lag) => {
    const qb = [Math.sin(a / 2), 0, 0, Math.cos(a / 2)], ql = [Math.sin((a * lag) / 2), 0, 0, Math.cos((a * lag) / 2)];
    const c = bones[2].head, dz = c[2] - axle, hc = [0, -Math.sin(a) * dz, axle + Math.cos(a) * dz];
    return [0, 0, 0, 1, ...bones[0].head, ...qb.map(r4), ...bones[1].head, ...ql.map(r4), ...hc.map(r4)];
  };
  const clips = {};
  for (const [p, [back, through]] of Object.entries(C.swings)) {
    clips[`wind_${p}`] = { k: 2, b: [...key(0, 1), ...key(back, 1.35)] };
    clips[`strike_${p}`] = { k: 2, b: [...key(back, 1.35), ...key(through, 0.7)] };
  }
  return { ...F, clips: { ...F.clips, ...clips }, bell: { card: readBellSpec(spec).card, height } };
}

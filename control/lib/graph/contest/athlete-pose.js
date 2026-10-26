/**
 * athlete pose — a character made with create_character posed by a sport's stick (inlined into a contest page's block
 * after versus-rig.js and versus-figure.js, only when the arena carries bodies: scene/channels/contest.js; the meshes
 * are athlete.client.js's).
 *
 * The sports draw their players from a STICK: the joints the page's drawing poses, in the stage's frame (metres, z up):
 * `pelvis`, `neck`, and per side `shoulder`, `elbow`, `wrist`, `hip`, `knee`, `ankle` (`hipL` … `ankleR`). A character
 * (its rig's rest skeleton, versus-figure.js characterBase: metres, z up, facing +y, its right +x, its feet on z = 0) is
 * posed by the stick's DIRECTIONS on its own lengths:
 *   - the trunk turned rigidly onto the stick's: its up the pelvis to the neck, its front the facing across that up
 *   - each limb laid along its stick bone from the joint the chain reached (a long-legged character runs the stride on
 *     its own legs, and nothing parts at a joint)
 *   - each foot turned with its shin (the shortest arc from the rest shin to the posed one)
 *   - the whole body set on the ground by its lowest sole (the heel under the ankle, the toe), then raised by `lift`,
 *     the stick's own air (a hurdle's hop, a flight)
 * Each of the character's bones then rides its segment (versus-figure.js figureSegments): the chain closes everywhere.
 *
 *   athleteNodes(base, stick, { face, lift, ground })  → posed nodes (the figure's names, the stage's frame)
 *   strideStick({ at, heading, phase, speed, ground }) → a stick for a body the sim keeps as a point and a velocity
 *                                                       (the pitch's players): standing, or running on its phase
 *   swingStick({ at, face, along, swing, both, ground }) → a stick addressing a ball (golf, both hands on the club) or
 *                                                       bowling it (the right arm alone), swung `swing` radians along
 *                                                       `along` (+ through the ball, − the backswing)
 *
 * Pure, no dice; nothing here is kept by a sim.
 */
import { characterBase } from '../versus/versus-figure.js';

const ATH_SIDES = ['L', 'R'];
const athV = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  unit: (a) => { const l = Math.hypot(a[0], a[1], a[2]); return l > 1e-9 ? [a[0] / l, a[1] / l, a[2] / l] : null; },
};
// v turned by the shortest arc that takes the unit a onto the unit b (Rodrigues)
function athArc(v, a, b) {
  const c = athV.dot(a, b), ax = athV.cross(a, b), s = athV.len(ax);
  if (s < 1e-9) return c > 0 ? v : athV.mul(v, -1);
  const k = athV.mul(ax, 1 / s), kv = athV.cross(k, v);
  return athV.add(athV.add(athV.mul(v, c), athV.mul(kv, s)), athV.mul(k, athV.dot(k, v) * (1 - c)));
}
const ATH_TRUNK = ['pelvisHub', 'navel', 'neckHub', 'headBase', 'headTop', 'shoulderL', 'shoulderR', 'hipL', 'hipR'];

/** The character's rest skeleton (`base`, characterBase's) posed by the stick, facing `face` ([x, y] on the floor). */
export function athleteNodes(base, stick, { face = [0, 1], lift = 0, ground = 0 } = {}) {
  const V = athV;
  const up = V.unit(V.sub(stick.neck, stick.pelvis)) || [0, 0, 1];
  const f0 = [face[0], face[1], 0];
  const fwd = V.unit(V.sub(f0, V.mul(up, V.dot(f0, up)))) || V.unit(V.cross(up, [1, 0, 0])) || [0, 1, 0];
  const right = V.cross(fwd, up);
  // the rest frame's x, y, z onto the posed trunk's right, front and up
  const T = (o) => V.add(V.add(V.mul(right, o[0]), V.mul(fwd, o[1])), V.mul(up, o[2]));
  const P0 = base.pelvisHub, P = [stick.pelvis[0], stick.pelvis[1], P0[2]];
  const N = {};
  for (const k of ATH_TRUNK) N[k] = V.add(P, T(V.sub(base[k], P0)));
  // a limb bone laid along the stick's from where the chain reached, at the character's own length
  const lay = (a, b) => {
    const d = V.unit(V.sub(stick[b], stick[a])) || V.unit(T(V.sub(base[b], base[a]))) || [0, 0, -1];
    return V.add(N[a], V.mul(d, V.len(V.sub(base[b], base[a]))));
  };
  for (const S of ATH_SIDES) {
    N[`knee${S}`] = lay(`hip${S}`, `knee${S}`);
    N[`ankle${S}`] = lay(`knee${S}`, `ankle${S}`);
    N[`elbow${S}`] = lay(`shoulder${S}`, `elbow${S}`);
    N[`wrist${S}`] = lay(`elbow${S}`, `wrist${S}`);
    const restShin = V.unit(T(V.sub(base[`ankle${S}`], base[`knee${S}`]))), shin = V.unit(V.sub(N[`ankle${S}`], N[`knee${S}`]));
    const foot = T(V.sub(base[`toe${S}`], base[`ankle${S}`]));
    N[`toe${S}`] = V.add(N[`ankle${S}`], restShin && shin ? athArc(foot, restShin, shin) : foot);
  }
  // on the ground by the lowest sole (the heel under the ankle, the toe, each at its rest height), then the air
  let low = Infinity;
  for (const S of ATH_SIDES) low = Math.min(low, N[`ankle${S}`][2] - base[`ankle${S}`][2], N[`toe${S}`][2] - base[`toe${S}`][2]);
  const dz = ground + lift - low;
  for (const k of Object.keys(N)) N[k] = [N[k][0], N[k][1], N[k][2] + dz];
  N.hand = base.hand;
  return N;
}

/** A packed rig's bones → the rest skeleton athleteNodes poses (versus-figure.js characterBase). */
export const athleteBase = (bones) => characterBase(bones);

const ATH_STICK = { hipZ: 0.92, hipW: 0.11, shW: 0.19, thigh: 0.45, shin: 0.44, arm: 0.3, fore: 0.28, trunk: 0.6 };

/** A body at a point running along `heading` (radians on the floor) at `speed` (m/s), its stride at `phase` (radians):
 * the legs and the arms swung against each other, the trunk leaning into the speed; standing when it is slow. */
export function strideStick({ at, heading = Math.PI / 2, phase = 0, speed = 0, ground = 0 }) {
  const L = ATH_STICK, fw = [Math.cos(heading), Math.sin(heading), 0], rt = [Math.sin(heading), -Math.cos(heading), 0];
  const moving = speed > 0.3, amp = moving ? Math.min(0.8, 0.3 + speed * 0.07) : 0;
  const lean = moving ? Math.min(0.22, 0.05 + speed * 0.025) : 0.02;
  const z = ground + L.hipZ, pt = (o, f, r, h) => [o[0] + fw[0] * f + rt[0] * r, o[1] + fw[1] * f + rt[1] * r, o[2] + h];
  const pelvis = [at[0], at[1], z];
  const st = { pelvis, neck: pt(pelvis, L.trunk * Math.sin(lean), 0, L.trunk * Math.cos(lean)) };
  for (const [S, side] of [['L', -1], ['R', 1]]) {
    const a = moving ? amp * Math.sin(phase + (side > 0 ? 0 : Math.PI)) : 0.04 * side, k = moving ? 0.35 + 0.9 * Math.max(0, -a) : 0.06;
    const hip = pt(pelvis, 0, side * L.hipW, 0);
    const knee = pt(hip, L.thigh * Math.sin(a), 0, -L.thigh * Math.cos(a));
    st[`hip${S}`] = hip; st[`knee${S}`] = knee; st[`ankle${S}`] = pt(knee, L.shin * Math.sin(a - k), 0, -L.shin * Math.cos(a - k));
    const aa = moving ? -0.9 * amp * Math.sin(phase + (side > 0 ? 0 : Math.PI)) : 0.06, bend = moving ? 1.2 : 0.2;
    const sh = pt(st.neck, -0.04, side * L.shW, -0.08);
    const elbow = pt(sh, L.arm * Math.sin(aa), side * 0.03, -L.arm * Math.cos(aa));
    st[`shoulder${S}`] = sh; st[`elbow${S}`] = elbow; st[`wrist${S}`] = pt(elbow, L.fore * Math.sin(aa + bend), 0, -L.fore * Math.cos(aa + bend));
  }
  return st;
}

/** A body addressing a ball: facing `face` (radians), the knees soft and the trunk bent over it, swung `swing` radians
 * along `along` (radians: toward the target). `both`: the hands together on a club (golf); else the right arm alone,
 * the left held out for balance (bowling). */
export function swingStick({ at, face = Math.PI / 2, along = 0, swing = 0, both = true, ground = 0 }) {
  const L = ATH_STICK, fw = [Math.cos(face), Math.sin(face), 0], rt = [Math.sin(face), -Math.cos(face), 0], tg = [Math.cos(along), Math.sin(along), 0];
  const bend = both ? 0.55 : 0.35, z = ground + L.hipZ - 0.06;
  const pelvis = [at[0] - fw[0] * 0.08, at[1] - fw[1] * 0.08, z];
  const neck = [pelvis[0] + fw[0] * L.trunk * Math.sin(bend), pelvis[1] + fw[1] * L.trunk * Math.sin(bend), z + L.trunk * Math.cos(bend)];
  const st = { pelvis, neck };
  for (const [S, side] of [['L', -1], ['R', 1]]) {
    const hip = [pelvis[0] + rt[0] * side * L.hipW * 1.4, pelvis[1] + rt[1] * side * L.hipW * 1.4, z];
    const knee = [hip[0] + fw[0] * 0.12, hip[1] + fw[1] * 0.12, z - L.thigh * 0.97];
    st[`hip${S}`] = hip; st[`knee${S}`] = knee; st[`ankle${S}`] = [knee[0] - fw[0] * 0.06, knee[1] - fw[1] * 0.06, z - L.thigh * 0.97 - L.shin];
    const sh = [neck[0] + rt[0] * side * L.shW - fw[0] * 0.03, neck[1] + rt[1] * side * L.shW - fw[1] * 0.03, neck[2] - 0.08];
    st[`shoulder${S}`] = sh;
  }
  // the hands on an arc about the shoulders' middle: hanging at 0, out along the target with the swing
  const mid = [(st.shoulderL[0] + st.shoulderR[0]) / 2, (st.shoulderL[1] + st.shoulderR[1]) / 2, (st.shoulderL[2] + st.shoulderR[2]) / 2];
  const reach = L.arm + L.fore - 0.04;
  const hands = (sw) => [mid[0] + (tg[0] * Math.sin(sw) + fw[0] * 0.25) * reach, mid[1] + (tg[1] * Math.sin(sw) + fw[1] * 0.25) * reach, mid[2] - Math.cos(sw) * reach * 0.97];
  for (const [S, side] of [['L', -1], ['R', 1]]) {
    const sh = st[`shoulder${S}`];
    const h = both || S === 'R' ? hands(swing) : [sh[0] + rt[0] * side * 0.25 + fw[0] * 0.2, sh[1] + rt[1] * side * 0.25 + fw[1] * 0.2, sh[2] - 0.45];
    st[`elbow${S}`] = [(sh[0] + h[0]) / 2 + rt[0] * side * 0.04, (sh[1] + h[1]) / 2 + rt[1] * side * 0.04, (sh[2] + h[2]) / 2];
    st[`wrist${S}`] = h;
  }
  return st;
}

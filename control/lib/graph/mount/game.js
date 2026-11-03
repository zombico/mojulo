/**
 * game.js — THE MOUNT IN A GAME: a horse a game's characters get on and ride, packed for the World page (the controllable
 * runtime's `ride` rule and its getting on and off: worlds/controllable/mount.js). One solve makes both halves, because
 * each needs the other: the horse's figure (its reins run to the rider's fists) and the rider's riding clips (solved on
 * the character's own rig to this horse's saddle, irons and bit, rider.js), each clip of the same name on both, played
 * together at the same phase by the runtime.
 *
 *   mountRide({ R, dz }, { register, coats, cells, fps }) → { figure, figures, clips, rule, mount }
 *     figure  the horse's page figure (`figures`: one a coat, the same body and clips in each coat's colours) (a skinned rig: `skin`, the page binds one mesh to its bones), its clips the
 *             runtime's names: loose `idle` (no carriage, the reins on the neck) and ridden ride_idle, ride_walk,
 *             ride_trot, ride_canter, ride_gallop, ride_back, ride_jump, mount, dismount (the ridden head carriage, the
 *             reins on chains from the bit to the rider's fists)
 *     clips   the rider's clips of the same names, as the layered packer takes them (u → its pose words, `keys`, `once`),
 *             raised by nothing: solved `dz` below the horse's frame, the packer's own lift putting them back on it
 *     rule    the horse's `ride` rule's numbers: each gait's clip, speed and stride (its distance a cycle), the idle's
 *             seconds, the rein-back's, the jump's (its clip, seconds, speed and its flight's share)
 *     mount   the horse's `mount`: where the rider stands to get on (and is set down getting off) in the horse's frame,
 *             facing it, and the getting-on and -off clips' seconds
 *   `R` absent (no character rides it): the horse alone, loose, with nothing ridden.
 *
 * The jump in a game is the jump's own take-off to its landing (the approach and the canter away are the runtime's: it
 * is asked for at a trot or faster and carried at the canter's speed). Everything in place: the runtime moves the body.
 */
import { resolveMount } from './build.js';
import { bodyMesh } from './body.js';
import { mountClips, mountPack } from './export.js';
import { boneFrames } from './skin.js';
import { standPose } from './gait.js';
import { tackPieces } from './tack.js';
import { carriageOf, riddenFrame, ridingGeometry, reinRig, carryPoint } from './ridden.js';
import { bodyField } from './body.js';
import { riderSeat, riderPose, rideCharacter, fistOf, RIDER_MODES, mountStand } from './rider.js';
import { rigNodesAt } from '../polygonizer/station-loft-rig.js';

/** the runtime's clip names → the mount's clips: ridden (the horse and its rider) and loose (the horse alone) */
export const RIDDEN_CLIPS = Object.freeze({ ride_idle: 'idle-breathe', ride_walk: 'walk', ride_trot: 'trot', ride_canter: 'canter', ride_gallop: 'gallop', ride_back: 'reinBack', ride_jump: 'jump', mount: 'mount', dismount: 'dismount' });
export const LOOSE_CLIPS = Object.freeze({ idle: 'idle-breathe' });
export const RIDE_GAITS = Object.freeze(['walk', 'trot', 'canter', 'gallop']);
/** the page's keys a second, and the jump's window about its flight (seconds before take-off, after landing) */
export const MOUNT_PAGE = Object.freeze({ fps: 15, cells: 36, jumpBefore: 0.45, jumpAfter: 0.5, light: [0.35, -0.55, 0.75], ambient: 0.55 });

const DEFAULT_CAL = Object.freeze({ leather: 0.35, out: 0.1, splay: 40 });
const r4 = (x) => Math.round(x * 1e4) / 1e4;

// a one-shot cut out of a clip (`t0` to `t1` seconds), its flight shifted with it
function windowed(c, t0, t1) {
  const f = c.flight ? Object.fromEntries(Object.entries(c.flight).map(([k, v]) => [k, ['launch', 'touchdown', 'apex'].includes(k) ? v - t0 : v])) : null;
  return { ...c, at: (t) => c.at(t0 + t), before: (t) => (t0 + t >= 0 ? c.at(t0 + t) : c.before(t0 + t)), s: t1 - t0, once: true, ...(f ? { flight: f } : {}) };
}

// a pose solved in the horse's frame, put `dz` lower (its hub and its feet's targets: the arms are its own turns), so the
// layered packer's lift by `dz` puts it back where it was solved
export function lowered(pose, dz) {
  if (!dz) return pose;
  const out = { ...pose };
  if (out.lift != null) { const z = out.lift - dz; delete out.lift; if (z >= 0) out.lift = z; else out.sink = -z; }
  else if (out.sink != null) out.sink += dz;
  else out.sink = dz;
  if (out.feet) out.feet = Object.fromEntries(Object.entries(out.feet).map(([S, p]) => [S, [p[0], p[1], p[2] - dz]]));
  return out;
}

export function mountRide(rider = null, { register = 'realistic', coat = 'bay', coats = [coat], cells = MOUNT_PAGE.cells, fps = MOUNT_PAGE.fps, seed = 3, markings = {} } = {}) {
  const B = resolveMount('horse', { register });
  const mesh = bodyMesh(B, { cells });
  const stand = standPose(B), rest = boneFrames(B, stand), anchors = tackPieces(B, { reins: false }).anchors;
  // the clips: the ridden set (its jump the flight's window), the loose
  const ridden0 = rider ? mountClips(B, { names: [...new Set(Object.values(RIDDEN_CLIPS))], ridden: true, seed }) : {};
  if (ridden0.jump) { const f = ridden0.jump.flight; ridden0.jump = windowed(ridden0.jump, Math.max(0, f.launch - MOUNT_PAGE.jumpBefore), Math.min(ridden0.jump.s, f.touchdown + MOUNT_PAGE.jumpAfter)); }
  const loose0 = mountClips(B, { names: Object.values(LOOSE_CLIPS), seed });
  // THE RIDER: seated by this horse's tack (its leathers and its knees by its own legs), every ridden clip solved
  let cal = DEFAULT_CAL, rc = null, H = null, reins = null;
  if (rider) {
    H = { R: { ...rider.R, reach: 'clamp' } };
    // (the barrel's field alone, its masses within a metre of the seat: what the irons and the knees clear)
    const near = (q) => Math.hypot(q.c[0] - anchors.seat[0], q.c[1] - anchors.seat[1], q.c[2] - anchors.seat[2]) < 1 + (q.R ?? 0);
    const F = bodyField(B, { only: near });
    cal = riderSeat(H, ridingGeometry(anchors, rest, rest), (p) => F.field(p));
    rc = rideCharacter(B, H, ridden0, { anchors, cal, rest, fps });
    // the reins: from the bits to the fists at the ridden halt (their length: that distance and a little)
    const stand1 = boneFrames(B, riddenFrame(stand, carriageOf(stand))), geo1 = ridingGeometry(anchors, stand1, rest);
    const n1 = rigNodesAt(H.R, riderPose(H, cal, geo1, RIDER_MODES.sit).pose).nodes, fists1 = { R: fistOf(n1, 'R'), L: fistOf(n1, 'L') };
    reins = reinRig(anchors.bits, fists1, Math.hypot(...fists1.R.map((x, i) => x - geo1.bits.R[i])) + 0.02);
  } else reins = null;
  // the loose reins: each half laid along the neck (tack.js neckReins), its n + 1 points carried by the bones they lie on
  const n = 4, bonesNear = ['head', 'neck4', 'neck3', 'neck2', 'neck1', 'neck0'].filter((id) => rest[id]);
  const nearest = (p) => bonesNear.reduce((best, id) => { const b = stand.bones[id], d = segDist(p, b.head, b.tail); return d < best.d ? { id, d } : best; }, { id: bonesNear[0], d: Infinity }).id;
  const neckHalves = Object.fromEntries(['R', 'L'].map((S) => { const c = anchors.neckReins[S]; const pts = Array.from({ length: n + 1 }, (_, j) => along(c, j / n)); return [S, pts.map((p) => ({ p, bone: nearest(p) }))]; }));
  // THE FIGURE: the page's clip names, the reins on their chains (to the fists ridden, on the neck loose)
  const clips = {}, from = {};
  // (the hair baked where the horse moves; standing, carried by the bones it grows from)
  const still = (c) => ({ ...c, hair: 'rigid' }), STILL = new Set(['ride_idle', 'idle', 'mount', 'dismount', 'ride_back']);
  for (const [name, src] of Object.entries(RIDDEN_CLIPS)) if (ridden0[src]) { clips[name] = STILL.has(name) ? still(ridden0[src]) : ridden0[src]; from[name] = src; }
  for (const [name, src] of Object.entries(LOOSE_CLIPS)) { clips[name] = still(loose0[src]); from[name] = null; }
  const extra = reins ? {
    joints: reins.joints, meshes: [reins.mesh],
    keysAt: (name, k, f) => {
      const r = from[name] && rc[from[name]];
      if (r) return reins.keys(r.geos[k].bits, r.fists[k]);
      return reins.along(Object.fromEntries(['R', 'L'].map((S) => [S, neckHalves[S].map(({ p, bone }) => carryPoint(rest, f, bone, p))])));
    },
  } : null;
  const packOf = (c, withClips) => ({ ...mountPack(B, { mesh, clips: withClips ? clips : {}, coat: c, markings, fps, tack: { reins: reins ? false : 'neck', stirrups: { length: cal.leather, out: cal.out } }, extra, shade: { dir: MOUNT_PAGE.light, ambient: MOUNT_PAGE.ambient } }), skin: true });
  // (each further coat the same body and clips in its own colours: its parts, the first's clips)
  const figure = packOf(coats[0], true), figures = { [coats[0]]: figure };
  for (const c of coats.slice(1)) figures[c] = { ...packOf(c, false), clips: figure.clips };
  // THE RIDER'S CLIPS: each pose by its key, lowered by the packer's lift
  const dz = rider?.dz ?? 0, riderClips = {};
  if (rc) for (const [name, src] of Object.entries(from)) {
    const r = src && rc[src]; if (!r) continue;
    const fn = (u) => lowered(r.poses[r.once ? Math.round(u * (r.K - 1)) : Math.round(u * r.K) % r.K], dz);
    fn.keys = r.K; if (r.once) fn.once = true;
    riderClips[name] = fn;
  }
  // THE RULE'S NUMBERS and THE MOUNT'S
  const gait = (g) => ({ clip: `ride_${g}`, loose: LOOSE_CLIPS[g] ? g : 'idle', v: r4(clips[`ride_${g}`]?.v ?? loose0[g]?.v ?? 0), stride: r4((clips[`ride_${g}`]?.v ?? 0) * (clips[`ride_${g}`]?.s ?? 1)) });
  const rule = rider ? {
    type: 'ride', gaits: RIDE_GAITS.map(gait), idle: { clip: 'ride_idle', loose: 'idle', s: r4(clips.ride_idle.s) },
    back: { clip: 'ride_back', v: r4(clips.ride_back.v), stride: r4(clips.ride_back.v * clips.ride_back.s) },
    jump: (() => { const j = clips.ride_jump, f = j.flight; return { clip: 'ride_jump', s: r4(j.s), v: r4(f.distance / f.airtime), air: [r4(f.launch / j.s), r4(f.touchdown / j.s)], clear: r4(Math.max(0.6, f.vz * f.vz / (2 * 9.81) + 0.5)) }; })(),
    height: r4(figure.figH), radius: 0.55,
  } : { type: 'ride', gaits: [], idle: { clip: 'idle', loose: 'idle', s: r4(clips.idle.s) } };
  const st = mountStand(ridingGeometry(anchors, rest, rest));
  const mount = rider ? { reach: 2.6, stand: [r4(st.at[0]), r4(st.at[1])], facing: r4(st.facing * Math.PI / 180), mount: { clip: 'mount', s: r4(clips.mount.s) }, dismount: { clip: 'dismount', s: r4(clips.dismount.s) }, slow: 1.8, camera: { dist: r4(3.6 * figure.figH), height: r4(1.6 * figure.figH), lookH: r4(0.95 * figure.figH) } } : null;
  return { figure, figures, clips: riderClips, rule, mount, cal };
}

function segDist(p, a, b) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]], L = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
  const t = L > 0 ? Math.max(0, Math.min(1, (ab[0] * ap[0] + ab[1] * ap[1] + ab[2] * ap[2]) / L)) : 0;
  return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t);
}
// a point a share of the way along a polyline (by its length)
function along(pts, u) {
  const seg = []; let L = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(...pts[i].map((x, q) => x - pts[i - 1][q])); seg.push(d); L += d; }
  let s = u * L;
  for (let i = 0; i < seg.length; i++) { if (s <= seg[i] || i === seg.length - 1) { const t = seg[i] > 0 ? Math.min(1, s / seg[i]) : 0; return pts[i].map((x, q) => x + (pts[i + 1][q] - x) * t); } s -= seg[i]; }
  return pts[pts.length - 1];
}

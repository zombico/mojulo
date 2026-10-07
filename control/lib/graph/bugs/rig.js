/**
 * BUG RIG — a bug's skeleton and gaits carried into the layered solid it mints, packed the way the animals' are
 * (fauna/rig.js), so the World, the skinned GLB and Godot play a bug's clips with no reader of their own.
 *
 * Opt-in by `motion`: `withBugMotion(plan, B, id, gaits)` returns a copy of the bug's plan with a `bind` on every part
 * (skeleton.js) and `motion: { bug: <the bauplan>, species?: <worked id>, gaits, keys, behaviors? }` (behavior.js: each
 * word done the way the bug's parts allow, a clip beside the gaits) and `wingbeat` (gait.js: how a flight's wings show).
 * A BLURRED flight packs, beside its clip, the World-only OVERLAY of each wing's swept fan (a see-through sheet over the
 * stroke, riding the trunk bone the wing hangs on) and the wing bones the World hides while it plays (`clip.hide`); an
 * engine export, which reads neither, plays the wings beating at the screen's cap. The bauplan rides the recipe,
 * so a bug nobody has built rigs from what it was minted as, and a worked bug re-renders as minted if its roster row is
 * later retuned. Without `motion` the plan is untouched (byte-identical).
 */
import { prepareBug, bugGaitFrames, bugGaitSeconds, poseBones, wingbeat } from './gait.js';
import { BUG_BEHAVIORS, bugRepertoire, behaviorPose, behaviorSeconds } from './behavior.js';
import { quatOfRows } from '../fauna/rig.js';
import { packLayeredRig } from '../polygonizer/station-loft-rig.js';
import { b64f32, b64u8 } from '../figures/rig-bake.js';
import { faceColorLinear } from '../figures/face-mesh.js';

const r4 = (v) => Math.round(v * 1e6) / 1e6 + 0;   // µm and micro-units: a flea's bones are a millimetre long

/** The gaits a bug can be minted with. */
export const bugMotionGaits = (B, id = null) => Object.keys(prepareBug(B, id).gaits);

/** The behaviors a bug can be minted with (every word: its parts choose how it does each), and the lines it does them by. */
export const bugMotionBehaviors = () => [...BUG_BEHAVIORS];
export const bugBehaviorLines = (B, id = null) => Object.fromEntries(Object.entries(bugRepertoire(prepareBug(B, id))).map(([w, r]) => [w, r.line]));

/** A copy of `plan` bound to the bug's skeleton and carrying its motion; throws on a gait it does not have. */
export function withBugMotion(plan, B, id = null, gaits = bugMotionGaits(B, id), keys = 24, { behaviors = [], wingbeat: wb } = {}) {
  const ctx = prepareBug(B, id), have = Object.keys(ctx.gaits);
  for (const g of gaits) if (!have.includes(g)) throw new Error(`this bug has no gait '${g}' (it moves by: ${have.join(', ')})`);
  for (const b of behaviors) if (!BUG_BEHAVIORS.includes(b)) throw new Error(`no behavior '${b}' (the behaviors: ${BUG_BEHAVIORS.join(', ')})`);
  if (!gaits.length && !behaviors.length) throw new Error('motion carries no clip: name a gait or a behavior');
  if (!Number.isInteger(keys) || keys < 4 || keys > 96) throw new Error('motion keys must be an integer in [4, 96]');
  if (wb !== undefined) { if (!gaits.some((g) => ctx.gaits[g].pattern === 'stroke')) throw new Error('`wingbeat` sets a flight: the motion carries no `fly`'); for (const g of gaits) if (ctx.gaits[g].pattern === 'stroke') wingbeat(ctx, g, wb); }
  const out = structuredClone(plan);
  for (const s of out.segments) if (ctx.K.bind[s.name] !== undefined) s.bind = ctx.K.bind[s.name];
  out.motion = { bug: structuredClone(B), ...(id ? { species: id } : {}), gaits: [...gaits], keys };
  if (behaviors.length) out.motion.behaviors = [...behaviors];
  if (wb !== undefined && wb !== 'auto') out.motion.wingbeat = wb;
  return out;
}

/** The skeleton as bindLayered and the pack read it. */
export function bugBones(motion) {
  const { K } = prepareBug(motion.bug, motion.species || null);
  return { bones: K.bones, boneIndex: Object.fromEntries(K.bones.map((b, i) => [b.id, i])) };
}

/** Pack a minted bug's mesh and gait clips as a rig figure (packFaunaRig's shape). */
export function packBugRig(mesh, skin, motion, opts = {}) {
  const { gaits = [], behaviors = [], keys = 24, wingbeat: wb = 'auto' } = motion, dz = opts.dz || 0, ctx = prepareBug(motion.bug, motion.species || null), bones = ctx.K.bones;
  const stand = { joints: {}, bones: bones.map((b) => ({ id: b.id, head: `${b.id}:h`, tail: `${b.id}:t` })) };
  for (const b of bones) { stand.joints[`${b.id}:h`] = b.head; stand.joints[`${b.id}:t`] = b.tail; }
  const pack = packLayeredRig(mesh, skin, stand, { ...opts, clips: {} });
  const clips = {};
  const packed = (frames) => { const flat = [];
    for (const f of frames) for (const b of bones) { const p = f.bones[b.id]; flat.push(...quatOfRows(p.m).map(r4), r4(p.head[0]), r4(p.head[1]), r4(p.head[2] + dz)); }
    return flat; };
  const overlays = [];
  for (const g of gaits) {
    clips[g] = { k: keys, b: packed(bugGaitFrames(ctx, g, keys)), s: bugGaitSeconds(ctx, g, { wingbeat: wb }) };
    if (ctx.gaits[g].pattern === 'stroke' && wingbeat(ctx, g, wb).mode === 'blur') {
      const index = Object.fromEntries(bones.map((b, i) => [b.id, i])), fans = wingFans(ctx, g, dz);
      clips[g].hide = fans.map((f) => index[f.wing]);
      for (const f of fans) overlays.push({ bone: index[f.bone], pos: b64f32(f.pos), col: b64u8(f.col), faces: f.faces, alpha: FAN_ALPHA, clips: [g] });
    }
  }
  for (const w of behaviors) clips[w] = { k: keys, b: packed(bugBehaviorFrames(ctx, w, keys)), s: behaviorSeconds(ctx, w) };
  return { ...pack, clips, ...(overlays.length ? { overlays } : {}) };
}

const FAN_ALPHA = 0.32, DEG = Math.PI / 180;
/**
 * Each wing's SWEPT FAN, the blur a fast wingbeat leaves: a sheet over the stroke (the wing spread to its side, swung
 * up and down by the gait's amplitude about the body's long axis at its root, from a tenth of its span to the tip),
 * in the rest frame, riding the trunk bone the wing hangs on; its colour the wing's, paler toward the tip.
 */
export function wingFans(ctx, gait, dz = 0) {
  const g = ctx.gaits[gait], amp = g.amp * DEG, plan = ctx.K.plan, out = [];
  for (const b of ctx.K.bones.filter((x) => x.role === 'wing')) {
    const s = b.id.endsWith('L') ? -1 : 1, root = b.head, span = Math.hypot(b.tail[0] - root[0], b.tail[1] - root[1], b.tail[2] - root[2]);
    const part = plan.segments.find((p) => p.name === b.id.replace(/L$/, 'R'));
    const base = faceColorLinear({ fill: plan.palette?.[part?.group] || '#c9d3d6' });
    const ox = s * Math.cos(10 * DEG), oy = -Math.sin(10 * DEG);
    const at = (a, r) => { const c = Math.cos(-s * a), sn = Math.sin(-s * a), x = ox * r * span, y = oy * r * span;   // rotY(-s·a)·out
      return [root[0] + c * x, root[1] + y, root[2] - sn * x + dz]; };
    const NA = 10, NR = 4, pos = [], col = [];
    for (let i = 0; i < NA; i++) for (let j = 0; j < NR; j++) {
      const a0 = -amp + (2 * amp * i) / NA, a1 = -amp + (2 * amp * (i + 1)) / NA, r0 = 0.1 + (0.9 * j) / NR, r1 = 0.1 + (0.9 * (j + 1)) / NR;
      const q = [at(a0, r0), at(a1, r0), at(a1, r1), at(a0, r1)], k = 0.75 + 0.25 * ((j + 0.5) / NR);
      for (const tri of [[0, 1, 2], [0, 2, 3]]) for (const v of tri) { pos.push(...q[v]); col.push(...base.map((c) => Math.min(1, c * k + (1 - k) * 0.9))); }
    }
    out.push({ wing: b.id, bone: b.parent, pos, col, faces: NA * NR * 2 });
  }
  return out;
}

/** n frames of one loop of a behavior: per bone `{ m, head }` */
export function bugBehaviorFrames(ctx, word, n = 24) {
  return Array.from({ length: n }, (_, i) => ({ t: i / n, bones: poseBones(ctx, behaviorPose(ctx, word, i / n)) }));
}

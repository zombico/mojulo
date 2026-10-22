/**
 * action-lab — TAKES: the hero library's clips FITTED to a feel card's frames, and the BODY the kernel reads.
 *
 * The kernel (feel.mjs) decides when things happen; this module makes the clips meet it. A move is the spike's strike
 * take rendered through its `render` with each span's time solved so the beats land on the card's frames: the wind-up
 * on startup − snap, the snap into contact on `snap`, contact on `startup`, the follow-through and the settle sharing
 * active + recovery as the take shares them. The card's wings deepen the wind-up and the follow-through about ready,
 * and the promise holds: the fist meets its contact point on the contact frame. Realistic's card is the take's own
 * time, so its fitted frames are the take's frame for frame. The jump's gather is fitted to the commit, its air is
 * read by vertical speed (the kernel flies it), its landing to the card's land frames. The dodge is a roll for each way
 * it can go (forward, right, left, back) fitted to its frames. The reaction is the library's, its depth by the blow the
 * card hands on.
 *
 * The BODY is the character's half: per take its reach (the fist ahead of the body's centre at contact) and its real
 * blow (the spike's momentum Δv), the cycles' natural speed and stride travel, the mass. Another cast reaches shorter
 * and hits lighter in the same card.
 *
 *   rigOf(cast) → R · bodyOf(R) → body
 *   fitMove(R, move, card) → { take, rendered, frames } · bake(cast) → everything the page draws, as mm integers
 *
 * Pure and deterministic. A lab: nothing registers.
 */
import { register } from 'node:module';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { validateRig, rigNodesAt } = await import('../../../lib/graph/polygonizer/station-loft-rig.js');
const { heroRecord, expandLayeredManifest } = await import('../../../lib/mcp/tools/layered.js');
const { keyedClip, JUMPS } = await import('../../../lib/graph/polygonizer/hero-jump.js');
const { heroLocomotion } = await import('../../../lib/graph/polygonizer/hero-motion.js');
const { GAITS } = await import('../../../lib/graph/polygonizer/hero-gaits.js');
const A = await import('../animation-games/flavor.mjs');
const { tuckOf } = await import('../animation-games/motion.mjs');
import { FEELS, FEEL_IDS, SPAR } from './feel.mjs';

const r4 = (x) => Math.round(x * 1e4) / 1e4;
const FPS = 60, PHASES = 32, AIR = 24;

export function rigOf(cast = 'male') {
  return validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast, head: 'anime' }) }).recipe.rig);
}

const CYCLES = new WeakMap();
/** the stride cycles: walk, jog and sprint, each its clip, its natural speed and a stride's travel */
export function cyclesOf(R) {
  if (CYCLES.has(R)) return CYCLES.get(R);
  const mk = (g) => { const Gt = GAITS[g]; const L = heroLocomotion({ [Gt.motion]: Gt.base }, R, { tilt: Gt.tilt }); return { fn: L.fn, travel: L.travel, v: L.travel / Gt.seconds }; };
  const c = { walk: mk('walk'), jog: mk('jog'), sprint: mk('sprint') }; CYCLES.set(R, c); return c;
}

/** the character's half the kernel reads */
export function bodyOf(R) {
  const reach = {}, dv = {};
  for (const name of ['jab', 'cross']) {
    const t = A.strikeTake(name, R), clip = keyedClip(t, R), c = t.beats.find((b) => b.deals).at;
    const n0 = rigNodesAt(R, clip.fn(0)).nodes, nc = rigNodesAt(R, clip.fn(c)).nodes;
    reach[name] = r4(nc[`wrist${t.hand}`][1] - n0.pelvisHub[1]);
    dv[name] = A.blow(t, 'realistic', R).dv;
  }
  const C = cyclesOf(R);
  return { reach, dv, strides: ['walk', 'jog', 'sprint'].map((g) => ({ gait: g, v: r4(C[g].v), travel: r4(C[g].travel) })), mass: 75 };
}

/**
 * A move fitted to the card: the strike take's spans timed so its beats fall on the card's frames. The beats are
 * ready → load (wind) → contact (act) → follow (after) → ready (settle). `look` gives the wings; no hold and no hitstop
 * are baked (the kernel freezes the live bodies).
 */
export function fitMove(R, move, card, { name = 'fit' } = {}) {
  const take = A.strikeTake(move.take, R), T = take.seconds, at = (id) => take.beats.find((b) => b.id === id && b.at > 0)?.at;
  const load = at('load'), contact = at('contact'), follow = at('follow');
  const after = move.active + move.recovery, share = (follow - contact) / (1 - contact);
  const target = { wind: move.startup - move.snap, act: move.snap, after: Math.max(1, Math.round(after * share)), settle: 0 };
  target.settle = after - target.after;
  const span = { wind: load, act: contact - load, after: follow - contact, settle: 1 - follow };
  const time = Object.fromEntries(Object.keys(span).map((k) => [k, r4(target[k] / (span[k] * T * FPS))]));
  const F = { name, time, gain: { wind: move.wings?.wind ?? 1, after: move.wings?.after ?? 1 }, windHold: 0, hitstop: null, squash: 0, smear: null, force: { model: 'momentum', gain: 1 } };
  const rendered = A.render(take, F, R, { fps: FPS });
  return { take, rendered, time };
}

/** nodes for a rendered take's frames */
const nodesOfFrames = (R, frames) => frames.map((f) => rigNodesAt(R, f.pose).nodes);

/** the drawn skeleton: the spike players' bones (the folds, the face and the inner pelvis left out) */
function skeleton(R) {
  const bones = R.bones.filter((b) => !/Fold|Face|pelvis$|lumbar/.test(b.id)).map((b) => [b.head, b.tail]);
  const names = [...new Set(bones.flat())];
  return { names, bones: bones.map(([a, b]) => [names.indexOf(a), names.indexOf(b)]) };
}

/** a frame as mm integers: x and y about `about` (the body's centre), z as is */
const packer = (names) => (n, about = [0, 0]) => names.flatMap((k) => [Math.round((n[k][0] - about[0]) * 1000), Math.round((n[k][1] - about[1]) * 1000), Math.round(n[k][2] * 1000)]);

/** everything the page draws, for one cast */
export function bake(cast = 'male') {
  const R = rigOf(cast), body = bodyOf(R), S = skeleton(R), pack = packer(S.names), C = cyclesOf(R);
  const centre = (n) => [n.pelvisHub[0], n.pelvisHub[1]];
  const stand = rigNodesAt(R, keyedClip(JUMPS.jump, R).fn(0)).nodes, about = centre(stand);
  const cycle = (g) => Array.from({ length: PHASES }, (_, i) => { const n = rigNodesAt(R, C[g].fn(i / PHASES)).nodes; return pack(n, centre(n)); });
  const T = tuckOf(R);
  const jump = A.jumpTake('jump', R), jc = keyedClip(jump, R), off = jump.beats.find((b) => b.id === 'takeoff').at, on = jump.beats.find((b) => b.id === 'land').at;
  const out = { cast, names: S.names, bones: S.bones, body, idle: pack(stand, about),
    loco: Object.fromEntries(['walk', 'jog', 'sprint'].map((g) => [g, { v: r4(C[g].v), travel: r4(C[g].travel), frames: cycle(g) }])),
    tuck: pack(T.nodes, centre(T.nodes)), tuckDiameter: r4(T.diameter),
    spar: fitMove(R, { take: SPAR.take, startup: SPAR.startup, snap: 4, active: SPAR.active, recovery: SPAR.recovery, wings: { wind: 1.8, after: 1.4 } }, FEELS.action, { name: 'spar' }).rendered.frames.map((f) => pack(rigNodesAt(R, f.pose).nodes, about)),
    feels: {} };
  for (const id of FEEL_IDS) {
    const card = FEELS[id], J = card.jump;
    const moves = card.moves.string.map((m) => { const fm = fitMove(R, m, card, { name: id }); return { take: m.take, contact: fm.rendered.beats.find((b) => b.id === 'contact').frame, frames: nodesOfFrames(R, fm.rendered.frames).map((n) => pack(n, about)) }; });
    const gather = Array.from({ length: J.commit + 1 }, (_, k) => pack(rigNodesAt(R, jc.fn(J.commit ? (off * k) / J.commit : off)).nodes, about));
    const air = Array.from({ length: AIR + 1 }, (_, k) => { const n = rigNodesAt(R, jc.fn(off + ((on - off) * k) / AIR)).nodes; return pack(n, centre(n)); });
    const land = Array.from({ length: Math.max(1, J.land) }, (_, k) => pack(rigNodesAt(R, jc.fn(on + ((1 - on) * (k + 1)) / Math.max(1, J.land))).nodes, about));
    // the directional roll: the library's roll forward, its side rolls (right, and the mirrored left), its hop back,
    // each fitted to the card's frames for that way (a back one shorter)
    const D = card.dodge, ROLLS = { fwd: 'rollForward', right: 'rollSide', left: 'rollSideLeft', back: 'jumpBack' };
    const dodge = Object.fromEntries(Object.entries(ROLLS).map(([way, name]) => {
      const rc = keyedClip(JUMPS[name], R), n0 = way === 'back' ? Math.round(D.frames * D.back.frames) : D.frames;
      return [way, Array.from({ length: n0 + 1 }, (_, k) => { const n = rigNodesAt(R, rc.fn(k / n0)).nodes; return pack(n, centre(n)); })];
    }));
    // the reaction the card's blow causes: the library's, its peak scaled by the blow shown (the spike's reactGain)
    const shown = (take) => { const F = card.hit.force; return F.model === 'momentum' ? body.dv[take] * F.gain : F.model === 'boop' ? F.push : F.floor * F.restitution; };
    const look = { ...A.FLAVORS[id], hitstop: null, windHold: 0, name: id };
    const react = Object.fromEntries([['jab', 'hitHigh'], ['cross', 'hitBody']].map(([take, clip]) => {
      const gain = r4(Math.max(0.15, Math.min(1.5, shown(take) / 1.2)));
      const r = A.render(A.reactTake(clip, R, { gain }), look, R, { fps: FPS });
      return [take, { clip, gain, frames: r.frames.map((f) => pack(rigNodesAt(R, f.pose).nodes, about)) }];
    }));
    const guard = A.render(A.reactTake('hitHigh', R, { gain: 0.15 }), { ...look }, R, { fps: FPS }).frames.slice(0, 13).map((f) => pack(rigNodesAt(R, f.pose).nodes, about));
    out.feels[id] = { moves, gather, air, land, dodge, react, guard };
  }
  return out;
}

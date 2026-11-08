// THE FULL-BODY SWING (hero-swing-body.js swingBody): the arm's arc carried by the body on the strike solver's principles: the
// hips lead the chest, the weight moves back then onto the lead foot, the rear foot pivots, the off hand counters a
// one-handed swing, and every key's legs reach their planted feet on the rig. One case a procedure: a forehand, a
// backhand, a two-handed heavy.
import { describe, expect, it } from 'vitest';
import { swingClipKeys } from './hero-swing.js';
import { swingBody, SWING_BODY } from './hero-swing-body.js';
import { STRUCTURED_SWING_BASE } from './hero-gesture.js';
import { validateRig, rigNodesAt } from './station-loft-rig.js';
import { aimClip } from './hero-swing-body.js';
import { heroStance, reachArm } from './hero-stance.js';
import { elbowsDown } from './hero-elbow.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';

const rig = (cast, item) => validateRig(expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast, gesture: 'chop', gear: { right: { item } } }) }).recipe.rig);
const body = (R, word, cls) => swingBody(word, cls, swingClipKeys(word, cls, { base: STRUCTURED_SWING_BASE }), R, rigNodesAt);
const at = (keys, cls, ph) => keys[SWING_BODY.phases[cls].indexOf(ph)];

describe('a swing carried by the whole body', () => {
  it('a forehand: the hips turned back at the coil, leading forward at the cock while the chest is still wound, through the blow onto the lead foot, the rear heel up', () => {
    for (const cast of ['male', 'female']) {
      const R = rig(cast, 'sword'), K = body(R, 'chop', 'normal');
      expect(at(K, 'normal', 'cock').facing).toBeGreaterThan(at(K, 'normal', 'coil').facing);   // (the hips already coming forward)
      expect(at(K, 'normal', 'cock').spine.twist[0]).toBe('right');                                // (the chest still back)
      expect(at(K, 'normal', 'strike').facing).toBeGreaterThan(0);
      expect(at(K, 'normal', 'cock').shift.y).toBeLessThan(0);
      expect(at(K, 'normal', 'strike').shift.y).toBeGreaterThan(0);
      expect(at(K, 'normal', 'strike').heelR).toBeGreaterThan(0);
      // (the off hand out at the cock, home at the hip through the blow)
      expect(at(K, 'normal', 'cock').shL.pitch).toBeGreaterThan(at(K, 'normal', 'strike').shL.pitch);
      // every key stands: both legs reach, the planted feet where the stance put them
      const feet = K.map((k) => { const { nodes, report } = rigNodesAt(R, k); expect(Object.values(report.legs).every((l) => l.reach === 'ok')).toBe(true); return [nodes[R.legs.L.toeBase], nodes[R.legs.R.toeBase]]; });
      for (const f of feet) for (let s = 0; s < 2; s++) for (let a = 0; a < 3; a++) expect(f[s][a]).toBeCloseTo(feet[0][s][a], 6);
    }
  });
  it('a backhand turns the other way; a two-handed swing keeps its own off hand', () => {
    const R = rig('male', 'sword'), B = body(R, 'rising', 'normal');
    expect(at(B, 'normal', 'cock').facing).toBeGreaterThan(0);
    expect(at(B, 'normal', 'strike').facing).toBeLessThan(0);
    const G = rig('male', 'greatsword'), plain = swingClipKeys('cleave', 'heavy', { base: STRUCTURED_SWING_BASE }), C = body(G, 'cleave', 'heavy');
    C.forEach((k, i) => expect(k.shL).toEqual(plain[i].shL));
    expect(at(C, 'heavy', 'strike').facing).toBeGreaterThan(at(C, 'heavy', 'load').facing);
  });
  it('the action style: a wider stance, the wind-up and the follow-through flung further from ready, the blow where it was', () => {
    const R = rig('male', 'sword'), keys0 = swingClipKeys('chop', 'normal', { base: STRUCTURED_SWING_BASE });
    const plain = swingBody('chop', 'normal', keys0, R, rigNodesAt), act = swingBody('chop', 'normal', keys0, R, rigNodesAt, 'action');
    // (the trunk swung through: the shoulder line's sweep on the rig from the wind-up to the follow; and the base the feet
    // stand on)
    const N = (K, ph) => rigNodesAt(R, at(K, 'normal', ph)).nodes;
    const line = (n) => Math.atan2(n.shoulderR[1] - n.shoulderL[1], n.shoulderR[0] - n.shoulderL[0]) * 180 / Math.PI;
    const sweep = (K) => Math.abs(line(N(K, 'follow')) - line(N(K, 'cock')));
    const base = (K) => { const n = N(K, 'strike'); return Math.hypot(...[0, 1].map((a) => n[R.legs.L.toeBase][a] - n[R.legs.R.toeBase][a])); };
    expect(sweep(act)).toBeGreaterThan(sweep(plain) * 1.5);
    expect(base(act)).toBeGreaterThan(base(plain) * 1.15);
    expect(at(act, 'normal', 'strike').shR).toEqual(at(plain, 'normal', 'strike').shR);
    expect(act[0].stance).toBeGreaterThan(plain[0].stance);
    expect(Math.abs(at(act, 'normal', 'follow').facing)).toBeGreaterThan(Math.abs(at(plain, 'normal', 'follow').facing));
    // (and every key still stands on the rig, its sword hand clear of its head: the elbow low, never over it)
    for (const k of act) {
      const { nodes, report } = rigNodesAt(R, k);
      expect(Object.values(report.legs).every((l) => l.reach === 'ok')).toBe(true);
      const head = [0, 1, 2].map((a) => (nodes.headBase[a] + nodes.headTop[a]) / 2), r = Math.hypot(...[0, 1, 2].map((a) => nodes.headTop[a] - nodes.headBase[a])) / 2;
      expect(Math.hypot(...[0, 1, 2].map((a) => nodes.wristR[a] - head[a]))).toBeGreaterThan(r + 0.08);
      expect(nodes.elbowR[2]).toBeLessThan(nodes.headTop[2]);
    }
  });
  it('a swing not asked for the body is its keys as they were', () => {
    const k = swingClipKeys('chop', 'normal', { base: STRUCTURED_SWING_BASE });
    expect(k.every((x) => x.facing === undefined && x.shift === undefined)).toBe(true);
  });
});

// THE FOOTWORK (hero-swing-body.js moveClip): through a string, a planted foot stays where it stands on the floor while
// the runtime carries the body (a travelling move advances, the lead foot then the rear), and no foot jumps where one
// move cuts into the next. Measured as the page plays it: the runtime's own presses, travel and phases, the page's
// crossfade between clips (advanceGaitMix, the node positions blended), each foot put on the floor by the hero's place.
import { moveClip, readyClip, strikeMoveClip, strikeReadyClip } from './hero-swing-body.js';
import { heroStrike } from './hero-strike.js';
import { heroBox } from './hero-box.js';
import { fitSwing, swingPhases, HELD_SWINGS, swingTiming } from './hero-swing.js';
import { layeredClip, plantedFoot } from './station-loft-rig.js';
import { createWorld, stepWorld, advanceGaitMix } from '../worlds/controllable-world.js';
import { BASIC_COMBOS, BASIC_ARSENAL, lowerCombos, lowerArsenal } from '../gameworld/combos.js';

const CONTACT = [0.44, 0.52];
function chain({ footwork, foeAt = 6, style = null, fist = false, presses = { 0: { fire: 1 }, 2: { fire: 1 }, 17: { fire: 1 } } }) {
  const R = rig('male', 'sword'), M = fist ? lowerArsenal(BASIC_ARSENAL).find((W) => W.id === 'fist').moveset : lowerCombos(BASIC_COMBOS);
  const ctx = { R, cls: 'normal', base: STRUCTURED_SWING_BASE, grip: [], own: 'chop', body: true, style, timing: style ? swingTiming('normal', style) : null, contact: CONTACT, layeredClip, rigNodesAt, plantedFoot, swingClipKeys, fitSwing, swingPhases, HELD_SWINGS };
  const clips = {};
  for (const mv of Object.values(M.moves)) if (mv.swing) { clips[mv.clip] = moveClip(mv, { ...ctx, footwork }); clips[`${mv.clip}_still`] = moveClip({ ...mv, travel: null }, ctx); }
  clips.mv_ready = readyClip(ctx);   // (the fighting stance: the idle in combat)
  if (fist) {
    // (the fist: the body's strikes, their guard its stance)
    const sc = { R, rigNodesAt, plantedFoot, solvers: { strike: heroStrike, box: heroBox } };
    for (const mv of Object.values(M.moves)) { clips[mv.clip] = strikeMoveClip(mv, { ...sc, footwork }); clips[`${mv.clip}_still`] = strikeMoveClip({ ...mv, travel: null }, sc); }
    clips[M.ready] = strikeReadyClip('jab', sc);
  }
  const w = createWorld({ entities: [
    { id: 'p', rule: { type: 'platform', eye: 0, speed: 6, strike: 'melee', strikeReach: 1.6, strikeDamage: 2, strikeContact: CONTACT, moveset: M, moveClips: true, combat: { near: 10, far: 15, linger: 3, speed: 2.4, stride: 1.6 } }, transform: { pos: [0, 0, 0], heading: 0 } },
    { id: 'foe', team: 'foes', body: { type: 'box', size: [0.6, 0.6, 1.8], hittable: true, hp: 1e6, poise: 1 }, rule: { type: 'static' }, transform: { pos: [foeAt, 0, 0], heading: Math.PI } },
  ] });
  const p = w.byId.p, hooks = { ground: () => 0 }, mix = {}, feet = [], dt = 1 / 60;
  for (let i = 0; i < 4; i++) stepWorld(w, {}, dt, hooks);
  const nodesOf = (clip, u) => rigNodesAt(R, clips[clip](u)).nodes;
  // (standing in combat first, then the string, then standing again: every frame the page draws)
  for (let f = 0; f < 200; f++) {
    const k = f - 20;
    stepWorld(w, presses[k] ?? {}, dt, hooks);
    const mode = p.swingT != null ? p.swingClip : p.moving ? p.locomotion : (p.idleClip || 'idle'), phase = p.swingT ?? 0;
    if (!clips[mode]) { feet.push(null); continue; }
    advanceGaitMix(mix, mode, phase, dt, mode.startsWith('mv_') ? M.blend : 0.18);   // (the page's: into a move's own clip, the moveset's blend)
    const cur = nodesOf(mix.mode, mix.phase), prev = mix.prevMode && clips[mix.prevMode] ? nodesOf(mix.prevMode, mix.prevPhase) : null;
    const node = (k) => (prev ? cur[k].map((v, a) => prev[k][a] + (v - prev[k][a]) * mix.w) : cur[k]);
    // (the rig's forward is +y; the hero faces its heading)
    const h = p.transform.heading - Math.PI / 2, c = Math.cos(h), s = Math.sin(h);
    feet.push({ at: `${mode}@${phase.toFixed(3)} w${(mix.w ?? 1).toFixed(2)}`, ...Object.fromEntries(['L', 'R'].map((S) => { const q = node(R.legs[S].toeBase); return [S, [p.transform.pos[0] + c * q[0] - s * q[1], p.transform.pos[1] + s * q[0] + c * q[1], q[2]]]; })) });
  }
  // a planted foot (its toe base on the floor in two frames running): how far it moved across the floor between them
  let worst = 0, total = 0;
  expect(feet.filter(Boolean).length).toBeGreaterThan(150);   // (the idle in combat is the fighting stance: every frame drawn)
  for (let i = 1; i < feet.length; i++) for (const S of ['L', 'R']) {
    if (!feet[i - 1] || !feet[i]) continue;
    const a = feet[i - 1][S], b = feet[i][S];
    if (a[2] < 0.03 && b[2] < 0.03) { const d = Math.hypot(b[0] - a[0], b[1] - a[1]); worst = Math.max(worst, d); total += d; if (process.env.FW_DEBUG && footwork && d > 0.005) console.log('slip', S, i, d.toFixed(4), feet[i].at); }
  }
  // (the rear foot through a lunge: how far it moved on the floor before the blow, and whether it came up after)
  const rearAt = (i) => feet[i] && feet[i].R;
  return { worst, total, frames: feet.length, travelled: p.transform.pos[0], feet };
}

describe('the footwork through a string', () => {
  it('L L L: the planted feet hold the floor while the body steps and lunges in, and no foot jumps between the cuts', () => {
    const sk = chain({ footwork: false }), fw = chain({ footwork: true });
    expect(fw.travelled).toBeGreaterThan(0.95);   // (two steps and the lunge: 0.25 + 0.25 + 0.5 m)
    // (the plain swings skate: their feet ride the body across the floor)
    expect(sk.total).toBeGreaterThan(0.5);
    expect(fw.worst).toBeLessThan(0.01);
    expect(fw.total).toBeLessThan(0.05);
  });
  it('a lunge: the lead foot drives out and lands with the blow, the rear foot holds behind it, then recovers forward', () => {
    const L = chain({ footwork: true, presses: { 0: { heavy: 1 } } });
    expect(L.worst).toBeLessThan(0.01);
    expect(L.travelled).toBeCloseTo(0.6, 2);
    // the stance at the blow is the lunge's: the feet apart by the stance's own split and most of the travel
    const at = L.feet.filter(Boolean), y = (f, S) => f[S][0];
    const widest = Math.max(...at.map((f) => y(f, 'L') - y(f, 'R'))), start = y(at[0], 'L') - y(at[0], 'R'), end = y(at[at.length - 1], 'L') - y(at[at.length - 1], 'R');
    expect(widest - start).toBeGreaterThan(0.25);
    // (and it ends in the stance it began in: the rear foot came up)
    expect(Math.abs(end - start)).toBeLessThan(0.01);
  });
  it('the action style (wider, deeper, its own timing) holds the floor as well', () => {
    const A = chain({ footwork: true, style: 'action' });
    expect(A.worst).toBeLessThan(0.01);
    expect(A.travelled).toBeGreaterThan(0.95);
  });
  it('the fist: the jab, the cross and the hook from the guard, the body\'s own strikes, the feet held as well', () => {
    const F = chain({ footwork: true, fist: true });
    expect(F.worst).toBeLessThan(0.01);
    expect(F.travelled).toBeGreaterThan(0.6);   // (0.15 + 0.2 + the hook's 0.35 lunge)
  });
  it('a foe too near for the travel: the moves play in place, the feet still', () => {
    const near = chain({ footwork: true, foeAt: 1.0 });
    expect(near.travelled).toBeLessThan(0.05);
    expect(near.worst).toBeLessThan(0.01);
  });
});

// THE SIDEARMS' AIMS (aimClip): stances in their own words, solved on the rig. One case a procedure: the archer's draw
// (a stance and its string hand re-solved along the arrow), the gunslinger's held guns.
describe('the aims', () => {
  const R = rig('male', 'sword'), N = (p) => rigNodesAt(R, p).nodes;
  const ctx = { R, stance: heroStance, reachArm, rigNodesAt, elbowsDown };
  it('the archer: the bow hand straight out on the target line at its shoulder; the string drawn straight back along the arrow to the jaw; the feet still', () => {
    const c = aimClip('archer', ctx);
    expect(c.aim.string).toBe('R');   // (the bow in the left hand: a right-handed archer)
    for (const k of ['nocked', 'drawn']) { expect(c.aim.checks[k].com.margin).toBeGreaterThan(0); expect(c.aim.checks[k].reach).toEqual({ L: 'ok', R: 'ok' }); }
    const at = [0, 0.25, 0.5, 0.75, 1].map((u) => N(c(u)));
    const arm = Math.hypot(...[0, 1, 2].map((i) => R.joints.shoulderL[i] - R.joints.elbowL[i])) + Math.hypot(...[0, 1, 2].map((i) => R.joints.elbowL[i] - R.joints.wristL[i]));
    for (const n of at) {
      expect(Math.abs(n.wristL[0])).toBeLessThan(0.03);                               // (on the target line)
      expect(Math.abs(n.wristL[2] - n.shoulderL[2])).toBeLessThan(0.06);              // (at its shoulder's height)
      expect(Math.hypot(...[0, 1, 2].map((i) => n.wristL[i] - n.shoulderL[i]))).toBeGreaterThan(0.85 * arm);   // (straight)
      for (const s of ['L', 'R']) for (let i = 0; i < 3; i++) expect(n[R.legs[s].toeBase][i]).toBeCloseTo(at[0][R.legs[s].toeBase][i], 4);
    }
    // the string hand: from an arrow's length short of the bow hand back to the jaw, never off the line between them
    const a = at[0].wristR, b = at[4].wristR;
    expect(at[0].wristL[1] - a[1]).toBeGreaterThan(0.25);
    expect(Math.hypot(b[0] - at[4].headBase[0], b[1] - at[4].headBase[1], b[2] - at[4].headBase[2])).toBeLessThan(0.08);
    const ab = [0, 1, 2].map((i) => b[i] - a[i]), L2 = ab.reduce((x, v) => x + v * v, 0);
    for (const n of at.slice(1, 4)) {
      const t = [0, 1, 2].reduce((x, i) => x + (n.wristR[i] - a[i]) * ab[i], 0) / L2;
      expect(Math.hypot(...[0, 1, 2].map((i) => n.wristR[i] - (a[i] + ab[i] * t)))).toBeLessThan(0.04);
    }
  });
  it('the gunslinger: square, both guns straight out at the shoulders\' height, the arms all but straight', () => {
    const c = aimClip('gunslinger', ctx), n = N(c(0));
    expect(c.aim.checks.held.com.margin).toBeGreaterThan(0);
    for (const s of ['L', 'R']) {
      expect(n[`wrist${s}`][1] - n[`shoulder${s}`][1]).toBeGreaterThan(0.45);
      expect(Math.abs(n[`wrist${s}`][2] - n[`shoulder${s}`][2])).toBeLessThan(0.1);
      expect(c(0)[`elbow${s}`]).toBeLessThan(15);
    }
    expect(n.wristL[0]).toBeCloseTo(-n.wristR[0], 3);
  });
});

// hero-reach — space boxer on a real hero rig (the realistic form, from the guard): a surface of the hand lands on its
// target facing along its approach (checked on the whole rig, not the solve); a straight strike lines the forearm up
// behind the fist; a near target is struck from another approach than the straight; a locked hand keeps its frame
// along a path; the drill's clip, as played, lands every target within the servos, keeps to its drive, balanced, starts
// and ends on the guard, and is the same for the same seed; the left hand reaches as the right; past the arm's reach the
// body joins in a rung at a time (the girdle, the trunk, the hips and weight, a step), as little as lands it, balanced
// over its feet; a hook drives along an arc that meets its target along its approach.
import { describe, expect, it } from 'vitest';
import { validateRig } from './station-loft-rig.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { WRIST_RANGE } from './hero-grip.js';
import { handFeatures, reachTarget, strikeTarget, contactOf, stanceBody, approachOf, targetDrill, drivePath, SURFACES, RUNGS } from './hero-reach.js';
import { rigNodesAt } from './station-loft-rig.js';
import { elbowsDown } from './hero-elbow.js';
import { comOf, hull, margin } from './hero-stance.js';
import { thoraxFrame } from './hero-servo.js';

const R = validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast: 'male', form: 'realistic' }) }).recipe.rig);
const G = stanceBody(R, 'guard', 'R'), sh = G.nodes.shoulderR, Tf = thoraxFrame(G.nodes);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const reachTo = (S, surface) => { const F = handFeatures(R, S); return dist(R.joints[`shoulder${S}`], R.joints[`elbow${S}`]) + dist(R.joints[`elbow${S}`], R.joints[`wrist${S}`]) + dist(F.surfaces[surface].p, F.wrist); };
/** a point `share` of the reach out from the shoulder, toward the thorax's forward, `up` and `out` (metres) */
const BODY = ['shoulders', 'spine', 'facing', 'shift', 'sink', 'feet'];
const balanceOf = (pose) => { const n = rigNodesAt(R, elbowsDown(R, pose)).nodes, pts = Object.values(R.legs).flatMap((L) => [L.toeBase, L.toeTip, L.hock].map((j) => [n[j][0], n[j][1]])); return margin(hull(pts), comOf(n)); };
const ahead = (share, { up = 0, out = 0 } = {}) => { const k = share * reachTo('R', 'knuckles'); return [0, 1, 2].map((i) => sh[i] + Tf.fwd[i] * k + Tf.up[i] * up + Tf.right[i] * out); };

describe('hero-reach', () => {
  it('reads the hand’s surfaces off the rig’s own hand: the fist’s front past the knuckles, facing along the hand', () => {
    const F = handFeatures(R, 'R');
    for (const name of Object.keys(SURFACES)) expect(F.surfaces[name], name).toBeTruthy();
    const k = F.surfaces.knuckles, along = F.axes.along;
    const past = (k.p[0] - R.joints.middleMcpR[0]) * along[0] + (k.p[1] - R.joints.middleMcpR[1]) * along[1] + (k.p[2] - R.joints.middleMcpR[2]) * along[2];
    expect(past).toBeGreaterThan(0);
    expect(k.n).toEqual(along);
    expect(handFeatures(R, 'R')).toBe(F);
  }, 120000);

  it('lands a surface on its target facing along its approach, on the whole rig as a clip plays it', () => {
    for (const surface of ['knuckles', 'palmHeel']) {
      const at = ahead(0.85, { up: -0.05 }), a = reachTarget(R, G.body, 'R', { at, surface, approach: approachOf('straight', at, sh, Tf, 'R') }, { n0: G.nodes });
      const c = contactOf(R, { ...G.body, ...a.pose }, 'R', a.frame);
      expect(c.err, surface).toBeLessThan(0.002); expect(c.approachErr, surface).toBeLessThan(1); expect(c.frameErr, surface).toBeLessThan(1);
      for (const k of ['flex', 'deviation', 'twist']) { expect(a.wrist[k]).toBeGreaterThanOrEqual(WRIST_RANGE[k][0] - 0.5); expect(a.wrist[k]).toBeLessThanOrEqual(WRIST_RANGE[k][1] + 0.5); }
    }
  }, 120000);

  it('the force line: a straight punch lines the forearm up behind the fist, the approach aimed off the shoulder’s line', () => {
    const at = ahead(0.8), a = reachTarget(R, G.body, 'R', { at, surface: 'knuckles', approach: approachOf('straight', at, sh, Tf, 'R') }, { n0: G.nodes });
    expect(Math.abs(a.wrist.flex)).toBeLessThan(10); expect(Math.abs(a.wrist.deviation)).toBeLessThan(10);
    expect(a.frame.aim, 'short of full reach the forearm cannot lie along the shoulder’s line').toBeGreaterThan(5);
  }, 120000);

  it('a near target is struck from another approach than the straight (the punch line)', () => {
    const a = strikeTarget(R, G.body, 'R', { at: ahead(0.45), surface: 'knuckles' }, { n0: G.nodes });
    expect(a.family).not.toBe('straight');
    expect(a.tried.straight).toBeGreaterThan(a.cost);
    expect(a.rung, 'in reach: the arm alone, the body still').toBe(0);
    for (const k of BODY) expect(a.pose[k], k).toBeUndefined();
  }, 120000);

  it('a locked hand keeps its frame while the arm carries it back along its approach', () => {
    const at = ahead(0.8), hit = reachTarget(R, G.body, 'R', { at, surface: 'knuckles' }, { n0: G.nodes });
    const back = at.map((v, i) => v - hit.frame.approach[i] * 0.12);
    const r = reachTarget(R, G.body, 'R', { at: back, surface: 'knuckles' }, { n0: G.nodes, seed: hit.x, lock: hit.frame });
    const c = contactOf(R, { ...G.body, ...r.pose }, 'R', r.frame);
    expect(c.err).toBeLessThan(0.002); expect(c.frameErr).toBeLessThan(1);
    expect(Math.hypot(...[0, 1, 2].map((i) => r.frame.m[i][0] - hit.frame.m[i][0]))).toBeLessThan(1e-9);
  }, 120000);

  it('the drill’s clip, as played, lands each target within the servos, keeps to its drive, balanced, and starts and ends on the guard', () => {
    const D = targetDrill(R, { seed: 3, count: 2, surfaces: ['knuckles', 'knife'] });
    for (const c of D.checks.targets) { expect(c.contact).toBeLessThan(0.005); expect(c.approach).toBeLessThan(5); expect(c.past).toEqual([]); expect(c.path).toBeLessThan(0.03); expect(c.balance).toBeGreaterThan(0); }
    const a = D.clip.fn(0), b = D.clip.fn(1);
    for (const k of ['shR', 'elbowR']) expect(JSON.stringify(b[k])).toBe(JSON.stringify(a[k]));
    expect(D.targets.map((x) => x.t)).toEqual([...D.targets.map((x) => x.t)].sort((x, y) => x - y));
    const again = targetDrill(R, { seed: 3, count: 2, surfaces: ['knuckles', 'knife'] });
    expect(JSON.stringify(again.keys)).toBe(JSON.stringify(D.keys));
  }, 240000);

  it('the left hand reaches as the right does', () => {
    const L = stanceBody(R, 'guard', 'L'), TL = thoraxFrame(L.nodes), s = L.nodes.shoulderL, k = 0.8 * reachTo('L', 'knuckles');
    const at = [0, 1, 2].map((i) => s[i] + TL.fwd[i] * k);
    const a = reachTarget(R, L.body, 'L', { at, surface: 'knuckles' }, { n0: L.nodes });
    const c = contactOf(R, { ...L.body, ...a.pose }, 'L', a.frame);
    expect(c.err).toBeLessThan(0.002); expect(c.approachErr).toBeLessThan(1);
  }, 120000);

  it('the ladder: past the arm’s reach the body joins in, a rung at a time, as little as lands it, over its feet', () => {
    const at = ahead(1.15, { up: -0.05 }), a = strikeTarget(R, G.body, 'R', { at, surface: 'knuckles' }, { n0: G.nodes });
    expect(a.tried[a.family], 'the arm alone misses').toBeGreaterThan(100);
    expect(a.rung).toBeGreaterThan(0); expect(a.rung).toBeLessThan(RUNGS.length - 1);
    const pose = { ...G.body, ...a.pose }, c = contactOf(R, pose, 'R', a.frame);
    expect(c.err).toBeLessThan(0.002); expect(a.hard).toEqual([]);
    for (const [k, v] of Object.entries(a.ladder)) expect(Math.abs(v), k).toBeGreaterThan(0);
    expect(balanceOf(pose)).toBeGreaterThan(0);
  }, 240000);

  it('a far, low target takes a step: the striking foot moves toward it and the hand lands, the body over its feet', () => {
    const at = ahead(1.6, { up: -0.3 }), a = strikeTarget(R, G.body, 'R', { at, surface: 'knuckles' }, { n0: G.nodes });
    expect(RUNGS[a.rung]).toBe('step'); expect(a.step.side).toBe('R');
    const before = G.body.feet.R, after = a.pose.feet.R, toward = [at[0] - before[0], at[1] - before[1]];
    expect((after[0] - before[0]) * toward[0] + (after[1] - before[1]) * toward[1]).toBeGreaterThan(0);
    const pose = { ...G.body, ...a.pose };
    expect(contactOf(R, pose, 'R', a.frame).err).toBeLessThan(0.002);
    expect(balanceOf(pose)).toBeGreaterThan(0);
  }, 240000);

  it('a straight drives along its approach; a hook along an arc that meets its target along its approach', () => {
    const at = ahead(0.8), a = reachTarget(R, G.body, 'R', { at, surface: 'knuckles' }, { n0: G.nodes });
    const d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    const line = drivePath(a.frame, 'straight', G.nodes.shoulderR, Tf, { stroke: 0.15, n: 3 });
    expect(d(line[0].at, line[3].at)).toBeCloseTo(0.15, 6); expect(d(line[3].at, at)).toBeLessThan(1e-9);
    const arc = drivePath(a.frame, 'hook', G.nodes.shoulderR, Tf, { stroke: 0.15, n: 6 });
    expect(d(arc[6].at, at)).toBeLessThan(1e-9);
    const last = [0, 1, 2].map((i) => arc[6].at[i] - arc[5].at[i]), l = Math.hypot(...last), cos = last.reduce((s2, v, i) => s2 + (v / l) * a.frame.approach[i], 0);
    expect(Math.acos(Math.min(1, cos)) * 180 / Math.PI, 'the last step along the approach, within half a step’s turn').toBeLessThan(10);
    const chord = d(arc[0].at, arc[6].at), length = arc.slice(1).reduce((s2, q, i) => s2 + d(q.at, arc[i].at), 0);
    expect(length, 'an arc, not a line').toBeGreaterThan(chord * 1.01);
    for (let i = 0; i < 6; i++) expect(Math.hypot(...[0, 1, 2].map((k) => arc[i + 1].m[k][0] - arc[i].m[k][0])), 'the hand turns along it').toBeGreaterThan(1e-4);
  }, 120000);
});

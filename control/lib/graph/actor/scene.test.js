// actors in a scene: a screenplay on one clock, in a set of marks; each speaks to the other and listens; a cross walks
import { describe, it, expect } from 'vitest';
import { parseScreenplay } from './screenplay.js';
import { actScene, TURN, WALK } from './scene.js';
import { BASELINE } from './baseline.js';
import { laws, readReadings } from './readings.js';
import { STYLES, STYLE_NAMES } from './style.js';
import { actBody, poseAt } from './body.js';
import { standOf } from './gestures.js';
import { takeOf } from '../persona/read.js';
import { validateRig, rigNodesAt } from '../polygonizer/station-loft-rig.js';
import { GESTURE_PRESETS } from '../polygonizer/hero-gesture.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';

const B = BASELINE.blocked, CAST = B.cast, MARKS = B.marks;
const S = actScene(B);

describe('the screenplay', () => {
  it('reads lines, their faces or notes, the directions and the notes', () => {
    const beats = parseScreenplay('MARA (worried): Hello.\nJON (under his breath): Hi.\nMara crosses to the window.\nJon turns to Mara.\nMara looks at the door.\nJon waits 2 seconds.\nThe rain does not stop.', { cast: CAST, marks: MARKS });
    expect(beats.map((b) => b.kind)).toEqual(['line', 'line', 'cross', 'turn', 'look', 'wait', 'note']);
    expect(beats[0]).toMatchObject({ who: 'mara', face: 'worried' });
    expect(beats[1]).toMatchObject({ who: 'jon', note: 'under his breath' });
    expect(beats[2].to).toEqual({ mark: 'window' });
    expect(beats[3].to).toEqual({ actor: 'mara' });
    expect(beats[5].seconds).toBe(2);
  });

  it('refuses a speaker outside the cast, a cross to no mark, and a script with no line', () => {
    expect(() => parseScreenplay('ANNA: Hi.', { cast: CAST, marks: MARKS })).toThrow(/not in the cast/);
    expect(() => parseScreenplay('MARA: Hi.\nMara crosses to Jon.', { cast: CAST, marks: MARKS })).toThrow(/crosses to a mark/);
    expect(() => parseScreenplay('Mara waits.', { cast: CAST, marks: MARKS })).toThrow(/no line/);
  });
});

describe('the scene on one clock', () => {
  it('is deterministic, its turns in the script\'s order, never overlapping', () => {
    expect(JSON.stringify(actScene(B))).toBe(JSON.stringify(S));
    for (let i = 1; i < S.turns.length; i++) expect(S.turns[i].at).toBeGreaterThanOrEqual(S.turns[i - 1].end);
    expect(S.seconds).toBeGreaterThan(S.turns.at(-1).end);
  });

  it('each actor speaks its own lines on the scene\'s turns', () => {
    for (const [w, A] of Object.entries(S.actors)) {
      const mine = S.turns.filter((T) => T.who === w);
      for (const T of mine) expect(A.speaks.some(([a]) => Math.abs(a - T.at) < 0.01), `${w} at ${T.at}`).toBe(true);
      expect(A.listens).toEqual(S.turns.filter((T) => T.who !== w).map((T) => [T.at, T.end]));
    }
  });

  it('a cross walks from mark to mark at the walk\'s pace, facing its way; a turn faces its target', () => {
    const A = S.actors.mara, [w] = A.walks;
    expect(w.from).toEqual([...MARKS.door]);
    expect(w.to).toEqual([...MARKS.table]);
    expect(w.end - w.start).toBeCloseTo(w.distance / WALK, 2);
    const way = (Math.atan2(w.to[0] - w.from[0], w.to[1] - w.from[1]) * 180) / Math.PI;
    expect(A.root.find((k) => Math.abs(k.t - w.start) < 1e-3).yaw).toBeCloseTo(way, 1);
    // (jon turns to mara where she stands now, at the table)
    const J = S.actors.jon.root.at(-1), toMara = (Math.atan2(MARKS.table[0] - J.x, MARKS.table[1] - J.y) * 180) / Math.PI;
    expect(J.yaw).toBeCloseTo(toMara, 1);
    expect(S.actors.jon.root.at(-1).t - S.actors.jon.root.at(-2).t).toBeCloseTo(TURN, 3);
  });

  it('the speaker looks at whom it speaks to, the listener at the speaker, listening', () => {
    for (const T of S.turns) {
      const other = Object.keys(CAST).find((w) => w !== T.who), mid = (T.at + T.end) / 2;
      const beatAt = (w) => [...S.actors[w].read.beats].reverse().find((b) => b.at <= mid);
      expect(beatAt(T.who).gaze.partner ?? 'glance').toMatch(new RegExp(`${other}|glance`));
      expect(beatAt(other)).toMatchObject({ state: 'listening', gaze: { partner: T.who } });
    }
  });

  it('law 5: the listeners regard the speaker, where the persona alone regarded no one', () => {
    for (const A of Object.values(S.actors)) expect(laws({ read: A.read, take: takeOf(A.read), listens: A.listens }).listening.reads.regard).toBeGreaterThan(0.9);
    expect(readReadings(S.actors.mara.read).gaze.share['partner:jon']).toBeGreaterThan(0.8);
  });

  it('a listener nods only in the speaker\'s turn, and never in a style that does not nod', () => {
    const quiet = STYLE_NAMES.find((n) => !STYLES[n].gesture.vocab.includes('nod'));
    const Q = actScene({ ...B, cast: Object.fromEntries(Object.entries(CAST).map(([w, C]) => [w, { ...C, style: quiet }])) });
    for (const A of Object.values(Q.actors)) expect(A.read.body.filter((b) => b.cause === 'listen')).toEqual([]);
    for (const A of Object.values(S.actors)) for (const b of A.read.body.filter((x) => x.cause === 'listen')) expect(A.listens.some(([a, e]) => b.t >= a && b.t <= e + 0.5)).toBe(true);
  });
});

describe('the body walking a cross', () => {
  const R = validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast: 'female' }) }).recipe.rig);
  const A = S.actors.mara, take = actBody(A.read, { R, base: standOf(R, GESTURE_PRESETS.relaxed.female), walks: A.walks, pole: 'female' });

  it('the planted foot keeps its place on the floor while the body crosses', () => {
    const smooth = (u) => u * u * (3 - 2 * u), wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
    const place = (s) => { const K = A.root; for (let k = 1; k < K.length; k++) if (s <= K[k].t) { const a = K[k - 1], c = K[k], u = (s - a.t) / Math.max(1e-6, c.t - a.t); return { x: a.x + (c.x - a.x) * u, y: a.y + (c.y - a.y) * u, yaw: a.yaw + wrap(c.yaw - a.yaw) * smooth(u) }; } return K.at(-1); };
    const world = (t, j) => { const n = rigNodesAt(R, poseAt(take, t)).nodes, P = place(t), a = (-P.yaw * Math.PI) / 180, h = n[j]; return [Math.cos(a) * h[0] - Math.sin(a) * h[1] + P.x, Math.sin(a) * h[0] + Math.cos(a) * h[1] + P.y, h[2]]; };
    const [w] = A.walks, dt = 1 / 30, grounded = [];
    for (let t = w.start + 0.2; t < w.end - 0.2; t += dt) for (const j of ['toeTipL', 'toeTipR']) { const p = world(t, j), q = world(t + dt, j); if (p[2] < 0.04) grounded.push(Math.hypot(q[0] - p[0], q[1] - p[1]) / dt); }
    grounded.sort((x, y) => x - y);
    expect(grounded.length).toBeGreaterThan(10);
    expect(grounded[Math.floor(grounded.length / 2)]).toBeLessThan(0.05);
  });

  it('an arm gesture on a cross is let go; the stand comes back after it', () => {
    const [w] = A.walks, T = actBody({ seconds: A.read.seconds, body: [{ t: (w.start + w.end) / 2, gesture: 'point', cause: 'stress' }] }, { R, base: {}, walks: A.walks });
    expect(T.gestures).toEqual([]);
    expect(T.dropped[0].why).toMatch(/walking/);
    expect(poseAt(take, w.end + 1).support).toBe(GESTURE_PRESETS.relaxed.female.support);
  });
});

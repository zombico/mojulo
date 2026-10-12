import { describe, it, expect } from 'vitest';
import { readHeartbeat, heartbeatInFrame, heartbeatFromLevel, HEARTBEAT_PRESETS, sideOf } from './heartbeat.js';
import { readLevel } from '../level/graph.js';
import { sequentialLevel, sequentialOrder } from '../level/sequential.js';
import { compileLevelGround } from '../level/ground.js';
import { outTrailOf } from './out-trail-board.js';
import { assembleHeartbeatScene, heartbeatReferenceLevel } from '../level/heartbeat-scene.js';

// A heartbeat (heartbeat.js): the flow of a level's land apart from its look. Relative places, metre heights: laid
// on another level it is the same ground to walk (its marks at the same share of the level, as tall, as deep).
const level = (runs, ground, kit = 'isekai-meadow', seed = 3) => ({ kit, seed, nodes: Object.fromEntries(runs.map((run, i) => [`t${i + 1}`, { trail: { run } }])), ...(ground ? { ground } : {}) });
const sitesOf = (L) => {
  const G = readLevel(L), laid = sequentialLevel(G);
  let o = 0;
  return laid.stages.map((s) => { const site = outTrailOf(s.manifest).site, r = { site, origin: o }; o += site.D; return r; });
};
// the ground at a relative place of a level: u across its site, v along its whole walk
const groundAt = (L, u, v) => {
  const S = sitesOf(L), len = S.reduce((a, s) => a + s.site.D, 0), y = v * len, t = S.find((s) => y < s.origin + s.site.D) ?? S[S.length - 1];
  return t.site.ground(t.site.grid.x0 + u * (t.site.W - t.site.grid.x0), y - t.origin);
};

describe('reading a heartbeat', () => {
  it('every preset reads, and a variant copies one with `from`', () => {
    for (const id of Object.keys(HEARTBEAT_PRESETS)) expect(readHeartbeat(id).id).toBe(id);
    const v = readHeartbeat({ from: 'ascent', pulse: { amplitude: 8 } });
    expect(v).toMatchObject({ id: 'ascent-variant', pulse: { amplitude: 8, depth: 2 }, rise: HEARTBEAT_PRESETS.ascent.rise });
  });

  it('teaches what is wrong', () => {
    expect(() => readHeartbeat('lumpy')).toThrow(/'lumpy' is not a preset/);
    expect(() => readHeartbeat({ id: 'x', colour: {} })).toThrow(/'colour' is not a setting/);
    expect(() => readHeartbeat({ id: 'x', rise: [[0, 0], [2, 3]] })).toThrow(/rise is two or more \[v, metres\]/);
    expect(() => readHeartbeat({ id: 'x', marks: [{ op: 'raise', at: [3, 0.5], height: 2 }] })).toThrow(/at is \[u, v\]/);
    expect(() => readHeartbeat({ id: 'x', marks: [{ op: 'cliff', path: [[0.2, 0.5], [0.8, 0.5]], height: 4 }] })).toThrow(/names its high side/);
    expect(() => readHeartbeat({ id: 'x', marks: [{ op: 'raise', at: [0.5, 0.5] }] })).toThrow(/height is metres/);
  });

  it('lowers into a frame: places scaled, heights kept, a cliff\'s high place made its side', () => {
    const { tune, edits } = heartbeatInFrame(readHeartbeat('broken-ground'), { x0: -10, x1: 40, length: 200 });
    expect(tune).toMatchObject({ amplitude: 6, depth: 5 });
    expect(edits[0]).toMatchObject({ op: 'cliff', path: [[12.5, 60], [40, 60]], height: 5, side: 'left' });
    expect(edits[1]).toMatchObject({ op: 'gorge', path: [[5, 120], [40, 120]], depth: 5 });
    expect(sideOf([[0, 0], [1, 0]], [0.5, -1])).toBe('right');
  });
});

describe('the same ground to walk', () => {
  it('a heartbeat on a short and a long level puts its gorge at the same share of the level, as deep', () => {
    const hb = { id: 'cut', marks: [{ op: 'gorge', path: [[0.2, 0.5], [1, 0.5]], depth: 6, width: 6, walk: 'keep' }] };
    for (const runs of [[14], [16, 18]]) {
      const plain = level(runs), cut = level(runs, { heartbeat: hb });
      expect(groundAt(cut, 0.85, 0.5) - groundAt(plain, 0.85, 0.5)).toBeCloseTo(-6, 0);
      expect(groundAt(cut, 0.85, 0.2)).toBeCloseTo(groundAt(plain, 0.85, 0.2), 3);
    }
  });

  it('a rise carries the walk: the end stands higher by the rise, on any length', () => {
    const hb = { id: 'up', rise: [[0, 0], [1, 10]] };
    for (const runs of [[14], [14, 14]]) {
      const S0 = sitesOf(level(runs)), S1 = sitesOf(level(runs, { heartbeat: hb }));
      const end = (S) => { const s = S[S.length - 1].site, P = s.out.plan; return P.smoothAt(P.L); };
      expect(end(S1) - end(S0)).toBeGreaterThan(8);
    }
  });

  it('a level\'s own ground exports as a heartbeat that lays back as the same ground', () => {
    const ground = { tune: { amplitude: 5 }, rise: [[2, 0], [15, 6]], edits: [{ op: 'raise', at: 'I6:J8', height: 5, walk: 'keep' }, { op: 'cliff', path: 'F12>J12', height: 4, high: 'H14' }] };
    const L = level([14, 14], ground), G = readLevel(L), laid = compileLevelGround(G, sequentialOrder(G));
    const hb = heartbeatFromLevel(laid.metres, laid.frame, { id: 'exported', source: 'test' });
    expect(hb).toMatchObject({ id: 'exported', pulse: { amplitude: 5 }, source: 'test' });
    expect(hb.marks.map((m) => m.op)).toEqual(['raise', 'cliff']);
    expect(hb.marks[1].side).toBeDefined();
    const back = level([14, 14], { heartbeat: hb });
    for (const [u, v] of [[0.9, 0.12], [0.7, 0.5], [0.5, 0.9]]) expect(groundAt(back, u, v)).toBeCloseTo(groundAt(L, u, v), 1);
  });
});

describe('the heartbeat seen', () => {
  it('a greybox on a reference level: values only, the walk lighter, walkable from the trailhead', () => {
    const P = assembleHeartbeatScene({ kind: 'heartbeat', heartbeat: 'ascent', on: { runs: [12] } });
    expect(P.faces.length).toBeGreaterThan(3000);
    const groups = new Set(P.faces.map((f) => f.group));
    expect([...groups].sort()).toEqual(expect.arrayContaining(['heartbeat:ground', 'heartbeat:walk']));
    expect(P.faces.every((f) => /^#[0-9a-f]{6}$/.test(f.fill))).toBe(true);
    const th = P.anchors.find((a) => a.beat === 'trailhead');
    expect(P.walk.spawn).toEqual([th.at[0], th.at[1], +(th.at[2] + 1.7).toFixed(3)]);
    expect(P.heartbeat).toMatchObject({ id: 'ascent', on: { kit: 'isekai-meadow', runs: [12] } });
    expect(P.heartbeat.map.split('\n').length).toBeGreaterThan(5);
    expect(() => assembleHeartbeatScene({ kind: 'heartbeat', heartbeat: 'ascent', colour: 1 })).toThrow(/'colour' is not a setting of the heartbeat kind/);
    expect(heartbeatReferenceLevel('ascent').nodes).toEqual({ 'stretch-1': { trail: { run: 16 } }, 'stretch-2': { trail: { run: 16 } } });
  });
});

import { describe, it, expect } from 'vitest';
import { firstLevel, readBossWin, storyWins, WINS, FIRST_LEVEL_SEGMENTS } from './first-level.js';
import { readGameworld, MEADOWMARK_HERO } from './index.js';
import { gameStages, stageLevelOrder, stageLane, stageTitle, isStrip, SIDE_BAND, SIDE_ENDS } from './levels.js';
import { foePlacements, hostileCast, RAIL } from './foes.js';
import { POLE_IDS, poleCard } from './feel/cards.js';

// A PLATFORMER'S FIRST LEVEL: its trails in teaching order, each its course and its foes' density; a boss only when the
// creator asks, its win's kind the story's record. Laid in a real world on one template whose card carries the advanced
// moves, every course law holding on the trails as they are built.
const pole = POLE_IDS.find((id) => { const C = poleCard(id); return C.cling && C.dash?.kind === 'dash' && C.dash.jump; });

describe('the first level, as words', () => {
  it('lays basic, meet, advanced, gauntlet in order, each its course and its density; no boss unless asked', () => {
    const L = firstLevel();
    expect(Object.keys(L.walk.nodes)).toEqual(['basic', 'meet', 'advanced', 'gauntlet']);
    expect(Object.values(L.course).map((c) => c.teach)).toEqual(['basic', 'meet', 'advanced', 'gauntlet']);
    expect(L.foes.density).toEqual({ basic: 'none', meet: 'sparse', advanced: 'none', gauntlet: 'dense' });
    expect(L.goal).toBeUndefined();
  });

  it('a boss when asked: the fifth trail, the level\'s boss goal, its win\'s kind kept as the story\'s record', () => {
    const L = firstLevel({ boss: { win: 'rival' } });
    expect(Object.keys(L.walk.nodes)).toEqual(FIRST_LEVEL_SEGMENTS);
    expect(L.course.boss.teach).toBe('boss');
    expect(L.goal).toEqual({ boss: { win: 'rival' } });
    expect(firstLevel({ boss: true }).goal).toEqual({ boss: true });
    expect(readBossWin({ win: 'jobber' }, 'x')).toEqual({ win: 'jobber' });
    expect(() => readBossWin({ win: 'nemesis' }, 'x')).toThrow(new RegExp(Object.keys(WINS).join('.*')));
    expect(() => readBossWin({ hp: 3 }, 'x')).toThrow(/not a boss setting/);
  });

  it('the story so far: each boss\'s win in the book\'s order, a plain boss and a level with none left out', () => {
    const G = { ids: ['a', 'b', 'c'], levels: { a: { goal: { boss: { win: 'jobber' } } }, b: { goal: { boss: true } }, c: { goal: { boss: { win: 'boss' } } } } };
    expect(storyWins(G)).toEqual([{ level: 'a', win: 'jobber' }, { level: 'c', win: 'boss' }]);
  });
});

describe('the first level, laid in a world', () => {
  const lv = 'first';
  const W = { ...MEADOWMARK_HERO, feel: { pole, takes: true }, levels: { [lv]: firstLevel({ boss: { win: 'boss' } }) } };
  delete W.links; delete W.start; delete W.hub;
  const G = readGameworld(W), stages = gameStages(W).filter((s) => s.level === lv);
  const orders = Object.fromEntries(stages.map((s) => [s.node, stageLevelOrder(G, s, { ref: `lv-${s.node}`, heroRef: 'gw-hero' })]));

  it('reads with the world, its boss\'s win among the story\'s', () => {
    expect(G.levels[lv].goal.boss).toEqual({ win: 'boss' });
    expect(storyWins(G)).toEqual([{ level: lv, win: 'boss' }]);
    expect(stages.map((s) => s.node)).toEqual(FIRST_LEVEL_SEGMENTS);
  });

  it('every trail\'s course is laid and holds its laws on the trail as built', () => {
    for (const [node, O] of Object.entries(orders)) {
      expect(O.course?.teach, node).toBe(node);
      const bad = O.laws.filter((l) => l.id.startsWith('course:') && !l.holds);
      expect(bad, node).toEqual([]);
    }
  });

  it('the foes stand at each trail\'s density, on its floors: none on basic and advanced, a few to meet, many in the gauntlet', () => {
    // (the run stands them, runner.js hostileCast, on the stage's beats: the course's floors, its trail node's density)
    const foes = (node) => foePlacements(G, lv, { ...orders[node].ends, node });
    expect(foes('basic')).toEqual([]);
    expect(foes('advanced')).toEqual([]);
    expect(foes('meet').length).toBeGreaterThan(0);
    expect(foes('gauntlet').length).toBeGreaterThan(foes('meet').length);
    // up on the course, not under it
    const lift = (node) => Math.min(...orders[node].ends.beats.filter((b) => b.beat.startsWith('floor-')).map((b) => b.at[2]));
    for (const f of foes('gauntlet')) expect(f.at[2]).toBeGreaterThanOrEqual(lift('gauntlet') - 0.01);
  });
});

describe('the first level from the side: one strip, its trails the segments of one run', () => {
  const lv = 'first';
  const W = { ...MEADOWMARK_HERO, camera: 'side', feel: { pole, takes: true }, levels: { [lv]: firstLevel() } };
  delete W.links; delete W.start; delete W.hub;
  const stages = gameStages(W).filter((s) => s.level === lv), G = readGameworld(W), S = stages[0];
  const O = stageLevelOrder(G, S, { ref: 'lv-one', heroRef: 'gw-hero' }), M = O.args.manifest;

  it('is one stage, a strip on a straight lane: the trails end to end in teaching order, each its own length', () => {
    expect(stages.length).toBe(1);
    expect(isStrip(S.manifest)).toBe(true);
    expect(stageTitle(S)).toBe(G.levels[lv].name ?? lv);   // (its level's name, else its id)
    const seg = S.manifest.side.segments;
    expect(seg.map((x) => x.node)).toEqual(FIRST_LEVEL_SEGMENTS.filter((n) => n !== 'boss'));
    seg.forEach((x, k) => { expect(x.length).toBeGreaterThan(40); if (k) expect(x.s0).toBeCloseTo(seg[k - 1].s0 + seg[k - 1].length, 2); });
    expect(S.manifest.side.length).toBeCloseTo(seg.at(-1).s0 + seg.at(-1).length, 2);
    expect(new Set(stageLane(S).line.map(([x]) => x))).toEqual(new Set([0]));
  });

  it('lays each segment its own course over its own stretch, the ground between them the strip\'s', () => {
    const seg = S.manifest.side.segments, B = M.side.boxes;
    expect(M.blocks).toBeUndefined();
    expect(M.colliders.map(({ min, max }) => [min, max])).toEqual(B.map(({ min, max }) => [min, max]));
    for (const x of seg) {
      const own = O.course.floors.filter((f) => f.node === x.node);
      expect(own.length, x.node).toBeGreaterThan(0);
      for (const f of own) { expect(f.s0).toBeGreaterThanOrEqual(x.s0 - 1e-6); expect(f.s1).toBeLessThanOrEqual(x.s0 + x.length + 1e-6); }
    }
    // (a floor up a wall stands built, the advanced segment's: its face is the one kicked up; the stairs are built too)
    const walls = O.course.gaps.filter((g) => g.kind === 'wall');
    expect(walls.length).toBeGreaterThan(0);
    for (const g of walls) expect(B.some((b) => b.role === 'built' && Math.abs(b.min[1] - (g.s1 - 1.5)) < 1.6), `wall @${g.s1}`).toBe(true);
    // (its catch zones each its own, a segment's name in it; its laws each its node's, and they hold)
    const zones = M.events.sources.filter((x) => x.zone?.startsWith('__course-')).map((x) => x.zone);
    expect(new Set(zones).size).toBe(zones.length);
    expect(O.laws.filter((l) => l.id.startsWith('course:') && !l.holds)).toEqual([]);
    expect(new Set(O.laws.filter((l) => l.id.startsWith('course:')).map((l) => l.id.split(':')[1]))).toEqual(new Set(seg.map((x) => x.node)));
  });

  it('stands each segment\'s foes at its own density, on the rail: none to run, a few to meet, many in the gauntlet', () => {
    const seg = S.manifest.side.segments, foes = hostileCast(G, lv, { ...O.ends, node: S.node }, { refs: {}, rail: { length: S.manifest.side.length } }).entities;
    const inSeg = (n) => { const x = seg.find((q) => q.node === n); return foes.filter((e) => e.rule.rail.join[1] >= x.s0 && e.rule.rail.join[1] <= x.s0 + x.length); };
    expect(inSeg('basic')).toEqual([]);
    expect(inSeg('advanced')).toEqual([]);
    expect(inSeg('meet').length).toBeGreaterThan(0);
    expect(inSeg('gauntlet').length).toBeGreaterThan(inSeg('meet').length);
    for (const e of foes) { expect(e.rule.rail).toMatchObject({ wait: true }); expect(e.transform.pos[0]).toBe(RAIL.back); }
  });

  it('its camera settles on the stairs and holds in from the lane\'s ends', () => {
    expect(M.camera).toMatchObject({ rule: 'side', band: [...SIDE_BAND], ends: SIDE_ENDS });
  });

  it('legend menu: no controls on the play screen (the pause menu teaches them); absent, the level\'s first seconds do', () => {
    const W2 = { ...W, mechanics: { legend: 'menu' } };
    expect(JSON.stringify(M)).toContain('A / D  run');
    expect(JSON.stringify(stageLevelOrder(readGameworld(W2), gameStages(W2).filter((s) => s.level === lv)[0], { ref: 'lv-one', heroRef: 'gw-hero' }).args.manifest)).not.toContain('A / D  run');
  });

  it('a side world with no course lays its trails as it did', () => {
    for (const s of gameStages({ ...MEADOWMARK_HERO, camera: 'side' })) expect(isStrip(s.manifest), s.node).toBe(false);
  });
});

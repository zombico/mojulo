import { describe, it, expect } from 'vitest';
import { firstLevel, readBossWin, storyWins, WINS, FIRST_LEVEL_SEGMENTS } from './first-level.js';
import { readGameworld, MEADOWMARK_HERO } from './index.js';
import { gameStages, stageLevelOrder, stageLane, isStrip, SIDE_BAND, SIDE_ENDS } from './levels.js';
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

describe('the first level from the side: a side strip, the course in the cube\'s layers', () => {
  const lv = 'first';
  const W = { ...MEADOWMARK_HERO, camera: 'side', feel: { pole, takes: true }, levels: { [lv]: firstLevel() } };
  delete W.links; delete W.start; delete W.hub;
  const stages = gameStages(W).filter((s) => s.level === lv), G = readGameworld(W);
  const order = (s, W2 = W) => stageLevelOrder(W2 === W ? G : readGameworld(W2), s, { ref: `lv-${s.node}`, heroRef: 'gw-hero' });

  it('each trail is a strip its trail\'s length, on a straight lane, in a geocube', () => {
    for (const s of stages) {
      expect(isStrip(s.manifest), s.node).toBe(true);
      expect(s.manifest.trail, s.node).toBeUndefined();
      expect(s.manifest.side.length, s.node).toBeGreaterThan(40);
      expect(typeof s.manifest.cube).toBe('string');
      expect(new Set(stageLane(s).line.map(([x]) => x))).toEqual(new Set([0]));
    }
  });

  it('its course is the level: each run terrain or a structure (the floor up a wall and the stairs built), its boxes the colliders', () => {
    const O = order(stages.find((s) => s.node === 'advanced')), M = O.args.manifest, B = M.side.boxes;
    expect(M.blocks).toBeUndefined();
    expect(M.colliders.map(({ min, max }) => [min, max])).toEqual(B.map(({ min, max }) => [min, max]));
    expect(new Set(B.map((b) => b.role))).toEqual(new Set(['terrain', 'built']));
    // (the floor after each wall gap stands built: its face is the one kicked up)
    const walls = O.course.gaps.filter((g) => g.kind === 'wall');
    expect(walls.length).toBeGreaterThan(0);
    for (const g of walls) expect(B.some((b) => b.role === 'built' && Math.abs(b.min[1] - (g.s1 - 1.5)) < 1.6), `wall @${g.s1}`).toBe(true);
    // (and the course's laws hold on the strip as on a trail)
    expect(O.laws.filter((l) => l.id.startsWith('course:') && !l.holds)).toEqual([]);
  });

  it('its foes wait off the rail and come in to it', () => {
    // (the run stands them: runner.js hands a strip's stage its rail, the length of its lane)
    const s = stages.find((x) => x.node === 'meet'), O = order(s);
    const foes = hostileCast(G, lv, { ...O.ends, node: s.node }, { refs: {}, rail: { length: s.manifest.side.length } }).entities;
    expect(foes.length).toBeGreaterThan(0);
    for (const e of foes) {
      expect(e.rule.rail).toMatchObject({ wait: true, a: [0, -RAIL.wake] });
      expect(e.transform.pos[0]).toBe(RAIL.back);                        // behind the lane
      expect(e.rule.rail.join[0]).toBe(0);                               // its place on the rail
    }
  });

  it('its camera settles on the stairs and holds in from the lane\'s ends', () => {
    expect(order(stages[0]).args.manifest.camera).toMatchObject({ rule: 'side', band: [...SIDE_BAND], ends: SIDE_ENDS });
  });

  it('legend menu: no controls on the play screen (the pause menu teaches them); absent, the level\'s first seconds do', () => {
    const W2 = { ...W, mechanics: { legend: 'menu' } };
    expect(JSON.stringify(order(stages[0]).args.manifest)).toContain('A / D  run');
    expect(JSON.stringify(order(gameStages(W2).filter((s) => s.level === lv)[0], W2).args.manifest)).not.toContain('A / D  run');
  });

  it('a side world with no course lays its trails as it did', () => {
    for (const s of gameStages({ ...MEADOWMARK_HERO, camera: 'side' })) expect(isStrip(s.manifest), s.node).toBe(false);
  });
});

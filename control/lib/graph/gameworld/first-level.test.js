import { describe, it, expect } from 'vitest';
import { firstLevel, readBossWin, storyWins, WINS, FIRST_LEVEL_SEGMENTS } from './first-level.js';
import { readGameworld, MEADOWMARK_HERO } from './index.js';
import { gameStages, stageLevelOrder, stageLane, SIDE_VIEW, SIDE_BAND, SIDE_ENDS } from './levels.js';
import { foePlacements } from './foes.js';
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

describe('the first level from the side: nothing between the camera and the hero', () => {
  const lv = 'first';
  const W = { ...MEADOWMARK_HERO, camera: 'side', feel: { pole, takes: true }, levels: { [lv]: firstLevel() } };
  delete W.links; delete W.start; delete W.hub;
  const stages = gameStages(W).filter((s) => s.level === lv);

  it('each trail keeps its camera side clear, from the walk out past the camera, the whole lane long', () => {
    for (const s of stages) {
      const K = s.manifest._viewOut, { line } = stageLane(s);
      expect(K?.length, s.node).toBeGreaterThan(0);
      expect(s.manifest._keepOut, s.node).toEqual(K);          // trees, rocks, bushes; and the grass (_viewOut)
      // every metre of the lane has its strip on the camera's side (the right of the run, `side` in rules-basic.js)
      for (const [x, y] of line) {
        const r = K.find((b) => y >= b[1] && y <= b[3]);
        expect(r, `${s.node} @${y}`).toBeTruthy();
        expect(r[0]).toBeLessThanOrEqual(x + SIDE_VIEW.near + 1e-6);
        expect(r[2]).toBeGreaterThanOrEqual(x + SIDE_VIEW.far - 1e-6);
      }
    }
  });

  it('its camera settles on the stairs and holds in from the lane\'s ends', () => {
    const G = readGameworld(W), O = stageLevelOrder(G, stages[0], { ref: 'lv-side', heroRef: 'gw-hero' });
    expect(O.args.manifest.camera).toMatchObject({ rule: 'side', band: [...SIDE_BAND], ends: SIDE_ENDS });
  });

  it('a side world with no course lays its trails as it did', () => {
    const plain = gameStages({ ...MEADOWMARK_HERO, camera: 'side' });
    for (const s of plain) expect(s.manifest._viewOut, s.node).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';

import { readStage, stageLaws, stagePoints, compileStage, stagePlace, stageBriefingData, SCORE, HAZARDS, FORMATIONS } from './stage.js';
import { designKind, missionsReadout, withMissions, applyMissionEdit } from './designer.js';
import { readRailPlan } from '../skyscape/rail-stage.js';
import { STAGE_DESIGNS, WOLF_SQUADRON_LOOK, wolfSquadronStart } from '../gameworld/wolf-squadron.js';
import { readGameworld } from '../gameworld/world.js';
import { THEME_CARDS } from '../playscape/ui/theme-cards/loader.js';

// ── an arcade stage's design (campaign/stage.js): Wolf Squadron's stages designed whole, told on the holo table, approved
// and compiled onto a rail stage's plan; scored, its medal its score's ──
// (one design per ground: a canyon run and a field of rocks, the two procedures a stage compiles through)
const canyon = Object.values(STAGE_DESIGNS).find((D) => D.route.ground === 'canyon');
const space = Object.values(STAGE_DESIGNS).find((D) => D.route.ground === 'space');

describe('an arcade stage\'s design', () => {
  it('reads a design, teaching each fault by its field', () => {
    const S = readStage(canyon);
    expect(S.waves.map((w) => w.id)).toEqual(canyon.waves.map((w) => w.id));
    const bad = (patch, m) => expect(() => readStage({ ...canyon, ...patch })).toThrow(m);
    bad({ route: { ground: 'ocean' } }, /route\.ground is canyon or space/);
    bad({ route: { ground: 'canyon', hazards: 'lots' } }, /route\.hazards/);
    bad({ waves: [{ id: 'a', name: 'A', count: 9, at: 0.2 }] }, /waves\[0\]\.count/);
    bad({ waves: [{ id: 'a', name: 'A', count: 2, at: 0.95 }] }, /the last stretch is the boss's/);
    bad({ waves: [{ id: 'a', name: 'A', count: 2, at: 0.5 }, { id: 'b', name: 'B', count: 2, at: 0.3 }] }, /order they come/);
    bad({ waves: [{ id: 'a', name: 'A', count: 2, at: 0.2, formation: 'box' }] }, /formation/);
    bad({ boss: { name: 'X', hull: 'barge' } }, /capital ship's class/);
    bad({ steps: [{ title: 't', say: 's', show: ['nobody'] }] }, /not in the stage/);
    bad({ why: 1 }, /not part of a stage's design/);
  });

  it('holds every fighter, gun and core as points, the medals its shares when unsaid; its laws advise', () => {
    const S = readStage(canyon), most = stagePoints(S);
    expect(most).toBe(S.waves.reduce((s, w) => s + w.count, 0) * SCORE.fighter + S.boss.guns * SCORE.gun + SCORE.core);
    expect(S.medals.gold).toBeLessThanOrEqual(most);
    expect(S.medals.gold).toBeGreaterThan(S.medals.silver);
    expect(stageLaws(S).every((L) => L.ok)).toBe(true);
    // (a boss never shown, a wave on another's heels and an unreachable gold each said, none refused)
    const T = readStage({ ...canyon, medals: { gold: most * 2, silver: 10, bronze: 5 }, steps: [canyon.steps[0], canyon.steps[1]],
      waves: [{ id: 'scouts', name: 'Scouts', count: 2, at: 0.2 }, { id: 'raiders', name: 'Raiders', count: 2, at: 0.22 }] });
    const failed = stageLaws(T).filter((L) => !L.ok).map((L) => L.law);
    expect(failed).toEqual(expect.arrayContaining(['boss-shown', 'waves-spaced', 'medals-reachable']));
  });

  it('compiles onto a rail stage: its ground\'s map, its waves at their marks in their formations, its hazards, boss and score', () => {
    for (const D of [canyon, space]) {
      const S = readStage(D), { level, approved } = compileStage(S, { design: D });
      expect(approved).toBe(D.status === 'approved');
      expect(level.goal).toEqual({ flight: 'stage' });
      const A = level.airspace, P = A.rail.plan;
      expect(readRailPlan(P)).toEqual([]);
      expect(P.waves).toEqual(S.waves.map((w) => ({ at: w.at, count: w.count, formation: w.formation })));
      expect(P.hazards).toBe(HAZARDS[S.route.hazards]);
      expect(P.boss).toEqual({ guns: S.boss.guns, armour: S.boss.armour });
      expect(P.score.medals).toEqual([S.medals.gold, S.medals.silver, S.medals.bronze]);
      expect(A.briefing).toBe(D);
      // (a canyon's corridor, or rocks in space with its moon near)
      if (D.route.ground === 'canyon') expect(A.map.form).toBe('canyon');
      else expect(A.space.backdrop.worlds).toEqual([S.route.world]);
    }
    expect(stagePlace(readStage(canyon))).toBe(`Kessa System | Varn Cluster | ${canyon.place.station} | Moon IV`);
    expect(readRailPlan({ waves: [{ at: 0.5, count: 2, formation: 'box' }] }).join(' ')).toMatch(/formation/);
  });

  it('is told on the same holo table as a mission: the route as a ribbon, each wave at its mark, the boss at its end', () => {
    const S = readStage(space), B = stageBriefingData(S);
    expect(B.place.parts).toHaveLength(4);
    const ids = new Set([...B.things.map((t) => t.id), ...B.theatre.nav.map((n) => n.id)]);
    for (const step of B.steps) {
      for (const id of step.show) expect(ids.has(id)).toBe(true);
      for (const r of step.routes) r.forEach((id) => expect(ids.has(id)).toBe(true));
    }
    expect(B.things.filter((t) => t.side === 'foe' && t.kind === 'group')).toHaveLength(S.waves.length);
    expect(B.things.find((t) => t.id === 'boss').kind).toBe('capital');
    // (the orrery's three opening steps, then the design's; the route shown as its ribbon's legs)
    expect(B.steps.slice(0, 3).map((s) => s.stage)).toEqual(['orrery', 'orrery', 'orrery']);
    expect(B.steps.find((s) => s.routes.some((r) => r[0] === 'r0'))).toBeTruthy();
    expect(B.goals.at(-1).text).toContain(`${S.medals.gold}`);
    expect(JSON.stringify(stageBriefingData(readStage(space)))).toBe(JSON.stringify(B));
    expect(FORMATIONS).toContain('swarm');
  });
});

describe('Wolf Squadron on mana-ui, its stages designed', () => {
  it('dresses its game in the squadron\'s look, writes its designs as missions, lays each approved one from its design', () => {
    expect(THEME_CARDS[WOLF_SQUADRON_LOOK]).toBeTruthy();
    const W = wolfSquadronStart({}).world;
    expect(W.ui).toEqual({ theme: WOLF_SQUADRON_LOOK });
    expect(wolfSquadronStart({ ui: { theme: 'static' } }).world.ui).toEqual({ theme: 'static' });
    expect(Object.keys(W.missions)).toEqual(Object.keys(STAGE_DESIGNS).filter((id) => W.levels[id]));
    // (the designer knows a stage by its route; its readout says it, with no table editor to move it about on)
    expect(designKind(W.missions['stage-1'])).toBe('stage');
    const R = missionsReadout(W, { ref: 'sk_x' });
    expect(R.every((r) => r.kind === 'stage' && r.laws.length === 0 && r.briefing && !r.editor)).toBe(true);
    const M = withMissions(W);
    expect(M.levels['stage-1'].airspace.rail.plan.waves).toHaveLength(STAGE_DESIGNS['stage-1'].waves.length);
    expect(M.levels['stage-1'].airspace.briefing.id).toBe('stage-1');
    expect(() => readGameworld({ id: 'wolf', name: 'Wolf', ...M })).not.toThrow();
    // (a draft is not laid; the person's approval on the table lays it)
    const draft = { ...W, missions: { ...W.missions, 'stage-2': { ...W.missions['stage-2'], status: 'draft' } } };
    expect(withMissions(draft).levels['stage-2'].airspace.rail.plan).toBeUndefined();
    const saved = applyMissionEdit(draft, { mission: 'stage-2', design: draft.missions['stage-2'], approve: true });
    expect(saved.status).toBe('approved');
    // (a stage's briefing on a level with no rail is refused, naming its field)
    const L = M.levels['stage-1'], { rail: _r, ...noRail } = L.airspace;
    expect(() => readGameworld({ id: 'wolf', name: 'Wolf', ...M, missions: undefined, levels: { ...M.levels, 'stage-1': { ...L, airspace: { ...noRail, course: true }, goal: { flight: 'course' } } } })).toThrow(/airspace\.briefing/);
  });
});

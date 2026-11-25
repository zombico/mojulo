import { describe, expect, it } from 'vitest';

import { readStage, stageLaws, stagePoints, compileStage, stagePlace, stageBriefingData, routeGround, worldGeocube, SCORE, HAZARDS, FORMATIONS, SEGMENTS, FOE_CRAFT, FORMATION_CRAFT } from './stage.js';
import { stageGround, TABLE_GROUND } from './stage-ground.js';
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
    expect(most).toBe(S.waves.reduce((s, w) => s + w.count, 0) * SCORE.fighter + (S.ground ?? []).reduce((s, g) => s + g.count * SCORE.ground[g.kind], 0) + S.boss.guns * SCORE.gun + SCORE.core);
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
      expect(P.waves).toEqual(S.waves.map((w) => ({ at: w.at, count: w.count, formation: w.formation, craft: w.craft })));
      // (each wave flies a ship: the design's, else its formation's)
      expect(S.waves.every((w) => FOE_CRAFT.includes(w.craft))).toBe(true);
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

describe('a ground stage in segments, told over its ground', () => {
  const D = Object.values(STAGE_DESIGNS).find((x) => x.route.segments), S = readStage(D);
  it('reads its stretches and its sky, teaching each fault', () => {
    expect(S.route.segments.map((g) => g.kind)).toEqual(D.route.segments.map((g) => g.kind));
    const bad = (route, m) => expect(() => readStage({ ...D, route: { ...D.route, ...route } })).toThrow(m);
    bad({ segments: [{ kind: 'swamp', seconds: 20 }] }, /canyon, open, colony/);
    bad({ segments: [{ kind: 'open', seconds: 4 }] }, /seconds/);
    bad({ segments: [] }, /1 to 8/);
    bad({ sky: 'murk' }, /route\.sky/);
    expect(() => readStage({ ...space, route: { ...space.route, segments: [{ kind: 'open', seconds: 20 }] } })).toThrow(/ground route/);
  });

  it('lays one long route: its stretches at their shares of the way, the world\'s colours, a colony in its style, its sky', () => {
    const G = routeGround(S), total = S.route.segments.reduce((a, g) => a + g.seconds, 0);
    expect(G.map.route).toBe(true);
    expect(G.map.field[0]).toBeCloseTo((S.route.speed * (SEGMENTS.lead + total + SEGMENTS.arena)) / SEGMENTS.span, -2);
    expect(G.ground.segments[0].from).toBe(0);
    expect(G.ground.segments.at(-1).to).toBe(1);
    for (let i = 1; i < G.ground.segments.length; i++) expect(G.ground.segments[i].from).toBe(G.ground.segments[i - 1].to);
    expect(G.ground.geocube).toEqual(worldGeocube(S.route.world));
    expect(G.ground.pads).toEqual([]);
    expect(G.ground.country?.style).toBe(S.route.segments.some((g) => g.kind === 'colony') ? 'colony' : undefined);
    expect(G.sky).toEqual(D.route.sky);
    const { level } = compileStage(S);
    expect(level.airspace).toMatchObject({ map: { form: 'canyon', route: true }, ground: G.ground, sky: G.sky });
    // (a stage without stretches lays as it did)
    expect(compileStage(readStage(space)).level.airspace.ground).toBeUndefined();
  });

  it('is told on its real ground: the land as terrain, the way as flown, each wave where it is posted, the boss at the end', () => {
    const { level } = compileStage(S), Gr = stageGround(level.airspace, { seed: 7 }), B = stageBriefingData(S, { ground: Gr });
    const T = B.theatre.terrain;
    expect(T.nx * T.ny).toBe(T.z.length);
    expect(T.nx).toBeLessThanOrEqual(TABLE_GROUND.across + 1);
    expect(B.theatre.vertical).toBe(TABLE_GROUND.vertical);
    expect(B.theatre.masses.length).toBeGreaterThan(0);
    // (the way runs up the table: its start low on y, the boss past its end; the waves in their order along it)
    const waveIds = new Set(S.waves.map((w) => w.id)), ys = B.things.filter((t) => waveIds.has(t.id)).map((t) => t.at[1]);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    expect(B.things.find((t) => t.id === 'squad').at[1]).toBeLessThan(ys[0]);
    expect(B.things.find((t) => t.id === 'boss').at[1]).toBeGreaterThan(ys.at(-1));
    expect(B.theatre.nav.find((n) => n.id === 'start').at).toEqual(Gr.path[0]);
    // (a space stage has no ground under its table; the same level, the same table)
    expect(stageGround(compileStage(readStage(space)).level.airspace)).toBeNull();
    expect(JSON.stringify(stageGround(level.airspace, { seed: 7 }))).toBe(JSON.stringify(Gr));
  });
});

describe('a ground stage\'s force: real ships in its waves, units on the ground', () => {
  const D = Object.values(STAGE_DESIGNS).find((x) => x.ground), S = readStage(D);
  it('reads its ground groups and its waves\' ships, teaching each fault', () => {
    expect(S.ground.map((g) => g.kind)).toEqual(D.ground.map((g) => g.kind));
    expect(S.waves.map((w) => w.craft)).toEqual(D.waves.map((w) => w.craft ?? FORMATION_CRAFT[w.formation ?? 'line']));
    const bad = (patch, m) => expect(() => readStage({ ...D, ...patch })).toThrow(m);
    bad({ ground: [{ id: 'x', name: 'X', kind: 'battleship', count: 1, at: 0.3 }] }, /turret, tank, .*walker/);
    bad({ ground: [{ id: 'x', name: 'X', kind: 'tank', count: 9, at: 0.3 }] }, /1 to 6/);
    bad({ ground: [{ id: 'scouts', name: 'X', kind: 'tank', count: 1, at: 0.3 }] }, /taken/);
    bad({ waves: [{ ...D.waves[0], craft: 'jumbo' }] }, /ship its fighters fly/);
    expect(() => readStage({ ...space, ground: [{ id: 'x', name: 'X', kind: 'tank', count: 1, at: 0.3 }] })).toThrow(/ground route/);
    // (a group never shown before launch is said by the laws)
    const T = readStage({ ...D, steps: D.steps.map((st) => ({ ...st, show: st.show.filter((id) => id !== S.ground[0].id) })) });
    expect(stageLaws(T).find((L) => L.law === 'every-wave-shown')).toMatchObject({ ok: false, says: expect.stringContaining(S.ground[0].name) });
  });

  it('is laid by the rail beside the way, cast as figures, scored by kind, and told on the table', () => {
    const { level } = compileStage(S);
    expect(level.airspace.rail.plan.ground).toEqual(S.ground.map((g) => ({ kind: g.kind, count: g.count, at: g.at })));
    const G = stageGround(level.airspace, { seed: 5 }), B = stageBriefingData(S, { ground: G });
    for (const g of S.ground) {
      const t = B.things.find((x) => x.id === g.id);
      expect(t).toMatchObject({ side: 'foe', kind: 'group', count: g.count, mini: { family: 'ground' } });
    }
    expect(B.roster.filter((r) => S.ground.some((g) => g.id === r.id)).length).toBe(S.ground.length);
    expect(stagePoints(S)).toBeGreaterThan(stagePoints({ ...S, ground: [] }));
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

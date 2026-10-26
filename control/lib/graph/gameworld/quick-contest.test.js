// The sport goals of the quick path: a meet and a contest are their own simulations on the World page (lib/graph/contest);
// the quick game is one level, the arena as a stage carrying the play and the hosted level's contract, and the game
// that plays it. A sport the book lacks is written out and read by the kernel.
import { describe, it, expect } from 'vitest';
import { quickWorld, readQuick, sportArenas, QUICK_GOALS } from './quick.js';
import { runSteps } from './runner.js';
import { QUICK_GENRE, contestGenre, cubeOfWorld } from './intent.js';
import { validateLevelContract } from '../game/level-contract.js';
import { contestRead } from '../contest/contest-kernel.js';
import { resolveSport, tennis, golf } from '../contest/sports.js';
import { matchArenaData } from '../contest/match-arena.js';
import { turnsArenaData } from '../contest/turn-arena.js';

/** Pickleball written out as a net game: tennis's shape with its own court, ladder and serve, a shuttle-less ball. */
const pickleball = () => ({
  id: 'pickleball', shape: 'match', words: 'pickleball: an underhand serve, side-out scoring to eleven by two, the kitchen a no-volley zone',
  spec: { ...tennis({ sets: 1 }), title: 'Pickleball', court: { frame: [6.1, 13.41], mirror: 'half-turn', regions: { half: { rect: [-3.05, -6.705, 3.05, 0] }, 'service-right': { rect: [0, -6.705, 3.05, -2.13] }, 'service-left': { rect: [-3.05, -6.705, 0, -2.13] }, kitchen: { rect: [-3.05, -2.13, 3.05, 0] } } }, scoring: { points: 'serve', ladder: [{ unit: 'game', to: 11, by: 2 }] }, serve: { into: ['service-right', 'service-left'], faults: 1, let: false, rotate: 'side-out' }, rally: { in: 'half', bounces: 1, touches: 1 }, fouls: {} },
  omits: ['the kitchen as a no-volley zone (the kernel has no volley rule by region)', 'the double-bounce rule on the return of serve'],
  ball: { mass: 0.024, radius: 0.037, restitution: 0.6, friction: 0.4 }, players: 1,
  strokes: { fore: 'forehand', back: 'backhand', serve: 'serve' }, net: { height: 0.86, posts: 0.91, beyond: 0.5 },
  serve: { behind: 0.4, aside: 0.8, hand: 1.0 }, receive: { behind: 0.8, aside: 1.2 }, home: { behind: 0.6 },
});

describe('the sport goals', () => {
  it('meet and contest are quick goals with the sports\' words; a meet is read by its arena, a contest by its sport\'s; the other goals refuse their keys', () => {
    expect(QUICK_GOALS.meet).toMatch(/athletic meet/); expect(QUICK_GOALS.contest).toMatch(/contest kernel/);
    expect(() => readQuick({ goal: 'meet', event: 'relay' })).toThrow(/event 'relay' is one of sprint, hurdles, longJump/);
    expect(() => readQuick({ goal: 'meet', hero: {} })).toThrow(/a meet takes goal, event, lanes/);
    expect(() => readQuick({ goal: 'meet', camera: 'fixed' })).toThrow(/a sport is seen from its arena/);
    expect(() => readQuick({ goal: 'contest' })).toThrow(/sport names the sport: tennis/);
    expect(() => readQuick({ goal: 'contest', sport: 'cricket' })).toThrow(/sport 'cricket' is one of tennis, golf, bowling, soccer, hockey, or a sport written out/);
    expect(() => readQuick({ goal: 'contest', sport: 'tennis', seats: 2 })).toThrow(/seats belongs to a turn sport; tennis is a net game/);
    expect(() => readQuick({ goal: 'contest', sport: 'golf', rounds: 9 })).toThrow(/rounds for golf is 1 to 3/);
    expect(() => readQuick({ goal: 'contest', sport: 'soccer', periods: 9 })).toThrow(/periods is 1 to 4/);
    expect(() => readQuick({ goal: 'reach', sport: 'tennis' })).toThrow(/sport belongs to the meet and contest goals/);
    expect(() => readQuick({ goal: 'contest', sport: 'bowling', rounds: 3 })).not.toThrow();
    expect(() => readQuick({ goal: 'meet', event: 'hurdles', lanes: 4, players: 2, distance: 110 })).not.toThrow();
  });
  it('the broadcast is a lever on both sport goals: the arena reads it, the level carries it, a bad word is taught', () => {
    expect(() => readQuick({ goal: 'contest', sport: 'tennis', broadcast: 'tv' })).toThrow(/broadcast package 'tv' is one of network, stadium, arcade, table, clean/);
    expect(() => readQuick({ goal: 'meet', event: 'sprint', broadcast: { sides: ['red'] } })).toThrow(/#rrggbb/);
    const [court] = sportArenas({ goal: 'contest', sport: 'tennis', broadcast: { package: 'stadium', names: ['Ana', 'Bo'] } });
    expect(court.manifest.court.broadcast).toEqual({ package: 'stadium', names: ['Ana', 'Bo'] });
    expect(matchArenaData(court.manifest.court).broadcast.package).toBe('stadium');
    const [track] = sportArenas({ goal: 'meet', event: 'sprint', lanes: 3, broadcast: 'arcade' });
    expect(track.manifest.meet.broadcast).toEqual({ package: 'arcade' });
  });
  it('a meet\'s game is one level, the track as a stage carrying the meet and a hosted level\'s contract; a contest\'s the court, the course or the pitch', () => {
    const steps = runSteps(quickWorld({ id: 'relay', seed: 3, quick: { goal: 'meet', event: 'hurdles', lanes: 4, players: 2 } }), { ref: 'gw_meet' });
    expect(steps.map((s) => s.key)).toEqual(['level-arena-track', 'game']);
    const level = steps[0].order.manifest;
    expect(level).toMatchObject({ kind: 'stage', meet: { event: 'hurdles', lanes: 4, players: 2, seed: 3 }, game: { levelRef: 'track', produces: { results: ['success', 'fail'], events: [] }, presets: { default: {} } } });
    expect(validateLevelContract(level.game, { slices: [] }).ok).toBe(true);
    expect(steps[1].order).toMatchObject({ title: 'relay', allow_unaudited: true, shell: 'play', levels: [{ ref: steps[0].ref, title: level.title }] });
    for (const [spec, id, key] of [[{ goal: 'contest', sport: 'tennis', players: 2 }, 'court', 'court'], [{ goal: 'contest', sport: 'golf', rounds: 2 }, 'course', 'turns'], [{ goal: 'contest', sport: 'hockey', players: 1 }, 'pitch', 'pitch']]) {
      const st = runSteps(quickWorld({ id: `g-${id}`, quick: spec }), { ref: `gw_${id}` });
      expect(st.map((s) => s.key)).toEqual([`level-arena-${id}`, 'game']);
      expect(st[0].order.manifest[key]).toMatchObject({ sport: spec.sport }); expect(st[0].order.manifest.game.levelRef).toBe(id);
      expect(validateLevelContract(st[0].order.manifest.game, { slices: [] }).ok).toBe(true);
    }
    // the same world runs the same steps
    expect(runSteps(quickWorld({ id: 'relay', seed: 3, quick: { goal: 'meet', event: 'hurdles', lanes: 4, players: 2 } }), { ref: 'gw_meet' })).toEqual(steps);
  });
  it('a contest\'s genre is its sport\'s shape; the cube it implies is the probe\'s', () => {
    expect(QUICK_GENRE.meet).toBe('athletics-meet'); expect(QUICK_GENRE.contest).toBe('net-game');
    expect(contestGenre('tennis')).toBe('net-game'); expect(contestGenre('bowling')).toBe('turn-sport'); expect(contestGenre('soccer')).toBe('team-goal-game'); expect(contestGenre('cricket')).toBe('net-game');
    expect(cubeOfWorld(quickWorld({ id: 'x', quick: { goal: 'contest', sport: 'soccer' } })).from).toBe('team-goal-game');
    expect(cubeOfWorld(quickWorld({ id: 'y', quick: { goal: 'meet', event: 'sprint' } })).from).toBe('athletics-meet');
  });
});

describe('a sport written out (the distilled rulebook\'s product)', () => {
  it('rides its shape\'s sim: the kernel reads its spec, the arena its dials; what it lacks is taught; the book\'s names are refused as ids', () => {
    const P = pickleball();
    const sp = resolveSport(P);
    expect(sp.written).toBe(true); expect(sp.shape).toBe('match'); expect(contestRead(sp.spec()).scoring.points).toBe('serve');
    expect(() => resolveSport({ ...P, id: 'tennis' })).toThrow(/'tennis' is the book's: name it, or write the variant out/);
    expect(() => resolveSport({ ...P, shape: 'duel' })).toThrow(/shape is match \| turns \| team/);
    expect(() => resolveSport({ ...P, net: undefined })).toThrow(/a written-out match sport carries ball, players, strokes, net, serve, receive, home \(missing net\)/);
    expect(() => resolveSport({ ...P, spec: { ...P.spec, shape: 'turns' } })).toThrow(/a match sport's spec has shape 'match'/);
    expect(() => resolveSport(P, 'turns')).toThrow(/'pickleball' is written as a match: it plays on the court/);
    expect(() => resolveSport({ ...P, omits: 'none' })).toThrow(/omits is a list of words/);
    // the quick goal reads it, its level carries the sport whole, the court's data compiles it
    expect(() => readQuick({ goal: 'contest', sport: P, players: 2 })).not.toThrow();
    expect(() => readQuick({ goal: 'contest', sport: P, seats: 2 })).toThrow(/seats belongs to a turn sport; pickleball is a net game/);
    const [L] = sportArenas({ goal: 'contest', sport: P, players: 2 }, { title: 'Pickleball', seed: 1 });
    expect(L.id).toBe('court'); expect(L.manifest.court.sport).toMatchObject({ id: 'pickleball' }); expect(L.manifest.court.sport.written).toBeUndefined();
    const D = matchArenaData(L.manifest.court);
    expect(D.C.court.regions.kitchen).toBeTruthy(); expect(D.sport).toMatchObject({ id: 'pickleball', written: true, net: { height: 0.86 } }); expect(D.sport.spec).toBeUndefined();
    expect(D.court.halfL).toBeCloseTo(6.705, 3);
    // a turn sport written out: mini golf, the book's holes cut to its own, the cup and the lies its own
    const mini = { id: 'mini-golf', shape: 'turns', words: 'mini golf: putts only, two holes, hot-seat', spec: { ...golf({ holes: 2 }), title: 'Mini golf' }, ball: 'golf', seats: 1, clubs: [{ verb: 'putt' }], lies: { tee: 1, fairway: 1, green: 0.8, rough: 2 }, cup: { radius: 0.054, capture: 2 }, swing: { tipSpeed: 20, charge: 1, spread: 20 }, holes: golf({ holes: 2 }).rounds.map((r) => ({ par: r.par })) };
    expect(() => resolveSport({ ...mini, cup: undefined })).toThrow(/missing cup/);
    const T = turnsArenaData({ sport: mini, rounds: 1, seats: 2 });
    expect(T.C.rounds.length).toBe(1); expect(T.sport.clubs).toEqual([{ verb: 'putt' }]); expect(T.course.rounds.length).toBe(1);
    expect(() => readQuick({ goal: 'contest', sport: mini, rounds: 3 })).toThrow(/rounds for mini-golf is 1 to 2/);
  });
});

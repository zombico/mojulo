// The sport goals of the quick path: a meet and a contest are their own simulations on the World page (lib/graph/contest);
// the quick game is one level, the arena as a stage carrying the play and the hosted level's contract, and the game
// that plays it. A sport the book lacks is written out and read by the kernel.
import { describe, it, expect } from 'vitest';
import { quickWorld, readQuick, sportArenas, QUICK_GOALS } from './quick.js';
import { runSteps, CHIBI_HEAD } from './runner.js';
import { QUICK_GENRE, contestGenre, cubeOfWorld } from './intent.js';
import { validateLevelContract } from '../game/level-contract.js';
import { contestRead } from '../contest/contest-kernel.js';
import { resolveSport, tennis, golf } from '../contest/sports.js';
import { matchArenaData } from '../contest/match-arena.js';
import { turnsArenaData } from '../contest/turn-arena.js';
import { SIDE_KITS } from '../contest/team-arena.js';
import { meetArenaData } from '../contest/meet-arena.js';
import { GROUND_KITS } from '../era/stage.js';
import { settingOfGame } from './cast-setting.js';

/** Pickleball written out as a net game: tennis's shape with its own court, ladder and serve, a shuttle-less ball. */
const pickleball = () => ({
  id: 'pickleball-sideout', shape: 'match', words: 'pickleball: an underhand serve, side-out scoring to eleven by two, the kitchen a no-volley zone',
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
    expect(() => readQuick({ goal: 'contest', sport: 'quidditch' })).toThrow(/sport 'quidditch' is one of tennis, golf, bowling, .*baseball, cricket, soccer, hockey, .*or a sport written out/);
    expect(() => readQuick({ goal: 'contest', sport: 'baseball', overs: 2 })).toThrow(/overs belong to a game of overs; baseball counts its innings by outs/);
    expect(() => readQuick({ goal: 'contest', sport: 'cricket', overs: 2 })).not.toThrow();
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
  it('a meet\'s game is one level, the track in its stadium carrying the meet and a hosted level\'s contract; a contest\'s the court, the course or the pitch', () => {
    const steps = runSteps(quickWorld({ id: 'relay', seed: 3, quick: { goal: 'meet', event: 'hurdles', lanes: 4, players: 2, athletes: false } }), { ref: 'gw_meet' });
    expect(steps.map((s) => s.key)).toEqual(['level-arena-track', 'game']);
    const level = steps[0].order.manifest;
    expect(level).toMatchObject({ kind: 'stadium', preset: 'olympic', meet: { event: 'hurdles', lanes: 4, players: 2, seed: 3, venue: 'olympic' }, game: { levelRef: 'track', produces: { results: ['success', 'fail'], events: [] }, presets: { default: {} } } });
    expect(validateLevelContract(level.game, { slices: [] }).ok).toBe(true);
    expect(steps[1].order).toMatchObject({ title: 'relay', allow_unaudited: true, shell: 'play', levels: [{ ref: steps[0].ref, title: level.title }] });
    for (const [spec, id, key] of [[{ goal: 'contest', sport: 'tennis', players: 2, athletes: false }, 'court', 'court'], [{ goal: 'contest', sport: 'golf', rounds: 2, athletes: false }, 'course', 'turns'], [{ goal: 'contest', sport: 'hockey', players: 1, athletes: false }, 'pitch', 'pitch'], [{ goal: 'contest', sport: 'baseball', innings: 2, athletes: false }, 'innings', 'innings']]) {
      const st = runSteps(quickWorld({ id: `g-${id}`, quick: spec }), { ref: `gw_${id}` });
      expect(st.map((s) => s.key)).toEqual([`level-arena-${id}`, 'game']);
      expect(st[0].order.manifest[key]).toMatchObject({ sport: spec.sport }); expect(st[0].order.manifest.game.levelRef).toBe(id);
      expect(validateLevelContract(st[0].order.manifest.game, { slices: [] }).ok).toBe(true);
    }
    // the same world runs the same steps
    expect(runSteps(quickWorld({ id: 'relay', seed: 3, quick: { goal: 'meet', event: 'hurdles', lanes: 4, players: 2, athletes: false } }), { ref: 'gw_meet' })).toEqual(steps);
    expect(steps[0].order.manifest.meet.athletes).toBeUndefined();
  });
  it('a sport stands in its kind\'s stadium unless it names its own venue or none; a course keeps its stage', () => {
    const level = (q) => runSteps(quickWorld({ id: 'v', quick: { athletes: false, ...q } }), { ref: 'gw_v' })[0].order.manifest;
    expect(level({ goal: 'contest', sport: 'hockey' })).toMatchObject({ kind: 'stadium', preset: 'football', pitch: { venue: 'football' } });
    expect(level({ goal: 'contest', sport: 'tennis', venue: { preset: 'colosseum', time: 'dusk' } })).toMatchObject({ kind: 'stadium', preset: 'colosseum', time: 'dusk' });
    expect(level({ goal: 'contest', sport: 'tennis', venue: false }).kind).toBe('stage');
    expect(level({ goal: 'contest', sport: 'golf' }).kind).toBe('stage');
    expect(level({ goal: 'contest', sport: 'cricket' })).toMatchObject({ kind: 'stadium', preset: 'football', innings: { venue: 'football' } });
    expect(() => readQuick({ goal: 'contest', sport: 'tennis', venue: 'wembley' })).toThrow(/\.venue 'wembley' is one of/);
    expect(() => readQuick({ goal: 'reach', venue: 'olympic' })).toThrow(/\.venue belongs to the meet, contest and tabletop goals/);
  });
  it('a contest\'s genre is its sport\'s shape; the cube it implies is the probe\'s', () => {
    expect(QUICK_GENRE.meet).toBe('athletics-meet'); expect(QUICK_GENRE.contest).toBe('net-game');
    expect(contestGenre('tennis')).toBe('net-game'); expect(contestGenre('bowling')).toBe('turn-sport'); expect(contestGenre('soccer')).toBe('team-goal-game'); expect(contestGenre('cricket')).toBe('turn-sport'); expect(contestGenre('quidditch')).toBe('net-game');
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
    expect(() => resolveSport(P, 'turns')).toThrow(/'pickleball-sideout' is written as a match: it plays on the court/);
    expect(() => resolveSport({ ...P, omits: 'none' })).toThrow(/omits is a list of words/);
    // the quick goal reads it, its level carries the sport whole, the court's data compiles it
    expect(() => readQuick({ goal: 'contest', sport: P, players: 2 })).not.toThrow();
    expect(() => readQuick({ goal: 'contest', sport: P, seats: 2 })).toThrow(/seats belongs to a turn sport; pickleball-sideout is a net game/);
    const [L] = sportArenas({ goal: 'contest', sport: P, players: 2 }, { title: 'Pickleball', seed: 1 });
    expect(L.id).toBe('court'); expect(L.manifest.court.sport).toMatchObject({ id: 'pickleball-sideout' }); expect(L.manifest.court.sport.written).toBeUndefined();
    const D = matchArenaData(L.manifest.court);
    expect(D.C.court.regions.kitchen).toBeTruthy(); expect(D.sport).toMatchObject({ id: 'pickleball-sideout', written: true, net: { height: 0.86 } }); expect(D.sport.spec).toBeUndefined();
    expect(D.court.halfL).toBeCloseTo(6.705, 3);
    // a turn sport written out: mini golf, the book's holes cut to its own, the cup and the lies its own
    const mini = { id: 'mini-golf', shape: 'turns', words: 'mini golf: putts only, two holes, hot-seat', spec: { ...golf({ holes: 2 }), title: 'Mini golf' }, ball: 'golf', seats: 1, clubs: [{ verb: 'putt' }], lies: { tee: 1, fairway: 1, green: 0.8, rough: 2 }, cup: { radius: 0.054, capture: 2 }, swing: { tipSpeed: 20, charge: 1, spread: 20 }, holes: golf({ holes: 2 }).rounds.map((r) => ({ par: r.par })) };
    expect(() => resolveSport({ ...mini, cup: undefined })).toThrow(/missing cup/);
    const T = turnsArenaData({ sport: mini, rounds: 1, seats: 2 });
    expect(T.C.rounds.length).toBe(1); expect(T.sport.clubs).toEqual([{ verb: 'putt' }]); expect(T.course.rounds.length).toBe(1);
    expect(() => readQuick({ goal: 'contest', sport: mini, rounds: 3 })).toThrow(/rounds for mini-golf is 1 to 2/);
  });
  it('an arcade card\'s variant rides the quick goal: its level carries the variant\'s words, the court composes them again', () => {
    const v = { id: 'pong-21', from: 'pingpong', score: { to: 21 } };
    const [L] = sportArenas({ goal: 'contest', sport: v, players: 1 }, { title: 'Pong', seed: 1 });
    expect(L.manifest.court.sport).toEqual(v);
    const D = matchArenaData(L.manifest.court);
    expect(D.C.scoring.ladder[0].to).toBe(21); expect(D.sport).toMatchObject({ id: 'pong-21', bed: { height: 0.76 } });
    expect(() => readQuick({ goal: 'contest', sport: { id: 'pong-x', from: 'pingpong', wings: 1 } })).toThrow(/a net card has no 'wings'/);
  });
});

describe('the athletes: a sport played by characters in their own bodies', () => {
  const keys = (st) => st.map((x) => x.key);
  const athletesOf = (st) => st.filter((x) => /^athlete(-\d+)?$/.test(x.key));
  it('rolls a person a lane in the game\'s setting, in the sport\'s kit in their own colour, each lane\'s ref on the track; the same world rolls the same', () => {
    const W = quickWorld({ id: 'sprint', seed: 5, quick: { goal: 'meet', event: 'sprint', lanes: 3 } });
    const st = runSteps(W, { ref: 'gw_sp' });
    expect(keys(st)).toEqual(['athlete', 'athlete-2', 'athlete-3', 'level-arena-track', 'game']);
    const A = athletesOf(st);
    // (the track's kit, each in the shirt colour the roll gave them; the clothes' colours left to the kit)
    for (const a of A) { expect(a.order.mint).toMatchObject({ kind: 'layered', via: 'hero', spec: { kit: { sport: 'track' } } }); expect(a.order.mint.spec.palette.Top).toBeUndefined(); }
    expect(new Set(A.map((a) => a.order.mint.spec.kit.colours?.[0])).size).toBeGreaterThan(1);
    expect(new Set(A.map((a) => a.print)).size).toBe(3);
    expect(st[3].order.manifest.meet.athletes).toEqual(A.map((a) => a.ref));
    expect(st[4].laws[0]).toMatchObject({ concern: 'cast', law: 'setting' });
    expect(st[4].laws[0].says).toMatch(/rolled in the game's setting \(.*meet\)/);
    expect(runSteps(W, { ref: 'gw_sp' })).toEqual(st);
  });
  it('draws them in the game\'s tradition: an anime world\'s athletes wear the anime head and the character light', () => {
    const kit = GROUND_KITS.find((k) => settingOfGame({ style: { kit: k } }).tradition === 'anime');
    const st = runSteps(quickWorld({ id: 'anime-court', style: { kit }, quick: { goal: 'contest', sport: 'tennis' } }), { ref: 'gw_ac' });
    const A = athletesOf(st);
    expect(A.length).toBe(2);
    for (const a of A) { expect(a.order.mint.spec.head).toBe('anime'); expect(a.order.mint.toon).toEqual({ light: true }); }
    // tennis is played in whites: each player's own colour is the trim
    for (const a of A) expect(a.order.mint.spec.kit.colours.slice(0, 2)).toEqual(['#ffffff', '#ffffff']);
  });
  it('rolls them as chibis or as mascots in the same kits; a list mixes mascots the run makes with people; refuses, teaching', () => {
    // chibi: the rolled person on the chibi build under an anime head, the kit as rolled
    const C = athletesOf(runSteps(quickWorld({ id: 'tiny', quick: { goal: 'contest', sport: 'tennis', athletes: 'chibi' } }), { ref: 'gw_c' }));
    expect(C.length).toBe(2);
    for (const a of C) {
      expect(a.order.mint.spec).toMatchObject({ cast: { build: 'chibi' }, head: 'anime', headScale: CHIBI_HEAD, kit: { sport: 'tennis' } });
      expect(['female', 'male']).toContain(a.order.mint.spec.cast.pole);
    }
    // mascots: each side's in the side's kit, minted through the creature door, the keeper in a kit of its own
    const st = runSteps(quickWorld({ id: 'zoo', quick: { goal: 'contest', sport: 'soccer', athletes: 'mascot' } }), { ref: 'gw_z' });
    const M = athletesOf(st);
    expect(M.length).toBe(8);
    for (const m of M) expect(m.order.mint).toMatchObject({ kind: 'layered', via: 'plan', spec: { plan: { mascot: { kit: { sport: expect.any(String) } } } } });
    expect(M[0].order.mint.spec.plan.palette.Top).toBe(SIDE_KITS.a); expect(M[4].order.mint.spec.plan.palette.Top).toBe(SIDE_KITS.b);
    expect(M[3].order.mint.spec.plan.mascot.kit.sport).toBe('keeper');
    expect(new Set(M.map((m) => m.print)).size).toBe(8);
    expect(st.at(-1).laws[0].says).toMatch(/mascots each/);
    // a list: a mascot the run makes in its kit, beside a person
    const L = athletesOf(runSteps(quickWorld({ id: 'mixed', quick: { goal: 'meet', event: 'sprint', lanes: 2, athletes: [{ mascot: { brief: 'a speedy fox' }, kit: 'track' }, { cast: 'female' }] } }), { ref: 'gw_m' }));
    expect(L[0].order).toMatchObject({ mascot: { brief: 'a speedy fox' }, mint: { via: 'plan' } }); expect(L[1].order.mint.via).toBe('hero');
    expect(() => readQuick({ goal: 'contest', sport: 'tennis', athletes: 'giant' })).toThrow(/'giant' is not a form the run rolls \(chibi, mascot\)/);
    expect(() => readQuick({ goal: 'contest', sport: 'tennis', athletes: [{ mascot: { colour: 'red' } }] })).toThrow(/\.mascot is true or \{ brief\?, facets\?, seed\? \}/);
    expect(() => readQuick({ goal: 'contest', sport: 'tennis', athletes: [{ mascot: true, cast: 'male' }] })).toThrow(/a mascot is \{ mascot/);
    expect(() => readQuick({ goal: 'contest', sport: 'tennis', athletes: [{ mascot: true, kit: 'quidditch' }] })).toThrow(/'quidditch' is not a sport's kit/);
    expect(() => readQuick({ goal: 'contest', sport: 'tennis', athletes: 'mascot', kits: [{ colours: ['#112233'] }] })).not.toThrow();
  });
  it('a team\'s sides are each a rank of faces in one kit, its shirt the side\'s colour, a keeper in a kit of its own', () => {
    const st = runSteps(quickWorld({ id: 'five', quick: { goal: 'contest', sport: 'soccer' } }), { ref: 'gw_5' });
    const A = athletesOf(st), refs = st.find((x) => x.key === 'level-arena-pitch').order.manifest.pitch.athletes;
    // per side: three outfield faces in one kit, then the keeper
    expect(A.length).toBe(8);
    const [a, ka, b, kb] = [A.slice(0, 3), A[3], A.slice(4, 7), A[7]];
    for (const [side, rank, keeper] of [['a', a, ka], ['b', b, kb]]) {
      for (const m of rank) expect(m.order.mint.spec.kit).toEqual(rank[0].order.mint.spec.kit);
      expect(rank[0].order.mint.spec.kit.sport).toBe('soccer'); expect(rank[0].order.mint.spec.kit.colours[0]).toBe(SIDE_KITS[side]);
      expect(keeper.order.mint.spec.kit.sport).toBe('keeper');
      expect(keeper.order.mint.spec.kit.colours[0]).not.toBe(SIDE_KITS[side]);
    }
    // soccer's roles: the keeper first, then the outfield cycled over the faces
    expect(refs.length).toBe(10);
    expect(refs.slice(0, 5)).toEqual([ka, a[0], a[1], a[2], a[0]].map((m) => m.ref));
    expect(refs.slice(5)).toEqual([kb, b[0], b[1], b[2], b[0]].map((m) => m.ref));
  });
  it('the kits\' words choose the sides\' colours and patterns; they dress the rolled athletes only', () => {
    const st = runSteps(quickWorld({ id: 'derby', quick: { goal: 'contest', sport: 'soccer', kits: [{ colours: ['#c8102e', '#ffffff'], pattern: 'hoops' }, { colours: ['#1f4fa8'], pattern: 'stripes' }] } }), { ref: 'gw_d' });
    const A = athletesOf(st);
    expect(A[0].order.mint.spec.kit).toMatchObject({ sport: 'soccer', colours: ['#c8102e', '#ffffff'], pattern: 'hoops' });
    expect(A[4].order.mint.spec.kit).toMatchObject({ colours: ['#1f4fa8'], pattern: 'stripes' });
    expect(() => readQuick({ goal: 'contest', sport: 'tennis', kits: [{ pattern: 'tartan' }] })).toThrow(/kits\[0\]: kit.pattern: one of/);
    expect(() => readQuick({ goal: 'contest', sport: 'tennis', kits: [{}], athletes: [{ ref: 'a' }] })).toThrow(/kits dress the athletes the run rolls/);
    expect(() => readQuick({ goal: 'meet', kits: [{ sport: 'track', colours: ['#2a9d8f'] }] })).not.toThrow();
  });
  it('takes the operator\'s own: a character by ref adopted as it stands, a hero-door spec made by the run, cycled over the slots', () => {
    const st = runSteps(quickWorld({ id: 'bowl', quick: { goal: 'contest', sport: 'bowling', seats: 3, athletes: [{ ref: 'my-bowler' }, { cast: 'female' }] } }), { ref: 'gw_b' });
    expect(keys(st)).toEqual(['athlete', 'level-arena-course', 'game']);
    expect(st[0].order.mint.spec).toEqual({ cast: 'female' });
    expect(st[1].order.manifest.turns.athletes).toEqual(['my-bowler', st[0].ref, 'my-bowler']);
    // (no rolled cast's setting law: the operator's own; the sport's laws say who plays each seat)
    expect(st[2].laws.map((l) => l.law)).toEqual(['characters', 'venue', 'one-look']);
    expect(st[2].laws[0].says).toBe('3 seats played by 2 characters in their own bodies (cycled over the seats)');
  });
  it('refuses what is not an athlete; an arena refuses more athletes than slots', () => {
    expect(() => readQuick({ goal: 'meet', athletes: 'four' })).toThrow(/athletes is false \(the stick figures\), 'chibi' or 'mascot' \(the rolled athletes in that form\), or 1 to 12 athletes/);
    expect(() => readQuick({ goal: 'meet', athletes: 4 })).toThrow(/athletes is false \(the stick figures\)/);
    expect(() => readQuick({ goal: 'contest', sport: 'tennis', athletes: [{ ref: 'a', cast: 'male' }] })).toThrow(/adopts a character made with create_character, by its sketch ref alone/);
    expect(() => readQuick({ goal: 'contest', sport: 'tennis', athletes: ['a'] })).toThrow(/an athlete is \{ ref \}, \{ mascot, kit\? \} or a hero-door spec/);
    expect(() => readQuick({ goal: 'contest', sport: 'golf', athletes: false })).not.toThrow();
    expect(() => meetArenaData({ lanes: 2, athletes: ['a', 'b', 'c'] })).toThrow(/athletes is a list of 1 to 2 characters' refs/);
    expect(() => matchArenaData({ athletes: ['a b'] })).toThrow(/athletes\[0\]/);
    expect(matchArenaData({ athletes: ['a', null] }, { bodies: { a: { bones: [], parts: [] } } })).toMatchObject({ athletes: ['a', null], bodies: { a: {} } });
    expect(matchArenaData({})).not.toHaveProperty('bodies');
  });
});

/**
 * THE BOSS FIGHT — a big machine fought in phases on the runtime's boss (worlds/controllable/boss.js): not shot down but
 * taken apart, each phase a way it fights and a way it is beaten. Two pieces, so a fight is composed and not written:
 *
 *   tankPhase(over?)    → a phase: THE TANK, beaten as every tank is. It drives to a ring round the pilot and lays its gun
 *                         on it, slowly (a pilot that keeps moving round it outruns the traverse); a mine under its wheels
 *                         breaks its drive for a while; its engine is open from behind. Any tank of the game is fought so:
 *                         the same phase, its own spots (`tankSpots`)
 *   tankSpots({ engine, sights?, ...more })  → the tank's weak spots: its engine deck reached from behind (all it takes
 *                         goes to the core), its sights from anywhere (shot out, its aim scatters and its lay slows), and
 *                         whatever else a body opens in its tank form (`more`: spots of its own)
 *
 *   siegeWalkerBoss({ id?, at, heading?, bounds?, down?, frame?, palette?, tune? })
 *                       → { entities, figures: { [id]: figure }, boss, readout }
 *     THE SIEGE WALKER (mecha-shelf: the siege walker, its howitzer and its missile launcher on its back, a scorpion's tail
 *     each side to reload them), its two phases:
 *       STANDING   it stands and lays a barrage on the pilot (rings on the ground where each shell will fall: cover
 *                  from each burst is the way to live through it); its tails reload it, standing, and it walks on to
 *                  where its shells fell. Two ways to beat it: MINES laid where it will walk break its legs (its feet in
 *                  their tread), and, optionally, its RELOADERS shot down from behind slow its reload (the window to lay
 *                  them in grows). A broken leg and it falls, and folds into its tank form
 *       THE TANK   tankPhase, its spots the tank's and those its fold opens: its HIPS, folded and bare, from its sides
 *                  (each one shot out, its turn and its gun's traverse slower), and its reloaders still on its back
 *     Its body is the frame as the artillery range rigs it (frames.js frameBase: its walk, its fold and its tank form, its
 *     tails' reload), its spots placed on its own bodies in each form (`places`), its guns its own mounts'.
 *     `tune`: { stand?, tank?, hp?, spots? } laid over the phases, the core and the spots by id.
 *
 * Vehicle space as the shelves' (+y forward, +x right); a spot's place is [forward, right, up]. Pure; the frame's
 * assembly is the slow part (a few seconds).
 */
import { frameBase } from './frames.js';

const r2 = (v) => Math.round(v * 100) / 100;
// [x, y, z] of vehicle space as a spot's [forward, right, up], pushed out along its own axes
const fru = (p, d = [0, 0, 0]) => [r2(p[1] + d[0]), r2(p[0] + d[1]), r2(p[2] + d[2])];
const mid = (a, b) => a.map((v, i) => (v + b[i]) / 2);

/** THE TANK'S PHASE: how a tank fights, and so how it is beaten (the header). */
export function tankPhase(over = {}) {
  return {
    kind: 'tank', speed: 5, turn: 0.5, stride: 3.1, standoff: [12, 22],
    gun: { lay: 1.6, traverse: 18, hurt: 40, r: 4, range: 140 },
    salvo: { every: 3, missiles: 6, scatter: 4, mflight: 1.8, mr: 3, mhurt: 20 },
    reload: { secs: 4, slow: [1, 1.5, 2.2] }, ram: { hurt: 30, every: 1.5 }, mine: { stun: 7, core: 30 },
    ...over,
    gun: { lay: 1.6, traverse: 18, hurt: 40, r: 4, range: 140, ...(over.gun ?? {}) },
  };
}

/** THE TANK'S WEAK SPOTS: its engine from behind, its sights from anywhere, and its own (the header). */
export function tankSpots({ engine, sights = null, phases = ['tank'], ...more } = {}) {
  if (!engine) throw new Error('tankSpots: a tank has an engine ([forward, right, up] on its body)');
  return [
    { id: 'engine', name: 'its engine deck', part: 'engine', at: { tank: engine }, r: 1.1, core: 1, from: 'behind', arc: 60, phases },
    ...(sights ? [{ id: 'sights', name: 'its sights', part: 'sights', at: { tank: sights }, r: 0.7, hp: 45, bonus: 20, effect: { spread: 2.5, lay: 1.6 }, phases }] : []),
    ...Object.values(more).flat(),
  ];
}

// the bodies a siege walker's spots stand on
const PLACES = ['pelvis', 'cage', 'pack', 'hipR', 'hipL', 'tailBaseR', 'tailBaseL', 'tailSeg1R', 'tailSeg1L', 'footR', 'footL', 'shankR', 'shankL'];

/** THE SIEGE WALKER AS A BOSS (the header). */
export function siegeWalkerBoss({ id = 'siege', at = [0, 0, 0], heading = 0, bounds = null, down = null, frame = 'siege walker', palette = null, tune = {} } = {}) {
  const F = frameBase({ frame, ...(palette ? { palette } : {}) }, { reload: true, places: PLACES });
  if (!F.drive || !F.places?.tank) throw new Error(`siegeWalkerBoss: the ${F.id} has no tank form to fold into`);
  const W = F.places.walker, T = F.places.tank;
  // its guns: the howitzer on its right mount, the missile launcher on its left (frames.js rounds: [f, r, u])
  const gun = (w) => { const R = F.rounds.find((x) => x.weapon === w); return R ? { at: R.at, atTank: R.atForm?.tank ?? R.at, barrel: R.barrel } : null; };
  const weapons = { r: gun('howitzer'), l: gun('missiles') };
  // its spots, on its own bodies in each form
  const tail = (S) => ({ id: `tail${S}`, name: `the ${S === 'R' ? 'right' : 'left'} reloader`, part: 'tail', side: S.toLowerCase(),
    // (at its root: the actuator its segments swing from, where it stays as they reach for the magazines)
    at: { walker: fru(mid(W[`tailBase${S}`], W[`tailSeg1${S}`])), tank: fru(mid(T[`tailBase${S}`], T[`tailSeg1${S}`])) }, r: 0.9, hp: 60, from: 'behind', arc: 75, bones: [`tailBase${S}`, `tailSeg1${S}`, `tailSeg2${S}`, `tailHead${S}`] });
  const leg = (S) => ({ id: `leg${S}`, name: `its ${S === 'R' ? 'right' : 'left'} leg`, part: 'leg', side: S.toLowerCase(), at: { walker: fru(mid(W[`foot${S}`], W[`shank${S}`])) }, hp: 100, by: 'mine', phases: ['stand'] });
  const hip = (S) => ({ id: `hip${S}`, name: `its ${S === 'R' ? 'right' : 'left'} hip`, part: 'hip', side: S.toLowerCase(),
    at: { tank: fru(T[`hip${S}`], [0, S === 'R' ? 0.45 : -0.45, 0]) }, r: 0.8, hp: 70, core: 0.5, bonus: 50, from: 'side', arc: 60, effect: { turn: 0.65 }, phases: ['tank'] });
  const spots = [
    tail('R'), tail('L'), leg('R'), leg('L'),
    ...tankSpots({
      // (its engine: the power pack's back, low behind its hips; its sights: the camera on the cockpit's roof)
      engine: fru(T.pack, [-0.9, 0, 0.1]), sights: fru(T.cage, [0, 0, 1.1]),
      hips: [hip('R'), hip('L')],
    }),
  ].map((s) => ({ ...s, ...(tune.spots?.[s.id] ?? {}) }));
  const g = F.gait, stand = {
    kind: 'walker', speed: r2(g.speed), turn: r2(g.turn), stride: r2(g.stride), then: 'tank', fall: 1.6,
    legs: { break: 150 },
    barrage: { aim: 1.8, shells: 3, gap: 0.9, missiles: 6, mgap: 0.22, flight: 2.8, mflight: 1.9, scatter: 4.5, r: 5, hurt: 30, mr: 3, mhurt: 12 },
    reload: { secs: 8, strokes: 2, slow: [1, 1.8, 3] },
    advance: { max: 10, stop: 3 },
    ...(tune.stand ?? {}),
  };
  const tank = tankPhase({ speed: r2(Math.min(5.5, F.drive.speed)), turn: r2(F.drive.turn), stride: r2(F.drive.stride), ...(tune.tank ?? {}) });
  const transformDur = r2(1 + 0.25 * g.L);
  const boss = { name: 'Siege walker', hp: tune.hp ?? 260, start: 'stand', fold: transformDur, phases: { stand, tank }, spots, weapons, mine: { item: 'mine', arm: 1, trip: 2.6, hurt: 55, lane: 2.6, tankLane: 3 },
    ...(down ? { down } : {}), ...(bounds ? { bounds } : {}) };
  // its spots' bodies: an egg each, no hp of its own (what hits it is the spot's: boss.js)
  const spotEntities = spots.filter((s) => (s.by ?? 'round') === 'round').map((s) => ({ id: `${id}:${s.id}`, rule: { type: 'static', bossSpot: { boss: id, spot: s.id } },
    body: { type: 'none', radius: s.r ?? 0.8, egg: { a: s.r ?? 0.8, c: s.r ?? 0.8, cz: s.r ?? 0.8 } }, transform: { pos: at.slice(), heading: 0 } }));
  const entity = { id, rule: { type: 'static', boss }, transformDur, body: { type: 'figure-rig', figure: id }, transform: { pos: at.slice(), heading } };
  return {
    entities: [entity, ...spotEntities], figures: { [id]: F.figure }, boss,
    readout: { frame: F.id, height: F.height, mass: F.mass, gait: { speed: g.speed, stride: g.stride }, drive: { speed: F.drive.speed }, transformDur, spots: spots.map((s) => s.id), clips: Object.keys(F.figure.clips) },
  };
}

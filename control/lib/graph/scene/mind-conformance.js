/**
 * THE MIND CONFORMANCE CORPUS — the minds the Godot kernel runs (kernel/mind.gd, with kernel/nav.gd's pathing and
 * kernel/combat.gd's trigger, blade and reactions) against the web's own (worlds/controllable mind.js, nav.js), frame by
 * frame. A scenario is a small world: a pilot (its pose and trigger scripted) and one or more bodies on the `ai` rule,
 * with colliders; the web side steps the real engine on flat ground, the Godot side replays the pilot's pose after each
 * web step and runs every mind itself. Both print one canonical snapshot a frame: each mind's pose to 1e-9, its trigger,
 * clip and the state it decides by (cover, memory and search, its roll, swing and charge, its loadout slot, its path),
 * every hittable body's hp, hits and reaction, and the rounds in flight. The cover law (worlds/controllable/
 * cover.test.js) is its first scenarios. scripts/conformance.mjs --engine godot --corpus mind runs the Godot side.
 *
 *   SCENARIOS                  the hand scenarios: one case per procedure (a motivation, a perception, cover, the
 *                              blade, the roll, the loadout, a tier, a boss, space, the boost, the switch)
 *   randomScenarios(n, seed)   seeded worlds: minds of random motivation, perception and tuning among random boxes
 *   corpus({ random, seed })   every scenario, with the pilot's trace and the export's rows, as plain JSON
 *   runMinds(sc)               → { snaps, trace } on the web engine
 *
 * A frame may poke a field before its step (`poke: [{ id, key, value }]`, a dotted key into the entity: the cover law's
 * "it has been hit"), and hand the cast ops after it (`ops`, as the bus's ctrl verb would: a vanish, a spawn). What stays out of the corpus because the kernel leaves it to the web: a clash of blades and the
 * other set pieces (the pilot's shove-down after a counter-charge), the commander.
 */
import { mulberry32 } from '../vegetation/grow.js';
import { composeLive } from '../worlds/controllable/compose.js';
import { extractBus } from './engine-score.js';
import { extractMinds } from './mind-score.js';

export const DT = 1 / 30;
const FLAT = { ground: () => 0 };
const clone = (x) => JSON.parse(JSON.stringify(x));
let CW = null;

const PERSON = { a: 0.35, c: 0.9, cz: 0.9 };
const rifle = { fireClass: 'sight', auto: false, cooldown: 0.2, magazine: 4, reload: 1, damage: 1, range: 60, coreAngle: 1.5, eye: 1.5 };
const smg = { fireClass: 'sight', auto: true, cooldown: 0.12, magazine: 12, reload: 1.4, damage: 1, range: 40, coreAngle: 2, eye: 1.4 };
const lobber = { fireClass: 'lob', auto: false, cooldown: 0.8, magazine: 2, reload: 2, damage: 3, range: 30, speed: 14, gravity: 9.8, splash: 2, eye: 1.4 };
// the pilot: a platform body the script walks and turns (its pose replayed in Godot), hittable, with an optional gun
const pilot = (pos = [0, 0, 0], heading = 0, extra = {}) => ({ id: 'p', pilotable: true, rule: { type: 'platform', speed: 4, eye: 0, collideRadius: 0.3, collideHeight: 1.7 }, body: { type: 'mesh', hittable: true, hp: 99, egg: { ...PERSON } }, transform: { pos, heading, pitch: 0 }, ...extra });
const mind = (id, pos, heading, rule, extra = {}) => ({ id, rule: { type: 'ai', speed: 3, turn: 4, dodge: false, eye: 0, collideRadius: 0.3, collideHeight: 1.7, ...rule }, body: { type: 'mesh', hittable: true, hp: 30, egg: { ...PERSON }, ...(extra.body || {}) }, transform: { pos, heading, pitch: 0 }, ...Object.fromEntries(Object.entries(extra).filter(([k]) => k !== 'body')) });
const run = (...parts) => parts.flatMap(([n, input]) => Array.from({ length: n }, () => ({ input: { ...input } })));
const poke = (frames, at, list) => { frames[at] = { ...frames[at], poke: list }; return frames; };
const withOps = (frames, at, ops) => { frames[at] = { ...frames[at], ops: [...(frames[at].ops || []), ...ops] }; return frames; };
const WALL = [{ min: [-4, 3.5, 0], max: [-0.6, 4, 2] }];

export const SCENARIOS = [
  // ── the cover law (cover.test.js) ──
  { id: 'cover-hurt', about: 'hurt, it breaks for a spot the wall hides it at and holds there; the hold over, it comes back out after the one it fights, and sees it again',
    colliders: WALL, entities: [pilot([0.5, -9, 0], Math.PI / 2), mind('g', [0.5, 5, 0], -Math.PI / 2, { mind: { motivation: 'hunt', aggressiveness: 'bold', perception: 'memory', pathing: 'navmesh' }, navCell: 0.5, cover: { radius: 6, hold: 1.5 }, standoff: 30 }, { team: 'foes', weapon: { ...rifle, eye: 1.4, cooldown: 0.6 } })],
    frames: poke(run([200, {}]), 3, [{ id: 'g', key: 'hits', value: 1 }]) },
  { id: 'cover-reload', about: 'reloading is a reason too: it takes cover until the magazine is full',
    colliders: WALL, entities: [pilot([0.5, -9, 0], Math.PI / 2), mind('g', [0.5, 5, 0], -Math.PI / 2, { mind: { motivation: 'hunt', aggressiveness: 'bold', perception: 'memory', pathing: 'navmesh' }, navCell: 0.5, cover: true, standoff: 30 }, { team: 'foes', weapon: { ...rifle, eye: 1.4, cooldown: 0.6 } })],
    frames: poke(run([90, {}]), 3, [{ id: 'g', key: 'weapon.ammo', value: 0 }]) },
  { id: 'stand-and-fight', about: 'without cover it stands and fights: its trigger on its burst and pause, the pilot hit',
    colliders: WALL, entities: [pilot([0.5, -9, 0], Math.PI / 2), mind('g', [0.5, 5, 0], -Math.PI / 2, { mind: { motivation: 'hunt', aggressiveness: 'bold' }, standoff: 30 }, { team: 'foes', weapon: { ...rifle, eye: 1.4 } })],
    frames: run([120, {}]) },
  // ── pathing and perception ──
  { id: 'path-round-the-wall', about: 'no line to the pilot: it walks the grid path round the wall, corner to corner, replanning as the pilot moves',
    colliders: [{ min: [-6, -1, 0], max: [6, 1, 2.5] }], entities: [pilot([0, -8, 0], Math.PI / 2), mind('h', [0, 8, 0], -Math.PI / 2, { mind: { motivation: 'hunt', pathing: 'navmesh' }, navCell: 0.5, standoff: 3 })],
    frames: run([60, {}], [40, { forward: 1 }], [80, {}]) },
  { id: 'sight-memory-search', about: 'seen, then out of its sight range: it goes where it last saw the pilot, searches there, and forgets',
    entities: [pilot([6, 0, 0], 0), mind('s', [0, 0, 0], 0, { mind: { motivation: 'hunt', perception: 'memory' }, speed: 2, sightRange: 8, standoff: 2, memorySpan: 6, searchTime: 2 })],
    frames: run([10, {}], [280, { forward: 1 }]) },
  { id: 'respawn-forgets', about: 'a mind sent away and spawned again is a fresh life: what it saw before is gone, so it does not go looking where the pilot was',
    entities: [pilot([6, 0, 0], 0), mind('s', [0, 0, 0], 0, { mind: { motivation: 'hunt', perception: 'memory' }, speed: 2, sightRange: 8, standoff: 2, memorySpan: 6, searchTime: 2 })],
    frames: withOps(withOps(run([10, {}], [30, { forward: 1 }], [80, {}]), 10, [{ op: 'vanish', who: 's' }]), 40, [{ op: 'spawn', who: 's', at: [-4, 0] }]) },
  { id: 'sight-cone', about: 'sight only: behind it, the pilot is not seen; in front, it is (a fresh sighting counted once)',
    entities: [pilot([-6, 1.5, 0], 0), mind('c', [0, 0, 0], 0, { mind: { motivation: 'hunt', perception: 'sight' }, standoff: 2, sightCone: 0.8, speed: 1 })],
    frames: run([20, {}], [90, { forward: 1 }], [60, {}]) },
  // ── motivations ──
  { id: 'sentry-tower', about: 'a tower that never moves: the nearest foe in range is turned to and fired on, the trigger pulled on alternate frames',
    entities: [pilot([12, 0, 0], Math.PI, { team: 'heroes' }), mind('t', [0, 0, 0], 0, { mind: { motivation: 'sentry' }, foes: 'heroes', range: 14 }, { team: 'towers', weapon: { ...rifle, cooldown: 0.3, magazine: 30 } })],
    frames: run([20, {}], [40, { forward: -1 }], [40, { forward: 1 }]) },
  { id: 'guard-post', about: 'a guard holds its post: a target past its radius sends it back to the post, where it scans',
    entities: [pilot([6, 0, 0], 0), mind('g', [0, 0, 0], 0, { mind: { motivation: 'guard' }, guardRadius: 10, standoff: 2, scan: 0.8, scanPeriod: 3 })],
    frames: run([40, {}], [80, { forward: 1 }], [100, {}]) },
  { id: 'escort-ward', about: 'an escort keeps to its ward and turns on what comes near it',
    entities: [pilot([20, 0, 0], Math.PI), mind('ward', [0, 0, 0], 0, { mind: { motivation: 'wander' }, wanderRadius: 6 }, { team: 'blue' }), mind('e', [-3, 0, 0], 0, { mind: { motivation: 'escort' }, followDist: 3, guardRadius: 12, standoff: 3 }, { team: 'blue' })],
    frames: run([60, {}], [90, { forward: 1 }], [60, {}]) },
  { id: 'territorial-warn', about: 'an intruder inside its territory is warned, then attacked; outside it is left alone',
    entities: [pilot([14, 0, 0], Math.PI), mind('b', [0, 0, 0], 0, { mind: { motivation: 'territorial' }, territory: 9, warnTime: 1, standoff: 2, wanderRadius: 4 })],
    frames: run([40, {}], [60, { forward: 1 }], [80, {}]) },
  { id: 'wander-forage', about: 'a wanderer walks seeded legs with pauses; a forager grazes the food near its home, and drifts without it',
    entities: [pilot([40, 40, 0], 0), mind('w', [0, 0, 0], 0, { mind: { motivation: 'wander' }, wanderRadius: 8, wanderPause: 1 }), mind('f', [5, 5, 0], 0, { mind: { motivation: 'forage' }, grazeTime: 1.5, regrow: 4 }), { id: 'grass', rule: { type: 'static' }, food: true, transform: { pos: [8, 6, 0], heading: 0 }, body: { type: 'none' } }],
    frames: run([300, {}]) },
  { id: 'flee-prey', about: 'prey runs from the pilot inside its fear radius, faster than it walks; outside it stands',
    entities: [pilot([-12, 0, 0], 0), mind('d', [0, 0, 0], 0, { mind: { motivation: 'flee' }, fearRadius: 8, fleeSpeed: 5 })],
    frames: run([30, {}], [90, { forward: 1 }]) },
  { id: 'temper-defensive', about: 'a defensive mind stands until it is hurt, then fights; a passive one never does',
    entities: [pilot([8, 0, 0], Math.PI, { weapon: { ...rifle } }), mind('d', [0, 0, 0], 0, { mind: { motivation: 'hunt', aggressiveness: 'defensive' }, standoff: 3 }), mind('q', [0, 4, 0], 0, { mind: { motivation: 'hunt', aggressiveness: 'passive' }, standoff: 3 })],
    frames: run([20, {}], [2, { fire: 1 }], [60, {}]) },
  // ── the blade, the roll, the loadout ──
  { id: 'blade-commit', about: 'a blade in its loadout: it closes and swings the opener, chains the downswing, pays the cooldown, and gives up when nothing lands',
    entities: [pilot([6, 0, 0], Math.PI), mind('k', [0, 0, 0], 0, { mind: { motivation: 'hunt' }, meleeSeek: true, loadout: [{ name: 'blade', strike: 'melee', strikeReach: 1.6, strikeDamage: 2, strikeDur: 0.5, strikeCooldown: 0.4, comboCooldown: 1 }], meleeTimeout: 3, meleeGiveUp: 2 })],
    frames: run([80, {}], [60, { forward: -1 }], [80, {}]) },
  { id: 'roll-after-stagger', about: 'staggered by the pilot\'s rounds, it rolls off the line as it recovers, sides alternating',
    entities: [pilot([10, 0, 0], Math.PI, { weapon: { ...smg, impact: 5 } }), mind('r', [0, 0, 0], 0, { mind: { motivation: 'hunt' }, dodge: true, dodgeCooldown: 2, standoff: 6 }, { body: { poise: 8, staggerDur: 0.4 } })],
    frames: run([10, {}], [12, { fire: 1 }], [70, {}], [12, { fire: 1 }], [70, {}]) },
  { id: 'loadout-rotation', about: 'two guns: it rotates the pick every few seconds, paying the switch ready-time, its spacing changing with the tool; the stowed one reloads',
    entities: [pilot([20, 0, 0], Math.PI), mind('l', [0, 0, 0], 0, { mind: { motivation: 'hunt' }, weaponRotate: 2, switchReady: 0.4, loadout: [{ name: 'smg', weapon: { ...smg, magazine: 8 } }, { name: 'lob', weapon: { ...lobber } }] })],
    frames: run([200, {}]) },
  // ── tuning ──
  { id: 'tier-easy', about: 'the world\'s easy tier: aim wobble, a reaction delay, shorter bursts and longer pauses',
    aiDifficulty: 'easy', entities: [pilot([14, 3, 0], Math.PI), mind('a', [0, 0, 0], 0, { mind: { motivation: 'hunt' }, standoff: 8 }, { weapon: { ...smg } })],
    frames: run([60, {}], [60, { forward: 1, turn: 0.3 }]) },
  { id: 'mind-tuned', about: 'a body tunes its own on top of the tier: a veteran, relentless, with a tune',
    aiDifficulty: 'medium', entities: [pilot([14, 3, 0], Math.PI), mind('a', [0, 0, 0], 0, { mind: { motivation: 'hunt', skill: 'veteran', aggressiveness: 'relentless', tune: { burstMul: 0.6 } }, standoff: 8 }, { weapon: { ...smg } })],
    frames: run([90, {}]) },
  { id: 'boss-phases', about: 'a boss crosses its health phases, holding the shift beat, bolder each time, and keeps its adapting ledger',
    entities: [pilot([12, 0, 0], Math.PI, { weapon: { ...smg, damage: 3, magazine: 60 } }), mind('boss', [0, 0, 0], 0, { mind: { motivation: 'hunt', rank: 'boss', aggressiveness: 'bold' }, standoff: 6, loadout: [{ name: 'rifle', weapon: { ...rifle } }, { name: 'blade', strike: 'melee', strikeReach: 1.5, strikeDamage: 1 }] }, { body: { hp: 40 } })],
    frames: run([10, {}], [40, { fire: 1 }], [40, {}], [40, { fire: 1 }], [80, {}]) },
  // ── the boost, space, the switch ──
  { id: 'boost-juke', about: 'an opt-in boost: bursts of weaving at the boost speed, then rests; spacing pressed in and fallen back',
    entities: [pilot([16, 0, 0], Math.PI), mind('j', [0, 0, 0], 0, { mind: { motivation: 'hunt' }, boost: true, boostBurst: 1, boostRest: 0.6, boostSpeed: 7, jukePeriod: 0.4, standoff: 9 }, { weapon: { ...rifle } })],
    frames: run([150, {}]) },
  { id: 'space-seek', about: 'in space it seeks along the full vector, altitude too, and gates its trigger on the 3D aim',
    entities: [pilot([20, 0, 6], Math.PI), mind('v', [0, 0, 0], 0, { mind: { motivation: 'hunt' }, space: true, standoff: 8, boost: true, boostBurst: 0.8, boostRest: 0.8, boostSpeed: 6 }, { weapon: { ...rifle, range: 80 } })],
    frames: run([150, {}]) },
  // ── groups and the charge ──
  { id: 'group-pack-hunt', about: 'a pack: fanned out, then encircling and closing on the pilot; one attack token, re-dealt to the nearest',
    entities: [pilot([0, 0, 0], 0), ...['w1', 'w2', 'w3'].map((id, i) => mind(id, [-30 + i * 2.3, 8 - i * 3.7, 0], 0, { mind: { motivation: 'hunt', group: i ? 'wolves' : { id: 'wolves', plan: 'pack-hunt', attackers: 1, spacing: 3 } }, speed: 4, meleeSeek: true, loadout: [{ name: 'bite', strike: 'melee', strikeReach: 1.2, strikeDamage: 1, strikeDur: 0.4, strikeCooldown: 0.6 }] }))],
    frames: run([300, {}]) },
  { id: 'group-squad', about: 'a squad unseen travels in column behind its leader; once it sees the pilot, a line, then a pincer, sight shared',
    entities: [pilot([30, 0, 0], Math.PI), ...['s1', 's2', 's3', 's4'].map((id, i) => mind(id, [-4 - i * 2, i % 2 ? 2 : -2, 0], 0, { mind: { motivation: 'hunt', perception: 'sight', group: i ? 'squad' : { id: 'squad', plan: 'squad', travel: 'column', spacing: 2.5 } }, speed: 3, standoff: 10, sightRange: 40, sightCone: 0.6 }, { weapon: { ...rifle } }))],
    frames: run([60, {}], [120, { forward: 1 }], [100, {}]) },
  { id: 'group-herd', about: 'a herd keeps to its leader; a threat inside one member\'s fear radius scatters them all, each on its own bearing',
    entities: [pilot([-20, 0.7, 0], 0.05), ...['d1', 'd2', 'd3'].map((id, i) => mind(id, [i * 3, (i - 1) * 2, 0], 0, { mind: { motivation: 'flee', group: i ? 'deer' : { id: 'deer', kind: 'herd', spacing: 2 } }, fearRadius: 9, fleeSpeed: 2.5, speed: 2 }))],
    frames: run([40, {}], [120, { forward: 1 }], [60, {}]) },
  { id: 'counter-charge', about: 'the opportunist sees a blade swung at it and body-checks down the line: the swinger is stuffed (it topples, its swing spent) and flung round',
    entities: [pilot([0, 40, 0], 0), mind('o', [0, 0, 0], 0, { mind: { motivation: 'hunt', aggressiveness: 'opportunist' }, target: 'enemy', standoff: 5, boostSpeed: 9 }, { team: 'a' }),
      mind('k', [8, 0, 0], Math.PI, { mind: { motivation: 'hunt' }, target: 'enemy', meleeSeek: true, loadout: [{ name: 'blade', strike: 'melee', strikeReach: 1.6, strikeDamage: 2, strikeDur: 0.8, strikeCooldown: 1 }] }, { team: 'b', body: { poise: 20, staggerDur: 0.5 } })],
    frames: run([200, {}]) },
  { id: 'switch-off', about: 'the world switch: off, every mind stands down where it is; G wakes them',
    ai: 'off', entities: [pilot([8, 0, 0], Math.PI), mind('o', [0, 0, 0], 0, { mind: { motivation: 'hunt' }, standoff: 2 })],
    frames: run([30, {}], [1, { aiToggle: 1 }], [60, {}], [1, { aiToggle: 1 }], [30, {}]) },
];

// ── seeded worlds ─────────────────────────────────────────────────────────────────────────────────────────────────
const MOTIVES = ['hunt', 'hunt', 'guard', 'escort', 'territorial', 'wander', 'flee', 'sentry', 'forage'];
const PERCEPTS = [null, 'sight', 'memory'];
const TEMPERS = ['bold', 'relentless', 'wary', 'defensive', 'bold'];
export function randomScenarios(n = 12, seed = 1) {
  const out = [];
  for (let s = 0; s < n; s++) {
    const rand = mulberry32(seed * 7919 + s * 104729 + 17);
    const pick = (a) => a[Math.floor(rand() * a.length)];
    const R = (lo, hi) => lo + rand() * (hi - lo);
    const colliders = Array.from({ length: Math.floor(R(0, 4)) }, () => { const x = R(-12, 12), y = R(-12, 12), w = R(0.5, 4), d = R(0.5, 4), h = R(1, 3); return { min: [x, y, 0], max: [x + w, y + d, h] }; });
    const ents = [pilot([R(-14, 14), R(-14, 14), 0], R(-3, 3), rand() < 0.5 ? { weapon: { ...rifle, damage: 2 } } : {})];
    const nm = 1 + Math.floor(R(0, 3));
    for (let k = 0; k < nm; k++) {
      const motive = pick(MOTIVES), percept = pick(PERCEPTS);
      const rule = {
        mind: { motivation: motive, aggressiveness: pick(TEMPERS), ...(percept ? { perception: percept } : {}), ...(colliders.length && rand() < 0.6 ? { pathing: 'navmesh' } : {}) },
        speed: R(1.5, 5), turn: R(1.5, 6), standoff: R(2, 12), navCell: 0.75,
        ...(rand() < 0.3 ? { cover: true } : {}), ...(motive === 'sentry' ? { range: R(8, 20) } : {}),
        ...(rand() < 0.3 ? { dodge: true, dodgeCooldown: R(1, 4) } : {}),
      };
      const armed = motive !== 'flee' && motive !== 'forage' && rand() < 0.7;
      ents.push(mind(`m${k}`, [R(-14, 14), R(-14, 14), 0], R(-3, 3), rule, { ...(armed ? { weapon: { ...pick([rifle, smg]) } } : {}), ...(rand() < 0.5 ? { team: pick(['a', 'b']) } : {}), ...(rand() < 0.3 ? { body: { poise: R(4, 12), staggerDur: 0.4 } } : {}) }));
    }
    // a band: every mind in one group, its plan seeded
    if (nm > 1 && rand() < 0.4) { const plan = pick(['pack-hunt', 'squad']); ents.filter((e) => e.rule.type === 'ai').forEach((e, i) => { e.rule.mind.group = i ? 'band' : { id: 'band', plan, attackers: 1 }; }); }
    if (ents.some((e) => e.rule.mind && e.rule.mind.motivation === 'forage')) ents.push({ id: 'food', rule: { type: 'static' }, food: true, transform: { pos: [R(-8, 8), R(-8, 8), 0], heading: 0 }, body: { type: 'none' } });
    const frames = [];
    for (let i = 0; i < 6; i++) {
      const len = 10 + Math.floor(R(0, 40));
      const input = { forward: pick([0, 0, 1, -1]), turn: pick([0, 0, 0.5, -0.5]), fire: rand() < 0.2 ? 1 : 0 };
      for (let k = 0; k < len; k++) frames.push({ input: { ...input } });
    }
    out.push({ id: `random-${seed}-${s}`, about: 'seeded minds among random boxes', ...(rand() < 0.3 ? { aiDifficulty: pick(['easy', 'medium']) } : {}), colliders, entities: ents, frames });
  }
  return out;
}

// ── the snapshot: the same canonical string on both sides ────────────────────────────────────────────────────────
function canon(v) {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
// a pose to 1e-9: a step's sine and cosine agree between the engines' libraries to the last bit almost, not always
const nano = (x) => (x == null ? null : Math.floor(x * 1e9 + 0.5) / 1e9);
const WEAPON_STATE = ['ammo', 'reserve', 'cooldownT', 'reloading', 'reloadT', 'shots'];

export function snapshotOf(world, mindIds, bodyIds, events = []) {
  const minds = {};
  for (const id of mindIds) {
    const e = world.byId[id], w = e.weapon;
    minds[id] = {
      pos: e.transform.pos.map(nano), heading: nano(e.transform.heading), pitch: nano(e.transform.pitch || 0),
      fire: e.aiFire ? 1 : 0, loco: e.locomotion ?? null, moving: !!e.moving,
      cover: e.coverAt ? e.coverAt.map(nano) : null, seen: e.lastSeen ? nano(e.lastSeen.t) : null, sightings: e.sightings || 0,
      search: nano(e.searchT ?? null), dodge: nano(e.dodgeT ?? null), dodgeCd: nano(e.dodgeCdT || 0), swing: nano(e.swingT ?? null),
      strikeCd: nano(e.strikeCdT || 0), slot: e.loadoutIdx || 0, ready: nano(e.readyT || 0), phase: e.mindPhase ?? null,
      path: e.navPath ? e.navPath.length : null, warn: e.warnFor ?? null, graze: nano(e.grazeT || 0),
      ...(w ? { weapon: WEAPON_STATE.map((k) => (typeof w[k] === 'number' ? nano(w[k]) : (w[k] ?? null))) } : {}),
    };
  }
  const bodies = {};
  for (const id of bodyIds) {
    const e = world.byId[id];
    bodies[id] = { hp: e.body && Number.isFinite(e.body.hp) ? nano(e.body.hp) : null, hits: e.hits || 0, downed: !!e.downed, stagger: nano(e.staggerT ?? null), react: Number.isFinite(e.poise) ? e.reactClip : null };
  }
  return canon({ minds, bodies, rounds: (world.projectiles || []).map((p) => [p.pos.map(nano), p.vel.map(nano)]), seen: events.filter((ev) => ev.type === 'seen').map((ev) => [ev.entity, ev.target ?? null]) });
}

function setPath(o, key, value) {
  const ks = key.split('.');
  let t = o;
  for (let i = 0; i < ks.length - 1; i++) t = t[ks[i]];
  t[ks[ks.length - 1]] = value;
}

const specOf = (sc) => ({ entities: clone(sc.entities), ...(sc.colliders ? { colliders: clone(sc.colliders) } : {}), ...(sc.aiDifficulty ? { aiDifficulty: sc.aiDifficulty } : {}), ...(sc.ai ? { ai: sc.ai } : {}) });

export function runMinds(sc) {
  CW ||= composeLive();
  const world = CW.createWorld(specOf(sc));
  const mindIds = world.entities.filter((e) => e.rule.type === 'ai').map((e) => e.id);
  const bodyIds = world.entities.filter((e) => e.body && e.body.hittable).map((e) => e.id);
  const snaps = [], trace = [];
  let prev = CW.castFacts(world, undefined).prev;
  for (const f of sc.frames) {
    for (const p of f.poke || []) setPath(world.byId[p.id], p.key, clone(p.value));
    CW.stepWorld(world, clone(f.input), f.dt || DT, FLAT);
    const c = CW.castFacts(world, prev);
    prev = c.prev;
    const h = world.byId.p;
    trace.push({ pos: h.transform.pos.slice(), heading: h.transform.heading, pitch: h.transform.pitch || 0, grounded: !!h.grounded });
    snaps.push(snapshotOf(world, mindIds, bodyIds, c.events));
    if (f.ops) CW.castOps(world, clone(f.ops));
  }
  return { snaps, trace, mindIds, bodyIds };
}

// every scenario with what the Godot side reads: the export's cast rows, combat and minds (bus.json), the frames with
// the pilot's pose after each web step
export function corpus({ random = 12, seed = 1 } = {}) {
  return [...SCENARIOS, ...randomScenarios(random, seed)].map((sc) => {
    const payload = { ...specOf(sc), events: {} };
    const bus = extractBus(payload);
    const { trace, mindIds, bodyIds } = runMinds(sc);
    return clone({
      id: sc.id, about: sc.about, cast: bus.cast, combat: bus.combat, minds: extractMinds(payload, 'p'), mindIds, bodyIds,
      frames: sc.frames.map((f, i) => ({ input: f.input, dt: f.dt || DT, pilot: trace[i], ...(f.poke ? { poke: f.poke } : {}), ...(f.ops ? { ops: f.ops } : {}) })),
    });
  });
}

export const scenarioById = (id, { random = 12, seed = 1 } = {}) => [...SCENARIOS, ...randomScenarios(random, seed)].find((s) => s.id === id);

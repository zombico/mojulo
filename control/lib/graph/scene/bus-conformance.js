/**
 * BUS CONFORMANCE — the corpus that holds the Godot kernel's event bus (godot-kernel/bus.gd) EQUAL to the web reducer
 * (worlds/event-bus.js buildBus). A scenario is a bus fragment, starting entities and a list of frames. Each frame runs
 * in the web page's order (scene/channels/events.js): the walkers' zone facts join the incoming events, then
 * process, the watch fixpoint, timers, sagas and the fixpoint again. Its snapshot is the canonical state
 * (`hashState`) plus the character intents and warps the frame queued. Both kernels must print the same string for
 * every frame. scripts/godot-bus-conformance.mjs runs the Godot side and compares.
 *
 *   SCENARIOS                   the hand scenarios: each names what it exercises
 *   randomScenarios(n, seed)    seeded scenarios over a small vocabulary (globs, refs, sagas, caps, float sums)
 *   corpus({ random })          every scenario, as plain JSON
 *   runScenario(sc)             → [snapshot per frame], on the web reducer
 *
 * STORE scenarios (`store: true`) hold the Godot store (godot-kernel/store.gd) equal to the web's (game/store-kernel.js)
 * the same way: a schema and a list of ops ({ events } | { outcome: { contract, envelope } } | { gate }), each op's
 * result snapshotted (ok, the errors word for word, the state after), the state carried only when a write is ok.
 *
 *   STORE_SCENARIOS, randomStoreScenarios(n, seed), runStoreScenario(sc)
 */
import { mulberry32 } from '../vegetation/grow.js';
import { buildBus } from '../worlds/event-bus.js';
import { lowerPlay } from '../playscape/ui/direction.js';
import { composeMechanics } from '../game/mechanics.js';
import { buildGameStoreKernel } from '../game/store-kernel.js';
import { buildStats } from '../playscape/stats/kernel.js';

// a scenario's frame: { events?: [...], dt?: seconds, walkers?: [{ id, position }] }
const clone = (x) => JSON.parse(JSON.stringify(x));

const BILLIARDS = {
  id: 'billiards',
  about: 'reactions with match globs and event refs; toggle; a re-pot of a gone ball is a no-op toggle back',
  config: { reactions: [
    { on: 'contact', match: { b: 'pocket-*' }, do: 'emit', type: 'potted', ball: 'event.a' },
    { on: 'potted', do: 'toggle', target: 'event.ball' },
  ] },
  entities: [1, 2, 3].map((i) => ({ id: `ball-${i}`, on: true })),
  frames: [
    { events: [{ type: 'contact', a: 'ball-1', b: 'pocket-tl' }, { type: 'contact', a: 'ball-2', b: 'pocket-tr' }] },
    { events: [{ type: 'contact', a: 'ball-3', b: 'rail' }] },
    { events: [{ type: 'contact', a: 'ball-1', b: 'pocket-bl' }, { type: 'contact', a: 'ghost', b: 'pocket-bl' }] },
  ],
};

const VAULT = {
  id: 'vault',
  about: 'vars written by inc, an edge-triggered watch, a saga that waits on a timer and on an event',
  config: {
    vars: { keys: 0 },
    reactions: [
      { on: 'grab-key', do: 'inc', var: 'keys' },
      { on: 'unlocked', do: 'toggle', target: 'gate' },
    ],
    watches: [{ type: 'unlocked', when: { var: 'keys', gte: 3 } }],
    sequences: [{ id: 'reveal', trigger: { on: 'unlocked' }, steps: [
      { await: { timer: 0.5 } },
      { do: 'toggle', target: 'treasure', to: true },
      { await: { on: 'open', who: 'event.source' } },
      { do: 'emit', type: 'looted' },
    ] }],
  },
  entities: [{ id: 'gate', on: true }, { id: 'treasure', on: false }],
  frames: [
    { events: [{ type: 'grab-key' }], dt: 0.1 },
    { events: [{ type: 'grab-key' }, { type: 'grab-key' }], dt: 0.1 },
    { dt: 0.2 }, { dt: 0.2 }, { dt: 0.2 },
    { events: [{ type: 'open', who: 'nobody' }], dt: 0.1 },
    { events: [{ type: 'open', who: 'unlocked' }], dt: 0.1 },
  ],
};

const STORM = {
  id: 'storm',
  about: 'the depth cap and the per-tick budget, both loud',
  config: { budget: 40, depthCap: 3, reactions: [
    { on: 'spark', do: 'emit', type: 'spark', gen: 'event.gen' },
    { on: 'spark', do: 'emit', type: 'spark', gen: 'two' },
  ] },
  entities: [],
  frames: [{ events: [{ type: 'spark', gen: 'one' }] }, { events: Array.from({ length: 30 }, (_, i) => ({ type: 'spark', gen: `g${i}` })) }],
};

const VERBS = {
  id: 'verbs',
  about: 'spawn with a content-derived id, move (position and pose), impulse by dir and vector, clamps, ctrl intents, warps',
  config: {
    vars: { hp: 10 },
    reactions: [
      { on: 'drop', do: 'spawn', type: 'crate', at: 'event.at' },
      { on: 'drop', do: 'spawn', template: { id: 'flag', type: 'marker', on: true } },
      { on: 'push', do: 'impulse', target: 'event.who', dir: 'up', gain: 2.5 },
      { on: 'push', do: 'impulse', target: 'event.who', vector: [0.1, 0.2, 0] },
      { on: 'pose', do: 'move', target: 'bot', to: 'event.pose' },
      { on: 'warp', do: 'move', target: 'hero', to: [1, 2, 3] },
      { on: 'hit', do: 'inc', var: 'hp', by: -4, min: 1 },
      { on: 'heal', do: 'inc', var: 'hp', by: 0.1, max: 12 },
      { on: 'name', do: 'set', var: 'title', to: 'event.name' },
      { on: 'greet', do: 'ctrl', op: 'walk', who: 'event.who', to: ['door'] },
    ],
  },
  entities: [{ id: 'bot', on: true, position: [0, 0, 0] }],
  frames: [
    { events: [{ type: 'drop', at: [3, 4, 0] }, { type: 'drop', at: [3, 4, 0], n: 2 }] },
    { events: [{ type: 'push', who: 'bot' }, { type: 'push', who: 'missing' }, { type: 'pose', pose: 'wave' }] },
    { events: [{ type: 'hit' }, { type: 'hit' }, { type: 'hit' }, { type: 'heal' }, { type: 'heal' }, { type: 'heal' }] },
    { events: [{ type: 'warp' }, { type: 'greet', who: 'mayor' }, { type: 'name', name: 'Ünïcode "quoted"\tname' }, { type: 'name' }] },
  ],
};

// chapters, lowered by the play exactly as a world does (playscape/ui/chapters.js through lowerPlay)
const TOWN_PLAY = {
  chapters: [
    { id: 'warned', when: { on: 'mayor-warned' }, world: { set: { gate: 'shut' } } },
    { id: 'siege', when: { after: 'warned' }, world: { set: { alarm: 'ringing' } } },
  ],
  carry: 'world',
};
const chapterTown = () => ({
  id: 'chapter-town',
  about: 'chapters lowered by lowerPlay: the counted turn, the chain, the carried twin that turns nothing again',
  config: clone(lowerPlay({ play: TOWN_PLAY })),
  entities: [],
  frames: [
    { events: [{ type: 'chapter-warned-carried' }] },
    { events: [{ type: 'mayor-warned' }] },
    { events: [{ type: 'mayor-warned' }] },
  ],
});
const chapterLive = () => ({ ...chapterTown(), id: 'chapter-live', about: 'a live turn and its chain', frames: [{ events: [{ type: 'mayor-warned' }] }, { events: [{ type: 'mayor-warned' }] }] });

// stats, lowered by the play as a world does (playscape/stats/stats.js through lowerPlay): levels on xp, a tech tree
// with ranks and a subtree, epochs by level and bought, offers, derived stats on every curve, buffs and their
// removal, a scaled hurt on the cast, bound bodies; the cues hear levelled, bought, denied, opened and epoch
const STATS_PLAY = {
  stats: {
    holders: ['hero'],
    stats: [
      { id: 'strength', base: 5, min: 0, max: 20 }, { id: 'vitality', base: 3 },
      { id: 'might', from: { sum: [{ stat: 'strength', per: 2 }, { stat: 'level', per: 0.5 }], curve: { soft: 20 } } },
      { id: 'guard', from: { stat: 'vitality', curve: { mitigate: 10 } } },
      { id: 'swift', from: { stat: 'level', base: 1, curve: 'sqrt', max: 3 } },
    ],
    bodies: { hpMax: 'vitality', speed: 'swift' },
    resources: [{ id: 'points' }, { id: 'gold', start: 10, cap: 500 }],
    level: { start: 1, max: 10, xp: { base: 100, growth: 2 }, each: { grant: { points: 1 }, raise: { vitality: 1 } }, at: { 3: { grant: { gold: 50 } } } },
    epochs: [{ id: 'hatchery' }, { id: 'lair', level: 3 }, { id: 'hive', cost: { gold: 100 }, requires: { level: 4 } }],
    tree: [
      { id: 'fireball', cost: { points: 1 }, ranks: 3, growth: 1.5, tree: [{ id: 'inferno', opens: 2, cost: { points: 1 } }] },
      { id: 'burrow', epoch: 'lair', cost: { points: 1 } },
      { id: 'carapace', epoch: 'hive', requires: { all: [{ has: 'burrow' }, { stat: 'strength', gte: 6 }] }, cost: { points: 1, gold: 20 } },
    ],
    offers: [{ id: 'train', cost: { points: 1 }, gives: { raise: { strength: 1 } }, max: 2 }],
  },
  cues: [
    { id: 'kill', when: { on: 'kill' }, then: { xp: { by: 120 } } },
    { id: 'slay', when: { on: 'slay' }, then: { xp: { by: { stat: 'level', per: 150 } } } },
    { id: 'loot', when: { on: 'loot' }, then: { grant: { res: 'gold', by: 40 } } },
    { id: 'tithe', when: { on: 'tithe' }, then: { grant: { res: 'points', by: 3 } } },
    { id: 'ding', when: { on: 'ding' }, then: { level: { by: 1 } } },
    { id: 'lift', when: { on: 'lift' }, then: { raise: { stat: 'strength', by: 2 } } },
    { id: 'drink', when: { on: 'drink' }, then: { buff: { id: 'potion', mods: [{ stat: 'strength', add: 3 }, { stat: 'might', pct: 0.25 }] } } },
    { id: 'brew', when: { on: 'brew' }, then: { buff: { id: 'potion-2', stat: 'vitality', mul: { stat: 'level', base: 1, per: 0.1 } } } },
    { id: 'sober', when: { on: 'sober' }, then: { unbuff: 'potion*' } },
    { id: 'hit', when: { on: 'hit' }, then: { hurt: { who: 'hero', by: { stat: 'might', per: 1.5 } } } },
    ...['fireball', 'inferno', 'burrow', 'carapace', 'hive', 'lair', 'train'].map((id) => ({ id: `buy-${id}`, when: { on: `buy-${id}` }, then: { buy: id } })),
    { id: 'up', when: { levelled: 'hero' }, then: { set: 'saw-level', to: 1 } },
    { id: 'got', when: { bought: 'fireball' }, then: { emit: 'fire-ready' } },
    { id: 'no', when: { denied: 'fireball' }, then: { set: 'refused', to: 1 } },
    { id: 'era', when: { epoch: 'lair' }, then: { set: 'era', to: 'lair' } },
    { id: 'new', when: { opened: 'inferno' }, then: { set: 'inferno-seen', to: 1 } },
  ],
};
const STATS_EVENTS = ['kill', 'slay', 'loot', 'tithe', 'ding', 'lift', 'drink', 'brew', 'sober', 'hit', 'buy-fireball', 'buy-inferno', 'buy-burrow', 'buy-carapace', 'buy-hive', 'buy-lair', 'buy-train', 'buy-nothing'];
const statsWorld = () => {
  const ev = lowerPlay({ play: STATS_PLAY });
  const { stats, ...config } = ev;
  // an id nothing names (the reader refuses it; a hand-poked bus can still send it): the kernel's `unknown`
  const fire = config.reactions.find((r) => r.do === 'ctrl' && r.op === 'buy' && r.id === 'fireball');
  config.reactions.push({ ...fire, on: 'buy-nothing', id: 'nothing' });
  return { config: clone(config), stats: clone(stats) };
};
const statsRun = () => ({
  id: 'stats-run',
  about: 'a stats play lowered by lowerPlay: every transaction, refusal, curve, buff and bound body',
  ...statsWorld(),
  entities: [],
  frames: [
    {},
    { events: [{ type: 'buy-fireball' }, { type: 'buy-nothing' }, { type: 'buy-hive' }] },
    { events: [{ type: 'kill' }, { type: 'kill' }, { type: 'kill' }] },
    { events: [{ type: 'buy-fireball' }, { type: 'tithe' }, { type: 'buy-fireball' }, { type: 'buy-inferno' }] },
    { events: [{ type: 'drink' }, { type: 'brew' }, { type: 'hit' }] },
    { events: [{ type: 'slay' }, { type: 'loot' }, { type: 'loot' }, { type: 'loot' }] },
    { events: [{ type: 'buy-burrow' }, { type: 'lift' }, { type: 'buy-hive' }, { type: 'buy-carapace' }] },
    { events: [{ type: 'sober' }, { type: 'hit' }, { type: 'ding' }, { type: 'buy-train' }, { type: 'buy-train' }, { type: 'buy-train' }] },
    // might past its soft cap (the curve's default slope), and strength held at its max
    { events: [{ type: 'lift' }, { type: 'lift' }, { type: 'lift' }, { type: 'lift' }, { type: 'lift' }, { type: 'lift' }, { type: 'hit' }] },
  ],
});
/** Seeded runs over the stats play: random events per frame, so the transactions meet in orders no hand wrote. */
export function randomStatsScenarios(n = 6, seed = 1) {
  const rand = mulberry32(seed * 7919 + 3), world = statsWorld(), out = [];
  for (let i = 0; i < n; i++) {
    const frames = [];
    for (let f = 0; f < 10; f++) frames.push({ events: Array.from({ length: Math.floor(rand() * 5) }, () => ({ type: STATS_EVENTS[Math.floor(rand() * STATS_EVENTS.length)] })) });
    out.push({ id: `stats-random-${seed}-${i}`, about: 'seeded stats events', ...clone(world), entities: [], frames });
  }
  return out;
}

// a crawler level, lowered from mechanics as a level sketch is (game/mechanics.js), walked through its zones
const STORE = { slices: [{ name: 'hero', kind: 'character', init: { stats: { hp: 100 } } }, { name: 'bag', kind: 'inventory' }, { name: 'campaign', kind: 'progression' }] };
const crawler = () => {
  const out = composeMechanics([
    { kind: 'reach-exit', at: [20, 0, 0], radius: 2 },
    { kind: 'collect', pickups: [{ item: 'coin', at: [5, 0, 0] }] },
    { kind: 'hazard-damage', hazards: [{ at: [10, 0, 0], damage: 25 }] },
    { kind: 'fail-on-death' },
  ], { storeSchema: STORE, player: 'hero', spawn: [0, 0, 2] });
  const at = (x) => [{ id: 'hero', position: [x, 0, 0] }];
  return {
    id: 'crawler',
    about: 'mechanics lowered to the bus, played through zone facts: a pickup, a hazard twice, the exit',
    config: clone(out.events),
    entities: clone(out.events.entities || []),
    frames: [0, 5, 5.5, 10, 12, 10.2, 15, 20].map((x) => ({ walkers: at(x), dt: 1 / 60 })),
  };
};

// Godot's JSON parser rounds some decimals to a neighbouring double (kernel/json_exact.gd reads them exactly): a 60 Hz
// step summed onto a 0.3 s period, and values JS prints in full (1.3000000000000003), hold the read to the web's
const FLOATS = {
  id: 'floats',
  about: 'the exact read: 60 Hz steps summed against a period, sums that print in full, a threshold on the edge',
  config: {
    vars: { t: 0, x: 1.3000000000000003 },
    timers: [{ every: 0.3, emit: { type: 'beat' } }],
    reactions: [{ on: 'beat', do: 'inc', var: 't', by: 0.1 }, { on: 'nudge', do: 'inc', var: 'x', by: 0.016666666666666666 }],
    watches: [{ type: 'edge', when: { var: 't', gte: 0.30000000000000004 } }],
  },
  entities: [],
  frames: Array.from({ length: 40 }, (_, i) => ({ dt: 1 / 60, ...(i % 7 === 0 ? { events: [{ type: 'nudge' }] } : {}) })),
};

// JS keeps undefined where Godot would say null: a var set from a missing field compares false, not as 0
const UNDEFINED = {
  id: 'undefined',
  about: 'a var set from a missing field, a timer gated on it, an emit whose fields resolve to nothing',
  config: {
    vars: { p: 0 },
    reactions: [
      { on: 'clear', do: 'set', var: 'p', to: 'event.missing' },
      { on: 'clear', do: 'emit', type: 'echo', who: 'event.missing' },
      { on: 'echo', match: { who: 'undefined' }, do: 'inc', var: 'echoed' },
    ],
    timers: [{ every: 0.5, emit: { type: 'tick' }, while: { var: 'p', lt: 4 } }],
  },
  entities: [],
  frames: [{ dt: 0.5 }, { events: [{ type: 'clear' }], dt: 0.5 }, { dt: 0.5 }, { dt: 0.5 }],
};

// doubles Godot's own read and print got wrong (found by the combat port): a small number's late digits (to_float drops
// them), 17-digit prints where 16 name the double, a tie printed toward the odd digit, the exponent forms and the
// subnormals. Each is read from the fragment, carried, summed and printed back in the state.
const DOUBLES = [0.0029523809523809424, 0.00003093738464768203, 0.3299999999999986, 0.006666666666665592, 590.46173095703125, 0.770952380952381, 1e21, 1.5e-7, 2.7755575615628914e-17, 5e-324, 1.7976931348623157e308, 123e-20];
const NUMBERS = {
  id: 'numbers',
  about: 'doubles at the edges of the exact read and the JS print: late digits, ties, exponent forms, subnormals',
  config: {
    vars: Object.fromEntries(DOUBLES.map((x, i) => [`d${i}`, x])),
    reactions: DOUBLES.map((x, i) => ({ on: 'step', do: 'inc', var: `d${i}`, by: DOUBLES[(i + 1) % DOUBLES.length] })),
  },
  entities: [],
  frames: Array.from({ length: 3 }, () => ({ events: [{ type: 'step' }] })),
};

// a reaction's `if` (buildBus reactionMatch): the race's checkpoints lower to guarded reactions, each counting only
// after the one before it; a guard reads the state as the reactions before it in the same event left it
const GUARDED = {
  id: 'guarded',
  about: 'checkpoints in order and out of order, a guard on an undefined var, a guard flipped by the reaction before it, count and entity guards',
  config: {
    vars: { cp: 0, laps: 0 },
    reactions: [
      ...[0, 1, 2].flatMap((i) => [
        { on: 'enter', match: { zone: `cp-${i}` }, if: { var: 'cp', eq: i }, do: 'emit', type: 'checkpoint', at: i },
        { on: 'enter', match: { zone: `cp-${i}` }, if: { var: 'cp', eq: i }, do: 'set', var: 'cp', to: i + 1 },
      ]),
      { on: 'enter', match: { zone: 'finish' }, if: { var: 'cp', eq: 3 }, do: 'emit', type: 'lap' },
      { on: 'lap', do: 'inc', var: 'laps' },
      { on: 'lap', do: 'set', var: 'cp', to: 0 },
      { on: 'ping', if: { var: 'nope', eq: 0 }, do: 'inc', var: 'undef-eq' },
      { on: 'ping', if: { var: 'nope', ne: 0 }, do: 'inc', var: 'undef-ne' },
      { on: 'flip', do: 'set', var: 'armed', to: true },
      { on: 'flip', if: { var: 'armed', eq: true }, do: 'inc', var: 'after-flip' },
      { on: 'tally', if: { count: 'checkpoint', gte: 2 }, do: 'emit', type: 'two-seen' },
      { on: 'tally', if: { entity: 'gate', field: 'on', eq: false }, do: 'toggle', target: 'gate' },
    ],
  },
  entities: [{ id: 'gate', on: true }],
  frames: [
    { events: [{ type: 'enter', zone: 'finish' }, { type: 'enter', zone: 'cp-2' }, { type: 'ping' }] },
    { events: [{ type: 'enter', zone: 'cp-0' }, { type: 'enter', zone: 'cp-0' }, { type: 'tally' }] },
    { events: [{ type: 'enter', zone: 'cp-2' }, { type: 'enter', zone: 'cp-1' }, { type: 'flip' }] },
    { events: [{ type: 'enter', zone: 'cp-2' }, { type: 'enter', zone: 'finish' }, { type: 'tally' }] },
    { events: [{ type: 'enter', zone: 'finish' }, { type: 'flip' }] },
  ],
};

export const SCENARIOS = [BILLIARDS, VAULT, STORM, VERBS, FLOATS, UNDEFINED, NUMBERS, GUARDED];

// ── seeded scenarios over a small vocabulary ──────────────────────────────────────────────────────────────────────
export function randomScenarios(n = 24, seed = 7) {
  const rand = mulberry32(seed), pick = (l) => l[Math.floor(rand() * l.length)], int = (k) => Math.floor(rand() * k);
  const TYPES = ['a', 'b', 'c', 'd'], IDS = ['e1', 'e2', 'e3', 'x-1', 'x-2'];
  const out = [];
  for (let s = 0; s < n; s++) {
    const reactions = [];
    for (let r = 0; r < 3 + int(5); r++) {
      const on = pick(TYPES), roll = rand();
      const match = rand() < 0.3 ? { who: pick(['e*', 'x-*', 'e2', '*']) } : undefined;
      const base = { on, ...(match ? { match } : {}) };
      if (roll < 0.3) reactions.push({ ...base, do: 'emit', type: pick(TYPES), who: pick(['event.who', 'e1', 'event.missing']), n: int(3) });
      else if (roll < 0.5) reactions.push({ ...base, do: 'inc', var: pick(['p', 'q']), by: pick([1, 0.1, -0.25, 'event.k', 2.5]) });
      else if (roll < 0.6) reactions.push({ ...base, do: 'set', var: pick(['p', 'r']), to: pick([7, 'word', 'event.who', true, 0.5]) });
      else if (roll < 0.75) reactions.push({ ...base, do: 'toggle', target: pick(['event.who', ...IDS]) });
      else if (roll < 0.85) reactions.push({ ...base, do: 'move', target: pick(IDS), to: pick([[1, 2, 3], 'pose-a', 'event.at']) });
      else reactions.push({ ...base, do: 'spawn', type: 'bit', at: 'event.at' });
    }
    const WHENS = [{ var: 'p', gte: 1 }, { var: 'q', lt: 0 }, { var: 'p', ne: 0 }, { var: 'q', lte: -1 }, { var: 'p', gt: 0.25 }, { var: 'r', eq: 'word' },
      { count: pick(TYPES), gte: 3 }, { count: pick(TYPES), lt: 2 }, { any: 'e*', field: 'on', eq: false }, { all: 'x-*', field: 'x', gt: 0 },
      { entity: 'e1', field: 'on', eq: true }, { entity: 'e2', field: 'pose', ne: 'pose-a' }];
    // a reaction's `if`, from a second stream so the first's draws are the ones they were before guards joined
    const grand = mulberry32(seed * 7919 + s);
    for (const r of reactions) if (grand() < 0.35) r.if = WHENS[Math.floor(grand() * WHENS.length)];
    const watches = Array.from({ length: 1 + int(3) }, () => ({ type: pick(TYPES), when: pick(WHENS) }));
    const sequences = rand() < 0.6 ? [{ id: 'saga', trigger: { on: pick(TYPES) }, scope: 'event.who', steps: [{ do: 'emit', type: pick(TYPES) }, { await: { timer: 0.25 } }, { do: 'inc', var: 'q', by: -1 }, { await: { on: pick(TYPES) } }, { do: 'toggle', target: 'e1' }] }] : [];
    const timers = rand() < 0.5 ? [{ every: pick([0.3, 0.5, 1]), emit: { type: pick(TYPES), who: 'e2' }, ...(rand() < 0.5 ? { while: { var: 'p', lt: 4 } } : {}) }] : [];
    const frames = [];
    for (let f = 0; f < 6 + int(6); f++) {
      const events = [];
      for (let e = 0; e < int(4); e++) events.push({ type: pick(TYPES), who: pick(IDS), k: pick([1, 0.1, 3]), at: [int(5), int(5), 0] });
      frames.push({ events, dt: pick([0.1, 1 / 60, 0.25]) });
    }
    out.push({ id: `random-${s}`, about: 'seeded', config: { budget: 200, depthCap: 5, vars: { p: 0 }, reactions, watches, sequences, timers }, entities: IDS.map((id, i) => ({ id, on: i % 2 === 0, position: [i, 0, 0] })), frames });
  }
  return out;
}

// ── the store ────────────────────────────────────────────────────────────────────────────────────────────────────
const SCHEMA = { slices: [
  { name: 'hero', kind: 'character', init: { stats: { hp: 100 } } },
  { name: 'bag', kind: 'inventory', init: { items: { coin: 2 } } },
  { name: 'crew', kind: 'party', init: { roster: { ana: { name: 'Ana', stats: { hp: 30 } } } } },
  { name: 'campaign', kind: 'progression' },
  { name: 'world', kind: 'flags' },
] };
const CONTRACT = { produces: { results: ['success', 'fail'], events: [{ type: 'setFlag', slice: 'world' }, { type: 'grant', slice: 'bag', max: 2 }, { type: 'promote', slice: 'campaign', max: 1 }] } };
const env = (events, result = 'success', extra = {}) => ({ contractVersion: 1, levelRef: 'town', seed: 1, result, events, ...extra });

export const STORE_SCENARIOS = [{
  id: 'store-campaign', store: true,
  about: 'every slice kind written, a chapter flag carried, gates on flags and completions, atomic refusals word for word',
  schema: SCHEMA,
  ops: [
    { gate: { flag: 'chapter:siege' } }, { gate: { completed: 'town' } }, { gate: null },
    { outcome: { contract: CONTRACT, envelope: env([{ type: 'setFlag', slice: 'world', key: 'chapter:siege', value: true }, { type: 'grant', slice: 'bag', item: 'key' }]) } },
    { gate: { flag: 'chapter:siege' } }, { gate: { flag: 'chapter:siege', equals: 1 } }, { gate: { flag: 'chapter:siege', equals: true } },
    { events: [{ type: 'promote', slice: 'campaign', ref: 'town' }] }, { gate: { completed: 'town' } }, { gate: { completed: 'walls', slice: 'campaign' } },
    { events: [{ type: 'consume', slice: 'bag', item: 'coin', count: 2 }, { type: 'setStat', slice: 'hero', stat: 'hp', delta: -12.5 }, { type: 'levelUp', slice: 'hero', by: 2, xp: 40 }] },
    { events: [{ type: 'consume', slice: 'bag', item: 'coin' }] },
    { events: [{ type: 'recruit', slice: 'crew', member: { id: 'bo', stats: { hp: 20 } } }, { type: 'setStat', slice: 'crew', id: 'bo', stat: 'hp', value: 0.1 }, { type: 'dismiss', slice: 'crew', id: 'ana' }] },
    { events: [{ type: 'teleport', slice: 'bag' }, { type: 'grant', slice: 'nowhere' }, { type: 'setFlag', slice: 'bag' }, { type: 'grant', slice: 'bag', item: 'x', count: 1.5 }, { type: 'setFlag', slice: 'world', key: 'k', value: { no: 1 } }, { type: 'promote', slice: 'campaign', ref: 'town', result: 'maybe' }, { type: 'levelUp', slice: 'hero', by: 0 }, { type: 'recruit', slice: 'crew', member: { id: 'bo' } }, { type: 'dismiss', slice: 'crew', id: 'zed' }, { type: 'setStat', slice: 'crew', id: 'zed', stat: 'hp', value: 1 }, { type: 'setStat', slice: 'hero', stat: 'hp' }] },
    { events: 'not a list' },
    { outcome: { contract: CONTRACT, envelope: env([{ type: 'grant', slice: 'bag', item: 'a' }, { type: 'grant', slice: 'bag', item: 'b' }, { type: 'grant', slice: 'bag', item: 'c' }]) } },
    { outcome: { contract: CONTRACT, envelope: env([{ type: 'setStat', slice: 'hero', stat: 'hp', value: 1 }], 'abort') } },
    { outcome: { contract: CONTRACT, envelope: { ...env([]), contractVersion: 2, events: 'none' } } },
    { outcome: { contract: { produces: { events: [] } }, envelope: env([], 'abort') } },
    { gate: { flag: 'k', slice: 'missing' } },
  ],
}];

export function randomStoreScenarios(n = 12, seed = 5) {
  const rand = mulberry32(seed), pick = (l) => l[Math.floor(rand() * l.length)];
  const EV = () => pick([
    { type: 'setFlag', slice: 'world', key: pick(['a', 'b', 'chapter:x']), value: pick([true, false, 1, 0.5, 'yes', undefined]) },
    { type: 'grant', slice: 'bag', item: pick(['coin', 'key']), count: pick([1, 2, 3, 0, -1, undefined]) },
    { type: 'consume', slice: 'bag', item: pick(['coin', 'key']), count: pick([1, 2]) },
    { type: 'setStat', slice: 'hero', stat: 'hp', delta: pick([-10, 0.25, 5]) },
    { type: 'levelUp', slice: 'hero', by: pick([1, 2, undefined]) },
    { type: 'promote', slice: 'campaign', ref: pick(['town', 'walls']), result: pick(['success', 'fail', undefined]) },
    { type: 'recruit', slice: 'crew', member: { id: pick(['bo', 'cy']) } },
    { type: 'dismiss', slice: 'crew', id: pick(['ana', 'bo']) },
    { type: pick(['setFlag', 'grant']), slice: pick(['world', 'bag', 'hero']) },
  ]);
  const GATE = () => pick([{ flag: pick(['a', 'b', 'chapter:x']) }, { flag: 'a', equals: pick([true, 1, 'yes']) }, { completed: pick(['town', 'walls']) }, null]);
  return Array.from({ length: n }, (_, s) => ({
    id: `store-random-${s}`, store: true, about: 'seeded', schema: SCHEMA,
    ops: Array.from({ length: 14 }, () => {
      const r = rand(), evs = Array.from({ length: 1 + Math.floor(rand() * 3) }, EV);
      if (r < 0.4) return { events: evs };
      if (r < 0.75) return { outcome: { contract: CONTRACT, envelope: env(evs, pick(['success', 'fail', 'abort'])) } };
      return { gate: GATE() };
    }),
  }));
}

export function runStoreScenario(sc) {
  const K = buildGameStoreKernel();
  let state = K.createStore(clone(sc.schema));
  return sc.ops.map((op) => {
    if ('gate' in op) return JSON.stringify(K.evalGate(sc.schema, state, clone(op.gate)));
    const r = 'events' in op ? K.applyEvents(sc.schema, state, clone(op.events)) : K.applyOutcome(sc.schema, state, clone(op.outcome.contract), clone(op.outcome.envelope));
    if (r.ok) state = r.state;
    return JSON.stringify(sortedKeys({ ok: r.ok, ...(r.ok ? {} : { errors: r.errors }), state }));
  });
}

export function corpus({ random = 24, seed = 7 } = {}) {
  return clone([...SCENARIOS, chapterTown(), chapterLive(), crawler(), statsRun(), ...randomStatsScenarios(Math.ceil(random / 4), seed), ...randomScenarios(random, seed), ...STORE_SCENARIOS, ...randomStoreScenarios(Math.ceil(random / 2), seed)]);
}

// ── the web side ─────────────────────────────────────────────────────────────────────────────────────────────────
export function runScenario(sc) {
  const B = buildBus(), st = B.createBusState(clone(sc.config), clone(sc.entities || []));
  const sources = (sc.config && sc.config.sources) || [];
  let zonePrev, out = [];
  // the page's __watchFix: with stats, each pass steps them over the ctrl queue before the watches are read
  const S = sc.stats ? buildStats() : null, cfg = sc.stats ? clone(sc.stats) : null;
  const watchFix = () => {
    for (let g = 0; g < 8; g++) {
      const s = S ? S.step(cfg, st) : [];
      if (s.length) B.processEvents(st, s);
      const w = B.watchEvents(st);
      if (!w.length && !s.length) break;
      if (w.length) B.processEvents(st, w);
    }
  };
  for (const f of sc.frames) {
    const incoming = clone(f.events || []);
    if (f.walkers) { const z = B.deriveZoneEvents(clone(f.walkers), zonePrev, sources); zonePrev = z.prev; incoming.push(...z.events); }
    const dt = f.dt || 0;
    if (incoming.length) B.processEvents(st, incoming);
    watchFix();
    const ticks = B.tickTimers(st, dt);
    if (ticks.length) B.processEvents(st, ticks);
    const timed = B.stepTime(st, dt);
    if (timed.length) B.processEvents(st, timed);
    watchFix();
    const ctrl = { ops: st._ctrlOps || [], warps: st._ctrlWarps || {} };
    st._ctrlOps = []; st._ctrlWarps = {};
    // with stats, the body changes they queued (what applyBodies hands the characters) close the snapshot
    const bodies = S ? '|' + JSON.stringify(sortedKeys(st._statBodyOps || [])) : '';
    if (S) st._statBodyOps = [];
    out.push(B.hashState(st) + '|' + JSON.stringify(sortedKeys(ctrl)) + bodies);
  }
  return out;
}

// the ctrl tail in key-sorted JSON (the same canonical form the state uses)
function sortedKeys(v) {
  if (Array.isArray(v)) return v.map(sortedKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortedKeys(v[k])]));
  return v === undefined ? null : v;
}

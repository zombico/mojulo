/**
 * THE LEVEL CORPUS — a whole level's bus and game channel, held equal in an engine whose own body walks the player.
 * A Roblox Humanoid (or any engine's character) is not the web's walk rule, so a level's transforms are not compared;
 * what is compared is what the level DOES with where its bodies stand: each frame, the positions the engine reports
 * become zone facts (bus deriveZoneEvents), the bus runs in the page's frame order (scene/channels/events.js), the
 * warps and intents it queued are handed to the engine, and the page's game channel (scene/channels/game.js) hears the
 * log's delta through the contract's `on` (an emit gathered, an end with its exit, a door left by once).
 *
 * The scenarios are REAL levels: mechanics lowered by composeMechanics (game/mechanics.js), walked in the web runtime
 * (game/level-equivalence.js levelSim and steer) through their pickups, hazards, checkpoints, doors and exits, a fall off
 * the ground's edge among them; the positions each frame starts from are recorded as the TRACK an engine replays. The
 * engine never sees the web's answer.
 *
 * One canonical string a frame: <hashState> | <ctrl: the frame's warps and intents> | <the channel: { door, envelope }>,
 * key-sorted JSON (bus-conformance.js's form); the envelope carries its kept numbers off the bus's vars.
 *
 *   LEVELS                                  the level specs (mechanics, the walk, the session's params)
 *   levelPayload(spec)                      → the spec as a resolved payload (faces, the walker, events, contract)
 *   levelScenario(spec)                     → { id, about, config, contract, params, frames }   config: the bus.json the level ships
 *   corpus({ random, seed })                the fixed levels and `random` more with their walks' stops reordered
 *   levelTrack(payload, { seconds, params }) → a scenario for a resolved level (an export's gate): its win script
 *                                           (level-equivalence.js) played in the web runtime, the bodies recorded
 *   runLevel(sc)                            → [string] a frame (the web side)
 *
 * Deterministic: a fixed step, the bus's own order, the steering a pure function of state, mulberry32 for the reorders.
 */
import { mulberry32 } from '../vegetation/grow.js';
import { buildBus } from '../worlds/event-bus.js';
import { buildStats } from '../playscape/stats/kernel.js';
import { composeMechanics } from '../game/mechanics.js';
import { levelSim, keyEvents, steer, gameChannel, faceGround, pageGroundFaces, winScript, playScript, keyEntities, frameKey, SIM_DT } from '../game/level-equivalence.js';
import { extractBus } from './engine-score.js';
import { lowerPlay } from '../playscape/ui/direction.js';

const clone = (v) => JSON.parse(JSON.stringify(v));
const quad = (x0, y0, x1, y1, z) => ({ corners: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]] });
const STORE = { slices: [{ name: 'bag', kind: 'inventory' }, { name: 'hero', kind: 'character', init: { stats: { hp: 100 } } }, { name: 'flags', kind: 'flags' }] };

// a level: its mechanics on a plain ground (a raised step where it says), walked through `walk` (the stops in order);
// `on`, `keep`, `reactions`: contract mappings, kept numbers and reactions after the mechanics' own; `initial`: the level's
// own first events
export const LEVELS = Object.freeze([
  {
    id: 'level-exit', about: 'a reach-exit through two pickups and a hazard, over a step',
    mechanics: [
      { kind: 'collect', pickups: [{ item: 'coin', at: [4, 0, 0] }, { item: 'coin', at: [8, 3, 0] }] },
      { kind: 'hazard-damage', hazards: [{ at: [6, 1.5, 0], damage: 15 }] },
      { kind: 'reach-exit', at: [12, 4, 0], radius: 1.5 },
    ],
    walk: [[4, 0], [6, 1.5], [8, 3], [12, 4]],
  },
  {
    id: 'level-death', about: 'two hazards that take the hp to nothing: fail-on-death ends it, the exit after is never heard',
    mechanics: [
      { kind: 'hazard-damage', hazards: [{ at: [3, 0, 0], damage: 60 }, { at: [3, 5, 0], damage: 60 }] },
      { kind: 'fail-on-death' },
      { kind: 'reach-exit', at: [10, 0, 0] },
    ],
    walk: [[3, 0], [3, 2.5], [3, 5], [10, 0]],
  },
  {
    id: 'level-doors', about: 'a door left by once (walked through twice), then one of two named exits; the session arrives and carries a chapter',
    mechanics: [
      { kind: 'door', id: 'cellar', at: [4, -3, 0], spawn: [4, -1, 0], heading: 1.5 },
      { kind: 'door', id: 'attic', at: [8, 0, 0] },
      { kind: 'reach-exit', at: [12, 4, 0], exit: 'north' },
      { kind: 'reach-exit', at: [12, -6, 0], exit: 'south' },
    ],
    walk: [[4, -3], [8, 0], [4, -3], [12, -6]],
    // the arrival named by the event it is ({event}); the chapter carried in from the session's flags
    on: { 'arrive:*': { emit: { type: 'came', from: '{event}' } } },
    contract: { arrive: ['east'], chapters: { slice: 'flags', carried: [{ key: 'met-smith', event: 'chapter:smith' }] } },
    params: { arrive: 'east', flags: { flags: { 'met-smith': true } } },
  },
  {
    id: 'level-keep', about: 'a survive clock with a score kept off the bus: coins scored on the way, the envelope carries the score',
    mechanics: [
      { kind: 'collect', pickups: [{ item: 'coin', at: [2, 0, 0] }, { item: 'coin', at: [2, 2, 0] }, { item: 'gem', at: [0, 2, 0] }] },
      { kind: 'score', points: [{ on: 'pickup:coin' }, { on: 'pickup:gem', by: 5 }] },
      { kind: 'survive', seconds: 4 },
    ],
    // written after the gem's own mapping and sorted before it: the first pattern AS WRITTEN maps the event
    on: { '*gem': { emit: { type: 'shiny', what: '{event}' } }, warm: { emit: { type: 'warmed' } } },
    // a kept number scaled, rounded to thousandths as the page rounds it; a scale of 0 is no scale (`k.scale || 1`); a
    // var holding a number's text kept as its number (`Number(v) || 0`)
    keep: [{ var: 'score', label: 'Thirds', scale: 1 / 3, best: 'high' }, { var: 'score', label: 'Unscaled', scale: 0, best: 'high' }, { var: 'note', label: 'Note', best: 'low' }],
    reactions: [{ on: 'pickup:gem', do: 'set', var: 'note', to: '4' }],
    // the level's initial events run before the page's channel listens: `warm` is never mapped
    initial: [{ type: 'warm' }],
    walk: [[2, 0], [2, 2], [0, 2], [0, 0]],
    hold: 6,
  },
  {
    id: 'level-laps', about: 'two laps on foot through two checkpoints, the race clock kept',
    mechanics: [{ kind: 'laps', checkpoints: [{ at: [6, 0, 0], radius: 1.5 }, { at: [0, 4, 0], radius: 1.5 }], laps: 2 }],
    walk: [[6, 0], [0, 4], [6, 0], [0, 4], [6, 0]],
  },
  {
    id: 'level-fall', about: 'a walk off the ground\'s edge into the catch box: the warp back to the spawn, then the exit',
    mechanics: [{ kind: 'reach-exit', at: [-6, 0, 0] }],
    walk: [[30, 0], [-6, 0]],
    ground: [-20, -10, 20, 10],
  },
]);

// the walker's ground: one plain, a step up where x > 5 unless the level names its own extent
function groundFaces(spec) {
  if (spec.ground) { const [x0, y0, x1, y1] = spec.ground; return [quad(x0, y0, x1, y1, 0)]; }
  return [quad(-20, -20, 5, 20, 0), quad(5, -20, 40, 20, 0.3)];
}

const EYE = 1.7, MAX_FRAMES = 1800;

// where every body stands: what an engine's world reports to the zone facts
const bodiesOf = (world) => world.entities.filter((e) => e && typeof e.id === 'string' && e.transform && Array.isArray(e.transform.pos))
  .map((e) => ({ id: e.id, transform: { pos: [...e.transform.pos] }, ...(e.gone ? { gone: true } : {}) }));

/** A level spec as a resolved payload (its faces, the walker, the lowered events and the contract). */
export function levelPayload(spec) {
  const m = composeMechanics(spec.mechanics, { storeSchema: STORE, player: 'hero', spawn: [0, 0, 0] });
  if (spec.reactions) m.events.reactions = [...(m.events.reactions || []), ...spec.reactions];
  if (spec.initial) m.events.initial = spec.initial;
  const contract = { on: { ...m.on, ...(spec.on || {}) }, audits: m.audits, ...(m.doors ? { doors: m.doors } : {}), ...(m.keep || spec.keep ? { keep: [...(m.keep || []), ...(spec.keep || [])] } : {}), ...(spec.contract || {}) };
  return {
    faces: groundFaces(spec),
    entities: [{ id: 'hero', pilotable: true, rule: { type: 'walk', speed: 4, eye: EYE }, transform: { pos: [0, 0, EYE], heading: 0 } }],
    events: m.events, game: contract,
  };
}

/** A level spec walked in the web runtime and recorded: the positions each frame starts from, its key presses. */
export function levelScenario(spec) {
  const payload = levelPayload(spec), m = { events: payload.events }, contract = payload.game;
  const sim = levelSim(payload), pilot = sim.world.byId[sim.world.pilotId];
  // the walk rule holds its height off the ground's edge; an engine's body falls: gravity laid on where no face is below
  const below = faceGround(pageGroundFaces(payload.faces || []));
  let vz = 0;
  const ch = gameChannel(contract, spec.params || {});
  let first = ch.start(sim);
  const frames = [];
  let k = 0, still = 0, best = Infinity, held = 0;
  for (let i = 0; i < MAX_FRAMES; i++) {
    const at = spec.walk[k], t = pilot.transform.pos;
    const inp = {};
    if (at) {
      const d = Math.hypot(at[0] - t[0], at[1] - t[1]);
      if (d < 0.8) { k++; best = Infinity; still = 0; }
      else {
        Object.assign(inp, steer(pilot, at));
        if (d < best - 0.05) { best = d; still = 0; } else if (++still > 90) { k++; best = Infinity; still = 0; }   // a stop that cannot be reached is passed
      }
    } else if (++held > (spec.hold || 1) / SIM_DT) break;
    for (const a of ['forward', 'strafe', 'turn', 'lookDX', 'lookDY', 'jump', 'jumpHeld', 'boost', 'fire', 'kneel']) sim.input[a] = 0;
    Object.assign(sim.input, inp);
    // where every body stands as the frame begins: what an engine's world reports to the zone facts
    const walkers = bodiesOf(sim.world);
    // the frame's presses (none: these levels are walked); the session's start events are the channel's, each side's own
    const presses = keyEvents(payload, []);
    frames.push({ walkers, ...(presses.length ? { events: clone(presses) } : {}), dt: SIM_DT });
    const n0 = sim.bus.log.length;
    sim.frame(SIM_DT, [...first, ...presses]);
    first = [];
    const p = pilot.transform.pos;
    if (below([p[0], p[1], p[2] - EYE]) == null) { vz -= 9.8 * SIM_DT; p[2] += vz * SIM_DT; } else vz = 0;
    ch.hear(sim.bus.log, n0);
    if (ch.envelope(sim.bus.vars) && !at) break;
  }
  return { id: spec.id, about: spec.about, config: clone(m.events), contract: clone(contract), params: clone(spec.params || {}), frames };
}

/** A resolved level's track: its win script steered toward the contract's audits, replayed, and each frame's starting
 * bodies recorded. The scenario's config and contract are the payload's own (the web's truth); an export's gate hands
 * the engine the same frames with the pack's bus.json and contract.json instead. */
export function levelTrack(payload, { id = 'level', seconds = 120, params = {} } = {}) {
  const win = winScript(payload, { seconds });
  const starts = [bodiesOf(levelSim(payload).world)];
  playScript(payload, win.frames, { params, onFrame: (sim) => starts.push(bodiesOf(sim.world)) });
  const frames = win.frames.map((f, i) => {
    const events = [...keyEvents(payload, f.keys), ...(f.events || [])];
    return { walkers: starts[i], ...(events.length ? { events: clone(events) } : {}), dt: SIM_DT };
  });
  return { id, about: `the level's win script (${win.waypoints} waypoints, ${win.outcome ?? 'no outcome'})`, config: clone(payload.events || {}), contract: clone(payload.game || {}), params: clone(params), frames };
}

export function corpus({ random = 6, seed = 7 } = {}) {
  const out = LEVELS.map(levelScenario);
  const rnd = mulberry32(seed);
  for (let n = 0; n < random; n++) {
    const spec = LEVELS[Math.floor(rnd() * LEVELS.length)];
    const walk = spec.walk.slice();
    for (let i = walk.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [walk[i], walk[j]] = [walk[j], walk[i]]; }
    out.push(levelScenario({ ...spec, id: `${spec.id}-r${n}`, about: `${spec.about} (its stops reordered)`, walk }));
  }
  return out;
}

// ── the web side ─────────────────────────────────────────────────────────────────────────────────────────────────
function sortedKeys(v) {
  if (Array.isArray(v)) return v.map(sortedKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortedKeys(v[k])]));
  return v === undefined ? null : v;
}

export function runLevel(sc) {
  const B = buildBus(), st = B.createBusState(clone(sc.config), clone(sc.config.entities || []));
  const sources = (sc.config && sc.config.sources) || [];
  const S = sc.config && sc.config.stats ? buildStats() : null, cfg = S ? clone(sc.config.stats) : null;
  const watchFix = () => {
    for (let g = 0; g < 8; g++) {
      const s = S ? S.step(cfg, st) : [];
      if (s.length) B.processEvents(st, s);
      const w = B.watchEvents(st);
      if (!w.length && !s.length) break;
      if (w.length) B.processEvents(st, w);
    }
  };
  if (sc.config && sc.config.initial) B.processEvents(st, clone(sc.config.initial));
  // the channel's start reads the world only to stand the pilot at its entry door (the engine's to do): none here
  const ch = gameChannel(sc.contract, sc.params);
  let first = ch.start({ world: { byId: {}, pilotId: null } });
  let zonePrev;
  const out = [];
  for (const f of sc.frames) {
    const n0 = st.log.length;
    const incoming = [...first, ...clone(f.events || [])];
    first = [];
    const z = B.deriveZoneEvents(clone(f.walkers || []), zonePrev, sources); zonePrev = z.prev; incoming.push(...z.events);
    if (incoming.length) B.processEvents(st, incoming);
    watchFix();
    const ticks = B.tickTimers(st, f.dt || 0);
    if (ticks.length) B.processEvents(st, ticks);
    const timed = B.stepTime(st, f.dt || 0);
    if (timed.length) B.processEvents(st, timed);
    watchFix();
    const ctrl = { ops: st._ctrlOps || [], warps: st._ctrlWarps || {} };
    st._ctrlOps = []; st._ctrlWarps = {};
    ch.hear(st.log, n0);
    out.push(`${B.hashState(st)}|${JSON.stringify(sortedKeys(ctrl))}|${JSON.stringify(sortedKeys({ door: ch.door, envelope: ch.envelope(st.vars) }))}`);
  }
  return out;
}

// ── THE LEVELCAST CORPUS: a whole level with its cast, its fight and its minds, the pilot fed ─────────────────────────
// A Roblox Humanoid is the pilot, so its pose is INPUT: the web plays a real composed level (level-equivalence.js
// levelSim, through playScript over a steered script) and records, each frame, where its pilot stands after the world's
// step; the engine is fed that pose and runs everything else itself, from the bus.json the pack ships (extractBus):
// the zone facts over every body, the cast's facts, the bus, its ops to the cast, the scenes, the fight and the minds.
// One canonical string a frame: the web's frameKey without the pilot (the bus's hash | each other ruled entity's
// quantized pose, its feet), so the cast's walks, the minds' steps and every fall are compared to a quantum.
//
//   CAST_LEVELS                     the levels: a stealth walk past seeing guards, a melee fight to the last foe, a
//                                   level whose cues and scene move the cast (walk, spawn, vanish, a line said)
//   castRun(id)                     → { payload, frames, keys, poses, outcome, at }   the web's run (cached)
//   castScenario(spec | payload, { id, frames? }) → { id, about, bus, contract, params, ground, ids, feet, frames }
//                                   frames: [{ pilot: { id, pos, heading, pitch, grounded }, input, events?, dt }]
//   castCorpus()                    every level's scenario
//   castTrack(payload, { id, seconds, params }) → { scenario, keys, outcome }   a resolved level's win script (an export's gate)
//   runLevelCast(sc)                → [string] a frame (the web side)
const CAST_QUAD = { corners: [[-30, -30, 0], [30, -30, 0], [30, 30, 0], [-30, 30, 0]] };
const mergeEv = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b || {})) o[k] = Array.isArray(v) ? [...(o[k] || []), ...v] : v && typeof v === 'object' ? { ...(o[k] || {}), ...v } : v; return o; };
const EGG = { a: 0.35, c: 0.9, cz: 0.9 };
// a guard that only watches: nothing to hit, so its level ships minds and no fight (bus.json's `minds`, no `combat`)
const sentinel = (id, pos, heading, rule) => ({ id, rule: { type: 'ai', speed: 1.5, turn: 3, dodge: false, eye: 0, collideRadius: 0.3, collideHeight: 1.7, ...rule }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] }, transform: { pos, heading, pitch: 0 } });

export const CAST_LEVELS = Object.freeze([
  {
    id: 'stealth-guards', about: 'a walk past a wandering sentry and a post guard that scans, watching only (minds and no fight), each seeing by its cone; three sightings and it fails, the exit first and it is won',
    build() {
      const entities = [
        { id: 'hero', pilotable: true, rule: { type: 'walk', speed: 3, eye: 1.7 }, transform: { pos: [0, 0, 1.7], heading: 0 } },
        sentinel('guard-a', [6, 4, 0], -Math.PI / 2, { mind: { motivation: 'wander', perception: 'sight' }, sightRange: 9, sightCone: 0.9, wanderRadius: 3, wanderPause: 1 }),
        sentinel('guard-b', [12, -5, 0.3], Math.PI / 2, { mind: { motivation: 'guard', perception: 'memory' }, sightRange: 8, sightCone: 0.7, guardRadius: 6, standoff: 2, scan: 0.9, scanPeriod: 3 }),
      ];
      const m = composeMechanics([{ kind: 'unseen', alarms: 3, who: 'guard-*' }, { kind: 'reach-exit', at: [18, 0, 0] }], { player: 'hero', spawn: [0, 0, 0] });
      // the post stands on a raised slab: the guard walks the land, not the plain
      return { faces: [CAST_QUAD, quad(8, -9, 16, -1, 0.3)], entities, events: m.events, game: { on: m.on, audits: m.audits } };
    },
    drive: { points: [[5, 0], [11, 1], [18, 0]], seconds: 30 },
  },
  {
    id: 'melee-fight', about: 'a platform hero with a blade against two hunters that close on it, hp-pool and defeat-all on the bus, the poised one staggered and floored by the killing blow',
    build() {
      // the hunters close and press without a blade of their own: blades that meet clash, a set piece no kernel ports
      const hunter = (id, pos, extra = {}) => ({ id, team: 'foes', rule: { type: 'ai', mind: { motivation: 'hunt', perception: 'sight' }, speed: 1.6, turn: 3, dodge: false, eye: 0, collideRadius: 0.3, collideHeight: 1.7, standoff: 1, sightRange: 20, sightCone: 1.6 }, body: { type: 'mesh', hittable: true, hp: 3, egg: { ...EGG }, ...extra }, transform: { pos, heading: Math.PI, pitch: 0 } });
      const entities = [
        { id: 'hero', pilotable: true, team: 'heroes', rule: { type: 'platform', speed: 3.5, eye: 0, collideRadius: 0.3, collideHeight: 1.7, strike: 'melee', strikeReach: 1.7, strikeDamage: 1, strikeDur: 0.4, strikeCooldown: 0.15 }, body: { type: 'mesh', hittable: true, hp: 40, egg: { ...EGG } }, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 } },
        hunter('foe-1', [6, 1.5, 0], { poise: 2, staggerDur: 0.3 }),
        hunter('foe-2', [-3, 7, 0]),
      ];
      const m = composeMechanics([{ kind: 'hp-pool', entities: [{ id: 'foe-1', hp: 3 }, { id: 'foe-2', hp: 3 }] }, { kind: 'defeat-all' }], { player: 'hero', spawn: [0, 0, 0] });
      // the ring the first foe falls in watches the foes (a felled body still stands in a zone; one sent away does not),
      // and a scene says a line over the first fall while the pilot's swings are held
      const play = { scenes: [{ id: 'one-down', when: { on: 'enemy:down' }, beats: [{ line: { who: 'hero', say: 'One down.' } }, { wait: 0.3 }] }] };
      const { menus: _m, style: _s, register: _r, looks: _l, hud: _h, ...lowered } = lowerPlay({ entities, play }, { player: 'hero' });
      const events = mergeEv(mergeEv(m.events, lowered), {
        sources: [{ type: 'zone', zone: 'ring', at: [4.5, 1.2, 0], radius: 2.5, planar: true, watch: 'foe-*' }],
        reactions: [{ on: 'enter', match: { zone: 'ring' }, do: 'inc', var: 'in-ring', by: 1 }, { on: 'exit', match: { zone: 'ring' }, do: 'inc', var: 'in-ring', by: -1 }],
      });
      return { faces: [CAST_QUAD], entities, events, game: { on: m.on, audits: m.audits } };
    },
    drive: { foes: ['foe-1', 'foe-2'], reach: 1.3, scene: 10, fireInScene: true, seconds: 40 },
  },
  {
    id: 'ambush', about: 'a bladeless platform pilot bitten on its way to the exit by two hunters, one listed before it and one after (the first sees where it stood, the second where it stands), each bite a hit on the bus',
    build() {
      const bite = { name: 'bite', strike: 'melee', strikeReach: 1.3, strikeDamage: 1, strikeDur: 0.5, strikeCooldown: 0.8 };
      const biter = (id, pos, heading) => ({ id, team: 'foes', rule: { type: 'ai', mind: { motivation: 'hunt', perception: 'sight' }, speed: 3, turn: 5, dodge: false, eye: 0, collideRadius: 0.3, collideHeight: 1.7, standoff: 1, meleeSeek: true, sightRange: 14, sightCone: 1.4, loadout: [bite] }, body: { type: 'mesh', hittable: true, hp: 5, egg: { ...EGG } }, transform: { pos, heading, pitch: 0 } });
      const entities = [
        biter('biter-a', [5, 2.5, 0], -Math.PI / 2),
        { id: 'hero', pilotable: true, team: 'heroes', rule: { type: 'platform', speed: 1.6, eye: 0, collideRadius: 0.3, collideHeight: 1.7 }, body: { type: 'mesh', hittable: true, hp: 30, egg: { ...EGG } }, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 } },
        biter('biter-b', [8, -2.5, 0], Math.PI / 2),
      ];
      const m = composeMechanics([{ kind: 'reach-exit', at: [16, 0, 0] }], { player: 'hero', spawn: [0, 0, 0] });
      m.events.reactions = [...(m.events.reactions || []), { on: 'hit:hero', do: 'inc', var: 'bitten', by: 1 }];
      return { faces: [CAST_QUAD], entities, events: m.events, game: { on: m.on, audits: m.audits } };
    },
    drive: { points: [[16, 0]], seconds: 30 },
  },
  {
    id: 'cast-cues', about: 'cues and a scene move the cast: a porter told to walk (its arrival heard, then sent away), a ghost woken and sent away again, a line said while the pilot is held',
    build() {
      const entities = [
        { id: 'hero', pilotable: true, rule: { type: 'walk', speed: 3, eye: 1.7 }, transform: { pos: [0, 0, 1.7], heading: 0 } },
        { id: 'porter', rule: { type: 'static', speed: 2 }, transform: { pos: [3, 4, 0], heading: 0 }, body: { type: 'mesh', shape: 'box', size: [0.5, 0.5, 1.7] } },
        { id: 'ghost', dormant: true, rule: { type: 'static' }, transform: { pos: [0, -6, 0], heading: 0 }, body: { type: 'mesh', shape: 'box', size: [0.5, 0.5, 1.7] } },
      ];
      const play = {
        spots: [{ id: 'gate', at: [9, 5] }, { id: 'yard', at: [5, 8] }],
        cues: [
          { id: 'call', when: { enter: { at: [4, 0], r: 1.2 } }, then: [{ walk: { who: 'porter', to: ['yard', 'gate'] } }, { spawn: { who: 'ghost', at: [9, -3] } }], once: true },
          { id: 'bye', when: { arrive: { who: 'porter', at: 'gate' } }, then: { vanish: 'porter' } },
          { id: 'boo', when: { enter: { at: [9, -1.5], r: 1.5 } }, then: { vanish: 'ghost' }, once: true },
          // the gate watches the porter: it leaves the gate's zone as it is sent away there
          { id: 'at-gate', when: { enter: { at: [9, 5], r: 1, who: 'porter' } }, until: { leave: { at: [9, 5], r: 1, who: 'porter' } }, then: { set: 'porter-at-gate', to: 1 } },
        ],
        scenes: [{ id: 'hello', when: { enter: { at: [2, 0], r: 1 } }, names: { porter: 'Porter' }, beats: [{ line: { who: 'porter', say: 'Mind the gate.' } }, { wait: 0.4 }, { line: { who: 'porter', say: 'Off you go.' } }] }],
      };
      const m = composeMechanics([{ kind: 'reach-exit', at: [12, 0, 0] }], { player: 'hero', spawn: [0, 0, 0] });
      const lowered = lowerPlay({ entities, play }, { player: 'hero' });
      const { menus: _m, style: _s, register: _r, looks: _l, ...bus } = lowered;
      const events = mergeEv(m.events, bus);
      return { faces: [CAST_QUAD], entities, events, game: { on: m.on, audits: m.audits } };
    },
    drive: { points: [[4, 0], [9, -1.5], [3, -6], [12, 0]], scene: 12, seconds: 40 },
  },
]);

// THE DRIVER: the pilot's held input, steered in the web runtime toward the drive's points in order (or the nearest
// standing foe, swinging in reach on alternate frames), a scene's line advanced every `scene` frames; until the level's
// outcome, or its seconds. Input only: the replay (playScript) is the truth.
function driveScript(payload, drive) {
  const sim = levelSim(payload), pilot = sim.world.byId[sim.world.pilotId], contract = payload.game || {};
  const AX = ['forward', 'strafe', 'turn', 'lookDX', 'lookDY', 'jump', 'jumpHeld', 'boost', 'fire', 'kneel'];
  const r4 = (v) => Math.round(v * 1e4) / 1e4;
  const frames = [];
  let next = 0, done = false;
  const n = Math.round((drive.seconds || 30) / SIM_DT);
  for (let i = 0; i < n && !done; i++) {
    let inp = {};
    const t = pilot.transform.pos;
    if (drive.points && next < drive.points.length) {
      const p = drive.points[next];
      if (Math.hypot(p[0] - t[0], p[1] - t[1]) < 0.8) next++;
      else inp = steer(pilot, p);
    } else if (drive.foes) {
      const up = drive.foes.map((id) => sim.world.byId[id]).filter((e) => e && !e.downed && !e.gone && (sim.bus.vars[`__hp_${e.id}`] ?? 1) > 0);
      up.sort((a, b) => Math.hypot(a.transform.pos[0] - t[0], a.transform.pos[1] - t[1]) - Math.hypot(b.transform.pos[0] - t[0], b.transform.pos[1] - t[1]));
      const f = up[0];
      if (f) {
        const d = Math.hypot(f.transform.pos[0] - t[0], f.transform.pos[1] - t[1]);
        inp = steer(pilot, f.transform.pos);
        // a swing only into a foe not mid-bite: blades that meet clash, a set piece the kernels leave to the web
        if (d < (drive.reach || 1.3)) { inp.forward = 0; if (i % 2 === 0 && f.swingT == null) inp.fire = 1; }
      }
    }
    const rec = Object.fromEntries(AX.filter((k) => inp[k]).map((k) => [k, r4(inp[k])]).filter(([, v]) => v));
    if (drive.scene && sim.sceneView && sim.sceneView.on && i % drive.scene === 0) rec.scene = { next: true };
    // swings pressed while a scene holds the pilot: the world must not hear them
    if (drive.fireInScene && sim.sceneView && sim.sceneView.on && i % 2 === 0) rec.fire = 1;
    for (const k of AX) sim.input[k] = rec[k] || 0;
    if (rec.scene) sim.scene(rec.scene);
    const n0 = sim.bus.log.length;
    sim.frame(SIM_DT, []);
    frames.push(rec);
    for (let j = n0; j < sim.bus.log.length; j++) { const pat = sim.bus.log[j] && sim.bus.log[j].type; const on = pat && Object.keys(contract.on || {}).find((k) => k === pat); if (on && contract.on[on].end) done = true; }
  }
  // a second's tail after the outcome: the falls and the walks finish where the engine must also leave them
  for (let k = 0; done && k < 30; k++) frames.push({});
  return frames;
}

// a payload played by its frames on the web: the pilot's pose after each frame (what an engine is fed) and the key
// without it (what the engine must print); `guard`: what no kernel ports never happens (a corpus level's promise)
function castPlay(payload, frames, { id = 'level', guard = false, params = null } = {}) {
  const ids = keyEntities(payload), rest = ids.slice(1), keys = [], poses = [];
  const run = playScript(payload, frames, {
    ...(params ? { params } : {}),
    onFrame: (sim, i) => {
      // what the engines leave to the web never happens in a corpus level (combat.luau, combat.gd: the clash)
      if (guard) for (const e of sim.world.entities) if (e.clashT != null) throw new Error(`levelcast ${id}: a clash at frame ${i} (${e.id}), which no kernel ports`);
      const P = sim.world.byId[sim.world.pilotId], t = P.transform;
      poses.push({ id: P.id, pos: [...t.pos], heading: t.heading || 0, pitch: t.pitch || 0, grounded: P.grounded !== false });
      keys.push(frameKey(sim, rest));
    },
  });
  return { ids, keys, poses, outcome: run.outcome, at: run.at };
}

const castById = new Map();
export function castRun(id) {
  if (castById.has(id)) return castById.get(id);
  const spec = CAST_LEVELS.find((l) => l.id === id);
  if (!spec) throw new Error(`levelcast: no level '${id}'`);
  const payload = spec.build(), frames = driveScript(payload, spec.drive);
  const out = { spec, payload, frames, ...castPlay(payload, frames, { id, guard: true }) };
  castById.set(id, out);
  return out;
}

// the ground's faces as triangles (a fan per face, as faceGround reads them), the page's (pageGroundFaces)
const trisOf = (faces) => faces.flatMap((f) => (f.corners || []).slice(1, -1).map((_, i) => [f.corners[0], f.corners[i + 1], f.corners[i + 2]]));

// what an engine is handed for a played payload: the pilot's pose and the input each frame, the bodies its key names
// and their feet, the land its minds stand on
function castFrames(payload, run, frames, { id, about, params = {} }) {
  const rest = run.ids.slice(1);
  const feet = Object.fromEntries(rest.map((k) => [k, ((e) => (e && e.rule && Number.isFinite(e.rule.eye) ? e.rule.eye : 0))(payload.entities.find((e) => e.id === k))]));
  return {
    id, about, bus: clone(extractBus(payload)), contract: clone(payload.game || {}), params: clone(params), ground: clone(trisOf(pageGroundFaces(payload.faces || []))), ids: rest, feet,
    frames: frames.map((f, i) => ({ pilot: run.poses[i], input: clone(f || {}), ...(f && (f.keys || f.events) ? { events: clone([...keyEvents(payload, f.keys), ...(f.events || [])]) } : {}), dt: SIM_DT })),
  };
}

export function castScenario(id) {
  const r = castRun(id);
  return castFrames(r.payload, r, r.frames, { id, about: r.spec.about });
}

/** A resolved level with a cast, as an export's gate plays it: its win script (level-equivalence.js) replayed on the
 * web, the pilot's poses recorded; → { scenario, keys } (the engine reads the pack's own bus.json in its place). */
export function castTrack(payload, { id = 'level', seconds = 120, params = {} } = {}) {
  const win = winScript(payload, { seconds });
  const run = castPlay(payload, win.frames, { id, params });
  return { scenario: castFrames(payload, run, win.frames, { id, about: `the level's win script (${win.waypoints} waypoints, ${win.outcome ?? 'no outcome'})`, params }), keys: run.keys, outcome: run.outcome };
}

export const castCorpus = () => CAST_LEVELS.map((l) => castScenario(l.id));
export const runLevelCast = (sc) => castRun(sc.id).keys;

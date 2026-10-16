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
import { levelSim, keyEvents, steer, gameChannel, faceGround, winScript, playScript, SIM_DT } from '../game/level-equivalence.js';

const clone = (v) => JSON.parse(JSON.stringify(v));
const quad = (x0, y0, x1, y1, z) => ({ corners: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]] });
const STORE = { slices: [{ name: 'bag', kind: 'inventory' }, { name: 'hero', kind: 'character', init: { stats: { hp: 100 } } }, { name: 'flags', kind: 'flags' }] };

// a level: its mechanics on a plain ground (a raised step where it says), walked through `walk` (the stops in order);
// `on`, `keep`: contract mappings and kept numbers after the mechanics' own
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
    on: { '*gem': { emit: { type: 'shiny', what: '{event}' } } },
    // a kept number scaled, rounded to thousandths as the page rounds it
    keep: [{ var: 'score', label: 'Thirds', scale: 1 / 3, best: 'high' }],
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
  const below = faceGround(payload.faces);
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

/**
 * OBJECTIVES (a terminal): a level's tasks, done in order. A mission is sections one after another, each with one thing
 * to do in it; this is that list on the bus. A task begins when its section is walked into (the first as the level
 * starts), is met by what its kind names, and being met opens the way on (its seal lifts) and hands over to the next;
 * the last one met is the level won.
 *
 *   take     walk over a place (`at`): what lies there is the `supplies` mechanic's, laid at the same place
 *   reach    walk to a place (`at`)
 *   clear    every one of its `foes` down (the cast's `down`); they stand dormant and are woken as it begins
 *   man      a clear with a mounted gun to do it with (`gun`, the pilot's swap takes it): met as a clear is
 *   hold     still there when `seconds` have run, while its `waves` are woken one every `every` seconds (the first
 *            after a breath); what still stands when the clock runs out is left standing
 *   act      do a thing the page says was done (`on`: the bus event it raises, e.g. the guide's `lesson:<fact>` as a
 *            lesson's control is done): met when it comes while the task is in hand
 *   scan     stay inside a ring (`at`, `radius`) for `seconds` while a readout fills: its clock runs only inside the
 *            ring, keeping what it had (`total`) when the pilot steps out; met, what it found (`found`) is said as a
 *            banner and as an event (`objective:found { task, text }`) a script can answer
 *
 * A flight's tasks (a lesson, a stage, a sortie: gameworld/flight-goal.js lays them), each in three dimensions:
 *   gates    fly through its `gates` ([{ at, radius }]) in order; each passed is said (`objective:gate`)
 *   land     set down on one of its `pads` ([{ at, half }]: boxes), its wheels touching while inside one and no harder
 *            than the gear takes (the page's `touchdown`, `hard: 0`); a touchdown elsewhere does not meet it
 *   band     hold the pilot inside its `band` (any of alt, agl, speed, climb, bank, heading: [min, max], either null for
 *            open; the units the HUD shows: m, knots, m/s, degrees) for `seconds`: the clock runs only while every
 *            gauge holds, and starts again from nothing when one is left (`total: true`: it adds up instead); the
 *            seconds it is left once it has been reached are its slip (objectiveNames' `slip`, kept for a grade)
 *   protect  keep its `who` (ids) up: one of them down while it is in hand, or before it, fails the level
 *            (`objectives:failed`); met when `seconds` have run, or when the first of them arrives at `arrive`
 *            ({ at, radius? }: an escort's end)
 *
 * Lowered onto the bus the other mechanics use (no runtime of its own), as the wave gauntlet is: a var for the task in
 * hand, a zone a section, a counter of downs a clear, a clock a hold, a guarded hand-over. A way on that is still
 * sealed puts a body that walks into it back (`back`), as the gauntlet's does.
 *
 * Params:
 *   { id?: 'obj', quiet?, tasks: [{ id, kind, text, zone?: { at, half }, at?, radius?, planar?, foes?, gun?, seconds?, every?, waves?,
 *                           door?: { at, back, radius? }, gates?, pads?, band?, total?, who?, arrive?, pause?, ops? }] }
 *   pause  seconds after the one before is met that it begins (a beat let breathe: what was found said, a line spoken,
 *          before the next is set); a pause on the first, after the level starts. Not met before it has begun: a place
 *          reached in the pause is met as it begins
 *   ops    the cast's ops issued as it begins, once ([{ op, who, … }], worlds/controllable/cast.js: a group that comes with
 *          it and is not its to down, `spawn`; an ally let go of its post): what its begin sets moving besides its own
 *   retry  true | { after?, say? }: the player down while a task is in hand (RETRY): the screen faded, the player stood
 *          up whole where it fell after `after` s and the task in hand begun again (a clear's foes up and whole, its
 *          `again` ops: [{ op, who, … }], a foe put back where it stood), the level going on; with it, a fall is no loss
 *   quiet  no count of the tasks met on the HUD (a level whose own HUD says what it needs): the task in hand's words, and
 *          a task's own clock while it is in hand, are all it shows
 *   zone   the section's box (its centre and half-extents; or { at, radius }, a round one, for a section in an open
 *          place): walking into it begins the task (none: it begins as the one
 *          before is met; the first begins as the level starts)
 *   door   the way on, sealed until the task is met
 *   planar false: a take or a reach met at its height (a place on a storey: never from the floor over or under it)
 *
 *   objectiveNames(id)      → { task (the var: the index in hand, the count when all are met), begun(k) (1 once the task
 *                             k has begun), seal(k), left(k), downs(k),
 *                             felled, time, slip, sink } the names it gives its things (felled: every foe of its downed;
 *                             time: seconds; slip: seconds out of a band in hand; sink: the landing's sink, m/s; say:
 *                             the words of the task in hand)
 *   objectivesOf(mechanics) → the mechanic of a level's list, or null
 *   lowerObjectives(p, ctx) → { world, on, emits }   (game/mechanics.js registers it)
 *
 * It keeps for the level's result (the contract's `keep`): the tasks met, the foes downed, the seconds taken.
 * Events it says: objective:begin { n, of, task, text }, objective:done { n, of, task }, objective:sealed { task },
 * objective:gate { n, of, task }, wave { n, of }, objectives:done (the win), objectives:failed { task } (the loss: a
 * protected one down).
 * The audit: none can fight, so it is not auto-auditable; its proof is on the bus with each fall given
 * (gameworld/mission-proof.js), and a player's on the runtime.
 *
 * Pure, no dice.
 */
import { SCREEN_VARS } from '../playscape/ui/cues.js';

const ID = /^[a-z][a-z0-9-]{0,31}$/;
/** A RETRY: the player down while a task is in hand, the screen faded for `after` s, then the player stood up whole
 *  where it fell and the task in hand begun again (its foes up and whole, its own `again` ops), the level going on from
 *  there; `say` shown as it comes back. */
export const RETRY = Object.freeze({ after: 2, back: 0.5, say: 'Back in the fight' });
const isVec = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
export const OBJECTIVE_KINDS = Object.freeze(['take', 'reach', 'clear', 'man', 'hold', 'gates', 'land', 'band', 'protect', 'scan', 'act']);
/** The facts a `band` holds (worlds/event-bus.js gauges), in the units the flight HUD shows. */
export const BAND_FACTS = Object.freeze(['alt', 'agl', 'speed', 'climb', 'bank', 'heading']);
const isRange = (v) => Array.isArray(v) && v.length === 2 && v.every((x) => x === null || Number.isFinite(x)) && !(v[0] === null && v[1] === null);

export const objectiveNames = (id) => ({ task: `__${id}`, begun: (k) => `__${id}_in${k}`, retries: `__${id}_retries`, seal: (k) => `${id}-seal-${k}`, left: (k) => `__${id}_left${k}`, downs: (k) => `__${id}_d${k}`, felled: `__${id}_downs`, time: `__${id}_time`, slip: `__${id}_slip`, sink: `__${id}_sink`, say: `__${id}_say` });
export const objectivesOf = (mechanics) => (Array.isArray(mechanics) ? mechanics.find((m) => m && m.kind === 'objectives') ?? null : null);

export function lowerObjectives(p, ctx) {
  const where = `objectives[${ctx.i}]`, fail = (m) => { throw new Error(`${where}: ${m}`); };
  const id = p.id === undefined ? 'obj' : p.id;
  if (typeof id !== 'string' || !ID.test(id)) fail('id is the list\'s name, lower-case');
  const T = p.tasks;
  if (!Array.isArray(T) || !T.length) fail(`needs tasks: [{ id, kind: ${OBJECTIVE_KINDS.join(' | ')}, text, … }], at least one`);
  const seen = new Set(), woken = new Set();
  T.forEach((t, k) => {
    const at = `tasks[${k}]`;
    if (!t || typeof t !== 'object') fail(`${at} is { id, kind, text, … }`);
    if (typeof t.id !== 'string' || !ID.test(t.id)) fail(`${at}.id is its name, lower-case`);
    if (seen.has(t.id)) fail(`${at}: '${t.id}' named twice`);
    seen.add(t.id);
    if (!OBJECTIVE_KINDS.includes(t.kind)) fail(`${at}.kind is one of ${OBJECTIVE_KINDS.join(', ')}`);
    if (typeof t.text !== 'string' || !t.text) fail(`${at}.text is what the player is told to do`);
    if ((t.kind === 'take' || t.kind === 'reach') && !isVec(t.at)) fail(`${at}.at is [x, y, z]: where a ${t.kind} is met`);
    if (t.kind === 'scan') {
      if (!isVec(t.at)) fail(`${at}.at is [x, y, z]: the ring's middle`);
      if (!(Number.isFinite(t.radius) && t.radius > 0)) fail(`${at}.radius is the ring's, metres`);
      if (!(Number.isFinite(t.seconds) && t.seconds > 0)) fail(`${at}.seconds is how long the scan takes inside the ring`);
      if (t.found !== undefined && !(typeof t.found === 'string' && t.found)) fail(`${at}.found is what the scan found, in words`);
    }
    if (t.kind === 'clear' || t.kind === 'man') { if (!Array.isArray(t.foes) || !t.foes.length || t.foes.some((f) => typeof f !== 'string' || !f)) fail(`${at}.foes is the ids to be downed, at least one`); }
    if (t.kind === 'man' && !(typeof t.gun === 'string' && t.gun)) fail(`${at}.gun is the id of the gun it is done with`);
    if (t.kind === 'hold') {
      if (!(Number.isFinite(t.seconds) && t.seconds > 0)) fail(`${at}.seconds is how long it is held, above 0`);
      if (t.every !== undefined && !(Number.isFinite(t.every) && t.every > 0)) fail(`${at}.every is the seconds between its waves, above 0`);
      if (t.waves !== undefined && (!Array.isArray(t.waves) || t.waves.some((w) => !Array.isArray(w) || !w.length || w.some((f) => typeof f !== 'string' || !f)))) fail(`${at}.waves is [[<foe id>, …], …]`);
    }
    if (t.kind === 'gates' && !(Array.isArray(t.gates) && t.gates.length && t.gates.every((g) => g && isVec(g.at) && Number.isFinite(g.radius) && g.radius > 0))) fail(`${at}.gates is [{ at: [x, y, z], radius }], at least one, in the order they are flown`);
    if (t.kind === 'land' && !(Array.isArray(t.pads) && t.pads.length && t.pads.every((q) => q && isVec(q.at) && isVec(q.half)))) fail(`${at}.pads is [{ at: [x, y, z], half: [hx, hy, hz] }]: the boxes a craft may set down in`);
    if (t.kind === 'band') {
      const B = t.band, keys = B && typeof B === 'object' ? Object.keys(B) : [];
      if (!keys.length) fail(`${at}.band is { ${BAND_FACTS.join('?, ')}? }: each [min, max] (null for open), at least one`);
      for (const f of keys) {
        if (!BAND_FACTS.includes(f)) fail(`${at}.band.${f} is not a gauge (${BAND_FACTS.join(', ')})`);
        if (!isRange(B[f])) fail(`${at}.band.${f} is [min, max], each a number or null (open), not both null`);
        if (f !== 'heading' && B[f][0] !== null && B[f][1] !== null && B[f][0] > B[f][1]) fail(`${at}.band.${f}: its min is above its max (only a heading wraps)`);
      }
      if (!(Number.isFinite(t.seconds) && t.seconds > 0)) fail(`${at}.seconds is how long the band is held, above 0`);
      if (t.total !== undefined && typeof t.total !== 'boolean') fail(`${at}.total is true (the seconds add up) or false (held in one go: the default)`);
    }
    if (t.kind === 'act' && !(typeof t.on === 'string' && /^[a-z][a-z0-9:_-]{0,63}$/i.test(t.on))) fail(`${at}.on is the bus event that meets it (the page's: a lesson done is lesson:<fact>)`);
    if (t.kind === 'protect') {
      if (!Array.isArray(t.who) || !t.who.length || t.who.some((w) => typeof w !== 'string' || !w)) fail(`${at}.who is the ids kept up, at least one`);
      const by = (Number.isFinite(t.seconds) && t.seconds > 0 ? 1 : 0) + (t.arrive !== undefined ? 1 : 0);
      if (by !== 1) fail(`${at}: a protect is met by seconds (kept up that long) or by arrive ({ at, radius? }: the first of them gets there), one of them`);
      if (t.arrive !== undefined && !(t.arrive && isVec(t.arrive.at))) fail(`${at}.arrive is { at: [x, y, z], radius? }`);
    }
    for (const f of [...(t.foes ?? []), ...(t.waves ?? []).flat()]) { if (woken.has(f)) fail(`${at}: '${f}' is woken twice (a foe is woken once: name another)`); woken.add(f); }
    if (t.zone !== undefined && !(t.zone && isVec(t.zone.at) && (isVec(t.zone.half) || (Number.isFinite(t.zone.radius) && t.zone.radius > 0)))) fail(`${at}.zone is { at: [x, y, z], half: [hx, hy, hz] } (the section's box) or { at, radius } (a round one)`);
    if (t.door !== undefined && !(t.door && isVec(t.door.at) && isVec(t.door.back))) fail(`${at}.door is { at, back }: the way on and where a body is put back while it is sealed`);
    if (t.pause !== undefined && !(Number.isFinite(t.pause) && t.pause > 0 && t.pause <= 30)) fail(`${at}.pause is the seconds after the one before is met that it begins, up to 30`);
    if (t.pause !== undefined && t.zone !== undefined) fail(`${at}: a task begun by its section (zone) takes no pause`);
    if (t.again !== undefined && !(Array.isArray(t.again) && t.again.every((o) => o && typeof o === 'object' && typeof o.op === 'string' && typeof o.who === 'string' && o.who))) fail(`${at}.again is [{ op, who, … }]: the cast's ops as it is begun again after a retry`);
    if (t.ops !== undefined && !(Array.isArray(t.ops) && t.ops.length && t.ops.every((o) => o && typeof o === 'object' && typeof o.op === 'string' && /^[a-z]{2,16}$/.test(o.op) && typeof o.who === 'string' && o.who))) fail(`${at}.ops is [{ op, who, … }]: the cast's ops issued as it begins (a body called in, an ally let go)`);
  });
  const N = T.length, names = objectiveNames(id), cur = names.task, pre = `__${id}`;
  const beginE = (k) => `${pre}:begin:${k}`, metE = (k) => `${pre}:met:${k}`, advE = (k) => `${pre}:adv:${k}`;
  // (what the level keeps for its result: the tasks met, the foes downed, the seconds it took: the clock runs until the
  // last task is met)
  const downs = `${pre}_downs`, time = `${pre}_time`;
  const world = { vars: { [cur]: 0, [downs]: 0, [time]: 0 }, reactions: [], watches: [], sequences: [], timers: [{ every: 1, emit: { type: `${pre}:sec` }, while: { var: cur, lt: N } }], hud: [], entities: [], sources: [], initial: [{ type: T[0].pause ? `${pre}:start` : beginE(0) }] };
  if (T[0].pause) world.sequences.push({ id: `${pre}:pause:0`, trigger: { on: `${pre}:start` }, steps: [{ await: { timer: T[0].pause } }, { do: 'emit', type: beginE(0) }] });
  world.reactions.push({ on: `${pre}:sec`, do: 'inc', var: time, by: 1 });
  for (const f of woken) world.reactions.push({ on: 'down', match: { entity: f }, do: 'inc', var: downs, by: 1 });
  T.forEach((t, k) => {
    const mine = { var: cur, eq: k }, begun = `${pre}_in${k}`;
    world.vars[begun] = 0;
    // it begins: as the level starts (the first), as its section is walked into, or as the one before is met
    if (k && t.zone) {
      const zone = `${id}_in_${k}`;
      world.sources.push({ type: 'zone', zone, at: t.zone.at.slice(), ...(t.zone.half ? { half: t.zone.half.slice() } : { radius: t.zone.radius }), planar: true, watch: ctx.player });
      // (only while it is the task in hand: a section reached out of turn begins nothing)
      world.reactions.push({ on: 'enter', match: { zone }, if: mine, do: 'emit', type: beginE(k) });
    }
    world.reactions.push({ on: beginE(k), if: { var: begun, eq: 0 }, do: 'emit', type: 'objective:begin', n: k + 1, of: N, task: t.id, text: t.text });
    // (its own foes are woken before the mark is set: every reaction of the begin sees it unbegun)
    if (t.kind === 'clear' || t.kind === 'man') for (const f of t.foes) world.reactions.push({ on: beginE(k), if: { var: begun, eq: 0 }, do: 'ctrl', op: 'spawn', who: f, fresh: true });
    // (its ops: the cast told as it begins, once: a group that comes with it uncounted, an ally let go)
    for (const o of t.ops ?? []) world.reactions.push({ on: beginE(k), if: { var: begun, eq: 0 }, ...o, do: 'ctrl' });
    if (t.kind === 'take' || t.kind === 'reach') {
      const zone = `${id}_at_${k}`;
      // (planar unless the task says otherwise: a place on a storey, read at the body's own height, is not met from the
      // floor over or under it)
      world.sources.push({ type: 'zone', zone, at: t.at.slice(), radius: Number.isFinite(t.radius) ? t.radius : t.kind === 'take' ? 1.4 : 2, planar: t.planar !== false, watch: ctx.player });
      world.reactions.push({ on: 'enter', match: { zone }, if: mine, do: 'emit', type: metE(k) });
      // (paused: the place may be reached before it begins; inside it then, it is met as it begins)
      if (t.pause) {
        const there = `${pre}_there${k}`;
        world.vars[there] = 0;
        world.reactions.push({ on: 'enter', match: { zone }, do: 'set', var: there, to: 1 }, { on: 'exit', match: { zone }, do: 'set', var: there, to: 0 });
        world.reactions.push({ on: beginE(k), if: { var: there, eq: 1 }, do: 'emit', type: metE(k) });
      }
    } else if (t.kind === 'clear' || t.kind === 'man') {
      const d = names.downs(k);
      world.vars[d] = 0;
      for (const f of t.foes) world.reactions.push({ on: 'down', match: { entity: f }, do: 'inc', var: d, by: 1 });
      world.watches.push({ type: metE(k), when: { var: d, gte: t.foes.length } });
    } else if (t.kind === 'gates') {
      // the gates in order: the next one due is a count that only moves while the task is in hand (-1 until it begins),
      // so a gate flown out of turn, or before, does nothing
      const g = `${pre}_g${k}`, n = t.gates.length;
      world.vars[g] = -1;
      world.reactions.push({ on: beginE(k), if: { var: g, eq: -1 }, do: 'set', var: g, to: 0 });
      t.gates.forEach((G, j) => {
        const zone = `${id}_gate_${k}_${j}`;
        world.sources.push({ type: 'zone', zone, at: G.at.slice(), radius: G.radius, planar: false, watch: ctx.player });
        world.reactions.push({ on: 'enter', match: { zone }, if: { var: g, eq: j }, do: 'emit', type: `${pre}:gate:${k}:${j}` });
        world.reactions.push({ on: `${pre}:gate:${k}:${j}`, do: 'set', var: g, to: j + 1 }, { on: `${pre}:gate:${k}:${j}`, do: 'emit', type: 'objective:gate', n: j + 1, of: n, task: t.id });
      });
      world.watches.push({ type: metE(k), when: { var: g, gte: n } });
    } else if (t.kind === 'land') {
      // in a pad's box or not (a count of the boxes it is out of, as the laps mechanic's landing keeps), and a
      // touchdown judged in two steps (the bus has no conjunctions): in hand and soft, then inside a box
      const offs = `${pre}_off${k}`, td = `${pre}:td:${k}`;
      world.vars[offs] = t.pads.length;
      t.pads.forEach((q, j) => {
        const zone = `${id}_pad_${k}_${j}`;
        world.sources.push({ type: 'zone', zone, at: q.at.slice(), half: q.half.slice(), planar: false, watch: ctx.player });
        world.reactions.push({ on: 'enter', match: { zone }, do: 'inc', var: offs, by: -1 }, { on: 'exit', match: { zone }, do: 'inc', var: offs, by: 1 });
      });
      world.reactions.push({ on: 'touchdown', match: { hard: 0 }, if: mine, do: 'emit', type: td, sink: 'event.sink' });
      // (the sink it met the ground at, kept for the result and a grade: names.sink)
      world.reactions.push({ on: td, if: { var: offs, lt: t.pads.length }, do: 'set', var: names.sink, to: 'event.sink' });
      world.reactions.push({ on: td, if: { var: offs, lt: t.pads.length }, do: 'emit', type: metE(k) });
    } else if (t.kind === 'band') {
      // each gauge a source; inside all of them is a count of the gauges entered equal to their number; the clock ticks
      // while the task is in hand, and adds a second only while every gauge holds (else it starts again)
      const facts = Object.keys(t.band), inN = `${pre}_in${k}n`, held = `${pre}_held${k}`, on = `${pre}_on${k}`, tick = `${pre}:tick:${k}`;
      world.vars[inN] = 0; world.vars[held] = 0; world.vars[on] = 0;
      facts.forEach((f) => {
        const zone = `${id}_band_${k}_${f}`, [lo, hi] = t.band[f];
        world.sources.push({ type: 'gauge', zone, fact: f, ...(lo !== null ? { min: lo } : {}), ...(hi !== null ? { max: hi } : {}), watch: ctx.player });
        world.reactions.push({ on: 'enter', match: { zone }, do: 'inc', var: inN, by: 1 }, { on: 'exit', match: { zone }, do: 'inc', var: inN, by: -1 });
      });
      world.reactions.push({ on: beginE(k), if: { var: begun, eq: 0 }, do: 'set', var: on, to: 1 });
      world.timers.push({ every: 1, emit: { type: tick }, while: { var: on, eq: 1 } });
      world.reactions.push({ on: tick, if: { var: inN, gte: facts.length }, do: 'inc', var: held, by: 1 });
      // (every second out of it once it has been reached, over all the bands: names.slip, kept for a grade; the time it
      // takes to get into it is the task's, not a slip)
      const got = `${pre}_got${k}`, out = `${pre}:out:${k}`;
      world.vars[got] = 0;
      world.reactions.push({ on: tick, if: { var: inN, gte: facts.length }, do: 'set', var: got, to: 1 });
      world.reactions.push({ on: tick, if: { var: inN, lt: facts.length }, do: 'emit', type: out });
      world.reactions.push({ on: out, if: { var: got, eq: 1 }, do: 'inc', var: names.slip, by: 1 });
      if (!t.total) world.reactions.push({ on: tick, if: { var: inN, lt: facts.length }, do: 'set', var: held, to: 0 });
      world.watches.push({ type: metE(k), when: { var: held, gte: Math.ceil(t.seconds) } });
      world.reactions.push({ on: advE(k), do: 'set', var: on, to: 0 });
      // (its clock on the HUD only while it is in hand: a list of bands shows one Held, the one being flown)
      const shown = `${id}-held-${k}`;
      world.vars[`ui-${shown}`] = 0;
      world.reactions.push({ on: beginE(k), do: 'set', var: `ui-${shown}`, to: 1 }, { on: advE(k), do: 'set', var: `ui-${shown}`, to: 0 });
      world.hud.push({ var: held, label: 'Held', as: 'counter', max: Math.ceil(t.seconds), id: shown });
    } else if (t.kind === 'scan') {
      // inside its ring the clock runs, a second a tick, while the task is in hand; out of it the clock holds what it had
      const zone = `${id}_scan_${k}`, inR = `${pre}_scanin${k}`, held = `${pre}_held${k}`, on = `${pre}_on${k}`, tick = `${pre}:tick:${k}`;
      world.vars[inR] = 0; world.vars[held] = 0; world.vars[on] = 0;
      world.sources.push({ type: 'zone', zone, at: t.at.slice(), radius: t.radius, planar: t.planar !== false, watch: ctx.player });
      world.reactions.push({ on: 'enter', match: { zone }, do: 'set', var: inR, to: 1 }, { on: 'exit', match: { zone }, do: 'set', var: inR, to: 0 });
      world.reactions.push({ on: beginE(k), if: { var: begun, eq: 0 }, do: 'set', var: on, to: 1 });
      world.timers.push({ every: 1, emit: { type: tick }, while: { var: on, eq: 1 } });
      world.reactions.push({ on: tick, if: { var: inR, eq: 1 }, do: 'inc', var: held, by: 1 });
      if (t.total === false) world.reactions.push({ on: tick, if: { var: inR, eq: 0 }, do: 'set', var: held, to: 0 });
      world.watches.push({ type: metE(k), when: { var: held, gte: Math.ceil(t.seconds) } });
      world.reactions.push({ on: advE(k), do: 'set', var: on, to: 0 });
      // (its readout on the HUD only while it is in hand; what it found said as it is met)
      const shown = `${id}-scan-${k}`;
      world.vars[`ui-${shown}`] = 0;
      world.reactions.push({ on: beginE(k), do: 'set', var: `ui-${shown}`, to: 1 }, { on: advE(k), do: 'set', var: `ui-${shown}`, to: 0 });
      world.hud.push({ var: held, label: 'Scan', as: 'counter', max: Math.ceil(t.seconds), id: shown });
      if (t.found) {
        world.reactions.push({ on: advE(k), do: 'emit', type: 'objective:found', task: t.id, text: t.found });
        world.hud.push({ on: `${pre}:adv:${k}`, text: t.found, ttl: 4 });
      }
    } else if (t.kind === 'act') {
      // (met as the page says it was done, while it is the task in hand)
      world.reactions.push({ on: t.on, if: mine, do: 'emit', type: metE(k) });
    } else if (t.kind === 'protect') {
      // one of them down while the task is still to be met (in hand, or before it) loses the level
      for (const w of t.who) world.reactions.push({ on: 'down', match: { entity: w }, if: { var: cur, lte: k }, do: 'emit', type: 'objectives:failed', task: t.id });
      if (t.arrive) {
        const zone = `${id}_arrive_${k}`;
        world.sources.push({ type: 'zone', zone, at: t.arrive.at.slice(), radius: Number.isFinite(t.arrive.radius) ? t.arrive.radius : 30, planar: false, watch: t.who[0] });
        world.reactions.push({ on: 'enter', match: { zone }, if: mine, do: 'emit', type: metE(k) });
      } else {
        const left = names.left(k), on = `${pre}_on${k}`, tick = `${pre}:tick:${k}`;
        world.vars[left] = Math.ceil(t.seconds); world.vars[on] = 0;
        world.reactions.push({ on: beginE(k), if: { var: begun, eq: 0 }, do: 'set', var: on, to: 1 });
        world.timers.push({ every: 1, emit: { type: tick }, while: { var: on, eq: 1 } });
        world.reactions.push({ on: tick, do: 'inc', var: left, by: -1, min: 0 });
        world.watches.push({ type: metE(k), when: { var: left, lte: 0 } });
        world.reactions.push({ on: advE(k), do: 'set', var: on, to: 0 });
        world.hud.push({ var: left, label: 'Hold', as: 'counter' });
      }
    } else {
      // a hold: its clock runs once it has begun, its waves on the clock, the task met when the clock is out
      const left = names.left(k), on = `${pre}_on${k}`, tick = `${pre}:tick:${k}`, waves = t.waves ?? [], every = t.every ?? Math.max(1, t.seconds / (waves.length + 1));
      world.vars[left] = Math.ceil(t.seconds); world.vars[on] = 0;
      world.reactions.push({ on: beginE(k), if: { var: begun, eq: 0 }, do: 'set', var: on, to: 1 });
      world.timers.push({ every: 1, emit: { type: tick }, while: { var: on, eq: 1 } });
      world.reactions.push({ on: tick, do: 'inc', var: left, by: -1, min: 0 });
      world.watches.push({ type: metE(k), when: { var: left, lte: 0 } });
      // (its clock on the HUD only while it is in hand)
      const shown = `${id}-hold-${k}`;
      world.vars[`ui-${shown}`] = 0;
      world.reactions.push({ on: beginE(k), do: 'set', var: `ui-${shown}`, to: 1 }, { on: advE(k), do: 'set', var: `ui-${shown}`, to: 0 });
      world.hud.push({ var: left, label: 'Hold', as: 'counter', id: shown });
      if (waves.length) {
        world.sequences.push({ id: `${pre}:waves:${k}`, trigger: { on: 'objective:begin', task: t.id }, steps: waves.flatMap((_, w) => [{ await: { timer: w ? every : 1.5 } }, { do: 'emit', type: `${pre}:wave:${k}:${w}` }]) });
        waves.forEach((W, w) => {
          const waveE = `${pre}:wave:${k}:${w}`, live = { var: on, eq: 1 };
          world.reactions.push({ on: waveE, if: live, do: 'emit', type: 'wave', n: w + 1, of: waves.length });
          for (const f of W) world.reactions.push({ on: waveE, if: live, do: 'ctrl', op: 'spawn', who: f, fresh: true });
        });
      }
      world.reactions.push({ on: advE(k), do: 'set', var: on, to: 0 });
    }
    world.reactions.push({ on: beginE(k), do: 'set', var: begun, to: 1 });
    // met while it is the one in hand: handed over (the guard read once, the hand-over its own event)
    // (a paused task is met only once it has begun: the guard read in two steps, the bus having no conjunctions)
    if (t.pause) world.reactions.push({ on: metE(k), if: { var: begun, eq: 1 }, do: 'emit', type: `${pre}:met2:${k}` }, { on: `${pre}:met2:${k}`, if: mine, do: 'emit', type: advE(k) });
    else world.reactions.push({ on: metE(k), if: mine, do: 'emit', type: advE(k) });
    world.reactions.push({ on: advE(k), do: 'set', var: cur, to: k + 1 }, { on: advE(k), do: 'emit', type: 'objective:done', n: k + 1, of: N, task: t.id });
    // (the next begun as this is met, or its pause after)
    if (k + 1 < N && !T[k + 1].zone) {
      if (T[k + 1].pause) world.sequences.push({ id: `${pre}:pause:${k + 1}`, trigger: { on: advE(k) }, steps: [{ await: { timer: T[k + 1].pause } }, { do: 'emit', type: beginE(k + 1) }] });
      else world.reactions.push({ on: advE(k), do: 'emit', type: beginE(k + 1) });
    }
    if (k + 1 >= N) world.reactions.push({ on: advE(k), do: 'emit', type: 'objectives:done' });
    // the way on: sealed until the task is met; walked into sealed, the body is put back
    if (t.door) {
      const seal = names.seal(k), zone = `${id}_door_${k}`;
      world.entities.push({ id: seal, type: 'seal', on: true, position: t.door.at.slice(), radius: 0.9, color: '#7a1f1a' });
      world.sources.push({ type: 'zone', zone, at: t.door.at.slice(), radius: Number.isFinite(t.door.radius) ? t.door.radius : 1.3, planar: true, watch: ctx.player });
      world.reactions.push({ on: advE(k), do: 'toggle', target: seal, to: false });
      world.reactions.push({ on: 'enter', match: { zone }, if: { var: cur, lte: k }, do: 'emit', type: 'objective:sealed', task: t.id });
      world.reactions.push({ on: 'enter', match: { zone }, if: { var: cur, lte: k }, do: 'move', target: ctx.player, to: t.door.back.slice() });
    }
  });
  // on the page's own HUD: how many are met, each task said as it begins, a sealed way said (a page that draws its
  // HUD on mana-ui reads the same var and events: gameworld/mission-mana.js)
  // (the words of the task in hand kept as a var, `names.say`, as it begins: the banner shows the var, since a banner is
  // raised off the log, which keeps an event's type and not its words)
  // `say`: seconds the words stand as a banner (3), or 'line': a standing line at the top, the task in hand's words for
  // as long as it is in hand (a lesson's instruction)
  const line = p.say === 'line', say = Number.isFinite(p.say) && p.say > 0 ? p.say : 3;
  world.vars[names.say] = '';
  world.reactions.push({ on: 'objective:begin', do: 'set', var: names.say, to: 'event.text' });
  if (p.quiet !== undefined && typeof p.quiet !== 'boolean') fail('quiet is true: no count of the tasks met on the HUD');
  world.hud.unshift(...(p.quiet ? [] : [{ var: cur, label: 'Objective', as: 'counter', max: N }]), line ? { var: names.say, label: '', as: 'text', slot: 'top' } : { on: 'objective:begin', text: `{${names.say}}`, ttl: say }, { on: 'objective:sealed', text: 'The way on is sealed', as: 'toast', ttl: 1.2 });
  // (a retry: the player down while a task is in hand begins it again, RETRY; the level is lost only where nothing retries)
  if (p.retry !== undefined) {
    if (p.retry !== true && !(p.retry && typeof p.retry === 'object' && (p.retry.after === undefined || (Number.isFinite(p.retry.after) && p.retry.after > 0 && p.retry.after <= 10)) && (p.retry.say === undefined || (typeof p.retry.say === 'string' && p.retry.say)))) fail('retry is true, or { after?: seconds (up to 10), say? }: the player down begins the task in hand again');
    if (!ctx.player) fail('retry needs the player: the one whose fall begins the task again');
    const R = { ...RETRY, ...(p.retry === true ? {} : p.retry) }, lost = `${pre}:lost`, again = `${pre}:again`, V = SCREEN_VARS;
    world.vars[names.retries] = 0; world.vars[V.fade] ??= 0;
    world.reactions.push({ on: 'down', match: { entity: ctx.player }, if: { var: cur, lt: N }, do: 'emit', type: lost });
    world.sequences.push({ id: `${pre}:retry`, trigger: { on: lost }, steps: [{ do: 'set', var: V.fade, to: 1 }, { await: { timer: R.after } }, { do: 'emit', type: again }, { await: { timer: R.back } }, { do: 'set', var: V.fade, to: 0 }] });
    world.reactions.push({ on: again, do: 'inc', var: names.retries, by: 1 }, { on: again, do: 'ctrl', op: 'spawn', who: ctx.player, fresh: true });
    T.forEach((t, k) => {
      for (const f of t.foes ?? []) world.reactions.push({ on: again, if: { var: cur, eq: k }, do: 'ctrl', op: 'spawn', who: f, fresh: true });
      for (const o of t.again ?? []) world.reactions.push({ on: again, if: { var: cur, eq: k }, ...o, do: 'ctrl' });
    });
    world.hud.push({ on: again, text: R.say, ttl: 2.4 });
  }
  for (const ch of ['watches', 'sequences', 'timers', 'entities', 'sources']) if (!world[ch].length) delete world[ch];
  const banded = T.some((t) => t.kind === 'band'), landed = T.some((t) => t.kind === 'land');
  if (banded) world.vars[names.slip] = 0;
  if (landed) world.vars[names.sink] = 0;
  // (foes down kept only where a task has foes: a lesson's result says nothing of them)
  const keep = [{ var: cur, label: 'Tasks met', best: 'high' }, ...(woken.size ? [{ var: downs, label: 'Foes down', best: 'high' }] : []), { var: time, label: 'Time', best: 'low', unit: 's' },
    ...(banded ? [{ var: names.slip, label: 'Out of the band', best: 'low', unit: 's' }] : []), ...(landed ? [{ var: names.sink, label: 'Touchdown', best: 'low', unit: ' m/s' }] : [])];
  const fails = T.some((t) => t.kind === 'protect');
  if (fails) world.hud.push({ on: 'objectives:failed', text: 'Failed', as: 'toast', ttl: 2 });
  if (T.some((t) => t.kind === 'gates')) world.hud.push({ on: 'objective:gate', text: 'gate {event.n} of {event.of}', as: 'toast', ttl: 1 });
  return { world, on: { 'objectives:done': { end: 'success' }, ...(fails ? { 'objectives:failed': { end: 'fail' } } : {}) }, keep, emits: ['objective:begin', 'objective:done', 'objective:sealed', 'objective:gate', 'objectives:done', 'objectives:failed', 'wave'] };
}

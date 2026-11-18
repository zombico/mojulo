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
 *
 * Lowered onto the bus the other mechanics use (no runtime of its own), as the wave gauntlet is: a var for the task in
 * hand, a zone a section, a counter of downs a clear, a clock a hold, a guarded hand-over. A way on that is still
 * sealed puts a body that walks into it back (`back`), as the gauntlet's does.
 *
 * Params:
 *   { id?: 'obj', tasks: [{ id, kind, text, zone?: { at, half }, at?, radius?, planar?, foes?, gun?, seconds?, every?, waves?,
 *                           door?: { at, back, radius? } }] }
 *   zone   the section's box (its centre and half-extents; or { at, radius }, a round one, for a section in an open
 *          place): walking into it begins the task (none: it begins as the one
 *          before is met; the first begins as the level starts)
 *   door   the way on, sealed until the task is met
 *   planar false: a take or a reach met at its height (a place on a storey: never from the floor over or under it)
 *
 *   objectiveNames(id)      → { task (the var: the index in hand, the count when all are met), seal(k), left(k), downs(k),
 *                             felled, time } the names it gives its things (felled: every foe of its downed; time: seconds)
 *   objectivesOf(mechanics) → the mechanic of a level's list, or null
 *   lowerObjectives(p, ctx) → { world, on, emits }   (game/mechanics.js registers it)
 *
 * It keeps for the level's result (the contract's `keep`): the tasks met, the foes downed, the seconds taken.
 * Events it says: objective:begin { n, of, task, text }, objective:done { n, of, task }, objective:sealed { task },
 * wave { n, of }, objectives:done (the win).
 * The audit: none can fight, so it is not auto-auditable; its proof is on the bus with each fall given
 * (gameworld/mission-proof.js), and a player's on the runtime.
 *
 * Pure, no dice.
 */
const ID = /^[a-z][a-z0-9-]{0,31}$/;
const isVec = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
export const OBJECTIVE_KINDS = Object.freeze(['take', 'reach', 'clear', 'man', 'hold']);

export const objectiveNames = (id) => ({ task: `__${id}`, seal: (k) => `${id}-seal-${k}`, left: (k) => `__${id}_left${k}`, downs: (k) => `__${id}_d${k}`, felled: `__${id}_downs`, time: `__${id}_time` });
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
    if (t.kind === 'clear' || t.kind === 'man') { if (!Array.isArray(t.foes) || !t.foes.length || t.foes.some((f) => typeof f !== 'string' || !f)) fail(`${at}.foes is the ids to be downed, at least one`); }
    if (t.kind === 'man' && !(typeof t.gun === 'string' && t.gun)) fail(`${at}.gun is the id of the gun it is done with`);
    if (t.kind === 'hold') {
      if (!(Number.isFinite(t.seconds) && t.seconds > 0)) fail(`${at}.seconds is how long it is held, above 0`);
      if (t.every !== undefined && !(Number.isFinite(t.every) && t.every > 0)) fail(`${at}.every is the seconds between its waves, above 0`);
      if (t.waves !== undefined && (!Array.isArray(t.waves) || t.waves.some((w) => !Array.isArray(w) || !w.length || w.some((f) => typeof f !== 'string' || !f)))) fail(`${at}.waves is [[<foe id>, …], …]`);
    }
    for (const f of [...(t.foes ?? []), ...(t.waves ?? []).flat()]) { if (woken.has(f)) fail(`${at}: '${f}' is woken twice (a foe is woken once: name another)`); woken.add(f); }
    if (t.zone !== undefined && !(t.zone && isVec(t.zone.at) && (isVec(t.zone.half) || (Number.isFinite(t.zone.radius) && t.zone.radius > 0)))) fail(`${at}.zone is { at: [x, y, z], half: [hx, hy, hz] } (the section's box) or { at, radius } (a round one)`);
    if (t.door !== undefined && !(t.door && isVec(t.door.at) && isVec(t.door.back))) fail(`${at}.door is { at, back }: the way on and where a body is put back while it is sealed`);
  });
  const N = T.length, names = objectiveNames(id), cur = names.task, pre = `__${id}`;
  const beginE = (k) => `${pre}:begin:${k}`, metE = (k) => `${pre}:met:${k}`, advE = (k) => `${pre}:adv:${k}`;
  // (what the level keeps for its result: the tasks met, the foes downed, the seconds it took: the clock runs until the
  // last task is met)
  const downs = `${pre}_downs`, time = `${pre}_time`;
  const world = { vars: { [cur]: 0, [downs]: 0, [time]: 0 }, reactions: [], watches: [], sequences: [], timers: [{ every: 1, emit: { type: `${pre}:sec` }, while: { var: cur, lt: N } }], hud: [], entities: [], sources: [], initial: [{ type: beginE(0) }] };
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
    if (t.kind === 'take' || t.kind === 'reach') {
      const zone = `${id}_at_${k}`;
      // (planar unless the task says otherwise: a place on a storey, read at the body's own height, is not met from the
      // floor over or under it)
      world.sources.push({ type: 'zone', zone, at: t.at.slice(), radius: Number.isFinite(t.radius) ? t.radius : t.kind === 'take' ? 1.4 : 2, planar: t.planar !== false, watch: ctx.player });
      world.reactions.push({ on: 'enter', match: { zone }, if: mine, do: 'emit', type: metE(k) });
    } else if (t.kind === 'clear' || t.kind === 'man') {
      const d = names.downs(k);
      world.vars[d] = 0;
      for (const f of t.foes) world.reactions.push({ on: 'down', match: { entity: f }, do: 'inc', var: d, by: 1 });
      world.watches.push({ type: metE(k), when: { var: d, gte: t.foes.length } });
    } else {
      // a hold: its clock runs once it has begun, its waves on the clock, the task met when the clock is out
      const left = names.left(k), on = `${pre}_on${k}`, tick = `${pre}:tick:${k}`, waves = t.waves ?? [], every = t.every ?? Math.max(1, t.seconds / (waves.length + 1));
      world.vars[left] = Math.ceil(t.seconds); world.vars[on] = 0;
      world.reactions.push({ on: beginE(k), if: { var: begun, eq: 0 }, do: 'set', var: on, to: 1 });
      world.timers.push({ every: 1, emit: { type: tick }, while: { var: on, eq: 1 } });
      world.reactions.push({ on: tick, do: 'inc', var: left, by: -1, min: 0 });
      world.watches.push({ type: metE(k), when: { var: left, lte: 0 } });
      world.hud.push({ var: left, label: 'Hold', as: 'counter' });
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
    world.reactions.push({ on: metE(k), if: mine, do: 'emit', type: advE(k) });
    world.reactions.push({ on: advE(k), do: 'set', var: cur, to: k + 1 }, { on: advE(k), do: 'emit', type: 'objective:done', n: k + 1, of: N, task: t.id });
    if (k + 1 < N) { if (!T[k + 1].zone) world.reactions.push({ on: advE(k), do: 'emit', type: beginE(k + 1) }); }
    else world.reactions.push({ on: advE(k), do: 'emit', type: 'objectives:done' });
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
  world.hud.unshift({ var: cur, label: 'Objective', as: 'counter', max: N }, { on: 'objective:begin', text: '{event.text}', ttl: 3 }, { on: 'objective:sealed', text: 'The way on is sealed', as: 'toast', ttl: 1.2 });
  for (const ch of ['watches', 'sequences', 'timers', 'entities', 'sources']) if (!world[ch].length) delete world[ch];
  const keep = [{ var: cur, label: 'Tasks met', best: 'high' }, { var: downs, label: 'Foes down', best: 'high' }, { var: time, label: 'Time', best: 'low', unit: 's' }];
  return { world, on: { 'objectives:done': { end: 'success' } }, keep, emits: ['objective:begin', 'objective:done', 'objective:sealed', 'objectives:done', 'wave'] };
}

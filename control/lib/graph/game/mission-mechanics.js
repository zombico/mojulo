/**
 * A STORY MISSION (gameworld/errand.js `mission`): a job told as one, with ways to fail. No runtime of its own: the
 * bus's vars, a timer and a watch, the law's own events (law-mechanics.js) and the street's (vitals-mechanics.js).
 *
 *   mission  (emitter)  it STARTS as its job is taken (`flag:<flag>`): MISSION, its name; with `time`, a clock on the
 *                       HUD. `heat`: as its goods are had (`flag:<hot>`), that many stars from the law. It is PASSED as
 *                       its job is done (`errand:done:<id>`). It FAILS while it is on when the player is wasted or
 *                       busted, or its clock runs out: MISSION FAILED, and `again` seconds after it starts once more
 *                       (what was had is kept; the clock whole again). A game continued (`resumed`, the level's save
 *                       handed back) picks up one taken and not yet passed.
 *                       { id, flag, name?, time?, heat?, hot?, again? (5), final? }
 *
 * Its vars: `mission-done-<id>` (passed: what a save keeps), `mission-on-<id>`, `mission-time-<id>`, `mission-again-<id>`, `ui-mission-clock-<id>` (its clock shown while
 * it is on). Its events: `mission:<id>` (started), `mission-failed:<id>`, `mission-passed:<id>`.
 *
 *   lowerMission   (game/mechanics.js registers it)
 * Pure, no dice.
 */
const WORD = /^[a-z][a-z0-9-]{0,31}$/, FLAG = /^[a-z][a-z0-9-]{0,47}$/;
export const MISSION = Object.freeze({ again: 5 });

export function lowerMission(p, ctx) {
  const at0 = `mission[${ctx.i}]`, fail = (m) => { throw new Error(`${at0}: ${m}`); };
  if (typeof p.id !== 'string' || !WORD.test(p.id)) fail('id is the job\'s name, lower-case');
  if (typeof p.flag !== 'string' || !FLAG.test(p.flag)) fail('flag is the flag taking the job sets (took-heist)');
  if (p.time !== undefined && !(Number.isFinite(p.time) && p.time > 0)) fail('time is the seconds it has');
  if (p.heat !== undefined && !(Number.isInteger(p.heat) && p.heat >= 1 && p.heat <= 5)) fail('heat is the stars its goods bring, 1 to 5');
  if (p.heat !== undefined && (typeof p.hot !== 'string' || !FLAG.test(p.hot))) fail('hot is the flag having its goods sets (had-diamonds), where its heat comes on');
  const again = Number.isFinite(p.again) && p.again > 0 ? p.again : MISSION.again;
  const id = p.id, name = typeof p.name === 'string' && p.name ? p.name : id.replace(/-/g, ' ');
  const ON = `mission-on-${id}`, T = `mission-time-${id}`, AG = `mission-again-${id}`, UI = `ui-mission-clock-${id}`;
  const start = `mission:${id}`, failed = `mission-failed:${id}`, passed = `mission-passed:${id}`;
  const DONE = `mission-done-${id}`, TOOK = `flag-${p.flag}`;
  const frag = { vars: { [ON]: 0, [AG]: 0, [DONE]: 0, [TOOK]: 0, ...(p.time ? { [T]: p.time, [UI]: 0 } : {}) }, reactions: [], hud: [], timers: [], watches: [] };
  // STARTED: as the job is taken, and again after a failure
  frag.reactions.push({ on: `flag:${p.flag}`, if: { var: ON, eq: 0 }, do: 'emit', type: start }, { on: `again:${id}`, do: 'emit', type: start });
  frag.reactions.push({ on: start, do: 'set', var: ON, to: 1 }, { on: start, do: 'set', var: AG, to: 0 });
  // (a game CONTINUED, the level's save handed back: game channel `resumed`; one taken and not done picks up again)
  frag.reactions.push({ on: 'resumed', if: { var: TOOK, gte: 1 }, do: 'emit', type: `resuming:${id}` }, { on: `resuming:${id}`, if: { var: DONE, eq: 0 }, do: 'emit', type: start });
  if (p.time) frag.reactions.push({ on: start, do: 'set', var: T, to: p.time }, { on: start, do: 'set', var: UI, to: 1 });
  // HEAT: the goods had, that many stars (the law's own raise: law-mechanics.js `raising:wanted`), while it is on
  if (p.heat) { frag.reactions.push({ on: `flag:${p.hot}`, if: { var: ON, gte: 1 }, do: 'emit', type: `heating:${id}` }); for (let k = 0; k < p.heat; k++) frag.reactions.push({ on: `heating:${id}`, do: 'emit', type: 'raising:wanted' }); }
  // THE CLOCK: a second at a time while on; out of time, failed
  if (p.time) {
    frag.timers.push({ every: 1, emit: { type: `ticking:${id}` }, while: { var: ON, gte: 1 } });
    frag.reactions.push({ on: `ticking:${id}`, do: 'inc', var: T, by: -1, min: 0 });
    frag.watches.push({ type: `expired:${id}`, when: { var: T, lte: 0 } });
    frag.reactions.push({ on: `expired:${id}`, if: { var: ON, gte: 1 }, do: 'emit', type: failed });
  }
  // FAILED: wasted or busted while on (vitals-mechanics.js, law-mechanics.js)
  for (const ev of ['wasted', 'busted']) frag.reactions.push({ on: ev, if: { var: ON, gte: 1 }, do: 'emit', type: failed });
  frag.reactions.push({ on: failed, do: 'set', var: ON, to: 0 }, { on: failed, do: 'set', var: AG, to: 1 });
  if (p.time) frag.reactions.push({ on: failed, do: 'set', var: UI, to: 0 });
  // (and `again` seconds on, it starts once more)
  frag.timers.push({ every: again, emit: { type: `waiting:${id}` }, while: { var: AG, gte: 1 } });
  frag.reactions.push({ on: `waiting:${id}`, if: { var: AG, gte: 1 }, do: 'emit', type: `again:${id}` });
  // PASSED: its job done while on
  // (and handed in while it waits to start again: passed all the same, the restart called off)
  frag.reactions.push({ on: `errand:done:${id}`, if: { var: ON, gte: 1 }, do: 'emit', type: passed }, { on: `errand:done:${id}`, if: { var: AG, gte: 1 }, do: 'emit', type: passed }, { on: passed, do: 'set', var: ON, to: 0 }, { on: passed, do: 'set', var: AG, to: 0 }, { on: passed, do: 'set', var: DONE, to: 1 });
  if (p.time) frag.reactions.push({ on: passed, do: 'set', var: UI, to: 0 });
  frag.hud.push(
    { on: start, as: 'banner', text: name.toUpperCase(), ttl: 2.6 },
    ...(p.time ? [{ id: `mission-clock-${id}`, var: T, label: name, as: 'clock', slot: 'top' }] : []),
    ...(p.heat ? [{ on: `heating:${id}`, as: 'toast', text: 'They saw you. Lose the police.', ttl: 3 }] : []),
    { on: failed, as: 'banner', text: 'MISSION FAILED', ttl: 3 },
    { on: `again:${id}`, as: 'toast', text: `${name}: try again.`, ttl: 2.6 },
    { on: passed, as: 'banner', text: p.final ? 'MISSION PASSED · THE END' : 'MISSION PASSED', ttl: 3.2 },
  );
  return { world: frag, emits: [start, failed, passed] };
}

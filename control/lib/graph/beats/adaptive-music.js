/**
 * adaptive-music — music that follows play: a tension meter fed by the level's own events, and a two-state score
 * (explore, combat) that changes on the bar line with hysteresis, so it never flaps.
 *
 *   audio: { soundtrack: 'field:forest', combat: 'field:battle', tension?: { on?, enter?, exit?, hold?, decay? } }
 *
 * SINGLE SOURCE: the logic is one self-contained closure, `buildAdaptive()`, run in Node by the tests and emitted
 * into the World page with `.toString()` (the event-bus pattern), so the laws the tests hold are the page's.
 * Presentation only: it reads the bus log and the AudioContext clock and never writes sim state.
 */

// the events each mechanic surfaces that should raise the tension, and by how much (0..1). A level's meter listens
// for these unless `audio.tension.on` names its own. Held by laws (adaptive-music.test.js): every row is an event
// some mechanic surfaces.
export const MECHANIC_TENSION = {
  'hp-pool': { 'hit:*': 0.35, 'enemy:down': 0.1 },
  unseen: { spotted: 0.7 },
  waves: { wave: 0.55, leak: 0.3 },
  'defeat-all': { 'enemy:down': 0.1 },
};
export const TENSION_DEFAULTS = { enter: 0.6, exit: 0.25, hold: 2, decay: 6 };

export function buildAdaptive() {
  const glob = (pat, t) => {
    if (pat === '*') return true;
    if (pat.indexOf('*') < 0) return pat === t;
    return new RegExp('^' + pat.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$').test(t);
  };
  // the meter: a raise by the first matching row's weight, capped at 1; a leak toward 0 over `decay` seconds
  function raise(tension, type, on) {
    for (const pat in on) if (glob(pat, type)) return Math.min(1, tension + on[pat]);
    return tension;
  }
  function leak(tension, dt, decay) { return dt > 0 ? tension * Math.exp(-dt / decay) : tension; }
  // the next bar line of the playing piece at or after `earliest` (a piece started at t0, bars of `bar` seconds)
  function nextBar(earliest, t0, bar) { return t0 + Math.max(0, Math.ceil((earliest - t0) / bar - 1e-9)) * bar; }
  // the bar's length, in seconds, of a beats recipe (quarters per bar by its meter; a pattern's whole loop)
  function barSeconds(recipe) {
    if (!recipe || !(recipe.bpm > 0)) return 2;
    const m = /^(\d+)\/(\d+)$/.exec(String(recipe.meter || '4/4'));
    const q = m ? (4 * Number(m[1])) / Number(m[2]) : 4;
    return (q * 60) / recipe.bpm;
  }
  /**
   * One step of the state machine. state: { active: 'explore'|'combat', below: seconds under `exit` }. Returns the new
   * state and, when the score should change, `to`. Combat comes in when the tension reaches `enter`; it leaves only
   * after the tension has stayed at or under `exit` for `hold` bars of the combat piece.
   */
  function decide(state, tension, dt, cfg, combatBar) {
    if (state.active === 'explore') return tension >= cfg.enter ? { active: 'combat', below: 0, to: 'combat' } : { active: 'explore', below: 0 };
    const below = tension <= cfg.exit ? state.below + dt : 0;
    return below >= cfg.hold * combatBar ? { active: 'explore', below: 0, to: 'explore' } : { active: 'combat', below };
  }
  return { glob, raise, leak, nextBar, barSeconds, decide };
}

/** The resolved tension config: the mechanics' rows (or the spec's own `on`) over the defaults. */
export function resolveTension(spec, mechanics = []) {
  const t = spec === undefined || spec === true ? {} : spec;
  if (!t || typeof t !== 'object' || Array.isArray(t)) throw new Error('audio.tension is { on?: { <event glob>: weight 0..1 }, enter?, exit?, hold? (bars), decay? (seconds) }');
  for (const k of Object.keys(t)) if (!['on', 'enter', 'exit', 'hold', 'decay'].includes(k)) throw new Error(`audio.tension.${k} is not a tension setting (on, enter, exit, hold, decay)`);
  const cfg = { ...TENSION_DEFAULTS };
  for (const k of ['enter', 'exit']) if (t[k] !== undefined) { if (!(Number.isFinite(t[k]) && t[k] >= 0 && t[k] <= 1)) throw new Error(`audio.tension.${k} is 0..1`); cfg[k] = t[k]; }
  for (const k of ['hold', 'decay']) if (t[k] !== undefined) { if (!(Number.isFinite(t[k]) && t[k] > 0)) throw new Error(`audio.tension.${k} is a positive number`); cfg[k] = t[k]; }
  if (cfg.exit >= cfg.enter) throw new Error(`audio.tension.exit (${cfg.exit}) must sit under enter (${cfg.enter}): the gap is what keeps the score from flapping`);
  let on = {};
  if (t.on !== undefined) {
    if (!t.on || typeof t.on !== 'object' || Array.isArray(t.on)) throw new Error('audio.tension.on is { <event glob>: weight 0..1 }');
    for (const [g, w] of Object.entries(t.on)) if (!(Number.isFinite(w) && w > 0 && w <= 1)) throw new Error(`audio.tension.on['${g}'] is a weight in (0, 1]`);
    on = { ...t.on };
  } else {
    // the level's mechanics say what is dangerous; when they name nothing dangerous (or none are known), every
    // mechanic's rows: an event that never fires adds nothing, and an asked-for combat score can still come in
    for (const k of mechanics) for (const [g, w] of Object.entries(MECHANIC_TENSION[k] || {})) if (!(g in on)) on[g] = w;
    if (!Object.keys(on).length) for (const rows of Object.values(MECHANIC_TENSION)) for (const [g, w] of Object.entries(rows)) if (!(g in on)) on[g] = w;
  }
  return { ...cfg, on };
}

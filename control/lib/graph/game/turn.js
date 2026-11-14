/**
 * turn — A GAME'S TURN: one level session in named phases, from the first pick to the results. The flow (flow.js)
 * strings turns together; a `level` step is a turn. The names are internal (the agent and the person read set up,
 * loading, play, pause, results):
 *
 *   untap     the player's: the picks the level asks for, one at a time (back unwinds one)
 *   upkeep    the app's: the picks checked, the seed, the load, the level started; its only screen is the loading one
 *   main      the game's: an optional start trigger, play, an optional end trigger
 *   cleanup   the app's: the outcome applied to the store, the save written, the unlocks worked out
 *   end       the player's: results, and what next
 *   interrupt the pause over the held game: legal in play only, never a phase
 *
 * What a level step says of its turn (all optional; a step that says none plays as it always has):
 *
 *   picks: [{ id, from: { slice: '<a slice the level consumes>' } | { options: ['<id>', …] }, min?, max? }]
 *          what the player chooses before the level loads, in order; `id` is the name the choice lands under in the
 *          session; from a slice the choice is which of its members go in (the contract's consumes pick), from
 *          options it is the game's own words (a difficulty, a mode); min (1; 0: may be passed) to max (1)
 *   start: { scene | video, skip?, once? }
 *          MAIN'S START TRIGGER: a scene the level has (scripted motion, talking) or a video, played as the level's
 *          first frame shows, control held; once (true): never again in this save, and never on a retry
 *   end:   { scene | video, skip?, when? }
 *          MAIN'S END TRIGGER: the same, played once the outcome is known, before cleanup; when: the outcomes it
 *          plays on (won, lost, left; one or a list; won and lost when not said)
 *
 *   TURN_PHASES · TURN_OUTCOMES · TURN_KEYS
 *   readTurn(step, { consumes?, scenes?, where })   → errors[] (teaching)
 *   turnOf(step)                                    → { picks, start, end }: the turn a level step says, defaulted
 *   buildTurnKernel()                               → { beginTurn, stepTurn, walkTurn, pickErrors, turnParams }:
 *                                                     self-contained, inlined in a shell by toString() beside the
 *                                                     flow kernel; node uses the same
 *   beginTurn(turn, { level, picks?, again? })      → the turn's first state: untap at its first pick, or upkeep
 *                                                     when there is nothing to pick or the picks are carried (a retry)
 *   stepTurn(turn, state, event, ctx?)              → the state an event leads to (null: the event means nothing here)
 *   walkTurn(turn, events, opts?, ctx?)             → the states a run of events visits (the headless walk)
 *
 * A state: { phase, level, picks: { <id>: id | [ids] }, at?, sub?, trigger?, paused?, outcome?, ok?, why?, exit?, again? }
 *   phase   untap | upkeep | main | cleanup | end | out (the turn is over: `exit` says how it was left)
 *   at      untap: the pick being asked
 *   sub     main: start (its start trigger playing) | play | end (its end trigger playing); `trigger` what plays
 *   why     untap: why the load sent the player back
 *
 * Events, by phase:
 *   untap    { pick: id | [ids] } (the choice for the pick asked) · back
 *   upkeep   ready · { fail: '<why>' }
 *   main     start, end: scene-end (it ended or was skipped) · play: interrupt, { outcome: won | lost | left };
 *            paused: resume, restart (upkeep again, the same picks), quit (a level left)
 *   cleanup  { applied: true | false }
 *   end      retry (upkeep again, the same picks) · any other word leaves the turn by it (next, home)
 *
 * ctx: { rows(pick) → [{ id, locked?, why? }] (what can be picked now: the store's answer, the options when absent),
 *        seen(which) → bool (has this save seen the turn's `start` trigger) }
 *
 * Pure: no clock, no dice, no DOM. Nothing here draws; a shell draws each phase (mana-ui its screens).
 */

export const TURN_PHASES = Object.freeze(['untap', 'upkeep', 'main', 'cleanup', 'end']);
export const TURN_OUTCOMES = Object.freeze(['won', 'lost', 'left']);
export const TURN_KEYS = Object.freeze(['picks', 'start', 'end']);

const PICK_KEYS = ['id', 'from', 'min', 'max'];
const TRIGGER_KEYS = { start: ['scene', 'video', 'skip', 'once'], end: ['scene', 'video', 'skip', 'when'] };
const ID = /^[a-z][a-z0-9-]{0,40}$/;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.length > 0;
const whole = (v, lo) => Number.isInteger(v) && v >= lo;

/**
 * A level step's turn as written: every fault said, with what it should be. `consumes`: the slices the level it plays
 * consumes (absent: not checked); `scenes`: the scenes that level has (absent: not checked).
 */
export function readTurn(step, { consumes = null, scenes = null, where = 'step' } = {}) {
  const errors = [];
  if (!isObj(step)) return errors;
  if (step.picks !== undefined) {
    if (!Array.isArray(step.picks) || !step.picks.length) errors.push(`${where}.picks is [{ id, from, min?, max? }]: what the player chooses before the level loads, at least one (leave it out for none)`);
    else {
      const ids = new Set();
      step.picks.forEach((p, i) => {
        const at = `${where}.picks[${i}]`;
        if (!isObj(p)) { errors.push(`${at} is { id, from: { slice } | { options }, min?, max? }`); return; }
        for (const k of Object.keys(p)) if (!PICK_KEYS.includes(k)) errors.push(`${at}.${k}: a pick takes ${PICK_KEYS.join(', ')}`);
        if (!isStr(p.id) || !ID.test(p.id)) errors.push(`${at}.id names the choice in the session (lower case, digits and hyphens: character, loadout, difficulty)`);
        else if (ids.has(p.id)) errors.push(`${at}.id '${p.id}' is said twice: each pick has its own name`);
        else ids.add(p.id);
        const f = p.from;
        if (!isObj(f) || Object.keys(f).length !== 1 || !(isStr(f.slice) || Array.isArray(f.options))) errors.push(`${at}.from is { slice: '<a slice the level consumes>' } or { options: ['<id>', …] }: where the choices come from`);
        else if (f.slice !== undefined) {
          if (consumes && !consumes.includes(f.slice)) errors.push(`${at}.from.slice '${f.slice}' is not a slice the level consumes (${consumes.join(', ') || 'it consumes none'}): the level would never hear the choice`);
        } else if (f.options.length < 2 || !f.options.every(isStr) || new Set(f.options).size !== f.options.length) errors.push(`${at}.from.options is two or more words, each once: with one there is nothing to pick`);
        const min = p.min === undefined ? 1 : p.min, max = p.max === undefined ? 1 : p.max;
        if (p.min !== undefined && !whole(p.min, 0)) errors.push(`${at}.min is how few may be picked, 0 or more (0: the pick may be passed)`);
        if (p.max !== undefined && !whole(p.max, 1)) errors.push(`${at}.max is how many may be picked, 1 or more`);
        if (whole(min, 0) && whole(max, 1) && min > max) errors.push(`${at}: min ${min} is over max ${max}`);
        if (isObj(f) && Array.isArray(f.options) && whole(max, 1) && max > f.options.length) errors.push(`${at}.max ${max} is more than its ${f.options.length} options`);
      });
    }
  }
  for (const which of ['start', 'end']) {
    const t = step[which];
    if (t === undefined) continue;
    const at = `${where}.${which}`, keys = TRIGGER_KEYS[which];
    if (!isObj(t)) { errors.push(`${at} is { ${keys.join('?, ')}? }: a scene or a video played at the ${which} of play, control held`); continue; }
    for (const k of Object.keys(t)) if (!keys.includes(k)) errors.push(`${at}.${k}: main's ${which} trigger takes ${keys.join(', ')}`);
    if (t.scene !== undefined && t.video !== undefined) errors.push(`${at}: a trigger plays a scene or a video, one or the other`);
    else if (t.scene === undefined && t.video === undefined) errors.push(`${at}: a trigger plays a scene the level has (scene) or a video (video)`);
    if (t.scene !== undefined) {
      if (!isStr(t.scene)) errors.push(`${at}.scene names a scene the level has`);
      else if (scenes && !scenes.includes(t.scene)) errors.push(`${at}.scene: the level has no scene '${t.scene}' (${scenes.join(', ') || 'none'})`);
    }
    if (t.video !== undefined && !isStr(t.video)) errors.push(`${at}.video is the video it plays (a url or a path)`);
    for (const k of ['skip', 'once']) if (t[k] !== undefined && typeof t[k] !== 'boolean') errors.push(`${at}.${k} is true or false`);
    if (which === 'end' && t.when !== undefined) {
      const w = Array.isArray(t.when) ? t.when : [t.when];
      if (!w.length || !w.every((x) => TURN_OUTCOMES.includes(x))) errors.push(`${at}.when is the outcomes it plays on: ${TURN_OUTCOMES.join(', ')} (one or a list; won and lost when not said)`);
    }
  }
  return errors;
}

/** The turn a level step says, defaulted: nothing to pick and no trigger when it says none. */
export function turnOf(step) {
  const s = isObj(step) ? step : {};
  const trigger = (t, more) => (isObj(t) ? { ...(t.scene !== undefined ? { scene: t.scene } : { video: t.video }), skip: t.skip !== false, ...more(t) } : null);
  return {
    picks: (Array.isArray(s.picks) ? s.picks : []).map((p) => ({ id: p.id, from: p.from, min: p.min === undefined ? 1 : p.min, max: p.max === undefined ? 1 : p.max })),
    start: trigger(s.start, (t) => ({ once: t.once !== false })),
    end: trigger(s.end, (t) => ({ when: t.when === undefined ? ['won', 'lost'] : Array.isArray(t.when) ? t.when.slice() : [t.when] })),
  };
}

/**
 * THE TURN KERNEL: stepping a turn, self-contained so a shell inlines it with toString() beside the flow kernel
 * (real, parseable JavaScript, references nothing outside itself). Node uses the same instance.
 */
export function buildTurnKernel() {
  const OUTCOMES = ['won', 'lost', 'left'];
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const copy = (s, more) => Object.assign({}, s, more);
  // a state with the keys of the phase it left taken off
  const leave = (s, more) => { const n = {}; for (const k of ['level', 'picks', 'again']) if (s[k] !== undefined) n[k] = s[k]; return Object.assign(n, more); };
  // what can be picked now: the store's answer (ctx.rows), else the pick's own options
  function rowsOf(pick, ctx) {
    if (ctx && ctx.rows) { const r = ctx.rows(pick); if (Array.isArray(r)) return r; }
    return pick.from && Array.isArray(pick.from.options) ? pick.from.options.map((id) => ({ id })) : [];
  }
  // why a choice cannot stand ([]: it can): how many, each one there, none locked, none twice
  function pickErrors(pick, value, ctx) {
    const ids = value === undefined || value === null ? [] : Array.isArray(value) ? value : [value], rows = rowsOf(pick, ctx), out = [];
    if (ids.length < pick.min) out.push(pick.min === 1 ? 'pick one' : 'pick at least ' + pick.min);
    if (ids.length > pick.max) out.push(pick.max === 1 ? 'pick one only' : 'pick ' + pick.max + ' at most');
    const seen = {};
    for (const id of ids) {
      const row = rows.find((r) => r.id === id);
      if (seen[id]) out.push(id + ' is picked twice');
      seen[id] = 1;
      if (!row) out.push('no ' + id + ' to pick');
      else if (row.locked) out.push(row.why || id + ' is locked');
    }
    return out;
  }
  // main as it starts: its start trigger when it has one this save has not seen (and this is no retry), else play
  function toMain(turn, s, ctx) {
    const t = turn.start, plays = t && !(t.once && (s.again || (ctx && ctx.seen && ctx.seen('start'))));
    return leave(s, plays ? { phase: 'main', sub: 'start', trigger: t } : { phase: 'main', sub: 'play' });
  }
  // main as it ends: its end trigger when it plays on this outcome, else cleanup
  function toCleanup(turn, s, outcome) {
    const t = turn.end, plays = t && t.when.indexOf(outcome) >= 0;
    return leave(s, plays ? { phase: 'main', sub: 'end', trigger: t, outcome } : { phase: 'cleanup', outcome });
  }
  /** A turn's first state: untap at its first pick; upkeep with nothing to pick, or with the picks carried (a retry). */
  function beginTurn(turn, opts) {
    const o = opts || {}, base = { level: o.level || null, picks: Object.assign({}, o.picks || {}) };
    if (o.again) base.again = true;
    if (!turn.picks.length || o.picks) return Object.assign(base, { phase: 'upkeep' });
    return Object.assign(base, { phase: 'untap', at: 0 });
  }
  /** The state an event leads to (null: the event means nothing here; a choice that cannot stand keeps the pick, with `why`). */
  function stepTurn(turn, s, event, ctx) {
    const e = typeof event === 'string' ? { event } : event || {}, name = e.event;
    if (s.phase === 'untap') {
      const pick = turn.picks[s.at];
      if (name === 'back') {
        if (s.at === 0) return leave(s, { phase: 'out', exit: 'back' });
        const picks = Object.assign({}, s.picks);
        delete picks[turn.picks[s.at - 1].id];
        return leave(copy(s, { picks }), { phase: 'untap', at: s.at - 1 });
      }
      if (!('pick' in e)) return null;
      const why = pickErrors(pick, e.pick, ctx);
      if (why.length) return copy(s, { why: why.join('; ') });
      const picks = Object.assign({}, s.picks);
      if (e.pick === undefined || e.pick === null || (Array.isArray(e.pick) && !e.pick.length)) delete picks[pick.id];
      else picks[pick.id] = pick.max === 1 && Array.isArray(e.pick) ? e.pick[0] : pick.max > 1 && !Array.isArray(e.pick) ? [e.pick] : e.pick;
      const next = leave(copy(s, { picks }), {});
      return s.at + 1 < turn.picks.length ? Object.assign(next, { phase: 'untap', at: s.at + 1 }) : Object.assign(next, { phase: 'upkeep' });
    }
    if (s.phase === 'upkeep') {
      if (name === 'ready') return toMain(turn, s, ctx);
      // a load that failed: back to the last pick with its reason; with nothing to pick, out of the turn
      if ('fail' in e) return turn.picks.length ? leave(s, { phase: 'untap', at: turn.picks.length - 1, why: String(e.fail || 'the level did not load') }) : leave(s, { phase: 'out', exit: 'failed', why: String(e.fail || 'the level did not load') });
      return null;
    }
    if (s.phase === 'main') {
      if (s.sub === 'start') return name === 'scene-end' ? leave(s, { phase: 'main', sub: 'play' }) : null;
      if (s.sub === 'end') return name === 'scene-end' ? leave(s, { phase: 'cleanup', outcome: s.outcome }) : null;
      if (name === 'interrupt') return s.paused ? null : copy(s, { paused: true });
      if (name === 'resume') return s.paused ? leave(s, { phase: 'main', sub: 'play' }) : null;
      if (name === 'quit') return s.paused ? toCleanup(turn, s, 'left') : null;
      // (restart: the level loaded again with the same picks, as a retry is)
      if (name === 'restart') return s.paused ? { phase: 'upkeep', level: s.level, picks: s.picks, again: true } : null;
      if ('outcome' in e && OUTCOMES.indexOf(e.outcome) >= 0) return s.paused ? null : toCleanup(turn, s, e.outcome);
      return null;
    }
    if (s.phase === 'cleanup') return 'applied' in e ? leave(s, { phase: 'end', outcome: s.outcome, ok: !!e.applied }) : null;
    if (s.phase === 'end') {
      if (name === 'retry') return { phase: 'upkeep', level: s.level, picks: s.picks, again: true };
      return typeof name === 'string' && name ? leave(s, { phase: 'out', exit: name, outcome: s.outcome }) : null;
    }
    return null;
  }
  /** The headless walk: the states a run of events visits; stops where an event means nothing ({ stuck, at }). */
  function walkTurn(turn, events, opts, ctx) {
    let s = beginTurn(turn, opts);
    const seen = [s];
    for (const e of events) {
      const next = stepTurn(turn, s, e, ctx);
      if (!next) { seen.push({ stuck: typeof e === 'string' ? e : Object.keys(e)[0], at: s.phase }); break; }
      s = next;
      seen.push(s);
    }
    return seen;
  }
  /**
   * What the picks hand the level: { picks: { <id>: … } } for the game's own words (a difficulty), and
   * { slices: { <slice>: [ids] } }, which members of a consumed slice go in (the shell carries those and no others).
   */
  function turnParams(turn, s) {
    const picks = {}, slices = {};
    for (const p of turn.picks) {
      const v = s.picks[p.id];
      if (v === undefined) continue;
      if (isObj(p.from) && p.from.slice) slices[p.from.slice] = Array.isArray(v) ? v.slice() : [v];
      else picks[p.id] = v;
    }
    return { picks, slices };
  }
  return { beginTurn, stepTurn, walkTurn, pickErrors, turnParams };
}
const TK = buildTurnKernel();

/** A turn's first state. */
export const beginTurn = (turn, opts = {}) => TK.beginTurn(turn, opts);
/** The state an event leads to (null: the event means nothing here). */
export const stepTurn = (turn, state, event, ctx = {}) => TK.stepTurn(turn, state, event, ctx);
/** The headless walk: the states a run of events visits. */
export const walkTurn = (turn, events, opts = {}, ctx = {}) => TK.walkTurn(turn, events, opts, ctx);
/** Why a choice cannot stand ([]: it can). */
export const pickErrors = (pick, value, ctx = {}) => TK.pickErrors(pick, value, ctx);
/** What the picks hand the level: the game's own words, and which members of each consumed slice go in. */
export const turnParams = (turn, state) => TK.turnParams(turn, state);

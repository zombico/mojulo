/**
 * level-contract — validate the `game:` channel a level's world manifest carries, plus the
 * shell↔level postMessage wire shapes (game-metacontext.plan.md).
 *
 * A LEVEL is a pure function: (recipe, params, seed, input ticks) → outcome envelope. The
 * contract is its declared signature —
 *
 *   game: {
 *     levelRef,                         // how the shell/game manifest names this level
 *     consumes: [{ slice, pick? }],     // store slices that parameterize the level;
 *                                       //   pick: { max } renders a picker on the setup screen
 *     produces: {                       // the outcome envelope's allowed shape
 *       results?: ['success','fail','abort'],
 *       events: [{ type, slice, max? }] // ONLY these typed events may come back
 *     },
 *     presets: { <name>: params },      // shell-less fallback: a level with no parent runs
 *                                       //   its 'default' preset — playable standalone in dev
 *     on?: { '<busEventPattern>': { emit: <typed event> } | { end: 'success'|'fail' } }
 *                                       // declarative bus → game mapping (mirrors audio.on)
 *     complete?: false | { text? }      // the in-level RESULT CARD (hud-widgets.js language):
 *                                       //   false hides it, text retitles it; absent → "level complete"
 *   }
 *
 * Envelope validation lives in the STORE KERNEL (one validator, shipped in the artifact and
 * used at design time alike) — this module validates the design-time contract with teaching
 * errors and defines the wire protocol constants both sides speak.
 */

import { buildGameStoreKernel } from './store-kernel.js';

const K = buildGameStoreKernel();

export const CONTRACT_VERSION = K.CONTRACT_VERSION;
export const RESULTS = ['success', 'fail', 'abort'];

// postMessage wire (versioned both directions; the shell refuses on mismatch):
//   level → shell  { moj: MSG_READY,   contractVersion, levelRef }
//   shell → level  { moj: MSG_INIT,    contractVersion, params, seed }
//   level → shell  { moj: MSG_OUTCOME, envelope }
// The envelope may carry an optional `stats` payload ({ pilot, rows }) beside its events —
// pure presentation (the shell's score screen); the store only ever applies `events`.
export const MSG_READY = 'game-ready';
export const MSG_INIT = 'game-init';
export const MSG_OUTCOME = 'game-outcome';
// a DOOR crossed (non-terminal): the level leaves through one of its door ends, carrying what its session has
// gathered so far (an envelope whose result is 'transit'); the shell applies it, then loads the level the door
// links to, entered at the door it pairs with (game-init params.__entry: { door }).
//   level → shell  { moj: MSG_DOOR, levelRef, door, envelope }
export const MSG_DOOR = 'game-door';
// presentation-only sidecars (unversioned, safe to ignore):
//   shell → level  { moj: MSG_AUDIO, on, volume }        — settings panel audio prefs → beats channel
//   shell → level  { moj: MSG_PAUSE, on }                — pause menu freezes / resumes the sim
//   level → shell  { moj: MSG_CONTROLS, rows: [[k,v]] }  — the live controls legend, replied on pause
//   shell → level  { moj: MSG_GAMEPAD, on, deadZone, lookScale, invertY }
//                                                        — controller prefs → the world's gamepad poll
//   shell → level  { moj: MSG_AI, on }                   — practice-mode AI attack switch; the world
//                                                          converges via the same input edge the G key uses
//                                                          (the MSG_CONTROLS reply carries `ai: { on }` when
//                                                          the level offers the switch)
export const MSG_AUDIO = 'game-audio';
export const MSG_PAUSE = 'game-pause';
export const MSG_CONTROLS = 'game-controls';
export const MSG_GAMEPAD = 'game-gamepad';
export const MSG_AI = 'game-ai';

export function validateLevelContract(game, schema) {
  const errors = [];
  if (!game || typeof game !== 'object') return { ok: false, errors: ['game channel must be an object'] };
  if (!game.levelRef || typeof game.levelRef !== 'string') errors.push('game.levelRef is required (string) — the name the game manifest and envelopes use for this level');

  const sliceKinds = new Map(((schema && schema.slices) || []).map((s) => [s.name, s.kind]));
  const checkSlice = (name, where) => {
    if (!name || typeof name !== 'string') { errors.push(`${where}.slice is required (string)`); return; }
    if (schema && !sliceKinds.has(name)) errors.push(`${where}.slice "${name}" is not declared in the game's store schema (slices: ${[...sliceKinds.keys()].join(', ') || 'none'})`);
  };

  if (game.consumes !== undefined) {
    if (!Array.isArray(game.consumes)) errors.push('game.consumes must be an array of { slice, pick? }');
    else game.consumes.forEach((c, i) => {
      const where = `game.consumes[${i}]`;
      if (!c || typeof c !== 'object') { errors.push(`${where} must be { slice, pick? }`); return; }
      checkSlice(c.slice, where);
      if (c.pick !== undefined && (!c.pick || typeof c.pick !== 'object' || !Number.isInteger(c.pick.max) || c.pick.max < 1)) {
        errors.push(`${where}.pick must be { max: positive integer } — how many roster members / items the setup screen lets the player take`);
      }
    });
  }

  if (!game.produces || typeof game.produces !== 'object') {
    errors.push('game.produces is required: { results?, events: [{ type, slice, max? }] } — the outcome envelope\'s allowed shape');
  } else {
    if (game.produces.results !== undefined) {
      if (!Array.isArray(game.produces.results) || !game.produces.results.length) errors.push('game.produces.results must be a non-empty subset of: ' + RESULTS.join(', '));
      else game.produces.results.forEach((r) => { if (!RESULTS.includes(r)) errors.push(`game.produces.results: "${r}" is not a result (${RESULTS.join(', ')})`); });
    }
    if (!Array.isArray(game.produces.events)) {
      errors.push('game.produces.events is required (array, may be empty): the ONLY typed events this level may emit back to the store');
    } else {
      game.produces.events.forEach((e, i) => {
        const where = `game.produces.events[${i}]`;
        if (!e || typeof e !== 'object') { errors.push(`${where} must be { type, slice, max? }`); return; }
        if (!K.EVENT_TYPES.includes(e.type)) errors.push(`${where}.type "${e.type}" is not a typed event (${K.EVENT_TYPES.join(', ')})`);
        checkSlice(e.slice, where);
        const kind = sliceKinds.get(e.slice);
        if (kind && K.EVENTS_BY_KIND[kind] && !K.EVENTS_BY_KIND[kind].includes(e.type)) {
          errors.push(`${where}: slice "${e.slice}" (${kind}) does not accept "${e.type}" (accepts: ${K.EVENTS_BY_KIND[kind].join(', ')})`);
        }
        if (e.max !== undefined && (!Number.isInteger(e.max) || e.max < 1)) errors.push(`${where}.max must be a positive integer`);
      });
    }
  }

  if (game.presets !== undefined) {
    if (!game.presets || typeof game.presets !== 'object' || Array.isArray(game.presets)) errors.push('game.presets must be { <name>: params } — a level with no shell runs its "default" preset');
    else for (const [name, p] of Object.entries(game.presets)) {
      if (!p || typeof p !== 'object') errors.push(`game.presets.${name} must be a params object`);
    }
  }

  if (game.complete !== undefined && game.complete !== false) {
    if (!game.complete || typeof game.complete !== 'object' || Array.isArray(game.complete) || (game.complete.text !== undefined && typeof game.complete.text !== 'string')) {
      errors.push("game.complete must be false (no result card) or { text? } (the result card's title)");
    }
  }

  // POWERS: what a power key gives its holder in a map game. { slice, target, grants: { <power>: { <rule knob>: number } } }:
  // the held ones apply at start, one picked up applies when the bus hears pickup:<power>.
  if (game.powers !== undefined) {
    const p = game.powers, num = (o) => o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length && Object.values(o).every((v) => typeof v === 'number' && Number.isFinite(v));
    if (!p || typeof p !== 'object' || typeof p.slice !== 'string' || !p.slice || typeof p.target !== 'string' || !p.target || !p.grants || typeof p.grants !== 'object' || Array.isArray(p.grants)) {
      errors.push('game.powers is { slice, target, grants: { <power>: { <rule knob>: number } } }: the slice the powers are held in, the entity they move, and what each changes');
    } else {
      for (const [id, g] of Object.entries(p.grants)) if (!num(g)) errors.push(`game.powers.grants.${id} is { <rule knob>: number } (airJumps, glideFall, jumpSpeed…)`);
      if (!(game.consumes || []).some((c) => c && c.slice === p.slice)) errors.push(`game.powers.slice '${p.slice}' is not consumed: add { slice: '${p.slice}' } to game.consumes, or the level never hears what is held`);
    }
  }

  // FLAGS: the store flags a level's scenes read and set (playscape/ui/scenes.js), pushed onto the bus at start.
  if (game.flags !== undefined) {
    const f = game.flags;
    const consumed = (sl) => (game.consumes || []).some((c) => c && c.slice === sl);
    if (!f || typeof f !== 'object' || !Array.isArray(f.names) || !f.names.every((n) => typeof n === 'string' && n) || (f.names.length && !(typeof f.slice === 'string' && f.slice))) errors.push('game.flags is { slice, names: [flag], items?, done? }: the flags slice and the flags the level reads');
    else {
      for (const sl of [f.slice, ...(f.items ? f.items.slices || [] : []), ...(f.done ? [f.done.slice] : [])]) if (sl && !consumed(sl)) errors.push(`game.flags reads the slice '${sl}', which is not consumed: add { slice: '${sl}' } to game.consumes`);
      if (f.items !== undefined && !(f.items && Array.isArray(f.items.slices) && Array.isArray(f.items.names))) errors.push('game.flags.items is { slices: [inventory slice], names: [item] }');
      if (f.done !== undefined && !(f.done && typeof f.done.slice === 'string' && f.done.levels && typeof f.done.levels === 'object')) errors.push('game.flags.done is { slice, levels: { <name>: <level ref> } }');
    }
  }

  // ARRIVE: the levels a map game travels in from. The shell's `arrive` param names one, the level hears `arrive:<ref>`
  // on its first frame, and its own events move the pilot to that end of the level.
  if (game.arrive !== undefined && !(Array.isArray(game.arrive) && game.arrive.length && game.arrive.every((r) => typeof r === 'string' && r))) {
    errors.push('game.arrive is [<level ref>, …]: the levels a map game travels in from (each heard as arrive:<ref> on the first frame)');
  }

  // the level's door ends (the `door` mechanic): where each is, and where a walker entering by it stands
  if (game.doors !== undefined) {
    if (!Array.isArray(game.doors)) errors.push('game.doors must be [{ id, at, spawn, heading }]');
    else game.doors.forEach((d, i) => { if (!d || typeof d.id !== 'string' || !Array.isArray(d.spawn)) errors.push(`game.doors[${i}] must be { id, at, spawn: [x, y, z], heading }`); });
  }

  // BAG: the inventory slice the player's bag is carried in (the bag mechanic): filled at the start, kept as it changes
  if (game.bag !== undefined && !(game.bag && typeof game.bag.slice === 'string' && (game.consumes || []).some((c) => c && c.slice === game.bag.slice))) {
    errors.push('game.bag is { slice }: an inventory slice the level consumes (the bag carried in, and kept as it changes)');
  }
  // AFTERMATH: the flags slice the level keeps its broken blocks in (the aftermath mechanic), restored on entry
  if (game.aftermath !== undefined && !(game.aftermath && typeof game.aftermath.slice === 'string' && (game.consumes || []).some((c) => c && c.slice === game.aftermath.slice))) {
    errors.push('game.aftermath is { slice }: a flags slice the level consumes (its broken blocks, kept and restored)');
  }

  // KEEP: the numbers a level reports at its end (a score, a time), each kept best by the shell: { var, label, best:
  // 'high' | 'low', scale?, unit? } (the laps and score mechanics write them)
  if (game.keep !== undefined) {
    if (!Array.isArray(game.keep) || !game.keep.length) errors.push('game.keep is [{ var, label, best: high | low, scale?, unit? }]');
    else game.keep.forEach((k, i) => { if (!k || typeof k.var !== 'string' || typeof k.label !== 'string' || (k.best !== 'high' && k.best !== 'low') || (k.scale !== undefined && !Number.isFinite(k.scale)) || (k.unit !== undefined && typeof k.unit !== 'string')) errors.push(`game.keep[${i}] is { var, label, best: 'high' | 'low', scale?, unit? }`); });
  }

  if (game.on !== undefined) {
    if (!game.on || typeof game.on !== 'object' || Array.isArray(game.on)) errors.push('game.on must be { "<busEventPattern>": { emit: <typed event> } | { end: result } }');
    else for (const [pat, action] of Object.entries(game.on)) {
      const where = `game.on["${pat}"]`;
      if (!action || typeof action !== 'object') { errors.push(`${where} must be { emit } or { end }`); continue; }
      const keys = ['emit', 'end', 'door'].filter((k) => action[k] !== undefined);
      if (keys.length !== 1) { errors.push(`${where} needs exactly one of emit | end | door`); continue; }
      if (action.door !== undefined && !(Array.isArray(game.doors) && game.doors.some((d) => d && d.id === action.door))) errors.push(`${where}.door '${action.door}' names no door in game.doors`);
      if (action.end !== undefined && !RESULTS.includes(action.end)) errors.push(`${where}.end must be one of: ${RESULTS.join(', ')}`);
      // a level left by one of several ways names it: the envelope carries `exit`, and a map game travels by it
      if (action.exit !== undefined && (action.end === undefined || typeof action.exit !== 'string' || !/^[a-z0-9][a-z0-9:_-]{0,63}$/.test(action.exit))) errors.push(`${where}.exit names the way the level was left (a short lower-case id), beside end`);
      if (action.emit !== undefined) {
        // an emitted event must itself be allowed by produces — check the pair here so the
        // authoring error surfaces at mint time, not as a rejected envelope at play time.
        const e = action.emit;
        if (!e || typeof e !== 'object' || !K.EVENT_TYPES.includes(e.type)) errors.push(`${where}.emit must be a typed event object`);
        else if (game.produces && Array.isArray(game.produces.events) && !game.produces.events.some((r) => r.type === e.type && r.slice === e.slice)) {
          errors.push(`${where}.emit (${e.type} → ${e.slice}) is not declared in game.produces.events`);
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

/** Normalize: fill defaults so the stored contract is self-contained. Never mutates input. */
export function normalizeLevelContract(game) {
  const g = JSON.parse(JSON.stringify(game));
  if (g.consumes === undefined) g.consumes = [];
  if (g.produces.results === undefined) g.produces.results = [...RESULTS];
  if (g.presets === undefined) g.presets = { default: {} };
  else if (!g.presets.default) g.presets.default = {};
  return g;
}

export { buildGameStoreKernel };

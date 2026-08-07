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

  if (game.on !== undefined) {
    if (!game.on || typeof game.on !== 'object' || Array.isArray(game.on)) errors.push('game.on must be { "<busEventPattern>": { emit: <typed event> } | { end: result } }');
    else for (const [pat, action] of Object.entries(game.on)) {
      const where = `game.on["${pat}"]`;
      if (!action || typeof action !== 'object') { errors.push(`${where} must be { emit } or { end }`); continue; }
      const keys = ['emit', 'end'].filter((k) => action[k] !== undefined);
      if (keys.length !== 1) { errors.push(`${where} needs exactly one of emit | end`); continue; }
      if (action.end !== undefined && !RESULTS.includes(action.end)) errors.push(`${where}.end must be one of: ${RESULTS.join(', ')}`);
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

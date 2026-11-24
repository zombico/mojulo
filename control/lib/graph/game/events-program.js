/**
 * A PROGRAM FOR PLAY — a level's `events.program: { source, params?, seed?, budgetMs? }`, run in the code realm
 * (polygonizer/code-realm.js) as the level is resolved, the way a workbench's program makes its parts
 * (worlds/workbench-program.js). The program is the body of `(params, ctx) => bus data` and RETURNS what the event bus
 * runs (worlds/event-bus.js): { vars?, sources?, reactions?, watches?, timers?, sequences?, hud? }. Its rows join the
 * level's own hand-written ones (after them, as the mechanics' join after both; a variable the hand sets keeps the
 * hand's value), and the program itself never reaches the page: the page runs data only, so it needs no fence of its own, and
 * the same program re-resolves to the same bytes. Logic past what the mechanics say is written here, in the recipe,
 * never as a change to the runtime.
 *
 * Determinism is the realm's: no clock, no network, `Math.random` its seed's. A program that throws or runs past its
 * budget fails the resolve with its message and its captured `console.log` lines.
 *
 *   ctx      { anchors: { <name>: [x, y, z] }, entities: [<id>] }: the level as resolved, a copy (nothing written back)
 *   EVENTS_PROGRAM_CHANNELS   the bus channels a program may return
 *   lowerEventsProgram(events, level?) → the events block with `program` gone and the program's data joined to its own
 *                                        rows; a block without a program comes back as it was. Throws
 *                                        `events.program: …`, teaching
 */
import { runCodeRealm, validateProgram, sourceHash } from '../polygonizer/code-realm.js';
import { mergeEventManifests } from './level-synth.js';

export const EVENTS_PROGRAM_CHANNELS = Object.freeze(['vars', 'sources', 'reactions', 'watches', 'timers', 'sequences', 'hud']);
const MAX_CACHED = 64;
const cache = new Map();
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (m, log) => { const e = new Error(`events.program: ${m}${log && log.length ? `\nprogram log:\n  ${log.join('\n  ')}` : ''}`); e.log = log || []; return e; };

// the program's return, checked: an object of the bus's channels, each array a list of rows, `vars` names to values
function readReturn(value, log) {
  if (!isObj(value)) throw fail(`the program returns the bus's data, an object { ${EVENTS_PROGRAM_CHANNELS.join('?, ')}? } (got ${Array.isArray(value) ? 'a list' : JSON.stringify(value)})`, log);
  for (const [k, v] of Object.entries(value)) {
    if (!EVENTS_PROGRAM_CHANNELS.includes(k)) throw fail(`'${k}' is not a channel a program returns (${EVENTS_PROGRAM_CHANNELS.join(', ')})`, log);
    if (k === 'vars') { if (!isObj(v)) throw fail('vars is { <name>: <value> }', log); continue; }
    if (!Array.isArray(v) || v.some((row) => !isObj(row))) throw fail(`${k} is a list of rows, each an object`, log);
  }
  return value;
}

export function lowerEventsProgram(events, level = {}) {
  if (!isObj(events) || events.program === undefined) return events;
  const { program, ...own } = events;
  if (!isObj(program)) throw fail('is { source, params?, seed?, budgetMs? }: the body of (params, ctx) => the bus\'s data');
  const errs = validateProgram(program, 'events.program');
  if (errs.length) throw fail(errs.join('; '));
  const ctx = JSON.parse(JSON.stringify({ anchors: isObj(level.anchors) ? level.anchors : {}, entities: Array.isArray(level.entities) ? level.entities : [] }));
  const key = JSON.stringify([sourceHash(program.source), program.params ?? {}, program.seed ?? 0, ctx]);
  let data = cache.get(key);
  if (!data) {
    let out;
    try {
      out = runCodeRealm({ source: program.source, params: program.params ?? {}, seed: program.seed ?? 0, budgetMs: program.budgetMs, ctx });
    } catch (err) {
      throw fail(err.message, err.log);
    }
    data = readReturn(out.value, out.log);
    if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value);
    cache.set(key, data);
  }
  // (a copy each resolve: the bus's rows are the page's, never the cache's)
  const merged = mergeEventManifests(own, structuredClone(data)) ?? {};
  if (isObj(own.vars) && isObj(data.vars)) merged.vars = { ...data.vars, ...own.vars };
  return merged;
}

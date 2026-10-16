/**
 * THE BUS CONTRACT — what a world's behaviour takes from the world (FACTS) and gives back (EFFECTS). The bus itself is
 * one reducer on every kernel (the web's buildBus; Godot's kernel/bus.gd, held equal by the bus corpus), so what an
 * engine lacks is never the logic: it is a fact nothing feeds in, or an effect nothing draws. A page effect is mostly a
 * bus VAR the page watches (an open menu is ui-menu-<id> = 1, a forced sky is weather-force:<cue>), so an engine's
 * adapter is a var watcher.
 *
 *   BUS_ABI                       { facts, effects }: id → { about, web }   status: built | partial | absent
 *   busCoverage(events, engine?)  the rows a world's lowered events use, and what the engine's kernel performs of them,
 *                                 does in part, and does not: { used: [id], [engine]: { built, partial, absent } }
 *
 * Which rows an engine performs is the engine's own: its marks module's BUS_MARKS (engines/registry.js), changed in the
 * step that builds the adapter. An engine without marks performs none.
 */
import { DEFAULT_ENGINE, marksOf } from './engines/registry.js';
import { CAST_WHEN } from '../playscape/ui/cast.js';
import { PHASE_VAR, WEATHER_VAR } from '../playscape/ui/cues.js';
import { buildBus } from '../worlds/event-bus.js';
import { buildCast } from '../worlds/controllable/cast.js';
import { STAT_OPS } from '../playscape/stats/kernel.js';
import { STAT_WHEN, statFire } from '../playscape/stats/stats.js';

const B = 'built', P = 'partial', A = 'absent';

export const BUS_ABI = Object.freeze({
  facts: Object.freeze({
    zone: { about: 'a figure enters or leaves a zone (enter / exit)', web: B },
    use: { about: 'the interact press at a usable place (use-<place>)', web: B },
    start: { about: 'the level starts (the initial events)', web: B },
    timer: { about: 'heartbeats and a sequence\'s timed waits', web: B },
    contact: { about: 'physics contact and rest', web: B },
    input: { about: 'a key or a click bound to an event (events.inputs on key / pointer: a power\'s key, the status page)', web: B },
    aim: { about: 'a pick or a shot naming what the pointer is over (events.inputs on pick / fire)', web: B },
    cast: { about: 'a character\'s happenings: down, gone, spawned, arrive, stuck, faded', web: B },
    hit: { about: 'a character takes a hit: a blade, a round, a splash (hit:<id>, what hp-pool counts)', web: B },
    struck: { about: 'a beam reaches a character (struck)', web: B },
    stats: { about: 'the stats\' happenings: levelled, bought, denied, epoch, opened', web: B },
    menu: { about: 'a menu\'s pick or close (menu-pick:<menu>:<n>, menu-close:<menu>)', web: B },
    seen: { about: 'a character with sight newly sees its target (seen: what unseen ends on)', web: B },
    beat: { about: 'the music\'s beat, said early by its own clock (beat: what on-beat judges)', web: B },
  }),
  effects: Object.freeze({
    logic: { about: 'emit, set, inc, toggle, spawn, move on the bus\'s own entities and vars', web: B },
    guarded: { about: 'a reaction that fires only while its predicate holds (a reaction\'s if)', web: B },
    warp: { about: 'a move that sends the walker somewhere (a respawn, a teleport)', web: B },
    impulse: { about: 'a push on a physics body', web: B },
    hud: { about: 'banners, toasts, readouts and legends (score.hud)', web: B },
    menus: { about: 'a menu over the play (ui-menu-<id>)', web: B },
    parts: { about: 'a HUD part shown, hidden or restated by a cue (ui-<part>, ui-<part>-state)', web: B },
    phase: { about: 'the play\'s phase (title, playing, …): a part stands in its phases only', web: B },
    weather: { about: 'a cue forcing the sky (weather-force:<cue>)', web: B },
    cast: { about: 'a character op: spawn, vanish, walk, hurt, status, puff, shake (the ctrl verb)', web: B },
    rearm: { about: 'rounds for the weapon in a character\'s hand (the cast\'s rearm: a supply\'s ammo)', web: B },
    stats: { about: 'stats: raise, grant, xp, level, buy, buff, unbuff; a scaling on a cast op', web: B },
    entities: { about: 'the bus\'s own entities drawn as markers (a spawn appears, a toggle shows or hides, a move places it)', web: B },
    shot: { about: 'a directed shot on the camera: shot, unshot, finish (a scene\'s camera and its skip)', web: B },
  }),
});

// THE VERBS, read from the reducers themselves so a new one cannot go uncounted (bus-abi.test.js holds every verb to a
// row): the bus's own (event-bus.js applyVerb: `verb === '<x>'`), the cast's (controllable cast.js castOps:
// `op === '<x>'`) and the stats kernel's (STAT_OPS). Each verb's row:
export const BUS_VERBS = Object.freeze([...new Set([...buildBus.toString().matchAll(/\bverb === '([a-z-]+)'/g)].map((x) => x[1]))]);
export const CAST_OPS = Object.freeze([...new Set([...buildCast.toString().matchAll(/\bop === '([a-z-]+)'/g)].map((x) => x[1]))]);
export const VERB_ROW = Object.freeze({ emit: 'logic', set: 'logic', inc: 'logic', toggle: 'logic', spawn: 'logic', move: 'logic', impulse: 'impulse', ctrl: null });
// a ctrl op's row: a stat op is the stats', rearm is its own, a camera op is the shot's, every other the cast's
const SHOT_OPS = new Set(['shot', 'unshot', 'finish']);
export const ctrlRow = (op) => (STAT_OPS[op] ? 'stats' : op === 'rearm' ? 'rearm' : SHOT_OPS.has(op) ? 'shot' : 'cast');
// the stats' happenings as the bus hears them (stats.js statFire: a `levelled` cue waits on `level-up`)
const STAT_FIRES = new Set(Object.keys(STAT_WHEN).map((k) => statFire({ kind: k, of: 'player', id: 'x' }, 'x').on));

const has = (list) => Array.isArray(list) && list.length > 0;

// which rows the lowered events use, in contract order
function usedRows(ev) {
  const sources = ev.sources || [], reactions = ev.reactions || [], vars = ev.vars || {};
  const sets = new Set(reactions.filter((r) => r.do === 'set' || r.do === 'inc').map((r) => String(r.var)));
  const varUsed = (pred) => [...sets, ...Object.keys(vars)].some(pred);
  const on = reactions.map((r) => String(r.on));
  const facts = {
    zone: sources.some((s) => s && s.type === 'zone' && !s.use),
    use: sources.some((s) => s && s.type === 'zone' && s.use),
    start: has(ev.initial),
    timer: has(ev.timers) || (ev.sequences || []).some((q) => (q.steps || []).some((st) => st && st.await && st.await.timer != null)),
    contact: sources.some((s) => s && (s.type === 'contact' || s.type === 'rest')),
    input: (ev.inputs || []).some((i) => i && (i.on === 'key' || i.on === 'pointer')),
    aim: (ev.inputs || []).some((i) => i && (i.on === 'pick' || i.on === 'fire')),
    cast: on.some((t) => t in CAST_WHEN && t !== 'struck' && t !== 'seen'),
    hit: on.some((t) => t.startsWith('hit:')),
    struck: on.includes('struck'),
    stats: on.some((t) => STAT_FIRES.has(t)),
    menu: on.some((t) => t.startsWith('menu-pick:') || t.startsWith('menu-close:')),
    seen: on.includes('seen'),
    beat: on.includes('beat') || (ev.sequences || []).some((q) => q && q.trigger && q.trigger.on === 'beat'),
  };
  // every verb a reaction or a sequence's step performs, by its row
  const doers = [...reactions, ...(ev.sequences || []).flatMap((q) => (q && Array.isArray(q.steps) ? q.steps : []))].filter((r) => r && r.do);
  const rows = new Set(doers.map((r) => (r.do === 'ctrl' ? ctrlRow(r.op) : VERB_ROW[r.do])).filter(Boolean));
  const effects = {
    logic: rows.has('logic') || has(ev.watches) || has(ev.sequences),
    guarded: reactions.some((r) => r && r.if),
    warp: reactions.some((r) => r.do === 'move' && Array.isArray(r.to)),
    impulse: rows.has('impulse'),
    hud: has(ev.hud),
    menus: has(ev.menus) || varUsed((v) => v.startsWith('ui-menu-')),
    parts: varUsed((v) => v.startsWith('ui-') && !v.startsWith('ui-menu-')),
    phase: varUsed((v) => v === PHASE_VAR),
    weather: varUsed((v) => v.startsWith(`${WEATHER_VAR}:`)),
    cast: rows.has('cast'),
    rearm: rows.has('rearm'),
    stats: rows.has('stats') || !!ev.stats,
    // a bus entity is drawn as a marker: one the world declares, or one a reaction spawns
    entities: has(ev.entities) || doers.some((r) => r.do === 'spawn'),
    shot: rows.has('shot'),
  };
  return [...Object.keys(facts).filter((k) => facts[k]).map((k) => `fact:${k}`), ...Object.keys(effects).filter((k) => effects[k]).map((k) => `effect:${k}`)];
}

// a mark as the bus's status (approximated is the bus's partial)
const STATUS = { built: 'built', approximated: 'partial', absent: 'absent' };

export function busCoverage(events, engine = DEFAULT_ENGINE) {
  const by = { built: [], partial: [], absent: [] };
  if (!events || typeof events !== 'object') return { used: [], [engine]: by };
  const used = usedRows(events);
  const rows = marksOf(engine)?.BUS_MARKS;
  for (const id of used) {
    const [side, k] = id.split(':');
    by[rows ? STATUS[rows[side === 'fact' ? 'facts' : 'effects'][k][engine]] : 'absent'].push(id);
  }
  return { used, [engine]: by };
}

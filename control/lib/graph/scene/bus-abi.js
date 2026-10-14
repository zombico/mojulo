/**
 * THE BUS CONTRACT — what a world's behaviour takes from the world (FACTS) and gives back (EFFECTS), and which of
 * them each engine kernel performs. The bus itself is one reducer on every kernel (the web's buildBus; Godot's
 * kernel/bus.gd, held equal by scripts/godot-bus-conformance.mjs), so what an engine lacks is never the logic: it is
 * a fact nothing feeds in, or an effect nothing draws. A page effect is mostly a bus VAR the page watches (an open
 * menu is ui-menu-<id> = 1, a forced sky is weather-force:<cue>), so an engine's adapter is a var watcher.
 *
 *   BUS_ABI                 { facts, effects }: id → { about, web, godot, how? }   status: built | partial | absent
 *   busCoverage(events)     the rows a world's lowered events use, and for each kernel what it performs, does in part,
 *                           and does not: { used: [id], godot: { built, partial, absent } }
 *
 * A row's godot status says what kernel/level.gd does today; change it in the step that builds the adapter.
 */
import { CAST_WHEN } from '../playscape/ui/cast.js';
import { PHASE_VAR, WEATHER_VAR } from '../playscape/ui/cues.js';
import { buildBus } from '../worlds/event-bus.js';
import { buildCast } from '../worlds/controllable/cast.js';
import { STAT_OPS } from '../playscape/stats/kernel.js';
import { STAT_WHEN, statFire } from '../playscape/stats/stats.js';

const B = 'built', P = 'partial', A = 'absent';

export const BUS_ABI = Object.freeze({
  facts: Object.freeze({
    zone: { about: 'a figure enters or leaves a zone (enter / exit)', web: B, godot: B, how: 'kernel/bus.gd derive_zone_events over the walker, in recipe units' },
    use: { about: 'the interact press at a usable place (use-<place>)', web: B, godot: B, how: 'E inside a usable zone; the prompt shows the place\'s word' },
    start: { about: 'the level starts (the initial events)', web: B, godot: B },
    timer: { about: 'heartbeats and a sequence\'s timed waits', web: B, godot: B },
    contact: { about: 'physics contact and rest', web: B, godot: A, how: 'Godot runs its own physics; no body reports to the bus yet' },
    input: { about: 'a key or a click bound to an event (events.inputs on key / pointer: a power\'s key, the status page)', web: B, godot: B, how: 'level.gd: a key by the character it types (as the page\'s KeyboardEvent.key), a click anywhere' },
    aim: { about: 'a pick or a shot naming what the pointer is over (events.inputs on pick / fire)', web: B, godot: A, how: 'the page raycasts its markers; the Godot kernel has no markers to pick' },
    cast: { about: 'a character\'s happenings: down, gone, spawned, arrive, stuck, faded', web: B, godot: B, how: 'kernel/cast.gd castFacts' },
    hit: { about: 'a character takes a hit: a blade, a round, a splash (hit:<id>, what hp-pool counts)', web: B, godot: B, how: 'kernel/combat.gd deals the hero\'s hits (its blade, its rounds, their splash; a fall\'s blast hits nobody) and kernel/cast.gd tells the bus' },
    struck: { about: 'a beam reaches a character (struck)', web: B, godot: B, how: 'kernel/cast.gd: a beam is a moment that lands after its distance (the web\'s land rule), and its target hears struck' },
    stats: { about: 'the stats\' happenings: levelled, bought, denied, epoch, opened', web: B, godot: B, how: 'kernel/stats.gd, conformance-tested equal to the web\'s stats kernel' },
    menu: { about: 'a menu\'s pick or close (menu-pick:<menu>:<n>, menu-close:<menu>)', web: B, godot: B, how: 'level.gd: arrows or W / S, Enter / Space / E, Esc' },
    seen: { about: 'a character with sight newly sees its target (seen: what unseen ends on)', web: B, godot: A, how: 'the web mind counts sightings (perceive) and castFacts says them; Godot has no mind\'s perception yet' },
    beat: { about: 'the music\'s beat, said early by its own clock (beat: what on-beat judges)', web: B, godot: B, how: 'kernel/level.gd _beat_tick from the music player\'s position and score.beat, the page\'s clock as one function (beats/beat-clock.js); equal on the bus at the harness\'s fixed step' },
  }),
  effects: Object.freeze({
    logic: { about: 'emit, set, inc, toggle, spawn, move on the bus\'s own entities and vars', web: B, godot: B, how: 'the reducer itself, conformance-tested equal' },
    guarded: { about: 'a reaction that fires only while its predicate holds (a reaction\'s if)', web: B, godot: B, how: 'kernel/bus.gd _reaction_match reads if as buildBus reactionMatch does, conformance-tested equal (since 0.19.0)' },
    warp: { about: 'a move that sends the walker somewhere (a respawn, a teleport)', web: B, godot: B },
    impulse: { about: 'a push on a physics body', web: B, godot: P, how: 'the bus entity moves; no Godot body is linked to it' },
    hud: { about: 'banners, toasts, readouts and legends (score.hud)', web: B, godot: B, how: 'kernel/hud.gd: the slots, text / counter / bar / clock, banners, stacking toasts, legends, in the guide\'s tokens, font, frame and plate (score.hudStyle); the register\'s motion, sound, cursor and light and a stylized border stay the web\'s' },
    menus: { about: 'a menu over the play (ui-menu-<id>)', web: B, godot: B, how: 'level.gd: the open one centred on the guide\'s panel, its {var} words filled, a row per choice; keys, a gamepad (d-pad or stick, A, B) and the pointer' },
    parts: { about: 'a HUD part shown, hidden or restated by a cue (ui-<part>, ui-<part>-state)', web: B, godot: B, how: 'kernel/hud.gd gates a row by its part id and draws its state (disabled, alert, focus, active)' },
    phase: { about: 'the play\'s phase (title, playing, …): a part stands in its phases only', web: B, godot: B, how: 'kernel/hud.gd reads the phase var against a row\'s when' },
    weather: { about: 'a cue forcing the sky (weather-force:<cue>)', web: B, godot: B, how: 'kernel/weather.gd force(): the newest force eased in over its blend, held, eased back (fog, colour, light; falls and lightning stay web)' },
    cast: { about: 'a character op: spawn, vanish, walk, hurt, status, puff, shake (the ctrl verb)', web: B, godot: P, how: 'kernel/cast.gd: spawn, vanish, kill, hurt, heal, walk, stop, status, lift, transfigure, shake, puff and explosion, beam (level.gd draws them simpler than the page); a walk has no collider push-out or ground snap; transits stay on the web' },
    rearm: { about: 'rounds for the weapon in a character\'s hand (the cast\'s rearm: a supply\'s ammo)', web: B, godot: B, how: 'kernel/cast.gd rearm into the weapon\'s reserve, which kernel/combat.gd\'s reload draws from (since 0.22.0), held equal by the combat corpus' },
    stats: { about: 'stats: raise, grant, xp, level, buy, buff, unbuff; a scaling on a cast op', web: B, godot: B, how: 'kernel/stats.gd inside the bus\'s watch fixpoint; bound bodies onto the cast and the walker\'s pace' },
    entities: { about: 'the bus\'s own entities drawn as markers (a spawn appears, a toggle shows or hides, a move places it)', web: B, godot: A, how: 'the page draws them (events.js __markerMeshes); kernel/level.gd builds their state and draws nothing' },
    shot: { about: 'a directed shot on the camera: shot, unshot, finish (a scene\'s camera and its skip)', web: B, godot: A, how: 'worlds/controllable cast.js sets the shot rule aside the camera\'s own; the Godot kernel has no camera rule to set aside' },
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
    // a bus entity is drawn as a marker on the page: one the world declares, or one a reaction spawns. A collect
    // pickup's (pk_<i>_<j>, mechanics.js) is drawn by the kernel's own mechanic (level.gd _build_mechanics), not here
    entities: (ev.entities || []).some((e) => e && !/^pk_\d+_\d+$/.test(String(e.id))) || doers.some((r) => r.do === 'spawn'),
    shot: rows.has('shot'),
  };
  return [...Object.keys(facts).filter((k) => facts[k]).map((k) => `fact:${k}`), ...Object.keys(effects).filter((k) => effects[k]).map((k) => `effect:${k}`)];
}

export function busCoverage(events) {
  if (!events || typeof events !== 'object') return { used: [], godot: { built: [], partial: [], absent: [] } };
  const used = usedRows(events);
  const godot = { built: [], partial: [], absent: [] };
  for (const id of used) {
    const [side, k] = id.split(':');
    godot[BUS_ABI[side === 'fact' ? 'facts' : 'effects'][k].godot].push(id);
  }
  return { used, godot };
}

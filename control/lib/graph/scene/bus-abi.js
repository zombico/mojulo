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

const B = 'built', P = 'partial', A = 'absent';
const STAT_WHEN = ['levelled', 'bought', 'denied', 'epoch', 'opened'];

export const BUS_ABI = Object.freeze({
  facts: Object.freeze({
    zone: { about: 'a figure enters or leaves a zone (enter / exit)', web: B, godot: B, how: 'kernel/bus.gd derive_zone_events over the walker, in recipe units' },
    use: { about: 'the interact press at a usable place (use-<place>)', web: B, godot: B, how: 'E inside a usable zone; the prompt shows the place\'s word' },
    start: { about: 'the level starts (the initial events)', web: B, godot: B },
    timer: { about: 'heartbeats and a sequence\'s timed waits', web: B, godot: B },
    contact: { about: 'physics contact and rest', web: B, godot: A, how: 'Godot runs its own physics; no body reports to the bus yet' },
    input: { about: 'a key or pointer bound to an event (events.inputs)', web: B, godot: A },
    cast: { about: 'a character\'s happenings: down, gone, spawned, arrive, stuck, faded, struck', web: B, godot: B, how: 'kernel/cast.gd castFacts (struck waits on beams)' },
    stats: { about: 'the stats\' happenings: levelled, bought, denied, epoch, opened', web: B, godot: A },
    menu: { about: 'a menu\'s pick or close (menu-pick:<menu>:<n>, menu-close:<menu>)', web: B, godot: B, how: 'level.gd: arrows or W / S, Enter / Space / E, Esc' },
  }),
  effects: Object.freeze({
    logic: { about: 'emit, set, inc, toggle, spawn, move on the bus\'s own entities and vars', web: B, godot: B, how: 'the reducer itself, conformance-tested equal' },
    warp: { about: 'a move that sends the walker somewhere (a respawn, a teleport)', web: B, godot: B },
    impulse: { about: 'a push on a physics body', web: B, godot: P, how: 'the bus entity moves; no Godot body is linked to it' },
    hud: { about: 'banners, toasts, readouts and legends (score.hud)', web: B, godot: P, how: 'level.gd paints them as plain text lines: no slots, bars or the UI guide\'s style' },
    menus: { about: 'a menu over the play (ui-menu-<id>)', web: B, godot: P, how: 'level.gd draws the open one as a plain panel, its {var} words filled; no UI guide style, no pad or pointer' },
    parts: { about: 'a HUD part shown, hidden or restated by a cue (ui-<part>)', web: B, godot: A },
    phase: { about: 'the play\'s phase (title, playing, …)', web: B, godot: A },
    weather: { about: 'a cue forcing the sky (weather-force:<cue>)', web: B, godot: A, how: 'kernel/weather.gd plays the schedule, not a cue\'s change' },
    cast: { about: 'a character op: spawn, vanish, walk, hurt, status, puff, shake (the ctrl verb)', web: B, godot: P, how: 'kernel/cast.gd: spawn, vanish, kill, hurt, heal, walk, stop, status, lift, transfigure, shake; a walk has no collider push-out or ground snap; puffs, beams and transits stay on the web' },
    stats: { about: 'stats: raise, grant, xp, level, buy', web: B, godot: A },
  }),
});

const has = (list) => Array.isArray(list) && list.length > 0;
const STAT_OP = new Set(['raise', 'grant', 'xp', 'level', 'buy', 'buff', 'unbuff']);

// which rows the lowered events use, in contract order
function usedRows(ev) {
  const sources = ev.sources || [], reactions = ev.reactions || [], vars = ev.vars || {};
  const sets = new Set(reactions.filter((r) => r.do === 'set' || r.do === 'inc').map((r) => String(r.var)));
  const varUsed = (pred) => [...sets, ...Object.keys(vars)].some(pred);
  const on = reactions.map((r) => String(r.on));
  const ctrl = reactions.filter((r) => r.do === 'ctrl');
  const facts = {
    zone: sources.some((s) => s && s.type === 'zone' && !s.use),
    use: sources.some((s) => s && s.type === 'zone' && s.use),
    start: has(ev.initial),
    timer: has(ev.timers) || (ev.sequences || []).some((q) => (q.steps || []).some((st) => st && st.await && st.await.timer != null)),
    contact: sources.some((s) => s && (s.type === 'contact' || s.type === 'rest')),
    input: has(ev.inputs),
    cast: on.some((t) => t in CAST_WHEN),
    stats: on.some((t) => STAT_WHEN.includes(t)),
    menu: on.some((t) => t.startsWith('menu-pick:') || t.startsWith('menu-close:')),
  };
  const effects = {
    logic: reactions.some((r) => ['emit', 'set', 'inc', 'toggle', 'spawn', 'move'].includes(r.do)) || has(ev.watches) || has(ev.sequences),
    warp: reactions.some((r) => r.do === 'move' && Array.isArray(r.to)),
    impulse: reactions.some((r) => r.do === 'impulse'),
    hud: has(ev.hud),
    menus: has(ev.menus) || varUsed((v) => v.startsWith('ui-menu-')),
    parts: varUsed((v) => v.startsWith('ui-') && !v.startsWith('ui-menu-')),
    phase: varUsed((v) => v === PHASE_VAR),
    weather: varUsed((v) => v.startsWith(`${WEATHER_VAR}:`)),
    cast: ctrl.some((r) => !STAT_OP.has(r.op)),
    stats: ctrl.some((r) => STAT_OP.has(r.op)) || !!ev.stats,
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

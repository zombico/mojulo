/**
 * CUES — one primitive for the UI answering the game. A cue says, in game words, WHEN the UI acts (a happening in
 * the world), WHAT it does (an effect on the UI) and UNTIL when; the pickup toast, the locked-door prompt, the
 * area-name banner, the low-health alert and the tutorial hint are all cues, not functions of their own.
 *
 *   play.cues: [{ id,
 *     when:  { enter | leave | near: '<zone>' | { anchor, r?, who? } | { at, r, who? } | { at, half, who? } }  (who: the one it watches)
 *                                                                       the figure walks into / out of / up to a zone (an
 *                                                                       anchor: any thing or place a map carries)
 *          | { use: '<place>' | '<id>' | { anchor, r? } | { at, r }, prompt? }   the figure uses a place (stands in reach and
 *                                                                       presses interact; the page shows the key and the prompt)
 *                                                                       or a thing (its `use-<id>` event, a door's click)
 *          | { take: '<item>' }                                             the figure picks an item up (its contact)
 *          | { var: '<name>', gte | gt | lte | lt | eq | ne }               a value crosses a line
 *          | { on: '<event>', match? }                                      any bus event
 *          | { start: true }                                                the level starts
 *          | { down | gone | spawned | stuck: '<who>' } | { arrive: '<who>' | { who, at? } }   the cast (cast.js)
 *          | { levelled | bought | denied | epoch | opened: … }              the stats (stats/stats.js)
 *     then:  effect | [effect, …]:
 *            { say: '<text>', as?: 'banner' | 'toast' | 'prompt', at?, ttl? }   words on screen
 *            { show: '<part id>' } | { hide: '<part id>' }                      a part comes or goes
 *            { state: '<part id>', to: '<UI state>' }                          a part's appearance state
 *            { phase: '<phase>' }                                              the level's phase
 *            { open: '<menu id>' } | { close: '<menu id>' | true }             a menu (menus.js) comes up or goes
 *            { set: '<var>', to } | { emit: '<event>' }                        the game's own state, for its rules to read
 *            { spawn | vanish | kill | hurt | heal | walk | stop: … }        the cast: a character (cast.js)
 *            { raise | grant | xp | level | buy: … }                       the stats (stats/stats.js); a cast number may be a scaling
 *     until?: a when | { ttl },                                             the effects end (shown → hidden, a prompt goes)
 *     once?:  true }]                                                       the first time only
 *
 * Every cue fires one bus event, `cue:<id>` (and `cue-end:<id>` when it ends), so any part can bind { on: 'cue:<id>' }.
 * `near` is an enter whose until is leaving the same zone. A zone given as an area becomes the cue's own planar zone.
 *
 *   CUE_WHEN, CUE_THEN       what a cue may name, one line each (the drawer's card)
 *   readCues(play)           → [{ id, when, then, until, once, page }] or throws, teaching
 *   readEffect(t, where, ctx) one effect, read (menus.js reads a choice's effects with it)
 *   lowerCues(play, { anchors, player, places }) → an events fragment (vars, sources, reactions, watches, initial, sequences, hud), or
 *                              null; `anchors` (the built map's, era/anchors.js) place a zone named by an anchor;
 *                              `player` (the walker's id) is the one a cue's zone watches; `places` (spots + anchors)
 *                              resolve the cast's walks and spawns
 *   lowerEffects(ts, on, frag, ctx)  effects onto the bus on one event (menus.js lowers its choices with it)
 *   unplacedAnchors(play, anchors)   the anchors cues name that the map does not carry
 *   cueVar(part), menuVar(menu), PHASE_VAR   the bus vars a show / hide / state / open / phase sets (the page reads them
 *                            in a later step)
 */
import { UI_STATES } from './parts.js';
import { regionOf, HUD_REGIONS } from './regions.js';
import { CAST_WHEN, CAST_THEN, readCastWhen, readCastEffect, castFire, lowerCastEffect } from './cast.js';
import { readLooks } from '../elements/elements.js';
import { readBeams } from '../elements/beams.js';
import { readExplosions } from '../elements/explosions.js';
import { STAT_WHEN, STAT_THEN, SCALABLE, readStats, readStatWhen, readStatEffect, readScaling, isScaling, readMods, statFire, lowerStatEffect, lowerStatusMods } from '../stats/stats.js';

export const CUE_WHEN = Object.freeze({
  enter: 'the figure walks into a zone: a zone the world declares, an anchor of the map { anchor, r? }, or an area { at, r } | { at, half }',
  leave: 'the figure walks out of a zone',
  near: 'the figure comes up to a zone; the cue ends when it walks away (the "press E" prompt)',
  use: 'the figure uses a place (a spot or an anchor, { anchor, r } or { at, r }: it stands there and presses interact, E; prompt: the word the page shows beside the key) or a thing (its use-<id> event)',
  take: 'the figure picks an item up (the item touching the figure)',
  var: 'a value crosses a line: { var, gte | gt | lte | lt | eq | ne }, each time it becomes true',
  on: 'any bus event (a glob), with match: { field: pattern }',
  start: 'the level starts',
  ...CAST_WHEN,
  ...STAT_WHEN,
});
export const CUE_THEN = Object.freeze({
  say: 'words on screen: a banner (replaces), a toast (stacks) or a prompt (at the bottom while the cue lasts; 4 s on the page today); {name} reads a var',
  show: 'a part (by its id) comes on',
  hide: 'a part goes',
  state: 'a part takes an appearance state: ' + UI_STATES.join(', '),
  phase: 'the level moves to a phase',
  open: 'a menu comes up (play.menus, by id): a sign to read, a talk, a shop, a chest, a save point…',
  close: 'a menu goes (by id, or true for whichever is up)',
  set: 'a game var takes a value ({ set: var, to }), for the game\'s rules to read',
  emit: 'a bus event, for the game\'s rules to react to',
  ...CAST_THEN,
  ...STAT_THEN,
});
export const SAY_AS = Object.freeze(['banner', 'toast', 'prompt']);
export const PROMPT_TTL = 4;
export const PHASE_VAR = 'phase';
export const cueVar = (part, state = false) => `ui-${part}${state ? '-state' : ''}`;
export const menuVar = (menu) => `ui-menu-${menu}`;
export const ANCHOR_REACH = 1.5;   // m round an anchor named with no r: arm's length and a step

const CMP = ['gte', 'gt', 'lte', 'lt', 'eq', 'ne'];
const ID = /^[a-z][a-z0-9-]*$/;
const isStr = (v) => typeof v === 'string' && v.length > 0;
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const pt = (p) => Array.isArray(p) && p.length >= 2 && p.slice(0, 3).every(Number.isFinite);

// a zone: a name the world declares, or an area the cue declares
function readZone(z, where) {
  if (isStr(z)) return { zone: z, area: null };
  // `who`: the character the zone watches (a glob) in place of the player
  if (isObj(z) && z.who !== undefined && !isStr(z.who)) throw new Error(`${where}.who is a character's id (a glob): the zone watches it in place of the player`);
  const who = isObj(z) && isStr(z.who) ? { who: z.who } : {};
  if (isObj(z) && isStr(z.anchor)) {
    if (z.r !== undefined && !(Number.isFinite(z.r) && z.r > 0)) throw new Error(`${where}.r is metres round the anchor`);
    return { zone: null, area: null, anchor: z.anchor, r: z.r ?? ANCHOR_REACH, ...who };
  }
  if (isObj(z) && pt(z.at) && ((Number.isFinite(z.r) && z.r > 0) || (Array.isArray(z.half) && z.half.length >= 2 && z.half.every((h) => Number.isFinite(h) && h > 0)))) {
    return { zone: null, area: { at: [z.at[0], z.at[1], z.at[2] ?? 0], ...(z.half ? { half: [z.half[0], z.half[1], z.half[2] ?? 1] } : { r: z.r }) }, ...who };
  }
  throw new Error(`${where} is a zone's name, an anchor { anchor: '<id>', r?, who? }, or an area { at: [x, y], r, who? } | { at, half: [hx, hy] }`);
}

function readWhen(w, where, ctx = {}) {
  if (!isObj(w)) throw new Error(`${where} is one happening: ${Object.keys(CUE_WHEN).join(', ')}`);
  const keys = Object.keys(CUE_WHEN).filter((k) => w[k] !== undefined);
  if (keys.length !== 1) throw new Error(`${where} names one happening (${Object.keys(CUE_WHEN).join(', ')}), not ${keys.length ? keys.join(' and ') : 'none'}`);
  const k = keys[0];
  if (k === 'enter' || k === 'leave' || k === 'near') return { kind: k, ...readZone(w[k], `${where}.${k}`) };
  if (k === 'use') {
    if (w.prompt !== undefined && !isStr(w.prompt)) throw new Error(`${where}.prompt is the word shown beside the interact key ('talk', 'open', 'read')`);
    const prompt = w.prompt ?? null;
    if (isStr(w.use)) return { kind: 'use', id: w.use, prompt };
    const z = readZone(w.use, `${where}.use`);
    return { kind: 'use', id: z.anchor || null, ...z, prompt };
  }
  if (k === 'take') { if (!isStr(w[k])) throw new Error(`${where}.${k} is a thing's id`); return { kind: k, id: w[k] }; }
  if (k === 'var') {
    if (!isStr(w.var)) throw new Error(`${where}.var is a bus var's name`);
    const c = CMP.filter((x) => w[x] !== undefined);
    if (!c.length) throw new Error(`${where}: a var crossing names its line: ${CMP.join(' | ')}`);
    return { kind: 'var', var: w.var, ...Object.fromEntries(c.map((x) => [x, w[x]])) };
  }
  if (CAST_WHEN[k]) return readCastWhen(k, w, where);
  if (STAT_WHEN[k]) return readStatWhen(k, w, where, ctx);
  if (k === 'on') {
    if (!isStr(w.on)) throw new Error(`${where}.on is a bus event (a glob)`);
    if (w.match !== undefined && !isObj(w.match)) throw new Error(`${where}.match is { field: pattern }`);
    return { kind: 'on', on: w.on, match: w.match || null };
  }
  if (w.start !== true) throw new Error(`${where}.start is true`);
  return { kind: 'start' };
}

export function readEffect(t, where, ctx = {}) {
  const { partIds = new Set(), phases = ['playing'], menuIds = new Set() } = ctx;
  if (!isObj(t)) throw new Error(`${where} is an effect: ${Object.keys(CUE_THEN).join(', ')}`);
  const keys = Object.keys(CUE_THEN).filter((k) => t[k] !== undefined);
  if (keys.length !== 1) throw new Error(`${where} does one thing (${Object.keys(CUE_THEN).join(', ')}), not ${keys.length ? keys.join(' and ') : 'none'}`);
  const k = keys[0];
  if (STAT_THEN[k]) return readStatEffect(k, t, where, ctx);
  // a stat-affected phenomenon: a scaling where the cast takes a number is read here, the rest as the cast reads it
  if (CAST_THEN[k] && SCALABLE[k] && isObj(t[k]) && SCALABLE[k].some((f) => isScaling(t[k][f])) && !(k === 'status' && t[k].mods !== undefined)) {
    const v = { ...t[k] }, sc = {};
    for (const f of SCALABLE[k]) if (isScaling(v[f])) { sc[f] = readScaling(v[f], `${where}.${k}.${f}`, ctx.stats); v[f] = 1; }
    return Object.assign(readCastEffect(k, { [k]: v }, where, ctx), sc);
  }
  // a status that carries modifiers on a holder's stats while it lasts (mods), and a lift that takes them off again
  if (k === 'status' && isObj(t.status) && t.status.mods !== undefined) {
    const { mods, ...rest } = t.status, w = `${where}.status`;
    if (!(ctx.stats && ctx.stats.holders.includes(rest.who))) throw new Error(`${w}.mods: modifiers go on a holder's stats (play.stats.holders: ${ctx.stats ? ctx.stats.holders.join(', ') : 'none'}), and '${rest.who}' is none`);
    if (isScaling(rest.for)) throw new Error(`${w}.for is seconds (a status that carries mods keeps a fixed time)`);
    return { ...readEffect({ status: rest }, where, ctx), mods: readMods(mods, `${w}.mods`, ctx.stats) };
  }
  if (CAST_THEN[k]) {
    const out = readCastEffect(k, t, where, ctx);
    if (out.op === 'lift' && ctx.stats && ctx.stats.holders.includes(out.who)) out.unbuff = true;
    return out;
  }
  if (k === 'say') {
    if (!isStr(t.say)) throw new Error(`${where}.say is the words`);
    const as = t.as ?? 'banner';
    if (!SAY_AS.includes(as)) throw new Error(`${where}.as is one of: ${SAY_AS.join(', ')}`);
    const region = t.at === undefined ? (as === 'prompt' ? 'bottom' : 'center') : regionOf(t.at);
    if (!region) throw new Error(`${where}.at is a screen region`);
    if (t.ttl !== undefined && !(Number.isFinite(t.ttl) && t.ttl > 0)) throw new Error(`${where}.ttl is seconds`);
    return { kind: 'say', say: t.say, as, region, ttl: t.ttl ?? null, page: HUD_REGIONS.includes(region) };
  }
  if (k === 'open' || k === 'close') {
    if (k === 'close' && t.close === true) return { kind: 'close', menu: null, page: false };
    if (!menuIds.has(t[k])) throw new Error(`${where}.${k} '${t[k]}' is no menu's id (${menuIds.size ? [...menuIds].join(', ') : 'play.menus is empty'})`);
    return { kind: k, menu: t[k], page: false };
  }
  if (k === 'set') {
    if (!isStr(t.set)) throw new Error(`${where}.set is a var's name`);
    if (!(typeof t.to === 'number' || typeof t.to === 'string' || typeof t.to === 'boolean')) throw new Error(`${where}.to is a number, a word or true / false`);
    return { kind: 'set', var: t.set, to: t.to, page: true };
  }
  if (k === 'emit') {
    if (!isStr(t.emit)) throw new Error(`${where}.emit is a bus event's name`);
    return { kind: 'emit', event: t.emit, page: true };
  }
  if (k === 'phase') {
    if (!phases.includes(t.phase)) throw new Error(`${where}.phase '${t.phase}' is not a phase of this play (${phases.join(', ')})`);
    return { kind: 'phase', phase: t.phase, page: false };
  }
  const part = t[k];
  if (!partIds.has(part)) throw new Error(`${where}.${k} '${part}' is no part's id (${partIds.size ? [...partIds].join(', ') : 'give a part an id: play.parts[i].id'})`);
  if (k === 'state') {
    if (!UI_STATES.includes(t.to)) throw new Error(`${where}.to is a UI state: ${UI_STATES.join(', ')}`);
    return { kind: 'state', part, to: t.to, page: false };
  }
  return { kind: k, part, page: false };
}

/** What effects may name in a play block: its part ids, its phases, its menu ids. */
export function effectContext(play, phases = (play && play.phases) || ['playing']) {
  const partIds = new Set();
  for (const p of (play && play.parts) || []) if (p && isStr(p.id)) { if (partIds.has(p.id)) throw new Error(`play.parts: two parts called '${p.id}'`); partIds.add(p.id); }
  const menuIds = new Set(((play && play.menus) || []).map((m) => m && m.id).filter(isStr));
  return { partIds, phases, menuIds, looks: readLooks(play), explosions: readExplosions(play), beams: readBeams(play), stats: readStats(play) };
}

/** The cues of a play block, read; shape errors throw and teach. */
export function readCues(play, phases = (play && play.phases) || ['playing']) {
  const list = play && play.cues;
  if (list === undefined) return [];
  if (!Array.isArray(list)) throw new Error('play.cues is a list of { id, when, then, until?, once? }');
  const ctx = effectContext(play, phases), seen = new Set();
  return list.map((c, i) => {
    const where = `play.cues[${i}]`;
    if (!isObj(c)) throw new Error(`${where} is { id, when, then, until?, once? }`);
    if (!isStr(c.id) || !ID.test(c.id)) throw new Error(`${where}.id '${c.id}' is a lower-case word`);
    if (seen.has(c.id)) throw new Error(`play.cues: two cues called '${c.id}'`);
    seen.add(c.id);
    const when = readWhen(c.when, `${where}.when`, ctx);
    const then = (Array.isArray(c.then) ? c.then : [c.then]).map((t, k) => readEffect(t, `${where}.then${Array.isArray(c.then) ? `[${k}]` : ''}`, ctx));
    if (!then.length) throw new Error(`${where}.then is one effect or a list of them`);
    let until = null;
    if (c.until !== undefined) {
      if (isObj(c.until) && Object.keys(c.until).length === 1 && c.until.ttl !== undefined) {
        if (!(Number.isFinite(c.until.ttl) && c.until.ttl > 0)) throw new Error(`${where}.until.ttl is seconds`);
        until = { kind: 'ttl', ttl: c.until.ttl };
      } else until = readWhen(c.until, `${where}.until`, ctx);
    } else if (when.kind === 'near') until = { kind: 'leave', zone: when.zone, area: when.area, anchor: when.anchor, r: when.r, ...(when.who ? { who: when.who } : {}), same: true };
    if (c.once !== undefined && typeof c.once !== 'boolean') throw new Error(`${where}.once is true or false`);
    return { id: c.id, when, then, until, once: c.once === true, page: then.every((t) => t.page) };
  });
}

/** The anchors the cues name that the built map does not carry. */
export function unplacedAnchors(play, anchors = []) {
  const have = new Set((anchors || []).map((a) => a.id)), out = [];
  for (const c of readCues(play)) for (const w of [c.when, c.until]) if (w && w.anchor && !have.has(w.anchor) && !out.includes(w.anchor)) out.push(w.anchor);
  return out;
}

// where a use happens: a place the map or the play carries (an anchor, a spot) or the cue's own area; null when the use
// names a thing (the event alone) or an anchor the map doesn't carry
function usePlace(w, zoneId, anchors) {
  if (w.area) return { id: zoneId, zone: `use-${zoneId}`, at: w.area.at, r: w.area.r, half: w.area.half };
  const a = (anchors || []).find((x) => x.id === (w.anchor || w.id));
  if (!a) return null;
  return { id: a.id, zone: `use-${a.id}`, at: [a.at[0], a.at[1], a.at[2] ?? 0], r: w.anchor ? w.r : ANCHOR_REACH };
}

// the bus side of a happening: the events that fire it, as reactions emitting `type`, plus the sources it needs
function fire(w, type, zoneId, anchors, player = null) {
  const out = { sources: [], reactions: [], watches: [], initial: [] };
  if (w.kind === 'enter' || w.kind === 'near' || w.kind === 'leave') {
    const zone = w.zone || zoneId;
    // an anchor's zone is a disc round it, where the built map put it (unplaced, nothing fires: the laws say so)
    const a = w.anchor ? (anchors || []).find((x) => x.id === w.anchor) : null, area = a ? { at: [a.at[0], a.at[1], a.at[2] ?? 0], r: w.r } : w.area;
    if (w.anchor && !a) return out;
    // the zone watches its `who`, else the player when the world names one (a walker's own props stand in their zones too)
    const watch = w.who || player;
    if (area && !w.same) out.sources.push({ type: 'zone', zone, at: area.at, ...(area.half ? { half: area.half } : { radius: area.r }), planar: true, ...(watch ? { watch } : {}) });
    out.reactions.push({ on: w.kind === 'leave' ? 'exit' : 'enter', match: { zone }, do: 'emit', type });
  } else if (w.kind === 'use') {
    // a place to use: a planar zone flagged `use` (standing in it is reach; the page sends use-<id> on the interact press)
    const u = usePlace(w, zoneId, anchors);
    if (u) out.sources.push({ type: 'zone', zone: u.zone, at: u.at, ...(u.half ? { half: u.half } : { radius: u.r }), planar: true, ...(player ? { watch: player } : {}), use: u.id, ...(w.prompt ? { prompt: w.prompt } : {}) });
    out.reactions.push({ on: `use-${u ? u.id : w.id}`, do: 'emit', type });
  }
  else if (w.kind === 'take') out.reactions.push({ on: 'contact', match: { a: w.id }, do: 'emit', type });
  else if (w.kind === 'on') out.reactions.push({ on: w.on, ...(w.match ? { match: w.match } : {}), do: 'emit', type });
  else if (w.kind === 'var') out.watches.push({ type, when: Object.fromEntries(['var', ...CMP].filter((k) => w[k] !== undefined).map((k) => [k, w[k]])) });
  else if (w.kind === 'start') out.initial.push({ type });
  else if (CAST_WHEN[w.kind]) out.reactions.push(castFire(w, type));
  else if (STAT_WHEN[w.kind]) out.reactions.push(statFire(w, type));
  return out;
}

const emptyFrag = () => ({ vars: {}, sources: [], reactions: [], watches: [], initial: [], sequences: [], hud: [] });
const shown = UI_STATES.indexOf('shown');

/**
 * Effects onto the bus, on one event: words become hud rows; show / hide / state / open / close / phase set the UI's
 * vars; set and emit are the game's own. `end` (when given) undoes what came up: a show is hidden, a state goes back
 * to shown, an opened menu closes (a phase, a set and an emit stay: they are the game's, not the moment's).
 */
export function lowerEffects(ts, on, frag, { phases = ['playing'], menuIds = new Set(), end = null, ttl = null, places = [] } = {}) {
  for (const t of ts) {
    if (t.kind === 'stat') { lowerStatEffect(t, on, frag); continue; }
    if (t.kind === 'cast') {
      lowerCastEffect(t, on, frag, places);
      if (t.op === 'status' && t.mods) lowerStatusMods(t, on, frag, end);
      if (t.op === 'lift' && t.unbuff) frag.reactions.push({ on, do: 'ctrl', op: 'unbuff', of: t.who, id: t.is ? `status:${t.is}` : 'status:*' });
      // a status with no time of its own comes off when the cue ends (as a shown part hides)
      if (end && t.op === 'status' && t.for === undefined) frag.reactions.push({ on: end, do: 'ctrl', op: 'lift', who: t.who, is: t.is });
      continue;
    }
    if (t.kind === 'say') {
      const life = t.ttl ?? ttl ?? (t.as === 'prompt' ? PROMPT_TTL : undefined);
      if (t.page) frag.hud.push({ on, ...(t.as === 'toast' ? { as: 'toast' } : {}), text: t.say, slot: t.region, ...(life ? { ttl: life } : {}) });
      continue;
    }
    if (t.kind === 'set') { frag.reactions.push({ on, do: 'set', var: t.var, to: t.to }); continue; }
    if (t.kind === 'emit') { frag.reactions.push({ on, do: 'emit', type: t.event }); continue; }
    if (t.kind === 'close' && !t.menu) {
      for (const m of menuIds) { if (!(menuVar(m) in frag.vars)) frag.vars[menuVar(m)] = 0; frag.reactions.push({ on, do: 'set', var: menuVar(m), to: 0 }); }
      continue;
    }
    const menu = t.kind === 'open' || t.kind === 'close';
    const v = t.kind === 'phase' ? PHASE_VAR : menu ? menuVar(t.menu) : cueVar(t.part, t.kind === 'state');
    const to = t.kind === 'phase' ? phases.indexOf(t.phase) : t.kind === 'state' ? UI_STATES.indexOf(t.to) : t.kind === 'show' || t.kind === 'open' ? 1 : 0;
    if (!(v in frag.vars)) frag.vars[v] = t.kind === 'phase' ? 0 : t.kind === 'state' ? shown : t.kind === 'hide' ? 1 : 0;
    frag.reactions.push({ on, do: 'set', var: v, to });
    if (end && t.kind !== 'phase') frag.reactions.push({ on: end, do: 'set', var: v, to: t.kind === 'state' ? shown : t.kind === 'show' || t.kind === 'open' ? 0 : 1 });
  }
  return frag;
}

const tidy = (frag) => { for (const k of Object.keys(frag)) if (Array.isArray(frag[k]) ? !frag[k].length : !Object.keys(frag[k]).length) delete frag[k]; return frag; };
export { emptyFrag, tidy };

/** A play block's cues → one events fragment the bus runs unchanged (compose-ready), or null when it has none. */
export function lowerCues(play, { anchors = [], player = null, places = anchors } = {}) {
  const phases = (play && play.phases) || ['playing'];
  const cues = readCues(play, phases);
  if (!cues.length) return null;
  const { menuIds } = effectContext(play, phases), frag = emptyFrag();
  const add = (f) => { for (const k of ['sources', 'reactions', 'watches', 'initial']) frag[k].push(...f[k]); };
  for (const c of cues) {
    const on = `cue:${c.id}`, end = `cue-end:${c.id}`, zone = `cue-${c.id}`;
    // once: the happening fires a hit; a watch on the count of hits fires the cue the first time only
    if (c.once) {
      add(fire(c.when, `cue-hit:${c.id}`, zone, anchors, player));
      frag.watches.push({ type: on, when: { count: `cue-hit:${c.id}`, gte: 1 } });
    } else add(fire(c.when, on, zone, anchors, player));
    // until a time: a sequence per cue waits it out after each firing, then ends the cue
    if (c.until && c.until.kind === 'ttl') frag.sequences.push({ id: `cue-${c.id}`, scope: c.id, trigger: { on }, steps: [{ await: { timer: c.until.ttl } }, { do: 'emit', type: end }] });
    else if (c.until) add(fire(c.until, end, c.until.same ? zone : `${zone}-end`, anchors, player));
    // a use at a place ends, as a near does, when the figure walks off it (what it opened closes)
    const used = !c.until && c.when.kind === 'use' ? usePlace(c.when, zone, anchors) : null;
    if (used) frag.reactions.push({ on: 'exit', match: { zone: used.zone }, do: 'emit', type: end });
    lowerEffects(c.then, on, frag, { phases, menuIds, places, end: c.until || used ? end : null, ttl: c.until && c.until.kind === 'ttl' ? c.until.ttl : null });
  }
  // two cues on one place share its zone (one enter, one exit); the first prompt given is its word
  const byZone = new Map();
  frag.sources = frag.sources.filter((x) => {
    const had = byZone.get(x.zone);
    if (!had) { byZone.set(x.zone, x); return true; }
    if (x.prompt && !had.prompt) had.prompt = x.prompt;
    return false;
  });
  return tidy(frag);
}

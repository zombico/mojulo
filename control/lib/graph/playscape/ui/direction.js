/**
 * UI DIRECTION — the gate before a world's UI is created: its style guide, its motion, its parts, its layout and its
 * wireframes, offered for approval item by item (scapeshift's art direction, era/art-direction.js, is the model).
 * Stricter than art: while any item is still `proposed` the page draws its UI in greybox (the structure, placeholder
 * values), and the skinned UI is emitted only once every item is `approved` or `auto`.
 *
 *   play: {
 *     parts:  [ … ],                         // parts.js
 *     phases: ['title', 'playing', …],       // at most 8; drawn as wireframes (the phase machine lands with rung 0)
 *     ui:     'propose' | 'auto' | { register?, pin?, border?, pixel?, pace?, seed? }   // authoring input
 *           → { ask, seed, guide, motion, status }                    // stored, as numbers and words
 *   }
 *   play_hints: { fiction?, register?, border?, pixel?, pace?, motifs? }   // optional, high level; scapeshift may write it
 *
 *   resolvePlayUi(manifest)  → AUTHORING TIME ONLY (create_sketch / update_sketch): fills the guide and the motion,
 *                              rolls any item set to 'reroll', keeps the others and their approval
 *   uiSettled(ui)            → every item approved or auto
 *   lowerPlay(manifest, { anchors, player }) → the BUILD's read: an events fragment { hud, …the cues' bus channels, menus?, style?,
 *                              register? }, or null
 *
 * Every guide value carries the layer that set it: 'operator' (play.ui), 'hints' (play_hints), 'flavor' (a stylized
 * border's preset, borders.js), 'world' (the stage's tone), 'roll' (dice inside a rail) or 'default'. Nothing is styled from taste.
 */
import { randomInt } from 'node:crypto';
import { STYLE_DEFAULTS, STYLE_TOKENS } from '../../game/hud-widgets.js';
import { readTone } from '../../era/tone.js';
import { readRegister, stopOf, dialsAt, validatePins, fontOfType, DIAL_IDS } from './register.js';
import { rollMotion } from './motion.js';
import { readBorder, readPixel, BORDER_FLAVORS } from './borders.js';
import { PACES } from './regions.js';
import { lowerParts, readPart } from './parts.js';
import { lowerCues, readCues } from './cues.js';
import { lowerMenus, readMenus, menuPages } from './menus.js';
import { lowerStats, readStats } from '../stats/stats.js';
import { STAT_OPS } from '../stats/kernel.js';
import { readSpots, spotAnchors, withStands, CAST_WHEN } from './cast.js';
import { withChapterCues, chapterBus } from './chapters.js';
import { withSceneCues, sceneProgram, sceneBus } from './scenes.js';
import { questProgram } from './quests.js';
import { withPartyCues } from './party.js';
import { withRoutineCues } from './routines.js';

export const UI_ITEMS = Object.freeze(['guide', 'motion', 'parts', 'layout', 'wireframes']);
const ROLLED = ['guide', 'motion'];
const STATUSES = ['proposed', 'approved', 'auto'];
export const MAX_PHASES = 8;

// the greybox the page draws while the direction is pending: values only, the structure readable, no colour
export const GREYBOX_TOKENS = Object.freeze({ accent: '#d9d9d9', accent2: '#a6a6a6', ink: '#f2f2f2', bg: '#000000', panel: '#1f1f1f', line: '#6b6b6b' });

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const subSeed = (seed, item) => { let h = (seed >>> 0) ^ 0x9e3779b9; for (const c of item) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0; return (h % 99998) + 1; };
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** A fresh seed: authoring time only (never inside a builder). */
export const freshUiSeed = () => randomInt(1, 2 ** 31 - 1);

// tokens from the world: a stage's tone gives its default ramp (panel from the shadow end, ink from the light end, the
// line between) and an accent from the ramp that carries the place's accent; the dice pick the stop inside each rail
function guideTokens(manifest, R) {
  if (manifest.tone === undefined) return { tokens: { ...pick(STYLE_DEFAULTS) }, source: 'default' };
  const T = readTone(manifest.tone), base = T.ramps[T.default];
  const accentRamp = T.ramps.accent || T.ramps.trim || T.ramps.green || base, warm = T.ramps.floor || base;
  const at = (ramp, [lo, hi]) => ramp[lo + Math.floor(R() * (hi - lo + 1))];
  // the rails never overlap, so the line always reads against the panel and the ink against both
  return { tokens: { panel: at(base, [0, 1]), bg: base[0], line: at(base, [2, 3]), ink: base[4], accent: at(accentRamp, [3, 4]), accent2: at(warm, [2, 3]) }, source: 'world' };
}
const pick = (s) => Object.fromEntries(STYLE_TOKENS.map((k) => [k, s[k]]));

// the register: the operator's word wins, then the hints, then the default; a reroll nudges it inside its stop's band
// unless the operator set it
function guideRegister(ask, hints, R, nudge) {
  if (ask.register !== undefined) return { register: readRegister(ask.register), source: 'operator' };
  let r = 0, source = 'default';
  if (hints && hints.register !== undefined) { r = readRegister(hints.register); source = 'hints'; }
  if (nudge) { r = Math.round(Math.max(0, Math.min(1, r + (R() - 0.5) * 0.24)) * 1000) / 1000; source = source === 'default' ? 'roll' : source; }
  return { register: r, source };
}

/**
 * The guide: register, stop, dials, font, tokens, the stylized border and the pixel tuning, each with its source.
 * Precedence, per value: the operator's words (play.ui) > the hints (play_hints) > a border flavor's own face, dials
 * and tint > the register's dials and the world's tone > the dice > the default.
 */
export function rollGuide(manifest, ask, seed, nudge = false) {
  const R = mulberry32(subSeed(seed, 'guide')), hints = isObj(manifest.play_hints) ? manifest.play_hints : null;
  const { register, source } = guideRegister(ask, hints, R, nudge);
  const pins = isObj(ask.pin) ? ask.pin : {};
  const borderSource = ask.border !== undefined ? 'operator' : hints && hints.border !== undefined ? 'hints' : null;
  const border = borderSource ? readBorder(borderSource === 'operator' ? ask.border : hints.border) : null;
  const F = border && border.flavor ? BORDER_FLAVORS[border.flavor] : null;
  const dials = dialsAt(register, { ...(F ? F.dials : {}), ...pins });
  const dialSource = (d) => (pins[d] !== undefined ? 'operator' : F && F.dials[d] !== undefined ? 'flavor' : 'register');
  const { tokens, source: tokenSource } = border && border.tint ? { tokens: { ...F.tint }, source: 'flavor' } : guideTokens(manifest, R);
  const pixelSource = ask.pixel !== undefined ? 'operator' : hints && hints.pixel !== undefined ? 'hints' : null;
  const pixel = pixelSource ? readPixel(pixelSource === 'operator' ? ask.pixel : hints.pixel) : 0;
  // the face: the operator's type pin, else pixelated text in the mono face, else the flavor's, else the type dial's
  const paceSource = ask.pace !== undefined ? 'operator' : hints && hints.pace !== undefined ? 'hints' : null;
  const pace = paceSource ? readPace(paceSource === 'operator' ? ask.pace : hints.pace) : 'scan';
  const fontBy = pins.type !== undefined ? 'operator' : pixel ? 'pixel' : F ? 'flavor' : 'register';
  const font = fontBy === 'pixel' ? 'mono' : fontBy === 'flavor' ? F.font : fontOfType(dials.type, hints);
  return {
    register, stop: stopOf(register), dials, font, tokens,
    border: border ? { flavor: border.flavor, elements: border.elements } : null,
    pixel, pace,
    sources: {
      register: source, tokens: tokenSource,
      dials: Object.fromEntries(DIAL_IDS.map((d) => [d, dialSource(d)])),
      font: fontBy,
      border: borderSource || 'default', pixel: pixelSource || 'default', pace: paceSource || 'default',
    },
  };
}

function statusOf(ui, fill) {
  const s = { ...(isObj(ui) && isObj(ui.status) ? ui.status : {}) };
  for (const item of UI_ITEMS) if (!STATUSES.includes(s[item])) s[item] = fill;
  return s;
}

/** A pace word: glance (twitch), scan (the default), study (management, menus). */
export function readPace(p, where = 'play.ui.pace') {
  if (!PACES.includes(p)) throw new Error(`${where} is one of: ${PACES.join(', ')} (glance: read in a glance, twitch; study: read slowly, management and menus)`);
  return p;
}

function readAsk(u) {
  const ask = {};
  if (u.register !== undefined) ask.register = readRegister(u.register);
  if (u.pin !== undefined) { const e = validatePins(u.pin); if (e.length) throw new Error(e.join('\n')); ask.pin = u.pin; }
  if (u.border !== undefined) { readBorder(u.border); ask.border = u.border; }
  if (u.pixel !== undefined) ask.pixel = readPixel(u.pixel);
  if (u.pace !== undefined) ask.pace = readPace(u.pace);
  return ask;
}

/** The phases a play block draws (validated: names, at most eight). */
export function phasesOf(play) {
  const ph = play && play.phases;
  if (ph === undefined) return ['playing'];
  if (!Array.isArray(ph) || !ph.length || !ph.every((p) => typeof p === 'string' && p)) throw new Error('play.phases is a list of phase names (title, playing, paused, won, lost, …)');
  if (ph.length > MAX_PHASES) throw new Error(`play.phases: at most ${MAX_PHASES} phases (a game with more is a rung-3 game of systems)`);
  return ph;
}

/**
 * AUTHORING TIME. `ui: 'propose'` (every item proposed), `'auto'` (hands off), `{ register?, pin?, seed? }` (proposed
 * from those words), or a stored direction whose items set to 'reroll' are drawn afresh. A manifest without
 * `play.ui` comes back as it was.
 */
export function resolvePlayUi(manifest, fresh = freshUiSeed) {
  const play = manifest && manifest.play;
  if (!isObj(play) || play.ui === undefined) return manifest;
  const u = play.ui;
  if (typeof u === 'string' && u !== 'propose' && u !== 'auto') throw new Error(`play.ui is 'propose', 'auto', { register?, pin?, seed? }, or a stored direction (got '${u}')`);
  if (!(typeof u === 'string' || isObj(u))) throw new Error("play.ui is 'propose', 'auto', or { register?, pin?, seed? }");
  phasesOf(play);
  (play.parts || []).forEach((p, i) => readPart(p, i));
  readCues(play, phasesOf(play));
  readMenus(play);
  readSpots(play);
  readStats(play);
  if (typeof u === 'string' || !ROLLED.some((k) => k in u)) {
    const ask = typeof u === 'string' ? {} : readAsk(u), seed = isObj(u) && Number.isInteger(u.seed) ? u.seed : fresh();
    const motion = rollMotion(mulberry32(subSeed(seed, 'motion')));
    return { ...manifest, play: { ...play, ui: { ask, seed, guide: rollGuide(manifest, ask, seed), motion, status: statusOf(null, u === 'auto' ? 'auto' : 'proposed') } } };
  }
  for (const k of ['parts', 'layout', 'wireframes']) if (u[k] === 'reroll') throw new Error(`play.ui.${k} is drawn from play.parts and play.phases: edit those to change it (only guide and motion roll)`);
  const redo = ROLLED.filter((k) => u[k] === 'reroll'), ask = isObj(u.ask) ? readAsk(u.ask) : {};
  if (!redo.length) return manifest;
  const seed = fresh(), status = statusOf(u, 'proposed'), next = { ...u, ask };
  if (redo.includes('guide')) next.guide = rollGuide(manifest, ask, seed, true);
  if (redo.includes('motion')) next.motion = rollMotion(mulberry32(subSeed(seed, 'motion')));
  for (const k of redo) status[k] = 'proposed';
  return { ...manifest, play: { ...play, ui: { ...next, status } } };
}

/** Every item approved or auto. */
export function uiSettled(ui) {
  return isObj(ui) && isObj(ui.status) && UI_ITEMS.every((k) => ui.status[k] === 'approved' || ui.status[k] === 'auto');
}

/** The items still waiting on the operator. */
export const uiPending = (ui) => UI_ITEMS.filter((k) => !(isObj(ui) && isObj(ui.status) && (ui.status[k] === 'approved' || ui.status[k] === 'auto')));

/**
 * THE BUILD'S READ (pure, no dice): play.parts lowered to hud rows, play.cues and play.menus to their rows and bus
 * channels (`anchors`, the built map's, place a cue named by an anchor); with a direction, the style tokens and the
 * register's dials once it is settled, the greybox until then. Absent `play` ⇒ null (zero bytes).
 */
export function lowerPlay(manifest, { anchors = [], player = null } = {}) {
  // chapters (chapters.js) and scenes (scenes.js) lower to cues, so the play below reads them as its own
  const play = withRoutineCues(withPartyCues(withSceneCues(withChapterCues(manifest && manifest.play))));
  if (!isObj(play)) return null;
  phasesOf(play);
  // the cues (cues.js) and the menus' picks (menus.js) ride beside the parts' rows: their hud rows after, their bus
  // channels as they are (the two share the menus' vars)
  // spots are places like the map's anchors (and the stand points at their doors): a cue's zone, the cast's walks and spawns
  const stood = withStands(anchors || []), spots = readSpots(play), places = [...spots, ...stood];
  const cues = lowerCues(play, { anchors: [...spotAnchors(play), ...stood], player, places }) || {}, menus = lowerMenus(play, { places }) || {};
  const hud = [...lowerParts(play.parts, phasesOf(play)), ...(cues.hud || []), ...(menus.hud || [])];
  const out = hud.length ? { hud } : {};
  const stats = lowerStats(play);
  const vars = { ...(stats ? stats.vars : {}), ...(cues.vars || {}), ...(menus.vars || {}) };
  if (Object.keys(vars).length) out.vars = vars;
  const chapters = chapterBus(play) || {}, flags = sceneBus(play) || {};
  if (flags.vars) out.vars = { ...(out.vars || {}), ...flags.vars };
  for (const k of ['sources', 'reactions', 'watches', 'initial', 'sequences', 'timers']) { const v = [...(cues[k] || []), ...(menus[k] || []), ...(chapters[k] || []), ...(flags[k] || [])]; if (v.length) out[k] = v; }
  // the scenes' program: the page's runner (scene-runner.js) paces their beats, frames their shots, draws the box
  if (play.scenes !== undefined) { const scenes = sceneProgram(play); if (scenes.length) out.scenes = scenes; }
  // the quests' journal (quests.js): the page keeps it over the flags
  if (play.quests !== undefined) { const quests = questProgram(play); if (quests.length) out.quests = quests; }
  const pages = menuPages(play);
  if (pages.length) out.menus = pages;
  // the page reads the characters' happenings and hands them the cast's ops only when something here uses them
  // (a stat op rides the same ctrl queue; the stats kernel takes it, so it alone needs no cast)
  const castOn = (r) => (r.do === 'ctrl' && !(r.op in STAT_OPS)) || (CAST_WHEN[r.on] && r.match && 'entity' in r.match);
  if (stats) out.stats = stats.stats;
  if ((out.reactions || []).some(castOn)) out.cast = true;
  // the looks its statuses wear, by status name (the first a name is given wins; the laws say when two differ)
  const looks = {};
  for (const t of [...readCues(play).flatMap((c) => c.then), ...readMenus(play).flatMap((m) => m.picks.flatMap((p) => p.then))]) if (t.kind === 'cast' && t.op === 'status' && !looks[t.is]) looks[t.is] = t.look;
  if (Object.keys(looks).length) out.looks = looks;
  const u = play.ui;
  if (isObj(u) && isObj(u.guide)) {
    if (uiSettled(u)) {
      out.style = { ...pick(u.guide.tokens), font: u.guide.font };
      out.register = { ...u.guide.dials, ...(u.guide.border ? { border: [...u.guide.border.elements] } : {}), ...(u.guide.pixel ? { pixel: u.guide.pixel } : {}) };
    }
    else out.style = { ...GREYBOX_TOKENS, font: 'system' };
  }
  return Object.keys(out).length ? out : null;
}

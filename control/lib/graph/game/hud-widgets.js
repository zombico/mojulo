/**
 * hud-widgets — the screen-space UI language for composed games: what a row of `events.hud`
 * MEANS, where it goes, and the style tokens the game shell and a level share.
 *
 * A hud row is a WIDGET in one of seven SLOTS (the signage slot names, reused verbatim — the
 * corners hold persistent readouts, the centre line holds moments):
 *
 *   readout  { var, label?, slot?, as?: 'text'|'counter'|'bar'|'clock', max?, color? }
 *   banner   { on: '<busEventPattern>', text, slot?: 'center', ttl?: 2, color? }
 *   toast    { on, text, as: 'toast', slot?: 'center', ttl?: 0.8, color? }   — a banner that STACKS
 *            { var, as: 'toast', text?: '{delta}', slot?, ttl?, color? }     — fires when the var changes
 *   title    { on, text, as: 'title', theme?, slot?: 'center', ttl?, color?, look?, style?, caps?, edge?, material?,
 *              block?, blockColor? }
 *            — a banner CARVED: its words as 3D letters put on the screen (title-carve.js, the glyph carver's
 *            letters) in a design THEME (TITLE_THEMES: arcade, pixel, cel, cartoon, cinematic, speed; the game's own
 *            by default, titleThemeFor), each dial of which a row may name itself: `look` the entrance (TITLE_LOOKS),
 *            `style` the carve (TITLE_STYLES), `caps`, `edge` (TITLE_EDGES), `color`, `ttl`, and `material` what the
 *            letters are made of (title-material.js: a metal reflecting a studio sweep, or a shelf finish; no theme sets
 *            one), `block` the depth made to show (TITLE_BLOCKS) in `blockColor`. A text may name a word in the world's
 *            language: '@fight' (title-words.js)
 *   legend   { text, slot?: 'bottom', ttl? }
 *
 * Any row may carry `id` (a part's: a cue shows, hides or restates it through the bus vars ui-<id> = 0 | 1 and
 * ui-<id>-state = a UI_STATES index) and `when` (the phase indices it stands in: the bus var `phase`). The page draws
 * a gated row only while both allow it; a hidden banner or toast does not fire.
 *
 * A toast is the damage number: each firing is its own rising, fading element (banners replace,
 * toasts queue). The event form substitutes `{event.<field>}` from the firing event (a
 * `hitConfirm({ damage })` shot carries `damage` + `target`); the var form substitutes `{delta}`
 * (signed) and `{value}`, and never merges with the var's readout — an HP bar and its "-20"
 * coexist. Substitution is `hudSubst` below, shipped verbatim into the page.
 *
 * A legacy `{ var, label }` row (every idiom / mechanic emits one) normalizes to a `text`
 * readout at `top-left` — so every existing world means what it meant. Two rows naming the same
 * var MERGE, first declared winning per field: hand-authored rows precede mechanic-lowered ones
 * in the merged manifest (level-synth mergeEventManifests), so a hand row restyles a mechanic's
 * default readout by naming its var (`{ var:'hp', as:'bar', max:100, slot:'bottom-left' }`).
 *
 * STYLE TOKENS are one shape in two places: the game manifest's `theme` (the shell skin, passed
 * to each level on game-init) and a world's `events.style` (a shell-less game's own look). Hex
 * colors + a font family from a closed list. The shell's theme wins over the level's style; absent
 * both, the defaults below are today's look. Pure + deterministic; nothing here touches the DOM.
 */

import { MOTION_TIMING } from '../playscape/ui/register.js';
import { titleMaterialName, titleMaterial } from './title-material.js';

export const HUD_SLOTS = ['top-left', 'top', 'top-right', 'center', 'bottom-left', 'bottom', 'bottom-right'];
export const HUD_KINDS = ['text', 'counter', 'bar', 'clock'];
export const MOMENT_KINDS = ['banner', 'toast', 'title'];   // what an `on` row may be `as`
export const TOAST_TTL = 0.8;                        // seconds a damage number lives (default)
export const TITLE_TTL = 1.8;                        // seconds a title card stands (default), its entrance and exit inside
// a title's entrance: slam (scaled down onto the screen, a flash and a jolt), rise (the letters rise one after another and
// settle), stamp (punched in from the viewer, then a bounce), fade (in slowly, drifting, and out), slide (in from the
// side, stretched, out the other way); its exit mirrors it.
export const TITLE_LOOKS = ['slam', 'rise', 'stamp', 'fade', 'slide'];
// a title's carve (lib/motion/glyph-carver.js CARVE_STYLES): heavy (bold, bevelled), blocky (rastered, chunky),
// slick, thin, italic.
export const TITLE_STYLES = ['heavy', 'blocky', 'slick', 'thin', 'italic'];
// what stands behind a title's letters: ink (a dark hull round each letter), shadow (a dark copy offset behind), both,
// glow (a copy in the title's colour, added, larger), none
export const TITLE_EDGES = ['ink', 'shadow', 'both', 'glow', 'none'];
// a title's depth made to show (title-channel.js): none (the letters face the screen, the carve's depth a sliver), drop
// (deep, down and to the right: the comic and cartoon block letter), perspective (deep, the sides running to a
// vanishing point under the word: the action-movie logo), stack (the comic masthead's receding copies, stepped)
export const TITLE_BLOCKS = ['none', 'drop', 'perspective', 'stack'];
/**
 * TITLE THEMES — the graphic-design styles game titles are set in, each a whole: the carve, the entrance, the case,
 * the tracking, the size, what stands behind the letters, a lean, how hard the landing hits (flash 0..1), whether it
 * throws sparks or a halo ring, the colour token, and how long it stands. A row names one (`theme`), or gets the one
 * its game implies (titleThemeFor: the juice floor's register and game type); any dial a row names on its own wins.
 *
 *   arcade     the fighting game's announcer: heavy caps with an ink line and a drop shadow, slammed down with a flash
 *              and sparks (Street Fighter's ROUND 1 / FIGHT, Tekken's K.O.)
 *   pixel      the 8- and 16-bit cabinet: bitmap blocks, flat colour, a hard dark edge, letters rising in turn, no flash
 *              (STAGE CLEAR on a NES, Shovel Knight, Celeste)
 *   cel        the anime fighter's cut-in: slanted heavy caps, thick ink, a tilt, stamped in from the eye with a halo
 *              and sparks (Guilty Gear, Dragon Ball FighterZ, Persona's cutouts)
 *   cartoon    the platformer's cheer: round chunky letters in mixed case, bright gold, bouncing up one by one
 *              (Mario's COURSE CLEAR, Rayman, Crash)
 *   cinematic  the prestige card: small, widely tracked thin caps in the ink colour, fading in slowly and out, nothing
 *              else (Dark Souls' YOU DIED, Halo's MISSION COMPLETE, God of War's chapter titles)
 *   speed      the racer's and the arena's readout: slanted slick caps, a drop shadow, sliding in from the side with
 *              streaks and out the other way (Wipeout, F-Zero, Overwatch's PLAY OF THE GAME)
 */
export const TITLE_THEMES = Object.freeze({
  arcade: { about: 'the fighting game\'s announcer: heavy caps, an ink line and a drop shadow, slammed down with a flash and sparks', style: 'heavy', look: 'slam', caps: true, tracking: 0.05, scale: 1, edge: 'both', tilt: 0, flash: 1, sparks: true, ring: false, color: 'accent', ttl: 1.8 },
  pixel: { about: 'the 8- and 16-bit cabinet: bitmap blocks, flat colour, a hard dark edge, letters rising in turn, no flash', style: 'blocky', look: 'rise', caps: true, tracking: 0.1, scale: 0.9, edge: 'ink', tilt: 0, flash: 0, sparks: false, ring: false, color: 'accent', ttl: 2 },
  cel: { about: 'the anime fighter\'s cut-in: slanted heavy caps, thick ink, a tilt, stamped in from the eye with a halo and sparks', style: 'italic', look: 'stamp', caps: true, tracking: 0.03, scale: 1.05, edge: 'ink', tilt: -0.1, flash: 1, sparks: true, ring: true, color: 'accent', ttl: 1.8 },
  cartoon: { about: 'the platformer\'s cheer: round chunky letters in mixed case, bright gold, bouncing up one by one', style: 'heavy', look: 'rise', caps: false, tracking: 0.08, scale: 1.1, edge: 'ink', tilt: 0.04, flash: 0, sparks: true, ring: false, color: 'value', ttl: 2 },
  cinematic: { about: 'the prestige card: small, widely tracked thin caps in the ink colour, fading in slowly and out, nothing else', style: 'thin', look: 'fade', caps: true, tracking: 0.3, scale: 0.5, edge: 'none', tilt: 0, flash: 0, sparks: false, ring: false, color: 'ink', ttl: 2.8 },
  speed: { about: 'the racer\'s and the arena\'s readout: slanted slick caps, a drop shadow, sliding in from the side with streaks and out the other way', style: 'italic', look: 'slide', caps: true, tracking: 0.02, scale: 0.85, edge: 'shadow', tilt: 0, flash: 0.4, sparks: true, ring: false, color: 'accent2', ttl: 1.5 },
});
export const TITLE_THEME_IDS = Object.keys(TITLE_THEMES);
/** The theme a game implies: the juice floor's { register, flavor } (null ⇒ the arcade announcer, which reads anywhere). */
export function titleThemeFor(juice) {
  if (!juice || typeof juice !== 'object') return 'arcade';
  const register = juice.register === 'western' ? 'western' : 'anime', flavor = juice.flavor || 'action';
  if (flavor === 'realistic') return 'cinematic';
  if (flavor === 'platformer') return 'cartoon';
  if (flavor === 'pinball') return register === 'western' ? 'speed' : 'arcade';
  return register === 'western' ? 'arcade' : 'cel';
}
const TITLE_DIALS = ['style', 'look', 'caps', 'tracking', 'scale', 'edge', 'tilt', 'flash', 'sparks', 'ring', 'color', 'tempo', 'steps'];
/**
 * THE CASCADE: a world whose play block carries a settled UI direction dresses its titles from the same register the
 * parts are dressed from (playscape/ui/register.js), so a title never looks like it came from another game:
 *   type    → the carve, and the case: system → slick; display → heavy, in capitals; period → thin, in capitals;
 *             a pixel tuning → blocky, in capitals, with an ink edge
 *   frame   → what stands behind the letters: none → none; hairline, rule → ink; bevel → both; material → shadow
 *   motion  → the entrance: ease → fade; snap → slam; stepped → rise; mechanical → slide — and its TEMPO (the motion
 *             dial's frames against ease's) and its STEPS (a stepped or mechanical motion plays its entrance in that
 *             many held drawings, the UI sheet's steps())
 * Each derived dial names the register dial it came from (`by`), for the board's provenance.
 */
const REGISTER_TITLE = Object.freeze({
  type: { system: { style: 'slick' }, display: { style: 'heavy', caps: true }, period: { style: 'thin', caps: true } },
  frame: { none: { edge: 'none' }, hairline: { edge: 'ink' }, rule: { edge: 'ink' }, bevel: { edge: 'both' }, material: { edge: 'shadow' } },
  motion: { ease: { look: 'fade' }, snap: { look: 'slam' }, stepped: { look: 'rise' }, mechanical: { look: 'slide' } },
});
export function titleDialsOfRegister(reg) {
  const dials = {}, by = {};
  if (!reg || typeof reg !== 'object') return { dials, by };
  for (const [dial, table] of Object.entries(REGISTER_TITLE)) {
    const got = table[reg[dial]];
    if (got) for (const [k, v] of Object.entries(got)) { dials[k] = v; by[k] = dial; }
  }
  if (reg.pixel) { dials.style = 'blocky'; dials.caps = true; dials.edge = 'ink'; by.style = 'pixel'; by.caps = 'pixel'; by.edge = 'pixel'; }
  const m = MOTION_TIMING[reg.motion];
  if (m) {
    dials.tempo = Math.round(Math.max(0.45, Math.min(1.6, m.frames / MOTION_TIMING.ease.frames)) * 100) / 100; by.tempo = 'motion';
    const st = /steps\((\d+)/.exec(m.fn); dials.steps = st ? Number(st[1]) : 0; by.steps = 'motion';
  }
  return { dials, by };
}
/**
 * A title row's dials, each from the first layer that sets it: the row's own word > the register the play block settled
 * (ctx.register: the dials lowerPlay hands the build, a pin among them counted as the operator's by ctx.sources) > its
 * theme > the default. With ctx.explain, `from` names each dial's layer ('row', 'operator', 'flavor', 'register',
 * 'pixel', 'theme', 'default') and `by` the register dial behind it.
 */
export function titleDials(r, ctx = {}) {
  const theme = TITLE_THEME_IDS.includes(r.theme) ? r.theme : 'arcade', T = TITLE_THEMES[theme];
  const reg = ctx.register ? titleDialsOfRegister(ctx.register) : { dials: {}, by: {} };
  const srcDials = ctx.sources && ctx.sources.dials ? ctx.sources.dials : {};
  const out = { theme }, from = {}, by = {};
  for (const k of TITLE_DIALS) {
    if (r[k] !== undefined && r[k] !== null) { out[k] = r[k]; from[k] = 'row'; }
    else if (reg.dials[k] !== undefined) { out[k] = reg.dials[k]; by[k] = reg.by[k]; from[k] = reg.by[k] === 'pixel' ? 'pixel' : srcDials[reg.by[k]] === 'operator' || srcDials[reg.by[k]] === 'flavor' ? srcDials[reg.by[k]] : 'register'; }
    else if (T[k] !== undefined) { out[k] = T[k]; from[k] = ctx.themeFrom || 'theme'; }
    else { out[k] = k === 'tempo' ? 1 : k === 'steps' ? 0 : undefined; from[k] = 'default'; }
  }
  out.ttl = Number.isFinite(r.ttl) && r.ttl > 0 ? r.ttl : T.ttl;
  from.ttl = Number.isFinite(r.ttl) && r.ttl > 0 ? 'row' : 'theme';
  // what the letters are made of: the row's word only (no theme or register sets one, so a title without it is unchanged);
  // a finish the row gives no colour of its own wears the shelf row's (a metal is its own colour, title-material.js)
  const material = titleMaterialName(r.material);
  if (material) {
    out.material = material; from.material = 'row';
    const m = titleMaterial(material);
    if (m.base && from.color !== 'row') { out.color = m.base; from.color = 'material'; }
  }
  // the block: the row's word only, like the material (no theme sets one, so a title without it is unchanged)
  if (TITLE_BLOCKS.includes(r.block) && r.block !== 'none') {
    out.block = r.block; from.block = 'row';
    if (isHudColor(r.blockColor)) { out.blockColor = r.blockColor; from.blockColor = 'row'; }
  }
  return ctx.explain ? { ...out, from, by } : out;
}

export const STYLE_TOKENS = ['accent', 'accent2', 'ink', 'bg', 'panel', 'line'];
export const FONTS = {
  system: 'system-ui,sans-serif',
  mono: 'ui-monospace,"SF Mono",Menlo,Consolas,monospace',
  serif: 'Georgia,"Times New Roman",serif',
  display: 'Impact,"Arial Black","Helvetica Neue",sans-serif',
};
export const FONT_IDS = Object.keys(FONTS);
// the reserved semantic palette the U5 decoration already assumes (red = harm, gold = value,
// green = goal) — a default an author retunes per game through the tokens, never a law.
export const SEMANTIC_COLORS = { harm: '#ff5a4d', value: '#ffd700', goal: '#3ff56f' };
export const STYLE_DEFAULTS = { accent: '#5fb0ff', accent2: '#e8b96a', ink: '#ffffff', bg: '#0b1220', panel: '#0c101a', line: '#2a3b58', font: 'system' };

const HEX = /^#[0-9a-fA-F]{3,8}$/;
const isStr = (v) => typeof v === 'string' && v.length > 0;

/** A color value a widget or token may carry: a hex string, or a semantic / token name. */
export function isHudColor(v) {
  return isStr(v) && (HEX.test(v) || Object.prototype.hasOwnProperty.call(SEMANTIC_COLORS, v) || v === 'accent' || v === 'accent2');
}

/**
 * validateHudStyle(style, where?) → errors[] — the token set both the game `theme` and a world's
 * `events.style` accept. Unknown keys are ignored (the game theme carries `style` beside these).
 */
export function validateHudStyle(style, where = 'style') {
  const errors = [];
  if (!style || typeof style !== 'object' || Array.isArray(style)) return [`${where} must be { ${STYLE_TOKENS.join('?, ')}?, font? }`];
  for (const k of STYLE_TOKENS) {
    if (style[k] !== undefined && !(isStr(style[k]) && HEX.test(style[k]))) errors.push(`${where}.${k} must be a hex color like '#5fe6d6'`);
  }
  if (style.font !== undefined && !FONT_IDS.includes(style.font)) errors.push(`${where}.font must be one of: ${FONT_IDS.join(', ')}`);
  return errors;
}

/**
 * styleTokens(style) → the resolved token object (defaults filled, only VALID values taken —
 * re-guarded so a hand-poked row can never reach a CSS context). `font` is the resolved stack.
 */
export function styleTokens(style) {
  const s = style && typeof style === 'object' ? style : {};
  const out = {};
  for (const k of STYLE_TOKENS) out[k] = isStr(s[k]) && HEX.test(s[k]) ? s[k] : STYLE_DEFAULTS[k];
  out.font = FONTS[FONT_IDS.includes(s.font) ? s.font : STYLE_DEFAULTS.font];
  return out;
}

/** hexToRgba('#rgb'|'#rrggbb'|'#rrggbbaa', alpha) → 'rgba(r,g,b,a)' — a translucent panel from a token. */
export function hexToRgba(hex, alpha = 0.72) {
  if (!isStr(hex) || !HEX.test(hex)) return `rgba(12,16,26,${alpha})`;
  let h = hex.slice(1);
  if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** styleVars(style) → the `--moj-*` custom-property declarations (no selector), for a CSS block. */
export function styleVars(style) {
  const t = styleTokens(style);
  return STYLE_TOKENS.map((k) => `--moj-${k}:${t[k]}`).concat([`--moj-panel-a:${hexToRgba(t.panel)}`, `--moj-font:${t.font}`, `--moj-harm:${SEMANTIC_COLORS.harm}`, `--moj-value:${SEMANTIC_COLORS.value}`, `--moj-goal:${SEMANTIC_COLORS.goal}`]).join(';');
}

/** resolve a widget color to a CSS value: hex passes, a semantic / token name becomes its var. */
export function colorCss(v, fallback = 'var(--moj-ink)') {
  if (!isStr(v)) return fallback;
  if (HEX.test(v)) return v;
  if (Object.prototype.hasOwnProperty.call(SEMANTIC_COLORS, v) || v === 'accent' || v === 'accent2') return `var(--moj-${v})`;
  return fallback;
}

/**
 * hudSubst(text, vars, ctx?) → the text with `{…}` filled. `{name}` reads a bus var (unknown ⇒ the
 * literal brace stays, as before); `{event.<field>}` reads the firing event, `{delta}` / `{value}`
 * a var toast's change — those three read '' when absent (a number never shows as "{delta}").
 * Emitted into the page by toString(): no closures, ES5-safe, one copy of the rule.
 */
export function hudSubst(text, vars, ctx) {
  var out = '', i = 0, t = String(text);
  while (i < t.length) {
    var a = t.indexOf('{', i); if (a < 0) { out += t.slice(i); break; }
    var b = t.indexOf('}', a); if (b < 0) { out += t.slice(i); break; }
    var key = t.slice(a + 1, b), v;
    if (key.indexOf('event.') === 0) { v = ctx && ctx.event ? ctx.event[key.slice(6)] : undefined; out += t.slice(i, a) + (v != null ? v : ''); }
    else if (key === 'delta' || key === 'value') { v = ctx ? ctx[key] : undefined; out += t.slice(i, a) + (v != null ? v : ''); }
    else { v = vars ? vars[key] : undefined; out += t.slice(i, a) + (v != null ? v : t.slice(a, b + 1)); }
    i = b + 1;
  }
  return out;
}

/** fmtDelta(n) → a signed number string: +5, -12, 0. Rounded to 2 places so a float tick reads. */
export function fmtDelta(n) {
  var r = Math.round(n * 100) / 100;
  return (r > 0 ? '+' : '') + r;
}

/**
 * normalizeHud(rows, ctx?) → { widgets, errors }. Widgets are complete (every optional filled) and in
 * declaration order; ctx.register (the dials a settled play direction hands the build) dresses the title rows
 * through the cascade (titleDials). Widgets are in
 * declaration order (a merged var keeps its FIRST position). Errors teach; a caller that needs
 * a gate throws on them, a renderer that already passed the gate takes the widgets.
 */
export function normalizeHud(rows, ctx = {}) {
  const errors = [];
  const widgets = [];
  const byVar = new Map();
  const list = Array.isArray(rows) ? rows : [];
  list.forEach((r, i) => {
    const where = `hud[${i}]`;
    if (!r || typeof r !== 'object') { errors.push(`${where} must be a readout { var, label? }, a banner { on, text } or a legend { text }`); return; }
    const slotGiven = r.slot !== undefined;
    if (slotGiven && !HUD_SLOTS.includes(r.slot)) errors.push(`${where}.slot must be one of: ${HUD_SLOTS.join(', ')}`);
    if (r.color !== undefined && !isHudColor(r.color)) errors.push(`${where}.color must be a hex color or one of: harm, value, goal, accent, accent2`);
    const slot = slotGiven && HUD_SLOTS.includes(r.slot) ? r.slot : null;
    const ttlBad = r.ttl !== undefined && !(Number.isFinite(r.ttl) && r.ttl > 0);
    const ttl = (dflt) => (Number.isFinite(r.ttl) && r.ttl > 0 ? r.ttl : dflt);
    // the gate: a part's id (its ui-<id> vars) and the phases it stands in
    if (r.id !== undefined && !(isStr(r.id) && /^[a-z][a-z0-9-]*$/.test(r.id))) errors.push(`${where}.id is a lower-case word (a cue names a part by it)`);
    if (r.when !== undefined && !(Array.isArray(r.when) && r.when.every((k) => Number.isInteger(k) && k >= 0))) errors.push(`${where}.when is a list of phase indices`);
    const gate = { id: isStr(r.id) && /^[a-z][a-z0-9-]*$/.test(r.id) ? r.id : undefined, when: Array.isArray(r.when) && r.when.every((k) => Number.isInteger(k) && k >= 0) ? [...r.when] : undefined };

    if (isStr(r.var) && r.as === 'toast') {   // the var toast: its own widget, never merged with the readout
      if (r.text !== undefined && !isStr(r.text)) errors.push(`${where}.text must be a string (default '{delta}')`);
      if (ttlBad) errors.push(`${where}.ttl must be a positive number of seconds`);
      widgets.push({ kind: 'toast', var: r.var, text: isStr(r.text) ? r.text : '{delta}', slot: slot || 'center', ttl: ttl(TOAST_TTL), color: isHudColor(r.color) ? r.color : undefined, ...gate });
      return;
    }
    if (isStr(r.var)) {
      const kind = r.as !== undefined ? r.as : null;
      if (kind !== null && !HUD_KINDS.includes(kind)) errors.push(`${where}.as must be one of: ${HUD_KINDS.join(', ')} (or 'toast' for a change popup)`);
      if (kind === 'bar' && !(Number.isFinite(r.max) || isStr(r.max))) errors.push(`${where}: as:'bar' needs max (a number, or the name of a var)`);
      if (r.max !== undefined && !(Number.isFinite(r.max) || isStr(r.max))) errors.push(`${where}.max must be a number or a var name`);
      if (r.label !== undefined && typeof r.label !== 'string') errors.push(`${where}.label must be a string`);
      const fields = {
        kind: 'readout', var: r.var,
        label: typeof r.label === 'string' ? r.label : undefined,
        slot, as: kind !== null && HUD_KINDS.includes(kind) ? kind : null,
        max: r.max !== undefined ? r.max : undefined,
        color: isHudColor(r.color) ? r.color : undefined,
        ...gate,
      };
      const prev = byVar.get(r.var);
      if (prev) {   // merge: first declared wins per field, later rows fill the gaps
        for (const k of ['label', 'slot', 'as', 'max', 'color', 'id', 'when']) {
          if ((prev[k] === undefined || prev[k] === null) && fields[k] !== undefined && fields[k] !== null) prev[k] = fields[k];
        }
        return;
      }
      byVar.set(r.var, fields);
      widgets.push(fields);
      return;
    }
    if (isStr(r.on)) {
      const kind = r.as !== undefined ? r.as : 'banner';
      if (!MOMENT_KINDS.includes(kind)) errors.push(`${where}.as must be one of: ${MOMENT_KINDS.join(', ')} (an 'on' row)`);
      if (!isStr(r.text)) errors.push(`${where}: a ${kind === 'toast' ? 'toast' : 'banner'} needs text (shown when the bus emits '${r.on}')`);
      if (ttlBad) errors.push(`${where}.ttl must be a positive number of seconds`);
      const k = MOMENT_KINDS.includes(kind) ? kind : 'banner';
      if (k === 'title') {   // the carved banner: its theme, entrance, carve, case and edge are closed words
        if (r.theme !== undefined && !TITLE_THEME_IDS.includes(r.theme)) errors.push(`${where}.theme must be one of: ${TITLE_THEME_IDS.join(', ')} (a title's design style)`);
        if (r.look !== undefined && !TITLE_LOOKS.includes(r.look)) errors.push(`${where}.look must be one of: ${TITLE_LOOKS.join(', ')} (a title's entrance)`);
        if (r.style !== undefined && !TITLE_STYLES.includes(r.style)) errors.push(`${where}.style must be one of: ${TITLE_STYLES.join(', ')} (a title's carve)`);
        if (r.edge !== undefined && !TITLE_EDGES.includes(r.edge)) errors.push(`${where}.edge must be one of: ${TITLE_EDGES.join(', ')} (what stands behind a title's letters)`);
        if (r.caps !== undefined && typeof r.caps !== 'boolean') errors.push(`${where}.caps is true (the words in capitals) or false`);
        if (r.block !== undefined && !TITLE_BLOCKS.includes(r.block)) errors.push(`${where}.block must be one of: ${TITLE_BLOCKS.join(', ')} (a title's depth made to show)`);
        if (r.blockColor !== undefined && !isHudColor(r.blockColor)) errors.push(`${where}.blockColor is a hex colour or a semantic name (harm, value, goal, accent, accent2): the block's sides`);
        if (r.material !== undefined && !titleMaterialName(r.material)) errors.push(`${where}.material must name a metal (chrome, gold, silver, copper, bronze, brass, steel, titanium …) or a finish (stone, wood, plastic, satin, glass, neon, cel …): what a title's letters are made of`);
        const d = titleDials({ theme: r.theme, look: TITLE_LOOKS.includes(r.look) ? r.look : undefined, style: TITLE_STYLES.includes(r.style) ? r.style : undefined, edge: TITLE_EDGES.includes(r.edge) ? r.edge : undefined, caps: typeof r.caps === 'boolean' ? r.caps : undefined, color: isHudColor(r.color) ? r.color : undefined, ttl: r.ttl, material: r.material, block: r.block, blockColor: r.blockColor }, { register: ctx.register });
        widgets.push({ kind: 'title', on: r.on, text: isStr(r.text) ? r.text : '', slot: slot || 'center', ...d, ...gate });
        return;
      }
      widgets.push({ kind: k, on: r.on, text: isStr(r.text) ? r.text : '', slot: slot || 'center', ttl: ttl(k === 'toast' ? TOAST_TTL : 2), color: isHudColor(r.color) ? r.color : undefined, ...gate });
      return;
    }
    if (isStr(r.text)) {
      if (ttlBad) errors.push(`${where}.ttl must be a positive number of seconds`);
      widgets.push({ kind: 'legend', text: r.text, slot: slot || 'bottom', ttl: ttl(null), color: isHudColor(r.color) ? r.color : undefined, ...gate });
      return;
    }
    errors.push(`${where} must be a readout { var, label? }, a banner { on, text } or a legend { text }`);
  });
  // fill readout defaults AFTER merging so a later row's slot/kind can still land on the first
  const out = widgets.map((w) => {
    if (w.kind !== 'readout') return strip(w);
    const as = w.as || 'text';
    return strip({ kind: 'readout', var: w.var, label: w.label !== undefined ? w.label : w.var, slot: w.slot || 'top-left', as, max: w.max, color: w.color, id: w.id, when: w.when });
  });
  return { widgets: out, errors };
}

function strip(o) { const r = {}; for (const k in o) if (o[k] !== undefined && o[k] !== null) r[k] = o[k]; return r; }

/** the slots a widget list uses, in HUD_SLOTS order (a renderer builds one column per slot). */
export function hudSlotsUsed(widgets) {
  const used = new Set((widgets || []).map((w) => w.slot));
  return HUD_SLOTS.filter((s) => used.has(s));
}

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
 *   legend   { text, slot?: 'bottom', ttl? }
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

export const HUD_SLOTS = ['top-left', 'top', 'top-right', 'center', 'bottom-left', 'bottom', 'bottom-right'];
export const HUD_KINDS = ['text', 'counter', 'bar', 'clock'];
export const MOMENT_KINDS = ['banner', 'toast'];   // what an `on` row may be `as`
export const TOAST_TTL = 0.8;                        // seconds a damage number lives (default)
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
 * normalizeHud(rows) → { widgets, errors }. Widgets are complete (every optional filled) and in
 * declaration order (a merged var keeps its FIRST position). Errors teach; a caller that needs
 * a gate throws on them, a renderer that already passed the gate takes the widgets.
 */
export function normalizeHud(rows) {
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

    if (isStr(r.var) && r.as === 'toast') {   // the var toast: its own widget, never merged with the readout
      if (r.text !== undefined && !isStr(r.text)) errors.push(`${where}.text must be a string (default '{delta}')`);
      if (ttlBad) errors.push(`${where}.ttl must be a positive number of seconds`);
      widgets.push({ kind: 'toast', var: r.var, text: isStr(r.text) ? r.text : '{delta}', slot: slot || 'center', ttl: ttl(TOAST_TTL), color: isHudColor(r.color) ? r.color : undefined });
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
      };
      const prev = byVar.get(r.var);
      if (prev) {   // merge: first declared wins per field, later rows fill the gaps
        for (const k of ['label', 'slot', 'as', 'max', 'color']) {
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
      widgets.push({ kind: k, on: r.on, text: isStr(r.text) ? r.text : '', slot: slot || 'center', ttl: ttl(k === 'toast' ? TOAST_TTL : 2), color: isHudColor(r.color) ? r.color : undefined });
      return;
    }
    if (isStr(r.text)) {
      if (ttlBad) errors.push(`${where}.ttl must be a positive number of seconds`);
      widgets.push({ kind: 'legend', text: r.text, slot: slot || 'bottom', ttl: ttl(null), color: isHudColor(r.color) ? r.color : undefined });
      return;
    }
    errors.push(`${where} must be a readout { var, label? }, a banner { on, text } or a legend { text }`);
  });
  // fill readout defaults AFTER merging so a later row's slot/kind can still land on the first
  const out = widgets.map((w) => {
    if (w.kind !== 'readout') return strip(w);
    const as = w.as || 'text';
    return strip({ kind: 'readout', var: w.var, label: w.label !== undefined ? w.label : w.var, slot: w.slot || 'top-left', as, max: w.max, color: w.color });
  });
  return { widgets: out, errors };
}

function strip(o) { const r = {}; for (const k in o) if (o[k] !== undefined && o[k] !== null) r[k] = o[k]; return r; }

/** the slots a widget list uses, in HUD_SLOTS order (a renderer builds one column per slot). */
export function hudSlotsUsed(widgets) {
  const used = new Set((widgets || []).map((w) => w.slot));
  return HUD_SLOTS.filter((s) => used.has(s));
}

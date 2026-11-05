/**
 * MANA-UI's THEMES — the style layer over the greybox. A theme is closed words and colours, read and checked, and
 * written as CSS that sets the sheet's `--mana-*` variables plus a few rules of its own (a focus that fills or glows, a
 * cut corner, ornaments on the windows). It never reaches into the structure: what a screen holds, where and how it is
 * moved through are the components'; how it looks is the theme's. A node still carries no look (the kernel refuses
 * one); the theme is context, set once for a game.
 *
 *   theme: '<preset>' | { from?: '<preset>', tokens?, type?, faces?, frame?, corner?, plate?, focus?, motion?, fills?,
 *                         scale?, case?, ornaments? }
 *     tokens    colours (hex): ink, panel, line, accent (the four a theme needs) and mid, soft, paper, wash, accent2,
 *               harm, hp, mp, xp, stamina, shield, boss (derived from those four when left out)
 *     type      { body, display, mono }: a stack (system, serif, mono, display, rounded) or a family the theme brings
 *     faces     FONTS YOU OWN: [{ family, src: 'data:font/<ttf|otf|woff|woff2>;base64,…', weight?, style? }], inlined
 *               as @font-face so the page stays self-contained (a host maps its own shelf onto this: no URL, no CDN)
 *     frame     none | hairline | rule | double | bevel | heavy        the edge a window sits in
 *     corner    square | soft | round | cut
 *     plate     clear | flat | solid | gradient | textured            what a window sits on
 *     focus     marker | fill | glow | bracket                         how the focus shows (the ▶ stays, a shape)
 *     motion    none | ease | snap | stepped                           how a state change moves
 *     fills     pattern | solid                                        bar kinds by pattern (values first) or by colour
 *     scale     compact | normal | large                               the type scale
 *     case      upper | none                                           titles and headings
 *     ornaments [brackets | ticks | scanlines | dotgrid | stitch | hazard | glow]   drawn on and around the windows
 *     sides     the kits of the sides (a team, a seat, a lane) as hex, 1 to 8, cycled: the chip a row with `side` draws
 *               (a host with its own colour science hands its kits here: the broadcast's, already kept apart); left
 *               out, the accent, the second accent, then the Okabe–Ito set
 *
 *   THEMES · THEME_IDS     the presets: greybox (the default), modern, console, terminal, storybook, arcade
 *   THEME_WORDS            each closed word set
 *   readTheme(t)           → the theme, every field filled (throws, teaching)
 *   themeCss(t, scope?)    → CSS laid after the sheet (manaCss) under the same scope
 *   themeAdvice(t)         → [{ law, at, advice }]: contrast measured (WCAG), never refused
 *   contrast(a, b)         → the WCAG contrast ratio of two hex colours
 */
export const FACE_STACKS = Object.freeze({
  system: 'system-ui,-apple-system,"Segoe UI",sans-serif',
  serif: 'Georgia,"Times New Roman",serif',
  mono: 'ui-monospace,Menlo,Consolas,monospace',
  display: 'Impact,"Arial Black",system-ui,sans-serif',
  rounded: 'ui-rounded,"SF Pro Rounded","Nunito",system-ui,sans-serif',
});
export const THEME_WORDS = Object.freeze({
  frame: ['none', 'hairline', 'rule', 'double', 'bevel', 'heavy'],
  corner: ['square', 'soft', 'round', 'cut'],
  plate: ['clear', 'flat', 'solid', 'gradient', 'textured'],
  focus: ['marker', 'fill', 'glow', 'bracket'],
  motion: ['none', 'ease', 'snap', 'stepped'],
  fills: ['pattern', 'solid'],
  scale: ['compact', 'normal', 'large'],
  case: ['upper', 'none'],
  ornaments: ['brackets', 'ticks', 'scanlines', 'dotgrid', 'stitch', 'hazard', 'glow'],
});
const NEEDED = ['ink', 'panel', 'line', 'accent'];
const TOKENS = [...NEEDED, 'mid', 'soft', 'paper', 'wash', 'accent2', 'harm', 'hp', 'mp', 'xp', 'stamina', 'shield', 'boss'];
const KEYS = ['from', 'name', 'tokens', 'type', 'faces', 'frame', 'corner', 'plate', 'focus', 'motion', 'fills', 'scale', 'case', 'ornaments', 'sides'];
// the colour-blind-safe categorical set, for the sides a theme does not name
const OKABE_ITO = ['#e69f00', '#56b4e9', '#009e73', '#f0e442', '#0072b2', '#d55e00', '#cc79a7', '#999999'];

export const THEMES = Object.freeze({
  greybox: { name: 'Greybox', tokens: { ink: '#111111', panel: '#fafafa', line: '#111111', accent: '#111111', mid: '#6b6b6b', soft: '#bdbdbd', paper: '#fafafa', wash: '#ececec', accent2: '#111111', harm: '#111111', hp: '#111111', mp: '#111111', xp: '#111111', stamina: '#111111', shield: '#111111', boss: '#111111' }, type: { body: 'system', display: 'system', mono: 'mono' }, frame: 'hairline', corner: 'square', plate: 'solid', focus: 'marker', motion: 'none', fills: 'pattern', scale: 'normal', case: 'upper', ornaments: [], sides: ['#111111', '#8a8a8a', '#4a4a4a', '#b5b5b5', '#2a2a2a', '#6b6b6b', '#9e9e9e', '#3c3c3c'] },
  modern: { name: 'Modern', tokens: { ink: '#eef1f6', panel: '#151a23', line: '#3a4558', accent: '#5fb0ff', accent2: '#e8b96a', harm: '#ff5a4d' }, type: { body: 'system', display: 'system', mono: 'mono' }, frame: 'hairline', corner: 'round', plate: 'flat', focus: 'fill', motion: 'ease', fills: 'solid', scale: 'normal', case: 'none', ornaments: [] },
  console: { name: 'Console RPG', tokens: { ink: '#ffffff', panel: '#1b2a7c', line: '#eef1ff', accent: '#ffe07a', accent2: '#8fb0ff', harm: '#ff6b6b' }, type: { body: 'system', display: 'system', mono: 'mono' }, frame: 'double', corner: 'soft', plate: 'gradient', focus: 'marker', motion: 'snap', fills: 'solid', scale: 'normal', case: 'none', ornaments: [] },
  terminal: { name: 'Terminal', tokens: { ink: '#c8f5d0', panel: '#06140c', line: '#3c8a52', accent: '#7dff9a', accent2: '#e8d36a', harm: '#ff7a5a' }, type: { body: 'mono', display: 'mono', mono: 'mono' }, frame: 'hairline', corner: 'square', plate: 'solid', focus: 'bracket', motion: 'snap', fills: 'pattern', scale: 'normal', case: 'upper', ornaments: ['brackets', 'scanlines'] },
  storybook: { name: 'Storybook', tokens: { ink: '#3a2a20', panel: '#fff4e2', line: '#b98a5a', accent: '#a8471f', accent2: '#5f7f2e', harm: '#b3261e', hp: '#5f7f2e', mp: '#2f5d8a' }, type: { body: 'serif', display: 'serif', mono: 'mono' }, frame: 'rule', corner: 'soft', plate: 'textured', focus: 'marker', motion: 'ease', fills: 'solid', scale: 'normal', case: 'none', ornaments: ['stitch'] },
  arcade: { name: 'Arcade', tokens: { ink: '#ffffff', panel: '#0b0b10', line: '#ffffff', accent: '#ff2e88', accent2: '#00e5ff', harm: '#ff3b30', xp: '#ffe600' }, type: { body: 'system', display: 'display', mono: 'mono' }, frame: 'heavy', corner: 'cut', plate: 'solid', focus: 'glow', motion: 'stepped', fills: 'solid', scale: 'large', case: 'upper', ornaments: ['hazard'] },
});
export const THEME_IDS = Object.keys(THEMES);

// ── colour ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const rgb = (h) => { let x = h.slice(1); if (x.length === 3) x = [...x].map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)); };
const hex = (c) => `#${c.map((n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')).join('')}`;
/** a toward b by t (0..1) */
const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return hex(A.map((n, i) => n + (B[i] - n) * t)); };
const alpha = (h, a) => `rgba(${rgb(h).join(',')},${a})`;
const lum = (h) => { const [r, g, b] = rgb(h).map((n) => { const c = n / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/** The WCAG contrast ratio of two hex colours. */
export function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

// ── reading ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const FAMILY = /^[A-Za-z0-9][A-Za-z0-9 \-]{0,48}$/;
const FONT_SRC = /^data:(font\/(ttf|otf|woff2?)|application\/(x-font-ttf|font-woff2?|x-font-otf));base64,[A-Za-z0-9+/=]+$/;
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);

/** A theme read: a preset name, or words over a preset (`from`, the greybox when left out). Throws, teaching. */
export function readTheme(t) {
  if (t === undefined || t === null) t = 'greybox';
  if (typeof t === 'string') { if (!THEMES[t]) throw new Error(`theme '${t}' is one of: ${THEME_IDS.join(', ')}, or { from?, tokens?, … }`); t = { from: t }; }
  if (!isObj(t)) throw new Error('a theme is a preset name or { from?, tokens?, type?, faces?, frame?, corner?, plate?, focus?, motion?, fills?, scale?, case?, ornaments? }');
  for (const k in t) if (!KEYS.includes(k)) throw new Error(`theme.${k}: a theme says ${KEYS.join(', ')} (a look is words, never CSS)`);
  const from = t.from === undefined ? 'greybox' : t.from;
  if (!THEMES[from]) throw new Error(`theme.from '${from}' is one of: ${THEME_IDS.join(', ')}`);
  const base = THEMES[from], out = { name: typeof t.name === 'string' ? t.name : base.name, from };
  for (const k of Object.keys(THEME_WORDS)) {
    const x = t[k] === undefined ? base[k] : t[k];
    if (k === 'ornaments') {
      if (!Array.isArray(x) || x.some((o) => !THEME_WORDS.ornaments.includes(o))) throw new Error(`theme.ornaments is a list of: ${THEME_WORDS.ornaments.join(', ')}`);
      out.ornaments = [...new Set(x)];
    } else if (!THEME_WORDS[k].includes(x)) throw new Error(`theme.${k} is one of: ${THEME_WORDS[k].join(', ')}`);
    else out[k] = x;
  }
  // tokens: a theme's own over its preset's (a theme from another preset keeps that preset's colours it does not name)
  if (t.tokens !== undefined && !isObj(t.tokens)) throw new Error(`theme.tokens is { ${TOKENS.join(', ')} } (hex colours)`);
  // new core colours re-derive the rest (a dark theme over the greybox keeps none of its light greys)
  const own = isObj(t.tokens) ? t.tokens : {}, core = NEEDED.some((n) => own[n] !== undefined);
  const tok = core ? { ...Object.fromEntries(NEEDED.map((n) => [n, base.tokens[n]])), ...own } : { ...base.tokens, ...own };
  for (const k in tok) {
    if (!TOKENS.includes(k)) throw new Error(`theme.tokens.${k}: the tokens are ${TOKENS.join(', ')}`);
    if (typeof tok[k] !== 'string' || !HEX.test(tok[k])) throw new Error(`theme.tokens.${k} is a hex colour (#rgb or #rrggbb)`);
  }
  for (const k of NEEDED) if (!tok[k]) throw new Error(`theme.tokens.${k} is needed`);
  out.tokens = derive(tok);
  // new core colours re-derive the sides too (a theme over the greybox keeps none of its grey kits)
  const sides = t.sides !== undefined ? t.sides : core ? undefined : base.sides;
  if (sides !== undefined && (!Array.isArray(sides) || !sides.length || sides.length > 8 || sides.some((x) => typeof x !== 'string' || !HEX.test(x)))) throw new Error('theme.sides is 1 to 8 hex colours, the kits of the sides in order');
  const kits = sides || [out.tokens.accent, out.tokens.accent2, ...OKABE_ITO];
  out.sides = Array.from({ length: 8 }, (_, i) => kits[i % kits.length]);
  // faces you own, then the type that names them
  const faces = t.faces === undefined ? [] : t.faces;
  if (!Array.isArray(faces)) throw new Error('theme.faces is [{ family, src: data:font/…;base64,…, weight?, style? }]');
  out.faces = faces.map((x, i) => {
    if (!isObj(x) || typeof x.family !== 'string' || !FAMILY.test(x.family)) throw new Error(`theme.faces[${i}].family is a name (letters, digits, spaces, hyphens)`);
    if (typeof x.src !== 'string' || !FONT_SRC.test(x.src)) throw new Error(`theme.faces[${i}].src is the font's bytes as a data: URL (font/ttf, otf, woff or woff2, base64): a page loads nothing from anywhere`);
    const weight = x.weight === undefined ? 400 : x.weight, style = x.style === undefined ? 'normal' : x.style;
    if (![100, 200, 300, 400, 500, 600, 700, 800, 900].includes(weight)) throw new Error(`theme.faces[${i}].weight is 100…900 in hundreds`);
    if (!['normal', 'italic'].includes(style)) throw new Error(`theme.faces[${i}].style is normal or italic`);
    return { family: x.family, src: x.src, weight, style };
  });
  const families = new Set(out.faces.map((x) => x.family));
  const type = { ...base.type, ...(isObj(t.type) ? t.type : {}) };
  for (const k of ['body', 'display', 'mono']) if (!FACE_STACKS[type[k]] && !families.has(type[k])) throw new Error(`theme.type.${k} '${type[k]}' is a stack (${Object.keys(FACE_STACKS).join(', ')}) or a family in theme.faces`);
  out.type = { body: type.body, display: type.display, mono: type.mono };
  return out;
}
// the tokens a theme leaves out, from the four it gives
function derive(t) {
  const o = { ...t };
  o.mid = o.mid || mix(o.ink, o.panel, 0.4);
  o.soft = o.soft || mix(o.ink, o.panel, 0.72);
  o.paper = o.paper || mix(o.panel, o.ink, 0.06);
  o.wash = o.wash || mix(o.panel, o.accent, 0.2);
  o.accent2 = o.accent2 || o.accent;
  o.harm = o.harm || '#e5484d';
  o.hp = o.hp || '#46b36a';
  o.mp = o.mp || '#4f7cff';
  o.xp = o.xp || '#e6c229';
  o.stamina = o.stamina || '#e59a1f';
  o.shield = o.shield || '#8da4ef';
  o.boss = o.boss || o.harm;
  return o;
}

// ── writing ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const FRAMES = { none: ['0px', 'solid'], hairline: ['1px', 'solid'], rule: ['2px', 'solid'], double: ['4px', 'double'], bevel: ['3px', 'outset'], heavy: ['3px', 'solid'] };
const RADII = { square: '0px', soft: '5px', round: '12px', cut: '0px' };
const MOTION = { none: 'none', snap: 'none', ease: 'background-color .18s cubic-bezier(.2,.7,.2,1),border-color .18s,box-shadow .18s,color .18s', stepped: 'background-color .15s steps(3),border-color .15s steps(3),box-shadow .15s steps(3)' };
const SCALE = { compact: '0.9', normal: '1', large: '1.12' };
const corners = (c, len, w) => ['top left', 'top right', 'bottom left', 'bottom right'].flatMap((at) => [`linear-gradient(${c},${c}) ${at}/${len}px ${w}px no-repeat`, `linear-gradient(${c},${c}) ${at}/${w}px ${len}px no-repeat`]).join(',');
const stack = (k) => FACE_STACKS[k] || `'${k}',system-ui,sans-serif`;

/** The theme as CSS, laid after the sheet under the same scope. */
export function themeCss(theme, scope = '.mana-root') {
  const T = readTheme(theme), s = scope, k = T.tokens, win = `${s} .mana-window,${s} .mana-place>.mana-region:not(:has(>:is(.mana-reticle,.mana-banner,.mana-touchpad)))`;
  const plate = { clear: 'transparent', flat: alpha(k.panel, 0.86), solid: k.panel, gradient: `linear-gradient(180deg,${mix(k.panel, '#ffffff', 0.1)} 0%,${k.panel} 55%,${mix(k.panel, '#000000', 0.25)} 100%)`, textured: `repeating-linear-gradient(0deg,${k.panel} 0 2px,${mix(k.panel, k.ink, 0.05)} 2px 3px)` }[T.plate];
  const vars = { ...Object.fromEntries(Object.entries(k)), plain: k.accent, scrim: alpha(k.panel, 0.66), 'focus-ink': T.focus === 'fill' ? k.panel : k.ink,
    ...Object.fromEntries(T.sides.map((c, i) => [`side-${i}`, c])),
    font: stack(T.type.body), display: stack(T.type.display), mono: stack(T.type.mono), scale: SCALE[T.scale], case: T.case === 'upper' ? 'uppercase' : 'none',
    radius: RADII[T.corner], 'frame-w': FRAMES[T.frame][0], 'frame-s': FRAMES[T.frame][1], plate, motion: MOTION[T.motion] };
  const out = [
    ...T.faces.map((x) => `@font-face{font-family:'${x.family}';font-style:${x.style};font-weight:${x.weight};font-display:block;src:url(${x.src})}`),
    `${s}{${Object.entries(vars).map(([n, x]) => `--mana-${n}:${x}`).join(';')}}`,
    `${s} .mana-node[data-state=learned]{background:${k.accent};color:${k.panel};border-color:${k.accent}}`,
    `${s} .mana-node[data-state=learned][data-st=focus]{background:${mix(k.accent, k.panel, 0.2)};color:${k.panel};border-color:${k.ink}}`,
    `${s} .mana-node[data-state=learned][data-st=focus]::before{color:${k.panel}}`,
    `${s} .mana-awareness[data-state=suspicious] b,${s} .mana-awareness[data-state=searching] b{border-color:${k.accent2};color:${k.accent2}}`,
  ];
  if (T.corner === 'cut') out.push(`${win},${s} .mana-button{clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)}`);
  if (T.focus === 'fill') out.push(`${s} [data-st=focus]{background:${k.accent};border-color:${k.accent};color:${k.panel}}`, `${s} [data-st=focus]::before{color:${k.panel}}`, `${s} [data-st=focus] .mana-label,${s} [data-st=focus] .mana-mark,${s} [data-st=focus] .mana-text,${s} [data-st=focus] .mana-num{color:${k.panel}}`);
  if (T.focus === 'glow') out.push(`${s} [data-st=focus]{box-shadow:0 0 0 1px ${k.accent},0 0 14px ${alpha(k.accent, 0.75)}}`);
  if (T.focus === 'bracket') out.push(`${s} [data-st=focus]{border-color:transparent;background:${corners(k.accent, 8, 2)},${k.wash}}`);
  if (T.fills === 'solid') out.push(...['mp', 'xp', 'stamina', 'shield'].map((x) => `${s} .mana-bar[data-variant=${x}] .mana-track i{background:${k[x]}}`));
  // ornaments: brackets before, the rest layered after
  if (T.ornaments.includes('brackets')) out.push(`${s} .mana-window::before{content:"";position:absolute;inset:3px;pointer-events:none;background:${corners(k.accent, 12, 2)}}`);
  const after = [];
  if (T.ornaments.includes('ticks')) after.push(corners(k.line, 4, 4));
  if (T.ornaments.includes('hazard')) after.push(`repeating-linear-gradient(-45deg,${k.accent2} 0 6px,transparent 6px 12px) top/100% 5px no-repeat`);
  if (T.ornaments.includes('scanlines')) after.push(`repeating-linear-gradient(0deg,${alpha('#000000', 0.22)} 0 1px,transparent 1px 3px)`);
  if (T.ornaments.includes('dotgrid')) after.push(`radial-gradient(${alpha(k.line, 0.5)} 1px,transparent 1.2px) 0 0/10px 10px`);
  if (after.length) out.push(`${s} .mana-window::after{content:"";position:absolute;inset:0;pointer-events:none;background:${after.join(',')}}`);
  if (T.ornaments.includes('stitch')) out.push(`${win}{outline:1px dashed ${k.line};outline-offset:-6px}`);
  if (T.ornaments.includes('glow')) out.push(`${win}{box-shadow:0 0 0 1px ${alpha(k.accent, 0.5)},0 0 18px ${alpha(k.accent, 0.35)}}`);
  return out.join('\n');
}

/** What a theme's colours will read like, measured (WCAG contrast); advice only, never a refusal. */
export function themeAdvice(theme) {
  const T = readTheme(theme), k = T.tokens, out = [];
  const need = (law, a, b, min, at, what) => { const r = contrast(a, b); if (r < min) out.push({ law, at, advice: `${what}: ${r.toFixed(2)}:1 where ${min}:1 reads; move the two apart in lightness` }); };
  need('ink-reads', k.ink, k.panel, 4.5, 'tokens.ink / panel', 'text on a window');
  need('mid-reads', k.mid, k.panel, 3, 'tokens.mid / panel', 'labels and captions on a window');
  if (T.focus === 'fill') need('focus-reads', k.panel, k.accent, 4.5, 'tokens.panel / accent', 'text on a filled focus');
  else need('focus-shows', k.accent, k.panel, 3, 'tokens.accent / panel', 'the focus against a window');
  if (T.frame !== 'none') need('frame-shows', k.line, k.panel, 1.5, 'tokens.line / panel', 'a window\'s edge');
  need('harm-shows', k.harm, k.panel, 3, 'tokens.harm / panel', 'a low bar and an alerted enemy');
  T.sides.slice(0, 2).forEach((c, i) => need('side-shows', c, k.panel, 1.5, `sides[${i}] / panel`, `side ${i + 1}'s chip against a window`));
  if (T.fills === 'solid') out.push({ law: 'values-apart', at: 'fills', advice: 'solid fills tell hp, mp, xp and stamina apart by colour alone; keep their labels, or fills: pattern' });
  return out;
}

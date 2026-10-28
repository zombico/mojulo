/**
 * THE BOOK STYLES — how a book mojulo prints looks, named by key: a LOOK (the colours), a FORMAT (the page and how text
 * flows on it) and FACES (the type for text, titles and tables), each its own vocabulary, a STYLE a preset composing
 * the three. A book names a preset, or a preset with any part swapped, or the parts alone.
 *
 *   look     a presentation theme token (visual-language/themes.js PRESENTATION_THEMES): the vocabulary decks and
 *            charts already speak, so a book and a deck of one game share their words. The page is the theme's
 *            reading card, the tint its ground, the rule its border. A dark look is a screen look: printing it is
 *            advised against, never refused. `palette` recolours any part ({ paper, tint, ink, muted, rule, accent } as
 *            hex: what a solved palette's `ui` gives, pick_palette)
 *   format   digest | manual | pamphlet | sheet (BOOK_FORMATS): the page, its columns, the type's size, the margins
 *   paper    letter | a4 | half-letter | a5 (PAPERS): the format's own unless named
 *   faces    { text, display, mono } each a font-shelf key (image-outcomes/fonts/font-shelf.js); a vendored face is
 *            inlined by the press, the rest of the stack is the host's
 *
 *   BOOK_STYLES, BOOK_FORMATS, PAPERS, FACE_ROLES
 *   readBookStyle(spec) → { style, look, format, paper, size: [w, h], columns, pt, margin, colours, faces, stacks,
 *                           findings }   spec: a preset's key | { style?, look?, format?, paper?, faces?, palette? };
 *                           throws, teaching
 */
import { PRESENTATION_THEMES, PRESENTATION_THEME_NAMES } from '../../visual-language/themes.js';
import { FONT_SHELF } from '../image-outcomes/fonts/font-shelf.js';

export const PAPERS = Object.freeze({
  letter: Object.freeze(['8.5in', '11in']), a4: Object.freeze(['210mm', '297mm']),
  'half-letter': Object.freeze(['5.5in', '8.5in']), a5: Object.freeze(['148mm', '210mm']),
});

export const BOOK_FORMATS = Object.freeze({
  digest: Object.freeze({ reads: 'one column on a small page held in the hand: a zine, a module carried to the table', paper: 'half-letter', columns: 1, pt: 9.5, margin: '13mm 12mm 15mm' }),
  manual: Object.freeze({ reads: 'two columns on a full page: the classic module, maps across both', paper: 'letter', columns: 2, pt: 9.5, margin: '15mm 14mm 17mm' }),
  pamphlet: Object.freeze({ reads: 'one landscape sheet in three panels, folded: the whole adventure on a page', paper: 'letter', landscape: true, columns: 3, pt: 7.5, margin: '9mm', onePage: true }),
  sheet: Object.freeze({ reads: 'one form a page: character sheets, a referee\'s screen', paper: 'letter', columns: 1, pt: 10, margin: '12mm' }),
});

export const FACE_ROLES = Object.freeze(['text', 'display', 'mono']);

export const BOOK_STYLES = Object.freeze({
  tome: Object.freeze({ reads: 'an old book: warm paper, two columns, an engraved title', look: 'sepia', format: 'manual', faces: Object.freeze({ text: 'crimson-text', display: 'im-fell', mono: 'courier-prime' }) }),
  zine: Object.freeze({ reads: 'a photocopied zine: grey stock, black ink, one red, a heavy title', look: 'newsprint', format: 'digest', faces: Object.freeze({ text: 'crimson-text', display: 'archivo-black', mono: 'courier-prime' }) }),
  dossier: Object.freeze({ reads: 'a case file: typewriter on cream', look: 'paper', format: 'manual', faces: Object.freeze({ text: 'courier-prime', display: 'courier-prime', mono: 'courier-prime' }) }),
  pamphlet: Object.freeze({ reads: 'one sheet to fold: the adventure on a page, ink on white', look: 'high-contrast', format: 'pamphlet', faces: Object.freeze({ text: 'crimson-text', display: 'archivo-black', mono: 'courier-prime' }) }),
  screen: Object.freeze({ reads: 'for reading at a screen: a dark page, one column', look: 'dark', format: 'digest', faces: Object.freeze({ text: 'crimson-text', display: 'crimson-text', mono: 'courier-prime' }) }),
});

// a face's stack after its own family, by the role the shelf gives it
const STACK = {
  'text-serif': "'Iowan Old Style', Palatino, Georgia, serif", 'display-serif': "Georgia, 'Times New Roman', serif",
  'display-sans': "'Arial Black', Impact, system-ui, sans-serif", 'text-sans': 'system-ui, Helvetica, Arial, sans-serif',
  'text-mono': "'Courier New', ui-monospace, monospace", 'display-script': 'cursive',
};
const HEX = /^#[0-9a-f]{6}$/i;
const PALETTE_KEYS = ['paper', 'tint', 'ink', 'muted', 'rule', 'accent'];
const no = (m) => { throw new Error(`book style: ${m}`); };

export function readBookStyle(spec = 'tome') {
  const S = typeof spec === 'string' ? { style: spec } : spec;
  if (!S || typeof S !== 'object' || Array.isArray(S)) no(`a style is a preset (${Object.keys(BOOK_STYLES).join(', ')}) or { style?, look?, format?, paper?, faces?, palette? }`);
  for (const k of Object.keys(S)) if (!['style', 'look', 'format', 'paper', 'faces', 'palette'].includes(k)) no(`'${k}' is not part of a style (style, look, format, paper, faces, palette)`);
  const base = S.style === undefined ? BOOK_STYLES.tome : BOOK_STYLES[S.style];
  if (!base) no(`no style '${S.style}' (${Object.keys(BOOK_STYLES).join(', ')}): ${Object.entries(BOOK_STYLES).map(([k, v]) => `${k}, ${v.reads}`).join('; ')}`);
  const look = S.look ?? base.look, theme = PRESENTATION_THEMES[look];
  if (!theme) no(`no look '${look}' (${PRESENTATION_THEME_NAMES.join(', ')})`);
  const formatId = S.format ?? base.format, F = BOOK_FORMATS[formatId];
  if (!F) no(`no format '${formatId}' (${Object.entries(BOOK_FORMATS).map(([k, v]) => `${k}: ${v.reads}`).join('; ')})`);
  const paper = S.paper ?? F.paper;
  if (!PAPERS[paper]) no(`no paper '${paper}' (${Object.keys(PAPERS).join(', ')})`);
  const faces = { ...base.faces, ...(S.faces ?? {}) };
  for (const [role, key] of Object.entries(faces)) {
    if (!FACE_ROLES.includes(role)) no(`'${role}' is not a face's role (${FACE_ROLES.join(', ')})`);
    if (!FONT_SHELF[key]) no(`no face '${key}' on the shelf (${Object.keys(FONT_SHELF).join(', ')})`);
  }
  const c = theme.chrome;
  const colours = { paper: c.panelBg, tint: c.pageBg, ink: c.ink, muted: c.mutedInk, rule: c.panelBorder, accent: c.accent };
  for (const [k, v] of Object.entries(S.palette ?? {})) {
    if (!PALETTE_KEYS.includes(k)) no(`palette.${k} is not a colour of the page (${PALETTE_KEYS.join(', ')})`);
    if (!HEX.test(v)) no(`palette.${k} is a hex colour like #1f2933`);
    colours[k] = v.toLowerCase();
  }
  const stacks = Object.fromEntries(Object.entries(faces).map(([role, key]) => [role, `'${FONT_SHELF[key].family}', ${STACK[FONT_SHELF[key].role] ?? 'serif'}`]));
  const [w, h] = PAPERS[paper];
  const findings = [];
  if (theme.surface === 'dark') findings.push({ level: 'advice', text: `the ${look} look is a screen look: printed, it lays ink edge to edge; for paper, a light look (paper, sepia, newsprint, light, high-contrast)` });
  if (formatId === 'pamphlet' && paper === 'half-letter') findings.push({ level: 'advice', text: 'a pamphlet on half-letter sets its type very small: letter or A4 folds better' });
  return {
    style: S.style ?? (typeof spec === 'string' ? spec : 'tome'), look, format: formatId, paper,
    size: F.landscape ? [h, w] : [w, h], columns: F.columns, pt: F.pt, margin: F.margin, onePage: !!F.onePage,
    colours, faces, stacks, findings,
  };
}

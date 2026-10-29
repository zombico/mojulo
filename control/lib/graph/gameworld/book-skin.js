/**
 * THE BOOK'S SKIN — how a world's book (bible-html.js) looks, authored by the model as data: a preset by name, or the
 * preset's values overridden, or a skin of its own. Every value is a word or a number checked here, so a skin can only
 * recolour, retype and reframe the book, never reach into its markup.
 *
 *   book: { skin: '<preset>' | { from?: '<preset>', paper?, sheet?, ink?, muted?, rule?, accent?, signal?, display?, body?,
 *           mono?, frame?: 'rule' | 'bracket', texture?: 'none' | 'grid' | 'scanlines', plates?: 'paper' | 'night' } }
 *     colours   '#rrggbb': the page, a panel, the text, the quiet text, the rules, the accent (the approved, the trail),
 *               the signal (a warning, a local change)
 *     faces     font families by name (letters, digits and spaces), loaded from Google Fonts; the book's own when absent
 *     frame     `bracket`: square panels with corner brackets; `rule` the book's own rounded rules
 *     texture   a faint ground over the page: a grid, or scanlines
 *     plates    `night`: the plates drawn in the book's ink (a plan) laid on the panel in the skin's ink; `paper` as drawn
 *
 *   BOOK_SKINS            the presets
 *   readBookSkin(spec)    → the resolved skin, or throws naming the word
 *   skinHead(skin)        → { link, css }: the fonts' stylesheet link (or '') and the rules laid over the book's own
 *
 * A world without `book` takes none of it: its book is the bytes it was.
 */

export const BOOK_SKINS = Object.freeze({
  // a modern military briefing: near-black olive, phosphor green, amber signals, bracketed panels, scanlines
  briefing: Object.freeze({
    paper: '#0a0e0b', sheet: '#101712', ink: '#c9e8cc', muted: '#6f8f74', rule: '#26402d', accent: '#5ef08a', signal: '#ffb000',
    display: 'Oxanium', body: 'IBM Plex Sans Condensed', mono: 'Share Tech Mono', frame: 'bracket', texture: 'scanlines', plates: 'night',
  }),
});
const COLOURS = ['paper', 'sheet', 'ink', 'muted', 'rule', 'accent', 'signal'];
const FACES = ['display', 'body', 'mono'];
const WORDS = { frame: ['rule', 'bracket'], texture: ['none', 'grid', 'scanlines'], plates: ['paper', 'night'] };
const KEYS = ['from', ...COLOURS, ...FACES, ...Object.keys(WORDS)];
const HEX = /^#[0-9a-f]{6}$/i, FACE = /^[A-Za-z0-9 ]{2,40}$/;
const fail = (m) => { throw new Error(`book: ${m}`); };

/** A world's `book` → its resolved skin (null when it names none). */
export function readBookSkin(book) {
  if (book === undefined || book === null) return null;
  if (!book || typeof book !== 'object' || Array.isArray(book) || Object.keys(book).some((k) => k !== 'skin')) fail("is { skin: '<preset>' | { … } }");
  const s = book.skin;
  if (typeof s === 'string') {
    if (!BOOK_SKINS[s]) fail(`skin '${s}' is not a preset (${Object.keys(BOOK_SKINS).join(', ')}), or a skin { ${KEYS.join(', ')} }`);
    return { ...BOOK_SKINS[s] };
  }
  if (!s || typeof s !== 'object' || Array.isArray(s)) fail(`skin is a preset (${Object.keys(BOOK_SKINS).join(', ')}) or { ${KEYS.join(', ')} }`);
  for (const k of Object.keys(s)) if (!KEYS.includes(k)) fail(`skin.${k} is not a skin setting (${KEYS.join(', ')})`);
  if (s.from !== undefined && !BOOK_SKINS[s.from]) fail(`skin.from '${s.from}' is not a preset (${Object.keys(BOOK_SKINS).join(', ')})`);
  for (const k of COLOURS) if (s[k] !== undefined && !HEX.test(s[k])) fail(`skin.${k} is a colour '#rrggbb'`);
  for (const k of FACES) if (s[k] !== undefined && !FACE.test(s[k])) fail(`skin.${k} is a font family's name (letters, digits and spaces)`);
  for (const [k, ws] of Object.entries(WORDS)) if (s[k] !== undefined && !ws.includes(s[k])) fail(`skin.${k} is ${ws.join(' or ')}`);
  const { from, ...own } = s;
  return { ...(from ? BOOK_SKINS[from] : {}), ...own };
}

const fam = (f, fallback) => `"${f}",${fallback}`;

/** The skin as the book's head: its fonts' link, and its rules after the book's own (so they win in either scheme). */
export function skinHead(K) {
  if (!K) return { link: '', css: '' };
  const faces = FACES.filter((k) => K[k]).map((k) => K[k]);
  const link = faces.length ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${[...new Set(faces)].map((f) => `family=${f.trim().replace(/ +/g, '+')}:wght@400;600;700`).join('&')}&display=swap">` : '';
  const vars = [
    K.paper && `--paper:${K.paper}`, K.sheet && `--sheet:${K.sheet}`, K.ink && `--ink:${K.ink}`, K.muted && `--muted:${K.muted}`,
    K.rule && `--rule:${K.rule};--dot:${K.rule}`, K.accent && `--c-trail:${K.accent}`, K.signal && `--local:${K.signal};--c-place:${K.signal}`,
    K.display && `--display:${fam(K.display, 'sans-serif')}`, K.body && `--body:${fam(K.body, 'sans-serif')}`, K.mono && `--mono:${fam(K.mono, 'monospace')}`,
  ].filter(Boolean);
  const css = [
    vars.length ? `:root{${vars.join(';')}}` : '',
    K.accent ? `a{color:var(--c-trail)}h2{color:var(--c-trail)}.mast{border-bottom-color:var(--c-trail)}.tabs a:hover{box-shadow:inset 0 3px 0 var(--c-trail)}` : '',
    K.frame === 'bracket' ? '.card,.hero,.canvas,.local,.nature,.gate,details,.stop .im,.sec-im{border-radius:0}'
      + '.card,.hero,.local,.nature,.gate{background-image:linear-gradient(var(--c-trail),var(--c-trail)),linear-gradient(var(--c-trail),var(--c-trail)),linear-gradient(var(--c-trail),var(--c-trail)),linear-gradient(var(--c-trail),var(--c-trail));'
      + 'background-repeat:no-repeat;background-size:14px 2px,2px 14px,14px 2px,2px 14px;background-position:0 0,0 0,100% 100%,100% 100%}'
      + '.tabs a{border-radius:0}h1,h2,h3{letter-spacing:.08em}' : '',
    K.texture === 'scanlines' ? 'body::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:50;background:repeating-linear-gradient(to bottom,transparent 0 2px,rgba(0,0,0,.22) 2px 3px)}' : '',
    K.texture === 'grid' ? 'body{background-image:linear-gradient(var(--rule) 1px,transparent 1px),linear-gradient(90deg,var(--rule) 1px,transparent 1px);background-size:32px 32px}' : '',
    // (the plates draw in currentColor on the panel, programs.js programPlanSvg: given the skin's ink on its panel they are
    // re-inked with no filter; a plate drawn in fixed colours keeps them, on its own ground)
    K.plates === 'night' ? '.sec-im,.places svg,.stop .im,.canvas,.hero{background-color:var(--sheet);color:var(--ink)}' : '',
  ].filter(Boolean).join('\n');
  return { link, css };
}

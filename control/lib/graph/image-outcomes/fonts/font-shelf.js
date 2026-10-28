/**
 * font-shelf — the curated titling/text font vocabulary for covers and books.
 *
 * mojulo owns cover TEXT as geometry (the carve kernel turns a face + a string
 * into vector outlines, title-geometry.js fills/extrudes them). That geometry is
 * only as portable as the face it's carved from, so the shelf is a small, curated
 * set of open-license (SIL OFL) display + text faces that ship WITH the repo —
 * not host fonts. A cover names a face by KEY (`archivo-black`), never a path, so
 * the same recipe carves identically on any host.
 *
 * Vendoring: drop the OFL `.ttf` named in each entry's `file` into THIS dir (see
 * fonts/README.md). Until a face is vendored, `loadFace` falls back to a system
 * face so the pipeline runs during bring-up — the KEY/role stays stable, only the
 * bytes change once the real face lands. `license` is carried per entry for
 * attribution (fonts/LICENSES.md).
 *
 * A book (lib/graph/book/) sets type in the same faces, by the same keys, as CSS: `styles` names the files of a face's
 * italic and bold where it has them, and `fontFaceCss(key)` inlines the vendored files as @font-face rules (a face
 * not vendored inlines nothing, and the page's stack falls back to the host's).
 */
import { readFileSync } from 'node:fs';
import { moduleDir } from '../../../module-dir.js';
import path from 'node:path';

import { loadFont } from '../../../motion/glyph-carver.js';

const HERE = moduleDir(import.meta.url, 'lib/graph/image-outcomes/fonts');

/**
 * key → { family, role, file, license, fallbacks }. `file` is the vendored OFL
 * face (resolved from this dir); `fallbacks` are host faces tried, in order, only
 * until `file` is vendored. `role`: display-* faces title/headline work; text-*
 * faces subtext (author, cover-lines).
 */
export const FONT_SHELF = {
  'archivo-black': {
    family: 'Archivo Black', role: 'display-sans', file: 'archivo-black.ttf', license: 'OFL-1.1',
    fallbacks: ['/System/Library/Fonts/Supplemental/Arial Black.ttf'],
  },
  'im-fell': {
    family: 'IM Fell English', role: 'display-serif', file: 'im-fell-english.ttf', license: 'OFL-1.1',
    styles: { italic: 'im-fell-english-italic.ttf' },
    fallbacks: [
      '/System/Library/Fonts/Supplemental/Academy Engraved LET Fonts.ttf',
      '/System/Library/Fonts/Supplemental/Georgia.ttf',
    ],
  },
  'great-vibes': {
    family: 'Great Vibes', role: 'display-script', file: 'great-vibes.ttf', license: 'OFL-1.1',
    fallbacks: ['/System/Library/Fonts/Supplemental/Apple Chancery.ttf'],
  },
  // a book's text face: an old-style serif for long reading
  'crimson-text': {
    family: 'Crimson Text', role: 'text-serif', file: 'crimson-text.ttf', license: 'OFL-1.1',
    styles: { italic: 'crimson-text-italic.ttf', bold: 'crimson-text-bold.ttf' },
    fallbacks: ['/System/Library/Fonts/Supplemental/Georgia.ttf'],
  },
  // a book's typewriter: tables, the dice, a dossier
  'courier-prime': {
    family: 'Courier Prime', role: 'text-mono', file: 'courier-prime.ttf', license: 'OFL-1.1',
    styles: { bold: 'courier-prime-bold.ttf', italic: 'courier-prime-italic.ttf' },
    fallbacks: ['/System/Library/Fonts/Supplemental/Courier New.ttf'],
  },
  'inter': {
    family: 'Inter', role: 'text-sans', file: 'inter.ttf', license: 'OFL-1.1',
    fallbacks: [
      '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
      '/System/Library/Fonts/Supplemental/Arial.ttf',
    ],
  },
};

const DEFAULT_KEY = 'archivo-black';
// Last-resort faces tried after a face's own fallbacks, so bring-up never dead-ends.
const GLOBAL_FALLBACKS = [
  '/System/Library/Fonts/Supplemental/Arial Black.ttf',
  '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
];

const CACHE = new Map();

/** Load an opentype font for a shelf key (falls back to system faces during
 *  bring-up, then the global fallbacks). Cached by resolved path. */
export function loadFace(key) {
  const entry = FONT_SHELF[key] || FONT_SHELF[DEFAULT_KEY];
  const tries = [path.join(HERE, entry.file), ...(entry.fallbacks || []), ...GLOBAL_FALLBACKS];
  for (const p of tries) {
    if (CACHE.has(p)) return CACHE.get(p);
    try {
      const f = loadFont(readFileSync(p));
      CACHE.set(p, f);
      return f;
    } catch { /* try the next candidate */ }
  }
  throw new Error(`font-shelf: no usable face for '${key}' (tried ${tries.join(', ')}). Vendor ${entry.file} into fonts/ or install a fallback.`);
}

/** All shelf keys (for recommend_cover / a vocab card). */
export function faceKeys() {
  return Object.keys(FONT_SHELF);
}

/** Metadata for one face key, or null. */
export function faceMeta(key) {
  return FONT_SHELF[key] || null;
}

/** Default titling face key. */
export const DEFAULT_TITLE_FACE = DEFAULT_KEY;
export const DEFAULT_TEXT_FACE = 'inter';

const FACE_CSS = new Map();
/** The vendored files of a shelf face as @font-face rules, for the styles asked ('regular', 'italic', 'bold'; each the
 *  face has); '' when the face is not vendored, so a page names it in its stack and the host's face stands in. */
export function fontFaceCss(key, styles = ['regular', 'italic', 'bold']) {
  const memo = `${key}|${styles.join(',')}`;
  if (FACE_CSS.has(memo)) return FACE_CSS.get(memo);
  const entry = FONT_SHELF[key];
  if (!entry) throw new Error(`font-shelf: no face '${key}' (${Object.keys(FONT_SHELF).join(', ')})`);
  const files = { regular: [entry.file, 'normal', '400'], italic: [entry.styles?.italic, 'italic', '400'], bold: [entry.styles?.bold, 'normal', '700'] };
  const rules = [];
  for (const [file, style, w] of styles.map((s) => files[s]).filter(Boolean)) {
    if (!file) continue;
    let bytes;
    try { bytes = readFileSync(path.join(HERE, file)); } catch { continue; }
    rules.push(`@font-face{font-family:'${entry.family}';font-style:${style};font-weight:${w};font-display:block;src:url(data:font/ttf;base64,${bytes.toString('base64')}) format('truetype')}`);
  }
  const css = rules.join('');
  FACE_CSS.set(memo, css);
  return css;
}

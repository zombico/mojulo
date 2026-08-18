/**
 * font-shelf — the curated titling/text font vocabulary for covers.
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
    fallbacks: [
      '/System/Library/Fonts/Supplemental/Academy Engraved LET Fonts.ttf',
      '/System/Library/Fonts/Supplemental/Georgia.ttf',
    ],
  },
  'great-vibes': {
    family: 'Great Vibes', role: 'display-script', file: 'great-vibes.ttf', license: 'OFL-1.1',
    fallbacks: ['/System/Library/Fonts/Supplemental/Apple Chancery.ttf'],
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

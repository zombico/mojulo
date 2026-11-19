/**
 * hero-look — how a hero the person designs LOOKS where its words say so: its hair (a style, how long, its colour) and
 * what hangs loose on it (a cape, a gown, a robe), read from its description or said outright, and laid over the hero
 * its sheet rolled. The sheet still rolls everything else (its face, its build, its clothes); a look only says what the
 * person said. What hangs loose is what a street swings in the air (brawl-sway.js), so a hero described with long hair
 * and a cape gets them, and they move.
 *
 *   readLook(v, at)         an explicit look checked → the look, or null: { hair?, length?, colour?, cape?, gown?, robe? }
 *                           hair    a style (LOOK_HAIR: the western head's library and the anime families, either word)
 *                           length  how long, about the style's own (0.5 … 2: 2 to the waist)
 *                           colour  a colour word (HAIR_COLOURS) or '#rrggbb'
 *                           cape | gown | robe   true, or where its hem falls (LOOK_HEMS)
 *   lookOfBrief(brief)      → { look, read: [the phrases read] }: the same words found in a sentence ("long white hair down
 *                           to her waist", "a ponytail", "a flowing cape", "a long skirt"); words it does not know are
 *                           left to the sheet
 *   heroLook(brief, look)   → the look its description gives, its explicit words over it, or null when neither says any
 *   lookSpec(look, sheet, head)  → the hero door's words over the sheet's (`hair`, `palette`, `outfit`) for `head`
 *                           ('anime' or the western 'landmark'): the hair a style that head wears, its colour the palette's
 *                           Hair, each piece added to the sheet's outfit build (its own of that kind replaced; none
 *                           rolled, an outfit of the pieces; one garment's word kept, the pieces left off)
 * Pure.
 */

/** the hair styles a look may say: the western head's library (the landmark head wears any of them) and the anime head's
 * families, each lowered to the other head's nearest */
export const LOOK_HAIR = Object.freeze({
  // style: [the anime family, the western style (female, male)]
  long: ['long', 'long', 'long'], wavy: ['long', 'wavy', 'wavy'], layers: ['long', 'layers', 'curtains'], ponytail: ['long', 'ponytail', 'ponytail'],
  braid: ['long', 'braid', 'braid'], bun: ['long', 'bun', 'bun'], hime: ['hime', 'long', 'long'],
  bob: ['bob', 'bob', 'bob'], angled: ['bob', 'angled', 'angled'], pixie: ['bob', 'pixie', 'crop'], animeBob: ['bob', 'animeBob', 'animeBob'],
  short: ['short', 'pixie', 'crop'], animeShort: ['short', 'animeShort', 'animeShort'], crop: ['short', 'crop', 'crop'], crew: ['short', 'crew', 'crew'],
  buzz: ['short', 'buzz', 'buzz'], taper: ['short', 'taper', 'taper'], undercut: ['short', 'undercut', 'undercut'], quiff: ['short', 'quiff', 'quiff'],
  swept: ['short', 'swept', 'swept'], curtains: ['short', 'curtains', 'curtains'], none: ['none', 'none', 'none'],
});
/** the hair's colours by name (the palette's Hair) */
export const HAIR_COLOURS = Object.freeze({
  white: '#ece8e1', silver: '#c8ccd4', grey: '#8d8f95', gray: '#8d8f95', black: '#1c1a1e', dark: '#2a2224', brown: '#5a3b26',
  chestnut: '#6e3b22', blonde: '#e2c46e', blond: '#e2c46e', golden: '#d9a83c', red: '#a8321e', ginger: '#b8562a', auburn: '#8e3a22',
  copper: '#b06232', blue: '#2f58b8', green: '#2f8a4a', purple: '#6a3fa0', violet: '#7a4fc0', pink: '#e27aa8', teal: '#23898a',
});
/** where a loose piece's hem may fall */
export const LOOK_HEMS = Object.freeze(['thigh', 'knee', 'shin', 'ankle']);
const PIECES = Object.freeze(['cape', 'gown', 'robe']);
// (the hero door's piece each is: a cape is its cloak)
const PIECE_KIND = Object.freeze({ cape: 'cloak', gown: 'gown', robe: 'robe' });
export const LOOK_WORDS = Object.freeze(['hair', 'length', 'colour', ...PIECES]);
const LENGTH = Object.freeze([0.5, 2]);

const fail = (m) => new Error(`gameworld: ${m}`);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const hexOf = (c) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : HAIR_COLOURS[typeof c === 'string' ? c.toLowerCase() : ''] ?? null);

export function readLook(v, at = 'look') {
  if (v === undefined || v === null) return null;
  if (!isObj(v)) throw fail(`${at} is { ${LOOK_WORDS.join('?, ')}? }: how the hero looks where its sheet should not roll it`);
  for (const k of Object.keys(v)) if (!LOOK_WORDS.includes(k)) throw fail(`${at}.${k} is not a look's word (${LOOK_WORDS.join(', ')})`);
  if (v.hair !== undefined && !LOOK_HAIR[v.hair]) throw fail(`${at}.hair is a style: ${Object.keys(LOOK_HAIR).join(', ')}`);
  if (v.length !== undefined && !(Number.isFinite(v.length) && v.length >= LENGTH[0] && v.length <= LENGTH[1])) throw fail(`${at}.length is how long the hair is about its style's own, ${LENGTH[0]} to ${LENGTH[1]} (2 to the waist)`);
  if (v.colour !== undefined && !hexOf(v.colour)) throw fail(`${at}.colour is a colour (${Object.keys(HAIR_COLOURS).join(', ')}) or '#rrggbb'`);
  for (const p of PIECES) if (v[p] !== undefined && v[p] !== true && v[p] !== false && !LOOK_HEMS.includes(v[p])) throw fail(`${at}.${p} is true, false, or where its hem falls (${LOOK_HEMS.join(', ')})`);
  const out = {};
  for (const k of LOOK_WORDS) if (v[k] !== undefined) out[k] = k === 'colour' ? hexOf(v[k]) : v[k];
  return Object.keys(out).length ? out : null;
}

// ── the words found in a sentence ──
const STYLE_WORDS = Object.freeze({ ponytail: 'ponytail', pigtails: 'braid', braid: 'braid', braids: 'braid', braided: 'braid', plait: 'braid', plaits: 'braid', bun: 'bun', topknot: 'bun', bob: 'bob', pixie: 'pixie', buzzcut: 'buzz', buzz: 'buzz', shaved: 'buzz', crewcut: 'crew', undercut: 'undercut', quiff: 'quiff', pompadour: 'quiff', bald: 'none', wavy: 'wavy', curly: 'wavy', curls: 'wavy', hime: 'hime' });
const HAIR_NOUNS = new Set(['hair', 'haired', 'mane', 'locks', 'tresses']);
// (the words that mean a hairstyle wherever they stand; the rest (a bob, a bun, a braid, shaved) are read only beside the
// hair, as a name, a pastry, a uniform's gold braid or a clean-shaved jaw are not hair)
const HAIR_ONLY = new Set(['ponytail', 'topknot', 'pompadour', 'quiff', 'undercut', 'buzzcut', 'crewcut', 'bald', 'pigtails']);
const PIECE_WORDS = Object.freeze({ cape: 'cape', capes: 'cape', cloak: 'cape', mantle: 'cape', gown: 'gown', dress: 'gown', skirt: 'gown', robe: 'robe', robes: 'robe' });
// (how long a piece hangs, from the words just before it)
const HEM_WORDS = Object.freeze({ long: 'ankle', flowing: 'ankle', trailing: 'ankle', sweeping: 'ankle', billowing: 'ankle', floor: 'ankle', short: 'knee', mini: 'thigh' });

export function lookOfBrief(brief) {
  const words = String(brief ?? '').toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/[\s-]+/).filter(Boolean);
  const look = {}, read = [];
  const near = (i, back, fwd = 0) => words.slice(Math.max(0, i - back), i + fwd + 1);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    // the hair: a colour and a length just before it ("long white hair", "silver-haired"), and how far it falls after
    // it ("hair down to her waist")
    if (HAIR_NOUNS.has(w)) {
      const before = near(i, 4).slice(0, -1), after = words.slice(i + 1, i + 6);
      const colour = before.map((x) => HAIR_COLOURS[x]).filter(Boolean).pop();
      if (colour && look.colour === undefined) { look.colour = colour; read.push(`${before.find((x) => HAIR_COLOURS[x] === colour)} ${w}`); }
      const style = before.map((x) => STYLE_WORDS[x] ?? (x === 'long' ? 'long' : x === 'short' ? 'short' : x === 'spiky' ? 'animeShort' : null)).filter(Boolean).pop()
        ?? after.map((x) => STYLE_WORDS[x]).find(Boolean);
      if (style && look.hair === undefined) { look.hair = style; read.push(`${style} ${w}`); }
      if ([...before, ...after].includes('waist') || after.includes('hips')) { look.hair ??= 'long'; look.length = 2; read.push('to the waist'); }
      else if ([...before, ...after].includes('shoulder') || [...before, ...after].includes('shoulders')) { look.hair ??= 'layers'; read.push('to the shoulders'); }
      continue;
    }
    if (HAIR_ONLY.has(w) && look.hair === undefined) { look.hair = STYLE_WORDS[w]; read.push(w); continue; }
    // what hangs loose: its hem from the word just before it ("a long cape", "a flowing cloak", "a short skirt")
    const piece = PIECE_WORDS[w];
    if (piece && look[piece] === undefined) {
      const hem = near(i, 2).slice(0, -1).map((x) => HEM_WORDS[x]).filter(Boolean).pop() ?? (w === 'skirt' ? 'knee' : piece === 'cape' ? true : 'ankle');
      look[piece] = hem;
      read.push(w);
    }
  }
  return { look: Object.keys(look).length ? look : null, read };
}

export function heroLook(brief, look) {
  const fromBrief = brief ? lookOfBrief(brief).look : null, said = readLook(look);
  const out = { ...(fromBrief ?? {}), ...(said ?? {}) };
  return Object.keys(out).length ? out : null;
}

const styleOf = (h) => (typeof h === 'string' ? h : Array.isArray(h) ? styleOf(h[0]) : isObj(h) ? h.style ?? null : null);

export function lookSpec(look, sheet = {}, head = 'landmark') {
  if (!look) return {};
  const out = {};
  const female = (typeof sheet.cast === 'string' ? sheet.cast : sheet.cast?.pole) === 'female';
  // THE HAIR: the style said, or the sheet's own when only its length is, as a style the head wears
  if (look.hair !== undefined || look.length !== undefined) {
    const own = styleOf(sheet.hair);
    const said = look.hair ?? (own && LOOK_HAIR[own] ? own : look.length > 1 ? 'long' : null);
    if (said) {
      const L = LOOK_HAIR[said], style = head === 'anime' ? L[0] : female ? L[1] : L[2];
      out.hair = look.length !== undefined && style !== 'none' ? [style, { length: look.length }] : style;
    }
  }
  if (look.colour) out.palette = { ...(isObj(sheet.palette) ? sheet.palette : {}), Hair: look.colour };
  // WHAT HANGS LOOSE: each piece on the sheet's outfit, the sheet's own of that kind replaced; none is taken off
  const pieces = PIECES.filter((p) => look[p] !== undefined && look[p] !== false).map((p) => ({ kind: PIECE_KIND[p], ...(typeof look[p] === 'string' ? { hem: look[p] } : {}) }));
  if (pieces.length) {
    // (an outfit build takes them beside its own; none rolled (an armour look), an outfit of the pieces alone; an outfit
    // said as one garment's word takes no pieces without being replaced, so it is kept and they are left off)
    const O = isObj(sheet.outfit) ? sheet.outfit : null, kinds = new Set(pieces.map((p) => p.kind));
    if (O) out.outfit = { ...O, pieces: [...(Array.isArray(O.pieces) ? O.pieces.filter((p) => !kinds.has(p?.kind)) : []), ...pieces] };
    else if (sheet.outfit === undefined || sheet.outfit === null) out.outfit = { type: 'outfit', style: 'adventurer', pieces };
  }
  return out;
}

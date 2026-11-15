/**
 * sfx-shelf/find — the shelf searched by intent, as the vehicle registry is (vehicle-registry/roster.js findVehicles):
 * words rank, facets filter, deterministic. Pure.
 *
 *   findSounds({ words?, category?, slot?, matter?, weight?, genre?, style?, limit? }) → [{ id, row, facets, score, why }]
 *   solveSound(words, filter?)    → { id, dials, why, alternatives } or null: the best row, and the dials its family
 *                                   takes from the words ("heavy footsteps on gravel" → step-gravel at body heavy)
 *   suggestSounds(word, filter?)  → a refusal's tail: the rows a word nearly names
 *
 * Words: an id or an alias exactly scores 100; a sound word (`say`: カチャ, kacha, clink) exactly 90, since one word
 * may score several sounds; otherwise the share of the asked words found among the row's own (its id, label, aliases,
 * sound words, category and matter), up to 60. A word that names two things is read by the rest: "fire" alone is the
 * shot it names, "a crackling fire" the fire. Ties go to the shelf's newest voices (`fresh`: the mouth voices them),
 * then to roster order.
 */
import { SOUNDS, SOUND_IDS, normalizeName, resolveSoundId } from './roster.js';
import { facetsOf } from './facets.js';
import { STYLES } from './styles.js';
import { FAMILIES } from './families.js';

const STOP = new Set(['a', 'an', 'the', 'of', 'on', 'in', 'into', 'with', 'and', 'to', 'for', 'its', 'it', 'is', 'at', 'as', 'by', 'from', 'some', 'sound', 'sounds', 'noise']);
/** A word as the finder compares it: lower case, plural and -ing / -ed / a final e cut (crackling and crackle meet). */
const stem = (t) => {
  let w = t;
  if (w.length > 4 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('es')) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s')) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1);
  return w;
};
const tokens = (s) => normalizeName(s).replace(/[^\p{L}\p{N} ]+/gu, ' ').split(' ').filter((t) => t && !STOP.has(t)).map(stem);

let WORDS = null;
const wordsOf = (id) => {
  if (!WORDS) WORDS = new Map();
  if (!WORDS.has(id)) {
    const r = SOUNDS[id], f = facetsOf(id);
    WORDS.set(id, new Set([id.replace(/-/g, ' '), r.label, ...r.aliases, ...f.say, r.category, ...f.matter].flatMap(tokens)));
  }
  return WORDS.get(id);
};
const voicedIn = (r, style) => (STYLES[style]?.palette ? !!r.palette || !!r.family : !!r.voices?.[style] || (style === 'realistic' && !!r.make));

/** The shelf searched: ranked rows. With no words, every row the facets pass, newest voices first, then roster order. */
export function findSounds({ words: asked, category, slot, matter, weight, genre, style, limit = 12 } = {}) {
  const exact = asked ? resolveSoundId(asked) : null;
  const said = asked ? normalizeName(asked) : '';
  const want = asked ? tokens(asked) : [];
  const out = [];
  SOUND_IDS.forEach((id, order) => {
    const r = SOUNDS[id], f = facetsOf(id);
    if (category && r.category !== category) return;
    if (slot && r.slot !== slot) return;
    if (matter && !f.matter.includes(matter)) return;
    if (weight && f.weight !== weight) return;
    if (genre && !f.genres.includes(genre)) return;
    if (style && !voicedIn(r, style)) return;
    let score = 0;
    const why = [];
    if (exact === id) { score = 100; why.push('named exactly'); }
    else if (said && f.say.some((w) => normalizeName(w) === said)) { score = 90; why.push(`its sound word: ${said}`); }
    else if (want.length) {
      const have = wordsOf(id);
      const hit = want.filter((t) => have.has(t));
      if (!hit.length) return;
      score = Math.round((60 * hit.length) / want.length);
      why.push(`its words: ${hit.join(', ')}`);
    }
    if (f.fresh) why.push('a new voice (mouth foley)');
    out.push({ id, row: r, facets: f, score, why, order, fresh: f.fresh });
  });
  out.sort((a, b) => b.score - a.score || Number(b.fresh) - Number(a.fresh) || a.order - b.order);
  return out.slice(0, limit).map(({ order, fresh, ...x }) => x);
}

/**
 * The words solved: the best row, and every dial of its family a word names (a value said: `gravel`, `heavy`, `huge`;
 * a boolean dial by its own name: `suppressed`, `metal`). A dial the row's own preset sets is overridden only by a word.
 */
export function solveSound(words, filter = {}) {
  const want = new Set(tokens(words));
  // each dial of a row's family the words name: a value said (`gravel`, `huge`), a boolean by its own name (`suppressed`)
  const said = (row) => {
    const fam = row.make && FAMILIES[row.make.family];
    return fam ? Object.entries(fam.dials ?? {}).map(([dial, values]) => [dial, values.find((v) => (typeof v === 'string' ? tokens(v).every((t) => want.has(t)) : v === true && want.has(stem(dial))))]).filter(([, v]) => v !== undefined) : [];
  };
  // the words rank the rows; among the first few, the one whose family takes the most of what was said goes first
  const found = findSounds({ words, ...filter, limit: 8 }).map((f, i) => ({ ...f, said: said(f.row), i }));
  if (!found.length) return null;
  found.sort((a, b) => b.score + 5 * b.said.length - (a.score + 5 * a.said.length) || a.i - b.i);
  const [best, ...rest] = found;
  const dials = { ...(best.row.make?.dials ?? {}) }, why = [...best.why];
  for (const [dial, v] of best.said) if (dials[dial] !== v) { dials[dial] = v; why.push(`${dial}: ${v} (said)`); }
  return { id: best.id, dials, why, alternatives: rest.slice(0, 3).map((f) => f.id) };
}

/** A refusal's tail: the rows a word nearly names, for an error that points at the shelf. */
export function suggestSounds(word, filter = {}) {
  const found = findSounds({ words: String(word ?? ''), ...filter, limit: 5 });
  return found.length ? `the SFX shelf has ${found.map((f) => `'${f.id}' (${f.row.label})`).join(', ')}` : 'see the SFX shelf (sfx-shelf/roster.js, docs/sfx-shelf.md)';
}

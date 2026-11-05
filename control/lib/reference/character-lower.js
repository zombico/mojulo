/**
 * The character target's lowering: a read of a picture (character-protocol.js) → the hero door's spec, and a refining
 * read → the words it may still move. Pure: the capture (lib/mcp/tools/character-capture.js) mints and files.
 *
 *   lowerCharacterRead(insights, { stash }) → { spec, look, register, chosen, overridden, likeness, view, unseen, gaps }
 *     The look's words, then the read's words, then the register and the stamp. A look's word wins over the read's,
 *     except a word the look lets you choose (its `choose`); a chibi look's build keeps the picture's pole. A read word
 *     a look overrode is reported (`overridden`), never dropped without a word. The spec is the hero door's own words,
 *     so the hero it makes is the hero create_character makes from them.
 *
 *   refineCharacterWords({ next, prior, current, minted, replace }) → { spec, kept, moved }
 *     A second picture refines by word. For each word the new read sets (a path, plain objects followed into), the word
 *     the person changed since the last pass is THEIRS and is kept: its stored value now (`current`) differs from what
 *     the last pass left (`minted`). The rest move to the new read where it differs from the last one. `replace` takes
 *     the new read whole, and takes off what the last read set and this one does not.
 */

import { CHARACTER_LOOKS, CHARACTER_LOOK_IDS, CHARACTER_LOOK_DEFAULT } from './character-looks.js';
import { LIKENESS_VERDICTS } from './hero-reference.js';
import { REGISTERS, HERO_CASTS } from '../graph/polygonizer/hero-form.js';

const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
/** an object naming one of these is a whole thing (a build, a style, an item, a cube from a preset): one word, never
 * followed into (create-character.js IDENTITY_KEYS) */
const IDENTITY_KEYS = ['type', 'style', 'item', 'from'];
const isWhole = (v) => !isPlain(v) || IDENTITY_KEYS.some((k) => k in v);
const canon = (v) => (Array.isArray(v) ? v.map(canon) : isPlain(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const at = (o, path) => path.reduce((x, k) => (isPlain(x) ? x[k] : undefined), o);
const put = (o, path, v) => { let x = o; path.slice(0, -1).forEach((k) => { x = x[k] ??= {}; }); x[path.at(-1)] = v; };

const VIEWS = ['front', 'three-quarter', 'side', 'back', 'turnaround'];
const strings = (v, label, max = 24) => {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > max || v.some((s) => typeof s !== 'string' || !s.trim())) throw new Error(`capture_reference (character): \`${label}\` is a list of short phrases`);
  return v.map((s) => s.trim());
};

/** A read → the hero spec and what the capture says of it. Refuses a read whose form is wrong, never one for what it
 * depicts (the likeness verdict is the model's; it is recorded, not judged). */
export function lowerCharacterRead(insights, { stash } = {}) {
  if (!isPlain(insights)) throw new Error('capture_reference (character): `insights` is the read (reference_protocol({ target: \'character\' }) says its shape)');
  const look = insights.look ?? CHARACTER_LOOK_DEFAULT;
  if (!CHARACTER_LOOK_IDS.includes(look)) throw new Error(`capture_reference (character): look '${look}' is not a look (${CHARACTER_LOOK_IDS.join(', ')})`);
  const L = CHARACTER_LOOKS[look];
  const register = insights.register ?? L.register;
  if (!Object.hasOwn(REGISTERS, register)) throw new Error(`capture_reference (character): register '${register}' is not a register (${Object.keys(REGISTERS).join(', ')})`);
  const words = insights.words ?? {};
  if (!isPlain(words)) throw new Error('capture_reference (character): `words` is an object of the hero door\'s words');
  if (words.reference !== undefined) throw new Error('capture_reference (character): `reference` is the capture\'s stamp, not a word of the read; give the verdict as `likeness`');
  if (words.register !== undefined && words.register !== register) throw new Error('capture_reference (character): the register is `register`, beside the words, not one of them');
  const lk = insights.likeness;
  if (!isPlain(lk) || !LIKENESS_VERDICTS.includes(lk.verdict)) {
    throw new Error(`capture_reference (character): \`likeness: { verdict: ${LIKENESS_VERDICTS.map((v) => `'${v}'`).join(' | ')}, like?, changed? }\` is required: your judgment of the picture (reference_protocol's \`likeness\` lines). It is recorded on the hero, never used to refuse.`);
  }
  if (insights.view !== undefined && !VIEWS.includes(insights.view)) throw new Error(`capture_reference (character): view is one of ${VIEWS.join(', ')}`);
  const unseen = strings(insights.unseen, 'unseen'), gaps = strings(insights.gaps, 'gaps');

  // the look's words over the read's, but for a word the look lets you choose; a build-only cast keeps the read's pole
  const overridden = [];
  const spec = { ...words };
  for (const [k, v] of Object.entries(L.words)) {
    if (Object.hasOwn(L.choose, k) && words[k] !== undefined) continue;
    if (k === 'cast' && isPlain(v) && !('pole' in v)) {
      const read = words.cast, pole = typeof read === 'string' && Object.hasOwn(HERO_CASTS, read) ? read : isPlain(read) ? read.pole : undefined;
      if (read !== undefined && pole === undefined) overridden.push({ word: 'cast', read, look: v });
      else if (isPlain(read) && read.build !== undefined && read.build !== v.build) overridden.push({ word: 'cast.build', read: read.build, look: v.build });
      spec.cast = { ...(pole ? { pole } : {}), ...v };
      continue;
    }
    if (words[k] !== undefined && !same(words[k], v)) overridden.push({ word: k, read: words[k], look: v });
    spec[k] = v;
  }
  spec.register = register;
  spec.reference = {
    likeness: lk.verdict,
    ...(lk.like !== undefined ? { like: lk.like } : {}),
    ...(lk.changed !== undefined ? { changed: lk.changed } : {}),
    ...(stash ? { stash } : {}),
  };
  const chosen = isPlain(insights.chosen) ? insights.chosen : null;
  return {
    spec, look, register, chosen, overridden,
    likeness: spec.reference,
    ...(insights.view ? { view: insights.view } : {}),
    unseen, gaps,
    ...(typeof insights.thesis === 'string' && insights.thesis.trim() ? { thesis: insights.thesis.trim() } : {}),
  };
}

/** The words a refining read may move, and the ones the person holds. Paths are the read's own (a plain object followed
 * into, a whole thing one word); `current` and `minted` are the stored hero now and as the last pass left it. */
export function refineCharacterWords({ next, prior = {}, current = {}, minted = {}, replace = false }) {
  const spec = {}, kept = [], moved = [];
  const walk = (value, path) => {
    if (!isWhole(value) && isPlain(at(current, path)) && Object.keys(value).length) {
      for (const [k, v] of Object.entries(value)) walk(v, [...path, k]);
      return;
    }
    const name = path.join('.');
    if (!replace && !same(at(current, path), at(minted, path))) { kept.push(name); return; }
    if (!replace && same(value, at(prior, path))) return;
    put(spec, path, value);
    moved.push(name);
  };
  for (const [k, v] of Object.entries(next)) walk(v, [k]);
  // the whole new read: what the last read set and this one does not is taken off
  if (replace) for (const k of Object.keys(prior)) if (next[k] === undefined) { spec[k] = null; moved.push(k); }
  return { spec, kept, moved };
}

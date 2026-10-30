/**
 * motion-stamp — where a recipe is WRITTEN, the gaits it authors are stored by value: a figure's `motion`
 * (figure-posing.js stampMotion), a hero's door `motion` (hero-motion.js stampHeroMotion), and the same two inside a
 * world's `figures` map. A hero new to a world's figures is also minted as the door mints one (the calibrated walk,
 * the hero laws). Renders never come here, so a recipe stored before the mint tables keeps resolving its
 * left-out dials against the frozen defaults, byte for byte.
 *
 * An edit stamps only a motion it CHANGED (compared with the stored recipe it replaces): an edit to a figure's garment
 * leaves the walk it was minted with alone, while a walk newly given to an old figure is minted as a walk is now.
 */
import { stampMotion } from './figure-posing.js';
import { stampHeroMotion } from './hero-motion.js';
import { HERO_LAWS_VERSION, readsHeroLaws, castOf } from './hero-form.js';
import { ANIME_STYLE_DEFAULT } from './anime-styles.js';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** A hero record with its door motion stamped, unless `prev` (the stored hero) already had this motion. */
export function stampHero(hero, prev = null) {
  if (!isObj(hero) || !isObj(hero.motion)) return hero;
  if (prev && same(hero.motion, prev.motion)) return hero;
  const motion = stampHeroMotion(hero.motion, { pole: walkPole(hero) });
  return same(motion, hero.motion) ? hero : { ...hero, motion };
}

/** the walk's silhouette (hero-gaits.js HERO_WALK_POLE): the adult cast's, a child or a chibi none (they walk the one walk) */
function walkPole(hero) {
  let C; try { C = castOf(hero.cast, hero.proportions ?? (hero.head === 'anime' ? 'anime' : 'hero')); } catch { return null; }
  return C && !C.child ? (C.silhouette === 'female' ? 'female' : 'male') : null;   // (only the female cast names its silhouette)
}

/**
 * A hero being MINTED walks with the calibrated gait: a spec that says nothing of its walk (no `motion.walk`, no door
 * clip named `walk`) gets `motion.walk: true`, which the hero door bakes in place of the stock four-key walk and
 * stampHero then stores by value. A creator's own walk (a gait or a clip) and a statue are left as they are. Only the
 * mint calls this: a hero stored before keeps the walk it was made with.
 */
export function withDefaultWalk(spec) {
  if (!isObj(spec) || spec.statue != null) return spec;
  if (isObj(spec.motion) && 'walk' in spec.motion) return spec;
  if (isObj(spec.clips) && 'walk' in spec.clips) return spec;
  return { ...spec, motion: { ...(isObj(spec.motion) ? spec.motion : {}), walk: true } };
}

/**
 * A hero being MINTED is built on the game body, the tiered form (tiered-form.js), unless it names a form (`'realistic'`, or
 * the deprecated `'classic'`, the body before it) or the deprecated streamlined core, which only the classic body carries.
 * A chibi or a child minted on it wears the anime head (`head: 'anime'`) unless it names a head or says a word only the landmark
 * head reads (`face`, `hair`, `expression`, `headPreset`, a clip's `face`). An adult on the anime head that wears its form
 * (hero laws 19, not the studio's face) and names no head cast wears the default cast (anime-styles.js
 * ANIME_STYLE_DEFAULT, Shonen High); `animeStyle: null` is the form's bare head. Only the mint calls this: a hero stored
 * without a form keeps the classic body it was made with, one stored without a head the landmark head, and one stored
 * without a head cast none.
 */
export function withDefaultForm(spec) {
  if (!isObj(spec)) return spec;
  const formed = (spec.form !== undefined && spec.form !== null) || spec.core === 'streamlined' ? spec : { ...spec, form: 'tiered' };
  return castHead(chibiHead(formed));
}
function castHead(spec) {
  if (spec.head !== 'anime' || spec.animeStyle !== undefined || spec.sculpt === false || isChibi(spec.cast)) return spec;
  return (spec.laws ?? (readsHeroLaws(spec) ? HERO_LAWS_VERSION : 1)) >= 19 ? { ...spec, animeStyle: ANIME_STYLE_DEFAULT } : spec;
}
const isChibi = (cast) => cast === 'chibi' || cast === 'child' || (isObj(cast) && (cast.build === 'chibi' || cast.build === 'child'));
const LANDMARK_WORDS = ['face', 'hair', 'expression', 'headPreset'];
function chibiHead(spec) {
  if (spec.form !== 'tiered' || spec.head !== undefined || !isChibi(spec.cast)) return spec;
  if (LANDMARK_WORDS.some((k) => spec[k] !== undefined) || JSON.stringify(spec.clips ?? null).includes('"face"')) return spec;
  return { ...spec, head: 'anime' };
}

/** An inline hero as the door would mint it: withDefaultForm, withDefaultWalk, and `laws` when it reads the hero laws' tables. */
function mintedInline(hero) {
  const walked = withDefaultWalk(withDefaultForm(hero));
  return walked.laws === undefined && readsHeroLaws(walked) ? { ...walked, laws: HERO_LAWS_VERSION } : walked;
}

function stampFigureMotion(entry, prev) {
  if (entry.motion == null || (prev && same(entry.motion, prev.motion))) return entry;
  const motion = stampMotion(entry.motion);
  return motion === entry.motion ? entry : { ...entry, motion };
}

/**
 * A manifest about to be stored, with every gait it authors stamped. `prev` is the stored manifest an edit replaces
 * (null at mint). Returns the manifest itself when nothing was stamped.
 */
export function stampAuthoredMotion(manifest, prev = null) {
  if (!isObj(manifest)) return manifest;
  let m = manifest;
  if (m.kind === 'figure') m = stampFigureMotion(m, prev);
  if (isObj(m.hero)) { const h = stampHero(m.hero, prev?.hero); if (h !== m.hero) m = { ...m, hero: h }; }
  if (isObj(m.figures)) {
    let figs = null;
    for (const [name, f] of Object.entries(m.figures)) {
      if (!isObj(f)) continue;
      const pf = isObj(prev?.figures) ? prev.figures[name] : null;
      let g = stampFigureMotion(f, pf);
      // a hero NEW to the world's figures is minted as the door mints one: the game body and the calibrated walk unless it brings its own,
      // and the hero laws when it reads their tables (an inline hero is re-recorded on every render, so it is stamped
      // here, where it is written, or never); a figure the world already had is left as it was stored
      if (isObj(g.hero) && !pf) g = { ...g, hero: mintedInline(g.hero) };
      if (isObj(g.hero)) { const h = stampHero(g.hero, pf?.hero); if (h !== g.hero) g = { ...g, hero: h }; }
      if (g !== f) (figs ??= { ...m.figures })[name] = g;
    }
    if (figs) m = { ...m, figures: figs };
  }
  return m;
}

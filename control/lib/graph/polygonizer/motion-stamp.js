/**
 * motion-stamp — where a recipe is WRITTEN, the gaits it authors are stored by value: a figure's `motion`
 * (figure-posing.js stampMotion), a hero's door `motion` (hero-motion.js stampHeroMotion), and the same two inside a
 * world's `figures` map. Renders never come here, so a recipe stored before the mint tables keeps resolving its
 * left-out dials against the frozen defaults, byte for byte.
 *
 * An edit stamps only a motion it CHANGED (compared with the stored recipe it replaces): an edit to a figure's garment
 * leaves the walk it was minted with alone, while a walk newly given to an old figure is minted as a walk is now.
 */
import { stampMotion } from './figure-posing.js';
import { stampHeroMotion } from './hero-motion.js';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** A hero record with its door motion stamped, unless `prev` (the stored hero) already had this motion. */
export function stampHero(hero, prev = null) {
  if (!isObj(hero) || !isObj(hero.motion)) return hero;
  if (prev && same(hero.motion, prev.motion)) return hero;
  const motion = stampHeroMotion(hero.motion);
  return same(motion, hero.motion) ? hero : { ...hero, motion };
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
      if (isObj(g.hero)) { const h = stampHero(g.hero, pf?.hero); if (h !== g.hero) g = { ...g, hero: h }; }
      if (g !== f) (figs ??= { ...m.figures })[name] = g;
    }
    if (figs) m = { ...m, figures: figs };
  }
  return m;
}

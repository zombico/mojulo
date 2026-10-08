/**
 * THE STYLE GUIDE — a world's style read into cards: the kit its ground is drawn in (its principles, its palette), the
 * language its towns speak (its read, its elements), the fortification its castles raise, what the language does to a
 * castle (the style's influence), and the ground's character. Data only; the bible draws it.
 */
import { STAGE_KITS } from '../era/stage.js';
import { NATURE_STYLES } from '../era/nature.js';
import { ISEKAI_STYLES } from '../era/isekai.js';
import { JUNGLE_STYLES } from '../era/jungle.js';
import { SWATCHES } from '../era/style/swatches.js';
import { structureStyle } from '../era/out-structures.js';
import { townLanguage } from '../era/out-town.js';
import { composeFort } from '../era/out-fortress.js';
import { influenceOf } from '../era/out-castle.js';
import { OUT_TRAIL } from '../era/out-trail.js';

const SHELLS = { nature: NATURE_STYLES, isekai: ISEKAI_STYLES, jungle: JUNGLE_STYLES };
const hex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const RAMPS = ['grass', 'soil', 'rock', 'foliage', 'sky', 'timber', 'stone'];

/** The kit's card: its style card's principles and its palette's ramps, shadow to light. */
export function kitCard(kit) {
  const K = STAGE_KITS[kit], card = SHELLS[K.shell][K.style], sw = SWATCHES[K.style] || {}, ramps = [];
  for (const name of RAMPS) {
    const r = sw.land?.[name] ?? sw.made?.[name];
    if (Array.isArray(r) && Array.isArray(r[0])) ramps.push({ name, stops: r.map(hex) });
  }
  return { kind: 'kit', id: kit, look: K.style, shell: K.shell, principles: [...(card.principles || [])], ramps };
}

/** The language's card: how its houses read, and the elements its town is built of. */
export function languageCard(kit, anchor, seed = 1) {
  const L = townLanguage(structureStyle(kit, seed), anchor), V = L.vocab;
  return {
    kind: 'language', id: L.id, read: L.read, own: anchor === undefined || anchor === null,
    vocab: { mass: V.mass, cap: V.cap ?? 'none', opening: V.opening, entry: V.entry, ornaments: V.ornaments || [], tiers: !!V.tiers, annex: V.annex ?? 'none' },
    language: L,
  };
}

/** The fortification's card, and what the language does to it: the wall's trace, the towers' crown, the keep. */
export function fortCard(fort, language) {
  const F = composeFort(fort), I = influenceOf(language, F);
  return { kind: 'fort', id: typeof fort === 'string' ? fort : 'its own', read: F.read, tower: { plan: F.tower.plan, crown: F.tower.crown }, influence: { trace: I.trace, crown: I.crown, keep: I.keep ?? 'tower', read: I.read } };
}

/** The ground's character: what the world sets for trails, climbs, towns and castles, the rest at its card's default. */
export function groundCard(style) {
  return {
    kind: 'ground',
    trail: { run: style.trail?.run ?? OUT_TRAIL.run[2], heartbeat: style.trail?.heartbeat ?? 'the kit\'s', bumpiness: style.trail?.bumpiness ?? 'the kit\'s' },
    meru: { preset: style.meru?.preset ?? 'mountain-lookout' },
    town: { ...(style.town || {}) },
    castle: { ...(style.castle || {}) },
  };
}

/** Every card of a style. */
export function styleGuide(style, seed = 1) {
  const language = languageCard(style.kit, style.anchor, seed);
  return { kit: kitCard(style.kit), language, fort: fortCard(style.fort, language.language), ground: groundCard(style) };
}

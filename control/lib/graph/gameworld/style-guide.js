/**
 * THE STYLE GUIDE — a world read into cards. The style: the kit its ground is drawn in (its principles, its palette)
 * and the ground's character. Each civilization: the language its towns speak (its read, its elements), the
 * fortification its castles raise, what the language does to a castle (the style's influence), how it lays out a
 * town and raises a castle. Data only; the bible draws it.
 */
import { stageKit } from '../era/stage.js';
import { lookOf } from '../era/style/looks.js';
import { NATURE_STYLES } from '../era/nature.js';
import { ISEKAI_STYLES } from '../era/isekai.js';
import { JUNGLE_STYLES } from '../era/jungle.js';
import { swatchesOf } from '../era/style/swatches.js';
import { structureStyle, hasStructureRails } from '../era/out-structures.js';
import { townLanguage } from '../era/out-town.js';
import { composeFort } from '../era/out-fortress.js';
import { influenceOf } from '../era/out-castle.js';
import { OUT_TRAIL } from '../era/out-trail.js';

const SHELLS = { nature: NATURE_STYLES, isekai: ISEKAI_STYLES, jungle: JUNGLE_STYLES };
const hex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const RAMPS = ['grass', 'soil', 'rock', 'foliage', 'sky', 'timber', 'stone'];

/** Whether a kit has an outdoor style card: a room kit (a nave, a plaza, a lab) has none, so no ramps or ornament. */
export const hasKitCard = (kit) => !!SHELLS[stageKit(kit).shell];
/** Whether a kit's towns speak a building language (languageCard): a trail kit has ramps but builds nothing. */
export const hasLanguageCard = (kit) => hasStructureRails(kit);

/** The kit's card: its style card's principles and its palette's ramps, shadow to light. */
export function kitCard(kit) {
  const K = stageKit(kit), card = SHELLS[K.shell][K.style] ?? lookOf(kit)?.card, sw = swatchesOf(K.style) || {}, ramps = [];
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

/** The ground's character: what the world sets for trails and climbs, the rest at its card's default. */
export function groundCard(style) {
  return {
    kind: 'ground',
    trail: { run: style.trail?.run ?? OUT_TRAIL.run[2], heartbeat: style.trail?.heartbeat ?? 'the kit\'s', bumpiness: style.trail?.bumpiness ?? 'the kit\'s' },
    meru: { preset: style.meru?.preset ?? 'mountain-lookout' },
  };
}

/** A civilization's cards, read on a kit: its language, its fortification and what the language makes of it, how it lays out a town and raises a castle. */
export function civilizationCard(C, kit, seed = 1) {
  const language = languageCard(kit, C.anchor, seed);
  return { kind: 'civilization', name: C.name, language, fort: fortCard(C.fort, language.language), town: { ...(C.town || {}) }, castle: { ...(C.castle || {}) } };
}

/** Every card of a world: its style, and each civilization on the world's kit. */
export function styleGuide(G) {
  return {
    kit: kitCard(G.style.kit), ground: groundCard(G.style),
    civilizations: Object.fromEntries(G.civIds.map((id) => [id, civilizationCard(G.civilizations[id], G.style.kit, G.seed)])),
  };
}

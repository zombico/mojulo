/**
 * A WORLD'S GUNS, READ — what a game that shoots carries, as the firing range takes it (combat/range.js rangeOf's
 * `weapons` and `skins`), read from what the world already says, never a key of its own:
 *
 *   1. a quick shooter's carried kit (`quick.arms`, arms-kit.js: kit words or an arm's build words), with the knife its
 *      free hand always holds (quick.js: a carried kit's `knife`)
 *   2. the hero's carried items that serve `shoot` (its adornment's right hand: levels.js armedPilot fires it), each
 *      its build words read to the kit word they name, else its fire type with its look as a skin
 *   3. its feel template's own loadout (TEMPLATE_LOADOUTS, the gun side's counterpart of the melee kits): the guns a
 *      game of that kind is played with
 *
 *   loadoutOf(G) → { weapons, skins?, from: 'quick' | 'hero' | 'template', template? } | null (a world that carries no
 *                  gun and whose template shoots none)
 *   TEMPLATE_LOADOUTS   { <template>: { weapons, why } }
 *
 * Pure, no dice. A world that writes nothing adds nothing.
 */
import { ARMS_KIT, ARMS_MAX } from './arms-kit.js';
import { readFeel } from './feel/lower.js';

// the free hand's blade, as the range takes a melee weapon (FIRE.melee's numbers: the kit's knife)
const KNIFE_SLOT = Object.freeze({ name: 'knife', fire: 'melee' });

/** The feel templates that shoot, each its guns (kit words; a launcher the range's projectile fire type). */
export const TEMPLATE_LOADOUTS = Object.freeze({
  conscription: { weapons: Object.freeze(['rifle', 'handgun', KNIFE_SLOT]), why: 'the contemporary FPS: a rifle, a sidearm, a knife' },
  'cogs-of-combat': { weapons: Object.freeze(['rifle', 'shotgun', 'handgun']), why: 'the cover shooter: a rifle, a shotgun for close, a sidearm' },
  'infinity-crisis': { weapons: Object.freeze(['rifle', Object.freeze({ name: 'launcher', fire: 'projectile' })]), why: 'the arena shooter: a rifle and a rocket launcher' },
  'steel-serpents': { weapons: Object.freeze(['handgun', KNIFE_SLOT]), why: 'the stealth game: a silenced pistol and a knife, no rifle' },
});

// an arm's build words → the kit word that builds it (its item and model; an item alone its first word), or null
function kitWordOf(build) {
  if (!build || typeof build !== 'object') return null;
  const words = Object.keys(ARMS_KIT).filter((w) => ARMS_KIT[w].arm?.item === build.item);
  return (build.model ? words.find((w) => ARMS_KIT[w].arm.model === build.model) : words[0]) ?? null;
}
// the range's weapons from a list of arms (kit words, or build words: the kit word they build, its look a skin where
// the words say more than the kit's; a gun the kit does not build, its fire type with its look), each name once, the
// knife after them where a slot is left
function weaponsOf(arms, knife) {
  const skins = {}, weapons = [], named = new Set();
  for (const arm of arms) {
    if (weapons.length >= ARMS_MAX) break;
    const word = typeof arm === 'string' ? (ARMS_KIT[arm] ? arm : null) : kitWordOf(arm);
    const name = word ?? (arm && typeof arm === 'object' && typeof arm.item === 'string' ? arm.item : null);
    if (!name || named.has(name)) continue;
    named.add(name);
    weapons.push(word ?? { name, fire: 'hitscan' });
    if (typeof arm === 'object' && (!word || arm.line || arm.parts || (arm.model && arm.model !== ARMS_KIT[word].arm.model))) {
      skins[name] = { item: arm.item, ...(arm.model ? { model: arm.model } : {}), ...(arm.line ? { line: arm.line } : {}), ...(arm.parts ? { parts: arm.parts } : {}) };
    }
  }
  if (knife && weapons.length && weapons.length < ARMS_MAX) weapons.push({ ...KNIFE_SLOT });
  return weapons.length ? { weapons, ...(Object.keys(skins).length ? { skins } : {}) } : null;
}

/** A world's guns (see the header), or null. */
export function loadoutOf(G) {
  if (!G || typeof G !== 'object') return null;
  // 1. a quick shooter's carried kit
  const arms = G.quick?.arms;
  if (Array.isArray(arms) && arms.length) {
    const L = weaponsOf(arms, true);
    if (L) return { ...L, from: 'quick' };
  }
  // 2. the hero's items that serve shoot
  const items = (G.characters?.hero?.adornment?.items ?? []).filter((it) => it && (it.serves ?? []).includes('shoot') && it.build);
  if (items.length) {
    const L = weaponsOf(items.map((it) => it.build), false);
    if (L) return { ...L, from: 'hero' };
  }
  // 3. its feel template's own
  let pole = null;
  try { pole = G.feel != null ? readFeel(G.feel).pole : null; } catch { pole = null; }
  const T = pole ? TEMPLATE_LOADOUTS[pole] : null;
  return T ? { weapons: T.weapons.map((w) => (typeof w === 'string' ? w : { ...w })), from: 'template', template: pole } : null;
}

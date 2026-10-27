/**
 * THE TABLE RPG'S ARMS AND ARTIFACTS — the game's weapons and gear as mojulo's equipment kernel makes them
 * (equipment/expand.js: an item, a style card, dials, parts, a stone; the laws turn the words into every dimension), so
 * the party's blades, the foes' arms and the treasures found are real objects: held in the characters' hands, minted
 * as items of their own and photographed for the book. The rules stay portable (table-rpg-kernel.js: a weapon or an
 * armour artifact, its bonus 1 to 3); the build is what it looks like.
 *
 *   gear?: { style?, foes? }   the game's arms language: `style` the party's and the treasures' (an equipment style
 *     sample, historical | elven | dwarven | brutal | eastern | anime-hero | druid | celestial, or an inline card),
 *     `foes` the cast's (brutal when none). Both the equipment card's words, never new ones.
 *   an item's `build?: { item, style?, dials?, parts?, gem?, seed? }`   what an artifact (a weapon, an armour, a treasure)
 *     looks like: the equipment kernel's words, its style the game's when it names none. A shield is an armour.
 *
 *   readGear(module) → module   the gear and every item's build checked by the equipment kernel (throws, teaching)
 *   itemBuildOf(module, id) → build words | null       an item's look, with the game's style
 *   memberGear(module, K, p) → { right?, left? } | null   what a member holds: the artifacts it starts with, else its
 *     class's weapon as the equipment kernel makes it (WEAPON_GEAR), in the game's style; the hero door's `gear`
 *   foeGear(module, foe) → { right?, left? } | null    what a person of the cast holds by its role (ROLE_ARMS), in the
 *     foes' style
 *   WEAPON_GEAR, ROLE_ARMS
 */
import { validateBuild, isFirearm } from '../equipment/expand.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const BUILD_KEYS = ['item', 'style', 'dials', 'parts', 'gem', 'seed'];
export const GEAR_KEYS = Object.freeze(['style', 'foes']);

/** A rules card's weapon by its name, as the equipment kernel makes it: a blade its blade, a mace a staff's mace head,
 * a spell a staff with a stone in its claw, an axe a hand axe and a mace a haft (the staff's `arm` reach). A weapon the kernel has no shape for (a chain, a rite) is held by nothing. */
export const WEAPON_GEAR = Object.freeze({
  sword: { item: 'sword' }, blade: { item: 'sword' }, axe: { item: 'staff', parts: { head: 'axe', reach: 'arm' } },
  'short blade': { item: 'dagger' }, knife: { item: 'dagger' }, scalpel: { item: 'dagger', dials: { mass: 0.7 } },
  staff: { item: 'staff' }, mace: { item: 'staff', parts: { head: 'mace', reach: 'arm' } }, hammer: { item: 'staff', parts: { head: 'mace', reach: 'arm' }, dials: { mass: 1.4 } },
  bolt: { item: 'staff', parts: { head: 'claw', focus: 'head' }, gem: 'amethyst' }, hex: { item: 'staff', parts: { head: 'crescent', focus: 'head' }, gem: 'opal' },
  bow: { item: 'bow' }, rifle: { item: 'carbine' }, revolver: { item: 'pistol' },
});
/** What a person of the cast holds by the role it fights in (egocube roles). */
export const ROLE_ARMS = Object.freeze({
  frontline: { right: { item: 'greatsword' } }, flanker: { right: { item: 'sword' } }, ranged: { right: { item: 'bow' } },
  caster: { right: { item: 'staff', parts: { head: 'claw', focus: 'head' }, gem: 'ruby' } }, controller: { right: { item: 'staff', parts: { head: 'crescent', focus: 'head' }, gem: 'amethyst' } },
  support: { right: { item: 'staff', parts: { head: 'mace' } }, left: { item: 'shield' } }, 'non-combatant': null,
});

// a build in the given style, unless it names its own; a firearm wears its own family's styles (service, future)
const styled = (build, style) => (build.style !== undefined || isFirearm(build.item) || style === undefined ? build : { ...build, style });

export function readGear(module) {
  const G = module.gear;
  if (G !== undefined) {
    if (!isObj(G)) throw new Error(`table rpg: gear is { ${GEAR_KEYS.join(', ')} }: the game's arms language (equipment styles)`);
    for (const k of Object.keys(G)) if (!GEAR_KEYS.includes(k)) throw new Error(`table rpg: gear.${k} is not a gear word (${GEAR_KEYS.join(', ')})`);
    for (const k of GEAR_KEYS) if (G[k] !== undefined) {
      const errs = validateBuild({ type: 'equipment', item: 'dagger', style: G[k] });
      if (errs.length) throw new Error(`table rpg: gear.${k}: ${errs.join('; ')}`);
    }
  }
  for (const [id, I] of Object.entries(module.items ?? {})) {
    if (I?.build === undefined) continue;
    if (!isObj(I.build) || typeof I.build.item !== 'string') throw new Error(`table rpg: item '${id}': build is { ${BUILD_KEYS.join(', ')} } (the equipment kernel's words: get_solid_vocab({ id: 'equipment' }))`);
    for (const k of Object.keys(I.build)) if (!BUILD_KEYS.includes(k)) throw new Error(`table rpg: item '${id}': build.${k} is not an equipment word (${BUILD_KEYS.join(', ')})`);
    const errs = validateBuild({ type: 'equipment', ...styled(I.build, G?.style ?? 'historical') });
    if (errs.length) throw new Error(`table rpg: item '${id}': ${errs.join('; ')}`);
  }
  return module;
}

export function itemBuildOf(module, id) {
  const I = module.items?.[id];
  return I?.build ? styled(I.build, module.gear?.style ?? 'historical') : null;
}

export function memberGear(module, K, p) {
  const style = module.gear?.style ?? 'historical', out = {};
  for (const id of (module.party ?? []).find((q) => q.id === p.id)?.arms ?? []) {
    const b = itemBuildOf(module, id);
    if (b) out[b.item === 'shield' ? 'left' : 'right'] = b;
  }
  if (!out.right) { const w = WEAPON_GEAR[p.weapon?.name]; if (w) out.right = styled(w, style); }
  return Object.keys(out).length ? out : null;
}

export function foeGear(module, foe) {
  const role = foe?.persona?.role, arms = role ? ROLE_ARMS[role] : null;
  if (!arms) return null;
  const style = module.gear?.foes ?? 'brutal';
  return Object.fromEntries(Object.entries(arms).map(([slot, b]) => [slot, styled(b, style)]));
}

/**
 * The wardrobe's PHOTOGRAPHS: each party member in its own clothes and in each armour its class may wear
 * (gameworld/wardrobe.js), as the run has made them (`world.made`: the member's own figure, `hero-equipped` or `hero`,
 * `cast-<id>`; each look `hero-look-<item>`, `cast-<id>-look-<item>`), photographed as the cast sheet photographs its foes
 * (table-rpg-portraits.js photographCharacter: its World page in headless Chromium, kept per its revision), so the world
 * bible's battles section shows what each one wears. Chromium is an optional worker: without one, no photograph, and the
 * look is named.
 *
 *   wardrobePortraits(world, { paper? }) → { portraits: { '<member>:' | '<member>:<item>': { figure, bust } }, key,
 *     missing: [{ look, why }] }   `key` the made figures' revisions, for a page kept in memory to be drawn again
 */
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { wardrobeLooks, lookKey } from '@/lib/graph/gameworld/wardrobe.js';
import { battleBase } from '@/lib/graph/gameworld/battles.js';
import { readRpg } from '@/lib/graph/playscape/rpg/rpg.js';
import { photographCharacter } from './table-rpg-portraits.js';
import { FOE_PAPER } from './foe-portraits.js';

export async function wardrobePortraits(world, { paper = FOE_PAPER } = {}) {
  const portraits = {}, missing = [], seen = [], made = world?.made ?? {};
  if (!world?.battles?.wardrobe) return { portraits, key: '', missing };
  const looks = wardrobeLooks(world, readRpg({ rpg: battleBase(world) }));
  // (the member's own figure first, then each look: the hero's own the one that holds what it carries)
  const own = (m) => (m === 'hero' ? made['hero-equipped']?.ref ?? made.hero?.ref : made[`cast-${m}`]?.ref) ?? null;
  const shots = [...new Set(looks.map((x) => x.member))].map((m) => [`${m}:`, own(m)]).concat(looks.map((x) => [`${x.member}:${x.item}`, made[lookKey(x.member, x.item)]?.ref ?? null]));
  for (const [k, ref] of shots) {
    const row = ref ? SketchRepository.getByRef(ref) : null;
    if (!row) { missing.push({ look: k, why: ref ? `its figure '${ref}' is not made yet` : 'not made yet (design_game run: true makes it)' }); continue; }
    seen.push(`${ref}@${row.updatedAt}`);
    try { portraits[k] = await photographCharacter(ref, { paper }); } catch (err) { missing.push({ look: k, why: err.message.split('\n')[0] }); }
  }
  return { portraits, key: seen.join(','), missing };
}

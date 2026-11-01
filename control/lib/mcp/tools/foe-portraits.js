/**
 * The cast sheet's PHOTOGRAPHS: each foe a run has made (gameworld/foe-cast.js `figure`: its `foes-<id>` sketch, or a
 * model's own) photographed as the table game's book photographs its cast (table-rpg-portraits.js photographCharacter:
 * its World page in headless Chromium, a figure and a bust framed by its own body, kept per its revision), so the cast
 * sheet and the world bible's Foes section show the real thing, a download included. Chromium is an optional worker:
 * without one, no photograph, and a foe keeps its silhouette.
 *
 *   foePortraits(world, { paper? }) → { portraits: { <foe id>: { figure, bust } }, key, missing: [{ foe, why }] }
 *     `key` the made figures' revisions, for a page kept in memory to be drawn again when one changes
 */
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { foeCastOf } from '@/lib/graph/gameworld/foe-cast.js';
import { photographCharacter } from './table-rpg-portraits.js';

/** The paper a photograph is taken on: the sheet's own, so a figure sits on its tile as drawn there. */
export const FOE_PAPER = '#eef1f4';

export async function foePortraits(world, { paper = FOE_PAPER } = {}) {
  const C = foeCastOf(world), portraits = {}, missing = [], seen = [];
  for (const x of C?.foes ?? []) {
    if (!x.figure) continue;
    const row = SketchRepository.getByRef(x.figure);
    if (!row) { missing.push({ foe: x.id, why: `its figure '${x.figure}' is not made yet (design_game run: true makes it)` }); continue; }
    seen.push(`${x.figure}@${row.updatedAt}`);
    try { portraits[x.id] = await photographCharacter(x.figure, { paper, body: x.skin.kind === 'beast' ? 'beast' : undefined }); } catch (err) { missing.push({ foe: x.id, why: err.message.split('\n')[0] }); }
  }
  return { portraits, key: seen.join(','), missing };
}

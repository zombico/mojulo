/**
 * The cast sheet's PHOTOGRAPHS: each foe a run has made (gameworld/foe-cast.js `figure`: its `foes-<id>` sketch, or a
 * model's own) photographed as the table game's book photographs its cast (table-rpg-portraits.js photographCharacter:
 * its World page in headless Chromium, a figure and a bust framed by its own body, kept per its revision), so the cast
 * sheet and the world bible's Foes section show the real thing, a download included. Chromium is an optional worker:
 * without one, no photograph, and a foe keeps its silhouette.
 *
 * A person (a foe on the hero door) is photographed striking the showcase its rank picks on its game's rail
 * (game-poses.js: a boss turning its back or looking down its arms, a grunt squaring up), the world's seed choosing; a
 * beast stands as it was made. The made foe is never changed: the pose is the photograph's, in memory.
 *
 *   foePortraits(world, { paper? }) → { portraits: { <foe id>: { figure, bust } }, poses: { <foe id>: word }, key,
 *     missing: [{ foe, why }] }
 *     `key` the made figures' revisions, for a page kept in memory to be drawn again when one changes
 */
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { foeCastOf } from '@/lib/graph/gameworld/foe-cast.js';
import { photographCharacter } from './table-rpg-portraits.js';
import { gamePose, RANK_ROLE } from '@/lib/graph/gameworld/game-poses.js';
import { railOfGame } from '@/lib/graph/gameworld/game-bodies.js';
import { QUICK_GENRE } from '@/lib/graph/gameworld/intent.js';

/** The paper a photograph is taken on: the sheet's own, so a figure sits on its tile as drawn there. */
export const FOE_PAPER = '#eef1f4';

export async function foePortraits(world, { paper = FOE_PAPER } = {}) {
  const C = foeCastOf(world), portraits = {}, poses = {}, missing = [], seen = [];
  const feel = typeof world.feel === 'string' ? world.feel : world.feel?.pole ?? null;
  const rail = railOfGame({ genre: world.intent?.from ?? (world.quick?.goal ? QUICK_GENRE[world.quick.goal] : null), goal: world.quick?.goal ?? null, feel })?.rail ?? null;
  for (const x of C?.foes ?? []) {
    if (!x.figure) continue;
    const row = SketchRepository.getByRef(x.figure);
    if (!row) { missing.push({ foe: x.id, why: `its figure '${x.figure}' is not made yet (design_game run: true makes it)` }); continue; }
    // (a person on the hero door strikes its rank's showcase; a beast, a model or a plan stands as made)
    const pose = x.skin.kind !== 'beast' && row.manifest?.hero ? gamePose(rail, 'cover', { role: RANK_ROLE[x.rank] ?? 'henchman', seed: `${world.seed ?? 1}:${x.id}` }).gesture : null;
    if (pose) poses[x.id] = pose;
    seen.push(`${x.figure}@${row.updatedAt}${pose ? `:${pose}` : ''}`);
    try { portraits[x.id] = await photographCharacter(x.figure, { paper, body: x.skin.kind === 'beast' ? 'beast' : undefined, ...(pose ? { pose } : {}) }); } catch (err) { missing.push({ foe: x.id, why: err.message.split('\n')[0] }); }
  }
  return { portraits, poses, key: seen.join(','), missing };
}

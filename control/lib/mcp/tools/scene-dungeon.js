/**
 * scene-dungeon — mint a DUNGEON from a tiny { chambers, tunnels } graph recipe.
 *
 * The fantasy-interior primitive (dungeon-designer.js): organic round chambers at
 * elevation joined by sloping tube/corridor tunnels, traced-fire lit — deliberately the
 * opposite of the flat generative house/room generators. The manifest stores ONLY the
 * recipe (`kind: 'dungeon'`, no geometry); the dungeon is regenerated deterministically
 * on render through the world-kind registry (walkable /world + .glb export). This is the
 * `dungeon` base behind `compose_world`; parameter manual: the `dungeon` view-vocab card.
 *
 * Posture matches create_edifice: STRUCTURAL validity throws at mint (a tunnel to an
 * unknown chamber, an unknown material name — planDungeon's own errors), while the
 * movement-flow check is ADVISORY, surfaced but never gated (docs/responsibility-model.md).
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planDungeon, assembleDungeonScene, assessDungeonFlow } from '@/lib/graph/architecture/dungeon-designer';

export function mintDungeon({ title, chambers, tunnels, style, lighting, seed, viewBox, ref, folderRef } = {}) {
  if (!Array.isArray(chambers) || chambers.length === 0) {
    throw new Error("create dungeon requires a non-empty `chambers` array (each `{ id, at:[x,y], elevation?, radius?, height?, … }`) — manual: get_view_vocab({ id: 'dungeon' })");
  }
  const manifest = {
    kind: 'dungeon',
    chambers,
    ...(Array.isArray(tunnels) && tunnels.length ? { tunnels } : {}),
    ...(style && typeof style === 'object' ? { style } : {}),
    ...(lighting && typeof lighting === 'object' ? { lighting } : {}),
    ...(seed != null ? { seed } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(title ? { title } : {}),
  };

  // Validate the recipe by PLANNING + ASSEMBLING it once (an unknown chamber ref or
  // material name throws here, at mint, not at render) + derive a readout. Nothing
  // heavy persists — only the recipe above is stored.
  const plan = planDungeon(manifest);
  const scene = assembleDungeonScene(manifest);
  const flow = assessDungeonFlow(plan);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `dungeon · ${plan.chambers.length} chamber${plan.chambers.length === 1 ? '' : 's'}`,
      manifest, ref, folderRef: folderRef ?? null,
    });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) {
      throw new Error(`A sketch with ref '${ref}' already exists`);
    }
    throw err;
  }

  const defects = [...flow.necessary, ...flow.preferential];
  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    recipe: manifest,
    stats: {
      chambers: plan.chambers.length,
      tunnels: plan.tunnels.length,
      faces: scene.faces.length,
      spawn: plan.spawn,
    },
    advisory: flow,
    ...(defects.length ? { note: `Advisory (not enforced): ${defects.map((d) => d.detail).join('; ')}. Minted anyway — the dungeon is yours.` } : {}),
  };
}

export async function createDungeonHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('dungeon mint requires a recipe object with a `chambers` array');
  }
  const { title, chambers, tunnels, style, lighting, seed, viewBox, ref, folder_ref: folderRef } = input;
  return mintDungeon({ title, chambers, tunnels, style, lighting, seed, viewBox, ref, folderRef });
}

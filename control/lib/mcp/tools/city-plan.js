/**
 * The city plan's mint: compose_world { base: 'city', overrides: { plan } } lands here (compose-world.js routes it). The
 * plan is read against its card (city/plan/card.js), what it left out is filled by the mint's laws and recorded in
 * `notes.inferred`, a seed is drawn and written when none was given, and only the recipe is stored (kind 'city'). The
 * reply is the city's readout: its census, every law and `next`, the same table the plan book's Open sheet reads.
 */
import { randomInt } from 'node:crypto';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { inferCity } from '@/lib/graph/city/plan/card';
import { cityReadout, readCity } from '@/lib/graph/city/plan/read';
import { cityGameOrder } from '@/lib/graph/city/plan/game';
import { mintBuilding } from '@/lib/mcp/tools/building';

export function mintCityPlan({ plan, seed, title, ref, folderRef } = {}) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    throw new Error("compose_world: overrides.plan is the city plan { grammar?, play?, board?, spine?, districts?, sites?, transit?, lots?, waive? }. Manual: get_view_vocab({ id: 'city-plan' }).");
  }
  const s = seed ?? plan.seed;
  const given = { ...plan, seed: Number.isInteger(s) ? s : randomInt(1, 2147483647) };
  delete given.kind;
  let recipe, inferred;
  try { ({ recipe, inferred } = inferCity(given)); } catch (err) { throw new Error(`compose_world: ${err.message}. Manual: get_view_vocab({ id: 'city-plan' }).`); }
  const manifest = { kind: 'city', ...recipe, ...(inferred.length ? { notes: { ...(recipe.notes || {}), inferred } } : {}), ...(title ? { title } : {}) };
  const readout = cityReadout(manifest);
  const sketch = SketchRepository.create({ title: title || `city · ${readout.city.look} · ${manifest.seed}`, manifest, ref, folderRef: folderRef ?? null });
  const at = encodeURIComponent(sketch.ref);
  // segments.levels: a level per segment beside the city, each reading it by ref, and the map game's order for create_game
  let game = null;
  if (manifest.segments && manifest.segments.levels) {
    const { design } = readCity(manifest), order = cityGameOrder(design, sketch.ref, sketch.title);
    for (const lv of order.sketches) SketchRepository.create({ title: lv.title, manifest: lv.manifest, ref: lv.ref, folderRef: folderRef ?? null });
    // each door's inside through the building door, so it is the building mint_building would store
    for (const x of order.interiors) mintBuilding({ title: x.title, manifest: x.manifest, ref: x.ref, folderRef: folderRef ?? null });
    game = { levels: order.sketches.map((x) => x.ref), ...(order.interiors.length ? { interiors: order.interiors.map((x) => ({ ref: x.ref, lot: x.manifest.title, kind: x.manifest.kind, door: x.door })) } : {}), create_game: order.createGame };
  }
  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${at}/world`,
    bookUrl: `/api/sketches/${at}/bible`,
    url: `/sketches/${at}`,
    recipe: manifest,
    ...(inferred.length ? { inferred } : {}),
    ...readout,
    ...(game ? { game } : {}),
  };
}

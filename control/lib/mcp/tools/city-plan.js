/**
 * The city plan's mint: compose_world { base: 'city', overrides: { plan } } lands here (compose-world.js routes it). The
 * plan is read against its card (city/plan/card.js), what it left out is filled by the mint's laws and recorded in
 * `notes.inferred`, a seed is drawn and written when none was given, and only the recipe is stored (kind 'city'). The
 * reply is the city's readout: its census, every law and `next`, the same table the plan book's Open sheet reads.
 */
import { randomInt } from 'node:crypto';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { inferCity } from '@/lib/graph/city/plan/card';
import { cityReadout } from '@/lib/graph/city/plan/read';

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
  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${at}/world`,
    bookUrl: `/api/sketches/${at}/bible`,
    url: `/sketches/${at}`,
    recipe: manifest,
    ...(inferred.length ? { inferred } : {}),
    ...readout,
  };
}

/**
 * create_view({ kind: 'microscopic' }) — a microscopic science world: molecules and cells composed from the
 * microscopic law table (lib/graph/science-worlds/microscopic/): Brownian motion, drift, membranes, reactions in a
 * well-mixed volume. The agent writes the model; the solver checks units, steps it with seeded dice, counts, and
 * runs its gates; the page draws it with a "what's real · what's drawn" panel.
 *
 * The recipe is stored as given (`kind: 'microscopic-view'`) and solved again on every render; the seed in it fixes
 * which of the sound runs it is. The mint returns the machine gate in full and never claims the eyes gate.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planMicroscopicWorld } from '@/lib/graph/science-worlds/microscopic/world';
import { microscopicStats } from '@/lib/graph/science-worlds/microscopic/solve';

export function mintMicroscopicView({ model, dress, liberties, title, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'microscopic-view',
    model,
    ...(dress !== undefined ? { dress } : {}),
    ...(liberties !== undefined ? { liberties } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };
  const plan = planMicroscopicWorld(manifest);
  const { solved } = plan;
  const sketch = SketchRepository.create({ title: title || 'microscopic world', manifest, ref, folderRef: folderRef ?? null });
  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    recipe: manifest,
    held: solved.held,
    gates: solved.gates.map((g) => ({ id: g.id, ok: g.ok, want: g.want, value: g.value, detail: g.detail })),
    ...(solved.gaps.length ? { gaps: solved.gaps } : {}),
    ...(solved.warnings.length ? { warnings: solved.warnings } : {}),
    observed: solved.observed,
    liberties: [...plan.drawn, ...solved.liberties],
    stats: microscopicStats(solved),
    note: 'Machine gate only. Nobody has looked at it yet: open the worldUrl.',
  };
}

export async function createMicroscopicViewHandler(input) {
  if (!input || typeof input !== 'object') throw new Error("create_view({ kind: 'microscopic' }) wants params: { model, dress?, liberties? }");
  const { model, dress, liberties, title, viewBox, scene, ref, folder_ref: folderRef, ...rest } = input;
  const extra = Object.keys(rest);
  if (extra.length) throw new Error(`science-worlds: params: unknown field '${extra[0]}' (a microscopic world's params are { model, dress?, liberties? })`);
  return mintMicroscopicView({ model, dress, liberties, title, viewBox, scene, ref, folderRef });
}

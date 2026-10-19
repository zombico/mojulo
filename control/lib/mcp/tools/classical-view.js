/**
 * create_view({ kind: 'classical' }) — a classical science world: a demo COMPOSED from the classical law table
 * (lib/graph/science-worlds/classical/), not one hand-authored experiment. The agent reads the teacher's ask and
 * writes the model (bodies, laws, duration); the solver checks units, steps it, measures it and runs its gates;
 * the page draws it with the world dress and a "what's real · what's drawn" panel.
 *
 * The recipe is stored as given (`kind: 'classical-view'`, no geometry, no tracks) and solved again on every
 * render. The mint returns the machine gate's verdict in full, so the agent can say which checks ran and what
 * they saw; it never claims the eyes gate.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planClassicalWorld } from '@/lib/graph/science-worlds/classical/world';
import { classicalStats } from '@/lib/graph/science-worlds/classical/solve';

export function mintClassicalView({ model, dress, liberties, title, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'classical-view',
    model,
    ...(dress !== undefined ? { dress } : {}),
    ...(liberties !== undefined ? { liberties } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };
  // solve once to validate the recipe and report the gates (only the recipe above is stored)
  const plan = planClassicalWorld(manifest);
  const { solved } = plan;
  const sketch = SketchRepository.create({ title: title || 'classical world', manifest, ref, folderRef: folderRef ?? null });
  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    recipe: manifest,
    // the machine gate: every check the solver ran, what it wanted and what it saw (they advise; none refuse)
    held: solved.held,
    gates: solved.gates.map((g) => ({ id: g.id, ok: g.ok, want: g.want, value: g.value, detail: g.detail })),
    ...(solved.gaps.length ? { gaps: solved.gaps } : {}),
    ...(solved.warnings.length ? { warnings: solved.warnings } : {}),
    observed: solved.observed,
    // what the page says is drawn rather than real: the drawing's own liberties, then the recipe's
    liberties: [...plan.drawn, ...solved.liberties],
    stats: classicalStats(solved),
    note: 'Machine gate only. Nobody has looked at it yet: open the worldUrl.',
  };
}

export async function createClassicalViewHandler(input) {
  if (!input || typeof input !== 'object') throw new Error("create_view({ kind: 'classical' }) wants params: { model, dress?, liberties? }");
  const { model, dress, liberties, title, viewBox, scene, ref, folder_ref: folderRef, ...rest } = input;
  const extra = Object.keys(rest);
  if (extra.length) throw new Error(`science-worlds: params: unknown field '${extra[0]}' (a classical world's params are { model, dress?, liberties? })`);
  return mintClassicalView({ model, dress, liberties, title, viewBox, scene, ref, folderRef });
}

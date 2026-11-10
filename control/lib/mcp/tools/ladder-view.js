/**
 * create_view({ kind: 'ladder' }) — a ladder of scales as one page: rungs top down, each simulated (a science world's
 * model, run and gated), depicted (drawn from sourced numbers, held to them) or explained (a cited sentence), each in its
 * own case with its magnification said, and a breadcrumb across the top that steps from one to the next
 * (lib/graph/science-worlds/ladder-view.js).
 *
 * The recipe is stored as given (`kind: 'ladder-view'`) and every rung is solved again on each render. The mint returns
 * every rung's gates (its id before theirs) and the ladder's own; it never claims the eyes gate.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planLadder, ladderStats } from '@/lib/graph/science-worlds/ladder-view';
import { sizeText } from '@/lib/graph/science-worlds/ladder';

export function mintLadderView({ rungs, open, title, viewBox, ref, folderRef } = {}) {
  const manifest = {
    kind: 'ladder-view', rungs,
    ...(open !== undefined ? { open } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(title ? { title } : {}),
  };
  const plan = planLadder(manifest);
  const sketch = SketchRepository.create({ title: title || 'ladder of scales', manifest, ref, folderRef: folderRef ?? null });
  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    recipe: manifest,
    held: plan.held,
    rungs: plan.rungs.map((r) => ({ id: r.id, label: r.label ?? r.id, status: r.status, ...(r.size ? { size: sizeText(r.size) } : {}), ...(r.step ? { step: `10^${r.step.power} of ${r.step.of}` } : {}) })),
    gates: plan.gates.map((g) => ({ id: g.id, ok: g.ok, want: g.want, value: g.value, detail: g.detail })),
    stats: ladderStats(plan),
    note: 'Machine gate only. Nobody has looked at it yet: open the worldUrl.',
  };
}

export async function createLadderViewHandler(input) {
  if (!input || typeof input !== 'object') throw new Error("create_view({ kind: 'ladder' }) wants params: { rungs, open? }");
  const { rungs, open, title, viewBox, ref, folder_ref: folderRef, ...rest } = input;
  const extra = Object.keys(rest);
  if (extra.length) throw new Error(`science-worlds: params: unknown field '${extra[0]}' (a ladder's params are { rungs, open? })`);
  return mintLadderView({ rungs, open, title, viewBox, ref, folderRef });
}

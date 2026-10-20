/**
 * create_view({ kind: 'relativistic' }) — a relativistic science world: the spacetime round one non-rotating mass,
 * composed from the relativistic law table (lib/graph/science-worlds/relativistic/): light bent round it and a disk's
 * shifted glow (drawn by a shader held to JS), bodies on geodesics, clocks held still or let fall. The agent writes
 * the model; the solver checks units, runs it and its gates; the page says what is real and what is drawn.
 *
 * The recipe is stored as given (`kind: 'relativistic-view'`) and solved again on every render; the seed in it fixes
 * which of the sound runs it is. The mint returns the machine gate in full and never claims the eyes gate.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planRelativisticWorld } from '@/lib/graph/science-worlds/relativistic/world';
import { relativisticStats } from '@/lib/graph/science-worlds/relativistic/solve';

export function mintRelativisticView({ model, dress, liberties, title, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'relativistic-view',
    model,
    ...(dress !== undefined ? { dress } : {}),
    ...(liberties !== undefined ? { liberties } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };
  const plan = planRelativisticWorld(manifest);
  const { solved } = plan;
  const sketch = SketchRepository.create({ title: title || 'relativistic world', manifest, ref, folderRef: folderRef ?? null });
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
    stats: relativisticStats(solved),
    note: solved.system === 'light'
      ? 'Machine gate only. The picture is drawn by a shader traced with the scheme these gates check; the shader conformance gate holds the two together in the test suite (node scripts/science-conformance.mjs --ref <ref>). Nobody has looked at it yet: open the worldUrl.'
      : 'Machine gate only. Nobody has looked at it yet: open the worldUrl.',
  };
}

export async function createRelativisticViewHandler(input) {
  if (!input || typeof input !== 'object') throw new Error("create_view({ kind: 'relativistic' }) wants params: { model, dress?, liberties? }");
  const { model, dress, liberties, title, viewBox, scene, ref, folder_ref: folderRef, ...rest } = input;
  const extra = Object.keys(rest);
  if (extra.length) throw new Error(`science-worlds: params: unknown field '${extra[0]}' (a relativistic world's params are { model, dress?, liberties? })`);
  return mintRelativisticView({ model, dress, liberties, title, viewBox, scene, ref, folderRef });
}

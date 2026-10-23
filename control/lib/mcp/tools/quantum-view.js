/**
 * create_view({ kind: 'quantum' }) — a quantum science world: states and the rules they follow, composed from the
 * quantum law table (lib/graph/science-worlds/quantum/): a particle on a line (wells, barriers, steps), a packet on a
 * plane through slits (its far field and detections), the hydrogen atom's orbitals, spin through Stern–Gerlach magnets, radioactive decay. The agent writes the model; the solver
 * checks units, runs it (Crank–Nicolson, exact orbitals, seeded outcomes) and its gates; the page draws it with a
 * "what's real · what's drawn" panel and the rows' sources.
 *
 * The recipe is stored as given (`kind: 'quantum-view'`) and solved again on every render; the seed in it fixes
 * which of the sound runs it is. The mint returns the machine gate in full and never claims the eyes gate.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planQuantumWorld } from '@/lib/graph/science-worlds/quantum/world';
import { quantumStats } from '@/lib/graph/science-worlds/quantum/solve';

export function mintQuantumView({ model, dress, liberties, title, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'quantum-view',
    model,
    ...(dress !== undefined ? { dress } : {}),
    ...(liberties !== undefined ? { liberties } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };
  const plan = planQuantumWorld(manifest);
  const { solved } = plan;
  const sketch = SketchRepository.create({ title: title || 'quantum world', manifest, ref, folderRef: folderRef ?? null });
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
    stats: quantumStats(solved),
    note: plan.shader
      ? `Machine gate only. The ${solved.system === 'plane' ? 'sheet is the solver\'s frames drawn' : 'volume is ψ drawn'} by a shader, held to the solver by the shader conformance gate in the test suite (node scripts/science-conformance.mjs --ref <ref>). Nobody has looked at it yet: open the worldUrl.`
      : 'Machine gate only. Nobody has looked at it yet: open the worldUrl.',
  };
}

export async function createQuantumViewHandler(input) {
  if (!input || typeof input !== 'object') throw new Error("create_view({ kind: 'quantum' }) wants params: { model, dress?, liberties? }");
  const { model, dress, liberties, title, viewBox, scene, ref, folder_ref: folderRef, ...rest } = input;
  const extra = Object.keys(rest);
  if (extra.length) throw new Error(`science-worlds: params: unknown field '${extra[0]}' (a quantum world's params are { model, dress?, liberties? })`);
  return mintQuantumView({ model, dress, liberties, title, viewBox, scene, ref, folderRef });
}

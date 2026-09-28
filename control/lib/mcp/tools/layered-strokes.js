/**
 * layered-strokes — strokes on a layered sketch through `update_sketch` (and the mint).
 *
 * A layered manifest may carry `strokes` (stroke-resolve.js): drawn lines as the authoring record of
 * someone who thinks in strokes. This module is the tool-side seam:
 *   - `prepareStrokes(manifest, mesh)` validates the list and records, on every stroke that lacks one,
 *     the camera it was drawn against (the view's framing of the mesh at that moment), so the stroke keeps
 *     its meaning after the form under it changes;
 *   - `applySolves(manifest, mesh, ops)` runs `{ op: 'solve', from: '/strokes/<id>' }` ops: the stroke's
 *     intent picks the solver (today: `silhouette` → the dial solve, silhouette-solve.js), the ops it
 *     produced land in the manifest (`dials`) and the stroke keeps a `solved` summary with the residual;
 *   - `strokesLedger(manifest, mesh)` re-resolves every stroke against the compiled mesh and returns the
 *     compact per-stroke entry the layered ledger carries (`ledger.strokes`), re-stamped on every edit.
 * Absent `strokes`, every function is a no-op and the manifest's bytes are untouched.
 */
import { validateStrokes, cameraRecord, resolveStroke, strokeLedgerEntry } from '@/lib/graph/polygonizer/stroke-resolve';
import { fitSilhouetteDials, solvedRecord, silhouetteResidual } from '@/lib/graph/polygonizer/silhouette-solve';

export const SOLVE_OP = 'solve';
const MANUAL = "manual: get_solid_vocab({ id: 'layered' }) (Drawing on it).";

/** Split a patch into the ops the generic applier takes and the `solve` ops this module runs. */
export function splitSolveOps(patch) {
  if (!Array.isArray(patch)) return { rest: patch, solves: [] };
  const solves = patch.filter((o) => o && typeof o === 'object' && o.op === SOLVE_OP);
  return { rest: patch.filter((o) => !solves.includes(o)), solves };
}

/** Validate `strokes`; record the camera on any stroke without one. Throws with the errors named. */
export function prepareStrokes(manifest, mesh) {
  if (manifest.strokes === undefined) return manifest;
  const errs = validateStrokes(manifest.strokes);
  if (errs.length) throw new Error(`strokes refused:\n - ${errs.join('\n - ')}\n${MANUAL}`);
  let changed = false;
  const strokes = manifest.strokes.map((s) => { if (s.camera) return s; changed = true; return { ...s, camera: cameraRecord(mesh, s.view) }; });
  return changed ? { ...manifest, strokes } : manifest;
}

const strokeRef = (op, i) => {
  const from = op.from ?? op.path; const m = typeof from === 'string' && from.match(/^\/strokes\/([A-Za-z0-9_.-]+)$/);
  if (!m) throw new Error(`patch[${i}]: \`solve\` needs \`from: '/strokes/<id>'\` — the stroke to solve`);
  return m[1];
};

/**
 * Run the solve ops in order. Returns { manifest, solved: [{ id, intent, …summary }], dialsChanged }.
 * `mesh` is the compiled mesh at the manifest's current dials (the first solve reuses it).
 */
export function applySolves(manifest, mesh, ops, indexOffset = 0) {
  if (!ops?.length) return { manifest, solved: [], dialsChanged: false };
  if (!Array.isArray(manifest.strokes) || !manifest.strokes.length) throw new Error(`patch[${indexOffset}]: \`solve\` needs a stored stroke — store one first with { op: 'set', path: '/strokes/-', value: { id, view, intent, points } }. ${MANUAL}`);
  let next = { ...manifest, strokes: [...manifest.strokes] }; const solved = []; let dialsChanged = false; let currentMesh = mesh;
  ops.forEach((op, k) => {
    const i = indexOffset + k; const id = strokeRef(op, i);
    const at = next.strokes.findIndex((s) => s.id === id);
    if (at < 0) throw new Error(`patch[${i}]: no stroke '${id}' (have ${next.strokes.map((s) => s.id).join(', ')})`);
    const stroke = next.strokes[at];
    if (stroke.intent === 'silhouette') {
      const names = Array.isArray(op.dials) ? op.dials : null;
      const budget = Number.isFinite(op.budget) ? Math.max(4, Math.min(400, op.budget)) : undefined;
      const fit = fitSilhouetteDials(next.recipe, next.dials, stroke, { names, budget, mesh: currentMesh });
      if (Object.keys(fit.moved).length) { next.dials = { ...next.dials, ...fit.moved }; dialsChanged = true; currentMesh = null; }
      const record = solvedRecord(fit); next.strokes[at] = { ...stroke, solved: record };
      solved.push({ id, intent: stroke.intent, ...record, trace: fit.trace });
    } else {
      throw new Error(`patch[${i}]: stroke '${id}' is a ${stroke.intent}; only silhouette strokes solve yet (contour, brush, fold and landmark follow). ${MANUAL}`);
    }
  });
  return { manifest: next, solved, dialsChanged };
}

/** The per-stroke ledger: each stroke re-resolved against this mesh. Undefined when the manifest has no strokes. */
export function strokesLedger(manifest, mesh) {
  if (!Array.isArray(manifest.strokes) || !manifest.strokes.length) return undefined;
  const out = {};
  for (const s of manifest.strokes) out[s.id] = strokeLedgerEntry(s, resolveStroke(mesh, s));
  return out;
}

/**
 * The readout `measure_solid` carries: the ledger entry plus, for a silhouette, what THIS form reaches now
 * (`reached` = 1 − the residual's share of the drawn area, the residual's box) and the dials its last solve left on a
 * bound — the grammar was short a word there. Undefined when the manifest has no strokes.
 */
export function strokesReadout(manifest, mesh) {
  const ledger = strokesLedger(manifest, mesh); if (!ledger) return undefined;
  const out = {};
  for (const s of manifest.strokes) {
    const entry = { ...ledger[s.id] };
    if (s.intent === 'silhouette') {
      const R = silhouetteResidual(mesh, s); entry.now = { iou: R.iou, reached: Math.round((1 - Math.min(1, R.share)) * 1000) / 1000, residual: { share: R.share, bbox: R.bbox } };
      if (s.solved?.bounds?.length) entry.hint = `the solve stopped on a bound (${s.solved.bounds.join(', ')}): the residual there is outside what the dials can say — a new dial or op, or a different outline`;
    } else entry.hint = `${s.intent} strokes resolve but do not solve yet`;
    if (entry.misses) entry.hint = `${entry.misses} of ${entry.points} points miss the solid in this view${entry.hint ? `; ${entry.hint}` : ''}`;
    out[s.id] = entry;
  }
  return out;
}

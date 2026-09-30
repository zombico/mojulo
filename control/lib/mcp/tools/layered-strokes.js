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
 *     compact per-stroke entry the layered ledger carries (`ledger.strokes`), re-stamped on every edit;
 *   - `carryStrokeWork(prev, next)` keeps what the strokes made across a hero / plan regeneration, which
 *     rebuilds the recipe whole.
 * Absent `strokes`, every function is a no-op and the manifest's bytes are untouched.
 */
import { validateStrokes, cameraRecord, resolveStroke, strokeLedgerEntry, viewOf } from '@/lib/graph/polygonizer/stroke-resolve';
import { fitSilhouetteDials, solvedRecord, silhouetteResidual } from '@/lib/graph/polygonizer/silhouette-solve';
import { contourStripParts, partsFrom } from '@/lib/graph/polygonizer/contour-strip';
import { brushDial, dialsFrom } from '@/lib/graph/polygonizer/brush-map';
import { compileLayered, addressPin } from '@/lib/graph/polygonizer/station-loft';
import { layeredExposure } from '@/lib/graph/polygonizer/station-loft-exposure';

export const SOLVE_OP = 'solve';
const MANUAL = "manual: get_solid_vocab({ id: 'layered' }) (Drawing on it).";

const isSolve = (o) => !!o && typeof o === 'object' && o.op === SOLVE_OP;
/**
 * Split a patch into the ops the generic applier takes and the `solve` ops this module runs. The solves run after
 * every other op, against the compiled result, so they come last: a set / remove / add written after a solve is
 * refused rather than silently run before it. The generic ops are then the patch's prefix and the solves its tail,
 * so both keep their patch indices (applySolves takes the tail's offset).
 */
export function splitSolveOps(patch) {
  if (!Array.isArray(patch)) return { rest: patch, solves: [] };
  const first = patch.findIndex(isSolve);
  if (first < 0) return { rest: patch, solves: [] };
  const late = patch.findIndex((o, i) => i > first && !isSolve(o));
  if (late >= 0) throw new Error(`patch[${late}]: a '${patch[late]?.op}' op after a \`solve\` (patch[${first}]) — solve ops run last, against what the other ops made: put them at the end`);
  return { rest: patch.slice(0, first), solves: patch.slice(first) };
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

// the keys a solve op reads, by the stroke's intent: any other key would be silently ignored, so it is refused
// by name (`mirror` above all, which is the STROKE's field, not the op's)
const SOLVE_KEYS = Object.freeze({ silhouette: ['dials', 'budget'], contour: ['height', 'width', 'group'], brush: ['amp', 'radius', 'direction'] });
function refuseUnreadKeys(op, i, stroke, at) {
  const reads = ['op', 'from', 'path', ...(SOLVE_KEYS[stroke.intent] || [])];
  const extra = Object.keys(op).filter((k) => !reads.includes(k)); if (!extra.length) return;
  const mirror = extra.includes('mirror') ? ` \`mirror\` is the stroke's own field: set /strokes/${at}/mirror to true, then solve.` : '';
  throw new Error(`patch[${i}]: a ${stroke.intent} solve reads ${reads.slice(1).join(', ')} — not ${extra.join(', ')}.${mirror} ${MANUAL}`);
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
  let next = { ...manifest, strokes: [...manifest.strokes] }; const solved = []; let dialsChanged = false, recipeChanged = false; let currentMesh = mesh;
  ops.forEach((op, k) => {
    const i = indexOffset + k; const id = strokeRef(op, i);
    const at = next.strokes.findIndex((s) => s.id === id);
    if (at < 0) throw new Error(`patch[${i}]: no stroke '${id}' (have ${next.strokes.map((s) => s.id).join(', ')})`);
    const stroke = next.strokes[at];
    if (SOLVE_KEYS[stroke.intent]) refuseUnreadKeys(op, i, stroke, at);
    if (stroke.intent === 'silhouette') {
      const names = Array.isArray(op.dials) ? op.dials : null;
      const budget = Number.isFinite(op.budget) ? Math.max(4, Math.min(400, op.budget)) : undefined;
      let fit;
      try { fit = fitSilhouetteDials(next.recipe, next.dials, stroke, { names, budget, mesh: currentMesh }); }
      catch (err) { throw new Error(`patch[${i}]: ${err.message}. ${MANUAL}`); }
      if (Object.keys(fit.moved).length) { next.dials = { ...next.dials, ...fit.moved }; dialsChanged = true; currentMesh = null; }
      const record = solvedRecord(fit); next.strokes[at] = { ...stroke, solved: record };
      solved.push({ id, intent: stroke.intent, ...record, trace: fit.trace });
    } else if (stroke.intent === 'contour') {
      // a contour becomes a surface strip along its resolved addresses (contour-strip.js), stored as layer-2 parts
      // carrying `from: <id>`; the parts an earlier solve of this stroke made are replaced. The exposure ledger
      // says whether the strip reads from the stroke's own view (advice on the record, never a refusal).
      // resolve against the solid WITHOUT the parts this stroke made before: a point over its own strip would
      // otherwise land on the strip's pin (one address for every point) instead of the carrier under it
      const own = partsFrom(next.recipe, id);
      const bare = own.length ? { ...next.recipe, parts: Object.fromEntries(Object.entries(next.recipe.parts).filter(([n]) => !own.includes(n))) } : next.recipe;
      const m = !own.length && currentMesh ? currentMesh : compileLayered(bare, next.dials || {}, next.channels || {});
      const resolved = resolveStroke(m, stroke);
      // the strip is built on the REST carrier: (s, t) addresses are dial-invariant, and a `follow` part placed on the
      // rest frame is carried to the dialed surface by compileLayered — so the strip lands where the stroke was drawn
      // at these dials and rides the carrier under any other
      const restMesh = compileLayered(next.recipe, {}, { details: false, creases: false });
      let made;
      try { made = contourStripParts(restMesh, stroke, resolved, { height: op.height, width: op.width, group: op.group }); }
      catch (err) { throw new Error(`patch[${i}]: ${err.message}. ${MANUAL}`); }
      const parts = { ...next.recipe.parts }; for (const n of partsFrom(next.recipe, id)) delete parts[n]; Object.assign(parts, made.parts);
      next.recipe = { ...next.recipe, parts }; currentMesh = null; recipeChanged = true;
      const after = compileLayered(next.recipe, next.dials || {}, next.channels || {});
      // each strip is judged from the view it was drawn in; the mirrored twin from that view's mirror (az → 360 − az),
      // since a twin on the far cheek is meant to be seen from the far side
      const az = viewOf(stroke.view).azimuth; const E = layeredExposure(after, { views: [az, (360 - az) % 360], res: 256 });
      const exposure = Object.fromEntries(made.names.map((n, k) => { const L = E.parts[n]; if (!L) return [n, null]; const v = L.visible[String(k === 0 ? az : (360 - az) % 360)] ?? 0; return [n, { exposed: v, flag: v >= 0.25 ? 'reads' : v >= 0.05 ? 'faint' : 'buried' }]; }));
      const record = { parts: made.names, carrier: made.carrier, side: made.side, stations: made.run.length, height: made.height, width: made.width, hits: resolved.hits, misses: resolved.misses, exposure };
      next.strokes[at] = { ...stroke, solved: record };
      solved.push({ id, intent: stroke.intent, ...record });
    } else if (stroke.intent === 'brush') {
      // a brush becomes a `brush` dial (brush-map.js): skin-map entries at the resolved addresses, stored at 1 so it
      // replays under every other dial and can be turned down by name; the dial an earlier solve made is replaced
      const m = currentMesh || compileLayered(next.recipe, next.dials || {}, next.channels || {});
      const resolved = resolveStroke(m, stroke);
      let made;
      try { made = brushDial(compileLayered(next.recipe, {}, { details: false, creases: false }), stroke, resolved, { amp: op.amp, radius: op.radius, direction: op.direction }); }
      catch (err) { throw new Error(`patch[${i}]: ${err.message}. ${MANUAL}`); }
      const dials = { ...next.recipe.dials }; const values = { ...next.dials }; for (const n of dialsFrom(next.recipe, id)) { delete dials[n]; delete values[n]; }
      dials[made.name] = made.dial; values[made.name] = made.value;
      next.recipe = { ...next.recipe, dials }; next.dials = values; currentMesh = null; recipeChanged = true;
      // the push, measured: how far the carrier's points moved at the dial's value
      const before = compileLayered({ ...next.recipe, dials: { ...next.recipe.dials, [made.name]: { ...made.dial, rest: 0 } } }, { ...next.dials, [made.name]: 0 });
      const after = compileLayered(next.recipe, next.dials);
      let moved = 0, maxPush = 0; after.vertices.forEach((v, k) => { const d = Math.hypot(v[0] - before.vertices[k][0], v[1] - before.vertices[k][1], v[2] - before.vertices[k][2]); if (d > 1e-9) { moved++; if (d > maxPush) maxPush = d; } });
      const record = { dial: made.name, carrier: made.carrier, side: made.side, entries: made.entries, amp: made.amp, radius: made.radius, hits: resolved.hits, misses: resolved.misses, pointsMoved: moved, maxPush: Math.round(maxPush * 1e6) / 1e6 };
      next.strokes[at] = { ...stroke, solved: record };
      solved.push({ id, intent: stroke.intent, ...record });
    } else {
      throw new Error(`patch[${i}]: stroke '${id}' is a ${stroke.intent}; silhouette, contour and brush strokes solve today (fold and landmark follow). ${MANUAL}`);
    }
  });
  return { manifest: next, solved, dialsChanged: dialsChanged || recipeChanged };
}

/**
 * A /hero or /plan edit (or a whole replacement of such a row) regenerates the recipe whole (layered.js
 * expandLayeredManifest), which would silently drop the strips and brush dials the stored strokes made. Carry each
 * over from `prev` onto `next` where it still lands: a strip's pin face and a brush's addresses on a layer-1 carrier of
 * the regenerated recipe, at rest, whose stations and slots are the ones the work was made on. An (s, t) address is a
 * station index (or `u`) and a slot `t`, so a carrier that gained or lost a station, or changed its slots, would put
 * the same address somewhere else on the body. A stroke whose work does not land is left out, its `solved` record
 * cleared, and named in `warnings` (its camera and points are kept: a re-solve rebuilds it on the new form). No
 * stroke work, no-op.
 */
export function carryStrokeWork(prev, next) {
  const strokes = Array.isArray(next.strokes) ? next.strokes : [];
  const made = strokes.map((s) => ({ id: s.id, parts: partsFrom(prev?.recipe || {}, s.id), dials: dialsFrom(prev?.recipe || {}, s.id) }))
    .filter((m) => m.parts.length || m.dials.length);
  if (!made.length) return { manifest: next, warnings: [] };
  const rest = compileLayered(next.recipe, {}, { details: false, creases: false });
  // what an (s, t) address means on a carrier (station-loft.js addressPin): its station ids and `u`, its slots and `slotT`
  const frame = (p) => (p ? JSON.stringify([(p.stations || []).map((st, i) => [st.id, st.u ?? i]), (p.slots || []).map((sl, k) => [sl, p.slotT?.[sl] ?? k])]) : null);
  const carrier = (name) => (rest.parts[name]?.layer === 1 && frame(prev.recipe.parts?.[name]) === frame(next.recipe.parts?.[name]) ? rest.parts[name] : null);
  const lands = (fn) => { try { return fn(); } catch { return false; } };
  const partLands = (p) => !!p?.pin && !!carrier(p.pin.parent)?.faces?.[p.pin.face];
  const dialLands = (d) => Array.isArray(d?.parts) && d.parts.every(carrier) && (d.entries || []).every((e) => lands(() => !!addressPin(carrier(d.parts[0]), d.parts[0], e.at[0], e.at[1], e.side === 'L' ? 'L' : 'R')));
  const parts = { ...next.recipe.parts }, spec = { ...next.recipe.dials }, values = { ...next.dials }; const dropped = [];
  for (const m of made) {
    if (!m.parts.every((n) => partLands(prev.recipe.parts[n])) || !m.dials.every((n) => dialLands(prev.recipe.dials[n]))) { dropped.push(m.id); continue; }
    for (const n of m.parts) parts[n] = prev.recipe.parts[n];
    for (const n of m.dials) { spec[n] = prev.recipe.dials[n]; values[n] = prev.dials?.[n] ?? spec[n].rest; }
  }
  const manifest = { ...next, recipe: { ...next.recipe, parts, dials: spec }, dials: values,
    ...(dropped.length ? { strokes: strokes.map((s) => { if (!dropped.includes(s.id)) return s; const { solved: _s, ...kept } = s; return kept; }) } : {}) };
  const warnings = dropped.length ? [`the regenerated recipe lost, or changed the stations or slots of, the carrier under what stroke${dropped.length > 1 ? 's' : ''} ${dropped.join(', ')} made, so ${dropped.length > 1 ? 'those strips and brushes were' : 'that strip or brush was'} dropped and the \`solved\` record cleared: re-solve with { op: 'solve', from: '/strokes/<id>' } (the stroke's camera and points are kept)`] : [];
  return { manifest, warnings };
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
    } else if (s.intent === 'contour') { if (!s.solved) entry.hint = 'unsolved: { op: \'solve\', from: \'/strokes/' + s.id + '\' } grows a strip along it'; else { const buried = Object.entries(s.solved.exposure || {}).filter(([, e]) => e && e.flag !== 'reads').map(([n, e]) => `${n} ${e.flag}`); if (buried.length) entry.hint = `the strip is hard to see from its own view (${buried.join(', ')}): raise height, or draw it where the surface faces the camera`; } }
    else if (s.intent === 'brush') { if (!s.solved) entry.hint = 'unsolved: { op: \'solve\', from: \'/strokes/' + s.id + '\' } pushes the skin along it (a brush dial you can turn down by name)'; else if (!s.solved.pointsMoved) entry.hint = 'the brush moved no point: the carrier has no vertex within its radius — a larger radius, or refine the carrier there'; }
    else entry.hint = `${s.intent} strokes resolve but do not solve yet`;
    if (entry.misses) entry.hint = `${entry.misses} of ${entry.points} points miss the solid in this view${entry.hint ? `; ${entry.hint}` : ''}`;
    out[s.id] = entry;
  }
  return out;
}

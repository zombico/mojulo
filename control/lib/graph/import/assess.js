/**
 * assess — what an import makes of a canonical GLB (import/to-glb.js), before anything is stored: what it holds
 * (inspect.js), how tall it stands, what it is (a body, a mascot, a creature or a prop: classify.js), and how it comes
 * to move: by its own skeleton read as a humanoid (rig-import.js: by the file's VRM map, by its joints' names, by its
 * skeleton's shape), or, a biped with none that reads, fitted onto the vajra (autorig.js). A rig either way is held to
 * the machine gate (rig-gate.js).
 *
 *   assessModel(glb, { height?, units?, as?, rig? }) → {
 *     inspect, units, height, class: { class, basis, headsTall, … },
 *     rig: { ok, how: 'file' | 'name' | 'shape' | 'auto' | 'none', bones?, gate?, error?, landmarks? },
 *     glb   the bytes a character is kept as: the file's own when its skeleton reads, the auto-rigged GLB when it was
 *           fitted, the file's own (unrigged) for anything else
 *   }
 *     height   the metres it is meant to stand (a character's): over its own reading
 *     units    the unit its numbers are in (mm | cm | m | in | ft): over the reading
 *     as       'body' | 'mascot' | 'creature' | 'prop': over the classifier
 *     rig      'auto' to fit it onto the vajra even when its own skeleton reads (a bad rig made over); 'none' to rig
 *              nothing (scenery)
 *
 * Pure: the same bytes and the same words give the same assessment.
 */
import { inspectModel, unitMetres, restTriangles, unitsReading } from './inspect.js';
import { classifyShape, CLASSES } from './classify.js';
import { autoRig } from './autorig.js';
import { poseStretch } from './rig-gate.js';
import { importRig } from '../scene/rig-import.js';

const r4 = (x) => Math.round(x * 1e4) / 1e4 + 0;

/** A rig pack's parts as one flat triangle list (its parts' positions, three corners a face). */
export function packTriangles(pack) {
  const out = [];
  for (const part of pack.parts) { if (!part) continue; const b = Buffer.from(part.pos, 'base64'); for (let i = 0; i + 3 < b.length; i += 4) out.push(b.readFloatLE(i)); }
  return out;
}

export const RIG_WORDS = Object.freeze(['auto', 'none']);

export async function assessModel(glb, { height = null, units = null, as = null, rig: rigWord = null } = {}) {
  if (as !== null && !CLASSES.includes(as)) throw new Error(`import: \`as\` is one of ${CLASSES.join(' | ')} (got '${as}')`);
  if (rigWord !== null && !RIG_WORDS.includes(rigWord)) throw new Error(`import: \`rig\` is one of ${RIG_WORDS.join(' | ')} (got '${rigWord}')`);
  const inspect = inspectModel(glb);
  const figure = inspect.skins.length > 0;
  if (units !== null && unitMetres(units) == null) throw new Error(`import: \`units\` is one of mm | cm | m | in | ft (got '${units}')`);
  // (the height it stands is settled once its class is: a figure's numbers are read against a figure's range)
  let reading = inspect.units, u = units ?? reading.assumed;
  let stands = height ?? r4(inspect.rest.height * unitMetres(u));
  // 1. its own skeleton, read as a humanoid
  let rig = { ok: false, how: 'none' }, own = null;
  if (figure && rigWord === null) {
    try {
      const { pack, ledger } = importRig(glb, { height: stands });
      const at = (id) => pack.bones.find((b) => b.id === id)?.head?.[2];
      // the chin: midway up from the neck joint to the head joint (the head joint sits at the skull's base)
      const chin = Number.isFinite(at('neck')) ? (at('neck') + at('head')) / 2 : at('head');
      own = { pack, chin };
      rig = { ok: true, how: ledger.how ?? 'name', bones: pack.bones.length };
    } catch (e) { rig = { ok: false, how: 'none', error: e.message.replace(/^rig-import: /, '') }; }
  }
  // 2. what it is: a rigged humanoid read in its pack's frame (stood up by its skeleton), anything else as it stands
  const shape = classifyShape(own ? packTriangles(own.pack) : restTriangles(glb), { rigged: own ? 'humanoid' : figure ? 'other' : null, chin: own ? own.chin : null });
  const cls = as ? { ...shape, class: as, basis: 'stated' } : shape;
  if (!figure && (cls.class === 'body' || cls.class === 'mascot')) {
    reading = unitsReading(inspect.rest.height, { figure: true });
    if (units === null) { u = reading.assumed; if (height === null) stands = r4(inspect.rest.height * unitMetres(u)); }
  }
  // 3. a biped with no skeleton that reads (or one asked to be made over): fitted onto the vajra
  let out = glb;
  if (own) rig.gate = poseStretch(own.pack);
  else if (rigWord !== 'none' && (cls.class === 'body' || cls.class === 'mascot')) {
    try {
      const fitted = autoRig(glb, { as: cls.class, shape });
      const { pack } = importRig(fitted.bytes, { height: stands });
      rig = { ok: true, how: 'auto', bones: pack.bones.length, gate: poseStretch(pack), landmarks: fitted.landmarks, fit: fitted.ledger, ...(rig.error ? { own: rig.error } : {}) };
      out = fitted.bytes;
    } catch (e) { rig = { ok: false, how: 'none', error: e.message.replace(/^import: /, ''), ...(rig.error ? { own: rig.error } : {}) }; }
  } else if (!rig.error) rig.error = cls.class === 'prop' ? 'a prop: placed as it stands, never rigged' : cls.class === 'creature' ? 'a creature: placed as it stands (its own clips are not played yet)' : 'no skeleton';
  return { inspect, units: { ...reading, assumed: u, ...(units !== null ? { basis: 'stated', ambiguous: false } : {}) }, height: stands, class: cls, rig, glb: out };
}

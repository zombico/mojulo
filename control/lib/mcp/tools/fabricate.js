/**
 * fabricate_solid — an object said by what its parts have to DO, solved from standard parts, carried out by the kind
 * that owns the material's joinery.
 *
 * The fabricator (lib/graph/fabricator/) DECIDES: each need's strategy, the parts to buy, and its executor. The
 * existing kinds EXECUTE: a workbench `frames` entry for wood joinery (its furniture joints place and count the
 * fittings), an OpenSCAD source for printed, metal, sheet and extrusion work (the `mj_*` cuts). A key-free two-call
 * handshake:
 *   1. `needs` alone → the plan (lib/graph/fabricator/plan.js). Nothing is minted.
 *   2. `needs` + `source` → a scad row; `needs` + `frames` → a workbench row. The plan rides beside the recipe as
 *      `fabricate`, stamped with the fabricator version (frozen, like the assembler's sources). A planned cut or joint
 *      the recipe never makes, and a need planned for the other executor, are warned about, never refused. On a frames
 *      mint the bill of materials is the frame's own hardware report, not the plan's estimate.
 */
import { registerTool } from '@/lib/mcp/server';
import { mintScad } from '@/lib/mcp/tools/scad';
import { createWorkbenchHandler } from '@/lib/mcp/tools/workbench';
import { DEFAULT_LOAD_N } from '@/lib/graph/fabricator/sizing';
import { fabricationPlan, planModules, unplacedModules, unplacedJoints, mintedBom, planChanges, EXECUTORS } from '@/lib/graph/fabricator/plan';
import { withPlacement } from '@/lib/graph/fabricator/place';
import { lowerFrame } from '@/lib/graph/construction/frame';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planScad, persistedScadLedger } from '@/lib/graph/scad/scad-render';

const NEEDS_KEYS = ['needs', 'host', 'loadN', 'cycles', 'access', 'tags'];

const nextFor = (plan) => {
  const how = [];
  if (plan.executors.includes('frames')) how.push('`frames`: a workbench frames entry (members as boxes), writing each planned `joints` row as a frame joint between the two members it joins; the frame places and counts the fittings');
  if (plan.executors.includes('scad')) how.push('`source`: an OpenSCAD program with each planned `cuts` call translated to the face it enters (cutters run from z = 0 down) and each printed part its own `parts` entry');
  if (!how.length) how.push('`source` or `frames` for the body; every planned part is bought and fitted by hand');
  const notes = [];
  const grips = plan.needs.filter((n) => n.assumes).map((n) => `${n.id} ${n.assumes.grip} mm`);
  const assumed = plan.needs.filter((n) => n.sizing?.loadAssumed).map((n) => n.id);
  if (assumed.length) notes.push(`Sized for ${DEFAULT_LOAD_N} N where no load was said (${assumed.join(', ')}): pass \`loadN\` (N on the joint, shared by its count) and \`certainty\`, and plan again.`);
  const weak = plan.needs.filter((n) => n.sizing?.by === 'given' && n.sizing.sf < n.sizing.required).map((n) => `${n.id} (${n.sizing.size}: safety factor ${n.sizing.sf}, ${n.sizing.required} asked)`);
  if (weak.length) notes.push(`A given size is weaker than its load asks: ${weak.join('; ')}.`);
  if (grips.length) notes.push(`Bolt lengths assume a grip (mm of material under the head) of ${grips.join(', ')}: pass \`grip\` on a need when yours differs, and plan again.`);
  if (plan.overlaps.length) notes.push(`Counted twice: ${plan.overlaps.map((o) => o.why).join('; ')}.`);
  if (plan.suggestions.length) notes.push(`Also needed, and not in your needs: ${plan.suggestions.map((s) => `{ function: '${s.function}'${s.through ? `, through: '${s.through}'` : ''}${s.rim ? `, rim: [${s.rim.join(', ')}]` : ''}${s.shaftD ? `, shaftD: ${s.shaftD}` : ''} } (${s.why})`).join('; ')}. Add them and plan again, or say why not.`);
  if (plan.placement) notes.push(`Placed: ${plan.placement.placed.map((x) => `${x.need} ${x.call.replace(/\(.*/, '')} ×${x.n} in ${x.part}`).join(', ')}. In the source, cut each part with fab_cuts("<part>") inside its difference() and add fab_adds("<part>") to its union; the block defining them is written in at mint.${plan.placement.manual.length ? ` By hand: ${plan.placement.manual.map((x) => `${x.need} ${x.call} (${x.why})`).join('; ')}.` : ''}`);
  else if (plan.executors.includes('scad')) notes.push('Each cut says `where` it goes; or give a need `at` points (with `axis` and `parts`) and the cuts are written for you.');
  else notes.push('Each cut says `where` it goes.');
  return `Call fabricate_solid again with the same needs and ${how.join('; or ')}. One executor per row: mint the other's needs as their own row. The bom is what to buy; carry the notices with the object. ${notes.join(' ')}`;
};

/** The fabrication readout every mint and re-plan returns beside the row's own stats. */
function readout(plan, fabrication, ref, elsewhere, extra = {}) {
  return { ...fabrication, ...(ref ? { export: `export_model({ ref: '${ref}', format: 'bom' })` } : {}), notices: plan.notices, gaps: plan.gaps, elsewhere,
    overlaps: plan.overlaps, suggestions: plan.suggestions, ...(plan.placement ? { placement: { placed: plan.placement.placed, manual: plan.placement.manual } } : {}), ...extra };
}

/** The advisory warnings shared by a mint and a re-plan. */
function advise(plan, executor, warnings, { unplaced, placement }) {
  if (unplaced.length) warnings.push(executor === 'scad'
    ? `fabricate: the source never calls ${unplaced.join(', ')} — the plan's cut for it is not placed`
    : `fabricate: no frame joint of type ${unplaced.join(', ')} was made — the plan's joint for it is not placed`);
  if (placement && plan.placement && !placement.called) warnings.push('fabricate: the needs say where (`at`), but the source never calls fab_cuts("<part>") or fab_adds("<part>") — the placement block is not written in');
  if (plan.placement?.manual.length) warnings.push(`fabricate: placed by hand — ${plan.placement.manual.map((m) => `${m.need} ${m.call} (${m.why})`).join('; ')}`);
  if (plan.overlaps.length) warnings.push(`fabricate: counted twice — ${plan.overlaps.map((o) => o.why).join('; ')}`);
  const elsewhere = plan.needs.filter((n) => n.executor !== executor && n.executor !== 'none').map((n) => `${n.id} (${n.executor})`);
  if (elsewhere.length) warnings.push(`fabricate: ${elsewhere.join(', ')} ${elsewhere.length === 1 ? 'is' : 'are'} planned for the other executor — mint ${elsewhere.length === 1 ? 'it' : 'them'} as ${elsewhere.length === 1 ? 'its' : 'their'} own row`);
  return elsewhere;
}

const needsOf = (input, stored = {}) => Object.fromEntries(NEEDS_KEYS.map((k) => [k, input[k] !== undefined ? input[k] : stored[k]]).filter(([, v]) => v !== undefined));

/**
 * A re-plan: `ref` names a stored scad or workbench row and no body is passed. The needs (the stored ones when none are
 * given) are planned again and the plan replaces the stored one in place, so the bill of materials and the placement
 * follow the needs and the body as they are now. A row minted without a plan takes one the same way.
 */
async function replan(input, sketch) {
  const m = sketch.manifest;
  const executor = m.kind === 'scad' ? 'scad' : m.kind === 'workbench' && Array.isArray(m.frames) && m.frames.length ? 'frames' : null;
  if (!executor) throw new Error(`fabricate_solid: '${sketch.ref}' is a ${m.kind} row — a plan rides on a scad row or a workbench row with \`frames\`.`);
  const before = m.fabricate || null;
  const said = needsOf(input, before || {});
  if (!said.needs) throw new Error(`fabricate_solid: '${sketch.ref}' has no plan yet — pass its \`needs\` to plan it.`);
  const plan = fabricationPlan(said);
  const fabricate = { ...said, executor, plan };
  const warnings = [];
  let manifest;
  let unplaced;
  let bom;
  let placement = null;
  if (executor === 'scad') {
    placement = withPlacement(m.source, plan.placement);
    manifest = { ...m, source: placement.source, fabricate };
    const { stats } = await planScad(manifest);
    manifest.ledger = persistedScadLedger(stats.ledger);
    unplaced = unplacedModules(plan, manifest.source);
    bom = plan.bom.map((l) => ({ ...l, from: 'plan' }));
  } else {
    const reports = m.frames.map((f) => lowerFrame(f).report);
    manifest = { ...m, fabricate };
    unplaced = unplacedJoints(plan, reports);
    bom = mintedBom(plan, reports);
  }
  const elsewhere = advise(plan, executor, warnings, { unplaced, placement });
  SketchRepository.update({ ref: sketch.ref, manifest });
  const changes = planChanges(before?.plan, plan);
  return {
    ok: true, phase: 'replan', ref: sketch.ref, minted: false, changes,
    stats: { fabrication: readout(plan, { version: plan.version, executor, bom, unplaced }, sketch.ref, elsewhere, placement ? { placementWritten: placement.written } : {}), ...(warnings.length ? { warnings } : {}) },
    next: changes.needs.length || changes.bom.length
      ? `Re-planned in place. ${placement?.written ? 'The placement block in the source is rewritten. ' : ''}Re-export the bill of materials: export_model({ ref: '${sketch.ref}', format: 'bom' }).`
      : 'Re-planned in place; nothing in the plan moved.',
  };
}

export async function fabricateSolidHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('fabricate_solid needs { needs: [{ function, … }], host?, source? | frames? }.');
  const { source, frames, title, ref, folder_ref: folderRef, ...rest } = input;
  const knobs = Object.fromEntries(Object.entries(rest).filter(([k]) => !NEEDS_KEYS.includes(k)));
  const hasSource = typeof source === 'string';
  const hasFrames = Array.isArray(frames) && frames.length > 0;
  if (hasSource && hasFrames) throw new Error('fabricate_solid: pass `source` (a scad row) or `frames` (a workbench row), not both — one executor per row; mint the other needs as their own row.');
  const stored = typeof ref === 'string' ? SketchRepository.getByRef(ref) : null;
  if (stored && !hasSource && !hasFrames) return replan(input, stored);
  if (stored) throw new Error(`fabricate_solid: '${ref}' already exists — call fabricate_solid({ ref: '${ref}', needs? }) without a body to re-plan it in place, or edit its body with update_sketch / edit_solid first.`);
  const said = needsOf(input);
  const plan = fabricationPlan(said);
  if (!hasSource && !hasFrames) {
    return { ok: true, phase: 'plan', minted: false, fabrication: { ...plan, modules: planModules(plan) }, next: nextFor(plan) };
  }
  const executor = hasSource ? 'scad' : 'frames';
  const fabricate = { ...said, executor, plan };
  const warnings = [];
  let out;
  let fabrication;
  let placement = null;
  if (executor === 'scad') {
    placement = withPlacement(source, plan.placement);
    out = await mintScad({ ...knobs, title, ref, folderRef, source: placement.source, fabricate });
    const unplaced = unplacedModules(plan, placement.source);
    fabrication = { version: plan.version, executor, bom: plan.bom.map((l) => ({ ...l, from: 'plan' })), unplaced, ...(plan.placement ? { placementWritten: placement.written } : {}) };
  } else {
    // The frames say their unit; a row that does not declare its own takes it, so the size readout is not cm by default.
    const units = knobs.units ?? (new Set(frames.map((f) => f && f.unit)).size === 1 && typeof frames[0]?.unit === 'string' ? frames[0].unit : undefined);
    out = await createWorkbenchHandler({ ...knobs, ...(units ? { units } : {}), title, ref, folder_ref: folderRef, frames, fabricate });
    fabrication = { version: plan.version, executor, bom: mintedBom(plan, out.stats.frames), unplaced: unplacedJoints(plan, out.stats.frames) };
  }
  const elsewhere = advise(plan, executor, warnings, { unplaced: fabrication.unplaced, placement });
  return {
    ...out,
    stats: {
      ...out.stats,
      fabrication: readout(plan, fabrication, out.ref, elsewhere),
      ...(warnings.length ? { warnings: [...(out.stats.warnings || []), ...warnings] } : {}),
    },
  };
}

export function registerFabricateTools() {
  registerTool({
    name: 'fabricate_solid',
    description:
      'Make a physical object buildable from real parts: `needs` say what each part must DO (fasten, hinge, spin, seal, '
      + 'mount …); get the standard parts, what to buy, and the cuts or joints that take them. `needs` alone → the plan; '
      + 'then + `source` (OpenSCAD) or + `frames` (a wood workbench frame) → the row; `ref` alone re-plans it. Placing parts in a scene is '
      + "the assembler. Manual: get_solid_vocab({ id: 'fabricate' }).",
    inputSchema: {
      type: 'object',
      properties: {
        needs: { type: 'array', items: { type: 'object' }, description: '[{ function, id?, count?, … }], one per job.' },
        host: { type: 'string', description: 'printed | wood | metal | sheet | extrusion.' },
        tags: { type: 'array', items: { type: 'string' } },
        source: { type: 'string', description: 'OpenSCAD program (second call).' },
        frames: { type: 'array', items: { type: 'object' }, description: 'Workbench frames (second call).' },
        title: { type: 'string' },
        ref: { type: 'string' },
        folder_ref: { type: 'string' },
      },
      required: [],
    },
    handler: async (input) => {
      try {
        return await fabricateSolidHandler(input);
      } catch (err) {
        throw new Error(`${err.message} — manual: get_solid_vocab({ id: 'fabricate' }).`);
      }
    },
  });
}

export { EXECUTORS };

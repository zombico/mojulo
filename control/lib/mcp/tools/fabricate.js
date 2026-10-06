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
import { fabricationPlan, planModules, unplacedModules, unplacedJoints, mintedBom, EXECUTORS } from '@/lib/graph/fabricator/plan';

const NEEDS_KEYS = ['needs', 'host', 'loadN', 'cycles', 'access', 'tags'];

const nextFor = (plan) => {
  const how = [];
  if (plan.executors.includes('frames')) how.push('`frames`: a workbench frames entry (members as boxes), writing each planned `joints` row as a frame joint between the two members it joins; the frame places and counts the fittings');
  if (plan.executors.includes('scad')) how.push('`source`: an OpenSCAD program with each planned `cuts` call translated to the face it enters (cutters run from z = 0 down) and each printed part its own `parts` entry');
  if (!how.length) how.push('`source` or `frames` for the body; every planned part is bought and fitted by hand');
  return `Call fabricate_solid again with the same needs and ${how.join('; or ')}. One executor per row: mint the other's needs as their own row. The bom is what to buy; carry the notices with the object.`;
};

export async function fabricateSolidHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('fabricate_solid needs { needs: [{ function, … }], host?, source? | frames? }.');
  const { needs, host, loadN, cycles, access, tags, source, frames, title, ref, folder_ref: folderRef, ...knobs } = input;
  const plan = fabricationPlan({ needs, host, loadN, cycles, access, tags });
  const hasSource = typeof source === 'string';
  const hasFrames = Array.isArray(frames) && frames.length > 0;
  if (!hasSource && !hasFrames) {
    return { ok: true, phase: 'plan', minted: false, fabrication: { ...plan, modules: planModules(plan) }, next: nextFor(plan) };
  }
  if (hasSource && hasFrames) throw new Error('fabricate_solid: pass `source` (a scad row) or `frames` (a workbench row), not both — one executor per row; mint the other needs as their own row.');
  const executor = hasSource ? 'scad' : 'frames';
  const fabricate = { ...Object.fromEntries(NEEDS_KEYS.filter((k) => input[k] !== undefined).map((k) => [k, input[k]])), executor, plan };
  const elsewhere = plan.needs.filter((n) => n.executor !== executor && n.executor !== 'none').map((n) => `${n.id} (${n.executor})`);
  const warnings = [];
  let out;
  let fabrication;
  if (executor === 'scad') {
    out = await mintScad({ ...knobs, title, ref, folderRef, source, fabricate });
    const unplaced = unplacedModules(plan, source);
    if (unplaced.length) warnings.push(`fabricate: the source never calls ${unplaced.join(', ')} — the plan's cut for it is not placed`);
    fabrication = { version: plan.version, executor, bom: plan.bom.map((l) => ({ ...l, from: 'plan' })), unplaced };
  } else {
    out = await createWorkbenchHandler({ ...knobs, title, ref, folder_ref: folderRef, frames, fabricate });
    const unplaced = unplacedJoints(plan, out.stats.frames);
    if (unplaced.length) warnings.push(`fabricate: no frame joint of type ${unplaced.join(', ')} was made — the plan's joint for it is not placed`);
    fabrication = { version: plan.version, executor, bom: mintedBom(plan, out.stats.frames), unplaced };
  }
  if (elsewhere.length) warnings.push(`fabricate: ${elsewhere.join(', ')} ${elsewhere.length === 1 ? 'is' : 'are'} planned for the other executor — mint ${elsewhere.length === 1 ? 'it' : 'them'} as ${elsewhere.length === 1 ? 'its' : 'their'} own row`);
  return {
    ...out,
    stats: {
      ...out.stats,
      fabrication: { ...fabrication, notices: plan.notices, gaps: plan.gaps, elsewhere },
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
      + 'then + `source` (OpenSCAD) or + `frames` (a wood workbench frame) → the row. Placing parts in a scene is '
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
      required: ['needs'],
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

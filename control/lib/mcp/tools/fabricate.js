/**
 * mint_solid kind 'scad', via 'fabricate' — an object said by what its parts have to DO, solved from standard parts.
 *
 * A key-free two-call handshake, like the polygomer's `packet` door:
 *   1. `spec.needs` and no `source` → the fabrication PLAN (lib/graph/fabricator/plan.js): for each need the strategy
 *      the resolver chose and why, the bill of materials to buy, the `mj_*` cuts and printed parts the source should
 *      place, the kit and principles for anything designed from scratch, and the trademark and licence notices.
 *      Nothing is minted.
 *   2. `spec.needs` and `source` (plus any scad knobs) → minted as an ordinary scad row with the plan frozen beside
 *      the source as `fabricate` (stamped with the fabricator version, like the assembler freezes its sources). Plan
 *      modules the source never calls are listed in `stats.fabrication.unplaced`: advisory, never refused.
 */
import { mintScad } from '@/lib/mcp/tools/scad';
import { fabricationPlan, planModules, unplacedModules } from '@/lib/graph/fabricator/plan';

const NEXT = 'Write the OpenSCAD source: the host part, with each `cuts` call translated to the face it enters (cutters run from z = 0 down) '
  + 'and each printed part placed as its own `parts` entry. Then call mint_solid again with the same `needs` and the `source`. '
  + 'The `bom` is what to buy; carry the `notices` with the object.';

export async function fabricateScadHandler(input) {
  if (!input || typeof input !== 'object') throw new Error("via 'fabricate' needs a spec: { needs: [{ function, … }], source? }.");
  const { needs, host, loadN, cycles, access, tags, source, ...scad } = input;
  const plan = fabricationPlan({ needs, host, loadN, cycles, access, tags });
  if (typeof source !== 'string') {
    return { ok: true, phase: 'plan', minted: false, fabrication: { ...plan, modules: planModules(plan) }, next: NEXT };
  }
  const fabricate = { needs, ...(host !== undefined ? { host } : {}), ...(loadN !== undefined ? { loadN } : {}),
    ...(cycles !== undefined ? { cycles } : {}), ...(access !== undefined ? { access } : {}), ...(tags !== undefined ? { tags } : {}), plan };
  const out = await mintScad({ ...scad, folderRef: scad.folder_ref, source, fabricate });
  const unplaced = unplacedModules(plan, source);
  return {
    ...out,
    stats: {
      ...out.stats,
      fabrication: { version: plan.version, bom: plan.bom, notices: plan.notices, gaps: plan.gaps, unplaced },
      ...(unplaced.length ? { warnings: [...(out.stats.warnings || []), `fabricate: the source never calls ${unplaced.join(', ')} — the plan's cut for it is not placed`] } : {}),
    },
  };
}

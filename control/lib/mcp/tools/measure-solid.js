/**
 * measure_solid — read a number back off a solid (cad-aid.plan.md C1, actioned by
 * continuous-guardrails.plan.md G2).
 *
 * Until now the agent could BUILD a thing but could not ask "how big is it, is it sealed,
 * what would it print at" before export_model — and export_model's answer arrived beside a
 * file. This tool is the same measuring probe, the same closure audit, the same scale
 * precedence, and (when manifold-3d resolves) the same Manifold volume, returned as numbers
 * with no file. The seams are SHARED with export_model (resolvePrintScale, auditStlClosure,
 * printAdvisories) so the two can never disagree: what measure says the print will be IS
 * what export ships.
 *
 * Posture: read-only, advisory. Nothing here refuses a shape; it reports one.
 */

import { registerTool } from '@/lib/mcp/server';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { planWorkbench } from '@/lib/graph/worlds/workbench';
import { facesToStl, printableShells, applyTransform } from '@/lib/graph/scene/scene-stl';
import { unionShells, shellsToInstances } from '@/lib/graph/scene/manifold-union';
import { printAdvisories, resolvePrinter } from '@/lib/graph/scene/print-advisory';
import { printSoup, measurePrintability, measureLine } from '@/lib/graph/scene/print-measure';
import { printProfileFor, auditStlClosure, resolvePrintScale } from '@/lib/mcp/tools/sketch-model-export';

const r1 = (v) => Math.round(v * 10) / 10;
const r3 = (v) => Math.round(v * 1000) / 1000;

export async function measureSolidHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('measure_solid requires { ref }');
  const { ref, scale: scaleInput = null, target_mm: targetMm = null, printer: printerInput = null, volume = true } = input;
  if (!ref || typeof ref !== 'string') throw new Error('`ref` is required (string)');
  if (scaleInput != null && (!Number.isFinite(scaleInput) || scaleInput <= 0)) throw new Error('`scale` must be a positive number if provided');
  if (targetMm != null && (!Number.isFinite(targetMm) || targetMm <= 0)) throw new Error('`target_mm` must be a positive number if provided');
  if (volume !== true && volume !== false) throw new Error('`volume` must be a boolean if provided');
  const printer = resolvePrinter(printerInput);

  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) throw new Error(`No sketch exists at ref '${ref}'`);
  if (!sketch.manifest) throw new Error(`Sketch '${ref}' has no manifest`);

  const { payload, kind } = await resolveWorldScene(sketch);
  const probe = payload ? facesToStl(payload, { scale: 1 }) : null;
  if (!probe) {
    return {
      ok: false, eligible: false, ref, kind: kind ?? null,
      reason: 'This sketch has no printable World geometry to measure — measure_solid covers the kinds export_model covers (workbench/assembler studies, figures, carved solids, worlds). Flat diagrams and charts have no solid to measure.',
    };
  }

  const resolvedKind = kind ?? sketch.manifest.kind;
  const profile = printProfileFor(resolvedKind);
  const units = typeof sketch.manifest.units === 'string' ? sketch.manifest.units : null;
  const { scale, scaleNote } = resolvePrintScale({ payload, profile, units, scaleInput, targetMm });

  // The workbench kind carries a per-monomer readout (planWorkbench's stats.parts) — size, base,
  // top, and an `open` block per part. Other kinds have no monomer table; parts is null.
  let parts = null;
  let warnings;
  let cuts;
  if (sketch.manifest.kind === 'workbench') {
    const { stats } = planWorkbench(sketch.manifest);
    parts = stats.parts;
    warnings = stats.warnings;
    cuts = stats.cuts;   // parts-booleans B2: what each cut consumed and what the grid rounded its edges to
  }

  const closure = profile === 'study'
    ? { audited: false, reason: `'${resolvedKind}' is a surface study — open shells by construction` }
    : auditStlClosure(payload);

  let vol;
  if (!volume) vol = { skipped: true, reason: 'volume: false' };
  else {
    const shells = printableShells(payload);
    const r = shells ? await unionShells(shellsToInstances(shells, applyTransform)) : { skipped: true, reason: 'no printable shells' };
    if (r.faces) {
      vol = { applied: true, volume_units3: r3(r.stats.volume), volume_mm3: Math.round(r.stats.volume * scale * scale * scale * 100) / 100, genus: r.stats.genus, unioned: r.stats.unioned, non_manifold: r.stats.non_manifold };
    } else {
      vol = { applied: false, reason: r.reason, ...(r.stats ? { unioned: r.stats.unioned, non_manifold: r.stats.non_manifold } : {}) };
    }
  }

  const sizeMm = probe.bounds.size.map((v) => r1(v * scale));
  // Rung 2 (text-to-cad-seam T2): overhang / support / sampled walls over the mm soup the
  // export would write — the same numbers export_model stamps beside the file.
  const soup = printSoup(payload, { scale });
  const measure = soup ? measurePrintability({ positions: soup, printer }) : null;
  const advisories = printAdvisories({ manifest: sketch.manifest, scale, sizeMm, printer, measure });
  const closureLine = closure.audited
    ? (closure.closed ? 'closed' : `${closure.holes} open rim${closure.holes === 1 ? '' : 's'}, widest ≈${closure.widest}${units ? ` ${units}` : ' world units'}`)
    : `not audited (${closure.reason})`;
  return {
    ok: true,
    ref,
    kind: resolvedKind,
    print_profile: profile,
    units,
    scale,
    scale_note: scaleNote,
    bounds: { min: probe.bounds.min.map(r3), max: probe.bounds.max.map(r3), size: probe.bounds.size.map(r3) },
    size_mm: sizeMm,
    triangles: probe.triangleCount,
    parts,
    ...(cuts && cuts.length ? { cuts } : {}),
    closure,
    volume: vol,
    printer,
    print_measure: measure,
    print_advisories: advisories,
    ...(warnings && warnings.length ? { warnings } : {}),
    note: `${probe.bounds.size.map(r3).join(' × ')}${units ? ` ${units}` : ' world units'} → prints ${sizeMm.join(' × ')} mm at ×${r3(scale)} (${scaleNote}). Closure: ${closureLine}. `
      + (vol.applied ? `Volume ${vol.volume_mm3} mm³ (Manifold union of ${vol.unioned} shell${vol.unioned === 1 ? '' : 's'}, genus ${vol.genus}). ` : `Volume not measured: ${vol.reason}. `)
      + `${measureLine(measure)[0].toUpperCase()}${measureLine(measure).slice(1)}. `
      + (advisories.length ? `Print advisories (${advisories.length}): ${advisories.map((a) => `${a.kind} — ${a.detail}`).join('; ')}.` : 'Print advisories: none.')
      + ' Advisory throughout — export_model({ ref, format: \'stl\' }) ships the same numbers beside the file.',
  };
}

export function registerMeasureSolidTool() {
  registerTool({
    name: 'measure_solid',
    description:
      'Read numbers off a stored solid without exporting: bounds, printed mm size, '
      + 'per-monomer sizes, closure audit, Manifold '
      + 'volume + genus, measured overhang + sampled walls, print advisories.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'Solid / world sketch ref.' },
        scale: { type: 'number', description: 'World units → mm.' },
        target_mm: { type: 'number', description: 'Fit longest dimension to mm.' },
        printer: { type: 'object', description: '{ process?: fdm|sla|sls|mjf, nozzle_mm?, min_wall_mm?, bed_mm? }.' },
        volume: { type: 'boolean', description: 'Manifold volume/genus (default true).' },
      },
      required: ['ref'],
    },
    handler: measureSolidHandler,
  });
}

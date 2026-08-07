/**
 * POST /api/pose-lab — the interactive pose harness backend. Takes a base biped
 * unit ref + a raw dof object (the figure-vajra / unit-pose posing channels,
 * including the new `wristR`/`wristL`), compiles it into a posed sibling via
 * compileUnitPose, and upserts a single reusable `<baseRef>_poselab` sketch the
 * harness page iframes through /world. One temp sketch, rewritten on every drag —
 * no artifact spam. Used by /pose-lab to dial melee end poses live.
 */
import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { compileUnitPose } from '@/lib/graph/worlds/unit-pose';
import { planAssembler } from '@/lib/graph/worlds/workbench-assembler';

export async function POST(req) {
  try {
    const { baseRef, dof } = await req.json();
    if (!baseRef) return NextResponse.json({ error: 'baseRef required' }, { status: 400 });
    const base = SketchRepository.getByRef(baseRef);
    if (!base?.manifest) return NextResponse.json({ error: `base unit '${baseRef}' not found` }, { status: 404 });
    if (base.manifest.model !== 'biped') return NextResponse.json({ error: `'${baseRef}' is not a biped unit (model:'biped')` }, { status: 400 });

    const { manifest, report } = compileUnitPose(JSON.parse(JSON.stringify(base.manifest)), dof || {});
    manifest.title = `${base.title} — pose-lab`;
    planAssembler(manifest);   // same validation gate as create_assembler

    const ref = `${baseRef}_poselab`;
    if (SketchRepository.getByRef(ref)) SketchRepository.update({ ref, title: manifest.title, manifest });
    else SketchRepository.create({ title: manifest.title, manifest, ref });

    return NextResponse.json({ ref, movedBones: report?.movedBones || [], warnings: report?.warnings || null });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

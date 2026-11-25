/**
 * POST /api/sketches/[ref]/missions — the person's save from the holo table (the briefing's editor,
 * lib/graph/campaign/briefing-page.js): { mission, design, approve? } writes a game's mission as edited, read and
 * compiled first (a fault is a 400 that says it), approved or a draft again (lib/graph/campaign/designer.js
 * applyMissionEdit). The game's next build lays an approved mission's level from it. → { ok, mission, status, laws }
 */
import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { isGameworldKind } from '@/lib/graph/gameworld/gameworld-kind';
import { applyMissionEdit } from '@/lib/graph/campaign/designer';
import { readGameworld } from '@/lib/graph/gameworld/world';
import { gameworldOf } from '@/lib/graph/gameworld/gameworld-kind';

export async function POST(request, { params }) {
  const { ref } = await params;
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) return NextResponse.json({ error: `Sketch '${ref}' not found` }, { status: 404 });
  if (!isGameworldKind(sketch.manifest?.kind)) return NextResponse.json({ error: 'missions are a game\'s (a gameworld)' }, { status: 422 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'the body is JSON: { mission, design, approve? }' }, { status: 400 }); }
  let out;
  try {
    out = applyMissionEdit(sketch.manifest, body || {});
    // (the world as a whole still reads: an approved mission laid as its level among the others)
    readGameworld(gameworldOf(out.manifest));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
  SketchRepository.update({ ref, manifest: out.manifest });
  return NextResponse.json({ ok: true, mission: body.mission, status: out.status, laws: out.laws.map((L) => ({ law: L.law, ok: L.ok, says: L.says })) });
}

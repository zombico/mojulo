/**
 * GET /api/sketches/[ref]/rail — a recipe's rail as JSON (lib/graph/rail): its outcomes and each concern's state, its
 * parts and whether each is fresh, the pages it is looked at in, and everything it and its parts have been exported
 * as (`shipped`: each outcome folder whole, by its subfolders). Read from the recipe, the store and the folders on every
 * call; nothing is stored. A recipe on no rail answers 422.
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { readRail } from '@/lib/graph/rail/index';
import { scanOutcomeTree } from '@/lib/render-bay/outputs-scan';

export async function GET(request, { params }) {
  try {
    const { ref } = await params;
    const sketch = SketchRepository.getByRef(ref);
    if (!sketch) return NextResponse.json({ error: `Sketch '${ref}' not found` }, { status: 404 });
    const row = (r) => {
      const s = SketchRepository.getByRef(r);
      return s ? { kind: s.manifest?.kind ?? s.kind ?? null, manifest: s.manifest } : null;
    };
    const rail = readRail(sketch.manifest, { ref, row });
    if (!rail) {
      return NextResponse.json({ eligible: false, reason: `'${sketch.manifest?.kind}' is on no rail` }, { status: 422 });
    }
    // what it and its parts were taken out as: each outcome folder that holds anything, whole (a building's sheets and
    // schedules, a game's levels and Godot pack, the game a world's run made)
    const owners = [{ ref, role: null }, ...rail.parts.filter((p) => p.state !== 'missing' && p.state !== 'taken').map((p) => ({ ref: p.ref, role: p.role }))];
    const shipped = [];
    for (const o of owners) {
      const tree = await scanOutcomeTree(o.ref);
      if (!tree.total) continue;
      shipped.push({ ...tree, role: o.role, groups: tree.groups.map((g) => ({ ...g, files: g.files.map((f) => ({ ...f, href: `${tree.url}${f.path.split('/').map(encodeURIComponent).join('/')}` })) })) });
    }
    return NextResponse.json({ ref, title: sketch.title || null, updatedAt: sketch.updatedAt ?? null, ...rail, shipped }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

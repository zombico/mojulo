/**
 * design_interior — the interior designer's door (lib/graph/interior/): fit out one room of a house. A room is a section
 * of a house, so the floor plan comes first: name a house row and its room, or describe the room (`section`) and its
 * house section is drafted and minted as a house row of its own first. The row is an ordinary `interior` sketch (minted
 * through create_sketch's world-recipe path, so both doors store the same row); called again with its `ref`, the door
 * revises it in place: a new style, brief or surface replaces the old, pieces merge by id.
 *
 * The reply is the room as decorated: its style, focal point, pieces by id, what the solver refused and why, the gaps,
 * and the review's findings, so the next call can address a piece by its id.
 */
import { registerTool } from '@/lib/mcp/server';
import { createSketchHandler, updateSketchHandler } from '@/lib/mcp/tools/sketch-mint';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { compileInterior } from '@/lib/graph/interior/compile';

const FIELDS = ['house', 'room', 'level', 'style', 'palette', 'brief', 'focal', 'surface', 'pieces', 'view'];

// the operator's pieces over the stored ones, by id: a piece named again is replaced, a new one joins
function mergePieces(stored = [], given = []) {
  const byId = new Map(stored.map((p) => [p.id, p]));
  for (const p of given) if (p && p.id) byId.set(p.id, { ...(byId.get(p.id) || {}), ...p });
  return [...byId.values()];
}

/** The reply's readout: the room as decorated, compiled over its house as stored. */
export function interiorReadout(manifest) {
  const house = typeof manifest.house === 'string' ? SketchRepository.getByRef(manifest.house)?.manifest : manifest.house;
  if (!house) return null;
  const r = compileInterior(manifest, house).readout;
  return {
    house: typeof manifest.house === 'string' ? manifest.house : 'inline',
    room: { tag: r.room.tag, name: r.room.name, size: r.room.size, doors: r.room.doors, windows: r.room.windows.length },
    style: r.style.id + (r.style.accent ? ` + ${r.style.accent}` : '') + (r.style.solved ? ` in palette ${r.style.solved.id} (${r.style.solved.scheme}, ${r.style.solved.key} key)` : ''),
    focal: r.focal,
    // where each piece stands (its centre in mm from the room's corner, and the way it faces), so the next call can
    // move it by id and a reader can tell what moved
    pieces: r.pieces.map((p) => ({ id: p.id, piece: p.piece, size: p.size, at: p.at, facing: p.facing, ...(p.like ? { like: p.like } : {}) })),
    ...(r.resolved.some((x) => x.refused?.length) ? { refused: r.resolved.filter((x) => x.refused?.length).map((x) => ({ fn: x.fn, won: x.strategy, refused: x.refused })) } : {}),
    ...(r.gaps.length ? { gaps: r.gaps } : {}),
    notes: r.notes,
    ...(r.review.findings.length ? { review: r.review.findings.map((f) => f.line) } : {}),
  };
}

export async function designInteriorHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('design_interior requires { title, house, room } or { title, section } — or { ref } to revise');
  const { ref, title, section, folder_ref: folderRef } = input;
  const given = Object.fromEntries(FIELDS.filter((k) => input[k] !== undefined).map((k) => [k, input[k]]));
  let res, manifest;
  if (ref && SketchRepository.getByRef(ref)) {
    // revise in place: what is named replaces what was stored, pieces merge by id
    const stored = SketchRepository.getByRef(ref);
    if (stored.manifest?.kind !== 'interior') throw new Error(`design_interior revises an interior; '${ref}' is a ${stored.manifest?.kind || 'sketch'} (a house is revised with update_sketch)`);
    if (section) throw new Error('design_interior: a section drafts a new house; to move this design to another room, name its `house` and `room`');
    manifest = { ...stored.manifest, ...given, ...(given.pieces ? { pieces: mergePieces(stored.manifest.pieces, given.pieces) } : {}) };
    res = await updateSketchHandler({ ref, manifest, ...(title ? { title } : {}) });
  } else {
    if (!section && (given.house == null || given.room == null)) {
      throw new Error("design_interior fits out a room of a house: name the house's ref and its room ({ house: 'sk_…', room: 'lounge' | '101' | 'L' }), or describe the room ({ section: { room, size, windows, doors } }) and its house is drafted first. Card: get_sketch_vocab({ id: 'interior' }).");
    }
    manifest = { kind: 'interior', ...given, ...(section ? { house: { section } } : {}) };
    res = await createSketchHandler({ title: title || 'interior', manifest, ...(ref ? { ref } : {}), ...(folderRef ? { folder_ref: folderRef } : {}) });
  }
  const row = SketchRepository.getByRef(res.ref);
  let readout = null;
  try { readout = interiorReadout(row.manifest); } catch { /* the row is stored; the readout is advisory */ }
  return {
    ok: true, ref: res.ref, url: res.url, ...(readout ? { interior: readout } : {}),
    next: 'revise with design_interior({ ref, style | brief | surface | pieces: [{ id, … }] }); see it at /world (view: section | house); the house itself is revised with update_sketch on its own ref',
  };
}

export function registerInteriorTools() {
  registerTool({
    name: 'design_interior',
    description:
      "Fit out one room of a house: its jobs solved into furniture at true size, a named style, clearances kept, walls and floor dressed → { ok, ref, url, interior: { room, style, focal, pieces by id, refused, gaps, review } }. Name a house ref and its `room` (tag, name or glyph), or describe it as `section` { room, size, windows, doors } and its house is drafted and minted first. `style`: japandi, mid-century, quiet-luxury, coastal, maximalism… or { name, accent, palette }. Revise: pass `ref` (pieces merge by id). Card: get_sketch_vocab({ id: 'interior' }).",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short title shown in the page header.' },
        house: { type: 'string', description: "The house row's ref (mint_building makes one); its plan is the room's shell." },
        room: { type: 'string', description: "The room: its tag on the house's set ('101'), name ('lounge', 'bedroom'), role or glyph ('L')." },
        level: { type: 'integer', description: 'On a stacked house, the storey (0 the ground).' },
        section: { type: 'object', additionalProperties: true, description: "A room from scratch: { room, size: [w, d], windows: ['S'], doors: [{ wall, to }] }." },
        style: { description: "A style card ('japandi') or { name, accent?, palette? }." },
        palette: { description: "The room's colours solved for what it is (pick_palette's spec; the same spec as its world's gives the room the world's colours): the card's forms, these colours, style.palette's words over them. Left out with no style, one is rolled; false keeps the card's." },
        brief: { type: 'object', additionalProperties: true, description: '{ uses?, tags?, seats?, bed?, tv? }.' },
        focal: { type: 'string', description: "'fireplace', a window's mark, a wall letter or 'view'." },
        surface: { type: 'object', additionalProperties: true, description: '{ walls, N|E|S|W, floor, accentWall, features }.' },
        pieces: { type: 'array', items: { type: 'object', additionalProperties: true }, description: "By id: [{ id: 'conversation.sofa', size?, at?, like?, omit? }]." },
        view: { type: 'string', enum: ['section', 'house'], description: "'section' (the room cut out of its house, the default) or 'house'." },
        ref: { type: 'string', description: 'An interior to revise in place; or, minting, an optional stable ref.' },
        folder_ref: { type: 'string', description: 'Optional `fld_<…>` folder.' },
      },
    },
    handler: designInteriorHandler,
  });
}

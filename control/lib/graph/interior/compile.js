/**
 * interior/compile — an interior recipe over its house → the house as it is built with that room fitted out.
 *
 *   { kind: 'interior', house, room, level?, brief?, style?, focal?, surface?, pieces?, view? }
 *
 * The house is resolved first (its plan is the shell: walls, doors, windows, height), the room read from it
 * (interior/shell.js), its program solved (interior/solve.js), the pieces skinned in the style (interior/skin.js), and
 * the result handed to the house kernel as one opt-in field, `fitOut` (polygonizer/floorplan-structure.js): that room
 * takes the solved pieces in place of its generated furniture, and its own walls and floor. Every other room is the
 * house's, and the house's own row is never written.
 *
 * Pure: the same house and recipe compile to the same fit-out.
 */
import { roomShell } from './shell.js';
import { solveRoom, reviewRoom } from './solve.js';
import { styleCard, styleErrors, skinPiece, skinSurfaces } from './skin.js';
import { PIECES } from './pieces.js';
import { FEATURES, placeFeature, featureFaces, wallPieceFaces } from './wall-faces.js';
import { makeRoom } from './place.js';
import { LAWS_VERSION } from './laws.js';
import { colourHex } from './palette.js';
import { MM_PER_FT } from './units.js';

export const INTERIOR_VERSION = 'interior-v1';
const ft = (mm) => mm / MM_PER_FT;
const r0 = (v) => Math.round(v);

// The wall a decorator dresses apart: behind the bed's head, else behind a sofa whose back is to a wall, else the focal
// wall (interior/skin.js skinSurfaces puts the card's accent wall there).
function accentEdgeOf(solved) {
  const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
  const bed = solved.placed.find((p) => p.id === 'sleep.bed');
  if (bed) return OPP[bed.facing];
  const sofa = solved.placed.find((p) => p.id === 'conversation.sofa');
  if (sofa) {
    const back = OPP[sofa.facing], r = sofa.rect, R = solved.R;
    const gap = { N: r.y0, S: R.D - r.y1, W: r.x0, E: R.W - r.x1 }[back];
    if (gap < 60) return back;
  }
  return solved.focal.edge;
}

/** Why an interior recipe is malformed (before its house is read) → string[]. */
export function interiorErrors(m) {
  const e = [];
  if (!m || typeof m !== 'object') return ['interior: a recipe object'];
  if (!(typeof m.house === 'string' && m.house) && !(m.house && typeof m.house === 'object' && m.house.kind === 'floorplan')) {
    e.push("interior.house: the ref of the house the room is in (a 'floorplan' row; mint_building makes one), or its recipe inline");
  }
  if (m.room == null || m.room === '') e.push("interior.room: the room to fit out — its tag ('101'), name ('lounge'), role ('living') or glyph ('L')");
  e.push(...styleErrors(m.style));
  for (const [i, f] of (m.surface?.features || []).entries()) {
    if (!FEATURES[f?.type]) e.push(`surface.features[${i}].type: one of ${Object.keys(FEATURES).join(', ')}`);
    if (!['N', 'E', 'S', 'W'].includes(f?.wall)) e.push(`surface.features[${i}].wall: 'N' | 'E' | 'S' | 'W'`);
  }
  for (const k of ['walls', 'trim', 'N', 'E', 'S', 'W']) {
    const p = m.surface?.[k]?.paint;
    if (p != null && !colourHex(p)) e.push(`surface.${k}.paint: '${p}' is not a colour`);
  }
  for (const [i, p] of (m.pieces || []).entries()) {
    if (!p || typeof p.id !== 'string') e.push(`pieces[${i}].id: the piece's id, as the readout names it ('conversation.sofa'), or a new id for an extra`);
    else if (p.piece != null && !PIECES[p.piece]) e.push(`pieces[${i}].piece: one of ${Object.keys(PIECES).join(', ')}`);
  }
  return e;
}

/**
 * Compile an interior over its house manifest.
 * → { house: the house manifest with `fitOut`, shell, solved, review, readout }
 */
export function compileInterior(m, house) {
  const errs = interiorErrors(m);
  if (errs.length) throw new Error(`interior:\n- ${errs.join('\n- ')}`);
  const shell = roomShell(house, { room: m.room, level: m.level ?? null });
  const card = styleCard(m.style, house);
  // the room's fixed features first: they are the shell's, and the placer keeps clear of them
  const probe = makeRoom({ ...shell, features: [] });
  const placedFeatures = (m.surface?.features || []).map((f, i) => placeFeature(shell, probe, f, i));
  const features = placedFeatures.filter((f) => !f.refused);
  const solved = solveRoom({ ...shell, features }, { ...(m.brief || {}), focal: m.focal ?? m.brief?.focal, pieces: m.pieces });
  for (const f of placedFeatures) {
    if (f.refused) solved.notes.unshift(`surface.features: ${f.refused}; left out`);
    else if (f.moved) solved.notes.unshift(`${f.id}: moved ${Math.abs(f.moved)} mm along the ${f.wall} wall, clear of its openings`);
  }
  const review = reviewRoom(solved);
  const overrides = new Map((m.pieces || []).filter((p) => p && p.id).map((p) => [p.id, p]));
  const surfaces = skinSurfaces(card, m.surface || {}, accentEdgeOf(solved));
  const paint = surfaces.walls.all.paint;
  const timber = colourHex(card.palette.casework) || '#8a6a48';

  // the pieces as the house's placed items: room-relative fractions of the floor the kernel lets them stand on
  const items = solved.placed.map((p) => {
    const skin = skinPiece(p, card, overrides.get(p.id) || {});
    const P = PIECES[p.piece];
    return {
      name: p.id,
      ...(P.render === 'mesh' ? { type: P.type } : { type: P.type || P.roster, compose: skin.compose }),
      ...(skin.finish ? { finish: skin.finish } : {}),
      at: [p.x / shell.W, p.y / shell.D],
      size: [ft(p.w), ft(p.d)],
      height: ft(Math.max(p.h, 10)),
      facing: p.facing,
    };
  });
  const faces = [
    ...features.flatMap((f) => featureFaces(shell, solved.R, f, { paint, timber })),
    ...solved.wall.map((w) => wallPieceFaces(shell, solved.R, w, { accent: colourHex(card.palette.accent) || '#7c7f5c', frame: colourHex(card.palette.trim) === '#1f1f1f' ? '#1f1f1f' : '#2b2724' }).map((f) => ({ ...f, group: `interior:${w.id}` }))).flat(),
  ];
  const fitOut = {
    level: shell.level,
    rect: { x: shell.rect.x, y: shell.rect.y, w: shell.rect.w, h: shell.rect.h },
    items, walls: surfaces.walls, floor: surfaces.floor,
    ...(faces.length ? { faces } : {}),
  };
  const readout = {
    version: INTERIOR_VERSION, laws: LAWS_VERSION,
    room: {
      tag: shell.card.tag, name: shell.card.name, glyph: shell.card.glyph, storey: shell.level,
      size: [r0(shell.W), r0(shell.D)], height: r0(shell.H), area: Math.round((shell.W * shell.D) / 1e4) / 100,
      doors: shell.openings.filter((o) => o.kind === 'door').map((o) => ({ tag: o.tag, wall: o.wall, to: o.connects.join(', ') || (o.entry ? 'outside' : 'the house') })),
      windows: shell.openings.filter((o) => o.kind === 'window').map((o) => ({ mark: o.tag, wall: o.wall, width: r0(o.b - o.a) })),
      ...(shell.alsoMatched ? { alsoMatched: shell.alsoMatched } : {}),
    },
    style: { id: card.id, label: card.label, line: card.line, ...(card.accent ? { accent: card.accent.id } : {}), palette: card.palette },
    surfaces: { floor: surfaces.floor, walls: surfaces.walls, ...(surfaces.accentEdge ? { accentWall: surfaces.accentEdge } : {}) },
    focal: { wall: solved.focal.edge, why: solved.focal.why },
    pieces: [
      ...solved.placed.map((p, i) => ({ id: p.id, piece: p.piece, fn: p.fn, size: [r0(p.w), r0(p.d), r0(p.h)], at: [r0(p.x), r0(p.y)], facing: p.facing, ...(items[i].compose ? { like: items[i].compose.like } : {}) })),
      ...solved.wall.map((w) => ({ id: w.id, piece: w.piece, fn: w.fn, size: [r0(w.w), 0, r0(w.h)], wall: w.edge, centre: r0(w.centre) })),
    ],
    features: features.map((f) => ({ id: f.id, type: f.type, wall: f.wall, at: r0(f.u) })),
    resolved: solved.resolved, gaps: solved.gaps, notes: solved.notes, review,
  };
  return { house: { ...house, fitOut }, shell, solved, review, readout };
}

/**
 * interior/wall-faces — what hangs on or stands against a room's walls, drawn by the interior: a fixed feature of the
 * room (a fireplace and its chimney breast) and a wall piece (a screen, a picture). The house's placed items stand on
 * the floor; these mount on the wall's face at their true height. Faces are in the plan's frame, feet, z from the
 * room's floor (the house kernel lifts them to the storey: floorplan-structure fitOut.faces).
 */
import { boxFaces } from '../architecture/condo-entrance.js';
import { makeLight } from '../polygonizer/vexar.js';
import { wallFrame, rectInFrame } from './place.js';
import { MM_PER_FT } from './units.js';
import { mixHex } from './palette.js';

// the house's own light (floorplan-structure structurizeFloorplan), so a feature reads as one with its walls
const LIGHT = makeLight({ direction: [0.34, 0.42, -0.84], ambient: 0.54, diffuse: 0.5 });
const ft = (mm) => mm / MM_PER_FT;

/** The wall's face in a wall frame's v (mm): the room's frame stands a little off it (the kernel's pad). */
export function faceV(shell, edge) {
  const t = shell.walls?.[edge]?.thickness ?? 0.42 * MM_PER_FT;
  return -(shell.pad * MM_PER_FT - t / 2);
}

/** A box given in a wall's frame (u along, v off the wall, z up; mm) → plan faces. */
function wallBox(shell, R, edge, u0, u1, v0, v1, z0, z1, tint, opts) {
  const r = rectInFrame(wallFrame(R, edge), u0, u1, v0, v1);
  const [ox, oy] = shell.origin;
  return boxFaces(ox + ft(r.x0), ox + ft(r.x1), oy + ft(r.y0), oy + ft(r.y1), ft(z0), ft(z1), tint, LIGHT, opts);
}

// ── fixed features ──────────────────────────────────────────────────────────────────────────────────────────────

export const FEATURES = Object.freeze({
  fireplace: { label: 'fireplace', w: 1520, depth: 400, hearth: 450, line: 'a chimney breast with its firebox, a stone hearth and a mantel shelf' },
  'chimney-breast': { label: 'chimney breast', w: 1400, depth: 400, hearth: 0, line: 'a projecting breast without a fire' },
  column: { label: 'column', w: 400, depth: 400, hearth: 0, line: 'a square column against the wall' },
});

/**
 * A feature asked of a room → its placement and keep-out in the placer's frame:
 *   { id, type, wall, u, w, depth, rect, keep } (mm)
 * `at` is a fraction along the wall (0.5 the middle) or a length from its left end.
 */
export function placeFeature(shell, R, f, i) {
  const F = FEATURES[f.type];
  const W = wallFrame(R, f.wall);
  const w = Number.isFinite(f.w) ? f.w : F.w;
  const asked = Number.isFinite(f.at) ? (f.at <= 1 ? f.at * W.len : f.at) : W.len / 2;
  // a feature never covers a door or a window: it slides along its wall to the nearest stretch clear of them, or is refused
  const cuts = R.openings.filter((o) => o.wall === f.wall).map((o) => W.span(o.a, o.b));
  const clear = (u) => u - w / 2 >= 0 && u + w / 2 <= W.len && !cuts.some(([a, b]) => Math.min(b, u + w / 2 + 50) > Math.max(a, u - w / 2 - 50));
  let u = null;
  for (let k = 0; k <= W.len / 50 && u == null; k += 1) for (const s of k ? [1, -1] : [1]) if (u == null && clear(asked + s * k * 50)) u = asked + s * k * 50;
  if (u == null) return { refused: `the ${f.type} on the ${f.wall} wall: no stretch ${Math.round(w)} mm clear of its openings` };
  const v0 = faceV(shell, f.wall);
  const rect = rectInFrame(W, u - w / 2, u + w / 2, v0, F.depth + v0);
  const keep = rectInFrame(W, u - w / 2 - 150, u + w / 2 + 150, v0, F.depth + F.hearth + v0 + 150);
  return { id: f.id || `${f.type}-${i + 1}`, type: f.type, wall: f.wall, u, w, depth: F.depth + F.hearth, rect, keep, ...(Math.abs(u - asked) > 1 ? { moved: Math.round(u - asked) } : {}) };
}

/** A feature's faces. `paint` the wall's colour (a chimney breast is the wall, come forward). */
export function featureFaces(shell, R, feat, { paint = '#e8e2d6', timber = '#8a6a48' } = {}) {
  const v0 = faceV(shell, feat.wall), H = shell.H;
  const F = FEATURES[feat.type];
  const u0 = feat.u - feat.w / 2, u1 = feat.u + feat.w / 2;
  const faces = [];
  if (feat.type === 'column') return wallBox(shell, R, feat.wall, u0, u1, v0, v0 + F.depth, 0, H, paint, { top: false });
  faces.push(...wallBox(shell, R, feat.wall, u0, u1, v0, v0 + F.depth, 0, H, paint, { top: false }));
  if (feat.type === 'fireplace') {
    const fw = 900, fh = 750;
    // the firebox: a dark opening set into the breast's face, its surround in stone
    faces.push(...wallBox(shell, R, feat.wall, feat.u - fw / 2 - 150, feat.u + fw / 2 + 150, v0 + F.depth, v0 + F.depth + 20, 0, fh + 150, '#cfc8bb', { top: true }));
    faces.push(...wallBox(shell, R, feat.wall, feat.u - fw / 2, feat.u + fw / 2, v0 + F.depth + 20, v0 + F.depth + 24, 0, fh, '#1d1b19', { top: false }));
    // the hearth, and the mantel shelf
    faces.push(...wallBox(shell, R, feat.wall, u0 - 100, u1 + 100, v0 + F.depth, v0 + F.depth + F.hearth, 0, 40, '#8c867c', { top: true }));
    faces.push(...wallBox(shell, R, feat.wall, u0 - 60, u1 + 60, v0 + F.depth, v0 + F.depth + 180, 1250, 1310, timber, { top: true, bottom: true }));
  }
  return faces;
}

// ── wall pieces ─────────────────────────────────────────────────────────────────────────────────────────────────

/** A wall piece's faces: { piece: 'tv' | 'art', edge, u, w, h, centre (mm off the floor), colour? } */
export function wallPieceFaces(shell, R, p, { accent = '#7c7f5c', frame = '#2b2724' } = {}) {
  const v0 = faceV(shell, p.edge);
  const z0 = p.centre - p.h / 2, z1 = p.centre + p.h / 2;
  const u0 = p.u - p.w / 2, u1 = p.u + p.w / 2;
  if (p.piece === 'tv') {
    return [
      ...wallBox(shell, R, p.edge, u0, u1, v0, v0 + 35, z0, z1, '#1c1d1f', { top: true, bottom: true }),
      ...wallBox(shell, R, p.edge, u0 + 12, u1 - 12, v0 + 35, v0 + 37, z0 + 12, z1 - 12, '#0b0c0e', { top: false }),
    ];
  }
  // a framed picture: the frame, a mat, and the field of colour in it
  const m = Math.min(p.w, p.h) * 0.12;
  return [
    ...wallBox(shell, R, p.edge, u0, u1, v0, v0 + 30, z0, z1, frame, { top: true, bottom: true }),
    ...wallBox(shell, R, p.edge, u0 + 25, u1 - 25, v0 + 30, v0 + 32, z0 + 25, z1 - 25, '#efe9dd', { top: false }),
    ...wallBox(shell, R, p.edge, u0 + m, u1 - m, v0 + 32, v0 + 34, z0 + m, (z0 + z1) / 2, mixHex(accent, '#efe9dd', 0.25), { top: false }),
    ...wallBox(shell, R, p.edge, u0 + m, u1 - m, v0 + 32, v0 + 34, (z0 + z1) / 2, z1 - m, mixHex(accent, '#1f1f1f', 0.35), { top: false }),
  ];
}

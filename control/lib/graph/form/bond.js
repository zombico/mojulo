/**
 * THE BOND AS POLYGONS (the form render, gen-7): a wall's coursing lowered to geometry rather than painted, so each brick
 * stands proud of its mortar and casts its own shadow into the joint under a real sun. Read from the same numbers the
 * paint reads (matte-paint/dressed.js: the brick cut's courses, bricks a course, its half bond, BRICK's joint and mortar
 * depth), so the polygons and the paint agree course for course.
 *
 *   brickBond({ metres, rows, cols }, { width, height }) → { bricks: [{ x0, x1, z0, z1, row, col }], mortar, joint }
 *     a wall `width` × `height` m (x along it, z up from its foot), its face at depth 0: each brick a box from the face
 *     back to `mortar` m, cut where the wall ends; the mortar a plane `mortar` m back of the face
 *   brickFaces(bond) → [{ corners, n, part }]   each brick's face and its four returns (the sides a raking sun lights or
 *     shades), and the mortar plane behind: a wall's polygons, its face toward −y
 *
 * Pure: no dice (the paint's tone is its colour, not its form).
 */
import { BRICK } from '../matte-paint/dressed.js';

const r4 = (v) => Math.round(v * 1e4) / 1e4;

export function brickBond({ metres = 2, rows, cols }, { width, height }) {
  if (!(rows > 0 && cols > 0)) throw new Error('form: a bond is { metres, rows, cols } (the brick cut\'s)');
  if (!(width > 0 && height > 0)) throw new Error('form: a wall is { width, height } in metres');
  const hc = metres / rows, bw = metres / cols, j = BRICK.joint / 2, bricks = [];
  // (the paint's courses run from the face's top down: row 0 at the top, each odd row slid half a brick)
  for (let row = 0; row * hc < height; row++) {
    const zTop = height - row * hc, z1 = r4(zTop - j), z0 = r4(Math.max(0, zTop - hc + j));
    if (z1 <= z0) continue;
    const slide = (row % 2) * bw / 2;
    for (let col = -1; (col * bw) - slide < width; col++) {
      const a = col * bw - slide, x0 = r4(Math.max(0, a + j)), x1 = r4(Math.min(width, a + bw - j));
      if (x1 - x0 > 1e-4) bricks.push({ x0, x1, z0, z1, row, col });
    }
  }
  return { bricks, mortar: BRICK.mortar, joint: BRICK.joint, width, height };
}

export function brickFaces({ bricks, mortar, width, height }) {
  const out = [], d = -mortar;
  // the face is the plane y = 0 looking toward −y; the mortar sits back at y = +mortar
  const P = (x, y, z) => [x, y, z];
  for (const b of bricks) {
    out.push({ corners: [P(b.x0, 0, b.z0), P(b.x1, 0, b.z0), P(b.x1, 0, b.z1), P(b.x0, 0, b.z1)], n: [0, -1, 0], part: 'brick' });
    out.push({ corners: [P(b.x0, 0, b.z1), P(b.x1, 0, b.z1), P(b.x1, -d, b.z1), P(b.x0, -d, b.z1)], n: [0, 0, 1], part: 'brick' });
    out.push({ corners: [P(b.x1, 0, b.z0), P(b.x0, 0, b.z0), P(b.x0, -d, b.z0), P(b.x1, -d, b.z0)], n: [0, 0, -1], part: 'brick' });
    out.push({ corners: [P(b.x0, 0, b.z0), P(b.x0, 0, b.z1), P(b.x0, -d, b.z1), P(b.x0, -d, b.z0)], n: [-1, 0, 0], part: 'brick' });
    out.push({ corners: [P(b.x1, 0, b.z1), P(b.x1, 0, b.z0), P(b.x1, -d, b.z0), P(b.x1, -d, b.z1)], n: [1, 0, 0], part: 'brick' });
  }
  out.push({ corners: [P(0, mortar, 0), P(width, mortar, 0), P(width, mortar, height), P(0, mortar, height)], n: [0, -1, 0], part: 'mortar' });
  return out;
}

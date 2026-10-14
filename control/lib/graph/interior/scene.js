/**
 * interior/scene — an interior on the World page: its house built with the room fitted out (interior/compile.js), the
 * room's own cameras, and the view.
 *
 *   view 'section'  the room cut out of its house: the room, its walls and doors, and a step of each neighbour
 *                   through them, everything above its ceiling and outside the cut left out (the default)
 *   view 'house'    the whole house, the room fitted out in it
 *
 * Cameras are a decorator's shots of the room: the dollhouse three-quarter, the corner at a standing eye looking at the
 * focal wall, the doorway (the first impression), and the plan from overhead.
 */
import { assembleFloorWorldScene, assembleHouseWorldScene, storeyLevels } from '../polygonizer/floorplan-structure.js';
import { compileInterior } from './compile.js';
import { wallFrame } from './place.js';
import { MM_PER_FT } from './units.js';

const SECTION_MARGIN_FT = 4;
const EYE_FT = 5.2;

/** The dollhouse corner to look in from: the one whose two near walls hide the least (the tall pieces against them). */
function dollhouseFrom(c) {
  const { shell, solved } = c;
  const r = shell.rect, z0 = shell.baseZ, H = shell.heightFt, span = Math.max(r.w, r.h);
  const near = 1200;   // a piece this close to a near wall hides under it
  const hidden = (edge) => solved.placed.reduce((a, p) => {
    const g = { N: p.rect.y0, S: solved.R.D - p.rect.y1, W: p.rect.x0, E: solved.R.W - p.rect.x1 }[edge];
    return a + (g < near && p.mount !== 'skin' ? p.h * (p.rect.x1 - p.rect.x0) * (p.rect.y1 - p.rect.y0) : 0);
  }, 0);
  const corners = [['S', 'W'], ['S', 'E'], ['N', 'W'], ['N', 'E']].map(([ns, ew]) => ({ ns, ew, cost: hidden(ns) + hidden(ew) }))
    .sort((a, b) => a.cost - b.cost);
  const { ns, ew } = corners[0];
  const x = ew === 'W' ? r.x - 0.5 * r.w : r.x + r.w + 0.5 * r.w;
  const y = ns === 'S' ? r.y + r.h + 0.6 * r.h : r.y - 0.6 * r.h;
  return [x, y, z0 + H + 1.1 * span];
}

/** The room's shots, in the plan's frame (feet): [{ name, worldFraming }]. */
export function interiorCameras(c) {
  const { shell, solved } = c;
  const r = shell.rect, z0 = shell.baseZ, H = shell.heightFt;
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, span = Math.max(r.w, r.h);
  const toPlan = (x, y) => [shell.origin[0] + x / MM_PER_FT, shell.origin[1] + y / MM_PER_FT];
  // the focal wall's middle, and the far corners facing it
  const F = wallFrame(solved.R, solved.focal.edge);
  const [fx, fy] = toPlan(...F.at(solved.focal.u, 0));
  const [ax, ay] = toPlan(...F.at(F.len * 0.15, F.depth - 700));
  const [bx, by] = toPlan(...F.at(F.len * 0.85, F.depth - 700));
  // the doorway: just inside the room's first door, looking across it
  const door = shell.openings.find((o) => o.kind === 'door');
  const shots = [
    { name: 'dollhouse', worldFraming: { cameraPosition: dollhouseFrom(c), lookAt: [cx, cy, z0 + 1], horizontalFov: 55 } },
    { name: 'corner', worldFraming: { cameraPosition: [ax, ay, z0 + EYE_FT], lookAt: [fx, fy, z0 + 3.4], horizontalFov: 78 } },
    { name: 'corner-2', worldFraming: { cameraPosition: [bx, by, z0 + EYE_FT], lookAt: [fx, fy, z0 + 3.4], horizontalFov: 78 } },
  ];
  if (door) {
    const D = wallFrame(solved.R, door.wall);
    const [u0, u1] = D.span(door.a, door.b);
    const [dx, dy] = toPlan(...D.at((u0 + u1) / 2, 250));
    shots.push({ name: 'doorway', worldFraming: { cameraPosition: [dx, dy, z0 + EYE_FT], lookAt: [cx, cy, z0 + 2.6], horizontalFov: 78 } });
  }
  shots.push({ name: 'plan', worldFraming: { cameraPosition: [cx, cy + 0.02, z0 + H + 1.25 * span], lookAt: [cx, cy, z0], horizontalFov: 58 } });
  return shots;
}

// The faces a section keeps: those that reach into the room's box, widened by a step each way, under its ceiling.
function inSection(f, box) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity;
  for (const c of f.corners) {
    if (c[0] < x0) x0 = c[0]; if (c[0] > x1) x1 = c[0];
    if (c[1] < y0) y0 = c[1]; if (c[1] > y1) y1 = c[1];
    if (c[2] < z0) z0 = c[2];
  }
  return x1 >= box.x0 && x0 <= box.x1 && y1 >= box.y0 && y0 <= box.y1 && z0 <= box.zTop && z0 >= box.zLow;
}

/**
 * The World payload of an interior over its house manifest (resolved by the caller: world-kinds reads the house row).
 * `opts` carries the World's { title, inline, view }.
 */
export function assembleInteriorWorldScene(m, house, opts = {}) {
  const c = compileInterior(m, house);
  const h = c.house;
  const r = c.shell.rect, z0 = c.shell.baseZ;
  const view = opts.view === 'house' || m.view === 'house' ? 'house' : 'section';
  const o = {
    ...h,
    view: 'cutaway', ceilings: true,
    title: opts.title || m.title || 'mojulo interior',
    inline: opts.inline ?? false,
    cameras: interiorCameras(c),
    walk: m.walk === false ? false : { spawn: [r.x + r.w / 2, r.y + r.h / 2], eye: z0 + EYE_FT },
  };
  let scene;
  if (Array.isArray(h.levels) && h.levels.length) scene = assembleHouseWorldScene(h, o);
  else {
    const stack = storeyLevels(h);
    scene = stack ? assembleHouseWorldScene({ ...h, ...stack }, o) : assembleFloorWorldScene(h, o);
  }
  if (view === 'section') {
    // the payload is in the world's frame (floorplan-world.js: world y = −plan y)
    const M = SECTION_MARGIN_FT;
    const box = { x0: r.x - M, x1: r.x + r.w + M, y0: -(r.y + r.h + M), y1: -(r.y - M), zTop: z0 + c.shell.heightFt + 0.25, zLow: z0 - 2 };
    scene = { ...scene, faces: scene.faces.filter((f) => inSection(f, box)) };
    if (scene.itemRefs) scene.itemRefs = scene.itemRefs.filter((ref) => ref.center[0] >= box.x0 && ref.center[0] <= box.x1 && ref.center[1] >= box.y0 && ref.center[1] <= box.y1);
  }
  return scene;
}

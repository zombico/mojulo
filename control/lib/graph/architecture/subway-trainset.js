/**
 * subway-trainset — a reusable, more-accurate subway consist with a laid-out
 * INTERIOR, parked broadside on a track. Replaces the old hand-rolled two-box car.
 *
 * Per car: a body with a CHAMFERED (rounded) roof, end caps, a platform-side skirt,
 * door leaves and a window band — and a real interior: longitudinal BENCH SEATS down
 * both walls, grab poles, a floor, and a lit far wall so the windows read as a lit car.
 *
 * Reveal (operator call): the HERO car has its platform-facing (near) wall OPEN
 * (doll-house), so the whole interior reads; the other cars keep the near wall with
 * its window band cut OUT (open gaps + mullions), so you see the seats THROUGH the
 * windows. Both expose the same interior — the hero car just opens the wall fully.
 *
 * Pure geometry: returns { faces, cars } as the baked {corners, fill, doubleSided}
 * list the World renderers consume, vexar-shaded under the passed scene light.
 */

import { shadeHex } from '../polygonizer/vexar.js';

const DEFAULTS = {
  x0: 14.7, x1: 18.3, yStart: 2, yEnd: 45, carLen: 6.6, gap: 0.5,
  zSkirt: -0.94, zFloor: -0.1, zRoof: 2.4, band: '#2f6fb0',
};

// translucent glazing — `water:true` + an rgba fill renders in the World's translucent pass.
const GLASS = 'rgba(190,217,237,0.38)';
function glassPane(faces, corners) { faces.push({ corners, fill: GLASS, water: true, doubleSided: true }); }

function quad(faces, corners, tint, light, normal, extra) {
  faces.push({ corners, fill: shadeHex(tint, normal, light), doubleSided: true, ...(extra || {}) });
}
function pushBox(faces, x0, x1, y0, y1, z0, z1, tint, light, { top = true, bottom = false } = {}) {
  if (x1 - x0 < 1e-3 || y1 - y0 < 1e-3 || z1 - z0 < 1e-3) return;
  quad(faces, [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], tint, light, [1, 0, 0]);
  quad(faces, [[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], tint, light, [-1, 0, 0]);
  quad(faces, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], tint, light, [0, 1, 0]);
  quad(faces, [[x1, y0, z0], [x0, y0, z0], [x0, y0, z1], [x1, y0, z1]], tint, light, [0, -1, 0]);
  if (top) quad(faces, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], tint, light, [0, 0, 1]);
  if (bottom) quad(faces, [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], tint, light, [0, 0, -1]);
}

/** The interior fit-out: benches down both long walls, grab poles, floor. */
function carInterior(faces, x0, x1, y0, y1, zFloor, shoulder, light, C) {
  const benchD = 0.5, baseTop = zFloor + 0.42, seatTop = zFloor + 0.5, backTop = zFloor + 0.95;
  quad(faces, [[x0, y0, zFloor], [x1, y0, zFloor], [x1, y1, zFloor], [x0, y1, zFloor]], C.floor, light, [0, 0, 1]); // floor
  for (const near of [true, false]) {
    const bx0 = near ? x0 : x1 - benchD, bx1 = near ? x0 + benchD : x1;
    pushBox(faces, bx0, bx1, y0 + 0.4, y1 - 0.4, zFloor, baseTop, C.seatBase, light);            // bench base
    pushBox(faces, bx0, bx1, y0 + 0.4, y1 - 0.4, baseTop, seatTop, C.seat, light);               // cushion
    const wx0 = near ? x0 : x1 - 0.12, wx1 = near ? x0 + 0.12 : x1;
    pushBox(faces, wx0, wx1, y0 + 0.4, y1 - 0.4, seatTop, backTop, C.seat, light);               // backrest
  }
  const cxm = (x0 + x1) / 2, len = y1 - y0;
  for (const py of [y0 + len * 0.28, y0 + len * 0.72]) {
    pushBox(faces, cxm - 0.04, cxm + 0.04, py - 0.04, py + 0.04, zFloor, shoulder, C.pole, light); // grab pole
  }
}

/** One car: chamfered-roof body, ends, skirt, far wall (lit), near wall (open hero /
 *  glazed), doors, band, and the interior. */
function buildCar(faces, p, mode, light, C) {
  const { x0, x1, y0, y1, zSkirt, zFloor, zRoof } = p;
  const shoulder = zRoof - 0.3, ch = 0.28;                 // shoulder + roof chamfer inset
  const winBot = zFloor + 1.05, winTop = zFloor + 1.95;
  const open = mode === 'hero';

  // SKIRT under the floor (slightly inset)
  pushBox(faces, x0 + 0.05, x1 - 0.05, y0, y1, zSkirt, zFloor, C.skirt, light);
  // FAR (+x) wall, with a lit interior band at window height (reads as a lit car through the near windows)
  quad(faces, [[x1, y0, zFloor], [x1, y1, zFloor], [x1, y1, shoulder], [x1, y0, shoulder]], C.body, light, [1, 0, 0]);
  quad(faces, [[x1 - 0.02, y0 + 0.3, winBot + 0.15], [x1 - 0.02, y1 - 0.3, winBot + 0.15], [x1 - 0.02, y1 - 0.3, winTop - 0.05], [x1 - 0.02, y0 + 0.3, winTop - 0.05]], C.winLit, light, [-1, 0, 0]);
  // END caps
  for (const [ey, n] of [[y0, [0, -1, 0]], [y1, [0, 1, 0]]]) {
    quad(faces, [[x0, ey, zFloor], [x1, ey, zFloor], [x1, ey, shoulder], [x0, ey, shoulder]], p.cab && (ey === y0 || ey === y1) ? C.cab : C.body, light, n);
  }
  // ROOF — two chamfers + a flat top (the rounded read)
  quad(faces, [[x0, y0, shoulder], [x0, y1, shoulder], [x0 + ch, y1, zRoof], [x0 + ch, y0, zRoof]], C.roof, light, [-0.7, 0, 0.7]);
  quad(faces, [[x1, y0, shoulder], [x1, y1, shoulder], [x1 - ch, y1, zRoof], [x1 - ch, y0, zRoof]], C.roof, light, [0.7, 0, 0.7]);
  quad(faces, [[x0 + ch, y0, zRoof], [x1 - ch, y0, zRoof], [x1 - ch, y1, zRoof], [x0 + ch, y1, zRoof]], C.roof, light, [0, 0, 1]);

  // NEAR (−x, platform-facing) wall — OPEN for the hero car; glazed (window gaps) otherwise.
  if (!open) {
    quad(faces, [[x0, y0, zFloor], [x0, y1, zFloor], [x0, y1, winBot], [x0, y0, winBot]], C.body, light, [-1, 0, 0]);   // sill
    quad(faces, [[x0, y0, winTop], [x0, y1, winTop], [x0, y1, shoulder], [x0, y0, shoulder]], C.body, light, [-1, 0, 0]); // header
    quad(faces, [[x0 - 0.01, y0 + 0.2, winBot - 0.45], [x0 - 0.01, y1 - 0.2, winBot - 0.45], [x0 - 0.01, y1 - 0.2, winBot - 0.2], [x0 - 0.01, y0 + 0.2, winBot - 0.2]], C.band, light, [-1, 0, 0]); // colour band
    const n = 4;                                                       // window mullions
    for (let k = 1; k < n; k += 1) {
      const my = y0 + 0.3 + (k * (y1 - y0 - 0.6)) / n;
      pushBox(faces, x0 - 0.04, x0, my - 0.05, my + 0.05, winBot, winTop, C.winFrame, light);
    }
    // GLAZING — a translucent pane across the window band (see the lit interior through it)
    glassPane(faces, [[x0, y0 + 0.2, winBot], [x0, y1 - 0.2, winBot], [x0, y1 - 0.2, winTop], [x0, y0 + 0.2, winTop]]);
  }
  // DOOR leaves on the platform side (two doorways per car), a centre seam + a glass window
  for (const dc of [y0 + (y1 - y0) * 0.3, y0 + (y1 - y0) * 0.7]) {
    for (const s of [-1, 1]) {
      quad(faces, [[x0 - 0.02, dc + s * 0.02, zFloor], [x0 - 0.02, dc + s * 0.58, zFloor], [x0 - 0.02, dc + s * 0.58, winTop + 0.05], [x0 - 0.02, dc + s * 0.02, winTop + 0.05]], C.door, light, [-1, 0, 0]);
    }
    glassPane(faces, [[x0 - 0.03, dc - 0.5, winBot], [x0 - 0.03, dc + 0.5, winBot], [x0 - 0.03, dc + 0.5, winTop - 0.05], [x0 - 0.03, dc - 0.5, winTop - 0.05]]);
  }
  // INTERIOR
  carInterior(faces, x0, x1, y0, y1, zFloor, shoulder, light, C);
}

/**
 * Build a multi-car consist on a track.
 * @param spec { x0, x1, yStart, yEnd, carLen, gap, zSkirt, zFloor, zRoof, band, light, heroIndex }
 * @returns { faces, cars }
 */
export function buildTrainset(spec = {}) {
  const o = { ...DEFAULTS, ...spec };
  const light = o.light;
  const C = {
    body: '#aeb6bd', skirt: '#3a3e44', roof: '#c6ccd1', door: '#cdd5db', band: o.band,
    seat: '#3f6f9c', seatBase: '#2a3138', pole: '#c8ccd0', floor: '#6b7077',
    winLit: '#aac6e4', bellows: '#26292e', cab: '#1b2026', winFrame: '#828a91',
  };
  const faces = [];
  const starts = [];
  for (let y = o.yStart; y + o.carLen <= o.yEnd; y += o.carLen + o.gap) starts.push(y);
  const hero = Number.isFinite(o.heroIndex) ? ((o.heroIndex % starts.length) + starts.length) % starts.length : Math.floor(starts.length / 2);
  starts.forEach((y, i) => buildCar(
    faces,
    { x0: o.x0, x1: o.x1, y0: y, y1: y + o.carLen, zSkirt: o.zSkirt, zFloor: o.zFloor, zRoof: o.zRoof, cab: i === 0 || i === starts.length - 1 },
    i === hero ? 'hero' : 'glazed', light, C,
  ));
  // gangway bellows between cars
  for (let i = 0; i < starts.length - 1; i += 1) {
    pushBox(faces, o.x0 + 0.35, o.x1 - 0.35, starts[i] + o.carLen, starts[i + 1], o.zFloor + 0.2, o.zRoof - 0.55, C.bellows, light);
  }
  return { faces, cars: starts.length, hero };
}

/**
 * subway-station — an INTERIOR transit-hall mint, the indoor sibling of the
 * exterior transportation-hub modes.
 *
 * Fractal-generation philosophy like its siblings: the operator passes a tiny
 * RECIPE (seed + a few knobs); the substrate stores ONLY the recipe (manifest
 * `kind: 'subway-station'`) and regenerates the whole hall deterministically on
 * render. Unlike the apron hub modes (which look DOWN at a flat ground), this is
 * an INTERIOR shot: the camera sits just outside a wide enclosed volume and the
 * near walls/ceiling backface-cull away (doll-house cutaway), so we look INTO the
 * hall. Geometry is emitted straight as `faces` through emitPreserve3dScene (the
 * same emitter the room/city renderers use); shading is baked per-face with vexar
 * litFactor under a soft, low-ambient INTERIOR light (no sun/moon).
 *
 * Layout: a wide ISLAND platform with a track trough on each side, columns
 * marching down the platform edges, a glowing ceiling-fixture strip, tunnel
 * portals in the far end wall, tiled side walls + a station-name frieze, and a
 * multi-car train parked broadside on the far track. Camera is a THREE-QUARTER
 * establishing view across the hall.
 *
 * Promoted from lite-template/integration/0616/spike-output/subway-station/.
 */

import { emitPreserve3dScene } from './scene-css3d.js';
import { makeLight, litFactor, scaleHex } from './polygonizer/vexar.js';

// ── seeded RNG (xorshift; whole hall is a pure function of the seed) ────────────
function makeRng(seed) {
  let t = (Number.isFinite(+seed) ? Math.trunc(+seed) : 1) >>> 0 || 1;
  return () => {
    t ^= t << 13; t ^= t >>> 17; t ^= t << 5; t >>>= 0;
    return t / 4294967296;
  };
}

// ── small vector + quad helpers ────────────────────────────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const centroid = (c) => [(c[0][0] + c[1][0] + c[2][0] + c[3][0]) / 4, (c[0][1] + c[1][1] + c[2][1] + c[3][1]) / 4, (c[0][2] + c[1][2] + c[2][2] + c[3][2]) / 4];
const quadNormal = (c) => norm(cross(sub(c[1], c[0]), sub(c[3], c[0])));

// ── line colour themes (band / frieze / roundel) ───────────────────────────────
const LINE_THEMES = {
  blue: { band: '#2f6fb0', frieze: '#244a6b', roundel: '#d2362f', pylon: '#1c5fa8' },
  red: { band: '#c0392b', frieze: '#5a2420', roundel: '#f0c419', pylon: '#a93226' },
  green: { band: '#2e8b57', frieze: '#1f4d36', roundel: '#e0e0e0', pylon: '#27704a' },
  orange: { band: '#d97a2b', frieze: '#5e3a17', roundel: '#1c5fa8', pylon: '#c46a1f' },
};
const LINE_NAMES = Object.keys(LINE_THEMES);

export const SUBWAY_LINES = LINE_NAMES;

/**
 * Build the subway-station scene: faces + cameras + viewBox + a stat readout.
 * @param {object} recipe { seed, line, density, cars, title }
 * @param {object} [opts]
 * @param {boolean} [opts.forWorld=false] — adapt for the traversable three.js
 *   /world realizer (flat-shaded, MeshBasic DoubleSide): the CSS backface cutaway
 *   doesn't survive there, so instead we PHYSICALLY OMIT the reader-facing (near)
 *   wall — an open-fronted stage set, the "room in 3D" convention. Also drops the
 *   rgba light-pool decals (no hex → they'd grey-patch in WebGL).
 */
export function planSubwayStation(recipe = {}, { forWorld = false } = {}) {
  const rng = makeRng(recipe.seed);
  const line = LINE_THEMES[recipe.line] || LINE_THEMES[LINE_NAMES[Math.floor(rng() * LINE_NAMES.length)]];
  const density = Number.isFinite(+recipe.density) ? Math.max(0.2, Math.min(1, +recipe.density)) : 0.6;

  const L = makeLight({ direction: [0.18, 0.32, -0.93], ambient: 0.62, diffuse: 0.4 });
  const C = {
    platform: '#b7b0a3', tactile: '#d8a52a',
    trough: '#33343a', ballast: '#3c3c40', rail: '#9a958a', thirdRail: '#5c5650',
    wall: '#cdd3d4', wallBase: '#9aa1a4', ceiling: '#787c82', ceilBeam: '#6a6e74',
    column: '#8b9198', columnCap: '#9aa0a7',
    trainBody: '#aeb6bd', trainBand: line.band, trainSkirt: '#3a3e44', trainWin: '#1d2228',
    winLit: '#cfe6ff', fixture: '#ffe9bf', portal: '#0a0c10', endWall: '#c2c8ca',
    frieze: line.frieze, roundel: line.roundel,
    bench: '#6b7178', benchSeat: '#8a6f53', bin: '#41454b', pylon: '#33373d', pylonSign: line.pylon,
  };

  const HALL = { x0: 1, x1: 19, y0: 0, y1: 46, zFloor: -1.1, zPlat: 0, zCeil: 5.0 };
  const CENTER = [(HALL.x0 + HALL.x1) / 2, (HALL.y0 + HALL.y1) / 2, 1.8];
  const faces = [];

  // shell quad: single-sided, wound so its front faces the interior CENTER → near
  // walls/ceiling backface-cull, giving the cutaway.
  function shell(corners, tint) {
    let c = corners, n = quadNormal(c);
    if (dot(n, sub(CENTER, centroid(c))) < 0) { c = [c[0], c[3], c[2], c[1]]; n = quadNormal(c); }
    faces.push({ corners: c, fill: scaleHex(tint, litFactor(n, L)) });
  }
  function tileCss(baseHex, lit, { cols = 30, rows = 6, grout = '#7e868c' } = {}) {
    const base = scaleHex(baseHex, lit), g = scaleHex(grout, lit * 0.82);
    return `repeating-linear-gradient(to right, ${g} 0 1.2px, transparent 1.2px calc(100%/${cols})),`
      + `repeating-linear-gradient(to bottom, ${g} 0 1.2px, transparent 1.2px calc(100%/${rows})),${base}`;
  }
  function shellTiled(corners, tint, tileOpts) {
    let c = corners, n = quadNormal(c);
    if (dot(n, sub(CENTER, centroid(c))) < 0) { c = [c[0], c[3], c[2], c[1]]; n = quadNormal(c); }
    faces.push({ corners: c, bg: tileCss(tint, litFactor(n, L), tileOpts) });
  }
  function shellBg(corners, css) {
    let c = corners;
    if (dot(quadNormal(c), sub(CENTER, centroid(c))) < 0) c = [c[0], c[3], c[2], c[1]];
    faces.push({ corners: c, bg: css });
  }
  function signPanelX(x, y0, y1, z0, z1, fill, extra = {}) {
    faces.push({ corners: [[x, y1, z1], [x, y0, z1], [x, y0, z0], [x, y1, z0]], fill, doubleSided: true, ...extra });
  }
  function panel(x0, x1, y0, y1, z, tint, extra = {}) {
    faces.push({ corners: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], fill: scaleHex(tint, litFactor([0, 0, 1], L)), doubleSided: true, ...extra });
  }
  function box(x0, x1, y0, y1, z0, z1, tint, opts = {}) {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
    const quads = [
      [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]],
      [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]],
      [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]],
      [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]],
      [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]],
    ];
    for (const q of quads) {
      let n = quadNormal(q);
      if (dot(n, sub(centroid(q), [cx, cy, cz])) < 0) n = [-n[0], -n[1], -n[2]];
      const top = q[0][2] === z1 && q[1][2] === z1 && q[2][2] === z1;
      faces.push({ corners: q, fill: scaleHex(top ? scaleHex(tint, 1.06) : tint, litFactor(n, L)), doubleSided: true, ...(opts.face || {}) });
    }
  }
  function pool(cx, cy, r, z, rgb = '255,236,196', peak = 0.5) {
    faces.push({ corners: [[cx - r, cy - r, z], [cx + r, cy - r, z], [cx + r, cy + r, z], [cx - r, cy + r, z]], bg: `radial-gradient(circle, rgba(${rgb},${peak}) 0%, rgba(${rgb},0) 70%)`, doubleSided: true });
  }
  function figure(x, y, clothes = '#3a4654', skin = '#caa07e') {
    box(x - 0.18, x + 0.18, y - 0.12, y + 0.12, 0, 0.85, '#2a2f38');
    box(x - 0.22, x + 0.22, y - 0.15, y + 0.15, 0.85, 1.5, clothes);
    box(x - 0.12, x + 0.12, y - 0.1, y + 0.1, 1.5, 1.74, skin);
  }

  // SHELL: trough beds, ceiling, tiled side walls, far end wall + tunnel portals
  shell([[HALL.x0, HALL.y0, HALL.zFloor], [6, HALL.y0, HALL.zFloor], [6, HALL.y1, HALL.zFloor], [HALL.x0, HALL.y1, HALL.zFloor]], C.trough);
  shell([[14, HALL.y0, HALL.zFloor], [HALL.x1, HALL.y0, HALL.zFloor], [HALL.x1, HALL.y1, HALL.zFloor], [14, HALL.y1, HALL.zFloor]], C.trough);
  shell([[HALL.x0, HALL.y0, HALL.zCeil], [HALL.x1, HALL.y0, HALL.zCeil], [HALL.x1, HALL.y1, HALL.zCeil], [HALL.x0, HALL.y1, HALL.zCeil]], C.ceiling);
  for (const wx of [HALL.x0, HALL.x1]) {
    // forWorld: omit the reader-facing (near, x0) wall so the WebGL stage set opens
    // toward the camera (DoubleSide can't cull it the way the CSS scene does).
    if (forWorld && wx === HALL.x0) continue;
    shell([[wx, HALL.y0, HALL.zFloor], [wx, HALL.y1, HALL.zFloor], [wx, HALL.y1, 1.4], [wx, HALL.y0, 1.4]], C.wallBase);
    shellTiled([[wx, HALL.y0, 1.4], [wx, HALL.y1, 1.4], [wx, HALL.y1, HALL.zCeil], [wx, HALL.y0, HALL.zCeil]], C.wall, { cols: 30, rows: 5 });
  }
  // station-name frieze high on the far (right) wall, above the train roof
  {
    const inset = HALL.x1 - 0.02;
    shell([[HALL.x1, HALL.y0, 3.15], [HALL.x1, HALL.y1, 3.15], [HALL.x1, HALL.y1, 3.85], [HALL.x1, HALL.y0, 3.85]], C.frieze);
    for (let y = 5; y <= HALL.y1 - 3; y += 7) {
      shellBg([[inset, y + 1.0, 3.75], [inset, y - 1.0, 3.75], [inset, y - 1.0, 3.25], [inset, y + 1.0, 3.25]], `radial-gradient(circle, ${C.roundel} 0 38%, #f4f7f8 39% 46%, transparent 47%)`);
    }
  }
  shell([[HALL.x0, HALL.y1, HALL.zFloor], [HALL.x1, HALL.y1, HALL.zFloor], [HALL.x1, HALL.y1, HALL.zCeil], [HALL.x0, HALL.y1, HALL.zCeil]], C.endWall);
  for (const [px0, px1] of [[1.6, 5.4], [14.6, 18.4]]) {
    faces.push({ corners: [[px0, HALL.y1 - 0.02, HALL.zFloor], [px1, HALL.y1 - 0.02, HALL.zFloor], [px1, HALL.y1 - 0.02, 2.7], [px0, HALL.y1 - 0.02, 2.7]], fill: C.portal, doubleSided: true });
  }

  // PLATFORM: island slab + walking surface + tactile edges
  box(6, 14, HALL.y0, HALL.y1, HALL.zFloor, HALL.zPlat, C.platform);
  panel(6, 14, HALL.y0, HALL.y1, HALL.zPlat + 0.001, C.platform);
  panel(6, 6.4, HALL.y0, HALL.y1, HALL.zPlat + 0.02, C.tactile);
  panel(13.6, 14, HALL.y0, HALL.y1, HALL.zPlat + 0.02, C.tactile);

  // TRACKS: ballast + rails + third rail in each trough
  for (const [tx0, tx1, plate] of [[1, 6, 6], [14, 19, 14]]) {
    const mid = (tx0 + tx1) / 2;
    panel(mid - 1.6, mid + 1.6, HALL.y0, HALL.y1, HALL.zFloor + 0.04, C.ballast);
    for (const rx of [mid - 0.55, mid + 0.55]) box(rx - 0.06, rx + 0.06, HALL.y0, HALL.y1, HALL.zFloor + 0.04, HALL.zFloor + 0.16, C.rail);
    const side = plate === 6 ? plate - 0.45 : plate + 0.45;
    box(side - 0.08, side + 0.08, HALL.y0, HALL.y1, HALL.zFloor + 0.04, HALL.zFloor + 0.34, C.thirdRail);
  }

  // COLUMNS: two rows down the platform edges, with capitals
  let columns = 0;
  for (const cxc of [6.7, 13.3]) {
    for (let y = 4; y <= HALL.y1 - 2; y += 5) {
      box(cxc - 0.35, cxc + 0.35, y - 0.35, y + 0.35, HALL.zPlat, HALL.zCeil - 0.35, C.column);
      box(cxc - 0.5, cxc + 0.5, y - 0.5, y + 0.5, HALL.zCeil - 0.35, HALL.zCeil, C.columnCap);
      columns++;
    }
  }

  // CEILING fixtures: a glowing strip down the platform centre
  for (let y = 3; y <= HALL.y1 - 2; y += 6) {
    faces.push({ corners: [[9, y - 0.7, HALL.zCeil - 0.03], [11, y - 0.7, HALL.zCeil - 0.03], [11, y + 0.7, HALL.zCeil - 0.03], [9, y + 0.7, HALL.zCeil - 0.03]], fill: C.fixture, doubleSided: true, glow: '0 0 26px 8px rgba(255,244,214,0.5)' });
  }

  // TRAIN: a multi-car consist parked broadside on the FAR (right) track
  const carLen = 6.6, gap = 0.5, bodyX0 = 14.7, bodyX1 = 18.3, zSkirt = HALL.zFloor + 0.16, zFloorCar = -0.1, zRoof = 2.4;
  let cars = 0;
  for (let y = 2; y + carLen <= HALL.y1 - 1; y += carLen + gap) {
    box(bodyX0, bodyX1, y, y + carLen, zSkirt, zFloorCar, C.trainSkirt);
    box(bodyX0, bodyX1, y, y + carLen, zFloorCar, zRoof, C.trainBody);
    const sx = bodyX0 - 0.02;
    faces.push({ corners: [[sx, y + 0.2, 1.25], [sx, y + carLen - 0.2, 1.25], [sx, y + carLen - 0.2, 1.95], [sx, y + 0.2, 1.95]], fill: C.trainWin, doubleSided: true });
    faces.push({ corners: [[sx, y + 0.2, 0.55], [sx, y + carLen - 0.2, 0.55], [sx, y + carLen - 0.2, 0.85], [sx, y + 0.2, 0.85]], fill: C.trainBand, doubleSided: true });
    for (let k = 0; k < 4; k++) {
      const wy = y + 0.6 + k * (carLen - 1.2) / 4;
      faces.push({ corners: [[sx - 0.01, wy, 1.32], [sx - 0.01, wy + 0.9, 1.32], [sx - 0.01, wy + 0.9, 1.88], [sx - 0.01, wy, 1.88]], fill: C.winLit, doubleSided: true, glow: '0 0 10px 2px rgba(207,230,255,0.45)' });
    }
    cars++;
  }

  // LIGHT POOLS: warm decals on platform + train roof under each fixture (CSS-only
  // atmosphere — skipped in the WebGL world where rgba gradients can't carry).
  if (!forWorld) {
    for (let y = 3; y <= HALL.y1 - 2; y += 6) {
      pool(10, y, 2.6, HALL.zPlat + 0.05, '255,236,196', 0.5);
      pool(16.5, y, 1.7, zRoof + 0.02, '255,236,196', 0.42);
    }
  }

  // PLATFORM LIFE: benches, pylons, bins, hanging signs, figures
  for (const y of [8, 20, 32]) {
    box(9.3, 10.7, y, y + 1.5, 0.42, 0.52, C.benchSeat);
    box(9.9, 10.1, y, y + 1.5, 0.52, 0.96, C.bench);
    for (const lx of [9.4, 10.5]) for (const ly of [y + 0.1, y + 1.3]) box(lx - 0.05, lx + 0.05, ly - 0.05, ly + 0.05, 0, 0.42, C.bench);
  }
  for (const y of [13, 29]) {
    box(9.85, 10.15, y - 0.15, y + 0.15, 0, 2.5, C.pylon);
    signPanelX(9.8, y - 0.7, y + 0.7, 1.95, 2.6, C.pylonSign, { glow: '0 0 8px 1px rgba(60,140,230,0.35)' });
  }
  for (const [bx, by] of [[7.5, 6], [12.5, 18], [7.5, 34]]) box(bx - 0.22, bx + 0.22, by - 0.22, by + 0.22, 0, 0.72, C.bin);
  for (const y of [10, 26]) {
    box(9.9, 10.1, y - 0.05, y + 0.05, 3.9, HALL.zCeil, C.pylon);
    signPanelX(8.6, y - 1.2, y + 1.2, 3.2, 3.85, scaleHex(C.frieze, 1.0), { glow: '0 0 10px 2px rgba(40,90,140,0.4)' });
    faces.push({ corners: [[8.59, y + 1.0, 3.7], [8.59, y - 1.0, 3.7], [8.59, y - 1.0, 3.35], [8.59, y + 1.0, 3.35]], bg: `radial-gradient(circle, ${C.roundel} 0 40%, #eef3f4 41% 48%, transparent 49%)`, doubleSided: true });
  }
  // figures — count scales with density; seeded scatter + clothes
  const clothesPool = ['#7a3b3b', '#34506a', '#3f4a3a', '#5a4a63', '#444b52', '#6b5230', '#2f5d52'];
  let figures = 0;
  const nFig = Math.round(3 + density * 6);
  for (let i = 0; i < nFig; i++) {
    const onFarEdge = rng() < 0.5;
    const fx = onFarEdge ? 12.4 + rng() * 0.9 : 7.4 + rng() * 5.0;
    const fy = 4 + rng() * (HALL.y1 - 8);
    figure(fx, fy, clothesPool[Math.floor(rng() * clothesPool.length)]);
    figures++;
  }

  const cameras = [
    { name: '3q-across', worldFraming: { cameraPosition: [-6, 9, 4.4], lookAt: [12, 15, 0.7], horizontalFov: 66 } },
    { name: '3q-across-high', worldFraming: { cameraPosition: [-7, 6, 6.2], lookAt: [12, 17, 0.2], horizontalFov: 62 } },
  ];

  return {
    faces, cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1200, height: 760 },
    stats: { faces: faces.length, columns, cars, figures, line: recipe.line || 'seeded' },
  };
}

/** Convenience: subway-station recipe → self-contained interior scene HTML. */
export function renderSubwayStationToHtml(recipe = {}) {
  const { faces, cameras, viewBox } = planSubwayStation(recipe);
  return emitPreserve3dScene({
    faces, cameras, viewBox, unitScale: 30,
    title: recipe.title || 'mojulo subway station',
    bg: '#0c0e12',
  });
}

/**
 * The traversable-world payload: an OPEN-FRONTED stage set (reader-facing wall
 * omitted) for the three.js /world realizer (emitThreeWorld). Shape matches the
 * city/hub assemble* seams: { faces, cameras, viewBox, title, bg }.
 */
export function assembleSubwayStationScene(recipe = {}) {
  const { faces, cameras, viewBox } = planSubwayStation(recipe, { forWorld: true });
  return {
    faces, cameras, viewBox,
    title: recipe.title || 'mojulo subway station',
    bg: '#0c0e12',
  };
}

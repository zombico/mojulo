/**
 * THE TRENCH — a space map's other ground: a battle station's surface, a plain of machinery out to the stars, with a
 * trench cut down the field's length and an exhaust port at its end. Flown down at full throttle a craft's width off
 * the walls, its turrets firing from the rims, the port shot to win.
 *
 *   surface   a plate at z = 0 past the reach's edge, greebled where it is flown over: plain boxes (city.js's lit unit
 *             box, instanced, a few numbers each) in the field's band, as a metro's massing reads from the air
 *   trench    TRENCH.w wide and TRENCH.d deep along the field's y axis, from a run-in before the field to its far edge; its
 *             walls and floor plain and clean (nothing in the channel to hit but the walls themselves)
 *   port      the target: a small box on the floor at the trench's end, TRENCH.port m across
 *   turrets   along both rims every TRENCH.turretS s of the craft's cruise, alternating sides
 *   ground    a roof grid (city.js packRoofs) the page and the autopilot both stand on: 0 on the plate, the greebles'
 *             tops over it, -d in the trench; in space a touchdown is a crash, so the walls are what a craft can hit
 *   the run   the start at the trench's mouth, down in it, heading along it at cruise; waypoints down its middle
 *             (`line`) for the autopilot's proof that it can be flown
 *
 *   trenchField(map, { seed? }) → field (groundAt, topAt, roofs, faces, repeats, start, line, port, turrets, report)
 *
 * Every size is in the craft's own terms (its turn circle, its cruise), so a jet's trench is wider than a fighter's.
 * Pure, deterministic.
 */
import { unitBox, packRoofs } from './city.js';
import { gnoise } from '../polygonizer/landform.js';

/** The trench: its width and depth (m, at least; in the craft's size), the port's size, the turrets' spacing (s of
 *  cruise), the greebles' share of the surface and their height (m), the roof grid's cell (m), the band either side of
 *  the trench the fine greebles fill (m) and the fine and coarse greebles' lattice (m). */
/** The run-in before the field (turn circles of the craft's) the trench opens with. */
export const RUN_IN = 4;
export const TRENCH = Object.freeze({ w: 60, d: 50, port: 6, turretS: 4, greeble: 0.35, tall: [3, 22], cell: 10, band: 500, fine: 24, coarse: 90 });
const SUN = [0.45, -0.35, 0.82];
const PLATE = { top: '#5b6068', wall: '#474b52', floor: '#3a3d43' };

const r2 = (v) => Math.round(v * 100) / 100;
const shadeHex = (hex, k) => '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * k))).toString(16).padStart(2, '0')).join('');
const lit = (n) => { const L = Math.hypot(...SUN); return 0.5 + 0.5 * Math.max(0, (n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2]) / L); };
const quad = (c, fill, n) => ({ corners: c, fill: shadeHex(fill, lit(n)), group: 'station' });

export function trenchField(map, { seed = 1 } = {}) {
  const F = map.rings.field, R = map.rings.reach, c = map.craft;
  const w = Math.max(TRENCH.w, r2(c.max / 3)), d = Math.max(TRENCH.d, r2(c.max / 3)), hw = w / 2;
  // the trench opens a run-in (RUN_IN turn circles) before the field, so a craft is down in it before the turrets
  const y0 = r2(-F.hy - RUN_IN * map.eye.turn.cruise), y1 = F.hy, far = 3 * Math.max(R.hx, R.hy);
  // the plate: left and right of the trench out past the reach, the trench's walls and floor, the ends past the field
  const faces = [
    quad([[-far, -far, 0], [-hw, -far, 0], [-hw, far, 0], [-far, far, 0]], PLATE.top, [0, 0, 1]),
    quad([[hw, -far, 0], [far, -far, 0], [far, far, 0], [hw, far, 0]], PLATE.top, [0, 0, 1]),
    quad([[-hw, -far, 0], [hw, -far, 0], [hw, y0, 0], [-hw, y0, 0]], PLATE.top, [0, 0, 1]),
    quad([[-hw, y1, 0], [hw, y1, 0], [hw, far, 0], [-hw, far, 0]], PLATE.top, [0, 0, 1]),
    quad([[-hw, y0, -d], [hw, y0, -d], [hw, y1, -d], [-hw, y1, -d]], PLATE.floor, [0, 0, 1]),
    quad([[-hw, y0, 0], [-hw, y1, 0], [-hw, y1, -d], [-hw, y0, -d]], PLATE.wall, [1, 0, 0]),
    quad([[hw, y1, 0], [hw, y0, 0], [hw, y0, -d], [hw, y1, -d]], PLATE.wall, [-1, 0, 0]),
    quad([[-hw, y1, 0], [hw, y1, 0], [hw, y1, -d], [-hw, y1, -d]], PLATE.wall, [0, -1, 0]),
  ];
  // the roof grid over the field and a band either side: 0 on the plate, -d in the trench, the greebles' tops
  // (the grid covers the trench and its band, where a craft flies low; past it the plate is the ground and the coarse
  // blocks are scenery)
  const cell = TRENCH.cell, gx0 = -Math.min(R.hx, hw + TRENCH.band + 50), gy0 = Math.min(-R.hy, y0 - cell), nx = Math.ceil((-2 * gx0) / cell), ny = Math.ceil((R.hy - gy0) / cell);
  const top = new Float32Array(nx * ny);
  const inTrench = (x, y) => Math.abs(x) < hw && y >= y0 && y <= y1;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const x = gx0 + (i + 0.5) * cell, y = gy0 + (j + 0.5) * cell; top[j * nx + i] = inTrench(x, y) ? -d : 0; }
  // the greebles: a coarse lattice over the field's band, each lattice cell a box or not, never in or over the trench
  // (a box keeps a cell's width off the rim, so the rim is a clean edge to fly under)
  const walls = [], roofs = [];
  // fine machinery in a band either side of the trench (what the eye sees from in it), coarse blocks past it (what
  // reads from above)
  const lay = (step, x0, x1, share, tall, salt) => {
    for (let y = -F.hy; y < y1; y += step) for (let x = x0 + step / 2; x < x1 - step / 2; x += step) {
      const n = 0.5 + 0.5 * gnoise(x / (4 * step), y / (4 * step), seed + salt), m = 0.5 + 0.5 * gnoise(x / step, y / step, seed + salt + 4);
      if (m > share + 0.45 * n || Math.abs(x) < hw + cell + step / 2) continue;
      const bw = Math.round(step * (0.45 + 0.5 * m)), bd = Math.round(step * (0.45 + 0.5 * (1 - m))), h = Math.round(tall[0] + (tall[1] - tall[0]) * n * n);
      const g = Math.round(100 * (0.36 + 0.1 * n) ** 2) / 100, at = [Math.round(x), Math.round(y + step / 2), 0], sc = [bw, bd, h];
      walls.push({ pos: at, scale: sc, tint: [g, r2(g * 1.04), r2(g * 1.1)] }); roofs.push({ pos: at, scale: sc, tint: [r2(g * 1.2), r2(g * 1.24), r2(g * 1.3)] });
      for (let yy = at[1] - bd / 2; yy <= at[1] + bd / 2; yy += cell / 2) for (let xx = x - bw / 2; xx <= x + bw / 2; xx += cell / 2) {
        const i = Math.floor((xx - gx0) / cell), j = Math.floor((yy - gy0) / cell); if (i >= 0 && j >= 0 && i < nx && j < ny) top[j * nx + i] = Math.max(top[j * nx + i], h);
      }
    }
  };
  const band = hw + TRENCH.band;
  for (const side of [-1, 1]) {
    lay(TRENCH.fine, side < 0 ? -band : hw, side < 0 ? -hw : band, TRENCH.greeble, TRENCH.tall, 3);
    lay(TRENCH.coarse, side < 0 ? -(F.hx + 600) : band, side < 0 ? -band : F.hx + 600, TRENCH.greeble - 0.1, [TRENCH.tall[0] * 2, TRENCH.tall[1] * 1.6], 11);
  }
  // the port at the trench's end, on its floor; the turrets on the rims, alternating
  const port = [0, r2(y1 - 3 * TRENCH.port), r2(-d + TRENCH.port / 2)];
  const turrets = [];
  for (let y = -F.hy + c.cruise * TRENCH.turretS, k = 0; y < y1 - c.cruise; y += c.cruise * TRENCH.turretS, k++) turrets.push([k % 2 ? hw + 8 : -hw - 8, r2(y), 4]);
  const groundAt = (x, y) => { const i = Math.floor((x - gx0) / cell), j = Math.floor((y - gy0) / cell); return i >= 0 && j >= 0 && i < nx && j < ny ? top[j * nx + i] : inTrench(x, y) ? -d : 0; };
  const sun = SUN.map((v) => v / Math.hypot(...SUN));
  const repeats = walls.length ? [{ group: 'station:walls', template: unitBox(sun, 'walls'), transforms: walls }, { group: 'station:roofs', template: unitBox(sun, 'roof'), transforms: roofs }] : [];
  // the run: in at the mouth, half the trench's depth down; waypoints down the middle every two turn circles
  const zRun = r2(-d / 2), line = [];
  for (let y = y0 + 2 * map.eye.turn.cruise; y < port[1] - c.cruise; y += 2 * map.eye.turn.cruise) line.push([0, r2(y), zRun]);
  return {
    groundAt, topAt: groundAt, pads: [], asteroids: [], cityFaces: [], cityRepeats: [], cityFormed: [], loop: null,
    roofs: [packRoofs({ x0: gx0, y0: gy0, nx, ny, top })], faces, repeats,
    bounds: { x: [-R.hx, R.hx], y: [-R.hy, R.hy], z: [-d, R.hz], cell },
    start: { pos: [0, r2(y0 + map.eye.turn.cruise / 2), zRun], heading: Math.PI / 2, pitch: 0 },
    line, port, turrets, trench: { w, d, y0, y1 },
    report: { trench: { width: w, depth: d, length: r2(y1 - y0) }, greebles: walls.length, turrets: turrets.length },
  };
}

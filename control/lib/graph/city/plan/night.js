/**
 * THE CITY AT NIGHT: a look with no sun (the city is moonlit, look.js lookLight) lights its windows and its signs.
 *
 *   grammar.night: { windows, shops, palette }   the share of a wall's windows lit (0–1), the share of shop fronts lit
 *                                                 along their ground storey (0–1), and the colours a lit room shows
 *
 * A lit window is a pane laid on a wall's own window grid (the facade card the facade pipeline realizes as mullions
 * over a recessed body, architecture/facade-card.js), between the body and the mullions, in a palette colour that no
 * light shades: it is the room's own. A run of lit windows along a storey is one pane. The share is the grammar's,
 * leant by the lot's use (an office floor lit late, a warehouse dark), and the dice are the lot's own
 * (`${seed}|night-v1|<lot>`), so a lot's windows stay lit as they were whatever the rest of the city does. A blade
 * sign (tagged by its box, scene-css3d bladeSignBoxes) burns in its own colour.
 *
 * Pure, and absent by day: a city under a sun gets none of it.
 */
import { streamOf } from './dice.js';
import { scaleHex } from '../../polygonizer/vexar.js';

// how a lot's use leans the grammar's share of lit windows
const USE_LEAN = Object.freeze({ residential: 1, mixed: 0.95, office: 0.8, civic: 0.45, industrial: 0.25 });
// the shirt's depth (facade-card.js projectCardOntoQuad: relief 0.12, brick 2.4×), and how far proud of the body a pane sits
const RELIEF = 0.12, PROUD = 0.025;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const r3 = (v) => Math.round(v * 1000) / 1000;
function normalOf(c) {
  const U = sub(c[1], c[0]), V = sub(c[3], c[0]);
  const n = [U[1] * V[2] - U[2] * V[1], U[2] * V[0] - U[0] * V[2], U[0] * V[1] - U[1] * V[0]], L = Math.hypot(...n) || 1;
  return n.map((v) => v / L);
}

// a wall faces a box's named face ('+y', '-x', …) when its outward normal points that way
const AXIS = { '-x': [0, -1], '+x': [0, 1], '-y': [1, -1], '+y': [1, 1] };
const facing = (f, face) => { const a = AXIS[face]; return !!a && normalOf(f.corners)[a[0]] * a[1] > 0.9; };

/** The lot (or site) a wall belongs to: the box its foot's middle lies on. */
function ownerOf(boxes, f) {
  const c = f.corners, x = (c[0][0] + c[1][0]) / 2, y = (c[0][1] + c[1][1]) / 2, e = 0.05;
  let best = null;
  for (const b of boxes) {
    if (x < b.x - e || x > b.x + b.w + e || y < b.y - e || y > b.y + b.d + e) continue;
    if (!best || b.w * b.d < best.w * best.d) best = b;
  }
  return best;
}

/** The lit panes of one wall: [{ corners, fill, group }] on its card's window grid. */
function wallPanes(f, share, shopRow, palette, rand) {
  const card = f.card, g = card.parts && card.parts[0];
  if (!g || g.kind !== 'grid' || card.material === 'metal') return [];
  const c = f.corners, n = normalOf(c), depth = (card.material === 'brick' ? RELIEF * 2.4 : RELIEF) - PROUD;
  const U = sub(c[1], c[0]), V = sub(c[3], c[0]);
  const at = (u, v) => [0, 1, 2].map((k) => r3(c[0][k] + U[k] * u + V[k] * v - n[k] * depth));
  const stepU = (g.u1 - g.u0) / g.countU, stepV = (g.v1 - g.v0) / g.countV, out = [];
  for (let j = 0; j < g.countV; j++) {
    const shop = j === 0 && shopRow;
    let run = null;
    const close = () => {
      if (!run) return;
      const u0 = g.u0 + run.i0 * stepU + g.gapU / 2, u1 = g.u0 + (run.i1 + 1) * stepU - g.gapU / 2, v0 = g.v0 + j * stepV + g.gapV / 2, v1 = g.v0 + (j + 1) * stepV - g.gapV / 2;
      out.push({ corners: [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)], normal: n, fill: run.fill, group: shop ? 'city:night-shop' : 'city:night-window', noInk: true });
      run = null;
    };
    // a storey's rooms: a lit one keeps its neighbour lit more often than not (one tenant, one floor), in its colour
    for (let i = 0; i < g.countU; i++) {
      const on = shop || rand() < (run ? Math.min(0.92, share + 0.45) : share);
      if (!on) { close(); continue; }
      if (!run) run = { i0: i, i1: i, fill: scaleHex(palette[Math.floor(rand() * palette.length)], shop ? 1 : 0.78 + rand() * 0.22) };
      else run.i1 = i;
    }
    close();
  }
  return out;
}

/**
 * The night's faces for an assembled city (in units): every facade wall's lit windows, and its blade signs burning.
 * `faces` are the facade pipeline's (walls carry their `card`), `boxes` the boxes it was handed (cityBoxes), `lots`
 * the plan's lots by id. Returns the faces with the signs relit and the panes added.
 */
export function nightFaces(faces, boxes, lots, night, seed) {
  if (!night) return faces;
  const dice = new Map(), panes = [];
  const out = faces.map((f) => (f && f.neon ? { ...f, fill: scaleHex(f.neon, 1.15), group: 'city:neon', noInk: true } : f));
  for (const f of faces) {
    if (!f || !f.card || !Array.isArray(f.corners) || f.corners.length !== 4) continue;
    const b = ownerOf(boxes, f);
    if (!b) continue;
    const key = b.lot || b.site, l = b.lot ? lots.get(b.lot) : null;
    if (!dice.has(key)) dice.set(key, streamOf(seed, 'night', key));
    const share = Math.min(1, night.windows * (USE_LEAN[l ? l.use : 'civic'] ?? 1));
    // a shop's ground storey is lit along its front, if the dice give it a lit shop
    const rand = dice.get(key), front = l && l.shopfront && facing(f, b.front) && Math.abs(f.corners[0][2] - b.z0) < 0.05 && rand() < night.shops;
    for (const q of wallPanes(f, share, front, night.palette, rand)) panes.push({ ...q, lot: key });
  }
  return [...out, ...panes];
}

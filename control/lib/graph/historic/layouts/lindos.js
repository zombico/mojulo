/**
 * historic/layouts/lindos — the 'acropolis' layout: Hellenistic Lindos (c. 180 BCE), the first site whose
 * ground ends in a SEA CLIFF. The plan, in order:
 *
 *   the land: the saddle between two bays, rising west into hills, built up in dry-stone terraces 3 m
 *     apart; the rock of the acropolis standing out of the sea to the east, sheer on its sea sides, its
 *     summit in two levels (the stoa's terrace, the temple's court 10 m above), its west flank falling in
 *     ledges to the saddle (`hAt`; ../terrain.js stands the cliffs and the terrace walls up)
 *   → the climb: a rock-cut stair up the west flank, Pythokritos' ship cut on the rock at its top
 *   → the sanctuary: the great stoa on the lower terrace, the great stair through it, the propylaia, the
 *     temple of Athena at the cliff's edge, her altar before it — UNLIT (the fireless rite) — statues
 *   → the theatre in the west foot of the rock
 *   → the town on the terraces: a street along the foot of every terrace wall, stairs climbing between
 *     them, courtyard houses packed in the rest, kilns by the beach, fires in some courts
 *   → the bays: the beach of the great harbour with its boats, warships at anchor, the round tomb on the cape
 *   → fields and olives on the terraces outside the town.
 *
 * `site.cliff: false` (the culture `polis`) is the same plan on a gentle acropolis hill: no sheer sides,
 * the flank terraced like the town, no ship relief and no round tomb. Plans in metres; x east, y south.
 */
import { terrainMesh, terraced } from '../terrain.js';
import { weatherRock, limestonePaint } from '../rock.js';
import { olive } from '../assets/lindos.js';
import { placeAsset } from '../assets/kit.js';
import { CELL, C, stream, pick, claimGrid, runs, packLots, lotSlot, laneZ, skinLoose } from '../layout-kit.js';
import { scaleHex } from '../../polygonizer/vexar.js';

const FRAME = { w: 960, d: 810 };
// the summit of the rock (its lower terrace) and the line south of which it stands 10 m higher (the temple's court)
const SUMMIT = [[588, 365], [630, 338], [700, 340], [735, 370], [732, 420], [712, 462], [670, 474], [628, 452], [596, 410]];
const UPPER_Y = 402;
// the rock shelf under the summit's north cliff, ~40 m up (Lindos only)
const SHELF = [[565, 300], [700, 290], [765, 318], [775, 362], [735, 370], [700, 340], [630, 338], [588, 365], [560, 352]];

const inPoly = (P, x, y) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const distPoly = (P, x, y) => {
  let d = Infinity;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [ax, ay] = P[j], [bx, by] = P[i], vx = bx - ax, vy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)));
    d = Math.min(d, Math.hypot(x - ax - vx * t, y - ay - vy * t));
  }
  return inPoly(P, x, y) ? 0 : d;
};
const TOWN = { x: 365, y: 155, w: 240, d: 280 };
// the picture: the rock, the town on the saddle, the beach of the great harbour and St Paul's bay — a read, not a province
const WIN = { x: 360, y: 130, w: 500, d: 500 };
const distEdge = (P, x, y) => { let d = Infinity; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [ax, ay] = P[j], [bx, by] = P[i], vx = bx - ax, vy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy))); d = Math.min(d, Math.hypot(x - ax - vx * t, y - ay - vy * t)); } return d; };
const inRect = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.d;

export function planAcropolis({ seed = 1, culture = 'lindos', assets, fire = false } = {}, K) {
  const P = K.palette, ST = K.site, cliff = ST.cliff !== false, landmarks = K.landmarks !== false;
  const g = claimGrid(FRAME), { cols, rows, grid, at, set } = g;
  const boxes = [], grounds = [], slots = [];
  const Zs = ST.summit, Zu = ST.upper, saddle = cliff ? 46 : 14, T = ST.terrace;

  // ── 1. the land ──
  // the sea: the great harbour to the north, open water east and south, St Paul's bay under the south cliff; the cape across the harbour is land
  const cape = (x, y) => y < 75 && x > 730;
  // (the generic polis keeps only the harbour bay: its hill meets no open sea, so it stands in no cliff)
  const isSea = (x, y) => !cape(x, y) && (((x - 560) / 240) ** 2 + ((y - 60) / 165) ** 2 < 1 || (cliff && ((x > 790 + 15 * Math.sin(y / 47) && y > 70) || ((x - 645) / 78) ** 2 + ((y - 545) / 58) ** 2 < 1 + 0.25 * Math.sin(Math.atan2(y - 545, x - 645) * 3 + 1) || (x > 655 && x < 700 && y > 560) || y > 690 + 20 * Math.sin(x / 70))));
  // the hills: a hump across the saddle, rising westward, falling to the shore north and south and to the sea east of the rock
  const smooth = (e0, e1, v) => { const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const base = (x, y) => {
    // down to the beach of the great harbour northward and to St Paul's bay and the south shore southward
    const S = y < 360 ? smooth(215, 380, y) : smooth(530, 410, y);
    const A = (saddle + Math.max(0, 480 - x) * 0.06) * Math.max(0, Math.min(1, (820 - x) / 220));
    const capeHill = 18 * Math.exp(-((x - 860) ** 2 + (y - 35) ** 2) / 2400);
    // the town's ground wanders (its terrace streets with it); the open hillside less
    const wander = inRect(TOWN, x, y) ? 2 * Math.sin(x / 37) * Math.sin(y / 53) : 1.2 * Math.sin(x / 90) * Math.sin(y / 70);
    return 1.5 + (A - 1.5) * S * (0.35 + 0.65 * smooth(0, 60, Math.min(y - 120, 900 - y))) + wander * S + capeHill;
  };
  // the climb (Lindos): a corridor cut up the west flank from the saddle to the stoa's terrace; the great stair's cut into the upper terrace
  const climb = { x: 486, y: 364, w: 114, d: 14, top: 596 };
  const climbZ0 = terraced(base(climb.x, climb.y + 7), T);
  const climbZ = (x) => climbZ0 + Math.max(0, Math.min(1, (x - climb.x) / (climb.top - climb.x))) * (Zs - climbZ0);
  const stair = { x: 643, y: 391, w: 21, d: 21 };   // the great stair, 21 m wide (record), from the stoa's walk up to the propylaia
  // the theatre's pad in the west foot of the rock: the orchestra level, flat
  const theatreR = { x: 484, y: 398, w: 40, d: 56 }, theatreZ = terraced(base(504, 426), T);
  const flank = (x, y) => {
    const d = distPoly(SUMMIT, x, y);
    if (!cliff) return Zs - d * 0.45;   // the polis' hill: a plain slope (the terraces are the town's and the fields')
    // ledges near the top, a steep band below, on the west side; they wander round the rock, so they read as
    // rock, not as rings
    // turning east the flank reaches out less and less, until the rock meets the sea and the shelf sheer
    const reach = 85 * (1 - smooth(560, 640, x));
    if (d > reach) return -Infinity;
    const a = Math.atan2(y - 400, x - 660), z = d < 40 ? Zs - 0.45 * d : Zs - 18 - 1.4 * (d - 40);
    return terraced(z + 3.5 * Math.sin(a * 7) + 2 * Math.sin(a * 13 + 2), 9);
  };
  const natural = (x, y) => {
    if (isSea(x, y)) return ST.sea;
    if (inPoly(SUMMIT, x, y)) return y >= UPPER_Y ? Zu : Zs;
    // in the town the terraces keep to the claim grid (each 3 m cell one level): every lot, street and stair stands on its level exactly
    const town = inRect(TOWN, x, y), bx = town ? (Math.floor(x / CELL) + 0.5) * CELL : x, by = town ? (Math.floor(y / CELL) + 0.5) * CELL : y;
    let z = terraced(base(bx, by), T);
    if (cliff && inPoly(SHELF, x, y)) z = Math.max(z, 40);
    return Math.max(z, flank(x, y));
  };
  const hAt = (x, y) => {
    if (cliff && inRect(climb, x, y) && x < climb.top) return climbZ(x);
    if (inRect(stair, x, y)) return Zs + Math.max(0, Math.min(1, (y - stair.y) / stair.d)) * (Zu - Zs);
    if (inRect(theatreR, x, y)) return theatreZ;
    return natural(x, y);
  };

  // ── 2. the sanctuary on the summit ──
  const slot = (s) => { slots.push(s); return s; };
  const stoaR = { x: 610, y: 382, w: 87, d: 20 };
  slot({ asset: 'ln-stoa', rect: stoaR, facing: 'n', z: Zs, gap: stair.w });
  slot({ asset: 'ln-stair', rect: { x: stair.x, y: stair.y, w: stair.w, d: stair.d }, facing: 'n', z: Zs, rise: Zu - Zs, steps: 35 });
  const propR = { x: 626, y: stair.y + stair.d, w: 54, d: 18 };
  slot({ asset: 'ln-propylaia', rect: propR, facing: 'n', z: Zu });
  const templeR = { x: 648, y: propR.y + propR.d + 5, w: 9, d: 24 };
  slot({ asset: 'ln-temple', rect: templeR, facing: 'n', z: Zu });
  slot({ asset: 'ln-altar', rect: { x: 663, y: templeR.y + 1, w: 7, d: 3 }, facing: 'w', z: Zu });   // before the temple, off its axis (place conjecture)
  // the statues: a row along the front of the lower terrace, a few in the temple court
  const SB = stream(seed, 'statues');
  for (let x = 606; x < 700; x += 7 + SB() * 5) if (inPoly(SUMMIT, x, 372) && inPoly(SUMMIT, x + 2, 374)) slot({ asset: 'ln-statue', rect: { x, y: 371, w: 1.6, d: 1.6 }, facing: 'n', z: Zs });
  for (const [x, y] of [[634, 436], [640, 446], [668, 448], [674, 440]]) if (inPoly(SUMMIT, x, y)) slot({ asset: 'ln-statue', rect: { x, y, w: 1.6, d: 1.6 }, facing: 'e', z: Zu });
  // the wall's towers either side of the way in at the top of the climb (the line of the walls is conjecture)
  const fits = (r) => [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.d], [r.x + r.w, r.y + r.d]].every(([x, y]) => inPoly(SUMMIT, x, y) && hAt(x, y) === Zs);
  for (const y of [352, 380]) { let r = { x: 596, y, w: 8, d: 8 }; for (let k = 0; k < 20 && !fits(r); k++) r = { ...r, x: r.x + 1 }; if (fits(r)) slot({ asset: 'ln-tower', rect: r, facing: 'w', z: Zs }); }
  if (cliff) {
    // the climb: the rock-cut stair (built up where it rides over the ledges), the ship at its top on the cut's north wall
    slot({ asset: 'ln-stair', rect: { x: climb.x, y: climb.y + 4, w: climb.top - climb.x, d: 8 }, facing: 'w', z: climbZ0, rise: Zs - climbZ0, rock: true, cheek: false });
    if (landmarks) slot({ asset: 'ln-ship-relief', rect: { x: 562, y: climb.y, w: 7, d: 2.4 }, facing: 's', z: climbZ(565.5) });
  }
  slot({ asset: 'ln-theatre', rect: theatreR, facing: 'w', z: theatreZ });

  // ── 3. the town on its terraces ──
  // the town: the saddle and the slopes west of the rock, above the shore, clear of the rock, the climb and the theatre
  const level = (c, r) => hAt((c + 0.5) * CELL, (r + 0.5) * CELL);
  const keepOut = [{ x: climb.x - 6, y: climb.y - 4, w: climb.w + 12, d: climb.d + 8 }, { x: theatreR.x - 6, y: theatreR.y - 6, w: theatreR.w + 12, d: theatreR.d + 12 }];
  const townCell = (c, r) => {
    const x = (c + 0.5) * CELL, y = (r + 0.5) * CELL;
    if (!inRect(TOWN, x, y) || keepOut.some((k) => inRect(k, x, y))) return false;
    const z = hAt(x, y), b = terraced(base(x, y), T);   // x, y are a cell's centre: the snapped level is its own
    // the whole cell on the terrace: no corner of it on the rock's flank
    const onTerrace = [[-1, -1], [1, -1], [-1, 1], [1, 1]].every(([u, v]) => Math.abs(hAt(x + u * (CELL / 2 - 0.05), y + v * (CELL / 2 - 0.05)) - z) < 0.01);
    return z > 1 && Math.abs(z - b) < 0.01 && onTerrace && !isSea(x, y) && [[-CELL, 0], [CELL, 0], [0, -CELL], [0, CELL]].every(([dx, dy]) => !isSea(x + dx * 2, y + dy * 2));
  };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) set(c, r, townCell(c, r) ? C.EMPTY : C.OUTSIDE);
  // a street along the foot of every terrace wall; the terrace's own edge kept open above it
  const laneCells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (at(c, r) === C.OUTSIDE) continue;
    for (const [dc, dr] of [[1, 0], [0, 1]]) {
      const v = at(c + dc, r + dr); if (v === C.OUTSIDE || v === -1) continue;
      const a = level(c, r), b = level(c + dc, r + dr);
      if (Math.abs(a - b) < 0.01) continue;
      const [lo, hi] = a < b ? [[c, r], [c + dc, r + dr]] : [[c + dc, r + dr], [c, r]];
      set(lo[0], lo[1], C.LANE); laneCells.push(lo);
      if (at(hi[0], hi[1]) === C.EMPTY) set(hi[0], hi[1], C.OPEN);
    }
  }
  // stairs climbing between the terrace streets, north–south every ~36 m, and the main way east along the saddle to the climb
  const stairs = [], LS = stream(seed, 'stairs');
  const carveStairs = (cells, dir) => {
    for (const [c, r] of cells) if (at(c, r) !== C.OUTSIDE && at(c, r) !== -1) { if (at(c, r) !== C.LANE) laneCells.push([c, r]); set(c, r, C.LANE); }
    // a flight wherever the line steps up a terrace: in the lower cell, climbing toward the higher
    for (let i = 0; i + 1 < cells.length; i++) {
      const [c, r] = cells[i], [c2, r2] = cells[i + 1];
      if (at(c, r) === C.OUTSIDE || at(c2, r2) === C.OUTSIDE || at(c, r) === -1 || at(c2, r2) === -1) continue;
      const a = level(c, r), b = level(c2, r2);
      if (Math.abs(a - b) < 0.01) continue;
      const [lo, up] = a < b ? [[c, r], [c2 - c, r2 - r]] : [[c2, r2], [c - c2, r - r2]];
      const facing = dir === 'ns' ? (up[1] < 0 ? 's' : 'n') : up[0] < 0 ? 'e' : 'w';
      stairs.push({ asset: 'ln-steps', rect: dir === 'ns' ? { x: lo[0] * CELL, y: lo[1] * CELL, w: 2 * CELL, d: CELL } : { x: lo[0] * CELL, y: lo[1] * CELL, w: CELL, d: 2 * CELL }, facing, z: Math.min(a, b), rise: Math.abs(a - b) });
    }
  };
  for (let c0 = Math.floor((TOWN.x + 8) / CELL) + Math.floor(LS() * 6); c0 < Math.floor(590 / CELL); c0 += 11 + Math.floor(LS() * 3)) {
    const line = []; for (let r = 0; r < rows; r++) line.push([c0, r]);
    carveStairs(line, 'ns');
    for (let r = 0; r < rows; r++) if (at(c0 + 1, r) !== C.OUTSIDE && at(c0 + 1, r) !== -1) set(c0 + 1, r, C.LANE);
  }
  const mainRow = Math.floor((climb.y + 7) / CELL), main = [];
  for (let c = Math.floor(TOWN.x / CELL); c < Math.floor(climb.x / CELL); c++) main.push([c, mainRow]);
  carveStairs(main, 'ew');
  for (const [c] of main) if (at(c, mainRow + 1) !== C.OUTSIDE && at(c, mainRow + 1) !== -1) set(c, mainRow + 1, C.LANE);
  // the potters by the harbour beach: kilns at the town's north edge, where the smoke blows out to sea
  const KL = stream(seed, 'kilns');
  for (let c = Math.floor(380 / CELL); c < Math.floor(500 / CELL) && slots.filter((s) => s.asset === 'ln-kiln').length < 5; c += 4 + Math.floor(KL() * 4)) {
    for (let r = 0; r < rows; r++) {
      if (![0, 1].every((dc) => [0, 1].every((dr) => at(c + dc, r + dr) === C.EMPTY || at(c + dc, r + dr) === C.OPEN))) continue;
      if (Math.abs(level(c, r) - level(c + 1, r + 1)) > 0.01) continue;
      for (const dc of [0, 1]) for (const dr of [0, 1]) set(c + dc, r + dr, C.PRECINCT);
      slot({ asset: 'ln-kiln', rect: { x: c * CELL, y: r * CELL, w: 2 * CELL, d: 2 * CELL }, facing: 'n', z: level(c, r) });
      break;
    }
  }
  // houses: every lot on one terrace (the streets and edges part them), fronting its street
  const HS = stream(seed, 'hearths');
  for (const lot of packLots(g, K.house.size, seed)) {
    const s = lotSlot(g, lot, K.house.gap, () => 'ln-house'), cx = s.rect.x + s.rect.w / 2, cy = s.rect.y + s.rect.d / 2;
    slot({ ...s, z: hAt(cx, cy), hearth: HS() < 0.14 });
  }
  slots.push(...stairs);

  // ── 4. the bays: boats on the harbour beach, warships at anchor, the round tomb on the cape ──
  const waterZ = ST.waterZ, SH = stream(seed, 'ships');
  for (let x = 390; x < 600; x += 14 + SH() * 16) {
    let y = 120; while (y < 300 && isSea(x, y)) y += 1;
    if (y >= 300 || hAt(x + 3, y + 3) > 4) continue;
    slot({ asset: 'ln-boat', rect: { x, y: y + 1, w: 6, d: 1.8 }, facing: 'n', z: hAt(x + 3, y + 2) });
  }
  for (const [x, y, f] of [[450, 150, 'n'], [560, 165, 's'], [660, 192, 'n']]) slot({ asset: 'ln-trireme', rect: { x, y, w: 32, d: 5 }, facing: f, z: waterZ + 0.05 });
  // (the round tomb on the cape across the harbour stands outside the picture: the kit keeps it, the town does not place it)

  // ── place: each slot by its asset; the fires burning in it noted where they stand ──
  const kit = assets || K.assets, fireSources = [];
  for (const [i, s] of slots.entries()) {
    const A = kit[s.asset];
    if (!A) throw new Error(`no asset '${s.asset}' in the ${culture} kit`);
    const placed = placeAsset(A, s, { palette: P, culture: K, rng: stream(seed, `asset|${i}`) });
    boxes.push(...placed.boxes); grounds.push(...placed.grounds);
    const fl = placed.boxes.filter((b) => b.kind === 'flame');
    if (fl.length) {
      const pts = fl.flatMap((b) => b.pts), z = Math.min(...pts.map((p) => p[2]));
      fireSources.push({ kind: s.asset === 'ln-kiln' ? 'campfire' : 'brazier', at: [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length, z], baked: false });
    }
  }

  // ── 5. views (before the ground: the ground is cut fine round each eye) ──
  const z = (x, y) => hAt(x, y);
  const views = {
    // from a boat in the great harbour: the town on its terraces, the rock and its cliffs, the stoa on top
    bay: { eye: [560, 185, waterZ + 3], at: [640, 380, 70] },
    // short of the climb's foot, looking up the rock-cut stair to the summit (the polis: up the flank)
    climb: { eye: [climb.x - 16, climb.y + 7, hAt(climb.x - 16, climb.y + 7) + 1.7], at: [climb.top, climb.y + 7, Zs + 6] },
    // on the stoa's terrace, before the colonnade: the great stair rising through it to the propylaia
    stoa: { eye: [stair.x + stair.w / 2 - 4, 360, Zs + 1.7], at: [stair.x + stair.w / 2, propR.y + 6, Zu + 5] },
    // in the temple court east of the altar: the temple's front porch and flank, the cliff's edge and the sea beyond
    temple: { eye: [templeR.x + 24, templeR.y + 5, Zu + 1.7], at: [templeR.x + 2, templeR.y + 8, Zu + 4] },
    // low on the sea under the east cliff: the rock sheer out of the water, the temple on its edge
    sea: { eye: [850, 470, waterZ + 2.5], at: [700, 430, 70] },
    // at the top of the theatre's seats, looking down over the orchestra to the town and the bay
    theatre: { eye: [theatreR.x + theatreR.w - 2, theatreR.y + theatreR.d / 2, theatreZ + 11.5], at: [380, 330, 10] },
    // in a terrace street in the town, the rock above the roofs
    town: { eye: [470, 300, z(470, 300) + 1.7], at: [650, 380, 90] },
  };
  if (!cliff) delete views.sea;

  // ── 6. the ground: the town's streets, fields and olives on the terraces just outside it ──
  // the town's streets: on each terrace at its own level
  runs(grid, cols, rows, (v) => v === C.LANE, (c, r, n) => {
    // a run may cross a step (an east–west street over a stair): cut it where the level changes
    let s = c;
    for (let k = c; k <= c + n; k++) if (k === c + n || Math.abs(level(k, r) - level(s, r)) > 0.01) { grounds.push({ kind: 'lane', x: s * CELL, y: r * CELL - (r % 2 ? 0.08 : 0), w: (k - s) * CELL + 0.15, d: CELL + (r % 2 ? 0.16 : 0), z: level(s, r) + laneZ(0, r), fill: P.lane, surface: 'rubble' }); s = k; }
  });
  // the sanctuary's paving on the two terraces
  for (const [r, zz] of [[{ x: 600, y: 352, w: 120, d: 30 }, Zs], [{ x: 620, y: propR.y + propR.d, w: 70, d: 6 }, Zu]]) grounds.push({ kind: 'court', ...r, z: zz + 0.03, fill: P.paving, surface: 'flagstone' });
  const G = stream(seed, 'groves'); let olives = 0;
  const occupied = slots.map((s) => s.rect);
  const hit = (x, y, w, d) => occupied.some((o) => x < o.x + o.w + 4 && x + w > o.x - 4 && y < o.y + o.d + 4 && y + d > o.y - 4);
  for (let y = WIN.y; y < WIN.y + WIN.d - 15; y += 15) for (let x = WIN.x; x < WIN.x + WIN.w - 15; x += 15) {
    const zs = [[x, y], [x + 15, y], [x, y + 15], [x + 15, y + 15], [x + 7.5, y + 7.5]].map(([a, b]) => hAt(a, b));
    if (Math.max(...zs) - Math.min(...zs) > 0.01 || zs[0] < 2.5 || zs[0] > 70 || inPoly(SUMMIT, x + 7, y + 7) || hit(x, y, 15, 15)) continue;
    if (at(Math.floor((x + 7) / CELL), Math.floor((y + 7) / CELL)) !== C.OUTSIDE) continue;
    if (G() < 0.6) grounds.push({ kind: 'field', x: x + 0.4, y: y + 0.4, w: 14.2, d: 14.2, z: zs[0] + 0.03, fill: pick(P.field, G), surface: 'furrows' });
    if (olives < K.groves.max && G() < K.groves.density) for (let k = 0; k < 1 + Math.floor(G() * 3); k++) { boxes.push(...olive(x + 2 + G() * 11, y + 2 + G() * 11, zs[0], G, P)); olives++; }
  }

  // ── 7. into the picture's frame: everything planned on the site's map moves to the window's origin ──
  const ox = WIN.x, oy = WIN.y, mv = (p) => [p[0] - ox, p[1] - oy, ...p.slice(2)];
  const mvRect = (r) => ({ ...r, x: r.x - ox, y: r.y - oy });
  const keepIn = (b) => b.x + b.w > ox && b.x < ox + WIN.w && b.y + b.d > oy && b.y < oy + WIN.d;
  const placedBoxes = boxes.filter(keepIn).map((b) => ({ ...mvRect(b), ...(b.pts ? { pts: b.pts.map(mv) } : {}), ...(b.top ? { top: mvRect(b.top) } : {}), ...(b.solid === 'beam' ? { a: mv(b.a), b: mv(b.b) } : {}) }));
  const placedGrounds = grounds.filter((q) => (q.poly ? q.poly.some(([x, y]) => x > ox && x < ox + WIN.w && y > oy && y < oy + WIN.d) : keepIn(q))).map((q) => (q.poly ? { ...q, poly: q.poly.map(mv) } : mvRect(q)));
  boxes.length = 0; boxes.push(...placedBoxes); grounds.length = 0; grounds.push(...placedGrounds);
  for (const s of slots) s.rect = mvRect(s.rect);
  for (const v of Object.values(views)) { v.eye = mv(v.eye); v.at = mv(v.at); }
  for (const f of fireSources) f.at = mv(f.at);
  const H = (x, y) => hAt(x + ox, y + oy);

  // ── 8. the terrain under it all: cliffs, terrace walls, slopes, the sea ──
  // St Paul's bay is shallow and sandy throughout; elsewhere the sea deepens away from the shore
  const seaFill = (x, y) => ((x + ox - 645) / 95) ** 2 + ((y + oy - 545) / 75) ** 2 < 1 ? P.shallows : [[0, 0], [45, 0], [-45, 0], [0, 45], [0, -45], [32, 32], [-32, 32], [32, -32], [-32, -32]].some(([dx, dy]) => !isSea(x + ox + dx, y + oy + dy)) ? P.shallows : P.sea;
  // the rock: the layout's shape weathered by the landform operators (../rock.js) — beds that bench and band the
  // cliffs, joints that break them into blocks, scree at their feet — wherever the ground is steep; the built
  // floors (the summit, the climb's cut, the great stair, the theatre's pad) and the sea keep their levels
  const summitIn = SUMMIT.map(mv), holds = [climb, stair, theatreR].map(mvRect);
  const R = weatherRock({
    hAt: H, region: { x: 140, y: 120, w: 320, d: 300 }, cell: 10, margin: 1, seed: `lindos-rock-${seed}`, below: waterZ,
    keep: (x, y) => (inPoly(summitIn, x, y) && distEdge(summitIn, x, y) > 2) || holds.some((r) => inRect({ x: r.x - 2, y: r.y - 2, w: r.w + 4, d: r.d + 4 }, x, y)) || isSea(x + ox, y + oy),
    // a cell holding any of the town (a lot, a street, a terrace edge) stays the terrain's
    owned: (x0, y0, sz) => { for (let y = y0 + 1.5; y < y0 + sz; y += CELL) for (let x = x0 + 1.5; x < x0 + sz; x += CELL) { const v = at(Math.floor((x + ox) / CELL), Math.floor((y + oy) / CELL)); if (v !== C.OUTSIDE && v !== -1) return true; } return false; },
    ops: [
      { op: 'strata', thickness: 7, contrast: 0.85, hardShare: 0.5, jitter: 0.45 },
      { op: 'joints', pattern: 'blocky', spacing: 14, steep: 40 },
      { op: 'talus', angle: 34, cliff: 55, retreat: 0.35 },
    ],
  });
  boxes.push(...R.faces(limestonePaint({ rock: P.rock, cliff: P.cliff, scree: P.scree })));
  const T0 = terrainMesh({
    hAt: R.hAt, skip: R.skip, frame: { w: WIN.w, d: WIN.d }, eyes: Object.values(views).map((v) => v.eye), cell: 20, eyeRadius: 40,
    // the open land in flat colour (a big read: the streets, courts and fields carry the texture): sand at the shore, rock up high
    surfaceAt: (x, y, zz) => ({ fill: zz < 2.2 && !inPoly(SUMMIT, x + ox, y + oy) ? P.sand : inPoly(SUMMIT, x + ox, y + oy) || zz > 60 ? P.rock : P.ground }),
    riserTint: (h) => (h >= 4 ? P.cliff : scaleHex(P.socle, 0.95)),
    water: { z: waterZ, fill: P.sea, fillAt: seaFill },
  });
  grounds.unshift(...T0.grounds);
  boxes.push(...T0.boxes);

  skinLoose(boxes, K);
  const precinct = mvRect({ x: 600, y: 338, w: 135, d: 136 });
  return {
    boxes, grounds, views, frame: { w: WIN.w, d: WIN.d }, slots,
    stats: {
      culture, houses: slots.filter((s) => s.asset === 'ln-house').length, stairs: stairs.length, kilns: slots.filter((s) => s.asset === 'ln-kiln').length,
      olives, precinct, summit: Zs, upper: Zu, cliff, terrain: T0.stats,
      laneCells: grid.reduce((n, v) => n + (v === C.LANE ? 1 : 0), 0),
    },
    hAt: R.hAt, isSea: (x, y) => isSea(x + ox, y + oy), rock: { cells: R.grid ? R.inRock : null }, summitPoly: SUMMIT.map(mv), temple: mvRect(templeR), altar: slots.find((s) => s.asset === 'ln-altar').rect, theatre: mvRect(theatreR),
    ...(fire ? { fireSources } : {}),
    fires: fireSources.length,
    // the claim grid stays on the site's map: `origin` is where the picture's (0, 0) stands on it
    grid: { cols, rows, cell: CELL, data: grid, codes: C, origin: [ox, oy] },
  };
}

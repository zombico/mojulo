/**
 * historic/assets/egypt — the New Kingdom Thebes kit (c. 1250 BCE). Every asset follows the kit
 * contract (./kit.js): built in a canonical local frame in metres, footprint [0, W] × [0, D], its FRONT
 * facing −y, z up. Each was designed from a massing sheet dreamed on the local image worker
 * (lite-template …/assets/dream-egypt.mjs) and drawn as a blueprint before it was rendered; the
 * proportions follow the record (../record/egypt.js), not the sheet, where the two disagree (the
 * sheet's pylon towers were twice too slender).
 *
 * The temple is stone (sandstone ashlar, carved and painted), the obelisks and colossi granite, the
 * enclosure, storerooms and town Nile mud brick. The Egyptian profile everywhere: a battered wall, a
 * rounded TORUS roll up its corners and under its top, a deep flaring CAVETTO cornice over it.
 */
import { battered, slopedFlight } from './kit.js';
import { scaleHex } from '../../polygonizer/vexar.js';
import { palm } from '../patterns.js';
import { SUMER_ART } from './sumer-art.js';

const box = (kind, x, y, w, d, z0, z1, tint, o = {}) => ({ kind, x, y, w, d, z0, z1, tint, ...o });
const drum = (cx, cy, r, z0, z1, tint, o = {}) => ({ kind: o.kind || 'drum', solid: 'drum', x: cx - r, y: cy - r, w: 2 * r, d: 2 * r, z0, z1, tint, ...o });
const dome = (cx, cy, r, z0, z1, tint, o = {}) => ({ kind: o.kind || 'dome', solid: 'dome', x: cx - r, y: cy - r, w: 2 * r, d: 2 * r, z0, z1, tint, ...o });
const DARK = '#2a2420';

/** The cavetto cornice: a band flaring out from the wall top `r` by `out`, `h` tall, with its torus roll under it. */
export function cavetto(r, z, tint, { h = 1.2, out = 0.8, torus = 0.3, inside = true } = {}) {
  // `inside`: the cornice's flare stays within `r` (a wall on the slot's edge must not overhang it)
  if (inside) { const k = out + torus / 2; r = { x: r.x + k, y: r.y + k, w: r.w - 2 * k, d: r.d - 2 * k }; }
  const top = { x: r.x - out, y: r.y - out, w: r.w + 2 * out, d: r.d + 2 * out };
  return [
    box('torus', r.x - torus * 0.5, r.y - torus * 0.5, r.w + torus, r.d + torus, z - torus, z, scaleHex(tint, 1.05)),
    { kind: 'cornice', solid: 'frustum', ...r, z0: z, z1: z + h * 0.75, top, tint },
    box('cornice', top.x, top.y, top.w, top.d, z + h * 0.75, z + h, scaleHex(tint, 1.04)),
  ];
}
/** A rounded torus rod up a battered corner: a thin leaning column from (x, y) leaning by (lx, ly) over height h. */
const torusRod = (x, y, s, z0, z1, lx, ly, tint) => ({ kind: 'torus', solid: 'frustum', x, y, w: s, d: s, z0, z1, top: { x: x + lx, y: y + ly, w: s, d: s }, tint });

/**
 * A column: a round shaft with a little swelling at its foot, a capital — a closed papyrus BUD (the
 * shaft narrowing to a cap) or an open papyrus FLOWER (flaring wide) — and a square abacus.
 */
export function column(cx, cy, r, h, tint, { capital = 'bud', z = 0, sides = 12 } = {}) {
  const out = [];
  out.push(drum(cx, cy, r * 1.25, z, z + 0.4, scaleHex(tint, 0.96), { kind: 'column-base', sides }));
  const capH = h * (capital === 'open' ? 0.2 : 0.14), shaft = h - capH - 0.5;
  out.push(drum(cx, cy, r, z + 0.4, z + 0.4 + shaft, tint, { kind: 'column', sides, taper: 0.88 }));
  // the bands that tie the papyrus stems under the capital
  out.push(drum(cx, cy, r * 0.92, z + 0.4 + shaft - 0.5, z + 0.4 + shaft, scaleHex(tint, 0.9), { kind: 'column', sides }));
  const zc = z + 0.4 + shaft;
  if (capital === 'open') out.push(drum(cx, cy, r * 0.88, zc, zc + capH, tint, { kind: 'column-capital', sides, taper: 1.75 }));
  else { out.push(drum(cx, cy, r * 0.88, zc, zc + capH * 0.55, tint, { kind: 'column-capital', sides, taper: 1.15 })); out.push(drum(cx, cy, r * 1.01, zc + capH * 0.55, zc + capH, tint, { kind: 'column-capital', sides, taper: 0.62 })); }
  const a = capital === 'open' ? r * 0.85 : r * 0.7;
  out.push(box('abacus', cx - a, cy - a, 2 * a, 2 * a, zc + capH, z + h, scaleHex(tint, 1.03)));
  return out;
}

/**
 * The pylon: two battered towers, wider than they are tall, a torus roll up their corners and a deep
 * cavetto over them, flanking a lower stone gateway with its own cornice and a passage right through.
 * Each tower's front has two tall niches with cedar flagstaffs, gilded at the tip, their pennants
 * flying. The front faces the approach.
 */
export const pylon = {
  id: 'eg-pylon', sheet: 'eg-pylon', designed: true, patterns: ['pylon-gate', 'stone-ashlar', 'painted-relief', 'door-emblem'],
  read: 'Two battered stone towers, carved and painted, flanking a lower gateway; flagstaffs in niches on the front.',
  notes: [
    'Towers: battered all round except toward the gate, lean ≈ 0.1 of the height; height ≈ 0.4 of the width (Luxor ≈ 65 × 24 m).',
    'Top: a torus roll under a cavetto flaring 0.9 m; the same roll up each front and outer corner.',
    'Gateway: 0.22 of the width, 0.62 of the height, its own cornice; a passage 0.45 of its width, 0.6 of its height.',
    'Flagstaffs: two niches per tower front (dark leaning panels), a cedar pole 1.2 × the tower, gilded tip, two pennants.',
    'Next: the king smiting enemies as one colossal relief per tower, over the register skin.',
  ],
  envelope: { w: [44, 64], d: [9, 12] },
  build({ W, D }, { palette: P }) {
    const stone = P.sandstone, out = [];
    const H = Math.min(24, W * 0.4), lean = H * 0.1, gw = W * 0.22, tw = (W - gw) / 2 + 0.6;
    const towers = [{ x: 0, y: 0, w: tw, d: D, sides: ['front', 'back', 'left'] }, { x: W - tw, y: 0, w: tw, d: D, sides: ['front', 'back', 'right'] }];
    for (const t of towers) {
      const b = battered(t, 0, H, stone, lean, { sides: t.sides, kind: 'pylon' });
      out.push(b, ...cavetto(b.top, H, stone, { h: 1.6, out: 0.9, inside: false }));   // the batter already sets the top in
      // the torus rods up the front and outer corners
      const outer = t.sides.includes('left') ? 0 : 1, ox = outer ? t.x + t.w - 0.45 : t.x, lx = outer ? -lean : lean;
      out.push(torusRod(ox, 0, 0.45, 0, H, lx, lean, scaleHex(stone, 1.06)), torusRod(ox, D - 0.45, 0.45, 0, H, lx, -lean, scaleHex(stone, 1.06)));
      // flagstaff niches and their staffs, on the front face
      for (const f of [0.3, 0.7]) {
        const nx = t.x + t.w * f - 0.6;
        out.push({ kind: 'niche', solid: 'frustum', x: nx, y: -0.05, w: 1.2, d: 0.1, z0: 0.2, z1: H * 0.92, top: { x: nx, y: lean * 0.92 - 0.05, w: 1.2, d: 0.1 }, tint: scaleHex(stone, 0.62) });
        const cx = nx + 0.6, hS = H * 1.22;
        out.push(drum(cx, -0.55, 0.38, 0, hS, P.cedar, { kind: 'flagstaff', sides: 8, taper: 0.55 }));
        out.push(drum(cx, -0.55, 0.22, hS, hS + 1.4, P.gold, { kind: 'flagstaff-tip', sides: 8, taper: 0.1 }));
        out.push(box('pennant', cx - 0.03, -0.55 - 3.2, 0.06, 3.0, hS - 3.2, hS - 1.9, f < 0.5 ? P.red : P.linen), box('pennant', cx - 0.03, -0.55 - 2.6, 0.06, 2.4, hS - 5.4, hS - 4.3, f < 0.5 ? P.linen : P.blue));
      }
    }
    // the gateway: jambs and a lintel block, its own cornice, a passage right through
    const gx = (W - gw) / 2, Hg = H * 0.62, pw = gw * 0.45, ph = Hg * 0.6, jamb = (gw - pw) / 2;
    out.push(box('gate-frame', gx, -0.4, jamb, D + 0.4, 0, Hg, stone), box('gate-frame', gx + gw - jamb, -0.4, jamb, D + 0.4, 0, Hg, stone));
    out.push(box('gate-frame', gx + jamb, -0.4, pw, D + 0.4, ph, Hg, stone));
    out.push(...cavetto({ x: gx + 0.6, y: 0.2, w: gw - 1.2, d: D - 0.8 }, Hg, stone, { h: 1.3, out: 0.6 }));
    // the winged sun disc over the passage: gold on a blue ground
    out.push(box('sun-disc', W / 2 - pw * 0.7, -0.5, pw * 1.4, 0.12, ph + 0.6, ph + 1.5, P.blue), drum(W / 2, -0.62, 0.5, ph + 0.6, ph + 1.5, P.gold, { kind: 'sun-disc', sides: 10 }));
    return out;
  },
};

/** An obelisk: a granite needle on a pedestal, tapering, its pyramidion cap gilded. */
export const obelisk = {
  id: 'eg-obelisk', sheet: 'eg-obelisk', designed: true, patterns: ['obelisk', 'stone-ashlar'],
  read: 'A red-granite needle ten times as tall as its base, tapering, a gilded pyramid cap, on a stone pedestal.',
  notes: ['Shaft: base side 0.62 of the slot, height 10 × the base, top side 0.68 of the base.', 'Pyramidion: 0.9 × the base high, gilded.', 'Pedestal: the slot, 1.2 m high, sandstone.'],
  envelope: { w: [2.6, 3.4], d: [2.6, 3.4] },
  build({ W, D }, { palette: P }) {
    const b = Math.min(W, D) * 0.62, H = b * 10, t = b * 0.68, cx = W / 2, cy = D / 2, z = 1.2;
    return [
      box('pedestal', 0, 0, W, D, 0, z, P.sandstone),
      { kind: 'obelisk', solid: 'frustum', x: cx - b / 2, y: cy - b / 2, w: b, d: b, z0: z, z1: z + H, top: { x: cx - t / 2, y: cy - t / 2, w: t, d: t }, tint: P.granite },
      { kind: 'pyramidion', solid: 'frustum', x: cx - t / 2, y: cy - t / 2, w: t, d: t, z0: z + H, z1: z + H + b * 0.9, top: { x: cx - 0.02, y: cy - 0.02, w: 0.04, d: 0.04 }, tint: P.gold },
    ];
  },
};

/** A seated colossus: the king on his throne, hands on his knees, nemes and double crown, on a pedestal. */
export const colossus = {
  id: 'eg-colossus', sheet: 'eg-colossus', designed: true, patterns: ['colossus', 'stone-ashlar'],
  read: 'A seated king many times life size: a cubic throne, legs together, hands flat on the knees, the nemes headcloth and the double crown.',
  notes: ['Pedestal 1.6 m; throne a block 0.75 of the slot wide; the figure ~10 m seated.', 'Head: a block, the nemes flaring to lappets on the chest, the crown a tapering drum.', 'Granite, the throne sides carved (painted-relief skin).'],
  envelope: { w: [5, 7], d: [8, 10] },
  build({ W, D }, { palette: P }) {
    const g = P.granite, s = W / 6, cx = W / 2, z = 1.6, out = [box('pedestal', 0, 0, W, D, 0, z, P.sandstone)];
    const ty = D * 0.42, tw = W * 0.78;
    out.push(box('throne', cx - tw / 2, ty, tw, D * 0.5, z, z + 4.4 * s, scaleHex(g, 0.95)));
    // lower legs (front of the throne) and the feet, thighs on the seat
    out.push(box('statue', cx - 1.6 * s, ty - 1.4 * s, 3.2 * s, 1.5 * s, z, z + 4.2 * s, g), box('statue', cx - 1.7 * s, ty - 2.1 * s, 3.4 * s, 0.9 * s, z, z + 0.6 * s, g));
    out.push(box('statue', cx - 1.7 * s, ty - 1.4 * s, 3.4 * s, 3.4 * s, z + 4.2 * s, z + 5.4 * s, g));
    // torso, arms along it to the hands on the knees, the broad collar
    out.push({ kind: 'statue', solid: 'frustum', x: cx - 1.5 * s, y: ty + 0.4 * s, w: 3 * s, d: 1.8 * s, z0: z + 5.4 * s, z1: z + 8.6 * s, top: { x: cx - 1.9 * s, y: ty + 0.5 * s, w: 3.8 * s, d: 1.6 * s }, tint: g });
    for (const o of [-1, 1]) out.push(box('statue', cx + o * 1.9 * s - 0.4 * s, ty - 1.1 * s, 0.8 * s, 2.6 * s, z + 5.4 * s, z + 6.0 * s, g));
    out.push(box('collar', cx - 1.8 * s, ty + 0.3 * s, 3.6 * s, 0.25 * s, z + 7.6 * s, z + 8.4 * s, P.blue));
    // head in the nemes, the lappets on the chest, the double crown
    out.push(box('statue', cx - 0.75 * s, ty + 0.6 * s, 1.5 * s, 1.4 * s, z + 8.6 * s, z + 10.2 * s, g));
    out.push({ kind: 'nemes', solid: 'frustum', x: cx - 1.3 * s, y: ty + 0.8 * s, w: 2.6 * s, d: 1.4 * s, z0: z + 8.3 * s, z1: z + 10.4 * s, top: { x: cx - 0.85 * s, y: ty + 0.8 * s, w: 1.7 * s, d: 1.4 * s }, tint: scaleHex(P.yellow, 0.9) });
    for (const o of [-1, 1]) out.push(box('nemes', cx + o * 1.0 * s - 0.25 * s, ty + 0.35 * s, 0.5 * s, 0.4 * s, z + 7.4 * s, z + 8.6 * s, scaleHex(P.yellow, 0.9)));
    out.push(drum(cx, ty + 1.4 * s, 0.75 * s, z + 10.2 * s, z + 12.2 * s, P.linen, { kind: 'crown', sides: 10, taper: 0.45 }));
    out.push(drum(cx, ty + 1.4 * s, 0.95 * s, z + 10.2 * s, z + 10.9 * s, P.red, { kind: 'crown', sides: 10, taper: 0.95 }));
    return out;
  },
};

/** One ram-headed sphinx (criosphinx): a recumbent lion with a ram's head and curled horns, a small king between its paws. Front (−y) = its head. */
function criosphinx(x0, y0, P) {
  const s = P.sandstone, k = scaleHex(s, 0.94), out = [];
  out.push(box('pedestal', x0, y0, 2.2, 5.6, 0, 1.0, scaleHex(s, 1.02)));
  const cx = x0 + 1.1, y = y0 + 0.4, z = 1.0;
  out.push(box('sphinx', cx - 0.7, y + 1.3, 1.4, 3.6, z, z + 1.3, k));                       // the body, lying
  out.push(box('sphinx', cx - 0.75, y + 3.6, 1.5, 1.3, z, z + 1.55, k));                     // the haunches
  for (const o of [-1, 1]) out.push(box('sphinx', cx + o * 0.45 - 0.22, y, 0.44, 1.5, z, z + 0.4, k));   // forelegs and paws
  out.push(box('sphinx', cx - 0.65, y + 0.8, 1.3, 0.8, z, z + 1.9, k));                      // the chest
  // the ram's head held high over the chest: a block skull, the long muzzle forward and down, the
  // headcloth's lappets either side, the horns curling round beside it
  out.push(box('sphinx', cx - 0.45, y + 0.75, 0.9, 1.0, z + 1.75, z + 2.7, k));
  out.push({ kind: 'sphinx', solid: 'frustum', x: cx - 0.3, y: y + 0.25, w: 0.6, d: 0.6, z0: z + 1.7, z1: z + 2.45, top: { x: cx - 0.24, y: y + 0.4, w: 0.48, d: 0.45 }, tint: k });
  for (const o of [-1, 1]) out.push(box('nemes', cx + o * 0.5 - 0.1, y + 0.85, 0.2, 0.7, z + 1.3, z + 2.5, scaleHex(P.blue, 1.4)));
  for (const o of [-1, 1]) out.push({ kind: 'horn', solid: 'ring', x: cx + o * 0.66 - 0.3, y: y + 1.0, w: 0.6, d: 0.22, z0: z + 2.0, z1: z + 2.6, band: 0.17, tint: scaleHex(k, 0.86), plane: 'y' });
  out.push(box('sphinx-king', cx - 0.25, y + 0.15, 0.5, 0.45, z, z + 1.25, scaleHex(k, 0.9)));   // the king, small, between the paws
  return out;
}
/** A row of criosphinxes along the slot's width, each on its pedestal, heads to the front (the way). */
export const sphinxRow = {
  id: 'eg-sphinx-row', sheet: 'eg-sphinx', designed: true, patterns: ['guardians', 'processional-axis'],
  read: 'Ram-headed sphinxes in a row, each on its own pedestal, facing the processional way.',
  notes: ['Each 2.2 × 5.6 m on a 1 m pedestal; ram head and ring horns; a small king between the paws.', 'Spaced every ~4.2 m along the slot.'],
  envelope: { w: [20, 60], d: [5.6, 6.2] },
  build({ W }, { palette: P }) {
    const every = 4.2, n = Math.max(1, Math.floor((W + 2) / every)), x0 = (W - (n - 1) * every - 2.2) / 2, out = [];
    for (let i = 0; i < n; i++) out.push(...criosphinx(x0 + i * every, 0, P));
    return out;
  },
};

/** A peristyle court: an open paved court, a roofed colonnade of bud columns down both sides; the front and back are the pylons'. */
export const court = {
  id: 'eg-court', sheet: 'eg-court', designed: true, patterns: ['colonnade', 'stone-ashlar', 'painted-relief'],
  read: 'An open court, sides walled and carved, a colonnade of papyrus-bud columns under a flat roof along each side.',
  notes: ['Side walls 1.6 thick, 9 m with cornice; columns r 0.85, 7.5 m, every ~4.6 m, 3.4 m in from the wall.', 'Architrave on the columns; roof slab from the wall to it.', 'Open front and back: the pylons close them.'],
  envelope: { w: [36, 50], d: [30, 44] },
  build({ W, D }, { palette: P }) {
    const s = P.sandstone, t = 1.6, H = 9, ch = 7.5, out = [];
    for (const x of [0, W - t]) { out.push(box('temple-wall', x, 0, t, D, 0, H, s)); out.push(...cavetto({ x, y: 0, w: t, d: D }, H, s, { h: 0.9, out: 0.5 })); }
    const n = Math.max(3, Math.round((D - 4) / 4.6)), step = (D - 4) / (n - 1);
    for (const side of [0, 1]) {
      const cx = side ? W - t - 3.4 : t + 3.4;
      for (let i = 0; i < n; i++) out.push(...column(cx, 2 + i * step, 0.85, ch, s));
      const ax = side ? cx - 0.9 : t, aw = side ? W - t - (cx - 0.9) : cx + 0.9 - t;
      out.push(box('architrave', cx - 0.9, 0.8, 1.8, D - 1.6, ch, ch + 0.9, s), box('temple-roof', ax, 0.8, aw, D - 1.6, ch + 0.9, ch + 1.4, scaleHex(s, 1.04)));
    }
    // the court's flags lie clear of the enclosure floor under them, for the World's depth test
    return { boxes: out, grounds: [{ kind: 'court', x: t, y: 0, w: W - 2 * t, d: D, z: 0.08, fill: P.paving, surface: 'flagstone' }] };
  },
};

/**
 * The hypostyle hall: a forest of columns under a stone roof. Down the middle a taller nave on two rows
 * of open-papyrus columns, lit by clerestory grilles over the side aisles' roof; the aisles on rows of
 * bud columns. Doors on the axis, front and back.
 */
export const hypostyle = {
  id: 'eg-hypostyle', sheet: 'eg-hypostyle', designed: true, patterns: ['hypostyle', 'stone-ashlar', 'painted-relief'],
  read: 'A walled hall roofed on rows of columns; the central nave taller, on open-papyrus columns, a clerestory of stone grilles over the aisles.',
  notes: ['Reduced from Karnak (134 columns, 103 × 52 m) to a big read in plan: 2 rows of nave columns, 3 rows each side.', 'Heights near the true ones: nave columns r 1.6, 19 m, open capitals (Karnak 21 m); aisle columns r 1.2, 14 m, bud capitals (Karnak 15 m).', 'Clerestory: a wall from the aisle roof to the nave roof with dark grille slots.', 'Walls carved and painted; doors 6 m wide on the axis, front and back.'],
  envelope: { w: [40, 52], d: [28, 40] },
  build({ W, D }, { palette: P }) {
    const s = P.sandstone, t = 2, Ha = 14, Hn = 19, nave = 12, clr = nave / 2 + 2.4, out = [];   // clr: the clerestory stands clear of the open capitals
    const door = 6, dh = 10, cxm = W / 2;
    // walls, the front and back broken by the axial door under a lintel
    out.push(box('temple-wall', 0, 0, t, D, 0, Ha + 1, s), box('temple-wall', W - t, 0, t, D, 0, Ha + 1, s));
    for (const y of [0, D - t]) out.push(box('temple-wall', t, y, cxm - door / 2 - t, t, 0, Ha + 1, s), box('temple-wall', cxm + door / 2, y, W - t - cxm - door / 2, t, 0, Ha + 1, s), box('temple-wall', cxm - door / 2, y, door, t, dh, Ha + 1, s));
    out.push(...cavetto({ x: 0, y: 0, w: W, d: D }, Ha + 1, s, { h: 1.1, out: 0.6 }));
    // the nave: two rows of open-papyrus columns either side of the axis
    const rows = Math.max(4, Math.round((D - 2 * t - 3) / 5.4)), step = (D - 2 * t - 3) / (rows - 1), y0 = t + 1.5;
    for (const o of [-1, 1]) for (let i = 0; i < rows; i++) out.push(...column(cxm + o * nave / 2, y0 + i * step, 1.35, Hn, s, { capital: 'open' }));
    // the aisles: three rows of bud columns each side
    const aisle = W / 2 - t - clr - 0.6;
    for (const o of [-1, 1]) for (let k = 0; k < 3; k++) {
      const cx = cxm + o * (clr + 0.6 + (k + 0.5) * aisle / 3);
      for (let i = 0; i < rows; i++) out.push(...column(cx, y0 + i * step, 1.2, Ha, s));
    }
    // roofs: the aisles at Ha, the nave at Hn; the clerestory walls between, with grille slots
    out.push(box('temple-roof', t, t, cxm - clr - t, D - 2 * t, Ha, Ha + 0.8, scaleHex(s, 1.04)), box('temple-roof', cxm + clr, t, W - t - cxm - clr, D - 2 * t, Ha, Ha + 0.8, scaleHex(s, 1.04)));
    out.push(box('temple-roof', cxm - clr - 0.4, t, 2 * clr + 0.8, D - 2 * t, Hn, Hn + 0.9, scaleHex(s, 1.04)));
    for (const o of [-1, 1]) {
      const x = cxm + o * clr - 0.4;
      out.push(box('clerestory', x, t, 0.8, D - 2 * t, Ha + 0.8, Hn, s));
      for (let i = 0; i < rows - 1; i++) out.push(box('grille', x + (o < 0 ? -0.06 : 0.8), y0 + (i + 0.5) * step - 1, 0.06, 2, Ha + 1.3, Hn - 0.6, DARK));
    }
    // the nave's ends, closed in stone between the aisle roof and the nave roof
    for (const y of [t, D - t - 0.8]) out.push(box('clerestory', cxm - clr - 0.4, y, 2 * clr + 0.8, 0.8, Ha + 0.8, Hn, s));
    out.push(...cavetto({ x: cxm - clr - 0.4, y: t, w: 2 * clr + 0.8, d: D - 2 * t }, Hn + 0.9, s, { h: 0.8, out: 0.4 }));
    return { boxes: out, grounds: [{ kind: 'court', x: t, y: t, w: W - 2 * t, d: D - 2 * t, z: 0.08, fill: scaleHex(P.paving, 0.92), surface: 'flagstone' }] };
  },
};

/** The sanctuary: the god's house at the end of the axis — a long stone shrine, cornice and roll, one tall door; lower chambers either side. */
export const sanctuary = {
  id: 'eg-sanctuary', sheet: 'eg-sanctuary', designed: true, patterns: ['stone-ashlar', 'painted-relief', 'processional-axis'],
  read: 'A long flat-roofed stone shrine with a cavetto cornice and one tall door on the axis; lower chambers along its sides.',
  notes: ['Central shrine 0.45 of the width, 8 m, cornice; side chambers 5.5 m.', 'Door 3 m wide, 5.5 m high, dark, framed.'],
  envelope: { w: [20, 28], d: [24, 34] },
  build({ W, D }, { palette: P }) {
    const s = P.sandstone, cw = W * 0.45, cx = (W - cw) / 2, out = [];
    out.push(box('sanctuary', cx, 0, cw, D, 0, 8, s), ...cavetto({ x: cx, y: 0, w: cw, d: D }, 8, s, { h: 1, out: 0.5 }));
    out.push(box('shrine-wall', 0, 2, cx - 0.4, D - 2, 0, 5.5, scaleHex(s, 0.97)), box('shrine-wall', cx + cw + 0.4, 2, W - cx - cw - 0.4, D - 2, 0, 5.5, scaleHex(s, 0.97)));
    out.push(...cavetto({ x: 0, y: 2, w: cx - 0.4, d: D - 2 }, 5.5, s, { h: 0.7, out: 0.35 }), ...cavetto({ x: cx + cw + 0.4, y: 2, w: W - cx - cw - 0.4, d: D - 2 }, 5.5, s, { h: 0.7, out: 0.35 }));
    out.push(box('door-frame', W / 2 - 2.1, -0.25, 4.2, 0.3, 0, 6.4, scaleHex(s, 1.05)), box('door', W / 2 - 1.5, -0.3, 3, 0.1, 0, 5.5, DARK));
    return out;
  },
};

/** A run of the temple enclosure: a thick, tall Nile-brick wall, battered both faces, a flat walk on top. */
export const temenosWall = {
  id: 'eg-temenos-wall', sheet: 'eg-temenos-gate', designed: true, patterns: ['sacred-precinct', 'sun-dried-earth'],
  read: 'A massive mud-brick enclosure wall, battered on both faces, plain and blank: the god\'s house walled off from the town.',
  notes: ['Courses straight, not wavy: pan-bedding is Late Period, not New Kingdom.', 'Batter 0.08 of the height each face.'],
  envelope: { w: [6, 200], d: [5, 7] },
  build({ W, D }, { palette: P }) {
    const H = 10;
    return [battered({ x: 0, y: 0, w: W, d: D }, 0, H, P.mud, H * 0.08, { sides: ['front', 'back'], kind: 'temenos-wall' })];
  },
};

/** A gate through the enclosure: a stone propylon with a cavetto, set in the brick wall, a passage through. */
export const temenosGate = {
  id: 'eg-temenos-gate', sheet: 'eg-temenos-gate', designed: true, patterns: ['pylon-gate', 'stone-ashlar', 'painted-relief'],
  read: 'A stone gateway with a cavetto cornice standing proud of the brick enclosure, a tall passage through it.',
  notes: ['Block 14 × 9 m in plan, 13 m high; passage 4.5 × 8 m.'],
  envelope: { w: [12, 16], d: [8, 10] },
  build({ W, D }, { palette: P }) {
    const s = P.sandstone, H = 13, pw = 4.5, ph = 8, j = (W - pw) / 2, out = [];
    out.push(box('temple-wall', 0, 0, j, D, 0, H, s), box('temple-wall', W - j, 0, j, D, 0, H, s), box('temple-wall', j, 0, pw, D, ph, H, s));
    out.push(...cavetto({ x: 0, y: 0, w: W, d: D }, H, s, { h: 1.2, out: 0.7 }));
    out.push(box('sun-disc', W / 2 - 2.6, -0.12, 5.2, 0.12, ph + 0.5, ph + 1.4, P.blue), drum(W / 2, -0.25, 0.45, ph + 0.5, ph + 1.4, P.gold, { kind: 'sun-disc', sides: 10 }));
    return out;
  },
};

/** The sacred lake: a stone-lined rectangular pool sunk in the enclosure, stairs down its two long sides. */
export const sacredLake = {
  id: 'eg-sacred-lake', sheet: 'eg-sacred-lake', designed: true, patterns: ['sacred-lake', 'stone-ashlar'],
  read: 'A rectangular pool lined in stone, its water well below the court, flights of steps down into it, a kerb round the top.',
  notes: ['Water 2.6 m down; walls sandstone, plumb; a kerb 0.6 wide, 0.4 high.', 'Two stairs on the long sides, 1:1.6, 3 m wide.'],
  envelope: { w: [30, 44], d: [20, 30] },
  build({ W, D }, { palette: P }) {
    const s = P.sandstone, z = -2.6, k = 0.6, out = [];
    // the kerb round the rim
    out.push(box('lake-wall', 0, 0, W, k, 0, 0.4, s), box('lake-wall', 0, D - k, W, k, 0, 0.4, s), box('lake-wall', 0, k, k, D - 2 * k, 0, 0.4, s), box('lake-wall', W - k, k, k, D - 2 * k, 0, 0.4, s));
    // the lining: four inner faces down to the water
    const i = { x: k, y: k, w: W - 2 * k, d: D - 2 * k };
    out.push({ kind: 'lake-wall', solid: 'panel', pts: [[i.x, i.y, 0], [i.x + i.w, i.y, 0], [i.x + i.w, i.y, z], [i.x, i.y, z]], out: [0, 1, 0], x: i.x, y: i.y, w: i.w, d: 0.01, z0: z, z1: 0, tint: s });
    out.push({ kind: 'lake-wall', solid: 'panel', pts: [[i.x, i.y + i.d, 0], [i.x + i.w, i.y + i.d, 0], [i.x + i.w, i.y + i.d, z], [i.x, i.y + i.d, z]], out: [0, -1, 0], x: i.x, y: i.y + i.d - 0.01, w: i.w, d: 0.01, z0: z, z1: 0, tint: s });
    out.push({ kind: 'lake-wall', solid: 'panel', pts: [[i.x, i.y, 0], [i.x, i.y + i.d, 0], [i.x, i.y + i.d, z], [i.x, i.y, z]], out: [1, 0, 0], x: i.x, y: i.y, w: 0.01, d: i.d, z0: z, z1: 0, tint: s });
    out.push({ kind: 'lake-wall', solid: 'panel', pts: [[i.x + i.w, i.y, 0], [i.x + i.w, i.y + i.d, 0], [i.x + i.w, i.y + i.d, z], [i.x + i.w, i.y, z]], out: [-1, 0, 0], x: i.x + i.w - 0.01, y: i.y, w: 0.01, d: i.d, z0: z, z1: 0, tint: s });
    // stairs down into the water on both long sides
    const run = 2.6 * 1.6;
    out.push(...slopedFlight({ x: W / 2 - 1.5, y: k, w: 3, d: run }, z, 0, P.stair, 'y-', { cheek: 0.3, cheekTint: s, riser: 0.3 }).map((b) => ({ ...b, kind: b.kind === 'stair-cheek' ? 'stair-cheek' : 'quay-stair' })));
    out.push(...slopedFlight({ x: W / 2 - 1.5, y: D - k - run, w: 3, d: run }, z, 0, P.stair, 'y+', { cheek: 0.3, cheekTint: s, riser: 0.3 }).map((b) => ({ ...b, kind: b.kind === 'stair-cheek' ? 'stair-cheek' : 'quay-stair' })));
    return { boxes: out, grounds: [{ kind: 'lake-water', x: i.x, y: i.y, w: i.w, d: i.d, z: z + 0.3, fill: P.water }] };
  },
};

/** The temple quay on the Nile: a stone landing stage, stairs down its river face into the water. The front (−y) is the river. */
export const quay = {
  id: 'eg-quay', sheet: 'eg-quay', designed: true, patterns: ['river-front', 'stone-ashlar'],
  read: 'A raised stone landing on the river bank, a broad stair down its river face, ramps of steps at its sides.',
  notes: ['Platform from below the water to 0.6 m over the bank; a stair 0.6 of the width down to the water, 1:1.5.', 'Kerb; sandstone.'],
  envelope: { w: [20, 30], d: [14, 20] },
  build({ W, D, slot }, { palette: P }) {
    const s = P.sandstone, wz = slot.waterZ ?? -2.6, top = 0.6, sw = W * 0.6, run = (top - wz) * 1.5, out = [];
    out.push(box('quay', 0, run, W, D - run, wz - 0.5, top, s));
    out.push(...slopedFlight({ x: (W - sw) / 2, y: 0, w: sw, d: run }, wz, top, P.stair, 'y+', { cheek: 0.5, cheekTint: s, riser: 0.3 }).map((b) => ({ ...b, kind: b.kind === 'stair-cheek' ? 'stair-cheek' : 'quay-stair' })));
    out.push(box('quay', 0, run * 0.25, (W - sw) / 2 - 0.5, run * 0.75, wz - 0.5, top, s), box('quay', W - (W - sw) / 2 + 0.5, run * 0.25, (W - sw) / 2 - 0.5, run * 0.75, wz - 0.5, top, s));
    return { boxes: out, grounds: [{ kind: 'court', x: 0, y: run, w: W, d: D - run, z: top + 0.02, fill: P.paving, surface: 'flagstone' }] };
  },
};

/**
 * A town house, Theban: mud brick, flat-roofed, often two or three storeys in town (the tomb paintings
 * show them tall). Small high windows, a framed door, a roof terrace with a shelter on palm-log posts
 * and a wind-catcher open to the north wind.
 */
export const house = {
  id: 'eg-house', sheet: 'eg-house', designed: true, patterns: ['flat-roof-cube', 'sun-dried-earth', 'whitewash', 'blank-wall'],
  read: 'A flat-roofed mud-brick house of two or three storeys, small high windows, a framed door, a roof shelter on posts and a slanted wind-catcher.',
  notes: ['Storeys 3 m; small lots one storey plus the roof shelter, larger lots two or three.', 'Wind-catcher: a sloped hood on the roof, open to one side.', 'Door frame painted red; whitewash on a share of houses.'],
  envelope: { w: [6, 14], d: [6, 14] },
  build({ W, D }, { palette: P, rng }) {
    const area = W * D, floors = area < 60 ? 1 : area < 110 ? 2 : 3, H = floors * 3 + 0.4;
    const white = rng() < 0.3, tint = white ? P.whitewash[Math.floor(rng() * 2)] : P.earth[Math.floor(rng() * P.earth.length)];
    const k = 0.2, dark = DARK, out = [box('house', k, k, W - 2 * k, D - 2 * k, 0, H, tint)];
    // the roof: a parapet, a shelter over a third of it, the wind-catcher
    const t = 0.3, ph = 0.8;
    out.push(box('house-parapet', k, k, W - 2 * k, t, H, H + ph, tint), box('house-parapet', k, D - k - t, W - 2 * k, t, H, H + ph, tint), box('house-parapet', k, k + t, t, D - 2 * k - 2 * t, H, H + ph, tint), box('house-parapet', W - k - t, k + t, t, D - 2 * k - 2 * t, H, H + ph, tint));
    const sx = W * 0.55, sw = W - k - t - sx, sd = Math.min(3.2, D * 0.45);
    for (const [px, py] of [[sx, D - k - t - sd], [sx + sw - 0.25, D - k - t - sd]]) out.push(box('post', px, py, 0.22, 0.22, H, H + 2.3, P.palmwood));
    out.push(box('awning', sx - 0.1, D - k - t - sd - 0.2, sw + 0.2, sd + 0.2, H + 2.3, H + 2.5, P.reed));
    out.push({ kind: 'wind-catcher', solid: 'wedge', x: W * 0.18, y: D * 0.35, w: 1.4, d: 1.6, z0: H, z1: H + 1.8, rise: 'y-', tint: scaleHex(tint, 0.96) });
    out.push(box('wind-catcher', W * 0.18, D * 0.35 - 0.1, 1.4, 0.1, H, H + 1.4, dark));
    // the door, framed, and small high windows on the street front and a side
    out.push(box('door-frame', W / 2 - 0.85, k - 0.12, 1.7, 0.14, 0, 2.6, P.red), box('door', W / 2 - 0.55, k - 0.16, 1.1, 0.1, 0, 2.2, dark));
    for (let f = 0; f < floors; f++) for (const fx of [0.2, 0.75]) out.push(box('window', W * fx - 0.35, k - 0.1, 0.7, 0.08, f * 3 + 2.0, f * 3 + 2.6, dark));
    return out;
  },
};

/**
 * A villa, Amarna's plan: a square house with a raised central hall lit by a clerestory, a columned
 * porch, inside a walled garden with a pool, a row of domed silos and a little shrine.
 */
export const villa = {
  id: 'eg-villa', sheet: 'eg-villa', designed: true, patterns: ['courtyard-house', 'whitewash', 'granary', 'grove-fringe'],
  read: 'A whitewashed house with a raised central hall and clerestory, a columned porch, in a walled garden with a pool, silos and trees.',
  notes: ['Garden wall 0.5 × 2.4 m around the lot, a gate on the street front.', 'House 0.5 of the lot, 4 m; the hall raised to 6.2 with clerestory slots.', 'Pool 0.18 × 0.22 of the lot; three silos; two palms.'],
  envelope: { w: [16, 28], d: [16, 28] },
  build({ W, D }, { palette: P, rng }) {
    const t = 0.5, gh = 2.4, g = 2.4, out = [], wash = P.whitewash[0];
    out.push(box('garden-wall', 0, 0, (W - g) / 2, t, 0, gh, P.mud), box('garden-wall', (W + g) / 2, 0, (W - g) / 2, t, 0, gh, P.mud));
    out.push(box('garden-wall', 0, D - t, W, t, 0, gh, P.mud), box('garden-wall', 0, t, t, D - 2 * t, 0, gh, P.mud), box('garden-wall', W - t, t, t, D - 2 * t, 0, gh, P.mud));
    // the house at the back, its porch toward the garden and the gate
    const hw = W * 0.55, hd = D * 0.42, hx = (W - hw) / 2, hy = D - t - 1 - hd;
    out.push(box('villa', hx, hy, hw, hd, 0, 4, wash));
    const cw = hw * 0.4, cd = hd * 0.45, cx = W / 2 - cw / 2, cy = hy + hd / 2 - cd / 2;
    out.push(box('villa-hall', cx, cy, cw, cd, 4, 6.2, scaleHex(wash, 0.98)));
    for (const fx of [0.25, 0.5, 0.75]) out.push(box('grille', cx + cw * fx - 0.3, cy - 0.06, 0.6, 0.08, 4.6, 5.8, DARK));
    for (const fx of [0.2, 0.4, 0.6, 0.8]) out.push(...column(hx + hw * fx, hy - 1.4, 0.22, 3.2, P.palmwood, { sides: 8 }));
    out.push(box('awning', hx + hw * 0.12, hy - 2.0, hw * 0.76, 2.0, 3.2, 3.5, wash), box('door', W / 2 - 0.6, hy - 0.06, 1.2, 0.08, 0, 2.4, DARK));
    // silos in a row along one side, the pool in the garden, two palms
    for (let i = 0; i < 3; i++) { const sx = t + 2 + i * 2.6, sy = t + 2.2; out.push(drum(sx, sy, 1.1, 0, 2.0, scaleHex(P.mud, 1.25), { kind: 'silo', sides: 12 }), dome(sx, sy, 1.1, 2.0, 3.6, scaleHex(P.mud, 1.25), { kind: 'silo', sides: 12 })); }
    const pw = W * 0.18, pd = D * 0.22, px = W * 0.62, py = D * 0.14;
    out.push(box('pool-kerb', px - 0.3, py - 0.3, pw + 0.6, pd + 0.6, 0, 0.35, P.sandstone), box('pool', px, py, pw, pd, 0.35, 0.37, P.water));
    out.push(palm(px - 1.6, py + pd + 1.6, rng), palm(px + pw + 1.4, py - 0.8 > 1 ? py - 0.2 : py + 1, rng));
    return { boxes: out, grounds: [{ kind: 'court', x: t, y: t, w: W - 2 * t, d: D - 2 * t, z: 0.03, fill: P.field[0] }] };
  },
};

/** A shaduf: an upright frame, a long sweep pole on a pivot, mud counterweight on the short end, a bucket on a rope from the long. Front: the water. */
export const shaduf = {
  id: 'eg-shaduf', sheet: 'eg-shaduf', designed: true, patterns: ['shaduf', 'river-front'],
  read: 'Two posts and a crossbar; a long pole pivoting on it, a lump of mud at the back, a bucket hanging over the water at the front.',
  notes: ['Posts 2.4 m; pole 5.5 m tipped up toward the back; bucket 1.4 m below the pole end.', 'A small brick channel carries the water back to the field.'],
  envelope: { w: [2.4, 3.2], d: [6, 7] },
  build({ W, D }, { palette: P }) {
    const wood = P.palmwood, cx = W / 2, py = D * 0.55, out = [];
    out.push(box('post', cx - 0.75, py - 0.12, 0.24, 0.24, 0, 2.6, wood), box('post', cx + 0.51, py - 0.12, 0.24, 0.24, 0, 2.6, wood), box('post', cx - 0.75, py - 0.12, 1.5, 0.24, 2.6, 2.8, wood));
    // the sweep: a thin leaning prism from the bucket end (front, low) to the counterweight (back, high)
    out.push({ kind: 'pole', solid: 'frustum', x: cx - 0.07, y: 0.4, w: 0.14, d: 0.14, z0: 2.0, z1: 2.15, top: { x: cx - 0.07, y: D - 0.6, w: 0.14, d: 0.14 }, tint: wood });
    out.push({ kind: 'pole', solid: 'frustum', x: cx - 0.07, y: 0.4, w: 0.14, d: D - 1.0, z0: 2.0, z1: 2.14, top: { x: cx - 0.07, y: 0.4, w: 0.14, d: D - 1.0 }, tint: wood });
    out.push(dome(cx, D - 0.7, 0.45, 1.75, 2.6, P.mud, { kind: 'counterweight', sides: 8 }));
    out.push(box('rope', cx - 0.02, 0.45, 0.04, 0.04, 0.9, 2.0, P.reed), drum(cx, 0.47, 0.28, 0.45, 0.9, P.mud, { kind: 'bucket', sides: 8, open: true, lip: 0.05 }));
    out.push(box('channel', cx - 0.35, 1.2, 0.7, D - 1.2, 0, 0.3, P.mud), box('channel-water', cx - 0.2, 1.2, 0.4, D - 1.2, 0.3, 0.31, P.water));
    return out;
  },
};

/** A Nile ship: a long wooden hull with up-swept ends, a tall mast and a broad square sail between two yards, a cabin amidships, two steering oars at the stern. Front (−y) = its port side; the bow is +x. */
export const nileShip = {
  id: 'eg-nile-ship', sheet: 'eg-nile-ship', designed: true, patterns: ['boat', 'river-front'],
  read: 'A long wooden hull rising at both ends, a single mast with a wide sail between two yards, a cabin, steering oars at the stern.',
  notes: ['Hull 20 × 4 m, 1.4 m freeboard; ends rise to 3.2 m.', 'Mast 11 m; sail 10 × 7 m on yards; cabin 4 × 2.4 m; two steering oars, posts at the stern.'],
  envelope: { w: [18, 22], d: [10.6, 11.2] },   // the slot is as wide as the sail, set square across the hull
  build({ W, D }, { palette: P }) {
    const wood = P.cedar, out = [], cy = D / 2, B = 4;
    out.push(box('hull', W * 0.12, cy - B / 2 + 0.2, W * 0.76, B - 0.4, 0, 1.4, wood));
    out.push({ kind: 'hull', solid: 'frustum', x: W * 0.88, y: cy - B / 2 + 0.5, w: W * 0.06, d: B - 1, z0: 0.2, z1: 2.4, top: { x: W * 0.94, y: cy - 0.35, w: W * 0.05, d: 0.7 }, tint: wood });
    out.push({ kind: 'hull', solid: 'frustum', x: W * 0.06, y: cy - B / 2 + 0.5, w: W * 0.06, d: B - 1, z0: 0.2, z1: 3.2, top: { x: W * 0.01, y: cy - 0.3, w: W * 0.05, d: 0.6 }, tint: wood });
    out.push(box('cabin', W * 0.3, cy - 1.2, 4, 2.4, 1.4, 3.2, P.linen), box('cabin', W * 0.3 - 0.1, cy - 1.3, 4.2, 2.6, 3.2, 3.4, P.red));
    const mx = W * 0.56;
    out.push(drum(mx, cy, 0.22, 1.4, 12.4, wood, { kind: 'mast', sides: 8, taper: 0.6 }));
    out.push(box('yard', mx - 0.15, cy - 5.2, 0.3, 10.4, 11.6, 11.9, wood), box('yard', mx - 0.15, cy - 5.2, 0.3, 10.4, 4.4, 4.7, wood));
    out.push(box('sail', mx - 0.08, cy - 5, 0.06, 10, 4.7, 11.6, P.linen));
    for (const o of [-1, 1]) {
      out.push(box('stern-post', W * 0.15, cy + o * 1.1 - 0.12, 0.24, 0.24, 1.4, 3.8, wood));
      out.push({ kind: 'steering-oar', solid: 'frustum', x: W * 0.13, y: cy + o * 1.4 - 0.1, w: 0.2, d: 0.2, z0: 3.6, z1: 3.8, top: { x: W * 0.02, y: cy + o * 1.6 - 0.1, w: 0.2, d: 0.2 }, tint: wood });
    }
    return out;
  },
};

/** An offering table before the god: a low stone table heaped with loaves and jars on a stepped platform, tall jars on stands beside it. */
export const offering = {
  id: 'eg-offering', sheet: 'eg-offering', designed: true, patterns: ['altar', 'stone-ashlar'],
  read: 'A stepped stone platform, a low table on it heaped with loaves and jars, a tall jar on a stand either side.',
  notes: ['Platform 2 steps; table 2 × 1.2 m at 0.9 m.', 'Loaves small domes, jars drums; stands 1.1 m.'],
  envelope: { w: [4, 6], d: [4, 6] },
  build({ W, D }, { palette: P }) {
    const s = P.sandstone, out = [box('plinth', 0, 0, W, D, 0, 0.25, s), box('plinth', W * 0.12, D * 0.12, W * 0.76, D * 0.76, 0.25, 0.5, scaleHex(s, 1.03))];
    out.push(box('altar', W / 2 - 1, D / 2 - 0.6, 2, 1.2, 0.5, 1.3, scaleHex(s, 0.97)));
    for (const [fx, fy] of [[-0.6, -0.25], [-0.15, 0.2], [0.35, -0.2], [0.7, 0.25]]) out.push(dome(W / 2 + fx, D / 2 + fy, 0.22, 1.3, 1.55, P.yellow, { kind: 'loaf', sides: 8 }));
    out.push(drum(W / 2 + 0.15, D / 2 + 0.05, 0.16, 1.3, 1.75, P.red, { kind: 'jar', sides: 8, taper: 0.7 }));
    for (const o of [-1, 1]) { const cx = W / 2 + o * (W * 0.36); out.push(drum(cx, D / 2, 0.16, 0.5, 1.6, P.palmwood, { kind: 'jar-stand', sides: 8 }), drum(cx, D / 2, 0.3, 1.6, 2.4, P.red, { kind: 'jar', sides: 10, taper: 0.55 })); }
    return out;
  },
};

// pieces the two cultures share: Egypt raised stelae and dug wells too, and its granaries are the same domed silos in a yard
const { stele, well, granary } = SUMER_ART;

export const EGYPT_ASSETS = Object.fromEntries([pylon, obelisk, colossus, sphinxRow, court, hypostyle, sanctuary, temenosWall, temenosGate, sacredLake, quay, house, villa, shaduf, nileShip, offering, stele, well, granary].map((a) => [a.id, a]));

/**
 * historic/assets/lindos — the Hellenistic Lindos kit (c. 180 BCE), built from the record
 * (../record/lindos.js) and the massing sheets dreamed on the local image worker (`sheet`). The Doric
 * order is one set of shared parts (column, entablature, gable) every building here is made of.
 * Same contract as the other kits (./kit.js): each asset builds in its slot's local frame, front = −y,
 * z up from the slot's ground. Heights the record does not give are conjecture and say so in `notes`.
 */
import { slopedFlight } from './kit.js';
import { scaleHex } from '../../polygonizer/vexar.js';

const box = (kind, x, y, w, d, z0, z1, tint, o = {}) => ({ kind, x, y, w, d, z0, z1, tint, ...o });
const drum = (kind, cx, cy, r, z0, z1, tint, o = {}) => ({ kind, solid: 'drum', x: cx - r, y: cy - r, w: 2 * r, d: 2 * r, z0, z1, tint, ...o });
const bbox = (pts) => { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), zs = pts.map((p) => p[2]); return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(0.01, Math.max(...xs) - Math.min(...xs)), d: Math.max(0.01, Math.max(...ys) - Math.min(...ys)), z0: Math.min(...zs), z1: Math.max(...zs) }; };
const panel = (kind, pts, out, tint) => ({ kind, solid: 'panel', pts, out, ...bbox(pts), tint });
const DEG = Math.PI / 180;

// ── the Doric order, shared ──

/** A Doric column: a tapering shaft (entasis read as taper), the echinus flaring out, the square abacus. */
export function doricColumn(cx, cy, r, z0, h, P, { sides = 10 } = {}) {
  const zs = z0 + h * 0.9, ze = z0 + h * 0.96;
  return [
    drum('column', cx, cy, r, z0, zs, P.stucco, { sides, taper: 0.8 }),
    drum('capital', cx, cy, r * 0.8, zs, ze, P.stucco, { sides, taper: 1.5 }),
    box('abacus', cx - r * 1.25, cy - r * 1.25, r * 2.5, r * 2.5, ze, z0 + h, P.stucco),
  ];
}
/** Columns from (x0, y) to (x1, y) (or along y with `along: 'y'`), `n` of them, ends included. */
const colonnade = (a, b, at, n, r, z0, h, P, along = 'x', o) => {
  const out = [];
  for (let i = 0; i < n; i++) { const t = n === 1 ? 0.5 : i / (n - 1), u = a + (b - a) * t; out.push(...doricColumn(along === 'x' ? u : at, along === 'x' ? at : u, r, z0, h, P, o)); }
  return out;
};
/**
 * The entablature over a rect at z: architrave, frieze (triglyphs standing proud along `faces` — the sides
 * that show: 'front' −y, 'back' +y), cornice. `h` its whole height; returns its top at z + h.
 */
export function entablature(r, z, h, P, { faces = ['front', 'back'], pitch = 1.3 } = {}) {
  const za = z + h * 0.42, zf = z + h * 0.84, out = [
    box('entablature', r.x, r.y, r.w, r.d, z, za, P.stucco),
    box('entablature', r.x + 0.04, r.y + 0.04, r.w - 0.08, r.d - 0.08, za, zf, P.stucco),
    box('entablature', r.x - 0.25, r.y - 0.25, r.w + 0.5, r.d + 0.5, zf, z + h, P.stucco),
  ];
  const n = Math.max(2, Math.round(r.w / pitch)), tw = Math.min(0.42, (r.w / n) * 0.45);
  for (const f of faces) for (let i = 0; i <= n; i++) {
    const x = r.x + (r.w * i) / n - tw / 2, y = f === 'front' ? r.y - 0.05 : r.y + r.d - 0.03;
    out.push(box('triglyph', Math.max(r.x, Math.min(r.x + r.w - tw, x)), y, tw, 0.08, za + 0.02, zf - 0.02, P.triglyph));
  }
  return out;
}
/**
 * A low gable roof of tiles over a rect at z, its ridge along `axis`, pitch in degrees; the gable ends
 * closed by pediments (`pediments`: true) in stucco. Returns the panels.
 */
export function gableRoof(r, z, pitch, P, { axis = 'y', pediments = true, eave = 0.3, tint } = {}) {
  const t = tint || P.tile, out = [], e = eave, k = Math.tan(pitch * DEG);
  if (axis === 'y') {
    const xm = r.x + r.w / 2, hr = (r.w / 2 + e) * k, y0 = r.y - e, y1 = r.y + r.d + e, s = Math.sin(pitch * DEG), c = Math.cos(pitch * DEG);
    out.push(panel('roof', [[r.x - e, y0, z], [r.x - e, y1, z], [xm, y1, z + hr], [xm, y0, z + hr]], [-s, 0, c], t));
    out.push(panel('roof', [[r.x + r.w + e, y0, z], [r.x + r.w + e, y1, z], [xm, y1, z + hr], [xm, y0, z + hr]], [s, 0, c], scaleHex(t, 0.94)));
    if (pediments) for (const [y, ny] of [[r.y - 0.02, -1], [r.y + r.d + 0.02, 1]]) out.push(panel('pediment', [[r.x - e * 0.5, y, z], [r.x + r.w + e * 0.5, y, z], [xm, y, z + hr * 0.92]], [0, ny, 0], P.stucco));
  } else {
    const ym = r.y + r.d / 2, hr = (r.d / 2 + e) * k, x0 = r.x - e, x1 = r.x + r.w + e, s = Math.sin(pitch * DEG), c = Math.cos(pitch * DEG);
    out.push(panel('roof', [[x0, r.y - e, z], [x1, r.y - e, z], [x1, ym, z + hr], [x0, ym, z + hr]], [0, -s, c], t));
    out.push(panel('roof', [[x0, r.y + r.d + e, z], [x1, r.y + r.d + e, z], [x1, ym, z + hr], [x0, ym, z + hr]], [0, s, c], scaleHex(t, 0.94)));
    if (pediments) for (const [x, nx] of [[r.x - 0.02, -1], [r.x + r.w + 0.02, 1]]) out.push(panel('pediment', [[x, r.y - e * 0.5, z], [x, r.y + r.d + e * 0.5, z], [x, ym, z + hr * 0.92]], [nx, 0, 0], P.stucco));
  }
  return out;
}
/** A lean-to of tiles over a rect, high along `high` ('back' +y or 'front' −y), falling `fall` m to the other side. */
const shedRoof = (r, z, fall, P, high = 'back', tint) => {
  const e = 0.3, zb = high === 'back' ? z + fall : z, zf = high === 'back' ? z : z + fall, k = fall / (r.d + 2 * e), n = high === 'back' ? [0, -k, 1] : [0, k, 1];
  return [panel('roof', [[r.x - e, r.y - e, zf], [r.x + r.w + e, r.y - e, zf], [r.x + r.w + e, r.y + r.d + e, zb], [r.x - e, r.y + r.d + e, zb]], n, tint || P.tile)];
};
/** Steps of a crepis: `n` steps `rise` high, each `tread` in from the one below; returns [boxes, top z, the top rect]. */
const crepis = (W, D, n, rise, tread, P) => {
  const out = [];
  for (let k = 0; k < n; k++) out.push(box('crepis', k * tread, k * tread, W - 2 * k * tread, D - 2 * k * tread, k * rise, (k + 1) * rise, P.stucco));
  return [out, n * rise, { x: n * tread, y: n * tread, w: W - 2 * n * tread, d: D - 2 * n * tread }];
};

/** A flame: two crossed cards in the colours of fire, standing on (cx, cy, z), `h` tall. The fire channel takes it from here. */
export function flame(cx, cy, z, h) {
  const w = h * 0.45, out = [];
  for (const [dx, dy, n] of [[w, 0, [0, 1, 0]], [0, w, [1, 0, 0]]]) {
    out.push(panel('flame', [[cx - dx, cy - dy, z], [cx + dx, cy + dy, z], [cx, cy, z + h]], n, '#ffb347'));
    out.push(panel('flame', [[cx - dx * 0.5, cy - dy * 0.5, z], [cx + dx * 0.5, cy + dy * 0.5, z], [cx, cy, z + h * 0.62]], n.map((v) => -v), '#ffe9a0'));
  }
  return out;
}

// ── the sanctuary ──

/** The temple of Athena Lindia: amphiprostyle tetrastyle Doric, on three steps. */
export const temple = {
  id: 'ln-temple', sheet: 'ln-temple', designed: true, patterns: ['classical-order', 'tile-roof', 'stone-ashlar'],
  read: 'A small Doric temple on three steps: four columns across the front porch and four across the back, plain side walls, a triglyph frieze, low pediments, a red tile roof.',
  notes: ['Stylobate 21.65 × 7.75 m (record); the slot adds the two lower steps.', 'Columns 5.2 m (conjecture), 0.76 m across; porches 2.8 m deep; entablature 1.5 m; roof 14°.', 'Stucco over limestone (conjecture, standard practice).'],
  envelope: { w: [8, 11], d: [22, 26] },
  build({ W, D }, { palette: P, culture: K }) {
    const [out, zs, s] = crepis(W, D, 3, 0.38, 0.42, P), H = (K && K.temple && K.temple.column) || 5.2, r = 0.38, pd = 2.8;
    out.push(...colonnade(s.x + r + 0.1, s.x + s.w - r - 0.1, s.y + r + 0.15, 4, r, zs, H, P));
    out.push(...colonnade(s.x + r + 0.1, s.x + s.w - r - 0.1, s.y + s.d - r - 0.15, 4, r, zs, H, P));
    const cy0 = s.y + pd, cy1 = s.y + s.d - pd;
    // amphiprostyle: the side walls stand flush with the stylobate's edge, under the entablature (no colonnade along the flanks)
    out.push(box('cella', s.x + 0.02, cy0, s.w - 0.04, cy1 - cy0, zs, zs + H, P.stucco));
    out.push(box('door', s.x + s.w / 2 - 0.8, cy0 - 0.06, 1.6, 0.08, zs, zs + 3.6, P.door));
    const top = zs + H, eh = 1.5;
    out.push(...entablature(s, top, eh, P));
    out.push(...gableRoof(s, top + eh, 14, P, { axis: 'y' }));
    return out;
  },
};

/**
 * Athena's altar, before the temple: a stepped block with offerings laid on it — and no fire. Her
 * sacrifices were fireless (apyra hiera, ../record/lindos.js); the altar's place is conjecture.
 */
export const altar = {
  id: 'ln-altar', sheet: 'ln-altar', designed: true, patterns: ['altar'],
  read: 'A long stone altar on a low step, garlands and cakes on its top: unlit.',
  notes: ['Unlit: the fireless rite of Athena Lindia. 1 step, block 1.2 m high.', 'Place before the temple: conjecture.'],
  envelope: { w: [3, 7], d: [2, 4] },
  build({ W, D }, { palette: P }) {
    const out = [box('crepis', 0, 0, W, D, 0, 0.3, P.stucco), box('altar', 0.4, 0.4, W - 0.8, D - 0.8, 0.3, 1.5, P.stucco), box('altar', 0.3, 0.3, W - 0.6, D - 0.6, 1.5, 1.62, P.stucco)];
    for (let i = 0; i < 3; i++) out.push(box('offering', 0.8 + i * (W - 1.6) / 3, D / 2 - 0.2, 0.4, 0.4, 1.62, 1.8, P.linen));
    return out;
  },
};

/**
 * The propylaia: a Π of Doric porticoes round a forecourt open to the stair, a door wall of five doors at
 * its back, a portico behind facing the temple court. 4.9 m façade columns (Pakkanen); plan proportions conjecture.
 */
export const propylaia = {
  id: 'ln-propylaia', sheet: 'ln-propylaia', designed: true, patterns: ['propylon', 'classical-order', 'stoa', 'tile-roof'],
  read: 'A Π of Doric porticoes: two wings reaching forward either side of a forecourt, a colonnade across its back, a wall of five doorways behind it, tile roofs.',
  notes: ['Wings 20% of the width each; the centre colonnade 35% back; the door wall at 62%, five doors 2.2 m.', 'Columns 4.9 m (record, façade); entablature 1.3 m.'],
  envelope: { w: [40, 60], d: [16, 24] },
  build({ W, D }, { palette: P, culture: K }) {
    const out = [], H = (K && K.propylaia && K.propylaia.column) || 4.9, r = 0.36, z0 = 0.6, eh = 1.3;
    out.push(box('crepis', 0, 0, W, D, 0, 0.3, P.stucco), box('crepis', 0.4, 0.4, W - 0.8, D - 0.8, 0.3, z0, P.stucco));
    const ww = W * 0.2, cy = D * 0.35, dy = D * 0.62;
    // the wings: their fronts and their inner sides colonnaded, a wall at the back and the outer side
    for (const [x0, inner] of [[0.4, 0.4 + ww], [W - 0.4 - ww, W - 0.4 - ww]]) {
      const wr = { x: x0, y: 0.4, w: ww, d: D - 0.8 };
      out.push(...colonnade(wr.x + r + 0.2, wr.x + wr.w - r - 0.2, wr.y + r + 0.2, Math.max(2, Math.round(ww / 2.4)), r, z0, H, P));
      out.push(...colonnade(wr.y + 2.8, cy - 0.5, inner + (x0 < W / 2 ? -r - 0.2 : r + 0.2), Math.max(2, Math.round((cy - 3) / 2.4)), r, z0, H, P, 'y'));
      const outer = x0 < W / 2 ? wr.x : wr.x + wr.w - 0.7;
      out.push(box('door-wall', outer, wr.y + 2.4, 0.7, wr.d - 2.4, z0, z0 + H, P.stucco), box('door-wall', wr.x, wr.y + wr.d - 0.7, wr.w, 0.7, z0, z0 + H, P.stucco));
      out.push(...entablature(wr, z0 + H, eh, P, { faces: ['front'] }), ...gableRoof(wr, z0 + H + eh, 13, P, { axis: 'y' }));
    }
    // the centre: a colonnade across the forecourt's back, the door wall, a back portico
    const c = { x: 0.4 + ww, y: cy - 0.6, w: W - 0.8 - 2 * ww, d: D - 0.4 - cy + 0.6 };
    out.push(...colonnade(c.x + r + 0.3, c.x + c.w - r - 0.3, cy, Math.max(4, Math.round(c.w / 2.3)), r, z0, H, P));
    out.push(...colonnade(c.x + r + 0.3, c.x + c.w - r - 0.3, D - 0.4 - r - 0.2, Math.max(4, Math.round(c.w / 2.5)), r, z0, H * 0.94, P));
    const door = 2.2, gaps = 5, seg = (c.w - gaps * door) / (gaps + 1);
    for (let i = 0; i <= gaps; i++) out.push(box('door-wall', c.x + i * (seg + door), dy, seg, 0.8, z0, z0 + H, P.stucco));
    for (let i = 0; i < gaps; i++) out.push(box('door-wall', c.x + seg + i * (seg + door), dy, door, 0.8, z0 + 3.4, z0 + H, P.stucco));
    out.push(...entablature(c, z0 + H, eh, P), ...gableRoof(c, z0 + H + eh, 13, P, { axis: 'x' }));
    return out;
  },
};

/**
 * The great stoa: a long Doric colonnade on the lower terrace, a wing reaching forward at each end, its
 * back wall against the upper terrace, open in the middle where the great stair climbs through it.
 * 87 m and 42 columns (record); depth, wings and column height conjecture. `gap` (slot): the stair's width.
 */
export const stoa = {
  id: 'ln-stoa', sheet: 'ln-stoa', designed: true, patterns: ['stoa', 'classical-order', 'tile-roof'],
  read: 'A long single-storey Doric colonnade, a short wing projecting forward at each end, a back wall, a lean-to tile roof; the stair rises through its middle.',
  notes: ['Main block 12 m deep; wings 9 m wide, reaching 8 m forward; columns ~2.1 m apart, 4.6 m high (conjecture).', 'The back wall opens `gap` m in the middle for the great stair.'],
  envelope: { w: [60, 92], d: [16, 22] },
  build({ W, D, slot }, { palette: P, culture: K }) {
    const S = (K && K.stoa) || {}, out = [], H = S.column || 4.6, r = 0.34, z0 = 0.35, eh = 1.2, wing = S.wing || 8, ww = 9, gap = slot.gap || 21;
    out.push(box('crepis', 0, wing, W, D - wing, 0, z0, P.stucco), box('crepis', 0, 0, ww, wing, 0, z0, P.stucco), box('crepis', W - ww, 0, ww, wing, 0, z0, P.stucco));
    const main = { x: 0, y: wing, w: W, d: D - wing }, total = S.columns || 42;
    const wingCols = 4, n = Math.max(6, total - 2 * wingCols);
    out.push(...colonnade(ww + r, W - ww - r, wing + r + 0.3, n, r, z0, H, P, 'x', { sides: 8 }));
    for (const x0 of [0, W - ww]) out.push(...colonnade(x0 + r + 0.3, x0 + ww - r - 0.3, r + 0.3, wingCols, r, z0, H, P, 'x', { sides: 8 }));
    // the back wall, open for the stair; the wings' outer walls
    const g0 = (W - gap) / 2;
    out.push(box('stoa-wall', 0, D - 0.8, g0, 0.8, z0, z0 + H, P.limestone), box('stoa-wall', W - g0, D - 0.8, g0, 0.8, z0, z0 + H, P.limestone));
    out.push(box('stoa-wall', 0, 0.8, 0.7, D - 1.6, z0, z0 + H, P.limestone), box('stoa-wall', W - 0.7, 0.8, 0.7, D - 1.6, z0, z0 + H, P.limestone));
    out.push(...entablature({ x: ww, y: main.y, w: W - 2 * ww, d: main.d }, z0 + H, eh, P, { faces: ['front'] }));
    out.push(...shedRoof({ x: ww, y: main.y, w: W - 2 * ww, d: main.d }, z0 + H + eh, 2.4, P));
    for (const x0 of [0, W - ww]) { const wr = { x: x0, y: 0, w: ww, d: D }; out.push(...entablature(wr, z0 + H, eh, P, { faces: ['front'] }), ...gableRoof(wr, z0 + H + eh, 13, P, { axis: 'y' })); }
    return out;
  },
};

/** A monumental flight between cheek walls, climbing away from its front (35 steps for the great stair). */
export const greatStair = {
  id: 'ln-stair', sheet: 'ln-stoa', designed: true, patterns: ['stone-ashlar', 'acropolis'],
  read: 'A broad straight flight of stone steps between low cheek walls, climbing from the stoa to the propylaia.',
  notes: ['Rise `rise` m (slot) in `steps` treads (record: 35 for the great stair); cheeks 0.8 m.'],
  envelope: { w: [4, 24], d: [6, 30] },
  build({ W, D, slot }, { palette: P }) {
    const rise = slot.rise ?? 3, steps = slot.steps || Math.max(4, Math.round(rise / 0.29)), tint = slot.rock ? P.rock : P.paving;
    return slopedFlight({ x: slot.cheek === false ? 0 : 0.8, y: 0, w: W - (slot.cheek === false ? 0 : 1.6), d: D }, 0, rise, tint, 'y+', { cheek: slot.cheek === false ? 0 : 0.8, cheekTint: tint, riser: rise / steps });
  },
};

/** A bronze on an inscribed base: the city's great, set up in the sanctuary. */
export const statueBase = {
  id: 'ln-statue', sheet: 'ln-statue', designed: true, patterns: ['statue-base'],
  read: 'A grey stone base, a bronze figure standing on it, one arm held out.',
  notes: ['Base 1.1 m high (Lardian stone, record); the bronze a little over life size, one arm out.'],
  envelope: { w: [1, 3], d: [1, 3] },
  build({ W, D }, { palette: P, rng }) {
    // a standing figure: legs, a draped body broader at the shoulders, a head; one arm out
    const cx = W / 2, cy = D / 2, h = 1.9 + rng() * 0.3, z = 1.1, b = P.bronze;
    return [box('base', 0.15, 0.15, W - 0.3, D - 0.3, 0, z - 0.1, P.lardos), box('base', 0.05, 0.05, W - 0.1, D - 0.1, z - 0.1, z, P.lardos),
      drum('bronze', cx, cy, 0.17, z, z + h * 0.46, b, { sides: 6, taper: 1.15 }), drum('bronze', cx, cy, 0.2, z + h * 0.46, z + h * 0.84, b, { sides: 6, taper: 1.25 }),
      { kind: 'bronze', solid: 'dome', sides: 6, x: cx - 0.12, y: cy - 0.12, w: 0.24, d: 0.24, z0: z + h * 0.84, z1: z + h, tint: b },
      box('bronze', cx + 0.2, cy - 0.06, 0.45, 0.12, z + h * 0.72, z + h * 0.78, b)];
  },
};

/**
 * Pythokritos' ship: the stern of a warship cut in relief on the rock beside the climb, the base of a
 * bronze statue on its deck (c. 180 BCE). ~5 m long (record).
 */
export const shipRelief = {
  id: 'ln-ship-relief', sheet: 'ln-ship-relief', designed: true, patterns: ['rock-relief', 'boat'],
  read: 'A warship\'s stern in high relief on a smoothed rock face: the curving sternpost, the steering oar, a statue base on the deck.',
  notes: ['The face smoothed 6 m wide, 5 m high; the stern 5 m long standing 0.4 m proud.'],
  envelope: { w: [5, 8], d: [1.5, 3] },
  build({ W, D }, { palette: P }) {
    const out = [box('rock-cut', 0, D - 0.8, W, 0.8, 0, 5, P.rock)], y = D - 1.2, k = P.rock, L = Math.min(5, W - 1), x0 = (W - L) / 2;
    // the hull's side, rising to the stern at the right, the sternpost curling back over it
    out.push(panel('relief', [[x0, y, 0.6], [x0 + L * 0.8, y, 0.6], [x0 + L, y, 2.2], [x0 + L * 0.98, y, 2.6], [x0, y, 1.5]], [0, -1, 0], scaleHex(k, 1.06)));
    out.push(panel('relief', [[x0 + L * 0.9, y - 0.02, 2.2], [x0 + L, y - 0.02, 2.4], [x0 + L * 0.9, y - 0.02, 3.6], [x0 + L * 0.82, y - 0.02, 3.3]], [0, -1, 0], scaleHex(k, 1.1)));
    out.push(box('relief', x0 + L * 0.55, y - 0.1, 0.18, 0.2, 0.2, 2.2, scaleHex(k, 0.92)));   // the steering oar
    out.push(box('base', x0 + L * 0.2, y - 0.3, 1.4, 0.7, 1.5, 2.3, scaleHex(k, 1.04)));      // the statue's base on the deck
    out.push(drum('bronze', x0 + L * 0.2 + 0.7, y + 0.05, 0.2, 2.3, 4.2, P.bronze, { sides: 6, taper: 0.8 }));
    return out;
  },
};

/** A Hellenistic tower of the acropolis circuit: a square block of ashlar. */
export const tower = {
  id: 'ln-tower', sheet: 'ln-tower', designed: true, patterns: ['stone-ashlar', 'towered-wall'],
  read: 'A square ashlar tower, flat-topped, a few slit windows.',
  notes: ['10 m high over the wall-walk ground (conjecture); the line of the walls is conjecture.'],
  envelope: { w: [6, 10], d: [6, 10] },
  build({ W, D }, { palette: P }) {
    const out = [box('tower', 0, 0, W, D, 0, 10, P.limestone), box('tower', -0.15, -0.15, W + 0.3, D + 0.3, 10, 10.4, P.limestone)];
    for (const x of [W * 0.3, W * 0.7]) out.push(box('door', x - 0.12, -0.06, 0.24, 0.08, 5.5, 7, P.door));
    return out;
  },
};
/** A run of the circuit wall, its face out to −y. */
export const wallRun = {
  id: 'ln-wall', sheet: 'ln-tower', designed: true, patterns: ['stone-ashlar', 'towered-wall'],
  read: 'A curtain of ashlar, 2.4 m thick and 7 m high.',
  notes: ['Line and height conjecture (record: 3rd c BCE wall with rectangular towers).'],
  envelope: { w: [4, 60], d: [2, 3] },
  build({ W, D }, { palette: P }) { return [box('acropolis-wall', 0, 0, W, D, 0, 7, P.limestone)]; },
};

// ── the theatre ──

/**
 * The theatre: rows of seats round a flat orchestra, cut into the hillside (19 rows, a gangway, 7 more —
 * record), a stage building in front. The bowl climbs away from the front (+y); its back is closed so it
 * sits against the slope. Diameter conjecture.
 */
export const theatre = {
  id: 'ln-theatre', sheet: 'ln-theatre', designed: true, patterns: ['theatre', 'stone-ashlar'],
  read: 'A bowl of stone seats round a round orchestra, rising up the hill; a low stone stage building in front of it.',
  notes: ['Rows `rows` (record: 19 + 7), a 2.15 m gangway after the 19th; each row 0.4 m high; 9 segments.', 'Skene 24 m × 4 m, 5 m high, a low colonnade (proskenion) before it.'],
  envelope: { w: [40, 64], d: [30, 48] },
  build({ W, D }, { palette: P, culture: K }) {
    const out = [], grounds = [], rows = (K && K.theatre && K.theatre.rows) || 26, lower = Math.min(19, rows), R = Math.min(W / 2 - 0.5, D - 8.5), ro = R * 0.26;
    const cx = W / 2, cy = D - R - 0.3, gang = 2.15, dr = (R - ro - 1.2 - gang) / rows, rise = 0.4, N = 9, a0 = -0.12, a1 = Math.PI + 0.12;
    const at = (r, a, z) => [cx + r * Math.cos(a), cy + r * Math.sin(a), z];
    const radius = (k) => ro + 1.2 + k * dr + (k >= lower ? gang : 0);
    const seat = P.rock;
    for (let k = 0; k < rows; k++) {
      const r0 = radius(k), r1 = r0 + dr + (k === lower - 1 ? gang : 0), z1 = (k + 1) * rise, z0 = k * rise;
      for (let i = 0; i < N; i++) {
        const A = a0 + ((a1 - a0) * i) / N, B = a0 + ((a1 - a0) * (i + 1)) / N, mid = (A + B) / 2;
        out.push(panel('seat', [at(r0, A, z1), at(r0, B, z1), at(r1, B, z1), at(r1, A, z1)], [0, 0, 1], scaleHex(seat, k % 2 ? 1.02 : 0.98)));
        out.push(panel('seat', [at(r0, A, z0), at(r0, B, z0), at(r0, B, z1), at(r0, A, z1)], [-Math.cos(mid), -Math.sin(mid), 0], scaleHex(seat, 0.9)));
      }
      // the bowl's two ends: a step of retaining wall at each
      for (const [a, s] of [[a0, -1], [a1, 1]]) out.push(panel('analemma', [at(r0, a, 0), at(r1, a, 0), at(r1, a, z1), at(r0, a, z1)], [Math.sin(a) * -s, Math.cos(a) * s, 0], P.limestone));
    }
    // the back of the bowl, closed
    const top = rows * rise, Rb = radius(rows - 1) + dr;
    for (let i = 0; i < N; i++) { const A = a0 + ((a1 - a0) * i) / N, B = a0 + ((a1 - a0) * (i + 1)) / N, m = (A + B) / 2; out.push(panel('analemma', [at(Rb, A, 0), at(Rb, B, 0), at(Rb, B, top), at(Rb, A, top)], [Math.cos(m), Math.sin(m), 0], P.limestone)); }
    // the orchestra, beaten earth; the stage building and its low colonnade
    grounds.push({ kind: 'orchestra', poly: Array.from({ length: 16 }, (_, i) => [cx + ro * Math.cos((i / 16) * 6.2832), cy + ro * Math.sin((i / 16) * 6.2832)]), z: 0.05, fill: P.court });
    const sy = Math.max(0.2, cy - ro - 7.5), sw = Math.min(W - 4, 24);
    out.push(box('skene', cx - sw / 2, sy, sw, 4, 0, 5, P.limestone));
    for (let i = 0; i < 8; i++) out.push(drum('column', cx - sw / 2 + 1 + (i * (sw - 2)) / 7, sy + 5.2, 0.18, 0, 2.6, P.stucco, { sides: 6 }));
    out.push(box('entablature', cx - sw / 2 + 0.6, sy + 4, sw - 1.2, 1.6, 2.6, 2.95, P.stucco));
    return { boxes: out, grounds };
  },
};

// ── the town ──

/**
 * A house on its terrace: rooms round an open court, plastered walls on a stone socle, tile roofs falling
 * to the court; a short colonnade (pastas) on the court's back side; the larger ones two storeys at the
 * back. `hearth` (slot): a fire burning in the court. No Hellenistic house at Lindos is described: by
 * analogy with Rhodes city and Ialysos (conjecture). Not whitewashed.
 */
export const house = {
  id: 'ln-house', sheet: 'ln-house', designed: true, patterns: ['courtyard-house', 'peristyle', 'blank-wall', 'tile-roof'],
  read: 'A plastered courtyard house on a stone socle: rooms round a small court, a short colonnade on one side, red tile roofs falling to the court, one door to the street.',
  notes: ['Rooms 3.2 m deep; walls 4.2 m (one storey) or 6.8 m at the back (two); roofs fall 0.8 m to the court.', 'Lots under 9 m across: one block under a gable roof.', '`hearth`: a fire in the court (the fire channel takes it).'],
  envelope: { w: [6, 18], d: [6, 18] },
  build({ W, D, slot }, { palette: P, rng }) {
    const out = [], grounds = [], h = 4.2, tone = scaleHex(P.plaster, 0.95 + rng() * 0.08), roofT = scaleHex(P.tile, 0.94 + rng() * 0.1);
    if (Math.min(W, D) < 9) {
      out.push(box('house', 0, 0, W, D, 0, h, tone), box('socle', -0.05, -0.06, W + 0.1, 0.12, 0, 0.9, P.socle), box('door', W / 2 - 0.55, -0.08, 1.1, 0.06, 0, 2.3, P.door));
      out.push(...gableRoof({ x: 0, y: 0, w: W, d: D }, h, 16, P, { axis: W >= D ? 'x' : 'y', pediments: false, eave: 0.25, tint: roofT }));
      if (slot.hearth) { out.push(drum('brazier', W - 1, -0.9, 0.35, 0, 0.6, P.bronze, { sides: 6 })); out.push(...flame(W - 1, -0.9, 0.6, 0.9)); }
      return { boxes: out, grounds };
    }
    const rd = 3.2, tall = W * D > 160 && rng() < 0.6, hb = tall ? 6.8 : h;
    const court = { x: rd, y: rd, w: W - 2 * rd, d: D - 2 * rd };
    const ranges = [
      [{ x: 0, y: 0, w: W, d: rd }, h, [0, 0.25, 1], 'front'],
      [{ x: 0, y: D - rd, w: W, d: rd }, hb, [0, -0.25, 1], 'back'],
      [{ x: 0, y: rd, w: rd, d: D - 2 * rd }, h, [0.25, 0, 1], 'left'],
      [{ x: W - rd, y: rd, w: rd, d: D - 2 * rd }, h, [-0.25, 0, 1], 'right'],
    ];
    for (const [r, hh, n, side] of ranges) {
      out.push(box('house', r.x, r.y, r.w, r.d, 0, hh, tone));
      // the roof falls toward the court: high at the outer edge
      const lo = hh, hi = hh + 0.8, e = 0.25;
      const pts = side === 'front' ? [[r.x - e, r.y - e, hi], [r.x + r.w + e, r.y - e, hi], [r.x + r.w, r.y + r.d, lo], [r.x, r.y + r.d, lo]]
        : side === 'back' ? [[r.x - e, r.y + r.d + e, hi], [r.x + r.w + e, r.y + r.d + e, hi], [r.x + r.w, r.y, lo], [r.x, r.y, lo]]
          : side === 'left' ? [[r.x - e, r.y, hi], [r.x - e, r.y + r.d, hi], [r.x + r.w, r.y + r.d, lo], [r.x + r.w, r.y, lo]]
            : [[r.x + r.w + e, r.y, hi], [r.x + r.w + e, r.y + r.d, hi], [r.x, r.y + r.d, lo], [r.x, r.y, lo]];
      out.push(panel('roof', pts, n, roofT));
    }
    out.push(box('socle', -0.05, -0.06, W + 0.1, 0.12, 0, 0.9, P.socle), box('door', W * 0.3 - 0.6, -0.08, 1.2, 0.06, 0, 2.4, P.door));
    // the pastas: three columns before the back range
    out.push(...colonnade(court.x + 0.6, court.x + court.w - 0.6, court.y + court.d - 0.5, 3, 0.16, 0, hb - 0.3, { stucco: tone }, 'x', { sides: 6 }));
    grounds.push({ kind: 'court', x: court.x, y: court.y, w: court.w, d: court.d, z: 0.05, fill: P.court, surface: 'flagstone' });
    if (slot.hearth) { const fx = court.x + court.w / 2, fy = court.y + court.d * 0.4; out.push(drum('hearth', fx, fy, 0.45, 0, 0.35, P.limestone, { sides: 6 }), ...flame(fx, fy, 0.35, 1)); }
    return { boxes: out, grounds };
  },
};

/** A flight of steps between two terrace streets, climbing away from its front. */
export const steps = {
  id: 'ln-steps', sheet: 'ln-steps', designed: true, patterns: ['terraced-hillside'],
  read: 'A short flight of rough stone steps up a terrace wall.',
  notes: ['Rise `rise` m (slot); drawn in treads 0.6 m high (each two steps: a big read).'],
  envelope: { w: [2, 9], d: [2, 12] },
  build({ W, D, slot }, { palette: P }) { const rise = slot.rise ?? 3; return slopedFlight({ x: 0, y: 0, w: W, d: D }, 0, rise, P.rock, 'y+', { riser: 0.6 }); },
};

/** A potter's kiln at the town's edge, fired: a domed chamber, its stoke-hole glowing. */
export const kiln = {
  id: 'ln-kiln', sheet: 'ln-kiln', designed: true, patterns: ['kiln', 'potters'],
  read: 'A domed kiln of clay and stone, its stoke-hole alight, pots stacked by it.',
  notes: ['Dome 3 m across, 2.4 m high; a fire in the stoke-hole (the fire channel takes it).'],
  envelope: { w: [4, 7], d: [4, 7] },
  build({ W, D, slot }, { palette: P }) {
    const cx = W / 2, cy = D / 2 + 0.4, out = [{ kind: 'kiln', solid: 'dome', sides: 8, x: cx - 1.5, y: cy - 1.5, w: 3, d: 3, z0: 0, z1: 2.4, tint: scaleHex(P.plaster, 0.85) }];
    out.push(box('kiln', cx - 0.6, cy - 2.2, 1.2, 0.8, 0, 0.9, scaleHex(P.plaster, 0.8)));
    if (slot.lit !== false) out.push(...flame(cx, cy - 2.3, 0, 0.8));
    for (let i = 0; i < 4; i++) out.push(drum('pot', 0.6 + i * 0.7, D - 0.6, 0.28, 0, 0.6, P.tile, { sides: 6, taper: 0.7 }));
    return out;
  },
};

/** The "tomb of Kleoboulos": a Hellenistic round drum of ashlar on the cape. Original height conjecture (1.7 m survives). */
export const roundTomb = {
  id: 'ln-tomb', sheet: 'ln-tomb', designed: true, patterns: ['round-tomb', 'stone-ashlar'],
  read: 'A low drum of big ashlar blocks on a rocky point, a small door, a flat top.',
  notes: ['9 m across (record); 4.2 m high as built (conjecture).'],
  envelope: { w: [9, 12], d: [9, 12] },
  build({ W, D }, { palette: P }) {
    const r = Math.min(W, D) / 2 - 0.4, cx = W / 2, cy = D / 2;
    return [drum('tomb', cx, cy, r + 0.35, 0, 0.5, P.limestone, { sides: 16 }), drum('tomb', cx, cy, r, 0.5, 4.2, P.limestone, { sides: 16 }), drum('tomb', cx, cy, r + 0.2, 4.2, 4.5, P.limestone, { sides: 16 }),
      box('door', cx - 0.5, cy - r - 0.06, 1, 0.08, 0.5, 2.1, P.door)];
  },
};

/** A Rhodian warship at anchor: long dark hull, bronze ram, upswept stern, oars shipped, sail furled. Bow toward +x. */
export const trireme = {
  id: 'ln-trireme', sheet: 'ln-trireme', designed: true, patterns: ['boat'],
  read: 'A long slender dark warship: a bronze ram at the bow, an upswept curling stern, a mast with its sail furled, oars along the side.',
  notes: ['Hull 32 m × 4.6 m (a trireme\'s, conjecture for the Rhodian type); mast 10 m.'],
  envelope: { w: [24, 36], d: [4, 6] },
  build({ W, D }, { palette: P }) {
    const c = D / 2, out = [];
    out.push({ kind: 'hull', solid: 'frustum', x: 2, y: c - 1.4, w: W - 4.5, d: 2.8, z0: -0.5, z1: 1.3, top: { x: 1, y: c - 2.1, w: W - 2.5, d: 4.2 }, tint: P.hull });
    out.push({ kind: 'ram', solid: 'wedge', rise: 'x-', x: W - 2.5, y: c - 0.35, w: 2.5, d: 0.7, z0: -0.4, z1: 0.3, tint: P.ram });
    out.push({ kind: 'hull', solid: 'wedge', rise: 'x-', x: 0, y: c - 0.6, w: 2.2, d: 1.2, z0: 0.8, z1: 4.2, tint: P.hull });
    out.push(box('deck', 2, c - 1.6, W - 5, 3.2, 1.3, 1.45, P.timber));
    out.push(box('mast', W * 0.45 - 0.15, c - 0.15, 0.3, 0.3, 1.45, 10, P.timber), box('sail', W * 0.45 - 0.25, c - 2.2, 0.5, 4.4, 8.8, 9.4, P.linen));
    // the oars, shipped: a dark fringe along each side, down to the water
    for (const s of [-1, 1]) { const y0 = c + s * 2.1, y1 = c + s * 3.2; out.push(panel('oars', [[4, y0, 1.1], [W - 6, y0, 1.1], [W - 6, y1, -0.3], [4, y1, -0.3]], [0, s, 1], scaleHex(P.timber, 0.8))); }
    return out;
  },
};

/** A small boat hauled up on the beach. */
export const boat = {
  id: 'ln-boat', sheet: 'ln-trireme', designed: true, patterns: ['boat'],
  read: 'A small open fishing boat drawn up on the sand.',
  notes: ['6 m × 1.8 m.'],
  envelope: { w: [5, 8], d: [1.6, 2.4] },
  build({ W, D }, { palette: P }) {
    const c = D / 2;
    return [{ kind: 'hull', solid: 'frustum', x: 0.6, y: c - 0.5, w: W - 1.2, d: 1, z0: 0, z1: 0.8, top: { x: 0.2, y: c - D / 2 + 0.1, w: W - 0.4, d: D - 0.2 }, tint: scaleHex(P.hull, 1.3) }];
  },
};

/** An olive tree: a gnarled short trunk under a round grey-green crown. A loose mass the layouts scatter. */
export function olive(x, y, z, rng, P) {
  const h = 3.2 + rng() * 1.6, r = 1.6 + rng() * 0.8, t = scaleHex(P.olive, 0.9 + rng() * 0.2);
  return [drum('trunk', x, y, 0.22, z, z + h * 0.45, P.timber, { sides: 5 }), { kind: 'olive', solid: 'dome', sides: 7, x: x - r, y: y - r, w: 2 * r, d: 2 * r, z0: z + h * 0.35, z1: z + h, tint: t }];
}

export const LINDOS_ASSETS = Object.fromEntries([temple, altar, propylaia, stoa, greatStair, statueBase, shipRelief, tower, wallRun, theatre, house, steps, kiln, roundTomb, trireme, boat].map((a) => [a.id, a]));

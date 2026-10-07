/**
 * historic/assets/qin — the Qin kit (Xianyang, c. 212 BCE), built from the record (../record/qin.js) and
 * the design language on the style card (../style/qin.js `kit`): every earth face at one batter, red
 * columns on stone bases with one bracket block, straight hip and gable roofs of grey tile with a dark
 * line of eave tiles. The reference drawings and what each gave: docs/historic/qin/README.md.
 * Same contract as the other kits (./kit.js): each asset builds in its slot's local frame, front = −y.
 * Roofs are frusta whose top is a ridge line (a hip) or a full-length ridge (a gable).
 */
import { scaleHex } from '../../polygonizer/vexar.js';
import { battered, slopedFlight, beam } from './kit.js';
import { QIN_STYLE } from '../style/qin.js';

const KIT = QIN_STYLE.kit, DEG = Math.PI / 180;
const box = (kind, x, y, w, d, z0, z1, tint, o = {}) => ({ kind, x, y, w, d, z0, z1, tint, ...o });
const lean = (h) => h / KIT.earth.batter;
/** An earth mass at the kit's batter (the leaning sides listed). */
const earth = (r, z0, z1, tint, kind = 'terrace', sides) => battered(r, z0, z1, tint, lean(z1 - z0), { kind, ...(sides ? { sides } : {}) });

/**
 * A straight roof over `r` from its eave at z0: 'hip' (the ridge inset half the depth at each end) or
 * 'gable' (the ridge the full length), the ridge along the rect's long side. `eave`: the dark line of
 * round tile ends along the eave; `ridge`: the ridge roll (and the hip rolls, on a hip). `top`: a pent
 * roof round a storey above, its top that storey's rect.
 */
export function roof(r, z0, P, { form = 'hip', pitch = KIT.roof.pitch, kind = 'roof', tint, eave = true, ridge = true, top: pent } = {}) {
  tint = tint || P.tile;
  const dark = scaleHex(tint, 0.72), alongX = r.w >= r.d, half = Math.min(r.w, r.d) / 2, rise = pent ? pent.rise : half * Math.tan(pitch * DEG);
  const top = pent ? pent.rect
    : form === 'gable' ? (alongX ? { x: r.x, y: r.y + half, w: r.w, d: 0 } : { x: r.x + half, y: r.y, w: 0, d: r.d })
    : (alongX ? { x: r.x + half, y: r.y + half, w: r.w - 2 * half, d: 0 } : { x: r.x + half, y: r.y + half, w: 0, d: r.d - 2 * half });
  const out = [{ kind, solid: 'frustum', ...r, z0, z1: z0 + rise, top, tint, underside: true }];
  if (eave) {
    const t = 0.2, e = (x, y, w, d) => out.push(box('eave-tiles', x, y, w, d, z0 - 0.2, z0 + 0.04, dark));
    e(r.x, r.y, r.w, t); e(r.x, r.y + r.d - t, r.w, t);
    if (form !== 'gable' || pent) { e(r.x, r.y + t, t, r.d - 2 * t); e(r.x + r.w - t, r.y + t, t, r.d - 2 * t); }
  }
  if (ridge && !pent) {
    const z1 = z0 + rise, L = alongX ? top.w : top.d;
    if (L > 0.2) out.push(alongX ? box('ridge', top.x, top.y - 0.22, top.w, 0.44, z1 - 0.15, z1 + 0.3, dark) : box('ridge', top.x - 0.22, top.y, 0.44, top.d, z1 - 0.15, z1 + 0.3, dark));
    if (form === 'hip') {
      const ends = alongX ? [[top.x, top.y], [top.x + top.w, top.y]] : [[top.x, top.y], [top.x, top.y + top.d]];
      const corners = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.d], [r.x, r.y + r.d]];
      for (const [cx, cy] of corners) {
        const [ex, ey] = ends.reduce((a, b) => (Math.hypot(b[0] - cx, b[1] - cy) < Math.hypot(a[0] - cx, a[1] - cy) ? b : a));
        const ix = cx + Math.sign(ex - cx) * 0.15, iy = cy + Math.sign(ey - cy) * 0.15;   // in a hair from the corner: the roll stays on the slot
        out.push(beam('hip-roll', [ix, iy, z0 + 0.1], [ex, ey, z1 + 0.1], 0.28, dark));
      }
    }
  }
  return out;
}

/**
 * A column on its square stone base with one bracket block and its short arms (the kit: d 0.5, a base
 * 1.6 d across). `bracket: false` for a plain post (a house's porch). Returns the parts and the height its
 * beam sits at.
 */
export function column(cx, cy, z0, P, { h = KIT.column.h[1], d = KIT.column.d, bracket = true, axis = 'x', base = true } = {}) {
  const s = d / KIT.column.d, pl = KIT.column.plinth * s, pz = base ? 0.25 : 0, parts = [];
  if (base) parts.push(box('plinth', cx - pl / 2, cy - pl / 2, pl, pl, z0, z0 + pz, P.stone));
  parts.push({ kind: 'column', solid: 'drum', sides: 8, x: cx - d / 2, y: cy - d / 2, w: d, d, z0: z0 + pz, z1: z0 + pz + h, tint: P.red });
  let top = z0 + pz + h;
  if (bracket) {
    const b = 0.7 * s, arm = 1.6 * s;
    parts.push(box('bracket', cx - b / 2, cy - b / 2, b, b, top, top + 0.28 * s, P.red));
    parts.push(axis === 'x' ? box('bracket', cx - arm / 2, cy - 0.17 * s, arm, 0.34 * s, top + 0.28 * s, top + 0.48 * s, P.red) : box('bracket', cx - 0.17 * s, cy - arm / 2, 0.34 * s, arm, top + 0.28 * s, top + 0.48 * s, P.red));
    top += 0.48 * s;
  }
  return { parts, top };
}

/** Columns round a rect's edge, `nx` bays along x and `ny` along y. */
function colonnade(r, z0, P, nx, ny, o = {}) {
  const pts = [];
  for (let i = 0; i <= nx; i++) { pts.push([r.x + (r.w * i) / nx, r.y, 'x']); pts.push([r.x + (r.w * i) / nx, r.y + r.d, 'x']); }
  for (let j = 1; j < ny; j++) { pts.push([r.x, r.y + (r.d * j) / ny, 'y']); pts.push([r.x + r.w, r.y + (r.d * j) / ny, 'y']); }
  let top = z0;
  const parts = pts.flatMap(([x, y, axis]) => { const c = column(x, y, z0, P, { ...o, axis }); top = c.top; return c.parts; });
  return { parts, top };
}

/**
 * A timber hall standing on `r` at z0: a stone floor, red columns round it on their bases, plaster walls
 * between, dark red doors in the front bays (`doors`: bay indices), a hip roof `ov` out over the eave.
 */
function hall(r, z0, P, { bays = 7, ov = KIT.roof.overhang[0], form = 'hip', doors, h, d } = {}) {
  const out = [box('hall-floor', r.x - 0.8, r.y - 0.8, r.w + 1.6, r.d + 1.6, z0, z0 + 0.25, P.stone)];
  const bay = r.w / bays, ny = Math.max(2, Math.round(r.d / bay)), f = z0 + 0.25;
  const C = colonnade(r, f, P, bays, ny, { h, d });
  out.push(...C.parts);
  out.push(box('hall-wall', r.x + 0.12, r.y + 0.12, r.w - 0.24, r.d - 0.24, f, C.top, P.plaster));
  for (const i of doors || [Math.floor(bays / 2)]) {
    const wide = i === Math.floor(bays / 2) ? 0.62 : 0.4;
    out.push(box('door', r.x + bay * (i + 0.5) - (bay * wide) / 2, r.y + 0.04, bay * wide, 0.12, f, f + Math.min(C.top - f - 0.5, 3.2), P.door));
  }
  out.push(box('beam', r.x - 0.1, r.y - 0.1, r.w + 0.2, 0.3, C.top - 0.35, C.top, P.red), box('beam', r.x - 0.1, r.y + r.d - 0.2, r.w + 0.2, 0.3, C.top - 0.35, C.top, P.red));
  out.push(...roof({ x: r.x - ov, y: r.y - ov, w: r.w + 2 * ov, d: r.d + 2 * ov }, C.top, P, { form }));
  return out;
}

/**
 * A palace hall on its terrace (Xianyang Palace No. 1 as read from the master drawing): a two-tier
 * rammed-earth platform, a stair up each tier on the axis, a covered gallery along the lower tier's front,
 * a plastered side room on each flank of the lower tier, and the hall on the top tier. `tiers: 1` for a
 * lesser hall on a single platform.
 */
export const palaceHall = {
  id: 'qn-hall', sheet: 'qin-hall-front', designed: true, patterns: ['terrace-hall', 'rammed-earth', 'timber-frame', 'tiled-roof'],
  read: 'A seven-bay timber hall with red columns and a straight grey hip roof, high on a two-tier battered earth terrace, a stair up the middle of each tier.',
  notes: ['Tiers 3.5 m each at the kit batter (≈77°); stairs ~30°, 0.3 m risers, on the axis.', 'Hall: 7 bays, columns 3.6 m × 0.5 m on 0.8 m bases, one bracket each; eave overhang 2.6 m; pitch 30°.', 'Lower tier: a covered gallery along the front, a plastered side room on each flank (the terrace plan).', 'Red columns are the standard reading, not attested (record: red-lacquer).'],
  envelope: { w: [36, 70], d: [30, 52] },
  build({ W, D, slot }, { palette: P }) {
    const two = (slot.tiers ?? 2) === 2, h1 = slot.h1 ?? 3.5, h2 = two ? slot.h2 ?? 3.5 : 0, run1 = h1 * 1.7, L1 = lean(h1), sw = Math.min(8, W * 0.14), out = [];
    out.push(earth({ x: 0, y: run1, w: W, d: D - run1 }, 0, h1, P.hangtu));
    out.push(...slopedFlight({ x: W / 2 - sw / 2, y: 0, w: sw, d: run1 + L1 }, 0, h1, P.stone, 'y+', { cheek: 0.6, cheekTint: P.hangtu, riser: 0.3 }));
    let top, tr;
    if (two) {
      const side = Math.max(6, W * 0.13), run2 = h2 * 1.7, L2 = lean(h2), y2 = run1 + L1 + run2 + 2;
      const t2 = { x: side, y: y2, w: W - 2 * side, d: D - y2 - side };
      out.push(earth(t2, h1, h1 + h2, P.hangtu));
      out.push(...slopedFlight({ x: W / 2 - sw * 0.4, y: y2 + L2 - run2, w: sw * 0.8, d: run2 }, h1, h1 + h2, P.stone, 'y+', { cheek: 0.5, cheekTint: P.hangtu, riser: 0.3 }));
      // the gallery along the lower tier's front, either side of the stair: a row of posts before a plastered
      // back wall, a lean-to roof between them
      const gy = run1 + L1 + 0.9, zf = h1 + 2.8, zb = h1 + 3.4, yb = gy + 3.4;
      for (const [a, b] of [[side * 0.6, W / 2 - sw / 2 - 1.2], [W / 2 + sw / 2 + 1.2, W - side * 0.6]]) {
        const n = Math.max(2, Math.round((b - a) / 3.4));
        for (let i = 0; i <= n; i++) out.push(...column(a + ((b - a) * i) / n, gy, h1, P, { h: 2.6, d: 0.36, bracket: false }).parts);
        out.push(box('room', a - 0.3, yb - 0.5, b - a + 0.6, 0.5, h1, zb, P.plaster));
        out.push({ kind: 'roof', solid: 'panel', pts: [[a - 0.5, gy - 0.9, zf], [b + 0.5, gy - 0.9, zf], [b + 0.5, yb, zb], [a - 0.5, yb, zb]], out: [0, -0.3, 1], x: a - 0.5, y: gy - 0.9, w: b - a + 1, d: yb - gy + 0.9, z0: zf, z1: zb, tint: P.tile });
        out.push(box('eave-tiles', a - 0.5, gy - 1.1, b - a + 1, 0.2, zf - 0.2, zf + 0.04, scaleHex(P.tile, 0.72)));
      }
      // a plastered side room on each flank of the lower tier, its gable roof running back
      const rw = side - L1 - 1.8, rd = Math.min(t2.d * 0.55, 18);
      if (rw > 2.4) for (const x of [L1 + 0.7, W - L1 - 0.7 - rw]) {
        const r = { x, y: y2 + 3, w: rw, d: rd };
        out.push(box('room', r.x, r.y, r.w, r.d, h1, h1 + 3, P.plaster), box('door', r.x + r.w / 2 - 0.6, r.y - 0.04, 1.2, 0.1, h1, h1 + 2.2, P.door));
        out.push(...roof({ x: r.x - 0.5, y: r.y - 0.5, w: r.w + 1, d: r.d + 1 }, h1 + 3, P, { form: 'gable' }));
      }
      top = h1 + h2; tr = { x: t2.x + L2, y: t2.y + L2, w: t2.w - 2 * L2, d: t2.d - 2 * L2 };
    } else {
      top = h1; tr = { x: L1, y: run1 + L1, w: W - 2 * L1, d: D - run1 - 2 * L1 };
    }
    const m = 3, ov = two ? KIT.roof.overhang[0] + 0.1 : 2;
    const hr = { x: tr.x + m, y: tr.y + m + 1, w: tr.w - 2 * m, d: tr.d - 2 * m - 1 };
    const bays = slot.bays ?? (two ? 7 : 5);
    out.push(...hall(hr, top, P, { bays, ov, doors: two ? [1, 3, 5] : [2] }));
    return out;
  },
};

/**
 * The palace gate: a pair of que, rammed-earth pylons each carrying a small pavilion, and between them
 * the gate passage under a timber gatehouse roof (the gate-tower drawing). Doors stand open.
 */
export const que = {
  id: 'qn-que', sheet: 'qin-que-city-wall', designed: true, patterns: ['pylon-gate', 'rammed-earth', 'timber-frame', 'tiled-roof', 'door-emblem'],
  read: 'Two tall battered earth towers, each crowned with a small red-columned pavilion under a grey hip roof, a roofed timber gate between them.',
  notes: ['Pylons 8.5 m to the platform at the kit batter; pavilions 3 bays, columns 2.8 m.', 'Gate passage `gap` m (default 6), its posts and lintel at 5.4 m, a gable roof over it.', 'The palace-scale que of the drawing; the slim Gaoyi-style que is a Han analogue, not built here.'],
  envelope: { w: [34, 52], d: [10, 14] },
  build({ W, D, slot }, { palette: P }) {
    const gap = slot.gap ?? 6, pw = (W - gap) / 2, H = slot.h ?? 8.5, L = lean(H), out = [];
    for (const x0 of [0, W - pw]) {
      out.push(earth({ x: x0, y: 0, w: pw, d: D }, 0, H, P.hangtu, 'que'));
      const p = { x: x0 + L + 1.2, y: L + 1.2, w: pw - 2 * L - 2.4, d: D - 2 * L - 2.4 };
      out.push(...hall(p, H, P, { bays: 3, ov: 1.1, h: 2.8, d: 0.4, doors: [1] }));
    }
    for (const x of [pw + 0.35, W - pw - 0.35]) out.push(...column(x, D / 2, 0, P, { h: 5.2, d: 0.45, axis: 'y' }).parts);
    out.push(box('beam', pw, D / 2 - 0.3, gap, 0.6, 5.4, 5.9, P.red));
    out.push(...roof({ x: pw - 0.3, y: 1, w: gap + 0.6, d: D - 2 }, 6.2, P, { form: 'gable' }));
    for (const x of [pw + 0.6, W - pw - 0.75]) out.push(box('door', x, D / 2 + 0.3, 0.15, gap * 0.45, 0, 4.8, P.door));
    return { boxes: out, grounds: [{ kind: 'court', x: pw, y: 0, w: gap, d: D, z: 0.05, fill: P.court, surface: 'mud' }] };
  },
};

/**
 * A run of rammed-earth wall: battered front and back at the kit batter, capped with a small gable of
 * tiles; cut in lengths of at most 24 m (a whole long face starves the page). `h` 3 (a common ward), 5
 * (an elite ward), 6 (the palace).
 */
export const wall = {
  id: 'qn-wall', sheet: 'qin-que-city-wall', designed: true, patterns: ['rammed-earth', 'blank-wall', 'walled-ward'],
  read: 'A plain battered wall of pounded earth, its courses showing, a little grey tile roof along its top.',
  notes: ['Height `h` (3 common ward, 5 elite ward, 6 palace); base = slot depth; batter 1:4.5.', 'Tile cap 0.25 m out over each face, pitch 30°.'],
  envelope: { w: [3, 400], d: [1.6, 6] },
  build({ W, D, slot }, { palette: P }) {
    const H = slot.h ?? 3, L = lean(H), n = Math.max(1, Math.ceil(W / 24)), out = [];
    for (let i = 0; i < n; i++) {
      const x0 = (W * i) / n, sw = W / n;
      out.push(earth({ x: x0, y: 0, w: sw, d: D }, 0, H, P.hangtu, 'wall', ['front', 'back']));
      out.push(...roof({ x: x0, y: L - 0.25, w: sw, d: D - 2 * L + 0.5 }, H, P, { form: 'gable', kind: 'wall-cap', eave: false, ridge: false }));
    }
    return out;
  },
};

/** A ward gate: earth piers either side of a 4 m passage, timber posts and lintel, a small hip roof; the leaves open. */
export const wardGate = {
  id: 'qn-ward-gate', sheet: 'qin-town', designed: true, patterns: ['rammed-earth', 'timber-frame', 'tiled-roof', 'walled-ward'],
  read: 'A modest timber gate in an earth wall: red posts, a lintel, a little grey hip roof, the doors standing open.',
  notes: ['Passage 4 m; piers to the wall height + 0.6 m; the roof over the passage only.'],
  envelope: { w: [6, 10], d: [1.8, 4.5] },
  build({ W, D, slot }, { palette: P }) {
    const H = (slot.h ?? 3) + 0.6, g = 4, pw = (W - g) / 2, out = [];
    for (const x0 of [0, W - pw]) out.push(earth({ x: x0, y: 0, w: pw, d: D }, 0, H, P.hangtu, 'wall', ['front', 'back']));
    for (const x of [pw + 0.25, W - pw - 0.25]) out.push(...column(x, D / 2, 0, P, { h: H - 0.4, d: 0.36, bracket: false, base: false }).parts);
    out.push(box('beam', pw, D / 2 - 0.2, g, 0.4, H - 0.4, H, P.red));
    out.push(...roof({ x: pw - 0.6, y: 0, w: g + 1.2, d: D }, H, P, { form: 'hip' }));
    for (const x of [pw + 0.5, W - pw - 0.65]) out.push(box('door', x, D / 2 + 0.25, 0.15, Math.min(1.8, D / 2 - 0.3), 0, H - 0.6, P.door));
    return { boxes: out, grounds: [{ kind: 'lane', x: pw, y: 0, w: g, d: D, z: 0.05, fill: P.lane, surface: 'mud' }] };
  },
};

/**
 * A courtyard house (the town sheet): a rammed-earth wall round the lot with a tile cap, a small gatehouse
 * on the street axis, the main hall across the back on a low platform with a row of posts before it, side
 * rooms either side of the court. Tiled main roof, thatched side rooms; an `elite` house tiles everything
 * and hips its hall, a poor one thatches the hall too.
 */
export const house = {
  id: 'qn-house', sheet: 'qin-town', designed: true, patterns: ['courtyard-house', 'rammed-earth', 'tiled-roof', 'blank-wall'],
  read: 'An earth-walled courtyard house: a little roofed gate on the lane, a tiled main hall across the back, thatched side rooms round a beaten-earth court.',
  notes: ['Outer wall 0.5 m, 2.8 m high, capped; gatehouse 3.6 × 3 m.', 'Hall 30% of the depth (4.5–7 m) on a 0.4 m platform, posts 1.2 m before its wall; side rooms 2.8–4.5 m wide.', '`elite`: tiles throughout, a hip roof; a poor house (a third of the rest) thatches its hall.'],
  envelope: { w: [9, 28], d: [10, 28] },
  build({ W, D, slot }, { palette: P, rng }) {
    const i = 0.35, t = 0.5, wh = 2.8, elite = !!slot.elite, poor = !elite && rng() < 0.33, out = [];
    const capT = P.tile, wallT = scaleHex(P.hangtu, 0.96 + rng() * 0.08);
    const run = (x, y, w, d) => { out.push(box('house-wall', x, y, w, d, 0, wh, wallT), box('wall-cap', x - 0.12, y - 0.12, w + 0.24, d + 0.24, wh, wh + 0.22, capT)); };
    const gw = Math.min(3.6, W * 0.32), gd = 3;
    run(i, D - i - t, W - 2 * i, t); run(i, i, t, D - 2 * i - t); run(W - i - t, i, t, D - 2 * i - t);
    run(i + t, i, W / 2 - gw / 2 - i - t, t); run(W / 2 + gw / 2, i, W / 2 - gw / 2 - i - t, t);
    // the gatehouse on the street axis, its door on the lane
    out.push(box('gatehouse', W / 2 - gw / 2, i, gw, gd, 0, 2.7, P.plaster), box('door', W / 2 - 0.6, i - 0.04, 1.2, 0.1, 0, 2.2, P.door));
    out.push(...roof({ x: W / 2 - gw / 2 - 0.3, y: i - 0.3, w: gw + 0.6, d: gd + 0.6 }, 2.7, P, { form: 'gable', eave: false, ridge: false }));
    // the main hall across the back
    const hd = Math.max(4.5, Math.min(7, D * 0.3)), hx = i + t + 0.35, hw = W - 2 * hx, hy = D - i - t - hd - 0.35, ph = 0.4, ch = 2.9;
    out.push(box('hall-floor', hx, hy - 1.4, hw, hd + 1.4, 0, ph, P.stone));
    out.push(box('hall-wall', hx + 0.2, hy, hw - 0.4, hd - 0.2, ph, ph + ch, elite ? P.whitePlaster : P.plaster));
    const n = Math.max(2, Math.round(hw / 3));
    for (let k = 0; k <= n; k++) out.push(...column(hx + 0.3 + ((hw - 0.6) * k) / n, hy - 1.0, ph, P, { h: ch, d: 0.28, bracket: false, base: false }).parts);
    out.push(box('door', hx + hw / 2 - 0.8, hy - 0.04, 1.6, 0.1, ph, ph + 2.3, P.door));
    out.push(...roof({ x: hx - 0.1, y: hy - 1.5, w: hw + 0.2, d: hd + 1.6 }, ph + ch, P, poor ? { form: 'gable', kind: 'thatch', tint: P.thatch, eave: false } : { form: elite ? 'hip' : 'gable', eave: elite }));
    // side rooms either side of the court
    const sw = Math.max(2.8, Math.min(4.5, W * 0.22)), sy = i + gd + 1.4, sd = hy - 1.6 - sy;
    if (sd >= 3 && W - 2 * (i + t + sw) > 3) for (const sx of [i + t + 0.4, W - i - t - 0.4 - sw]) {
      out.push(box('room', sx, sy, sw, sd, 0, 2.5, elite ? P.whitePlaster : P.plaster));
      out.push(...roof({ x: sx - 0.35, y: sy - 0.35, w: sw + 0.7, d: sd + 0.7 }, 2.5, P, elite ? { form: 'gable', eave: false } : { form: 'gable', kind: 'thatch', tint: P.thatch, eave: false, ridge: false }));
    }
    if (rng() < 0.5 && sd > 4) out.push(...tree(W / 2 + (rng() - 0.5) * 2, sy + sd / 2, rng, P, { h: 5 + rng() * 2, crown: 'round' }));
    return { boxes: out, grounds: [{ kind: 'court', x: i + t, y: i + t, w: W - 2 * (i + t), d: D - 2 * (i + t), z: 0.04, fill: P.court, surface: 'mud' }] };
  },
};

/**
 * A walled market (a HAN analogue: the Sichuan market brick): an earth wall round a square, a gate in the
 * middle of each side, rows of tiled stall sheds and cloth awnings, and the two-storey market tower with
 * its drum in the middle. Drawn because a capital had a market, not because a Qin one is excavated.
 */
export const market = {
  id: 'qn-market', sheet: 'qin-town', designed: true, patterns: ['market', 'rammed-earth', 'tiled-roof', 'timber-frame'],
  read: 'A walled market square: rows of open stall sheds under grey tile and pale cloth, a gate in each side, a two-storey drum tower in the middle.',
  notes: ['A Han analogue (record: han-market-brick), labelled as such.', 'Wall 3 m; gates 5 m; sheds 4 m deep, eaves 2.4 m; the tower 5 m square, 9 m to its ridge.'],
  envelope: { w: [50, 96], d: [50, 96] },
  build({ W, D }, { palette: P, rng }) {
    const out = [], H = 3, B = 2, g = 5, ins = [];
    const side = (r, sides) => { out.push(earth(r, 0, H, P.hangtu, 'wall', sides)); out.push(...roof({ x: r.x + (sides[0] === 'left' ? lean(H) - 0.2 : 0), y: r.y + (sides[0] === 'front' ? lean(H) - 0.2 : 0), w: sides[0] === 'left' ? r.w - 2 * lean(H) + 0.4 : r.w, d: sides[0] === 'front' ? r.d - 2 * lean(H) + 0.4 : r.d }, H, P, { form: 'gable', kind: 'wall-cap', eave: false, ridge: false })); };
    for (const y of [0, D - B]) { side({ x: 0, y, w: W / 2 - g / 2, d: B }, ['front', 'back']); side({ x: W / 2 + g / 2, y, w: W / 2 - g / 2, d: B }, ['front', 'back']); }
    for (const x of [0, W - B]) { side({ x, y: B, w: B, d: D / 2 - g / 2 - B }, ['left', 'right']); side({ x, y: D / 2 + g / 2, w: B, d: D / 2 - g / 2 - B }, ['left', 'right']); }
    // a little roof over each gate
    for (const [x, y, w, d] of [[W / 2 - g / 2 - 0.5, 0, g + 1, B], [W / 2 - g / 2 - 0.5, D - B, g + 1, B], [0, D / 2 - g / 2 - 0.5, B, g + 1], [W - B, D / 2 - g / 2 - 0.5, B, g + 1]]) out.push(...roof({ x, y, w, d }, H + 0.5, P, { form: 'hip', eave: false }));
    // the stall rows: E–W sheds, a cloth awning stall now and then, the middle kept open for the tower
    const plaza = { x: W / 2 - 13, y: D / 2 - 13, w: 26, d: 26 };
    for (let y = B + 4; y + 4 < D - B - 3; y += 11) for (let x = B + 4; x + 8 < W - B - 4; x += 15) {
      const len = Math.min(12, W - B - 4 - x);
      if (x + len > plaza.x && x < plaza.x + plaza.w && y + 4 > plaza.y && y < plaza.y + plaza.d) continue;
      if (Math.abs(x + len / 2 - W / 2) < g && (y < B + 8 || y > D - B - 12)) continue;   // keep the gate ways clear
      if (rng() < 0.3) {
        for (const [px, py] of [[0, 0], [len, 0], [0, 4], [len, 4]]) out.push(box('post', x + px - 0.1, y + py - 0.1, 0.2, 0.2, 0, 2.1, P.timber));
        out.push(box('awning', x - 0.2, y - 0.2, len + 0.4, 4.4, 2.1, 2.2, P.linen));
      } else {
        for (let k = 0; k <= 3; k++) for (const py of [0.3, 3.7]) out.push(box('post', x + (len * k) / 3 - 0.12, y + py - 0.12, 0.24, 0.24, 0, 2.4, P.timber));
        out.push(box('stall-wall', x, y + 3.6, len, 0.3, 0, 2.4, P.plaster));
        out.push(...roof({ x: x - 0.4, y: y - 0.4, w: len + 0.8, d: 4.8 }, 2.4, P, { form: 'gable', eave: false, ridge: false }));
        for (let k = 0; k < 3; k++) if (rng() < 0.7) out.push(box('goods', x + 0.6 + k * (len / 3), y + 1.2, len / 3 - 1.2, 1.2, 0, 0.7, pickGoods(P, rng)));
      }
      ins.push([x, y]);
    }
    // the market tower: an earth base, a plastered storey on red posts, a pent roof, the drum storey, a hip roof
    const c = { x: W / 2 - 2.5, y: D / 2 - 2.5, w: 5, d: 5 };
    out.push(earth({ x: c.x - 1, y: c.y - 1, w: c.w + 2, d: c.d + 2 }, 0, 1.2, P.hangtu));
    const z1 = 1.2;
    for (const [px, py] of [[0, 0], [c.w, 0], [0, c.d], [c.w, c.d]]) out.push(...column(c.x + px, c.y + py, z1, P, { h: 3, d: 0.4, axis: 'x', base: false }).parts);
    out.push(box('room', c.x + 0.3, c.y + 0.3, c.w - 0.6, c.d - 0.6, z1, z1 + 3.2, P.plaster), box('door', W / 2 - 0.6, c.y + 0.26, 1.2, 0.1, z1, z1 + 2.2, P.door));
    const e1 = z1 + 3.4, up = { x: c.x + 0.8, y: c.y + 0.8, w: c.w - 1.6, d: c.d - 1.6 };
    out.push(...roof({ x: c.x - 1.1, y: c.y - 1.1, w: c.w + 2.2, d: c.d + 2.2 }, e1, P, { top: { rect: up, rise: 1.1 } }));
    const e2 = e1 + 1.1;
    out.push(box('room', up.x, up.y, up.w, up.d, e2, e2 + 2.4, P.plaster), box('balcony', up.x - 0.6, up.y - 0.6, up.w + 1.2, up.d + 1.2, e2, e2 + 0.15, P.timber));
    out.push({ kind: 'drum', solid: 'drum', sides: 10, x: W / 2 - 0.8, y: up.y - 0.55, w: 1.6, d: 0.5, z0: e2 + 0.5, z1: e2 + 2.1, tint: P.red });
    out.push(...roof({ x: up.x - 1, y: up.y - 1, w: up.w + 2, d: up.d + 2 }, e2 + 2.4, P, { form: 'hip' }));
    return { boxes: out, grounds: [{ kind: 'court', x: B, y: B, w: W - 2 * B, d: D - 2 * B, z: 0.04, fill: P.court, surface: 'mud' }] };
  },
};
const pickGoods = (P, rng) => [P.millet, P.wheat, '#8a6a4a', '#6d6a63', P.linen][Math.floor(rng() * 5)];

/**
 * Epang Palace's front hall, begun in 212 BCE: the rammed-earth terrace rising in sections of different
 * heights, board forms standing on the highest, earth ramps up the front, spoil heaps, the gangs' sheds.
 * At this date it is a building site; it was never finished (record: epang-front-hall).
 */
export const terraceWorks = {
  id: 'qn-terrace-works', sheet: 'qin-terrace-plan', designed: true, patterns: ['rammed-earth', 'terrace'],
  read: 'A great earth platform being built: battered sections at different heights, plank forms on the highest, earth ramps up its face, spoil heaps and sheds in front.',
  notes: ['Sections 2–7 m high at the kit batter; forms 0.8 m planks on the highest; ramps 1:3.', 'Only the near end of a terrace 1,270 m long: the frame cannot hold the rest.'],
  envelope: { w: [60, 240], d: [26, 60] },
  build({ W, D }, { palette: P, rng }) {
    const out = [], back = D * 0.45, n = Math.max(3, Math.round(W / 26));
    for (let k = 0; k < n; k++) {
      const x0 = (W * k) / n, sw = W / n, h = 2 + 5 * rng(), r = { x: x0, y: D - back, w: sw, d: back };
      out.push(earth(r, 0, h, P.hangtu, 'works-earth', ['front']));
      if (h > 5) for (const y of [D - back + lean(h), D - 0.4]) out.push(box('formwork', x0 + 0.4, y, sw - 0.8, 0.25, h, h + 0.8, P.timber));
      if (rng() < 0.6) { const rl = h * 3, rw = 4; if (D - back - rl > 1) out.push({ kind: 'ramp', solid: 'wedge', rise: 'y+', x: x0 + sw / 2 - rw / 2, y: D - back - rl, w: rw, d: rl + lean(h) * 0.5, z0: 0, z1: h * 0.95, tint: scaleHex(P.loess, 0.94) }); }
    }
    for (let k = 0; k < Math.round(W / 30); k++) { const s = 4 + rng() * 5; out.push({ kind: 'spoil', solid: 'dome', sides: 8, x: rng() * (W - s), y: 1 + rng() * (D - back - s - 2), w: s, d: s, z0: 0, z1: s * 0.35, tint: scaleHex(P.loess, 0.9 + rng() * 0.08) }); }
    for (let k = 0; k < Math.max(1, Math.round(W / 70)); k++) {
      const sx = 4 + rng() * (W - 14), sy = 1;
      for (const [px, py] of [[0, 0], [6, 0], [0, 4], [6, 4]]) out.push(box('post', sx + px, sy + py, 0.25, 0.25, 0, 2.4, P.timber));
      out.push(...roof({ x: sx - 0.4, y: sy - 0.4, w: 7, d: 4.9 }, 2.4, P, { form: 'gable', kind: 'thatch', tint: P.thatch, eave: false, ridge: false }));
    }
    return { boxes: out, grounds: [{ kind: 'works-floor', x: 0, y: 0, w: W, d: D, z: 0.03, fill: scaleHex(P.loess, 0.93), surface: 'mud' }] };
  },
};

/**
 * A timber bridge over the Wei on rows of piles (record: wei-bridge — the excavated one is ~880 m long,
 * 15.4 m wide; here only the stretch the frame holds): a plank deck with low rails, ramps down to each
 * bank. Length along the slot's depth; `waterZ` the river's surface.
 */
export const bridge = {
  id: 'qn-bridge', sheet: 'qin-que-city-wall', designed: true, patterns: ['bridge'],
  read: 'A long, straight, flat timber bridge on close rows of piles, plank deck and low rails, ramps down at each end.',
  notes: ['Deck 1.4 m over the bank, 0.5 m thick; rails 1 m; pile rows every 7 m, four piles across, 0.5 m.', 'Ramps 8 m at each end.'],
  envelope: { w: [10, 18], d: [40, 160] },
  build({ W, D, slot }, { palette: P }) {
    const dz = 1.4, wz = slot.waterZ ?? -2, out = [], ramp = 8, wood = P.timber;
    for (let y = ramp; y < D - ramp - 0.01; y += 20) { const sd = Math.min(20, D - ramp - y); out.push(box('deck', 0.3, y, W - 0.6, sd, dz - 0.5, dz, wood)); for (const x of [0.3, W - 0.5]) out.push(box('rail', x, y, 0.2, sd, dz, dz + 1, scaleHex(wood, 0.9))); }
    out.push({ kind: 'deck', solid: 'wedge', rise: 'y+', x: 0.3, y: 0, w: W - 0.6, d: ramp, z0: 0, z1: dz, tint: wood }, { kind: 'deck', solid: 'wedge', rise: 'y-', x: 0.3, y: D - ramp, w: W - 0.6, d: ramp, z0: 0, z1: dz, tint: wood });
    for (let y = ramp + 3; y < D - ramp - 2; y += 7) for (let k = 0; k < 4; k++) out.push({ kind: 'pile', solid: 'drum', sides: 6, x: 1 + ((W - 2.5) * k) / 3, y, w: 0.5, d: 0.5, z0: wz - 0.4, z1: dz - 0.5, tint: scaleHex(wood, 0.8) });
    return out;
  },
};

/**
 * A tree (not a slot: the layout scatters them): `crown: 'poplar'` a tall narrow cone, 'round' a broad
 * crown (an elm, a jujube, a willow by the water).
 */
export function tree(x, y, rng, P, { h = 9 + rng() * 5, crown = 'poplar' } = {}) {
  const tw = 0.36, out = [{ kind: 'trunk', solid: 'drum', sides: 6, x: x - tw / 2, y: y - tw / 2, w: tw, d: tw, z0: 0, z1: h * 0.4, tint: P.bark }];
  const leaf = scaleHex(P.poplar, 0.9 + rng() * 0.2);
  if (crown === 'poplar') { const r = h * 0.14; out.push({ kind: 'crown', solid: 'frustum', x: x - r, y: y - r, w: 2 * r, d: 2 * r, z0: h * 0.25, z1: h, top: { x: x - r * 0.2, y: y - r * 0.2, w: r * 0.4, d: r * 0.4 }, tint: leaf }); }
  else { const r = h * 0.32; out.push({ kind: 'crown', solid: 'dome', sides: 8, x: x - r, y: y - r, w: 2 * r, d: 2 * r, z0: h * 0.35, z1: h, tint: leaf }); }
  return out;
}

export const QIN_ASSETS = Object.fromEntries([palaceHall, que, wall, wardGate, house, market, terraceWorks, bridge].map((a) => [a.id, a]));

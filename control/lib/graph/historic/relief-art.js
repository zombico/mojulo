/**
 * historic/relief-art — the carved and lettered surfaces of the Roman forum, drawn into a wall skin's overlay
 * (./ground.js `overlay`: `add` lightens or darkens the relief, `paint` lays a pigment or a metal over it). A relief is
 * read by its light: a raised shape has a lit face and casts a shadow down and to the right; an incised line is dark.
 * Each drawing is a big read at walking distance, not a copy of a particular carving.
 *
 *   acanthusFrieze — a running scroll: a wave of stem, a spiral in each bay curling to a flower, leaves at the turns
 *   doricFrieze    — triglyphs and metopes, the metopes alternating ox skulls hung with garlands and libation bowls
 *   bronzeLetters  — one line of square capitals in gilt bronze set into marble (a dedication on an architrave)
 *   fastiPanel     — columns of small incised lines under headings, in a moulded frame (the lists of magistrates)
 *   figureFrieze   — a procession of figures in high relief
 *   riderPanel     — one framed scene: a rider on a rearing horse (Mettius Curtius at the Lacus Curtius)
 */

/** A shape (a predicate over pixels) carved proud: its face lit by `k`, a shadow cast `off` px down-right. */
export function raise(o, inside, { k = 0.32, off = 2, box = [0, 0, o.W, o.H] } = {}) {
  const [x0, y0, x1, y1] = box.map(Math.round), w = x1 - x0 + off + 2, h = y1 - y0 + off + 2, m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x0 + x, y0 + y)) m[y * w + x] = 1;
  const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? m[y * w + x] : 0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (at(x, y)) { o.add(x0 + x, y0 + y, (at(x - 1, y - 1) ? k * 0.45 : k)); continue; }   // the face, its upper-left rim brightest
    if (at(x - off, y - off) || at(x - 1, y - 1)) o.add(x0 + x, y0 + y, -k * 1.1);          // the cast shadow
  }
}
const disc = (cx, cy, r) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const ring = (cx, cy, r0, r1) => (x, y) => { const d = (x - cx) ** 2 + (y - cy) ** 2; return d <= r1 * r1 && d >= r0 * r0; };
const poly = (pts) => (x, y) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; }
  return c;
};
const any = (...fs) => (x, y) => fs.some((f) => f(x, y));
const bounds = (pts, pad = 2) => { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad]; };
/** A band of mouldings across the tile: a light fillet over a dark groove. */
function fillet(o, y, h = 2) { for (let x = 0; x < o.W; x++) { for (let k = 0; k < h; k++) o.add(x, y + k, 0.18); o.add(x, y + h, -0.3); } }

/** A running acanthus scroll: two waves a tile, each bay's spiral curling into a rosette, a leaf sheathing each turn. */
export function acanthusFrieze(o, rng) {
  const { W, H } = o, mid = H * 0.52, amp = H * 0.2, lam = W / 2, th = Math.max(3, H * 0.075);
  fillet(o, 1); fillet(o, H - 5);
  // the stem: a thick wave
  raise(o, (x, y) => Math.abs(y - (mid + amp * Math.sin((2 * Math.PI * x) / lam))) < th, { k: 0.34, off: 3, box: [0, mid - amp - th, W, mid + amp + th] });
  // small leaves sprouting along the stem, alternately up and down
  for (let x = lam / 16; x < W; x += lam / 8) {
    const y0 = mid + amp * Math.sin((2 * Math.PI * x) / lam), sg = Math.round(x / (lam / 8)) % 2 ? 1 : -1, L = H * 0.17;
    const lf = [[x - L * 0.25, y0], [x + L * 0.1, y0 + sg * L * 0.55], [x + L * 0.35, y0 + sg * L * 0.2], [x + L * 0.6, y0 + sg * L * 0.5], [x + L * 0.5, y0]];
    raise(o, poly(lf), { k: 0.24, box: bounds(lf) });
  }
  for (let b = 0; b < 4; b++) {
    // each half-wave bay: a spiral tendril from the stem into the bay's middle, a rosette at its heart
    const xb = (b + 0.5) * (lam / 2), up = b % 2 === 0, cy = mid + (up ? -1 : 1) * amp * 0.15, cx = xb + lam * 0.1;
    const turns = 1.45, pts = [];
    for (let t = 0; t <= 1; t += 0.02) { const a = t * turns * 2 * Math.PI, r = amp * 1.05 * (1 - t * 0.85); pts.push([cx + r * Math.cos(a + (up ? 0 : Math.PI)), cy + r * Math.sin(a + (up ? 0 : Math.PI)) * 0.8]); }
    raise(o, (x, y) => pts.some(([px, py], i) => (x - px) ** 2 + (y - py) ** 2 < (th * (0.95 - i * 0.006)) ** 2), { k: 0.3, off: 3, box: bounds(pts, th + 3) });
    const [rx, ry] = pts[pts.length - 1], rr = H * 0.13;
    raise(o, any(disc(rx, ry, rr), ...Array.from({ length: 6 }, (_, i) => disc(rx + Math.cos(i) * rr * 0.9, ry + Math.sin(i) * rr * 0.9, rr * 0.45))), { k: 0.34, box: [rx - rr * 1.6, ry - rr * 1.6, rx + rr * 1.6, ry + rr * 1.6] });
    // the acanthus sheath at the stem's turn: a pointed leaf with lobes
    const lx = b * (lam / 2) + lam / 4, ly = mid + amp * Math.sin((2 * Math.PI * lx) / lam), dir = up ? -1 : 1, L = H * 0.32;
    const leaf = [[lx - L * 0.35, ly], [lx - L * 0.2, ly + dir * L * 0.5], [lx - L * 0.05, ly + dir * L * 0.35], [lx + L * 0.1, ly + dir * L * 0.8], [lx + L * 0.2, ly + dir * L * 0.3], [lx + L * 0.4, ly + dir * L * 0.45], [lx + L * 0.35, ly]];
    raise(o, poly(leaf), { k: 0.28, box: bounds(leaf) });
    for (let i = 0; i < 3; i++) o.add(lx - L * 0.1 + i * L * 0.1, ly + dir * L * 0.3, -0.25);   // the leaf's veins
  }
}

/** The Doric frieze: triglyphs (two channels and two half channels) between square metopes, ox skulls hung with garlands alternating with libation bowls. */
export function doricFrieze(o, rng) {
  const { W, H } = o, unit = W / 2, tw = unit * 0.4, mw = unit - tw, top = H * 0.12, bot = H * 0.95;
  fillet(o, 0, 3);
  for (let u = 0; u < 2; u++) {
    const x0 = u * unit;
    raise(o, (x, y) => x >= x0 + 1 && x < x0 + tw - 1 && y > top && y < bot, { k: 0.22, box: [x0, top, x0 + tw, bot] });
    for (const f of [0.02, 0.32, 0.62, 0.95]) for (let y = top + 3; y < bot - 1; y++) for (let k = 0; k < Math.max(1, tw * 0.07); k++) o.add(x0 + tw * f + k, y, -0.32);
    const cx = x0 + tw + mw / 2, cy = (top + bot) / 2, s = Math.min(mw, bot - top) * 0.36;
    if (u === 0) {
      // a bucranium: the skull narrowing to the muzzle, the horns curving out, a garland swung beneath
      const skull = [[cx - s * 0.45, cy - s * 0.7], [cx + s * 0.45, cy - s * 0.7], [cx + s * 0.3, cy + s * 0.2], [cx + s * 0.15, cy + s * 0.75], [cx - s * 0.15, cy + s * 0.75], [cx - s * 0.3, cy + s * 0.2]];
      // the horns: from the brow out and up, tapering crescents
      const horns = (x, y) => [-1, 1].some((sg) => {
        for (let t = 0; t <= 1; t += 0.04) { const hx = cx + sg * s * (0.4 + 0.75 * Math.sin(t * 1.6)), hy = cy - s * (0.62 + 0.55 * t * t), r = s * 0.14 * (1 - 0.8 * t); if ((x - hx) ** 2 + (y - hy) ** 2 < r * r) return true; }
        return false;
      });
      raise(o, any(poly(skull), horns), { k: 0.34, box: [cx - s * 1.4, cy - s * 1.5, cx + s * 1.4, cy + s] });
      for (const e of [-1, 1]) o.add(cx + e * s * 0.18, cy - s * 0.25, -0.5);   // the eye sockets
      const gar = (x, y) => { const t = (x - (cx - mw * 0.48)) / (mw * 0.96); if (t < 0 || t > 1) return false; const yy = cy + s * 0.35 + Math.sin(t * Math.PI) * s * 0.75; return Math.abs(y - yy) < s * 0.16; };
      raise(o, gar, { k: 0.26, box: [cx - mw * 0.5, cy, cx + mw * 0.5, bot] });
    } else {
      // a patera: a shallow bowl seen face on, its boss and its fluted rim
      raise(o, ring(cx, cy, s * 0.55, s * 0.85), { k: 0.3, box: [cx - s, cy - s, cx + s, cy + s] });
      raise(o, disc(cx, cy, s * 0.22), { k: 0.38, box: [cx - s * 0.3, cy - s * 0.3, cx + s * 0.3, cy + s * 0.3] });
      for (let i = 0; i < 16; i++) { const a = (i / 16) * 2 * Math.PI; for (let r = s * 0.58; r < s * 0.82; r++) o.add(cx + Math.cos(a) * r, cy + Math.sin(a) * r, -0.22); }
    }
  }
}

// square capitals as strokes in a unit box (x 0–1 across, y 0–1 down): lines [x0, y0, x1, y1] and arcs [cx, cy, rx, ry, a0, a1]
export const GLYPH = {
  A: [[0, 1, 0.5, 0, 1], [0.5, 0, 1, 1], [0.22, 0.62, 0.78, 0.62]], C: [['arc', 0.55, 0.5, 0.5, 0.5, 0.25, 1.75]], D: [[0, 0, 0, 1], ['arc', 0.1, 0.5, 0.8, 0.5, -0.5, 0.5]],
  E: [[0, 0, 0, 1], [0, 0, 0.8, 0], [0, 0.5, 0.65, 0.5], [0, 1, 0.8, 1]], F: [[0, 0, 0, 1], [0, 0, 0.8, 0], [0, 0.5, 0.65, 0.5]], I: [[0.5, 0, 0.5, 1]], L: [[0, 0, 0, 1], [0, 1, 0.75, 1]],
  M: [[0, 1, 0.08, 0], [0.08, 0, 0.5, 1], [0.5, 1, 0.92, 0], [0.92, 0, 1, 1]], N: [[0, 1, 0, 0], [0, 0, 1, 1], [1, 1, 1, 0]],
  O: [['arc', 0.5, 0.5, 0.5, 0.5, 0, 2]], P: [[0, 0, 0, 1], [0, 0, 0.5, 0], [0, 0.52, 0.5, 0.52], ['arc', 0.5, 0.26, 0.38, 0.26, -0.5, 0.5]],
  R: [[0, 0, 0, 1], [0, 0, 0.5, 0], [0, 0.52, 0.5, 0.52], ['arc', 0.5, 0.26, 0.38, 0.26, -0.5, 0.5], [0.4, 0.52, 0.9, 1]],
  S: [['arc', 0.5, 0.26, 0.42, 0.26, 0.5, 1.85], ['arc', 0.5, 0.74, 0.42, 0.26, -0.5, 0.85]], T: [[0, 0, 1, 0], [0.5, 0, 0.5, 1]],
  V: [[0, 0, 0.5, 1], [0.5, 1, 1, 0]], X: [[0, 0, 1, 1], [0, 1, 1, 0]], Q: [['arc', 0.5, 0.5, 0.5, 0.5, 0, 2], [0.55, 0.8, 0.95, 1.12]], G: [['arc', 0.55, 0.5, 0.5, 0.5, 0.25, 1.75], [0.6, 0.55, 1.02, 0.55], [1.02, 0.55, 1.02, 0.85]],
};
const WIDE = { M: 1.15, O: 1, Q: 1, C: 0.9, G: 0.92, D: 0.88, A: 0.95, V: 0.95, X: 0.9, N: 0.9, T: 0.8, I: 0.25, L: 0.7, E: 0.7, P: 0.72, R: 0.8, S: 0.72 };
/** Does a pixel fall on letter `ch` drawn in a w × h box with strokes `sw` thick (all in px)? */
function onGlyph(ch, u, v, w, h, sw) {
  for (const g of GLYPH[ch] || []) {
    if (g[0] === 'arc') {
      const [, cx, cy, rx, ry, a0, a1] = g, dx = u - cx * w, dy = v - cy * h, a = (Math.atan2(dy / (ry * h), dx / (rx * w)) / Math.PI + 2) % 2;
      const inArc = a1 >= 2 || (a0 < 0 ? a >= a0 + 2 || a <= a1 : a >= a0 && a <= a1);
      const d = Math.hypot(dx / (rx * w), dy / (ry * h));
      if (inArc && Math.abs(d - 1) * Math.min(rx * w, ry * h) < sw / 2) return true;
    } else {
      const [x0, y0, x1, y1] = g, ax = x0 * w, ay = y0 * h, bx = x1 * w, by = y1 * h, L = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
      const t = Math.max(0, Math.min(1, ((u - ax) * (bx - ax) + (v - ay) * (by - ay)) / L));
      if (Math.hypot(u - ax - t * (bx - ax), v - ay - t * (by - ay)) < sw / 2) return true;
    }
  }
  return false;
}
const LETTERS = 'AEIMNOPRSTVCDLQGX';
/**
 * One line of square capitals, gilt-bronze set into the stone (`metal`) or cut and painted red (`ink`). The letters are
 * real Roman capitals but drawn at random into words: the scene states no text the record does not hold.
 */
export function bronzeLetters(o, rng, { metal = [204, 166, 78], ink = null, cap = 0.62, from = 0.19 } = {}) {
  const { W, H } = o, top = H * from, ch = H * cap, sw = Math.max(1.6, ch * 0.13), col = ink || metal;
  for (let x = W * 0.02; x < W * 0.97;) {
    const n = 2 + Math.floor(rng() * 7);   // a word
    for (let i = 0; i < n && x < W * 0.97; i++) {
      const c = LETTERS[Math.floor(rng() ** 1.4 * LETTERS.length)], lw = ch * (WIDE[c] || 0.8);
      for (let py = Math.floor(top - sw); py < top + ch + sw + 2; py++) for (let px = Math.floor(x - sw); px < x + lw + sw + 2; px++) {
        if (onGlyph(c, px - x, py - top, lw, ch, sw)) { o.paint(px, py, col, ink ? 0.85 : 0.95); o.add(px, py, ink ? -0.15 : 0.1); }
        else if (!ink && onGlyph(c, px - x - 1, py - top - 1, lw, ch, sw)) o.add(px, py, -0.32);
      }
      x += lw + ch * 0.22;
    }
    // the interpunct, a small triangle at mid-height, then the word space
    for (let k = 0; k < sw * 1.2; k++) for (let j = 0; j < sw * 1.2 - k; j++) o.paint(x + ch * 0.12 + j, top + ch * 0.45 + k, col, 0.9);
    x += ch * 0.62;
  }
}

/** The Fasti: a moulded frame, a heading, and columns of short incised lines (names and years), the odd line in red. */
export function fastiPanel(o, rng) {
  const { W, H } = o, m = W * 0.04;
  raise(o, (x, y) => (x < m || x > W - m || y < m || y > H - m) && x > 1 && y > 1 && x < W - 2 && y < H - 2, { k: 0.24 });
  const cols = 4, cw = (W - 2 * m) / cols, lh = H * 0.028;
  for (let c = 0; c < cols; c++) {
    const x0 = m + c * cw + cw * 0.08;
    for (let y = m + H * 0.05; y < m + H * 0.09; y++) for (let x = x0; x < x0 + cw * 0.6; x++) o.add(x, y, -0.32);   // the heading, larger
    for (let y = m + H * 0.13; y < H - m - lh; y += lh * 1.6) {
      const len = cw * (0.4 + rng() * 0.45), red = rng() < 0.12;
      for (let x = x0; x < x0 + len; x++) if (rng() < 0.82) for (let k = 0; k < Math.max(1, lh * 0.5); k++) { o.add(x, y + k, -0.28); if (red) o.paint(x, y + k, [163, 50, 31], 0.6); }
    }
  }
}

/** A procession in high relief: figures in long garments, a few leading animals, heads in profile. */
export function figureFrieze(o, rng) {
  const { W, H } = o, base = H * 0.92, top = H * 0.1;
  fillet(o, 1); fillet(o, H - 4);
  for (let x = W * 0.03; x < W * 0.97;) {
    const h = (base - top) * (0.84 + rng() * 0.1), animal = rng() < 0.08;
    if (animal) {
      // a bull led to the altar: a heavy body, short legs, the head low with horns
      const bw = h * 0.85, by = base - h * 0.42;
      const body = (px, py) => ((px - (x + bw / 2)) / (bw / 2)) ** 2 + ((py - by) / (h * 0.2)) ** 2 <= 1;
      const legs = (px, py) => py > by && py < base && [0.14, 0.28, 0.72, 0.86].some((f) => Math.abs(px - (x + bw * f)) < h * 0.035);
      const head = poly([[x + bw * 0.92, by - h * 0.12], [x + bw * 1.14, by - h * 0.02], [x + bw * 1.12, by + h * 0.1], [x + bw * 0.95, by + h * 0.08]]);
      const horn = (px, py) => Math.hypot(px - (x + bw * 1.02), py - (by - h * 0.14)) < h * 0.03;
      raise(o, any(body, legs, head, horn), { k: 0.3, off: 3, box: [x - 2, by - h * 0.3, x + bw * 1.2, base] });
      x += bw * 1.3;
      continue;
    }
    // a figure in a long garment: the robe widening to its hem, shoulders, a head in profile, an arm raised or holding
    const w = h * 0.3, lean = (rng() - 0.5) * w * 0.25, sx = x + w / 2 + lean;
    const robe = poly([[x + w * 0.02, base], [x + w * 0.98, base], [sx + w * 0.3, base - h * 0.78], [sx - w * 0.3, base - h * 0.78]]);
    const head = (px, py) => ((px - sx) / (h * 0.06)) ** 2 + ((py - (base - h * 0.88)) / (h * 0.075)) ** 2 <= 1;
    const neck = (px, py) => Math.abs(px - sx) < h * 0.025 && py > base - h * 0.84 && py < base - h * 0.77;
    const up = rng() < 0.35, arm = (px, py) => { const ax = sx + w * 0.28, ay = base - h * 0.74, bx = ax + w * (up ? 0.25 : 0.35), by = up ? ay - h * 0.2 : ay + h * 0.25, L = (bx - ax) ** 2 + (by - ay) ** 2, t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / L)); return Math.hypot(px - ax - t * (bx - ax), py - ay - t * (by - ay)) < h * 0.03; };
    raise(o, any(robe, head, neck, arm), { k: 0.34, off: 3, box: [x - 4, top - 4, x + w * 1.6, base + 2] });
    for (let k = 0; k < 5; k++) for (let y = base - h * 0.7; y < base - 2; y++) { const f = (y - (base - h * 0.78)) / (h * 0.78); o.add(sx + (k - 2) * w * 0.14 * (0.6 + f * 0.5), y, -0.16); }   // the folds, fanning to the hem
    x += w * (0.75 + rng() * 0.45);
  }
}

/** A framed panel: a rider on a rearing horse, plunging (the Curtius relief's composition, not its copy). */
export function riderPanel(o, rng) {
  const { W, H } = o, m = Math.min(W, H) * 0.06;
  raise(o, (x, y) => (x < m || x > W - m || y < m || y > H - m) && x > 1 && y > 1 && x < W - 2 && y < H - 2, { k: 0.26 });
  const cx = W * 0.5, cy = H * 0.55, s = H * 0.3;
  const body = (x, y) => (((x - cx) * Math.cos(0.5) + (y - cy) * Math.sin(0.5)) / (s * 0.95)) ** 2 + ((-(x - cx) * Math.sin(0.5) + (y - cy) * Math.cos(0.5)) / (s * 0.38)) ** 2 <= 1;
  const neck = poly([[cx - s * 0.5, cy - s * 0.25], [cx - s * 0.75, cy - s * 0.95], [cx - s * 0.98, cy - s * 0.82], [cx - s * 0.78, cy - s * 0.1]]);
  const head = poly([[cx - s * 0.75, cy - s * 0.95], [cx - s * 1.2, cy - s * 0.75], [cx - s * 1.15, cy - s * 0.62], [cx - s * 0.9, cy - s * 0.72]]);
  const legs = (x, y) => [[cx - s * 0.6, cy, cx - s * 0.95, cy - s * 0.2], [cx - s * 0.45, cy + s * 0.1, cx - s * 0.75, cy + s * 0.1], [cx + s * 0.55, cy + s * 0.35, cx + s * 0.5, cy + s * 1.05], [cx + s * 0.75, cy + s * 0.3, cx + s * 0.9, cy + s * 1.0]]
    .some(([ax, ay, bx, by]) => { const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2))); return Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay)) < s * 0.08; });
  const rider = any(poly([[cx - s * 0.05, cy - s * 0.25], [cx + s * 0.3, cy - s * 0.3], [cx + s * 0.15, cy - s * 0.95], [cx - s * 0.1, cy - s * 0.9]]), disc(cx + s * 0.02, cy - s * 1.1, s * 0.15), poly([[cx + s * 0.1, cy - s * 0.85], [cx + s * 0.55, cy - s * 1.25], [cx + s * 0.6, cy - s * 1.15], [cx + s * 0.18, cy - s * 0.72]]));
  raise(o, any(body, neck, head, legs, rider), { k: 0.36, box: [m, m, W - m, H - m] });
  // the chasm under him: a dark gash across the panel's foot
  for (let x = m * 2; x < W - m * 2; x++) for (let y = H - m - H * 0.12 + Math.sin(x * 0.2) * 2; y < H - m - 2; y++) o.add(x, y, -0.25);
}

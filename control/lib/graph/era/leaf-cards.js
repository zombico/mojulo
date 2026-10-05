/**
 * LEAF CARDS — the late sixth-gen jungle's foliage: painted RGBA tiles of leaves on flat quads, alpha-tested on the
 * World page (emitThreeWorld `cutouts`), so a plant is a few crossed cards and its silhouette lives in the texture.
 * A card is painted leaf by leaf, back to front, the back leaves darker, so a single card already has depth in it.
 *
 *   card:broadleaf  an understory clump (aroid / heliconia): big ovate leaves on petioles fanned from the base
 *   card:fern       fronds arching from the base, pinnae alternating and shrinking to the tip
 *   card:spray      a crown or canopy clump: many small leaves in a ragged mass with holes the sky shows through
 *   card:vine       a hanging liana: a wavering stem with heart leaves, tiling top to bottom
 *   card:litter     fallen leaves for the forest floor (laid flat as a decal), brown and olive
 *   card:roots      a banyan's hanging aerial roots: wavering strands from the top edge, ragged at their ends
 *   card:bamboo     bamboo foliage: drooping twigs hung with narrow lance leaves
 *   card:grass      a clump of tall broad blades from one crown, bowed outward, back blades darker
 *   card:bough      a spruce bough from its base (bottom) to its tip (top): a main shoot, side shoots swept to the tip,
 *                   every shoot a comb of short dark needles, the lower combs hanging; blue-dark, lit at the tips
 *   card:meadow     a meadow tuft: many fine blades from one crown, green into straw, a few seed stalks above
 * and the cutouts a building wears, painted the same way:
 *   card:ivy        ivy cascading from the top edge: wandering stems hung with small lobed leaves, ragged at the foot
 *   card:cobweb     a web strung across a corner (its anchor at the bottom left): radial threads and a spiral, grey
 *   card:banner     a hanging cloth banner: crimson, a gold border and sigil, folds, a torn and holed foot
 *   card:flowers    a window box's flowers: a mound of leaves with red and pink geranium heads, trailing stems
 *   card:laundry    washing on a line along the top edge: shirts, sheets and towels in bright cottons, pegged, sagging
 *   card:awning     a striped canvas awning seen flat: white and blue stripes, a scalloped hem
 *   card:roofs      a town beyond: a skyline of roofs, chimneys and a bell tower, painted near neutral (its row's colour
 *                   sets its distance), for the far rows
 *
 * `cardTexture(key)` → data:image/png (registered as the `card:` texture resolver); `cardMask(key)` → { W, H, a } the
 * alpha the sun bake reads, so light through a canopy card falls in the card's own holes. Deterministic: mulberry32 dice
 * seeded from the card's key, memoized per process.
 */
import { encodePngRgba, registerTextureResolver } from '../landscape/surface-textures.js';
import { mulberry32 } from '../vegetation/grow.js';

const SIZE = 256;
const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

// the palette: deep olive to yellow-green leaf, a brown dry leaf; a leaf's colour is one of these, shaded by depth
const GREENS = [[62, 84, 36], [78, 98, 40], [92, 112, 48], [70, 96, 52], [104, 120, 56]];
const DRY = [[118, 92, 52], [134, 108, 60], [98, 84, 48], [112, 112, 60]];

function canvas() { return { W: SIZE, H: SIZE, px: Buffer.alloc(SIZE * SIZE * 4) }; }

/**
 * Paint one leaf: base (bx, by) in pixels, `ang` the direction to the tip (radians, 0 = +x, y down), `len` and `wid`
 * in pixels, `shape` 'ovate' | 'lance' | 'heart', `bend` the midrib's sideways curl, `col` its colour, `dark` 0..1 the
 * depth shade. The tile wraps horizontally when `wrapX` (the vine).
 */
function leaf(cv, { bx, by, ang, len, wid, shape = 'ovate', bend = 0, col, dark = 0, veins = 7, wrapY = false }) {
  const ca = Math.cos(ang), sa = Math.sin(ang), r = Math.max(len, wid) * 1.2;
  const half = (t) => {
    if (t < 0 || t > 1) return shape === 'heart' && t > -0.12 && t <= 0 ? wid * 0.42 * (1 + t / 0.12) * 0.9 : -1;
    if (shape === 'lance') return (wid / 2) * Math.pow(Math.sin(Math.PI * t), 1.15);
    if (shape === 'heart') return (wid / 2) * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.85 + 0.15)), 0.75) * (1 - 0.25 * t);
    return (wid / 2) * Math.pow(Math.sin(Math.PI * t), 0.7) * (1 - 0.28 * t);
  };
  const shade = 1 - 0.45 * dark;
  for (let y = Math.floor(by - r); y <= by + r; y++) for (let x = Math.floor(bx - r); x <= bx + r; x++) {
    const yy = wrapY ? ((y % SIZE) + SIZE) % SIZE : y;
    if (x < 0 || x >= SIZE || yy < 0 || yy >= SIZE) continue;
    const dx = x - bx, dy = y - by, t = (dx * ca + dy * sa) / len, s0 = -dx * sa + dy * ca;
    const s = s0 - bend * len * t * t, h = half(t);
    if (h <= 0 || Math.abs(s) > h) continue;
    const e = Math.abs(s) / h;                                   // 0 on the midrib, 1 at the edge
    let k = shade * (s > 0 ? 1.12 : 0.9) * (1 - 0.18 * e * e);  // folded along the midrib: one half catches the light
    if (Math.abs(s) < Math.max(0.7, wid * 0.025)) k *= 1.32;    // the midrib
    const vt = t * veins - (Math.abs(s) / (wid / 2)) * 0.9;      // lateral veins, swept toward the tip
    if (vt > 0 && Math.abs(vt - Math.round(vt)) < 0.07 && e > 0.12 && e < 0.92) k *= 1.12;
    if (e > 0.93) k *= 0.8;                                      // a dark rim reads the edge at a distance
    const o = (yy * SIZE + x) * 4;
    cv.px[o] = clamp(col[0] * k); cv.px[o + 1] = clamp(col[1] * k); cv.px[o + 2] = clamp(col[2] * k); cv.px[o + 3] = 255;
  }
}

/** A stem or petiole: a polyline of pixel points, `w` wide. */
function stem(cv, pts, w, col, wrapY = false) {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) + 1;
    for (let k = 0; k <= n; k++) {
      const cx = x0 + ((x1 - x0) * k) / n, cy = y0 + ((y1 - y0) * k) / n;
      for (let y = Math.floor(cy - w); y <= cy + w; y++) for (let x = Math.floor(cx - w); x <= cx + w; x++) {
        const yy = wrapY ? ((y % SIZE) + SIZE) % SIZE : y;
        if (x < 0 || x >= SIZE || yy < 0 || yy >= SIZE || Math.hypot(x - cx, y - cy) > w) continue;
        const o = (yy * SIZE + x) * 4; cv.px[o] = col[0]; cv.px[o + 1] = col[1]; cv.px[o + 2] = col[2]; cv.px[o + 3] = 255;
      }
    }
  }
}

const PAINTERS = {
  broadleaf(cv, R) {
    const n = 8, base = [SIZE / 2, SIZE - 4];
    for (let i = 0; i < n; i++) {
      const back = i < n / 2, f = (i + 0.5) / n, ang = -Math.PI / 2 + (f - 0.5) * 2.3 + (R() - 0.5) * 0.25;
      const pl = SIZE * (0.16 + 0.16 * R()), tip = [base[0] + Math.cos(ang) * pl, base[1] + Math.sin(ang) * pl];
      const col = GREENS[(R() * GREENS.length) | 0];
      stem(cv, [base, [base[0] + Math.cos(ang) * pl * 0.5, base[1] + Math.sin(ang) * pl * 0.55 - 6], tip], 1.6, [64, 78, 36]);
      const la = ang + (ang < -Math.PI / 2 ? -0.5 : 0.5) * (0.6 + R() * 0.6);   // leaves droop outward
      leaf(cv, { bx: tip[0], by: tip[1], ang: la, len: SIZE * (0.26 + 0.1 * R()), wid: SIZE * (0.15 + 0.06 * R()), shape: R() < 0.35 ? 'heart' : 'ovate', bend: (R() - 0.5) * 0.3, col, dark: back ? 0.55 : 0.1 * R(), veins: 9 });
    }
  },
  fern(cv, R) {
    const n = 6, base = [SIZE / 2, SIZE - 4];
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n, ang0 = -Math.PI / 2 + (f - 0.5) * 2.0, curl = (f - 0.5) * 1.4, L = SIZE * (0.62 + 0.14 * R());
      const col = GREENS[(R() * GREENS.length) | 0], dark = i % 2 ? 0.45 : 0.05, pts = [];
      for (let k = 0; k <= 20; k++) { const t = k / 20, a = ang0 + curl * t * t; pts.push([base[0] + Math.cos(a) * L * t + Math.cos(ang0) * 0, base[1] + Math.sin(a) * L * t + 30 * t * t * (1 - Math.abs(Math.sin(ang0)))]); }
      stem(cv, pts, 1.1, [70, 84, 38]);
      for (let k = 2; k < 20; k++) {
        const [px, py] = pts[k], [qx, qy] = pts[k + 1], a = Math.atan2(qy - py, qx - px), t = k / 20, pl = SIZE * 0.14 * (1 - t * 0.75);
        for (const side of [-1, 1]) leaf(cv, { bx: px, by: py, ang: a + side * (1.05 - 0.3 * t), len: pl, wid: pl * 0.32, shape: 'lance', bend: side * 0.15, col, dark, veins: 3 });
      }
    }
  },
  spray(cv, R) {
    // a ragged crown mass: leaves scattered in a blob whose edge breaks up; the centre stays dense, the edge holed
    const cx = SIZE / 2, cy = SIZE / 2;
    for (let i = 0; i < 320; i++) {
      const a = R() * Math.PI * 2, rr = Math.pow(R(), 0.65) * SIZE * 0.4, x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.86;
      const depth = 1 - i / 320, len = SIZE * (0.07 + 0.05 * R());
      leaf(cv, { bx: x, by: y, ang: a + (R() - 0.5) * 2.4, len, wid: len * (0.42 + 0.2 * R()), shape: R() < 0.7 ? 'ovate' : 'lance', bend: (R() - 0.5) * 0.4, col: GREENS[(R() * GREENS.length) | 0], dark: 0.65 * depth, veins: 5 });
    }
  },
  vine(cv, R) {
    // the stem wavers but meets itself at the tile's top and bottom, so a liana is one card repeated down its length
    const pts = []; for (let k = 0; k <= 32; k++) { const t = k / 32; pts.push([SIZE / 2 + 18 * Math.sin(t * Math.PI * 2) + 8 * Math.sin(t * Math.PI * 6), t * SIZE]); }
    stem(cv, pts, 2.2, [84, 74, 46], true);
    for (let k = 0; k < 7; k++) {
      const t = (k + 0.5) / 7, [px, py] = pts[Math.round(t * 32)], side = k % 2 ? -1 : 1, len = SIZE * (0.2 + 0.08 * R());
      leaf(cv, { bx: px, by: py, ang: Math.PI / 2 + side * (0.9 + 0.3 * R()), len, wid: len * 0.75, shape: 'heart', bend: side * 0.2, col: GREENS[(R() * GREENS.length) | 0], dark: 0.2 * R(), veins: 5, wrapY: true });
    }
  },
  roots(cv, R) {
    // a banyan's hanging roots: thin strands from the top edge, wavering down to ragged ends, a few forking
    const TONES = [[118, 100, 80], [96, 82, 66], [134, 116, 94], [84, 74, 60]];
    for (let i = 0; i < 26; i++) {
      const x0 = 8 + R() * (SIZE - 16), len = SIZE * (0.45 + 0.55 * R()), w = 0.8 + 1.4 * R(), col = TONES[(R() * TONES.length) | 0], pts = [];
      const ph = R() * 6, amp = 2 + 5 * R();
      for (let k = 0; k <= 24; k++) { const t = k / 24; pts.push([x0 + amp * Math.sin(ph + t * 7) + 10 * t * (R() - 0.5), t * len]); }
      stem(cv, pts, w, col);
      if (R() < 0.35) { const k0 = 8 + ((R() * 10) | 0), [fx, fy] = pts[k0]; stem(cv, [[fx, fy], [fx + (R() - 0.5) * 30, fy + len * 0.35]], w * 0.7, col); }
    }
  },
  bamboo(cv, R) {
    // bamboo foliage: thin drooping twigs, each a fan of narrow lance leaves hanging from it
    for (let i = 0; i < 9; i++) {
      const bx = SIZE * (0.15 + 0.7 * R()), by = SIZE * (0.12 + 0.35 * R()), ang = Math.PI * (0.1 + 0.8 * R()), L = SIZE * (0.25 + 0.2 * R());
      const pts = []; for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push([bx + Math.cos(ang) * L * t * 0.6, by + Math.sin(ang) * L * t * 0.3 + L * 0.5 * t * t]); }
      stem(cv, pts, 0.9, [96, 104, 50]);
      for (let k = 2; k <= 10; k += 1) {
        const [px, py] = pts[k], len = SIZE * (0.12 + 0.08 * R()), side = k % 2 ? 1 : -1;
        leaf(cv, { bx: px, by: py, ang: Math.PI / 2 + side * (0.3 + 0.5 * R()), len, wid: len * 0.16, shape: 'lance', bend: side * 0.2, col: GREENS[(R() * GREENS.length) | 0], dark: (i % 3) * 0.2, veins: 2 });
      }
    }
  },
  grass(cv, R) {
    // a clump of broad, sharp blades from one crown (Snake Eater's tall grass): long lances fanned and bowed, the
    // back blades darker, the front ones catching light
    const n = 34, base = [SIZE / 2, SIZE - 2];
    for (let i = 0; i < n; i++) {
      const f = i / n, ang = -Math.PI / 2 + (R() - 0.5) * 1.5, len = SIZE * (0.55 + 0.42 * R()), wid = SIZE * (0.04 + 0.025 * R());
      const bx = base[0] + (R() - 0.5) * SIZE * 0.22;
      leaf(cv, { bx, by: base[1], ang, len, wid, shape: 'lance', bend: (ang + Math.PI / 2) * 0.5 + (R() - 0.5) * 0.25, col: [[74, 96, 42], [88, 110, 48], [102, 120, 56], [80, 104, 52]][(R() * 4) | 0], dark: 0.55 * (1 - f), veins: 1 });
    }
  },
  bough(cv, R) {
    // a needle: a short dark stroke off its shoot, the newer ones (at the shoot's tip) lighter
    const TONES = [[30, 54, 44], [38, 66, 52], [46, 76, 58], [58, 90, 66]];
    const needles = (pts, len, dark, hang) => {
      for (let k = 0; k + 1 < pts.length; k++) {
        const [px, py] = pts[k], [qx, qy] = pts[k + 1], a = Math.atan2(qy - py, qx - px), t = k / (pts.length - 1);
        for (const side of [-1, 1]) for (let j = 0; j < 2; j++) {
          const bx = px + (qx - px) * (j / 2), by = py + (qy - py) * (j / 2), na = a + side * (0.85 + 0.35 * R()) + hang * (Math.PI / 2 - a) * 0.5;
          leaf(cv, { bx, by, ang: na, len: len * (0.75 + 0.5 * R()) * (1 - 0.35 * t), wid: 2.2, shape: 'lance', col: TONES[Math.min(3, (t * 2.4 + R() * 1.6) | 0)], dark, veins: 1 });
        }
      }
    };
    const axis = []; const bend = (R() - 0.5) * 30;
    for (let k = 0; k <= 24; k++) { const t = k / 24; axis.push([SIZE / 2 + bend * t * t + 4 * Math.sin(t * 5), SIZE - 2 - t * (SIZE - 10)]); }
    // the side shoots, back (dark) first; each sweeps toward the tip and droops a little, shorter toward the tip
    const shoot = (bx, by, a0, side, L, dark, hang, depth) => {
      const pts = []; for (let j = 0; j <= 8; j++) { const u = j / 8, a = a0 - side * 0.35 * u; pts.push([bx + Math.cos(a) * L * u, by + Math.sin(a) * L * u + 10 * u * u * (L / SIZE) * 3]); }
      stem(cv, pts, depth ? 0.7 : 1, [70, 58, 40]);
      // a side shoot carries its own shoots, alternate, swept the same way (the spruce's flat-topped, hanging sprays)
      if (!depth) for (let j = 2; j < 8; j += 2) { const [qx, qy] = pts[j], sd = j % 4 ? 1 : -1; shoot(qx, qy, a0 - side * 0.35 * (j / 8) + sd * 0.9, sd, L * 0.38 * (1 - j / 12), dark, hang, 1); }
      needles(pts, depth ? 10 : 13, dark, hang);
    };
    for (const pass of [0, 1]) for (let k = 2; k < 23; k++) {
      for (const side of [-1, 1]) {
        if ((k + (side > 0 ? 1 : 0) + pass) % 2) continue;
        const t = k / 24, [bx, by] = axis[k], L = SIZE * (0.5 - 0.36 * t) * (0.8 + 0.4 * R()), a0 = -Math.PI / 2 + side * (1.0 - 0.25 * t + 0.2 * (R() - 0.5));
        shoot(bx, by, a0, side, L, pass ? 0.05 : 0.5, 0.6 * (1 - t), 0);
      }
    }
    stem(cv, axis, 1.6, [84, 66, 44]);
    needles(axis, 12, 0.1, 0);
  },
  meadow(cv, R) {
    // fine blades fanned from one crown, the back ones dark, green going to straw at the tips; seed stalks above
    const base = [SIZE / 2, SIZE - 2], BL = [[84, 110, 46], [98, 122, 52], [112, 128, 60], [128, 132, 70], [146, 138, 82]];
    for (let i = 0; i < 70; i++) {
      const f = i / 70, ang = -Math.PI / 2 + (R() - 0.5) * 1.3, len = SIZE * (0.4 + 0.5 * R()), wid = SIZE * (0.012 + 0.012 * R());
      leaf(cv, { bx: base[0] + (R() - 0.5) * SIZE * 0.18, by: base[1], ang, len, wid, shape: 'lance', bend: (ang + Math.PI / 2) * 0.6 + (R() - 0.5) * 0.3, col: BL[Math.min(4, (f * 3 + R() * 2.2) | 0)], dark: 0.6 * (1 - f), veins: 1 });
    }
    for (let i = 0; i < 4; i++) {
      const x0 = base[0] + (R() - 0.5) * SIZE * 0.3, top = [x0 + (R() - 0.5) * SIZE * 0.25, SIZE * (0.04 + 0.12 * R())];
      stem(cv, [[x0, base[1]], [(x0 + top[0]) / 2, (base[1] + top[1]) / 2], top], 0.9, [150, 140, 92]);
      for (let k = 0; k < 6; k++) leaf(cv, { bx: top[0] + (R() - 0.5) * 3, by: top[1] + k * 5, ang: -Math.PI / 2 + (R() - 0.5) * 0.8, len: 9, wid: 3.4, shape: 'lance', col: [164, 150, 98], dark: 0.1, veins: 1 });
    }
  },
  ivy(cv, R) {
    // stems wander down from the top edge, each hung with ivy leaves (three to five lobes, dark and glossy)
    const DARK = [[34, 52, 30], [44, 64, 34], [52, 72, 40], [40, 58, 36]];
    const ivyLeaf = (x, y, s, col, dark) => {
      for (const [da, k] of [[0, 1], [-0.9, 0.7], [0.9, 0.7], [-1.7, 0.45], [1.7, 0.45]]) leaf(cv, { bx: x, by: y, ang: Math.PI / 2 + da + (R() - 0.5) * 0.3, len: s * k, wid: s * k * 0.75, shape: 'ovate', col, dark, veins: 3 });
    };
    for (let i = 0; i < 15; i++) {
      const x0 = 10 + R() * (SIZE - 20), len = SIZE * (0.45 + 0.55 * R()), pts = [];
      for (let k = 0; k <= 16; k++) { const t = k / 16; pts.push([x0 + 14 * Math.sin(t * 5 + i) + 8 * (R() - 0.5), t * len]); }
      stem(cv, pts, 1.1, [72, 60, 44]);
      for (let k = 1; k <= 16; k++) { const [x, y] = pts[k], t = k / 16; if (R() < 0.85) ivyLeaf(x + (R() - 0.5) * 14, y, SIZE * (0.05 + 0.04 * R()) * (1 - 0.35 * t), DARK[(R() * 4) | 0], i % 3 === 0 ? 0.5 : 0.15 * R()); }
    }
    for (let i = 0; i < 40; i++) ivyLeaf(R() * SIZE, R() * SIZE * 0.3, SIZE * (0.05 + 0.04 * R()), DARK[(R() * 4) | 0], 0.3 * R());   // the mass at the top edge
  },
  cobweb(cv, R) {
    // anchored in the corner at the bottom left (uv 0,0): radial threads fanning across the quarter, a spiral strung on
    // them, sagging; one torn sector
    const thread = (x0, y0, x1, y1, a) => {
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
      for (let k = 0; k <= n; k++) {
        const x = Math.round(x0 + ((x1 - x0) * k) / n), y = Math.round(y0 + ((y1 - y0) * k) / n);
        if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;
        const o = (y * SIZE + x) * 4; cv.px[o] = 196; cv.px[o + 1] = 198; cv.px[o + 2] = 204; cv.px[o + 3] = Math.max(cv.px[o + 3], a);
      }
    };
    const O = [2, SIZE - 3], spokes = 9, torn = 3 + ((R() * 4) | 0), ang = (k) => -((Math.PI / 2) * k) / (spokes - 1);
    for (let k = 0; k < spokes; k++) { const L = SIZE * (0.92 + 0.06 * R()); thread(O[0], O[1], O[0] + Math.cos(ang(k)) * L, O[1] + Math.sin(ang(k)) * L, 255); }
    for (let r = 14; r < SIZE * 0.9; r += 9 + R() * 5) for (let k = 0; k + 1 < spokes; k++) {
      if (k === torn && r > SIZE * 0.35) continue;
      const sag = (r / SIZE) * 6, a0 = ang(k), a1 = ang(k + 1), m = (a0 + a1) / 2;
      const p0 = [O[0] + Math.cos(a0) * r, O[1] + Math.sin(a0) * r], p1 = [O[0] + Math.cos(m) * (r - sag), O[1] + Math.sin(m) * (r - sag)], p2 = [O[0] + Math.cos(a1) * r, O[1] + Math.sin(a1) * r];
      thread(...p0, ...p1, 255); thread(...p1, ...p2, 255);
    }
  },
  banner(cv, R) {
    // cloth from x 0.2 to 0.8 of the card, hanging from the top: crimson with vertical folds, a gold border, a gold
    // sigil (a ring round a lozenge), and a swallowtail foot torn and holed
    const x0 = SIZE * 0.2, x1 = SIZE * 0.8, w = x1 - x0, foot = (x) => { const t = (x - x0) / w; return SIZE * (0.84 + 0.12 * Math.abs(t - 0.5) * 2) + 7 * Math.sin(x * 0.6) * R(); };
    const holes = [...Array(5)].map(() => [x0 + w * R(), SIZE * (0.55 + 0.4 * R()), 2 + 5 * R()]);
    for (let y = 0; y < SIZE; y++) for (let x = Math.ceil(x0); x < x1; x++) {
      if (y > foot(x) || holes.some(([hx, hy, hr]) => Math.hypot(x - hx, y - hy) < hr)) continue;
      const t = (x - x0) / w, fold = 0.78 + 0.22 * Math.cos(t * Math.PI * 7 + 0.6) * (0.6 + 0.4 * (y / SIZE)), wear = 0.88 + 0.12 * R();
      const edge = Math.min(x - x0, x1 - x), border = edge > 7 && edge < 14 || (y > 8 && y < 15);
      const dx = x - SIZE / 2, dy = y - SIZE * 0.42, rr = Math.hypot(dx, dy);
      const sigil = (rr > 34 && rr < 41) || Math.abs(dx) / 22 + Math.abs(dy) / 34 < 1 && Math.abs(dx) / 22 + Math.abs(dy) / 34 > 0.7;
      const col = border || sigil ? [176, 138, 62] : [118, 26, 30], k = fold * wear * (y > foot(x) - 6 ? 0.7 : 1);
      const o = (y * SIZE + x) * 4; cv.px[o] = clamp(col[0] * k); cv.px[o + 1] = clamp(col[1] * k); cv.px[o + 2] = clamp(col[2] * k); cv.px[o + 3] = 255;
    }
  },
  flowers(cv, R) {
    // a leafy mound from the bottom edge, flower heads dotted over its top, a few stems trailing down past the edge
    const LEAF = [[52, 96, 40], [64, 112, 44], [44, 84, 36]], HEAD = [[214, 40, 44], [236, 84, 104], [246, 128, 150], [198, 30, 52]];
    for (let i = 0; i < 90; i++) {
      const x = SIZE * (0.06 + 0.88 * R()), h = SIZE * 0.55 * Math.sin(Math.PI * (x / SIZE)) * (0.5 + 0.5 * R()), y = SIZE - 4 - h * R();
      leaf(cv, { bx: x, by: y, ang: -Math.PI / 2 + (R() - 0.5) * 2.4, len: SIZE * (0.07 + 0.05 * R()), wid: SIZE * 0.06, shape: 'heart', col: LEAF[(R() * 3) | 0], dark: 0.5 * (1 - i / 90), veins: 3 });
    }
    for (let i = 0; i < 26; i++) {
      const x = SIZE * (0.1 + 0.8 * R()), top = SIZE - 4 - SIZE * 0.55 * Math.sin(Math.PI * (x / SIZE)) * (0.55 + 0.4 * R()), c = HEAD[(R() * 4) | 0];
      for (let k = 0; k < 9; k++) leaf(cv, { bx: x + (R() - 0.5) * 12, by: top + (R() - 0.5) * 10, ang: R() * 6.3, len: 7, wid: 6, shape: 'ovate', col: c, dark: 0.15 * R(), veins: 1 });
    }
  },
  laundry(cv, R) {
    // the line sags across the top; garments hang from it, each pegged, each its own cotton
    const C = [[236, 236, 228], [88, 140, 210], [232, 196, 72], [222, 92, 80], [120, 186, 132], [244, 168, 188]], sag = (x) => 10 + 14 * Math.sin((Math.PI * x) / SIZE);
    stem(cv, [...Array(17)].map((_, k) => [(k * SIZE) / 16, sag((k * SIZE) / 16)]), 0.8, [70, 64, 58]);
    let x = 6;
    while (x < SIZE - 30) {
      const w = 34 + 30 * R(), kind = R(), col = C[(R() * C.length) | 0], top = sag(x + w / 2) + 1;
      const h = kind < 0.35 ? w * 1.1 : kind < 0.7 ? 70 + 90 * R() : 40 + 30 * R();
      for (let y = Math.floor(top); y < top + h && y < SIZE; y++) for (let xx = Math.floor(x); xx < x + w; xx++) {
        const t = (y - top) / h, u = (xx - x) / w;
        if (kind < 0.35 && t > 0.28 && (u < 0.2 || u > 0.8)) continue;   // a shirt: sleeves at the shoulders only
        if (t > 0.97 - 0.05 * Math.sin(u * 9 + x)) continue;
        const fold = 0.84 + 0.16 * Math.cos(u * Math.PI * 4 + x), o = (y * SIZE + xx) * 4;
        cv.px[o] = clamp(col[0] * fold); cv.px[o + 1] = clamp(col[1] * fold); cv.px[o + 2] = clamp(col[2] * fold); cv.px[o + 3] = 255;
      }
      for (const px of [x + 3, x + w - 5]) stem(cv, [[px, top - 3], [px, top + 5]], 1.4, [150, 112, 70]);   // pegs
      x += w + 3 + 6 * R();
    }
  },
  awning(cv, R) {
    // canvas from the top edge down to a scalloped hem; stripes run down it (the card's v), shading toward the hem
    const hem = (x) => SIZE * 0.78 + 14 * Math.abs(Math.sin((Math.PI * x) / (SIZE / 6)));
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      if (y > hem(x)) continue;
      const white = Math.floor(x / (SIZE / 12)) % 2 === 0, col = white ? [238, 234, 222] : [46, 104, 178], k = (0.95 - 0.2 * (y / SIZE)) * (0.96 + 0.06 * R());
      const o = (y * SIZE + x) * 4; cv.px[o] = clamp(col[0] * k); cv.px[o + 1] = clamp(col[1] * k); cv.px[o + 2] = clamp(col[2] * k); cv.px[o + 3] = 255;
    }
  },
  roofs(cv, R) {
    // one flat tone, a lighter roof-slope band, a skyline of gables, chimneys and one bell tower; the card's foot is solid
    const sky = new Float32Array(SIZE); let x = 0;
    while (x < SIZE) {
      const w = 22 + 36 * R(), h = SIZE * (0.4 + 0.25 * R()), gable = R() < 0.55;
      for (let i = 0; i < w && x + i < SIZE; i++) { const t = i / w; sky[Math.floor(x + i)] = Math.max(sky[Math.floor(x + i)] || 0, h + (gable ? 26 * (1 - Math.abs(t - 0.5) * 2) : 0)); }
      if (R() < 0.4) { const c = Math.floor(x + w * (0.2 + 0.6 * R())); for (let i = 0; i < 5 && c + i < SIZE; i++) sky[c + i] = Math.max(sky[c + i], h + 22); }
      x += w;
    }
    // a campanile: a shaft and a pyramid cap, standing over the roofs
    const bt = Math.floor(SIZE * (0.3 + 0.4 * R()));
    for (let i = 0; i < 22; i++) sky[bt + i] = SIZE * 0.78 + (11 - Math.abs(i - 10.5)) * 2.2;
    // the bottom rows stay clear: the tile repeats, so a solid foot would bleed into the card's top edge as a line
    for (let xx = 0; xx < SIZE; xx++) for (let y = 0; y < SIZE - 3; y++) {
      const hgt = SIZE - y; if (hgt > sky[xx]) continue;
      const v = hgt > sky[xx] - 10 ? [214, 170, 156] : [236, 234, 230], o = (y * SIZE + xx) * 4;   // near neutral: the row's colour sets its distance
      cv.px[o] = v[0]; cv.px[o + 1] = v[1]; cv.px[o + 2] = v[2]; cv.px[o + 3] = 255;
    }
  },
  litter(cv, R) {
    for (let i = 0; i < 70; i++) {
      const len = SIZE * (0.07 + 0.07 * R()), col = R() < 0.78 ? DRY[(R() * DRY.length) | 0] : GREENS[(R() * GREENS.length) | 0];
      leaf(cv, { bx: 12 + R() * (SIZE - 24), by: 12 + R() * (SIZE - 24), ang: R() * Math.PI * 2, len, wid: len * (0.4 + 0.2 * R()), shape: R() < 0.6 ? 'ovate' : 'lance', bend: (R() - 0.5) * 0.6, col, dark: 0.5 * (1 - i / 70), veins: 5 });
    }
  },
};

export const CARD_KEYS = Object.freeze(Object.keys(PAINTERS).map((k) => `card:${k}`));

const built = {};
function build(key) {
  if (built[key]) return built[key];
  const kind = key.slice(5), paint = PAINTERS[kind]; if (!paint) return null;
  const cv = canvas(); let h = 2166136261; for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  paint(cv, mulberry32(h >>> 0));
  const a = new Uint8Array(SIZE * SIZE); for (let i = 0; i < SIZE * SIZE; i++) a[i] = cv.px[i * 4 + 3];
  // clear texels take their nearest leaf's colour (one pass of a 4-neighbour fill), so mip filtering at the cut edge
  // blends leaf into leaf, not into black
  for (let pass = 0; pass < 6; pass++) for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const o = (y * SIZE + x) * 4; if (cv.px[o + 3] || cv.px[o] || cv.px[o + 1]) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= SIZE || yy >= SIZE) continue;
      const q = (yy * SIZE + xx) * 4; if (cv.px[q] || cv.px[q + 1]) { cv.px[o] = cv.px[q]; cv.px[o + 1] = cv.px[q + 1]; cv.px[o + 2] = cv.px[q + 2]; break; }
    }
  }
  return (built[key] = { url: `data:image/png;base64,${encodePngRgba(cv.px, SIZE, SIZE).toString('base64')}`, mask: { W: SIZE, H: SIZE, a } });
}

export function cardTexture(key) { const b = build(key); return b ? b.url : null; }
export function cardMask(key) { const b = build(key); return b ? b.mask : null; }
/** Coverage of a card: the share of its texels that are leaf (a canopy's openness is 1 − this). */
export function cardCover(key) { const m = cardMask(key); let n = 0; for (const v of m.a) if (v) n++; return n / m.a.length; }

registerTextureResolver('card:', cardTexture);

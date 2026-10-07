/**
 * historic/assets/giza — the Old Kingdom Giza kit (c. 2515 BCE, the 4th Dynasty under Menkaure), built
 * from the record (../record/giza.js) and the dreamed sheets. The pyramids are read NEW:
 *  - smooth faces of white Tura limestone, not today's stepped core;
 *  - Khafre's lowest course in red granite;
 *  - Menkaure's lower casing in granite, its faces still undressed.
 * Same contract as the other kits (./kit.js): each asset builds in its slot's local frame, front = −y.
 * Sloped faces are `panel`s, which the kit turns and lifts with the slot.
 */
import { scaleHex } from '../../polygonizer/vexar.js';

const box = (kind, x, y, w, d, z0, z1, tint, o = {}) => ({ kind, x, y, w, d, z0, z1, tint, ...o });
const DARK = '#2a2420';
const bbox = (pts) => { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), zs = pts.map((p) => p[2]); return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(0.01, Math.max(...xs) - Math.min(...xs)), d: Math.max(0.01, Math.max(...ys) - Math.min(...ys)), z0: Math.min(...zs), z1: Math.max(...zs) }; };
const panel = (kind, pts, out, tint) => ({ kind, solid: 'panel', pts, out, ...bbox(pts), tint });
const DEG = Math.PI / 180;

/**
 * A true pyramid's four faces as panels, centred at (cx, cy), base `b`, height `h`. Each face is cut
 * into rows and each row into pieces of no more than ~36 m: a whole 230 m face near an eye-level camera
 * crosses behind it and the page drops it. `band(t)` → [kind, tint] by height fraction (granite courses
 * at the foot).
 */
export function pyramidFaces(cx, cy, b, h, band, { rows = [0.1, 0.22, 0.36, 0.52, 0.7, 0.86, 1], split = 36 } = {}) {
  const out = [], A = [cx, cy, h], r = b / 2;
  const C = [[cx - r, cy - r], [cx + r, cy - r], [cx + r, cy + r], [cx - r, cy + r]];
  const sides = [[0, 1, [0, -1]], [1, 2, [1, 0]], [2, 3, [0, 1]], [3, 0, [-1, 0]]];
  const at = (c, t) => [c[0] + (A[0] - c[0]) * t, c[1] + (A[1] - c[1]) * t, h * t];
  const cuts = [...new Set([0, ...(band.cuts || []), ...rows])].filter((t) => t <= 1).sort((p, q) => p - q);
  for (const [i, j, [nx, ny]] of sides) {
    for (let k = 0; k < cuts.length - 1; k++) {
      const t0 = cuts[k], t1 = cuts[k + 1], [kind, tint] = band((t0 + t1) / 2);
      const m = Math.max(1, Math.ceil((b * (1 - t0)) / split));
      for (let q = 0; q < m; q++) {
        const lerp = (p, s, f) => [p[0] + (s[0] - p[0]) * f, p[1] + (s[1] - p[1]) * f, p[2] + (s[2] - p[2]) * f];
        const b0 = at(C[i], t0), b1 = at(C[j], t0), u0 = at(C[i], t1), u1 = at(C[j], t1);
        out.push(panel(kind, [lerp(b0, b1, q / m), lerp(b0, b1, (q + 1) / m), lerp(u0, u1, (q + 1) / m), lerp(u0, u1, q / m)], [nx, ny, 0.8], tint));
      }
    }
  }
  return out;
}
/**
 * The casing by height fraction: granite courses at the foot (`granite`, `rough`), Tura limestone above,
 * and the pyramidion — the capstone, `ph` m tall — at the apex. `pyramidion: 'electrum'` sheathes it in
 * electrum, which is a CONJECTURE for Giza: a gilded cap is attested only from the 5th Dynasty on
 * (../record/giza.js `gilded-pyramidion`); the one Giza capstone found is plain limestone.
 */
const casingBand = (P, h, { granite = 0, rough = false, pyramidion } = {}) => {
  const ph = Math.max(1.5, h * 0.02), cap = 1 - ph / h;
  const f = (t) => (t > cap ? (pyramidion === 'electrum' ? ['pyramidion-gilt', P.electrum] : ['pyramidion', scaleHex(P.tura, 1.03)]) : t < granite ? (rough ? ['pyramid-rough', scaleHex(P.granite, 0.96)] : ['pyramid-granite', P.granite]) : ['pyramid', P.tura]);
  f.cuts = [granite, cap].filter((t) => t > 0);
  return f;
};

/** A king's pyramid on its paved court, inside an enclosure wall (open on the front for the mortuary temple). */
export const pyramid = {
  id: 'gz-pyramid', sheet: 'gz-pyramid', designed: true, patterns: ['pyramid', 'stone-ashlar'],
  read: 'A true pyramid cased in smooth white limestone to a sharp apex, on a paved court, a plain stone enclosure wall round it.',
  notes: ['Slope from the slot (`slope`, degrees): Khufu 51.84°, Khafre 53.13°, Menkaure 51.33°.', 'The pyramidion (2% of the height, ≥ 1.5 m): limestone, or `pyramidion: \'electrum\'` (conjecture at Giza).', 'Casing: Tura limestone; `granite` = the height fraction cased in red granite at the foot (`rough`: left undressed).', 'Court `court` m wide round the base, wall 3 m thick and 6 m high, a gap `gap` m wide on the front for the temple.'],
  envelope: { w: [60, 260], d: [60, 260] },
  build({ W, D, slot }, { palette: P }) {
    const court = slot.court ?? 10, b = Math.min(W, D) - 2 * court, h = (b / 2) * Math.tan((slot.slope ?? 51.84) * DEG), cx = W / 2, cy = D / 2, t = 3, wh = 6, gap = slot.gap ?? 0;
    const out = pyramidFaces(cx, cy, b, h, casingBand(P, h, slot));
    // the enclosure wall: three sides whole, the front open where the temple meets it
    if (court >= 6) {
      out.push(box('enclosure', 0, D - t, W, t, 0, wh, P.limestone), box('enclosure', 0, t, t, D - 2 * t, 0, wh, P.limestone), box('enclosure', W - t, t, t, D - 2 * t, 0, wh, P.limestone));
      const g0 = (W - gap) / 2;
      if (g0 > 0) out.push(box('enclosure', 0, 0, g0, t, 0, wh, P.limestone), box('enclosure', W - g0, 0, g0, t, 0, wh, P.limestone));
    }
    const grounds = [{ kind: 'court', x: t, y: 0, w: W - 2 * t, d: D - t, z: 0.06, fill: P.paving, surface: 'flagstone' }];
    return { boxes: out, grounds };
  },
};

/** A queen's pyramid with its small offering chapel on the front (east). */
export const queenPyramid = {
  id: 'gz-queen-pyramid', sheet: 'gz-queen-pyramid', designed: true, patterns: ['pyramid', 'stone-ashlar'],
  read: 'A small cased pyramid, a flat-roofed stone chapel against its east face.',
  notes: ['Base = slot width; slope 51.8°; the chapel 40% of the base wide, 5 m deep, 4.5 m high, on the front.', '`chapel: false`: a king\'s satellite (cult) pyramid, no chapel.'],
  envelope: { w: [20, 52], d: [26, 60] },
  build({ W, D, slot }, { palette: P }) {
    const chapel = slot.chapel !== false, b = chapel ? Math.min(W, D - 6) : Math.min(W, D), h = (b / 2) * Math.tan(51.8 * DEG), cy = D - b / 2;
    const out = pyramidFaces(W / 2, cy, b, h, casingBand(P, h, slot), { rows: [0.25, 0.55, 0.8, 1], split: 30 });
    if (chapel) out.push(box('chapel', W * 0.3, 0.6, W * 0.4, D - b - 0.4, 0, 4.5, P.limestone), box('door', W / 2 - 0.6, 0.55, 1.2, 0.1, 0, 2.6, DARK));
    return out;
  },
};

/**
 * A mortuary temple against the pyramid's front (Khufu's as excavated): a walled rectangle, an open
 * court ringed by square red-granite pillars under a roofed walk, the court floored in black basalt, a
 * hall at the back against the pyramid; a door from the causeway on the front.
 */
export const mortuaryTemple = {
  id: 'gz-mortuary-temple', sheet: 'gz-mortuary-temple', designed: true, patterns: ['stone-ashlar', 'colonnade'],
  read: 'A walled limestone temple: an open court of black basalt ringed by square red-granite pillars under a flat-roofed walk, a hall behind.',
  notes: ['Walls 3 m, 8.5 m high; the walk 5 m deep on pillars 1.1 m square every ~3.6 m; the back hall 9 m deep.', 'Doors 3.5 m on the front (the causeway) and back (to the pyramid court).'],
  envelope: { w: [34, 60], d: [30, 50] },
  build({ W, D }, { palette: P }) {
    const t = 3, H = 8.5, door = 3.5, hall = 9, walk = 5, out = [], s = P.limestone;
    const wallX = (y0, y1, x) => out.push(box('temple-wall', x, y0, t, y1 - y0, 0, H, s));
    for (const y of [0, D - t]) { const g0 = (W - door) / 2; out.push(box('temple-wall', 0, y, g0, t, 0, H, s), box('temple-wall', g0 + door, y, g0, t, 0, H, s), box('temple-wall', g0, y, door, t, door + 2.2, H, s)); }
    wallX(t, D - t, 0); wallX(t, D - t, W - t);
    // the back hall, roofed, against the pyramid court
    out.push(box('temple-roof', t, D - t - hall, W - 2 * t, hall, H - 1, H, s), box('temple-wall', t, D - t - hall, (W - door) / 2 - t, 1.2, 0, H - 1, s), box('temple-wall', (W + door) / 2, D - t - hall, (W - door) / 2 - t, 1.2, 0, H - 1, s));
    // the court and its pillared walk
    const c = { x: t + walk, y: t + walk, w: W - 2 * t - 2 * walk, d: D - 2 * t - hall - walk };
    const pil = (x, y) => out.push(box('pillar', x - 0.55, y - 0.55, 1.1, 1.1, 0, H - 1, P.granite));
    const nx = Math.max(2, Math.round(c.w / 3.6)), ny = Math.max(2, Math.round(c.d / 3.6));
    for (let i = 0; i <= nx; i++) { pil(c.x + (c.w * i) / nx, c.y); pil(c.x + (c.w * i) / nx, c.y + c.d); }
    for (let j = 1; j < ny; j++) { pil(c.x, c.y + (c.d * j) / ny); pil(c.x + c.w, c.y + (c.d * j) / ny); }
    // the walk's roof: slabs from the walls to the pillars
    out.push(box('temple-roof', t, t, W - 2 * t, walk + 0.6, H - 1, H - 0.2, s), box('temple-roof', t, c.y + c.d - 0.6, W - 2 * t, walk + 0.6 - (c.y + c.d + walk - (D - t - hall)), H - 1, H - 0.2, s));
    out.push(box('temple-roof', t, c.y + 0.6, walk + 0.6, c.d - 1.2, H - 1, H - 0.2, s), box('temple-roof', W - t - walk - 0.6, c.y + 0.6, walk + 0.6, c.d - 1.2, H - 1, H - 0.2, s));
    const grounds = [{ kind: 'basalt', x: t, y: t, w: W - 2 * t, d: D - 2 * t, z: 0.08, fill: P.basalt, surface: 'flagstone' }];
    return { boxes: out, grounds };
  },
};

/**
 * A valley temple (Khafre's): a massive square block, its battered walls cased in polished red granite,
 * flat-roofed, two doors in its front onto a stone terrace above the harbour. `open`: the Sphinx temple
 * beside it — limestone, its court open to the sky and ringed by granite pillars (and never finished).
 */
export const valleyTemple = {
  id: 'gz-valley-temple', sheet: 'gz-valley-temple', designed: true, patterns: ['stone-ashlar', 'river-front'],
  read: 'A great square block of red granite, battered walls, flat roof, two dark doorways in the front, a terrace before it on the water.',
  notes: ['Block = slot width square, 13 m high, battered 1:10; doors 3 m × 7 m at a quarter and three quarters.', 'Terrace 1.2 m high in front (the rest of the slot depth), ramps down to the quay.', '`open`: an open court with granite pillars (the Sphinx temple), limestone walls.', '`unfinished`: the limestone core waiting for its granite (Menkaure\'s, in his reign).'],
  envelope: { w: [36, 50], d: [44, 62] },
  build({ W, D, slot }, { palette: P }) {
    const S = W, y0 = D - S, H = slot.open ? 10 : 13, lean = H * 0.1, out = [];
    const core = slot.open || slot.unfinished, tint = core ? P.limestone : P.granite, kind = core ? 'temple-wall' : 'granite-casing';
    if (slot.open) {
      const t = 4;
      out.push({ kind, solid: 'frustum', x: 0, y: y0, w: S, d: t, z0: 0, z1: H, top: { x: lean, y: y0 + lean, w: S - 2 * lean, d: t - lean }, tint });
      out.push({ kind, solid: 'frustum', x: 0, y: D - t, w: S, d: t, z0: 0, z1: H, top: { x: lean, y: D - t, w: S - 2 * lean, d: t - lean }, tint });
      for (const x of [0, S - t]) out.push({ kind, solid: 'frustum', x, y: y0 + t, w: t, d: S - 2 * t, z0: 0, z1: H, top: { x: x === 0 ? lean : x, y: y0 + t, w: t - lean, d: S - 2 * t }, tint });
      const n = 5;
      for (let i = 0; i < n; i++) for (const y of [y0 + t + 5, D - t - 5]) out.push(box('pillar', t + 4 + ((S - 2 * t - 8) * i) / (n - 1) - 0.6, y - 0.6, 1.2, 1.2, 0, H - 2, P.granite));
    } else {
      out.push({ kind, solid: 'frustum', x: 0, y: y0, w: S, d: S, z0: 0, z1: H, top: { x: lean, y: y0 + lean, w: S - 2 * lean, d: S - 2 * lean }, tint });
      out.push(box('temple-roof', lean + 0.5, y0 + lean + 0.5, S - 2 * lean - 1, S - 2 * lean - 1, H, H + 0.4, P.limestone));
    }
    for (const f of [0.25, 0.75]) out.push(box('door', S * f - 1.5, y0 - 0.05, 3, 0.4, 0.2, 7, DARK));
    // the terrace before it, a ramp down each side to the quay
    if (y0 > 2) out.push(box('terrace', 2, 0, S - 4, y0, 0, 1.2, P.limestone), { kind: 'ramp', solid: 'wedge', rise: 'x+', x: -0.01, y: 1, w: 2, d: y0 - 2, z0: 0, z1: 1.2, tint: P.limestone }, { kind: 'ramp', solid: 'wedge', rise: 'x-', x: S - 1.99, y: 1, w: 2, d: y0 - 2, z0: 0, z1: 1.2, tint: P.limestone });
    return out;
  },
};

/**
 * The Great Sphinx, new: a recumbent lion carved from the plateau's own beds (so its body shows the
 * strata), the forelegs reaching far forward, a king's head in the nemes headcloth with the uraeus — no
 * beard (that came later). Front (−y) = its face, to the east. Built in rounded forms like the
 * criosphinx, at 13 times the size.
 */
export const greatSphinx = {
  id: 'gz-sphinx', sheet: 'gz-sphinx', designed: true, patterns: ['guardians', 'colossus'],
  read: 'A colossal lion lying in a sunken quarry, carved from layered bedrock, its forelegs stretched far forward, a small king\'s head in the striped nemes.',
  notes: ['73 m long, 20 m to the top of the head, 19 m wide.', 'Body: barrel back, domed haunch and shoulders, forelegs 15 m long; head ~5 m, nemes lappets on the chest; uraeus; no beard.', 'Skin: bedrock strata; the head in the harder upper bed, paler.'],
  envelope: { w: [18, 22], d: [68, 76] },
  build({ W, D }, { palette: P }) {
    const k = P.bedrock, hd = P.limestone, cx = W / 2, s = D / 73, out = [];
    const S = (v) => v * s;
    out.push({ kind: 'sphinx', solid: 'vault', axis: 'y', x: cx - S(7.4), y: S(22), w: S(14.8), d: S(38), z0: 0, z1: S(11), tint: k });
    out.push({ kind: 'sphinx', solid: 'dome', sides: 10, x: cx - S(8.6), y: S(52), w: S(17.2), d: S(20.5), z0: 0, z1: S(10.5), tint: k });
    out.push({ kind: 'sphinx', solid: 'dome', sides: 10, x: cx - S(8.2), y: S(13), w: S(16.4), d: S(17), z0: 0, z1: S(13.5), tint: k });
    out.push({ kind: 'sphinx', solid: 'frustum', x: cx - S(7), y: S(13.5), w: S(14), d: S(9), z0: 0, z1: S(11.5), top: { x: cx - S(5.5), y: S(16), w: S(11), d: S(7) }, tint: k });
    for (const o of [-1, 1]) {
      // the forelegs, rising from the paws into the chest; the paws; the hind paws tucked at the sides
      out.push({ kind: 'sphinx', solid: 'wedge', rise: 'y+', x: cx + o * S(4.6) - S(1.9), y: S(2.5), w: S(3.8), d: S(13), z0: 0, z1: S(4.6), tint: k });
      out.push({ kind: 'sphinx', solid: 'frustum', x: cx + o * S(4.6) - S(2.1), y: 0, w: S(4.2), d: S(3.4), z0: 0, z1: S(2.4), top: { x: cx + o * S(4.6) - S(1.8), y: S(0.6), w: S(3.6), d: S(2.6) }, tint: k });
      out.push({ kind: 'sphinx', solid: 'frustum', x: cx + o * S(8.3) - S(1.6), y: S(47), w: S(3.2), d: S(7), z0: 0, z1: S(2.6), top: { x: cx + o * S(8.3) - S(1.2), y: S(48), w: S(2.4), d: S(5) }, tint: k });
    }
    out.push({ kind: 'sphinx', solid: 'frustum', x: cx + S(8.4), y: S(40), w: S(1.1), d: S(16), z0: 0, z1: S(1.1), top: { x: cx + S(8.5), y: S(40.5), w: S(0.9), d: S(15) }, tint: k });   // the tail along the flank
    // the head: the nemes flaring over the shoulders, its lappets on the chest, the face, the uraeus
    out.push({ kind: 'nemes', solid: 'frustum', x: cx - S(4.4), y: S(16.8), w: S(8.8), d: S(6.5), z0: S(10.5), z1: S(19.2), top: { x: cx - S(2.7), y: S(17.6), w: S(5.4), d: S(4.6) }, tint: hd });
    out.push({ kind: 'nemes', solid: 'dome', sides: 10, x: cx - S(2.8), y: S(17.4), w: S(5.6), d: S(5), z0: S(19.2), z1: S(20.2), tint: hd });
    for (const o of [-1, 1]) out.push({ kind: 'nemes', solid: 'frustum', x: cx + o * S(3.2) - S(0.8), y: S(16.4), w: S(1.6), d: S(1.2), z0: S(8.5), z1: S(14), top: { x: cx + o * S(2.9) - S(0.7), y: S(16.6), w: S(1.4), d: S(1) }, tint: hd });
    out.push({ kind: 'sphinx-face', solid: 'frustum', x: cx - S(2.2), y: S(15.9), w: S(4.4), d: S(3), z0: S(13.4), z1: S(18.6), top: { x: cx - S(2.1), y: S(16.3), w: S(4.2), d: S(2.6) }, tint: P.ochreFace });
    out.push({ kind: 'sphinx-face', solid: 'frustum', x: cx - S(0.5), y: S(15.4), w: S(1), d: S(0.8), z0: S(15), z1: S(16.6), top: { x: cx - S(0.4), y: S(15.8), w: S(0.8), d: S(0.5) }, tint: P.ochreFace });   // the nose
    for (const o of [-1, 1]) out.push(box('sphinx-eye', cx + o * S(1.1) - S(0.45), S(15.85), S(0.9), S(0.2), S(16.7), S(17.1), DARK));
    out.push(box('sphinx-mouth', cx - S(0.8), S(15.85), S(1.6), S(0.2), S(14.3), S(14.5), DARK));
    out.push(box('uraeus', cx - S(0.35), S(16.2), S(0.7), S(0.6), S(18.4), S(19.6), hd));
    return out;
  },
};

/** A boat pit by the pyramid: `covered` — a long trench roofed with limestone slabs (a dismantled ship inside); open — a boat-shaped cut in the rock. */
export const boatPit = {
  id: 'gz-boat-pit', sheet: 'gz-pyramid', patterns: ['boat'],
  read: 'A long narrow boat pit beside the pyramid: covered with a row of great limestone slabs, or open in the shape of a hull.',
  notes: ['Covered: slabs 0.9 m high, each ~2 m wide across the pit.', 'Open: a hull-shaped dark cut with a stone kerb.'],
  envelope: { w: [20, 52], d: [4, 8] },
  build({ W, D, slot }, { palette: P }) {
    if (slot.covered) {
      const n = Math.max(4, Math.round(W / 2)), out = [];
      for (let i = 0; i < n; i++) out.push(box('slab', (W * i) / n + 0.04, 0.2, W / n - 0.08, D - 0.4, 0, 0.9, scaleHex(P.limestone, 0.96 + (i % 3) * 0.02)));
      return out;
    }
    const pts = [[0.5, D / 2], [W * 0.15, 0.4], [W * 0.85, 0.4], [W - 0.5, D / 2], [W * 0.85, D - 0.4], [W * 0.15, D - 0.4]];
    return { boxes: [box('kerb', 0, 0, W, 0.3, 0, 0.25, P.limestone), box('kerb', 0, D - 0.3, W, 0.3, 0, 0.25, P.limestone)], grounds: [{ kind: 'boat-pit', poly: pts, z: 0.07, fill: DARK }] };
  },
};

/**
 * A causeway in WORLD metres along `path` ([[x, y, z], …], each point on the ground): a walled
 * corridor following the slope — roofed with a slit of light down it (`roof`), or open (Khafre's: no
 * evidence it was roofed). Laid by the layout, not a slot
 * (it runs on the diagonal, up the escarpment).
 */
export function causeway(path, { width = 5, wall = 1.6, height = 4.6, tint, kind = 'causeway', roof = true } = {}) {
  const out = [];
  for (let i = 0; i < path.length - 1; i++) {
    const [a, b] = [path[i], path[i + 1]], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const off = (p, o, z) => [p[0] + nx * o, p[1] + ny * o, p[2] + z];
    const half = width / 2, outer = half + wall;
    for (const sgn of [-1, 1]) {
      const o0 = sgn * outer, o1 = sgn * half, N = [nx * sgn, ny * sgn, 0];
      out.push(panel(kind, [off(a, o0, 0), off(b, o0, 0), off(b, o0, height), off(a, o0, height)], N, tint));                 // the outer face
      out.push(panel(kind, [off(a, o1, 0), off(b, o1, 0), off(b, o1, height - 0.4), off(a, o1, height - 0.4)], [-N[0], -N[1], 0], scaleHex(tint, 0.7)));   // the inner face, in shade
      out.push(panel(kind, [off(a, o0, height), off(b, o0, height), off(b, roof ? sgn * 0.35 : o1, height), off(a, roof ? sgn * 0.35 : o1, height)], [0, 0, 1], tint));   // the roof to the slit, or the wall top
    }
    out.push(panel('causeway-floor', [off(a, -half, 0.05), off(b, -half, 0.05), off(b, half, 0.05), off(a, half, 0.05)], [0, 0, 1], scaleHex(tint, 0.85)));
  }
  return out;
}

export const GIZA_ASSETS = Object.fromEntries([pyramid, queenPyramid, mortuaryTemple, valleyTemple, greatSphinx, boatPit].map((a) => [a.id, a]));

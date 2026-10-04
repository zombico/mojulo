/**
 * historic/assets/sumer-art — Sumer's art and street structures (patterns.js families `art` and
 * `street`), each the read of a massing sheet the image worker dreamed for it (brief ids in `sheet`).
 * Local frame, metres, front −y (see ./kit.js). Placed by the layout by meaning: at the stair foot,
 * the precinct gate and the temple door; wells where lanes meet, kilns under the wall, granaries by
 * the precinct, boats at the quays. Scaled a little past life where a true size would vanish in the
 * big read (a Tell Asmar worshipper is under a metre; these stand at a man's height).
 */
import { slopedFlight } from './kit.js';
import { scaleHex } from '../../polygonizer/vexar.js';

const drum = (cx, cy, r, z0, z1, tint, o = {}) => ({ kind: o.kind || 'drum', solid: 'drum', x: cx - r, y: cy - r, w: 2 * r, d: 2 * r, z0, z1, tint, ...o });
const dome = (cx, cy, r, z0, z1, tint, o = {}) => ({ kind: o.kind || 'dome', solid: 'dome', x: cx - r, y: cy - r, w: 2 * r, d: 2 * r, z0, z1, tint, ...o });
const box = (kind, x, y, w, d, z0, z1, tint) => ({ kind, x, y, w, d, z0, z1, tint });

/**
 * Inanna's reed post (sheet inanna-gatepost: a tall reed bundle on a square plinth, tied at four
 * levels, its reed ends splaying at the top, an upright ring on a short stem above, a tassel hanging
 * from the top tie). A pair stands either side of the goddess's door, twice its height.
 */
function reedPost(cx, cy, h, P) {
  const reed = P.reed, tie = scaleHex(reed, 0.72);
  const out = [
    box('post-plinth', cx - 0.65, cy - 0.65, 1.3, 1.3, 0, 0.3, scaleHex(P.platform, 0.95)),
    drum(cx, cy, 0.45, 0.3, h * 0.9, reed, { kind: 'reed-post', sides: 10, taper: 0.88 }),
    drum(cx, cy, 0.4, h * 0.9, h, scaleHex(reed, 1.05), { kind: 'reed-post', sides: 10, taper: 1.35 }),   // the splayed ends
  ];
  for (const f of [0.14, 0.4, 0.66, 0.86]) out.push(drum(cx, cy, 0.5 - f * 0.08, h * f, h * f + 0.26, tie, { kind: 'reed-tie', sides: 10 }));
  out.push(box('ring-stem', cx - 0.06, cy - 0.06, 0.12, 0.12, h, h + 0.35, tie));
  out.push({ kind: 'reed-ring', solid: 'ring', x: cx - 0.55, y: cy - 0.09, w: 1.1, d: 0.18, z0: h + 0.3, z1: h + 1.4, band: 0.16, tint: reed });
  out.push({ kind: 'tassel', solid: 'frustum', x: cx + 0.45, y: cy - 0.12, w: 0.08, d: 0.24, z0: h * 0.62, z1: h * 0.86, top: { x: cx + 0.47, y: cy - 0.05, w: 0.06, d: 0.1 }, tint: tie });
  return out;
}
export const doorPosts = {
  id: 'door-posts', sheet: 'inanna-gatepost', designed: true, patterns: ['door-emblem', 'reed'],
  read: "Inanna's sign: two tied reed bundles, twice the door's height, each crowned by an upright ring.",
  notes: [
    'Bundle: a drum r 0.45, 10 sides, tapering to 0.88 by 90% of its height; the last tenth flares (taper 1.35) — the splayed reed ends.',
    'Ties: four short drums a touch wider than the bundle at 14, 40, 66 and 86% of its height, a shade darker.',
    'Ring: an upright hoop 1.1 m across, band 0.16, on a 0.35 m stem; it turns with the slot so it always faces the approach.',
    'Tassel: a thin battered block hanging from the top tie on the outer side; plinth 1.3 m square, 0.3 m high.',
    'Next: a streamer of cloth from the ring would read at a distance; keep the pair the same height.',
  ],
  envelope: { w: [4, 12], d: [1.3, 1.6] },
  build({ W, D }, { palette: P }) { const h = 6.6; return [...reedPost(0.75, D / 2, h, P), ...reedPost(W - 0.75, D / 2, h, P)]; },
};

/**
 * A victory stele (sheet victory-stele: a deep, tall slab of greenish stone with a rounded top, its
 * face carved in six registers of marching figures between projecting ledges, set on a three-step
 * base of baked brick).
 */
export const stele = {
  id: 'stele', sheet: 'victory-stele', designed: true, patterns: ['stele'],
  read: 'A victory set up in public: a deep slab of greenish stone, round-topped, carved in registers, on a stepped brick base.',
  notes: [
    'Slab: a box 1.5 wide × 0.63 deep (depth ≈ 0.42 of width — it is a pillar more than a plate), up to 4.2 m with the round top.',
    "Round top: a vault, axis through the depth, spanning the slab's width, springing where the box ends.",
    'Registers: six, between seven ledges proud of the face and sides by 4–6 cm; each register holds a darker figure band.',
    'Base: three brick steps, each 0.22 high, inset 0.28 a side.',
    "Next: the top register could hold the god's emblem (a disc) instead of figures.",
  ],
  envelope: { w: [2.4, 3.2], d: [1.8, 2.6] },
  build({ W, D }, { palette: P }) {
    const stone = P.stone, brick = scaleHex(P.paving, 0.92), sw = Math.min(1.5, W * 0.55), t = sw * 0.42, h = 4.2;
    const x0 = (W - sw) / 2, y0 = (D - t) / 2, out = [];
    for (let k = 0; k < 3; k++) { const i = k * 0.28; out.push(box('stele-base', i, i * 0.7, W - 2 * i, D - 1.4 * i, k * 0.22, (k + 1) * 0.22, scaleHex(brick, 1 - k * 0.04))); }
    const zb = 0.66, zt = h - sw / 2;
    out.push(box('stele', x0, y0, sw, t, zb, zt, stone));
    out.push({ kind: 'stele', solid: 'vault', x: x0, y: y0, w: sw, d: t, z0: zt, z1: h, axis: 'y', tint: stone });   // the round top
    const n = 6, rh = (zt - zb - 0.2) / n;
    for (let k = 0; k <= n; k++) {   // the ledges between registers, proud of the face and sides
      const z = zb + 0.1 + k * rh;
      out.push(box('stele-ledge', x0 - 0.04, y0 - 0.06, sw + 0.08, t + 0.12, z, z + 0.07, scaleHex(stone, 1.08)));
    }
    for (let k = 0; k < n; k++) {   // the figures: a darker carved band in each register
      const z = zb + 0.1 + k * rh + 0.12;
      out.push(box('stele-figures', x0 + 0.08, y0 - 0.03, sw - 0.16, 0.03, z, z + rh - 0.22, scaleHex(stone, 0.78)));
    }
    return out;
  },
};

/**
 * One worshipper (sheet votive-statue: bare legs under a knee-length flared skirt, broad square
 * shoulders, forearms folded across the chest with the hands clasped, a big squared beard, a hair
 * cap, huge inlaid eyes; on a square plinth).
 */
function worshipper(cx, cy, z, s, tint, P, rng) {
  const skin = tint, cloth = scaleHex(tint, 0.9), hair = scaleHex(tint, 0.62), out = [];
  const B = (k, x0, y0, w, d, z0, z1, c) => out.push(box(k, cx + x0 * s, cy + y0 * s, w * s, d * s, z + z0 * s, z + z1 * s, c));
  B('statue-plinth', -0.36, -0.3, 0.72, 0.6, -0.12, 0, scaleHex(P.platform, 0.95));
  B('statue', -0.17, -0.08, 0.13, 0.16, 0, 0.44, skin); B('statue', 0.04, -0.08, 0.13, 0.16, 0, 0.44, skin);   // legs
  out.push(drum(cx, cy, 0.3 * s, z + 0.4 * s, z + 0.86 * s, cloth, { kind: 'statue', sides: 10, taper: 0.72 }));   // the flared skirt
  B('statue', -0.2, -0.12, 0.4, 0.24, 0.86, 1.18, skin);                               // the torso
  B('statue', -0.3, -0.13, 0.6, 0.26, 1.12, 1.32, skin);                               // square shoulders
  B('statue', -0.22, -0.24, 0.44, 0.13, 0.98, 1.12, skin);                             // forearms folded, hands clasped
  B('statue', -0.13, -0.12, 0.26, 0.26, 1.32, 1.64, skin);                             // the head
  B('statue', -0.15, -0.1, 0.3, 0.27, 1.58, 1.7, hair);                                 // the hair cap
  if (rng() < 0.7) B('statue', -0.13, -0.17, 0.26, 0.07, 1.1, 1.44, hair);             // the squared beard
  for (const o of [-0.065, 0.065]) {
    B('statue-eye', o - 0.05, -0.15, 0.1, 0.03, 1.5, 1.58, '#f1ece0');
    B('statue-eye', o - 0.025, -0.165, 0.05, 0.03, 1.51, 1.57, P.lapis);
  }
  return out;
}
export const votiveRow = {
  id: 'votive-row', sheet: 'votive-statue', designed: true, patterns: ['votive-figures'],
  read: 'Worshippers standing before the god, hands clasped, eyes wide — a row on a mud-brick bench.',
  notes: [
    'Figure (scale 1 ≈ 1.7 m): legs two boxes to 0.44; skirt a drum flaring to the hem (taper 0.72) from 0.4 to 0.86.',
    'Torso a box to 1.18; shoulders a wider box (0.6) from 1.12 to 1.32; folded forearms a box proud of the chest at 0.98–1.12.',
    'Head a box to 1.64 under a hair cap; the beard a flat box proud of the face; eyes white boxes with a lapis pupil.',
    'Row: one figure per 1.4 m of bench, each in its own stone (alabaster, greenish stone, baked clay, plaster), heights ±15%.',
    'Next: one larger figure (the dedicant) in the middle; the cult statue itself stays inside the shrine.',
  ],
  envelope: { w: [8, 30], d: [2, 3] },
  build({ W, D }, { palette: P, rng }) {
    const out = [box('bench', 0, D * 0.3, W, D * 0.6, 0, 0.55, scaleHex(P.platform, 1.02))];
    const n = Math.max(3, Math.floor(W / 1.4)), tones = [P.alabaster, P.stone, scaleHex(P.paving, 1.05), P.whitewash[1]];
    for (let i = 0; i < n; i++) out.push(...worshipper((i + 0.5) * (W / n), D * 0.6, 0.67, 1.05 + (rng() - 0.5) * 0.3, tones[Math.floor(rng() * tones.length)], P, rng));
    return out;
  },
};

/**
 * The Pillar Hall of Uruk (sheet pillar-hall: an open portico on a raised terrace; two rows of round
 * columns flaring slightly toward the top, each on a white base ring under a red capital band and a
 * square abacus, wholly sheathed in red, black and white cone mosaic; a mosaic frieze of zigzags under
 * a thick overhanging roof slab; a stair running up along the terrace's front face).
 */
export const pillarHall = {
  id: 'pillar-hall', sheet: 'pillar-hall', designed: true, patterns: ['mosaic-skin', 'terrace', 'sun-dried-earth'],
  read: 'An open portico of massive round columns sheathed in clay-cone mosaic, red, black and white, on a raised terrace.',
  notes: [
    'Terrace: a battered block the full slot, 1.4 m high; the stair a wedge running along its front face from the left, rising to the right.',
    'Columns: 2 rows × n (one per ~4.2 m), drum r ≈ W/20 capped 1.2, 12 sides, flaring to 1.12 at the top, 7.2 m (about 3 diameters); skin = cone-mosaic.',
    'Each column: a white base ring (drum r × 1.25, 0.25 high), a red capital band (drum r × 1.15, 0.4) and a square abacus (box 2.5 r, 0.35).',
    'Entablature: a mosaic frieze band 0.9 m deep on the column line, under a roof slab 0.7 thick overhanging 0.6, with a raised rim.',
    'Open on all sides: no back wall (the sheet shows the court through it).',
  ],
  envelope: { w: [20, 40], d: [12, 24] },
  build({ W, D }, { palette: P }) {
    const ht = 1.4, H = 7.2, r = Math.min(1.2, W / 20), white = P.mosaic[2], red = P.mosaic[0], out = [];
    const T = { x: 0, y: 2.4, w: W, d: D - 2.4 };
    out.push({ kind: 'terrace', solid: 'frustum', ...T, z0: 0, z1: ht, top: { x: 0.25, y: 2.65, w: W - 0.5, d: D - 2.9 }, tint: P.platform });
    out.push(...slopedFlight({ x: W * 0.08, y: 0.4, w: Math.min(4, W * 0.14), d: 2 }, 0, ht, P.stair, 'x+', { cheek: 0.35, cheekTint: P.platform }));
    const n = Math.max(3, Math.round((W - 4) / 4.2)), rows = [T.y + T.d * 0.28, T.y + T.d * 0.72], xs = Array.from({ length: n }, (_, i) => 2.4 + (i + 0.5) * ((W - 4.8) / n));
    for (const cy of rows) for (const cx of xs) {
      out.push(drum(cx, cy, r * 1.25, ht, ht + 0.25, white, { kind: 'column-base', sides: 12 }));
      out.push(drum(cx, cy, r, ht + 0.25, ht + H, red, { kind: 'column', sides: 12, taper: 1.12, surface: 'cone-mosaic' }));
      out.push(drum(cx, cy, r * 1.15, ht + H, ht + H + 0.4, red, { kind: 'capital', sides: 12 }));
      out.push(box('abacus', cx - r * 1.25, cy - r * 1.25, r * 2.5, r * 2.5, ht + H + 0.4, ht + H + 0.75, white));
    }
    const zf = ht + H + 0.75, fx0 = xs[0] - r * 1.4, fx1 = xs[n - 1] + r * 1.4, fy0 = rows[0] - r * 1.4, fy1 = rows[1] + r * 1.4;
    out.push({ kind: 'frieze', solid: 'frustum', x: fx0, y: fy0, w: fx1 - fx0, d: fy1 - fy0, z0: zf, z1: zf + 0.9, top: { x: fx0, y: fy0, w: fx1 - fx0, d: fy1 - fy0 }, tint: red, surface: 'cone-mosaic' });
    out.push(box('hall-roof', Math.max(0, fx0 - 0.6), fy0 - 0.6, Math.min(W, fx1 + 0.6) - Math.max(0, fx0 - 0.6), fy1 - fy0 + 1.2, zf + 0.9, zf + 1.6, white));
    out.push(box('roof-rim', Math.max(0, fx0 - 0.6), fy0 - 0.6, Math.min(W, fx1 + 0.6) - Math.max(0, fx0 - 0.6), 0.3, zf + 1.6, zf + 1.85, scaleHex(white, 0.95)));
    return out;
  },
};

/**
 * A copper bull (sheet temple-portal: a standing bull, head up and forward at shoulder height, horns
 * curving out and up, a heavy shoulder hump, on a square plinth; green-bronze with age). Facing −y.
 */
function bull(cx, y0, P) {
  const cu = P.patina, dk = scaleHex(cu, 0.72), z = 0.45, out = [box('plinth', cx - 0.75, y0, 1.5, 3, 0, z, scaleHex(P.paving, 0.95))];
  for (const [lx, ly] of [[-0.42, 0.75], [0.17, 0.75], [-0.42, 2.35], [0.17, 2.35]]) out.push(box('bull-leg', cx + lx, y0 + ly, 0.25, 0.26, z, z + 0.95, dk));
  out.push(box('bull', cx - 0.5, y0 + 0.65, 1.0, 2.05, z + 0.9, z + 1.75, cu));                                   // the barrel
  out.push(box('bull', cx - 0.52, y0 + 0.6, 1.04, 0.75, z + 1.6, z + 2.05, cu));                                  // the shoulder hump
  out.push(box('bull', cx - 0.3, y0 + 0.1, 0.6, 0.62, z + 1.35, z + 1.95, cu));                                   // the head, up and forward
  out.push(box('bull', cx - 0.2, y0 - 0.05, 0.4, 0.2, z + 1.35, z + 1.65, dk));                                   // muzzle
  for (const o of [-1, 1]) out.push({ kind: 'horn', solid: 'frustum', x: cx + o * 0.27 - 0.08, y: y0 + 0.3, w: 0.16, d: 0.16, z0: z + 1.9, z1: z + 2.45, top: { x: cx + o * 0.58 - 0.05, y: y0 + 0.22, w: 0.1, d: 0.1 }, tint: dk });
  out.push(box('bull-tail', cx - 0.06, y0 + 2.68, 0.12, 0.12, z + 0.8, z + 1.6, dk));
  return out;
}
export const guardians = {
  id: 'guardians', sheet: 'temple-portal', designed: true, patterns: ['guardians'],
  read: 'A pair of copper bulls standing guard either side of the way up to the god.',
  notes: [
    'Bull (≈ life size, 2.5 m long): plinth 1.5 × 3 × 0.45; four legs (boxes 0.25) to 1.4; the barrel a box 1.0 × 2.05 to 2.2.',
    'Shoulder hump: a box over the front third, a little wider and higher than the barrel — it is what makes it a bull from afar.',
    'Head: a box up and forward at shoulder height, a darker muzzle below; horns two thin battered blocks leaning out and up.',
    'Tint: green-bronze patina (palette `patina`); the legs, muzzle, horns and tail a shade darker.',
    'Next: the lion-headed eagle relief and the cattle frieze belong on the temple facade (white-temple), not on this pair.',
  ],
  envelope: { w: [8, 24], d: [3, 3.6] },
  build({ W, D }, { palette: P }) { const y0 = Math.max(0, D - 3); return [...bull(0.8, y0, P), ...bull(W - 0.8, y0, P)]; },
};

/**
 * A ritual vase (sheet ritual-vase — the Uruk Vase: a flared foot, an ovoid body widest two-thirds
 * up, a shoulder narrowing to a short neck, a flared lip; the body carved in registers — beasts,
 * offering bearers, plants — on a green ground; a square pedestal). Drawn as a profile of stacked
 * drums, each the frustum between two radii.
 */
const VASE = [   // [height fraction, radius fraction] up the profile
  [0, 0.62], [0.06, 0.5], [0.1, 0.52], [0.3, 0.8], [0.52, 0.94], [0.66, 0.96], [0.78, 0.78], [0.84, 0.5], [0.92, 0.44], [1, 0.66],
];
function vase(cx, cy, P, H = 1.9, R = 0.5) {
  const a = P.alabaster, ground = scaleHex(P.patina, 1.18), z = 0.45, out = [box('pedestal', cx - 0.6, cy - 0.6, 1.2, 1.2, 0, z, scaleHex(P.alabaster, 0.88))];
  for (let i = 0; i < VASE.length - 1; i++) {
    const [h0, r0] = VASE[i], [h1, r1] = VASE[i + 1], reg = i >= 2 && i <= 5;   // the carved body wears its green-ground registers
    out.push(drum(cx, cy, R * r0, z + h0 * H, z + h1 * H, reg && i % 2 ? ground : a, { kind: reg ? 'vase-register' : 'vase', sides: 12, taper: r1 / r0 }));
  }
  return out;
}
export const ritualVase = {
  id: 'ritual-vase', sheet: 'ritual-vase', designed: true, patterns: ['ritual-vessel'],
  read: 'A pair of great alabaster vases, carved in registers, set out at the foot of the stair for the offerings.',
  notes: [
    'Profile (fractions of height H = 1.9 m and radius R = 0.5 m): foot 0–0.1, body swelling to 0.96 R at two-thirds, shoulder in to 0.5 R by 0.84, neck, lip flaring to 0.66 R.',
    'Each step of the profile is one drum tapering from the radius below to the radius above (12 sides).',
    'Registers: the body steps alternate alabaster and a green ground (the carved bands read as stripes at a distance).',
    'Pedestal: a square alabaster block 1.2 × 1.2 × 0.45.',
    'Next: a rim of offerings (fruit, grain) heaped in the mouth, as the vase itself shows them being brought.',
  ],
  envelope: { w: [5, 14], d: [1.2, 1.6] },
  build({ W, D }, { palette: P }) { return [...vase(0.6, D / 2, P), ...vase(W - 0.6, D / 2, P)]; },
};

/**
 * An offering altar (sheet altar: a low brick kerb round it, open at the front; three receding steps
 * with a stair up the front; on top a table on two piers, hollow beneath; offering bowls round a fire
 * basin with its flame).
 */
export const altar = {
  id: 'altar', sheet: 'altar', designed: true, patterns: ['altar'],
  read: 'The offering table on the sacred axis: stepped, kerbed, a fire burning among the bowls.',
  notes: [
    'Kerb: a brick wall 0.35 thick, 0.6 high round the slot, a gap the stair\'s width in the front.',
    'Steps: three boxes, each inset 0.35 a side and 0.3 high; the stair a wedge up the front of them with treads.',
    'Table: two brick piers 0.9 high carrying a slab 0.25 thick; the hollow between the piers left dark.',
    'On the slab: a fire basin (drum) with a flame (two cones, orange under yellow) and four bowls (drums flaring up).',
    'Next: a libation channel running from the table to the kerb.',
  ],
  envelope: { w: [5, 7], d: [5, 7] },
  build({ W, D }, { palette: P }) {
    const brick = P.paving, kerb = scaleHex(P.copper, 1.15), clay = scaleHex(P.earth[3], 0.6), out = [];
    const t = 0.35, kh = 0.6, gap = W * 0.28;
    out.push(box('kerb', 0, 0, (W - gap) / 2, t, 0, kh, kerb), box('kerb', (W + gap) / 2, 0, (W - gap) / 2, t, 0, kh, kerb));
    out.push(box('kerb', 0, D - t, W, t, 0, kh, kerb), box('kerb', 0, t, t, D - 2 * t, 0, kh, kerb), box('kerb', W - t, t, t, D - 2 * t, 0, kh, kerb));
    let r = { x: t + 0.4, y: t + 1.1, w: W - 2 * t - 0.8, d: D - 2 * t - 1.5 }, z = 0;
    for (let k = 0; k < 3; k++) { out.push(box('altar-step', r.x, r.y, r.w, r.d, z, z + 0.3, scaleHex(brick, 1 - k * 0.03))); z += 0.3; r = { x: r.x + 0.35, y: r.y + 0.35, w: r.w - 0.7, d: r.d - 0.7 }; }
    out.push(...slopedFlight({ x: W / 2 - gap / 2 + 0.2, y: t + 0.2, w: gap - 0.4, d: 1.25 }, 0, z, P.stair, 'y+', { cheek: 0.15, cheekTint: brick }));
    const tw = Math.min(r.w, 2.4), td = Math.min(r.d, 1.6), tx = W / 2 - tw / 2, ty = r.y + (r.d - td) / 2, zt = z + 0.9;
    out.push(box('altar-pier', tx, ty, 0.6, td, z, zt, kerb), box('altar-pier', tx + tw - 0.6, ty, 0.6, td, z, zt, kerb));
    out.push(box('altar-hollow', tx + 0.6, ty + td * 0.4, tw - 1.2, 0.1, z, zt - 0.1, '#2b2622'));
    out.push(box('altar-table', tx - 0.1, ty - 0.1, tw + 0.2, td + 0.2, zt, zt + 0.25, brick));
    const top = zt + 0.25, cx = W / 2, cy = ty + td / 2;
    out.push(drum(cx, cy, 0.32, top, top + 0.16, clay, { kind: 'fire-basin', sides: 10, taper: 1.25 }));
    out.push(drum(cx, cy, 0.24, top + 0.16, top + 0.55, '#d9662a', { kind: 'flame', sides: 6, taper: 0.05 }));
    out.push(drum(cx, cy, 0.13, top + 0.2, top + 0.75, '#f2c14a', { kind: 'flame', sides: 6, taper: 0.05 }));
    for (const [ox, oy] of [[-0.8, -0.35], [0.8, -0.35], [-0.6, 0.45], [0.6, 0.45]]) out.push(drum(cx + ox, cy + oy, 0.2, top, top + 0.18, clay, { kind: 'bowl', sides: 10, taper: 1.35 }));
    return out;
  },
};

/**
 * A town well (sheet well: a round well head of red baked brick, dark water deep inside; two thick
 * timber posts and a beam over it, a bucket hanging on its rope; a brick-rimmed trough of water;
 * a paved apron).
 */
export const well = {
  id: 'well', sheet: 'well', designed: true, patterns: ['well'],
  read: 'Where lanes meet: a brick well head under a timber beam, a trough beside it, a paved apron.',
  notes: [
    'Well head: a drum r 0.8, 1.0 high, of red baked brick (palette copper, lightened); a dark disc inset just below the rim.',
    'Frame: two posts (boxes 0.24) to 2.6 either side of the head, a beam (box) across their tops, 0.1 proud each end.',
    'Bucket: a drum flaring up (taper 1.15) hanging 0.9 below the beam on a rope (a thin box).',
    'Trough: four low brick rims round a sheet of water (palette water), at the front-left.',
    'Apron: the slot paved in brick (ground surface `brick`).',
  ],
  envelope: { w: [2.6, 3.2], d: [2.6, 3.2] },
  build({ W, D }, { palette: P }) {
    const brick = scaleHex(P.copper, 1.22), wood = scaleHex(P.bridge, 1.15), cx = W * 0.56, cy = D * 0.56, out = [];
    out.push(drum(cx, cy, 0.8, 0, 1.0, brick, { kind: 'well-head', sides: 12, open: true, lip: 0.2 }));
    out.push(drum(cx, cy, 0.58, 0.28, 0.3, '#1f1c1a', { kind: 'well-water', sides: 12 }));   // dark, down the shaft
    for (const o of [-1, 1]) out.push(box('well-post', cx + o * 0.98 - 0.12, cy - 0.12, 0.24, 0.24, 0, 2.6, wood));
    out.push(box('well-beam', cx - 1.2, cy - 0.11, 2.4, 0.22, 2.4, 2.62, wood));
    out.push(box('rope', cx - 0.025, cy - 0.025, 0.05, 0.05, 1.75, 2.4, scaleHex(wood, 1.3)));
    out.push(drum(cx, cy, 0.2, 1.35, 1.75, wood, { kind: 'bucket', sides: 8, taper: 1.15 }));
    const tx = 0.15, ty = 0.15, tw = W * 0.38, td = 0.75;
    out.push(box('trough', tx, ty, tw, 0.14, 0, 0.35, brick), box('trough', tx, ty + td - 0.14, tw, 0.14, 0, 0.35, brick));
    out.push(box('trough', tx, ty + 0.14, 0.14, td - 0.28, 0, 0.35, brick), box('trough', tx + tw - 0.14, ty + 0.14, 0.14, td - 0.28, 0, 0.35, brick));
    out.push(box('trough-water', tx + 0.14, ty + 0.14, tw - 0.28, td - 0.28, 0, 0.27, scaleHex(P.water, 1.15)));
    return { boxes: out, grounds: [{ kind: 'apron', x: 0, y: 0, w: W, d: D, z: 0.04, fill: P.paving, surface: 'brick' }] };
  },
};

/** A clay jar: a bulbous body (two drums) under an open neck. */
function jar(cx, cy, z, s, tint) {
  return [
    drum(cx, cy, 0.24 * s, z, z + 0.22 * s, tint, { kind: 'jar', sides: 10, taper: 1.35 }),
    drum(cx, cy, 0.32 * s, z + 0.22 * s, z + 0.46 * s, tint, { kind: 'jar', sides: 10, taper: 0.7 }),
    drum(cx, cy, 0.22 * s, z + 0.46 * s, z + 0.56 * s, scaleHex(tint, 0.92), { kind: 'jar', sides: 10, taper: 1.12, open: true, lip: 0.05 * s }),
  ];
}
/**
 * A beehive pottery kiln (sheet pottery-kiln: a tall egg-shaped dome of mud brick rising from the
 * ground, an arched brick porch over the firing mouth, an open smoke hole at the crown and a stub
 * chimney behind it; jars beside it, one stacked on another).
 */
export const potteryKiln = {
  id: 'pottery-kiln', sheet: 'pottery-kiln', designed: true, patterns: ['kiln', 'sun-dried-earth'],
  read: 'The potters\' kiln under the town wall: a brick beehive with its fire mouth, jars waiting beside it.',
  notes: [
    'Dome: a dome solid r = 0.38 of the slot, from a 0.35 m drum footing up to 2.1 r — taller than a hemisphere, an egg.',
    'Mouth: a short vault (axis through the depth) projecting from the front, open and dark at its outer end.',
    'Crown: a dark ring-drum for the smoke hole; a square chimney stub just behind it.',
    'Jars: bulbous open jars (two drums under an open neck) in a cluster at the side, one stacked.',
  ],
  envelope: { w: [3.5, 5], d: [3.5, 5] },
  build({ W, D }, { palette: P }) {
    const brick = scaleHex(P.wall, 1.18), terra = scaleHex(P.copper, 1.1), r = Math.min(W, D) * 0.34, cx = W * 0.42, cy = D * 0.52, out = [];
    out.push(drum(cx, cy, r, 0, 0.35, brick, { kind: 'kiln', sides: 12 }));
    out.push(dome(cx, cy, r, 0.35, 0.35 + r * 2.1, brick, { kind: 'kiln', sides: 12 }));
    const top = 0.35 + r * 2.1;
    out.push(drum(cx, cy, r * 0.2, top - 0.08, top + 0.04, '#2b2622', { kind: 'smoke-hole', sides: 8 }));
    out.push(box('chimney', cx + r * 0.25, cy + r * 0.05, 0.36, 0.36, top - r * 0.5, top + 0.35, scaleHex(brick, 0.95)));
    out.push({ kind: 'kiln-mouth', solid: 'vault', x: cx - 0.55, y: cy - r - 0.5, w: 1.1, d: 0.85, z0: 0, z1: 1.25, axis: 'y', open: 'lo', tint: scaleHex(brick, 0.92) });
    out.push(...jar(W * 0.86, D * 0.72, 0, 1.3, terra), ...jar(W * 0.86, D * 0.72, 0.56 * 1.3, 1.1, scaleHex(terra, 0.95)));
    out.push(...jar(W * 0.84, D * 0.4, 0, 1.2, scaleHex(terra, 1.05)), ...jar(W * 0.66, D * 0.18, 0, 1.0, terra));
    return out;
  },
};

/**
 * A granary yard (sheet granary: four tall bullet-shaped silos of mud plaster — a round body running
 * up into a domed head with a small open hole at the top, arched hatches high on their sides, wooden
 * pegs to climb by — inside a low walled yard entered through a small gatehouse in the front wall).
 */
export const granary = {
  id: 'granary', sheet: 'granary', designed: true, patterns: ['granary', 'sun-dried-earth'],
  read: "The temple's store: tall beehive silos in a walled yard, a gatehouse at its front.",
  notes: [
    'Silo: a drum r ≈ 0.19 of the slot, 2 r high, then a dome to 3.4 r — a bullet, taller than wide; a dark ring-drum hole on top.',
    'Hatches: two dark boxes high on each silo (front and outer side); pegs: thin boxes jutting from the shoulder.',
    'Yard: a wall 0.5 thick, 1.8 high, round the slot; the gatehouse a box 2.6 wide breaking the front wall, a dark door in it.',
    'Next: a ramp of beaten earth up to one hatch, and a heap of grain sacks at the gate.',
  ],
  envelope: { w: [11, 18], d: [11, 18] },
  build({ W, D }, { palette: P }) {
    const mud = P.earth[0], t = 0.5, h = 1.8, gw = 2.6, dark = '#2b2622', wood = scaleHex(P.bridge, 1.2), out = [];
    out.push(box('yard-wall', 0, 0, (W - gw) / 2, t, 0, h, mud), box('yard-wall', (W + gw) / 2, 0, (W - gw) / 2, t, 0, h, mud));
    out.push(box('yard-wall', 0, D - t, W, t, 0, h, mud), box('yard-wall', 0, t, t, D - 2 * t, 0, h, mud), box('yard-wall', W - t, t, t, D - 2 * t, 0, h, mud));
    out.push(box('gatehouse', (W - gw) / 2, -0.3, gw, 1.6, 0, h + 0.9, scaleHex(mud, 1.04)), box('gate', W / 2 - 0.5, -0.36, 1, 0.1, 0, 1.9, dark));
    const r = Math.min(W, D) * 0.19, plaster = scaleHex(mud, 1.07);
    for (const [fx, fy] of [[0.3, 0.4], [0.7, 0.4], [0.3, 0.74], [0.7, 0.74]]) {
      const cx = W * fx, cy = D * fy, zb = 2 * r, top = 3.4 * r;
      out.push(drum(cx, cy, r, 0, zb, plaster, { kind: 'silo', sides: 12 }));
      out.push(dome(cx, cy, r, zb, top, plaster, { kind: 'silo', sides: 12 }));
      out.push(drum(cx, cy, r * 0.16, top - 0.05, top + 0.06, dark, { kind: 'silo-hole', sides: 8 }));
      const side = fx < 0.5 ? -1 : 1;
      out.push(box('silo-hatch', cx - 0.3, cy - r * 0.86 - 0.08, 0.6, 0.1, zb + r * 0.15, zb + r * 0.65, dark));
      out.push(box('silo-hatch', cx + side * r * 0.86 - 0.05, cy - 0.3, 0.1, 0.6, zb + r * 0.15, zb + r * 0.65, dark));
      for (const a of [0.6, 2.2, 3.8, 5.2]) out.push(box('silo-peg', cx + Math.cos(a) * r * 0.95 - 0.04, cy + Math.sin(a) * r * 0.95 - 0.04, 0.08, 0.08, zb - 0.1, zb, wood));
    }
    return { boxes: out, grounds: [{ kind: 'court', x: t, y: t, w: W - 2 * t, d: D - 2 * t, z: 0.03, fill: P.court }] };
  },
};

/**
 * A reed boat (sheet reed-boat: a crescent hull of bundled reed bound with ties, its ends sweeping up
 * into tall horns that curl over at the tips; an arched reed cabin amidships, open at both ends; an
 * oar laid along the side). The long axis is local x.
 */
export const reedBoat = {
  id: 'reed-boat', sheet: 'reed-boat', designed: true, patterns: ['boat', 'reed'],
  read: 'A crescent of bundled reed on the canal, its horns curling at prow and stern, a reed cabin amidships.',
  notes: [
    'Hull: a low box over the middle 60%, its ends stepping up and in (three blocks each) — the crescent.',
    'Horns: six stacked drums per end, each narrower and higher, leaning inward over the last two; a ring curls over each tip.',
    'Ties: darker thin drums round each horn; the cabin a vault (axis along the hull) open at both ends.',
    'Oar: a long thin box laid along the side, its blade a flat box.',
  ],
  envelope: { w: [8, 12], d: [1.8, 2.6] },
  build({ W, D }, { palette: P }) {
    const reed = P.reed, tie = scaleHex(reed, 0.75), cy = D / 2, out = [];
    out.push(box('hull', W * 0.2, D * 0.2, W * 0.6, D * 0.6, 0, 0.6, reed));
    for (const end of [-1, 1]) {
      const x0 = end < 0 ? W * 0.2 : W * 0.8;
      for (let k = 0; k < 3; k++) { const len = W * 0.035, wd = D * (0.56 - k * 0.1); out.push(box('hull', end < 0 ? x0 - (k + 1) * len : x0 + k * len, cy - wd / 2, len + 0.05, wd, 0.1 + k * 0.15, 0.75 + k * 0.2, k % 2 ? tie : reed)); }
      const hx = end < 0 ? W * 0.11 : W * 0.89;
      for (let k = 0; k < 6; k++) {
        const lean = k >= 4 ? (k - 3) * 0.18 * -end : 0, r = 0.36 - k * 0.035, z = 0.9 + k * 0.42;
        out.push(drum(hx + lean, cy, r, z, z + 0.46, k % 2 ? reed : scaleHex(reed, 1.04), { kind: 'horn', sides: 8 }));
        out.push(drum(hx + lean, cy, r + 0.03, z + 0.36, z + 0.44, tie, { kind: 'horn-tie', sides: 8 }));
      }
      const tipX = hx + 0.36 * -end;
      out.push({ kind: 'horn-curl', solid: 'ring', x: tipX - 0.38, y: cy - 0.12, w: 0.76, d: 0.24, z0: 3.3, z1: 4.06, band: 0.2, tint: reed });
    }
    out.push({ kind: 'cabin', solid: 'vault', x: W * 0.36, y: D * 0.22, w: W * 0.26, d: D * 0.56, z0: 0.6, z1: 2.0, axis: 'x', tint: scaleHex(reed, 0.92) });
    for (const fx of [0.4, 0.46, 0.52, 0.58]) out.push({ kind: 'cabin-rib', solid: 'vault', x: W * fx, y: D * 0.2, w: 0.08, d: D * 0.6, z0: 0.6, z1: 2.06, axis: 'x', caps: false, tint: tie });
    out.push(box('oar', W * 0.3, D * 0.82, W * 0.5, 0.08, 0.6, 0.68, scaleHex(P.bridge, 1.15)), box('oar-blade', W * 0.78, D * 0.78, W * 0.08, 0.16, 0.58, 0.64, scaleHex(P.bridge, 1.15)));
    return out;
  },
};

export const SUMER_ART = Object.fromEntries([doorPosts, stele, votiveRow, pillarHall, guardians, ritualVase, altar, well, potteryKiln, granary, reedBoat].map((a) => [a.id, a]));

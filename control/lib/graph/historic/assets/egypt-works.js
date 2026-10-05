/**
 * historic/assets/egypt-works — the New Kingdom works (c. 1250 BCE): where Thebes cut its stone, cast
 * its bronze, made its glass, its chariots and its boats (patterns.js family `works`). Same contract as
 * ./sumer-works.js: local frame, metres, front −y, `ctx` = { palette, culture, rng }; the record behind
 * each piece is ../record/egypt-industry.js.
 *
 * Egypt had what the Sumerian plain lacked: building stone in the cliffs along the river (sandstone
 * from Gebel el-Silsila for the Theban temples, limestone, granite at Aswan), so its works begin at a
 * quarry face. Blocks were freed by trenches and wedges, dragged on sledges over wetted timber, and
 * floated down on barges. Much else Egypt did as Sumer had: brick moulded from river mud and dried
 * (the clay pit, treading pits, brick field and hacks are the Sumerian pieces in Nile colours), but
 * never fired. Fifteen centuries on, the tools have moved on too:
 *   - the smiths' hearths are blown by pot bellows trodden in pairs, not by reed pipes;
 *   - the copper comes as oxhide ingots;
 *   - glass is made, new in the New Kingdom;
 *   - the wheelwrights build light spoked wheels for chariots;
 *   - the boats are plank hulls built shell first, not bundled reed.
 *
 * At rest, as everywhere in this kit: the people and the oxen are placed by their own builders.
 */
import { beam } from './kit.js';
import { box, drum, dome, basket, jar, plate } from './sumer-farm.js';
import { panel, rim, bundle, fire } from './sumer-works.js';
import { amphora } from './egypt-farm.js';
import { scaleHex } from '../../polygonizer/vexar.js';

const DARK = '#2b2622';
const shade = (x, y, w, d, h, P, roof = P.reed) => {
  const out = [];
  for (const [px, py] of [[x, y], [x + w, y], [x, y + d], [x + w, y + d]]) out.push(box('shade-post', px - 0.08, py - 0.08, 0.16, 0.16, 0, py > y + 1 ? h + 0.3 : h, P.wood));
  out.push(plate('reed-mat', x - 0.3, y - 0.3, w + 0.6, 0.06, d + 0.6, h, h + 0.35, roof));
  return out;
};
/** Copper chisels and a wooden mallet set down at (x, y, z). */
const chisels = (x, y, z, P) => [
  box('chisel', x, y, 0.28, 0.04, z, z + 0.04, P.bronze), box('chisel', x, y + 0.12, 0.24, 0.04, z, z + 0.04, P.bronze),
  drum(x + 0.55, y + 0.1, 0.1, z, z + 0.24, P.wood, { kind: 'mallet', sides: 7, taper: 0.8 }), beam('mallet-handle', [x + 0.55, y + 0.1, z + 0.24], [x + 0.55, y + 0.1, z + 0.5], 0.04, P.wood),
];
/** A spoked chariot wheel standing in the y–z plane (it rolls along y): rim, six spokes, the hub along x. */
export function spokedWheel(cx, cy, cz, R, P, spokes = 6) {
  const t = P.timber, out = [{ kind: 'wheel-rim', solid: 'ring', plane: 'y', x: cx - 0.04, y: cy - R, w: 0.08, d: 2 * R, z0: cz - R, z1: cz + R, band: 0.06, tint: t }];
  for (let i = 0; i < spokes; i++) { const a = (i / spokes) * 6.2832 + 0.26; out.push(beam('spoke', [cx, cy, cz], [cx, cy + Math.cos(a) * (R - 0.04), cz + Math.sin(a) * (R - 0.04)], 0.03, scaleHex(t, 1.1))); }
  out.push(beam('wheel-hub', [cx - 0.12, cy, cz], [cx + 0.12, cy, cz], 0.1, scaleHex(t, 0.85)));
  return out;
}
/** An oxhide ingot: a flat slab with its four corners drawn out, `s` across, lying at (x, y, z). */
const oxhide = (x, y, z, P, s = 0.6) => [box('oxhide-ingot', x, y + s * 0.12, s, s * 0.46, z, z + 0.05, P.metal), ...[[0, 0], [s * 0.82, 0], [0, s * 0.58], [s * 0.82, s * 0.58]].map(([u, v]) => box('oxhide-ingot', x + u - 0.02, y + v, s * 0.2, s * 0.12, z, z + 0.05, P.metal))];

// ── the stone ──

/**
 * The quarry face (after Gebel el-Silsila): the sandstone outcrop cut back into steps — the hill's
 * back and flanks still sloped as weathering left them, its front a sheer worked face in benches. On
 * the benches, blocks being freed: trenches cut round them, a row of wedge slots along the foot of one,
 * a lever under another; a freed block lies on the quarry floor below, a ramp down from the lowest
 * bench, rubble heaps of chips, copper chisels and mallets, the masons' marks in red ochre.
 */
export const egQuarry = {
  id: 'eg-quarry', designed: true, patterns: ['quarry'],
  read: 'A sandstone outcrop cut back in benches: blocks freed by trenches, wedge slots, a lever, a ramp, rubble, red ochre marks on the face.',
  notes: [
    'Hill: the back 60 % of the slot, to ≈ 9 m in three benches (at 3.2, 6 and 9 m), the front of each cut sheer; the ends and back of each slope down to the bench below (wedges), lumps on the crown.',
    'On each bench a row of blocks ≈ 2 × 1.2 × 1 m standing proud of the face with dark trenches between them; on the lowest, a row of wedge slots along one block\'s foot and a lever (a beam) under another.',
    'Floor: a freed block, rubble heaps of chips (domes), chisels and mallets; a ramp (a wedge) up from the floor to the lowest bench.',
    'Red ochre: a level line and a mark on the face (thin red boxes). The quarrymen are placed by their own builder.',
  ],
  envelope: { w: [26, 40], d: [16, 26] },
  build({ W, D }, { palette: P, rng }) {
    const st = P.sandstone, cut = scaleHex(st, 1.06), out = [], grounds = [];
    const y1 = D * 0.4, H = 9;
    // the hill: the worked front is sheer, the rest is the outcrop's own slope
    const benches = [{ y: y1, z: 3.2 }, { y: y1 + (D - y1) * 0.28, z: 6.0 }, { y: y1 + (D - y1) * 0.52, z: H }];
    let prevZ = 0;
    // each bench in pieces ≈ 9 m long: an eye-level camera drops a long face passing close across its view
    // each bench a sheer block in pieces ≈ 9 m long (an eye-level camera drops a long face passing close
    // across its view), its ends and back sloping down as wedges to the bench below's top edge (the page
    // draws parallelograms and triangles, not the trapezoids a part-battered block would need)
    const n = Math.max(1, Math.round(W / 9));
    let side = 0, back = 0;
    for (const [i, b] of benches.entries()) {
      const s1 = side + 0.6 + i * 0.5, b1 = back + 0.8 + i * 0.3, tint = scaleHex(cut, 1 - i * 0.04), x0 = s1, x1 = W - s1, seg = (x1 - x0) / n, yb = D - b1;
      for (let k = 0; k < n; k++) out.push(box('rock', x0 + k * seg, b.y, seg, yb - b.y, prevZ, b.z, tint));
      out.push({ kind: 'rock', solid: 'wedge', x: side, y: b.y, w: s1 - side, d: yb - b.y, z0: prevZ, z1: b.z, rise: 'x+', tint: scaleHex(tint, 0.95) });
      out.push({ kind: 'rock', solid: 'wedge', x: x1, y: b.y, w: s1 - side, d: yb - b.y, z0: prevZ, z1: b.z, rise: 'x-', tint: scaleHex(tint, 0.92) });
      for (let k = 0; k < n; k++) out.push({ kind: 'rock', solid: 'wedge', x: x0 + k * seg, y: yb, w: seg, d: b1 - back, z0: prevZ, z1: b.z, rise: 'y-', tint: scaleHex(tint, 0.9) });
      prevZ = b.z; side = s1; back = b1;
    }
    for (let k = 0; k < 4; k++) { const cx = W * (0.15 + k * 0.23 + rng() * 0.06), cy = D - 4.2 - rng() * 1.5; out.push(dome(cx, cy, 2.2 + rng() * 1.5, H - 0.2, H + 1.0 + rng() * 1.0, scaleHex(st, 0.9 + rng() * 0.08), { kind: 'rock', sides: 8 })); }
    // blocks being freed on each bench: standing proud, trenches between them
    for (const [i, b] of [[0, { y: 0, z: 0 }], [1, benches[0]], [2, benches[1]]]) {
      const z0 = b.z, by = (i === 0 ? y1 : benches[i].y) - 1.3, n = Math.floor((W - 6) / 2.4);
      for (let k = 0; k < n; k++) {
        if (rng() < 0.25) continue;
        const x = 3 + k * 2.4, h = 1.0 + rng() * 0.15;
        out.push(box('quarry-block', x, by, 2.0, 1.25, z0, z0 + h, scaleHex(st, 0.98 + rng() * 0.1)));
        out.push(box('trench', x + 2.0, by, 0.4, 1.25, z0 - 0.02, z0 + h - 0.05, scaleHex(st, 0.55)));
        if (i === 0 && k % 3 === 1) for (let q = 0; q < 5; q++) out.push(box('wedge-slot', x + 0.15 + q * 0.38, by - 0.02, 0.14, 0.04, z0 + 0.12, z0 + 0.3, DARK));
        if (i === 0 && k % 3 === 2) out.push(beam('lever', [x + 1.0, by - 0.1, z0 + 0.05], [x + 1.4, by - 2.4, z0 + 1.2], 0.12, P.wood));
      }
    }
    // the red ochre line along the lowest face, a mark
    out.push(box('ochre-line', 1, y1 - 0.02, W - 2, 0.03, 2.4, 2.46, P.red), box('ochre-mark', W * 0.6, y1 - 0.02, 0.3, 0.03, 1.4, 1.9, P.red), box('ochre-mark', W * 0.6 - 0.15, y1 - 0.02, 0.6, 0.03, 1.65, 1.72, P.red));
    // the floor: a ramp up to the first bench, a freed block, rubble heaps, tools
    out.push({ kind: 'ramp', solid: 'wedge', x: W - 4.2, y: 1.0, w: 3.6, d: y1 - 1.0 - 1.3, z0: 0, z1: 1.0, rise: 'y+', tint: scaleHex(st, 0.88) });
    out.push(box('quarry-block', W * 0.35, 2.2, 2.1, 1.25, 0, 1.05, scaleHex(st, 1.04)), box('quarry-block', W * 0.35 + 0.6, 2.4, 1.2, 0.9, 1.05, 1.75, scaleHex(st, 1.0)));
    for (let k = 0; k < 5; k++) out.push(dome(1.5 + rng() * (W * 0.3), 1.0 + rng() * (y1 - 3.5), 0.9 + rng() * 0.8, 0, 0.5 + rng() * 0.5, scaleHex(st, 0.92 + rng() * 0.1), { kind: 'chips', sides: 9 }));
    out.push(...chisels(W * 0.55, 1.4, 0, P), basket(W * 0.62, 2.4, 0.26, 0.3, P));
    grounds.push({ kind: 'quarry-floor', x: 0, y: 0, w: W, d: y1, z: 0.03, fill: scaleHex(st, 0.95), surface: 'rubble' });
    return { boxes: out, grounds };
  },
};

/**
 * A block on its way: a sledge (two runners curled up at the front, cross bars) with a sandstone block
 * roped on, the hauling ropes laid out forward; ahead of it timber sleepers set across the track, and
 * the water jar whose water, poured before the runners, made the wet silt slick (Djehutihotep's colossus).
 */
export const egStoneSledge = {
  id: 'eg-stone-sledge', designed: true, patterns: ['quarry', 'stone-landing'],
  read: 'A sandstone block roped on a sledge, hauling ropes laid forward over timber sleepers, a water jar to wet the way.',
  notes: [
    'Sledge: two runners 0.25 wide, 3.2 m, their fronts curled up (wedges), cross bars across them; the block 1.6 × 2.2 × 1.2 roped with three ropes.',
    'Ropes: four lines laid forward to the slot\'s front. Sleepers: timbers across the track every 0.9 m ahead of the sledge.',
    'A water jar and a pouring jar by the runners. The haulers and the man pouring are placed by their own builders.',
  ],
  envelope: { w: [3, 4.5], d: [8, 12] },
  build({ W, D }, { palette: P }) {
    const cx = W / 2, out = [], sy = D - 3.6, wood = P.wood;
    for (let y = 0.6; y < sy - 0.6; y += 0.9) out.push(beam('sleeper', [cx - 1.2, y, 0.06], [cx + 1.2, y, 0.06], 0.12, scaleHex(wood, 0.9)));
    for (const o of [-0.65, 0.65]) out.push(box('runner', cx + o - 0.13, sy, 0.26, 3.2, 0, 0.22, wood), { kind: 'runner', solid: 'wedge', x: cx + o - 0.13, y: sy - 0.45, w: 0.26, d: 0.46, z0: 0, z1: 0.45, rise: 'y-', tint: wood });
    for (const y of [sy + 0.3, sy + 1.6, sy + 2.9]) out.push(beam('sledge-bar', [cx - 0.85, y, 0.28], [cx + 0.85, y, 0.28], 0.12, wood));
    out.push(box('sandstone-block', cx - 0.8, sy + 0.4, 1.6, 2.2, 0.34, 1.54, P.sandstone));
    for (const y of [sy + 0.7, sy + 1.5, sy + 2.3]) out.push(box('rope', cx - 0.84, y, 1.68, 0.06, 0.3, 1.58, scaleHex(P.reed, 0.7)));
    for (const o of [-0.6, -0.2, 0.2, 0.6]) out.push(beam('hauling-rope', [cx + o * 0.8, sy - 0.3, 0.3], [cx + o * 1.4, 0.2, 0.04], 0.04, scaleHex(P.reed, 0.7)));
    out.push(...jar(cx + 1.3, sy + 0.4, 1.4, scaleHex(P.copper, 1.08)), ...jar(cx - 1.3, sy - 0.8, 0.8, scaleHex(P.copper, 1.15)));
    return { boxes: out, grounds: [{ kind: 'wet-track', x: cx - 1.0, y: 0.3, w: 2.0, d: sy - 0.3, z: 0.03, fill: scaleHex(P.mud, 0.9), surface: 'mud' }] };
  },
};

/**
 * The masons' and sculptors' yard (Rekhmire's): blocks dressed true with mallet and copper chisel, one
 * half dressed (its worked face paler), the boning rods that checked a face flat, a column drum; and a
 * seated colossus roughed out of a single block in a scaffold of poles and planks, its grid of red
 * ochre lines still on it, a heap of chips, the tools under a shade.
 */
export const egMasonsYard = {
  id: 'eg-masons-yard', designed: true, patterns: ['quarry', 'joinery'],
  read: 'A masons\' yard: blocks being dressed, boning rods, a column drum, a seated colossus roughed out in a scaffold of poles, red ochre lines, chips.',
  notes: [
    'Blocks: four on the ground ≈ 1.4–2 m; one with a dressed face (a paler skin of 0.03 on one side), three boning rods (two posts and a cord) on another.',
    'Column drum: a drum r 0.9, 0.9 high. Colossus: one block roughed into a seated king ≈ 6.4 m — plinth, throne, the shins and lap forward, the torso widening to the shoulders, the headcloth narrowing — with red grid lines on it; a scaffold of poles (beams) and two plank stages round it.',
    'Chips: a rubble ground and heaps; a shade over a bench with chisels and mallets.',
  ],
  envelope: { w: [16, 24], d: [12, 18] },
  build({ W, D }, { palette: P, rng }) {
    const st = P.sandstone, out = [];
    // blocks being dressed along the front
    for (let k = 0; k < 4; k++) {
      const x = 1.0 + k * 2.6, s = 1.4 + rng() * 0.5;
      out.push(box('dressed-block', x, 1.0, s, s * 0.7, 0, s * 0.6, scaleHex(st, 0.95 + rng() * 0.08)));
      if (k === 1) out.push(box('dressed-face', x, 0.97, s, 0.03, 0, s * 0.6, scaleHex(st, 1.15)));
      if (k === 2) { for (const u of [0.1, s / 2, s - 0.1]) out.push(box('boning-rod', x + u - 0.02, 1.0 + s * 0.35, 0.04, 0.04, s * 0.6, s * 0.6 + 0.35, P.wood)); out.push(box('rope', x + 0.1, 1.0 + s * 0.35, s - 0.2, 0.015, s * 0.6 + 0.33, s * 0.6 + 0.345, scaleHex(P.reed, 0.7))); }
    }
    out.push(drum(W * 0.62, 2.0, 0.9, 0, 0.9, scaleHex(st, 1.04), { kind: 'column-drum', sides: 14 }));
    // the colossus in its scaffold, at the back: a seated king roughed out of one block — plinth, throne,
    // the shins and the lap forward of it, the torso narrowing to the shoulders, the headcloth
    const cx = W * 0.4, cy = D - 4.5, k = scaleHex(st, 1.02);
    out.push(box('statue-roughout', cx - 1.6, cy - 2.2, 3.2, 4.4, 0, 1.0, scaleHex(st, 0.96)), box('statue-roughout', cx - 1.3, cy + 0.2, 2.6, 2.0, 1.0, 3.2, k), box('statue-roughout', cx - 1.0, cy - 1.8, 2.0, 2.0, 1.0, 2.6, k));
    out.push({ kind: 'statue-roughout', solid: 'frustum', x: cx - 1.0, y: cy + 0.3, w: 2.0, d: 1.4, z0: 2.6, z1: 5.0, top: { x: cx - 1.25, y: cy + 0.4, w: 2.5, d: 1.2 }, tint: k });
    out.push({ kind: 'statue-roughout', solid: 'frustum', x: cx - 0.95, y: cy + 0.35, w: 1.9, d: 1.3, z0: 5.0, z1: 6.4, top: { x: cx - 0.55, y: cy + 0.45, w: 1.1, d: 1.0 }, tint: scaleHex(st, 1.06) });
    for (const z of [3.4, 4.2]) out.push(box('ochre-grid', cx - 1.05, cy + 0.27, 2.1, 0.02, z, z + 0.04, P.red));
    for (const z of [1.4, 2.0]) out.push(box('ochre-grid', cx - 1.0, cy - 1.83, 2.0, 0.02, z, z + 0.04, P.red));
    for (const x of [cx - 0.5, cx, cx + 0.5]) out.push(box('ochre-grid', x - 0.02, cy - 1.83, 0.04, 0.02, 1.0, 2.6, P.red), box('ochre-grid', x - 0.02, cy + 0.27, 0.04, 0.02, 2.6, 5.0, P.red));
    const sx0 = cx - 2.3, sx1 = cx + 2.3, sy0 = cy - 2.6, sy1 = Math.min(D - 0.2, cy + 2.6);
    for (const [px, py] of [[sx0, sy0], [sx1, sy0], [sx0, sy1], [sx1, sy1]]) out.push(beam('scaffold-pole', [px, py, 0], [px, py, 6.6], 0.12, P.wood));
    for (const z of [3.0, 5.2]) {
      out.push(box('scaffold-plank', sx0, sy0 - 0.2, sx1 - sx0, 0.5, z, z + 0.06, scaleHex(P.wood, 1.1)), box('scaffold-plank', sx0 - 0.2, sy0, 0.5, sy1 - sy0, z, z + 0.06, scaleHex(P.wood, 1.1)));
      out.push(beam('scaffold-bar', [sx0, sy0, z], [sx1, sy0, z], 0.08, P.wood), beam('scaffold-bar', [sx0, sy0, z], [sx0, sy1, z], 0.08, P.wood), beam('scaffold-bar', [sx1, sy0, z], [sx1, sy1, z], 0.08, P.wood), beam('scaffold-bar', [sx0, sy1, z], [sx1, sy1, z], 0.08, P.wood));
    }
    // the shade with its bench and tools, chips heaped
    const hx = W - 5.6, hy = D - 4;
    out.push(...shade(hx, hy, 4.6, 3.2, 2.3, P), box('bench', hx + 1, hy + 1.4, 2.4, 0.6, 0.6, 0.8, P.wood), box('bench-leg', hx + 1.1, hy + 1.5, 0.16, 0.4, 0, 0.6, P.wood), box('bench-leg', hx + 3.2, hy + 1.5, 0.16, 0.4, 0, 0.6, P.wood), ...chisels(hx + 1.3, hy + 1.5, 0.8, P));
    for (let k = 0; k < 3; k++) out.push(dome(W * 0.7 + rng() * 3, D * 0.45 + rng() * 2, 0.7 + rng() * 0.4, 0, 0.45, scaleHex(st, 0.95), { kind: 'chips', sides: 8 }));
    return { boxes: out, grounds: [{ kind: 'yard', x: 0, y: 0, w: W, d: D, z: 0.025, fill: scaleHex(st, 0.92), surface: 'rubble' }] };
  },
};

/**
 * The stone quay: a sandstone face down to the river with a ramp for the sledges, mooring posts, and
 * on it blocks and a column drum waiting to be loaded or dragged off, rollers and levers.
 */
export const egStoneQuay = {
  id: 'eg-stone-quay', designed: true, patterns: ['stone-landing', 'quarry'],
  read: 'A sandstone quay with a ramp down to the water, mooring posts, blocks and a column drum waiting, rollers and levers.',
  notes: [
    'Face: sandstone along the front from the water (`slot.waterZ`) to 0.2 m; a ramp (a wedge) down into the water at one end for the sledges.',
    'Mooring posts; three blocks and a column drum; rollers (beams) and levers laid by them.',
  ],
  envelope: { w: [18, 26], d: [8, 12] },
  build({ W, D, slot }, { palette: P, rng }) {
    const wz = slot.waterZ ?? -1.4, st = P.sandstone, out = [];
    out.push(box('quay', 0, -0.4, W - 4.5, 0.8, wz - 0.3, 0.2, st));
    out.push({ kind: 'quay-ramp', solid: 'wedge', x: W - 4.5, y: -1.6, w: 4.2, d: 3.0, z0: wz - 0.2, z1: 0.18, rise: 'y+', tint: scaleHex(st, 0.94) });
    for (const x of [1.4, W * 0.45]) out.push(drum(x, 0.3, 0.13, 0.2, 1.2, P.wood, { kind: 'mooring-post', sides: 7 }));
    for (let k = 0; k < 3; k++) { const x = 2.5 + k * 2.6, s = 1.2 + rng() * 0.5; out.push(box('sandstone-block', x, 2.0 + rng() * 0.6, s * 1.3, s, 0, s * 0.8, scaleHex(st, 0.96 + rng() * 0.08))); }
    out.push(drum(W * 0.58, D - 2.4, 1.0, 0, 1.0, scaleHex(st, 1.05), { kind: 'column-drum', sides: 14 }));
    for (let k = 0; k < 4; k++) out.push(beam('roller', [W * 0.66 + k * 0.45, D - 3.6, 0.13], [W * 0.66 + k * 0.45, D - 1.2, 0.13], 0.24, scaleHex(P.wood, 0.9)));
    out.push(beam('lever', [2, D - 1.2, 0.06], [5.5, D - 1.0, 0.06], 0.12, P.wood), beam('lever', [2.2, D - 0.7, 0.06], [5.6, D - 0.5, 0.06], 0.12, P.wood));
    return { boxes: out, grounds: [{ kind: 'quay', x: 0, y: 0, w: W, d: D, z: 0.03, fill: P.paving, surface: 'rubble' }] };
  },
};

/**
 * A stone barge moored at the quay: a broad flat plank hull, its ends raised, a granite block from
 * Aswan on a timber cradle amidships, the steering oars at the stern, no mast — barges were towed
 * and drifted down.
 */
export const egStoneBarge = {
  id: 'eg-stone-barge', designed: true, patterns: ['boat', 'stone-landing'],
  read: 'A broad flat stone barge, its ends raised, a red granite block on a cradle amidships, two steering oars at the stern.',
  notes: [
    'Hull: a flat box along x the slot\'s length less the ends, 0.9 m deep; the ends wedges rising to 1.8 m; a dark gunwale.',
    'Cargo: a red granite block (Aswan) 4 × 1.6 × 1.4 on two cradle timbers; deck beams across.',
    'Steering: two oars from posts at the stern down into the water. Sits at `slot.z` on the water.',
  ],
  envelope: { w: [16, 24], d: [4.5, 6] },
  build({ W, D }, { palette: P }) {
    const t = P.timber, cy = D / 2, B = D - 0.4, e = 2.6, out = [];
    out.push(box('hull', e, cy - B / 2, W - 2 * e, B, 0, 0.9, t));
    out.push({ kind: 'hull', solid: 'wedge', x: 0.3, y: cy - B / 2 + 0.4, w: e - 0.3, d: B - 0.8, z0: 0, z1: 1.8, rise: 'x-', tint: t }, { kind: 'hull', solid: 'wedge', x: W - e, y: cy - B / 2 + 0.4, w: e - 0.3, d: B - 0.8, z0: 0, z1: 1.6, rise: 'x+', tint: t });
    out.push(box('gunwale', e, cy - B / 2 - 0.05, W - 2 * e, 0.12, 0.9, 1.0, scaleHex(t, 0.7)), box('gunwale', e, cy + B / 2 - 0.07, W - 2 * e, 0.12, 0.9, 1.0, scaleHex(t, 0.7)));
    for (let x = e + 0.6; x < W - e; x += 1.4) out.push(beam('deck-beam', [x, cy - B / 2, 0.92], [x, cy + B / 2, 0.92], 0.12, scaleHex(t, 0.85)));
    for (const o of [-1.4, 1.4]) out.push(box('cradle', W / 2 + o - 0.15, cy - 1.0, 0.3, 2.0, 0.9, 1.1, P.wood));
    out.push(box('granite-block', W / 2 - 2, cy - 0.8, 4, 1.6, 1.1, 2.5, P.granite));
    for (const o of [-0.8, 0.8]) out.push(beam('steering-post', [0.9, cy + o, 1.0], [0.9, cy + o, 2.4], 0.12, P.wood), beam('steering-oar', [1.0, cy + o, 2.3], [-0.3, cy + o * 1.3, -0.3], 0.1, P.wood));
    return out;
  },
};

// ── the metal and the glass ──

/**
 * The bronze foundry (Rekhmire's): a walled yard before its store; a raised hearth with its crucible,
 * pairs of pot bellows round it — pottery bowls with leather tops, each with the cord the treader
 * pulled it up by — and reed pipes with clay nozzles from them to the fire. A crucible lifted out
 * between two green withy rods; a long trench mould in the floor fed by a row of funnels for a temple
 * door; oxhide ingots stacked, charcoal, a quench jar, slag.
 */
export const egBronzeFoundry = {
  id: 'eg-bronze-foundry', designed: true, patterns: ['metal-casting', 'sun-dried-earth'],
  read: 'A foundry yard: a hearth blown by trodden pot bellows with reed pipes, crucibles lifted on withy rods, a long door mould with funnels, oxhide ingots.',
  notes: [
    'Yard: mud walls 0.5 thick, 2.2 m, a 2 m gate in the front; a flat-roofed store 3.5 m deep across the back.',
    'Hearth: a raised clay bench 1.4 × 1.0, 0.45 high, a charcoal bed with a crucible in it, molten bronze.',
    'Bellows: two pairs, each a pottery bowl r 0.3 with a dark leather top and a cord up 1.1 m from its centre; a reed pipe with a clay nozzle from each to the hearth.',
    'Withy rods: two green rods 1.4 m across a crucible standing on the floor. Mould: a trench 3.2 × 0.9 in the floor with five funnel cups along it.',
    'Oxhide ingots: four-cornered slabs stacked on a mat; a charcoal heap; a quench jar; a slag heap by the wall. The smiths are placed by their own builder.',
  ],
  envelope: { w: [14, 18], d: [11, 14] },
  build({ W, D }, { palette: P, rng }) {
    const mud = P.earth[2], band = scaleHex(mud, 0.93), dark = DARK, t = 0.5, hw = 2.2, rd = 3.5, h1 = 3.0, gw = 2, out = [];
    out.push(box('house', 0, D - rd, W, rd, 0, h1, mud), box('house-roof', -0.1, D - rd - 0.1, W + 0.2, rd + 0.2, h1, h1 + 0.3, band), box('door', W * 0.3, D - rd - 0.06, 1, 0.08, 0, 2.1, dark));
    out.push(box('court-wall', 0, 0, (W - gw) / 2, t, 0, hw, mud), box('court-wall', (W + gw) / 2, 0, (W - gw) / 2, t, 0, hw, mud), box('court-wall', 0, t, t, D - rd - t, 0, hw, mud), box('court-wall', W - t, t, t, D - rd - t, 0, hw, mud));
    const cy0 = t, cd = D - rd - t;
    // the hearth and its bellows on the west side
    const hx = 3.2, hy = cy0 + cd * 0.55;
    out.push(box('hearth', hx - 0.7, hy - 0.5, 1.4, 1.0, 0, 0.45, scaleHex(P.earth[3], 0.75)), ...fire(hx, hy, 0.38, 0.5, P));
    out.push(drum(hx, hy, 0.14, 0.42, 0.62, P.crucible, { kind: 'crucible', sides: 8, taper: 1.15, open: true, lip: 0.025 }), drum(hx, hy, 0.1, 0.54, 0.57, P.molten, { kind: 'molten', sides: 8 }));
    for (const [bx, by] of [[hx - 1.9, hy - 0.5], [hx - 1.9, hy + 0.5], [hx + 0.6, hy - 1.7], [hx - 0.6, hy - 1.7]]) {
      out.push(drum(bx, by, 0.3, 0, 0.22, scaleHex(P.copper, 0.95), { kind: 'pot-bellows', sides: 10 }), dome(bx, by, 0.29, 0.22, 0.3, '#5a4030', { kind: 'bellows-leather', sides: 10 }));
      out.push(box('bellows-cord', bx - 0.01, by - 0.01, 0.02, 0.02, 0.3, 1.4, scaleHex(P.reed, 0.7)));
      const ang = Math.atan2(hy - by, hx - bx), nx = hx - Math.cos(ang) * 0.55, ny = hy - Math.sin(ang) * 0.55;
      out.push(beam('blowpipe', [bx + Math.cos(ang) * 0.3, by + Math.sin(ang) * 0.3, 0.12], [nx, ny, 0.3], 0.04, P.reed), beam('blowpipe-tip', [nx, ny, 0.3], [nx + Math.cos(ang) * 0.12, ny + Math.sin(ang) * 0.12, 0.34], 0.06, P.clay));
    }
    // a crucible on the floor between its withy rods
    const wx = hx + 1.5, wy = hy + 0.6;
    out.push(drum(wx, wy, 0.14, 0, 0.22, P.crucible, { kind: 'crucible', sides: 8, taper: 1.15, open: true, lip: 0.025 }), drum(wx, wy, 0.1, 0.14, 0.17, P.molten, { kind: 'molten', sides: 8 }));
    for (const o of [-0.1, 0.1]) out.push(beam('withy-rod', [wx - 0.7, wy + o, 0.25], [wx + 0.7, wy + o, 0.15], 0.035, scaleHex(P.green, 1.2)));
    // the long door mould with its funnels, in the middle of the yard
    const mx = W * 0.45, my = cy0 + cd * 0.3;
    out.push(...rim('mould', mx, my, 3.4, 1.1, 0.1, 0.12, scaleHex(P.earth[3], 0.85)), box('mould-matrix', mx + 0.1, my + 0.1, 3.2, 0.9, 0.01, 0.04, '#2e2925'));
    for (let k = 0; k < 5; k++) out.push(drum(mx + 0.4 + k * 0.65, my + 0.55, 0.13, 0.04, 0.28, P.clay, { kind: 'funnel', sides: 8, taper: 1.6, open: true, lip: 0.025 }));
    // ingots, charcoal, the quench jar, slag
    const ex = W - t - 1.8;
    out.push(box('reed-floor-mat', ex - 0.4, cy0 + cd * 0.15, 1.8, 1.2, 0.01, 0.03, scaleHex(P.reed, 0.9)));
    for (let k = 0; k < 5; k++) out.push(...oxhide(ex - 0.2 + (k % 2) * 0.7, cy0 + cd * 0.15 + 0.2, 0.03 + Math.floor(k / 2) * 0.05, P));
    out.push(dome(ex + 0.4, cy0 + cd * 0.75, 1.0, 0, 0.65, P.charcoal, { kind: 'charcoal-heap', sides: 10 }), basket(ex - 0.7, cy0 + cd * 0.8, 0.28, 0.34, P));
    out.push(...jar(mx + 0.4, my + 2.0, 1.1, scaleHex(P.copper, 1.1)), dome(W - t - 0.9, D - rd - 0.9, 0.75, 0, 0.45, P.slag, { kind: 'slag-heap', sides: 9 }));
    for (let k = 0; k < 3; k++) out.push(box('chisel', mx + 2.2 + rng() * 0.4, my + 1.8 + k * 0.14, 0.28, 0.04, 0.03, 0.06, P.metal));
    return { boxes: out, grounds: [{ kind: 'court', x: t, y: cy0, w: W - 2 * t, d: cd, z: 0.03, fill: scaleHex(P.lane, 0.9), surface: 'mud' }] };
  },
};

/**
 * The glass and faience works (as dug at Amarna and Qantir-Piramesse): a round furnace with its
 * mouth, rows of cylindrical crucibles — the glass in them cobalt blue and copper turquoise — cooling
 * ingots tipped out of them, the white quartz pebbles crushed for silica and the grey heap of plant
 * ash, and under a shade the faience makers' mats: moulds, and rows of little blue amulets and beads
 * drying before their firing.
 */
export const egGlassWorks = {
  id: 'eg-glass-works', designed: true, patterns: ['glass-working', 'kiln'],
  read: 'A round glass furnace, cylindrical crucibles with blue glass, ingots, quartz and plant-ash heaps, faience moulds and blue amulets drying.',
  notes: [
    'Furnace: a drum r 1.2, 1.4 m under a dome to 2.4 m, fire-reddened; a dark mouth at its foot, a glowing one at its crown.',
    'Crucibles: open drums r 0.08, 0.16 high in rows, cobalt blue and turquoise inside; ingots (blue discs) by them.',
    'Heaps: white crushed quartz, grey plant ash; a stone mortar with its pounder.',
    'Faience: under a mat shade, clay moulds (small boxes) and rows of tiny turquoise amulets on a mat. The glassmakers are placed by their own builder.',
  ],
  envelope: { w: [10, 14], d: [8, 12] },
  build({ W, D }, { palette: P, rng }) {
    const out = [], red = scaleHex(P.earth[2], 1.15);
    const fx = 2.4, fy = D - 2.6;
    out.push(drum(fx, fy, 1.2, 0, 1.4, red, { kind: 'kiln', sides: 12 }), dome(fx, fy, 1.2, 1.4, 2.4, red, { kind: 'kiln', sides: 12 }), drum(fx, fy, 0.22, 2.32, 2.42, P.ember, { kind: 'ember', sides: 8 }));
    out.push({ kind: 'kiln-mouth', solid: 'vault', x: fx - 0.35, y: fy - 1.5, w: 0.7, d: 0.6, z0: 0, z1: 0.7, axis: 'y', open: 'lo', tint: scaleHex(red, 0.8) }, ...fire(fx, fy - 1.85, 0.3, 0.06, P));
    // crucibles in rows, ingots tipped from them
    for (let r = 0; r < 2; r++) for (let k = 0; k < 6; k++) {
      const x = 4.6 + k * 0.38, y = D - 3.4 + r * 0.4, c = (k + r) % 3 === 0 ? P.faience : P.glass;
      out.push(drum(x, y, 0.08, 0, 0.16, P.crucible, { kind: 'crucible', sides: 7, open: true, lip: 0.015 }), drum(x, y, 0.06, 0.06, 0.13, c, { kind: 'glass', sides: 7 }));
    }
    for (let k = 0; k < 5; k++) out.push(drum(4.8 + k * 0.42, D - 1.9, 0.09, 0, 0.07, k % 2 ? P.faience : P.glass, { kind: 'glass-ingot', sides: 8, taper: 0.8 }));
    out.push(dome(W - 1.4, D - 1.5, 0.9, 0, 0.55, P.quartz, { kind: 'quartz-heap', sides: 9 }), dome(W - 1.4, D - 3.6, 0.8, 0, 0.45, P.ash, { kind: 'plant-ash', sides: 9 }));
    out.push(drum(W - 3.2, D - 2.2, 0.3, 0, 0.4, P.dolerite, { kind: 'mortar', sides: 9, open: true, lip: 0.08 }), beam('pounder', [W - 3.2, D - 2.2, 0.3], [W - 3.0, D - 2.3, 0.9], 0.08, P.dolerite));
    // the faience makers under a shade at the front
    const sx = 1.0, sy = 0.8, sw = W - 2.0, sd = 2.6;
    out.push(...shade(sx, sy, sw, sd, 2.2, P));
    out.push(box('reed-floor-mat', sx + 0.4, sy + 0.4, sw * 0.5, sd - 0.8, 0.01, 0.03, scaleHex(P.reed, 0.9)));
    for (let k = 0; k < 40; k++) out.push(dome(sx + 0.55 + (k % 10) * (sw * 0.045), sy + 0.6 + Math.floor(k / 10) * 0.35, 0.05, 0.03, 0.08, scaleHex(P.faience, 0.95 + rng() * 0.1), { kind: 'amulet', sides: 5 }));
    for (let k = 0; k < 6; k++) out.push(box('faience-mould', sx + sw * 0.6 + (k % 3) * 0.4, sy + 0.6 + Math.floor(k / 3) * 0.5, 0.3, 0.3, 0, 0.1, P.sherd), box('mould-matrix', sx + sw * 0.6 + (k % 3) * 0.4 + 0.08, sy + 0.68 + Math.floor(k / 3) * 0.5, 0.14, 0.14, 0.1, 0.105, '#2e2925'));
    return { boxes: out, grounds: [{ kind: 'yard', x: 0, y: 0, w: W, d: D, z: 0.025, fill: scaleHex(P.lane, 0.92), surface: 'mud' }] };
  },
};

// ── the wood: carpenters, chariots, boats ──

/**
 * The carpenters (Rekhmire's): a plank being sawn from a log lashed upright to a post sunk in the
 * ground, the pull saw left in the cut and a weighted lever holding the kerf open; trestles with a
 * chest being built, an adze, a bow drill, chisels; cedar logs on skids, planks stacked, chips.
 */
export const egCarpenters = {
  id: 'eg-carpenters', designed: true, patterns: ['joinery'],
  read: 'Carpenters\' yard: a log lashed upright to a post with the saw left in its cut, a chest on trestles, adze and bow drill, cedar logs and planks.',
  notes: [
    'Saw post: a post 2.4 m sunk in the ground; a squared log 0.4 × 0.3, 2.6 m lashed to it upright (three rope bands); the saw a thin bronze blade in the cut halfway down, a lever with a stone weight wedging the kerf.',
    'Trestles: two, with a chest (box 1.4 × 0.7 × 0.7) half built (sides on, lid beside it); an adze, a bow drill, chisels on a bench under a shade.',
    'Logs: imported cedar (dark) on skids; planks stacked; a chips ground.',
  ],
  envelope: { w: [12, 16], d: [9, 12] },
  build({ W, D }, { palette: P, rng }) {
    const wood = P.wood, cedar = P.timber, out = [];
    // the saw post
    const px = 2.2, py = D - 3.0;
    out.push(box('saw-post', px - 0.12, py - 0.12, 0.24, 0.24, 0, 2.4, scaleHex(wood, 0.9)), box('log', px - 0.2, py + 0.12, 0.4, 0.3, 0, 2.6, scaleHex(cedar, 1.1)));
    for (const z of [0.4, 1.2, 2.0]) out.push(box('rope', px - 0.22, py - 0.15, 0.44, 0.6, z, z + 0.08, scaleHex(P.reed, 0.7)));
    out.push(box('saw', px - 0.02, py + 0.05, 0.04, 0.5, 1.5, 1.62, P.bronze), beam('saw-grip', [px, py + 0.55, 1.56], [px, py + 0.75, 1.56], 0.05, wood));
    out.push(beam('lever', [px, py + 0.27, 2.45], [px + 0.6, py + 0.27, 2.1], 0.05, wood), drum(px + 0.6, py + 0.27, 0.1, 1.85, 2.1, P.sandstone, { kind: 'weight-stone', sides: 7 }));
    // the shade and bench, the trestles with the chest
    const sx = W - 6.2, sy = D - 3.6;
    out.push(...shade(sx, sy, 5.6, 3.0, 2.3, P));
    const bx = sx + 1.2, by = sy + 1.4;
    out.push(box('bench', bx, by, 2.6, 0.6, 0.6, 0.8, wood), box('bench-leg', bx + 0.1, by + 0.1, 0.16, 0.4, 0, 0.6, wood), box('bench-leg', bx + 2.34, by + 0.1, 0.16, 0.4, 0, 0.6, wood));
    out.push(beam('adze', [bx + 0.3, by + 0.2, 0.84], [bx + 0.75, by + 0.28, 0.84], 0.04, wood), box('adze-blade', bx + 0.22, by + 0.14, 0.1, 0.16, 0.8, 0.84, P.bronze));
    out.push(beam('bow-drill', [bx + 1.0, by + 0.45, 0.82], [bx + 1.8, by + 0.45, 0.82], 0.03, wood), beam('bow-drill', [bx + 1.35, by + 0.42, 0.8], [bx + 1.35, by + 0.42, 1.1], 0.03, wood));
    for (let k = 0; k < 3; k++) out.push(box('chisel', bx + 2.0, by + 0.12 + k * 0.12, 0.22, 0.03, 0.8, 0.83, P.bronze));
    const tx = W * 0.45, ty = D * 0.42;
    for (const o of [0, 1.1]) out.push(box('trestle', tx + o, ty - 0.1, 0.12, 0.9, 0, 0.7, wood));
    const ch = scaleHex(cedar, 1.2);
    out.push(box('chest', tx - 0.15, ty, 1.4, 0.06, 0.7, 1.35, ch), box('chest', tx - 0.15, ty + 0.64, 1.4, 0.06, 0.7, 1.35, ch), box('chest', tx - 0.15, ty, 0.06, 0.7, 0.7, 1.35, ch), box('chest', tx - 0.15, ty, 1.4, 0.7, 0.7, 0.76, ch));
    out.push(box('chest-lid', tx + 1.6, ty - 0.2, 1.4, 0.7, 0, 0.06, ch));
    // logs and planks at the front
    for (const y of [0.8, 3.6]) out.push(box('skid', 0.3, y, 2.4, 0.2, 0, 0.18, scaleHex(wood, 0.9)));
    for (let k = 0; k < 3; k++) { const x = 0.6 + k * 0.65; out.push(beam('log', [x, 0.4, 0.42], [x, 4.0 + rng() * 0.4, 0.42], 0.48, scaleHex(cedar, 0.95 + k * 0.05))); }
    for (let k = 0; k < 5; k++) out.push(box('plank', 3.2, 0.8 + (k % 2) * 0.05, 0.35, 2.6, 0.18 + k * 0.065, 0.24 + k * 0.065, scaleHex(cedar, 1.15 + k * 0.03)));
    for (const y of [1.0, 2.9]) out.push(box('skid', 3.0, y, 0.75, 0.18, 0, 0.18, scaleHex(wood, 0.9)));
    return { boxes: out, grounds: [{ kind: 'yard', x: 0, y: 0, w: W, d: D, z: 0.025, fill: P.lane, surface: 'mud' }, { kind: 'chips', x: 0.8, y: D - 4.4, w: 3.4, d: 3.0, z: 0.03, fill: P.chips, surface: 'stubble' }] };
  },
};

/**
 * The chariot makers (Rekhmire's, and Tutankhamun's chariots for what they made): a finished chariot
 * standing on its two six-spoked wheels, its light body of bent wood open at the back, the pole run
 * forward to the yoke; a second body on trestles waiting for its wheels; spare wheels leaning; a rim
 * being bent round a post; rawhide strips hung on a rail; the bench under a shade.
 */
export const egChariotShop = {
  id: 'eg-chariot-shop', designed: true, patterns: ['joinery', 'cart'],
  read: 'A chariot workshop: a finished chariot on six-spoked wheels, a body on trestles, spare spoked wheels, a rim bent round a post, rawhide hung on a rail.',
  notes: [
    'Chariot: two spoked wheels r 0.48 (rim, six spokes, hub) on an axle at the body\'s back edge, gauge 1.6; the body a light floor 1.0 × 0.5 with a bent-wood rail 0.75 high round its front and sides, open at the back; the pole a beam forward and down to the yoke on the ground.',
    'A second body on two trestles, no wheels; three spare wheels leaning on the wall.',
    'Bending: a post with a rim half bent round it (a ring segment of beams), lashed. Rawhide: strips (thin boxes) hanging from a rail between two posts.',
    'Bench with adze and bow drill under a shade. The chariot makers are placed by their own builder; the horses by theirs.',
  ],
  envelope: { w: [12, 16], d: [9, 12] },
  build({ W, D }, { palette: P }) {
    const out = [], t = P.timber, wood = P.wood, R = 0.48;
    // a body: the floor and the bent rail round the front and sides
    const body = (cx, y0, z) => {
      const o = [box('chariot-floor', cx - 0.5, y0, 1.0, 0.5, z, z + 0.05, t)];
      const pts = [[cx - 0.5, y0 + 0.5], [cx - 0.5, y0 + 0.1], [cx - 0.3, y0], [cx + 0.3, y0], [cx + 0.5, y0 + 0.1], [cx + 0.5, y0 + 0.5]];
      for (let i = 0; i < pts.length - 1; i++) o.push(beam('chariot-rail', [...pts[i], z + 0.75], [...pts[i + 1], z + 0.75], 0.04, scaleHex(t, 1.15)));
      for (const p of pts) o.push(beam('chariot-strut', [...p, z + 0.05], [...p, z + 0.75], 0.03, scaleHex(t, 1.1)));
      o.push(box('chariot-siding', cx - 0.5, y0 + 0.1, 0.02, 0.4, z + 0.05, z + 0.5, P.cloth), box('chariot-siding', cx + 0.48, y0 + 0.1, 0.02, 0.4, z + 0.05, z + 0.5, P.cloth));   // leather or linen siding
      return o;
    };
    // the finished chariot facing the front, the yoke on the ground
    const cx = W * 0.3, ay = 4.2;
    out.push(...spokedWheel(cx - 0.8, ay, R, R, P), ...spokedWheel(cx + 0.8, ay, R, R, P), beam('axle', [cx - 0.9, ay, R], [cx + 0.9, ay, R], 0.07, t));
    out.push(...body(cx, ay - 0.5, R + 0.04));
    out.push(beam('chariot-pole', [cx, ay - 0.3, R + 0.04], [cx, 0.8, 0.12], 0.07, t), beam('yoke', [cx - 0.7, 0.8, 0.1], [cx + 0.7, 0.8, 0.1], 0.08, t));
    // a body on trestles
    const bx = W * 0.62, by = 2.2;
    for (const o of [-0.35, 0.35]) out.push(box('trestle', bx + o - 0.06, by - 0.1, 0.12, 0.7, 0, 0.6, wood));
    out.push(...body(bx, by - 0.05, 0.6));
    // spare wheels leaning on the back wall
    out.push(box('court-wall', 0.3, D - 0.5, W - 0.6, 0.4, 0, 2.0, P.earth[1]));
    for (let k = 0; k < 3; k++) out.push(...spokedWheel(1.2 + k * 0.3, D - 1.0 - R + 0.1, R, R, P));
    // the rim bent round a post, the rawhide rail
    const rx = W * 0.5, ry = D - 3.2;
    out.push(drum(rx, ry, 0.2, 0, 1.4, scaleHex(wood, 0.9), { kind: 'bending-post', sides: 8 }));
    for (let i = 0; i < 5; i++) { const a0 = (i / 5) * 3.14, a1 = ((i + 1) / 5) * 3.14; out.push(beam('bent-rim', [rx + Math.cos(a0) * 0.5, ry + Math.sin(a0) * 0.5, 0.9], [rx + Math.cos(a1) * 0.5, ry + Math.sin(a1) * 0.5, 0.9], 0.06, scaleHex(t, 1.2))); }
    const hx = 3.0, hy = D - 2.6;
    for (const o of [0, 2.4]) out.push(beam('rail-post', [hx + o, hy, 0], [hx + o, hy, 1.9], 0.1, wood));
    out.push(beam('rail', [hx, hy, 1.85], [hx + 2.4, hy, 1.85], 0.07, wood));
    for (let k = 0; k < 6; k++) out.push(box('rawhide', hx + 0.25 + k * 0.36, hy - 0.02, 0.12, 0.04, 0.7, 1.82, scaleHex('#a88a62', 0.92 + (k % 3) * 0.05)));
    // the bench under a shade
    const sx = W - 4.6, sy = D - 4.2;
    out.push(...shade(sx, sy, 4.0, 2.8, 2.3, P), box('bench', sx + 0.7, sy + 1.2, 2.4, 0.6, 0.6, 0.8, wood), box('bench-leg', sx + 0.8, sy + 1.3, 0.16, 0.4, 0, 0.6, wood), box('bench-leg', sx + 2.9, sy + 1.3, 0.16, 0.4, 0, 0.6, wood));
    out.push(beam('adze', [sx + 0.9, sy + 1.4, 0.84], [sx + 1.35, sy + 1.48, 0.84], 0.04, wood), box('adze-blade', sx + 0.82, sy + 1.34, 0.1, 0.16, 0.8, 0.84, P.bronze), beam('bow-drill', [sx + 1.6, sy + 1.65, 0.82], [sx + 2.4, sy + 1.65, 0.82], 0.03, wood));
    return { boxes: out, grounds: [{ kind: 'yard', x: 0, y: 0, w: W, d: D, z: 0.025, fill: P.lane, surface: 'mud' }, { kind: 'chips', x: W - 4.4, y: 0.8, w: 3.0, d: 2.4, z: 0.03, fill: P.chips, surface: 'stubble' }] };
  },
};

/**
 * The boatyard on the bank: a plank hull on its stocks, built shell first as Egypt built — the lower
 * strakes on, the upper strake only part way along, its stem and stern posts up — crossbeams laid
 * across; cedar planks stacked, an adze and mallets, a pot of glue on a fire.
 */
export const egBoatyard = {
  id: 'eg-boatyard', designed: true, patterns: ['boat', 'joinery'],
  read: 'A plank hull on its stocks, built shell first: lower strakes on, the top strake part way, stem and stern posts up; cedar planks stacked, adzes, a glue pot.',
  notes: [
    'Hull: along the slot\'s length less 3 m, beam ≈ 3.4 m at the middle, narrowing to 0.6 at the ends, the sheer rising from 1.6 m to 2.6 at the ends; the bottom and two strakes a side as slanted panels, the upper strake on the stern half only.',
    'Stocks: blocks under the bottom; posts at the stem and stern; crossbeams on the finished half.',
    'Planks stacked; an adze, mallets; a glue pot on a small fire. The shipwrights are placed by their own builder.',
  ],
  envelope: { w: [20, 28], d: [8, 12] },
  build({ W, D }, { palette: P }) {
    const t = P.timber, out = [], x0 = 1.5, L = W - 3, cy = D * 0.42, N = 10, z0 = 0.6;
    const half = (u) => 0.3 + 1.4 * Math.sin(Math.PI * u), sheer = (u) => z0 + 1.0 + 1.0 * (2 * u - 1) ** 2, bot = (u) => 0.2 + 0.9 * Math.sin(Math.PI * u);
    for (let i = 0; i < N; i++) {
      const u0 = i / N, u1 = (i + 1) / N, xa = x0 + L * u0, xb = x0 + L * u1;
      for (const s of [-1, 1]) {
        const mid = (u) => (bot(u) + half(u)) / 2, zm = (u) => z0 + (sheer(u) - z0) * 0.5;
        out.push(panel('hull-strake', [[xa, cy + s * bot(u0), z0], [xb, cy + s * bot(u1), z0], [xb, cy + s * mid(u1), zm(u1)], [xa, cy + s * mid(u0), zm(u0)]], [0, s, -0.3], scaleHex(t, 0.95)));
        if (i >= N / 2 - 1) out.push(panel('hull-strake', [[xa, cy + s * mid(u0), zm(u0)], [xb, cy + s * mid(u1), zm(u1)], [xb, cy + s * half(u1), sheer(u1)], [xa, cy + s * half(u0), sheer(u0)]], [0, s, 0.2], scaleHex(t, 1.05)));
      }
      out.push(panel('hull-bottom', [[xa, cy - bot(u0), z0], [xb, cy - bot(u1), z0], [xb, cy + bot(u1), z0], [xa, cy + bot(u0), z0]], [0, 0, -1], scaleHex(t, 0.8)));
      out.push(panel('hull-floor', [[xa, cy - bot(u0), z0 + 0.02], [xb, cy - bot(u1), z0 + 0.02], [xb, cy + bot(u1), z0 + 0.02], [xa, cy + bot(u0), z0 + 0.02]], [0, 0, 1], scaleHex(t, 0.88)));
      if (i % 2 === 0 && i > 0) out.push(box('stock', xa - 0.2, cy - 1.0, 0.4, 2.0, 0, z0, scaleHex(P.wood, 0.85)));
      if (i >= N / 2 && i < N - 1) out.push(beam('crossbeam', [xb, cy - half(u1), sheer(u1) - 0.1], [xb, cy + half(u1), sheer(u1) - 0.1], 0.12, scaleHex(t, 0.85)));
    }
    out.push(beam('stem-post', [x0, cy, z0], [x0 - 0.4, cy, sheer(0) + 0.8], 0.18, t), beam('stern-post', [x0 + L, cy, z0], [x0 + L + 0.4, cy, sheer(1) + 0.6], 0.18, t));
    // planks, tools, the glue pot
    for (let k = 0; k < 6; k++) out.push(box('plank', 1.0, D - 1.6 + (k % 2) * 0.05, 4.5, 0.35, k * 0.065, 0.06 + k * 0.065, scaleHex(t, 1.1 + k * 0.03)));
    out.push(beam('adze', [7, D - 1.2, 0.04], [7.45, D - 1.1, 0.04], 0.04, P.wood), box('adze-blade', 6.9, D - 1.3, 0.1, 0.16, 0, 0.04, P.bronze), drum(8.2, D - 1.2, 0.1, 0, 0.24, P.wood, { kind: 'mallet', sides: 7, taper: 0.8 }));
    out.push(...fire(W - 2.5, D - 1.4, 0.3, 0.08, P), drum(W - 2.5, D - 1.4, 0.22, 0.1, 0.4, scaleHex(P.copper, 0.85), { kind: 'glue-pot', sides: 9, open: true, lip: 0.03 }));
    return { boxes: out, grounds: [{ kind: 'yard', x: 0, y: 0, w: W, d: D, z: 0.025, fill: scaleHex(P.lane, 0.95), surface: 'mud' }, { kind: 'chips', x: x0 + L * 0.3, y: cy + 1.8, w: L * 0.4, d: 1.6, z: 0.03, fill: P.chips, surface: 'stubble' }] };
  },
};

// ── the pots and the papyrus ──

/**
 * The potters' yard, Egyptian: a mat shade over the wheel (a turntable on a low socket, a jar on it),
 * the tall slender beer jars and carinated bowls drying in rows, stacks of the conical bread moulds
 * that every bakery used by the thousand, a settling pit for the Nile clay, a wasters heap.
 */
export const egPottersYard = {
  id: 'eg-potters-yard', designed: true, patterns: ['potters'],
  read: 'A mat shade over a turntable wheel, slender beer jars and bowls drying in rows, stacks of conical bread moulds, a settling pit, a wasters heap.',
  notes: [
    'Shade: a mat roof 2.4 m up on four posts; the wheel a disc r 0.4 on a socket 0.35 high, a jar on it; a low seat.',
    'Drying: rows of slender jars (a tall narrow drum on a pointed foot) and open bowls, greenware.',
    'Bread moulds: stacks of inverted cones (drums tapering to a point), red Nile silt ware; a settling pit; the wasters heap with sherds.',
  ],
  envelope: { w: [12, 18], d: [9, 13] },
  build({ W, D }, { palette: P, rng }) {
    const out = [], green = P.greenware, terra = P.sherd, grounds = [];
    const sx = 0.6, sy = D - 6, sw = 6, sd = 4.6;
    out.push(...shade(sx, sy, sw, sd, 2.4, P));
    const wx = sx + 2, wy = sy + 2.2;
    out.push(drum(wx, wy, 0.12, 0, 0.35, P.wood, { kind: 'wheel-socket', sides: 8 }), drum(wx, wy, 0.4, 0.35, 0.45, scaleHex(P.wood, 1.1), { kind: 'potters-wheel', sides: 14 }));
    out.push(drum(wx, wy, 0.1, 0.45, 0.6, green, { kind: 'jar', sides: 9, taper: 1.8 }), drum(wx, wy, 0.18, 0.6, 0.9, green, { kind: 'jar', sides: 9, taper: 0.6, open: true, lip: 0.02 }), box('seat', wx - 0.25, wy + 0.65, 0.5, 0.4, 0, 0.3, P.wood));
    // greenware drying along the front: slender beer jars and bowls
    for (let r = 0; r < 2; r++) for (let x = 0.8 + r * 0.3; x < W * 0.55; x += 0.6) {
      const y = 0.6 + r * 0.8, c = scaleHex(green, 0.97 + rng() * 0.06);
      if ((Math.round(x * 10) + r) % 3) out.push(drum(x, y, 0.06, 0, 0.12, c, { kind: 'beer-jar', sides: 8, taper: 2.2 }), drum(x, y, 0.13, 0.12, 0.55, c, { kind: 'beer-jar', sides: 8, taper: 0.6, open: true, lip: 0.02 }));
      else out.push(drum(x, y, 0.12, 0, 0.12, c, { kind: 'bowl', sides: 9, taper: 1.6, open: true, lip: 0.02 }));
    }
    // bread moulds stacked: inverted cones
    for (let i = 0; i < 6; i++) {
      const bx = W * 0.62 + (i % 3) * 0.6, by = 0.6 + Math.floor(i / 3) * 0.6, n = 3 + Math.floor(rng() * 3);
      out.push(drum(bx, by, 0.16, 0, 0.28 + n * 0.05, scaleHex(terra, 1.0 + rng() * 0.08), { kind: 'bread-moulds', sides: 9, taper: 0.25 }));
    }
    // the settling pit, the wasters heap
    const tx = sx + sw + 1.2, ty = sy + 0.4;
    out.push(...rim('tank-rim', tx, ty, 2.2, 1.6, 0.25, 0.35, scaleHex(P.mud, 1.05)));
    grounds.push({ kind: 'slurry', x: tx + 0.25, y: ty + 0.25, w: 1.7, d: 1.1, z: 0.28, fill: P.clay });
    const hx = W - 1.6, hy = D - 1.6;
    out.push(dome(hx, hy, 1.4, 0, 0.9, terra, { kind: 'wasters', sides: 11 }));
    for (let k = 0; k < 5; k++) { const a = rng() * 6.283, r = 0.5 + rng() * 0.6; out.push(drum(hx + Math.cos(a) * r, hy + Math.sin(a) * r, 0.16, 0.9 * (1 - r / 1.4) * 0.8, 0.9 * (1 - r / 1.4) * 0.8 + 0.18, scaleHex(terra, 0.9 + rng() * 0.15), { kind: 'sherd', sides: 7, taper: 1.3, open: true, lip: 0.02 })); }
    return { boxes: out, grounds: [...grounds, { kind: 'yard', x: 0, y: 0, w: W, d: D, z: 0.025, fill: P.lane, surface: 'mud' }] };
  },
};

/**
 * The pottery kiln, Egyptian: a tall updraft cylinder of mud brick, fire-reddened, open at the top
 * where the load shows, its stoking mouth at the foot with soot above it, fuel (straw and dung) by it.
 */
export const egPotteryKiln = {
  id: 'eg-pottery-kiln', designed: true, patterns: ['kiln', 'potters'],
  read: 'A tall cylindrical updraft kiln, open at the top on its load of pots, a stoking mouth at its foot, soot, fuel heaped by it.',
  notes: [
    'Kiln: a drum r ≈ 1.5, 2.8 m, tapering a little, open at the top with a 0.3 m lip; rims of the stacked pots showing inside the top.',
    'Mouth: a dark vault 0.7 × 0.8 at the foot of the front, a soot plume above; a heap of straw and dung cakes by it.',
  ],
  envelope: { w: [3.5, 5.5], d: [3.5, 5.5] },
  build({ W, D }, { palette: P }) {
    const r = Math.min(W, D) / 2 - 0.4, cx = W / 2, cy = D / 2 + 0.3, red = scaleHex(P.earth[2], 1.15), out = [];
    out.push(drum(cx, cy, r, 0, 2.8, red, { kind: 'kiln', sides: 12, taper: 0.88, open: true, lip: 0.3 }));
    for (let k = 0; k < 5; k++) { const a = k * 1.256, q = r * 0.4; out.push(drum(cx + Math.cos(a) * q, cy + Math.sin(a) * q, 0.18, 2.3, 2.55, P.sherd, { kind: 'pot-rim', sides: 8, open: true, lip: 0.03 })); }
    out.push({ kind: 'kiln-mouth', solid: 'vault', x: cx - 0.35, y: cy - r - 0.3, w: 0.7, d: 0.6, z0: 0, z1: 0.8, axis: 'y', open: 'lo', tint: scaleHex(red, 0.8) });
    out.push(panel('soot', [[cx - 0.35, cy - r - 0.02, 0.75], [cx + 0.35, cy - r - 0.02, 0.75], [cx, cy - r + 0.05, 2.0]], [0, -1, 0], scaleHex(red, 0.6)));
    out.push(dome(cx + r * 0.9, 0.5, 0.5, 0, 0.4, P.straw, { kind: 'straw-heap', sides: 8 }), dome(cx - r * 0.9, 0.5, 0.42, 0, 0.32, '#5b4a3a', { kind: 'dung-cakes', sides: 8 }));
    return out;
  },
};

/**
 * The papyrus works at the marsh edge: the green stalks cut and bundled with their umbels on; the
 * pith cut in strips and laid in two layers crosswise on boards, pressed under flat stones; finished
 * sheets drying on a rack and rolled; rope twisted from the rind on a rope walk between two posts; a
 * papyrus skiff half lashed.
 */
export const egPapyrusWorks = {
  id: 'eg-papyrus-works', designed: true, patterns: ['reed-working', 'reed'],
  read: 'Papyrus cut and bundled with its umbels, strips laid crosswise and pressed under stones, sheets drying, rope twisted on a walk, a skiff half lashed.',
  notes: [
    'Bundles: green stalks (beams 0.2 thick, 3 m) with a tuft (a small dome) at the umbel end, stacked in two layers.',
    'Sheets: boards 0.4 × 0.5 with two crossing layers of pale strips, two pressed under flat stones; a rack with sheets drying; rolls.',
    'Rope walk: two posts 6 m apart, a rope stretched between them, coils by the end post. Skiff: a papyrus-bundle hull, its ends curving up, half lashed.',
  ],
  envelope: { w: [10, 14], d: [6, 9] },
  build({ W, D }, { palette: P }) {
    const out = [], g = P.papyrus, pith = '#e6dcc0';
    for (let l = 0; l < 2; l++) for (let k = 0; k < 4 - l; k++) {
      const y = 0.4 + 0.12 * l + k * 0.24, z = 0.12 + l * 0.2;
      out.push(beam('papyrus-stalk', [0.4, y, z], [3.2, y, z], 0.2, g), dome(3.4, y, 0.22, z - 0.12, z + 0.16, scaleHex(g, 1.2), { kind: 'umbel', sides: 6 }));
    }
    // sheets on boards, two pressed under stones
    for (let k = 0; k < 4; k++) {
      const x = 4.2 + k * 0.7, y = 0.5;
      out.push(box('board', x, y, 0.5, 0.6, 0, 0.05, P.wood), box('papyrus-sheet', x + 0.05, y + 0.05, 0.4, 0.5, 0.05, 0.06, pith), box('papyrus-sheet', x + 0.05, y + 0.05, 0.4, 0.5, 0.06, 0.07, scaleHex(pith, 0.95)));
      if (k < 2) out.push(box('press-stone', x + 0.08, y + 0.1, 0.34, 0.4, 0.07, 0.17, P.sandstone));
    }
    out.push(beam('rack', [4.2, 2.0, 1.2], [7.0, 2.0, 1.2], 0.05, P.wood), beam('rack-post', [4.2, 2.0, 0], [4.2, 2.0, 1.2], 0.06, P.wood), beam('rack-post', [7.0, 2.0, 0], [7.0, 2.0, 1.2], 0.06, P.wood));
    for (let k = 0; k < 5; k++) out.push(box('papyrus-sheet', 4.4 + k * 0.5, 1.98, 0.4, 0.02, 0.7, 1.18, pith));
    for (let k = 0; k < 3; k++) out.push(beam('papyrus-roll', [7.6, 0.6 + k * 0.2, 0.05], [7.95, 0.6 + k * 0.2, 0.05], 0.08, pith));
    // the rope walk along the back
    const ry = D - 0.7, rx0 = 0.6, rx1 = Math.min(W - 0.6, rx0 + 6);
    for (const x of [rx0, rx1]) out.push(beam('rope-post', [x, ry, 0], [x, ry, 1.0], 0.1, P.wood));
    out.push(beam('rope', [rx0, ry, 0.9], [rx1, ry, 0.9], 0.04, scaleHex(P.reed, 0.7)));
    for (let k = 0; k < 2; k++) out.push(drum(rx1 + 0.1 - k * 0.5, ry - 0.6, 0.22, 0, 0.12, scaleHex(P.reed, 0.72), { kind: 'rope-coil', sides: 9, open: true, lip: 0.08 }));
    // a skiff of papyrus bundles, half lashed
    const sy = D * 0.55, sx0 = W - 5.2, sx1 = W - 0.6;
    for (const o of [-0.3, 0, 0.3]) out.push(bundle([sx0 + 0.6, sy + o, 0.25], [sx1 - 0.6, sy + o, 0.25], { reed: g }, 0.32));
    out.push(bundle([sx0 + 0.6, sy, 0.25], [sx0, sy, 0.9], { reed: g }, 0.26), bundle([sx1 - 0.6, sy, 0.25], [sx1, sy, 0.8], { reed: g }, 0.26));
    for (let k = 0; k < 3; k++) out.push(box('lashing', sx0 + 1.0 + k * 0.5, sy - 0.48, 0.06, 0.96, 0.08, 0.44, scaleHex(P.reed, 0.7)));
    return { boxes: out, grounds: [{ kind: 'yard', x: 0, y: 0, w: W, d: D, z: 0.025, fill: scaleHex(P.marsh, 1.1), surface: 'mud' }] };
  },
};

export const EGYPT_WORKS_ASSETS = Object.fromEntries([egQuarry, egStoneSledge, egMasonsYard, egStoneQuay, egStoneBarge, egBronzeFoundry, egGlassWorks, egCarpenters, egChariotShop, egBoatyard, egPottersYard, egPotteryKiln, egPapyrusWorks].map((a) => [a.id, a]));

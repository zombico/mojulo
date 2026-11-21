/**
 * THE FOOD'S FORMS: each a face list built from the lathe and the box and prism of the dress (gameroom/dress.js), the
 * glyph shelf's discipline (game/glyph-forms.js): built at glyph scale (about one unit across), its base at z = 0,
 * centred on x = y = 0, read from above at gameplay distance. Placed at a size by `foodFaces` (food/derive.js).
 *
 *   FORMS[name](colours) → faces       the ingredients whole and prepped, and the vessels
 *   ARRANGE[name](parts, vessel) → faces   a dish's parts composed (parts: their resolved looks, food/derive.js)
 *
 * Pure, no dice: the scatter of a pile is laid on fixed spots.
 */
import { latheToFaces } from '../polygonizer/lathe-faces.js';
import { prism as prismInto, face } from '../gameroom/dress.js';
import { shadeHex, newellNormal } from '../polygonizer/vexar.js';
import { VESSELS } from './roster.js';

const G = 'food';
// THE ROUNDS: a lathe swept fine, each face tagged with its own colour (`smooth` shades it a corner at a time)
const tag = (faces, fill) => faces.map((f) => ({ ...f, round: fill }));
const lathe = (prof, z0, z1, fill, { at = [0, 0], n = 16, s = 28 } = {}) => tag(latheToFaces({ axisFrom: { x: at[0], y: at[1], z: z0 }, axisTo: { x: at[0], y: at[1], z: z1 }, profile: prof.map(([t, radius]) => ({ t, radius })), crossSections: n, samples: s }, { tint: fill }), fill);
// a lathe lying along x (a fish, a carrot, a loaf), its axis at height z
const latheX = (prof, x0, x1, z, fill, { y = 0, n = 18, s = 24 } = {}) => tag(latheToFaces({ axisFrom: { x: x0, y, z }, axisTo: { x: x1, y, z }, profile: prof.map(([t, radius]) => ({ t, radius })), crossSections: n, samples: s }, { tint: fill }), fill);
const r4 = (v) => Math.round(v * 1e4) / 1e4;
// THE BOXES: every box chamfered, its twelve edges cut at 45° (`c`: the cut, a quarter of its thinnest side at most),
// each face shaded by the light as it faces, so an edge catches it: a fillet, a block of rice, a crate read as made
// (a face's normal turned away from its box's middle, whatever its winding)
const outward = (corners, mid) => { const n = newellNormal(corners), c = [0, 1, 2].map((k) => corners.reduce((t, p) => t + p[k], 0) / corners.length); return n[0] * (c[0] - mid[0]) + n[1] * (c[1] - mid[1]) + n[2] * (c[2] - mid[2]) >= 0 ? n : n.map((x) => -x); };
const lit = (corners, fill, mid) => face(corners, shadeHex(fill, outward(corners, mid)), G);
function box([x0, y0, z0], [x1, y1, z1], fill, cut = 0.03) {
  const c = Math.min(cut, (x1 - x0) / 4, (y1 - y0) / 4, (z1 - z0) / 4), mid = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], h = [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2];
  // corner (sx, sy, sz)'s three points: on its x face, its y face, its z face
  const v = (axis, sx, sy, sz) => { const s = [sx, sy, sz]; return [0, 1, 2].map((k) => r4(mid[k] + s[k] * (k === axis ? h[k] : h[k] - c))); };
  const out = [], S = [-1, 1];
  // the six faces, set in from their edges
  for (const k of [0, 1, 2]) for (const s of S) {
    const a = (k + 1) % 3, b = (k + 2) % 3, at = (u, w) => { const t = [0, 0, 0]; t[k] = s; t[a] = u; t[b] = w; return v(k, ...t); };
    out.push(lit([at(-1, -1), at(1, -1), at(1, 1), at(-1, 1)], fill, mid));
  }
  // the twelve edge strips: along axis k, between the faces of the other two
  for (const k of [0, 1, 2]) for (const p of S) for (const q of S) {
    const a = (k + 1) % 3, b = (k + 2) % 3, at = (axis, e) => { const t = [0, 0, 0]; t[k] = e; t[a] = p; t[b] = q; return v(axis, ...t); };
    out.push(lit([at(a, -1), at(a, 1), at(b, 1), at(b, -1)], fill, mid));
  }
  // the eight corners, a triangle each
  for (const sx of S) for (const sy of S) for (const sz of S) out.push(lit([v(0, sx, sy, sz), v(1, sx, sy, sz), v(2, sx, sy, sz)], fill, mid));
  return out;
}

// a disc (a plate, a slice, a ring): a prism, each face shaded as it faces, its top lit and its rim in the half-light
// (its rim a round, shaded smooth with the rest; its top flat, its edge with the rim kept sharp)
const disc = (c, r, z0, z1, fill, sides = 32, ry = r) => { const o = []; prismInto(o, c, r, ry, z0, z1, sides, fill, G); const mid = [c[0], c[1], (z0 + z1) / 2]; return o.map((f) => (f.corners.every((p) => Math.abs(p[2] - z1) < 1e-6) ? { ...f, fill: shadeHex(fill, outward(f.corners, mid)) } : { ...f, round: fill, outNormal: outward(f.corners, mid) })); };

/**
 * SMOOTH: the rounds shaded a corner at a time. Each corner of a round face takes the mean of the normals of the faces
 * meeting there that turn less than `crease` from its own (so a rim, a cap's edge, stays sharp), and its colour is the
 * face's own shaded by the light along that normal (`cornerFills`: the page blends them across the face). A face that is
 * not round (a box, a disc) is left as built.
 */
export function smooth(faces, { crease = 50 } = {}) {
  const key = (c) => c.map((v) => Math.round(v * 2000)).join(','), cos = Math.cos((crease * Math.PI) / 180);
  // (a face's normal by its corners, turned to agree with the outward normal the lathe recorded)
  const norm = (f) => { const n = newellNormal(f.corners), o = f.outNormal; return o && n[0] * o[0] + n[1] * o[1] + n[2] * o[2] < 0 ? n.map((x) => -x) : n; };
  const R = faces.filter((f) => f.round), N = new Map(R.map((f) => [f, norm(f)])), at = new Map();
  for (const f of R) for (const c of f.corners) { const k = key(c); (at.get(k) ?? at.set(k, []).get(k)).push(f); }
  return faces.map((f) => {
    if (!f.round) return f;
    const n0 = N.get(f), { round, ...rest } = f;
    const cornerFills = f.corners.map((c) => {
      const m = [0, 0, 0];
      for (const g of at.get(key(c))) { const n = N.get(g); if (n[0] * n0[0] + n[1] * n0[1] + n[2] * n0[2] >= cos) for (let k = 0; k < 3; k++) m[k] += n[k]; }
      const l = Math.hypot(...m) || 1;
      return shadeHex(round, m.map((x) => x / l));
    });
    return { ...rest, fill: shadeHex(round, n0), cornerFills };
  });
}
// a flat triangle, both sides (a fin, a tail's lobe)
const tri = (a, b, c, fill) => [face([a, b, c, c], fill, G)];
const lift = (faces, [dx, dy, dz], k = 1) => faces.map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => [x * k + dx, y * k + dy, z * k + dz]) }));
// fixed scatter spots for a pile (no dice: the same pile every time)
const SPOTS = [[0, 0], [0.16, 0.08], [-0.14, 0.1], [0.06, -0.15], [-0.12, -0.1], [0.2, -0.06], [-0.2, 0.02], [0.02, 0.18]];

export const FORMS = {
  // ── whole ──
  // a fish on its belly: its body a lathe along x, a forked tail and a dorsal fin, its eyes
  fish: ([body, belly]) => [
    ...latheX([[0, 0.04], [0.12, 0.16], [0.4, 0.21], [0.72, 0.12], [0.92, 0.05], [1, 0.035]], -0.42, 0.3, 0.21, body),
    ...tri([0.27, 0, 0.21], [0.5, 0, 0.42], [0.42, 0, 0.21], body), ...tri([0.27, 0, 0.21], [0.42, 0, 0.21], [0.5, 0, 0.02], body),
    ...tri([-0.16, 0, 0.4], [0.06, 0, 0.36], [0.02, 0, 0.5], body),
    ...box([-0.3, -0.1, 0.06], [0.06, 0.1, 0.09], belly),
    ...disc([-0.33, -0.11], 0.035, 0.24, 0.29, '#1d2328', 16), ...disc([-0.33, 0.11], 0.035, 0.24, 0.29, '#1d2328', 16),
  ],
  // a sack: full in the belly, cinched at the neck under a tie, its mouth flared above it
  sack: ([cloth, tie]) => [...lathe([[0, 0.28], [0.15, 0.34], [0.5, 0.33], [0.7, 0.22], [0.8, 0.09], [0.86, 0.08], [0.93, 0.14], [1, 0.1]], 0, 0.8, cloth), ...disc([0, 0], 0.105, 0.63, 0.68, tie, 32)],
  sheaf: ([grain, stalk]) => [
    ...[-0.1, -0.03, 0.04, 0.1].flatMap((x, k) => box([x - 0.02, -0.02 + (k % 2) * 0.03, 0], [x + 0.02, 0.02 + (k % 2) * 0.03, 0.55], stalk)),
    ...lathe([[0, 0.1], [0.5, 0.2], [1, 0.05]], 0.5, 0.85, grain), ...disc([0, 0], 0.15, 0.24, 0.29, stalk, 32),
  ],
  head: ([outer, inner]) => [...lathe([[0, 0.14], [0.3, 0.4], [0.65, 0.38], [1, 0.06]], 0, 0.6, outer), ...lathe([[0, 0.2], [0.6, 0.18], [1, 0.03]], 0.42, 0.66, inner, { s: 10 })],
  fruit: ([skin, leaf]) => [...lathe([[0, 0.08], [0.25, 0.34], [0.6, 0.38], [0.9, 0.24], [1, 0.08]], 0, 0.6, skin), ...disc([0, 0], 0.13, 0.58, 0.61, leaf, 5), ...disc([0, 0], 0.025, 0.58, 0.72, leaf, 6)],
  carrot: ([root, top]) => [...latheX([[0, 0.02], [0.8, 0.15], [1, 0.12]], 0.4, -0.3, 0.16, root), ...box([-0.42, -0.03, 0.1], [-0.3, 0.03, 0.42], top), ...box([-0.4, -0.1, 0.1], [-0.32, -0.05, 0.36], top)],
  lump: ([skin]) => [...lathe([[0, 0.18], [0.3, 0.36], [0.7, 0.32], [1, 0.12]], 0, 0.4, skin)],
  bulb: ([skin]) => [...lathe([[0, 0.12], [0.35, 0.36], [0.7, 0.3], [0.95, 0.06], [1, 0.02]], 0, 0.68, skin)],
  mushroom: ([cap, stem]) => [...disc([0, 0], 0.1, 0, 0.28, stem, 32), ...lathe([[0, 0.36], [0.5, 0.3], [1, 0.04]], 0.24, 0.5, cap)],
  // a drumstick: its meat a round, its bone out of one end
  drumstick: ([meat, bone]) => [...latheX([[0, 0.06], [0.25, 0.2], [0.6, 0.22], [1, 0.08]], -0.38, 0.18, 0.23, meat), ...latheX([[0, 0.05], [0.7, 0.035], [1, 0.06]], 0.14, 0.42, 0.23, bone ?? '#f7ece4')],
  slab: ([meat, fat]) => [...box([-0.4, -0.27, 0], [0.4, 0.27, 0.15], meat), ...box([-0.4, 0.2, 0.15], [0.4, 0.27, 0.165], fat ?? meat)],
  egg: ([shell]) => [...lathe([[0, 0.05], [0.25, 0.27], [0.55, 0.3], [0.85, 0.22], [1, 0.04]], 0, 0.62, shell)],
  loaf: ([crust, crumb]) => [...latheX([[0, 0.18], [0.12, 0.27], [0.88, 0.27], [1, 0.18]], -0.42, 0.42, 0.27, crust), ...[-0.2, 0, 0.2].flatMap((x) => box([x - 0.03, -0.12, 0.51], [x + 0.03, 0.12, 0.54], crumb ?? crust))],
  wedge: ([cheese]) => [...disc([0, 0], 0.42, 0, 0.3, cheese, 3)],
  sheet: ([sheet]) => [0, 1, 2].flatMap((k) => box([-0.3 + k * 0.03, -0.3 + k * 0.03, k * 0.03], [0.3 + k * 0.03, 0.3 + k * 0.03, k * 0.03 + 0.025], sheet)),
  bundle: ([strand]) => [...[-0.12, -0.06, 0, 0.06, 0.12].flatMap((y, k) => box([-0.42, y - 0.02, (k % 2) * 0.04], [0.42, y + 0.02, (k % 2) * 0.04 + 0.04], strand)), ...box([-0.04, -0.17, 0], [0.04, 0.17, 0.1], '#c9a978')],
  jug: ([liquid, glass]) => [...lathe([[0, 0.22], [0.6, 0.24], [0.75, 0.16], [1, 0.12]], 0, 0.7, glass ?? liquid), ...disc([0, 0], 0.2, 0.05, 0.45, liquid, 32)],
  // ── prepped and cooked ──
  fillet: ([flesh, line]) => [...box([-0.4, -0.17, 0], [0.4, 0.17, 0.12], flesh), ...[-0.24, -0.08, 0.08, 0.24].flatMap((x) => box([x - 0.025, -0.16, 0.12], [x + 0.025, 0.16, 0.13], line ?? flesh))],
  mound: ([grain]) => [...lathe([[0, 0.37], [0.4, 0.33], [0.75, 0.2], [1, 0.03]], 0, 0.32, grain)],
  shreds: ([leaf, light]) => SPOTS.slice(0, 7).flatMap(([x, y], k) => box([x - 0.12, y - 0.05, (k % 3) * 0.05], [x + 0.12, y + 0.05, (k % 3) * 0.05 + 0.06], k % 2 ? light ?? leaf : leaf)),
  slices: ([rim, flesh]) => [0, 1, 2].flatMap((k) => [...disc([-0.24 + k * 0.24, (k - 1) * 0.04], 0.2, k * 0.02, k * 0.02 + 0.06, rim, 32), ...disc([-0.24 + k * 0.24, (k - 1) * 0.04], 0.16, k * 0.02 + 0.06, k * 0.02 + 0.065, flesh ?? rim, 32)]),
  sauce: ([sauce]) => [...disc([0, 0], 0.4, 0, 0.04, sauce, 32)],
  cubes: ([flesh]) => SPOTS.slice(0, 6).flatMap(([x, y], k) => box([x - 0.07, y - 0.07, (k % 2) * 0.08], [x + 0.07, y + 0.07, (k % 2) * 0.08 + 0.14], flesh)),
  rings: ([ring, inner]) => [0, 1, 2].flatMap((k) => [...disc([-0.22 + k * 0.22, 0], 0.18, k * 0.02, k * 0.02 + 0.05, ring, 32), ...disc([-0.22 + k * 0.22, 0], 0.11, k * 0.02 + 0.05, k * 0.02 + 0.055, inner ?? '#8a6a5a', 32)]),
  strips: ([meat]) => [-0.18, -0.06, 0.06, 0.18].flatMap((y, k) => box([-0.36, y - 0.04, (k % 2) * 0.04], [0.36, y + 0.04, (k % 2) * 0.04 + 0.07], meat)),
  cracked: ([white, yolk]) => [...disc([0, 0], 0.34, 0, 0.03, white, 9), ...lathe([[0, 0.12], [1, 0.02]], 0.03, 0.12, yolk)],
  fried: ([white, yolk]) => [...disc([0.02, -0.02], 0.38, 0, 0.03, white, 9, 0.32), ...lathe([[0, 0.13], [1, 0.02]], 0.03, 0.11, yolk)],
  nest: ([strand]) => [...lathe([[0, 0.38], [0.6, 0.3], [1, 0.12]], 0, 0.22, strand), ...[0, 1, 2].flatMap((k) => box([-0.25 + k * 0.2, -0.03, 0.18], [-0.1 + k * 0.2, 0.03, 0.24], strand))],
  // an egg boiled and halved: two halves, the white cut, the yolk in each
  halved: ([white, yolk]) => [-0.15, 0.15].flatMap((x) => [...lathe([[0, 0.2], [0.6, 0.18], [1, 0.03]], 0, 0.14, white, { at: [x, 0] }), ...disc([x, 0], 0.1, 0.13, 0.15, yolk, 24)]),
  // sticks: fries, a potato cut for the fryer: a fan of chamfered batons
  sticks: ([stick, tip]) => [-0.16, -0.08, 0, 0.08, 0.16, -0.12, 0.04, 0.12].flatMap((x, k) => box([x - 0.03, -0.3 + (k % 3) * 0.04, k > 4 ? 0.06 : 0], [x + 0.03, 0.3 - (k % 2) * 0.06, (k > 4 ? 0.06 : 0) + 0.06], k % 3 ? stick : tip ?? stick, 0.012)),
  // fries standing in their cup: batons upright, leaning a little each way, their tops above its rim
  upright: ([stick, tip]) => [[-0.1, -0.06], [0, -0.1], [0.1, -0.05], [-0.06, 0.04], [0.05, 0.05], [-0.12, 0.1], [0.11, 0.1], [0, 0.12], [-0.02, -0.01]].flatMap(([x, y], k) => box([x - 0.025, y - 0.025, 0], [x + 0.025, y + 0.025, 0.3 + (k % 3) * 0.04], k % 2 ? stick : tip ?? stick, 0.01)),
  // a sheet of dough rolled out flat: a round, its edge a little raised
  flat: ([dough, rim]) => [...disc([0, 0], 0.42, 0, 0.05, dough, 32), ...lathe([[0, 0.43], [0.5, 0.45], [1, 0.43]], 0.02, 0.08, rim ?? dough)],
  block: ([c, d]) => [...box([-0.3, -0.24, 0], [0.3, 0.24, 0.36], c), ...box([-0.26, -0.2, 0.36], [0.26, 0.2, 0.4], d ?? c)],
  burnt: () => [...lathe([[0, 0.2], [0.4, 0.34], [1, 0.08]], 0, 0.3, '#2a2522'), ...box([-0.06, -0.06, 0.28], [0.06, 0.06, 0.34], '#4a4440')],
};

// the vessels: { faces, top } (top: the height the content sits at)
export const VESSEL_FORMS = {
  plate: () => ({ faces: [...disc([0, 0], 0.5, 0, 0.025, VESSELS.plate.colours[1], 32), ...disc([0, 0], 0.48, 0.025, 0.045, VESSELS.plate.colours[0], 32)], top: 0.045 }),
  // a bowl: deep, its rim banded, its inside in shadow under what it holds
  bowl: () => ({ faces: [...lathe([[0, 0.2], [0.35, 0.33], [0.8, 0.41], [1, 0.43]], 0, 0.4, VESSELS.bowl.colours[0]), ...disc([0, 0], 0.435, 0.34, 0.37, VESSELS.bowl.colours[1], 32), ...disc([0, 0], 0.38, 0.37, 0.375, '#b9b2a6', 32)], top: 0.375 }),
  crate: () => ({ faces: [...box([-0.42, -0.32, 0], [0.42, 0.32, 0.32], VESSELS.crate.colours[0]), ...[0.08, 0.2].flatMap((z) => box([-0.43, -0.33, z], [0.43, -0.32, z + 0.05], VESSELS.crate.colours[1]))], top: 0.32 }),
  sack: () => ({ faces: FORMS.sack(VESSELS.sack.colours), top: 0.72 }),
  // a baking tray: a dark chamfered dish, its inside set down
  tray: () => ({ faces: [...box([-0.46, -0.32, 0], [0.46, 0.32, 0.16], VESSELS.tray.colours[0], 0.04), ...box([-0.4, -0.26, 0.15], [0.4, 0.26, 0.16], VESSELS.tray.colours[1], 0.005)], top: 0.08 }),
  // a paper cup, red with a white band: what comes out of a fryer
  cup: () => ({ faces: [...lathe([[0, 0.17], [1, 0.25]], 0, 0.42, VESSELS.cup.colours[0]), ...lathe([[0, 0.205], [1, 0.218]], 0.16, 0.24, VESSELS.cup.colours[1])], top: 0.3 }),
};

// ── the dishes: parts composed on their vessel (part: { form, colours, family, grain? }) ──
const colourOf = (p, k = 0) => p.colours[k] ?? p.colours[0];
const isGrain = (p) => p.family === 'grain' || p.family === 'bread';
const isNoodle = (p) => p.family === 'noodle' || p.ingredient === 'noodles';
const isSauce = (p) => p.form === 'sauce' || p.form === 'shreds';
const isEgg = (p) => p.family === 'egg';
const isMeat = (p) => p.family === 'meat' || p.family === 'fish';
const NORI = '#1f3a2a', RICE = '#fbfaf5';

export const ARRANGE = {
  // nigiri: a pressed block of the grain part, the topping's look laid over it; a pair side by side
  nigiri: (parts, top) => {
    const base = parts.find(isGrain), topping = parts.find((p) => !isGrain(p)) ?? parts[0];
    return [-0.19, 0.19].flatMap((y) => [
      ...box([-0.24, y - 0.12, top], [0.24, y + 0.12, top + 0.15], base ? colourOf(base) : RICE),
      ...box([-0.28, y - 0.14, top + 0.15], [0.28, y + 0.14, top + 0.21], colourOf(topping)),
      ...box([-0.1, y - 0.14, top + 0.21], [-0.06, y + 0.14, top + 0.215], colourOf(topping, 1)), ...box([0.06, y - 0.14, top + 0.21], [0.1, y + 0.14, top + 0.215], colourOf(topping, 1)),
    ]);
  },
  // a roll: three rings cut from it, the wrap round the grain round the fillings
  roll: (parts, top) => {
    const fill = parts.filter((p) => !isGrain(p)), base = parts.find(isGrain);
    return [-0.3, 0, 0.3].flatMap((x, k) => [
      ...disc([x, 0], 0.14, top, top + 0.16, NORI, 32), ...disc([x, 0], 0.115, top + 0.16, top + 0.165, base ? colourOf(base) : RICE, 32),
      ...disc([x, 0], 0.05, top + 0.165, top + 0.17, fill.length ? colourOf(fill[k % fill.length]) : '#e0452f', 32),
      ...(fill.length > 1 ? disc([x + 0.035, 0.03], 0.03, top + 0.165, top + 0.172, colourOf(fill[(k + 1) % fill.length]), 16) : []),
    ]);
  },
  // tossed in its bowl: the parts' pieces heaped
  heap: (parts, top) => [...SPOTS, ...SPOTS.map(([x, y]) => [y * 0.7, -x * 0.7])].flatMap(([x, y], k) => { const p = parts[k % parts.length], z = top + (0.12 - Math.hypot(x, y) * 0.35) + (k % 3) * 0.02; return box([x * 1.3 - 0.08, y * 1.3 - 0.05, z], [x * 1.3 + 0.08, y * 1.3 + 0.05, z + 0.05], colourOf(p, k % 2)); }),
  // a bowl of it: its broth the colour of its first part, its parts floating
  // its broth (the part that is a broth, a sauce, else the first), and over it: noodles in a nest, an egg halved, slices
  // fanned, the rest scattered
  soup: (parts, top) => {
    const broth = parts.find((p) => p.form === 'sauce' || p.dish === 'soup') ?? parts[0], over = parts.filter((p) => p !== broth);
    const out = [...disc([0, 0], 0.36, top, top + 0.025, colourOf(broth), 32)];
    top += 0.02;
    over.forEach((p, k) => {
      const a = (k / Math.max(1, over.length)) * 2 * Math.PI + 0.4, at = [0.17 * Math.cos(a), 0.17 * Math.sin(a)];
      if (isNoodle(p)) out.push(...lathe([[0, 0.22], [0.6, 0.18], [1, 0.06]], top - 0.01, top + 0.07, colourOf(p), { at: [0.03, 0.02] }), ...[0, 1, 2, 3].flatMap((q) => box([-0.18 + q * 0.1, -0.012, top + 0.06], [-0.1 + q * 0.1, 0.012, top + 0.08], colourOf(p), 0.006)));
      else if (isEgg(p)) out.push(...lift(FORMS.halved(p.colours), [at[0], at[1], top - 0.02], 0.55));
      else if (isMeat(p)) out.push(...[0, 1, 2].flatMap((q) => box([at[0] - 0.09 + q * 0.03, at[1] - 0.07 + q * 0.025, top + q * 0.012], [at[0] + 0.07 + q * 0.03, at[1] + 0.05 + q * 0.025, top + q * 0.012 + 0.025], colourOf(p, q % 2), 0.008)));
      else out.push(...SPOTS.slice(0, 4).flatMap(([x, y]) => box([at[0] + x * 0.4 - 0.035, at[1] + y * 0.4 - 0.035, top], [at[0] + x * 0.4 + 0.035, at[1] + y * 0.4 + 0.035, top + 0.035], colourOf(p), 0.01)));
    });
    return out;
  },
  // layered between bread: a bun, each part a layer, a domed bun
  stack: (parts, top) => {
    const bread = parts.find(isGrain), bun = bread ? colourOf(bread) : '#d39a55', fill = parts.filter((p) => p !== bread);
    let z = top + 0.1;
    const out = [...disc([0, 0], 0.3, top, z, bun, 32)];
    for (const p of fill) { out.push(...disc([0, 0], 0.33, z, z + 0.05, colourOf(p), 32)); z += 0.05; }
    return [...out, ...lathe([[0, 0.3], [0.6, 0.25], [1, 0.04]], z, z + 0.2, bun)];
  },
  // a round base, the parts over it
  // a round base, then each sauce or cheese a layer a little smaller, then the rest over it
  round: (parts, top) => {
    const base = parts.find(isGrain), layers = parts.filter((p) => p !== base && isSauce(p)), rest = parts.filter((p) => p !== base && !isSauce(p));
    let z = top + 0.06, r = 0.38;
    const out = [...disc([0, 0], 0.42, top, z, base ? colourOf(base, 1) : '#e3b06c', 32), ...lathe([[0, 0.43], [0.5, 0.45], [1, 0.42]], top + 0.02, top + 0.09, base ? colourOf(base) : '#e3b06c')];
    for (const p of layers) { out.push(...disc([0, 0], r, z, z + 0.02, colourOf(p), 32)); z += 0.02; r -= 0.04; }
    return [...out, ...SPOTS.slice(1).flatMap(([x, y], k) => disc([x * 1.5, y * 1.5], 0.055, z, z + 0.025, colourOf(rest[k % Math.max(1, rest.length)] ?? layers[0] ?? parts[0]), 24))];
  },
  // pasta: twirled in a nest, its sauce spooned over the top, what else there is dusted over that
  twirl: (parts, top) => {
    const pasta = parts.find(isNoodle) ?? parts[0], sauce = parts.find((p) => p !== pasta && p.form === 'sauce'), dust = parts.filter((p) => p !== pasta && p !== sauce);
    const out = [...lathe([[0, 0.34], [0.45, 0.3], [0.8, 0.18], [1, 0.05]], top, top + 0.2, colourOf(pasta)), ...[0, 1, 2, 3, 4].flatMap((q) => { const a = q * 1.26, r = 0.22; return box([r * Math.cos(a) - 0.1, r * Math.sin(a) - 0.013, top + 0.08 + q * 0.012], [r * Math.cos(a) + 0.1, r * Math.sin(a) + 0.013, top + 0.105 + q * 0.012], colourOf(pasta), 0.006); })];
    if (sauce) out.push(...lathe([[0, 0.2], [0.6, 0.14], [1, 0.03]], top + 0.15, top + 0.25, colourOf(sauce)));
    for (const p of dust) out.push(...SPOTS.slice(0, 6).map(([x, y]) => [x * 0.8, y * 0.8]).flatMap(([x, y], k) => box([x - 0.03, y - 0.015, top + 0.22 + (k % 2) * 0.02], [x + 0.03, y + 0.015, top + 0.235 + (k % 2) * 0.02], colourOf(p, k % 2), 0.006)));
    return out;
  },
  // tossed in a pan: a heap of its base, its parts mixed through and over it
  tossed: (parts, top) => {
    const base = parts.find((p) => p.base) ?? parts.find(isGrain) ?? parts.find(isNoodle) ?? parts[0], mixed = parts.filter((p) => p !== base);
    const h = (x, y) => 0.24 * Math.max(0, 1 - (x * x + y * y) / 0.16);
    const out = [...lathe([[0, 0.4], [0.35, 0.34], [0.75, 0.2], [1, 0.03]], top, top + 0.24, colourOf(base))];
    const spots = [...SPOTS, ...SPOTS.map(([x, y]) => [-y * 0.8, x * 0.8]), ...SPOTS.map(([x, y]) => [y * 1.4, -x * 1.2])];
    spots.forEach(([x, y], k) => { const p = mixed.length ? mixed[k % mixed.length] : base; const z = top + h(x, y) - 0.015; out.push(...box([x - 0.035, y - 0.035, z], [x + 0.035, y + 0.035, z + 0.04], colourOf(p, k % 2), 0.01)); });
    return out;
  },
  // layered in its tray: the base, the sauce, the top (what melts: a cheese, else the last part)
  bake: (parts, top) => {
    const base = parts.find(isNoodle) ?? parts.find(isGrain) ?? parts[0], topp = parts.find((p) => p.family === 'dairy') ?? parts[parts.length - 1], mid = parts.filter((p) => p !== base && p !== topp);
    let z = top;
    const out = [...box([-0.38, -0.24, z], [0.38, 0.24, z + 0.07], colourOf(base), 0.015)]; z += 0.07;
    for (const p of mid) { out.push(...box([-0.38, -0.24, z], [0.38, 0.24, z + 0.035], colourOf(p), 0.01)); z += 0.035; }
    out.push(...box([-0.38, -0.24, z], [0.38, 0.24, z + 0.04], colourOf(topp), 0.012));
    return out;
  },
  // a curry: its grain heaped on one side, its sauce pooled on the other with what is in it
  beside: (parts, top) => {
    const grain = parts.find(isGrain) ?? parts[0], sauce = parts.find((p) => p !== grain && p.form === 'sauce'), rest = parts.filter((p) => p !== grain && p !== sauce);
    return [...lathe([[0, 0.24], [0.5, 0.2], [1, 0.03]], top, top + 0.18, colourOf(grain), { at: [-0.18, 0] }),
      ...disc([0.17, 0], 0.26, top, top + 0.03, sauce ? colourOf(sauce) : colourOf(rest[0] ?? grain), 32),
      ...SPOTS.slice(0, 5).flatMap(([x, y], k) => box([0.17 + x - 0.04, y - 0.04, top + 0.03], [0.17 + x + 0.04, y + 0.04, top + 0.07], colourOf(rest[k % Math.max(1, rest.length)] ?? sauce ?? grain), 0.012))];
  },
  // a fold: a flatbread curved over its filling, the filling showing along the open side
  fold: (parts, top) => {
    const bread = parts.find(isGrain) ?? parts[0], fill = parts.filter((p) => p !== bread);
    return [-0.16, 0.16].flatMap((y) => [
      ...latheX([[0, 0.05], [0.15, 0.16], [0.85, 0.16], [1, 0.05]], -0.3, 0.3, top + 0.12, colourOf(bread), { y }),
      ...(fill.length ? fill : [bread]).flatMap((p, k) => box([-0.24 + k * 0.16, y - 0.05, top + 0.2], [-0.1 + k * 0.16, y + 0.05, top + 0.27], colourOf(p, k % 2), 0.012)),
    ]);
  },
  // dumplings: pleated parcels in a ring, their wrapper's colour, a crimp along each
  dumplings: (parts, top) => {
    const wrap = parts.find(isGrain) ?? parts[0];
    return [0, 1, 2, 3, 4].flatMap((k) => { const a = (k / 5) * 2 * Math.PI, at = [0.27 * Math.cos(a), 0.27 * Math.sin(a)];
      return [...lathe([[0, 0.12], [0.5, 0.11], [1, 0.02]], top, top + 0.13, colourOf(wrap), { at }), ...box([at[0] - 0.09, at[1] - 0.012, top + 0.08], [at[0] + 0.09, at[1] + 0.012, top + 0.14], colourOf(wrap, 1), 0.006)]; });
  },
  // skewers: its parts threaded on sticks, two side by side
  skewer: (parts, top) => [-0.14, 0.14].flatMap((y) => [
    ...box([-0.46, y - 0.012, top + 0.07], [0.46, y + 0.012, top + 0.095], '#c9a978', 0.006),
    ...[-0.27, -0.09, 0.09, 0.27].flatMap((x, k) => box([x - 0.075, y - 0.075, top + 0.02], [x + 0.075, y + 0.075, top + 0.15], colourOf(parts[k % parts.length], k % 2), 0.025)),
  ]),
  // side by side on a plate: each part's own look, smaller, round the middle
  plate: (parts, top, look) => parts.flatMap((p, k) => {
    const a = (k / parts.length) * 2 * Math.PI, r = parts.length > 1 ? 0.2 : 0;
    return lift(look(p), [r * Math.cos(a), r * Math.sin(a), top], parts.length > 1 ? 0.45 : 0.7);
  }),
};

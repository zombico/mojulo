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
import { box as boxInto, prism as prismInto, face } from '../gameroom/dress.js';
import { VESSELS } from './roster.js';

const G = 'food';
const lathe = (prof, z0, z1, fill, { at = [0, 0], n = 10, s = 14 } = {}) => latheToFaces({ axisFrom: { x: at[0], y: at[1], z: z0 }, axisTo: { x: at[0], y: at[1], z: z1 }, profile: prof.map(([t, radius]) => ({ t, radius })), crossSections: n, samples: s }, { tint: fill });
// a lathe lying along x (a fish, a carrot, a loaf), its axis at height z
const latheX = (prof, x0, x1, z, fill, { y = 0, n = 12, s = 12 } = {}) => latheToFaces({ axisFrom: { x: x0, y, z }, axisTo: { x: x1, y, z }, profile: prof.map(([t, radius]) => ({ t, radius })), crossSections: n, samples: s }, { tint: fill });
const box = (mn, mx, fill) => { const o = []; boxInto(o, mn, mx, fill, G); return o; };
const disc = (c, r, z0, z1, fill, sides = 18, ry = r) => { const o = []; prismInto(o, c, r, ry, z0, z1, sides, fill, G); return o; };
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
    ...disc([-0.33, -0.11], 0.035, 0.24, 0.29, '#1d2328', 8), ...disc([-0.33, 0.11], 0.035, 0.24, 0.29, '#1d2328', 8),
  ],
  // a sack: full in the belly, cinched at the neck under a tie, its mouth flared above it
  sack: ([cloth, tie]) => [...lathe([[0, 0.28], [0.15, 0.34], [0.5, 0.33], [0.7, 0.22], [0.8, 0.09], [0.86, 0.08], [0.93, 0.14], [1, 0.1]], 0, 0.8, cloth), ...disc([0, 0], 0.105, 0.63, 0.68, tie, 10)],
  sheaf: ([grain, stalk]) => [
    ...[-0.1, -0.03, 0.04, 0.1].flatMap((x, k) => box([x - 0.02, -0.02 + (k % 2) * 0.03, 0], [x + 0.02, 0.02 + (k % 2) * 0.03, 0.55], stalk)),
    ...lathe([[0, 0.1], [0.5, 0.2], [1, 0.05]], 0.5, 0.85, grain), ...disc([0, 0], 0.15, 0.24, 0.29, stalk, 10),
  ],
  head: ([outer, inner]) => [...lathe([[0, 0.14], [0.3, 0.4], [0.65, 0.38], [1, 0.06]], 0, 0.6, outer), ...lathe([[0, 0.2], [0.6, 0.18], [1, 0.03]], 0.42, 0.66, inner, { s: 10 })],
  fruit: ([skin, leaf]) => [...lathe([[0, 0.08], [0.25, 0.34], [0.6, 0.38], [0.9, 0.24], [1, 0.08]], 0, 0.6, skin), ...disc([0, 0], 0.13, 0.58, 0.61, leaf, 5), ...disc([0, 0], 0.025, 0.58, 0.72, leaf, 6)],
  carrot: ([root, top]) => [...latheX([[0, 0.02], [0.8, 0.15], [1, 0.12]], 0.4, -0.3, 0.16, root), ...box([-0.42, -0.03, 0.1], [-0.3, 0.03, 0.42], top), ...box([-0.4, -0.1, 0.1], [-0.32, -0.05, 0.36], top)],
  lump: ([skin]) => [...lathe([[0, 0.18], [0.3, 0.36], [0.7, 0.32], [1, 0.12]], 0, 0.4, skin)],
  bulb: ([skin]) => [...lathe([[0, 0.12], [0.35, 0.36], [0.7, 0.3], [0.95, 0.06], [1, 0.02]], 0, 0.68, skin)],
  mushroom: ([cap, stem]) => [...disc([0, 0], 0.1, 0, 0.28, stem, 10), ...lathe([[0, 0.36], [0.5, 0.3], [1, 0.04]], 0.24, 0.5, cap)],
  slab: ([meat, fat]) => [...box([-0.4, -0.27, 0], [0.4, 0.27, 0.15], meat), ...box([-0.4, 0.2, 0.15], [0.4, 0.27, 0.165], fat ?? meat)],
  egg: ([shell]) => [...lathe([[0, 0.05], [0.25, 0.27], [0.55, 0.3], [0.85, 0.22], [1, 0.04]], 0, 0.62, shell)],
  loaf: ([crust, crumb]) => [...latheX([[0, 0.18], [0.12, 0.27], [0.88, 0.27], [1, 0.18]], -0.42, 0.42, 0.2, crust), ...[-0.2, 0, 0.2].flatMap((x) => box([x - 0.03, -0.12, 0.44], [x + 0.03, 0.12, 0.47], crumb ?? crust))],
  wedge: ([cheese]) => [...disc([0, 0], 0.42, 0, 0.3, cheese, 3)],
  sheet: ([sheet]) => [0, 1, 2].flatMap((k) => box([-0.3 + k * 0.03, -0.3 + k * 0.03, k * 0.03], [0.3 + k * 0.03, 0.3 + k * 0.03, k * 0.03 + 0.025], sheet)),
  bundle: ([strand]) => [...[-0.12, -0.06, 0, 0.06, 0.12].flatMap((y, k) => box([-0.42, y - 0.02, (k % 2) * 0.04], [0.42, y + 0.02, (k % 2) * 0.04 + 0.04], strand)), ...box([-0.04, -0.17, 0], [0.04, 0.17, 0.1], '#c9a978')],
  jug: ([liquid, glass]) => [...lathe([[0, 0.22], [0.6, 0.24], [0.75, 0.16], [1, 0.12]], 0, 0.7, glass ?? liquid), ...disc([0, 0], 0.2, 0.05, 0.45, liquid, 14)],
  // ── prepped and cooked ──
  fillet: ([flesh, line]) => [...box([-0.4, -0.17, 0], [0.4, 0.17, 0.12], flesh), ...[-0.24, -0.08, 0.08, 0.24].flatMap((x) => box([x - 0.025, -0.16, 0.12], [x + 0.025, 0.16, 0.13], line ?? flesh))],
  mound: ([grain]) => [...lathe([[0, 0.37], [0.4, 0.33], [0.75, 0.2], [1, 0.03]], 0, 0.32, grain)],
  shreds: ([leaf, light]) => SPOTS.slice(0, 7).flatMap(([x, y], k) => box([x - 0.12, y - 0.05, (k % 3) * 0.05], [x + 0.12, y + 0.05, (k % 3) * 0.05 + 0.06], k % 2 ? light ?? leaf : leaf)),
  slices: ([rim, flesh]) => [0, 1, 2].flatMap((k) => [...disc([-0.24 + k * 0.24, (k - 1) * 0.04], 0.2, k * 0.02, k * 0.02 + 0.06, rim, 16), ...disc([-0.24 + k * 0.24, (k - 1) * 0.04], 0.16, k * 0.02 + 0.06, k * 0.02 + 0.065, flesh ?? rim, 16)]),
  sauce: ([sauce]) => [...disc([0, 0], 0.4, 0, 0.04, sauce, 18)],
  cubes: ([flesh]) => SPOTS.slice(0, 6).flatMap(([x, y], k) => box([x - 0.07, y - 0.07, (k % 2) * 0.08], [x + 0.07, y + 0.07, (k % 2) * 0.08 + 0.14], flesh)),
  rings: ([ring, inner]) => [0, 1, 2].flatMap((k) => [...disc([-0.22 + k * 0.22, 0], 0.18, k * 0.02, k * 0.02 + 0.05, ring, 14), ...disc([-0.22 + k * 0.22, 0], 0.11, k * 0.02 + 0.05, k * 0.02 + 0.055, inner ?? '#8a6a5a', 12)]),
  strips: ([meat]) => [-0.18, -0.06, 0.06, 0.18].flatMap((y, k) => box([-0.36, y - 0.04, (k % 2) * 0.04], [0.36, y + 0.04, (k % 2) * 0.04 + 0.07], meat)),
  cracked: ([white, yolk]) => [...disc([0, 0], 0.34, 0, 0.03, white, 9), ...lathe([[0, 0.12], [1, 0.02]], 0.03, 0.12, yolk)],
  fried: ([white, yolk]) => [...disc([0.02, -0.02], 0.38, 0, 0.03, white, 9, 0.32), ...lathe([[0, 0.13], [1, 0.02]], 0.03, 0.11, yolk)],
  nest: ([strand]) => [...lathe([[0, 0.38], [0.6, 0.3], [1, 0.12]], 0, 0.22, strand), ...[0, 1, 2].flatMap((k) => box([-0.25 + k * 0.2, -0.03, 0.18], [-0.1 + k * 0.2, 0.03, 0.24], strand))],
  burnt: () => [...lathe([[0, 0.2], [0.4, 0.34], [1, 0.08]], 0, 0.3, '#2a2522'), ...box([-0.06, -0.06, 0.28], [0.06, 0.06, 0.34], '#4a4440')],
};
// a generic thing a word no row names: a rounded block in its colour
FORMS.block = ([c, d]) => [...box([-0.3, -0.24, 0], [0.3, 0.24, 0.36], c), ...box([-0.26, -0.2, 0.36], [0.26, 0.2, 0.4], d ?? c)];

// the vessels: { faces, top } (top: the height the content sits at)
export const VESSEL_FORMS = {
  plate: () => ({ faces: [...disc([0, 0], 0.5, 0, 0.025, VESSELS.plate.colours[1], 22), ...disc([0, 0], 0.48, 0.025, 0.045, VESSELS.plate.colours[0], 22)], top: 0.045 }),
  // a bowl: deep, its rim banded, its inside in shadow under what it holds
  bowl: () => ({ faces: [...lathe([[0, 0.2], [0.35, 0.33], [0.8, 0.41], [1, 0.43]], 0, 0.4, VESSELS.bowl.colours[0], { s: 18 }), ...disc([0, 0], 0.435, 0.34, 0.37, VESSELS.bowl.colours[1], 18), ...disc([0, 0], 0.38, 0.37, 0.375, '#b9b2a6', 18)], top: 0.36 }),
  crate: () => ({ faces: [...box([-0.42, -0.32, 0], [0.42, 0.32, 0.32], VESSELS.crate.colours[0]), ...[0.08, 0.2].flatMap((z) => box([-0.43, -0.33, z], [0.43, -0.32, z + 0.05], VESSELS.crate.colours[1]))], top: 0.32 }),
  sack: () => ({ faces: FORMS.sack(VESSELS.sack.colours), top: 0.72 }),
};

// ── the dishes: parts composed on their vessel (part: { form, colours, family, grain? }) ──
const colourOf = (p, k = 0) => p.colours[k] ?? p.colours[0];
const isGrain = (p) => p.family === 'grain' || p.family === 'bread';
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
      ...disc([x, 0], 0.14, top, top + 0.16, NORI, 16), ...disc([x, 0], 0.115, top + 0.16, top + 0.165, base ? colourOf(base) : RICE, 16),
      ...disc([x, 0], 0.05, top + 0.165, top + 0.17, fill.length ? colourOf(fill[k % fill.length]) : '#e0452f', 10),
      ...(fill.length > 1 ? disc([x + 0.035, 0.03], 0.03, top + 0.165, top + 0.172, colourOf(fill[(k + 1) % fill.length]), 8) : []),
    ]);
  },
  // tossed in its bowl: the parts' pieces heaped
  heap: (parts, top) => [...SPOTS, ...SPOTS.map(([x, y]) => [y * 0.7, -x * 0.7])].flatMap(([x, y], k) => { const p = parts[k % parts.length], z = top + (0.12 - Math.hypot(x, y) * 0.35) + (k % 3) * 0.02; return box([x * 1.3 - 0.08, y * 1.3 - 0.05, z], [x * 1.3 + 0.08, y * 1.3 + 0.05, z + 0.05], colourOf(p, k % 2)); }),
  // a bowl of it: its broth the colour of its first part, its parts floating
  soup: (parts, top) => [...disc([0, 0], 0.4, top - 0.03, top, colourOf(parts[0]), 18), ...SPOTS.slice(1, 6).flatMap(([x, y], k) => box([x * 1.3 - 0.05, y * 1.3 - 0.05, top], [x * 1.3 + 0.05, y * 1.3 + 0.05, top + 0.04], colourOf(parts[(k + 1) % parts.length], 1)))],
  // layered between bread: a bun, each part a layer, a domed bun
  stack: (parts, top) => {
    const bread = parts.find(isGrain), bun = bread ? colourOf(bread) : '#d39a55', fill = parts.filter((p) => p !== bread);
    let z = top + 0.1;
    const out = [...disc([0, 0], 0.3, top, z, bun, 18)];
    for (const p of fill) { out.push(...disc([0, 0], 0.33, z, z + 0.05, colourOf(p), 18)); z += 0.05; }
    return [...out, ...lathe([[0, 0.3], [0.6, 0.25], [1, 0.04]], z, z + 0.2, bun)];
  },
  // a round base, the parts over it
  round: (parts, top) => {
    const base = parts.find(isGrain), rest = parts.filter((p) => p !== base);
    return [...disc([0, 0], 0.42, top, top + 0.06, base ? colourOf(base) : '#e3b06c', 20), ...SPOTS.slice(1).flatMap(([x, y], k) => disc([x * 1.5, y * 1.5], 0.06, top + 0.06, top + 0.08, colourOf(rest[k % Math.max(1, rest.length)] ?? parts[0]), 10))];
  },
  // side by side on a plate: each part's own look, smaller, round the middle
  plate: (parts, top, look) => parts.flatMap((p, k) => {
    const a = (k / parts.length) * 2 * Math.PI, r = parts.length > 1 ? 0.2 : 0;
    return lift(look(p), [r * Math.cos(a), r * Math.sin(a), top], parts.length > 1 ? 0.45 : 0.7);
  }),
};

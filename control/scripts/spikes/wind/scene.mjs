// A small seeded field for the wind spike: grass tufts of the production kinds (their heights, bending numbers,
// splay and colours come from vegetation/grass GRASSES), three saplings with branches and leaves, a fence of rigid
// posts with a ribbon on one, and loose debris. Every element names its category so a preview can tune φ per category.
import { GRASSES } from '../../../lib/graph/vegetation/grass.js';
import { mulberry32 } from '../../../lib/graph/vegetation/grow.js';

export const DOMAIN = Object.freeze({ x0: -12, y0: -8, W: 24, H: 16 });
// Drag per unit own weight, per (m/s)²: ½ ρ_air C_d / (ρ_tissue g t). Estimates, not measurements:
//   grass blade (t ≈ 0.3 mm, ρ ≈ 700): ≈ 0.35 · culm with a head: less · woody twig in leaf: ≈ 0.05–0.1 (the leaves
//   carry the area) · a leaf on its petiole: ≈ 1.2 · a cloth ribbon: ≈ 2.5 · a timber post: ≈ 0.01.
export const SAIL = Object.freeze({ blade: 0.35, culm: 0.2, trunk: 0.04, branch: 0.08, leaf: 1.2, ribbon: 2.5, post: 0.01 });
// Vogel exponents: drag ∝ u^(2+V). Rigid bodies 0; flexible ones streamline as they bend. Literature ranges, rounded:
// grass blades and leaves −0.7 to −1.2 (Vogel 1989; Gosselin & de Langre 2011), a flag near 0 (it flaps, not folds).
export const VOGEL = Object.freeze({ grass: -0.9, trunk: 0, branch: -0.4, leaf: -0.8, ribbon: 0 });
// The flaccidity each category is born with. Everything that existed before wind is 0.
export const PHI = Object.freeze({ grass: 1, branch: 1, leaf: 1, ribbon: 1, debris: 1, rigid: 0 });

const DEG = Math.PI / 180, HALF = Math.PI / 2;
const dirOf = (elev, az) => [Math.cos(elev) * Math.cos(az), Math.cos(elev) * Math.sin(az), Math.sin(elev)];

export function buildScene({ seed = 7, tufts = 340, dust = 220, leaves = 110, twigs = 36 } = {}) {
  const rnd = mulberry32(seed), r = (a, b) => a + (b - a) * rnd(), { x0, y0, W, H } = DOMAIN;
  const stations = [], elements = [], particles = [];
  const station = (pos, B, L, zeta = 0.12, vogel = 0) => (stations.push({ pos, B, L, zeta, vogel }), stations.length - 1);
  const push = (e) => (elements.push({ phi: PHI[e.cat], ...e }), elements.length - 1);

  // grass: bands across the field, so the eye can compare kinds side by side
  const bandKinds = [['lawn', 'fescue'], ['fescue', 'needlegrass'], ['meadow', 'meadow', 'sedge'], ['tussock', 'fountain'], ['meadow', 'pampas']];
  for (let i = 0; i < tufts; i++) {
    const x = r(x0 + 0.3, x0 + W - 0.3), y = r(y0 + 0.3, y0 + H - 0.3);
    if (Math.hypot(x - 3, y + 1.5) < 2.2 || Math.abs(y - 4.5) < 0.25) continue;     // a clearing for debris, and the fence line
    const band = bandKinds[Math.min(bandKinds.length - 1, Math.floor(((x - x0) / W) * bandKinds.length))];
    const kindName = band[Math.floor(rnd() * band.length)], kind = GRASSES[kindName];
    const h = r(kind.heights[0], kind.heights[1]), Bmid = (kind.B[0] + kind.B[1]) / 2;
    const st = station([x, y, 0.5 * h], Bmid, h, 0.12, VOGEL.grass);
    for (let b = 0; b < 5; b++) {
      const L = h * r(0.7, 1.05), splay = r(kind.splay[0], kind.splay[1]) * DEG;
      push({ cat: 'grass', part: 'blade', kind: kindName, station: st, base: [x, y, 0], dir: dirOf(HALF - splay, r(0, 2 * Math.PI)),
        L, B: r(kind.B[0], kind.B[1]), sail: SAIL.blade, colors: kind.colors, width: kind.w });
    }
    if (kind.head) {
      const L = h * kind.culmH;
      push({ cat: 'grass', part: 'culm', kind: kindName, station: st, base: [x, y, 0], dir: dirOf(HALF - r(2, 14) * DEG, r(0, 2 * Math.PI)),
        L, B: 0.8, sail: SAIL.culm, colors: kind.colors, head: kind.head, headLen: kind.headLen, width: 0.002 });
    }
  }

  // saplings: a trunk, branches along its upper half, leaves along each branch
  for (const [sx, sy, sh] of [[-6.5, 1.5, 1.7], [1.5, 4.0, 2.1], [8, -3.5, 1.5]]) {
    const lean = r(-4, 4) * DEG;
    const trunk = push({ cat: 'branch', part: 'trunk', station: station([sx, sy, sh / 2], 0.35, sh, 0.08, VOGEL.trunk), base: [sx, sy, 0],
      dir: dirOf(HALF - Math.abs(lean), lean > 0 ? 0 : Math.PI), L: sh, B: 0.35, sail: SAIL.trunk, width: 0.03 });
    for (let b = 0; b < 6; b++) {
      const at = 0.45 + 0.5 * (b / 5), az = b * 2.4 + r(-0.3, 0.3), elev = r(15, 45) * DEG, L = sh * r(0.28, 0.4);
      const bx = sx + Math.cos(az) * L * 0.5, by = sy + Math.sin(az) * L * 0.5, bz = at * sh;
      const branch = push({ cat: 'branch', part: 'branch', station: station([bx, by, bz], 0.6, L, 0.1, VOGEL.branch), parent: trunk, at,
        base: [sx, sy, at * sh], dir: dirOf(elev, az), L, B: 0.6, sail: SAIL.branch, width: 0.012 });
      for (let l = 0; l < 8; l++) {
        const la = 0.25 + 0.75 * (l / 7), side = l % 2 ? 1 : -1;
        const lx = sx + Math.cos(az) * L * la, ly = sy + Math.sin(az) * L * la;
        push({ cat: 'leaf', part: 'leaf', station: station([lx, ly, bz + 0.1], 2.0, 0.09, 0.15, VOGEL.leaf), parent: branch, at: la,
          base: [lx, ly, bz], dir: dirOf(r(10, 50) * DEG, az + side * r(0.6, 1.2)), L: 0.09, B: 2.0, sail: SAIL.leaf,
          flutter: r(0.5, 0.9), flutterHz: r(4, 7), phase: r(0, 2 * Math.PI), leafLen: r(0.1, 0.14) });
      }
    }
  }

  // a fence of posts (rigid: φ = 0, the state of everything before wind) and a ribbon tied to the first
  let firstPost = -1;
  for (let i = 0; i < 7; i++) {
    const px = -9 + i * 3, idx = push({ cat: 'rigid', part: 'post', station: station([px, 4.5, 0.55], 0.001, 1.1), base: [px, 4.5, 0],
      dir: [0, 0, 1], L: 1.1, B: 0.001, sail: SAIL.post, width: 0.08 });
    if (firstPost < 0) firstPost = idx;
  }
  push({ cat: 'ribbon', part: 'ribbon', station: station([-8.7, 4.5, 1.0], 25, 0.7, 0.2, VOGEL.ribbon), parent: firstPost, at: 0.95,
    base: [-9, 4.5, 1.05], dir: [0.98, 0, -0.2], L: 0.7, B: 25, sail: SAIL.ribbon, width: 0.04 });

  // loose debris on the ground: dust and leaves everywhere, twigs in the clearing
  for (let i = 0; i < dust; i++) particles.push({ kind: 'dust', x: r(x0, x0 + W), y: r(y0, y0 + H), phi: PHI.debris });
  for (let i = 0; i < leaves; i++) particles.push({ kind: 'leaf', x: r(x0, x0 + W), y: r(y0, y0 + H), phi: PHI.debris });
  for (let i = 0; i < twigs; i++) { const a = r(0, 2 * Math.PI), d = 2 * Math.sqrt(rnd()); particles.push({ kind: 'twig', x: 3 + d * Math.cos(a), y: -1.5 + d * Math.sin(a), phi: PHI.debris }); }

  return { domain: DOMAIN, stations, elements, particles };
}

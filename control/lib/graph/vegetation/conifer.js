// vegetation/conifer — the excurrent conifers (spruce, silver fir, Scots pine), grown by rule rather than by light
// competition. The self-organizing engine (grow.js) boom-busts on a dense crown of long-lived needles: its mid-crown
// whorls grow and are shed within three years, whatever the shadow weight. Palms and bamboo have their own growers for
// the same reason; this is the conifers'.
//
// One rule per thing a person sees:
//   · the leader grows g(t) a year, ramping up, and for an old fir or pine slowing with age;
//   · each year a whorl of k branches at the top of the year's shoot, and `inter` smaller interwhorl branches below it;
//   · a branch extends ratio · g0 · exp(−depth / shadeDepth) a year, so its length is the leader's height gain since it
//     formed times the ratio: a cone. When the leader slows, the top whorls keep widening and the top flattens, and an
//     old fir's top laterals turn up (Edelin 1981, for Abies);
//   · the live crown is the top `crown` of the height (shade tolerance); a closed stand cuts it to `crownStand`;
//   · a branch leaves at its set-point, which droops with depth (spruce: upper ascending, lower drooping), sags along
//     its length, and its current-year tip turns up (Edelin, for Picea);
//   · order 2 along a branch: two-ranked sprays (fir), pendant combs low in the crown (spruce), or, for a pine, a whorl
//     of shoots at every year node that whorls again, shed after `twigKeep` years (Rauh's short-shoot pine: a bare limb
//     with the needle mass in clumps at its end);
//   · needles are kept `leafLife` years, so a shoot is clothed back as far as its needles live;
//   · radii by the pipe model (area ∝ the needles distal to a point), normalized so the trunk's diameter is H / slender.
// Returns a plant the mesh and ladder take: { nodes, axes, arch, params, children, exposure, spec, H }.
// Deterministic: mulberry32 dice from the seed.
import { mulberry32 } from './grow.js';
import * as dmath from '../../util/dmath.js';

const DEG = Math.PI / 180;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => dmath.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const smooth = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

/**
 * The conifers, as rules. Heights and crowns from the European Atlas of Forest Tree Species (2016); architecture and
 * the flat top from Edelin (1981); needle retention from Reich et al. (1996). The crown width over height is tuned (no
 * source gives it): spruce about 0.2, fir 0.3.
 */
export const CONIFERS = Object.freeze({
  spruce: {
    label: 'Norway spruce (Picea abies)', years: 40, g0: 0.5, ramp: 5, slowAfter: null, whorl: 5, inter: 2, interScale: 0.45,
    ratio: 0.2, shadeDepth: 14, crown: 0.95, crownStand: 0.6,
    angle: [55, 100], droop: 18, upturn: 30, twig: 'comb', twigRate: 0.09, twigMax: 0.9, twigAngle: 62,
    leafLife: 7, leafSize: 0.05, leavesPerNode: 3, slender: 55, jitter: 0.12,
  },
  silverfir: {
    label: 'silver fir (Abies alba)', years: 45, g0: 0.45, ramp: 6, slowAfter: 34, slowRate: 0.12, whorl: 5, inter: 1, interScale: 0.4,
    ratio: 0.24, shadeDepth: 18, crown: 0.9, crownStand: 0.65,
    angle: [72, 90], droop: 6, upturn: 12, twig: 'spray', twigRate: 0.1, twigMax: 1.0, twigAngle: 58, topUpright: 0.12,
    leafLife: 8, leafSize: 0.05, leavesPerNode: 3, slender: 50, jitter: 0.1,
  },
  pine: {
    label: 'Scots pine (Pinus sylvestris)', years: 50, g0: 0.55, ramp: 4, slowAfter: 26, slowRate: 0.09, whorl: 4, inter: 0, interScale: 0,
    ratio: 0.42, shadeDepth: 30, crown: 0.5, crownStand: 0.36,
    angle: [42, 78], droop: 12, upturn: 28, twig: 'whorl', twigRate: 0.16, twigMax: 1.4, twigAngle: 38, twigKeep: 7, twigWhorl: 3,
    leafLife: 3, leafSize: 0.06, leavesPerNode: 4, slender: 45, jitter: 0.6, lose: 0.4, topUpright: 0.1, limbMin: 0.022,
  },
});

/** Grow a conifer. `stand` 0..1 blends the live crown from open-grown to a closed stand's. */
export function growConifer(specIn, { seed = 1, years = null, stand = 0 } = {}) {
  const S = typeof specIn === 'string' ? CONIFERS[specIn] : specIn;
  if (!S) throw new Error(`growConifer: unknown conifer '${specIn}' (have ${Object.keys(CONIFERS).join(', ')})`);
  const A = years ?? S.years; const rng = mulberry32((seed * 2654435761) >>> 0);
  const nodes = [], axes = [], children = new Map();
  const addNode = (n) => { n.id = nodes.length; nodes.push(n); if (n.parent >= 0) { if (!children.has(n.parent)) children.set(n.parent, []); children.get(n.parent).push(n.id); } return n; };
  // the leader's yearly growth, and its height at the end of year y (h[0] = 0)
  const g = (t) => S.g0 * Math.min(1, (t + 1) / S.ramp) * (S.slowAfter && t > S.slowAfter ? dmath.exp(-(t - S.slowAfter) * S.slowRate) : 1);
  const h = [0]; for (let t = 1; t <= A; t++) h.push(h[t - 1] + g(t));
  const H = h[A]; const crownDepth = (S.crown + (S.crownStand - S.crown) * stand) * H;

  // the trunk: three internodes a year, the whorl at the top of each year's shoot
  axes.push({ id: 0, order: 0 });
  addNode({ parent: -1, axis: 0, order: 0, born: 0, pos: [0, 0, 0], dir: [0, 0, 1], len: 0, leaves: 0 });
  let top = 0; const lean = [(rng() - 0.5) * 0.02, (rng() - 0.5) * 0.02];
  const trunkAt = [];
  for (let t = 1; t <= A; t++) {
    trunkAt[t] = [];
    for (let i = 1; i <= 3; i++) {
      const z = h[t - 1] + (g(t) * i) / 3; const p = nodes[top].pos;
      const pos = [lean[0] * z + (rng() - 0.5) * 0.01, lean[1] * z + (rng() - 0.5) * 0.01, z]; const d = [pos[0] - p[0], pos[1] - p[1], pos[2] - p[2]];
      const n = addNode({ parent: top, axis: 0, order: 0, born: t, pos, dir: unit(d), len: len(d), leaves: 0 });
      trunkAt[t].push(n); top = n.id;
    }
  }
  // needles on the leader's youngest years (a leader is clothed like a shoot)
  for (const n of nodes) if (n.order === 0 && n.born > 0 && A - n.born < S.leafLife) n.leaves = S.leavesPerNode;

  const phase0 = rng() * 360;
  // order 2 (and a pine's order 3) off a branch's year node
  const twigs = (at, u, d, hor, f) => {
    const age = A - u; if (age < 1) return;
    const side = unit(cross([0, 0, 1], hor)); const Lt = Math.min(S.twigMax, S.twigRate * age) * (1 - 0.4 * f) * (0.7 + 0.6 * rng());
    const dirs = [];
    if (S.twig === 'spray') for (const sg of [-1, 1]) dirs.push(unit(add(mul(d, dmath.cos(S.twigAngle * DEG)), mul(side, sg * dmath.sin(S.twigAngle * DEG)))));
    else if (S.twig === 'comb') {
      // two-ranked, and low in the crown hanging: the comb spruce's curtains
      const depth = (h[A] - at.pos[2]) / h[A]; const hang = smooth((depth - 0.25) / 0.35);
      for (const sg of [-1, 1]) dirs.push(unit(add(add(mul(d, dmath.cos(S.twigAngle * DEG) * (1 - 0.6 * hang)), mul(side, sg * dmath.sin(S.twigAngle * DEG) * (1 - 0.5 * hang))), [0, 0, -1.3 * hang])));
    } else if (S.twig === 'whorl') {
      if (age > S.twigKeep) return;                                           // older laterals are shed: the limb is bare inside
      const w1 = unit(cross(d, side));
      for (let q = 0; q < S.twigWhorl; q++) { const ph = (u * 97 + (q * 360) / S.twigWhorl) * DEG; dirs.push(unit(add(add(mul(d, dmath.cos(S.twigAngle * DEG)), mul(side, dmath.cos(ph) * dmath.sin(S.twigAngle * DEG))), mul(w1, dmath.sin(ph) * dmath.sin(S.twigAngle * DEG) + 0.25)))); }
    }
    for (let td of dirs) {
      td = unit(add(td, [(rng() - 0.5) * 0.35, (rng() - 0.5) * 0.35, (rng() - 0.5) * 0.3]));   // no two twigs alike
      const axis = axes.length; axes.push({ id: axis, order: 2 }); let prev = at.id; const n = Math.max(1, Math.min(age, 3)); const step = Lt / n;
      for (let k = 0; k < n; k++) {
        const born = u + Math.round(((k + 1) * age) / n);
        const nn = addNode({ parent: prev, axis, order: 2, born, pos: add(nodes[prev].pos, mul(td, step)), dir: td, len: step, leaves: A - born < S.leafLife ? S.leavesPerNode : 0 });
        prev = nn.id;
        if (S.twig === 'whorl' && k < n - 1) for (let q = 0; q < 2; q++) {       // the shoot whorls again: the candelabra at a limb's end
          const ph = (born * 131 + q * 180) * DEG; const a1 = unit(cross(td, [0, 0, 1])); const dd = unit(add(add(mul(td, 0.75), mul(a1, 0.6 * dmath.cos(ph))), [0, 0, 0.35 + 0.3 * dmath.sin(ph)]));
          const ax3 = axes.length; axes.push({ id: ax3, order: 3 }); const l3 = Math.min(0.5, 0.5 * S.twigRate * (A - born + 1));
          addNode({ parent: nn.id, axis: ax3, order: 3, born: born + 1, pos: add(nn.pos, mul(dd, l3)), dir: dd, len: l3, leaves: A - born - 1 < S.leafLife ? S.leavesPerNode : 0 });
        }
      }
    }
  };
  // a branch born in year t at `base`: one node per year of its growth
  const branch = (base, t, az, scale, elevFromVert) => {
    const axis = axes.length; axes.push({ id: axis, order: 1 });
    if (A - t < 1) return;
    const hor = [dmath.cos(az * DEG), dmath.sin(az * DEG), 0];
    const inc = []; for (let u = t + 1; u <= A; u++) inc.push(scale * S.ratio * S.g0 * dmath.exp(-(h[u] - h[t]) / S.shadeDepth) * (1 + (rng() - 0.5) * S.jitter));
    const L = inc.reduce((a, b) => a + b, 0); let prev = base.id, s = 0;
    for (let k = 0; k < inc.length; k++) {
      const u = t + 1 + k; s += inc[k]; const f = s / L;
      // the angle from vertical along the branch: the set-point, sagging toward the tip, the newest year turned up
      const th = (elevFromVert + S.droop * f * f * Math.min(1.6, L / 2.5) - (k >= inc.length - 1 ? S.upturn : 0)) * DEG;
      const d = unit(add(mul([0, 0, 1], dmath.cos(th)), mul(hor, dmath.sin(th))));
      const n = addNode({ parent: prev, axis, order: 1, born: u, pos: add(nodes[prev].pos, mul(d, inc[k])), dir: d, len: inc[k], leaves: A - u < S.leafLife ? S.leavesPerNode : 0 });
      prev = n.id;
      if (k < inc.length - 1) twigs(n, u, d, hor, f);
    }
  };
  for (let t = 1; t < A; t++) {
    const depth = H - h[t]; if (depth > crownDepth) continue;                   // below the live crown: shed
    let elev = S.angle[0] + (S.angle[1] - S.angle[0]) * (depth / H);
    if (S.topUpright && S.slowAfter && t > S.slowAfter) elev = Math.max(20, elev - 40 * smooth((t - S.slowAfter) / 8));   // an old top's laterals turn up
    const ws = trunkAt[t]; const az0 = phase0 + t * 137.5;
    for (let j = 0; j < S.whorl; j++) { if (S.lose && rng() < S.lose) continue; branch(ws[2], t, az0 + (j * 360) / S.whorl + (rng() - 0.5) * 20, 1, elev); }
    for (let i = 0; i < S.inter; i++) branch(ws[i], t, az0 + 180 + i * 97, S.interScale, elev + 8);
  }
  // radii: the pipe model, normalized to the trunk's slenderness; a pine's limbs get a minimum from the length they carry
  const F = new Float64Array(nodes.length);
  for (let i = nodes.length - 1; i >= 0; i--) { F[i] += nodes[i].leaves; if (nodes[i].parent >= 0) F[nodes[i].parent] += F[i]; }
  const rBase = H / S.slender / 2; const k = (rBase * rBase - 0.003 ** 2) / Math.max(1, F[1]);
  for (let i = 0; i < nodes.length; i++) nodes[i].r = Math.sqrt(0.003 ** 2 + k * F[i]);
  nodes[0].r = nodes[1] ? nodes[1].r * 1.05 : rBase;
  if (S.limbMin) { const rest = new Map(); for (let i = nodes.length - 1; i >= 0; i--) { const n = nodes[i]; if (n.order !== 1) continue; const acc = (rest.get(n.axis) || 0) + n.len; rest.set(n.axis, acc); n.r = Math.max(n.r, S.limbMin * Math.sqrt(acc / 3)); } }
  // light: Beer–Lambert into the crown from its envelope (a shoot deep inside, or low, is darker)
  const env = new Float64Array(20);
  for (const n of nodes) { const b = Math.min(19, Math.floor((n.pos[2] / H) * 20)); env[b] = Math.max(env[b], dmath.hypot(n.pos[0], n.pos[1])); }
  const exposure = (p) => { const b = Math.max(0, Math.min(19, Math.floor((p[2] / H) * 20))); const inward = Math.max(0, (env[b] || 1) - dmath.hypot(p[0], p[1])); return Math.max(0.05, dmath.exp(-1.2 * inward) * (0.55 + 0.45 * p[2] / H)); };
  const arch = { label: S.label, needles: true, leafSize: S.leafSize, leafLife: S.leafLife, conifer: true };
  return { nodes, axes, arch, params: { years: A, lignin: 1, cambium: 1 }, children, exposure, spec: S, H };
}

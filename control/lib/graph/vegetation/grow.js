// vegetation/grow — a growth engine: a plant grown year by year from buds, light, and wood.
//
// Borrowed, not invented:
//   · light by SHADOW PROPAGATION in a voxel grid, and resource by BORCHERT–HONDA allocation
//     (Palubicki et al. 2009, "Self-organizing tree models") — the crown shape is not drawn, it is competed for;
//   · architecture as Hallé–Oldeman's small table of choices (monopodial/sympodial, orthotropic/plagiotropic,
//     rhythmic/continuous) — the "mineral table" of plants: rules and angles, no size;
//   · wood by the PIPE MODEL + PRESSLER: each year's ring AREA at a point = k × foliage above it. Leonardo's rule and
//     the trunk's taper are consequences, not inputs. Wood never shrinks, so shed branches leave their pipes behind.
//   · mechanics (mechanics.js): each internode is a beam of E(age, lignin) and I = πr⁴/4 that takes this year's EXTRA load
//     (older wood is locked in the shape it grew in — Fournier's growth-stress view), then reaction wood pulls it back
//     toward its gravitropic set-point with a curvature ∝ Δα·Δr/r² (only where there is wood to do it).
//
// The two lignification dials (separate: a palm or a bamboo has lignin and no cambium):
//   lignin   0..1 — how locked the wall is: E(age) = stemModulus(lignin · maturity(age)).
//   cambium  0..1 — secondary growth: the pipe increment is scaled by it. Monocots (grass, bamboo, palm) have none.
// Deterministic: mulberry32 dice from the seed; no Math.random, no Date.
import { stemModulus, G } from './mechanics.js';

export function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const vec = { add, sub, mul, dot, cross, len, unit };
/** Rodrigues: rotate v about unit axis k by angle a. */
function rot(v, k, a) { const c = Math.cos(a), s = Math.sin(a), d = dot(k, v), x = cross(k, v); return [v[0] * c + x[0] * s + k[0] * d * (1 - c), v[1] * c + x[1] * s + k[1] * d * (1 - c), v[2] * c + x[2] * s + k[2] * d * (1 - c)]; }
export { rot };
function perp(d) { const a = Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]; const u = unit(cross(a, d)); return [u, cross(d, u)]; }
const UP = [0, 0, 1];
const DEG = Math.PI / 180;

// ── the architecture table (Hallé–Oldeman), as data ────────────────────────────────────────────────────────────
// Per-order arrays index by axis order (clamped to the last entry). Angles in degrees. Lengths in metres.
//   setPoint : gravitropic set-point, degrees from vertical, per order (0 = straight up, 90 = horizontal)
//   plagio   : plagiotropic axes (their laterals sit in a plane, their set-point is ~horizontal)
//   rhythm   : 'continuous' (a bud at every node) | 'acrotonic' (laterals favoured near the top of each year's shoot)
//              | 'whorl' (laterals only at the top node, `whorl` of them — tiers)
//   phyllo   : 'spiral' (divergence) | 'distichous' (two ranks, 180°) | 'decussate' (pairs, 90° per node)
//   sympodial: the apex ends each year (flowering) and `relay` laterals just below it take over
//   unbranched: Corner's model — one axis, no laterals at all
export const ARCHITECTURES = {
  rauh: {                                     // oak, ash, pine: monopodial, orthotropic, rhythmic
    label: 'Rauh (oak-like)', phyllo: 'spiral', divergence: 137.5, rhythm: 'acrotonic', insertion: [45, 50, 55],
    setPoint: [0, 48, 60, 70], plagio: [false], apical: [0.54, 0.47], matureAt: 14, internode: [0.26, 0.22, 0.16, 0.12], maxShoot: [5, 5, 4, 3],
    leafLife: 1, leafSize: 0.11, leavesPerNode: 4, budLife: 3, vigor: 1.25,
  },
  massart: {                                  // fir, spruce, Araucaria: orthotropic trunk, whorled tiers of plagiotropic branches
    label: 'Massart (fir-like)', phyllo: 'spiral', divergence: 137.5, rhythm: 'whorl', whorl: 5, insertion: [78, 55, 55],
    setPoint: [0, 82, 88, 90], plagio: [false, true], apical: 0.62, internode: [0.2, 0.16, 0.12, 0.1], maxShoot: [3, 3, 3, 2], vigor: 1.33,
    params: { shedLight: 0.08 },
    leafLife: 5, leafSize: 0.05, leavesPerNode: 3, budLife: 2, needles: true,
  },
  troll: {                                    // beech, elm: every axis plagiotropic; the trunk is built by uprighting (reaction wood)
    label: 'Troll (beech-like)', phyllo: 'distichous', rhythm: 'continuous', insertion: [45, 50, 55],
    setPoint: [50, 65, 75, 84], plagio: [true], uprightAge: 1, apical: [0.5, 0.46], internode: [0.3, 0.22, 0.16, 0.12], maxShoot: [5, 4, 4, 3],
    leafLife: 1, leafSize: 0.09, leavesPerNode: 3, budLife: 3, vigor: 1.52,
  },
  leeuwenberg: {                              // frangipani, castor, many shrubs: sympodial, every module ends and relays
    label: 'Leeuwenberg (candelabra)', phyllo: 'spiral', divergence: 137.5, rhythm: 'acrotonic', sympodial: true, relay: 2,
    insertion: [36, 36, 36], setPoint: [0, 26, 30, 34, 38], plagio: [false], apical: 0.5, internode: [0.2, 0.16, 0.14, 0.12, 0.1], maxShoot: [5, 4, 3, 3, 2], vigor: 1.4,
    leafLife: 1, leafSize: 0.16, leavesPerNode: 1, budLife: 1, terminalLeaves: true,
  },
  corner: {                                   // palms, tree ferns: one axis, a crown of big leaves
    label: 'Corner (palm-like)', unbranched: true, phyllo: 'spiral', divergence: 137.5, rhythm: 'continuous', insertion: [60],
    setPoint: [0], plagio: [false], apical: 1, internode: [0.06], maxShoot: [12], leafLife: 2, leafSize: 1.6, leavesPerNode: 1, budLife: 0, frond: true,
    vigor: 6, voxelScale: 6, monocot: true, rEstablish: 0.14,   // no cambium: girth is set once, by establishment growth
  },
};

export const GROW_DEFAULTS = {
  years: 20, seed: 1, lignin: 1, cambium: 1,
  // light (Palubicki's constants, in voxel units)
  voxel: null, shadowA: 1, shadowB: 1.9, shadowDepth: 7, fullLight: 3.2,
  // resource
  alpha: 2.1, vMin: 1,                         // resource per unit exposure; a bud needs ≥ vMin to make one metamer
  wPrev: 1, wTrop: 0.35, wLight: 0.3, wander: 0.06,
  // wood
  rPrimary: 0.0025,                            // m, a new shoot's radius before any secondary growth
  pipe: 1.4e-6,                                // m² of new ring area per living leaf, per year
  rho: 900, leafMass: 0.0015,                  // green wood kg/m³; kg per leaf
  // mechanics
  maturity: 1,                                 // years for a shoot's wall to finish lignifying
  firstSeason: 0.8,                            // the share of that done in the season the shoot grows (twigs are ~3 GPa)
  react: 3e-3,                                 // Δα, the maturation-strain asymmetry reaction wood can apply (0.1–0.3%)
  shedAfter: 2, shedLight: 0.18,               // a branch starved this many years in a row is shed
  maxNodes: 150000,                            // a safety cap only: reaching it stops growth, and a tree that stops leafing starves
};

/**
 * Grow a plant. Returns { nodes, axes, years, arch, params, history } where
 *   node: { id, parent, axis, order, born, died?, pos, dir, len, r, area[], leaves, setPoint }
 *   area[y] is the node's cumulative wood cross-section after year y (index 0 = year 1) — the ring history.
 * `history` keeps per-year totals for the ledger (nodes, leaves, height).
 */
export function grow(archIn, opts = {}) {
  const arch = typeof archIn === 'string' ? ARCHITECTURES[archIn] : archIn;
  if (!arch) throw new Error(`grow: unknown architecture '${archIn}' (have ${Object.keys(ARCHITECTURES).join(', ')})`);
  const P = { ...GROW_DEFAULTS, ...(arch?.monocot ? { cambium: 0 } : {}), ...(arch?.params || {}), ...opts };
  const rng = mulberry32((P.seed * 2654435761) >>> 0);
  const at = (arr, k) => arr[Math.min(k, arr.length - 1)];
  const nodes = []; const axes = []; const buds = []; const history = [];

  // ── shadow grid: dense, sized from the most the plant could grow, clamped (outside the box = open sky) ────
  const vs = P.voxel ?? at(arch.internode, 0) * (arch.voxelScale ?? 1);
  const reach = Math.min(40, P.years * at(arch.maxShoot, 0) * at(arch.internode, 0) * 1.15 + 1);
  const NX = Math.min(160, Math.ceil((2 * reach * 0.75) / vs) + 2), NZ = Math.min(180, Math.ceil((reach + 2) / vs) + 2);
  const ox = -(NX * vs) / 2, oz = -1;          // x,y centred on the seed; z from 1 m below ground
  const grid = new Float32Array(NX * NX * NZ);
  const cell = (p) => [Math.floor((p[0] - ox) / vs), Math.floor((p[1] - ox) / vs), Math.floor((p[2] - oz) / vs)];
  const inside = (i, j, k) => i >= 0 && j >= 0 && k >= 0 && i < NX && j < NX && k < NZ;
  const shadowAt = (p) => { const [i, j, k] = cell(p); return inside(i, j, k) ? grid[(k * NX + j) * NX + i] : 0; };
  function castShadows() {
    grid.fill(0);
    for (const n of nodes) {
      if (n.died || !n.leaves) continue;
      const [i, j, k] = cell(n.pos); const w = 1;           // one leafy metamer casts one unit (Palubicki)
      for (let q = 0; q <= P.shadowDepth; q++) {
        const kk = k - q; if (kk < 0) break; if (kk >= NZ) continue;
        const s = w * P.shadowA * Math.pow(P.shadowB, -q);
        const j0 = Math.max(0, j - q), j1 = Math.min(NX - 1, j + q), i0 = Math.max(0, i - q), i1 = Math.min(NX - 1, i + q);
        for (let jj = j0; jj <= j1; jj++) { const row = (kk * NX + jj) * NX; for (let ii = i0; ii <= i1; ii++) grid[row + ii] += s; }
      }
    }
  }
  // a bud does not shade itself: its own node's unit is taken back out (Palubicki's `+ a`)
  const exposure = (p, own = 0) => Math.max(0, P.fullLight - shadowAt(p) + own * P.shadowA) / P.fullLight;
  function lightDir(p) {                     // toward less shadow: the negative gradient, plus a sky bias
    const h = vs; const g = [0, 1, 2].map((a) => { const e = [0, 0, 0]; e[a] = h; return shadowAt(add(p, e)) - shadowAt(sub(p, e)); });
    const d = [-g[0], -g[1], -g[2] + 0.05]; return len(d) < 1e-9 ? UP : unit(d);
  }

  // ── structure helpers ─────────────────────────────────────────────────────────────────────────────────────
  const children = new Map();                  // node id → child node ids
  const budsOf = new Map();                    // node id → buds sitting on it (they turn with the wood)
  const pushBud = (b) => { buds.push(b); if (!budsOf.has(b.node)) budsOf.set(b.node, []); budsOf.get(b.node).push(b); };
  const addNode = (n) => { n.id = nodes.length; nodes.push(n); if (n.parent >= 0) { if (!children.has(n.parent)) children.set(n.parent, []); children.get(n.parent).push(n.id); } return n; };
  function setPointDir(d, order, age) {
    let sp = at(arch.setPoint, order);
    if (arch.uprightAge && order === 0 && age >= arch.uprightAge) sp = 0;       // Troll: the older trunk uprights
    const h = [d[0], d[1], 0]; const hl = len(h); const hu = hl < 1e-6 ? [1, 0, 0] : mul(h, 1 / hl);
    return unit(add(mul(UP, Math.cos(sp * DEG)), mul(hu, Math.sin(sp * DEG))));
  }
  function budDirs(d, order, nodeIndexInShoot, shootLen, phase) {
    // lateral bud directions at one node: phyllotaxis around the parent direction d
    const [u, w] = perp(d); const ins = at(arch.insertion, order) * DEG; const out = [];
    const mk = (phi) => unit(add(mul(d, Math.cos(ins)), mul(add(mul(u, Math.cos(phi)), mul(w, Math.sin(phi))), Math.sin(ins))));
    const plag = order > 0 && at(arch.plagio, order);
    if (plag || arch.phyllo === 'distichous') {
      // two ranks, in the plane of the horizontal: laterals go left and right, not up and down
      const side = unit(cross(UP, d)); const sgn = nodeIndexInShoot % 2 ? 1 : -1;
      const s = len(side) < 1e-6 ? u : side;
      out.push(unit(add(mul(d, Math.cos(ins)), mul(s, sgn * Math.sin(ins)))));
    } else if (arch.phyllo === 'decussate') {
      const phi = phase + (nodeIndexInShoot % 2) * Math.PI / 2; out.push(mk(phi), mk(phi + Math.PI));
    } else {
      out.push(mk(phase + nodeIndexInShoot * arch.divergence * DEG));
    }
    return out;
  }

  // ── seed: the embryo is one node with an apical bud ───────────────────────────────────────────────────────
  axes.push({ id: 0, order: 0, base: -1, alive: true, starved: 0, born: 0 });
  addNode({ parent: -1, axis: 0, order: 0, born: 0, pos: [0, 0, 0], dir: UP, len: 0, r: P.rPrimary, area: [], leaves: 0, dA: 0 });
  pushBud({ node: 0, axis: 0, order: 0, dir: UP, apical: true, born: 0, alive: true, phase: rng() * 2 * Math.PI });

  for (let year = 1; year <= P.years; year++) {
    castShadows();
    // exposure of every live bud, and the basipetal sum per node (Q flows down to the root)
    const liveBuds = buds.filter((b) => b.alive);
    for (const b of liveBuds) b.Q = exposure(nodes[b.node].pos, nodes[b.node].leaves ? 1 : 0);
    const Qnode = new Float64Array(nodes.length); const Bnode = new Float64Array(nodes.length); const budsAt = new Map();
    for (const b of liveBuds) { if (!budsAt.has(b.node)) budsAt.set(b.node, []); budsAt.get(b.node).push(b); }
    const order = topo(nodes);                   // parents before children
    for (let t = order.length - 1; t >= 0; t--) {
      const id = order[t]; let q = 0, nb = 0; for (const b of budsAt.get(id) || []) { q += b.Q; nb++; }
      for (const c of children.get(id) || []) if (!nodes[c].died) { q += Qnode[c]; nb += Bnode[c]; }
      Qnode[id] = q; Bnode[id] = nb;
    }
    // Borchert–Honda: the base resource splits at every node between the continuing axis and the laterals
    const vNode = new Float64Array(nodes.length); vNode[0] = P.alpha * (arch.vigor ?? 1) * Qnode[0];
    for (const id of order) {
      const n = nodes[id]; if (n.died) continue; const v = vNode[id];
      const parts = [];
      for (const c of children.get(id) || []) if (!nodes[c].died) parts.push({ c, main: nodes[c].axis === n.axis, Q: Qnode[c] });
      for (const b of budsAt.get(id) || []) parts.push({ b, main: b.apical && b.axis === n.axis, Q: b.Q });
      const lam = Array.isArray(arch.apical) ? arch.apical[0] + (arch.apical[1] - arch.apical[0]) * Math.min(1, year / (arch.matureAt || 15)) : arch.apical; let W = 0;
      for (const p of parts) { p.w = (p.main ? lam : 1 - lam) * p.Q; if (p.b && !p.b.apical && arch.rhythm === 'acrotonic') p.w *= p.b.acro ?? 1; W += p.w; }
      for (const p of parts) { const share = W > 0 ? v * p.w / W : 0; if (p.c !== undefined) vNode[p.c] = share; else p.b.v = share; }
    }
    // bud fate: grow shoots
    const newShoots = [];
    for (const b of liveBuds) {
      const nMax = at(arch.maxShoot, b.order); const n = Math.min(nMax, Math.floor((b.v || 0) / P.vMin));
      if (!b.apical && year - b.born > arch.budLife) { b.alive = false; continue; }
      if (process.env.GDEBUG && year === +process.env.GDEBUG) console.log("bud", b.node, b.apical ? "A" : b.relay ? "R" : "L", "o", b.order, "Q", b.Q?.toFixed(2), "v", b.v?.toFixed(2), "n", n);
      if (n < 1) continue;
      b.alive = false; newShoots.push({ b, n });
    }
    // deterministic order: by node id then direction
    newShoots.sort((x, y) => x.b.node - y.b.node || x.b.dir[0] - y.b.dir[0]);
    for (const { b, n } of newShoots) {
      if (nodes.length >= P.maxNodes) break;
      let axisId = b.axis;
      if (!b.apical) { axisId = axes.length; axes.push({ id: axisId, order: b.order, base: b.node, alive: true, starved: 0, born: year }); }
      const ax = axes[axisId]; const order_ = ax.order;
      let d = b.dir; let prev = b.node; const L0 = at(arch.internode, order_);
      const phase = b.phase ?? rng() * 2 * Math.PI;
      for (let i = 0; i < n; i++) {
        const p0 = nodes[prev].pos;
        const trop = setPointDir(d, order_, 0);
        const light = lightDir(p0);
        const jitter = [rng() - 0.5, rng() - 0.5, rng() - 0.5];
        d = unit(add(add(add(mul(d, P.wPrev), mul(trop, P.wTrop)), mul(light, P.wLight)), mul(jitter, P.wander)));
        const l = L0 * (0.85 + 0.3 * rng());
        const lv = arch.terminalLeaves ? (i >= n - 2 ? arch.leavesPerNode * 4 : 0) : arch.leavesPerNode;
        const node = addNode({ parent: prev, axis: axisId, order: order_, born: year, pos: add(p0, mul(d, l)), dir: d, len: l, r: P.rPrimary, area: [], leaves: lv, dA: 0 });
        const last = i === n - 1;
        // lateral buds (none for Corner; whorls only at the last node; acrotony favours the top)
        if (!arch.unbranched) {
          let dirs = [];
          if (arch.rhythm === 'whorl') {
            if (last) { const k = arch.whorl || 5; const [u, w] = perp(d); const ins = at(arch.insertion, order_) * DEG;
              for (let j = 0; j < k; j++) { const phi = phase + year * 137.5 * DEG + (j * 2 * Math.PI) / k; dirs.push(unit(add(mul(d, Math.cos(ins)), mul(add(mul(u, Math.cos(phi)), mul(w, Math.sin(phi))), Math.sin(ins))))); } }
            else if (order_ > 0) dirs = budDirs(d, order_, i, n, phase);   // fir branches: two-ranked twigs along them
          } else dirs = budDirs(d, order_, i, n, phase);
          if (arch.sympodial && !last) dirs = [];                           // relays come from just below the tip only
          for (const bd of dirs) pushBud({ node: node.id, axis: axisId, order: order_ + 1, dir: bd, apical: false, born: year, alive: true, acro: arch.rhythm === 'acrotonic' ? Math.pow((i + 1) / n, 2) : 1, phase: rng() * 2 * Math.PI });
        }
        prev = node.id;
      }
      if (arch.sympodial) {
        // the apex ends (a flower); `relay` laterals just below it continue next year as new axes of the same order
        const tip = nodes[prev]; const [u, w] = perp(tip.dir); const k = arch.relay || 2; const ins = at(arch.insertion, order_) * DEG;
        for (let j = 0; j < k; j++) { const phi = phase + (j * 2 * Math.PI) / k; const bd = unit(add(mul(tip.dir, Math.cos(ins)), mul(add(mul(u, Math.cos(phi)), mul(w, Math.sin(phi))), Math.sin(ins))));
          pushBud({ node: tip.id, axis: axisId, order: order_ + 1, dir: bd, apical: false, born: year, alive: true, relay: true, phase: rng() * 2 * Math.PI }); }
        tip.flower = year;
      } else {
        pushBud({ node: prev, axis: axisId, order: order_, dir: d, apical: true, born: year, alive: true, phase });
      }
    }

    // leaves of shoots older than the leaf life fall (after this year's flush: what is left is this year's canopy)
    for (const n of nodes) if (n.leaves && year - n.born >= arch.leafLife) n.leaves = 0;
    const leafArea = Math.min(4, (arch.leafSize / 0.11) ** 2);   // the pipe serves leaf AREA; a 0.11 m leaf is one unit
    // ── wood: the pipe model. ring area this year = pipe × living leaves above (Pressler), scaled by cambium ──
    const F = new Float64Array(nodes.length);
    const ord2 = topo(nodes);
    for (let t = ord2.length - 1; t >= 0; t--) { const id = ord2[t]; const n = nodes[id]; if (n.died) continue; let f = n.leaves; for (const c of children.get(id) || []) if (!nodes[c].died) f += F[c]; F[id] = f; }
    for (const id of ord2) {
      const n = nodes[id]; const r0 = arch.rEstablish && n.order === 0 ? arch.rEstablish : P.rPrimary;
      const prevA = n.area.length ? n.area[n.area.length - 1] : Math.PI * r0 ** 2;
      const dA = n.died ? 0 : P.pipe * F[id] * leafArea * P.cambium;
      const A = prevA + dA; n.dA = dA; n.area.push(A); n.r = Math.sqrt(A / Math.PI);
      n.F = F[id];
    }
    // backfill area arrays of nodes born this year so area[y-1] indexes by year for everyone
    for (const n of nodes) while (n.area.length < year) n.area.unshift(Math.PI * P.rPrimary ** 2);

    // ── mechanics: this year's extra load bends each internode; reaction wood pulls back toward the set-point ──
    bendAndReact(year);
    groundContact();

    // ── self-pruning: a branch whose whole subtree's buds see too little light for `shedAfter` years is shed ──
    // (judged on the SUBTREE, from this year's basipetal light sums: a sympodial module is not starved while its
    // relays above it are in the sun)
    const firstOf = new Map(); for (const n of nodes) if (!n.died && !firstOf.has(n.axis)) firstOf.set(n.axis, n.id);
    for (const ax of axes) {
      if (!ax.alive || ax.order === 0) continue;
      const f = firstOf.get(ax.id); if (f === undefined) { ax.alive = false; continue; }
      const q = Bnode[f] > 0 ? Qnode[f] / Bnode[f] : 0;
      ax.starved = q < P.shedLight ? ax.starved + 1 : 0;
      if (ax.starved >= P.shedAfter) shedAxis(ax, year);
    }
    let h = 0, leaves = 0, live = 0; for (const n of nodes) if (!n.died) { live++; leaves += n.leaves; if (n.pos[2] > h) h = n.pos[2]; }
    history.push({ year, nodes: live, leaves, height: h, dbh: nodes[1] ? 2 * nodes[1].r : 0 });
  }

  function shedAxis(ax, year) {
    ax.alive = false; ax.died = year;
    const stack = nodes.filter((n) => n.axis === ax.id && !n.died).map((n) => n.id);
    while (stack.length) { const id = stack.pop(); const n = nodes[id]; if (n.died) continue; n.died = year; n.leaves = 0; for (const c of children.get(id) || []) stack.push(c); }
    for (const b of buds) if (b.alive && nodes[b.node].died) b.alive = false;
  }

  function bendAndReact(year) {
    const ord = topo(nodes);
    // distal mass and first moment (mass × position) per node, this year's positions
    const m = new Float64Array(nodes.length), mx = new Float64Array(nodes.length), my = new Float64Array(nodes.length);
    for (let t = ord.length - 1; t >= 0; t--) {
      const id = ord[t]; const n = nodes[id]; if (n.died) continue;
      const own = P.rho * Math.PI * n.r * n.r * n.len + n.leaves * P.leafMass;
      const mid = n.parent >= 0 ? mul(add(n.pos, nodes[n.parent].pos), 0.5) : n.pos;
      let M = own, X = own * mid[0], Y = own * mid[1];
      for (const c of children.get(id) || []) if (!nodes[c].died) { M += m[c]; X += mx[c]; Y += my[c]; }
      m[id] = M; mx[id] = X; my[id] = Y;
    }
    // root first: each internode (parent → n) rotates n's subtree
    for (const id of ord) {
      const n = nodes[id]; if (n.parent < 0 || n.died || m[id] <= 0) continue;
      const base = nodes[n.parent].pos;
      // gravity moment about the base: Σ (r − base) × (0,0,−m g) = g · (−(Y − m·by), (X − m·bx), 0)
      const Mv = [-(my[id] - m[id] * base[1]) * G, (mx[id] - m[id] * base[0]) * G, 0];
      const Mmag = len(Mv); const prevM = n.Mprev || 0; n.Mprev = Mmag;
      const age = year - n.born; const lig = P.lignin * Math.min(1, P.firstSeason + (1 - P.firstSeason) * age / P.maturity);
      const E = stemModulus(lig) * 1e9; const I = Math.PI * n.r ** 4 / 4;
      // older wood is locked in its grown shape: it only answers the load added since last year
      const dM = age <= 0 ? Mmag : Math.max(0, Mmag - prevM);
      // never past hanging: cap at half the angle between the distal centroid's lever and straight down
      const c = [mx[id] / m[id] - base[0], my[id] / m[id] - base[1], 0]; const lever = len(c);
      const cz = n.pos[2] - base[2]; const toDown = Math.atan2(lever, -cz - 1e-9);
      let theta = Math.min(0.5 * Math.max(0, toDown), 0.6, (dM * n.len) / (E * I));
      if (theta > 1e-7) rotateSubtree(id, base, unit(Mv), theta);
      // reaction wood: curvature ∝ Δα · Δr / r², only with lignin and new wood
      if (age >= 1 && P.lignin > 0 && n.dA > 0) {
        const want = setPointDir(n.dir, n.order, age);
        const err = Math.acos(Math.max(-1, Math.min(1, dot(n.dir, want))));
        if (err > 1e-4) {
          const dr = n.r - Math.sqrt(Math.max(0, n.r * n.r - n.dA / Math.PI));
          const kappa = 4 * P.react * lig * dr / (n.r * n.r);
          const fix = Math.min(err, kappa * n.len);
          const ax = unit(cross(n.dir, want)); if (len(ax) > 0 && fix > 1e-7) rotateSubtree(id, base, ax, fix);
        }
      }
    }
  }
  function groundContact() { groundPass(nodes, children, rotateSubtree); }
  function rotateSubtree(id, pivot, axis, a) {
    const stack = [id];
    while (stack.length) {
      const k = stack.pop(); const n = nodes[k];
      n.pos = add(pivot, rot(sub(n.pos, pivot), axis, a)); n.dir = unit(rot(n.dir, axis, a));
      for (const b of budsOf.get(k) || []) if (b.alive) b.dir = unit(rot(b.dir, axis, a));
      for (const c of children.get(k) || []) stack.push(c);
    }
  }

  castShadows();
  return { nodes, axes, arch, params: P, history, children, exposure, shadowAt };
}

/** Parents before children (ids are already in that order: a child is always created after its parent). */
function topo(nodes) { const o = new Array(nodes.length); for (let i = 0; i < nodes.length; i++) o[i] = i; return o; }

/**
 * Measurements on a grown plant (for the gates and the zoom test).
 *   leonardo: Δ at forks, solving r_p^Δ = Σ r_c^Δ over live forks (median)
 *   ldExp   : the exponent in l ∝ d^b over axes (axis length vs base diameter), per-plant least squares
 *   ringArea: the last year's ring area along the trunk (should be ~constant below the crown)
 */
export function measure(plant) {
  const { nodes, children } = plant; const live = (n) => !n.died;
  const deltas = [];
  for (const n of nodes) {
    if (!live(n)) continue; const cs = (children.get(n.id) || []).map((c) => nodes[c]).filter(live);
    if (cs.length < 2) continue; const rp = n.r; const rc = cs.map((c) => c.r);
    if (rc.some((r) => r >= rp)) continue;
    let lo = 0.5, hi = 6; const f = (D) => Math.pow(rp, D) - rc.reduce((s, r) => s + Math.pow(r, D), 0);
    if (f(lo) * f(hi) > 0) continue; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (f(lo) * f(m) <= 0) hi = m; else lo = m; }
    if (rp > 0.004) deltas.push((lo + hi) / 2);
  }
  deltas.sort((a, b) => a - b);
  // axes: length along the axis, diameter at its base
  const axLen = new Map(), axBase = new Map();
  for (const n of nodes) { if (!live(n)) continue; axLen.set(n.axis, (axLen.get(n.axis) || 0) + n.len); if (!axBase.has(n.axis)) axBase.set(n.axis, n); }
  const pts = []; for (const [a, L] of axLen) { const b = axBase.get(a); if (L > 0.3 && b.r > 0.003) pts.push([Math.log(2 * b.r), Math.log(L)]); }
  const fit = (P) => { const n = P.length; if (n < 3) return null; const mx = P.reduce((s, p) => s + p[0], 0) / n, my = P.reduce((s, p) => s + p[1], 0) / n; let sxy = 0, sxx = 0; for (const [x, y] of P) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; } return sxy / sxx; };
  // trunk ring area by height
  const trunk = nodes.filter((n) => n.axis === 0 && live(n)).sort((a, b) => a.pos[2] - b.pos[2]);
  const ring = trunk.map((n) => ({ z: n.pos[2], dA: n.dA, r: n.r, F: n.F }));
  let height = 0, leaves = 0, liveN = 0, crownBase = Infinity;
  for (const n of nodes) if (live(n)) { liveN++; leaves += n.leaves; height = Math.max(height, n.pos[2]); if (n.leaves && n.order > 0) crownBase = Math.min(crownBase, n.pos[2]); }
  return {
    leonardo: deltas.length ? { median: deltas[Math.floor(deltas.length / 2)], q1: deltas[Math.floor(deltas.length / 4)], q3: deltas[Math.floor((3 * deltas.length) / 4)], n: deltas.length } : null,
    ldExp: fit(pts), ldN: pts.length, ring, height, leaves, nodes: liveN, crownBase: Number.isFinite(crownBase) ? crownBase : 0,
    dbh: trunk.length > 1 ? 2 * trunk[Math.min(trunk.length - 1, Math.max(1, Math.round(trunk.length * 0.1)))].r : 0,
  };
}

/** Stems cannot go through the ground: any internode that ends below z = 0 is turned (with its subtree) to lie on it. */
function groundPass(nodes, children, rotateSubtree) {
  for (let id = 1; id < nodes.length; id++) {
    const n = nodes[id]; if (n.died || n.pos[2] >= 0) continue; const p = nodes[n.parent].pos;
    const d = sub(n.pos, p); const l = len(d); if (l < 1e-9) continue;
    const h = Math.hypot(d[0], d[1]); const hz = Math.max(-0.999 * l, -Math.max(0, p[2]));
    const hh = Math.sqrt(Math.max(0, l * l - hz * hz)); const hx = h > 1e-9 ? d[0] / h : 1, hy = h > 1e-9 ? d[1] / h : 0;
    const want = unit([hx * hh, hy * hh, hz]); const cur = unit(d);
    const ax = cross(cur, want); const s = len(ax); if (s < 1e-9) continue;
    rotateSubtree(id, p, mul(ax, 1 / s), Math.atan2(s, dot(cur, want)));
  }
}

/**
 * Re-stand a grown plant in another material: the same architecture and topology, with the secondary thickening
 * scaled by `cambium`, the wall locked to `lignin`, and the whole plant scaled by `scale` (geometric: lengths and radii
 * alike, so only the square–cube law changes). The self-weight is applied in `steps` increments, each bending every
 * internode by ΔM·l/(E I), root first, with ground contact. No reaction wood: this is what the material alone does.
 * Returns a plant-shaped object (clone) that the mesh builders accept, plus the tip drop statistics.
 */
export function restand(plant, { lignin = 1, cambium = 1, scale = 1, steps = 12 } = {}) {
  const P = plant.params;
  const nodes = plant.nodes.map((n) => ({ ...n, pos: mul(n.pos, scale), dir: [...n.dir], len: n.len * scale }));
  for (const n of nodes) { const r0 = P.rPrimary; n.r = (r0 + cambium * (n.r - r0)) * scale; }
  const children = plant.children; const E = stemModulus(lignin) * 1e9;
  const rotateSubtree = (id, pivot, axis, a) => { const st = [id]; while (st.length) { const k = st.pop(); const n = nodes[k]; n.pos = add(pivot, rot(sub(n.pos, pivot), axis, a)); n.dir = unit(rot(n.dir, axis, a)); for (const c of children.get(k) || []) st.push(c); } };
  const leafMass = P.leafMass * scale ** 3;
  const Mprev = new Float64Array(nodes.length);
  for (let s = 1; s <= steps; s++) {
    const f = s / steps;
    const m = new Float64Array(nodes.length), mx = new Float64Array(nodes.length), my = new Float64Array(nodes.length);
    for (let id = nodes.length - 1; id >= 0; id--) {
      const n = nodes[id]; if (n.died) continue;
      const own = f * (P.rho * Math.PI * n.r * n.r * n.len + n.leaves * leafMass);
      const mid = n.parent >= 0 ? mul(add(n.pos, nodes[n.parent].pos), 0.5) : n.pos;
      let M = own, X = own * mid[0], Y = own * mid[1];
      for (const c of children.get(id) || []) if (!nodes[c].died) { M += m[c]; X += mx[c]; Y += my[c]; }
      m[id] = M; mx[id] = X; my[id] = Y;
    }
    for (let id = 1; id < nodes.length; id++) {
      const n = nodes[id]; if (n.died || m[id] <= 0) continue; const base = nodes[n.parent].pos;
      const Mv = [-(my[id] - m[id] * base[1]) * G, (mx[id] - m[id] * base[0]) * G, 0]; const Mm = len(Mv);
      const dM = Math.max(0, Mm - Mprev[id]); Mprev[id] = Mm;
      const c = [mx[id] / m[id] - base[0], my[id] / m[id] - base[1], 0]; const toDown = Math.atan2(len(c), -(n.pos[2] - base[2]) - 1e-9);
      const I = Math.PI * n.r ** 4 / 4; const th = Math.min(0.5 * Math.max(0, toDown), 0.6, (dM * n.len) / (E * I));
      if (th > 1e-7) rotateSubtree(id, base, unit(Mv), th);
    }
    groundPass(nodes, children, rotateSubtree);
  }
  let h = 0; for (const n of nodes) if (!n.died) h = Math.max(h, n.pos[2]);
  const h0 = plant.nodes.reduce((a, n) => (n.died ? a : Math.max(a, n.pos[2])), 0) * scale;
  return { ...plant, nodes, params: { ...P, lignin, cambium }, exposure: (p) => plant.exposure(mul(p, 1 / scale)), standing: h / h0, height: h };
}

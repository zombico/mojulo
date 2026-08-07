/**
 * molecule-builder — author molecules by CONNECTIVITY (or by NAME), not by hand-placed coordinates.
 *
 * molecule-view renders ball-and-stick structure beautifully but demands every atom's 3D position up
 * front. This module removes that friction: give it what's bonded to what (symbols + index pairs) and
 * it generates chemically-reasonable coordinates via idealized VSEPR geometry, or look a molecule up
 * by name in MOLECULE_LIBRARY. The output is exactly molecule-view's recipe shape, so the stored
 * manifest stays tiny ({ kind:'molecule-view', library:'caffeine' }) and regenerates on render — the
 * same fractal-recipe contract every other view honours.
 *
 * VSEPR here means IDEALIZED hybridization geometry — recognizable shapes (tetrahedral methane, bent
 * water, pyramidal ammonia, linear CO₂, planar ethylene), NOT energy-minimized coordinates. It is a
 * deterministic geometric construction, not a force field. Rings are not perceived (the BFS tree
 * leaves a cycle open); ring molecules are supplied with explicit coordinates in the library instead.
 *
 * See molecule-builder.plan.md for the full design + scope.
 */

// ── tiny vec helpers ──
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Rodrigues: rotate v about unit axis k by angle th.
function rotAxis(v, k, th) {
  const c = Math.cos(th), s = Math.sin(th);
  const kv = cross(k, v), kd = dot(k, v);
  return [
    v[0] * c + kv[0] * s + k[0] * kd * (1 - c),
    v[1] * c + kv[1] * s + k[1] * kd * (1 - c),
    v[2] * c + kv[2] * s + k[2] * kd * (1 - c),
  ];
}

// rotation taking unit vector a onto unit vector b, applied to a whole set of vectors.
function rotateSet(set, a, b) {
  const c = clamp(dot(a, b), -1, 1);
  if (c > 0.999999) return set.map((v) => v.slice());
  if (c < -0.999999) {
    let axis = cross(a, [1, 0, 0]);
    if (len(axis) < 1e-6) axis = cross(a, [0, 1, 0]);
    axis = norm(axis);
    return set.map((v) => rotAxis(v, axis, Math.PI));
  }
  const axis = norm(cross(a, b)), ang = Math.acos(c);
  return set.map((v) => rotAxis(v, axis, ang));
}

// ── element data ──
const elemKey = (s) => String(s || '').trim().toUpperCase();
// valence electrons (main-group group number) — drives lone-pair inference.
const VALENCE = {
  H: 1, HE: 2, LI: 1, BE: 2, B: 3, C: 4, N: 5, O: 6, F: 7, NE: 8,
  NA: 1, MG: 2, AL: 3, SI: 4, P: 5, S: 6, CL: 7, AR: 8, BR: 7, I: 7,
};
// covalent radii (Å) — bond length = sum of the two (shortened for multiple bonds).
const COVALENT = {
  H: 0.31, C: 0.76, N: 0.71, O: 0.66, F: 0.57, CL: 1.02, BR: 1.20, I: 1.39, S: 1.05, P: 1.07,
  B: 0.84, NA: 1.66, MG: 1.41, AL: 1.21, SI: 1.11,
};
const valence = (s) => VALENCE[elemKey(s)] ?? 4;
const radius = (s) => COVALENT[elemKey(s)] ?? 0.75;
const bondScale = (order) => (order >= 3 ? 0.84 : order === 2 ? 0.90 : 1.0);
// uniform display scale: true Ångström bonds (~1.1 Å) render crowded against molecule-view's default
// ball/rod sizes. Scaling every coordinate preserves all bond angles + length RATIOS while giving the
// ball-and-stick room to breathe — a presentation choice, like the existing principal-axis framing.
const VIS = 2.2;

// ── ideal direction sets by steric number, slot 0 = +z (the "parent" slot for non-root atoms) ──
const T = Math.sqrt(2);
const GEOMETRY = {
  1: [[0, 0, 1]],
  2: [[0, 0, 1], [0, 0, -1]],                                   // linear
  3: [[0, 0, 1], [0.8660254, 0, -0.5], [-0.8660254, 0, -0.5]],  // trigonal planar (xz-plane)
  4: [[0, 0, 1], [2 * T / 3, 0, -1 / 3], [-T / 3, Math.sqrt(2 / 3), -1 / 3], [-T / 3, -Math.sqrt(2 / 3), -1 / 3]], // tetrahedral
  5: [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-0.5, 0.8660254, 0], [-0.5, -0.8660254, 0]], // trig-bipyramidal
  6: [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]],            // octahedral
};
const geometryFor = (sn) => GEOMETRY[clamp(sn, 1, 6)] || GEOMETRY[4];

// plane normal of a (near-)planar direction set, or null if not planar enough.
function planeNormal(dirs) {
  if (dirs.length < 2) return null;
  const n = cross(dirs[0], dirs[1]);
  return len(n) > 1e-3 ? norm(n) : null;
}

/**
 * Connectivity → 3D coordinates via idealized VSEPR. `atoms` is an array of element symbols OR
 * {symbol, charge?, label?, meta?, color?, radius?} objects; `bonds` is an array of [i, j, order?]
 * tuples OR {from, to, order?} objects. Returns molecule-view-ready { atoms:[{symbol,pos,…}], bonds:
 * [{from,to,order}], warnings }.
 */
export function buildMoleculeGeometry({ atoms = [], bonds = [] } = {}) {
  const syms = atoms.map((a) => (typeof a === 'string' ? a : (a && a.symbol)));
  const n = syms.length;
  if (n === 0) throw new Error('buildMoleculeGeometry needs at least one atom');

  // normalize bonds, build adjacency + per-atom bond-order sum.
  const edges = bonds.map((b) => Array.isArray(b)
    ? { from: b[0], to: b[1], order: Math.max(1, Math.min(3, Math.round(b[2]) || 1)) }
    : { from: b.from, to: b.to, order: Math.max(1, Math.min(3, Math.round(b && b.order) || 1)) });
  const adj = Array.from({ length: n }, () => []);
  const orderSum = new Array(n).fill(0);
  for (let e = 0; e < edges.length; e++) {
    const { from, to, order } = edges[e];
    if (!(from >= 0 && from < n && to >= 0 && to < n) || from === to) throw new Error(`bad bond ${from}→${to}`);
    adj[from].push({ to, order, e }); adj[to].push({ to: from, order, e });
    orderSum[from] += order; orderSum[to] += order;
  }

  const charge = atoms.map((a) => (a && typeof a === 'object' && Number.isFinite(+a.charge)) ? +a.charge : 0);
  // steric number = bonded neighbours + inferred lone pairs.
  const sn = syms.map((s, i) => {
    const lp = Math.max(0, Math.round((valence(s) - charge[i] - orderSum[i]) / 2));
    return adj[i].length + lp;
  });

  const pos = new Array(n).fill(null);
  const dirs = new Array(n).fill(null);   // available bonding directions at each placed atom
  const dirPtr = new Array(n).fill(0);    // next free direction index
  const warnings = [];

  // ── rings first: perceive them, place each ring system as a rigid plate (planar / fused / chair) ──
  const rings = findSmallRings(adj, n);
  const seeds = [];
  for (const sys of groupRingSystems(rings)) {
    try {
      placeRingSystem(sys, { syms, adj, sn, pos, dirs, dirPtr });
      for (const a of sys.atoms) if (pos[a]) seeds.push(a);
    } catch (err) {
      warnings.push(`ring system [${[...sys.atoms].join(',')}] not placed (${err.message}) — built as an open tree`);
    }
  }

  // acyclic (or a ring that failed to place): seed from the highest-degree still-unplaced atom.
  if (seeds.length === 0) {
    let root = 0;
    for (let i = 1; i < n; i++) if (adj[i].length > adj[root].length) root = i;
    pos[root] = [0, 0, 0];
    dirs[root] = geometryFor(sn[root]).map((v) => v.slice());
    seeds.push(root);
  }

  // ── unified VSEPR tree growth from every seed; ring atoms feed their substituent subtrees ──
  const placed = new Set(seeds.filter((s) => pos[s]));
  const queue = [...placed];
  while (queue.length) {
    const u = queue.shift();
    for (const { to: v, order } of adj[u]) {
      if (placed.has(v)) continue;
      const avail = dirs[u] && dirs[u].length ? dirs[u] : [norm([1, 0.3, 0.2])];
      const d = avail[Math.min(dirPtr[u], avail.length - 1)];
      dirPtr[u]++;
      const L = (radius(syms[u]) + radius(syms[v])) * bondScale(order);
      pos[v] = add(pos[u], scl(d, L));
      placed.add(v);

      // build v's frame: rotate its ideal set so slot 0 points back at the parent u.
      const toParent = norm(sub(pos[u], pos[v]));
      let set = rotateSet(geometryFor(sn[v]), [0, 0, 1], toParent);

      // multiple bonds are rigid: pin the twist so an sp²/sp child stays coplanar with its parent
      // (ethylene flat), rather than taking the arbitrary minimal-rotation orientation.
      if (order >= 2 && sn[v] === 3 && sn[u] === 3) {
        const nP = planeNormal(dirs[u]), nV = planeNormal(set);
        if (nP && nV) {
          const axis = toParent;
          const proj = (x) => norm(sub(x, scl(axis, dot(x, axis))));
          const a = proj(nV), b = proj(nP);
          if (len(a) > 1e-3 && len(b) > 1e-3) {
            const ang = Math.atan2(dot(cross(a, b), axis), clamp(dot(a, b), -1, 1));
            set = set.map((x) => rotAxis(x, axis, ang));
          }
        }
      }
      dirs[v] = set;
      dirPtr[v] = 1;   // slot 0 is the bond back to the parent
      queue.push(v);
    }
  }

  // any atom still unplaced (disconnected fragment) — flag + park it so we never return a null pos.
  for (let i = 0; i < n; i++) {
    if (pos[i]) continue;
    warnings.push(`atom ${i} (${syms[i]}) is not connected to the main fragment — placed arbitrarily`);
    pos[i] = [3 + i, 0, 0];
  }

  const outAtoms = atoms.map((a, i) => (typeof a === 'string'
    ? { symbol: a, pos: round3(scl(pos[i], VIS)) }
    : { ...a, symbol: syms[i], pos: round3(scl(pos[i], VIS)) }));
  const outBonds = edges.map((e) => ({ from: e.from, to: e.to, order: e.order }));
  return { atoms: outAtoms, bonds: outBonds, warnings };
}

const round3 = (p) => [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000, Math.round(p[2] * 1000) / 1000];

// ─────────────────────────── ring perception + placement ───────────────────────────

// smallest ring through each bond (BFS with that bond removed), deduped by atom-set, sizes 3..8.
function findSmallRings(adj, n) {
  const seen = new Set(), rings = [];
  for (let a = 0; a < n; a++) {
    for (const { to: b } of adj[a]) {
      if (b <= a) continue;
      const path = shortestPathAvoidingEdge(adj, n, a, b);
      if (!path || path.length < 3 || path.length > 8) continue;
      const k = path.slice().sort((x, y) => x - y).join(',');
      if (seen.has(k)) continue;
      seen.add(k); rings.push(path);
    }
  }
  return rings;
}

// shortest a→b path that does NOT use the direct a–b edge → the ring closed by that edge.
function shortestPathAvoidingEdge(adj, n, a, b) {
  const prev = new Array(n).fill(-1), dist = new Array(n).fill(-1);
  dist[a] = 0; const q = [a];
  while (q.length) {
    const u = q.shift();
    for (const { to: v } of adj[u]) {
      if ((u === a && v === b) || (u === b && v === a)) continue;  // forbid the closing edge
      if (dist[v] !== -1) continue;
      dist[v] = dist[u] + 1; prev[v] = u;
      if (v === b) { const path = [b]; let c = b; while (c !== a) { c = prev[c]; path.push(c); } return path.reverse(); }
      q.push(v);
    }
  }
  return null;
}

// union rings sharing ≥1 atom into ring systems.
function groupRingSystems(rings) {
  const systems = [];
  for (const ring of rings) {
    const touching = systems.filter((s) => !s._dead && ring.some((a) => s.atoms.has(a)));
    if (touching.length === 0) { systems.push({ atoms: new Set(ring), rings: [ring] }); continue; }
    const base = touching[0];
    ring.forEach((a) => base.atoms.add(a)); base.rings.push(ring);
    for (let i = 1; i < touching.length; i++) {
      touching[i].atoms.forEach((a) => base.atoms.add(a));
      base.rings.push(...touching[i].rings); touching[i]._dead = true;
    }
  }
  return systems.filter((s) => !s._dead);
}

const ringHasDouble = (ring, adj) => ring.some((a, i) => {
  const b = ring[(i + 1) % ring.length];
  const e = adj[a].find((x) => x.to === b);
  return e && e.order >= 2;
});
const meanRingBond = (ring, syms) => {
  let s = 0; for (let i = 0; i < ring.length; i++) s += radius(syms[ring[i]]) + radius(syms[ring[(i + 1) % ring.length]]);
  return s / ring.length;
};
const centroidOf = (atoms, pos) => {
  let x = 0, y = 0, z = 0, c = 0;
  for (const a of atoms) if (pos[a]) { x += pos[a][0]; y += pos[a][1]; z += pos[a][2]; c++; }
  return c ? [x / c, y / c, z / c] : [0, 0, 0];
};

// place one ring system, then compute each ring atom's free (exocyclic) directions.
function placeRingSystem(sys, { syms, adj, sn, pos, dirs, dirPtr }) {
  const toPlace = [...sys.rings];
  const chair = toPlace.length === 1 && toPlace[0].length === 6
    && !ringHasDouble(toPlace[0], adj) && toPlace[0].every((a) => sn[a] === 4);

  const done = new Set();
  const first = toPlace.shift();
  if (chair) placeChair6(first, syms, pos); else placePolygon(first, syms, pos);
  first.forEach((a) => done.add(a));

  let guard = 0;
  while (toPlace.length && guard++ < 64) {
    const idx = toPlace.findIndex((r) => sharedEdge(r, done).length === 2);
    if (idx === -1) throw new Error('unsupported ring fusion (spiro/bridged/non-edge)');
    const ring = toPlace.splice(idx, 1)[0];
    placeFusedPolygon(ring, sharedEdge(ring, done), syms, pos, centroidOf(done, pos));
    ring.forEach((a) => done.add(a));
  }

  for (const a of done) {
    const ringNbrs = adj[a].filter(({ to }) => done.has(to)).map(({ to }) => norm(sub(pos[to], pos[a])));
    const planar = sys.rings.some((r) => r.includes(a) && ringHasDouble(r, adj));
    dirs[a] = exocyclicDirs(ringNbrs, sn[a], planar);
    dirPtr[a] = 0;
  }
}

function placePolygon(ring, syms, pos) {
  const k = ring.length, s = meanRingBond(ring, syms), R = s / (2 * Math.sin(Math.PI / k));
  for (let i = 0; i < k; i++) { const th = (i / k) * 2 * Math.PI; pos[ring[i]] = [R * Math.cos(th), R * Math.sin(th), 0]; }
}

// idealized chair: alternating ±z pucker, horizontal radius set so adjacent C–C = bond length.
function placeChair6(ring, syms, pos) {
  const s = meanRingBond(ring, syms), c = 0.25 * s, r = Math.sqrt(Math.max(0, s * s - 4 * c * c));
  for (let i = 0; i < 6; i++) { const th = (i / 6) * 2 * Math.PI; pos[ring[i]] = [r * Math.cos(th), r * Math.sin(th), i % 2 ? -c : c]; }
}

// two placed, ring-adjacent atoms shared with an already-placed ring (a fused edge), else [].
function sharedEdge(ring, done) {
  const k = ring.length;
  for (let i = 0; i < k; i++) { const a = ring[i], b = ring[(i + 1) % k]; if (done.has(a) && done.has(b)) return [a, b]; }
  return [];
}

// build a regular k-gon on the shared edge [A,B], coplanar (z=0), bulging away from the placed centroid.
function placeFusedPolygon(ring, [A, B], syms, pos, placedCentroid) {
  const k = ring.length, PA = pos[A], PB = pos[B];
  const s = Math.hypot(...sub(PB, PA)), R = s / (2 * Math.sin(Math.PI / k)), apo = R * Math.cos(Math.PI / k);
  const M = scl(add(PA, PB), 0.5), e = norm(sub(PB, PA));
  let p = norm([-e[1], e[0], 0]);
  if (dot(p, sub(placedCentroid, M)) > 0) p = scl(p, -1);   // push the new ring away from the old one
  const C = add(M, scl(p, apo));
  const seq = orderRingFrom(ring, A, B);                    // [A, …new…, B] the long way round
  const TWO = 2 * Math.PI, wrap = (x) => ((x % TWO) + TWO) % TWO, step = TWO / k;
  const angA = Math.atan2(PA[1] - C[1], PA[0] - C[0]), angB = Math.atan2(PB[1] - C[1], PB[0] - C[0]);
  const dAB = wrap(angB - angA);
  const dir = Math.abs(dAB - step) < Math.abs(dAB - (TWO - step)) ? -1 : 1;  // long way is opposite the shared edge
  for (let i = 1; i <= k - 2; i++) { const th = angA + dir * i * step; pos[seq[i]] = [C[0] + R * Math.cos(th), C[1] + R * Math.sin(th), 0]; }
}

// ring cycle starting at A, traversed AWAY from B, so the sequence ends at B (the long path).
function orderRingFrom(ring, A, B) {
  const k = ring.length, iA = ring.indexOf(A), seq = [];
  const back = ring[(iA + 1) % k] === B;                    // is B the forward neighbour?
  for (let i = 0; i < k; i++) seq.push(ring[((back ? iA - i : iA + i) % k + k) % k]);
  return seq;
}

// the free bonding directions left at a ring atom after its ring bonds, by steric class.
function exocyclicDirs(ringNbrs, sn, planar) {
  if (ringNbrs.length === 2) {
    const [a, b] = ringNbrs, m = norm(scl(add(a, b), -1));
    if (planar || sn <= 3) return [m];                       // sp²/aromatic: one in-plane radial slot
    const nrm = norm(cross(a, b));                           // sp³: axial + equatorial
    return [add(scl(m, 0.5774), scl(nrm, 0.8165)), add(scl(m, 0.5774), scl(nrm, -0.8165))];
  }
  if (ringNbrs.length === 3) {                               // ring-fusion atom
    const sum = norm(scl(ringNbrs.reduce(add, [0, 0, 0]), -1));
    return sn >= 4 ? [sum] : [];
  }
  return [];
}

// ── library: connectivity specs, expanded to 3D by the builder on lookup ──
// { atoms:[symbols], bonds:[[i,j,order?]] }. Rings perceived + placed by the ring engine above.
// (Explicit-coordinate entries are still supported by resolveMoleculeRecipe via { explicit:true, … }.)
const LIB = {
  // acyclic — VSEPR
  water: { atoms: ['O', 'H', 'H'], bonds: [[0, 1], [0, 2]] },
  methane: { atoms: ['C', 'H', 'H', 'H', 'H'], bonds: [[0, 1], [0, 2], [0, 3], [0, 4]] },
  ammonia: { atoms: ['N', 'H', 'H', 'H'], bonds: [[0, 1], [0, 2], [0, 3]] },
  'carbon-dioxide': { atoms: ['C', 'O', 'O'], bonds: [[0, 1, 2], [0, 2, 2]] },
  methanol: { atoms: ['C', 'O', 'H', 'H', 'H', 'H'], bonds: [[0, 1], [0, 2], [0, 3], [0, 4], [1, 5]] },
  ethanol: { atoms: ['C', 'C', 'O', 'H', 'H', 'H', 'H', 'H', 'H'], bonds: [[0, 1], [1, 2], [0, 3], [0, 4], [0, 5], [1, 6], [1, 7], [2, 8]] },
  ethane: { atoms: ['C', 'C', 'H', 'H', 'H', 'H', 'H', 'H'], bonds: [[0, 1], [0, 2], [0, 3], [0, 4], [1, 5], [1, 6], [1, 7]] },
  formaldehyde: { atoms: ['C', 'O', 'H', 'H'], bonds: [[0, 1, 2], [0, 2], [0, 3]] },
  ethylene: { atoms: ['C', 'C', 'H', 'H', 'H', 'H'], bonds: [[0, 1, 2], [0, 2], [0, 3], [1, 4], [1, 5]] },
  acetylene: { atoms: ['C', 'C', 'H', 'H'], bonds: [[0, 1, 3], [0, 2], [1, 3]] },
  'hydrogen-cyanide': { atoms: ['H', 'C', 'N'], bonds: [[0, 1], [1, 2, 3]] },

  // rings — perceived + placed (planar aromatic / chair / fused)
  benzene: {
    atoms: ['C', 'C', 'C', 'C', 'C', 'C', 'H', 'H', 'H', 'H', 'H', 'H'],
    bonds: [[0, 1, 2], [1, 2, 1], [2, 3, 2], [3, 4, 1], [4, 5, 2], [5, 0, 1], [0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]],
  },
  cyclohexane: {
    atoms: ['C', 'C', 'C', 'C', 'C', 'C', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
    bonds: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0],
      [0, 6], [0, 7], [1, 8], [1, 9], [2, 10], [2, 11], [3, 12], [3, 13], [4, 14], [4, 15], [5, 16], [5, 17]],
  },
  cyclopentane: {
    atoms: ['C', 'C', 'C', 'C', 'C', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
    bonds: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0],
      [0, 5], [0, 6], [1, 7], [1, 8], [2, 9], [2, 10], [3, 11], [3, 12], [4, 13], [4, 14]],
  },
  pyridine: {
    atoms: ['N', 'C', 'C', 'C', 'C', 'C', 'H', 'H', 'H', 'H', 'H'],
    bonds: [[0, 1, 2], [1, 2, 1], [2, 3, 2], [3, 4, 1], [4, 5, 2], [5, 0, 1], [1, 6], [2, 7], [3, 8], [4, 9], [5, 10]],
  },
  pyrimidine: {
    atoms: ['N', 'C', 'N', 'C', 'C', 'C', 'H', 'H', 'H', 'H'],
    bonds: [[0, 1, 2], [1, 2, 1], [2, 3, 2], [3, 4, 1], [4, 5, 2], [5, 0, 1], [1, 6], [3, 7], [4, 8], [5, 9]],
  },
  pyrrole: {
    atoms: ['N', 'C', 'C', 'C', 'C', 'H', 'H', 'H', 'H', 'H'],
    bonds: [[0, 1, 1], [1, 2, 2], [2, 3, 1], [3, 4, 2], [4, 0, 1], [0, 5], [1, 6], [2, 7], [3, 8], [4, 9]],
  },
  furan: {
    atoms: ['O', 'C', 'C', 'C', 'C', 'H', 'H', 'H', 'H'],
    bonds: [[0, 1, 1], [1, 2, 2], [2, 3, 1], [3, 4, 2], [4, 0, 1], [1, 5], [2, 6], [3, 7], [4, 8]],
  },
  imidazole: {
    atoms: ['N', 'C', 'N', 'C', 'C', 'H', 'H', 'H', 'H'],
    bonds: [[0, 1, 1], [1, 2, 2], [2, 3, 1], [3, 4, 2], [4, 0, 1], [0, 5], [1, 6], [3, 7], [4, 8]],
  },
  naphthalene: {
    atoms: ['C', 'C', 'C', 'C', 'C', 'C', 'C', 'C', 'C', 'C', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
    bonds: [[0, 1, 2], [1, 2, 1], [2, 3, 2], [3, 4, 1], [4, 5, 1], [5, 6, 2], [6, 7, 1], [7, 8, 2], [8, 9, 1], [9, 0, 1], [4, 9, 2],
      [0, 10], [1, 11], [2, 12], [3, 13], [5, 14], [6, 15], [7, 16], [8, 17]],
  },
  // 1,3,7-trimethylxanthine — fused pyrimidinedione (6) + imidazole (5), three N-methyls, two C=O
  caffeine: {
    atoms: ['N', 'C', 'O', 'N', 'C', 'C', 'C', 'O', 'N', 'C', 'N', 'C', 'C', 'C',
      'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
    bonds: [
      [0, 1, 1], [1, 3, 1], [3, 4, 1], [4, 5, 2], [5, 6, 1], [6, 0, 1],   // 6-ring
      [1, 2, 2], [6, 7, 2],                                               // carbonyls
      [5, 8, 1], [8, 9, 1], [9, 10, 2], [10, 4, 1],                       // 5-ring
      [0, 11], [3, 12], [8, 13],                                          // N-methyls
      [9, 14],                                                            // C8–H
      [11, 15], [11, 16], [11, 17], [12, 18], [12, 19], [12, 20], [13, 21], [13, 22], [13, 23],
    ],
  },
};

export const MOLECULE_LIBRARY = LIB;
export const MOLECULE_NAMES = Object.keys(LIB);
const normName = (s) => String(s || '').trim().toLowerCase().replace(/[\s_]+/g, '-');

// connectivity-authoring mode: atoms given as bare symbols, or as objects with NO `pos` at all. A
// `pos` that is present but malformed is an explicit-coordinate error — left for molecule-view's
// own validation to reject, NOT silently rebuilt.
function needsBuild(atoms) {
  return atoms.some((a) => typeof a === 'string' || (a && typeof a === 'object' && a.pos === undefined));
}

/**
 * The single seam molecule-view calls before planning. Resolves the three author modes into a recipe
 * whose atoms all carry numeric `pos`:
 *   • recipe.library:'water'  → library lookup (VSEPR-built or explicit)
 *   • atoms as symbols / atoms without pos → VSEPR build from connectivity
 *   • atoms with explicit pos → returned unchanged (today's behaviour)
 */
export function resolveMoleculeRecipe(recipe = {}) {
  if (recipe.library != null) {
    const entry = LIB[normName(recipe.library)];
    if (!entry) throw new Error(`unknown molecule library entry '${recipe.library}' (known: ${MOLECULE_NAMES.join(', ')})`);
    if (entry.explicit) {
      const { library, ...rest } = recipe;
      return { ...rest, atoms: entry.atoms.map((a) => ({ ...a })), bonds: entry.bonds.map((b) => ({ ...b })) };
    }
    const built = buildMoleculeGeometry({ atoms: entry.atoms, bonds: entry.bonds });
    const { library, ...rest } = recipe;
    return { ...rest, atoms: built.atoms, bonds: built.bonds };
  }

  const atoms = Array.isArray(recipe.atoms) ? recipe.atoms : [];
  if (atoms.length && needsBuild(atoms)) {
    const built = buildMoleculeGeometry({ atoms, bonds: Array.isArray(recipe.bonds) ? recipe.bonds : [] });
    return { ...recipe, atoms: built.atoms, bonds: built.bonds };
  }
  return recipe;
}

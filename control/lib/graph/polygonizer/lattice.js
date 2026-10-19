/**
 * THE LATTICE — mandala-space tiled: a board's cells, corners and edges, and the relations between them. Manji gives
 * the cardinal frame and named points but no relations (no adjacency, no shared edge, no tiling); the pattern cards
 * `hex-tessellation` and `constellation-chain` name that intent. This is their code: a board is a connection of tiles,
 * and a piece may stand on a cell (chess), a corner (a settlement) or an edge (a road).
 *
 * Pure numbers and plain JSON; imports nothing. The frame is mandala-space's: x east, y north, z up along the meru,
 * 1 unit = 1 m, the board centred on the origin.
 *
 *   lattice({ shape, orient?, cols?, rows?, radius?, heights?, types?, omit?, cell?, step? }) → L
 *     shape 'square' | 'hex'; orient 'pointy' (rows run east, the default) | 'flat' (columns run north), hex only
 *     cols × rows the rectangle (hex in offset coordinates, odd rows east for pointy, odd columns north for flat), or
 *     radius n (hex) a hexagon of hexes (radius 2 is nineteen), or rhombus n (hex) a rhombus n cells a side; heights[r][c] whole steps, null for no cell (rows from
 *     the south, so heights[0] is row 1), or { <name>: steps }; types the same shape (a string a cell carries);
 *     omit: [names] cells left out; cell the centre-to-centre distance in metres (1); step a height step (cell / 4)
 *   L: { shape, orient?, cols, rows, cell, step, size: [w, d], dirs, diags, cells, corners, edges }
 *     dirs: [{ name, angle, v, rot, mirror }] the ways to a neighbour across an edge, counter-clockwise from east; v the
 *       lattice vector, rot the index a quarter turn (square) or a sixth (hex) further, mirror the index across N-S
 *       square E N W S; pointy hex E NE NW W SW SE; flat hex NE N NW SW S SE
 *     diags: the same, the ways out through a corner (to the cell sharing only that corner on a square, the cell two
 *       steps away across it on a hex), its vector the sum of the two dirs either side
 *       square NE NW SW SE; pointy hex ENE N WNW WSW S ESE; flat hex NNE NNW W SSW SSE E
 *     cell: { name, v, at: [x, y, z], h, type?, n: [cell | -1 per dir], d: [cell | -1 per diag], k: [corner per diag],
 *             e: [edge per dir] }   v the lattice coordinate (square [c, r]; hex axial [q, r]); corner k lies between
 *             edge k and edge k + 1, counter-clockwise, so edge k runs from corner k - 1 to corner k
 *     corner: { name, at, cells: [i], edges: [i] }   edge: { name, at, ends: [corner, corner], cells: [i] (one on the rim) }
 *     a corner or edge stands as high as the highest cell it touches
 *
 * Names: a cell by column letter and row number ('C4': column C from the west, row 4 from the south); a corner or edge
 * by any cell it touches and the way to it in lower case ('C4.ne' a square's corner, 'C4.n' its edge; on a pointy hex
 * 'C4.n' is a corner and 'C4.ne' an edge). The name kept is the first cell's; every alias resolves to the same record.
 *
 *   address(L, 'C4' | 'C4.ne') → { kind: 'cell' | 'corner' | 'edge', i } | null
 *   cellAt(L, 'C4' | v) → i | -1
 *   vecOf(L, 'N' | v) → v                 a dir or diag by name, or a lattice vector as given
 *   step(L, i, 'N') → i | -1              the neighbour that way (a dir or a diag)
 *   shift(L, i, v) → i | -1               the cell a lattice vector away (a knight's (1, 2)), holes and all
 *   ray(L, i, v) → [i]                    shift again and again until off the board (a rook's slide); not past a hole
 *   rotate(L, v, k = 1) / mirror(L, v)    a vector turned k steps counter-clockwise / reflected across N-S
 *   orbit(L, v, { reflect = true }) → [v] its images under the lattice's turns (and reflections), each once, in order
 *   distance(L, a, b, { diagonal }) → n   steps on the lattice (a square counts a diagonal as one when `diagonal`)
 *   euler(L) → corners - edges + cells    1 for a board in one piece without holes, one less for each hole
 *   latticeLaws(L) → [string]             what fails among the relations' invariants (empty when sound)
 */

const SQ3 = Math.sqrt(3);
const round = (x) => (Math.round(x * 1e6) / 1e6) || 0;

// Each frame: the dirs and the corner ways, counter-clockwise, corner k between dir k and dir k + 1.
const FRAMES = {
  square: {
    dirs: [['E', 0, [1, 0]], ['N', 90, [0, 1]], ['W', 180, [-1, 0]], ['S', 270, [0, -1]]],
    diags: [['NE', 45], ['NW', 135], ['SW', 225], ['SE', 315]],
  },
  pointy: {
    dirs: [['E', 0, [1, 0]], ['NE', 60, [0, 1]], ['NW', 120, [-1, 1]], ['W', 180, [-1, 0]], ['SW', 240, [0, -1]], ['SE', 300, [1, -1]]],
    diags: [['ENE', 30], ['N', 90], ['WNW', 150], ['WSW', 210], ['S', 270], ['ESE', 330]],
  },
  flat: {
    dirs: [['NE', 30, [1, 0]], ['N', 90, [0, 1]], ['NW', 150, [-1, 1]], ['SW', 210, [-1, 0]], ['S', 270, [0, -1]], ['SE', 330, [1, -1]]],
    diags: [['NNE', 60], ['NNW', 120], ['W', 180], ['SSW', 240], ['SSE', 300], ['E', 0]],
  },
};

function frameOf(shape, orient) {
  const F = FRAMES[shape === 'square' ? 'square' : orient];
  const n = F.dirs.length;
  const mirrorOf = (list, a) => list.findIndex(([, b]) => b === (540 - a) % 360);
  const dirs = F.dirs.map(([name, angle, v], i) => ({ name, angle, v, rot: (i + 1) % n, mirror: mirrorOf(F.dirs, angle) }));
  const diags = F.diags.map(([name, angle], i) => {
    const a = F.dirs[i][2], b = F.dirs[(i + 1) % n][2];
    return { name, angle, v: [a[0] + b[0], a[1] + b[1]], rot: (i + 1) % n, mirror: mirrorOf(F.diags, angle) };
  });
  return { dirs, diags };
}

// Lattice coordinate → plan point, before centring. Square [c, r]; hex axial [q, r].
function planOf(shape, orient, cell) {
  if (shape === 'square') return ([a, b]) => [a * cell, b * cell];
  if (orient === 'pointy') return ([q, r]) => [cell * (q + r / 2), cell * (SQ3 / 2) * r];
  return ([q, r]) => [cell * (SQ3 / 2) * q, cell * (r + q / 2)];
}

/** Column letters, A … Z then AA, AB … */
export function columnName(c) {
  let s = '', n = c + 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

// The cells present: [{ c, r, v }] in row order from the south, west to east, and the rectangle they sit in.
function layout(spec, shape, orient) {
  const hexV = orient === 'pointy' ? (c, r) => [c - Math.floor(r / 2), r] : (c, r) => [c, r - Math.floor(c / 2)];
  const vOf = shape === 'square' ? (c, r) => [c, r] : hexV;
  if (spec.rhombus !== undefined) {
    if (shape !== 'hex') throw new Error('lattice: rhombus makes a rhombus of hexes; a square board takes cols and rows');
    const n = spec.rhombus;
    if (!Number.isInteger(n) || n < 1) throw new Error('lattice: rhombus is a whole number of cells a side, 1 or more');
    // axial q and r each 0 … n - 1, laid into offset coordinates and slid so the least column (pointy) or row (flat) is 0
    const off = [];
    for (let r = 0; r < n; r += 1) for (let q = 0; q < n; q += 1) off.push(orient === 'pointy' ? [q + Math.floor(r / 2), r] : [q, r + Math.floor(q / 2)]);
    const minC = Math.min(...off.map((o) => o[0])), minR = Math.min(...off.map((o) => o[1]));
    const set = new Set(off.map(([c, r]) => `${c - minC},${r - minR}`));
    const cols = Math.max(...off.map((o) => o[0])) - minC + 1, rows = Math.max(...off.map((o) => o[1])) - minR + 1;
    const at = [];
    for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) if (set.has(`${c},${r}`)) at.push({ c, r, v: vOf(c, r) });
    return { cols, rows, at };
  }
  if (spec.radius !== undefined) {
    if (shape !== 'hex') throw new Error('lattice: radius makes a hexagon of hexes; a square board takes cols and rows');
    const R = spec.radius;
    if (!Number.isInteger(R) || R < 0) throw new Error('lattice: radius is a whole number of rings, 0 or more');
    // Centred axial cells, laid into offset coordinates and slid so the least column (pointy) or row (flat) is 0.
    const raw = [];
    for (let r = -R; r <= R; r += 1) for (let q = -R; q <= R; q += 1) if (Math.abs(q + r) <= R) raw.push([q, r]);
    const off = raw.map(([q, r]) => (orient === 'pointy'
      ? [q + Math.floor((r + R) / 2), r + R] : [q + R, r + Math.floor((q + R) / 2)]));
    const minC = Math.min(...off.map((o) => o[0])), minR = Math.min(...off.map((o) => o[1]));
    const set = new Set(off.map(([c, r]) => `${c - minC},${r - minR}`));
    const cols = Math.max(...off.map((o) => o[0])) - minC + 1, rows = Math.max(...off.map((o) => o[1])) - minR + 1;
    const at = [];
    for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) if (set.has(`${c},${r}`)) at.push({ c, r, v: vOf(c, r) });
    return { cols, rows, at };
  }
  const grid = Array.isArray(spec.heights) ? spec.heights : null;
  const rows = spec.rows ?? grid?.length, cols = spec.cols ?? (grid ? Math.max(...grid.map((row) => row.length)) : undefined);
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1) {
    throw new Error('lattice: a board needs cols and rows (whole numbers, 1 or more), a heights grid, or a radius (hex)');
  }
  const at = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (grid && (grid[r]?.[c] === null || grid[r]?.[c] === undefined)) continue;
      at.push({ c, r, v: vOf(c, r) });
    }
  }
  return { cols, rows, at };
}

function readCellValue(table, name, c, r) {
  if (table === undefined || table === null) return undefined;
  if (Array.isArray(table)) return table[r]?.[c] ?? undefined;
  return table[name];
}

export function lattice(spec = {}) {
  const shape = spec.shape ?? 'square';
  if (shape !== 'square' && shape !== 'hex') throw new Error(`lattice: shape is 'square' or 'hex', not '${shape}'`);
  const orient = shape === 'hex' ? (spec.orient ?? 'pointy') : undefined;
  if (shape === 'hex' && orient !== 'pointy' && orient !== 'flat') throw new Error(`lattice: a hex board is 'pointy' or 'flat', not '${orient}'`);
  const cell = spec.cell ?? 1, step = spec.step ?? cell / 4;
  if (!(cell > 0) || !(step >= 0)) throw new Error('lattice: cell is a distance above 0, step one of 0 or more');
  const { dirs, diags } = frameOf(shape, orient);
  const { cols, rows, at } = layout(spec, shape, orient);
  const omit = new Set(spec.omit ?? []);
  const present = at.filter(({ c, r }) => !omit.has(`${columnName(c)}${r + 1}`));
  if (!present.length) throw new Error('lattice: every cell is left out');

  // Plan points, centred on the middle of the cells' span.
  const plan = planOf(shape, orient, cell);
  const pts = present.map(({ v }) => plan(v));
  const mid = [0, 1].map((k) => round((Math.min(...pts.map((p) => p[k])) + Math.max(...pts.map((p) => p[k]))) / 2));
  const place = (v, m) => { const [x, y] = plan([v[0] / m, v[1] / m]); return [round(x - mid[0]), round(y - mid[1])]; };

  const cells = present.map(({ c, r, v }) => {
    const name = `${columnName(c)}${r + 1}`;
    const hv = readCellValue(spec.heights, name, c, r);
    const h = Number.isFinite(hv) ? hv : 0;
    const type = readCellValue(spec.types, name, c, r);
    return { name, v, at: [...place(v, 1), round(h * step)], h, ...(type !== undefined ? { type } : {}), n: [], d: [], k: [], e: [] };
  });
  const byV = new Map(cells.map((cl, i) => [`${cl.v[0]},${cl.v[1]}`, i]));
  const vAt = (v) => byV.get(`${v[0]},${v[1]}`) ?? -1;

  // Corners and edges keyed on exact lattice multiples: a corner sits 1/2 (square) or 1/3 (hex) of the way along a
  // diag, an edge 1/2 of the way along a dir, so cells that share one compute the same whole-number key.
  const m = shape === 'square' ? 2 : 3;
  const corners = [], edges = [], cornerKey = new Map(), edgeKey = new Map();
  cells.forEach((cl, i) => {
    diags.forEach((dg) => {
      const key = `${m * cl.v[0] + dg.v[0]},${m * cl.v[1] + dg.v[1]}`;
      let id = cornerKey.get(key);
      if (id === undefined) {
        id = corners.length;
        cornerKey.set(key, id);
        corners.push({ name: `${cl.name}.${dg.name.toLowerCase()}`, at: place([m * cl.v[0] + dg.v[0], m * cl.v[1] + dg.v[1]], m), cells: [], edges: [] });
      }
      corners[id].cells.push(i);
      cl.k.push(id);
    });
    dirs.forEach((dr, k) => {
      const key = `${2 * cl.v[0] + dr.v[0]},${2 * cl.v[1] + dr.v[1]}`;
      let id = edgeKey.get(key);
      if (id === undefined) {
        id = edges.length;
        edgeKey.set(key, id);
        const ends = [cl.k[(k + dirs.length - 1) % dirs.length], cl.k[k]];
        edges.push({ name: `${cl.name}.${dr.name.toLowerCase()}`, at: place([2 * cl.v[0] + dr.v[0], 2 * cl.v[1] + dr.v[1]], 2), ends, cells: [] });
      }
      edges[id].cells.push(i);
      cl.e.push(id);
      cl.n.push(vAt([cl.v[0] + dr.v[0], cl.v[1] + dr.v[1]]));
    });
    diags.forEach((dg) => cl.d.push(vAt([cl.v[0] + dg.v[0], cl.v[1] + dg.v[1]])));
  });
  edges.forEach((ed, id) => ed.ends.forEach((k) => corners[k].edges.push(id)));

  // A corner or an edge stands as high as the highest cell it touches.
  const top = (list) => Math.max(...list.map((i) => cells[i].at[2]));
  corners.forEach((cr) => { cr.at.push(top(cr.cells)); });
  edges.forEach((ed) => { ed.at.push(top(ed.cells)); });

  const xs = corners.map((cr) => cr.at[0]), ys = corners.map((cr) => cr.at[1]);
  const size = [round(Math.max(...xs) - Math.min(...xs)), round(Math.max(...ys) - Math.min(...ys))];
  return { shape, ...(orient ? { orient } : {}), cols, rows, cell, step, size, dirs, diags, cells, corners, edges };
}

// ── queries ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const INDEX = new WeakMap();
function indexOf(L) {
  let ix = INDEX.get(L);
  if (ix) return ix;
  const byV = new Map(L.cells.map((cl, i) => [`${cl.v[0]},${cl.v[1]}`, i]));
  const byName = new Map();
  L.cells.forEach((cl, i) => {
    byName.set(cl.name, { kind: 'cell', i });
    L.diags.forEach((dg, k) => byName.set(`${cl.name}.${dg.name.toLowerCase()}`, { kind: 'corner', i: cl.k[k] }));
    L.dirs.forEach((dr, k) => byName.set(`${cl.name}.${dr.name.toLowerCase()}`, { kind: 'edge', i: cl.e[k] }));
  });
  const ways = new Map([...L.dirs, ...L.diags].map((w) => [w.name, w.v]));
  ix = { byV, byName, ways };
  INDEX.set(L, ix);
  return ix;
}

export function address(L, name) {
  const hit = indexOf(L).byName.get(String(name));
  return hit ? { ...hit } : null;
}

export function cellAt(L, ref) {
  if (Array.isArray(ref)) return indexOf(L).byV.get(`${ref[0]},${ref[1]}`) ?? -1;
  const hit = indexOf(L).byName.get(String(ref));
  return hit?.kind === 'cell' ? hit.i : -1;
}

export function vecOf(L, way) {
  if (Array.isArray(way)) return way;
  const v = indexOf(L).ways.get(way);
  if (!v) throw new Error(`lattice: no way '${way}' on a ${L.orient ?? ''}${L.orient ? ' ' : ''}${L.shape} board (ways: ${[...indexOf(L).ways.keys()].join(', ')})`);
  return v;
}

export function shift(L, i, way) {
  const v = vecOf(L, way), at = L.cells[i]?.v;
  if (!at) return -1;
  return cellAt(L, [at[0] + v[0], at[1] + v[1]]);
}

export function step(L, i, way) {
  const dk = L.dirs.findIndex((d) => d.name === way);
  if (dk >= 0) return L.cells[i]?.n[dk] ?? -1;
  const gk = L.diags.findIndex((d) => d.name === way);
  if (gk >= 0) return L.cells[i]?.d[gk] ?? -1;
  return shift(L, i, way);
}

export function ray(L, i, way) {
  const v = vecOf(L, way), out = [];
  if (!v[0] && !v[1]) return out;
  for (let j = shift(L, i, v); j >= 0; j = shift(L, j, v)) out.push(j);
  return out;
}

export function rotate(L, v, k = 1) {
  const n = L.dirs.length, turns = ((k % n) + n) % n;
  let [a, b] = v;
  for (let t = 0; t < turns; t += 1) [a, b] = L.shape === 'square' ? [-b, a] : [-b, a + b];
  return [a || 0, b || 0];
}

export function mirror(L, [a, b]) {
  const out = L.shape === 'square' ? [-a, b] : L.orient === 'pointy' ? [-a - b, b] : [-a, a + b];
  return [out[0] || 0, out[1] || 0];
}

export function orbit(L, v, { reflect = true } = {}) {
  const seen = new Set(), out = [];
  const add = (w) => { const key = `${w[0]},${w[1]}`; if (!seen.has(key)) { seen.add(key); out.push(w); } };
  const base = vecOf(L, v);
  for (let k = 0; k < L.dirs.length; k += 1) add(rotate(L, base, k));
  if (reflect) for (let k = 0; k < L.dirs.length; k += 1) add(rotate(L, mirror(L, base), k));
  return out;
}

export function distance(L, a, b, { diagonal = false } = {}) {
  const [p, q] = [L.cells[a].v, L.cells[b].v];
  const dx = q[0] - p[0], dy = q[1] - p[1];
  if (L.shape === 'square') return diagonal ? Math.max(Math.abs(dx), Math.abs(dy)) : Math.abs(dx) + Math.abs(dy);
  return (Math.abs(dx) + Math.abs(dy) + Math.abs(dx + dy)) / 2;
}

export function euler(L) {
  return L.corners.length - L.edges.length + L.cells.length;
}

export function latticeLaws(L) {
  const out = [], n = L.dirs.length, most = L.shape === 'square' ? 4 : 3;
  L.cells.forEach((cl, i) => {
    cl.n.forEach((j, k) => {
      if (j < 0) return;
      const back = (k + n / 2) % n;
      if (L.cells[j].n[back] !== i) out.push(`${cl.name} reaches ${L.cells[j].name} going ${L.dirs[k].name}, but not back going ${L.dirs[back].name}`);
      if (L.cells[j].e[back] !== cl.e[k]) out.push(`${cl.name} and ${L.cells[j].name} do not share the edge between them`);
    });
    cl.e.forEach((id, k) => {
      const ed = L.edges[id], k0 = cl.k[(k + n - 1) % n], k1 = cl.k[k];
      if (!(ed.ends.includes(k0) && ed.ends.includes(k1))) out.push(`${cl.name}'s ${L.dirs[k].name} edge does not join its corners either side`);
    });
  });
  L.edges.forEach((ed) => {
    if (ed.cells.length < 1 || ed.cells.length > 2) out.push(`edge ${ed.name} borders ${ed.cells.length} cells`);
    if (ed.ends[0] === ed.ends[1]) out.push(`edge ${ed.name} joins a corner to itself`);
  });
  L.corners.forEach((cr) => {
    if (cr.cells.length < 1 || cr.cells.length > most) out.push(`corner ${cr.name} touches ${cr.cells.length} cells`);
    if (cr.edges.length < 2 || cr.edges.length > 4) out.push(`corner ${cr.name} meets ${cr.edges.length} edges`);
  });
  for (const [name, hit] of indexOf(L).byName) {
    const rec = hit.kind === 'cell' ? L.cells[hit.i] : hit.kind === 'corner' ? L.corners[hit.i] : L.edges[hit.i];
    if (!rec) out.push(`${name} names no ${hit.kind}`);
  }
  return out;
}

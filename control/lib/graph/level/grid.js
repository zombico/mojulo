/**
 * THE GLYPH GRID — a map level written as a small grid of characters, one SQUARE tile each, the way a floorplan is
 * written in room glyphs. Every tile is the same square, so tiles always sit side by side: no tile lies over another,
 * and every seam is a shared edge.
 *
 *   grid: {
 *     tile?: 48,                     // metres a side (GRID_TILE)
 *     rows: [                        // north row first; a space between glyphs is allowed and ignored
 *       '. . # . .',
 *       '. t # t .',
 *       '# # # # #',
 *       '. . # . S',
 *     ],
 *     key?: { <glyph>: <what stands on it> },   // the PLACES the geocube lays round the paths (a town block, a
 *   }                                           // building, a wood…); '#' a path and '.' open land are always known
 *
 * A PATH tile's shape is SOLVED from its path neighbours, never written: its open edges are the sides a path tile
 * (or a place a path reaches: a building's door) lies on. One edge open is an END, two opposite an I, two adjacent an
 * L, three a T, four an X; the shape's turn says which edges (the I running north–south or east–west, the L's
 * corner, the T's stem). A path crosses an edge at its middle, so two tiles' paths always meet.
 *
 *   readGrid(g)  → { tile, rows, cols, cells: [{ r, c, glyph, kind: 'path' | 'land' | 'place', place?, shape?, open?,
 *                   turn? }], at(r, c) }
 *   SHAPES       the shapes by their open edges
 *
 * Coordinates: column c runs east (+x), row r runs south (−y): the tile (r, c) has its centre at
 * (c + ½, −(r + ½)) × tile on the level's frame, north up. Pure.
 */

export const GRID_TILE = Object.freeze({ d: 48, lo: 24, hi: 96 });
export const GRID_GLYPHS = Object.freeze({ path: '#', land: '.' });
// a tile's sides, clockwise from north: their unit step on the grid (row, column)
export const SIDES = Object.freeze({ n: [-1, 0], e: [0, 1], s: [1, 0], w: [0, -1] });
const ORDER = ['n', 'e', 's', 'w'];

/** The shapes by their open edges, and which way each is turned (its open edges, clockwise from north). */
export const SHAPES = Object.freeze({
  end: 'one edge open: the path stops in the tile (a place reached, a dead end, a lookout)',
  I: 'two opposite edges: the path runs straight through',
  L: 'two adjacent edges: the path turns a corner',
  T: 'three edges: the path forks (a Y where the art wants it)',
  X: 'four edges: a crossing',
});

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const GLYPH = /^[A-Za-z#.]$/;

/** The shape of a path tile from its open edges (a set of side names). */
export function shapeOf(open) {
  const n = open.length;
  if (n === 0) return null;
  if (n === 1) return 'end';
  if (n === 2) { const [a, b] = open.map((s) => ORDER.indexOf(s)); return (b - a) % 2 === 0 ? 'I' : 'L'; }
  return n === 3 ? 'T' : 'X';
}

export function readGrid(g, at = 'grid') {
  if (!isObj(g)) throw new Error(`level: ${at} is { tile?, rows, key? }`);
  for (const k of Object.keys(g)) if (!['tile', 'rows', 'key'].includes(k)) throw new Error(`level: ${at}.${k} is not a grid setting (settings: tile, rows, key)`);
  const tile = g.tile ?? GRID_TILE.d;
  if (!(Number.isFinite(tile) && tile >= GRID_TILE.lo && tile <= GRID_TILE.hi)) throw new Error(`level: ${at}.tile is a tile's side in metres, ${GRID_TILE.lo} to ${GRID_TILE.hi}`);
  if (!Array.isArray(g.rows) || !g.rows.length || !g.rows.every((r) => typeof r === 'string')) throw new Error(`level: ${at}.rows is the map written as rows of glyphs, north first ('#' a path, '.' open land)`);
  const rows = g.rows.map((r) => r.replace(/\s+/g, ''));
  const cols = rows[0].length;
  if (!cols || rows.some((r) => r.length !== cols)) throw new Error(`level: ${at}.rows are all one width (${rows.map((r) => r.length).join(', ')} glyphs)`);
  const key = g.key === undefined ? {} : g.key;
  if (!isObj(key)) throw new Error(`level: ${at}.key is { <glyph>: <what stands on it> }`);
  for (const k of Object.keys(key)) if (!/^[A-Za-z]$/.test(k)) throw new Error(`level: ${at}.key.${k}: a place's glyph is one letter ('#' and '.' are the path and open land)`);
  const glyphAt = (r, c) => (r >= 0 && c >= 0 && r < rows.length && c < cols ? rows[r][c] : null);
  // (every glyph read before any shape is solved: a place the key does not name is named as that)
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < cols; c++) {
    const glyph = rows[r][c];
    if (!GLYPH.test(glyph)) throw new Error(`level: ${at}.rows[${r}] column ${c + 1}: '${glyph}' is not a glyph (a letter, '#' a path, '.' open land)`);
    if (glyph !== GRID_GLYPHS.land && glyph !== GRID_GLYPHS.path && !Object.hasOwn(key, glyph)) throw new Error(`level: ${at}.rows[${r}] column ${c + 1}: '${glyph}' is a place the key does not name (key: ${Object.keys(key).join(', ') || 'none'})`);
  }
  const cells = [];
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < cols; c++) {
    const glyph = rows[r][c];
    if (!GLYPH.test(glyph)) throw new Error(`level: ${at}.rows[${r}] column ${c + 1}: '${glyph}' is not a glyph (a letter, '#' a path, '.' open land)`);
    if (glyph === GRID_GLYPHS.land) { cells.push({ r, c, glyph, kind: 'land' }); continue; }
    if (glyph !== GRID_GLYPHS.path) {
      if (!Object.hasOwn(key, glyph)) throw new Error(`level: ${at}.rows[${r}] column ${c + 1}: '${glyph}' is a place the key does not name (key: ${Object.keys(key).join(', ') || 'none'})`);
      // (a place a path reaches opens toward it: the sides its path neighbours lie on)
      const open = ORDER.filter((s) => glyphAt(r + SIDES[s][0], c + SIDES[s][1]) === GRID_GLYPHS.path);
      cells.push({ r, c, glyph, kind: 'place', place: key[glyph], open });
      continue;
    }
    // a PATH: open toward every side a path or a place lies on
    const open = ORDER.filter((s) => { const n = glyphAt(r + SIDES[s][0], c + SIDES[s][1]); return n === GRID_GLYPHS.path || (n !== null && n !== GRID_GLYPHS.land && Object.hasOwn(key, n)); });
    if (!open.length) throw new Error(`level: ${at}.rows[${r}] column ${c + 1}: a path tile that meets no other path nor place (a path runs somewhere)`);
    cells.push({ r, c, glyph, kind: 'path', shape: shapeOf(open), open });
  }
  // ONE NETWORK: every path and every place a path reaches is walked to from every other (a map is one level)
  const walk = cells.filter((x) => x.kind === 'path' || (x.kind === 'place' && x.open.length));
  if (walk.length) {
    const id = (x) => `${x.r},${x.c}`, seen = new Set([id(walk[0])]), queue = [walk[0]];
    const byId = new Map(walk.map((x) => [id(x), x]));
    while (queue.length) {
      const x = queue.shift();
      for (const s of x.open ?? []) { const y = byId.get(`${x.r + SIDES[s][0]},${x.c + SIDES[s][1]}`); if (y && !seen.has(id(y))) { seen.add(id(y)); queue.push(y); } }
    }
    const lost = walk.filter((x) => !seen.has(id(x)));
    if (lost.length) throw new Error(`level: ${at}: the paths are not one network (row ${lost[0].r + 1}, column ${lost[0].c + 1} is not reached from row ${walk[0].r + 1}, column ${walk[0].c + 1}); a map is one level, walked end to end`);
  }
  const at2 = (r, c) => cells[r * cols + c] ?? null;
  return { tile, rows: rows.length, cols, cells, at: at2 };
}

/** A tile's centre on the level's frame (north up: columns east, rows south). */
export const tileCentre = (G, r, c) => [(c + 0.5) * G.tile, -(r + 0.5) * G.tile];
/** The middle of a tile's side on the level's frame: where its path crosses it. */
export function sideMiddle(G, r, c, side) {
  const [x, y] = tileCentre(G, r, c), h = G.tile / 2, [dr, dc] = SIDES[side];
  return [x + dc * h, y - dr * h];
}

/**
 * THE TRAIL LIBRARY — the ways a block of a planned map (plan.js: a segment, size × size tiles) may be laid before its
 * author writes it: basic templates, each a shape of trail between the block's gates. A plan names one per block
 * (`key.<S>.fill`); a block that names none is laid `through`, as it always was. A template is a procedure over the
 * block's size and its gates, never a stored grid, so it fits any block: turned to whichever sides its gates are on.
 *
 *   through      gate to the middle to gate: a straight run, a bend, a fork or a crossing by its gates
 *   round        the way goes round the middle by one side, never through it: a hill, a grove or a pond is passed
 *   loop         a ring round the middle with every gate on it: two ways round, always
 *   spur         through, and a dead end off the middle toward a side with no gate: a find's place, a lookout
 *   crossroads   through, and a branch toward every side with no gate
 *   switchback   lanes back and forth between two opposite gates: a climb's way, a long walk in a small block
 *
 * THE RING lies one tile in from the block's border, so no template lays a path on a border but at a gate (a path there
 * would join a neighbour where the plan did not), and two templates side by side meet only at the plan's gates. A
 * template the block has no room or no gates for is laid as the nearest one that fits (`laid` says which): a switchback
 * wants an odd side of 7 or more and two opposite gates alone, else it is `round`; `round` wants two gates, else
 * `through`; a ring wants a side of 4.
 *
 *   BLOCK_FILLS                        { <id>: { reads, min } }
 *   layFill(n, gates, id?)             → { rows: [[glyph]], laid } the block's glyphs ('#' a path, '.' open land)
 *     gates: { in?, out?, more?: [side] }   the walk's way in and out, and its joins' sides
 * Pure: no dice.
 */
export const BLOCK_FILLS = Object.freeze({
  through: { min: 3, reads: 'gate to the middle to gate: a straight run, a bend, a fork or a crossing by its gates' },
  round: { min: 4, reads: 'the way goes round the middle by one side, never through it' },
  loop: { min: 4, reads: 'a ring round the middle, every gate on it: two ways round' },
  spur: { min: 5, reads: 'through, and a dead end off the middle toward a side with no gate' },
  crossroads: { min: 5, reads: 'through, and a branch toward every side with no gate' },
  switchback: { min: 7, reads: 'lanes back and forth between two opposite gates: a climb\'s way' },
});
export const BLOCK_FILL_IDS = Object.freeze(Object.keys(BLOCK_FILLS));

const ORDER = ['n', 'e', 's', 'w'], OPP = { n: 's', s: 'n', e: 'w', w: 'e' };
const mid = (n) => Math.floor((n - 1) / 2);
const gateOf = (n, s) => ({ n: [0, mid(n)], s: [n - 1, mid(n)], w: [mid(n), 0], e: [mid(n), n - 1] })[s];
// (the ring's tile a gate's tile steps onto)
const innerOf = (n, s) => ({ n: [1, mid(n)], s: [n - 2, mid(n)], w: [mid(n), 1], e: [mid(n), n - 2] })[s];
const blank = (n) => Array.from({ length: n }, () => Array(n).fill('.'));
const lay = (G, [r0, c0], [r1, c1]) => { for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r++) for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c++) G[r][c] = '#'; };

/** The ring one tile in from the border, clockwise from its north-west corner. */
export function blockRing(n) {
  const a = 1, b = n - 2, out = [];
  for (let c = a; c <= b; c++) out.push([a, c]);
  for (let r = a + 1; r <= b; r++) out.push([r, b]);
  for (let c = b - 1; c >= a; c--) out.push([b, c]);
  for (let r = b - 1; r > a; r--) out.push([r, a]);
  return out;
}

const through = (n, sides) => { const G = blank(n), m = [mid(n), mid(n)]; for (const s of sides) lay(G, gateOf(n, s), m); return G; };
// (a branch from the middle toward a side, stopping a tile short of the border)
const stub = (G, n, s) => lay(G, [mid(n), mid(n)], innerOf(n, s));
function ring(n, sides, cut) {
  const G = blank(n), R = blockRing(n), ix = (t) => R.findIndex((x) => x[0] === t[0] && x[1] === t[1]);
  const on = sides.map((s) => ix(innerOf(n, s))).sort((a, b) => a - b);
  let drop = new Set();
  // (round: the longest stretch of the ring between two gates is left out, so the way is one way)
  if (cut && on.length > 1) {
    let best = null;
    on.forEach((a, i) => { const b = on[(i + 1) % on.length], gap = (b - a + R.length) % R.length || R.length; if (!best || gap > best.gap) best = { a, gap }; });
    drop = new Set(Array.from({ length: best.gap - 1 }, (_, k) => (best.a + 1 + k) % R.length));
  }
  R.forEach(([r, c], i) => { if (!drop.has(i)) G[r][c] = '#'; });
  for (const s of sides) { const [r, c] = gateOf(n, s); G[r][c] = '#'; }
  return G;
}
// (west to east: lanes up and down the block at every other column, joined at the top and the bottom in turn)
function lanes(n) {
  const G = blank(n), m = mid(n), L = (n - 1) / 2, top = 1, bot = n - 2;
  for (let i = 0; i < L; i++) {
    const c = 2 * i + 1, first = i === 0, last = i === L - 1, fromTop = (L - 2) % 2 === 0;
    lay(G, [first ? top : last && !fromTop ? m : top, c], [first ? m : last && fromTop ? m : bot, c]);
    if (!last) G[i % 2 === 0 ? top : bot][c + 1] = '#';
  }
  G[m][0] = '#'; G[m][n - 1] = '#';
  return G;
}
const transpose = (G) => G.map((_, r) => G.map((row) => row[r]));

/** A block's glyphs by a template of the library; `laid` the template it was laid as. */
export function layFill(n, gates = {}, id = 'through') {
  if (!BLOCK_FILLS[id]) throw new Error(`level: '${id}' is no trail template (the library: ${BLOCK_FILL_IDS.join(', ')})`);
  const sides = ORDER.filter((s) => s === gates.in || s === gates.out || (gates.more ?? []).includes(s));
  const bare = ORDER.filter((s) => !sides.includes(s)), fits = (k) => n >= BLOCK_FILLS[k].min;
  let laid = id;
  if (laid === 'switchback' && !(fits('switchback') && n % 2 === 1 && sides.length === 2 && OPP[sides[0]] === sides[1])) laid = 'round';
  if (laid === 'round' && !(fits('round') && sides.length >= 2)) laid = 'through';
  if (laid !== 'through' && (!fits(laid) || !sides.length)) laid = 'through';
  if (laid === 'switchback') return { rows: sides.includes('w') ? lanes(n) : transpose(lanes(n)), laid };
  if (laid === 'round' || laid === 'loop') return { rows: ring(n, sides, laid === 'round'), laid };
  const G = through(n, sides);
  if (laid === 'spur' && bare.length) stub(G, n, bare[0]);
  if (laid === 'crossroads') for (const s of bare) stub(G, n, s);
  return { rows: G, laid };
}

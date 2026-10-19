/**
 * SETTLERS (of the island kind), without trading, written in the tabletop kernel's words. Nineteen hexes dealt from a
 * seed; settlements and cities on corners, roads on edges, the robber on a cell; two dice, production, the seven (half
 * a hand over seven given up, the robber moved, a card stolen); development cards (knights, victory points, road
 * building, year of plenty, monopoly), the longest road and the largest army; ten points on one's own turn wins. The
 * opening is the snake: each player a settlement and a road, then back again, the second settlement paying what its
 * hexes give. No trading between players, and no bank exchange (`exchange: { rate: 4 }` turns that on).
 *
 *   settlersGame({ seed?, players? }) → G   players 3 or 4 (4); seed deals the island and shuffles the deck (1)
 */

const COLOURS = { red: '#c4362a', blue: '#2f6db3', white: '#efe9dc', orange: '#e0892b' };
const TERRAIN = { forest: 4, pasture: 4, fields: 4, hills: 3, mountains: 3, desert: 1 };
const NUMBERS = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];
// pointy hex, radius 2, in the lattice's order (rows from the south)
const CELLS = ['B1', 'C1', 'D1', 'A2', 'B2', 'C2', 'D2', 'A3', 'B3', 'C3', 'D3', 'E3', 'A4', 'B4', 'C4', 'D4', 'B5', 'C5', 'D5'];
// the axial coordinates of those cells (lattice.js, pointy, radius 2), for the 6-and-8 rule
const AXIAL = [[1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1], [-1, 2], [0, 2], [1, 2], [2, 2], [3, 2], [-1, 3], [0, 3], [1, 3], [2, 3], [-1, 4], [0, 4], [1, 4]];

function dice(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(list, roll) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) { const j = Math.floor(roll() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
const touching = (a, b) => { const dq = b[0] - a[0], dr = b[1] - a[1]; return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2 === 1; };

/** The island: terrain and numbers dealt from the seed, the desert numberless, no 6 or 8 beside another. */
export function dealIsland(seed = 1) {
  const roll = dice(seed);
  const terrain = shuffle(Object.entries(TERRAIN).flatMap(([t, n]) => Array(n).fill(t)), roll);
  const land = CELLS.map((_, i) => i).filter((i) => terrain[i] !== 'desert');
  for (let tries = 0; tries < 1000; tries += 1) {
    const nums = shuffle(NUMBERS, roll), at = {};
    land.forEach((i, k) => { at[i] = nums[k]; });
    const red = land.filter((i) => at[i] === 6 || at[i] === 8);
    if (red.some((i) => red.some((j) => i < j && touching(AXIAL[i], AXIAL[j])))) continue;
    const types = {}, numbers = {};
    CELLS.forEach((c, i) => { types[c] = terrain[i]; if (at[i] !== undefined) numbers[c] = at[i]; });
    return { types, numbers, desert: CELLS[terrain.indexOf('desert')] };
  }
  throw new Error('settlers: no dealing kept the sixes and eights apart');
}

const BUILDINGS = ['settlement', 'city'];

export function settlersGame({ seed = 1, players = 4 } = {}) {
  if (players !== 3 && players !== 4) throw new Error('settlers: three or four players');
  const island = dealIsland(seed);
  const ids = Object.keys(COLOURS).slice(0, players);
  const place = [{ place: 'settlement', need: [{ apart: 1 }] }, { place: 'road', need: [{ touch: 'last' }] }];
  return {
    title: 'Settlers',
    seed,
    look: {
      types: { forest: '#2f6b3a', pasture: '#8cc26b', fields: '#e2bf4f', hills: '#c0623b', mountains: '#8b919a', desert: '#d9c9a0' },
      resources: { lumber: '#2f6b3a', brick: '#c0623b', wool: '#8cc26b', grain: '#e2bf4f', ore: '#8b919a' },
    },
    board: { shape: 'hex', radius: 2, types: island.types },
    numbers: island.numbers,
    players: ids.map((id) => ({ id, facing: 'N', colour: COLOURS[id] })),
    pieces: {
      settlement: { on: 'corner', name: 'settlement', glyph: '⌂' },
      city: { on: 'corner', name: 'city', glyph: '♜' },
      road: { on: 'edge', name: 'road' },
      robber: { on: 'cell', name: 'robber', glyph: '♟' },
    },
    setup: { neutral: { robber: [island.desert] } },
    stock: { settlement: 5, city: 4, road: 15 },
    resources: { lumber: 19, brick: 19, wool: 19, grain: 19, ore: 19 },
    build: {
      road: { cost: { brick: 1, lumber: 1 }, need: [{ any: [{ touch: BUILDINGS }, { reach: ['road'], block: BUILDINGS }] }] },
      settlement: { cost: { brick: 1, lumber: 1, wool: 1, grain: 1 }, need: [{ apart: 1 }, { touch: ['road'] }] },
      city: { cost: { grain: 2, ore: 3 }, upgrade: 'settlement' },
    },
    opening: [
      { order: 'forward', steps: place },
      { order: 'reverse', steps: [{ ...place[0], yield: true }, place[1]] },
    ],
    dice: { n: 2, sides: 6 },
    produce: {
      yields: { forest: 'lumber', hills: 'brick', pasture: 'wool', fields: 'grain', mountains: 'ore' },
      amount: { settlement: 1, city: 2 },
      block: 'robber',
    },
    rolls: { 7: [{ discard: { over: 7 } }, { robber: 'robber' }] },
    decks: { development: { cards: { knight: 14, vp: 5, roads: 2, plenty: 2, monopoly: 2 }, cost: { wool: 1, grain: 1, ore: 1 } } },
    cards: {
      knight: { name: 'knight', play: [{ robber: 'robber' }] },
      vp: { name: 'victory point' },
      roads: { name: 'road building', play: [{ free: 'road', n: 2 }] },
      plenty: { name: 'year of plenty', play: [{ gain: 2 }] },
      monopoly: { name: 'monopoly', play: [{ claim: true }] },
    },
    score: {
      pieces: { settlement: 1, city: 2 },
      cards: { vp: 1 },
      awards: {
        road: { name: 'longest road', vp: 2, min: 5, trail: 'road', block: BUILDINGS },
        army: { name: 'largest army', vp: 2, min: 3, played: 'knight' },
      },
      win: 10,
    },
    cap: 400,
  };
}

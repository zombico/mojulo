/**
 * A TEST FIXTURE, not a game in the book: an island economy written out from the tabletop kernel's systems, the way a
 * person's own rules would be once they have explained them (the book offers systems and meeples, never a published
 * game by name). Nineteen hexes dealt from a seed (the `deal` system), pieces on corners and edges, dice and
 * production, a seven's robber, cards, awards, an opening in rounds, and, when asked, trading between players.
 *
 *   islandEconomy({ seed?, players?, trade? }) → G   players 3 or 4 (4); seed deals the island and shuffles the deck (1);
 *     trade true adds trading between players (two offers a turn)
 */

const COLOURS = { red: '#c4362a', blue: '#2f6db3', white: '#efe9dc', orange: '#e0892b' };
const TERRAIN = { forest: 4, pasture: 4, fields: 4, hills: 3, mountains: 3, desert: 1 };
const NUMBERS = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];

const BUILDINGS = ['settlement', 'city'];

export function islandEconomy({ seed = 1, players = 4, trade = false } = {}) {
  if (players !== 3 && players !== 4) throw new Error('island economy: three or four players');
  const ids = Object.keys(COLOURS).slice(0, players);
  const place = [{ place: 'settlement', need: [{ apart: 1 }] }, { place: 'road', need: [{ touch: 'last' }] }];
  return {
    title: 'Island economy',
    seed,
    look: {
      types: { forest: '#2f6b3a', pasture: '#8cc26b', fields: '#e2bf4f', hills: '#c0623b', mountains: '#8b919a', desert: '#d9c9a0' },
      resources: { lumber: '#2f6b3a', brick: '#c0623b', wool: '#8cc26b', grain: '#e2bf4f', ore: '#8b919a' },
    },
    board: { shape: 'hex', radius: 2 },
    deal: { types: TERRAIN, numbers: NUMBERS, numberless: ['desert'], apart: [6, 8], place: { robber: 'desert' } },
    players: ids.map((id) => ({ id, facing: 'N', colour: COLOURS[id] })),
    pieces: {
      settlement: { on: 'corner', name: 'settlement', glyph: '⌂' },
      city: { on: 'corner', name: 'city', glyph: '♜' },
      road: { on: 'edge', name: 'road' },
      robber: { on: 'cell', name: 'robber', glyph: '♟' },
    },
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
    ...(trade ? { trade: { offers: 2 } } : {}),
    cap: 400,
  };
}

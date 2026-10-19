/**
 * A TEST FIXTURE, not a game in the book: tile placement written out from the tabletop kernel's tile system, named by
 * its principle. Square tiles drawn from a seeded bag and laid edge to matching edge; walls (areas a tile's edges
 * join), paths (lines from edge to edge, ending where a tile ends them) and shrines (a centre, done when the eight
 * cells round it are laid). A claim on a feature pays when it is done; what is left open pays less at the end.
 *
 *   tileGame({ players?, seed? }) → G   players 2 to 4 (2); seed deals the bag (1)
 *
 * Edges count E N W S (0 1 2 3), the board's own order.
 */

const COLOURS = ['#c4362a', '#2f6db3', '#e0b23a', '#3a8f5a'];
const IDS = ['red', 'blue', 'yellow', 'green'];

const TYPES = {
  'path-straight': { segments: [{ type: 'path', edges: [1, 3] }] },
  'path-bend': { segments: [{ type: 'path', edges: [3, 0] }] },
  'path-three': { segments: [{ type: 'path', edges: [0] }, { type: 'path', edges: [2] }, { type: 'path', edges: [3] }] },
  'path-four': { segments: [{ type: 'path', edges: [0] }, { type: 'path', edges: [1] }, { type: 'path', edges: [2] }, { type: 'path', edges: [3] }] },
  'wall-cap': { segments: [{ type: 'wall', edges: [1] }] },
  'wall-cap-path': { segments: [{ type: 'wall', edges: [1] }, { type: 'path', edges: [0, 2] }] },
  'wall-caps-apart': { segments: [{ type: 'wall', edges: [1] }, { type: 'wall', edges: [3] }] },
  'wall-corner': { segments: [{ type: 'wall', edges: [1, 2] }] },
  'wall-corner-path': { segments: [{ type: 'wall', edges: [1, 2] }, { type: 'path', edges: [3, 0] }] },
  'wall-band': { segments: [{ type: 'wall', edges: [0, 2] }] },
  'wall-three': { segments: [{ type: 'wall', edges: [0, 1, 2] }] },
  'wall-three-path': { segments: [{ type: 'wall', edges: [0, 1, 2] }, { type: 'path', edges: [3] }] },
  'wall-all': { segments: [{ type: 'wall', edges: [0, 1, 2, 3] }] },
  shrine: { segments: [{ type: 'shrine', centre: true }] },
  'shrine-path': { segments: [{ type: 'shrine', centre: true }, { type: 'path', edges: [3] }] },
};

const BAG = {
  'path-straight': 8, 'path-bend': 9, 'path-three': 4, 'path-four': 1,
  'wall-cap': 5, 'wall-cap-path': 3, 'wall-caps-apart': 3, 'wall-corner': 4, 'wall-corner-path': 5, 'wall-band': 3,
  'wall-three': 3, 'wall-three-path': 3, 'wall-all': 1, shrine: 4, 'shrine-path': 2,
};

export function tileGame({ players = 2, seed = 1 } = {}) {
  if (!(players >= 2 && players <= 4)) throw new Error('tile game: two to four players');
  return {
    title: 'Tiles',
    seed,
    board: { shape: 'square', cols: 21, rows: 21 },
    players: IDS.slice(0, players).map((id, s) => ({ id, facing: 'N', colour: COLOURS[s] })),
    pieces: { meeple: { name: 'meeple', shape: 'meeple', glyph: '' } },
    look: { plain: '#8db36a', features: { wall: { colour: '#c98b4f', form: 'area' }, path: { colour: '#f2ead6', form: 'line' }, shrine: { colour: '#b84a3a', form: 'centre' } } },
    tiles: {
      types: TYPES,
      bag: BAG,
      start: { tile: 'wall-cap-path', at: 'K11' },
      claim: { kind: 'meeple', stock: 7 },
      features: { wall: { complete: 2, incomplete: 1 }, path: { complete: 1, incomplete: 1 }, shrine: { complete: 1, incomplete: 1 } },
    },
  };
}

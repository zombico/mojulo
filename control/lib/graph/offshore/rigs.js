/**
 * THE RIGS — offshore rig levels on the shelf, each a recipe plan.js reads: its decks as maps of tiles, its legs, its
 * stairs, its modules, where the operative comes aboard, what it is there for and the rounds that watch it. A new rig is
 * a row. A map's first row is the deck's far (+y) edge; every deck's map is the same size (the rig's grid, CELL metres a
 * glyph): '#' plate, '=' grating, 'H' the helideck, '.' none.
 */

// (the grid: 16 cells by 12, 48 m by 36; four legs at its corners' nodes; decks 8 m apart, a switchback stair each)
const ROW = (s) => s;
export const RIGS = Object.freeze({
  // A DRILLING PLATFORM: the boat landing on its leg, the cellar deck a forest of columns under the main deck, the main
  // deck's yard of containers and the quarters, the drill floor under its derrick and the helideck beside it. The way up
  // crosses each deck to the stair on its far side.
  'drilling-platform': {
    id: 'drilling-platform', name: 'The drilling platform', seed: 3,
    reads: 'four decks over the sea at night in the rain: a landing, a cellar deck of columns, a production deck of containers, the drill floor and the helideck, lit by floods',
    decks: [
      { id: 'landing', z: 4, reads: 'the boat landing round the south-west leg',
        map: [
          ROW('................'), ROW('................'), ROW('................'), ROW('................'),
          ROW('................'), ROW('................'), ROW('................'), ROW('................'),
          ROW('................'), ROW('=======.........'), ROW('=======.........'), ROW('=======.........'),
        ] },
      { id: 'cellar', z: 12, columns: { every: 3 }, reads: 'the cellar deck: grating under the main deck, its columns a forest',
        map: [
          ROW('................'), ROW('.==============.'), ROW('.==============.'), ROW('.==============.'),
          ROW('.==============.'), ROW('.======..======.'), ROW('.======..======.'), ROW('.==============.'),
          ROW('.==============.'), ROW('.==============.'), ROW('.==============.'), ROW('................'),
        ] },
      { id: 'main', z: 20, inner: 'bulwark', walls: { '+y': 'bulwark', '-x': 'bulwark' }, reads: 'the main deck: plate, a yard of containers, the quarters, under the drill floor a hall of columns',
        map: [
          ROW('################'), ROW('################'), ROW('################'), ROW('################'),
          ROW('################'), ROW('#######..#######'), ROW('#######..#######'), ROW('################'),
          ROW('################'), ROW('################'), ROW('################'), ROW('################'),
        ] },
      { id: 'top', z: 28, walls: { '-y': 'screen' }, reads: 'the drill floor under the derrick, a walkway to the helideck',
        map: [
          ROW('................'), ROW('................'), ROW('................'), ROW('.....######.HHHH'),
          ROW('.....######.HHHH'), ROW('.....######=HHHH'), ROW('.....######=HHHH'), ROW('.....######.HHHH'),
          ROW('.....######.HHHH'), ROW('................'), ROW('................'), ROW('................'),
        ] },
    ],
    legs: [[1, 1], [15, 1], [1, 11], [15, 11]],
    stairs: [
      { from: 'landing', to: 'cellar', at: [3, 0], dir: '+x', side: '+y' },
      { from: 'cellar', to: 'main', at: [12, 10], dir: '-x', side: '-y' },
      { from: 'main', to: 'top', at: [4, 4], dir: '-x', side: '-y' },
    ],
    modules: [
      // the cellar deck: plant between the columns
      { kind: 'container', deck: 'cellar', at: [6.5, 2.5] },
      { kind: 'tank', deck: 'cellar', at: [4.5, 4.5] },
      { kind: 'tank', deck: 'cellar', at: [4.5, 6.5] },
      { kind: 'skid', deck: 'cellar', at: [10.5, 2.5] },
      { kind: 'rack', deck: 'cellar', at: [10.5, 6.5] },
      { kind: 'container', deck: 'cellar', at: [12.5, 4.5] },
      { kind: 'container', deck: 'cellar', at: [2.5, 6.5], turn: 90 },
      { kind: 'drums', deck: 'cellar', at: [2.5, 8.5] },
      { kind: 'skid', deck: 'cellar', at: [6.5, 8.5] },
      // the main deck: the quarters, the yard, racks under the drill floor, the crane, the flare, the lifeboats
      { kind: 'quarters', deck: 'main', at: [3, 9] },
      { kind: 'container', deck: 'main', at: [6.5, 1] },
      { kind: 'container', deck: 'main', at: [10.5, 1] },
      { kind: 'container', deck: 'main', at: [10.5, 2.1] },
      { kind: 'drums', deck: 'main', at: [8.5, 1.5] },
      { kind: 'skid', deck: 'main', at: [13.5, 1.5] },
      { kind: 'rack', deck: 'main', at: [10.5, 4.5] },
      { kind: 'rack', deck: 'main', at: [12.5, 4.5] },
      { kind: 'tank', deck: 'main', at: [5.5, 10.5] },
      { kind: 'container', deck: 'main', at: [7.5, 9.5] },
      { kind: 'container', deck: 'main', at: [13.5, 9.5], turn: 90 },
      { kind: 'crane', deck: 'main', at: [0, 5.5], toward: '-x' },
      { kind: 'flare', deck: 'main', at: [15, 11], toward: '+x' },
      { kind: 'lifeboat', deck: 'main', at: [4.5, -1.2], toward: '+y' },
      { kind: 'lifeboat', deck: 'main', at: [8.5, -1.2], toward: '+y' },
      // the drill floor: the derrick over the moonpool, its drawworks, the driller's cabin, the pipe laid down
      { kind: 'derrick', deck: 'top', at: [7.5, 5.5] },
      { kind: 'drawworks', deck: 'top', at: [7.5, 7.75] },
      { kind: 'cabin', deck: 'top', at: [10, 7] },
      { kind: 'rack', deck: 'top', at: [6.5, 3.4] },
      { kind: 'container', deck: 'top', at: [9.5, 3.6], turn: 90 },
      { kind: 'container', deck: 'top', at: [5.5, 5.5], turn: 90 },
      { kind: 'skid', deck: 'top', at: [9.6, 5.1] },
      { kind: 'drums', deck: 'top', at: [5.5, 7.5] },
    ],
    // the night: rain, a tube under every third tile of a deck over another, and the floods: the main deck's from three
    // legs and the quarters' wall, the drill floor's from the derrick, the helideck's corner, the landing's
    hour: 'night', weather: { climate: { rain: 3, downpour: 1 }, start: 'rain' }, fittings: { every: 3 },
    floods: [
      { deck: 'landing', at: [0.6, 8.4], height: 4, aim: [7, 3] },
      { deck: 'main', at: [4.9, 4.9], height: 7, aim: [16, 8] },
      { deck: 'main', at: [43.1, 4.9], height: 7, aim: [33, 8] },
      { deck: 'main', at: [43.1, 31.1], height: 7, aim: [35, 22] },
      { deck: 'main', at: [10.5, 25.2], height: 8.5, aim: [18, 17] },
      { deck: 'top', at: [20.9, 14.9], height: 9, aim: [25, 19] },
      { deck: 'top', at: [27.1, 21.1], height: 9, aim: [22, 15] },
      { deck: 'top', at: [47.5, 26.5], height: 3, aim: [40, 16] },
    ],
    start: { deck: 'landing', at: [5.5, 7.6], says: 'aboard from the boat. Up through the decks to the drill floor, unseen.' },
    goal: { deck: 'top', at: [31.5, 19.6], says: 'the driller\'s cabin' },
    watch: [
      { id: 'cellar-round', deck: 'cellar', at: [7.5, 15], to: [40, 15], look: 4 },
      { id: 'cellar-post', deck: 'cellar', at: [37.5, 27], facing: [24, 27] },
      { id: 'yard-round', deck: 'main', at: [27, 10.5], to: [44, 10.5], look: 4 },
      { id: 'hall-round', deck: 'main', at: [31.5, 21], to: [45, 21], look: 4 },
      { id: 'floor-round', deck: 'top', at: [22, 20], to: [29, 20], look: 5 },
      { id: 'helideck-post', deck: 'top', at: [45, 24], facing: [45, 10] },
    ],
  },
});
export const RIG_IDS = Object.keys(RIGS);

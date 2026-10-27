/**
 * THE SUNKEN CHAPEL — a test module written in portable words only (roles, ranks, faculties, difficulty words), so it
 * plays under every system: a village, two days of road, a ruined chapel over a crypt. The chapel has a loop (nave,
 * gallery, stair), a lock whose key lies off the main way, a hidden way to an ossuary, a trap, a wandering table and
 * the goal, the saint's bell, in the reliquary behind the locked crypt. Test data: no picture, no level.
 */
export const SUNKEN_CHAPEL = Object.freeze({
  title: 'The Sunken Chapel',
  seed: 7,
  hook: 'The bell of Saint Wend has not rung in Millbrook for a hundred years. The reeve says it lies under the chapel on Barrow Hill, and that the dead there do not sleep.',
  goal: { item: 'saint-bell' },
  ending: 'The bell rings once in your hands, and somewhere under the hill the dead lie down.',
  party: [
    { id: 'alys', name: 'Alys', role: 'frontline' },
    { id: 'wren', name: 'Wren', role: 'flanker' },
    { id: 'tamsin', name: 'Tamsin', role: 'support' },
  ],
  world: {
    start: 'millbrook',
    places: [
      { id: 'millbrook', name: 'Millbrook', kind: 'town', text: 'A mill, a green, a tavern and a reeve who will not meet your eye.' },
      { id: 'standing-stones', name: 'the Standing Stones', kind: 'landmark', text: 'Seven grey stones on the moor, leaning together like gossips.' },
      { id: 'barrow-hill', name: 'Barrow Hill', kind: 'dungeon', text: 'A roofless chapel on a hill of old graves.', dungeon: 'chapel' },
    ],
    routes: [
      { a: 'millbrook', b: 'standing-stones', days: 1, danger: 'road' },
      { a: 'standing-stones', b: 'barrow-hill', days: 1, danger: 'road' },
    ],
  },
  dungeons: {
    chapel: {
      name: 'the Sunken Chapel',
      entry: 'porch',
      wander: 'chapel-wander',
      rooms: [
        { id: 'porch', name: 'the Porch', text: 'A broken arch, and the nave beyond it open to the sky.' },
        { id: 'nave', name: 'the Nave', text: 'Pews rotted to their nails. Something moves between them.', foes: ['ghoul', 'grave-rat'] },
        { id: 'vestry', name: 'the Vestry', text: 'Mouldered robes on hooks; a box under the bench.', items: ['iron-key', 'tonic'] },
        { id: 'gallery', name: 'the Gallery', text: 'A narrow walk above the nave, its rail long gone.', search: 'medium' },
        { id: 'ossuary', name: 'the Ossuary', text: 'Skulls stacked to the ceiling, every one facing the door.', items: [{ item: 'silver-ring', hidden: true }] },
        { id: 'crypt-stair', name: 'the Crypt Stair', text: 'Steps worn into a dip, going down.', trap: { faculty: 'agility', difficulty: 'medium', harm: 1, text: 'A step gives way under the first foot.' } },
        { id: 'crypt', name: 'the Crypt', text: 'Low vaults and stone biers. One bier is empty.', foes: ['barrow-wight'] },
        { id: 'reliquary', name: 'the Reliquary', text: 'A small round room, and on a plinth the bell.', items: ['saint-bell'] },
      ],
      links: [
        { a: 'porch', b: 'nave', kind: 'open' },
        { a: 'nave', b: 'vestry', kind: 'door' },
        { a: 'nave', b: 'gallery', kind: 'stair' },
        { a: 'nave', b: 'crypt-stair', kind: 'open' },
        { a: 'gallery', b: 'crypt-stair', kind: 'open' },
        { a: 'gallery', b: 'ossuary', kind: 'secret' },
        { a: 'crypt-stair', b: 'crypt', kind: 'locked', key: 'iron-key', force: 'hard' },
        { a: 'crypt', b: 'reliquary', kind: 'door' },
      ],
    },
  },
  foes: {
    'grave-rat': { name: 'Grave Rat', rank: 1, text: 'fat, pale and bold' },
    footpad: { name: 'Footpad', rank: 1, text: 'a knife and a hungry look' },
    ghoul: { name: 'Ghoul', rank: 2, text: 'grey skin and long nails' },
    'barrow-wight': { name: 'Barrow Wight', rank: 3, text: 'a crowned corpse that rises from its bier' },
  },
  items: {
    'iron-key': { name: 'the iron key', kind: 'key', text: 'Heavy, black, and cold to hold.' },
    tonic: { name: 'a tonic', kind: 'heal', heal: 'some' },
    'silver-ring': { name: 'a silver ring', kind: 'treasure' },
    'saint-bell': { name: 'the bell of Saint Wend', kind: 'treasure', text: 'Small enough to hold in one hand.' },
  },
  tables: {
    road: { name: 'On the road', die: '1d6', rows: [
      { on: 1, text: 'Footpads step out of the gorse.', foes: ['footpad', 'footpad'] },
      { on: [2, 3], text: 'A peddler sells you a tonic for a song.', item: 'tonic' },
      { on: [4, 6], text: 'Wind, heather and a long quiet road.' },
    ] },
    'chapel-wander': { name: 'In the chapel', die: '1d6', rows: [
      { on: 1, text: 'A grave rat noses out of the dark.', foes: ['grave-rat'] },
      { on: [2, 6], text: 'Dripping water, and nothing else.' },
    ] },
  },
  beats: [
    { id: 'stones', at: 'standing-stones', text: 'At the stones the wind drops, and for a moment you hear a bell that is not there.' },
    { id: 'crypt-door', at: 'chapel/crypt', text: 'The empty bier is the wight\'s. It was waiting for you.', milestone: true },
  ],
});

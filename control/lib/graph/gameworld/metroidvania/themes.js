/**
 * A BOX'S THEMES (docs/metroidvania-map.md "The castle"): what a box is made of and how it is lit, laid over its greybox
 * ring by ring. A theme names a LOOK for each ring, outermost first and the core last (a box with more rings than a theme
 * has looks repeats its middle ones), and the night it stands under. A new theme is a row; a new place a look.
 *
 *   a LOOK  { place, open?, back, stone, mortar, top, trim, glass?, carpet?, bays, ceiling?, pier?, shafts?, near?, focal,
 *             dark, lamp }
 *     open     the ring is out under the sky: its back the night (the sky, the moon, the castle's far towers), a parapet's
 *              merlons standing behind its walk; else its back is a wall of ashlar in `back`
 *     stone    the closed parts' face, `mortar` its coursed joints, `top` its coping (every top a lit edge), `trim` the
 *              band under a lip and the fittings (frames, brackets, rails)
 *     bays     [A, B]: the two pieces its wall alternates bay by bay (backdrop.js BAY_PIECES: an arched window of moonlit
 *              `glass`, a niche and its statue, a banner, a coat of arms, a shelf of books, a portrait, ivy over cracked
 *              stone, a parapet's merlons), ordered by the wall's rhythm (era/wall-rhythm.js)
 *     ceiling  what hangs under its ceiling: `vault` (ribs to a boss a bay), `beams` (a timber and its brackets), none
 *     pier     the pier at each cell's edge, standing out of the wall: `round` (a half-column, its base and capital, the
 *              vault's ribs springing from it), `square` (a chamfered pier), none
 *     shafts   slender wall shafts flanking each bay's piece, rising to the vault's ribs
 *     near     what stands between the lane and the wall, at the cells' edges: `column`, `chain`, none
 *     dado     along its floor: `wainscot` (panels and a rail, a hall's), else a plain plinth (calm behind the play)
 *     lancets  a slit of moonlit glass high in each bay, over its piece: what is seen through a wall with no windows
 *     focal    the one piece a room is remembered by, larger than a bay's (backdrop.js FOCAL_PIECES)
 *     carpet   a runner down its floors (a hall's, the throne's)
 *     dark     how far its shadow falls where no lamp reaches (the share of a colour left: low is a dark mood)
 *     lamp     its light, one a bay: `torch` (a bracket and a flame), `candles` (a sconce of three), `ghost` (a cold
 *              lamp), `brazier` (a bowl of fire on the floor); its colour and its `reach` (m) baked into what stands
 *              near it, its flames haloed, dust hanging in its light
 *     wall     the back's masonry (WALLS in dress.js): `ashlar` (unsaid), `brick`, `rock` (a cave's rough beds), `plaster`
 *     path     what its floors are laid in (fabric.js PATHS): `flags` (unsaid), `boards`, `tiles`, `rock`
 *     ledge    what its stairs' ledges are built of (fabric.js LEDGES): `stone` (unsaid), `timber`, `iron`
 *     first    the focal piece of the room the box is entered by, where the rest of the ring shows `focal`
 *   a planet's look (XenoJager's, xeno-jager.js) says, besides:
 *     cave     its back the rock's (each chunk knocked, strata wandering across it, a rib of rock at a cell's edge where a
 *              castle has its pier; no plinth and no cobwebs)
 *     fabric   `rock`: its closed parts built as rock (fabric.js), its doorways cave mouths
 *     parapet  `crag`: behind an open ring's walk, a crag of rock where a castle has its merlons
 *     ceiling `stalactites` · near `stalagmite` · crevices (a glowing slit of a deeper cavern high in each bay) · lamp
 *              `glow` (pods on a stalk) · hazard (`water` | `lava`: recorded in the dress plan for the game to come)
 *     rock     what its boulders are (polygonizer/rock-minerals.js ROCK_PRESETS: granite unsaid, basalt, slate, marble,
 *              quartzite): real rocks, fractured and grained
 *     gem      what its crystals are (polygonizer/crystal-optics.js: quartz unsaid, amethyst, sapphire, ruby, tourmaline,
 *              …): real stones the page shades live
 *   the NIGHT { zenith, horizon, moon: { colour, r }, towers, skyline?, planet?, moon2? }   the sky an open ring stands
 *              under (a planet's: `skyline: 'spires'`, a ringed `planet` { colour, ring, r } and a second moon)
 *   the LOCALES  a room its own place inside its ring (docs/metroidvania-map.md "Locales"): a locale is a look's words laid
 *              over its ring's look for one room, by what the room is: a save room is a chapel, a ring's `shaft` its
 *              shafts, its `boss` its boss's room, its `hall` its halls, its `alt` every other of its corridors. A closed ring's rooms are then
 *              not one hall all through: the halls have their library stacks, the ward its clock tower and catacombs, the
 *              keep its throne room. Its closed parts keep their ring's stone, laid in the locale's path and ledge.
 *
 *   BOX_THEMES, BOX_THEME_IDS, LAMP_KINDS (the castle and its seeded re-keys, castle-frost and castle-blood; XenoJager's planet, xeno)
 *   rekey(base, { name?, night?, looks?, locales?, lamp? }) → a theme: the base's rings and locales in other colours
 *   lookOf(theme, ring, rings) → the ring's look (`rings` the box's ring count, the core counted)
 *   localeOf(theme, room, rings, corridorIndex?) → the locale's id a room is dressed as, or null (its ring's look)
 *   roomLook(theme, room, rings, corridorIndex?) → the look a room is dressed in: its locale over its ring's
 *   themeLaws(theme, rings, gates?) → [{ id, holds, says }]   rings-distinct: each ring unlike the one outside it;
 *                                     gates-read: every gate's colour stands out from the back of each ring it is in
 *
 * Pure.
 */
export const LAMP_KINDS = Object.freeze({ torch: 'a bracket and a flame', candles: 'a sconce of three candles', ghost: 'a cold lamp', brazier: 'a bowl of fire', glow: 'a cluster of glowing pods, the life\'s own light' });

// the vampire lord's castle, stormed by night: its walls out under the moon, its halls warm with candles, its ward cold
// and mossy, its keep dark stone and gold, crimson at its heart
const CASTLE = Object.freeze({
  name: 'the vampire lord\'s castle by night',
  night: Object.freeze({ zenith: '#0b0d1f', horizon: '#2a2550', moon: Object.freeze({ colour: '#f1ecd6', r: 1.3 }), towers: '#17162e' }),
  looks: Object.freeze([
    Object.freeze({ place: 'the ramparts', open: true, back: '#1b1f38', stone: '#6c6875', mortar: '#3d3a46', top: '#a6a2ad', trim: '#4f4b58',
      path: 'flags', ledge: 'stone', bays: Object.freeze(['merlons', 'merlons']), focal: 'gargoyle', dark: 0.5, lamp: Object.freeze({ kind: 'torch', colour: '#ffad55', reach: 6 }), shaft: Object.freeze(['tower', 'observatory']) }),
    Object.freeze({ place: 'the great halls', back: '#3b2a2c', stone: '#8c8179', mortar: '#55493f', top: '#c4b8a6', trim: '#8a6a3e', glass: '#5d7cb4', carpet: '#7a1a26', path: 'flags', ledge: 'timber',
      bays: Object.freeze(['arch', 'shelf']), ceiling: 'vault', pier: 'round', shafts: true, near: 'column', dado: 'wainscot', focal: 'portrait', dark: 0.36, lamp: Object.freeze({ kind: 'candles', colour: '#ffcc80', reach: 5.5 }), shaft: 'library', alt: Object.freeze(['alchemy', 'ballroom', 'banquet']) }),
    Object.freeze({ place: 'the inner ward', back: '#1f2c2a', stone: '#5a6658', mortar: '#2f3a30', top: '#8d9a86', trim: '#3f4a3c', glass: '#7fa6a0', path: 'flags', ledge: 'timber',
      bays: Object.freeze(['arch', 'ivy']), ceiling: 'beams', pier: 'square', near: 'chain', focal: 'statue', dark: 0.34, lamp: Object.freeze({ kind: 'ghost', colour: '#9fe0ff', reach: 5 }), shaft: 'clocktower', boss: 'clocktower', alt: Object.freeze(['catacombs', 'dungeon']) }),
    Object.freeze({ place: 'the keep', back: '#2a0f16', stone: '#4c3b40', mortar: '#2a1e22', top: '#8a7466', trim: '#c9a24a', carpet: '#8c1020', path: 'tiles', ledge: 'stone',
      bays: Object.freeze(['banner', 'niche']), ceiling: 'vault', pier: 'round', shafts: true, near: 'column', lancets: true, focal: 'arms', dark: 0.32, lamp: Object.freeze({ kind: 'brazier', colour: '#ff7a3a', reach: 6.5 }), boss: 'throne', hall: 'armoury' }),
  ]),
  locales: Object.freeze({
    // (a save room: whitewashed plaster, lancets of coloured glass, a rose window, candles; her light coloured by it)
    chapel: Object.freeze({ place: 'the chapel', wall: 'plaster', back: '#5e5868', trim: '#b49a5a', carpet: '#3c2c66', path: 'tiles', bays: Object.freeze(['stained', 'stained']), ceiling: 'vault', pier: 'round', shafts: true, near: 'column', dado: 'wainscot', focal: 'rose', dark: 0.42, lamp: Object.freeze({ kind: 'candles', colour: '#ffdca8', reach: 5.1 }) }),
    // (the great halls' tall stacks: cases two storeys high under their galleries, an orrery turning under the roof)
    library: Object.freeze({ place: 'the library', calm: true, back: '#3c2a1e', trim: '#8a6436', path: 'boards', ledge: 'timber', bays: Object.freeze(['shelf', 'shelf']), ceiling: 'beams', pier: 'square', near: 'column', lancets: true, focal: 'orrery', dark: 0.34, lamp: Object.freeze({ kind: 'candles', colour: '#ffc880', reach: 5.5 }) }),
    // (the outer wall's towers, closed against the night: rough ashlar, arrow-slit lancets, banners, torches; their stairs
    // built onto their walls and their pier)
    tower: Object.freeze({ place: 'the towers', open: false, back: '#2c2a36', trim: '#5c5866', glass: '#5d6c9c', path: 'flags', ledge: 'stone', bays: Object.freeze(['banner', 'arms']), ceiling: 'beams', pier: 'square', near: 'chain', lancets: true, focal: 'statue', dark: 0.36, lamp: Object.freeze({ kind: 'torch', colour: '#ffad55', reach: 6.5 }) }),
    // (the outer wall's other towers, an observatory at their tops: charts of the stars, a brass telescope aimed at a
    // round of night, cold candles)
    observatory: Object.freeze({ place: 'the observatory', open: false, wall: 'brick', back: '#24283a', trim: '#a08a5a', glass: '#4a5a8c', path: 'boards', ledge: 'stone', bays: Object.freeze(['chart', 'arch']), ceiling: 'beams', pier: 'square', near: 'chain', lancets: true, focal: 'telescope', dark: 0.36, lamp: Object.freeze({ kind: 'candles', colour: '#d8e4ff', reach: 5.5 }) }),
    // (the great halls' ballroom: pale plaster, tall mirrors and windows, a great chandelier burning, a carpet)
    ballroom: Object.freeze({ place: 'the ballroom', wall: 'plaster', back: '#5a4656', trim: '#c8a050', carpet: '#5a1a3a', glass: '#6a7cb4', path: 'tiles', ledge: 'timber', bays: Object.freeze(['mirror', 'arch']), ceiling: 'vault', pier: 'round', shafts: true, near: 'column', dado: 'wainscot', focal: 'chandelier', dark: 0.4, lamp: Object.freeze({ kind: 'candles', colour: '#ffd8a0', reach: 5.2 }) }),
    // (the great halls' banquet hall: brick, mounted antlers and banners, a great hearth burning under the house's crest)
    banquet: Object.freeze({ place: 'the banquet hall', wall: 'brick', back: '#4a2a22', trim: '#9a6a3a', carpet: '#6a1a1a', path: 'boards', ledge: 'timber', bays: Object.freeze(['antlers', 'banner']), ceiling: 'beams', pier: 'square', near: 'column', lancets: true, focal: 'hearth', dark: 0.34, lamp: Object.freeze({ kind: 'torch', colour: '#ffa050', reach: 6 }) }),
    // (the inner ward's dungeon: rough brick, cells barred in the wall, shackles, a gibbet hung from the roof, a lean torch)
    dungeon: Object.freeze({ place: 'the dungeon', wall: 'brick', back: '#2a2624', trim: '#4a4440', path: 'rock', ledge: 'iron', bays: Object.freeze(['cell', 'shackles']), ceiling: 'beams', pier: 'square', near: 'chain', lancets: true, focal: 'gibbet', dark: 0.28, lamp: Object.freeze({ kind: 'torch', colour: '#ff9a48', reach: 5.5 }) }),
    // (the inner ward's clock tower: brick, gears turning in the wall, the great clock's face, its hands going round)
    clocktower: Object.freeze({ place: 'the clock tower', wall: 'brick', back: '#56302a', trim: '#9a7a44', path: 'boards', ledge: 'iron', bays: Object.freeze(['gears', 'gears']), ceiling: 'beams', pier: 'square', near: 'chain', lancets: true, focal: 'clockface', dark: 0.34, lamp: Object.freeze({ kind: 'torch', colour: '#ffa050', reach: 6 }) }),
    // (the catacombs under the ward: rough rock, skulls stacked in their niches, a sarcophagus, candles)
    catacombs: Object.freeze({ place: 'the catacombs', wall: 'rock', back: '#3a332c', trim: '#5a5046', path: 'rock', ledge: 'stone', bays: Object.freeze(['skulls', 'niche']), near: 'chain', lancets: true, focal: 'sarcophagus', dark: 0.28, lamp: Object.freeze({ kind: 'candles', colour: '#ffb468', reach: 4.8 }) }),
    // (the keep's heart: the lord's throne on its dais under a canopy, banners and tall windows, braziers)
    // (SEEDED locales) the great halls' alchemy: shelves of potions glowing in their bottles, a cauldron bubbling on its fire
    alchemy: Object.freeze({ place: 'the alchemist\'s laboratory', wall: 'brick', back: '#2e3a2c', trim: '#7a6a3a', path: 'tiles', ledge: 'timber', bays: Object.freeze(['flasks', 'shelf']), ceiling: 'beams', pier: 'square', near: 'chain', lancets: true, focal: 'cauldron', dark: 0.32, calm: true, lamp: Object.freeze({ kind: 'candles', colour: '#d8ffb0', reach: 5 }) }),
    // the keep's armoury: racks of spears and swords, a suit of armour standing guard
    armoury: Object.freeze({ place: 'the armoury', back: '#2a2a30', trim: '#8a7a5a', carpet: '#3a2a20', path: 'flags', ledge: 'iron', bays: Object.freeze(['rack', 'arms']), ceiling: 'vault', pier: 'round', shafts: true, near: 'column', lancets: true, focal: 'armour', dark: 0.32, lamp: Object.freeze({ kind: 'torch', colour: '#ffa050', reach: 6 }) }),
    throne: Object.freeze({ place: 'the throne room', back: '#3e0e1a', trim: '#d0a84a', carpet: '#9a1222', glass: '#6c64a8', path: 'tiles', bays: Object.freeze(['banner', 'arch']), ceiling: 'vault', pier: 'round', shafts: true, near: 'column', focal: 'throne', dark: 0.3, lamp: Object.freeze({ kind: 'brazier', colour: '#ff7a3a', reach: 6.5 }) }),
  }),
});

/** A RE-KEY of a theme (docs/backdrop-variations.md "Re-key a row"): the same rings, locales and pieces in other colours:
 * its night replaced, each look's words (by ring, in order) and each locale's laid over the base's, every lamp's colour
 * given where `lamp` is. No drawing of its own. */
export function rekey(base, { name, night, looks = [], locales = {}, lamp } = {}) {
  const lampOf = (L) => (lamp && L.lamp ? { ...L.lamp, ...lamp(L.lamp) } : L.lamp);
  return Object.freeze({
    ...base, name: name ?? base.name, night: Object.freeze({ ...base.night, ...(night ?? {}), moon: Object.freeze({ ...base.night.moon, ...(night?.moon ?? {}) }) }),
    looks: Object.freeze(base.looks.map((L, k) => Object.freeze({ ...L, ...(looks[k] ?? {}), lamp: lampOf({ ...L, ...(looks[k] ?? {}) }) }))),
    locales: Object.freeze(Object.fromEntries(Object.entries(base.locales ?? {}).map(([id, X]) => [id, Object.freeze({ ...X, ...(locales[id] ?? {}), ...(X.lamp ? { lamp: lampOf({ ...X, ...(locales[id] ?? {}) }) } : {}) })]))),
  });
}

// XENOJAGER'S PLANET (xeno-jager.js): a dangerous world explored down through its crust, the same box, rings and idioms
// as the castle in another visual library (docs/metroidvania-map.md "XenoJager"): the surface under an alien sky (two
// moons, a ringed planet, rock spires), then rock all the way down, its fabric the rock's own (`fabric: 'rock'`: no
// quoins, no arches, cave mouths and rock ledges, every climb the rock breaking through); its lamps the life's own glow
// (`glow`: bioluminescent pods); stalactites under its ceilings, stalagmites before its walls, crevices showing the
// glow of deeper caverns where a castle has windows; its places a ring each: the fungal caverns, the flooded depths,
// the magma core. A look's `hazard` (water, lava) is said for the play to come (a handle, not yet played)
const XENO = Object.freeze({
  name: 'a dangerous planet explored down through its crust',
  night: Object.freeze({ zenith: '#0a0618', horizon: '#3a1a3a', moon: Object.freeze({ colour: '#d8f0c8', r: 1.0 }), towers: '#1a0e1e', skyline: 'spires', planet: Object.freeze({ colour: '#c87a4a', ring: '#e8c890', r: 5.5 }), moon2: Object.freeze({ colour: '#9ab8ff', r: 0.55 }) }),
  looks: Object.freeze([
    Object.freeze({ place: 'the crust', open: true, cave: true, rock: 'basalt', gem: 'quartz', fabric: 'rock', parapet: 'crag', back: '#1a1220', stone: '#6a4a44', mortar: '#3a2826', top: '#b08a70', trim: '#5a4040',
      path: 'rock', ledge: 'stone', bays: Object.freeze(['boulders', 'boulders']), focal: 'monolith', first: 'lander', dark: 0.5, lamp: Object.freeze({ kind: 'glow', colour: '#7affd0', reach: 6 }), shaft: 'chasm' }),
    Object.freeze({ place: 'the fungal caverns', cave: true, rock: 'slate', gem: 'tourmaline', fabric: 'rock', wall: 'rock', back: '#1e2a22', stone: '#4c5c48', mortar: '#263022', top: '#8aa07a', trim: '#3a4a34', glass: '#3affa0',
      path: 'rock', ledge: 'stone', bays: Object.freeze(['fungus', 'tendrils']), ceiling: 'stalactites', near: 'stalagmite', crevices: true, focal: 'bloom', dark: 0.36, lamp: Object.freeze({ kind: 'glow', colour: '#7affa8', reach: 4.4 }), shaft: 'grotto', alt: 'boulderfield', save: 'station' }),
    Object.freeze({ place: 'the flooded depths', cave: true, rock: 'marble', gem: 'sapphire', fabric: 'rock', wall: 'rock', back: '#142236', stone: '#3c4c5e', mortar: '#1c2634', top: '#7a96b4', trim: '#2c3c50', glass: '#4ad0ff', hazard: 'water',
      path: 'rock', ledge: 'stone', bays: Object.freeze(['waterfall', 'crystals']), ceiling: 'stalactites', near: 'stalagmite', crevices: true, focal: 'fossil', dark: 0.3, lamp: Object.freeze({ kind: 'glow', colour: '#6ad8ff', reach: 5.5 }), shaft: 'grotto', alt: 'ruins', boss: 'ruins', save: 'station' }),
    Object.freeze({ place: 'the magma core', cave: true, rock: 'basalt', gem: 'ruby', fabric: 'rock', wall: 'rock', back: '#2a1010', stone: '#4e3430', mortar: '#2a1614', top: '#a07060', trim: '#5a2a20', glass: '#ff8a3a', hazard: 'lava',
      path: 'rock', ledge: 'stone', bays: Object.freeze(['lavafall', 'boulders']), ceiling: 'stalactites', near: 'stalagmite', crevices: true, focal: 'lavafall', dark: 0.3, lamp: Object.freeze({ kind: 'glow', colour: '#ff9a4a', reach: 5.4 }), boss: 'nest', hall: 'nest', save: 'station' }),
  ]),
  locales: Object.freeze({
    // (a save room: a station of the explorer's own, its beacon lit, cold light)
    station: Object.freeze({ place: 'the save station', cave: true, gem: 'quartz', back: '#1c2430', trim: '#8aa0c0', bays: Object.freeze(['crystals', 'crystals']), focal: 'beacon', dark: 0.36, lamp: Object.freeze({ kind: 'glow', colour: '#a0e8ff', reach: 5.5 }) }),
    // (the crust's shafts: a chasm closed in rock, crystals in its walls)
    chasm: Object.freeze({ place: 'the chasm', open: false, cave: true, gem: 'amethyst', wall: 'rock', back: '#22161e', bays: Object.freeze(['crystals', 'boulders']), ceiling: 'stalactites', near: 'stalagmite', crevices: true, focal: 'monolith', dark: 0.34, lamp: Object.freeze({ kind: 'glow', colour: '#c88aff', reach: 5.0 }) }),
    // (a grotto of crystals, their light their own)
    grotto: Object.freeze({ place: 'the crystal grotto', gem: 'amethyst', back: '#1e1a34', glass: '#c08aff', bays: Object.freeze(['crystals', 'tendrils']), focal: 'monolith', dark: 0.32, lamp: Object.freeze({ kind: 'glow', colour: '#c88aff', reach: 5.0 }) }),
    // (a field of fallen boulders)
    boulderfield: Object.freeze({ place: 'the boulder field', rock: 'granite', back: '#2a2622', bays: Object.freeze(['boulders', 'fungus']), focal: 'fossil', dark: 0.3 }),
    // (the ruins of a people before, sunk in the depths: carved monoliths, water over them)
    ruins: Object.freeze({ place: 'the sunken ruins', back: '#1a2a2e', trim: '#6a8a7a', bays: Object.freeze(['ruin', 'waterfall']), focal: 'monolith', dark: 0.3 }),
    // (the core's nest: pods pulsing in the rock, the thing that laid them)
    nest: Object.freeze({ place: 'the nest', back: '#2a1418', bays: Object.freeze(['pods', 'lavafall']), focal: 'nest', dark: 0.28, lamp: Object.freeze({ kind: 'glow', colour: '#ff6a8a', reach: 5.0 }) }),
  }),
});

export const BOX_THEMES = Object.freeze({
  castle: CASTLE,
  xeno: XENO,
  // (SEEDED re-keys of the castle) under a FROST: an ice-blue night and a pale moon, the halls cold stone, the lamps' fire
  // gone blue; the keep's crimson turned a deep sapphire
  'castle-frost': rekey(CASTLE, {
    name: 'the vampire lord\'s castle under frost',
    night: { zenith: '#081626', horizon: '#2c4c6c', towers: '#12283c', moon: { colour: '#eef8ff' } },
    looks: [{ back: '#1c2c40', stone: '#8a9aac', mortar: '#4a5866', top: '#d4e2ee', trim: '#5c6c7e' }, { back: '#3a3452', stone: '#a49ab4', top: '#dcd6e8', trim: '#8a80a8', glass: '#8ab8e8', carpet: '#24406a' },
      { back: '#1c2c34', stone: '#5e7078', top: '#9ab4bc', trim: '#3e5058', glass: '#a8e0f0' }, { back: '#121e36', stone: '#3e4a60', top: '#8a9ab4', trim: '#9ab8e0', carpet: '#1c3c8c' }],
    locales: { chapel: { back: '#566476', carpet: '#24406a' }, tower: { back: '#1e2a3a' }, library: { back: '#263240' }, observatory: { back: '#1c2638' }, ballroom: { back: '#4a5068' }, banquet: { back: '#2e3444' }, dungeon: { back: '#22282e' }, clocktower: { back: '#3c4a5c' }, catacombs: { back: '#2a3238' }, throne: { back: '#141e3c', carpet: '#1c3c8c', glass: '#8ab8e8' }, alchemy: { back: '#22343c' }, armoury: { back: '#263044' } },
    lamp: (l) => ({ colour: l.kind === 'ghost' ? '#c8f4ff' : '#9fd4ff' }),
  }),
  // under a BLOOD MOON: a crimson night and a red moon, the halls in deep reds, every flame hotter
  'castle-blood': rekey(CASTLE, {
    name: 'the vampire lord\'s castle under a blood moon',
    night: { zenith: '#16040a', horizon: '#5c1422', towers: '#22080e', moon: { colour: '#ff6a52', r: 1.6 } },
    looks: [{ back: '#2a0e16', stone: '#6e5458', top: '#b08a8a', trim: '#5a3a40' }, { back: '#3e1416', carpet: '#5a0a14', glass: '#b45a6a' },
      { back: '#2c1418', stone: '#5c4a48', top: '#9a7a72', glass: '#c07070' }, { back: '#30060e', carpet: '#b0101e' }],
    locales: { chapel: { back: '#5a3a44' }, tower: { back: '#2e1418' }, ballroom: { back: '#5a2a3a' }, dungeon: { back: '#2e1a1a' }, throne: { back: '#30060e', carpet: '#c0141e' } },
    lamp: (l) => ({ colour: l.kind === 'ghost' ? '#ff8a8a' : '#ff6a30' }),
  }),
});
export const BOX_THEME_IDS = Object.freeze(Object.keys(BOX_THEMES));

/** The ring's look: the theme's own for the outermost and the core, its middle looks repeated for any rings between. */
export function lookOf(theme, ring, rings) {
  const T = typeof theme === 'string' ? BOX_THEMES[theme] : theme, L = T.looks, last = rings - 1;
  if (ring === 0) return L[0];
  if (ring === last) return L[L.length - 1];
  const mid = L.slice(1, -1);
  return mid.length ? mid[(ring - 1) % mid.length] : L[Math.min(ring, L.length - 1)];
}

/** The locale a room is dressed as (themes' `locales`): a save room the chapel; its ring's `boss` its boss's room, its
 * `shaft` its shafts, its `alt` every other corridor (`corridorIndex` its order among the ring's rooms of its kind;
 * each a locale or a list of them taken in turn); none in an open ring but its towers, or where the theme has none. */
export function localeOf(theme, room, rings, corridorIndex = 0) {
  const T = typeof theme === 'string' ? BOX_THEMES[theme] : theme, L = lookOf(T, room.ring, rings), X = T.locales ?? {};
  // (a look may name a LIST of locales for its shafts, its halls or its other corridors: each room of that kind takes
  // the next in turn, counted in its ring's walk: `corridorIndex` its order among its ring's rooms of its kind)
  const pick = (v, k) => (Array.isArray(v) ? v[((k % v.length) + v.length) % v.length] : v);
  // (an open ring's rooms are under the sky, but its towers, where its look names a locale for its shafts)
  if (L.open && !(room.kind === 'shaft' && L.shaft && X[pick(L.shaft, corridorIndex)])) return null;
  const want = room.save ? (L.save ?? 'chapel') : room.boss ? L.boss : room.kind === 'shaft' ? pick(L.shaft, corridorIndex) : room.kind === 'hall' ? pick(L.hall, corridorIndex) : room.kind === 'corridor' && corridorIndex % 2 === 1 ? pick(L.alt, (corridorIndex - 1) / 2) : null;
  return want && X[want] ? want : null;
}
/** The look a room is dressed in: its locale's words over its ring's look. */
export function roomLook(theme, room, rings, corridorIndex = 0) {
  const T = typeof theme === 'string' ? BOX_THEMES[theme] : theme, L = lookOf(T, room.ring, rings), id = localeOf(T, room, rings, corridorIndex);
  return id ? { ...L, ...T.locales[id], locale: id } : L;
}

const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const lum = (h) => { const c = rgb(h).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
/** WCAG's contrast of two colours (1 to 21) */
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const dist = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));
/** how far two rings must stand apart (the distance of their backs and their stones in RGB, 0 to √3) */
export const RING_APART = 0.12;
/** how far a gate stands out from a back (contrast) */
export const GATE_READS = 2.2;

/** The theme's laws over a box of `rings` rings (the core counted), and, given, the gates it lays: [{ kind, colour, rings }]. */
export function themeLaws(theme, rings, gates = []) {
  const looks = Array.from({ length: rings }, (_, k) => lookOf(theme, k, rings)), out = [];
  const close = [];
  for (let k = 1; k < looks.length; k++) {
    const a = looks[k - 1], b = looks[k];
    if (dist(a.back, b.back) + dist(a.stone, b.stone) < RING_APART) close.push(`${a.place} and ${b.place}`);
  }
  out.push({ id: 'rings-distinct', holds: !close.length, says: close.length ? `${close.join('; ')} look alike` : `each of ${rings} rings unlike the one outside it, in its back and its stone` });
  const faint = [];
  for (const g of gates) for (const r of g.rings) { const c = contrast(g.colour, looks[r].back); if (c < GATE_READS) faint.push(`${g.kind} on ${looks[r].place} (${Math.round(c * 10) / 10})`); }
  out.push({ id: 'gates-read', holds: !faint.length, says: faint.length ? `faint against their room: ${faint.join(', ')}` : `every gate stands out from its room's back (contrast ${GATE_READS} or more)` });
  return out;
}

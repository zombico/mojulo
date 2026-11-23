// THE RPG DUNGEON KITS' STYLE CARDS (stage.js STAGE_KITS, dressed by era/dungeon.js): four dungeons that are not built
// stone at all, or not stone as a church is, each its own cause read in what stands in it. A card: its `principles`,
// its `materials` (role → hex: glow and glow2 the self-lit), what its doodads cast (`light`), and what stands where
// (`centre`, `lay`, `walls`, `corners`, `hall`, `ceiling`: dungeon.js). A new dungeon is a card here and a kit card
// in stage.js; a new thing in it a doodad row in dungeon.js.

// THE DEEP FORGE: a hall the dwarves cut to work metal, square and heavy, the light the forge's and the molten run's
export const DEEP_FORGE = Object.freeze({
  id: 'dungeon', kit: 'deep-forge',
  principles: Object.freeze([
    'The hall is cut, not built: square piers left standing in the rock, a flat beam over each, nothing arched.',
    'Its light is work: the forge glows at the heart, the molten run lights the floor beside the walk, the walls are dark.',
    'Everything is made to be used: anvils on their blocks, carts of ore, tools on racks, a crucible on the hoist.',
  ]),
  materials: Object.freeze({ stone: '#3e3a3c', metal: '#4a4644', wood: '#5a4232', trim: '#b8873a', glow: '#ff7a1e', glow2: '#ffb347' }),
  light: Object.freeze({ color: '#ff8a3a', intensity: 2.6, radius: 11 }),
  centre: Object.freeze({ kind: 'forge-hearth', clear: 2.6 }),
  lay: Object.freeze({ kind: 'molten-channel', of: 0.75, w: 0.55 }),
  walls: Object.freeze({ kinds: ['anvil', 'tool-rack', 'ore-cart'], share: 0.75 }),
  corners: Object.freeze({ kinds: ['ore-cart', 'anvil'], share: 0.6 }),
  hall: Object.freeze({ kinds: ['tool-rack', 'ore-cart'], share: 0.55 }),
  ceiling: Object.freeze({ kind: 'chain-hoist', every: 6, in: 'chamber', z: 2.6 }),
});

// THE FUNGAL GROTTO: a cave the fungus has taken, no hand in it at all; the light is the growth's own
export const FUNGAL_GROTTO = Object.freeze({
  id: 'dungeon', kit: 'fungal-grotto',
  principles: Object.freeze([
    'No one built it: rough rock walls and vault, no plinth, no cornice, no pier but the rock\'s own.',
    'The light is alive: the caps glow under their gills, small growth glows at the walls\' feet, spores glow in the air.',
    'It grows from where it is damp and dark: giant caps at the heart, brackets up the walls, roots hung from the vault.',
  ]),
  materials: Object.freeze({ stem: '#cbbfa8', cap: '#6a3f6e', root: '#4a3a2c', water: '#0c1416', glow: '#9a7bff', glow2: '#5cffc8' }),
  light: Object.freeze({ color: '#8f7bff', intensity: 2.2, radius: 9 }),
  centre: Object.freeze({ kind: 'mushroom-grove', n: 4, clear: 3 }),
  lay: Object.freeze({ kind: 'still-pool', r: 1.8, place: 'end' }),
  walls: Object.freeze({ kinds: ['shelf-fungus', 'glowcaps'], share: 0.7 }),
  corners: Object.freeze({ kinds: ['glowcaps'], share: 0.8 }),
  hall: Object.freeze({ kinds: ['glowcaps', 'shelf-fungus'], share: 0.65 }),
  ceiling: Object.freeze({ kind: 'roots', every: 4, in: 'all' }),
});

// THE DROWNED SHRINE: a sea god's temple the sea took back, flooded to the ankle, the light the deep's cold glow
export const DROWNED_SHRINE = Object.freeze({
  id: 'dungeon', kit: 'drowned-shrine',
  principles: Object.freeze([
    'The sea came in and stayed: still water over the floor, coral and kelp grown up the walls the priests built.',
    'The altar still stands above the water, on its steps, the god\'s shell open on it and the pearl alight.',
    'Its light is the deep\'s: cold, blue-green, from things that drift; no flame burns here.',
  ]),
  materials: Object.freeze({ stone: '#6f8580', shell: '#e8d8c4', coral: '#e86a58', coral2: '#d99a5a', kelp: '#3f5a34', water: '#1c4a52', glow: '#7ff0ff', glow2: '#bff8ff' }),
  light: Object.freeze({ color: '#6fe8ff', intensity: 1.4, radius: 8 }),
  centre: Object.freeze({ kind: 'drowned-altar', clear: 2.8 }),
  lay: Object.freeze({ kind: 'flood', of: 0.85 }),
  walls: Object.freeze({ kinds: ['kelp', 'coral'], share: 0.75 }),
  corners: Object.freeze({ kinds: ['coral', 'kelp'], share: 0.7 }),
  hall: Object.freeze({ kinds: ['kelp', 'coral'], share: 0.6 }),
  ceiling: Object.freeze({ kind: 'jelly-lantern', every: 4.5, in: 'all', z: 3.2 }),
});

// THE ARCANE VAULT: a mage's sealed archive, precise and quiet, its light the crystals' and the circle's
export const ARCANE_VAULT = Object.freeze({
  id: 'dungeon', kit: 'arcane-vault',
  principles: Object.freeze([
    'It is a mind made into a room: everything set out exactly, the orrery at the centre of its circle.',
    'The light is the work\'s own: the circle\'s runes, the crystals floating under the vault, a mote over the open book.',
    'Knowledge lines it: shelves of books in every bay, a lectern, crystals grown where no one tidied.',
  ]),
  materials: Object.freeze({ metal: '#8c7a4a', trim: '#c9a850', wood: '#3c2a22', book: '#6a2a3a', book2: '#2a4a6a', page: '#f0e6cc', planet: '#a8b4c8', glow: '#b98cff', glow2: '#7fd4ff' }),
  light: Object.freeze({ color: '#a88cff', intensity: 1.4, radius: 8 }),
  centre: Object.freeze({ kind: 'orrery', clear: 3.6 }),
  lay: Object.freeze({ kind: 'rune-circle', r: 2.6 }),
  walls: Object.freeze({ kinds: ['bookcase', 'bookcase', 'lectern'], share: 0.85 }),
  corners: Object.freeze({ kinds: ['crystal-cluster'], share: 0.7 }),
  hall: Object.freeze({ kinds: ['bookcase', 'crystal-cluster'], share: 0.6 }),
  ceiling: Object.freeze({ kind: 'floating-crystal', every: 5, in: 'all', z: 3.4 }),
});

export const DUNGEON_STYLES = Object.freeze({ 'deep-forge': DEEP_FORGE, 'fungal-grotto': FUNGAL_GROTTO, 'drowned-shrine': DROWNED_SHRINE, 'arcane-vault': ARCANE_VAULT });

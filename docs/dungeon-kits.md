# RPG dungeon kits

Four room kits made for RPG dungeons, none of them built stone as the gothic kits are: **deep-forge** (a dwarven hall
cut to work metal), **fungal-grotto** (a cave the fungus took), **drowned-shrine** (a sea god's temple the sea took
back) and **arcane-vault** (a mage's sealed archive). Each is a `STAGE_KITS` entry (`control/lib/graph/era/stage.js`),
dressed by one data-driven dressing (`era/dungeon.js` `dungeonDress`) from its style card
(`era/style/dungeon-kits.js`).

## The shape: a chamber and its halls

Each kit's starter (`era/entries.js` `KIT_STARTERS`) is the smallest dungeon it makes: a hall leading in, the chamber,
a hall leading on. The largest room is the chamber; every other room is a hall. Grow one by adding rooms and links
the way the starter does (`rooms: [{ id, x, y, w, d, h }]`, `links: [{ from, to }]`, each pair sharing a wall):

```js
{ kind: 'stage', kit: 'deep-forge', seed: 3,
  rooms: [{ id: 'adit', x: 6, y: 0, w: 5, d: 12, h: 5 }, { id: 'forge', x: 0, y: 12, w: 18, d: 16, h: 9 }, { id: 'store', x: 18, y: 16, w: 12, d: 5, h: 5 }],
  links: [{ from: 'adit', to: 'forge' }, { from: 'forge', to: 'store' }] }
```

A hall is a room narrow enough to walk (4–5 m); a chamber wants 15 m or more so its set piece has room round it.

## The card: what stands where

| key | what | where |
|---|---|---|
| `centre` | the set piece `{ kind, clear?, ... }` | the chamber's middle, kept clear by `clear` m |
| `lay` | the floor's feature `{ kind, of?, place?, ... }` | a channel beside the walk, a flood across it, a pool toward the far end (`place: 'end'`), a circle round the middle |
| `walls` | `{ kinds, share }` | the chamber's wall bases between its piers |
| `corners` | `{ kinds, share }` | every room's corners |
| `hall` | `{ kinds, share }` | the halls' wall bases |
| `ceiling` | `{ kind, every, in, z? }` | hung or floating on a grid `every` m apart, over the chamber, the halls or all |
| `light` | `{ color, intensity, radius }` | what each glow casts |
| `materials` | role → `#hex` | the doodads' surfaces; `glow` and `glow2` the self-lit |

Things at the walls and corners stand at the room props' places (`era/props.js` `wallSpots`): never in a doorway, on the
walking line or on the set piece. The kit card shapes the shell (piers, plinth, cornice, arch or none, the tiles, a
frieze, the lamps; `torch.none` for a place no hand lit).

## The doodads

`DUNGEON_DOODADS` (`era/dungeon.js`), each `(ctx, p, N, U, s, seed, o)`: the foot on the floor, the way into the room,
the way along the wall, a die, a seed and the card's numbers. A doodad builds its faces with `obox`, `lathe`, `panel`
and the self-lit `glowFace` / `glowGem` / `glowBox` / `ring` / `disc`, and lays its light with `shine`.

- forge: `forge-hearth`, `anvil`, `ore-cart`, `chain-hoist`, `tool-rack`, `molten-channel`
- grotto: `mushroom-grove`, `glowcaps`, `shelf-fungus`, `roots`, `spores`, `still-pool`
- shrine: `drowned-altar`, `coral`, `kelp`, `jelly-lantern`, `flood`
- vault: `orrery`, `rune-circle`, `bookcase`, `lectern`, `crystal-cluster`, `floating-crystal`

A doodad is one kit's by its look, not by rule: any card may name any of them.

## Adding one

- **A new thing:** a `DUNGEON_DOODADS` row; name it on a card. A floor feature joins `FLOOR_KINDS`.
- **A new dungeon:** a style card in `style/dungeon-kits.js` (`id: 'dungeon'`), a kit card in `STAGE_KITS`, a starter
  in `KIT_STARTERS`, its words in `KIT_WORDS`. `era/dungeon.test.js` holds every card to doodads that exist.

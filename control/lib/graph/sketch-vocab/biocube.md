---
{ "id": "biocube", "name": "A biocube — what grows in a level, and trees composed as silhouettes", "summary": "a biocube is a level's flora as data (trees, grass, bushes, wildflowers) and its fauna (gnats, fireflies, butterflies, birds overhead), the geocube's sibling: the cube holds the look and its colours, the biocube what grows; its tree KINDS are silhouettes you compose (a leaf form, proportions, stems, branching, bark marks) and paint from the colour theorist's offer, never species looked up from nature", "when": "someone wants a level's trees or flora to look a certain way: a birch wood, willows by a path, an umbrella grove, a forest of mixed trees, autumn colour, V-shaped or many-stemmed trees, fine or heavy branching, white or dark bark, sparse upland trees, bare ground, more or less grass; composed clumps (ikebana), harmonious tree colours, a dominant tree with accents; wildlife, butterflies, gnats, midges, fireflies, birds flying overhead, sheep grazing, deer in the woods, rabbits, a herd, a pasture, a level that feels alive, animals to pet, animals that can be hunted or killed", "tier": "render-primitive", "marks": [], "phase": "p1" }
---

A biocube says WHAT grows in a level; the geocube says how the level LOOKS. Colours stay the cube's: the colour
theorist solves them from the cube's palette and offers them; a biocube only picks. Trees are not botany here: a tree
is a SILHOUETTE you compose (its leaf form, its proportions, its trunk and branching, its bark's marks) and the world
paints it in its own style.

## Where it goes

- a `stage` recipe: `biocube` (a preset id, a document, or `{ from: <preset>, …changes }`), its land a kit's
  (`kit: 'isekai-meadow'`), gritty when `shading: { grit: 0.7 }` (grit 0.35 and up);
- a geocube: its own `biocube` (the flora every level of the cube grows); the `geocube` kind's `biocube` for one
  street's land.

A gritty land draws trees as composed kinds (below); a quiet land keeps the sixth-gen ball crowns whatever it names.

## The document

`{ from?: <preset>, flora: { trees?, grass?, shrubs?, flowers? } }`, each block merged over the preset's. Presets
(`BIOCUBE_IDS`): `meadow`, `upland` (lone trees, short thin grass), `grove` (close clumps, bushes), `forest` (arranged
clumps, the near trees whole and the far ones shapes), `bare`.

- **trees** `{ clusters, perCluster: [lo, hi], spread, heights: [lo, hi] m, clearTrail, clearCliff, compose?, bands?,
  kinds? }`: `clusters` clumps of `perCluster` trees `spread` m round each; `compose: 'ikebana'` arranges a clump (a
  tall back tree, two stepping down, the trail's side open); `bands: true` builds a tree whole near the trail, stamped
  further off, its shape alone far (a big level stays cheap).
- **grass** `{ clusters, perCluster, spacing, scatter, fringeEvery, height, kinds?, field?, live? }` or null:
  tussocks, the trail's fringe, the sea of blades along it (`field`) and the carpet round the walker (`live: { kind,
  density, height }`).
- **shrubs** `{ count, bloom, fruit }` or null; **flowers** `{ share, mix? }` or null (wildflowers in the carpet).

## Tree kinds

`trees.kinds`: 1 to 6, each clump one of them. A kind is a form's name, or:

```
{ form,           the silhouette: spray (fans of leaves along twigs), plate (flat level tiers), weep (long hanging
                  drops), tuft (brushes at bare limbs' tips), whorl (level spokes round each limb's end: an umbrella)
  scale?,         its height against the level's heights (0.4–2)
  trunk?,         where its crown starts, a share of its height (0.15–0.8; high for a tall clean stem)
  girth?,         its trunk's radius, a share of its height (0.015–0.12)
  spread?,        its crown's radius, a share of its height (0.12–0.6)
  density?,       its limbs against the form's (0.4–2.5)
  stems?, splay?, trunks from its foot (1–4; 2 a V, 3–4 a clump) and how far each leans out (degrees, 0–40)
  branch?,        limbs' and twigs' thickness (0.3–1.6; under 1 the finer)
  split?,         how often each limb forks again (0–2: finer, airier branching)
  leaf?,          its foliage: 0 the world's, 1 deep, 2 young, 3 turned (toward the cube's accent, or autumn)
  bark?,          its wood: 0 the world's, 1 warm, 2 pale, 3 dark, 4 near-white
  barkForm?,      its bark's marks: furrowed, smooth, banded (dark dashes and scars), plated (cracked plates), peeling
  share? }        how much of the level it is against the other kinds (1 each): 6, 3, 1 is a dominant, a subordinate, an accent
```

The colours are the theorist's offer for THIS world: each solved from the cube's own foliage, grass, rock and soil, so
`leaf: 2` is this world's young green, not a fixed one. Which tree takes which is yours.

Compose a wood as a dominant kind and one or two accents, each a different silhouette, so a clump reads apart from its
neighbour: a pale-stemmed fine tree against a heavy dark one, a weeping kind by the path, a turned kind for one note of
colour. Some silhouettes people ask for:

- a birch: `{ form: 'spray', spread: 0.26, branch: 0.55, split: 1, bark: 4, barkForm: 'banded' }`
- a V: `{ form: 'spray', stems: 2, splay: 22, trunk: 0.38 }`; a many-stemmed clump: `{ form: 'tuft', stems: 3 }`
- a tall clean-stemmed tree with cracked bark: `{ form: 'tuft', trunk: 0.62, girth: 0.06, barkForm: 'plated' }`
- an airy weeping tree: `{ form: 'weep', split: 2, branch: 0.5, leaf: 2, barkForm: 'peeling' }`
- an umbrella grove: `{ form: 'whorl', scale: 1.3, trunk: 0.7, spread: 0.45 }`

## A clump, composed (ikebana)

With `compose: 'ikebana'` each clump has roles: `shin` the tall line at the back, `soe` the mass stepping down, `hikae`
the low anchor in front, `filler` round them, the trail's side left open. Cast them and colour them:

- `clump: { shin, soe, hikae, filler }`: each role's kind, by its place in `kinds` (from 0). Contrast line, mass and mound:
  a tall clean-stemmed kind for `shin`, a spreading one for `soe`, a low wide one for `hikae` (`{ form: 'spray', scale:
  0.45, trunk: 0.15, spread: 0.55, stems: 3 }` is a mound).
- `harmony`: the clump's colours by role, solved by the colour theorist from the world's foliage and checked (each role
  steps from the one behind it, and every role stands off the grass). `analogous` (the hue stepping cool behind to warm
  in front), `value` (one hue, dark behind to light in front: depth from afar), `accent` (the world's green, and one note
  turned on the anchor), `season` (the clump turning: the line green, the mass half turned, the anchor turned). A role's
  harmony colour wins over its kind's `leaf`.

Stamped trees vary a little in value each, so no two read the same.

## Fauna

`fauna`: what lives in the level, beside what grows. Fauna are never enemies (a hunting animal is a game's foe), and
not every level wants them: a biocube grows none unless asked, every preset's is none. A preset (`FAUNA_IDS`):
`summer-day` (butterflies, gnats, a flock crossing), `summer-night` (fireflies, a few gnats), `pasture` (two flocks of
sheep grazing, to pet, butterflies, birds), `woodland` (deer, rabbits, birds); a document `{ swarms?: { <kind>: true |
{ …settings } | null }, herds?: { <species>: true | { groups, size, killable, interact } | null } }`; or `{ from:
<preset>, swarms?, herds? }`, kind by kind and species by species, null for none.

The field's kinds: scenery that is never in the way, each on its own ground, in the world's own colours:

- **gnats** `{ clouds (1–24), per (6–80) }`: dark specks jittering in a column over the grass by the way;
- **fireflies** `{ count (1–400) }`: glowing specks drifting low by the trees, each blinking: a night's light;
- **butterflies** `{ count (1–60) }`: wings beating on a wandering loop above the grass;
- **birds** `{ flock: [lo, hi], every s, height: [lo, hi] m }`: a loose V crossing high overhead every `every` seconds.

Each stands for an animal in the encyclopedia, and its size class is that animal's, measured: `mini` (insects), `smol`
(a mouse to a pet), `chonky` (to a person or cattle), `behemoth` (a hippo), `gargantuan` (an elephant and up).

The herds: animals that take up room, a species of the encyclopedia by its id (`sheep`, `deer`, `rabbit`, `cow`…),
`groups` herds of `size: [lo, hi]` each on the open ground off the way. Each walks on its own gait at its own pace,
drawn by its own rig: a grazer crops the grass round its herd, every other animal wanders round its ground. None is
hostile, whatever its species (a wolf here only wanders): no weapon, no side, a passive mind. Each herd may also be:

- **killable** (`false`, `true` or `{ hp }`; false by default): its body takes hits, its hp by its size unless named,
  and it flinches, falls and lies; it never strikes back. Its ids begin `fauna:`, so a `defeat-all` that names its foes
  never counts it;
- **petted** (`interact: 'pet'`): the walker (or the player in a game) in reach presses interact; it stops, turns to them,
  stands content a moment under a heart, then goes back to grazing. A game hears `petted` { entity, species } on its bus.

Petting is the World page's: Godot plays the herds, not the petting. Not yet: a bug as a unit (mini animals are
swarms), an animal of the water, a body with no stride on land (a snake), feeding, riding.

```
biocube: { from: 'grove', fauna: { from: 'summer-night', swarms: { fireflies: { count: 150 } } } }
biocube: { from: 'meadow', fauna: { from: 'pasture', herds: { sheep: { groups: 3 }, cow: { size: [2, 4] } } } }
biocube: { from: 'forest', fauna: { herds: { deer: { killable: true }, rabbit: { interact: 'pet' } } } }
```

## Example

```
{ kind: 'stage', kit: 'isekai-meadow', trail: {}, shading: { grit: 0.7 },
  biocube: { from: 'forest', flora: { trees: { kinds: [
    { form: 'tuft', trunk: 0.6, girth: 0.03, branch: 0.7, bark: 2, barkForm: 'smooth', share: 2 },
    { form: 'spray', share: 3 },
    { form: 'spray', scale: 0.45, trunk: 0.15, spread: 0.55, stems: 3, share: 1 } ],
    clump: { shin: 0, soe: 1, hikae: 2, filler: 1 }, harmony: 'value' } } } }
```

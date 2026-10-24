---
{ "id": "biocube", "name": "A biocube — what grows in a level, and trees composed as silhouettes", "summary": "a biocube is a level's flora as data (trees, grass, bushes, wildflowers), the geocube's sibling: the cube holds the look and its colours, the biocube what grows; its tree KINDS are silhouettes you compose (a leaf form, proportions, stems, branching, bark marks) and paint from the colour theorist's offer, never species looked up from nature", "when": "someone wants a level's trees or flora to look a certain way: winter's bare trees and evergreens, firs and pines, a birch wood, willows by a path, an umbrella grove, a forest of mixed trees, autumn colour, V-shaped or many-stemmed trees, fine or heavy branching, white or dark bark, sparse upland trees, bare ground, more or less grass; composed clumps (ikebana), harmonious tree colours, a dominant tree with accents", "tier": "render-primitive", "marks": [], "phase": "p1" }
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
- **bushes** `{ kinds, sections? }`: bushes and shrubs composed in SECTIONS (below).

## Tree kinds

`trees.kinds`: 1 to 6, each clump one of them. A kind is a form's name, or:

```
{ form,           the silhouette: spray (fans of leaves along twigs), plate (flat level tiers), weep (long hanging
                  drops), tuft (brushes at bare limbs' tips), whorl (level spokes round each limb's end: an umbrella),
                  spire (a cone of near-level tiers to a leader: a fir's, a pine's; evergreen)
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
  share?,        how much of the level it is against the other kinds (1 each): 6, 3, 1 is a dominant, a subordinate, an accent
  evergreen? }    it keeps its leaves when the season is bare (a spire does unless it says false)
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
- a fir: `{ form: 'spire', trunk: 0.15, spread: 0.26, leaf: 1 }`; a tall pine: `{ form: 'spire', scale: 1.3, trunk: 0.45, spread: 0.18 }`

## The season

`trees.season: 'bare'` drops the leaves of whatever has a fall: every tree and bush is its limbs and twigs (a tree with
no kind grown as a spray's), but the evergreens, which keep their crowns: a `spire` (firs, pines) unless it says
`evergreen: false`, and any kind with `evergreen: true`. The far woods go to the bark's grey-brown. For deep
winter, a bare season under the cube's snow (`get_sketch_vocab({ id: 'geocube' })`, `snow`): the snow lies on the
evergreen's crowns and along the bare limbs' tops.

## Bushes and shrubs, in sections

`flora.bushes.kinds` (1 to 6) are tree kinds with the trunk taken away: a form's name, or `{ form, height: [lo, hi] m,
spread, stems, splay, trunk, girth, branch, split, density, leaf, bark, barkForm, share, walk }`. The defaults are a
bush's (0.8–1.5 m, five thin stems from the foot, fine limbs, a wide low crown). `walk: 'block'` (default) stops a
walker (and is a collider for an engine); `walk: 'through'` is pushed through (low brush, ferny cover).

(`evergreen` too, for a bush that keeps its leaves in a bare season.) `sections: { count, radius: [lo, hi] m, fill (bushes a m²), gap m, band: [near, far] m from the trail }`: patches of
one kind each, off the trail, clear of the rocks, the trees and each other, mounding toward their middle; no grass grows
up through a bush. `count: 0` for none (bushes only in clumps). Mind the grass: a bush under the meadow's height sinks
into it; a hedge is 1.2 m and up, brush you see over the grass 0.8 m and up.

## A clump, composed (ikebana)

With `compose: 'ikebana'` each clump has roles: `shin` the tall line at the back, `soe` the mass stepping down, `hikae`
the low anchor in front, `filler` round them, the trail's side left open. Cast them and colour them:

- `clump: { shin, soe, hikae, filler }`: each role's kind, by its place in `kinds` (from 0). Contrast line, mass and mound:
  a tall clean-stemmed kind for `shin`, a spreading one for `soe`, a low wide one for `hikae` (`{ form: 'spray', scale:
  0.45, trunk: 0.15, spread: 0.55, stems: 3 }` is a mound).
  A role may be a BUSH: `{ bush: n }`, a kind of `flora.bushes`: `hikae: { bush: 0 }` grounds the clump on a shrub,
  `filler: { bush: 1 }` fills round it with brush; a bush role takes its role's harmony colour as a tree does.
- `harmony`: the clump's colours by role, solved by the colour theorist from the world's foliage and checked (each role
  steps from the one behind it, and every role stands off the grass). `analogous` (the hue stepping cool behind to warm
  in front), `value` (one hue, dark behind to light in front: depth from afar), `accent` (the world's green, and one note
  turned on the anchor), `season` (the clump turning: the line green, the mass half turned, the anchor turned). A role's
  harmony colour wins over its kind's `leaf`.

Stamped trees vary a little in value each, so no two read the same.

## Example

```
{ kind: 'stage', kit: 'isekai-meadow', trail: {}, shading: { grit: 0.7 },
  biocube: { from: 'forest', flora: { trees: { kinds: [
    { form: 'tuft', trunk: 0.6, girth: 0.03, branch: 0.7, bark: 2, barkForm: 'smooth', share: 2 },
    { form: 'spray', share: 3 },
    { form: 'spray', scale: 0.45, trunk: 0.15, spread: 0.55, stems: 3, share: 1 } ],
    clump: { shin: 0, soe: 1, hikae: 2, filler: 1 }, harmony: 'value' } } } }
```

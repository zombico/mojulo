---
{
  "id": "equipment",
  "name": "Equipment (arms named by intent and direction: fantasy, modern and future)",
  "family": "object",
  "entry": "mint_solid",
  "summary": "Compose fantasy arms (dagger, sword, greatsword, staff, bow, shield) from an item, a style and a few dials, and modern or future ones (pistols, revolvers, carbines, rifles, bullpups, marksman rifles, submachine guns, shotguns, knives, karambits, blasters, pulse rifles, vibroblades, and near-future smart pistols, PDWs, caseless rifles, coilguns and breachers styled real) from an item, a model, a line, a finish and tunable parts. A handful of laws turn the words into every dimension, so an item nobody has drawn before comes out with the samples' discipline. The recipe stores the words, stamped with the laws, and re-derives the item on every read.",
  "when": "Reach for this on 'a pistol / revolver / assault rifle / sniper rifle / bullpup / SMG / shotgun', 'a combat knife / tanto / karambit', 'a blaster / pulse rifle / railgun / sci-fi gun / vibroblade', 'a near-future / realistic sci-fi gun', 'a coilgun / gauss rifle / caseless rifle / smart gun / PDW', 'a gun with a red dot / scope / suppressor', 'guns for a seventh-gen shooter', 'a fantasy sword / dagger / greatsword', 'a wizard's staff / a druid staff', 'an elven bow / a longbow', 'a shield with a gem / a heater shield / a round shield', 'fantasy weapons / gear / arms in <style>', 'make the gem bigger / more stylized / more anime', 'a warlock's staff', 'a weapon for my hero', 'a style guide for our weapons'."
}
---

Name the item and its direction; the laws do the rest. These are display and game props: geometry for a hero, a scene or a printed replica, with no construction or function beyond the shape. An equipment item is a workbench whose monomers are EXPANDED from a short `build` on every read: the stored recipe is about a hundred bytes, and one dial restyles it in place. Everything the workbench gives (the World, the studio shots, the closure audit, `.glb` / `.stl` / `.usdz` / `.scad`, the assembler) sees plain monomers.

## Spec

```
{ item: 'dagger' | 'sword' | 'greatsword' | 'staff' | 'bow' | 'shield',
  style?: 'historical' | 'elven' | 'dwarven' | 'brutal' | 'eastern' | 'anime-hero' | 'druid' | 'celestial' | { …a card },
  dials?: { stylize?: 0–1, mass?: 0.5–2, focus?, ornament?: 0–3 },
  parts?: { <slot>: <variant>, … },
  gem?:   '<gem>' | { gem, cut?: 'natural' | 'brilliant' | 'cabochon', glow?: 0–1 } | null,
  seed?:  <int>,
  units?: 'cm' (the default), title?, lathes? / sweeps? / … (your own parts beside the built item) }
```

Stored as `{ kind: 'workbench', build: { type: 'equipment', …, laws: 2 } }` (laws 2: a hilt carrying an end, below). Edit it with a patch on `/build/…`:
`set /build/dials/stylize 0.9`, `set /build/style 'celestial'`, `set /build/parts/head 'claw'`, `set /build/gem 'ruby'`.

## The dials

- `stylize` — realism 0 → stylized 1. ONE proportion curve for the whole item, not a filter (below).
- `mass` — heft: 0.8 slender … 1 … 1.35 heavy.
- `focus` — the signature, where a stone goes: `guard` | `pommel` | `blade` (swords), `head` (staff), `riser` | `tips` | `curve` (bow), `boss` (shield), or `none`.
- `ornament` — 0–3, how many secondary accents the item is allowed.

## The laws (what the dials drive)

1. **Hierarchy.** One focal element; everything else is sized against it. **1b.** On a shield the stone is sized against the whole face (6 % of its diameter realistic → 34 % stylized), not a local boss.
2. **Stylization is a proportion law.** As `stylize` rises the focal grows fastest (a stone 0.85× its host → about 3×), the hilt grows for hand-scale readability, a blade widens and shortens, a bow's curve exaggerates, a long item compresses, and detail gets fewer and bigger (wrap turns, barbs, rays, twigs).
3. **The host frames the focal.** The part that carries a stone re-forms as its setting: a flush bezel below 0.25, then a boss, a cage sized to the stone, or a claw of prongs. The setting touches the stone. Wings and quillons root at it.
4. **Readability floor.** No feature thinner than a stylize-dependent fraction of the item's length: thin at 0, bolder at 1.
5. **Contrast spends on the focal.** Fittings recede toward neutral as stylization rises; the stone takes the glow.
6. **The focal sits where the eye already goes:** a staff's head, a bow's riser, a shield's boss. Leading lines (rays, bands, vines, feathers) run from the frame into it.
7. **Organic forms grow.** A branching head shares its shaft's cross-section among its limbs (r² = Σ rᵢ²), so twigs taper by construction; barked parts carry `bark: { species, tile }` with the tile scaled to the stem.

### Laws 2: a hilt carrying an end

Laws 2 (current; stamped at mint, so a row minted under laws 1 keeps its bytes) draws a sword or a staff as a **hilt**
(what the hand holds) carrying an **end** (what does the work), chosen apart:

- `parts.hilt` — a sword hilt (pommel, grip, guard): `dagger` · `one-hand` · `hand-and-half` · `two-hand`; or a haft:
  `wand` · `arm` · `long` · `pole` (a pole taken at two bands). `parts.hiltLength` (cm) sets the grip's or the haft's
  length.
- `parts.end` — `blade` (its outline the `blade` word) or a head (`plain` · `branch` · `claw` · `crescent` · `block` ·
  `mace` · `ringed` · `spear` · `axe` · `halberd`), or one of laws 2's own staves and clubs: `club` (a knotted swelling) ·
  `spiked` (the club banded and studded) · `flanged` (a flanged mace) · `hammer` (a war hammer: a face, a back spike, a
  top spike) · `maul` (a two-faced block) · `bone` (a long bone's knobbed end; give `shaft: ['matte', '#d6cfbd']` for a
  bone club) · `crook` (a shepherd's curl) · `orb` (a polished sphere in a cup) · `cap` (an iron shoe: a quarterstaff) ·
  `trident` · `scythe` (a long curved blade at right angles to the haft). `parts.endLength` (cm) sets a blade's length
  (a head on a sword hilt: the neck it rises on).

The item names are presets: `dagger` (dagger + blade), `sword` (one-hand + blade), `greatsword` (two-hand + blade),
`staff` (its `reach`'s haft + its `head`). So `{ item: 'staff', parts: { hilt: 'pole', end: 'blade', blade: 'sabre' } }`
is a glaive, `{ item: 'sword', parts: { hilt: 'hand-and-half' } }` a longsword, `{ item: 'sword', parts: { end: 'mace' } }`
a sword-hilted mace, `{ item: 'staff', parts: { hilt: 'long', end: 'axe' } }` a long axe. Four more laws size them:

8. **The grip is counted in hands:** one-hand 11.5 cm, hand-and-half 19, two-hand 30.
9. **The guard is sized by the blade it stops:** its span a multiple of the blade's base width (2.3 dagger → 5.4 two-hand),
   never more than 0.42 of the blade's length (more as it stylizes); its rise (horns, wings, spikes) bounded by its span.
10. **The pommel balances the blade:** its radius from the blade's mass, between 1.15 and about twice the grip's.
11. **A head is sized by its haft:** a spear's point 0.16 of it, a halberd 0.26, an axe 0.2, a blade on a haft 0.24; a
   grip band and a collar sit on a grown shaft wherever it wanders.

**Shields under laws 2** take more: `outline` also `scutum` (a tall rounded rectangle) · `tower` · `oval` · `buckler`;
`curve` `flat` · `barrel` (bent about the upright, the face wrapping the arm) · `dish` (a dome: round outlines), with
`bend` 0–1 how deep (a scutum and a tower barrel by their own, a buckler dishes); `construction` `board` · `planks`
(boards with their seams, two iron bands, nails) · `panels` (the face framed into panels by riveted straps). A curved
shield carries its boss and its construction; the other devices are the flat board's. A laws-2 shield naming none of
these is the laws-1 shield.

**The armory** (`equipment/armory.js`): generic arms for a crowd, in the `grave` card (rust, grey wood, verdigris,
chipped edges): rusted-sword · notched-blade · grave-dagger · old-longsword · old-greatsword · grave-axe · cudgel ·
spiked-club · bone-club · flanged-mace · war-hammer · broken-spear · grave-halberd · reaper-scythe · grave-bow ·
rotten-buckler · cracked-round · old-kite · grave-scutum, drawn by role from kits (rabble · soldier · archer · warden ·
brute · captain; a two-handed arm leaves the left hand empty). An armed undead (the hero door's `undead` with the
`armed` layer) minted now draws its arms from its card's kit, rolled on its own seed, so a host of skeletons is armed
variously; one minted before keeps its card's own arms.

`stats.equipment.variants` names the hilt and the end; the readout's `guard`, `pommel`, `grip`, `blade` or `haft`
give their sizes. The bow and the shield are not hilts and ends: laws 2 draws them as laws 1 did.

## Items and their slots (`parts`)

- **Swords** — `blade`: straight · broad · leaf · hero · flamberge · cleaver · sabre · tanto. `guard`: bar · crescent · block · spiked · disc · winged. `pommel`: wheel · block · spike · cap · ring · cage. `grip`: leather · banded · wire · cord.
- **Staff** — `head`: plain · branch · claw · crescent · block · mace · ringed · spear · axe · halberd. `reach`: long (the staff, a spear, a halberd; the default) · arm (a haft: an axe, a mace, a warhammer with a `block` head, a sceptre) · wand. The blade heads carry no stone: a `spear` is a point (the sword's blade loft, its outline the `blade` word, leaf when none) on a socket; an `axe` a bearded blade to one side and a poll to the other at the haft's top; a `halberd` the axe's blade low on the head, a point rising through it and a spike behind. `shaftForm`: turned · gnarled. `bark`: oak · beech · pine · chestnut · spruce · silverfir · pineUpper. Branch heads take `limbs` (1–8), `twigs` (0–6), `leaves`; a crescent takes `wings: true`. A branch, claw, crescent or block head cradles a stone, so it needs one to resolve (a `gem` and focus `head`); plain, mace and ringed carry none.
- **Bow** — `limb`: longbow · recurve · horn · yumi (every bow needs one, from `parts` or its card). `tips`: none · leaf · wing · spike · horn.
- **Shield** — `outline`: round · heater · kite. `device`: none · chevron · rays · bands · spikes · mon · wings · vine.

Gems: quartz, amethyst, calcite, diamond, ruby, sapphire, tourmaline, opal. A `natural` cut is the raw crystal (a druid's stone); a face-set stone reads best `cabochon` or `brilliant`.

## Samples, not a catalogue

The eight styles are cards (plain JSON: `dials`, `lean` (multipliers 0.25–4 on W, T, L, span, grip, pommel), `language` per item, `edge` (fuller and bevel 0–1, barbs 0–12), `roles`, `gem`). A role is a shelf row `['<material>', '#hex']` or a metal surface `{ metal, finish?, film?, pattern? }` (the workbench card's metal-surface line): `{ metal: 'steel', film: { temper: 300 } }` is blued steel, `{ metal: 'bronze', film: { age: 40 } }` verdigris, `{ metal: 'steel', pattern: { kind: 'damascus', type: 'twist' } }` a pattern-welded blade (the eastern sample's). A blade's pattern with no `scale` is sized to the blade by the readability law. Copy one, change it, and pass it as `style` — a new direction is a new card, not code:

```
style: { id: 'frost', dials: { stylize: 0.6, mass: 0.9, focus: 'guard', ornament: 2 },
  language: { blade: 'leaf', guard: 'winged', pommel: 'cap', grip: 'wire',
    staff: { head: 'claw', focus: 'head', shaft: ['satin', '#dfe8ef'] } },
  edge: { fuller: 0.2, bevel: 0.5 },
  roles: { blade: ['silver', '#e6eef4'], fittings: ['silver', '#b8c6d2'], accent: ['silver', '#f2f6fa'], wrap: ['matte', '#2d4a66'] },
  gem: { gem: 'sapphire', cut: 'natural', glow: 0.5 } }
```

Fresh items need no card at all: `{ item: 'staff', style: 'brutal', parts: { head: 'claw', focus: 'head' }, gem: 'ruby', dials: { stylize: 0.75 } }` is a warlock's staff no sample defines.

## The readout

`stats.equipment` names the item, style, laws, resolved dials and variants, the **focal** (where, which stone, its size, its share of its host or face, flush or boss), the **sockets** a figure mounts gear by (`grip` with its axis, `tip`, `focal`, a bow's `nockTop` / `nockBottom`, a shield's back `grip`), the item's length and its readability floor.

## Modern and future arms

The arms library (pistols, the carbine, rifles, the submachine gun, shotguns, knives) is drawn for the seventh-generation
look (a live key over materials told apart by how they reflect), by its own laws:

1. **Silhouette from the side.** Every major part is its side outline pushed through its width: the grip's rake, the
   guard's gap, the magazine's drop and the stock's line read side-on.
2. **The chamfer catches the key.** Every hard edge is chamfered to its part's thickness (12 % realistic → 20 %
   stylized, twice for the future line, never under 1.2 mm), so a live light draws a highlight along the silhouette.
3. **Material by response.** Bare or coated metal, a finish and the hand's own grip, plus the dark of a bore: three
   responses at least; a future arm adds one glow hue, never two.
4. **The bore is one line.** Sights, barrel, muzzle and rail on it; the grip raked back 18° with the trigger in the guard.
5. **Detail in three tiers.** Silhouette, parts, then serrations, rail teeth, slots and vents, fewer and bigger as it stylizes.
6. **Negative space reads.** A trigger guard keeps a finger's opening (1.6 cm); a skeleton stock its window.
7. **The future is a transform of the same mechanics.** The future line keeps every station and changes the language:
   broad facets, a shell split by a dark gap, a lit conduit, an emitter at the muzzle, a cell for a magazine. A blaster
   is held as a pistol.
8. **A blade reads by its grind.** Ground toward the spine, its edge a brighter secondary bevel (the future line's: the glow).
9. **The near future is engineered** (the `near` line: futuristic, styled real). Every new part shows what it does in a
   form a factory could make: coils you can count, a capacitor bank's cells and terminals, a cassette's door, a smart
   sight's lens in front and its screen behind. Shells are moulded (a softer chamfer) and read by their parting lines and
   vent rows; light only where a real device lights (a display, a counter), small and screen-shaped.

```
{ item: 'pistol' | 'carbine' | 'rifle' | 'smg' | 'shotgun' | 'knife',
  model?:  the archetype (below; absent → the item's first),
  line?:   'modern' | 'future' | 'near' (absent → the finish's, else the model's),
  style?:  'black' | 'fde' | 'od' | 'stainless' | 'walnut' (modern) | 'white' | 'gunship' | 'titan' | 'hazard' (future) | 'slate' | 'sand' | 'ranger' | 'arctic' (near) | { …a card },
  parts?:  { <slot>: <word>, … },
  dials?:  { stylize?: 0–1, mass?: 0.5–2 } }
```

- **pistol** — `service` (a polymer-framed striker), `compact`, `heavy` (a steel single-stack, an exposed hammer),
  `revolver` (a fluted cylinder, an underlug), `smart` (near: a moulded shroud over the slide, a recessed crown, an ammo
  counter in its rear face, a smart sight). Slots: `barrel` short · standard · long (or cm), `magazine` flush ·
  extended · cell, `optic` irons · reddot, `muzzle` plain · suppressor · emitter, `underbarrel` none · light (a revolver:
  barrel, optic, muzzle).
- **carbine** — `assault`. **rifle** — `assault`, `marksman` (a scope and a bipod), `sniper` (the marksman's receiver on the longest barrel, a long scope read at 8×), `bullpup`, and the near line's
  `caseless` (a monolithic shell over a shrouded barrel, a cassette loaded from the top, a smart sight on two posts) and
  `coilgun` (a bullpup chassis, a barrel wound with copper coils in a skeleton of rails and bulkheads, a capacitor bank
  for a magazine with its cells bare, a cable to the coils). **smg** — `compact`, and the near line's `pdw` (a
  top-feeder: a translucent magazine along its top, a thumbhole, a guard that takes the hand). The caseless, the coilgun
  and the pdw take `barrel`, `optic`, `muzzle` and `underbarrel`.
  Slots: `barrel`, `stock` fixed · collapsible · folding · skeleton · none, `magazine` box · curved · drum · cell, `optic`
  irons · reddot · holo · scope · none, `muzzle` plain · flash · brake · suppressor · emitter, `rail` none · top · full,
  `underbarrel` none · grip · light · bipod (a bullpup has no stock or rail slot).
- **shotgun** — `pump` (a straight stock, a wooden pump on the walnut card), `tactical` (a pistol grip, a rail, a light),
  and the near line's `breacher` (drum-fed, a deep receiver; it takes the rifle's slots).
  Slots: `barrel`, `stock`, `magazine` tube · box · cell, `optic`, `muzzle` plain · brake · emitter, `rail` none · top,
  `underbarrel` none · light, `grip` straight · pistol.
- **knife** — `combat` (a clip point, a cross guard, a ridged handle), `tanto` (a choil, a cord wrap), `dagger` (a
  double-edged spear point, pinned scales on a full tang), `karambit` (a hawkbill and its finger ring). Slots: `blade`
  clip · drop · tanto · spear · hawkbill, `length` short · standard · long (or cm), `guard` cross · choil · none, `handle`
  ridged · cord · slab, `serrations` true · false.

Every gun's `optic` also takes `smart` (a moulded housing, its lens in front and a dim screen behind). Any model takes
the near line (`{ item: 'carbine', line: 'near' }`: a smart sight, the upper parted from the lower by its seam, a round
counter by the thumb); the near models draw in it by default. The future line's defaults: an emitter for a muzzle and a cell for a magazine (`{ item: 'pistol', line: 'future' }` is a
blaster; `{ item: 'rifle', model: 'marksman', style: 'titan' }` a railgun; `{ item: 'knife', style: 'white' }` a
vibroblade). A finish card is plain JSON: `{ id?, line?, roles: { metal, frame, grip?, furniture?, accent?, bore?, glass?,
blade?, edge?, glow?, coil? } }` (on the near line `glow` is only a display's; `coil` a coilgun's windings, copper when absent), each role a shelf row `['<material>', '#hex']` or a metal surface; copy one and pass it as
`style`. Sockets: a gun's `grip` (the fist, the grip's raked line), `tip` (the muzzle), `stock` (the butt); a knife's the
sword's (`grip`, `guard`, `tip`). `stats.equipment.arms` reads the laws back: the chamfers, the responses, the glow
hues, the guard's opening and any advice (advisory: nothing refuses).

A `pistol`, `carbine` or `shotgun` build that names none of model, line, parts or an arms finish is the earlier
firearm proxy (`style: 'service' | 'future'`, the boxes the hero's carry holds pose round), kept byte for byte for rows
minted with it; the mint stamps the item's first model on a new one, so a new gun is the library's. A hero wears any of
them as `gear` (the hero card's gear section).

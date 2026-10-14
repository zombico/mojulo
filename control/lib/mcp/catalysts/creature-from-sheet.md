---
{
  "id": "creature-from-sheet",
  "name": "Design a non-human character from an Egocube sheet — the method, not a template",
  "summary": "The creature loop driven by an Egocube sheet (design notes per channel: frame, structure, cover, ornament, face at rest, stance, silhouette, dress, palette, wear): read the sheet, write the thesis, choose the body's topology from its notes, derive a head from the nearest library skull, build masses before detail, cover, ornaments, dress and colour by principle, mint through create_character, look (wire for form, the shaded rest for colour), audit the plan against the sheet, fix by number. Every body is designed, never copied: the audit flags a plan that reuses a served example's body.",
  "valueHook": "Make a people nobody has drawn yet (a cat-kin, a beaked avian, a four-armed insectoid, a serpent-bodied naga) from a rolled sheet, by applying the principles learned building the first ones instead of re-skinning them.",
  "version": 1,
  "category": "substrate",
  "tier": "design",
  "requires": {
    "protocols": [],
    "writeTarget": "none"
  },
  "parameters": [
    {
      "name": "sheet",
      "description": "The Egocube roll: the arguments to scripts/egocube-roll.mjs (a brief, `--set ancestry=<people>`, a seed, a custom `--lineages` file), or the printed sheet itself. Omit to roll one with the operator."
    }
  ],
  "mcpTools": { "mojulo": ["create_character", "get_solid_vocab", "update_sketch", "measure_solid", "export_model"] }
}
---

# Design a non-human character from an Egocube sheet — operating instructions

An Egocube sheet (docs/egocube.md) says what a character's body, face, stance and dress should carry and **why**:
each note names its source (`archetype.caregiver/shadow`, `ancestry.lupine`, `age.seasoned`) and the dials or passes
that can carry it, never an amount. You are the designer. The sheet is the brief; the plan is yours.

The roll runs from a shell today (no MCP tool yet), from `control/` (paths below are from `control/`; `docs/` is at
the repo root, one level up):

```sh
node scripts/egocube-roll.mjs --set ancestry=feline --seed 4            # the sheet
node scripts/egocube-roll.mjs --set ancestry=feline --seed 4 --audit plan.json   # your plan, audited against it
node scripts/egocube-roll.mjs --set ancestry=lupine --seed 3 --contrast archetype=ruler   # a contrast pair (below)
```

## The invariants — read first

- **Design, never copy.** A served example (a contrast pair, the Pale Warden) shows how a note moves a choice. It is
  not a body to re-skin. The audit's `sameness` row flags a plan whose joint table is a served example's, rescaled.
- **The plan is the artifact.** `create_character({ as: 'creature', spec: { plan } })` stores it; every fix is
  `update_sketch` on `/plan/...` or `/dials/...`. Never re-mint for a change.
- **Two gates, never conflated.** The audit and the mint's gates are the machine gate. Looking is the eyes gate, and
  only the operator passes it. Say which ran and what was seen.
- **Every note lands or is named.** Finish with the audit's ledger: each sheet note `carried`, or `missing` with the
  reason you chose not to (or could not) carry it.

## The loop

```
0. READ      the sheet: the reads, then each channel. Note which notes come from the people (born) and which from the
             life (lived): the people decides the body, the life decides how it is held and worn.
1. THESIS    five traits: silhouette (needle / bell / barrel / column) · stance (biped digitigrade or plantigrade,
             quadruped, serpent, …) · head (long snout / short muzzle / long muzzle / beak / mandibles) · the ONE iconic
             feature · scale in metres. Restate it every pass.
2. DOOR      the sheet's `door`: creature (a ring plan) or hero (the hero door's words). Below this line, creature.
3. TOPOLOGY  from the frame notes, not from an example: how many limbs, how they meet the ground, a tail, a coil.
             Joints first, as a table, in metres, +z up, +y front, x = 0 the mirror, soles on z = 0.
4. HEAD      the nearest library skull, derived (below). A people with no skull near enough gets a new one drawn
             the same way; the rig always needs one.
5. MASSES    ring radii first: the barrel chest, the ruff's mass, the haunch. Look at the silhouette before any detail.
6. COVER     tiles over windows: fur, scales, chitin, plates. Patterns follow anatomy.
7. ORNAMENTS horns, ears, tusks, claws, crests: sized to the part they sit on.
8. DRESS     the kit the dress notes ask for, as adornments with one signature each; one focal piece.
9. COLOUR    the sheet's swatches and palette notes, by group; the underside paler.
10. STANCE   the lean and the ready pose from the stance notes; clips from the rig.
11. LOOK     wire views for form: az 180 is the FRONT, 150 the three-quarter, 90 the side, 0 the back (a sheet of
             az000…az180 runs back, side, three-quarter, front). The World page at REST for colour (the clip
             preview drops palette groups today). measure_solid for exposure (is the focal piece seen?),
             legibility (what shimmers at 256 px) and clearance (what sinks at a dial's extreme).
12. AUDIT    --audit plan.json: the ledger and the lessons. Fix by number; re-look; repeat.
```

The plan grammar is `get_solid_vocab({ id: 'layered' })` (the Plan, Body detail and adornment sections). The creature
loop's own card (`creature-from-plan`) holds the ring-plan forms and the art direction; this card adds the sheet.

## Topology: what the frame notes ask for

- **Biped, digitigrade** (`legs = digitigrade`): hip → knee (forward) → hock (behind, raised) → toe base → toe tip, as
  explicit segments; the metatarsus is what makes the heel read as raised (docs/planar-drawing.md).
- **Biped, plantigrade**: hip → knee → ankle near the ground → a short foot.
- **Quadruped and the upright-on-four**: the horse, bull and sphinx plans (`lib/graph/polygonizer/horse-form.js`,
  `bull-form.js`, `sphinx-form.js`) are worked forms of four-legged bodies. Read them for construction, not to copy.
- **The rig's core.** Rest joints must include the vajra core's names (`pelvisHub`, `navel`, `neckHub`, `headBase`,
  `headTop`, shoulder / elbow / wrist / hip / knee / ankle L and R). `rig.legs` is optional: declare it only for legs
  that plant. Core joints a body does not use are harmless placed inside the mass they would drive.
- **Serpent and coil** (a naga's lower body): a `chain` of many joints from the pelvis, tapering. Two traps, both met:
  a LEVEL segment whose axis runs along x refuses ("a ring whose axis runs along x has no R side"), so let every
  ground link slope a little; and a coil that rides the pelvis sinks into the floor under `crouch` or any pelvis move,
  so keep those out of its clips.
- **More limbs** (a second pair of arms): the core takes ONE pair. A second pair is its own joints
  (`shoulder2$S`, `elbow2$S`, …) that `ride` a core bone (the torso), its own bones, and its own chain channels to pose
  it (`armL` / `armR` clip words never reach it). Mirror it by name like the first.
- **Folded arms, crossed anything**: limbs that cross the mirror plane are authored per side, NOT mirrored, or the two
  forearms pass through each other at x = 0.
- **A tail** hanging to the floor on the centre line reads as a third leg from the front: lift it, curve it, or swing
  it off the midline.
- **Wings**: the wing grammar (docs/examples/wings) is not in the plan grammar yet. A wing that matters can be built as
  flat feather segments bound to the forearm and hand bones (a flat segment's broad side follows its ring's
  orientation), and tiles over the forearm; flare it out to make it read from the front. Say in the ledger what it is.
- **A familiar** (a controller's bond): its own named parts (`familiar…`) worn on or beside the body, sharing the
  character's accent. The audit carries a familiar it can find by name.

## Deriving a head (the wolf, from the bear)

Library skulls (`lib/graph/creature-heads/`): `dragon` (reptile), `bear` and `wolf` (mammal). A head plan's cranium
and jaw are station ROWS `[id, y, { slot: z | [x, z] }]`; every region, skin map, tile window and ornament is
addressed by station and slot PARAMETERS (`[s, t]`), so moving a row moves everything addressed to it with it.

The wolf was drawn from the bear this way:
1. **Keep the slots and the row ids.** Only the numbers in the rows change, so the bear's eyes, brows, nostrils,
   folds, cheek web, tongue and whiskers land on the wolf without a single address edited.
2. **Narrow the braincase** (the cheek and brow x at st0–st2, about 15 %).
3. **Put a stop at the brow** (st3: the top drops sharply from st2 to st3).
4. **Stretch and narrow the muzzle** (st4–st6 move forward, y 0.16 → 0.43, and their widths fall); the jaw rows follow
   the cranium's, the gum always under the palate.
5. **Swap an ornament by kind**: the bear's round `disc` ear became a tall `sweep` (space `local`, a spine up the
   surface normal, radii tapering to a point, `squash` to flatten it), its `curl` driven by `earAttitude`, so worry
   lays the ears back.
6. **Size what sits on the part to the part**: the nose pad shrank with the muzzle (see the lessons).
7. **A library head carries a neutral palette**; the character's colours go over it (`headPlan(id, { palette })`).

**Keeping addresses keeps the source's anatomy.** The eyes, brows and wrinkles stay where the source had them: a cat
shortened from the wolf kept the wolf's side-set eyes and read as a rodent until its eye, brow strip and crow's feet
were moved forward to the face plane together; a raven's eye moved further back and out. Move the eye region and
everything addressed around it (brow, wrinkles) on purpose, by the same shift.

What every derived head must know (each learned in a trial):
- **Required regions**: `eye`, `orbit`, `brow`, `nostril`, `fold`, `web` are read unguarded by the builder; keep them,
  even tiny (an insect keeps a 2.5 mm nostril). `tongue` and `whiskers` may go.
- **Units**: the rows, caps and landmarks are in HEAD units and scale with `units.scale`; region sizes (eye `R`, orbit,
  brow `w` / `h`, tile heights, skin `radius` and amplitudes), teeth sizes, and sweep RADII (even in `head` space) are
  metres and do not. Resize those by hand when you scale a skull.
- **Sweeps** take one radius fewer than spine points. A pointed ear's `squash` flattens it along one axis: flattened
  edge-on to the viewer it reads as a horn from the front.
- **The eye**: `eye.mode: 'solid'` is the no-iris, fully coloured eye (compound, lidless, glowing), with `orbit.open`
  near 1 so only a rim shows. An `irisAngle` that lands the limbus ring on a fixed ring makes degenerate faces (50
  failed where 46 held).
- **The palette**: the head's own palette WINS over the plan's for the head's groups; set head colours in the head plan.
- **The mouth**: a jaw narrower than the lip, or a pale palate, reads as an open mouth from the front; widen the jaw,
  lower the gum, or colour the palate dark. A lipless mouth lays the lip slot on the palate and colours its band as skin.
- **Scale and pitch**: a non-human head reads small against a broad chest; trials raised head scale 10–35 % by eye.
  A long neck and a beak want the head pitched so the face reads forward.

A cat is the wolf's skull shortened and domed, its eyes brought forward; a beak is a muzzle whose rows close to a point
with no stop, the upper tip cap dropped below the palate for a hook, a hard `Beak` group, teeth and ears gone and the
nostril moved onto the beak's base; mandibles are two flattened `head`-space sweeps either side of a short cranium
whose front collapses into a clypeus, with a curl control to open them. Draw the new skull as a file beside the others
when it is good.

## The lessons (each learned building the first ones; the audit checks the ones a machine can)

| Lesson | Principle | Audit |
|---|---|---|
| The ruff read as chest scallops until the neck had mass | Primary masses before detail: an iconic cover is a ring radius first, tufts second | `mass-before-cover` |
| The long snout replaced the short; full scales replaced patches | One reading per slot: the deeper cue wins (the sheet already resolves this) | — |
| Tile windows refused `wrap`, then refused t past the ring | A tile window is `[t0, t1]` on the ring's RIGHT half (0 … slots/2) and mirrors by name; tiles grow only where one bone dominates | `windows` |
| Dragon horns floated off a scaled skull | A head authored in metres has `space: 'world'` sweeps: scale them with it (head space) | `world-sweeps` |
| Peoples with no head broke the rig | The rig needs a skull anchor (`headTop`, the jaw); a missing head is a stand-in, named | `head` |
| A 12° lean did not read; 18° did | Stance reads at distance only exaggerated; a stooped note wants a lean of 15° or more | `lean` |
| A baldric ring competed with the medallion | One focal metal piece; mended straps take stitches or studs | `one-focal` |
| The collar puffed over the ruff | An adornment stands off its carrier, its `over` parts, and every detail or adornment whose NAME contains those part names (tiles grown on the part included): name a garment for its carrier (`torsoTunic`, `torsoWrap`) or give `over`, and keep straps thin and low under the iconic feature | `stack` |
| A tunic let the body poke through between rows | A shell samples its window at `ns` × `nt`; raise them on a large, curved window | — |
| Spine scales vanished under a bodice | Keep a cover note's window outside the dress windows, or it is carried and never seen | — |
| A clasp sat buried between jaw and chest | Read `measure_solid`'s exposure ledger: a focal piece must `read` | — |
| Satchels did not show as thick shells | A volume is a signature (`pack`, `volume`), not a thick shell | — |
| Arms straight out read as a zombie | The ready pose comes from the stance notes: hands low and open unless the notes guard. A clip's `armL` / `armR` is a DIRECTION for the upper arm in the figure's frame (x out, y forward, z up: `{ x: 0.12, y: 0.2, z: -0.97 }` hangs it low and a little forward), and the lean's pitch adds to it | eyes |
| Near-black chitin vanished on the World backdrop; a pale sternum read as a grille | Judge VALUE against the backdrop: a dark people needs a lighter rim, edge or accent to hold its silhouette; a pale panel below the face competes with it | eyes |
| Every trial's torso was a box and its limbs stick prisms | The default rings are coarse: raise the ring family (`style: { slots, limbSlots, e }`) and volumize the masses before judging the form | eyes |
| An oversized nose pad read as an open mouth | Size an ornament to the part it sits on | `ornament-scale` |
| A stout elf | A people constrains its builds (the sheet re-draws or holds it) | — |
| A turning character carried one kit | Turning means both readings show, in the face and in the dress | — |
| The clip preview went grey | Judge colour at rest | — |
| A served example's body, rescaled | Design the topology from the notes | `sameness` |

## What the audit can and cannot tell

The audit reads PRESENCE: `carried` means the plan has what the note asks for (a tail segment, fur tiles, a focal
signature), not that it reads. Most notes are `eyes` by nature. A clean audit is the floor, not the verdict: the look
and the operator's eyes decide. Its sameness check reads the joint table by name, tolerating `R` / `L` / `$S`; it says
`NOT CHECKED` when too few biped joints exist (a naga), which is not the same as designed.

## Contrast pairs

`--contrast <facet>=<value>` rolls the sheet twice, the second with one facet changed, and prints both first readings
side by side with the choices that moved. A pair teaches the mapping from a note to a choice; one example would teach
a destination. Read pairs for what MOVES (the lean drops, the kit changes, the brows level), never for the values:
the first reading behind them wears the nearest library head and the served biped, which a people without its own
(a cat's short muzzle, a beak) contradicts. Then write your own.

## Worked derivation: the Pale Warden

lupine, seed 3: a seasoned white wolf-kin, humanity 0.33, heroic, a familiar user, a caregiver turning toward the
martyr. Thesis: barrel · digitigrade biped, leaning forward · long muzzle · a heavy white ruff over shoulders hung with
satchels · 2.0 m. The decisions, each from a note: the wolf skull derived from the bear (structure: a long muzzle);
the ruff as neck and shoulder mass and then drooping tufts (cover); a deeper chest for the barrel (silhouette); 18° of
lean and hands low and open (stance: stooped from carrying, a low centre); a bedroll pack and two satchels (silhouette:
burdened); bandaged forearms (dress: bandages); studs on the baldric (dress: mended); one brass medallion on a cord
under the ruff (dress: the bond's emblem is the focal); brows lifted at the centre over a furrow and heavy lids (rest:
kind, and worry between the brows); crow's feet kept at rest (wear). What it got wrong first is the lessons table.

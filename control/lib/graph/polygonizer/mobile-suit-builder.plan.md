# Mobile-suit-builder — the mechanical/articulated-hardware register of dream→character

Status: PROVEN AS WORKFLOW; M1+M2 LANDED (2026-07-15: the `mobile-suit`
sketch-vocab card + the `mobile-suit-builder` catalyst); M3/M4 open. This doc
generalizes a single end-to-end success (the Worker Bot, 2026-07-15) into a
repeatable pipeline that first ran entirely by hand through `create_sketch` +
a skin bake. See the 2026-07-16 addendum at the end: a second by-hand session
split off a sibling FUNCTION-FIRST register (`mobile-worker`). Sibling to
[character-from-dream.plan.md](character-from-dream.plan.md) (organic bodies via
the tuned protoform) and [shape-from-dream.plan.md](shape-from-dream.plan.md)
(objects). This is the register for the case those two can't serve: **the body
is hardware — chunky, panelled, articulated, mechanical — not flesh.**

## The thesis (why this is its own register)

The protoform is wrong for a mech, and knowing that *early* is the first win.
The Worker Bot build tried the `figure` primitive once
(`sk_y9wl9r64is`, "chunky humanoid reconstruction", 0 lathes) and **rejected it
in four minutes** — a worker bot is layered armor over a dark frame, not a tuned
body. The whole method is: don't tune a body, **assemble a machine from
lathe-turned segments**, then bake a prop skin over it.

Mobile-suit-builder is therefore a `manji-tree` / lathe method, not a
`figure`/proto method. Its substrate is the four wave primitives + lathes
(tubes/barrels/drums/beads) documented in
[docs/POLYGONIZER-SYNTHESIS.md](../../../../docs/POLYGONIZER-SYNTHESIS.md).

## Proof-of-concept trail (the Worker Bot, all refs live in `sketches`)

52 minutes, one clean pipeline, every stage a separate immutable recipe:

| Stage | Ref | Parts | Note |
|---|---|---|---|
| Precedent | `sk_dhg5y40k0x` | — | "Dream Lantern Scout" — a turnable char that already worked |
| Whole-body blockout | `sk_xmuchzs73t` | 47 | Too mushy — proved you can't one-shot the whole body |
| **Rejected primitive** | `sk_y9wl9r64is` | 0 (`figure`) | Tried the protoform, killed it in 4 min |
| Arm sheet v1→v3 | `sk_r24gwxog2j`…`sk_rt5e1c44um` | 34→38 | Segment studied in isolation, iterated 3× |
| Leg sheet v1→v3 | `sk_jpdo1msft3`…`sk_w4sa8j8ibc` | 35→42 | "slab boot" → "flat tread boot" |
| Torso sheet v1→v2 | `sk_78hpzcd8ao`…`sk_d896mx4b2h` | 44→43 | "receiver chassis" |
| Head sheet v1→v2 | `sk_5i0hlvdto5`…`sk_vbli0lmo2v` | 21→22 | "compact" → "industrial" |
| Reassembly v1 | `sk_x3yf2fuqon` | 66 | Studied parts packed back together |
| Mirror | `sk_087lrrq8er` | 80 | Right limbs mirrored to left |
| **Final** | `sk_zgdewnf49c` | 81 | Full assembly v2 — turnable scaffold |

Then a **skin bake** (the image worker's paint-over) supplied panel seams,
bolts, scuffs, lens glow, grime — the "finished prop" layer the geometry can't.

Structural signature of the final recipe: one zenith→nadir spine, 81 lathes
between 162 paired slots, 56/81 carrying shaped (multi-radius) profiles, palette
doing the taxonomy (safety-orange identity ×14, graphite frame ×~40, amber
metal ×~15, cyan eyes ×2).

## The pipeline

`dream image → identity lock → segment sheets → scaffold passes → assembled
turnable → mirror → skin bake`

### 0. Identity lock (do this FIRST, repeat it EVERY pass)
Reduce the dream to a one-line thesis of **≤5 named, repeatable traits** —
color, core, accent, silhouette, mass. Worker Bot: *"safety-yellow worker bot,
black mechanical core, orange handles, compact head, massive practical limbs."*
This is the anti-drift device. Because it is simple and restated on every
subsystem, the model never wanders into generic-robot territory. **Gate:** if
you can't say the identity in one sentence, you're not ready to lathe.

### 1. Segment sheets (decompose along real seams)
Arm / leg / torso / head — how a body actually factors — each as its **own
sketch with its own origin**, judged alone. Iterate each subsystem v1→v2→v3;
put the design decision in the version name ("slab boot" → "flat tread boot"),
so the title *is* the changelog. Over-detail here on purpose — you're learning
the shape language, not budgeting yet. **Gate:** each sheet reads as the thing
head-on before it joins.

### 2. Work WITH the rounded vocabulary
The tool wants tubes, barrels, drums, beads. Don't fight it into boxes. Imply
boxy industrial hardware with **repetition, tint, scale contrast, and overlap**.
Boxiness is an *illusion* built from rounded parts, not a primitive.

### 3. Accept superposition
Stop demanding clean part separation. **Overlapping lathes read as layered
armor over a dark frame** — which is exactly the construction-machine look.
Superposition is a feature; it's where the "plated" quality comes from.

### 4. Assemble + mirror (economize)
Pack the studied sheets into one tree; expect and *accept* lower per-limb
fidelity than the isolated sheets had (Worker Bot: ~38-part arm sheet →
~20-part arm in the 81-part whole). Spend the part budget where it reads at
body scale. Model ONE side; **mirror** for the other — half the work, free L/R
consistency.

### 5. Skin bake (coequal stage, not a garnish)
Geometry gives mass + turnability; the skin gives panel seams, bolts, scuffs,
lens glow, grime, the finished-prop feeling. **They cover each other's
weaknesses** — a mushy join hides under a painted seam; a flat paint reads as
form because the turntable gave it real silhouette. Budget real effort here.

## Known limitation (state it, don't hide it)
**Single-view skin projection.** Front / three-quarter bake much stronger than
side / back. The geometry is fully turnable; the *skin* is not yet
view-consistent. Mitigations to explore: multi-view bake passes, or leaning on
palette/geometry (not painted detail) for the weak angles. Log this on any
artifact so "turnable" isn't oversold as "turnable *and* skinned from all
angles."

## Why it worked (portable principles)
1. **Anchor on a proven precedent** — start from the last turnable char that worked, never cold.
2. **Kill the wrong primitive fast** — the 4-min `figure` rejection was the highest-value negative result.
3. **Identity lock repeated every pass** — a simple restated thesis is the anti-drift mechanism.
4. **Decompose on natural seams, iterate in isolation, version-name the decision.**
5. **Exploit symmetry** — model half, mirror the rest.
6. **Assemble last, expect fidelity to drop** — study high, ship economical.
7. **Sculptural scaffold, not one-shot magic** — never ask the tool to *be* the dream image; ask it to be the armature the skin finishes.
8. **Color carries the taxonomy; skin carries the finish** — two coequal covering layers.
9. **Keep the whole trail** — every stage an immutable recipe makes the process inspectable (this doc exists because of that).

## If we tool this (open — mirrors character-from-dream's C-slices)
- **M1** — a `mobile-suit` sketch-vocab card: identity-lock template + the segment-sheet checklist + the rounded→boxy idiom table (repetition/tint/scale/overlap). **LANDED** (`sketch-vocab/mobile-suit.md`).
- **M2** — a `mobile-suit-builder` catalyst: the dream→identity→sheets→assemble→mirror→skin loop as a curated workflow (sibling to the `character-from-dream` catalyst). **LANDED** (`catalysts/mobile-suit-builder.md`).
- **M3** — a mirror helper on the manji-tree so "mirror right limbs to left" is one call, not a hand rebuild.
- **M4** — multi-view skin bake to close the side/back gap (the one real limitation).

## Addendum 2026-07-16 — the mobile-worker split (second proof, new sibling register)

A second by-hand session (the **Yellow Construction Utility Worker Robot**,
2026-07-16 04:41–06:59) re-proved the segment-first method on a different
substrate — `create_workbench` segments composed by `create_assembler` at
literal scale, instead of manji-tree lathes — and surfaced a register split
this plan had been conflating:

- **Mobile suit = character-first.** Silhouette, palette taxonomy, hero face,
  skin bake. The thing IS a character that happens to be hardware.
- **Mobile worker = function-first.** A platform defined by its JOB: the
  session minted `mechanics-view` references FIRST (crane lift `sk_mkxrhjqkj8`,
  screw jack `sk_pze6pnt8um`, slider crank `sk_3pd2m5lc0q`), built tool
  modules named by job (screw-jack stabilizer boot, clamp-and-pry arm, torso
  work core + tool bay, protected sensor head), then carried ONE identity
  (safety-yellow livery, black core, three-dot camera head) across THREE
  locomotion morphologies: biped (`sk_243cilugfy`, `sk_4atbz4qgfg` +
  volumized/heavy-arm passes), wheeled platform (`sk_qyf60ylpj8`, with
  service-mast head + battery-backpack accessories), and **spider-tank**
  (`sk_29zzuri190` → `sk_49p4u0f407`, v1→v5) — one curved wheel-leg module
  replicated at six ground stations with mirrored splay rotations, over a low
  thorax body and spherical camera head.

The portable finding: **locomotion is a swappable module family** — keep the
work identity fixed, swap only the chassis, and get a coherent product family
(biped / wheeled / multi-leg) from one session's modules. Replication with
pose variance (one leg, six stations, ±rotate/scale) beats sculpting unique
limbs.

Codified as the [`mobile-worker` sketch-vocab card](../sketch-vocab/mobile-worker.md)
(the function-first sibling; route by "does it have a job or a face"). M3/M4
remain open and apply to both registers; the assembler `items` replication
pattern partially substitutes for M3 on the worker side.

## Addendum 2026-07-17 — the g-series design language (third proof, deepest line)

The **80stronian** line (2026-07-15 → 07-17, 78 assembly versions, reference
unit `sk_80str_modular_frame_fit_v78_raised_chest_vents` — 45 stations, ~430
monomers) went deep enough to become its own **design language inside this
register**: fixed palette ROLES (cream armor `#e7dfcf` family / graphite frame
/ blue chest yoke / red feet+cod / gold emblem), a fixed spine canon (feet z0 →
head ~z22, legs ±2.24, arms ±4.65, narrow-waist pinch), and named form idioms —
sealed superposition masses, boxy-not-brick chamfered housings, the
**cross-overlay** limb-detail move (the limb's own chamfer volume rotated 90°
and superposed raised, same-color — the v55–v58 answer that retired all colored
limb doodads), skirted pelvis over red cod, 16-version fin-crowned helmet with
recessed under-brow eyes, down-angled backpack thrusters. Notably it ran on the
**workbench + assembler** substrate (like mobile-worker) rather than manji-tree
lathes — the method transfers across both substrates.

Codified as the [`g-series` sketch-vocab card](../sketch-vocab/g-series.md):
hold the roles/canon/idioms fixed, swap hues-within-role, loadout, fins, and
skirts to mint sibling units. The unit-vs-language split generalizes: when a
build line crosses ~dozens of versions and its decisions stop being about THIS
model and start being about the SERIES, the language earns its own card.

2026-07-17 descendant-generator phase 1: the card's palette-role table +
livery shelf now live as code — `g-series-livery.js` (this folder) classifies a
frozen assembler manifest's tints into the six roles and re-hues the
armor/identity/signal families per livery (card-pinned hexes map exactly;
near-tint strays ride nearest-anchor + residual delta; frame/emblem/eyes fixed;
seeded shelf pick + optional panel-break jitter, mulberry32). Minted via
`scripts/mint-g-series-livery.mjs` through the same planAssembler validation as
`create_assembler`, livery + seed recorded as provenance in title + manifest
note — the descendant manifest stays sovereign and self-contained
(mint-at-import; no live ref to the source unit). Open next: an advisory
g-series lint (machine-checkable half of the language rules), then a
station-swap patch compiler once alternative segments exist as minted
workbenches.

2026-07-17 follow-up: the **skin seam now reaches this substrate** — the
workbench/assembler kinds render a `?control=1` faces-scaffold (the same
shared-camera polygon contract manji-tree/figure use), so `get_skin_packet` →
paint → `skin_polygomer` works on an assembled unit (2D reskin + world/.glb
bake via `bakeBoundSkinFaces`). The Step-6 skin-bake layer of this plan's
method — panel seams, decals, grime — is therefore available to g-series and
mobile-worker builds without leaving their substrate. M4 (multi-view) still
applies to all legs.

---
{ "id": "mobile-suit", "name": "Mobile-suit builder (mechanical-hardware character)", "summary": "manji-tree + lathe grammar for chunky mechanical characters — robots, mechs, worker bots, armored figures — assembled from lathe-turned segment sheets on one spine, boxiness IMPLIED from rounded parts via repetition/tint/scale/overlap, palette carrying the taxonomy, then a skin bake for the finished-prop layer; NOT the organic protoform", "when": "build a mech / mecha / mobile suit / robot / worker bot / android / droid / power-armored figure / mechanical or industrial character: a chunky panelled machine with articulated limbs, layered armor over a dark frame, not a fleshy body — when the figure/protoform primitive reads too organic and you want to sculpt hardware from tubes/barrels/drums", "tier": "recipe", "marks": ["manjiTree", "lathe"], "phase": "p1" }
---

`kind = "manji-tree"` + lathes is the mechanical-character grammar. **Do not
reach for the `figure`/protoform primitive here** — it tunes flesh, and a mech
reads as *layered armor over a dark frame*, not a tuned body. You assemble a
machine from lathe-turned segments, then bake a prop skin over it. Full method +
provenance: [[mobile-suit-builder.plan.md]] (archived:
`lite-template/integration/archive-mobile-suit/plans/`, untracked).

## Step 0 — Identity lock (do FIRST, restate on EVERY subsystem)

Reduce the target to **≤5 named, repeatable traits**: color / core / accent /
silhouette / mass. e.g. *"safety-yellow worker bot, black mechanical core,
orange handles, compact head, massive practical limbs."* This one line is the
anti-drift device — repeated on every segment so the model never slides into
generic-robot territory. If you can't say it in a sentence, don't start lathing.

## Step 1 — Segment sheets, each its OWN sketch

Decompose along real seams — **arm / leg / torso / head** — each authored as a
separate manji-tree with its own origin and judged alone. Iterate v1→v2→v3 and
put the decision in the title ("slab boot" → "flat tread boot") so the name is
the changelog. Over-detail on purpose; you're learning the shape language, not
budgeting yet. Gate: the sheet must read as the part head-on before it joins.

## Step 2 — Imply boxiness from rounded parts

Lathes want tubes / barrels / drums / beads. Don't fight them into cubes. Boxy
industrial hardware is an *illusion* built with four moves:

- **repetition** — rows of identical short lathes read as louvers / knuckles / treads
- **tint** — near-neighbor grays (`#1a1f21`,`#20272a`,`#242b2e`) read as panel breaks
- **scale contrast** — one fat drum beside thin struts reads as a housing
- **overlap (superposition)** — let parts interpenetrate; overlap reads as
  plating over a frame. Do NOT demand clean separation — that's where the
  construction-machine look comes from.

## Step 3 — The lathe grammar

One vertical spine; every part is a lathe swept between a **pair** of slots
(`s0→s1`, `s2→s3`, …). A shaped profile (`>1` point) tapers/bulges the tube; a
single-point profile is a plain strut.

```
kind: "manji-tree", dimensions: "3d", detail: 2,
tree: {
  id: "world", anchor: {x:0,y:0,z:0},
  spine: { bar1: { axis: "Zenith-Nadir", tails:{Zenith:"closed",Nadir:"closed"}, lengthScale: 0.06 } },
  slots: [ {id:"s0", position:{...}}, {id:"s1", position:{...}}, ... ]   // pairs
},
lathes: [
  { axisFrom:"world/slot/s0", axisTo:"world/slot/s1",
    profile:[{t:0, radius:0.22},{t:0.5, radius:0.30},{t:1, radius:0.18}], // shaped = housing
    crossSections: 10, samples: 18, style:{ stroke:"#20272a", width:0.5 } },
  { axisFrom:"world/slot/s2", axisTo:"world/slot/s3",
    profile:[{t:0.5, radius:0.055}],                                       // single = strut
    crossSections: 6, samples: 14, style:{ stroke:"#1a1f21", width:0.5 } }
],
physics: { gravity:true, gravityStrength: 1, defaultSagFactor: 0 }
```

`crossSections` 6–8 = faceted/mechanical; 10–14 = smooth housings. Keep `samples`
modest (12–20) — this is a scaffold, not a hero mesh.

## Step 4 — Palette IS the taxonomy

With no material system, stroke color does the labeling. Budget it:

- **Identity color** ×10–15 — the one trait that names the machine (safety-orange `#ef7f1a`).
- **Frame** ×~half — a graphite family (`#121719`…`#252b2e`), many near-tints for panel breaks.
- **Metal accents** ×10–15 — an amber/gold family (`#c9921a`…`#e1a525`).
- **Life points** ×2–3 — one saturated cyan (`#6fd3ff`) for eyes/lenses. Two glowing points do most of the "it's a character" work.

## Step 5 — Assemble, then mirror

Pack the studied sheets into one tree and **accept lower per-limb fidelity** than
the isolated sheets had (a 38-part arm sheet → ~20 parts in the whole). Spend
budget where it reads at body scale. Model **one** side; mirror slot positions
across the sagittal plane for the other — half the work, free L/R consistency.

## Step 6 — Skin bake (coequal, not garnish)

Geometry gives mass + turnability; the skin supplies panel seams, bolts, scuffs,
lens glow, grime — the finished-prop feel. Budget real effort here; the two
layers cover each other's weaknesses (a mushy join hides under a painted seam).
**Known gap:** single-view skin projection — front/¾ bake far stronger than
side/back. Say so on any artifact; don't oversell "turnable" as skinned from all
angles.

## Do / don't

- DO anchor on a precedent mech that already turned well; never start cold.
- DO kill the `figure` primitive fast if it reads organic (a 4-min rejection is a win).
- DON'T one-shot the whole body — the first whole-body pass is always mushy; sheets fix it.
- DON'T separate every part cleanly — superposition is the armor.

Pairs with [[compositional-balance]] for mass-check and [[image-outcome]] for the
skin-bake camera set. Function-first utility platforms — worker drones, loader
bots, spider-tanks, anything with a job instead of a face — are the sibling
register: [[mobile-worker]]. One design language has been codified INSIDE this
register: [[g-series]] (the 80stronian heroic-humanoid canon) — reach for it
when the ask is another unit in that language rather than a new design.

---
{ "id": "g-series", "name": "G-series mobile suit (heroic-humanoid design language)", "summary": "the codified design language of the 80stronian line (v1→v78): a heroic humanoid mobile suit canon — cream armor over a graphite inner frame, blue chest yoke with vent slats, red feet + cod, gold emblem points, chamfered-box limbs detailed by same-color cross overlays, skirted pelvis, fin-crowned helmet with recessed under-brow eyes, down-angled backpack thrusters — with fixed palette ROLES, a fixed spine canon, and a four-livery shelf (akai-comet / titanic / eff-ground / union-green) seeded-picked per unit so new UNITS read as siblings, not copies", "when": "build another g-series unit / a variant of the 80stronian suit / a heroic humanoid mobile suit in the established house language / a squad of matching mobile suits with different loadouts, liveries, or hue swaps / roll me a g-series unit — when the goal is a NEW UNIT inside a proven design language rather than inventing a mech from scratch (from-scratch → mobile-suit)", "tier": "recipe", "marks": ["lathe"], "phase": "p1" }
---

The g-series is a **design language**, not a single model — the distilled canon
of the 80stronian build line (78 assembly versions, 2026-07-15 → 07-17;
reference unit `sk_80str_modular_frame_fit_v78_raised_chest_vents`, 45 stations
/ ~430 monomers, walkable at `/api/sketches/<ref>/world`). Where
[[mobile-suit]] teaches the *method* (segment sheets, superposition, identity
lock), this card pins the *language*: palette roles, spine canon, and form
idioms that make a new unit read as g-series. Build variants by holding the
canon and swapping inside it.

## 1. Palette — colors are ROLES, not decoration

| Role | Hexes (canonical) | Where it is ALLOWED |
|---|---|---|
| Armor (dominant) | `#e7dfcf`, panel breaks `#d8d0c0` `#d6cfc2`, shadow `#c8c0b3` `#b9b2a5` | everything not named below — limbs, skirts, helmet, feet tops |
| Inner frame | `#111315` `#17191b` `#191b1d` `#151719` | joints, sockets, vent recesses, anything mechanical showing through |
| Identity blue | `#214f95` `#1f4f93`, deep `#173b70`, light `#2e67b0` | chest yoke + neck deck + back wrap ONLY |
| Signal red | `#b13b28` `#cf4a35`, deep `#8f2c22` `#7f241e` | feet/soles + toe blocks + cod armor ONLY |
| Emblem gold | `#d59a19`, dark `#5b4108` | forehead emblem + 1–2 waist points, nothing else |
| Eye cyan | `#35e7ef` | the two eyes/lenses under the brow, nothing else |

The hard-won rule (v11, "clean volumized limbs, no color doodads"): **limbs
stay armor-white.** Color lives on the torso and the extremity accents; a limb
earns detail through geometry (see the cross overlay), never through paint. A
variant unit may re-hue a ROLE (crimson unit: swap the blue family) but must
not add roles or move a role to a new region — role placement IS the series.

## 1b. Livery shelf — four stock bases + a seeded default pick

The table above is the **reference livery** (the v78 unit). Four stock bases
re-hue the armor / identity / signal roles; **frame, emblem, and eye cyan never
change** (the shared inner frame + gold points + eyes are what make mixed
squads read as one series). Role placement is identical in every livery.

| Livery | Armor (dominant · breaks · shadow) | Identity (chest yoke) | Signal (feet + cod) |
|---|---|---|---|
| `akai-comet` (red base) | `#c05540` · `#b04a37` `#a13f2e` · `#8a3323` | oxblood `#571a15` / `#6d241d` | dark maroon-black `#3d1210` / `#4a1512` |
| `titanic` (midnight blue base) | `#243a5e` · `#1f3352` `#1a2c47` · `#15243a` | pale steel `#c7cfdb` / `#a9b4c6` | crimson `#8f2c22` / `#a63c2a` |
| `eff-ground` (light brown base) | `#c8b48c` · `#b9a67e` `#ab9872` · `#8f7d5c` | olive umber `#5f5333` / `#75683f` | rust `#96412a` / `#7a3421` |
| `union-green` (light teal base) | `#a9c9c0` · `#98bab0` `#88aba1` · `#6f9187` | deep teal `#245c54` / `#2f7268` | coral red `#a03b26` / `#83301f` |

Note the two dark bases invert the identity contrast (dark armor → pale chest;
light armor → dark chest) — the chest must always pop off the armor field.

**Seeded default.** When the user doesn't name a livery, roll one — seeded,
never `Math.random` (house invariant):

```
rng   = mulberry32(seed)            // seed = the unit's seed, pick one and say it
livery = ['akai-comet','titanic','eff-ground','union-green'][floor(rng()*4)]
jitter = each panel-BREAK hex nudged ±4 lightness via rng()   // optional squad variance
```

The roll happens at **authoring time**: resolve the pick, write the resolved
hexes into the segment manifests (recipes pin literal tints — the manifest
stays deterministic; the seed is provenance, so record `seed` + livery name in
the unit title or a manifest note). This table lives as code in
`lib/graph/polygonizer/g-series-livery.js` (role classify + livery remap over a
frozen assembler manifest); `scripts/mint-g-series-livery.mjs` mints a livery
descendant of any stored unit in one command — keep card and module in sync. Always tell the user which livery the seed
landed on and that it's tunable: swap any role family wholesale, or nudge
individual hexes — role placement stays fixed. Jitter only ever touches the
panel-break tints, never the dominant, identity, or signal anchors.

## 2. Spine canon — the z-stack that makes units siblings

One vertical spine, feet at z=0, head crown ≈ z 22. Station heights from the
reference unit (armor units on the measured grid):

```
foot 0 · ankle 1.2 · lower leg 1.4–4.4 · knee 6.6 (+pad) · thigh 7.5–10
pelvis 11 (skirted) · waist connector 14.4 · torso 13.7 · shoulders 18.7
neck deck 20.1 · head 20.1 (scale ~0.87) · backpack at y+0.9, z 16.5
legs at x ±2.24–2.34 · arms at x ±4.65
```

Humanoid proportions were a deliberate pass (v8 "humanoid limb proportions",
v8b "tightened silhouette", v13 "20 percent narrower abdomen") — keep the
narrow waist between the blue chest mass and the skirted pelvis; that pinch is
where the heroic read comes from.

The line is authored **front toward −y** (toes and chest at −y, backpack at
+y), while the studio's preset `front` camera assumes +y — so stamp
`facing: "-y"` on every unit manifest (a `create_assembler` /
`create_workbench` setting; camera-only, geometry untouched) or the default
shot shows the unit's back.

## 3. Form idioms (the moves that say "g-series")

- **Sealed superposition masses** (v4–v6): every module reads closed — armor
  shells interpenetrate into sealed volumes; you never see through a limb.
- **Boxy, not brick** (v9): limb housings are chamfered boxes with tapered
  box-round silhouettes (v22) and unified chamfered housings (v8-series limb
  cards) — never raw cubes.
- **The cross overlay** (v55–v58, the signature): limb surface detail is the
  limb's own chamfer volume duplicated, rotated `[0,0,90]`, scaled ~0.74–0.95,
  and superposed as a RAISED SAME-COLOR cross (`*_cross_l/r` stations). Depth
  without color — this replaced every colored doodad.
- **Skirted pelvis**: chamfered front/side/rear skirt plates over a red cod
  (v10–v13 pelvis line, "wider front side skirts" v77).
- **Chest = blue yoke + vents**: enclosed blue chest block, white pectoral
  backing, center vent slats raised proud of the plane (v78), blue neck yoke
  rising to a sealed deck (v53–v54), orthogonal panel lines (v75).
- **The head** (16 versions of hard work): deep bucket helmet, recessed
  under-brow eyes with a light mask (v6), chamfered sloped brow (v14), raised
  forehead emblem with diagonal lines (v15), volumized crown fins (v16).
  Fork the head last; it carries the most identity per monomer.
- **Extremity punctuation**: red toe-down chamfer blocks, ankle hover guards,
  knee pads, articulated fingers under larger fist shells (v59–v67).
- **Backpack**: simple sealed unit with down-angled thrusters (v72–v74).

## 4. Building a variant unit

Each segment is its own `create_workbench` sketch; the unit is one
`create_assembler` with per-side stations (`*_l` / `*_r` placed at ±x — model
one side's geometry, place it twice). To mint a NEW unit:

- **Hold fixed:** palette roles + placement, the z-stack, sealed masses, the
  cross-overlay idiom, skirted pelvis, under-brow eyes.
- **Swap freely:** livery — start from the seeded pick off the §1b shelf, then
  tune (a squad reads as a squad because roles hold) — plus shoulder pod shape,
  backpack loadout (thrusters → cannon → shield rack), fin count + emblem
  geometry, skirt count/width, fists → tool hands, chest vent pattern.
- **Fork, don't restyle:** copy the reference unit's segment sketches, change
  one segment per version, and keep the assembler stations — the titles are
  the changelog (`v79 - twin cannon backpack`), same as the source line.
- **Paint a skin (patterns/decals/weathering):** the assembled unit takes the
  polygomer skin seam — `get_skin_packet({ ref })` → paint panel lines, squad
  markings, grime, or a full camo FLAT over the `?control=1` scaffold →
  `skin_polygomer` — and wears it deterministically (skin albedo × the
  recipe's own form shading) in `/skin.png`, `/world`, and the `.glb`. The
  livery + geometry recipe stays sovereign underneath; the skin is a bound
  render. Single-view: front/¾ faithful, the back wraps front colours.

## Do / don't

- DO iterate head and torso in their own sketches — they carry the identity;
  limbs are canon and mostly travel unchanged between units.
- DO keep one named decision per assembly version.
- DON'T color the limbs — geometry detail only (the cross overlay exists so
  you never need to).
- DON'T unseal masses or leave joints see-through; sealed superposition is
  half the finished read.
- DON'T start here for a non-heroic machine — a job-defined robot is
  [[mobile-worker]]; an unrelated mech design starts from [[mobile-suit]].

Pairs with [[mobile-suit]] (the parent register and method), [[mobile-worker]]
(the function-first sibling), and [[compositional-balance]] for the assembled
silhouette check.

---
name: skull-study
description: Render an animal HEAD as a skull-shape turntable — an azimuth sweep (front → ¾ → lateral → back) plus top-down and under views, cropped to the head — so a skull reads correctly from EVERY angle, not just one. Catches the failure modes a single view hides (a hollow/open-tube face that only shows head-on, a pale interior scoop that only shows at ¾, a lopsided or over-long muzzle that only shows from above). Use before/after tuning any animal head, when adding a new species' skull, or after editing the skull/welded-head builders (figure-animal-skull.js, weldedSkull in figure-animal-skin.js). Invoke as `/skull-study <species|archetype>` or `/skull-study --recipe head.json`.
---

# skull-study

The head is the hardest part of an animal to get right, and the part a single
render lies about most. This is the **check pass for skull shape**: it renders a
head from all around so you can Read the turntable and catch what a front-only or
lateral-only view hides.

Why a turntable and not one view — learned the hard way on the leopard head:
- the **hollow / open-tube face** (a short-muzzled skull with no front cap) reads
  fine in profile but is a see-through ring head-on;
- the **pale interior scoop** (looking into the open muzzle) only appears at ¾;
- an **over-long, lopsided, or wrongly-dropped muzzle** only reads from top / under.

## Use it

```bash
node .claude/skills/skull-study/study.mjs <subject> [<subject>...] [--recipe file.json] [--out dir]
```

Then **Read the printed PNGs** — that is the analysis. Each subject writes a
turntable to `<out>/<subject>/png/` (default `/tmp/skull-study`):

| view | reads |
|---|---|
| `1-front` | face plane — hollow ring? eyes/nose seated? countershade chin? |
| `2-front3q` · `3-threeqtr` | the recognizability angle — muzzle mass, cheek fill, scoop |
| `4-lateral` | profile — muzzle length, brow/stop, nasal bridge, jaw |
| `5-rear3q` · `6-back` | cranium closure, ear seating |
| `7-top` | dorsal skull, muzzle centering + symmetry, **nasal bridge prominence** |
| `8-under` | muzzle / jaw underside, chin |

Subjects:
- **a species** — any `ZOO_BUILDS` key (`wolf`, `cougar`, `lion`, `deer`, `fox`, …).
- **an archetype** — any `QUADRUPED_ARCHETYPES` key (`feline`, `canine`, `stumpy`,
  `equine`, `rodent`, …), rendered with neutral skin+coat so you see the RAW skull.
- **`--recipe file.json`** — an ad-hoc `{ archetype, opts }` head being TUNED before
  it's graduated into `ZOO_BUILDS`. The file's basename names the subject. Repeatable.

Examples:
- `… study.mjs cougar` — the existing puma head, all around.
- `… study.mjs feline canine stumpy` — compare three raw archetype skulls.
- `… study.mjs --recipe /path/leopard-recipe.json` — a head under construction.

## The skull dials it's checking (map)

Reference for what moves the skull, so a turntable finding maps to a dial. Skull cfg
(`skullCfg`), consumed by `protoSkull` (overlap) and `weldedSkull` (skin):

- `length` overall skull length · `width` overall breadth · `dome` cranium height
- `muzzle` muzzle fraction of length (↑ = longer snout) · `snout` snout-tip radius
  (↑ = blunter/wider tip) · `muzzleDrop` how far the nose dips · `jaw` lower-jaw size
- `boxy` superellipse squaring (protoSkull only; the welded head is round)

Welded-head-only muzzle dials (opt-in; default neutral, so long-muzzled animals are
untouched) — added for brachycephalic/cat faces:
- **`pad`** whisker-pad masses that WIDEN the front into a squared muzzle (small: the
  cap radius tracks the opening, so a big pad blows the whole muzzle up).
- **`bridge`** a raised nasal-bridge ridge up the top-centre, between the eyes.
- **`capDepth`** front-cap forward depth (`<1` = flatter, SHORTER, squarer front).

Face decorators (`face` cfg, `faceDecor`): `eyeR/eyeSide/eyeUp/eyeSink`, `noseR/noseFwd`,
`earLen/earW/earTip/earUp/earSide`.

**Invariant learned:** the welded head is a `marchAxis` lathe tube — CLOSE its open
front AT THE MARCH (the `weldedSkull` front cap), never by overlaying a second surface
(overlays z-fight and reveal the interior). See `animal-from-dream.plan.md` gap ledger.

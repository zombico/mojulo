---
{ "id": "figure-fluff", "name": "figure fluff — the stylized (chunky/mecha/action-figure) body register", "summary": "build a stylized figure body from a CLOSED set of named simple volumes (cone/football/bead/bell/slab) bound to armature segments and composed by superposition — girth contrast by default (huge distal masses on thin connectors: mega-boy, mecha, Mega-Man, chibi-hero). The create_figure `fluffs` input; REPLACES `proto` (anatomical) when present.", "when": "a STYLIZED / cartoon / chunky / mecha / robot / action-figure / super-deformed character body — Mega Man, a Gundam-lite hero, a zdog-style mascot, anything with deliberate girth contrast — as opposed to an anatomically-proportioned human (that is create_figure `proto`). Route here from 'make a robot/mecha/action-figure/chibi character body', 'chunky stylized figure', 'mega man / mega boy'.", "tier": "render-primitive", "marks": [], "phase": "p1" }
---

Fluff is the **stylized body register** of `create_figure` — the sibling of
the anatomical `proto` body. Pass a `fluffs: [...]` array (it REPLACES `proto`
when present) and the figure is built from chunky named solids instead of
sculpted anatomy. Garments, poses, motion, and views all still apply — fluffs
ride the same armature, so an authored character walks/emotes on day one.

## The principle — girth contrast from superposition

Rich, appealing volume from a tiny set of chunky primitives with soft unions
(the zdog principle). The DEFAULT read is **girth contrast**: huge distal
masses (fists, forearms, boots, shoulders) hanging off skinny connectors
(upper arms, thighs). Superposition is native — the armature stays thin where
no fluff wins, so contrast is free, not something to fight for.

## The CLOSED shape table (five, no more)

Each fluff binds either a **segment** (two landmark keys `[proximal, distal]`)
or a **node** (one key), plus dials. Unknown shapes/dials are rejected at mint.

| shape      | binds   | dials                          | reads as |
|------------|---------|--------------------------------|----------|
| `cone`     | segment | `girth`, `taper` (>1 = FLARE)  | legs, thin connectors, boots (flared) |
| `football` | segment | `girth`, `peak` (belly pos), `mouth` (0–0.95 distal flat truncation) | forearms, biceps, calves — **mouth open = the arm-cannon / buster** |
| `bead`     | node    | `r`, `peak` (0 sphere→1 cone/crest), `squash` | helmet head, shoulder balls, fists, knuckles, knees |
| `bell`     | segment | `girth`, `mouth` (wide distal radius) | chest, skirt-hips, cuffs |
| `slab`     | segment | `girth`, `depth`, `n` (superellipse, ↑=boxier), `taper` | torso plates, feet |

Optional on any fluff: `id` (name the stack), `bias:{x,y,z}` (offset ring
centers — masses that sit off-axis), `hex` (per-fluff colour). Multiple
segment fluffs on the SAME ordered node pair merge by smooth-max (superposition
— e.g. a football forearm over a thin cone connector swells only where the
football wins).

## The 17 landmarks (segment / node keys)

`headTop, headBase, neckHub, navel, pelvisHub, shoulderL, shoulderR, elbowL,
elbowR, wristL, wristR, hipL, hipR, kneeL, kneeR, ankleL, ankleR`

Girth defaults are ~0.02–0.03 (STAND units); distal masses read at ~0.05–0.07.

## Worked example — Mega Man (the girth-contrast flagship)

```js
create_figure({ title: 'Mega Man', view: 'frontal', setup: 'white-cyc', fluffs: [
  { shape:'bead', node:'headTop', r:0.075, squash:1.05 },                       // dome helmet
  { shape:'slab', segment:['neckHub','navel'], girth:0.095, depth:0.06, n:3, taper:0.9 }, // chest plate
  { shape:'cone', segment:['navel','pelvisHub'], girth:0.055, taper:0.85 },     // waist pinch
  { shape:'bead', node:'shoulderL', r:0.062 }, { shape:'bead', node:'shoulderR', r:0.062 }, // shoulder balls
  { shape:'cone', segment:['shoulderL','elbowL'], girth:0.028, taper:0.95 },    // thin upper arm
  { shape:'cone', segment:['shoulderR','elbowR'], girth:0.028, taper:0.95 },
  { shape:'football', segment:['elbowL','wristL'], girth:0.055, peak:0.68 },     // gauntlet
  { shape:'bead', node:'wristL', r:0.045 },                                      // fist
  { shape:'football', segment:['elbowR','wristR'], girth:0.062, peak:0.72, mouth:0.55 }, // OPEN buster
  { shape:'cone', segment:['hipL','kneeL'], girth:0.038, taper:0.92 },          // thin thighs
  { shape:'cone', segment:['hipR','kneeR'], girth:0.038, taper:0.92 },
  { shape:'bead', node:'kneeL', r:0.04 }, { shape:'bead', node:'kneeR', r:0.04 },// knee seal
  { shape:'cone', segment:['kneeL','ankleL'], girth:0.042, taper:1.5 },         // FLARED boots
  { shape:'cone', segment:['kneeR','ankleR'], girth:0.042, taper:1.5 },
  { shape:'bead', node:'ankleL', r:0.052, squash:0.8 },                         // rounded feet
  { shape:'bead', node:'ankleR', r:0.052, squash:0.8 },
] })
```

## Composes with

- `create_figure` `pose` / `motion` — fluffs pose and animate for free (they
  bind articulated landmarks).
- `create_figure` `garment` — cloth tracks fluff masses with zero garment math
  (piece ids reuse the proto vocabulary).
- The dream loop (`reconstruct-from-dream` catalyst) — a dreamed stylized
  character in a simple register decomposes DIRECTLY into this vocabulary; this
  is the figure-register build target.

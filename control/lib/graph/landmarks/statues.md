# Making statues (figure-on-pedestal landmarks)

How to build a monument landmark whose subject is a **posed human figure** — the
Statue of Liberty is the reference implementation. The reusable core is
[`buildStatueFigure()`](statue-figure.js); the landmark wiring is
`statueOfLibertyBuilding` in [`index.js`](index.js). This doc is the map + the
gotchas, distilled from the 0625 `liberty-pose` spikes.

## The pipeline

```
figure polygonizer ─pose─▶ posed armature ─garment─▶ robe + sash
        │                                                 │
        └────────── renderFigureWorldFrames ──────────────┘
                         │ (z-up {corners,fill} faces, feet ≈ 0, baked lit)
                         ▼
            luminance-remap every face → one verdigris tone (keeps shading)
                         │
            + sculpted props (torch / tablet / crown) off the hand/head stacks
                         │
            normalise (feet z=0, centred, unit height)
                         ▼
   landmark: build cityBox pedestal, drop figure on top with ONE uniform scale
```

`buildStatueFigure(pal)` returns `{ faces }` already normalised, so a landmark only
has to: build a pedestal, pick `figSpan`, and map each corner
`[x,y,z] → [cx + x·figSpan, cy + y·figSpan, pedTop + z·figSpan]`.

## The seven things that were non-obvious

1. **Shoulder ROM caps the arm.** The rest arm hangs straight *down*, and
   `figure-vajra` `LIMITS.shoulder` is a cone measured from there. The default 80°
   only reaches ~horizontal — an overhead arm needs ~172°. We raised
   `LIMITS.shoulder` to **180** (real glenohumeral flexion). Without this, no torch.

2. **Raise the arm with a RAW shoulder angle, not the friendly aim.** `armR:'up'`
   compiles (via `aimSwivel`) to the *minimum-magnitude* solution, which for a
   straight-down→straight-up flip degenerates to "stay down." Use
   `shR:{ pitch: 172 }` directly. (`elbowR: 8` keeps it nearly straight.)

3. **A cross-body forearm needs humeral ROLL.** Bending the elbow alone swings the
   forearm in the sagittal plane (forward), not across the chest. `shL:{ roll: 30 }`
   rotates the upper arm so `elbowL: 95` carries the hand across — the tablet cradle.

4. **Garments take inline spec objects.** `buildPosedFigure(pose, proto, garment)`
   accepts a GARMENTS key *or a spec object* (or an array to layer). The Liberty robe
   is passed inline so it doesn't pollute the shared wardrobe:
   `[ drape(torso+seat), pelvis bell (includeLegs, hemFrac 0.98), sash ]`.

5. **The sash is its own garment mode — and folds must be GEOMETRY.** `fit:'sash'`
   ([`figure-garments.js`](../polygonizer/figure-garments.js) `sashStacks`) is a
   diagonal one-shoulder himation: bearing-shoulder → opposite hip, low `clearance`
   ("mugen"), with **analytic fold ridges** added as real displacement. The renderer
   shades by surface normal, so a fold has to be a ridge — recolour panels can't make
   a fold read. The stock drapes (`drapeFrontSheet`/`hullStacks`) deliberately *smooth
   folds away*, so they can't do this. The sash auto-computes a **bridge standoff**:
   it measures how far the real bust protrudes past a smoothed torso and lifts the
   whole sheet to clear it, so low-mugen cloth never clips through.

6. **Unify the material by luminance-remap, monochrome.** Map every baked face
   (flesh + robe + sash) onto one verdigris hue, scaling the hue by the face's
   luminance so the baked light/shade survives. One tone is what makes it read as a
   cast statue — and it hides any cloth/body clip-through, leaving folds as pure relief.

7. **Props are located off the figure's own labelled stacks.** `buildPosedFigure`
   stacks carry ids (`handR`, `handL`, `forearmR/L`, head). Map them to the figure's
   world frame with the SAME transform `renderFigureWorldFrames` uses —
   `world = [(x/12)·1.95, (y/12)·1.95, ((z/12) − groundZ)·1.95 + 0.02]`
   (`PROTO_SCALE=12`, `S=1.95`, `groundZ = min(z/12)`) — so props land in the hands.

## The props (sculpting)

- **Torch** — a lathe (revolve a `[t, radius]` profile along the raised forearm axis):
  handle → gilded brazier bowl → flame. Reference ratio matters: the real torch is
  **29 ft on a ~111 ft figure (~0.26×)**, and the flame is a **bulbous teardrop
  ~1.3:1**, not a tall needle. We build at ~0.32× then trim with `torchScale` (0.8).
- **Tablet** — a keystone slab seated in the forearm cradle, tilted diagonally,
  broad face forward. Keep it moderate; oversize/high reads as a billboard over the face.
- **Crown** — a **radiating sunburst diadem**, built in a frame tilted into the head's
  plane, spikes fanning *outward* (radial ≫ vertical). Spikes that point straight up
  read as horns, not Liberty.

## Mirroring

`buildStatueFigure({ mirror: true })` **re-poses** the figure (torch arm, tablet arm,
contrapposto weight, and the sash's bearing shoulder all swap sides). Do NOT mirror by
negating geometry x — that leaves every face shaded from the wrong side, because the
lighting is baked. Re-posing re-bakes it correctly.

## The pedestal

Stacked `cityBox` tiers (`[fxHalfWidth, uLo, uHi]` fractions of footprint / pedestal
height). Keep it a **slim tapered die**: a plinth foot, a narrow shaft, a cornice cap
just wide enough to seat the figure's robe base (cap half-width ≳ the robe hem half-
width, ~0.2–0.25 of the footprint). A wide block dwarfs the figure. Pedestal:figure
height ≈ 1:1 reads right.

## Wiring a NEW statue

1. Author (or parameterise `buildStatueFigure` for) the pose + robe + props. Reuse the
   pose/garment/prop idioms above; only the gesture and attributes change.
2. In [`index.js`](index.js): add a `xxxBuilding(b, ctx)` that builds the pedestal and
   drops the normalised figure on top (copy `statueOfLibertyBuilding`). Register the
   shape in `LANDMARK_SHAPES`, `LANDMARK_HEIGHTS` (torch/finial tip as a multiple of
   the short side — Liberty is 3.0), dispatch in `renderLandmarkBuilding`, and add a
   `LANDMARK_FOOTPRINT` entry in [`fractal-city.js`](../fractal-city.js).
3. Add a placement + alias test in [`fractal-city.test.js`](../fractal-city.test.js).
   The figure makes a huge vertex count, so assert max-height with a `reduce`, never
   `Math.max(...spread)` (the spread overflows the call stack).

## Cost

The polygonised figure is **~35k faces** — one statue is ~100× a typical landmark, and
it dominates scene-assembly time. Fine for a single hero landmark; if statues ever go
into dense scenes, add an LOD/decimation pass in `buildStatueFigure`.

## Source map

- [`statue-figure.js`](statue-figure.js) — `buildStatueFigure()`, the reusable primitive.
- [`index.js`](index.js) — `statueOfLibertyBuilding`, the landmark wiring + pedestal.
- [`../polygonizer/figure-render.js`](../polygonizer/figure-render.js) — `renderFigureWorldFrames`, `buildPosedFigure` (inline-spec garments).
- [`../polygonizer/figure-posing.js`](../polygonizer/figure-posing.js) — the pose language (`resolvePose`, raw `shL/shR` swivels, spine/limb aims).
- [`../polygonizer/figure-garments.js`](../polygonizer/figure-garments.js) — `GARMENTS`, `buildGarment`, `sashStacks` (`fit:'sash'`), the svgile-row `cuts`/`panels` tailoring.
- [`../polygonizer/figure-vajra.js`](../polygonizer/figure-vajra.js) — `LIMITS` (shoulder ROM), `articulate`.
- Reference spikes/renders: `lite-template/integration/0625/spike-output/liberty-pose/` and `…/liberty-landmark/`.

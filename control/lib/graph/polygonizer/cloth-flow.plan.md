# cloth-flow — dynamic drape as a behavior over garments

Status: **behavior + gown + collision landed** — `flowDrape` (ambient wave) and `drapeCollide`
(limb-capsule push-out: the swinging leg physically kicks the skirt, and the bust/seat capsules
fix the nosing) are in [cloth-flow.js](cloth-flow.js), with the `gown` GARMENTS entry, demonstrated
on a female form in `lite-template/integration/0624/spike-output/gown-walk/`. Cape proto in
`.../cape-walk/`. Remaining: re-home the cape onto `flowDrape`, thread phase through the renderer,
and consider velocity-aware kick (read prev-frame limb pos for momentum). See Roadmap.

## The gap this closes

The figure substrate has two catalogs:

- **Garments** — `GARMENTS` in [figure-garments.js](figure-garments.js): declarative specs
  (`coverage + fit + clearance + cuts/panels`). All **static** — `buildGarment(body, spec)` is a
  pure function of the pose, with no time.
- **Motions** — [figure-posing.js](figure-posing.js) via `resolveMotion`: `walk`/`gait`,
  `sprint`/`run`, `wave`, `stretch`, `keyframes`, `performance()`. These drive the **skeleton**
  (`phase → dof`). `performance()` gives secondary motion to **limbs**, never to cloth.

Nothing couples **cloth to motion**. The cape spike proved a third axis — *garment-behavior* —
but did it as a one-off (a `sampleWaveField` sheet anchored ad-hoc to the shoulders, meshed by a
hand-rolled renderer). This plan promotes that proto into reusable pieces.

## Design: flow is a behavior, not a garment

A flowing cape and a flowing gown are the same idea applied to different drapes. So the wave-flow
is a **post-process over a garment's ring-stacks**, parameterized by phase, not a new `fit` kind:

```
buildGarment(body, spec)  →  ring-stacks (the REST drape, static)
flowDrape(stacks, body, { phase, gait, ... })  →  ring-stacks (the SAME drape, displaced by a wave)
```

`flowDrape` is **pure** (stacks → stacks), so it is production-ready before the renderer threads
phase: a spike drives it explicitly per frame today; `renderFigureFrames` threads phase later
(see Roadmap).

### The wave model (carried from the cape proto)

Each draped stack is a set of rings. For a vertex at height-fraction `zf ∈ [0,1]` (1 = anchor /
top, 0 = hem) and azimuth `θ` about the stack's central axis:

1. **Pin → free envelope** — `env = smoothstep(1 − zf)`: 0 at the anchor (sewn to the body), 1 at
   the hem (free to swing). The wave only ever moves the free part; the seam stays put.
2. **Wave (superposition)** — `w = Σ ampₖ · sin(cu_k·θ + cz_k·zf·2π + phaseₖ)`, displaced along
   the outward radial `r̂` (billow out/in). Multiple components = primary swing + micro-folds.
3. **Sag** — a baseline outward+down relaxation of the hem (gravity), `× env`.
4. **Trail + sway** — couple to the gait: a backward bias of the hem (the skirt streams behind)
   and a lateral sway driven by the step signal (`sin(2π·phase)` / the dof weight-shift), `× env`.

Phase advances with the gait so crests travel down the drape (a trailing billow), amplitude
pulses on the foot-plant gusts. The anchor tracks the body for free (rings are read from the posed
garment, which already rides the gait's girdle counter-rotation).

## Deliverables

1. **`cloth-flow.js`** (this dir) — exports `flowDrape(stacks, body, opts)` + `FLOW_DEFAULTS`.
   Pure, no renderer dependency. Operates on the ring-stack shape `buildGarment` emits.
2. **`GARMENTS` promotion** — add `cape` (a shoulder-anchored back drape) and `gown` (a
   floor-length shoulder drape with high sag) as declarative specs. Static in production today;
   they *flow* when run through `flowDrape`.
3. **`gown-walk` spike** — a **female** form (`proto.sex = 'female'`) in a `gown`, walked via
   `gait`, with the gown flowing through `flowDrape` per frame. The next visible milestone.
4. Re-home the **cape spike** onto `flowDrape` + the `cape` spec (retire the bespoke sheet path),
   so the two share one behavior.

## Wet paint under clothes (prototyped in the gown spike)

A cheap pixel cheat for nose-through, orthogonal to `drapeCollide`: **stain the flesh directly under
a garment its own colour**, so any poke-through reads as cloth. Prototyped as `stainUnder(stacks,
parts)` in the gown spike — tags the nosing-prone flesh stacks with a per-face `stain(point) → hex`,
which the mesher honours. Flesh-only (garment-on-garment never makes a `:under:` of another garment),
scoped so open regions (neckline/arms) stay skin. Paint alone hides most breach for a fraction of
collision's cost; collision then only earns its keep for the *volume/kick*.

**Production home:** `litFaces` in [figure-render.js](figure-render.js), a per-face flesh recolour —
the sibling of svgile-row's `panels` recolour (same `point → hex` shape). The flesh→garment→colour
map is free: it's exactly what the `*:under:<fleshId>` lining shells already encode (gate with a
radial-containment test so the neckline opening isn't painted).

## Hair → the `wig` primitive

The hair prototype is promoted into [wig.js](wig.js) — a reusable primitive with a `WIGS` catalog
(the sibling of `GARMENTS` for the head). A wig is pure data over one generator: dome cap +
**canonical hairline** (`hairline` raises the part toward the crown without altering coverage) +
`part` (bangs width) + `length`/`fullness`/`flare`/`curl`/`color`, plus a `kind` (`curtain` or a
`tail` ponytail). `buildWig(body, spec)` returns ring-stacks; the caller flows them with
`flowDrape`/`drapeCollide` and meshes (curtain = open sheet, tail = closed tube). Catalog so far:
`longWave`, `bob`, `pixie`, `splitHood`, `curls`, `ponytail`. Demonstrated in
`lite-template/integration/0624/spike-output/wig-lineup/`. New styles are new rows.

## Hair proves the generality

Hair is the same object as a cape/gown — a drape pinned at one edge (the **scalp**) and free at the
other (the **tips**). Prototyped in the gown spike as a back-curtain sheet: `flowDrape` (higher
frequency → strand ripple) + `drapeCollide` against head/shoulders + the cape's two-sided
smoothed-normal mesher. Only the geometry (`buildHair`, ~15 lines anchoring strands at the back
hairline) is new; the motion is the shared behaviors verbatim. This is the evidence that "garment-
behavior" generalizes to any pinned-free surface — next candidates: a scarf, a flag, a flowing sleeve,
a beard, foliage.

## Roadmap (after the spike reads well)

- **Thread phase through the renderer** — `renderFigureFrames` / `renderFigureWorldFrames` pass
  `i/frames` (and a small gait context) into `buildPosedFigure → buildGarment`, so a `GARMENTS`
  flow piece animates in the production `create_figure` tool, not only in spikes. Gate behind a
  spec flag (`flow: {...}`) so static garments are byte-identical.
- **Traced-diffusion option** — the cape hero showed `bakeDiffusion3d` gives real fold AO; expose
  it as a render setup for cloth, deferred for per-frame cost.
- **Self-collision** — the drape can dip into the legs on a deep stride; a body-capsule push-out
  is the eventual fix (out of scope for a wave).

## Resolved (by rendering)

- **Drape over legs → clean cone? YES.** `fit:'drape'` over `['torso','seat','legs']` unions into a
  single closed-loop `gown:drape` stack (30 rings × 45 verts, ankle→shoulder). No split. So `gown`
  is a plain shoulder drape, as hoped.
- **Gait signal into `flowDrape`:** explicit — `opts.phase` (+ optional `opts.step`, fed the dof
  `weight`). Kept explicit; the renderer-threading step can default `step` from the dof later.
- **Garment fit, not flow:** a few skin specks at the bust tips / stepping knee — the shoulder drape
  noses past the forward-projecting bust and the stepping leg. More clearance doesn't fix it; a
  bust-aware suspension or a capsule push-out is the real fix. Tracked as a garment-builder follow-on,
  not a cloth-flow bug. Gown clearance settled at 0.34 / sag 0.18 in the catalog.

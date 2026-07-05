# star-surface-view — plan

A scientifically-grounded **star surface** (the photosphere) as a live orbit-able World. Not a glowing
gas cloud — mojulo already has three of those (`star-birth`, `plasma-globe`, `fusion`) and they are all
**volumetric raymarch**: emissive gas, no surface. This is the missing sibling: the star as a **solid
body whose appearance is generated from a temperature field**, which is what a real star's look actually
*is* (blackbody radiation off a ~5772 K surface, mottled by convection and spots).

Born from the `heat-sphere-view` spike. That spike proved the one capability this needs and did not exist
before: **a scalar field painted as colour on a static sphere, recomputed every frame** (the `heatSpheres`
render channel). The sun is the second, harder consumer of that same idea — and per the sequencing call
(build the second real thing, *then* extract the shared primitive), this plan builds the sun on a possibly-
duplicated channel and factors the common core out only at the end, when two working examples exist.

## The one genuinely new design question

The heat-sphere channel is hard-wired to **axisymmetric Legendre modes** — temperature depends only on the
pole angle θ, and colour is **view-independent**. A star breaks both:

1. **Field varies in (θ, φ), not just θ.** Granules and spots are not latitude rings. The field source must
   become a general per-vertex sampler over the full sphere, evolving in time.
2. **Colour becomes view-dependent.** Limb darkening — the disk edge looks dimmer because you see higher,
   cooler layers — needs the **camera direction fed into the channel** per frame. The heat-sphere channel
   never needed that; the ocean/gw channels never needed it either. This is the new seam.

Everything else (build sphere once, per-frame per-vertex colour, MeshStandardMaterial + a light, the `?t=`
frozen-frame verification path) carries over from the spike unchanged.

## The honesty note (register, matching the *_view family)

Stance: **honest colour physics + honest ingredients, phenomenological dynamics.** The colour is real
(Planck blackbody, Kelvin → true RGB), the ingredient list is real (granulation, spots in active bands,
limb darkening, differential rotation), and the *scales are truthful in kind*. But the granulation is a
**noise model that looks right, not a magnetoconvection simulation** — exactly the ocean's stance (correct
dispersion, phenomenological wave sum, not Navier–Stokes). We say so in the readout. What we DON'T fake:
the temperature→colour map, so "different heat surfaces" means real stellar classes (see Stage 4).

## Scientific ingredients (each maps to a knob)

- **Blackbody colour (Planck).** Surface temperature in Kelvin → chromaticity via the Planckian locus
  (a compact polynomial fit is fine; no need for full spectral integration). This is the load-bearing
  scientific choice — it replaces the spike's artistic blue→red diverging map. A G star (~5772 K) renders
  near-white with a warm cast; this is also what makes Stage 4 (star types) real rather than a recolour.
- **Granulation.** Convection cells: bright hot centres (rising plasma), dark cooler lanes (sinking).
  Model as a time-evolving cellular/worley or domain-warped simplex field, ΔT ≈ ±few hundred K, cell scale
  ~1/30 of the radius, boiling on a few-second loop. This is the "always alive" texture.
- **Sunspots.** Localized **cool** patches (umbra ~4000 K + a warmer penumbra ring) placed in **active
  latitude bands** (~±15–30°), a few per hemisphere, slowly evolving. Cooler ⇒ (via Planck) darker and
  oranger automatically — no special-case colour.
- **Limb darkening.** `I(μ)/I(0) ≈ 0.3 + 0.93μ − 0.23μ²`, μ = cosine of the angle between the surface
  normal and the view direction. A per-frame, per-vertex brightness multiplier — the view-dependent seam.
- **Differential rotation.** Equator rotates faster than poles (`Ω(lat)` falls off with |sin lat|). Drift
  the granulation/spot sampling longitudes accordingly so the surface shears as it spins.

## Explicitly out of scope for this channel

- **Corona, prominences, chromospheric glow** belong to the **raymarch/glow layer** (`star-birth` already
  speaks it), NOT this surface channel. The intended end-state is a **composite**: this channel for the
  photosphere + a raymarch overlay for the corona — the same "effects layer over a mesh world" pattern the
  fog work established (see `effects-layer.plan.md`, `docs/raymarch-effects-layer.md`). That composite is a
  follow-on, not part of this plan's core.
- Real magnetoconvection / MHD. Phenomenological only.

## Build sequence (option 2: sun first, extract last)

**Stage 0 — plan (this file).** ✔

**Stage 1 — the field seam. ✔** Forked the spike's channel into the `starSurface` channel (duplication as
planned). Field source is a general per-vertex sampler over (θ, φ, t); colour comes from a **Planck**
blackbody map. Blackbody colour verified (5772 K → warm white).

**Stage 2 — granulation. ✔** Added an animated **Worley F2−F1** convection texture (bright cell interiors,
dark lanes) that boils via time-jittered feature points. Reads as a mottled carpet in the stills.

**Stage 3 — spots + limb darkening. ✔** Cool spots (umbra + penumbra) in the active latitude bands; the
view-dependent **limb-darkening** term threads `camera.position` into the channel (the new interface bit).
Also added a **Stefan–Boltzmann T⁴ luminance** term beyond the plan — chromaticity alone left spots too
bright; T⁴ makes a cooler patch genuinely *dark*, which is the physically correct reason sunspots look
black. Material is `MeshBasicMaterial` (self-luminous; no shaded terminator). Reads unmistakably as the Sun.

**Stage 4 — star types. ✔** `sun` / `red-dwarf` / `blue-giant` / `spotted`; the Planck map makes each
Tbase its true colour. Verified four visually distinct stars from one recipe.

**Stage 5 — wire-up + verify. ✔** `star-surface-view.js` (`plan*`/`assemble*`), MCP handler, registered in
`create-view.js` / `world-kinds.js` / `sketch-manifest.js` (science slot in `WORLD_RENDER_KINDS`),
`view-vocab/star-surface.md`, and `.test.js` (11 tests: temp ordering, spot bands, umbra/penumbra,
determinism). Verified via headless `?t=` frozen-frame screenshots of all three star types.

**Stage 6 — EXTRACT (not optional). ✔ — a narrower seam than guessed.**
The plan guessed "one merged channel parameterised by a field-source strategy." Seeing the two real
implementations (the whole reason we extract *after* two examples, not before) overturned that guess: the
two steppers share almost nothing — Legendre modal sum vs. Worley cells + spots, lit `MeshStandardMaterial`
vs. self-luminous `MeshBasicMaterial`, view-independent vs. camera-dependent limb darkening. Merging them
behind a `mode` branch would rebuild the exact `surfaces`-channel anti-pattern (gerstner/wavefield/gw in one
switch) that couldn't accept a sphere in the first place. The ONLY genuine duplicate was the **UV-sphere
construction** (~25 identical lines) — heat even carried a redundant `cosT` array that was just the normal's
z-component.

So the honest extraction: a shared `__uvSphereRig(radius, nlat, nlon)` preamble (emitted once when either
channel is present) that builds the BufferGeometry + typed arrays and returns them; each channel keeps its
own material, lighting, and per-frame field maths. The "field-source strategy" is simply that each channel
owns its stepper. This is two-examples-over-one-guess working as intended — the right seam was *narrower*
than the guess. A future third consumer (cooling lava planet, Earth thermal map) reuses the rig and writes
only its own colour kernel. Both channels re-rendered byte-identically after the refactor.

## Risks / open questions

- **Granulation cost.** Worley/simplex per-vertex per-frame over a dense sphere may be heavier than the
  cheap Legendre recurrence. Mitigations: coarser mesh + smooth interpolation, or precompute a static
  granule basis and only animate its phase. Measure before optimising.
- **Planck fit accuracy** at the temperature extremes (M and O stars) — validate the polynomial against a
  reference locus at the four class temperatures in the test.
- **Where does it live** — `heat-sphere` is filed under math (it teaches the heat equation). `star-surface`
  is science. Confirm the education-vs-science slot before wiring.
- **Seam design for Stage 6** — decide whether the view-dependent hook is a general callback or a fixed
  "limb term" flag. Defer the decision until Stage 3 has shown what limb darkening actually needs.

# Arabesque renderer — spike & fold-in plan

Status: **SPIKE** (2026-07-08). Goal: prove the geometric-arabesque principle on a
few samples, then decide how it folds into the general renderer capability
(sketch marks vs. mint-time expander vs. manji shelf card).

## What "arabesque" means here

The *geometric* strand of Islamic ornament — star-and-polygon tessellations
(khatam, girih). Not the vegetal/biomorphic strand. These are periodic, exactly
constructible, and therefore a perfect fit for mojulo's "recipe not render"
ethos: a tiny deterministic spec → a full pattern.

## The principle — PIC / Hankin (polygons-in-contact)

One method generates the whole family. Chosen as the spine because a single spec
`{ tiling, contactAngle, ... }` covers every sample below; it reveals the
underlying principle rather than hand-authoring each pattern.

1. **Tile** a region with a periodic arrangement of regular polygons.
   The tiling's symmetry sets the star order:
   - hexagons (6.6.6) → 6-fold rosettes
   - octagon+square (4.8.8) → 8-fold stars (the iconic khatam)
   - dodecagon+triangle (3.12.12) → 12-fold stars
2. **Contact points** sit at the midpoint of every tile edge.
3. From each contact point, shoot **two rays into the tile interior**, each
   making the **contact angle** with the edge (symmetric about the inward
   normal). This one angle is the pattern's signature: small angle → sharp,
   spiky stars; ~90° → blunt, near-polygonal.
4. Rays are **truncated at their first intersection** with another ray of the
   same tile. The surviving segments are the star's points and the interstitial
   polygons.
5. Because contact points live on *shared* edges, adjacent tiles' motifs meet
   exactly — the pattern is continuous across the whole plane with no seams.

Per-tile construction (Kaplan's "infer" simplification): each tile is processed
independently; continuity is a consequence of shared edge midpoints + mirror
symmetry across the edge, so no global stitching pass is needed.

## Spike deliverables

- `polygonizer/arabesque.spike-lib.js` — self-contained: tiling generators
  (hex, 4.8.8, 3.12.12), the PIC core (contact points → rays → truncation),
  and a minimal standalone SVG emitter. No engine coupling yet.
- `polygonizer/arabesque.spike.gen.test.js` — writes samples to
  `lite-template/integration/0708/spike-output/arabesque/`.

Samples to see:
1. `1-hex-6fold.svg` — hexagonal tiling, canonical 6-fold.
2. `2-octagon-8fold.svg` — 4.8.8, the classic 8-pointed khatam.
3. `3-dodecagon-12fold.svg` — 3.12.12, 12-fold stars.
4. `4-angle-sweep.svg` — one tiling, contact angle swept, to *see* the
   signature-angle principle.
5. `5-tiled-field.svg` — repeated cell, to confirm seamless wallpaper continuity.

Review loop: spike test writes SVGs → `/view-svg` rasterizes → visual check.

## Spike outcome (2026-07-08) — PRINCIPLE PROVEN

All five samples render as recognizable geometric arabesque. Key findings:

- **The N-gon → N-star law holds.** A regular n-gon tile yields a clean
  n-pointed star for every n tested (5,6,8,10,12) — `3-ngon-rosettes.svg`.
- **One angle is the whole signature.** `4-angle-sweep.svg` (45→58→68→76°)
  goes blunt-octagon → crisp star → spiky star. Contact angle ∈ ~[45°,80°] is
  the usable band; the parameter is measured from the edge, **high = sharp**.
- **Tiles self-connect with no stitching pass.** Because contact points live on
  shared edge midpoints, per-tile motifs meet exactly: `1-hex-6fold.svg` is a
  seamless 6-star field, `2-octagon-8fold.svg` a classic 8-star khatam (octagon
  stars linked by bowtie knots in the square gaps).

Two lessons that shaped the core (see `arabesque.spike-lib.js` `tileMotif`):

1. **Angle convention was inverted at first.** Rays are offset from the *inward
   normal* by `90°−contactAngle`; low contact angle → splayed rays → stubs, not
   sharp stars. Sharpness rises with the angle.
2. **Nearest-intersection truncation is not robust — pairing is.** Cutting each
   ray at its globally-nearest crossing gave clean stars only for lucky (n,angle)
   pairs and stubs otherwise. The fix: deterministically pair each ray with the
   ray from its *adjacent* contact point over the shared vertex. That closes into
   a clean 2n-vertex star for **any** n and angle. This is the reusable invariant
   to carry into the general renderer.

Deliberately still open (per "line network first"): interstitial polygon
in-fill beyond the star outline, and strapwork interlace.

### Concentric-circle family (2026-07-08, second pass)

Added the circle-based constructions — historically how these patterns are
struck, and the door to radial medallions. New primitives in the spike-lib
(`radialSpokes`, `ringOfTiles`, `hexCircleGrid`) + circle/guide rendering in
`segmentsToSvg`. Samples in `arabesque-circles.spike.gen.test.js`:

- `6-compass-scaffold.svg` — concentric guide circles + 24 radial divisions with
  the 12-fold star struck on the framework: shows the compass-and-straightedge
  root. Circles carry a `role` ('guide' = faint, behind; 'ink' = gold, above).
- `7-shamsa.svg` — radial medallion: central 12-star, a band of 12 six-stars,
  an outer band of 24 eight-stars, framed by concentric circles. Reuses the PIC
  `tileMotif` unchanged — tiles are just placed on rings via `ringOfTiles`.
- `8-flower-of-life.svg` — the overlapping equal-circle hex lattice (spacing ==
  radius) with the double bounding ring: the canonical seed grid.

Finding: the star engine and the circle layer are cleanly orthogonal — a medallion
is "place existing star tiles on a ring + draw the framing circles," no new star
math. That keeps the eventual fold-in small: the expander emits `polyline` marks
for stars and `circle` marks for the framework.

Still open here: petal/arc extraction from the circle grid (cutting the vesica
petals into an ornament rather than leaving full circles), and connecting the
shamsa bands into a true annular tiling rather than floating stars.

### Composed panels (2026-07-08, third pass)

Three families now compose: PATTERN (tiled star field), ANGULAR (radial spokes /
star polygons), CIRCULAR (concentric circles / rings). One new primitive makes
compositing possible without SVG clip-paths — `clipByCircle(segments, c, r,
side)` keeps segments fully inside or outside a radius and drops straddlers (the
framing circle hides the seam); `tilesCenter` finds the field centre to place a
medallion on. Samples in `arabesque-composed.spike.gen.test.js`:

- `c1-medallion-in-field.svg` — hex star field with a circular medallion punched
  into the centre (central 12-star + ring of six-stars). **All three families.**
- `c2-star-roundel.svg` — a rose-window roundel: 16-star + 8 radial wedges + a
  ring of eight-stars between concentric rings. **Angular + circular.**
- `c3-tile-panel.svg` — khatam octagon field + central circular roundel with a
  16-star. **All three families.**

Finding that matters for the fold-in: **the composite is pure post-processing.**
Field, medallion, and framework are generated independently by the primitives
already proven; `clipByCircle` + concatenation assembles them. So a composed
panel is still one flat list of `polyline` + `circle` marks — the mint-time
expander stays viable even for the richest panels. Design/tuning knobs that
matter aesthetically: medallion radius should hug its content (dead annulus reads
as a mistake), and central-star tip radius vs. ring radius vs. frame radius want
to step out in even increments.

### Research / gap spike (2026-07-08, fourth pass)

Probed the distance between the pure per-tile-star-OUTLINE prototype and
authentic Islamic design, to decide refactor vs. new primitives.
Samples in `arabesque-research.spike.gen.test.js` (output dir
`spike-output/arabesque-research/`). Visual findings:

- **N-fold coverage (`r1`): NO gap in motifs.** Clean 5/7/9/10/11-point stars —
  the engine reaches any single star order, odd included. BUT tiling the plane
  with fivefold symmetry needs a non-regular tiling (the fivefold/girih system);
  my regular/Archimedean generators (hex, square, 4.8.8) don't produce it. Gap
  is the *tiling*, not the star.
- **Filled faces (`r2`): PARTIAL gap → face extraction.** Filling the STAR as a
  closed 2n-gon is trivial (`starPolygon` added) and already yields convincing
  two-tone tilework. But the interstitial cells read as undifferentiated
  background — colouring them distinctly (authentic 3+ colour work) needs a
  planar-arrangement / face-extraction pass the segment model can't provide.
- **Rosette (`r3`): real gap → new primitive.** A plain {n} star vs. a
  constructed petal-ring rosette are visibly different motifs; the rosette
  (shams) is the richer, more authentic one. A first `rosette()` primitive works
  but its centre overlaps — a proper rosette needs cleaner petal geometry, and
  it does NOT come out of n-gon PIC for free.
- **Interlace (`r4`): real gap → new pass.** Offsetting lines into rails
  (`toBands`) makes bands, but joints are open and there's no weave. True
  strapwork needs strand extraction + corner mitering + over/under crossing
  arbitration — a distinct rendering pass, not a transform.

**Verdict — reconciled with the literature (Hankin / Bonner / Kaplan).**
The visual spike and the scholarship agree: **the PIC core is the accepted
standard construction (Hankin's polygons-in-contact, = Bonner's "polygonal
technique", formalized by Kaplan's Taprats). DO NOT refactor the core.** Our
`{tiling, contactAngle} → contact points at edge midpoints → paired rays → star`
IS Kaplan's method; contact angle θ is his term (measured from the edge).

Additive gaps, in priority order (each leaves the PIC core intact):

1. **Rosette (shams) primitive — highest.** The bare {n} star is the *rare*
   motif; the characteristic one is the rosette: inner star + a ring of
   hexagonal *petals* + outer points, with shoulder/flank degrees of freedom
   (Kaplan/Lee construction). Our `rosette()` prototype proves it's needed and
   doesn't fall out of n-gon PIC. Without it the output doesn't "read" as Islamic.
2. **Planar face extraction + coloured fills.** The canonical artifact is a
   partition into coloured cells (star / petal / kite / saft), not a wireframe.
   Add an arrangement/DCEL pass that finds bounded faces and classifies them.
   `starPolygon()` already fills the star face; the rest need real faces. This
   pass is ALSO the substrate for true interlace.
3. **Strapwork / interlace pass.** Walk each strand, flip over/under at every
   crossing (strict alternation is globally consistent for star patterns), mitre
   corners, offset to band width. `toBands()` shows the naive offset; the joints
   and weave need this pass.
4. **Fivefold/tenfold (girih) tile set — gates fivefold work.** Fivefold
   symmetry can't come from a regular/Archimedean tiling; it needs the dedicated
   equilateral tile alphabet (decagon, pentagon, barrel hexagon, bowtie, thin
   rhombus = the Lu–Steinhardt girih tiles, which are just PIC tiles with the
   54°-contact motif pre-baked). Single stars of any order already work (`r1`).

Refinements to bake into the fold-in:
- **Expose Bonner's pattern families (acute / median / obtuse / two-point)** as
  the user-facing sharpness control instead of a raw angle — that's how the
  tradition names it (the 72°/108° values are the median/obtuse crossing angles).
  Maps directly onto our contactAngle.
- Half/quarter motifs at tile edges/corners (Hankin's edge/corner rule).

Advanced / optional (not now): **two-level self-similar substitution** for the
Darb-i Imam quasicrystalline (Penrose-like) patterns — a girih-tile inflation
rule. Real, but a distinct advanced feature.

Sources: Kaplan, *Islamic Star Patterns from Polygons in Contact* (2005) &
thesis; Bonner, *Islamic Geometric Patterns* (2017); Lu & Steinhardt, *Science*
(2007); Grünbaum–Shephard on interlace. (Full URLs in the research task log.)

### Rosette primitive (2026-07-08, fifth pass) — BUILT, gap #1 closed

`buildRosette(n, opts)` (Kaplan/Lee): a ring of `n` tall POINTS alternating with
`n` PETALS (hexagons) around a central STAR, returning linework AND classified
faces `{points, petals, core}`. Samples in `arabesque-rosette.spike.gen.test.js`.

- `rs1-anatomy` — 12-fold, faces colour-coded: reads as an authentic *shams*.
- `rs3-shoulder` — sweeping `Rshoulder` blooms points→petals continuously while
  keeping n-fold symmetry: this is the literature's shoulder/flank DOF, working.
- `rs4-field` — 6-fold rosettes on the hex lattice interlock into a coherent
  field using the EXISTING tiling infra (no new tiling code).

**Two findings that reshape the roadmap:**
1. **Rosettes come WITH their faces.** Because the motif is built from classified
   polygons, filling a rosette (points/petals/core in distinct colours) needs NO
   general planar-face extraction — the fills are free. So face extraction
   (gap #2) is only needed to colour PIC-*field* interstitials, not rosettes.
   That demotes gap #2 for the common "rosette medallion/field" case.
2. **Rosette fields reuse the tiling generators as-is.** Placing one rosette per
   tile centre already interlocks acceptably on the hex lattice. Perfecting the
   interlock (matching rosette reach to lattice spacing, shared-edge petals) is a
   tuning refinement, not a new primitive.

Updated priority after this pass: (1) DONE rosette. (2) strapwork/interlace pass
(still the biggest visual upgrade left, needs strand-walk). (3) girih/fivefold
tiling (gates fivefold fields). (4) general face extraction (now only for
PIC-field interstitial fills — lower value than thought).

### Interlace / strapwork pass (2026-07-08, sixth pass) — BUILT

`strapworkSvg(segments, opts)` converts any line network into woven bands.
Pipeline (all in the spike-lib): dedup into a planar graph → **extract strands**
(walk straight-through each vertex: most-collinear continuation at crossings, the
turn at tips) → **assign over/under** (crossings alternate along each strand) →
render each strand as a gold core + bg-coloured casing, **physically gapping the
UNDER strand** at each crossing so the over strand reads on top regardless of
draw order. Samples in `arabesque-interlace.spike.gen.test.js`:

- `il1-star` — one 8-star: no self-crossings, so it just confirms clean band +
  mitred tips.
- `il2-hex` — hex 6-star field: straps weave at the X-junctions between stars.
- `il3-khatam` — 4.8.8 field: clear over/under weave through the bowtie knots.

**Known limitation (documented, acceptable for the spike):** over/under is a
GREEDY per-strand parity with a deterministic tie-break, not a globally
consistent alternating assignment. A few crossings therefore don't alternate
perfectly. True "taut"/alternating interlace needs the checkerboard face
2-colouring — i.e. it depends on the same **planar face extraction** as gap #4.
So face extraction is now dual-purpose (interstitial fills + perfect interlace)
and is the natural next infra piece if we want gallery-grade strapwork.

Authentic vocabulary now covered end-to-end: PIC star fields, N-fold motifs,
concentric/circular constructions, composed panels, rosettes, and interlace.
The remaining items (girih/fivefold tiling; face extraction for perfect
weave + interstitial fills) are enhancements, not blockers, for a fold-in.

## Fold-in — DONE (2026-07-08, seventh pass)

Folded into `create_sketch` as a compact construction mark `arabesque` that lowers
to base `polygon`/`polyline`/`circle` marks at mint time (the same model as
`mandalaField`/`fluidField`). The spec stays tiny; the renderer expands it.

Files:
- **`polygonizer/arabesque.js`** (NEW) — the geometry promoted from the spike to a
  dependency-free, deterministic engine module (tilings, PIC, rosette, circles,
  `strapworkPieces`) + `expandArabesque(mark, manifest)` → base marks.
- **`polygonizer/arabesque.spike-lib.js`** — now re-exports the geometry from
  `arabesque.js` and keeps only the spike SVG emitters (all 6 spike gen-tests,
  22 tests, still green).
- **`sketch/sketch-manifest.js`** — `'arabesque'` added to `MARK_KINDS` + a
  validator branch (mode/pattern enums, numeric + string + boolean params).
- **`neo-rembrandt/index.js`** — `isConstructionMark` + a `resolveConstructionMarks`
  dispatch branch calling `expandArabesque`.
- **`sketch-vocab/arabesque.md`** (NEW) — render-primitive card (reindexed).
- **`polygonizer/index.js`** — `arabesque` → card id for repair hints.
- **`mcp/tools/sketches.js`** — mark documented in the `marks` description.
- Tests: 5 expansion/determinism tests in `neo-rembrandt/index.test.js`.

Mark spec: `{ kind:'arabesque', mode:'field'|'rosette'|'medallion', pattern?, n?,
contactAngle?, cols?, rows?, interlace?, fill?, cx?, cy?, size?, stroke?,
starFill?, petalFill?, coreFill?, ... }`. Deterministic; centred + scaled into the
viewBox. Verified end-to-end via `expandNeoRembrandt` → `validateSketchManifest`
(valid) and a standalone base-mark render (rosette/khatam/interlace/medallion all
render). 1300 polygonizer+sketch tests green, no regressions.

**Operational note:** the running control-plane MCP server caches the tool schema
(mark enum) at connect time, so a `create_sketch({ kind:'arabesque' })` call only
works after the dev server restarts to pick up the new `sketches.js` schema +
`expandArabesque` dispatch.

## Remaining enhancements (not blockers)

- **Fivefold/tenfold girih tiling** — periodic 5/10-fold fields (single 5/10-fold
  stars & rosettes already work via `n`).
- **Planar face extraction (DCEL)** — dual-purpose: perfect "taut" interlace
  (checkerboard 2-colouring) + colouring PIC-field interstitial cells.
- **Bonner pattern-family control** (acute/median/obtuse/two-point) over raw
  `contactAngle`.
- Two-level self-similar (Darb-i Imam quasicrystalline) substitution — advanced.

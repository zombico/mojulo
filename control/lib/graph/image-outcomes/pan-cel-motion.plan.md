# Pan-Cel Motion — generative stills, deterministic motion

Status: proposed (2026-07-11). Next spike after image-outcomes I0–I2.
Designed in conversation with the operator; builds on the image-outcomes
doctrine (image-outcomes.plan.md) and the motion compositor seam
(lib/mcp/tools/motion.js, lib/motion/encode-gif.js). Nothing here is built.

## The idea

Use the external image model (ChatGPT image capability first, same worker
seam as image-outcomes I3) as a NEW frame source for mojulo motion — but
never let it paint motion. The model paints STILLS only: one oversized
background plate, one character key, and a small set of pose cels. Motion
itself — the camera path, the cel schedule, the frame timing — is a
deterministic function of the manifest, composited by mojulo. This is the
pan-cel technique from limited animation, run as a substrate primitive.

Target artifact for the spike: a **5-second looping GIF at 6 fps**
(30 frames) from **~8 external generations**.

## How the design got here (decided, in order)

1. **A frame is a panel with a time index.** The sequential-art per-panel
   machinery transposes to per-frame: same packet/scaffold/instruction/
   audit shapes, same pull/submit seam (I3), `target: cel_<n>` instead of
   `target: panel_id`. The compositor already exists: world motions are
   raster-native (`framePngs` → `encodeGifBuffers`), so an
   externally-rendered family slots into `forge_motion` beside them.
2. **Whole-frame generation boils.** 30 independent generations of the
   same shot flicker in identity, palette, and lighting. Conditioning
   strategies (chain vs anchor) reduce it but don't remove it.
3. **Hotspots → cels.** The background is static CONTENT, not static
   pixels. Regions where content changes (the figure) are cels — the only
   per-frame generative surface. Everything else is plate.
4. **The camera can still move.** Generate the plate LARGER than the
   frame; the camera is a 2D window path over plate coordinates. Pan and
   crop-zoom (Ken Burns) come free and perfectly coherent — the
   background is never re-rendered, only re-cropped. Rotation and true
   dolly/parallax need redrawing and are out of scope for v1.
5. **Lighting is locked by a key, not hoped for.** Scenes are lit: one
   directional light per scene, stated in the brief, established by the
   plate, inherited by every cel. "Same character, same light, only the
   pose changes" is the fixed conditioning clause.
6. **Identity is locked by a pre-scene render (cel 0).** Before any
   footage: a standalone character study — the model-sheet strip — lit to
   the scene (conditioned on the plate), never appearing in the GIF.
   Every follow cel conditions on cel 0, not on frame N−1, so drift
   cannot compound and follow cels generate in parallel.
7. **Model-sheet strip over mandala layout** (operator decision,
   2026-07-11): the turnaround sheet uses the production-standard
   horizontal strip (front / three-quarter / side / back on a common
   ground line) because that layout is what the image model has seen —
   the layout IS the instruction. The mandala/meru machinery enters
   underneath: the figure rig's orthographic cardinal projections
   (figure-mandala-cardinal spike) are the optional high-fidelity
   scaffold for the strip cells, with meru unit-scale keeping character
   height identical across cells. Meru discipline generates scaffold
   geometry; industry convention carries the instruction.

## Doctrine

- **The model paints stills; mojulo paints time.** No generation is ever
  asked to depict motion, continuity, or "the next frame". Every
  generative target is a static image: plate, character key, or one cel
  at one pose.
- **Recipes not renders, fully preserved.** The manifest (plate spec +
  window path + cel schedule + fps) deterministically regenerates every
  scaffold and every instruction. The generated PNGs are the
  externally-authored artifacts (image-outcomes doctrine): snapshot into
  the outcome folder, audit-gated, never the source of truth, never
  edited in place. Given (manifest, accepted stills), the GIF is
  byte-stable. Retiming to 8 fps or editing the pan path re-renders the
  motion WITHOUT touching the generative layer — the lettering-edit
  guarantee, transposed to time.
- **`forge_motion`'s "regenerates deterministically" gets a carve-out**,
  same as world clips: the recipe regenerates scaffolds and prompts, not
  paint. `recoverClip` for stitching reads the stored frames/stills, it
  does not re-generate. Record this beside the world-clip carve-out.
- **Coherence by construction, not by audit.** Background consistency
  needs no check — mojulo did the cropping. The only audited surfaces are
  the plate (standard image-outcome checks), cel 0 (identity + lighting +
  strip conformance), and each cel (pose beat + identity/lighting match
  against cel 0 + edge paintability).
- **One directional light per scene, v1.** Stated in the brief, keyed by
  the plate, locked by cel 0. Local sources (a lamp the figure walks
  past) and pans that carry the figure into differently-lit plate
  territory are real shots but v2 shots.
- **Locked cel-relative camera geometry.** Window pan/zoom moves over the
  plate; the FIGURE's facing does not change mid-shot in v1 (no rotation
  = no re-facing). A shot that needs the character to turn picks the new
  facing from the vocabulary per cel — that's what the turnaround strip
  is for — but perspective on the figure never changes.

## Primitives (the eventual `motion-outcome` manifest)

```
{
  kind: 'motion-outcome',
  title, intent,
  frame: { width: 1536, height: 1024 },
  fps: 6, durationSec: 5, loop: true,
  plate: {
    // an image-outcome-shaped packet, oversized relative to frame
    viewBox: { width: 3072, height: 1280 },   // ≥1.5× frame for crop-zoom headroom
    camera, horizonY, vanishingPoint, forms, renderBrief,
    light: { direction: 'key-left-high', quality: 'soft dusk' }  // stated, not implied
  },
  characterKey: {
    // cel 0 — the pre-scene render; tooling, never footage
    character: 'prose description or character-key ref (v2)',
    facings: ['front', 'three-quarter-left', 'left', 'back'],  // strip cells, closed vocab
    scaffold: 'stick' | 'rig'   // rig = orthographic cardinal projections of the protoform figure
  },
  cels: [
    // the pose cycle — K unique cels, scheduled onto 30 frames
    { id: 'c1', pose: 'walk-contact-a', facing: 'left' },  // closed vocabs only
    ...
  ],
  window: {
    // deterministic 2D camera over plate coordinates
    keyframes: [ { t: 0, x, y, scale: 1 }, { t: 1, x, y, scale: 1 } ],
    easing: 'linear' | 'ease-in-out'
  },
  schedule: {
    // cel → frame mapping; a 6-cel cycle looping over 30 frames
    cycle: ['c1','c2','c3','c4','c5','c6'],
    anchor: 'frame' | 'plate',   // frame = figure holds position, world slides (the walk illusion)
    at: { x, y, scale }          // cel placement in the anchor space
  }
}
```

Three closed vocabularies, one new:
- **cameras.js** (exists, I2) — used by the plate packet.
- **poses.js** (exists, I2) — the cel control layer. The spike may need
  2–4 walk/wave cycle poses added behind the same closed-vocab
  discipline; stick silhouettes remain sufficient (spike lesson 4).
- **facings.js** (NEW) — `front`, `three-quarter-left`, `left`,
  `three-quarter-back-left`, `back`, and right-side mirrors. Each entry:
  yaw angle, instruction phrase, strip-cell slot. Validation rejects
  freeform facings; audits reference entries by name.

## Generation order (the lock chain)

Each stage freezes one thing; the pull/submit seam handles the fan-out.

1. **Plate** — clean, no figures, scaffold-conditioned, oversized.
   Locks the SCENE: geometry, palette, light. Standard image-outcome
   audit + a `light_stated` check (shadow direction matches the brief).
2. **Cel 0 (character key)** — the model-sheet strip, conditioned on the
   plate image (lighting reference) + character description + strip
   scaffold. Locks the CHARACTER IN THAT LIGHT. Rendered large — it is
   the conditioning reference for everything downstream. Neutral study
   poses per facing, generous framing; NOT frame 1's action pose (don't
   bias every follow cel toward one stance).
3. **Cels 1..K** — in parallel once cel 0 is accepted. Each conditions on
   cel 0 + its own stick-pose scaffold (+ the plate crop under its
   composite position). Fixed instruction clause: *same character, same
   light — light direction, shadow side, color temperature, and contact
   shadow behavior must match the key; only the pose changes.* Preferred
   conditioning mode is **in-place** (generated over the actual plate
   crop, composited back with a feathered hotspot edge) — least clever,
   most likely to integrate contact shadows; matting/keying variants are
   spike comparisons, not the default.

Then zero further generations: mojulo composites frame t = eased window
crop of plate + scheduled cel at its anchor → 30 PNG buffers →
`encodeGifBuffers` at 6 fps → motion.gif (+ optional MP4 via the
existing encoder). Filed as a Motion Project (ops tag + stash + outcome
folder) like every other motion.

## Sub-cels — the talking-mouth + blink primitive (added 2026-07-11)

The second classic limited-animation economy, nested one level down: a
HELD base cel (a character holding a pose — a talking close-up) with tiny
**sub-cel** regions that swap independently on their own schedules — the
anime mouth-flap and blink technique. Where the plate/cel split makes the
*background* free per frame, the sub-cel split makes shot *duration* free:
a dialogue shot of any length costs one held cel + a handful of sub-cel
states, because time lives entirely in the schedule, not in the stills.

- **Base-state economics.** Each sub-cel's FIRST state (mouth closed,
  eyes open) is painted INTO the held cel; only the non-base states are
  separate generations. A talking head = 1 held cel + 2 mouth states
  (mid, open) + 2 eyelid states (half, closed) = **5 generations for a
  shot of arbitrary length.**
- **Two new closed vocabularies** (same discipline as poses/facings):
  `mouth` — closed | mid | open (the standard 3-flap set; vowel-shaped
  flaps are a v2 extension of the same vocab), and `blink` — open |
  half | closed.
- **Two deterministic track kinds** drive the schedules:
  `speech` — spans `[{from, to}]` in seconds; within a span the mouth
  cycles closed→mid→open→mid at a flap rate quantized to fps; outside,
  closed. (A text→syllable→span compiler is the natural v2; explicit
  spans are the v1 contract.)
  `blink` — seeded (mulberry32, the beats doctrine: seeded dice only,
  never Math.random) with a mean gap; each blink is a half→closed→half
  envelope scaled to fps. Same seed → same blinks, forever.
- **Composite order:** held cel → sub-cel overlays (only when state ≠
  base state) → then the shot behaves like any cel under the pan-cel
  machinery (a held shot may still ride a slow window drift).
- **Audit surface:** sub-cel states are near-inpaints — tiny rects over
  the held cel. Checks: region-boundary paintability (nothing outside
  the rect changed), state legibility (open reads as open at composite
  scale), identity continuity with the held cel.
- Retiming and re-dialoguing (new speech spans, new blink seed) re-render
  the motion with ZERO new generations — the strongest expression yet of
  "the model paints stills; mojulo paints time."

## The spike

**Shot:** a figure walking left-to-right through a scene — frame-anchored
6-cel walk cycle + a window pan (the classic illusion). Fixed facing
(`left` or `three-quarter-left`). One directional light. 1536×1024 frame
over a ~3072-wide plate. 6 fps × 5 s = 30 frames.

**Budget:** 1 plate + 1 character key + 6 cels = **8 generations**
(plus rejects). Dependency chain plate → key → 6 parallel cels.

**Build steps (throwaway-grade, spike files beside this plan):**
1. Hand-author the motion-outcome manifest (no validator yet).
2. `facings.js` sketch + strip scaffold emitter (stick first; if time
   allows, a second scaffold from the rig's orthographic cardinal
   projections for A/B).
3. Scaffold + instruction emitters for plate / key / cel targets
   (generalize `buildRenderInstructions`; the lighting-match clause and
   art-layer rules are fixed text).
4. Manual handoff to the render worker (the I3 tables don't exist yet —
   the spike does what the manga spike did: files + prompts by hand,
   capture every prompt + conditioning input used, verbatim, as
   retrospective evidence).
5. Composite: window-path resolver (eased keyframes → per-frame crop
   rect), cel paste with feathered edge, `encodeGifBuffers` at 6 fps.
6. Retime the same accepted stills to 8 fps and re-composite — prove the
   motion layer re-renders without regeneration.

**What the spike must measure (the doctrine input):**
- Boil: with cels as the only generative surface, does the result read
  as limited animation (acceptable, stylistic) or as flicker (broken)?
- Identity drift: do 6 parallel cels conditioned on one key hold the
  character? (vs the manga spike's per-panel drift)
- Lighting lock: does the key-cel clause actually hold shadow
  side/temperature across cels, and do contact shadows survive the
  feathered in-place composite?
- Facings fidelity: does the model-sheet strip render as a usable
  turnaround from one generation? Stick scaffold vs rig scaffold, if
  both were run.
- Loop closure: does cel 6 → cel 1 read as continuous? (a cycle is the
  brutal honest coherence test)
- Cel matting: in-place + feather vs any alternative tried — edge
  quality, halo, plate bleed.

**Exit:** the 5-second GIF exists and loops; the retimed 8-fps variant
was produced with zero new generations; a retrospective section is
appended to this plan quoting what held and what drifted — that
retrospective is the gate for promoting to phases M0+.

## Retrospective (running — first render round, 2026-07-11)

The full generation round landed (plate + character key + 6 cels, ChatGPT
image worker; prompts captured under renders/prompts/). What held and what
didn't:

- **HELD: the director layer.** Plate geometry followed the scaffold
  (horizon, road, seawall, headland); the key strip came back as a usable
  four-facing turnaround; the cels carried their walk-cycle beats from
  stick poses alone — identity consistent across all six from key-only
  conditioning, no chained conditioning needed.
- **HELD: motion is mojulo's.** The 30-frame pan composited and retimed
  (6→8 fps) with zero regeneration, as designed.
- **FAILED: the in-place cel contract.** Two independent failure modes:
  (1) *stick-matte ghosting* — the painted character's true silhouette
  (coat, bag, stride) never matches the fat stick mass, so the silhouette
  matte lifted a translucent, misaligned slice of her; (2) *background
  repaint drift* — the model cannot repaint a plate crop "as-is" (clouds
  and sea shimmer moved), so the full cel rect showed as a visible seam
  against the surrounding plate.
- **PARTIAL: difference matting** (|cel − conditioning crop| as the
  matte) recovered the silhouette without regeneration but inherits both
  problems in weaker form: low-contrast figure/ground (tan coat on tan
  pavement) leaves alpha holes, and repaint drift becomes matte noise.
  Kept in the spike as the salvage path for opaque cels; not the
  production shape.
- **DECIDED (operator, 2026-07-11): the ACETATE contract.** The cel is a
  traditional animation cel — the character painted ALONE on a
  transparent background (flat chroma green fallback), no ground shadow.
  Mojulo keys (if needed), draws the deterministic contact shadow
  (identical across every cel and frame, offset along the stated light),
  and composites. This removes both failure modes by contract instead of
  by audit: there is no background to drift and no matte to guess. The
  in-place contract is retired; the cel audit drops
  region-boundary-paintability and gains edge-quality (halo/fringe on the
  keyed edge).

- **ROUND 2 (acetate cels landed): registration is mojulo's job.** The
  acetate contract removed ghosting and seams as designed, but each
  generation places the figure slightly differently in its canvas
  (±17px of feet-bottom jitter across the 6-cel cycle) — composited raw,
  the figure bounces and slides against the ground. Fixed
  deterministically: the compositor measures each cel's alpha bbox and
  pins its feet to the manifest ground line (figure anchor + 104·scale)
  before compositing; horizontal placement is left alone (stride
  asymmetry is legitimate). Residual ~3% scale wobble between cels is
  accepted as hand-drawn boil. Doctrine: geometry the manifest already
  states (the ground line) is re-imposed at composite time, never
  requested from the model — the overlay-re-imposes-truth rule, applied
  to registration.

- **ROUND 3: gait lock — pan speed belongs to the cycle, not the shot.**
  With registration fixed, the walk still read as the character being
  DRAGGED: the eased window pan accelerated/decelerated while the cycle
  played at constant cadence, and the pan speed never matched the stride
  — the skating artifact. The figure rig's own gait doctrine
  (polygonizer/gait-camera.js) names the constraint: the cycle treadmills
  in place, the planted foot regresses at the gait's own rate, and
  forward travel advances phase BY DISTANCE, with `strideDistance`
  coupling the two. Transposed to pan-cel: (1) a constant-cadence walk
  takes a LINEAR pan — never eased; (2) pan px/frame must equal the
  cycle's planted-foot regression px/frame (stick vocab: ~23 units/frame
  × figure scale ≈ 64px/frame here); (3) shot length is therefore a
  DERIVED quantity — this plate's 1536px of pan room buys 4 seconds of
  honest walking (24 frames, 4 clean cycles), and a longer walk needs a
  wider plate, not a slower pan. Fixture updated (linear, 4 s). v2 note:
  the walk-cycle pose entries should be authored with UNIFORM per-frame
  foot regression (ours varies 16→30 units between phases), which is the
  residual intra-cycle surge; the rig's `gait()` is the reference for
  even phase spacing.

- **SUB-CEL ROUND 1 (talking head): patches fail; edits + measured rects
  are the contract.** The held cel came back excellent and is accepted.
  The four states failed two ways: (1) the worker delivered tiny
  STANDALONE patches painted on approximated flat skin — a background
  that never matched the real face cannot be difference-keyed away, so
  every flap composited as a band-aid rectangle; (2) the mouth/eyes rects
  had been guessed at authoring time, before the face existed, and missed
  her actual features. Round-2 contract: **full-frame edits only** (the
  whole held cel re-emitted with only the feature changed — image-edit
  harnesses' native strength; mojulo crops and difference-keys), and
  **rect calibration is a pipeline stage**: sub-cel regions are measured
  from the accepted held cel, never authored blind. General doctrine
  emerging across rounds: never ask the model to paint a small canvas
  that must match existing pixels — either give it nothing to match
  (acetate) or give it everything (full-frame edit).

## Spike 2 — gait-locked walk (rig-authored cycle; started 2026-07-11)

Round 3's rules, wired in rather than hand-applied. Files:
pan-cel-spike/gait-cels.js + pan-cel-gait.spike.gen.test.js, output under
spike-output/pan-cel-motion/gait/. Plate + character key are REUSED from
spike 1; the only new generation targets are six cels.

- **The cycle is authored by the rig.** `gait(WALK_DEFAULTS)` sampled at
  6 uniform phases replaces the hand-tuned stick walk poses — uniform
  regression, real weight shift, loop-perfect closure. Each phase renders
  through the protoform mesher (lateral view, transparent) as the cel's
  pose scaffold — the plan's "optional higher-fidelity pose source"
  promoted for the pose-critical shot.
- **The stride is measured, not assumed.** 24 fine-phase rig renders →
  planted-foot cluster tracking over the ground-contact rows → summed
  regression per cycle = 347px, within 1% of the gait model's own
  2×strideLength prediction (0.66 STAND × the figure's 519px render
  height). Pan = 347/6 ≈ 58px/frame, linear; shot length derived (27
  frames, 4.5 s over this plate). The number is compiled into the
  manifest (`gait.panPerFrame`) — the waypoints→ticks pattern.
- **The rig preview is the timing gate.** The rig overlays themselves
  composite as acetate cels (registration + shadow pipeline unchanged)
  into gait-preview-6fps.gif — the mannequin walks the actual scene at
  the exact timing the painted cels will inherit, so gait acceptance
  happens BEFORE the six generations, not after.
- Cel instructions carry the acetate contract + a new clause: match the
  mannequin silhouette exactly, because the timing was measured from it —
  pose drift now becomes foot-slip.
- **COMPLETE (2026-07-11).** All seven targets rendered (flat-cel simple
  plate + six alpha cels; worker self-keyed from chroma sources, kept
  under renders/chroma-source/); gait-6fps.gif composited first-try
  through the acetate → registration → shadow → measured-pan pipeline.
  The flat limited-animation plate integrates the composited character
  BETTER than spike 1's painterly plate (less texture for the cel edge
  to disagree with) — plate style is a compositing variable, not just an
  aesthetic one. Full pipeline proven end-to-end: scene lock → identity
  lock → timing lock (rig preview) → paint → deterministic composite.
  The primitive is ready for its promotion re-plan (M0+).

## Promotion path (sketch only; re-plan after the spike)

> SUPERSEDED (2026-07-12): promotion now routes through
> animation-cheats.plan.md — the piecewise-character / declared-
> coordinates / cheat-shelf reconceptualization absorbs this M-path
> (its A0–A4 phases carry these items forward).

- M0 — pure module (`normalize/validate`, scaffold + instruction
  emitters, window resolver, compositor) with byte-stability tests; no
  `Date`/`Math.random`.
- M1 — mint via `create_sketch` kind `motion-outcome/v1`; vocab card;
  `/sketches/<ref>` shows plate/key/cel scaffolds + composite preview.
- M2 — render targets ride the image-outcomes I3/I4 seam (`plate`,
  `character_key`, `cel_<id>` targets; same durable request rows, same
  two-layer audit; new checks: `identity_match`, `lighting_match` vs the
  key). A motion-outcome composites only when every target has an
  accepted render.
- M3 — `forge_motion` fifth subject family (`subject.motion_outcome_ref`)
  so the composite lands as a normal mo_ outcome and stitches.
- Character-key as a standalone mintable artifact (`character-key` ref)
  reusable across shots AND by sequential-art panels — the identity-
  persistence seam the comics plan deferred. Re-key per scene: new cel 0
  conditioned on master key + new plate.

## Out of scope (recorded so they aren't re-litigated)

- Camera rotation, true dolly, parallax/multiplane (multiple plates at
  depth rates) — need redrawing or plate stacks; multiplane is the
  natural v2 of the plate primitive.
- Local light sources and re-lighting mid-shot — breaks the "scenes are
  lit" invariant; v2 with per-region light zones on the plate.
- Character turning mid-shot (facing changes within one cycle) — needs
  per-facing cel sets; the turnaround strip exists to enable it later.
- Transparent-cel generation / chroma keying as the default matting path
  — spike comparison only; in-place is the working assumption.
- Deterministic pixel audits (SSIM on cel edges, luminance-gradient
  lighting checks) — v2 of the M2 gate, same posture as image-outcomes.
- Sound — beats bindings for motion outcomes ride the existing audio
  channel work when long-form output (stitch) makes it worth it.

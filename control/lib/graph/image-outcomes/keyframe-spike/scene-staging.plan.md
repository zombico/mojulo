# K1 follow-up — the STAGE layer (multi-clip scenes over depth-anchored plates)

Status: proposed (2026-07-13). Parent doctrine:
[animation-cheats.plan.md](../animation-cheats.plan.md) Addendum 4 — read it
first. Sibling: [face-subcels.plan.md](face-subcels.plan.md) (the sub-cel
schedule layer this reuses). Background primitive:
[pan-cel-motion.plan.md](../pan-cel-motion.plan.md) (the plate + window). Nothing
here is built.

## The pivot this plan makes

The pan-cel manifest is a SHOT: one plate, one window path, one character's cel
schedule ([pan-cel-motion.plan.md](../pan-cel-motion.plan.md#L102-L127)).
"Basic side-scrolling" is that shot's degenerate case — `anchor: 'frame'`, the
character held at screen-center, the plate sliding under it. Everything richer
than side-scroll is blocked by a MISSING LAYER, not a missing render.

What k1/k2 changed: a finished keyframe cycle is no longer "a walk pinned to a
pan." It is a **meru-locked, keyed, loopable character performance** — a
transparent clip, scale-true to the canonical spine unit, with a face sub-cel
track on top, kept per facing (k1 deliberately banked front AND back). That is a
composable OBJECT. This plan adds the layer that composes several of them:

**A SCENE is a stage + a cast + a camera + one clock — and it costs zero
generations over the clips and plates it stages.** Same economics as the cheat
shelf (parent §principle 3), one level up: *scene design becomes placement +
vocabulary selection*, and the only audited surfaces are the plate and the clips
(which already exist). Blocking, depth, camera moves, cuts, dialogue timing, and
audio are all deterministic operators over stills that already exist.

## The load-bearing unknown (why this is a spike, not a build)

**Does the PLATE carry declared floor/depth anchors cleanly enough that
character placement is arithmetic, not eyeballing?** This is the meru-guide move
(Addendum 3) applied to backgrounds: the plate is generated as an EDIT of a
stage guide that declares a floor line and a depth ramp, so where a meru-unit
figure stands — and at what scale — reads correct BY CONSTRUCTION. If that holds,
multi-actor multi-depth staging is coherence-by-construction. If it doesn't, we
fall back to declared stage MARKS the operator places by eye once per plate (the
sub-cel "measure once, trust forever" doctrine). Either way placement never
drifts frame to frame — every frame re-snaps to the declared mark.

## The primitive: a scene manifest above the shot

```
scene := { stage, cast[], camera, timeline, shots[] }

  stage  := {
    plate:  { ref, size },              // oversized static bg (pan-cel plate, unchanged)
    floor:  yAtDepth(depth) -> pixelY,  // DECLARED sole-line as a function of depth
    depth:  { near, far },              // the meru ruler extended into Z: scale = unit / depth
    bands:  [ { name, zFrom, zTo, ref } ] // optional fore/mid/back plate crops for occlusion+parallax
  }

  cast[] := {
    clipRef,                            // a finished keyframe cycle (k1-nera-wave/front, k2-lio-wave, ...)
    mark | xy,                          // stage mark (snapped to floor) OR raw plate coords
    depth,                              // -> scale + parallax rate, from stage.depth
    facing,                             // selects WHICH banked clip (front|back|...); not a mid-shot rotation
    playhead: { clip, in, out, loop },  // where on the timeline this performance runs
    cheat,                             // optional shelf entry (shinobi-run legs-only, speed-line-hold, ...)
    face                                // optional sub-cel track (blink seed / speech spans) from face-subcels
  }

  camera := keyframed window path over stage coords (eased pan + zoom + CUTS)

  timeline := one deterministic clock (fps + duration) that drives:
              camera window, every cast playhead, every face track, beats bindings
```

Recipe, not render: given (scene manifest, accepted plate + clips), every frame
is a deterministic composite — byte-stable, re-timeable, re-seedable for free.
Nothing in a scene is generated that a shot didn't already generate.

## The axes this opens (each is a deterministic operator)

1. **Multiplane depth — the meru lock makes it free.** A character further back
   is the SAME clip scaled by `unit / depth` with its sole snapped to
   `floor(depth)`, on a plate band that parallaxes slower under the window. Before
   the meru lock this was eyeballed; now depth placement is arithmetic on a
   declared unit. This is the real unlock — flat layer → stage with Z. Foreground
   occluder bands borrow [effects-occluder.js](../../effects-occluder.js)'s
   box-field idea: a `zFrom/zTo` plate crop composited OVER actors behind it.

2. **Blocking as placement recipe.** Placing an actor = snapping its sole-line to
   a stage mark at a depth. Coherence by construction, not audit — the extension
   of ground-line pinning from one figure to a cast. Entrances/exits use the
   BANKED facing that reads (a `wave-back` turnaround walks an actor upstage);
   facing is clip SELECTION, never a mid-shot rotation (Addendum 4: head-turns are
   keyframe territory).

3. **Camera grammar + cuts.** Side-scroll is one continuous window. A scene wants
   the camera cheats COMPOSED: `camera-as-subject` drift over the empty plate →
   CUT → `zoom-approach` push on one actor → held two-shot. A cut is a
   discontinuity in the window path plus a cast-subset swap on the timeline;
   shot/reverse-shot is two window crops (or two plates) of the same staged
   composite. All window machinery already exists in the pan-cel compositor — this
   plan sequences it.

4. **Interaction without rendering it.** Two `wave`/`talk` clips staged facing
   each other, each with its own face sub-cel speech schedule
   ([face-subcels.plan.md](face-subcels.plan.md)), camera cutting between them = a
   dialogue scene, zero new character art. A skirmish = `lightning-blows` ghosted
   fist parts between two performers + `speed-line-hold`. The staging DEPICTS the
   interaction; the cheat shelf already refuses framings that contradict it.

5. **One clock.** A scene timeline is the same shape as the blink/speech schedule
   — one level up. A single deterministic playhead drives window, every clip's
   frame, every face track, and (later) beats bindings (parent §out-of-scope:
   audio rides the existing channel when long-form earns it). Retiming or
   reseeding a WHOLE scene stays free — exactly `--blink-seed` at scene scale.

## Depth kernel (Axis 1, one level deep) — one factor governs everything

On a flat ground plane under a fixed camera, a SINGLE depth factor
`k(d) = d_ref / d` governs scale, floor-height, lateral placement, and parallax
— derived (pinhole ground plane, `f·h = (groundY_ref − horizonY)·d_ref`), not
tuned. This derivation is WHY S0's placement is arithmetic, not eyeballing.

```
U            = meru span (859px; k2 crown 178 → ground 1037)
d_ref        = depth where a clip draws native size
horizonY     = vanishing line;  groundY_ref = reference sole line (1037)

k(d)         = d_ref / d                                    // the only free function
scaleAt(d)   = k(d)                     // actor drawn span = U * k(d)
footY(d)     = horizonY + (groundY_ref - horizonY) * k(d)   // soles rise to horizon w/ depth
parallax(d)  = k(d)                     // screen px per reference-plane camera px
```

Per-frame draw for actor `(markX, depth d, facing)` under camera `(camX, camY, zoom)`:

```
span   = U * scaleAt(d) * zoom
footSx = markX*zoom - camX*parallax(d)
footSy = footY(d)*zoom - camY*parallax(d)   // draw facing-clip centered-x footSx, soles footSy, height span
```

- **Actors vs. bands differ.** An ACTOR takes size + floor-y + parallax from `k`.
  A plate BAND is a 2D authored image (not a meru object): it takes ONLY
  `parallax(k(d_band))` for motion and is authored to fill-frame size — never
  scaled by `scaleAt`, or you shrink the plate. Plate depth is the author's
  choice: `d_band = d_ref` → 1:1 window crop; `d_band ≫ d_ref` → slow distant
  vista with actors in front.
- **Occlusion is a painter's sort**: render bands+actors far→near; a foreground
  band drawn last occludes actors behind it. v1 forbids depth ties (actors
  strictly between bands).
- **`zoom-approach` collapses into the kernel**: it is a per-actor DEPTH ramp
  (`d: 2.0 → 0.9` over the shot) + a window counter-move, not a special
  cel-scaler. The one dolly-like move v1 keeps, because the shelf blessed it.

Worked (832×1216 frame, 3072 plate, horizonY=500): bush d0.6/k1.67 (whips),
Nera d1.0/k1.0 span859 footY1037, plate d1.0, Lio d2.0/k0.5 span430 footY768. A
300px reference pan shifts bush 500 / Nera+plate 300 / Lio 150 — multiplane from
two existing clips + one plate.

## Shot algebra (Axis 2, one level deep) — a cut is the ABSENCE of a tween

A scene is a PIECEWISE window over one clock. A continuous eased window is one
shot; a scene is a sequence of independent segments — so a CUT needs zero special
machinery, it falls out of the piecewise structure at encode time.

```
shot := {
  span:   [tIn, tOut],           // frames/seconds on the ONE timeline
  camera: cameraKeys[],           // (camX, camY, zoom) keys eased WITHIN the shot only
  cast:   [clipRef...],           // visible subset (empty = camera-as-subject establish)
  cheat?: shelfEntry,             // zoom-approach = a depth ramp on one cast member
}

for frame t:
  shot         = piecewise-lookup(t)
  (cx,cy,zoom) = ease(shot.camera, t - shot.tIn)   // sampled within the shot → no cross-cut tween
  layers = shot.cast.map(a => kernel(a,cx,cy,zoom) |> selectCel(a.playhead,t) |> faceSelect(a.face,t))
  depthSort(layers + bands) |> composite |> encode
```

Frame N = shot A's last, frame N+1 = shot B's first with a different camera+cast:
the encoder emits a hard cut, no cut frame. Shot/reverse-shot = two window crops
of the same staged composite. Validator teeth:

- **Plate headroom** — window excursion must stay inside every band at ITS
  parallax; check the FASTEST (nearest) layer:
  `plateWidth ≥ frameW + max|camX|·max(parallax)`.
- **Cut continuity** — an actor carried across a cut keeps a continuous playhead
  (only the camera cuts); no cut lands mid-non-loopable-gesture on a carried actor.
- **Sole-mark in band** — a placement whose `footY(d)` leaves the floor range is
  refused.
- v2 (noted, not built): 180°/screen-direction, dissolves, true camera dolly.

## The two rungs (local proves the wiring; Codex is the quality spike)

The kernel AND the shot grammar are pure deterministic code — ZERO generations.
The only worker output is the plate (+ maybe one occluder band).

- **Local (ComfyUI) rung — validates the CONNECTION, now (S0–S2).** A throwaway
  worker plate + the real k1/k2 clips must composite through the kernel + shot
  grammar into a multiplane scene with a cut that reads. Cost: 1 plate (+ maybe 1
  bush band); 0 character gens. Local's only job is a plate fast enough to
  exercise the math against clips that already exist.
- **Codex + bicycle rung — the QUALITY spike, later.** A real staged plate
  painted as an EDIT of the stage guide (floor line + horizon + depth ticks
  preserved), gated by a stage-guide compliance audit, with its own JOB.md — same
  shape as how the keyframe bicycle followed the k1 hand-run. Built once the
  wiring is proven; the kernel/grammar don't care which rung made the plate.

## What exists (do not rebuild)

- **Finished clips to stage**: k1-nera-wave (front + back), k2-lio-wave,
  l1-nero-airfist — meru-locked, keyed, audit-passed, under
  `lite-template/integration/0712/spike-output/animation-cheats/`.
- **The plate + window primitive**:
  [pan-cel-motion.plan.md](../pan-cel-motion.plan.md) (plate spec, window path,
  `anchor: 'frame'|'plate'`), [cameras.js](../cameras.js) (I2, drives the plate
  packet). The window resolver + on-twos compositor from the pan-cel spike are the
  substrate — extend, don't fork.
- **The meru discipline**: the guide emitter + compliance gate (Addendum 3), now
  to be pointed at a STAGE guide instead of a figure guide.
- **The face sub-cel schedule**: [face-composite.js](face-composite.js) +
  [composite-face.mjs](composite-face.mjs) — per-frame state selection on a
  seeded clock; a cast member's `face` track is this, addressed by clipRef.
- **The cheat shelf** (parent §principle 3) — the closed vocabulary of
  zero-generation shot economies; a cast member's `cheat` field selects one.
- **The bicycle** ([bicycle.mjs](bicycle.mjs)) — the self-drivable worker loop;
  the plate/stage-guide render rides its native/local rungs.

## The work

**Rung note for the whole spike:** S0–S2 ride the LOCAL rung to prove the
WIRING — a throwaway ComfyUI plate + the real k1/k2 clips through the pure
kernel + shot grammar. Zero character generations; the only gen is the plate. The
Codex quality rung + its bicycle come after the wiring is proven (see The two
rungs). Build the pure modules FIRST (they need no plate at all) and unit-test
the kernel on synthetic layers before any worker runs.

### S0 — the depth kernel + the stage guide + the floor/depth contract (the unknown)

First the PURE module `stage.js` — `k(d)`, `scaleAt(d)`, `footY(d)`,
`parallax(d)` (the Depth kernel section), fixture-tested on synthetic layers with
NO plate (byte-stable, no Date/Math.random). Then emit a **stage guide**: the
plate canvas with declared `horizonY`, `groundY_ref`, and depth ticks (soles at
d=1.5/2/3) drawn as register geometry (the meru-guide move for backgrounds).
Generate ONE plate as an edit of it via the LOCAL rung. Then place k1-nera-wave/
front at two depths and audit: does the actor read at `U·k(d)` scale with soles on
`footY(d)`, zero placement calibration? Fallback recorded if plate anchors are too
soft: operator places declared marks once per plate (measure-once doctrine). Exit:
an actor placed at a never-authored depth that reads scale-true; the floor/depth
contract written down.

### S1 — multi-clip composite over a static window (the multiplane proof)

Stage TWO clips at two depths on the S0 plate: k1-nera-wave/front at d=1.0
(span 859, footY 1037), k2-lio-wave upstage at d=2.0 (span 430, footY≈768).
Depth-sort (painter's, far→near), `scaleAt`, sole-snap to `footY`, composite over
the plate; parallax stubbed to a static window first. Extend the pan-cel
compositor to take a CAST (ordered by depth) instead of one cel; bands take
`parallax` only, actors take the full kernel. Deliverable: a still + short loop
with both actors at correct relative scale, zero placement calibration.

### S2 — the keyframed camera + the first CUT

Add the piecewise window: an establishing `camera-as-subject` drift over the
empty plate → CUT → `zoom-approach` push on Nera (a depth ramp on her `depth`
track + window counter-move). A cut is the ABSENCE of a cross-boundary tween —
each shot's camera path is sampled within its own span; the encoder concatenates.
Add a foreground occluder band (d≈0.6) so parallax is VISIBLE (it whips past
faster than the plate). Deliverable: `composite/scene.gif` — establish, cut, push,
foreground parallax. The validator refuses: a cut mid-non-loopable-gesture on a
carried actor, a placement whose `footY(d)` leaves the floor range, and a camera
excursion that breaks plate headroom against the FASTEST band
(`plateWidth ≥ frameW + max|camX|·max(parallax)`).

### S3 — the scene manifest + the one clock + re-time proof

Fold S0–S2 into a `scene` manifest and a single timeline clock that drives
window + every cast playhead + every face track together. Add each actor's face
track (reuse face-composite). Then the doctrinal proof, ZERO new generations:
re-time the scene 6→8 fps, re-seed a blink, swap a cut point, re-block one actor
to a new depth — all re-composite deterministically. Fold into the bicycle as
`bicycle scene <dir>` (emit stage guide + JOB, audit plate + placements,
composite). Exit: a retrospective quoting what held and what drifted — that gates
promotion.

## Build log

**S0–S2 wiring PROVEN (2026-07-13, local rung, zero character generations).** The
two pure modules + the raster runnable landed and the multiplane scene reads:

- [stage.js](stage.js) + [stage.test.js](stage.test.js) (17 green) — the depth
  kernel. `k(d)=dRef/d` governs `scaleAt` / `footY` / `parallax`; `placeActor` +
  `drawBox` (clip-raster anchoring), `placeBand` (parallax-only, no scale),
  `depthSort`, and the `headroomOk` / `soleInBand` validator teeth. The plan's
  worked table is pinned as tests (Nera d1 span859 footY1037; Lio d2 span430
  footY768.5; a 300px pan shifts bush 500 / Nera 300 / Lio 150). Pure, no
  Date/Math.random.
- [scene-compose.js](scene-compose.js) + [scene-compose.test.js](scene-compose.test.js)
  (12 green) — the shot algebra. `resolveSceneFrames` plans one depth-sorted layer
  list per frame; a CUT falls out of the piecewise `shotAt` lookup (no cut
  machinery); `zoom-approach` is an actor `depthKeys` ramp reusing the kernel;
  `validateScene` refuses too-narrow plates, out-of-floor soles, and non-loop
  actors straddling a cut. Generalizes pan-cel-spike/window.js (one crop, one cel)
  to N depth layers.
- [composite-scene.mjs](composite-scene.mjs) — the LOCAL raster rung. Real k1/k2
  cels flood-keyed to transparent, composited over a DETERMINISTIC stand-in plate
  (no worker). Two demos: `still` (S1 two-shot: Nera d1 full-size, Lio d2 exactly
  half-scale standing higher on the same ground plane — placement arithmetic, no
  calibration) and `cut` (S2 establish drift + foreground bush parallax → CUT →
  two-shot; the bush at d0.6 whips off-frame while the plate barely drifts).
  Output under `spike-output/animation-cheats/scene-spike/{still,cut}/`.

Doctrine earned: **`sharp` applies a `.resize()` chained after `.composite()` to
the BASE first**, shrinking the canvas below the full-size layer inputs → "must
have same dimensions or smaller". Composite at full frame size, downscale in a
SEPARATE `sharp()` pass. (Recorded so it isn't re-hit in the Codex rung.)

**S0 stage GUIDE + audit DONE (2026-07-13).**
[stage-guide.js](stage-guide.js) + [stage-guide.test.js](stage-guide.test.js)
(9 green) — `buildStageGuide` projects the kernel into a plate-sized guide
(horizon + reference sole line + depth-tick figures at U·k(d) receding to the
horizon, all magenta `#ff2bd6`); `stageGuideSvg` is the BASE the worker edits;
`stageOverlaySvg` is the eyes-gate. `auditStagePlate` is the honest machine gate:
dims match, magenta removed (register leak < tol), sky≠ground (advisory).
[emit-stage.mjs](emit-stage.mjs) emits `guide.png` + `guide.json` + a
`JOB-STAGE.md` handoff, and `audit <dir>` ingests `plate.png` → `stage-status.json`
+ `stage-overlay.png`. Round-trip proven at
`scene-spike/stage/`: auditing the guide itself FAILS (magenta leak 0.0088),
auditing a clean painted plate PASSES (leak 0, groundΔ 360); the overlay shows the
tick figures standing on the painted ground. The register/floor READ stays the
operator's eyes over the overlay (the plate has no crisp crown/ground — stated in
the plan, honored here).

**S3 one-clock face tracks + zero-generation proof DONE (2026-07-13).**
scene-compose.js grew `resolveActorFace` (per-actor blink/speech resolved on the
SCENE clock via the existing `resolveSubCelTracks`; actor layers carry `celFile` +
`keyDir`, variant → `face/<vocab>-<state>.png`, base → `cel.png`) and
`requiredAssets` (pose count + face variants per clip, INDEPENDENT of fps / seed /
cut / blocking). Tests (16 total, +4): a face-tracked actor selects blink variants
on the scene clock while an untracked actor holds base; and the doctrinal proof —
re-time (fps 12→8), re-seed (blink), re-block (depth), re-cut (shot boundary) each
change the composite but leave `requiredAssets` byte-identical. Demonstrated at the
raster level: [composite-scene.mjs](composite-scene.mjs) `talk` demo at 12fps (36
frames) vs `SCENE_FPS=8` (24 frames) reports the SAME requiredAssets; `celBuffer`
honors `celFile` with a fallback to `cel.png` for variants the Codex face rung
hasn't painted yet (the selection path is exercised without blocking on assets).

**Codex plate + contact shadows PROVEN (2026-07-13).** Codex rode JOB-STAGE.md and
painted a real plate (an empty plaza with an explicit perspective floor —
`scene-spike/stage/plate.png`), audit PASS (dims, zero magenta leak, groundΔ 218).
Fed through `PLATE=<path> composite-scene.mjs still`, the real k1/k2 clips staged
onto it read correctly at their declared depths — the S0 gamble held against a
freely-styled plate: the painted floor recession AGREES with `k(d)=1/d` (overlay
tick figures plant on the tiles). Two quality gaps identified: (1) figures read as
cutouts without ground contact, (2) warm-clip vs cool-plate light mismatch.

Gap 1 closed deterministically — the **contact-shadow effect layer** (cheat-shelf
family; mojulo draws it, the worker paints NOTHING): `groundShadow(place)` in
stage.js (a flat AO pool on the sole point, direction-agnostic, scaling with
`span` so it shrinks with depth), attached per actor layer by scene-compose
(opt-out via `stage.shadows === false`), rasterized as a blurred ellipse under the
cel by `shadowClip` in composite-scene.mjs. Re-composited: both figures anchor to
Codex's floor. Gap 2 (light match) is the A4 re-key, v2 — the only thing between
this and shot-quality.

**The GIANT bug — `unit` is a per-plate SCALE FIT, not the clip's height
(2026-07-13, operator caught it).** First Codex composite read as giants. Root
cause: stage `unit` was set to the clip's NATIVE pixel height (859), but `unit` is
"how tall a person APPEARS at the reference depth in THIS plate" — a different
number. The tell is the implied camera height `h = (groundYRef − horizonY) / unit`
= 537/859 ≈ 0.62 person-heights = a hip-level camera looking up → everyone looms.
Fix (one number, zero regeneration, NOT handing the composite to Codex — that
would discard the reusable-clip / zero-gen architecture): `eyeLevelUnit(groundYRef,
horizonY, h=0.93)` in stage.js sets `unit = (groundYRef−horizonY)/h` so a standing
figure's eyes land on the horizon (the correct-scale rule). unit 859→577; `drawBox`
already scales the native 859px clips down to it. Re-composited: natural eye-level
medium shot, figures shorter than the lampposts. **Doctrine: the guide AND the
composite must share this fitted unit** — the first guide drew unit-859 giant tick
figures, so Codex (rightly) ignored them and painted a natural plaza; the scale was
LUCK, not contract. emit-stage.mjs now uses `eyeLevelUnit` too, so the guide's tick
figures sit head-on-horizon and a plate painted to match them is correctly scaled
by construction. 51 tests green. **Open: `unit` should ideally be DECLARED by the
worker (the person-height it painted for) or bound by a fixed architectural anchor
in the guide, not assumed eye-level — different shots want different camera
heights.**

**PUSH/PULL orchestration PROVEN (2026-07-13).** The camera `zoom` keyframe now
scales about the FRAME CENTER (was origin → shrank toward the corner): placeActor/
placeBand pan first, then zoom about `center` (threaded from `scene.frame` by
scene-compose; default origin keeps zoom-1 math unchanged). `pull` demo on the
Codex plate: lens zoom 1.5→1.0 (ease-in-out) over the full 3s while both actors
wave — the camera pulls back to reveal the plaza, plate covering throughout,
shadows scaling with the zoom. Constraint recorded: this plate is frame-HEIGHT
(1216), so the pull stays z≥1 (a wider pull that goes z<1 reveals black top/bottom
— needs a taller plate; the plate-height ceiling, same family as pan headroom).
52 tests green.

**`zoom-approach` PROVEN, data-only (2026-07-13).** `approach` demo: Nera walks
toward camera via a per-actor `depthKeys` ramp (d 2.6→1.0) while Lio HOLDS at d=2 —
she grows + moves down-frame, he stays put, so it reads as the CHARACTER advancing,
not the camera. Zero new code — `actorDepth` already read `depthKeys`; only a demo
object was added. This is the tool-cost proof: the motion vocabulary (multiplane,
cuts, lens push/pull, zoom-approach, shadows, face tracks, zero-gen re-time) all
COMPOSES AS SCENE DATA — no new tools. The remaining boundary is the AUTHORING
SURFACE: scenes are hardcoded demo objects in composite-scene.mjs; a new scene
means editing the .mjs (or a ~5-line scene.json reader). First-class authorable/
mintable scenes are the A0–A4 promotion path (below), the real build.

What is NOT yet done: an external scene-manifest input (author scenes without
editing code) + the A0–A4 promotion (mint via create_sketch, render seam,
forge_motion); A4 scene re-key / light-match (v2); the blink VARIANT cels (the
face rung) so `talk` visibly blinks; a real occluder BAND from Codex (the `cut`
bush is a stand-in); a TALLER plate so a full wide pull (z<1) stays covered;
folding emit/compose/audit into a single `bicycle scene` subcommand.

## Success criteria

1. Two+ actors from existing clips stage at correct relative scale by the meru
   unit with ZERO per-placement calibration (S0 contract holds). ✓ (S1 `still`)
2. The multiplane composite depth-sorts, parallaxes bands at declared rates, and
   occludes actors behind foreground bands correctly. ✓ (S2 `cut` — bush parallax)
3. `scene.gif` reads as a directed sequence — establish, cut, push — not a pan;
   the cut lands clean. ✓ (S2 `cut`; `zoom-approach` push wired, not yet demoed)
4. Re-time / re-seed / re-block / re-cut with zero new generations (byte-diff:
   the recomposite differs ONLY where the manifest differs). ✓ (`requiredAssets`
   invariant tests + the 12/8fps `talk` raster demo)
5. The validator refuses a staging that contradicts its cheat (out-of-band
   sole-mark; cut mid-gesture), the way the shelf refuses a bad framing. ✓
   (`validateScene` tests)

## Out of scope (v1)

- **Mid-shot rotation / true dolly / real parallax-by-redraw** — facing is banked
  clip selection; depth parallax is band translation, not re-projection (parent
  §out-of-scope, unchanged).
- **Actor-to-actor contact that must be DRAWN** (a handshake, a real hit) —
  interaction is depicted by staging + cheats (lightning-blows, speed lines), not
  by a new two-body render. A genuinely drawn contact is a keyframe shot, not a
  staging op.
- **Local light per actor / re-lighting into a plate's zones** — v2 (parent
  §out-of-scope). Clips carry their bank light; staging does not re-light.
- **Automatic blocking / camera choreography from a script** — the manifest is
  authored; a text→blocking compiler is a later layer, if ever.
- **Beats/audio bindings** — ride the existing audio channel when long-form scene
  output earns it (parent §out-of-scope); the one-clock design leaves the seam
  open.
- **Mechanical inbetween interpolation of clips** — unchanged from Addendum 4;
  clips run on twos with holds, never tweened.

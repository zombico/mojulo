# Pixelizer — directed pixels on a deterministic frame

The raster mirror of the polygonizer: a closed, deterministic vocabulary that
turns intent into directed pixels on a fixed map, animated by sprite grammar
rather than by running code. Sibling doctrine to
[POLYGONIZER-SYNTHESIS](../../../..//docs/POLYGONIZER-SYNTHESIS.md); dream-loop
seam shared with [shape-from-dream](../polygonizer/shape-from-dream.plan.md).

## Motivation: recover the PPU's authorship model, not its look

What made the CRT + sprite era workable was never the pixels — it was that the
console never *drew*. An NES frame is not the residue of accumulated draw
calls; it is a **pure resolution of tiny declarative state**: a nametable (grid
of tile *references*), a pattern bank (the tiles), OAM (~64 sprite entries of
`{x, y, tile, palette, flip}`), and palette RAM. Every frame the PPU re-derives
the whole raster from that state. Nothing free-flows; nothing persists except
the declaration. The picture is always *derivable*, never *mutated into being*.

That is mojulo's founding invariant discovered forty years early: **recipes,
not renders**. OAM is a recipe the hardware re-mints 60 times a second. The
pixelizer does not imitate the CRT aesthetic — it recovers the CRT's authorship
model, which this substrate already enforces everywhere else (seeded dice,
validate-at-mint, deterministic re-render, beats' audio-reads-sim-state-never-
writes-back).

Why this beats raw canvas mechanically: a JS canvas *can* do all of this
(emulators prove it), but canvas is immediate-mode — the frame is an emergent
side effect of imperative code, and the state that produced any given frame
exists only in the running process. There is no artifact to validate, diff, or
re-derive; you cannot run a mint-time gate against a render loop. The
declarative frame model gets, for free, everything mojulo's machinery already
knows how to do:

- **Validate at mint** — palette budget exceeded, placement outside the map,
  dangling sprite reference: all refusable before anything renders.
- **Diff as data** — two animation revisions diff as "frame 3: hero moved cell
  (4,7)→(5,7)", not as unreviewable code diffs.
- **Byte-identical replay** — `frame(recipe, t)` is a pure function; render
  frame 47 twice, assert byte equality. "Each pixel landed on a deterministic
  frame" is literally testable.
- **LLM authorability** — the quiet decisive one. An agent cannot hold a render
  loop's emergent state in its head, but OAM-sized declarative state is exactly
  what an LLM authors well. The 1983 constraint (tiny RAM) and the 2026
  constraint (context and legibility) select the same design.

## The two-tier structure (the NES's own split, mapped onto mojulo)

- **The tile lattice** (nametable analog) — the map as a grid of tile
  references into a shared sprite/tile bank, plus per-region palette assignment
  (the attribute-table move: palettes bound to regions, not pixels). Keeps
  recipes tiny; makes the palette a first-class validatable constraint.
- **The CCA above it** (OAM-plus analog) — sprite placement with what OAM never
  had: parent attachment, depth bands, cardinal-pinned relations, back-to-front
  paint order. The CCA emits the pixels *from the angle the content is shown
  in*: facing is a CCA property, and the raster is derived from it. "Turning
  left and right" is one authored sprite + the E-W reflect — zero new pixel
  data, exactly the OAM flip bit as grammar.

The CRT itself (phosphor, scanlines, curvature) stays out of the recipe: a
presentation shader over the crisp render, like baked lighting outside world
geometry.

## Invariants

- **Recipes, not renders.** The recipe is palettes + sprites + placements +
  tracks. SVG/PNG/GIF frames are derived renders; an exported strip or APNG is
  a bound render over the seam, like beats' WAV export.
- **Declarative frame resolution.** A frame is `resolveFrame(recipe, t)` — a
  pure function of the recipe and an integer frame index. No retained scene
  graph, no mutation between frames. Same recipe + same t → byte-identical
  output.
- **Integer cells only.** Positions, sizes, and spans are integer cells. The
  "landed" feel is the quantization rule, held as an invariant, not a
  preference. No sub-pixel positions, no floats in the placement grammar.
- **Palette budget is vocabulary.** NES sprite rule adopted from day one:
  3 colors + transparent per sprite. Background regions get their own small
  palettes (attribute-table style, later phase). Loose-then-tighten never
  works; the constraint IS the medium.
- **Reflect is grammar, not data.** Facing/mirroring resolves through the
  cardinal reflect (E-W first; N-S available), mapping cardinals to cardinals —
  the polygonizer's no-free-angles discipline. A flipped frame contains zero
  new pixel data.
- **Seeded dice only.** The spike needs no randomness; when dither/noise
  arrives it is mulberry32-seeded (never `Math.random`), matching beats.
- **Validate at mint.** Bad palette indices, out-of-bounds placements, ragged
  sprite rows, dangling refs fail with clear messages before render.
- **Fields are shared, not forked.** When region fills arrive (P3), they sample
  the existing polygonizer field kinds (`gradient`, `radial`, `noise`, `sum`)
  quantized to palette ramps — the pixelizer is a second *sampler* over the
  same fields, the way `/world` is a second renderer over the same manifests.
  No parallel field system.

## Dream-loop posture (both taken, split by register)

The qwen worker (Qwen-Image-Edit-2511, the local rung) is the pixelizer's eyes
exactly as in shape-from-dream. Two postures, both now live:

- **Posture 1 — read-and-reauthor** (the 8-bit standard, and for characters
  that have no dream): DREAM → SEE → re-author cells by hand in the closed
  vocabulary → discard the raster. Right where sprites are small or the agent
  is inventing rather than transposing.
- **Posture 2 — the quantizer** (TAKEN 2026-07-24, `quantize.js`): dreamed
  pixels bake into cells through a PURE function (same bytes + params → same
  cells), so the recipe stays re-derivable from the archived source — the
  sovereignty condition. Recipes carry dream-audit-style provenance (source
  file, sha256, crop, grid). This is the cutscene/demo-tier intake: worker
  fidelity the agent could never hand-transcribe, landed in-budget. The
  division of labor is fixed: quantization recovers LIKENESS; palette
  curation, region boundaries, animation timing, and repair passes stay
  agent-side. The killer seam is `diffRasters`: meru-locked face variants
  quantized on the base's pinned palette diff into blink/mouth sub-cels WITH
  placement coordinates — the edit model's localized change mapped directly
  onto the sub-cel economy. No frame is generated per frame; the worker
  supplies states, the track grammar supplies time.

## The cutscene register (the 16-bit tier's forcing case)

Upscaling an era means adopting the next console's declarative state model,
never its labor model. The forcing case for the 16-bit tier is the **cutscene /
intro** — the one artifact that is a pure function of `t` end to end: no sim,
no input, no branching. Every cinematic verb of the era decomposes into closed
integer grammar:

- **the cut** — a scene list with frame durations; the global clock resolves to
  (scene, local-t).
- **the pan** — viewport ≠ map: a `viewport` plus a `@camera` cell track.
  World-coordinate placements scroll with it; `fixed` placements (HUD, titles)
  don't.
- **parallax** — layers of tile rows, each with a `parallax: [num, den]`
  rational against the camera plus its own scroll track. `[0,1]` is sky-locked,
  `[1,1]` is world-locked.
- **the fade and the flash** — the era's palette math kept integer: a `@fade`
  level track stepping 0..8 toward a track color. Fade-from-black, white
  impact flash, sepia tint — zero new pixel data (the third instance of
  animation-as-grammar after reflect and palette cycling).
- **text** — on real hardware text was tiles; here a font is a 1-bit glyph
  bank and a caption is a placement whose `reveal` track is the typewriter and
  whose `cell` track (or a camera move) is the credits scroll.
- **timeline tracks** — cutscene tracks are long, so per-frame value lists
  don't scale. Keyframes `{at, value}` with integer-floor lerp for
  cell/scroll/level/reveal, step-hold for sprite/facing. The P0 cycle tracks
  survive unchanged (walk cycles), gaining `every` for frame-rate control.
- **the player** — playback is presentation: a canvas + integer rAF clock over
  `resolveFrame(recipe, t)`, with scrub/step/pause because every frame is
  addressable. GIF/APNG demotes to an optional derived render. The engine is
  one closure (`createCutsceneEngine`) serialized into the player HTML, so the
  module and the player can never drift.

The 16-bit raster budget rides the same seam: `register: '16bit'` widens the
per-raster palette to 15 + transparent (cell chars `1-9a-f`), the 4bpp SNES
budget. Constraint stays the medium — just the next console's constraint.
Beats sync is the natural next seam (both players are pure functions of one
integer clock), deliberately deferred until the picture side proves out.

## Phase ladder

- **P0 — the spike (this folder).** `pixelizer.js`: palette + sprite (cell
  strings) + placement + facing + `resolveFrame(recipe, t)` → crisp-edges SVG
  (one merged path per palette color). Red robot, 16×16, standing in place,
  turning left/right — the turn is the E-W reflect resolved from the CCA
  facing. Unit test: mint validation, byte-identical replay, reflect
  correctness. Gen test: frames + a CSS `steps()` preview for eyeballing.
- **P1 — tile lattice + CCA placement.** The nametable analog: map as tile
  references into a bank; placements gain parent / depth-band / paint-order
  via the constellation grid's placement math (`boundsFromGridCell`);
  per-region background palettes.
- **P2 — dream loop.** `pixel-from-dream` discipline: qwen dreams a
  single-subject sprite sheet in a pixel register, agent re-authors cells.
  Register note: sprites are single subjects, so the exploded-parts negative
  result from shape-from-dream does not bite here.
- **P3 — fields as fills.** Background regions filled by sampling existing
  field kinds quantized to palette ramps; seeded dither.
- **P4 — animation tracks beyond facing.** Frame-variant sprites (walk cycles),
  cell-displacement tracks, deterministic clock; GIF/APNG export as a derived
  render over the seam.
- **P5 — MCP surface.** Ride sketches, not a new namespace: a `pixelizer`
  block on `create_sketch`/`update_sketch` manifests (expanded like
  `withConstellationGrid`), a conversational door à la `sketch_polygomer`,
  sprite/palette vocab cards under a `pixel_vocab` kind, `pixel-from-dream`
  catalyst.
- **P6 — the 16-bit register.** `register: '16bit'` → 15+transparent rasters
  (cell chars `1-9a-f`), shared tile banks, layers with parallax rationals,
  palette-track effects (cycle/swap/stepped fade).
- **P7 — the cutscene tier + player.** Scenes with durations, viewport +
  camera, timeline keyframe tracks, font banks + caption reveal/scroll, the
  canvas player with scrub (engine closure serialized into the HTML); APNG/
  strip export as a derived render.
- **P8 — the quantizer, with provenance.** The parked doctrine decision,
  forced by 16-bit economics (a 32×48 15-color raster is too big to
  re-author by hand): a deterministic palette-snap + downsample from dreamed
  PNG to cells, carrying dream-audit-style provenance. Posture 1 stays the
  8-bit standard.
- **P9 — sim-driven tracks.** The clock swapped for the game bus: the
  pixelizer as a 2D presentation layer for `create_game` worlds. Visuals read
  sim state, never write back (beats doctrine, picture edition).

## Build log

- 2026-07-26 — THE PHONE POSTURE (brickster + philosopher's stone cabinets made
  mobile-friendly; input was already touch-ready, the gap was layout). Both
  shells gained a `fitBoard`: the world keeps rendering at its native scale and
  the board wrap is transform-scaled as ONE unit to the viewport (width AND
  height constrained), so hit metrics — brickster's knob geometry, PS's
  `cellFromEvent` getBoundingClientRect ratios — stay true under the scale; a
  `#board-outer` carries the scaled layout footprint. A stacked media query
  (620px / 760px) reflows the side HUD into a stat strip ABOVE the board
  (brickster: NEXT/SCORE/LINES/LEVEL/HOLD row; PS: mode buttons + stats + a
  full-width timebar), hides the keyboard hints, and top-aligns the page;
  `100dvh`, `viewport-fit=cover` + safe-area padding, and `touch-action:
  manipulation` round out the ergonomics. Two REAL touch blockers fixed along
  the way: PS's start splash covered the board but had no pointer handler (on a
  phone the game literally could not start — keyboard was the only gate), and
  brickster's message card promised "tap to start"/"tap restarts" without
  honoring taps on itself; both now begin/restart on pointerdown. PS's keyboard
  cursor is hidden on coarse pointers until a key moves it (it read as a
  phantom selection at (0,0)). HUD stats wrapped in `.stat` divs so one flex
  rule reflows them — desktop block flow unchanged. Verified in headless
  Chrome at 1280×800 (byte-for-byte desktop look), 390×844 and 375×667 with
  touch emulation: zero horizontal overflow, pad auto-shows, both games start
  by tap, a center-of-board tap arms exactly the gem under the finger through
  the transform, timed-mode timebar visible above the board. 41 unit + 6 gen
  tests green.
- 2026-07-25 — NEON GP: THE MODE-7 RACER (P9 taken — the first sim-driven
  pixelizer game; the clock swapped for a driving bus). neon-gp's attract-mode
  art direction (synthwave F-Zero — glowing magenta rails, scanline sun, cyan
  grid floor, the rear-view wedge) made PLAYABLE as a solo time-trial, folded
  into the Arcade through the SAME reducer-game seam as brickster (one registry
  entry in pixelizer-games.js → mintable via create_pixelizer_game, served at
  /api/sketches/<ref>/game). Four modules, the brickster split extended for a
  continuous world: `neon-gp-track.js` is the single map as ONE analytic source
  of truth — a rounded-rectangle SDF whose `classify(x,y)→SURF` is read by BOTH
  the reducer (as `surfaceAt`, for physics) and the texture painter (per world
  pixel), so what you HIT is what you SEE; `buildTrackTexture()` bakes it to a
  16bit raster (passes validatePixelRecipe) + an aligned RGBA/surface buffer.
  `neon-gp-core.js` is the pure reducer — an F-Zero-like on a FIXED timestep
  (position/heading/velocity are floats advanced by DT-sized ticks whose input
  rides in the action; determinism holds as seed + input-per-tick → the same
  run). The four requested mechanics live in `applySurface`, keyed off the one
  classifier: RAIL is a wall-RIDE (kill the into-wall velocity component, slide
  the tangential glide, bleed energy only on a hard hit — bump + damage without
  the bounce-stall), VOID is the edge scrape (drag + drain; far past the rail =
  fall = wreck), RAMP launches a z-arc that flies over rails, BOOST pads + a
  manual afterburner raise the cap, the START line is a recharge pit that banks
  the lap through ordered gates. `neon-gp-skin.js` holds the ONE projector —
  `renderFrame(tex, state)` → an RGBA scene (parallax synthwave sky + an
  infinite cyan grid floor + the track loop scaled/rotated under a trailing
  Mode-7 camera, per-scanline `dist = camH·FOCAL/(sy−horizon)`), shared verbatim
  by the shell (→ live canvas) and the gen-test (→ PNG stills), so the cabinet
  and the reviewable still can't drift; plus the deterministic craft painter and
  `resolveOverlay` (raster = world, overlay = communication — SPD/LAP/TIME/
  ENERGY are real DOM). `neon-gp-shell.js` `emitNeonGpShell` inlines the three
  modules + a fixed-timestep input→step loop + the canvas draw (banked craft,
  ground shadow, airborne lift) + a start gate / 3-2-1 countdown + a touch pad +
  an optional WebAudio engine hum that rides speed. Register labelled '32bit'
  (the era it belongs to; the authored rasters are 16bit internally) — the mint
  tool's enum gained '32bit' as a metadata label. Verified headless end to end:
  texture validates, the projection reads from spawn/mid-corner/airborne stills
  (baked via sharp), physics accel/wall-ride/determinism pin down, and a
  centerline autopilot FINISHES 2 laps with energy intact (completability
  proven the F-Zero way). Open follow-ons: rival AI + the field race; a second
  track; Mode-7 track curl-back (this loop is a rounded rect).
  UPDATE (same day, iteration 2): the circuit went BIG + WIDE and gained a
  soundtrack. Track is now a ~7400-unit lap (10×) on a 260-wide road (5× — room
  to race), which forced DECOUPLING the texture from world size: `TEX_SCALE`
  (texels/unit) keeps the painted raster a light ~1MP while physics stays exact
  at world scale (surfaceAt is analytic, not texel-sampled), and `buildTrack-
  Texture` (rgba+surface, runtime) split from `buildTrackRecipe` (cells, the
  validatable doctrine gate — tests/gen only) so the shell never inlines a
  million-char cells array; detail patterns (grid/dash/glow/chevron) moved to
  world space so they hold at any scale. Camera + physics re-tuned for the fast
  circuit (MAX_SPEED 430, grippier so wide sweepers are drivable, wide run-off
  before a fall); the autopilot still finishes 2 laps. SOUNDTRACK ships through
  the REAL beats family (no parallel grammar): `neon-gp-audio.recipe.js` holds
  three selectable 32-step A-minor loops — NEON (synthwave) / PULSE (techno) /
  DRIFT (ambient), all `beats-pattern` (loop by construction) — plus an SFX cue
  bank; the shell serializes the beats kernel + recipes and fires cues by
  DIFFING sim state (countdown/go/lap/finish/wreck/boost/launch/bump), layered
  under the speed-tracking engine hum, with a track-select + mute button (audio
  reads sim state, never writes back). 17 unit + 2 gen + 140 family green; the
  emitted 105KB cabinet (beats kernel inlined) parses clean. Still browser-
  judged: driving FEEL + soundtrack mix.
  UPDATE (iteration 3): road widened again — ROAD_HALF 130→200 (a 400-wide
  ribbon), the world grown to fit (2960×2240) — and the soundtrack now EVOLVES
  instead of repeating. A shell-side seeded dice (mulberry32 off the clock, never
  Math.random — the doctrine as a live-performance layer) re-lays the pattern
  every loop period via `varyPattern`: rolls between authored alternate contours
  (`alts` on the lead/arp/shimmer — carried on the recipe, ignored by validator
  + kernel), jitters the per-step mask (drop a hit / add a ghost) while holding
  the kick steady, and occasionally lifts a sparkle voice an octave. The stored
  recipes stay pure/validatable; the variation is performance, seeded so it's
  reproducible. Base recipes provably unmutated across variations.
  UPDATE (iteration 4): the map went VAST and the ground sampler went ANALYTIC.
  A ~20×-larger course (loop linear ×5 → ~25× area, a ~37k-unit lap; road kept
  at 400) blew past what a baked full-world texture can hold, so the Mode-7
  ground is now sampled ANALYTICALLY: `groundColorAt(wx,wy)` computes each pixel's
  color directly from the map's `paintAt` (classify + world-space detail) — no
  baked texture at runtime, so the world costs O(1) memory and stays crisp to the
  horizon at any size. `buildTrackTexture`/`buildTrackRecipe` survive only as the
  coarse top-down review render + the validatable doctrine gate; `renderFrame`
  dropped its texture arg (shell/gen/test updated), and the shell no longer builds
  any texture at load. Physics rescaled for the big lap (MAX_SPEED 650, accel to
  match), detail spacings coarsened to world scale, camera fog pushed out. The
  craft draws at 20% (80% smaller) — a tiny wedge on a road that now runs dead-
  straight to a distant vanishing point. Autopilot completes a lap with energy
  intact; 17 unit + 2 gen + 140 family green; the ~107KB cabinet parses. Doctrine
  note: analytic ground is MORE in the "recipes not renders" spirit — the frame
  is a pure function of position with no intermediate raster at all.
  UPDATE (iteration 5): it became an actual RACE. Added a field of AI RIVALS
  (state.rivals, in the reducer so replay stays deterministic): each holds a lane
  on the centerline via a lane-following controller (tangent + lateral-error
  correction + lookahead braking), runs the same physics shape as the player, and
  laps through the SHARED `advanceGates` (refactored out of applyProgress so
  player + rivals count laps the same way). Player↔rival CONTACT resolves in the
  tick — a bump knocks both apart and dents the player's energy (the racing
  element made real). Standings via `racePosition` (a monotonic progress scalar);
  the HUD gained a live "P n/4". Rivals render as depth-sorted TINTED BILLBOARDS
  through a new shared `projectToScreen` (the exact inverse of the ground sampler,
  so a rival lands precisely on the plane), fog-dimmed by distance. Added the
  MINIMAP: the track sampled once via `surfaceAt` into a corner canvas, with the
  player (cyan) + rivals (team colors) as live dots. Car back up to a readable
  size (scale 1.3), top speed to 760. Verified headless: rivals lap + standings
  evolve (player slips P1→P4 as the faster AI passes), a bump drains energy +
  separates both, the billboard projection reads (a `blitRivals` still shows the
  three rivals on the road), minimap renders the loop + dots. 21 unit + 2 gen +
  154 family green; the ~116KB cabinet parses.
- 2026-07-25 — BRICKSTER FOLDED INTO THE MOJULO ARCADE (the P5→GP-A
  intake for a reducer game, first instance). A reducer game is now a
  sovereign `kind:'game'` sketch: `scripts/seed-brickster-game.js` mints
  `sk_brickster`, whose manifest is a tiny RECIPE — `engine:'pixelizer'`,
  `reducer:'brickster'`, `music`, `menu.tagline`, `theme` — and nothing
  more (recipes, not renders; the HTML is regenerated per request). That
  single row lands it in the `game` bucket, so it appears on the Maker
  gallery and the Arcade (`/api/arcade` → `/arcade`), inspectable at
  `/sketches/sk_brickster`, playable at `/arcade/sk_brickster`. The play
  seam is a new branch in `app/api/sketches/[ref]/game/route.js`: when
  `manifest.engine === 'pixelizer'` it serves the self-contained shell
  instead of running the world/level resolver. The shell became ONE
  reusable emitter — `brickster-shell.js` `emitBricksterShell({ music,
  touchDefault, title })` — so the served cabinet and the gen-test spike
  can never drift (the spike now just calls it; source is inlined from
  `process.cwd()/lib/graph/pixelizer` so it survives Next's bundler where
  `import.meta.url` would resolve into `.next/`). Verified live end to
  end: `/api/arcade` lists the cabinet with its manifest facts, the game
  route returns a 128KB `text/html` shell (title/GROOVE-default/start-
  gate/touch-toggle all present), and `/sketches`·`/arcade` render 200.
- 2026-07-25 — THE MINT TOOL (`create_pixelizer_game`) landed, so a reducer
  game comes in through MCP, not a seed script. `lib/graph/pixelizer/
  pixelizer-games.js` is now the single registry — `PIXELIZER_REDUCERS`
  (reducer → cabinet defaults + shell emitter), `buildPixelizerGameManifest`,
  `emitPixelizerGame` — shared by the tool, the game route (which now
  dispatches through `emitPixelizerGame` instead of a hardcoded brickster
  check), and the bootstrap seed. Registered beside `create_game`
  (server.js), filed in the `game` creative-toolset drawer + the test's
  `RING10_TOOLS`, description trimmed to lean routing prose (drawer teaches);
  the tools/list payload pin was re-pinned 360k→362k to bless it. 5 tool
  tests + the registry/description/routing sweeps green. Adding the next
  reducer is now one registry entry + a shell emitter — mintable and
  playable with no route or tool edit. Still open (doctor-pill's turn): its
  own shell emitter as the second `PIXELIZER_REDUCERS` entry, and a pixelizer
  game-vocab shelf if the reducers grow options worth a card.
- 2026-07-24 — BRICKSTER MIGRATED TO THE RASTER/OVERLAY DOCTRINE. The
  doctor-pill split ("raster = world, overlay = communication") applied
  to the first playable: the world raster now carries ONLY the well,
  stack, active piece, and landing ghost — the 5×7 glyph font is gone
  from both skins' banks, and SCORE/LINES/LEVEL, the HOLD/NEXT labels,
  and the GAME OVER interruption resolve through `resolveOverlay(state)`,
  a pure register-independent view-model rendered as real text (native
  resolution, selectable, screen-readable, i18n-ready). The hold/next
  previews stay diegetic (they ARE pieces) as their own tiny world
  rasters placed beside their text labels. One consequence made the
  doctrine's payoff literal: `emitComposedSvg` is now register-neutral
  (takes `renderWorld`/`renderPreview`), so the 8-bit and 16-bit skins
  share the EXACT same text HUD — the render seam collapsed entirely
  into the world, and `brickster-skin-16.js` re-exports `resolveOverlay`
  verbatim instead of forking a glyph panel. Dual-register demo reframed
  from "two pixel registers" to "one truth, two resolutions, one HUD."
  Tests rewritten to assert the negative (the world bank holds no glyph
  tiles; `renderWorldSvg(over)` contains no `<text>`; GAME OVER is an
  overlay message, never a raster row) — 19 brickster + 105 family
  green; the playable/touch/dual bundles + composed stills regenerated.
- 2026-07-24 — NEON GP AT THE ERA FRAME: upscaled from 192×112 to
  320×224 (the PS1-class 2D resolution) — the second half of "32-bit"
  after color depth. Cost of the resolution rung, measured: the painter
  re-derived at the finer grid by constant changes (horizon, sun
  radius, block sizes, line spacing), the hand ship rode an integer
  `double()` (nearest-neighbor 2×), and every motion track carried over
  UNTOUCHED — palette rotations, bob, flicker, blink are all
  resolution-independent grammar. ~20 lines of parameter edits, zero
  new art, zero renders. Generated art scales for free; only
  hand-authored rasters pay a (mechanical) upscale.
- 2026-07-24 — NEON GP LANDED — the 32-bit register's first original
  scene: a futuristic racer attract mode where the form factor is
  honored but the color space is deliberately post-era (full-sRGB neons
  — #00ffe7, #ff2bd6, #b6ff00 — that RGB555 could never name; "not
  bound by the technology, just the form factor"). One generated world
  raster (painter: sky ramp + stars + scanline sun + two window-lit
  city silhouettes + converging grid floor + perspective road) with the
  palette laid out in NAMED INDEX BLOCKS so two rotation tracks animate
  exactly the grid-line ramp and the road-band ramp — the OutRun trick,
  all forward motion at zero pixel data per frame. Hand-authored
  rear-view craft with hover-bob cell cycle and 3-cel exhaust flicker;
  HUD captions incl. a blinking BOOST (reveal cycle track — reveal's
  first cycle-track use). One iteration: phase-plateau grid lines
  painted slabs → lines now paint only on phase TRANSITIONS. LOE: ~200
  recipe lines, zero worker renders, zero hand-typed art beyond the
  36×20 ship — the scene is math + palette discipline + the existing
  grammar.
- 2026-07-24 — THE 32-BIT RUNG LANDED (color depth first) — register
  '32bit' = 61 colors/raster (the cell alphabet 1-9a-zA-Z is the
  ceiling), one shared CELL_ALPHABET across cutscene.js/quantize.js,
  and the same Hana renders re-baked through the SAME bakeActor call at
  grid 104 + budget 61: visibly closer to the painted source (skin
  gradients, hair ramps, iris warmth), recipe only 1.4× the bytes of
  the 16-bit bake. One era lesson surfaced immediately and is now
  grammar: at deep budgets the palette is fine-grained enough that
  diffusion's invisible generation noise lands on DIFFERENT palette
  entries between renders — the blink diff exploded to 63% changed.
  Fixed with a perceptual `tolerance` on diffRasters (cells whose
  palette colors sit within an RGB distance count as same; transparent
  vs painted always differs) — the 15-color budget had been absorbing
  that noise silently; the deep register needs it named. Effort shape
  confirmed: the era climb cost ~60 lines of engine + a spike block +
  one bug — zero art authoring, because pixels now arrive through the
  quantizer. Tokens scale with grammar, not with art. Next 32-bit
  rungs: blend layers (color math), layer affine, more states per
  group.
- 2026-07-24 — PIXEL-ACTOR LANDED — the qwen→pixelizer asset pipeline as
  one call. `pixel-actor.js` `bakeActor({dir, decode, files, grid,
  budget, groups})` → quantized base + diff-extracted cel groups (shared
  boxes, blanks, base-relative placement cells) + sha256 provenance +
  changed-ratio health, with a drift ceiling that refuses non-meru-locked
  pairs loudly instead of smearing a giant cel. One design flaw caught by
  a synthetic test before it bit a real actor: pinning variants to the
  BASE's palette silently snaps away colors only a variant introduces (a
  tongue, a glow) — fixed with `jointPalette` (quantize.js): ONE
  median-cut over base + all variants, pinned everywhere. The economics
  now stated as invariant: one base render + one edit render per
  expression state buys an actor; every minute of animation after that
  costs zero renders — the worker supplies STATES, the track grammar
  supplies TIME. The quantize spike is now a thin bakeActor caller
  (3 blinks + two speech bursts on the quantized Hana). Next rungs for
  the pipeline: region masks on diffRasters (the mouth-open variant also
  moved the eyes — expression crosstalk), background knockout, and a
  request-side catalyst that asks the worker for base + variant sets in
  one deliberate batch.
- 2026-07-24 — THE QUANTIZER LANDED (P8 taken; posture 2 live) — the
  no-redraw intake for cutscene/demo-tier fidelity. `quantize.js`:
  `buildPalette` (deterministic median-cut, lexicographic tie-breaks, no
  dice), `quantizeRgba` (box-filter to the cell grid + nearest-map;
  pinned-palette mode; background knockout), `diffRasters` (two rasters
  on one grid+palette → minimal-bbox overlay cel + placement offset +
  changed-ratio alignment health), `unionCels` (pad cels onto a shared
  box + matching blank so they ride one sprite track). Dependency-free —
  raw RGBA in, validateRaster-compatible rasters out; PNG decoding stays
  with the caller (sharp, already in deps). Proven against the REAL
  worker renders (data/outcomes/sk_bd626zr5b3): the painted Hana's face
  crop quantized to an 88×88, 15-color portrait that keeps her likeness
  outright, and the meru-locked blink/mouth variants diff-extracted into
  sub-cels driving the standard blink chart + speech flaps — a living
  portrait minted from PNGs by pure functions, recipe JSON carrying
  sha256 provenance per source. 9 unit tests + the gen spike green.
  Known refinements queued: background knockout for seamless placement,
  post-quantization cel passes (auto-outline/ramp-merge), per-region
  palettes for the >15-color villain-portrait register, grid-snap for
  fake-pixel diffusion output.
- 2026-07-24 — HANA CLOSEUP LANDED — the animeness test, passed: Hana at
  dialogue-portrait resolution (the era's own close-up register — the
  RPG talking bust), face ~4× the full-body sprite's. The anime
  signifiers become authorable exactly at this scale: thick lash lines,
  two-tone warm-brown iris with white highlights, the lid-shadow half
  blink, dithered blush, the closed-∪ smile eye (the warm beat), speech
  flaps with a tongue-hint open mouth. New authoring posture proven: the
  head is built by a deterministic PAINTER (pure module-load code —
  ellipse skull + side-lock rects + face ellipse + derived cel passes:
  under-fringe shadow, lock-rim shadow, auto-outline silhouette = cel
  lineart for free), while the identity-carrying fringe and the whole
  eye/mouth sub-cel bank stay hand-drawn. Generated-vs-authored has a
  grain: curves and outlines generate well; identity shapes don't
  (generated shine crescents left phantom bands — hand arcs replaced
  them). One accidental gift: the auto-outline's convex-tip nub reads as
  an ahoge. 3 probe tests — 71 green.
- 2026-07-24 — HANA WAVE LANDED — the actual "pilot wave" (sk_bd626zr5b3
  "Hana — hangar wave", the Qwen local worker's first minted
  keyframe-animation), transposed from the painted-cel register to the
  sovereign one, and the first REAL pixel-from-dream run: the worker's
  painted Hana is the dream, `hana-wave.recipe.js` is the re-authoring
  (a 40×84 base at 13 of the 15-color budget — graphite suit, orange
  piping + harness, silver pauldrons/shin plates, black gloves, the bob).
  The source manifest's channels map one-to-one onto tracks: 6 keys on
  twos @12fps ×3 cycles → a 6-entry arm-cel key sequence at 4-frame
  steps (24f/cycle); blink{meanGapSec:2.2} → BLINK charts ~2.2s apart;
  speech{spans, flapsPerSec:8} → mouth sub-cel keys every 3 frames
  inside each span. Sub-cel economy throughout: the body never redraws;
  right arm (rest/raise/3 wave cels with a shared L-shaped
  forearm+upper-arm block), eyes, and mouth are overlays. Three visual
  iterations, all instructive: (1) a right arm accidentally authored
  into the base gave the overlay a third limb; (2) shallow-diagonal
  raised arm read as a blade — a waving arm needs a sharp L (horizontal
  upper arm, strictly vertical forearm); (3) hands are gloves, not skin
  — the character sheet is the costume authority. 4 channel-probe tests
  (wave/speech/blink pixels) — 68 green.
- 2026-07-24 — PILOT WAVE LANDED, and with it PALETTE CYCLING (the last
  open P6 palette-track item; fourth instance of animation-as-grammar).
  Grammar: a `palette` track prop on placements with `range: [start, len]`
  — the era's color-rotation on a span of palette RAM; multiple range
  tracks compose on one placement; rotation values ride the existing
  cycle/keys machinery (step, no lerp). The transposition is the
  double-slit ripple tank (views/science/double-slit-view.js — the
  "pilot wave" reading: particles guided by their interference field):
  cos(k·r1−ωt)+cos(k·r2−ωt) factors into a STATIC envelope × a TRAVELING
  carrier, so the fringe fan is authored once into a generated 200×120
  12-color raster (bright band / dim band / transparent nodal lines) and
  the propagation is two synchronized palette rotations — the raster
  never changes between frames, byte-provably: svg(t) === svg(t+12) over
  the carrier period while adjacent frames differ. Plane wave floods the
  slits, two guided particles ride keyframed trajectories to the screen,
  23 hits accumulate on fringe maxima (golden-stagger arithmetic, no
  dice), typewriter readout. One visual iteration: captions were
  illegible over the cycling plane-wave stripes → dark header band carved
  into the field raster. 9 new tests (cycle-rotation fixture, range/offset
  refusals, carrier periodicity, hit accumulation) — 64 green.
- 2026-07-24 — QUIET CALL LANDED: the anime limited-animation economy as
  track grammar, and the settled answer to "ride the image-outcomes
  keyframe-animation capability or not." Different beasts, same
  decomposition: KIND_KEYFRAME_ANIMATION paints cels by diffusion (bound
  renders, identity by conditioning, a generation per cel); its base-cel +
  face-sub-cel split is the anime industry's own declarative economy, and
  THAT ports to the sovereign side. `quiet-call.recipe.js`: one authored
  32×48 bust (8 colors, never redrawn), 10×4 eye sub-cels
  (open/half/closed) and 6×3 mouth sub-cels (closed/small/open) as
  separate placements swapped by step-hold keys — a blink is a 4-key
  timing chart (`BLINK(at)`), phone talk is mouth flaps in bursts with
  listening pauses, the phone buzz is a 2px cell-jitter track with a
  blinking notification spark. Two scenes, 384 frames, zero captions (the
  quiet is the point), night-room tile bank + moon + twinkle cycles. Two
  visual iterations: (1) room-map row one tile wider than the frame +
  polka-dot tile accents too regular + phone invisible against the frame
  color; (2) the buzz track's key values still carried the phone's old
  resting cell — a track override beats the placement cell from frame 0,
  caught by the eyes, now pinned by a probe test. 4 recipe tests among
  the 23 cutscene tests green.
- 2026-07-24 — PIXEL DAWN LANDED (pulls P6's 16-bit register and P7's
  cutscene tier + player forward). `cutscene.js`: register-tiered raster
  budgets ('16bit' = 15+transparent, chars `1-9a-f`), shared tile banks,
  parallax layers ([num,den] rationals + origin/scroll), timeline keyframe
  tracks (integer-floor lerp for cell/scroll/level/reveal, step-hold for
  sprite/facing; P0 cycle tracks kept, gaining `every`), '@camera' /
  '@fade' / '@layer:' targets, font glyph banks + caption typewriter,
  the stepped fade (level 0..8 toward a track color — palette math, third
  animation-as-grammar instance), and the canvas player with scrub/step —
  the engine is ONE closure (`createCutsceneEngine`) serialized verbatim
  into the player HTML, so module and player cannot drift.
  `pixel-dawn.recipe.js` proves all of it at intro scale: 4 scenes, 576
  frames @24fps, no frame authored — fade-in studio card typewriter → 10s
  parallax dawn pan (sky-locked gradient + [1,4]/[1,2]/[1,1] silhouette
  planes, 6-color-ramp sun as the 16-bit budget proof — the same recipe
  refuses to mint under '8bit') with the 8-bit platformer hero walking
  through unchanged (vocabulary rides between registers) → white-flash
  title card over a star field → credits scrolled AS a camera-y move →
  fade out. `font-3x5.js` is the first text-as-tiles bank. 19 unit tests
  green first run, including exact camera-lerp pixel probes, fixed-vs-
  world placement under the pan, typewriter reveal counts, and level-8
  fade exactness (the flash frame is uniform white by palette math).
  Known gap: placements always paint over layers (the sun can't sit
  behind a ridge) — P1's depth-band note now has its forcing case.

- 2026-07-24 — DOCTOR PILL AUDIO: sound through the REAL beats family, no
  parallel grammar. `doctor-pill-beats.js` holds two beats manifests that
  pass `validateBeatsManifest` in the unit suite: a beats-ambient theme
  ("Bedside Manner" — celesta sparkle melody over a doo-wop I–vi–IV–V,
  tuba oom-pah roots, pad bed, brushed-hat pulse, bpm 116 swing 0.16 seed
  77) and a beats-sfx cue set (move/rotate/lock/clear/win/lose as gesture
  lists). The bundle inlines `buildBeatsKernel.toString()` + PATCHES — the
  beats-player discipline verbatim — and the shell fires cues by DIFFING
  states (grid changed → lock; viruses dropped → clear; won/over
  transitions → jingle/womp + transport stop): audio reads sim state and
  never writes back; the reducer knows nothing about sound. Music starts
  on first keypress (autoplay policy), 'm' mutes. 101 tests green.
- 2026-07-24 — DOCTOR PILL: the raster/overlay split proven as a game.
  A Dr. Mario-like where the doctrine "raster = world, overlay =
  communication" is load-bearing: the raster carries ONLY the bottle,
  viruses, capsules, and the diegetic next-pill (not one glyph tile in the
  bank — asserted by test); score/virus/level and the win/lose interruption
  resolve through `resolveOverlay(state)` — a pure view-model — rendered as
  REAL text (native resolution, selectable, screen-readable, i18n-ready).
  `doctor-pill-core.js`: pure reducer — seeded match-free virus placement,
  4-orientation capsules with wall nudge, 4-run matches across virus+pill,
  link-orphaning as the cascade mechanism (clearing a half nulls its
  partner's link, which IS what makes it fall — the cascade is the data
  model, not a special case), win/lose, byte-identical replay.
  `doctor-pill-skin.js`: world recipe (8bit register, palette-swapped
  virus/cap tiles — one cells array per shape × three palettes) +
  `emitComposedSvg` baking both layers into one reviewable SVG (crisp
  <text> beside crispEdges raster; the raster alone never contains <text>,
  also asserted). Playable `doctor-pill.html` (31KB): world in one element,
  overlay as styled DOM with role="status" on the interrupt card. 97 tests
  green across the family.
- 2026-07-24 — PRERENDER SEAM (the DKC pipeline recovered). DKC's look was
  pre-rendered 3D — Rare modeled/lit props and downsampled the renders into
  SNES sprites — and mojulo owns both ends natively: polygonizer monomers
  are the modeler, vexar the light rig, the 16bit register the SNES.
  `prerender.js` is the seam: `projectFacesToSvg` (bounds-fit painter camera
  over lit {corners,fill} faces, transparent bg) + `quantizeRgbaToRaster`
  (deterministic median-cut to the register budget, 1-bit alpha at 128,
  full tiebreakers → same input = same sprite bytes). DOCTRINE: this is the
  one LEGAL "pixels from a render" path — the source is mojulo's own pure
  render of a sovereign recipe, so recipe → faces → SVG → downsample →
  cells is deterministic end to end (the diffusion quantizer stays parked
  as posture 2). Spike: lathe barrel + hoops / extrude crate / lathe mast
  with rope rings, vexar studio light, sharp lanczos downsample (the AA IS
  the 1994 downsample), quantized at 40/36/28-px sprite sizes, composed on
  a ship-deck scene (banded sky, sparkle sea, plank lattice with built
  joint rows). One bug found by eyes: lathe tint fell through to the gray
  default (latheToFaces reads opts.tint/spec.fill, not spec.tint) — gray
  barrels, one-line fix. 77 tests green (quantizer determinism/budget/
  alpha, projector determinism, quantized raster passes the 16bit mint
  gate).
- 2026-07-24 — BRICKSTER-16: the register comparison made literal.
  `brickster-skin-16.js` resolves the UNTOUCHED brickster-core state through
  the 16bit register: gem-cut piece tiles (one deterministic bevel function ×
  seven 6-shade ramps, corner glints), a starfield-gradient backdrop lattice
  under the dynamic nametable (layered tiles in a live game frame), a
  1px-seam cell-grid well floor, machined frame, dithered translucent ghost.
  brickster-skin exports FONT/previewRows/pad; core untouched — the diff
  between the two games is 100% skin. Gen writes same-state stills
  (brickster-8bit.svg / brickster-16bit.svg from one replay) and
  `brickster-dual.html` (36KB): one reducer, one state, BOTH skins rendered
  live side-by-side per keystroke — the render seam as a playable
  demonstration. Tests: 16bit live-frame mint gate (fresh/mid/over),
  byte-stable per skin, 8bit ≠ 16bit bytes over identical state.
- 2026-07-24 — 16-BIT REGISTER IN THE CORE + CRIMSON-DUSK SCREEN. The
  register concept from cutscene.js lifted into pixelizer.js itself:
  `register: '8bit' | '16bit'` widens the raster budget (3 → 15 colors +
  transparent, cell chars 1-9a-f) — same names, one grammar, no fork. `tiles`
  now accepts an ordered array of lattices (the SNES's background layers),
  each with its own tileSize/bank/legend; later layers overpaint where
  opaque. Proof artifact: `crimson-dusk.recipe.js`, a detailed static
  256×224 screen — six layers (starfield/dusk ramp with vertically-blended
  dither seams, generated 24×24 sun disc, two generated rim-lit ridges,
  hand-authored forest + ground tiles) under sprite placements (streak
  clouds, birds, 24×32 visored hero, hearts HUD with a derived empty
  variant). Repetition is built by deterministic helpers (solids, dithers,
  ridge builder, circle sun — loops, no dice); character is authored cells.
  One visual iteration: 2×2-block dither rows read as hard stripes →
  replaced with a vertical blend inside the seam tile. 65 tests green
  across the family (budget gate at 15, hex resolution to palette[14],
  layer paint order, scene mint gate + byte-stable render).
- 2026-07-24 — BRICKSTER LANDED: a full playable tetris-like proving the
  doctrine with a player in the loop. Architecture is the PPU split made
  playable: `brickster-core.js` is the game as a pure reducer —
  step(state, action) → state, seeded 7-bag over mulberry32 carried in the
  state, SRS shapes generated from spawn cells + the published JLSTZ/I
  wall-kick tables (y negated for y-down), guideline hold (once per drop),
  clears/scoring/top-out — no DOM, no clock, no Math.random.
  `brickster-skin.js` resolves state to ONE tile lattice (19×22 nametable:
  bevel piece tiles, ghost outline, wall, 5×7 glyph font for
  HOLD/NEXT/SCORE/LINES/LEVEL and GAME OVER); a live game frame passes
  validatePixelRecipe. The gen test naive-bundles the three pure modules +
  a ~30-line imperative shell (keys + gravity timer only) into a
  self-contained `spike-output/brickster.html` (28KB, no deps — open and
  play). 13 tests: SRS rotation generation, wall-kick off the left wall,
  refused rotation returns identical state, 7-bag permutations, wall clamp,
  line clear with stack shift + scoring, hold once-per-drop + swap after
  lock, top-out via hidden-row lock, seed+script → byte-identical state AND
  frame, frame mint-gate, ghost/digit/game-over resolution. Guideline
  spawn nudge (drop one row into view if free) added after the first replay
  frames showed the fresh piece fully hidden.
- 2026-07-24 — Platformer proof LANDED (pulls P1's tile lattice and P4's
  track grammar forward). Grammar: `tiles` (tileSize + bank + legend + char
  rows — the nametable; the map is tile *references*), track props widened to
  the closed set `facing`/`sprite`/`cell` (variant swap must share the base
  sprite's size; cell paths validated in-bounds), background as one rect,
  horizontal run-merged color paths. Vocabulary in `platformer.recipe.js`
  (~8KB total): 8 tiles (ground/brick/?-block/4 pipe/cloud), hero
  stand/walk/jump sharing one authored head, chomper walk-1/walk-2/squashed.
  The stomp is pure track grammar — an 8-frame storyboard where the hero's
  cell track draws the jump arc and the chomper's sprite track swaps to
  squashed on the impact frame; no frame is authored, all 8 derive. 19 unit
  tests green, including grid-level stomp assertions (body gone at f5,
  pancake present where the walk frame was transparent) and cycle closure
  (frame 8 byte-equals frame 0). One test failure during authoring was the
  scene's own physics: the first dome-gone probe sat inside the landing
  hero's footprint — the declarative grid made that diagnosable in one read.
- 2026-07-24 — P0 LANDED. `pixelizer.js` (validate / resolveFrame / emitPixelSvg
  / emitPreviewHtml), `red-robot.recipe.js` (16×16, 3+transparent palette,
  gaze-left pupils as the flip asymmetry), 12 unit tests green (mint gates,
  byte-identical replay, E-frame == exact E-W reflect of W-frame, one merged
  path per color), gen spike writes frames + steps() preview to
  `spike-output/`. One visual iteration was needed: the first face's left
  pupil merged with the helmet's inner outline and the eyes read as a single
  glyph — widened the face window (cheek guards touch skin directly, megaman
  style) and separated the pupils. The dream→see→re-author→discard loop worked
  in miniature: render, look, fix cells, re-mint.

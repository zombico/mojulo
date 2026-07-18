# Storyboard Render — the worker seam extended to the annotated shot sequence

Status: spike (2026-07-11). Files: storyboard-spike/{moves,board,fixture}.js
+ storyboard.spike.gen.test.js, output under
lite-template/integration/0711/spike-output/storyboard/. Built by
COMPOSITION over the shipping image-outcomes module (deliberately — the
shared files were under active parallel development when this spike was
cut): every shot lowers into a plain `image-outcome` and reuses the
shipping normalizer/scaffold/instructions verbatim; nothing in
manifest.js/scaffold.js/instructions.js was touched. Waiting on the first
generation round; the retrospective gates promotion.
Addendum (2026-07-11, operator call): **fidelity + casting dials** —
boards gained two board-level dials, both worker-facing (they render into
every frame brief, not just board chrome):
- `fidelity: thumbnail | working (default) | color-script | concept`
  (fidelity.js, the comic pipeline's dial transposed to the board
  production ladder). Fidelity is a FINISH DISCIPLINE, orthogonal to the
  Style Lock: the preset says what drawing language the production
  speaks, fidelity says how far each frame is taken in it. `concept` is
  the design register: the frame's job is to one-shot the production's
  feel — environment, costume, materials, lighting language — and an
  accepted frame becomes the design reference.
- `casting: locked | explore` (default: locked when characters[] is
  present). `locked` is the comic-pipeline posture — cast bound
  character sheets, "match the reference sheet exactly". `explore`
  inverts it: the cast is a DESIGN BRIEF; the lowered manifests carry no
  characters (the sheet language would be a lie), the board injects its
  own Cast section, and the worker AUTHORS the design on a **design
  plate** first — which is the character-sheet primitive with the
  framing flipped from "reproduce" to "design" (`designPlateManifest`
  builds a real character-sheet manifest from the cast entry), so the
  scaffold layout, neutral-presentation contract, and — post render
  round — `bind_character_sheet` all apply unchanged. An accepted plate
  binds the explored design into the substrate's locked cast: storyboard
  explores → sheet locks → comics/books inherit. Figures may still point
  at cast entries in explore (membership board-validated).
Second fixture (concept-fixture.js, "The Saltglass Orchard — concept
pass"): fidelity concept × casting explore × deliberately NO style preset
(concept exploration is the max-capability path the styles shelf leaves
open); output under spike-output/storyboard/concept/.

## Not a re-litigation of the retired storyboard example

The original image-outcomes spike had a "storyboard" example that was
retired as "superseded by the sequential-art kind" (image-outcomes.plan.md
I0 note). That example was a storyboard-as-drawn-page — panels on a sheet,
which sequential-art genuinely covers. THIS kind is the thing
sequential-art does not model: a **pre-production sequence document with
time semantics** — uniform-aspect frames in shot order, each carrying
timing (seconds), a camera move, subject moves, a transition to the next
shot, and dialogue/sfx bands. A comic page is a final artifact whose
layout IS the art; a storyboard is a working document whose frames are
interchangeable renders and whose annotation layer is the point.

## The idea

- **A shot IS an image-outcome + board metadata.** `shotToImageOutcome`
  lowers each shot (beat → intent, frame → viewBox, shared `characters[]`
  cast, forms, figures minus the board-side `move` field) and the
  shipping machinery does the rest — camera/pose/character/style
  validation, scaffold, per-frame brief. The board adds only: `scene`,
  `cameraMove`, per-figure `move`, `dialogue`, `sfx`, `seconds`,
  `transition` — all deterministic annotation.
- **The model paints frames; the board paints time.** Shot numbers,
  timing, transitions, dialogue/sfx bands, and MOTION ARROWS are drawn by
  the board compositor as deterministic HTML/SVG overlay — the
  overlay-re-imposes-truth rule applied to motion (the pan-cel "mojulo
  paints time" doctrine, at the document level instead of the GIF level).
  Retiming a shot or changing a transition re-renders the board with ZERO
  new generations.
- **Moves are a closed vocabulary** (moves.js — the I2 cameras lesson):
  9 camera moves + 8 subject moves, each carrying an instruction phrase
  (composition consequences only: lead room, headroom, "stage the START
  of the move") and deterministic arrow geometry. Arrows appear ONLY in
  the board overlay — never in the conditioning scaffold (a scaffold
  arrow would get painted; the spike's scaffold-echo failure mode) — and
  briefs carry an explicit no-arrows negative.
- **The annotation invariant** (the lettering rule, extended): dialogue,
  sfx, and timing never reach render instructions. Tested.
- **Identity is the character-sheet primitive, cross-artifact.** The
  fixture casts the SAME Noa sheet as the picture-book spike (imported,
  not redeclared) — one bound sheet conditions book pages AND storyboard
  frames. The HANDOFF tells the worker to reuse the book run's sheet
  render verbatim; that reuse is the `bind_character_sheet` story
  demonstrated across kinds.

## What the spike emits

Stage A — handoff bundle: normalized board manifest, character-sheet
scaffold + brief, six per-shot scaffolds (16:9, arrow-free) + briefs
(bible-free: the board has no book bible; scene truths live in shot
beats), HANDOFF.md. Stage B — the **scaffold-edition board**: frames are
scaffold rasters; arrows, timing chips (`5s · track-right · → match`),
scene dividers, and dialogue/sfx bands overlaid — the whole sequence
reads end-to-end before any generation is spent. Stage C (conditional) —
the **generated-edition board** once `renders/character-sheet.png` +
`renders/frame-<id>.png` land.

Tested invariants: normalize deterministic; every lowered shot validates
through the shipping normalizer and casts the character; closed move
vocabulary rejects freeform moves; dialogue/sfx never in briefs; arrows
never in scaffolds, always in the board; board HTML byte-stable.

## Promotion path (sketch only; re-plan after the render round)

- **P1 — first-class `storyboard/v1` kind** in manifest.js (the
  character-sheet precedent): normalizeStoryboardManifest with the lowering
  built in, moves.js promoted beside cameras/poses, vocab card + routing
  row. Mint via `create_sketch`; `/sketches/<ref>` renders the
  scaffold-edition board.
- **P2 — packet targets = shot ids.** `get_image_render_packet` expands a
  storyboard to one target per shot (the per-panel rule; there is no
  whole-board strategy — the grid is mojulo's), each pull carrying the
  frame scaffold + the cast's bound character sheets.
- **P3 — the board composite as a derived render**: `/api/sketches/<ref>/
  board.html` (or the I5 composite pass) over bound frame renders; the
  scaffold-edition serves until frames are accepted — a board with no
  renders is a complete, reviewable artifact (recipes-not-renders).
- **P4 — the seams this kind was built to meet:**
  - pan-cel: a storyboard shot with a cameraMove is the SPEC for a pan-cel
    motion-outcome (plate + window path derive from move + seconds) — the
    board is the sequence-level plan, pan-cel the per-shot execution;
  - I6 world projection: `compose from world` per shot — storyboard a
    sequence THROUGH an existing world's cameras;
  - forge_motion: an animatic (frames held for `seconds`, cut/dissolve
    transitions) is a deterministic derived render of (board, frames) —
    the cheapest possible motion artifact, zero new generations.

## Out of scope (recorded so they aren't re-litigated)

- Animatic export (the P4 forge_motion seam) — design it after boards are
  routine; it is a composite, not a new generative surface.
- Multi-row shot sizes / aspect mixes (inserts at 4:3 on a 16:9 board) —
  uniform frames until the render round argues otherwise.
- Continuity audits (180-degree rule, screen-direction checks across
  cuts) — the acceptance-audit posture applies; needs the I4 layer first.
- Per-shot lens language (focal length, depth of field) — belongs to the
  camera vocabulary if it ever graduates; not board metadata.

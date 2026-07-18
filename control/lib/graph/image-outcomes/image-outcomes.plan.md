# Image Outcomes — a director layer for external image generation

Status: I0 + I1 built (2026-07-10). I0 — manifest.js/scaffold.js/
instructions.js/fixtures.js + image-outcomes.test.js (17 tests); spike
files deleted; the recipe-city and storyboard spike examples were retired
rather than ported: storyboard is superseded by the sequential-art kind
itself, recipe-city's world-recipe source is I6's seam and returns there.
I1 — kinds validate through validateSketchManifest (own normalizer branch),
mint/update via create_sketch/update_sketch bypassing the diagram pipeline,
render mode 'svg' + bucket 'illustration', stored-sketch-svg dispatches to
renderScaffoldSvg, vocab cards image-outcome.md + sequential-art.md indexed
(reindex run), PICTURE routing row (body-ceiling-lint-sized). Exit proven
live: semantic_search ranked the card first for a manga-page intent;
create_sketch minted the manga fixture (sk_jxubfy2vdj, normalized to
sequential-art/v1 with per-panel default); /svg + /png serve the scaffold.
I2 built (2026-07-10) — cameras.js (six-entry closed vocabulary, each with
instruction phrase + horizonBand + subjectHeightFrac audit dials;
normalizeCamera rejects unknown kinds, omitted camera defaults to
wide-establishing) and poses.js (twelve-entry closed stick-pose vocabulary
as limb-offset data + one generic poseFigure emitter; unknown poses
rejected); instructions render camera/pose phrasings from the entries;
cards updated + reindexed. I3+ not built (I3 gate: operator eyes on the
schema + Codex render-pass contract-notes). Addendum (2026-07-11, operator
call): **rig figures** — a figure may carry `rig: { motion?, phase?, pose?,
proto?, garment?, view?, setup?, note? }`, the protoform rig behind
create_figure rendered via renderFigureToSvg (background:false) and nested
into the scaffold at the same {x, y, scale} anchor as a stick figure
(mid-torso anchor, 200·scale height). Poses come from the substrate's
authored MOTION vocabulary first — `motion` ('walk'/'wave'/'stretch' or a
gait/keyframe spec) sampled at `phase` via the new
figure-render.sampleMotionPose export (the still-frame door into the same
choreographies create_figure animates) — with raw per-joint `pose` DOF
composing on top (explicit keys override the sample). image-outcome gained
optional `figures[]` for the same staging. The stick vocabulary remains
the default control layer; this partially supersedes the out-of-scope
bullet below.
Addendum (2026-07-11, operator call): **style presets** — styles.js is the
third closed vocabulary (beside cameras/poses): `renderBrief.preset` +
`renderBrief.dials` lock a drawing DISCIPLINE so composition doesn't ride
the model's over-rendered freeform default (which stays available by
omitting the preset — that's the deliberate max-capability path). Three
presets: `gpen-shonen` (G-pen ink + screentones; dial
`stylization` ∈ [0,1] between a realism pole and a stylized expressive
big-head pole, phrased by band; dial `palette`: ink-color default |
bw-tones — classic black-and-white manga, midtones as screentone/hatching
only), `shojo-soft` (gpen-shonen's shojo-register sibling, added
2026-07-11 — fine maru-pen line, eyes/hair/mouth as the expressive
instruments, elongated elegance; dial `ornament` ∈ [0,1] restrained ↔
full efflorescence, plus the shared `palette` dial), `crosshatch`
(added 2026-07-11 — 16th-century European old-master ink: all value from
hatch/cross-hatch line systems following the form, paper white the only
white; dials `technique` pen|engraving|woodcut, `density` ∈ [0,1] airy ↔
densely worked plate, `ink` black|sepia), `ukiyo-e` (added 2026-07-11 —
Edo woodblock print: flat registered color planes in a carved keyblock
contour, bokashi as the one sanctioned gradient, pattern-for-texture;
dials `palette` nishiki|aizuri|sumi, `weathering` ∈ [0,1] fresh ↔ aged
print), `louvrijks` (added 2026-07-11 — old-master oil, Dutch Golden Age
+ Italian Renaissance; the one deliberately PAINTERLY preset: bans the
modern photographic layer — HDR/bloom/bokeh/lens optics/plastic 3D sheen
— instead of banning paint; dials `school` dutch|italian, `drama` ∈ [0,1]
soft daylight ↔ deep tenebrism, `patina` ∈ [0,1] fresh ↔ aged museum
surface), `tv-cartoon` (added 2026-07-11 — 80s TV cel animation codified
as page style, not motion: outlined cel-flat two-tone characters over
softer painted no-outline backgrounds — the invariant is outline
separation; saturated broadcast palette; animation-budget fidelity as the
rule of the primitive; modern finishing allowed on top; dial `register`
∈ [0,1] sitcom-family ↔ mutant-hero), `silver-age` (added 2026-07-11 —
the Western cousin of the manga pair: brush-and-nib ink under limited
four-color flats; deliberately looser lock than tv-cartoon; dials
`register` ∈ [0,1] romance ↔ pulp-hero, `print` ∈ [0,1] crisp press ↔
aged newsprint. Re-tuned plainer after first renders read too muscular
and over-filtered (operator, 2026-07-11): mid register is now an
everyday plain-clothes band, Ben-Day demoted to a subtle
where-needed accent, print default 0.5→0.3, and a blanket
halftone/grain/aging-filter negative added), `antiquity` (added 2026-07-11 —
the image as ancient-world artifact: period pigments + conventions,
depth by registers/overlap/scale, glyph-like marks decorative and
non-legible; dials `tradition` egyptian|cave|greco-roman, `surface`
∈ [0,1] fresh commission ↔ weathered ruin), `ink-brush` (added
2026-07-11 — East Asian brush painting: loaded-brush strokes on
absorbent paper, ink tone from water, emptiness as composition,
wet-into-wet + flying-white edges; dials `register` ∈ [0,1] sumi-e ↔
ink-wash, `tint` none|pale literati mineral tints), `art-nouveau` (added
2026-07-11 — whiplash organic line, flat decorative color in firm
contour, ornament as structure, muted floral palette; dials `medium`
∈ [0,1] Mucha lithograph illustration ↔ stained glass-pane with heavy
leading, `gilding` none|gold), `photo-realism` (added 2026-07-11 — the
max-fidelity register made deliberate: opts INTO what the shelf tunes
away from; dial `medium` ∈ [0,1] photograph — real optics, captured-not-
made ↔ 3d-engine — clearly-CG AAA renderer polish; commits to one
register, no half-photo half-CG mix), `hard-boiled`
(classical pulp noir black
and white, shadows as shapes; dial `tone`: none|red|yellow|blue single
spot color), `steamboat` (rubber-hose classical cartoon — noodle-cylinder
bodies, simple dot/pie-cut eyes, transformative squash-and-stretch
expressions; no dials). The recipe stores preset + dial values only;
phrasing derives at instruction time as a "## Style Lock" section, preset
negatives merge into the Avoid list, preset style/mood/lighting fill brief
defaults (explicit fields override). Unknown presets/dials/values rejected
at mint. Cards updated (+ style-framed `when` rows) and reindexed.
Addendum (2026-07-11, operator call): **I3 read half built** —
`get_image_render_packet({ ref, target? })` (sketches.js tools) is the
worker-facing pull surface: targets expanded from `renderStrategy`
(page / per-panel / hybrid page-then-panels), per-target render
instructions (Style Lock included), the normalized manifest, and scaffold
URLs — `/api/sketches/<ref>/svg|png` grew `?panel=<id>` crops (threaded
through renderStoredSketchSvg / rasterizeSketchToPng; SVG-path kinds
only). Read-only and stateless by design: the DURABLE half of I3
(`image_render_requests` rows, `pull_agent_task` kind branch,
`submit_image_render`, the worker catalyst) stays gated on operator
review — until it lands the worker returns the PNG out of band and the
I4 bind/audit layer is still unbuilt. Lettering-never-in-packet covered
by handler tests (sketches.test.js). First live Codex pull surfaced a
THIRD failure mode (after geometry drift and bubble-painting): the worker
returned the scaffold itself — the wireframe — as the finished artifact,
never invoking its image generator. Countermeasure, both layers: every
brief opens with a WORKER_PIPELINE block (instructions.js — "INVOKE YOUR
IMAGE-GENERATION CAPABILITY… the scaffold is INPUT, never the
deliverable; wireframe output = traced, not generated → discard and
regenerate"), and the packet response carries a numbered `workerProtocol`
(fetch scaffold → invoke generator conditioned on it → verify no scaffold
graphic language survives → return the GENERATED raster → repeat per
remaining target). This is prompt-side defense; the I4 acceptance audit
remains the real gate (a scaffold-echo render must fail `panel_beats`).
Addendum (2026-07-11, operator call): **character reference sheets** —
the identity-persistence slice, comic-first (partially un-defers the
last out-of-scope bullet). `sequential-art` gained `characters: [{ id,
name?, description, outfits[], rig? }]` as identity METADATA; panel
figures bind via `character` + `outfit` (membership validated at mint).
`buildCharacterSheetInstructions(manifest, id)` emits a per-character
sheet brief: neutral-light model-sheet turnaround (front/¾/side/back,
common ground line — the pan-cel model-sheet-strip pattern in comic
form), one row per outfit, page Style Lock applied, no-text rule.
`get_image_render_packet` returns `characterSheets[]` and prepends a
step 0 to workerProtocol: generate sheets FIRST, condition every panel
on its characters' sheets, return sheets with the panels. Works within a
single worker run with no bind seam — the worker holds its own sheets.
When I3-durable/I4 land, accepted sheet renders become stored conditioning
references served in the pull payload (and rig-backed cardinal-projection
sheet scaffolds are the natural upgrade).
Addendum (2026-07-11, operator call): **characters as reusable
primitives** — the stored-conditioning-reference future arrived early,
scoped to sheets. New sketch kind `character-sheet` (character-sheet/v1):
one inline character + neutral sheet brief; scaffold renders the
turnaround-strip layout itself (4 labeled view columns × one row per
outfit, stick or rig placeholders on ground lines — the layout IS the
instruction). Minted via create_sketch, rendered via
get_image_render_packet (targets ['page']), and the generated PNG is
saved back with the new `bind_character_sheet { ref, image_path |
image_base64 }` tool — append-only snapshots in
`data/outcomes/<ref>/sheet-<n>.png` (sheet-store.js; the I3 outcome
folder pattern, to be absorbed by I4's render sidecar table), latest
served at `/api/sketches/<ref>/sheet.png`. Comics cast a stored character
with `characters: [{ ref }]` — create/update_sketch inline the sheet's
character block (resolveCharacterRefs, tool layer, so manifest.js stays
pure; ref kept for provenance) and the render packet serves the bound PNG
as `characterSheets[].boundSheet` with step 0 flipped to "fetch, don't
regenerate". Identity now persists across pages, scenes, and artifacts
through one stored image.
Addendum (2026-07-11, operator call): **page recipes ported from the
deterministic comic pipeline** — "make manga" must land on the generative
comic tool with the layout brains included. New page-recipes.js: a
vocabulary over depiction-layout.js's panel-blocking paradigms
(`manga-high-eye-control`, `sunday-comic`,
`american-comic-widescreen-panels`, `monoculous`, `comic-page`), each
with eye-line phrasing + default reading flow (manga → RTL).
`layoutPanelBounds` is now exported from the polygonizer so BOTH comic
paths share one source of panel-blocking math. sequential-art panels may
omit `bounds` when `pageRecipe` names a paradigm (auto-laid in panel
order, pad/gap scaled to the viewBox; off-ideal counts fall back to the
comic grid; explicit bounds/readingFlow always win; freeform recipe
labels stay legal for hand-bounded pages, but boundless panels under an
unknown recipe are rejected with the paradigm list). Eye-line renders
into the page brief. Cards updated both ways: panel-depiction-recipes
now routes AI-painted comic/manga intents to sequential-art; the
deterministic manga machinery (manga-cel renderer, comic cook outcome)
deliberately NOT folded in — two render paths, one grammar; convergence
happens at the publication layer once I5 composites exist (a
sequential-art final.png becomes a comic-cook page).
Addendum (2026-07-11, operator call): **I5 built (minimal) + page-render
submit + publication convergence** — imagegen now flows into every comic
format. (a) `bind_image_render { ref, target, image_path|image_base64 }`
(sketches.js) is the page/panel submit half: append-only
`data/outcomes/<ref>/render-<target>-<n>.png` via render-store.js;
`renderTargets()` (manifest.js) is the single expansion rule shared by
packet, bind, and composite. (b) final-page.js is the I5 composite:
`final = bound renders + manifest-derived overlay` (panel renders fitted
into bounds on a paper-white page — or over the whole-page/hybrid base —
then borders, bubbles, and LETTERING as the only place bubble text
becomes pixels); served at `/api/sketches/<ref>/final.png` (404 lists
missing targets); the I5 exit criterion holds in tests — a
lettering-only edit changes final.png without touching the generative
layer. No audit gate yet (I4's two-layer audit remains future; binding
is acceptance for now). (c) Publication convergence: resolveSketchItem
gained `preferFinalRender` + image-outcomes dispatch (scaffold via
renderStoredSketchSvg — previously these kinds would have hit the
diagram renderer); the comic cook publishes a bound page as
`page-NNN.png` and an unbound one as its scaffold SVG (the nēmu),
end-to-end tested through cookHandler with format 'manga-tankobon'. So:
mint sequential-art pages → worker generates + binds per target → finals
composite → gather + cook → AI-painted pages in all four comic formats
(and webtoon/RTL come free — format is orthogonal to art source).
Addendum (2026-07-11, picture-book adoption): **`characters[]` extended
to `image-outcome`** — a single directed shot casts characters exactly
like a sequential-art page (a picture-book page is one shot casting a
recurring character; see picture-book-render.plan.md). Same
normalizeCharacter block + duplicate check (shared `normalizeCharacters`
helper), same figure `character`/`outfit` binding validation; single-shot
briefs gain the Characters section ("condition every shot"),
`buildCharacterSheetInstructions` accepts image-outcome manifests, and
`resolveCharacterRefs` + the render packet's `characterSheets`/step-0
cover the kind for free (they key on `manifest.characters`).
Reviewed by the Codex agent 2026-07-10;
all six findings accepted and integrated (mint via create_sketch not
create_view; staged-file submit path; renderStrategy whole-page/per-panel/
hybrid with per-panel default for sequential-art; per-panel crops + paths/
URLs in the pull payload; worker_audit vs acceptance_audit split).
This plan formalizes the image-outcomes
spike of 2026-07-10 (Codex/GPT agent: `agent-render-packet.js`,
`sequential-art-packet.js`, `examples.js`, two on-demand `.spike.gen.test.js`
bundles) into a substrate primitive family. The spike ran one real
generation (the Manga Signal Page rendered by ChatGPT image capability);
its retrospective is doctrine input and is quoted where it decided
something. Written by Claude; contract sections (I3, I4) are explicitly
flagged for review by the Codex agent, which will serve as the first
render worker.

## What the spike taught

1. **Mojulo primitives are already enough to act as a director layer.**
   Panels, per-panel camera, pose silhouettes, protected blank zones, and
   depth-ranked forms steered the generated page's *beats* correctly even
   where exact geometry drifted. A page grammar beats a plain prompt.
2. **Prompt-only generation is not strict enough for exact geometry.**
   The generated image respected "sequential page with distinct beats" but
   drifted from exact panel bounds and crops. Two consequences, both
   load-bearing below: (a) the scaffold image itself must be fed into
   generation/editing, not just described; (b) whatever mojulo can
   re-impose after the fact, it should — don't spend prompt strictness on
   things a composite pass can overlay.
3. **Blank bubble zones must stay mojulo-owned end to end.** The model
   still treats bubbles as visual objects. Robust design: image gen paints
   *under* the bubbles; mojulo composites final bubbles/captions/borders
   afterward as SVG. Text never enters the generative layer.
4. **Pose silhouettes are enough to steer action.** The stick-figure
   stand/reach/crouch poses carried the intended beats. The control layer
   does NOT need the protoform figure rig — a small closed pose vocabulary
   suffices. (The full figure stays available later as an optional
   higher-fidelity pose source; off the critical path by design.)
5. **Camera primitives are the missing precision dial.** `camera.kind` as
   a freeform string is read as vibes. Cameras must graduate to a closed
   vocabulary carrying crop box + horizon/vanishing constraints — which is
   also the seam a future world-projection feature plugs into.
6. **The division of labor is settled.** Mojulo owns: panels, gutters,
   camera, pose, protected zones, text, bubbles, final borders. Image gen
   owns: ink, light, texture, mood, costume, environmental detail.

## Doctrine (decided)

- **Recipes not renders — kept, not violated.** The packet (a sketches-row
  manifest) is the tiny deterministic recipe. The scaffold SVG/PNG is a
  deterministic derived render of it (same manifest → same bytes, the
  scene-png pattern). The generated PNG is the one *externally-authored*
  artifact in the substrate: it is never the source of truth, never edited
  in place, and never required — a packet with no bound render is a
  complete, listable, re-renderable artifact.
- **The final page is deterministic again.** `final = generated.png +
  SVG overlay derived from the manifest` (borders, gutters, bubbles,
  lettering). Given (manifest, accepted render), the composite is
  byte-stable — the beats muted-capture guarantee, transposed. Drift in
  the generative layer is forgiven wherever the overlay re-imposes truth.
- **Timeless manifests.** The spike stamped `new Date().toISOString()`
  into its manifest output; the primitive must not. Timestamps belong to
  render/bind events (sidecar rows), never to the recipe.
- **The renderer is a pluggable worker, not a build-time dependency.**
  Nothing in the primitive requires image capability; the image-capable
  agent (Codex first) serves renders at runtime through a pull/submit
  seam. A foreign agent completing the loop cold is the validation that
  the contract is self-routing.
- **Audit gates binding.** A submitted render is not the sketch's accepted
  render until an audit is recorded — the game-paradigm posture
  ("refused until proven completable") applied to composition fidelity.
  The audit surface is deliberately small: only what the overlay CANNOT
  re-impose (pose beats, occlusion order, strict-form placement,
  bubble-zone paintability).
- **Rows stay in `sketches`; sovereignty is the domain layer** (the beats
  B9 pattern). Renders/audits ride a sidecar table keyed by ref, not a new
  artifact table.
- **No readable text from the generative layer, ever.** Negative-prompted
  AND overlaid: lettering is a mojulo SVG layer in the composite.

## Kinds

Two manifest kinds, one module family in `control/lib/graph/image-outcomes/`:

- `image-outcome` — a single shot. Manifest: viewBox, camera (I2
  primitive), horizonY, vanishingPoint, depth-ranked `forms[]` (polygon,
  role, depthBand, depthRank, preserve: strict|guided|loose, materialHint,
  notes), protectedZones, overlayZones, renderBrief (style, mood,
  lighting, mustPreserve, mayInvent, negative).
- `sequential-art` — a page. Manifest: pageRecipe, readingFlow, viewBox,
  `renderStrategy: 'per-panel' | 'whole-page' | 'hybrid'` (default
  **per-panel** — Codex review: whole-page generation keeps drifting panel
  geometry; per-panel generation + deterministic page composite is the
  stronger production shape. whole-page remains for color-script cohesion;
  hybrid = whole-page pass for palette + per-panel passes for fidelity),
  `panels[]` (bounds, beat, camera, figures[] with pose vocab entries,
  forms[], bubbleZones[] with bubble kind + optional lettering), shared
  renderBrief. Bubble `lettering` (text, when present) is used ONLY by the
  composite pass — it never reaches render instructions. Render
  instructions state explicitly that the generated layer is **art only**:
  no panel borders, no bubbles, no text — the overlay owns all of those.

Contract version bumps to `image-outcome/v1` and `sequential-art/v1`
(the spike's `*-agent-render/v0` strings retire with the spike files).

## Phases

### I0 — promote the spike to a manifest-first module

Restructure `image-outcomes/` so everything is a pure function of a
manifest: `normalize + validate` (from the spike's `createAgentRenderPacket`
/ `mangaSignalPagePacket`, generalized to accept caller manifests),
`renderScaffoldSvg(manifest)`, `buildRenderInstructions(manifest)`. Delete
the file-writing outcome writers (`writeAgentRenderOutcome`,
`writeSequentialArtOutcome`) and the `generatedAt` stamp; the spike tests
become unit tests over the pure functions (no `spike-output` writes).
`examples.js` shrinks to fixtures for tests + vocab worked examples.

Exit: `node --check` clean; unit tests assert same-manifest → same-SVG
bytes; no `new Date`/`Math.random` anywhere in the module.

### I1 — mint path + surfaces

- **`create_sketch` manifest kinds** `image-outcome` and `sequential-art`
  (validated in `validateSketchManifest` alongside the other sketch kinds
  → `SketchRepository.create`, refs `sk_*`), returning `/sketches/<ref>`.
  NOT `create_view` — Codex review, accepted: views mean live
  science/math/world study objects; durable visual manifests rendered as
  scaffolds are sketch grammar. `update_sketch` teaches on the kinds
  (full-manifest replace through the same validation gate).
- `/sketches/<ref>` render mode: scaffold SVG live-rendered from the
  manifest; when a bound render exists, scaffold / generated / final
  composite side by side (the spike's `index.html`, promoted to the page).
- Scaffold PNG rides the `data/scene-png/<ref>-<hash>.png` derived-cache
  pattern for the pull payload (I3) and page thumbnails.
- Vocab cards `image-outcome.md` + `sequential-art.md` in the sketch-vocab
  folder (preserve-level gradient, mustPreserve/mayInvent/negative grammar,
  blank-bubble rule, worked examples from `examples.js`), indexed under
  `sketch_vocab`. `TOOL_INDEX`/`ROUTING_INDEX` rows for the new main-flow
  tools; routing rows only — orientation depth stays behind the vocab
  drawer (forward_context stays thin).

Exit: an agent can `semantic_search` → find the kind → mint via
`create_sketch` → open `/sketches/<ref>` and see the scaffold, with no
in-context knowledge beyond the cards.

### I2 — camera + pose graduate to closed vocabularies

- `cameras.js`: a closed camera vocabulary — `wide-establishing`,
  `insert-close-up`, `low-angle-hero`, `over-shoulder`, `close-up`,
  `wide-cinematic` (extensible) — each entry carrying `cropBox`,
  horizon/vanishing constraints, and an instruction phrasing. Validation
  rejects unknown camera kinds; instructions render from the entry, not
  from a freeform string. Aligns with the polygonizer two-point camera
  primitive's fields (vanishingPoints, horizonY, cropBox) so a world
  camera can lower into it later (I6).
- `poses.js`: a closed stick-pose vocabulary (~a dozen: stand, reach,
  crouch, point, run, fall, sit, embrace, …) — each a pure
  `poseFigure(entry, {x, y, scale})` emitter (generalizing the spike's
  three) plus a one-line beat phrasing for instructions.
- Both vocabularies documented on the I1 cards.

Exit: the manga fixture re-expressed entirely in vocabulary entries;
validation rejects a freeform camera; audit checks (I4) can reference
camera cropBox and pose entries by name.

### I3 — the handoff: `image_render` on the agent-tasks surface
**(contract section — Codex review requested)**

Keep the Ring 7 pull/submit *conventions*; back the kind with **durable
rows, not parked promises**. The in-memory queue's shape (park a typed
HTTP request, resolve within a ~60s submit timeout, drop everything on
restart) fits inference relays; an image render takes minutes, nothing
HTTP-blocks on it, and a pending render must survive a control-plane
restart. So:

- `image_render_requests` table (migration in db/index.js): `id, ref,
  target ('page' | panel id), manifest_rev_hash, status
  (pending|in_flight|submitted|expired|cancelled), pulled_at, created_at`.
- `request_image_render({ ref })` — parks durable request(s) for a minted
  image-outcome/sequential-art ref, expanded by the manifest's
  `renderStrategy`: whole-page (and every image-outcome) parks one `page`
  request; per-panel parks **one request per panel** (each panel is its
  own pull/render/submit unit); hybrid parks the page request first, then
  panel requests. Idempotent per (ref, target, head manifest).
- `pull_agent_task({ kinds: ['image_render'] })` — the existing tool grows
  a durable-kind branch. The payload is deliberately redundant across
  harness capabilities (Codex review: some harnesses can route MCP image
  blocks into generation, some can only take file paths or URLs):
  - packet manifest JSON + render instructions as text content;
  - the scaffold as a **native image content block** — the page scaffold
    for `page` targets, the panel-crop scaffold for panel targets
    (scaffold-conditioned generation is the spike's main quality lesson);
  - for sequential-art panel targets, the whole-page scaffold ALSO rides
    along (as a second image block + path/URL) — the page teaches layout
    and continuity, the crop teaches the local shot;
  - **staged file paths + control-plane URLs** for every image above
    (`data/scene-png/` cache paths and `/api/sketches/<ref>/...` URLs),
    so a local worker can read from disk and a remote one can fetch.
  Manifest names `submit_tool: 'submit_image_render'` and carries `target`.
- `submit_image_render({ request_id, image_path | image_base64, audit })`
  — **exactly one** image source (Codex review: its image harness writes
  PNGs to local disk, so `image_path` is the primary path for a same-host
  worker; `image_base64` stays as the remote/foreign-agent fallback).
  Validates the worker audit against the I4 schema at the wire (per-kind
  submit tool with embedded inputSchema, the Ring 7 pattern), copies the
  PNG into `data/outcomes/<ref>/renders/<n>/generated.png` + `audit.json`
  (cook-publication folder pattern; `n` = sidecar rowid; the submitted
  `image_path` is read once and copied — the outcomes folder is the only
  durable home), records the render row (I4), marks the request submitted.
- `cancel_agent_task` works unchanged (kind-agnostic).
- Worker catalyst `image-render-worker.md` (catalysts folder, JSON
  frontmatter): the pull → generate-with-scaffold-conditioning →
  self-audit → submit loop, written for a foreign agent reading it cold —
  including the art-only rule (no borders/bubbles/text in the generated
  layer) and the per-panel loop shape.

The I3 contract questions were answered by the Codex review and are
folded in above: (a) staged `image_path` primary, base64 fallback;
(b) per-panel crops yes for sequential-art, single scaffold fine for
image-outcome; (c) instructions gained `renderStrategy` and the explicit
art-layer-only rule.

Exit: with the MCP exposed to it, the Codex agent pulls a real request,
renders, submits — packet-to-bound-PNG with zero human file copying, and
a pending request survives a `npm run dev` restart.

### I4 — bind + audit gate (the sovereignty layer)

- `image_outcome_renders` sidecar table: `ref, n, target, manifest_rev_hash,
  file_path, worker_audit_json, acceptance_audit_json, source
  (model/harness id), conditioned (scaffold|prompt-only), status
  (submitted|accepted|rejected), created_at`. Repository beside the beats
  repos.
- **Two audit layers, never conflated** (Codex review, accepted: a render
  must not become accepted solely because the same worker said it
  passed): `worker_audit` is what the render worker claims at submit
  (required, wire-validated); `acceptance_audit` is what the accepting
  agent/operator verifies at accept time (required to accept — v1 may be
  a visual read, but it is recorded separately with its own author).
- Audit schema (both layers share it): per-check verdicts for exactly the
  non-overlayable surface — `panel_beats` (per panel: does the painted
  content carry the beat + pose?), `strict_forms` (per strict form:
  placement within tolerance?), `occlusion_order`, `bubble_zones_paintable`
  (nothing load-bearing painted where the overlay will sit), plus
  free-text `drift_notes`. `conditioned` is recorded because prompt-only
  vs scaffold-conditioned is the main quality dial.
- `accept_image_render({ ref, n, audit })` / reject — operator-agent call
  supplying the acceptance audit; the accepted render is what the page
  and the composite (I5) use. Acceptance is refused if any per-check
  verdict in EITHER layer is `fail` (override flag exists, recorded as
  such). A deterministic check (edge-density sampling along strict
  polygon boundaries) is a natural v2, out of scope here. Per-panel
  strategy accepts per target — a page composites (I5) only when every
  panel target has an accepted render.
- `get_sketch`-path reads and the `/sketches/<ref>` page surface render
  history (submitted/accepted/rejected, drift notes).

Exit: a render with a failed `strict_forms` check cannot be accepted
without the explicit override; the page shows the accepted render; a
second submit against the same ref appends `n+1` rather than overwriting.

### I5 — the composite pass (final page, deterministic again)

- `compositeFinalPage(manifest, acceptedRenders)` — pure. Under
  `whole-page`: rasterizes the SVG overlay (panel borders, gutters,
  bubble shapes, lettering from `bubbleZones[].lettering`, caption boxes)
  over the single accepted page render via sharp. Under `per-panel` (the
  sequential-art default): mojulo owns the page grid — each accepted
  panel render is cropped/fitted into its panel bounds, panels are
  composited onto the page, THEN the overlay goes on top. Under `hybrid`:
  the page render is the base layer, accepted panel renders replace their
  panel regions, then the overlay. Same (manifest, renders) → same bytes
  in every strategy.
- Served as `/api/sketches/<ref>/final.png` (derived on demand, cached by
  `<ref>-<manifestHash>-<renderN>`), and written into
  `data/outcomes/<ref>/final.png` on accept so the outcome folder is
  self-contained (index.html + scaffold + generated + final + audit —
  the spike's browsable bundle, now a real outcome).
- Lettering is the only place bubble text exists; render instructions
  (I0/I3) must provably never include it (unit test).

Exit: byte-stability test green; a lettering-only manifest edit changes
`final.png` without re-rendering the generative layer.

### I6 — world projection seam (the prize; deliberately last, optional)

`projectWorldToPacket(worldPayload, cameraRef)` — server-side perspective
projection of `resolveWorldScene` faces through a named world camera
(worldFraming metadata) into depth-ranked screen polygons + horizon +
vanishing point, lowered into an `image-outcome` manifest (I2 camera
entry). Occlusion order from depth sort; polygon simplification to keep
forms coarse (blockout masses, not meshes — the spike showed rectangles
suffice). Nothing does this today: worlds project at browser runtime via
THREE, and the only deterministic projection code (`projectTwoPoint` in
the polygonizer) serves two-point sketch rooms. This phase is the only
genuinely new engineering in the plan and carries most of the long-term
value: `compose_world` → pick a camera → cinematic still of *your
existing world*. Ships as a `compose from world` option on the mint
tool, not a new tool.

Exit: a fractal-city world ref + camera name mints an image-outcome whose
scaffold visibly matches a browser screenshot of the same framing
(manual visual check is the bar; pixel equivalence is not).

## Execution split (decided with the operator, 2026-07-10)

Claude implements the substrate phases (I0–I5, I6 later); the Codex agent
reviewed this plan against its spike experience (findings integrated —
see Status line) and serves as the first `image_render` worker once the
MCP is exposed to it. That foreign-agent run IS the I3 exit criterion.

## Out of scope (recorded so they aren't re-litigated)

- Deterministic pixel-level audit (edge sampling) — v2 of the I4 gate.
- ~~Protoform-figure-driven poses~~ — brought IN as the optional `rig`
  field (operator call, 2026-07-11; see Status addendum). The stick
  vocabulary remains the default; rigs are for key poses.
- Multi-page sequential works / story continuity across pages — needs its
  own plan once single pages are routine.
- Image *editing* loops (mask-based revision of an accepted render) —
  ride the revision sidecar when they come; not v1.
- Character identity persistence across panels/renders (same hero, same
  costume) — the hardest generative problem here; note it, don't gate on it.

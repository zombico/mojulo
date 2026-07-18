# Picture-Book Render — the worker seam adapted to the publisher

Status: spike (2026-07-11). Files: picture-book-spike/{fixture,book-briefs,
book-compositor}.js + picture-book.spike.gen.test.js, output under
lite-template/integration/0711/spike-output/picture-book/. Builds directly
on the image-outcomes doctrine (image-outcomes.plan.md) and the pan-cel
character-key lesson (pan-cel-motion.plan.md). Waiting on the first
generation round; the retrospective is the gate for the promotion phases.
Addendum (2026-07-11, operator call): **character-sheet adoption** — the
comics character-sheet primitive (image-outcomes.plan.md addenda) landed
the same day and supersedes this spike's identity half. Adopted directly:
the ad-hoc character-key manifest + prose character bible are deleted; the
fixture declares Noa once as a `character-sheet` manifest and every page
casts her via `characters[]` + figure `character`/`outfit` binding. To
enable that, `characters[]` was EXTENDED from sequential-art to
`image-outcome` manifests (manifest.js — same normalizeCharacter block,
same figure-binding validation; instructions gained the characters section
on single shots and `buildCharacterSheetInstructions` accepts them;
`resolveCharacterRefs` + the packet's `characterSheets`/step-0 work for
image-outcome for free since they key on `manifest.characters`). The book
bible shrank to what is genuinely book-level: setting, palette, the
continuity ladder. P3 below is struck — the `characters: [{ ref }]`
mechanism replaces the preload-labeled-refs idea.

## The idea

The `picture_book` publication kind (stash of sketch items → `cook` →
paginated outcome folder) already has everything a generated book needs
EXCEPT a raster page: pages resolve `sketch_ref → SVG` and nothing else
(lib/outcomes/resolvers/sketch.js). Meanwhile image-outcomes already turns
a sketch row into a scaffold + brief + externally-rendered PNG. The
adaptation is therefore small and mostly *reuses* the existing seam:

- **A picture-book page IS an `image-outcome` sketch.** No new manifest
  kind. Each page is a single directed shot minted via `create_sketch`;
  the book is a stash of six of them plus captions.
- **The picture book is the PURE case of the lettering doctrine.** Comics
  need the overlay composite (borders, bubbles, lettering painted over the
  render). A picture book's text lives entirely OUTSIDE the raster — the
  caption band under the illustration in the book HTML. No composite pass
  at all: the accepted render is the finished page verbatim.
- **The new problem is cross-page identity + style hold.** Six independent
  generations of the same character will drift. Solved by the substrate's
  character-sheet primitive (adopted — see Status addendum): the character
  is a standalone `character-sheet` manifest, every page casts it via
  `characters[]` + figure binding, and the bound sheet render is the
  conditioning reference for every page — pages condition on the sheet,
  never on each other, so drift cannot compound and pages render in
  parallel. A book-level Style Lock (one preset + dials shared by every
  page manifest) plus a **book bible** block (setting, palette, per-page
  continuity ladder — the scene truths no single manifest carries)
  rendered verbatim into every brief carry the rest.

## What the spike emits

Stage A — the handoff bundle: normalized book manifest, character-sheet
scaffold + brief (the substrate's own turnaround-strip scaffold and
`buildCharacterSheetInstructions` emitter), six page scaffolds + briefs,
HANDOFF.md (sheet-first render order, parallel pages, art-only rules).
Stage B — the **scaffold edition**: the real `picture_book.html` template
composited with scaffold rasters as `<img>` pages, proving the PNG-page
seam and the caption/pagination read before any generation is spent (the
rig-preview pattern: verify what's deterministic first). Stage C
(conditional) — the **generated edition** once
`renders/character-sheet.png` + `renders/page-<n>.png` land.

Tested invariants: every manifest validates through the shipping
normalizer; captions and cover blurb never appear in any brief (the
lettering rule transposed to publications); the bible rides every brief;
scaffold SVG and book HTML are byte-stable.

## Promotion path (sketch only; re-plan after the render round)

- **P1 — resolver PNG branch (`pb-2`).** `resolveSketchItem` (or a sibling
  resolver) learns: when the page's sketch is an image-outcomes kind AND
  the I4 sidecar has an ACCEPTED render, resolve to that PNG (copied into
  the outcome folder as `page-NNN.png`); otherwise fall back to the
  scaffold SVG — a book with no renders yet is still a complete, cookable
  artifact (recipes-not-renders, kept). The writer's manifest.json records
  per-page render provenance (render `n`, source, conditioned).
- **P2 — no new render machinery.** Each page sketch gets its render
  through the normal image-outcomes I3/I4 loop (durable request rows, two
  audits, accept gate). The book adds only an aggregation read: a cook of
  kind picture_book can report which pages still lack accepted renders.
- ~~**P3 — the character key as a mintable artifact** via the `preload`
  labeled-refs machinery~~ — STRUCK (2026-07-11): superseded by the
  character-sheet primitive. Pages cast a stored character with
  `characters: [{ ref }]` (validated + inlined at mint by
  `resolveCharacterRefs`, now image-outcome-aware); the bound sheet PNG
  already rides every page's render packet as
  `characterSheets[].boundSheet` with workerProtocol step 0. Nothing left
  to build here.
- **P4 — acceptance audit gains an `identity_match` check** (vs the
  bound character sheet) for pages whose sketch casts a character —
  the pan-cel M2 check, arriving via the book instead.
- **P5 — publication covers (2026-07-11, operator call).** A cover is
  the pure single-shot case of this seam and generalizes past
  picture_book to every cover-bearing kind (novel, textbook, comic,
  field-guide, …). The cover IS an `image-outcome` sketch — portrait
  viewBox (~1024×1536), a `protectedZones` title zone, optional
  `characters[]` cast so the cover holds identity with interior pages,
  and a Style Lock matched to the kind's register. The cook gains a
  cover slot (a stash item in the cover role pointing at the sketch —
  the photojournal cover-lift pattern); the P1 resolver branch reuses
  verbatim: ACCEPTED render → `cover.png`, else scaffold SVG, else the
  kind's current typographic cover — a book with no cover render stays
  a complete, cookable artifact. Title/author/blurb never enter the
  brief; the typographic layer stays an HTML overlay at the publication
  layer (the lettering doctrine), so copy edits re-cook without
  touching the generative layer.
  **Iterability is a requirement, not a nicety** (operator call): the
  cover must iterate exactly like every other publication artifact.
  Concretely — (a) the cover manifest revises through the normal
  `update_sketch` / `diff_sketches` revision surfaces; (b) new render
  rounds append `n+1` through the same I3/I4 request → audit → accept
  loop, and re-accepting swaps the cover; (c) the cook resolves the
  *currently-accepted* render at cook time — never frozen at first
  cook — so revise-render-accept-recook is the whole loop; (d) the
  outcome's manifest.json records cover provenance (sketch ref, render
  `n`, manifest_rev_hash, source, conditioned) so any cooked edition is
  auditable back to the exact cover version it shipped with.
  Pre-gate check: one portrait-viewBox smoke test (camera / horizon /
  scaffold behavior at 1024×1536) before committing — the spike's shots
  are all landscape. Otherwise rides the same retrospective gate as
  P1/P2.
  **Pre-gate check PASSED (2026-07-11)** — the spike gained a `cover`
  target (fixture `coverManifest()`: portrait 1024×1536, title +
  imprint `protectedZones`, casts Noa, book Style Lock; emitted to
  `cover/` beside the pages, `renders/cover.png` accepted standalone,
  raster cover composited onto the editions' cover page via the
  compositor's `cover` arg). Portrait normalizes and scaffolds with no
  substrate change. One gap for the retro: `imageOutcomeInstructions`
  never narrates protected/overlay zones in prose — the scaffold draws
  them but a cold worker isn't told to keep them quiet; the spike's
  `buildCoverInstructions` carries the rule book-side, and promoting a
  zones section into the shipping emitter should land with P5.

## Out of scope (recorded so they aren't re-litigated)

- Spreads, page-turn pacing, trim/bleed print geometry — book design
  concerns for a later pb-N template pass, orthogonal to rendering.
- Multiple recurring characters per book — the bible + preload machinery
  already allow it; the audit story (per-character identity checks) waits
  for the single-character round to teach first.
- Style-transfer consistency checks (did every page hold the Style Lock)
  as a deterministic audit — same v2 posture as the other pixel audits.

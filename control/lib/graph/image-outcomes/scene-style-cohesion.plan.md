# Scene cohesion via a shared, MCP-authorable style source

> **Execution status (2026-07-14):** A, B, C **landed + verified** — 299 tests
> green across the affected suites (14 new in `scene-style-cohesion.test.js`).
> Style is authorable three ways with a stable `styleId`; keyframe clips carry a
> declared style into the cels; scene plates inherit the lead cast clip's style at
> mint (or take an explicit override); `get_style_vocab` reader added (registered,
> indexed in `TOOL_INDEX` + `RING10_TOOLS`); vocab cards updated. Also fixed a
> latent failure from the prior task: `human-figure.md` was over the routing-card
> 1100-char ceiling (broke reindex/semantic-search) — trimmed to 1025.
> Pre-existing, NOT touched: the tool-descriptions budget/payload-pin failures
> (`skin_polygomer`/`export_model`/`create_manji_tree`/`sketch_polygomer`) and the
> slow worked-examples honesty-gate (passes with a longer timeout).


**Goal:** a staged scene reads as ONE look — the background is painted in the same
style as the characters. Achieved by **shared source, not by a post-hoc check**:
the plate is rendered from the same style token the character cels were painted
under. "background watercolor = character watercolor" is load-bearing because
there is one style, applied to both surfaces — there is nothing to diverge.

**Explicit non-goals (decided):**
- NO composited/pixel cohesion score, NO warn/refuse gate, NO register-clash matrix.
  A 3D-rendered / "unreal-engine" look is a valid style for 2D animation; the
  feature never judges style *combinations*, only makes the SAME style flow to both
  surfaces.
- Style is not a closed gate. `STYLE_VOCAB` presets are **templates / starting
  guidelines**; a fully custom style is first-class and MCP-authorable.

---

## What exists today (call sites)

- `STYLE_VOCAB` + `resolveStyle` — the closed preset shelf, wired into
  `renderBrief` for `image-outcome` / `sequential-art` / `character-sheet` only.
  [styles.js](styles.js), `normalizeRenderBrief` at [manifest.js:140](manifest.js) (used at :186/:432/:474).
- **Keyframe cels carry NO renderBrief** — hardcoded "flat cel animation style"
  at [instructions.js:330](instructions.js). The consuming branch that WOULD use a
  preset already exists at instructions.js:337-343 (currently only reached via a
  fallback default).
- **scene-motion plate has NO style field** — painted from free-text plate
  instructions; `normalizeSceneMotionManifest` at [manifest.js:617](manifest.js)
  stores `cast[].clipRef` but never reads the clip's style.
- `renderBrief` already supports a freeform `style` string (no preset) — the seed
  of the custom-style path; it just lacks custom `lock[]`/`negative[]`/mood/lighting.

So the incohesion is structurally invited: characters locked to flat-cel, plate
unconstrained, no shared source. The fix is to introduce that shared source.

---

## The build

### A — style becomes a first-class, MCP-authorable object
Extend `normalizeRenderBrief` (styles.js + manifest.js) to accept, in priority order:
1. `preset` (+ `dials`) — a `STYLE_VOCAB` template, as today.
2. `preset` (+ `dials`) **+ `overrides`** — start from a template, then add/replace
   `style` / `mood` / `lighting` and append `lock[]` / `negative[]` lines.
3. a fully **inline custom style** `{ id, style, mood, lighting, lock[], negative[] }`
   with NO preset — resolves straight to the same shape `resolveStyle` returns.
Add a stable **style token** to the resolved brief: `styleId` = the preset+dials key,
or the custom `id` (or a content hash when `id` is omitted). This token is what makes
sharing load-bearing — two surfaces are "the same style" iff their `styleId` matches.
- New MCP reader `get_style_vocab` (sibling of `get_sketch_vocab`): list presets +
  read one in full, so an agent can pull a template and fork it into a custom style.
  Register in the tools index / routing.

### B — keyframe-animation clips declare their style
- `normalizeKeyframeAnimationManifest` ([manifest.js:506](manifest.js)) accepts
  `renderBrief` and stores the resolved brief (incl. `styleId`). Omitted → the
  current flat-cel default (unchanged behavior, so existing clips are untouched).
- Thread it into the cel instructions: remove the hardcoded style at
  instructions.js:330 in favor of the already-present preset branch; the meru
  contract / identity sections are unchanged.
- `local-render-params.js:97` — carry the brief's negatives/preset into the local
  diffusion params (as image-outcome already does at :148).

### C — scene-motion: the plate takes the cast's style (the load-bearing link)
- The plate is painted in the scene's style; that style is the SAME token as the
  characters, so bg = char by construction.
- Resolution rule (no check, pure inheritance):
  - If the scene declares an explicit `style` (renderBrief, MCP-authorable) → the
    plate uses it (operator override).
  - Else the plate **inherits the lead cast member's `styleId`** — resolved at
    PLATE-RENDER time (in the plate render-packet / instruction builder, where the
    `clipRef`s can be looked up), NOT in the pure normalizer.
- The plate's Style Lock section is built from that resolved brief, exactly like a
  cel's — same discipline, same source → same look.
- No cohesion field on the accept audit; the plate STAGE gate (ground/recession) is
  unchanged.

---

## Sequencing
1. **A** — `normalizeRenderBrief` custom/override support + `styleId` token + `get_style_vocab`. (Foundation; reused by B and C.)
2. **B** — keyframe clips declare style; cels painted under it.
3. **C** — plate inherits cast style (or explicit scene override).

## Tests
- A: `resolveStyle`/`normalizeRenderBrief` accepts a full inline custom style and a
  preset+overrides; `styleId` is stable for identical input and differs across styles.
- B: a keyframe manifest with `renderBrief.preset:'steamboat'` puts the steamboat
  Style Lock into the cel instructions; omitted → flat-cel default preserved (existing
  keyframe tests stay green).
- C: a scene whose cast clip is `styleId:X` builds a plate packet whose Style Lock is
  X; an explicit scene `style:Y` overrides to Y. (Unit over the plate-packet builder.)

## Out of scope / later
- Comparing two DIFFERENT custom styles for similarity — deliberately not built; the
  load-bearing contract is a shared token, not a fuzzy match.
- `scene-motion` vocab card + human-facing routing updates to document the shared-style
  contract (do alongside C so the card matches behavior).

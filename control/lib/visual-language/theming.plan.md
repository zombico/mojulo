# Visual-language theming plan

Goal: stop defaulting every rendered surface to dark mode. Reframe the output
target as **info presentation**, not just slideshows. Give the model a small,
named theme vocabulary it can pick from — **scoped per domain**, because a deck
theme is meaningless for a figure study.

## Decision (locked)

- **Approach A: named themes only.** The model passes a single token (e.g.
  `theme: 'paper'`); it does not hand-author hex. Per-token overrides are an
  explicit non-goal for v1.
- **Themes are scoped to a domain.** No global theme object. Each domain exposes
  its own vocabulary; shared plumbing resolves a `(domain, token)` pair to colors.
- **Theme (UI mode) and tone (atmospheric lighting) stay orthogonal.** Landscape
  keeps its tone axis; a light presentation can still embed a moonlit panel.

## Reference pattern

`control/lib/graph/geo/palette.js` already does this right:
`MAP_THEMES = { dark, light }` + `getMapTheme(theme)`, `DEFAULT_THEME='dark'`.
Lift that shape into a shared module; every domain registry follows it.

## Domains

### 1. Presentation  — PRIMARY, v1 scope
The "info presentation" surface. The vocabulary is deliberately **broad and
indicative from the start** — the menu itself signals range to the model so it
stops defaulting to dark. v1 ships the full set (each is a data entry; the pipe
only has to be proven once):

| token           | ground            | ink / accent        | feel                        |
| --------------- | ----------------- | ------------------- | --------------------------- |
| `dark`          | slate / near-black| light text          | current default             |
| `midnight`      | deep navy/indigo  | soft-glow light     | premium dark variant        |
| `light`         | cool white        | dark text           | clean / neutral             |
| `paper`         | warm cream        | ink                 | editorial / document        |
| `blueprint`     | deep blue ground  | cyan/white lines    | technical / schematic       |
| `sepia`         | tan / brown       | dark brown          | archival                    |
| `high-contrast` | pure black/white  | bold, single accent | accessibility / emphasis    |

Each must be coherent across BOTH chrome and embedded visuals (no light-page /
dark-visual split). The set spans dark↔light and neutral↔characterful so the
model sees the breadth.

Consumers that currently hardcode color and must read from the registry instead:
- `control/lib/motion/deck.js` — `DECK_BG = '#0b0f16'` (hardcoded dark)
- `control/lib/motion/viewer.js` — `background: #0e1319` chrome (hardcoded dark)
- `control/lib/motion/flipbook.js` — `bgFill` default `#fafaf6`
- `control/lib/graph/sketch-svg.js` — already has `surface:'dark'|'light'` +
  CSS-var inlining. THIS IS THE MECHANISM. Generalize `surface` → `theme`.
- `control/lib/outcomes/template/outcome.html` — light page chrome wrapping a
  dark `--visual-bg`. The incoherent split to fix.
- `control/lib/outcomes/template/slide_deck.html` — same light-page/dark-visual split.

The defining v1 win: chrome and embedded visuals resolve from ONE theme, so the
page/visual split disappears.

### 2. Figure  — own vocabulary, v1 (CONFIRMED)
`control/lib/graph/polygonizer/figure-render.js` — `BG = '#eef1f4'`, flesh
`#c8836a` hardcoded. Axis is backdrop + material + lighting key, NOT slide themes.
Named setups (v1, confirmed): `studio-grey`, `white-cyc`, `blueprint-wire`.
Composes with the existing filled vs wireframe modes.

### 3. Landscape  — no change
`painted-landscape.js` + `skin-palette.js` already tone-aware
(moonlight/sunset/silver-daylight). Leave as-is; document that tone IS its axis.

### 4. Maps  — align names, keep impl
`graph/geo/palette.js` stays; rename/alias tokens to match Presentation
(`dark`/`light`) so the model sees consistent names across domains.

## Shared plumbing (the only new shared code)

`control/lib/visual-language/themes.js`
- `PRESENTATION_THEMES`, `FIGURE_SETUPS` registries (map-palette shape).
- `resolveTheme(domain, token)` → CSS-var set (`--background`, `--ink`,
  `--paper`, `--visual-bg`, accent…). Falls back to the domain default.
- Reuse the CSS-var → literal-hex inliner already in sketch-svg.js; do not invent
  a second one. Extract it here if it needs to be called from deck/viewer too.

## Model-facing surface

- `forge_motion` subject gains optional `theme` (presentation vocab) for decks +
  camera motions; validated against `PRESENTATION_THEMES`.
- Figure tools/skill gain optional `setup` (figure vocab).
- Outcome rendering takes the same `theme` token so page chrome matches the deck.
- Validation rejects unknown tokens with the domain's allowed list (small surface,
  coherent-by-construction).

## Sequencing

1. **Prove the pipe** with the motion/deck slideshow path. ✅ DONE.
   - `control/lib/visual-language/themes.js` — registry + `resolvePresentationTheme`.
   - `sketch-svg.js` `renderSketchToSvg` gained a `vars` override (merged over the
     `surface` base) → the inliner now re-tints ink/accent per theme.
   - `deck.js` + `regime-a.js` thread `vars` into the slide render.
   - `motion.js` (`renderShot`/`forgeMotionHandler`) resolves `shot.params.theme`
     → surface + vars + backdrop (flipbook/frame/GIF) + viewer chrome; explicit
     `surface`/`bg` still override; recipe persists the token (faithful regen).
   - `viewer.js` takes `chrome` (DEFAULT_CHROME = today's dark when absent),
     infers light/dark `color-scheme` from the page bg.
   - Schema/description expose `theme` with the broad vocabulary.
   - Tests: motion.test.js — themed deck threads ink+bg+chrome; unknown token
     rejects. All 25 pass. Visually verified dark/light/paper/blueprint/sepia.
   - All 7 themes shipped here (not just dark+light) per "broad from the start".

2. **Cook publish path** — thread the SAME `theme` token through the static
   outcome templates. ✅ DONE.
   - `themes.js` — `presentationDocVars(theme, kind)` maps a theme onto the cook
     template page vars (kind-specific, since `--paper` differs essay↔deck);
     `presentationSketchTheme(theme)` returns the embedded-sketch {surface, vars}.
   - `cook.js` — `resolvePublicationStyle(style, kind)` replaces the accent-only
     resolver: accepts `publication.style.theme`, emits a `body { … }` override
     block (beats each template's `:root`), and returns `sketchTheme`. `accent`
     still works and overrides the theme's accent. Gated to `THEMED_KINDS =
     {essay, slide_deck}` with a clear redirect to `accent` for other kinds.
   - `resolvers/sketch.js` — `resolveSketchItem` gained a `vars` passthrough.
   - `slide-deck.js` — writer takes `sketchTheme`, threads surface+vars into the
     embedded sketch slides so the visual band matches the page chrome.
   - cook schema/description document `style.theme` with the vocabulary.
   - Why essay is chrome-only: its visuals[] are agent-supplied raw SVG/PNG (no
     mojulo-controlled surface to re-tint); the dark-visual band lives in
     slide_deck, which is fully threaded.
   - Tests: cook.test.js — themed deck sets chrome doc-vars AND re-tints the
     embedded slide SVG; theme on a non-wired kind + unknown token both reject.
     63 pass. Visually verified paper + blueprint slide SVGs legible on their
     band color (split gone).
   - Known minor: slide_deck's `.slide.visual .slide-meta` divider is a
     hardcoded `rgba(255,255,255,0.15)` (assumes a dark band) — invisible on a
     light themed band. Cosmetic; left for a follow-up.

   Remaining tail: extend theme to the other sketch-embedding kinds
   (picture_book, field_guide, comic, visual_guide, instruction_manual) by
   threading sketchTheme into their writers — same pattern as slide_deck.
3. Figure `setup` vocabulary in figure-render. ✅ DONE.
   - `themes.js` — `FIGURE_SETUPS` registry (its own domain; axes = backdrop +
     material + lighting + render mode) + `resolveFigureSetup`. Three setups:
     `studio-grey` (default lit), `white-cyc` (high-key white), `blueprint-wire`.
   - `figure-render.js` — factored `worldVertex`; `litFaces` takes a `light`;
     `resolveSetup(manifest)` resolves bg/flesh/light/mode (no setup = built-in
     defaults, byte-identical); `recolorFlesh` re-tints only flesh stacks. NEW
     wireframe path: `projectWire`/`drawWire` stroke the projected ring polylines
     (the figure is already ring-stacks, so the construction view is those rings
     as lines, no fill). Both renderFigureToSvg + renderFigureFrames branch on mode.
   - `figure.js` — `create_figure` takes a `setup` token (validated), threads it
     into the manifest + the GIF backdrop; schema/description document it.
   - `blueprint-wire` is a REAL wireframe (not a filled stand-in): the spike's
     ring-wave was study-only; this promotes the idea into the renderer.
   - Tests: figure.test.js — no-setup byte-identical (back-compat); filled setup
     swaps bg + stays meshed; blueprint-wire emits stroked polylines (no polygon)
     on the blueprint ground; unknown token rejects at tool + render. 7 pass.
     Visually verified all three (wireframe reads as a coherent ring-wave body).
4. Align Maps token names. Landscape untouched. ✅ DONE.
   - Found the real mismatch: map `light` was warm cream — which is `paper`
     everywhere else. Maps aren't wired to a live tool yet (buildMapMarks has no
     caller), so no model-facing or stored-manifest back-compat risk.
   - `geo/palette.js` — `light` is now COOL (matches presentation `light`); the
     warm cream moved to its correct name `paper`; added `blueprint` + `sepia`
     (cartographically meaningful). Names are now a subset of the presentation
     vocabulary. Maps keep their own rich per-element palette (land/sea/holes/
     legend) — they don't derive from presentation chrome.
   - `geo/palette.test.js` (new) — guards: every theme fully specified; map names
     ⊆ presentation names (no drift); getMapTheme default/reject; light≠paper
     regression. 4 pass.
   - Landscape left untouched: its axis is tone (moonlight/sunset/…), not theme.

## Palette expansion (post-step-4)

Presentation vocabulary grown from 7 → 15, leaning into contextual identities so
the model can match the look to the SUBJECT, not just the mode. Added: `slate`
(corporate), `terminal` (console/code), `solarized` (dev editor), `synthwave`
(retro/hype), `forest` (nature), `mint` (light/wellness), `newsprint`
(journalism), `chalkboard` (teaching). Each is a data entry — auto-surfaces in
the motion + cook schemas (they read `PRESENTATION_THEME_NAMES`), no call-site
changes. Visually verified each renders legibly with author bars intact.
New `themes.test.js` guards every presentation theme + figure setup is complete
and well-formed (hex chrome, valid surface/mode) so a malformed addition fails
loudly. 104 tests green across the five touched suites.

## Status: plan complete

Domains 1–4 all themeable, each with its own honest vocabulary, one consistent
set of token names across presentation + maps. Remaining OPTIONAL tail (only
when those kinds are actually needed):
- Extend presentation theme to the other sketch-embedding cook kinds
  (picture_book, field_guide, comic, visual_guide, instruction_manual) — same
  pattern as slide_deck (thread sketchTheme into each writer).
- Author `midnight` / `high-contrast` map palettes if a map must pair with one.
- Per-theme categorical mark palette (default mark colors when the author sets
  none) — the one cross-cutting idea deferred since step 1.

### Follow-ups noticed while building
- A theme recolors only `var(--…)` DEFAULTS; author-set mark fills (bar colors)
  are intentionally untouched. A future "categorical palette per theme" could
  drive default mark colors when the author doesn't set them — out of scope now.

## Decisions (resolved)

- Presentation vocabulary = `dark | midnight | light | paper | blueprint | sepia
  | high-contrast` — broad/indicative, all in v1.
- Figure setups = `studio-grey | white-cyc | blueprint-wire` — confirmed.

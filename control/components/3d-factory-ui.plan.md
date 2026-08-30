# 3D Factory UI — revamp plan + style guide

Status: **phases 1–6 shipped** (2026-08-30). The rollout in §8 is complete; each phase's entry there records what it actually cost and where the plan was wrong.

Mojulo's positioning has narrowed to **"a 3D factory for agents."** The dashboard has not
followed. This plan makes the *surface* speak the colloquial vocabulary of 3D work — viewport,
outliner, library, materials, display modes, render queue, ship — while the *spine* underneath
stays exactly what it is: sketch recipes, `compose_world`, `forge_motion`, `create_beats`,
`request_image_render`, `create_game`, all over the one `sketches` store.

**The one-line thesis: the vocabulary is a skin, not a refactor.** No primitive is renamed, no
tool signature moves, no route is deleted before its replacement can hold its traffic.

Concepts minted with mojulo's own diagram primitive (dogfooded, not mocked in Figma):

| | ref | what it shows |
|---|---|---|
| Vocabulary map | [`sk_as8polf1ok`](/sketches/sk_as8polf1ok) | six surface bays → the primitives behind each |
| Concept A — viewport-first home (dark) | [`sk_sufrycadhj`](/sketches/sk_sufrycadhj) | outliner / viewport / inspector, HUD, status bar |
| Concept B — bench instrument home (light) | [`sk_ftmtd211ji`](/sketches/sk_ftmtd211ji) | the same IA in the ombi.co instrument register |
| Style guide v1 — "Machine Shop" (dark) | [`sk_t5o18axogc`](/sketches/sk_t5o18axogc) | surfaces, signal hues, type rule, display modes, components |
| Style guide v2 — "Bench Instrument" (light) | [`sk_qy336qeohl`](/sketches/sk_qy336qeohl) | plastic/LCD panel, one accent + two, key row, components |

**The two style guides are the same information architecture in two registers.** §2–§6 below
hold for either. §7 is the dark direction, §7b the light one. Pick one; do not ship both as a
theme toggle until the token layer in §8 phase 1 exists, because a toggle over two *different*
signal palettes is a second design system, not a theme.

---

## 1. What is wrong today

Read [`components/workshop-nav.jsx`](workshop-nav.jsx) and [`components/HomeLauncher.jsx`](HomeLauncher.jsx)
with fresh eyes and four problems fall out.

**a. The home screen is a menu, not a workshop.** Three abstract mode buttons (Studio / Ideate /
Operate) open a drawer of sixteen tiles. Nothing the operator *made* is visible on the landing
surface. A 3D factory whose front door shows zero geometry is arguing against itself.

**b. The taxonomy is mojulo-internal, not operator-facing.** Worlds / Objects / Illustrations is a
real and load-bearing distinction inside the substrate — walk vs. orbit vs. flat, the `walk` flag
in `world-kinds.js`. It is **not** how a person asks for things. They say scene, model, picture.
Today that internal split is a *navigation fork*: four routes (`/sketches`, `/maker/illustrations`,
`/maker/worlds`, `/maker/objects`) that are the same `SketchGallery` with a different `bucket`
prop. The fork buys nothing and costs the operator a decision on every visit.

**c. The 3D is hidden behind a click.** `SketchPreviewBody` already mounts a live `<iframe>` on
`/api/sketches/<ref>/world` — a real navigable three.js scene — but only for the *selected* sketch
in a split pane. The grid itself is flat cards. The most impressive thing mojulo does is two
clicks deep.

**d. There is no render surface.** `image_render_requests` is a durable queue with
`request → pull → submit → accept` states. GI bakes run through `bake-world-gi.mjs`. Cooks
materialize into `/outputs`. Exports (`.glb` / `.stl` / Godot) hang off individual download
buttons. Four expressions of "mojulo is producing something" with no single place to watch them.

## 2. Surface vocabulary → primitive spine

Six bays. Each is a **lens** on the store; none is a new data model.

| Bay (surface) | Absorbs today's | Primitive spine |
|---|---|---|
| **Viewport** | `/` | head sketch + `/api/sketches/<ref>/{world,scene,svg}` |
| **Library** | `/sketches`, `/maker/illustrations`, `/maker/worlds`, `/maker/objects` | `create_sketch`, `compose_world`, `mint_solid`, `edit_solid` |
| **Animate** | `/maker/motion` | `forge_motion`, `stitch_motion` |
| **Sound** | `/maker/beats`, `/maker/voice` | `create_beats`, `create_voice` |
| **Render Bay** | `/outputs`, scattered download buttons | `request_image_render`, `cook`, `export_model`, `bake-world-gi.mjs` |
| **Build** | `/maker/games`, `/arcade` | `create_game`, `create_game_project`, `export_game` |

Demoted out of the top level, into the top bar:

- **Notes** — `/research`, `/plan`, `/stashes`. Real, and genuinely secondary to making.
- **Runtime** — `/bots`, `/apps`, `/mcp-skills`. Already presence-gated; keep that. On a creative-only
  install these vanish entirely, and the top level should not have reserved a third of itself for them.

**Do not rename anything below the surface.** `WORKSHOP_GROUPS` stays the source of truth for the
nav; the `key` strings and hrefs are what change, plus the i18n values under `home.tiles.*`.

### The Library fold — the highest-value single change

Four routes collapse into one browser with filter chips: **Scenes · Models · Characters ·
Materials · Images · Diagrams**. The `bucket` prop becomes a URL query (`/library?kind=scene`),
old routes 301 to it, and `SketchGallery` loses nothing — it already takes `bucket` as a prop.

Two new chips carry real weight and do not exist today:

- **Characters** — figure/protoform recipes and character sheets are a first-class thing an
  operator asks for by name, currently scattered across the object and illustration buckets.
- **Materials** — the procedural-material presets (`gradient-plate`, `brushed-steel`,
  `brushed-hull`, `weathered-hull`, `weathered-heavy`) are a *real registry* in
  `lib/graph/materials/procedural-material.js` with **no UI at all**. A material browser
  showing each preset on a standard test solid is cheap to build and reads as unmistakably 3D.

## 3. Concept A — the viewport-first home

See [`sk_sufrycadhj`](/sketches/sk_sufrycadhj). Three columns under a thin top bar, over a thin
status bar.

**Left rail — Outliner.** The DCC hierarchy word, and honest here: mojulo genuinely has a tree
(scene → parts → materials → bound audio → bakes) via graph bindings and `list_stash_bindings`.
Under it, the Library counts and the other bays as flat rows. One rail replaces the entire
current drawer.

**Centre — Viewport.** The largest element on the page is a live scene: the `<iframe>` that
already exists, promoted from preview pane to landing surface. It carries

- a **view-cube** in the corner — front / side / top / ¾ camera presets, deterministic and already
  expressible in the camera primitives;
- a **scale bar** and `1 unit = 1 m · stl-ready` in the corner. Mojulo exports print-ready STL **at
  true scale**; that is a differentiator and it should be visible, not buried in a tooltip;
- a **HUD strip** with `ref · kind · seed · tri count · materials · last bake`.

**Right rail — Inspector.** Recipe params as mono JSON, revision list, bound artifacts, ship
buttons, and one amber **Ask the Agent** card.

**Bottom — status bar.** Installed packs, render-queue depth, tool-call rate. The factory's
"machine on" light. It is also the honest place to surface `installedGroups()` so a lean install
explains itself instead of just having fewer tiles.

### What the home shows when the workshop is empty

An empty studio is an invitation, per the existing comment in `workshop-nav.jsx`. The viewport
renders the **orientation gallery** (`mojulo-orient`) turntable instead of a blank grid, with its
consent-first framing intact: this would *create* a real artifact, accept or decline.

## 4. Display modes — one control, everywhere

The single most legible 3D affordance mojulo can adopt, because it maps onto four render paths
that **already exist**:

| Mode | What renders it | Provenance |
|---|---|---|
| **Wire** | vexar wireframe / ring-wave construction | mojulo |
| **Shaded** | vertex colours, procedural materials, `resolveFaceMaterials` | mojulo |
| **Baked** | Blender Cycles GI baked into the world's own vertex colours | mojulo geometry, operator's Blender |
| **Painted** | external image worker over the scaffold | **not mojulo's paint** |

A segmented control in the top bar of every artifact page. Modes the artifact does not have are
disabled with the reason, not hidden — "no GI bake yet · ask the agent to bake it" is a better
empty state than a missing button.

**Painted carries a provenance badge, always.** This is not decoration. `docs/bicycles.md` and the
image-outcomes doctrine are explicit that mojulo owns geometry and the model owns paint; the UI
should not let a painted render pass as a mojulo render. Badge it in forge amber.

## 5. Render Bay

One page, three lanes, over surfaces that already exist:

- **Queued / in flight / done** — `image_render_requests` rows, with worker attribution and the
  `accept` / `reject` eyes-gate made visible. Today this loop is entirely invisible in the UI.
- **Bakes** — GI bake runs, preset used, and the two gates from `map-gi-bake.plan.md` shown as
  what they are: a machine gate and an eyes gate, never conflated.
- **Cooks and exports** — `/outputs`, plus `.glb` / `.stl` / `.wav` / `.mid` / Godot project.

Nothing here is mutating from the UI. Each lane's action is a copy-prompt.

## 6. Turntable cards

Cards today are an icon — the grid tile is a row with a `FileIcon`, no picture at all. Bake a
**16-frame azimuth strip** and step it with CSS `steps(16)` on hover. No WebGL context per card,
no live iframe in the grid, one image request. A grid of models that all turn when you sweep the
mouse across it is the single cheapest way to make the surface read as 3D.

`prefers-reduced-motion` freezes every turntable at its ¾ frame — which is also the best single
still, so the fallback is not a downgrade.

Two things this section got wrong, both recorded in the phase 4 entry below: the azimuth engine is
`forge_motion`'s turntable camera path, not the study skills; and the bake cannot happen at mint
time on the critical path — it is a background warm plus a first-hover mint, behind a queue.

One thing deliberately *not* adopted, so it is not rediscovered as an oversight: `/world` already
takes `?spin=1`, a self-rotating showcase orbit. That is one query param from a live turning card
and is exactly what §6 rejects — it is a WebGL context per tile.

## 7. Style guide v1 — "Machine Shop"

See [`sk_t5o18axogc`](/sketches/sk_t5o18axogc). Dark-native, near-black, one hot accent, technical
register. Deliberately *not* the purple-gradient look every AI product currently wears — mojulo is
a workshop tool, and it should sit next to Blender and Houdini in a person's mental shelf.

### Surfaces

| Token | Value | Role |
|---|---|---|
| `--bay-void` | `#07090C` | page |
| `--bay-floor` | `#0D1117` | panel |
| `--bay-bench` | `#151B23` | card |
| `--bay-rail` | `#1E2530` | hairline |
| `--bay-rail-lit` | `#2C3540` | hover border |

Today's `--background: #111827` / `--surface-primary: #1f2937` are Tailwind gray-900/800 — the
default admin-dashboard palette. The proposed set is cooler and darker, so that a lit 3D viewport
sitting inside it reads as the light source in the room.

### Signal — hues carry STATE, not section

The three mode hues already in `globals.css` get **repurposed rather than replaced**. Today
`--mode-studio` / `--mode-ideate` / `--mode-operate` mean *which section you are in*, which stops
meaning anything once the section is on screen. Rebind them to state, and they earn their keep on
every page:

| Token | Value | Means |
|---|---|---|
| `--live` | `#5eead4` (was `--mode-operate`) | exists · running · bound · sealed |
| `--forge` | `#F4A86A` (was `--mode-studio`) | making · queued · needs the agent |
| `--think` | `#A5B4FC` (was `--mode-ideate`) | speculative · plan · wireframe |
| `--seal` | `#D8B4FE` (existing `--entity-purple`) | durable record · entity |
| `--fault` | `#F87171` | error · rejected render |

Two rules that make the whole surface readable at a glance:

- **Teal means it exists and runs.** Amber means the agent has to act.
- Every mutating affordance is amber, because the dashboard never mutates — it hands the operator
  a prompt. That is the golden rule made visible instead of merely obeyed.

### Type — sans is human, mono is machine

Geist Sans and Geist Mono are already wired as `--font-sans` / `--font-mono` in `@theme inline`,
and currently `body` overrides both with `Arial, Helvetica, sans-serif`. Fix that, then hold one
rule:

> Anything the recipe stores or the agent typed renders **mono**.
> Anything a person wrote renders **sans**.

Refs, seeds, kinds, params, tool names, file paths: mono. Titles, descriptions, operator notes,
UI chrome: sans. In a workshop where two authors share every screen, the typeface is the cheapest
possible attribution.

Scale: `32 / 18 / 15 / 13 / 12 / 11`. Tight tracking at ≥24.

### Geometry and motion

- Radius **4** controls, **8** cards, **12** bays. Today's `rounded-2xl` (16px) on the mode tiles
  is too soft for a factory.
- Hairlines are **1px, always**. No 2px borders, no glow, no shadow below 8px blur.
- Spacing base **8** — 8 / 16 / 24 / 40 / 64.
- **120ms** state transitions, **240ms** panels, turntables at 24fps `steps(16)`.

## 7b. Style guide v2 — "Bench Instrument" (light)

See [`sk_qy336qeohl`](/sketches/sk_qy336qeohl) and [`sk_ftmtd211ji`](/sketches/sk_ftmtd211ji).
Taken from the ombi.co instrument theme (`~/Documents/ombi-co/instrument.css`) — flat plastic
panel, LCD, mono readouts, one desaturated teal.

**Why this is the stronger direction.** It supplies a *concept*, not just a palette. §7's Machine
Shop is a dark admin dashboard with a 3D pane in it; the instrument theme says **the dashboard is
a piece of equipment and the viewport is its screen**. Every affordance in §2–§6 then has an
obvious physical analogue instead of needing to be invented:

| UI element | Instrument analogue | ombi.co class |
|---|---|---|
| Viewport | the recessed LCD, corner ticks | `.display` / `.stage` |
| Display modes | the key row, `aria-pressed → teal` | `.keys` / `.key` |
| Viewport HUD | the stepper bar overlaid on the screen | `.stepper` / `.readout` |
| Bound audio | the phono row with its play key | `.phono` |
| Outliner / Library | the directory ledger | `.dir` |
| Revisions | the dated ledger | `.cv` |
| Recipe params | the recess readout block | `.world-rec` |
| Ship targets | pills | `.pill` |
| Counts | readout tiles, tabular mono | `.stat` |
| Ask the agent | the one primary action | `.cta.primary` |

It also inherits the brand for free — a dashboard that looks like ombi.co reads as the same
workshop, and the theme is already written and shipping.

### Panel

| Token | Value | Role |
|---|---|---|
| `--plastic` | `#cfccc4` | slab / page |
| `--card` | `#d5d2c9` | readout tile |
| `--btn` | `#c7c4ba` | key fill (`--btn-active` `#b6b3a8`) |
| `--recess` | `#c4c1b8` | readout block, phono row |
| `--lcd` | `#bcb9af` | **the viewport** |
| `--line` | `rgba(40,42,34,.22)` | control border |
| `--hairline` | `rgba(40,42,34,.16)` | list rules |

### Ink and signal

`--ink #33362f` · `--ink-soft #5c5f55` · `--ink-faint #7c7f74`.

The theme ships **one** accent, `--teal #3a6b64`. The dashboard needs state, so two are added,
desaturated into the same value band so the panel stays plastic:

| Token | Value | Means |
|---|---|---|
| `--live` | `#3a6b64` (theme teal) | exists · runs · bound |
| `--forge` | `#8a5f2e` | making · queued · the agent must act |
| `--think` | `#4d5570` | speculative · plan · **wireframe** |

Same two rules as the dark sheet, and they land harder here because teal is the only saturated
thing on the panel: **teal means it exists and runs; ochre means the agent has to act.**

Note `--think` doubles as the wireframe stroke — an indigo line drawing on grey LCD is exactly
what a wire display mode should look like, so the signal colour and the render mode agree instead
of competing.

### Type and geometry

Grotesk **800** for names (`Harbor City 04`), mono for every readout. Eyebrows are the theme's
signature: 11px mono, uppercase, `.24em` tracking, led by a 26px rule — use them for every section
head, and the surface self-labels without needing boxes.

The sans/mono rule from §7 is unchanged and fits better here, since the theme is already
mono-forward.

Radius **6** key · **8** display · **10** panel · **999** pill. Flat fills only — no bevel, no
gloss, no gradient, `--engrave-hi` stays `transparent`. 1px hairlines, no shadow except the modal.

### What it costs

This is a **bigger** change than §7, honestly: §7 re-tints tokens the dashboard already has, while
§7b replaces a dark Tailwind-gray surface with a light plastic one, so every `bg-gray-800` /
`text-gray-100` / `border-gray-700` literal in the components has to go. `SketchGallery.jsx` alone
carries dozens. That argues for doing phase 1 (tokens) *properly* — no raw Tailwind gray literals
left — before phase 2, regardless of which register wins.

Two things to verify before committing to light:

- **The LCD must stay darker than the panel.** A world render on `#bcb9af` reads as a lit screen;
  on white it reads as a hole. Every generated scene assumes a dark-ish backdrop today.
- **Sketch SVG export already re-tints for a light surface** (see the `--entity-purple` note in
  `globals.css` and `sketch-svg.js`). A light dashboard and the light SVG export would finally
  agree, which is a point in this direction's favour — today they don't.

## 8. Rollout

Ordered so each phase is shippable alone and none of them breaks a route before its replacement
carries the traffic.

1. **Tokens.** ✅ **Done** (`app/globals.css`). New bay / ink / signal / radius custom properties;
   the legacy names (`--surface-primary`, `--border-color`, `--mode-*`, …) re-point at them, so the
   palette moves without a component change. `body` now uses the Geist stack that `layout.jsx`
   loads and the old `Arial, Helvetica` rule silently overrode. One-line fix to a dead
   `hover:bg-gray-750` in `stashes/page.jsx` (not a real Tailwind shade, so it never did anything).

   The one thing this phase could not avoid: the app carries **~1,700 hardcoded `gray-*` /
   `neutral-*` literals**, so a `:root` change alone would have left the surface half-migrated.
   Both ramps are therefore re-pointed in `@theme`, which moves every literal at once and keeps
   phase 1 a token change instead of a 1,700-site edit.

   Re-pointing a ramp can silently wreck contrast, so every step was measured against its old
   pairing before/after:

   | usage | old | new | |
   |---|---|---|---|
   | `text-gray-100` on page | 16.12 | 16.07 | holds |
   | `text-gray-300` on page | 12.04 | 8.41 | calmer by design; still > AAA |
   | `text-gray-400` on page | 6.99 | 6.82 | holds |
   | `text-gray-500` on page | 3.67 | **4.10** | improves |
   | `text-gray-500` on card | 3.04 | **3.75** | improves |
   | `text-gray-600` on page | 2.35 | 2.39 | holds |

   Step **600** is the one shade not pulled onto a bay token. The app uses it as a hover border
   (169 sites) *and* as its dimmest text (25 sites — separator dots, empty-state hints, disabled
   labels). Mapping it to `--bay-rail-lit` dropped that text to 1.94:1, so it keeps a value at
   parity and `--bay-rail-lit` stays a separate token for new work.

   `--radius-*` is declared but not yet consumed — phase 2 is its first caller.
2. **Display-mode control.** ✅ **Done.** Wire / Shaded / Baked / Painted, on the sketch detail
   page and both gallery preview surfaces (split pane + full-view modal).

   The surprise: **two of the four render paths already existed and had simply never been
   surfaced.** `/api/sketches/[ref]/world` has accepted `?wire=1` all along (`route.js`, feeding
   `emitThreeWorld({ wireframe })`), and `CreationMap` has accepted `mode="wireframe"`. This phase
   is mostly an act of exposure, not construction.

   - `lib/graph/sketch/display-modes.js` — the pure resolver. It is the single place that decides
     what an artifact can do, so the detail page and the gallery can't drift. 13 unit tests in
     `display-modes.test.js`.
   - `components/DisplayModes.jsx` — the control, plus `useDisplayModeState` so both preview
     surfaces share one reset rule (a new artifact starts at *its* default, not the last one's).
   - `render-store.js` gains `hasBoundRender(ref)`; `/api/sketches` returns it per row so the
     gallery can offer `painted` without a round-trip per card.

   Three honesty rules the resolver enforces, each of which a naive four-way toggle would break:

   - **Unavailable is disabled with a reason, never hidden.** `/scene` and `/svg` kinds genuinely
     have no construction reading and say so; a world with no bake says "no GI bake yet, ask the
     agent to bake it".
   - **An `inline-faces` bake has no unlit reading left.** That adapter recolours the world's own
     faces, so `baked` becomes the default and `shaded` reports `bakedInPlace` — rather than
     offering a Shaded button that silently shows the baked render again.
   - **`painted` always carries its provenance badge.** Mojulo owns the geometry, the image model
     owns the paint, and the UI must not let a painted render pass as a mojulo render.

   Back-compat: the older diagram-only `?mode=wireframe` link still works, now folded into the
   control's own `?display=` param. First consumer of `--radius-control`.
3. **Library fold.** ✅ **Done.** `/library` with shelf chips — **Recent · Scenes · Models ·
   Characters · Images · Diagrams · Materials** — replacing `/sketches`,
   `/maker/illustrations`, `/maker/worlds`, `/maker/objects`, which now 307 to their shelf.
   `/sketches/<ref>` detail pages are untouched, so every URL `create_sketch` has ever returned
   still resolves.

   - `lib/graph/sketch/library-shelves.js` + 11 tests — the shelf model.
   - `app/library/page.jsx`, redirects in `next.config.mjs`, one folded crumb in `Breadcrumbs.jsx`,
     one `library` tile replacing four in `workshop-nav.jsx` (its test updated to assert the same
     invariant through the new door), and the `get_ui_map` drawer rewritten.
   - `components/MaterialShelf.jsx` — the **Materials** shelf, the first UI the procedural-material
     registry has ever had. Swatches are real quads through the real `resolveFaceMaterials`, so a
     preset's family is exact. One stated approximation: a cell is flat-filled with the average of
     its four corner fills, where a real face interpolates them.

   **The bug this phase nearly shipped, and the rule that comes out of it.** The first cut fetched
   the store once and filtered in the browser. That reads `SketchRepository.list()` unscoped —
   which caps at `rootLimit` (200). This workshop holds **2,111** sketches, so the Library showed
   200 of them and hid the rest with no indication; the Diagrams chip read **7** where the old
   `/sketches` correctly showed **121**. The repository already carried the warning, in a comment
   about the *other* direction: bucket-scoped reads deliberately scan the whole table "otherwise an
   older game/world silently drops out of its gallery."

   So: **a shelf is a fetch scope, not a client-side filter.** Every typed shelf names the `bucket`
   its request carries and gets the uncapped read; `recent` is the only capped view and is named
   for what it honestly is rather than called "All", with a line saying so. Chip totals come from a
   new `GET /api/sketches/counts` (one server-side scan via `SketchRepository.bucketCounts()`,
   a handful of integers out) — because the client deliberately never holds the whole store, and a
   chip reading "7" over a shelf of 121 is worse than no number at all. A regression test pins it.

   Not done here: dead `home.tiles.{sketch,illustrations,worlds,objects}` and `maker.{...}` keys
   remain in `messages/en.json`. Removing them means a `/sync-locales` pass across ~24 locales;
   `/find-unused-locale-keys` is the tool for it.

   **Unrelated red test, flagged not fixed.** `lib/graph/worlds/world-scene.kinds.test.js` fails on
   the `transportation-hub` payload hash (snapshot expects `69bb9163`, code produces `22a2629f`).
   It is not from this work: import analysis over `world-scene.js`'s 299 reachable modules finds
   exactly one file this branch touched (`lib/db/repositories/sketches.js`, a purely additive
   method), and reverting that file leaves the failure identical. The likely cause is the
   uncommitted `lib/graph/worlds/workbench.js` change in the working tree moving a world payload
   against a committed snapshot. The snapshot was deliberately NOT refreshed — that is the
   workbench author's call to make, and `-u` here would bury the signal.
4. **Turntable cards.** ✅ **Done.** The grid card is now a picture: a still at rest, turning
   through a baked 16-frame azimuth strip while the pointer is on it.

   **The azimuth sweep already existed, and not where §6 pointed.** This section cited the
   `skull-study` / `figure-study` skills, but those drive `renderAnimalToSvg({view, elev})` —
   figures only. The general engine is the motion stack: `cameraPathFor('turntable')`
   (`lib/motion/camera-path.js` — a full 360° `orbitPath`, backend-agnostic) driven through
   `renderWorldFrames` (`lib/motion/world-frames.js`), which loads the World ONCE and drives it
   a frame at a time over the capture bridge — one Chromium, one WebGL context and geometry
   upload for all 16 frames, so cost is per-frame screenshot, not per-frame init. `forge_motion`
   already wires those two together in `renderWorldMotion`. The strip bake calls it and lays the
   frames out in a row; that is the whole of the new rendering code.

   - `lib/graph/sketch/turntable-strip.js` + 14 tests — the pure planner (import-light, so the
     client bundle carries it): which kinds turn, the cell/frame/fps contract, the strip geometry.
     The single place that decides, so the card, the route and the mint-time warm can't drift.
   - `lib/graph/sketch/turntable-bake.js` — `renderWorldMotion` → sharp row composite, disk-cached
     under `data/turntable/<ref>-<hash>.png` with a bumpable `STRIP_CACHE_VERSION`, same shape as
     the scene-PNG cache.
   - `app/api/sketches/[ref]/turntable.png` — serves it, ETagged on the cache key (edit the
     manifest and the strip re-bakes; leave it alone and the browser never refetches).
   - `components/TurntableCard.jsx` — `useTurntable` (state + the hover handlers the card ROOT
     spreads) and `<TurntableThumb>` (draws), split the way phase 2's `useDisplayModeState` /
     `<DisplayModes>` are.

   **Not "at mint time" — still by default, strip on first hover.** A browser launch plus 16 WebGL
   frames is ~8s per world. On the mint path that is latency on every `compose_world`; on a naive
   lazy path it is 24 simultaneous browser launches the first time someone opens the Library. So
   the card shows the cheap still it can already get, and mints its strip the first time someone
   actually hovers it, behind a queue that dedupes concurrent requests for the same strip and runs
   one bake at a time. Nobody waits for a card they didn't look at.

   Mint-time warming still happens, just off the critical path: `warmScenePng` was ALREADY a
   fire-and-forget background bake at every mint/update seam, so the strip is one more deferred
   bake inside it — ordered after the still, with its own `MOJULO_DISABLE_TURNTABLE_WARM` opt-out.
   Zero new call sites, and a freshly minted world is warm by the time the operator opens the
   Library.

   **The one piece of arithmetic here, and the naive version is wrong.** A percentage
   `background-position` aligns the image's p% point with the box's p% point, so for an N-cell
   strip in a one-cell box, position p lands on frame `p·(N−1)/100`. Animating `0% → 100%` with
   `steps(16)` — the obvious form — therefore lands on frame `15k/16`: a fraction of a cell for
   every step but the first. Ending at `100·N/(N−1)` lands on whole frames. Verified in a real
   browser by pausing the animation at each of its 16 steps and diffing the box against the cell
   extracted from the strip: **0.000 mean channel difference on all 16**, against up to 13.3/255
   for the naive `100%`. A unit test pins the algebra; `stripEndPercent` keeps it out of the CSS.

   **The rest frame is free.** §6 asks reduced motion to freeze at the ¾ frame because it is the
   best single still. Frame 0 of `orbitPath` IS the base shot, and `deriveBaseShot` takes that from
   the world's own authored `cameras[0]` when it has one, falling back to a ¾ of the bounding box.
   So the rest frame is either the author's hero shot or a ¾, by construction — nothing has to
   choose it, and reduced motion never requests a strip at all.

   **Which shelves actually turn.** Render modes `world` and `scene` — which is more than it
   sounds: walkable worlds AND every orbit-only object (workbench, assembler, the science and
   education views, polygomer manji-trees), plus the CSS-3D turntable and subway station, all of
   which resolve a World payload so the bake path is uniform. `svg` and `diagram` don't turn and
   say so (`reason: 'flat'`) — a flow chart has no ¾ view — but still get a picture, the cheap
   `/svg` still. Beats, voice, games and motion comics report `noStill` and keep their icon: heard,
   spoken, played, clicked-through, never looked at.

   **A gap the strip closes on the way past.** Running the grid for real turned up something the
   plan never asked for: the orbit-only kinds — planetary, the science and education views — have
   no CSS-3D `/scene` form, so `/png` 422s for them and they have **never had a gallery thumbnail
   at all**, a v1 gap documented in `sketch-manifest.js` and left standing since. Their turntable
   bakes fine. So a card whose still fails adopts the strip instead, and a `trig-circle-view` that
   showed a file icon now shows itself.

   That promotion is strictly `?cached=1` — serve an already-baked strip or 404, never bake —
   because unlike a hover it fires with nobody asking, and a shelf of a hundred such views would
   otherwise enqueue a hundred bakes on load. Which means the gap closes going FORWARD: the
   mint-time warm bakes every new world's strip, so a freshly minted view has a thumbnail on first
   sight, while an older one keeps its icon until someone hovers it and mints one. That is the
   whole posture of this phase in one seam — the future arrives warm, the past stays cheap.

   Three smaller things the same pass fixed. The still is **`object-cover` only where a strip is
   coming**, because the cold still is a different renderer at a different aspect (world kinds bake
   theirs from the CSS-3D emitter, the strip from three.js) and letterboxing it would make the
   subject jump size the moment the strip arrives; a flat artifact has no strip to match, so it is
   shown whole rather than cropped for nothing. The icon sits **under** every still rather than
   instead of one, so a card whose PNG is still baking reads as pending instead of as a void. And
   once a strip has loaded it **owns** the card — parked on frame 0 at rest, running on hover — so
   the still-to-strip swap happens once per card, not on every hover.

   One thing observed and deliberately not fixed: **framing is the world's own.** `deriveBaseShot`
   prefers the authored camera, which for a wide establishing shot leaves the subject small in a
   256×192 cell (the mug-on-table and the city read well; the wizard sits small). `emitThreeWorld`
   has a tighter showcase fit, but only inside `applyCam` under `?spin=1`, and the capture drives
   the camera directly — reusing it means threading a second camera policy through the bake, which
   is its own change.

   Not done here: the Library still opens in split view, so the turning grid is behind the
   view toggle. Making the grid the Library's landing surface belongs with the viewport home
   below, not smuggled in here — the full view is also the bulk move/delete surface, and that
   action bar should not become the first thing the Library shows.
5. **Render Bay.** ✅ **Done.** `/render-bay` — three lanes over the four expressions of
   "mojulo is producing something", none of which is a new data model and one of which had never
   been drawn at all.

   - `lib/render-bay/lanes.js` + 41 tests — the shared vocabulary: the status→stage→signal map,
     the ref fold, the two gates, the output-file taxonomy, and the copy-prompt text. The page,
     the route and the tests read the same module, so they cannot drift about what a state means.
   - `lib/render-bay/outputs-scan.js` + 8 tests — the disk read, because exports have no ledger.
   - `RenderRequestRepository.listRecent` / `.statusCounts`, `SketchRepository.giBakes` — the three
     reads the lanes needed and the repositories didn't have.
   - `app/api/render-bay/route.js`, `app/render-bay/page.jsx`, a studio tile, a crumb, and the
     `get_ui_map` drawer.

   **§5 named three stages and there are four, because three conflates the two gates.** "Queued /
   in flight / done" has no room for `submitted` — which is *precisely* the state where the machine
   has finished and nobody has looked. Folding it into "in flight" would hide the one gate the same
   section asks to make visible. So `gate` is its own stage, and it is the only stage whose rows are
   never folded (below), because `accept_image_render` takes exactly one `request_id` and every PNG
   needs its own look.

   The bakes lane makes the same distinction the other way. A `giBake` row EXISTS only because the
   machine gate already passed — `bake-world-gi.mjs` fails before it binds anything — so the machine
   gate is reported as passed **with its measured numbers** (corner match, dark-floor fraction
   against the 25% limit) rather than re-derived. The eyes gate has no column: nothing anywhere
   records that the operator looked. So it reports itself as unrecorded and stays theirs to make,
   instead of borrowing the machine's verdict. Reading `docs/bicycles.md` and then rendering
   "machine gate passed · 94% corner match · 1% dark floor" beside "eyes gate: yours — open it and
   look" is the whole doctrine in one row.

   **The defect the real workshop exposed, and the fold that answers it.** The first cut listed one
   row per request, which is what the table holds. On this host that is 66 pending rows — and a
   sequential-art page parks one request per panel while a keyframe clip parks one per mouth shape,
   so 25 of those 66 were the same clip. The result pushed the eyes gate, both other lanes, and
   everything the bay exists to show off the bottom of the screen. Twenty-five pending targets on
   one clip is ONE artifact waiting, and that is what the operator is deciding about. So every stage
   but the gate folds to one row per ref: 66 rows became 14, and `pull_image_render({ ref })` — which
   drains exactly one sketch's requests — means the fold matches the tool's own grain rather than
   merely tidying the page. Nothing is hidden: the group keeps every request, every target, the
   newest movement, and the OLDEST pull, so a sibling claimed a moment ago cannot reset a stall
   reading that six others have earned.

   That fold is also why the queue lane reads the active statuses **whole** rather than capped. A
   partial read would make the fold lie about how many targets an artifact is waiting on, and it is
   affordable precisely because the active set is bounded by what the operator has parked, not by how
   long the workshop has existed. The unbounded half — `accepted`, 279 rows here — stays capped, with
   its true total from `statusCounts()` beside it.

   **`/outputs` is deliberately NOT folded in**, though §2 lists it under this bay. The Library fold
   collapsed four routes because they were one gallery with a different prop; `/outputs` is not that.
   It is a distinct inbox with real filters and an archive action, and a read-only bay cannot carry a
   mutating surface without demoting it. So the bay shows the newest publications and links out, both
   doors stay, and a nav test pins the decision so it reads as a choice rather than an oversight. For
   the same reason each outputs group caps at 12 rows and `?limit=` does not raise it — the bay
   watches production, and a second forty-row inbox stacked under the queue would bury what is moving.

   One thing measured on the way past: `unixepoch()` has **second** resolution, so rows parked in one
   tick share an `updated_at` and order by rowid within that second. Real movement is seconds apart,
   so the ordering rule holds — but a test that leaned on the tie would have been asserting insertion
   order, and the one that nearly did now pushes its stamps apart by hand and says why.

   Not done here: `data/outcomes/` is scanned per request (a readdir plus a stat per file, ~300
   folders on this host). That is fine on local disk and honest — the disk cannot disagree with
   itself — but it is the first thing to cache if the bay ever polls.
6. **Viewport home.** ✅ **Done.** `/` is a workshop instead of a menu: a live artifact on the
   landing surface, an outliner reading its recipe, an inspector, and a status bar — over pieces
   phases 1–5 had already built, which is exactly why §8 put this last.

   - `lib/graph/sketch/outliner.js` + 26 tests — the outliner tree, the HUD facts, the scale
     statement, and the head pick. Import-light, so the client bundle carries it.
   - `app/api/home/route.js` — one request for the whole home. Six waterfalled fetches is what the
     drawer version felt like.
   - `components/ViewportHome.jsx`, `app/page.jsx`, `SketchRepository.recent()`,
     `scanOneOutcome()`, the `home3d` message block, and the `get_ui_map` drawer.

   **The outliner reads the recipe's own shape, because there is no shared spine to walk.** §3 says
   mojulo "genuinely has a tree (scene → parts → materials → bound audio → bakes)". It has trees,
   plural, and they do not agree: a `workbench` is lathes + extrudes + sweeps + drapes, a
   `fractal-city` is elements + civicAreas, a `controllable` is entities + camera + ground + audio.
   Walking a fixed spine would have produced an outliner that was right for cities and empty for
   everything else. So the rail reads the manifest's own top-level structure — named where mojulo
   has a word for what it found, *italic and unlabelled where it doesn't*, never nothing. Running it
   against the plan's own vocabulary diagram is the proof: `Stations 13 · Edges 6` named, `marks 17 ·
   neoRembrandt 46` admitted as structure it has no word for. An outliner that hid what it could not
   label would lie about the recipe.

   **The view-cube already exists, and it is inside the frame.** §3 asks for front/side/top/¾ camera
   presets in the viewport corner. `/world` already serves its own HUD strip — view cams, wireframe,
   fly/walk — unless you pass `?hud=0`, and the camera lives in the world's own three.js context
   where nothing outside the iframe can reach it without a postMessage protocol that does not exist.
   So the camera control stays where it already works and the strip outside carries READOUTS instead.
   Same shape of finding as phase 2's: the capability was there and simply never surfaced.

   **Two things §3 asked for that would have been false on screen.**

   - *"1 unit = 1 m · stl-ready"* is not true by default. `facesToStl` multiplies by `scale` and
     slicers read STL units as **millimetres**, so the default export is 1 unit = 1 **mm**, and only
     a handful of kinds (workbench) declare `units` at all. Print-at-true-scale is one of mojulo's
     differentiators; a readout that gets it wrong is worse than no readout. So the strip says what
     is true — the declared unit when there is one, plus the `scale` that would print it at true
     size (`1 unit = 1 m · print true scale with scale: 1000`), and `units undeclared · stl reads
     1 unit = 1 mm` when the recipe never said. Both readouts are hidden entirely on flat kinds: a
     flowchart has no STL, and the first cut shipped one under a flowchart before the real data
     caught it.
   - *"tri count"* costs a full `resolveWorldScene` — tens of seconds for a big world. The home must
     not pay that to draw a strip of text, and must not show a number it guessed. The strip says
     where the number lives (`export_model`) instead.

   **The shell is not pinned to the viewport height.** `h-screen` measures the whole window while
   the home starts BELOW the app's nav + breadcrumb chrome, so the status bar fell off the bottom by
   exactly the chrome's height — a height that varies by route. It grows and the page scrolls like
   every other page; the viewport pane keeps a tall minimum so it is still the largest thing on
   screen, which was the point.

   **An empty workshop falls through to the old launcher.** §3 wants the orientation gallery
   turntable here, and that is `mojulo-orient` — an MCP surface the AGENT drives, consent-first, that
   mints a real artifact into the operator's store. A dashboard cannot take that consent on the
   operator's behalf, so the honest version is the tile launcher, which is already the "here is what
   is here" invitation. `HomeLauncher` is therefore kept rather than deleted, and it also catches a
   failed read: a broken home should still open its doors.

   Not done here: `?ref=` opens any artifact in the three panes, but nothing navigates INTO it yet —
   the outliner branches don't select, and the Library doesn't link back. The revision list §3 puts
   in the Inspector has no store to read: `beats_revisions` exists, the sketch equivalent does not.

## 9. Invariants this plan does not touch

- The dashboard is **not** a conversational surface. Every affordance above is render-state or a
  copy-prompt. No `HomeAgentChat` / `useAgentChatStream` consumer is added.
- No primitive, tool, or table is renamed. The vocabulary lives in the i18n messages and the route
  layer.
- Every string added is i18n-ready in `messages/en.json`, then propagated with `/sync-locales`.
- Presence gating stays: Runtime bays appear only when their `presence` count is positive, and a
  creative-only install simply never grows them.
- Install-group honesty: the status bar reports `installedGroups()` rather than the UI quietly
  having fewer tiles than a doc promised.

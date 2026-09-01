# 3D Factory UI — revamp plan + style guide

Status: **phases 1–9 shipped** (2026-08-31). The rollout in §8 is complete; each phase's entry there records what it actually cost and where the plan was wrong. Phases 7–9 landed after it: the splayed floor (§10), the rooms (§11), and the view-cube protocol (§12). Light mode is PLANNED, not built: §13.

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

## 7c. The brand layer — blocking, the mark, the latent field

*(drafted 2026-08-31, from the `mojulo-ui-treatments-v1` wireframes, for the 2.0 reposition.)*

§7 is the **system**: what a hue means, what a typeface attributes, how big a radius is. This
section is the **brand layer** that rides on it — how a page is blocked out, what the mark is, and
the one texture that means something. It adds no token a component branches on and changes no
meaning §7 fixed. Where the wireframes and §7 disagreed, §7 wins; the reconciliations are recorded
at the end so the disagreement is not re-litigated later.

The register the wireframes found, in one line: **an instrument has a case and internal partitions,
not a tray of floating cards.**

### The blocking rule — one frame, shared hairlines, no gutters

This is the change with the widest reach and the least risk, and it is the reason to do the pivot
at all.

A surface is **one bordered frame** — `1px --bay-rail-lit`, `--radius-bay`, `overflow:hidden` —
divided into regions by hairlines those regions **share**. A region is defined by the rule beside
it, not by a border of its own and a gap. Concretely:

- The frame owns the outer border and the only radius on the page.
- Every internal division is a single `1px --bay-rail` edge, contributed by ONE side
  (`border-r` on all but the last column; `border-b` on the nav; `border-t` on the status bar).
  Two adjacent regions never both draw a border, so a division is never 2px.
- Regions carry **padding, not margin**. There is no gutter between a viewport and its inspector —
  they meet at the rule.
- Inside a region, a card may still float (`--radius-card`, `1px --bay-rail`) — but it is then a
  *thing on a bench*, and it must be an artifact, a queue item, or the amber prompt. Never a
  layout device. Layout is done by the partitions.
- Elevation is by VALUE, not by shadow: `--bay-void` page → `--bay-floor` panel →
  `--bay-bench` card. One shadow on the page, on the frame itself. None inside it.

Why it reads instrumental: the shared rule tells you the two regions are parts of one machine,
where a gutter tells you they are two documents that happen to be near each other. It is also
strictly cheaper — no gap math, no per-card border, no shadow stack.

**What today does instead.** The tree carries **237 `rounded-lg` + 149 `rounded-md` +
55 `rounded-xl` + 12 `rounded-2xl`** against only 43 uses of the `--radius-*` tokens, and
**121 `border-t`/`border-b` against 14 `border-l`/`border-r`** — i.e. horizontal stacking by rule
is already the habit, vertical partitioning is not, and almost every panel is a floating rounded
box. Adoption is therefore mostly *subtraction*: drop the radius and the border from panel-level
boxes, hand the border to the frame, convert gaps to a shared edge.

Nav, status bar and eyebrows already agree with this — `ViewportHome`'s `Eyebrow` is the
self-labelling device that makes a partition legible without a box around it. Keep it; it is the
same idea §7b independently arrived at.

### The mark — the dot-relief `m`

The 2.0 mark is the lowercase `m` rendered as a **halftone relief**: a fixed 18×15 dot lattice
where ink dots swell toward the letterform and latent dots hold the field, with a left-to-right
size gradient so the mark has a light direction. It replaces the three-card teal gradient in
`app/icon.svg`.

It is the same grammar as the field and the dot rows below, which is the whole point: the mark is
not a logo parked in the corner, it is a sample of the display system.

**Bake it, do not sample it.** The wireframe derives the lattice at runtime by drawing the glyph
to a canvas and running ~270 `getImageData` reads. That cannot server-render, repeats on every
navigation, and is invisible to the theme. Ship instead a **precomputed dot map** (one small JSON
or a static SVG of `<circle>`s, generated once by a script under `scripts/`) rendered as inline
SVG with `fill="currentColor"` — then it SSRs, inherits ink colour, costs nothing per navigation,
survives the §13 light flip for free, and can be CSS-animated.

Sizes: 20px in the nav, 40px as an empty-shelf ghost at ~35% opacity, 120px as the boot mark. The
empty state is the mark at rest, not a sad icon — the brand IS the placeholder.

### The latent field — one meaning, enforced

A Ben-Day dot field (`radial-gradient(circle, <dot> 1px, transparent 1.4px)` at `11px 11px`) means
exactly one thing:

> **Space that can be minted into, and has not been yet.**

Two densities: `--field` (`--bay-rail-lit` dots) where the invitation is the point — an empty
viewport, an empty shelf card, a library thumbnail plate — and `--field-faint` (`--bay-rail` dots)
where it is a backdrop behind something live.

That single meaning is the load-bearing constraint. The wireframes used it for three different
things — mintable space, "still potential until a human looks" at the eyes gate, and the fleet
map's ground plane — and a texture with three meanings is decoration, which is the failure mode
§7 exists to prevent. So:

- **Keep** it under empty viewports, empty shelves, and artifact thumbnails (the card then reads as
  a thing that condensed out of the lattice, which is exactly what a recipe is).
- **Drop** it from the fleet-map ground plane. Running processes are not latent space; a labelled
  rule between the air and ground planes does that job.
- **Drop** it from the render bay's eyes-gate column. That column is not unminted — the render
  exists; what is missing is a human's verdict. Amber already says that, and it says it better.
- **Never** on deliberation surfaces (`/plan`, `/research`). Plans are words, not artifacts.
  The wireframes got this right and the rule stands: no field where nothing mints.

### Dots as a data primitive

The lattice's atom becomes a readout, so counts and progress are drawn in the mark's own grammar
rather than in bars borrowed from a generic dashboard:

- **Dot row** — N cells, filled in `--live` for present / `--live-idle` for partial /
  `--bay-rail-lit` for absent. Used for shelf tallies (`scenes 4`), render progress, and the beats
  scrubber. Always paired with a numeric label; the dots are the shape of the number, never a
  replacement for it.
- **Dot-column waveform** — audio drawn as halftone columns rather than a line, played region in
  live teal, unplayed as latent dots. Seeded, never `Math.random`, same as everything else here.
- **Node dots** on the map: `--live` running, `--think` speculative, `--bay-rail-lit` stopped.

A dot row is a **presence** display, not a precision one. Anything the operator would compare or
audit stays a mono number — the dots sit beside it.

### Reconciliations — where the wireframes were overruled

Recorded so these do not come back:

- **Indigo stays `--think`.** The wireframes bound indigo to "orbit & connected services", which is
  a hue meaning *section* — the exact thing §7 repudiated — and they then contradicted themselves
  by using it correctly for a *proposed* plan. Orbit-vs-walkable is a **kind**, not a state: tag it
  with a glyph or a label. `--think` keeps meaning speculative.
- **Token VALUES are §7's.** The wireframes re-declared a neutral-gray, higher-saturation set
  (`#0a0a0a` / `#00e5c0` / `#7c6dfa` / `#f5a623`). Keep the shipped bay/signal values: the
  blue-tinted neutrals are what let a lit viewport read as the light source in the room, and
  `#7c6dfa` is a saturated violet that walks straight back into the purple-gradient AI look §7 was
  written to avoid. The treatments read the same in the shipped palette.
- **Five signals, not three.** `--seal` and `--fault` appear nowhere in the wireframes, and the
  eyes-gate column is precisely where a *rejected* render lives. A reject affordance uses
  `--fault`; do not let the amber gate absorb the failure state.
- **The sans/mono attribution rule survives.** The wireframes are globally mono, which is a
  wireframe convention and not a proposal. §7's rule stands: mono is what the recipe stores or the
  agent typed, sans is what a person wrote.
- **11px is the floor.** The wireframes' label layer sits at 8–9px uppercase on `--ink-muted`.
  Eyebrows are 11px mono / `.24em` (as `ViewportHome` already does); 10px is the absolute floor for
  a dense readout, and nothing goes below it.
- **The library keeps the splayed floor.** Wireframe 02 draws `/library` as a flat four-column chip
  grid, which predates §10–§11. The floor, the zones and the rooms stand; the brand layer applies
  *to* them — field under the empty and thumbnail plates, dot rows for the shelf tallies, shared
  hairlines between zones instead of gutters.

### Motion

One boot gesture: the latent field sweeps in, content pops over it. Fire it **once per session on
the home surface only** — a local dashboard gets hit hundreds of times a day and a per-navigation
animation becomes a tax within an hour. The print-pass shimmer is the loading state for a rendering
artifact; magnet-on-hover belongs to artifact cards only.

All of it goes under the existing `prefers-reduced-motion` block in `globals.css`, which already
freezes the turntables and the launcher lift.

### Rollout — phase 1 shipped

**B1. Primitives + the two anchor surfaces.** ✅ **Done** (2026-08-31).

- `app/globals.css` — `--field-dot` / `--field-dot-faint`, and the utilities
  `.moj-frame`, `.moj-part-r` / `.moj-part-b`, `.moj-field` / `.moj-field-faint`,
  `.moj-field-boot`. The partition classes drop their rule on `:last-child`,
  which is what makes them safe to apply from a `.map()` and is why a division
  can never come out 2px.
- `scripts/build-brand-mark.mjs` → `lib/brand/mark-dots.js` — the mark, baked.
  No canvas: the glyph is five round-capped strokes, so coverage is a distance
  test, which makes the bake dependency-free and exactly reproducible. Emits both
  readings from one geometry — the 18×15 lattice and the plain strokes.
- `components/brand/MojuloMark.jsx` — **the size floor is enforced in the
  component, not left to call sites.** A contact sheet settled it: below ~28px a
  cell is about 1px and the relief turns to mush, so asking for a smaller `size`
  silently returns the solid reading of the same skeleton. That is what keeps the
  favicon and dense chrome legible without anyone having to remember a rule.
- `components/brand/DotRow.jsx` + tests — the readout.
- `app/render-bay/page.jsx`, `components/floor/SplayedFloor.jsx` — the blocking
  pass on the two anchor surfaces. Also fixes a standing §7 violation: the floor's
  zone headers carried a `border-b-2`, and hairlines are 1px, always. The zone now
  gets its weight from the *lit* rail value and a padded band instead.

Two things this phase got wrong first, both worth keeping written down:

- **The generator wrote on import.** The test that proves the committed lattice
  re-bakes identically imports the generator — and a top-level `writeFileSync`
  meant that test rewrote the very file it was checking, so it could never fail.
  The bake is now pure and the CLI is behind an entry-point guard, with the
  staleness check itself pinned as a test.
- **The first dot row was decoration.** It filled one dot per unit and saturated
  at seven, so on the real store — scenes 335, models 1144, characters 71 — every
  shelf drew a full row and the readout said nothing. A dot row now renders a
  PART against a WHOLE it can actually be a fraction of (a shelf's share of its
  zone), and the cell count went 7 → 10 because seven could not separate a 4.6%
  shelf from a 21.6% one once "never show a real quantity as empty" applied.
  The rule that falls out, and that the tests pin: **a row that can sit
  permanently full is the wrong component.**

**B2. The rest of the surfaces.** Not started. Per-surface and independently
shippable: `/library` rooms, `/beats/<ref>`, `/map`, `/plan` (frame and
partitions only — no field, nothing mints there).

**B3. The favicon.** Open. `app/icon.svg` still carries the three-card teal mark.
The relief cannot survive 16px and `MojuloMark`'s solid reading is the honest
replacement, but swapping the tab icon is a visible brand change with reach
beyond the dashboard (npm, README, docs), so it wants the maintainer's eyes
rather than a silent commit.

### What it costs

Cheaper than §7b, in three parts:

1. **Two CSS utilities and two tokens** — `.moj-field` / `.moj-field-faint` plus `--field-dot` /
   `--field-dot-faint`. Free, and they flip with the theme.
2. **The mark** — one generator script, one baked asset, `app/icon.svg` replaced, plus the npm/README
   and any doc using the card mark. Bounded and mechanical.
3. **The blocking pass** — the real work, and it is per-surface, not global. Each surface is
   independently convertible (frame the shell, hand borders to the partitions, delete the gaps), so
   this lands one route at a time behind no flag. Start with the home floor and the render bay,
   where the partition reading is strongest and both are new enough to have few callers.

Nothing here blocks §13. The blocking rule is value-independent, the field takes its dot colour
from a token, and a `currentColor` mark inherits the flip.

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

## 10. The splayed floor — the library is the front door

*(phase 7, 2026-08-30 — one level up from §3's viewport home, at the maintainer's direction:
"the library needs to splay on the main UI … sort creative work to 3D and 2D.")*

The viewport home put one artifact on the landing surface; the splayed floor puts the **library**
there. `/` renders a bench band (the §3 viewport, kept, with its poster still painting first and
the live iframe mounting only after browser idle) over two zones with real typographic weight:
**3D** — scenes, models, characters, materials — then **2D** — images, diagrams. The zone split is
DERIVED, not curated: it is `sketchRenderMode`'s walk-vs-orbit-vs-flat answer, summed from the
same bucket tallies the shelf chips read. Sound / Build / Notes / Runtime demote to one presence-
gated row. The outliner/inspector reading of a single artifact did not die: it is `/?ref=` now, the
bench's deep view rather than the landing surface.

Decisions worth recording:

- **A strip is a storefront, not the store.** Each shelf shows its freshest few faces in its own
  card register (turntable cards for models, cast cards with a figure/sheet/sprites kit line for
  characters, reading-room rows for diagrams); the header opens the shelf's `/library` room, and
  the status bar says the cap out loud. `lib/graph/sketch/library-zones.js` (pure, tested) is the
  one place the floor's shape lives.
- **Iteration chains fold.** Rows sharing a title stem collapse to one face with an `×N` chip;
  characters fold by NAME (the segment before a spaced dash). Both are stated heuristics: a stem
  that fails to match leaves a solo card, which is always correct, just less folded. The real
  store proved the need — back-to-back 116-sibling QA chains were the whole illustration window.
- **The wire stays light.** `/api/home/floor` is one request carrying ref / title / kind /
  renderMode / badge facts — never a manifest (a city manifest is tens of KB and the floor draws
  ~30 faces). `SketchRepository.newestByBucket()` feeds it in a single whole-table scan (the same
  cost `bucketCounts()` already pays) instead of four bucket scans. `renderMode` rides along so
  cards resolve stills via `resolveTurntableForMode` without manifests — `useTurntable` split into
  a resolver + state machine for this, no behavior change on the gallery side.
- **Lazy by default.** Below-fold strips are IntersectionObserver-gated skeletons (row-shaped for
  diagrams, card-shaped elsewhere); every card image is `loading="lazy"`; the bench hero is the
  ONLY live context and it waits for `requestIdleCallback` behind its poster, with a spinner that
  clears on iframe load. Reduced motion: skeleton pulse and spinner are `motion-reduce`-frozen,
  and the turntable cards already rest at their ¾ frame.
- **Provenance on the wall.** Painted faces (bound external renders) badge in forge amber on the
  strip itself, not just in a detail view — `docs/bicycles.md` posture.

Not done here, deliberately: the `/library` rooms are still the round-1 gallery (the contextual
room bodies — location board, turntable wall, cast board, print wall, reading room — are the next
phase over the same `LIBRARY_SHELVES` dispatch the Materials shelf proved); scene cards keep the
4:3 turntable cell rather than the wireframes' 16:9; and `/sync-locales` still owes the `floor`
namespace to the non-English locales.

*(Amendment, 2026-08-31, at the maintainer's direction: the floor's bays row is no longer an
inline row — `BaysMenu` in `SplayedFloor.jsx` is one trigger that opens the global
`WorkshopDrawer`, so the floor keeps a single nav model instead of an inline duplicate of it.
The trigger reuses `home.drawer.open`, so no new locale debt.)*

## 11. The rooms — one contextual body per shelf

*(phase 8, 2026-08-30 — the round-1 wireframes' shelf views, landed behind the floor's strips.)*

Every `/library` shelf now opens as a room: scenes → the **location board**, models → the
**turntable wall**, characters → the **cast board**, images → the **print wall**, diagrams → the
**reading room**. The dispatch is a `view` field on `LIBRARY_SHELVES`, resolved in
`SketchGallery` exactly where `registry: true` already swapped in the material shelf — §2's bet
that the shelf model could carry per-shelf bodies paid off without touching fetch scopes, counts,
folders, or the detail pages. `components/rooms/LibraryRooms.jsx` holds all five plus the shared
chrome (facet chips from `ROOM_FACETS` in library-zones.js, room search, stack chips, badges).

Decisions worth recording:

- **The room is a reading; management is a capability.** The Split/Full toggle relabels to
  Room / Full folder view on room shelves. Folders, bulk select, move and delete all stay in the
  full view — the room never grew its own management affordances, so nothing was re-implemented
  and nothing can disagree.
- **Rooms read the fetch the gallery already made.** Full manifests were already on the wire for
  every bucket-scoped list; the rooms spend them (outliner facts, CreationMap expands, seed
  readouts) instead of re-fetching. The floor stays light; the room is where the manifest earns
  its weight.
- **Folding is universal.** `collapseStems` gained a `siblings` filmstrip (newest first, face
  included) so the wall's drawer and the board's focus rail can walk a chain in place. The print
  wall folds too — the same 135-sibling QA chains that swallowed the floor's window would have
  hung two hundred identical prints.
- **The one amber affordance.** The cast board's missing-kit chips are copy-prompts
  ("Ask agent: mint sprites"), the §3 inspector pattern reused — state rendered, ask handed to
  the host agent, dashboard never mutates.
- **Live frames stay on demand.** The board's focus iframe is the only live context a room can
  mount, and only after a scene is selected; everything else is stills, strips, and lazy images.
- **Selection is a MODAL, not a panel.** The first cut put the wall's drawer and the board/cast
  focus above or beside the grid — which teleported a selection made deep in a thousand-model
  wall to the top of the page and made the operator scroll back up (maintainer caught it).
  All three now open a shared `RoomModal` over the grid — esc, click-away, or ✕ dismisses —
  the same dismissal grammar as the print wall's lightbox, so the four selection surfaces agree.

Not done here: the board focus keeps the plain `/world` frame (no view-cube preset strip yet —
closed by §12); the wall drawer shows recipe facts but not the full mono JSON (that stays on the
detail page); `/sync-locales` still owes `floor` + `rooms` + `library.roomToggle` to the
non-English locales (deliberately last, per the maintainer).

## 12. The view-cube protocol — the parent finally gets to ask

*(phase 9, 2026-08-31 — the seam phases 6 and 8 both recorded as missing: "a postMessage
protocol that does not exist." Now it exists, and it is the smallest one that could.)*

Two messages in [lib/graph/scene/view-cube-contract.js](../lib/graph/scene/view-cube-contract.js)
(+ contract test), speaking the same `{ moj }` dialect as the game shell's level contract on the
same wire: the world announces `world-view-ready` once on boot; the parent may then post
`world-view` with a named preset — **¾ / front / side / top** — and the frame snaps to an axis
reading of the subject's own bounds. The camera never leaves the frame's three.js context; the
parent only ever asks.

Decisions worth recording:

- **Protocol-gated, not kind-guessed.** `WorldViewStrip` (components/WorldViewStrip.jsx) renders
  only after ITS frame says ready — `useWorldViewProtocol` checks `e.source` against the mounted
  iframe's `contentWindow`, because a page can hold several live worlds (bench hero + board
  focus) and each strip must answer for its own. A CSS-3D `/scene` frame, a plain image, or a
  frame that failed to boot never announces, so no dead buttons — the same shape as phase 4's
  `?cached=1` posture: capability observed, never assumed.
- **The fit is the showcase fit.** `applyView` separates the subject from the studio floor
  exactly the way the `?spin=1` fit does (fit what stands above the lowest 4% z-slice, centre on
  the full box), so a mug on a big studio floor fills the frame instead of shrinking to the
  floor's extent. `top` carries an epsilon off-axis because a view direction parallel to
  `camera.up` degenerates OrbitControls' orbit basis; front/side carry a small +z lift.
- **Walk mode owns the camera.** A preset is an orbit affordance; `applyView` is a no-op while
  walking, and a `?spin=1` showcase stops self-rotating the moment a view is asked for — same
  rule as grabbing it.
- **Consumers: the home viewport (§3 finally gets its view-cube, outside the frame) and the
  board focus (§11's named leftover).** The frame's own HUD (authored cams, wireframe, fly/walk)
  stays where it already works; the strip only adds what the parent could never do before.
- **The Library links back to the bench.** `OpenBenchLink` (`rooms.openBench`) sits beside the
  recipe link in the wall drawer and the board focus — `/?ref=` was reachable from nowhere, the
  other half of phase 6's "the Library doesn't link back". The cast modal deliberately doesn't
  carry it: it has no link footer, and its kit pieces already navigate.
- **Emission changed for EVERY world, and the characterization net said so.** The view-cube
  block is unconditional in `emitThreeWorld`, so all 46 fixture hashes in
  `emit-channels.char.test.js` moved; snapshots refreshed in the same change, named here per
  that test's own rule. `emit-parse` (49) and the full scene layer (317) run green. The ready
  post is harmless in capture/bake contexts — headless frames have no listening parent.

**Second pass, same day — the focus verb and the last strip.** The two capability leftovers
above closed together, because the second is five lines once the first exists:

- **`world-focus` is the protocol's second verb.** The ready handshake now carries `groups` —
  the frame's REAL render-group names — and the parent may post `{ moj: 'world-focus', group }`
  to isolate one (every other group mesh dims to 0.08 opacity; `null` clears). The emission
  changed again for every fixture (ready payload + listener), snapshots refreshed, named here;
  scene layer 319 green.
- **Selection is offered over what EXISTS, not what the recipe implies.** The outliner's
  manifest branches (`entities 5`, `elements 120`) have no render-side identity — most worlds
  merge to one `static` mesh, and faces only carry a `group` where a kind authored one (shell
  walls, instanced repeats). So the bench rail grows a **Render groups** band listing exactly
  what the frame announced (`static` dropped via `selectableGroups` — isolating the whole world
  means nothing), clickable to isolate, click-again to clear. A merged city shows no band at
  all: absent, not disabled, because the absence is the truth about that world's render. Making
  the RECIPE branches clickable would have been fake selection; this is the honest subset.
- **Focus outranks the cutaway, and state lives with the protocol.** `updateCutaway` reads the
  focus group per frame, so an isolated wall holds opacity from any angle instead of
  auto-hiding; on the React side `focused` lives in `useWorldViewProtocol` (cleared when the
  frame remounts — a stale isolation must not carry into a fresh world), and the wire write
  rides an effect so the state updater stays Strict-Mode pure. In `ViewportHome` the hook
  lifted from the viewport pane to the body, because two panes now read it (strip + rail).
- **The detail page mounts the strip.** Keyed to the display-mode frame only — the beats /
  game / play frames share the same `frameRef` but never announce ready, so the gate holds
  by construction.
- Stated, not hidden: textured label sub-meshes and glow sprites ride outside the group dict
  and stay lit under focus; wireframe mode hides fills entirely, so isolation only reads in a
  filled mode.

Not done here: focus dims but doesn't outline — a highlighted edge cage on the focused group
would read better in busy interiors; the rail's Render groups band shows raw group names
(`shell:northWall`), the machine register being honest rather than translated; `/sync-locales`
owes `viewCube`, `rooms.openBench`, and the new `outliner.renderGroups`/`isolate` keys on top
of the standing `floor` + `rooms` debt.

## 13. Light mode — the Bench Instrument flip (plan, not yet built)

*(planned 2026-08-31. §7b holds the register; this section holds the engineering. The header
warning — "no theme toggle until the token layer exists, because a toggle over two different
signal palettes is a second design system" — is answered here by an invariant, not ignored.)*

### The invariant that makes it a theme and not a second design system

**Same tokens, same semantics, same geometry — values only.** Light mode re-declares the VALUES
of the tokens phase 1 built; it never adds a token a component branches on, never changes what a
hue means (teal = exists/runs, ochre = the agent must act, indigo = speculative/wireframe), and
never touches radius/spacing/type. §7b's instrument radii (6/8/10) and its physical analogues
(keys, recesses, engraved eyebrows) are a LATER, register-wide restyle that would apply to both
themes or neither — deliberately out of this plan. What ships here is: the same dashboard, lit.

### Why the flip is cheap now (and what phase 1 actually bought)

Tailwind v4 utilities resolve through theme variables — `bg-gray-800` compiles to
`var(--color-gray-800)` — and phase 1 re-pointed the whole gray/neutral ramp onto the bay/ink
values in `@theme`. So the ~1,700 literal `gray-*`/`neutral-*` sites ride a `:root` variable
flip for free: one `:root[data-theme="light"]` block re-declaring `--color-gray-*`,
`--color-neutral-*`, the bay/ink/signal tokens, and the legacy aliases moves the entire surface.
The ramp mapping is SEMANTIC, not luminance (100 = ink-primary, 800 = card, 950 = page), so the
light block keeps the mapping and inverts the luminance: `gray-100` becomes dark ink `#33362f`
on a light page, `gray-950` becomes the plastic. Verify early that opacity modifiers
(`bg-gray-800/40` → `color-mix` over the var) resolve under the override — one throwaway page,
five minutes, before anything else is built.

### The palette (from §7b / ombi.co `instrument.css`)

Surfaces: `--bay-void → #cfccc4` (plastic page) · `--bay-floor → #d5d2c9` · `--bay-bench →
#c7c4ba` · `--bay-rail → rgba(40,42,34,.16)` · `--bay-rail-lit → rgba(40,42,34,.28)`.
Ink: `#33362f / #5c5f55 / #7c7f74`. Signal: `--live #3a6b64` · `--forge #8a5f2e` ·
`--think #4d5570`, with `-strong`/`-idle` variants and light `--seal`/`--fault` values still to
be derived — same value band, desaturated, so the panel stays plastic. Note the elevation
DIRECTION flips (dark: darker = further back; light: the card is *darker* than the page, a
recess) — that is the instrument reading and it is correct, but it is why the light sheet must
be derived by ROLE against §7b's table, not by numerically inverting the dark hexes.

### The LCD split — the one new token, and the audit that earns it

§7b's hard requirement: **the screen stays darker than the panel.** Every baked still,
turntable strip, and world render assumes a dark backdrop; on a light page they must read as a
lit instrument screen, not a hole. Today `--bay-void` serves two masters across 18 JSX sites:
the page/chrome register (stack chips, modal scrims, code wells) and the RENDER WELL behind
iframes and `object-contain` stills (bench hero, viewport pane, board focus, render-bay
thumbs). Split them: a new `--lcd` token, dark register `= --bay-void` (byte-identical today),
light register `#bcb9af` — and move only the well sites onto it. The artifact inside the well
never themes: a world's sky is the world's own recipe, and repainting it would violate §9.

### Stragglers the ramp flip cannot carry (measured on this tree)

- **346 `teal-*` utility literals** (SketchGallery, wizard, legacy chrome): re-point
  `--color-teal-*` in `@theme` onto the live/accent scale, the exact phase-1 trick — one block,
  346 sites ride free, and the light override re-tunes the same ramp.
- **101 `white`/`black` utility sites in 39 files**: these need per-site triage, not a ramp
  re-point — `text-white` on a filled teal button is correct in BOTH themes, while
  `hover:text-white` on chrome (AuthNav) is invisible on plastic. Rule of thumb: white-on-fill
  stays, white-as-chrome becomes `--ink-primary`, `bg-black/50` scrims become a `--scrim` token.
- **130 raw hexes in JSX**: mostly SVG icon gradients (the brand mark reads fine on both
  surfaces — leave) and a handful of real offenders to move onto tokens as found.

### The parts that must AGREE with light, and already know how

`sketch-svg.js` has carried a `surface: 'light'` render since before this plan — dark-tuned
accent inks re-tinted to clear AA on white (`#7c3aed` for the entity purple, teal-700), opaque
background dropped. A light dashboard finally makes the dashboard and the SVG export agree; the
integration is that inline diagram `<img>` fetches (`/svg?inline=1` in the reading room, floor
rows, bench) pass the active surface so a diagram on plastic renders in its light ink rather
than arriving as a dark card. Wireframe display mode already strokes in `--think`, which §7b
tuned specifically so an indigo line drawing on grey LCD IS the wire reading — no work, just
the payoff.

### The switch

Single-operator, no user table: a `mojulo_theme` cookie (`dark | light | system`), read in
`layout.jsx` and stamped as `data-theme` on `<html>` at SSR — no flash, no hydration mismatch,
no client-side theme library. `system` is the only state needing a pre-hydration inline script
(match `prefers-color-scheme`, set the attribute before paint). The control is a three-way in
/settings (host chrome, where AuthNav already points); **dark stays the default** — the Machine
Shop is the shipped register and a fresh install should not surprise. All strings i18n-ready;
they join the release-cut `/sync-locales` run.

### Rollout — each phase shippable alone, dark byte-identical until L3

- **L0 — verify + audit** (half a day): the opacity-modifier check; classify the 18 bay-void
  sites; the white/black triage list; pin the current dark values in a token test.
- **L1 — semantic seams** (small): introduce `--lcd` + `--scrim`, move their sites, re-point
  `--color-teal-*`. Dark renders byte-identical — this is pure refactor, provable by eye and
  by the L0 pin.
- **L2 — the light sheet** (the design work): the full `[data-theme="light"]` block, including
  derived `-strong`/`-idle`/`seal`/`fault` values, plus a **contrast machine gate** — a unit
  test that parses `globals.css` and pins WCAG ratios for every text/surface pair in BOTH
  sheets (phase 1 measured by hand; the light sheet gets the same table enforced in CI).
  Nothing sets the attribute yet; still invisible.
- **L3 — the switch**: cookie + SSR stamp + settings control + system script.
- **L4 — the eyes gate**: page-by-page sweep in light (floor, rooms, bench, detail, render
  bay, plan/research, bots, wizard, settings, login), fixing stragglers the triage list
  predicts and the ones it missed. Machine gate ≠ eyes gate (docs/bicycles.md); this phase is
  the second one and it is not optional.
- **L5 — deferred, explicitly**: the instrument LANGUAGE (§7b's key rows, recess readouts,
  engraved eyebrows, radius retune). A separate decision after the flip has lived a while.

### Open decisions (maintainer's)

1. Ship `system` in v1, or dark/light only? (Recommend: all three — the script is ten lines.)
2. §7b's warm plastic vs a neutral cool light? (Recommend: the plastic. It carries the ombi.co
   brand, it is already a proven sheet, and a generic cool gray forfeits the one conceptual
   argument — the dashboard as instrument — that made light worth doing.)
3. Does the floor's bench hero keep its dark poster on plastic, or gain a light-baked variant?
   (Recommend: keep dark — it is a screen. Revisit only if L4's sweep says it reads wrong.)

# Workshop-shell rollout — every page becomes the one instrument

Status: **phases 0–4 executed** (2026-09-01, working tree, uncommitted).
Foundation (registry, posture prop, self-serve pills), the bench deep view,
Studio, Ideate, and Operate + system are all converted and verified:
`npm run build` clean, every converted route serving 200 with zero global
chrome. Remaining: phase 5 (chatbot pack) and phase 6 (trails + retirements),
which is gated on phase 5. Executed-state notes worth keeping: `/observability`
and several Studio rails took the scroll posture (no 66px idiom to replace);
`/maker` was broken at HEAD (tiles carried string icon names the page never
resolved) and was fixed to resolve through `DOOR_ICONS`; pre-existing i18n
gaps found — `data.explorer`/`data.table` namespaces missing (explorer tab
renders raw keys, predates the sweep; still open), `apps.detail.graph.subtitle`
missing (added). Repo quirk: `control/.gitignore`'s bare `data/` pattern also
ignores `control/app/data/` — that page directory is untracked; needs a
maintainer decision (anchor the pattern to `/data/`).

Design authority: [3d-factory-ui.plan.md](3d-factory-ui.plan.md) §7 (the brand
system). This file only decides HOW the shell spreads, not what it looks like.

## The treatment, stated once

A page that wears the shell is ONE rounded frame (`.moj-shell`) centered in
page padding, and everything the page is lives inside it:

- The shell's top strip (`NavStrip`, WorkshopHome.jsx) is the page's ONLY
  header — brand mark, `/ crumb` locator, pack + artifact pills, Settings,
  sign-out. `AuthNav` and `Breadcrumbs` stand down on shell routes.
- The brand mark toggles the shell's own nav rail (`WorkshopShell.jsx`): a
  0-width panel on the container's left edge, under the strip, expanding
  rightward — the third rendering of the one nav model in `workshop-nav.jsx`
  (single rows, small line icons, mode hues, presence gating). No page carries
  an "Open navigation" affordance of its own.
- Regions divide by shared 1px hairlines (`moj-part-b`); padding, never
  margin; hue carries state; tabs ride ON a band's rail via `-mb-px`
  (ZoneSection in SplayedFloor.jsx is the reference tab implementation).
- Two postures, chosen per page:
  - **scroll** — the shell grows with content and the page scrolls (`/`,
    `/dashboard`). Outer: `main px-4 py-6 sm:px-8 sm:py-10`.
  - **pinned** — the shell is viewport-height and panes scroll inside
    (`/library`). Outer: `main flex h-screen flex-col px-4 py-4 sm:px-6
    sm:py-5`, shell `flex-1 min-h-0 flex flex-col`. This REPLACES the
    `h-[calc(100vh-66px)]` idiom — every converted page deletes its 66px
    constant.
- Width is a per-page knob, not an identity: 1040 (read-and-leave directory),
  1400 (content pages, the default for the sweep), 1600 (galleries/walls).
- `StatusBar` stays a home-family region (`/`, `/dashboard`) — the sweep does
  not spread it.
- The auth flag enters server-side: a thin server `page.jsx` passes
  `isAuthEnabled()` into the client body (library/page.jsx is the pattern).

Excluded from the treatment, deliberately: `/login` (auth screen), and
`/sketches/<ref>` (bare artifact frame — ALL chrome already stands down).

## Phase 0 — foundation refactors (before any more pages)

Do these first so the sweep is mechanical, not 20 hand-wired variants:

1. **Shell-route registry.** `components/workshop-shell-routes.js` exporting
   `isShellPath(pathname)`. AuthNav and Breadcrumbs consult it instead of
   growing per-route `if` chains (three already: `/`, `/dashboard`+ref-check,
   `/library`). Each converted page adds one line here and nothing in the
   chrome components.
2. **Posture prop.** `WorkshopShell` absorbs the `<main>` wrapper:
   `posture="scroll" | "pinned"` + `width={1040|1400|1600}` render the outer
   main, padding and min-h-0 chain. Retrofit SplayedFloor and SketchGallery
   onto it so there is exactly one implementation of each posture.
3. **Self-serve pills.** When `packs`/`total` are not passed, WorkshopShell
   fetches `/api/home?shallow=1` itself (SWR dedupes across the strip and any
   page copy). Migrate SketchGallery's `shellHome` hook into it; pages with
   richer data (the floor) keep passing their own.
4. **Crumb stays a word for now.** Deep pages need trails — that lands in
   phase 6, not per-page. Until then a converted deep page shows its single
   crumb word and no trail; acceptable mid-sweep.

## The sweep, by mode

Order follows value: the surfaces the operator lands on daily first, gated
pack pages last. Per page the recipe is identical: wrap the body in
`WorkshopShell` (posture + width + crumb), add the route to the registry, pass
`authEnabled` from a server page.jsx, delete the page's own h1/back-links that
the strip now covers, screenshot closed + rail-open.

### Phase 1 — the bench deep view (unlocks a simplification)

- `/dashboard?ref=` (ViewportHome.jsx) — **scroll**, 1400, crumb `dashboard`.
  The outliner/viewport/inspector grid becomes the shell's one region; its
  "lays itself out below the chrome" comment and the fallback-WorkshopHome
  double-render rule die here.
- Then `/dashboard` stands down chrome UNCONDITIONALLY: the `?ref=`
  searchParams checks in AuthNav/Breadcrumbs (and their Suspense wrappers, if
  nothing else needs them) revert to a plain pathname test via the registry.

### Phase 2 — Studio

| Route | Posture | Width | Notes |
|---|---|---|---|
| `/maker` | scroll | 1040 | a directory like `/` — read and leave |
| `/maker/motion` | pinned | 1400 | currently a 66px instrument |
| `/maker/beats` | pinned | 1400 | SketchGallery consumer: pass `shell` + `authEnabled` from its page — the prop path already exists; verify `/maker/voice`, `/maker/games` the same way if they share it |
| `/maker/voice` | per current layout | 1400 | |
| `/maker/games` | scroll | 1400 | |
| `/beats/[ref]` | pinned | 1600 | the studio — instrument, wide |
| `/games/[ref]` | pinned | 1600 | the game-developer studio |
| `/arcade` | scroll | 1400 | cabinets launch standalone; page itself is a rack |
| `/render-bay` | scroll | 1400 | |
| `/outputs` | pinned | 1400 | currently 66px instrument |
| `/pose-lab` | **skip for now** | — | lab tool, no nav entry; decide with maintainer |

### Phase 3 — Ideate

`/research`, `/plan`, `/stashes`, `/stashes/[ref]` — all currently 66px
instruments → **pinned**, 1400. Plan and research pages are deliberation
surfaces; keep their copy-starter-prompt affordances (the amber rule) intact.

### Phase 4 — Operate + system

`/mcp-skills` (+`[ref]`, +`[ref]/graph`), `/apps` (+`[ref]`, +`[ref]/graph`),
`/data`, `/graph`, `/map`, `/observability`, `/settings` — **pinned**, 1400
(graph/map are iframe-ish canvases: verify the min-h-0 chain reaches the
canvas, same trap as the library). `/settings` gets crumb `settings`; the
strip's own Settings link becomes self-referential there, which is fine (the
strip is chrome, not a trail).

### Phase 5 — chatbot pack (only when bot work is in scope)

`/bots`, `/dashboard/documents`, `/dashboard/deployments/[id]/…`
(conversations / submissions / cloud-deploy), `/chat-builder`,
`/bot-factory/modular` — pinned, 1400. Pack rules apply: nothing outside the
pack imports pack code; the shell components are kernel-side so the direction
is safe. The builder chat is the one conversational surface — the shell wraps
it, the rule stands.

### Phase 6 — trails, then retirements

1. **Trail crumbs.** NavStrip's `crumb` learns to take the ROUTES trail model
   (label + optional href per segment) — fold Breadcrumbs' route table into a
   shared module; deep pages (`apps/[ref]/graph`, `stashes/[ref]`,
   `beats/[ref]`, deployments) render their trail as mono micro-segments in
   the strip. Reuse the existing `breadcrumbs.*` keys; do NOT mint per-page
   crumb words beyond the ones already minted (`floor.crumb`,
   `library.crumb`).
2. **Retire** — only after every non-excluded page is on the registry:
   - `AuthNav.jsx` + `Breadcrumbs.jsx` (nothing left to render them over);
   - `WorkshopDrawer.jsx` (the rail replaced it everywhere; check the
     remaining consumer in AuthNav goes with it);
   - the `h-[calc(100vh-66px)]` idiom and the 33+33 height contract it
     encodes (grep for stragglers in components/);
   - dead keys sweep (`/find-unused-locale-keys`): `floor.presets`,
     `home.drawer.*` if the rail's aria-labels replaced them, breadcrumb keys
     the trail model didn't inherit.
3. **`/sync-locales`** once, at the end — the `floor`/`library` crumb debt and
   anything the sweep added, one locale at a time per that skill's rule.

## Traps already hit once (don't hit them twice)

- **min-h-0 or it silently grows**: every flex level between `h-screen` and a
  scrolling pane needs `min-h-0` (library shell chain is the reference).
- **useSearchParams needs Suspense** at every consumer (ViewportHome pattern);
  after phase 1 the chrome components may not need searchParams at all.
- **Shared components get an opt-in prop, never a changed default** —
  SketchGallery's `shell` prop is the precedent; `/maker/beats` proved the
  non-shell path must keep rendering byte-identically.
- **`isAuthEnabled()` is server-only** — client pages need the thin server
  page.jsx split (library/page.jsx is the template).
- **The rail is physically left** (`left-0`, expands right). Fine for LTR; RTL
  hosts get the rail on the reading-start side only when this is revisited
  with logical properties — note it, don't block on it.
- Verification per page: screenshot closed + rail-open (scratch scripts exist:
  `shot.mjs`, `shot-rail.mjs`), Esc + click-away close, no double header, and
  at each phase end `npm run build`.

## Decision points for the maintainer

- `/pose-lab` and `/bot-factory/modular`: shell, or leave as labs?
- Width table above is a proposal — override per page at conversion time.
- Whether `StatusBar` ever spreads beyond the home family (this plan says no).

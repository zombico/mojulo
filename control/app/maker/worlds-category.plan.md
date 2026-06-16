# Worlds — a third Mojulo Maker concern

Status: **implemented** (2026-06-15) except locale translation of the new EN strings,
which is deferred (see Deferred). The sections below describe what was built.

## Why

A traversable city/hub is a different artifact paradigm from a still landscape or a
flowchart: it is **moved through**, not **looked at**. Today `fractal-city` and
`transportation-hub` sit in the `illustration` bucket next to still landscapes and
figures, and render as a live three.js World via `/api/sketches/[ref]/world` (the
renderer work is already shipped — see "Already done" below). The taxonomy should
catch up to the renderer: promote the traversable kinds into their own **concern
bucket** so they get their own tuned, opinionated surface.

This is the "Worlds category" from the original visualization-layer strategy:
> Scene (looked at) → SVG/PNG · Worlds-lite (preset shots) → CSS-3D · **Worlds (moved through) → live three.js canvas**

The bucket seam was built for exactly this. [sketch-manifest.js:596](../../lib/graph/sketch-manifest.js#L596):
> "The two concerns share the renderer today and are expected to diverge into
> separately tuned surfaces over time — the bucket is the seam they split along."

## Membership rule

**Worlds = the traversable kinds = `WORLD_RENDER_KINDS`** (`fractal-city`,
`transportation-hub`). These are precisely the kinds the render dispatch already
routes to the three.js `/world` endpoint, so renderer mode and concern bucket stay
aligned on one line: moved-through vs looked-at.

- `css3d-turntable` **stays in `illustration`** — it is worlds-lite (an object you
  watch spin), not something you move through.
- Still illustration kinds (`manji-tree`, `painted-landscape`, `carved-solid`,
  `figure`) **stay in `illustration`**.

When a new traversable kind is added later, adding it to `WORLD_RENDER_KINDS` should
be the single switch that flips both its renderer and its bucket. Keep that the one
source of truth (see Decisions).

## No data migration needed

`SketchRepository.list({ bucket })` filters JS-side on the **derived** bucket
(`classifyBucket(manifest)`), with an optional stored `sketches.bucket` override
column ([sketches.js:139](../../lib/db/repositories/sketches.js#L139)). So the moment
`classifyBucket` returns `'world'` for the traversable kinds, every existing city/hub
row reclassifies automatically. No backfill, no ALTER.

**Edge case to honor:** a row with an explicit `bucket` override pinned to
`'illustration'` (or `'diagram'`) keeps that pin — the override beats the derived
value by design. That is correct: an operator who deliberately filed a city under
Illustrations should keep it there. No action needed; just don't assume all cities
move.

## Changes

### 1. Taxonomy — [lib/graph/sketch-manifest.js](../../lib/graph/sketch-manifest.js)
- `BUCKETS = ['diagram', 'illustration', 'world']`.
- `classifyBucket(manifest)`: check `WORLD_RENDER_SET` **first**, return `'world'`;
  else the existing illustration/diagram logic. (`WORLD_RENDER_SET` already exists
  from the renderer work — reuse it; do not introduce a second list.)
- Remove `fractal-city` / `transportation-hub` from `ILLUSTRATION_KINDS` so they
  don't double-count. VERIFIED: `ILLUSTRATION_KINDS` / `ILLUSTRATION_KIND_SET` has
  exactly one consumer — `classifyBucket` itself ([sketch-manifest.js:623](../../lib/graph/sketch-manifest.js#L623)).
  Nothing else imports it, so removing the world kinds is safe and needs no
  `isMakerKind()` shim. Just order the checks: `WORLD_RENDER_SET` → `'world'`, then
  `ILLUSTRATION_KIND_SET` → `'illustration'`, else `'diagram'`.
- Update the bucket doc comment to describe the three concerns.

### 2. API filter — [app/api/sketches/route.js:80](../../app/api/sketches/route.js#L80)
- Accept `world` in the `?bucket=` allow-list:
  `bucketParam === 'diagram' || bucketParam === 'illustration' || bucketParam === 'world'`.
  (Better: validate against the exported `BUCKETS` set so this list stops being
  hand-maintained.)

### 3. New surface — `app/maker/worlds/page.jsx`
- Mirror [app/maker/illustrations/page.jsx](../../app/maker/illustrations/page.jsx):
  `<SketchGallery bucket="world" heading={t('title')} subtitle={t('subtitle')} />`.
- `SketchGallery` already renders `world` kinds via the `/world` iframe (the
  `mode === 'world' || mode === 'scene'` branch in `SketchPreviewBody`). No gallery
  changes needed — it just receives a new `bucket` prop value.
- Preview cost note: the gallery renders only the **selected** sketch live (tiles are
  icon rows), so one WebGL world at a time. Fine. If we later want grid thumbnails,
  that needs the poster-PNG step (see Deferred).

### 4. Maker landing rail — [app/maker/page.jsx:84](../../app/maker/page.jsx#L84)
- Add a `worlds` rail beside `illustrations` and `motion`:
  `{ key: 'worlds', href: '/maker/worlds', data: worlds, accent: '<pick>' }`.
- Add a `useRecent('/api/sketches?bucket=world', …)` hook mirroring `illustrations`.
- Pick an accent color distinct from violet (illustrations) / amber (motion) —
  e.g. `cyan` or `emerald`.

### 5. i18n — EN only now, locales deferred
- Add to `messages/en.json`: `maker.worlds.title`, `maker.worlds.subtitle`, and the
  rail label key used by the Maker landing (match how `maker.illustrations` is keyed).
- **Do NOT run `/sync-locales` yet** — per decision, other locales come later. The EN
  source is the system of record; the app falls back to EN keys for missing locales,
  so this won't break non-EN sessions, it just shows English for the new strings until
  we translate. Leave a TODO noting the locale sync is pending.

### 6. (Optional, same PR) MCP discoverability
- `lib/mcp/tools/scene-city.js` and `scene-transport-hub.js` return `sceneUrl` only.
  Consider adding `worldUrl: /api/sketches/<ref>/world` so agents surface the
  traversable link. Low risk, additive. Could also be its own follow-up.

## Already done (renderer layer — shipped this session)
- `WORLD_RENDER_KINDS` + `sketchRenderMode` → `'world'` ([sketch-manifest.js](../../lib/graph/sketch-manifest.js#L641)).
- `/api/sketches/[ref]/world` route + `emitThreeWorld` + `faceListToMesh` adapter.
- `assembleBoxCityScene` / `assemble{FractalCity,TransportationHub}Scene` seam.
- three.js vendored at `public/vendor/three/`.
- Detail page + gallery route `'world'` → `/world` iframe.

This plan is purely the **concern-bucket / surface** layer on top of that.

## Testing
- Extend `lib/graph/sketch-manifest.render-mode.test.js` (or a sibling) with
  `classifyBucket` cases: city/hub → `'world'`, turntable/landscape → `'illustration'`,
  chart → `'diagram'`, and an explicit override beating the derived value.
- Manual: `/maker` shows the Worlds rail; `/maker/worlds` lists only cities/hubs;
  `/sketches` and `/maker/illustrations` no longer show cities/hubs; selecting a world
  traverses.

## Decisions
- **One source of truth for membership:** `WORLD_RENDER_KINDS` drives both renderer
  dispatch and bucket classification. Don't fork the list.
- **Turntable stays Illustration** (worlds-lite, looked-at).
- **Override semantics preserved:** explicit `sketches.bucket` pins win over derived.

## Deferred (not this PR)
- Locale translation of the new EN strings (`/sync-locales` later).
- Poster-PNG hero frame for World gallery thumbnails / OG cards (needs a deterministic
  hero camera + the SVG→PNG freeze step).
- Lossy World materials (facade gradients / glow / brick HTML flatten to flat color).
- WebGPU upgrade path / walk-through controls (PointerLock/Fly) beyond OrbitControls.

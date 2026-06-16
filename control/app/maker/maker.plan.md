# Mojulo Maker — plan

Mojulo Maker is a new top-level **concern**: a tuned, opinionated creative surface for
**illustrations** (landscapes, figures, and complicated perspective / css3d / painterly
renders), with **motion** (movies & gifs) folded in. It is a **sibling** to the existing
**Sketches** concern — *not* a hub that absorbs it.

- **Sketches** (`/sketches`) — stays its own first-class concern, tuned for **diagrams,
  flows, charts, and scientific explanation**.
- **Maker** (`/maker`) — the **illustration** concern + **Motion**.

The two are expected to grow separately tuned renderers over time. Today they share one
renderer (dispatch on `manifest.kind`); the `bucket` classifier is the seam they split
along.

## Core principle (do not violate)

**An illustration IS a sketch.** "Illustration" and "diagram" are two **buckets** over the
one sketch primitive, not two different objects. Same `sk_` ref, same row, same renderer
dispatch on `manifest.kind`. Everything a sketch participates in — `bind_stash`, "refer to"
/ plan + research associations, `update_sketch`, `diff_sketches`, folders, bulk ops — works
**identically** whichever concern owns it. The bucket only decides *which concern's gallery
the sketch shows up in*.

## The bucket split

`manifest.kind` already encodes the rendering context, so the diagram/illustration split
exists implicitly — this surfaces it as the concern boundary.

| `manifest.kind`     | Rendering context              | Bucket → Concern        |
| ------------------- | ------------------------------ | ----------------------- |
| *(none)* / chart / flow | CreationMap SVG (boxes, arrows, charts) | **diagram → Sketches**  |
| `manji-tree`        | perspective / two-point room   | **illustration → Maker** |
| `painted-landscape` | painterly terrain              | **illustration → Maker** |
| `carved-solid`      | metallic 3D extrude            | **illustration → Maker** |
| `figure`            | posed human (protoform rig)    | **illustration → Maker** |
| `fractal-city`      | CSS-3D                         | **illustration → Maker** |
| `transportation-hub`| CSS-3D                         | **illustration → Maker** |
| `css3d-turntable`   | CSS-3D                         | **illustration → Maker** |
| `room`              | two-point room                 | **illustration → Maker** |

Rule of thumb: **a landscape or complicated figure in a perspective / css3d / painterly
context is an illustration (Maker); diagrams and flows stay sketches.** The nullable
`sketches.bucket` override column exists for the genuine edge case (e.g. a structural
`manji-tree` the operator wants kept in Sketches) — derived by default, override only when
explicitly set.

## Navigation

Two sibling tiles on the home launcher, plus Motion folded into Maker:

```
/sketches                   Sketches concern — diagrams, flows, scientific explanation
                            (SketchGallery filtered to bucket=diagram)

/maker                      Mojulo Maker hub — two rails
 ├─ /maker/illustrations    SketchGallery filtered to bucket=illustration
 └─ /maker/motion           Motion Project gallery (migrated from /motion)
```

- `/sketches` and `/maker/illustrations` are the **same gallery component**
  ([components/SketchGallery.jsx](control/components/SketchGallery.jsx)), mounted twice with
  a different `bucket` prop. Nothing forks downstream of the manifest.
- The sketch detail viewer (`/sketches/<ref>`) is concern-agnostic and unchanged — it
  dispatches on `manifest.kind`.
- `/motion` redirects to `/maker/motion`. `/sketches` does **not** redirect.

## Work items (status: implemented)

1. **Classifier** — `classifyBucket()` + `ILLUSTRATION_KINDS` + `BUCKETS=['diagram',
   'illustration']` in [sketch-manifest.js](control/lib/graph/sketch-manifest.js). Single
   source of truth.
2. **Data model** — nullable `bucket` override column on `sketches`
   ([db/index.js](control/lib/db/index.js) migration). NULL = derive. Effective bucket =
   `row.bucket ?? classifyBucket(manifest)`, computed in
   [repositories/sketches.js](control/lib/db/repositories/sketches.js) (+ `setBucket`, +
   `list({ bucket })`). No backfill.
3. **API** — GET [/api/sketches](control/app/api/sketches/route.js) `?bucket=diagram|illustration`;
   PATCH [/api/sketches/[ref]](control/app/api/sketches/[ref]/route.js) accepts a `bucket`
   override.
4. **Pages** — [/sketches](control/app/sketches/page.jsx) (`bucket="diagram"`),
   [/maker](control/app/maker/page.jsx) hub (Illustrations + Motion),
   [/maker/illustrations](control/app/maker/illustrations/page.jsx) (`bucket="illustration"`),
   [/maker/motion](control/app/maker/motion/page.jsx) (migrated, reworked cards).
5. **Nav** — [HomeLauncher.jsx](control/components/HomeLauncher.jsx): `sketch` + `maker`
   tiles; standalone `motion` tile removed. `MakerIcon` = framed landscape.
6. **MCP tools** — illustration mint tools auto-classify; `create_sketch` / `update_sketch`
   gained an optional `bucket` override (`enum: ['diagram','illustration']`). `get_ui_map` /
   page-map copy in [context.js](control/lib/mcp/tools/context.js) describes both concerns.
7. **i18n** — English source updated (`tiles.sketch`, `tiles.maker`, `maker.*`). Locale sync
   deferred (run `/sync-locales`; note the branch also carries unrelated unsynced keys).

## Motion cards

`/maker/motion` cards are left-preview / right-metadata. Previews do **not** auto-play: on a
mouse device the animation mounts only on hover; on a touch device (no hover) it plays on its
own. A motion's only assets are themselves animated (flipbook svg / gif / mp4) with no static
first-frame, so the idle state shows a play-badge placeholder (stitch MP4s get a real poster
frame via `preload="metadata"`).

## Out of scope
- No new database table, no new ref prefix, no new renderer **yet**. Illustrations reuse the
  sketch primitive end to end; the tuned per-concern renderers are future work that splits
  along the `bucket` seam.
- No change to how any artifact renders today — `manifest.kind` dispatch is untouched.

## Open questions
- **Folders across concerns.** Folders are global to all sketches; a folder filtered into
  Sketches shows only its diagram children (and into Illustrations, only illustration
  children). Confirm that's acceptable vs. per-concern folder namespaces.
- **List filter cost.** Effective-bucket filtering is JS-side because `kind` lives in
  `manifest_json`. Fine for a single-user scratch surface; if it grows, persist a derived
  bucket column and filter in SQL.

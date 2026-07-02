# Folderization pass — turning `control/lib/graph/` from a bag of toys into a substrate

Status: **Slice 1 done, awaiting review** (views → `views/{science,math,bio}`, 42 modules + tests moved, all tests green). Remaining slices proposed, not started.

Slice 1 result: 81 files `git mv`'d, 41 external `@/lib/graph/*` alias sites rewritten, 3 straggler graph-root importers fixed by hand (`scene-planetary.js`→ephemeris, `bio-views.test.js`, `molecule-library.spike.gen.test.js`). Top-level flat modules 122 → 80. Verified: `views` suite 493/493 + `lib/mcp/tools` 583/583 pass; `node --check` clean.

## Problem

`control/lib/graph/` has **122 flat top-level modules** (+~124 co-located tests, +20 `*.plan.md`) sitting at the same level as **12 folders that already exist** (`polygonizer/` alone is 308 files; also `geo/ machina/ themes/ layout/ derivers/ landmarks/ neo-rembrandt/ rendrant/ sketch-vocab/ manji-programs/ painted-landscape-cards/`).

The substrate spine (scene backends, sketch pipeline, effects) is interleaved with leaf content (`atom-view`, `saturn-view`, `whack-a-mole`) at one flat level. That flatness is what makes the directory read as a bag of toys rather than a layered substrate. The fix is to push leaf content into role-named families and keep the spine near the top.

## Blast radius (measured)

- **197 external import sites** reference `graph/`, almost all via the stable alias `@/lib/graph/<name>` (from `app/api/sketches/**`, `lib/mcp/tools/**`, `components/`), plus a few relative `../lib/graph/<name>.js` from `scripts/*.mjs`.
- Because the specifier form is uniform, **moves are a deterministic codemod, not hand-editing**: `@/lib/graph/atom-view` → `@/lib/graph/views/science/atom-view`.
- **The view families are leaves** — no other `graph/` module imports them; they import only *downward* (`polygonizer/`, `scene-*`, `sketch-*`, `volume-raymarch`, `workbench`, `motion-vocabulary`). Fan-in per view = its one MCP tool + its test + (rarely) its plan. That is the low-risk beachhead.
- No typecheck exists repo-wide; safety net is co-located `*.test.js` under vitest + `node --check`.

## Decisions (locked)

- **Import strategy: rewrite specifiers (clean).** No re-export shims, no barrels. New paths everywhere; nothing left at the old path.
- **First pass: Slice 1 only** — `views/{science,math,bio}` (42 leaf modules). Prove the codemod, empty a third of the floor, review before continuing.
- **Artifact: this file.** Execute against it; stop at a reviewable diff (no commit until reviewed).

## Target taxonomy (full vision — only `views/` executed in Slice 1)

```
graph/
  scene/        scene-{css3d,three,html,gltf,png,png-warm,planetary}, sky-css, chromium, signage-chrome
  sketch/       sketch-{manifest,svg,png,derive,diff}, stored-sketch-svg, validate
  effects/      light-diffusion-3d, effects-{fog,occluder}, volume-raymarch, sdf-glsl, form-effect, carved-{solid,motion}
  views/
    science/    atom, black-hole, cherenkov, comet, double-slit, fission, fusion, galaxy, gravity-wave,
                lightning-storm, orbit, plasma-globe, pulsar, reactor, saturn, star-birth, wavepacket,
                field, field-flow, mechanics, ephemeris, parallel-transport         (22)
    math/       quadratic, complete-square, conics, complex, derivative, ftc, series, trig-circle,
                pythagoras, probability, transform, transformer, vector-match, surface   (14)
    bio/        dna-view, dna-process, molecule-view, molecule-builder, cellular, energy-cycle   (6)
  landscape/    atmosphere, ocean, cascade, fluid, painted-landscape-raymarch, surface-textures
  architecture/ building-facade, facade-card, condo-*, dungeon-designer, kitchen-run, room-*, roof,
                suite-layout, subway-*, transportation-hub
  city/         fractal-city, roads
  figures/      character-*, megaboy-*, face-mesh, cyclist-asset, pedestrian-asset
  vehicles/     vehicles-{css3d,swept}, ball-flight, windmill-view
  worlds/       world-scene (dispatch seam), controllable-world, physics-sim, event-bus, game-idioms,
                motion-vocabulary, movement-flow, workbench, workbench-assembler, solid-turntable
    games/      newton-cradles, laser-range, whack-a-mole
  (unchanged)   polygonizer/ geo/ machina/ themes/ …
```

Edge-case placements (adjustable, low-stakes): `surface-view`→math (implicit-surface plotter), `parallel-transport-view`→science (differential geometry, GR-adjacent), `energy-cycle`→bio, `ephemeris`→science.

## Slice 1 mechanics

Per module: `git mv <name>.js` + `<name>.test.js` (+ `.plan.md` if present) into `views/<sub>/`.

Codemod rules applied to the moved files' own relative imports (they drop two levels deeper):
- `./X` / `./polygonizer/X` pointing at something that stayed at `graph/` root → `../../X` / `../../polygonizer/X`. (covers the observed `./sketch-manifest.js`, `./scene-three.js`, `./volume-raymarch.js`, `./workbench.js`, `./motion-vocabulary.js`, `./polygonizer/*`.)
- Sibling views moved to the **same** subfolder → import stays `./X`. (`molecule-view → molecule-builder`, both `bio/`.)
- Sibling view moved to a **different** subfolder → `../<othersub>/X`. (`field-flow-view` [science] → `transform-view` [math] becomes `../math/transform-view.js`.)

External codemod: across the **40 external files**, rewrite `@/lib/graph/<name>` → `@/lib/graph/views/<sub>/<name>` for each moved view.

Gate: `node --check` each moved file; run the graph vitest suite; eyeball the diff. No commit until reviewed.

## Slice 2 — DONE, awaiting review

Moved the spine into `scene/` (10 modules), `sketch/` (7), `effects/` (8) — 41 files incl. tests. Top-level flat modules 80 → 55.

Codemod generalized (`/tmp/folderize.mjs` + `/tmp/repair.mjs`): recomputes every relative specifier from each file's final location and swaps `@/lib/graph/<mod>` aliases. Reach was far wider than Slice 1 — **171 relative specifiers across 117 files** + 13 alias-with-extension sites. Lessons banked for Slice 3:
- Some spine modules were **untracked** (uncommitted `??` files) → `git mv` fails; fall back to plain `mv`.
- Moved files that resolve **filesystem paths relative to self** break beyond imports: `scene-three.js` `VENDOR_DIR` (`../../` → `../../../public/vendor/three`) and its inlined `ball-flight.js` read (`./` → `../`). `process.cwd()`-relative paths (chromium, sketch-png) are unaffected.
- Alias imports appear in **two forms** — `@/lib/graph/<mod>` and `@/lib/graph/<mod>.js`; the codemod must handle the `.js` suffix or `polygonizer/index.js` breaks and cascades into MCP-server registration tests.
- Non-canonical co-located tests travel with their module when the first dot-segment equals the module name (`scene-css3d.signage.test.js` moves; `scene-css3d-city.spike.gen.test.js` stays).

Verified: `lib/graph` + `lib/mcp/tools` = **3291 pass, 1 fail**; the single failure (`meta-fabricator` vehicle-family partition, 13≠14) reproduces on clean HEAD → pre-existing WIP, not folderization.

## Slice 3 — DONE, awaiting review

Moved the world/content layer into `landscape/` (8), `architecture/` (16), `city/` (2), `figures/` (7), `vehicles/` (4), `worlds/` (10) + `worlds/games/` (3) — 91 files incl. tests, 50 modules. **Top-level flat modules 55 → 5.**

Codemod ran in ONE clean pass after fixing its two latent bugs from Slice 2 (`withJs` is now lexical, not `existsSync`-based; alias regex handles the `.js` suffix). 132 files rewritten, "all relative imports resolve" first try — no repair pass needed.

New trap handled (banked from the pre-move scan): **6 spike tests climb to repo root** via `resolve(HERE, '..','..','..')`. Moving them deeper silently redirects their output dir (they'd pass but write to the wrong place). Fixed by adding one `..` for files one level deeper (architecture/, worlds/) and **two** for `worlds/games/newton-cradles` (two levels deeper). Also fixed a doc example in `lib/mcp/catalysts/design-world-asset.md` (codemod skips `.md`).

Note: the `meta-fabricator` partition test that failed after Slice 2 now passes — a vehicle-registry module import that was stale post-Slice-2 got healed by the repo-wide path correction. Full control suite: **268 files, 4144 tests, 0 fail.**

`worlds/games/` demonstrated the codemod handles nested sub-folders (nested `sub` key just works for mkdir, alias, and relative recompute).

## Left flat, deliberately (5 files) — the reconciliation cases

`layout.js` (collides with `layout/`), `theme-registry.js` (collides with `themes/`), plus the cross-cutting meta files `creation-map.js`, `conceptual-vault.js`, `meta-fabricator.js`. These aren't content leaves; each needs a real decision:
- `layout.js` / `theme-registry.js` — either fold into the existing same-named folder (as `layout/grid.js`, `themes/registry.js`) or rename to disambiguate.
- `creation-map` / `conceptual-vault` / `meta-fabricator` — decide whether a `meta/` folder earns its place or they stay as top-level substrate concerns.

Deferred on purpose: forcing them into a family would be worse than leaving them visible at the top as "things that don't fit the family model yet."

## Non-goals / cautions

- Not touching `polygonizer/` internal layout (its own 308-file substrate).
- `world-scene.js` is the dispatch seam with the widest internal fan-out; when it moves (Slice 3), its per-kind assembler imports all rewrite in one file.
- Keep each slice one reviewable commit so a bad move is trivially revertible.

# Science Atlas — plan

A **standalone, static, SEO-earning educational gallery** of mojulo's worthwhile science
views, hosted on GitHub Pages. Zero marketing. Each view is the phenomenon + a plain-language
explanation + the live interactive render + the recipe/code shown as a *deep reference*.

It is a **satellite of mojulo.ai**, not part of it: its own repo, its own deploy, its own
URL. Its job is to (1) preserve worthwhile science views as permanent, shareable pages, and
(2) earn organic search traffic for interactive-science topics that links back to mojulo.

Sibling doctrine to the marketing site: *recipes-not-renders applied to the site's own pages*
— `gallery.json` is the recipe, `build.mjs` emits the rendered HTML, the deployed site stays
plain static files (the GitHub Pages portability contract). Never hand-edit generated HTML.

---

## Decisions locked (from the operator)

- **Location:** its own standalone thing on GitHub — a **dedicated repo → GitHub Pages**,
  parallel to mojulo.ai, sized to earn SEO for mojulo and to be a deep code reference.
- **Framing:** **pure education, 0 marketing.** No token→output ratios, no "the ask", no
  "get started" CTAs. Lead with the science; the recipe is present as reference, not a pitch.
- **Extra goal (new):** the page is also a **deep code reference** — the tiny recipe *and* a
  link/excerpt into the actual generator source, so a curious reader (or a search engine) can
  go all the way down.

## Decisions still open (operator's call — flagged, not blocking the build)

1. **Public name + URL.** Options, in my recommended order:
   - `science.mojulo.ai` — custom subdomain on GitHub Pages (CNAME). *Recommended.* Clearly
     mojulo's, inherits brand trust, every page strengthens mojulo's topical authority, and
     the app backlinks read as first-party. Needs one DNS `CNAME` record.
   - `zombico.github.io/<repo>` — zero DNS, ships today, a genuinely separate domain (more of
     a classic external "buff" backlink to mojulo.ai, but a fresh path with less standing).
   - A brandable custom domain of its own (e.g. an "atlas"/"phenomena" domain). Most work,
     most independence.
   Working name in this doc: **Science Atlas**; local dir `science/`; slug base TBD.
2. **Baker home + degree of automation.** Where the "pull a view out of mojulo into the
   gallery" script lives and how automatic it is (see §5). Recommendation inside.
3. **Initial catalog.** Which ~8–12 views ship first (proposed list in §6).

---

## 1. Why this can work as SEO (and why the naive version fails)

The only satellite content that ranks in 2026 is content that is genuinely useful and
*unique*. This qualifies: interactive, physically-grounded science views that don't exist
elsewhere. The failure modes to design against:

- **Thin pages.** A page that is *just* an `<iframe>` ranks for nothing — Google indexes text.
  → Every view page carries several hundred words of real, unique explanation in the static
  HTML (the phenomenon, why it looks like this, the technique). The explanation IS the SEO.
- **JS-injected content.** If the words are painted by client JS, indexing is unreliable.
  → All prose, headings, and the recipe are pre-rendered into static HTML by `build.mjs`. The
  interactive render is the only JS-heavy part, and it lives in a lazy `<iframe>`.
- **One giant page.** Anchors on a single page can't each rank for their own query.
  → **One page per view** at a clean URL (`/views/<slug>/`). The index is a hub that links out.
- **Dead index.** 20 live WebGL/raymarch iframes on the landing grid = a browser that melts.
  → The index shows a static **thumbnail image** per card; the live render only loads on the
  view page (and can itself be click-to-activate).

## 2. Repo layout (the gallery — its own git repo)

```
science/                         # its own repo; git-ignored by mojulo like site/
├─ PLAN.md                       # this file
├─ README.md                     # what it is, how to add a view, how to deploy
├─ CNAME                         # science.mojulo.ai  (only if custom-domain option)
├─ robots.txt                    # allow all + sitemap pointer
├─ sitemap.xml                   # generated: every view page + the index
├─ theme.css                     # forked from site/theme.css, marketing nav stripped
├─ gallery.json                  # THE REGISTRY (recipe) — one entry per view
├─ build.mjs                     # generates index.html + every views/<slug>/index.html + sitemap
├─ index.html                    # generated: the gallery hub (grid of cards, grouped by domain)
├─ assets/
│  ├─ fonts/  ...                # self-hosted, from site (no external font CDN)
│  └─ og-default.png
└─ views/
   └─ <slug>/
      ├─ index.html              # generated: the per-view educational page
      ├─ world.html              # baked, self-contained interactive render (or figure.svg for SVG kinds)
      ├─ recipe.json             # the stored mojulo recipe (downloadable + shown inline)
      ├─ thumb.png               # static thumbnail for the index card + OG image
      └─ content.md              # HAND-WRITTEN: the educational prose + source pointers (the input)
```

Generated files (`index.html`, `views/*/index.html`, `sitemap.xml`) are committed but never
hand-edited — `build.mjs` overwrites them wholesale from `gallery.json` + each `content.md`.

## 3. The per-view page — anatomy (pure education + deep reference)

Top-to-bottom, all static HTML except the render iframe:

1. **`<head>` SEO block** (per page, generated from the registry entry):
   - `<title>` — phenomenon-first, e.g. *"Gravitational lensing around a black hole —
     interactive"*.
   - `<meta name="description">` — one honest sentence, ~150 chars.
   - Open Graph + Twitter card → the view's `thumb.png`.
   - `<link rel="canonical">` to the view's own URL.
   - **JSON-LD structured data**: `schema.org/LearningResource` (or `CreativeWork`) with
     `about`, `educationalLevel`, `learningResourceType: "interactive visualization"`,
     `isBasedOn` → the mojulo repo source file. This is what earns rich/topical results.
2. **H1 = the phenomenon.** Not "black-hole-view" — "A gravitationally lensed black hole".
3. **The interactive render** — lazy `<iframe src="world.html">`, click-to-activate poster so
   the page is fast and Core-Web-Vitals-clean.
4. **The explanation** (the SEO body, ~250–500 words, hand-written in `content.md`): what
   you're seeing, why it looks like this, the real physics/biology, the technique used to draw
   it. Honest, teacherly, no product pitch.
5. **The recipe, shown as a deep reference** — the exact `recipe.json` rendered inline
   (syntax-highlighted, static), with a short gloss of each field, and a **download** link.
   This is the "code shown as a deep reference" the operator asked for, layer one.
6. **Under the hood** — layer two of the deep reference: a short "how it's actually drawn"
   note + a **link to the generator source** on `github.com/zombico/mojulo` (e.g.
   `control/lib/graph/.../black-hole-view.js`). Doubles as a backlink into the main repo and
   as genuine unique technical content.
7. **Related views** — 2–4 internal links to sibling views in the same domain (topic
   clustering; keeps visitors and spreads link equity).
8. **Footer** — a single quiet, non-marketing line: "Made with mojulo, an agent's workshop →
   mojulo.ai" (the one intentional backlink; attribution, not a CTA).

## 4. The index (hub) page

- H1 + one educational sentence about what the atlas is (no marketing).
- Views grouped into **domain sections** — each an H2 that is itself a topic hub:
  Astrophysics · Biology · Earth & Fluids · Chemistry & Physics · Anatomy.
- Each card: static `thumb.png` + title + one-line description, linking to `/views/<slug>/`.
- Sections give us category-level indexable hubs and clean internal-link structure.

## 5. The baker — getting a view out of mojulo and into the gallery

The gallery is static; the *production* of each artifact happens against the local control
plane (mojulo.ai control plane on :3001). The bake reuses paths that already exist:

- **Worlds** → `GET http://localhost:3001/api/sketches/<ref>/world?download=1` returns the
  self-contained page with the vendored three.js inlined as `data:` URLs (already implemented;
  `emit-util.js` `inlineImportmap()`). Write it to `views/<slug>/world.html`.
- **CSS-3D scenes** → `/scene?download=1` (already dependency-free; served verbatim).
- **SVG kinds** (figures, diagrams, dna/cellular where applicable) → `/svg?inline=1` →
  `views/<slug>/figure.svg`.
- **Recipe** → the stored manifest for the ref → `views/<slug>/recipe.json`.
- **Thumbnail** → rasterize the render (headless) or a hand-picked frame → `thumb.png`.

Proposed tool: **`science/bake.mjs <sketch-ref> <slug>`** — one command that hits the local
endpoints, writes `world.html` + `recipe.json` into `views/<slug>/`, and stubs `content.md`
for the human to fill in. It lives in the gallery repo (keeps the gallery self-sufficient) and
just needs the control plane running locally. *Recommendation: start here — a plain Node
script, not an MCP tool.* Promote to a mojulo MCP tool/catalyst later only if the ritual proves
frequent enough to earn a shelf spot.

**Curation ritual (documented in README):**
`bake <ref> <slug>` → write `content.md` (the teaching) → add the entry to `gallery.json` →
`node build.mjs` → review the diff → commit → push. Deploy is automatic (§7).

## 6. Proposed initial catalog (~10 views, spread across domains)

Drawn from science kinds already in the substrate (astrophysics/biology/fluids/physics views
seen across `control/lib/graph/**`). Final list is the operator's call.

- **Astrophysics:** black hole (raymarched lensing) · a star's surface · a planetary
  scene/orbit · a comet.
- **Biology:** a cell (cellular-view) · a DNA double helix · a DNA/replication process.
- **Earth & fluids:** an ocean / fluid / cascade landscape view · an atmosphere view.
- **Chemistry & physics:** an atom · an energy cycle / reactor.
- **Anatomy:** the figure construction study (ring-wave armature → filled body).

Ship 2–3 first (black hole is the cleanest end-to-end proof), prove the pipeline and that
Google indexes the pages, then fill the rest.

## 7. Deploy (GitHub Pages)

- New repo `zombico/<name>`; enable Pages from `main` (root), or add a tiny
  `actions/deploy-pages` workflow if we ever add a build step to CI (not needed while
  `build.mjs` is run locally and output is committed — mirrors the site's model exactly).
- If `science.mojulo.ai`: set repo custom domain + commit `CNAME`, add the DNS `CNAME` record,
  let Pages provision HTTPS.
- After first deploy: submit `sitemap.xml` to Google Search Console, verify indexing, add the
  reciprocal link from mojulo.ai (e.g. a quiet footer/`how.html` link "Science atlas →") so
  the two sites reinforce each other.

## 8. SEO checklist (baked into `build.mjs`, so it can't be forgotten)

- [ ] One page per view, clean slug URL, `<link rel="canonical">`.
- [ ] Unique `<title>` + `<meta description>` per page, phenomenon-first.
- [ ] Open Graph + Twitter card per page → the view thumbnail.
- [ ] JSON-LD `LearningResource`/`CreativeWork` per page, `isBasedOn` → repo source.
- [ ] All prose + recipe in static HTML (never JS-injected); render iframe is lazy.
- [ ] `sitemap.xml` regenerated to list every page; `robots.txt` allows all + points to it.
- [ ] Internal topic-cluster links between related views; one backlink to mojulo.ai per page.
- [ ] Static thumbnails on the index (no live iframes in the grid); responsive; fast.
- [ ] Self-contained pages only — no external CDN/font/script (Pages + brand-safe + fast).

## 9. Build phases

- **Phase 0 — decide** name/URL (§ open-decision 1), create repo, enable Pages.
- **Phase 1 — scaffold + one real view.** Fork `theme.css` (strip marketing nav), write
  `gallery.json` schema + `build.mjs` + the per-view template, hand-bake **black hole**
  end-to-end, deploy, confirm it's live and crawlable.
- **Phase 2 — the baker.** `bake.mjs` against the local control plane; the `content.md`
  authoring flow; JSON-LD + SEO block generation in `build.mjs`.
- **Phase 3 — populate.** Bake the initial catalog (§6); write each `content.md` (the real
  work — the teaching text); thumbnails.
- **Phase 4 — SEO polish + wiring.** Sitemap, structured data validated, Search Console,
  reciprocal mojulo.ai ↔ atlas links, topic-cluster internal links.
- **Phase 5 — ritual.** Document the add-a-view flow in README; from here it's steady-state
  curation, one worthwhile view at a time.

## 10. Non-goals / guardrails

- Not a mirror of the sketches DB — a *curated* set of worthwhile views, hand-picked.
- No marketing copy, no lead capture, no analytics beyond what SEO needs. Pure education.
- No server, no DB, no secrets in the repo — static files only (the Pages contract).
- Never hand-edit generated HTML; the registry + `content.md` are the only inputs.
- Stays a separate repo from mojulo (its own cadence); mojulo only hosts the optional baker.

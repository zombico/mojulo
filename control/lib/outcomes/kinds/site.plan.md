# site — the navigational publication kind

The first **multi-page** publication kind. Every existing kind renders a single
document (`essay`, `resume`, `newsletter`) or a paginated deck (`slide_deck`,
`picture_book`). `site` renders a **navigable static website**: a home page plus
N sub-pages, a shared nav, a footer, and a theme — one stash → one self-contained,
portable site.

Target use: **personal sites, marketing/brochure sites, ordinary small-business
sites**. Static tier only (operator's choice) — no form processing, no runtime.

## Why it's its own kind (vs. essay / lesson_plan)

- `essay` is one scrolling document. A site is *several* pages you move between.
- `lesson_plan` proves the substrate can write **multiple cross-linked HTML files
  into one folder** (`index.html` + `handout.html`). `site` generalizes that from
  two fixed faces to **N pages driven by the stash's drawers**, plus a real nav.
- It's navigational, not paginated: pages are reached by clicking nav links, not
  by flipping a book-viewer. So `site` is NOT in `PAGINATED_KINDS`.

## Invariants

Inherited from the outcomes substrate:

- **Strictly static** — no JS framework, no client-side rendering, no server
  runtime. Interactivity (mobile nav toggle) is **CSS-only** (checkbox hack).
- Self-contained folder; frozen to its template version.
- Whole-stash semantics — the site IS the stash (added to `WHOLE_STASH_KINDS`).

New, and load-bearing for `site` specifically:

- **Portability contract.** All internal links are **relative** (`about.html`,
  `assets/logo.svg`) — never absolute `/outcomes/<ref>/...`. The folder must run
  **identically** from `file://`, the `/outcomes/<ref>/` route, AND any external
  static host (Netlify / Cloudflare Pages / GitHub Pages / S3). This is the
  acceptance test — it's what makes the output a *real website*, not a viewer-bound
  document.

## Input model — stash → site

- **Drawer = page.** Each drawer becomes one `<slug>.html`; the drawer name is the
  nav label, slugified for the filename. Drawer order (or `metadata.order`) sets
  nav order.
- **Root items (no drawer) = the home page** (`index.html`).
- **Item order within a drawer = section order** down that page.

### Item type → render

- `markdown` → a content section (headings, prose, lists, tables). Leading `h1` =
  section title.
- `sketch` → inline figure/graphic (reuse `resolvers/sketch.js`).
- `image` / `svg` → hero image, logo, or gallery image (relative-referenced).
- `link` → nav item, CTA button, or external link card (role decides — below).
- `text` → callout / tagline / hero copy.

### Roles — `metadata.role` tells a section what it is

- `hero` → hero band (headline + sub + optional CTA). The home page leads with it;
  `aim` is the default headline, `report_md` the default hero copy.
- `cta` → call-to-action button/band (marketing).
- `feature` / `service` → card in a features/services grid.
- `logo` → site logo, lifted into the nav.
- `footer` → footer content (contact info, social links, copyright).
- (default) → an ordinary content section.

## Responsive foundation (shared by all presets)

Extend the existing template house style (`:root` token system, system font stacks,
box reset, zero dependencies — see `outcome.html`). The site shell adds the
**modern intrinsically-responsive patterns** that work desktop↔mobile without a
thicket of breakpoints:

- **Container** — `width: min(100% - 2 * var(--gutter), var(--measure)); margin-inline: auto`.
  Centers and fluidly pads with no media query.
- **Fluid type** — hero + headings use `clamp(min, preferred-vw, max)`; body stays a
  fixed comfortable size. One type scale, scales itself.
- **Fluid spacing** — section padding via `clamp()` (a `--section-y` token).
- **Card grids** (features / services / portfolio / footer columns) — the canonical
  intrinsic grid: `grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr))`.
  The `min(100%, …)` guard kills overflow on narrow screens. Reflows 3→2→1 columns
  on its own — **no media query needed**.
- **Nav** — flexbox bar, `position: sticky; top: 0`. Below a single breakpoint it
  collapses to a **CSS-only hamburger** (hidden checkbox + `<label>`, `:checked ~ nav`
  reveal) — honors the no-JS invariant.
- **Media** — `img, svg { max-width: 100%; height: auto }`; heroes use `object-fit: cover`.
- **A11y / modern polish** — `:focus-visible` outlines, `aria-current="page"` on the
  active nav link, `@media (prefers-reduced-motion: reduce)` to drop transitions,
  contrast-checked token pairs.

Exactly one baked `<style>` in `site_page.html` holds all of this, written against
tokens. No external CSS, no framework, no JS.

## Preset system — `publication.style`

The three archetypes the operator named map to **presets**. A preset is NOT a
separate stylesheet — it's a **`:root { … }` token block + a `data-preset` hook**,
injected the same way essay injects `--accent` / theme overrides today:

1. Shared stylesheet (structure + the responsive foundation above) keys off tokens.
2. Each preset supplies a token block (palette, font vars, `--radius`, `--measure`,
   `--section-y`, `--hero-min`) into the `{{theme_style}}` slot.
3. `<body data-preset="marketing">` lets the few **structural** deltas key off
   `[data-preset="…"]` (e.g. marketing's full-bleed accent bands, personal's serif
   headings). Minimal duplication; all static.

The four presets (`style.preset`), each on proven modern layout patterns:

| preset | personality | patterns | default palette / type |
|---|---|---|---|
| `personal` | warm, editorial, writer/portfolio homepage | narrow measure (~65ch), single-column-forward, project grid, soft accent | **serif headings** (Iowan/Palatino stack — already in repo) + sans body |
| `marketing` | bold, conversion-first product/landing | big fluid hero (headline `clamp` → ~4rem), prominent CTA buttons, feature-card grid, alternating full-bleed section bands, logo row | sans display, tight tracking, saturated accent |
| `business` | clean, trustworthy, agency/local/professional | balanced hierarchy, services grid, sticky nav with CTA button, contact block (address/hours) | professional slate/navy palette, sans or serif |
| `minimal` | near-zero chrome, link-in-bio / index | system font, monochrome + one accent, hairline dividers, generous whitespace, single column, no cards | system font, mono-ish restraint |

Also on `publication.style`:

- `style.accent` — reuse `ACCENT_NAMES` + hex (already in cook.js); overrides the
  preset's default accent.
- `style.theme` — add `site` to `THEMED_KINDS` (full-page palette override).
- `style.font` — optional curated heading/body pairing override.

Presentation only. The renderer **never rewrites prose** (same rule as lesson_plan
bands). Dark mode (`prefers-color-scheme`) is a per-preset optional token block —
**deferred to a fast-follow**; v1 ships light presets.

## SEO / meta (business + marketing need this)

- Per page: `metadata.seo.{title, description}` → `<title>`, `<meta name=description>`,
  Open Graph tags.
- Site level: `aim` → default site title; `metadata.site.{name, tagline, favicon}`
  on a root item (or the publication config) → nav brand + `<title>` suffix.

## Files written

```
site_ref/
  index.html          home (hero + root sections)
  <slug>.html         one per drawer/page (about, services, contact, …)
  report.md           source-of-truth markdown
  manifest.json       machine index (+ a pages[] map)
  assets…  (svg/png)  relative-referenced
```

## New templates & partials

- `template/site_page.html` — the shared page shell: `{{>doc-head}}`, nav partial,
  `{{page_content}}` slot, footer partial. One template, filled once per page.
- `partials/site_nav.html` — the nav bar (built once from the page list, injected
  into every page; active page via `data-page` + `[aria-current]`, CSS-highlighted).
- `partials/site_footer.html` — the footer.
- Reuse `partials/doc-head.html`, `render-template.js` (partials + slots),
  `markdown.js`.

Responsive breakpoints + the CSS-only mobile nav toggle live in `site_page.html`'s
baked `<style>` (no external CSS, no JS).

## Writer — `writeSiteOutcome({ cookRef, aim, slices, reportMd, publicationStyle })`

1. Resolve the single whole-stash slice → items grouped by drawer.
2. Build the ordered page list: home (root) + one per drawer.
3. Build the nav once from the page list.
4. For each page: render its sections (dispatch by item type + role) → `page_content`,
   fill `site_page.html` with nav, seo slots, and the resolved theme `<style>` block.
5. Write `index.html` + one file per page + `report.md` + `manifest.json`
   (manifest gains a `pages: [{ slug, label, file, section_count }]` array).

Special-cased in cook.js's dispatch (like `lesson_plan` / `comic`) because it's
multi-page and consumes the style block + drawer grouping rather than the single
`report_html` slot.

## cook.js wiring checklist

1. Add `'site'` to `PUBLICATION_KINDS`.
2. Add `'site'` to the **three** `enum` arrays in the tool schema (search `enum:`).
3. Add `'site'` to `WHOLE_STASH_KINDS` and `THEMED_KINDS`. (NOT `PAGINATED_KINDS`,
   NOT `ACCEPTS_VISUALS`.)
4. Import `writeSiteOutcome`; add it to the writers map / dispatch.
5. One line of routing copy in the big tool `description` string + `sketch_plan` /
   `recommend_kind` ideal-content-shape rule (drawer = page model) so "make me a
   site" routes to `site`.

## Where the effort actually goes (the load-bearing principle)

The mechanics of this kind are the **easy 90%**: drawer→page, roles, nav, the
portability contract — all settled by the converged web platform and mechanically
testable. Do NOT lavish craft here; get it thin, correct, and out of the way.

The **hard 10% is taste**, and it lives entirely in the **presets**. "Does this
marketing site look good" is the only part with no external ground truth and no unit
test. So the effort budget inverts the line count: the scaffold is quick; each
preset is a real design artifact.

Consequences for this plan:

- **Presets are the main event, not step 4.** The scaffold exists to serve them.
- **Each preset must be specced to reference quality** — actual token values,
  the exact hero/section/footer composition, a worked example — not the personality
  adjectives in the table above. That table is the brief; the preset file is the work.
- **Build one preset to a genuinely high bar first**, prove the pattern end-to-end,
  then the other three are cheap replication over the same shell.
- **Borrow, don't invent.** The medium is converged — adapt known-good modern site
  layouts (marketing landing, portfolio, agency, link-in-bio). Inventing a novel
  layout language is effort spent against the grain of the one thing that's easy here.

## Tests

- `site.test.js` — unit: drawer→page mapping, role dispatch, theme resolution,
  whole-stash enforcement.
- `site-demo.gen.test.js` — golden (matches the `*-demo.gen.test.js` pattern):
  assert N drawers → N+1 pages, nav present on every page, **relative links only
  (grep the output for `/outcomes/` and `http` origins → must be absent from
  internal links)**, seo tags present, theme applied.
- **Visual review gate (the part that matters).** The mechanical tests can't see
  taste. So each preset is rendered to a demo site and **actually looked at** —
  render the page(s) to PNG (the `view-svg` / HTML-rasterize path) at desktop AND a
  narrow mobile width, and eyeball hero, grid reflow, nav collapse, contrast. A
  preset isn't "done" because the golden test passes; it's done when it looks right
  at both widths. This gate is explicit precisely because it's the only check on the
  hard 10%.

The relative-links assertion is the portability contract, mechanically enforced.

## Real-content trial findings (Production AI Systems consulting site)

Ran the kind against a real bespoke-branded brochure (`homepage_draft.md` +
`style-tile.html`): 8 pages (home + Method/Work/Governance/Services/About/Contact),
`personal` preset + `accent: #0F5257`. Two things learned, both now handled:

- **FIXED — accent override silently lost to the preset.** cook injected accent as
  `body { --accent }` (0,0,1) but preset token blocks are `body[data-preset]`
  (0,1,1), so the preset always won. Now the accent is applied INLINE on `<body>`
  (1,0,0,0) by the writer (regression-tested). Presets must beat `:root`; the
  accent must beat presets — only inline resolves that ordering.
- **WIN — an `svg` item carries a bespoke diagram verbatim.** The operator's
  signature "reasoning boundary" schematic dropped straight in as a figure and
  harmonized with the teal accent. Custom brand marks survive as svg items today.

**The real gap it exposed → the next feature.** Preset + single-accent gets you a
*clean, credible* site but NOT a *bespoke brand*: no custom web fonts (Fraunces /
IBM Plex), no full palette control (paper/ink/amber), no reserved-signal color
(amber-for-governance), no custom section styling (the risk table). That's a
`brand` escape hatch — `publication.style.tokens` (a validated CSS-var map:
--bg/--ink/--accent/--font-head/…) + an optional self-hosted/`@font-face` web-font
pairing + a couple of semantic roles (a `risk_table` / `signal` role). Deferred,
but this trial is the argument for it. See v1 cuts below.

## v1 scope cuts (logged, not silently dropped)

- **No contact form processing** — static `mailto:` only. Form-posting-to-a-mojulo-bot
  is the documented next tier (operator chose static now).
- **No blog** — drawer=page only. A blog (drawer → one page per post, index +
  pagination) is a follow-up shape.
- **CSS-only interactivity** — nav toggle only; no JS of any kind.
- **One site per cook** — composing multiple cooks into one site is future.

## Build order (front-loaded on the hard part)

Get the scaffold thin and fast (steps 1–3), then spend the real time on presets
(steps 4–5) — one to reference quality, the rest as replication.

1. **Shell** — `site_page.html` + `site_nav.html` + `site_footer.html`: the
   responsive foundation, written against tokens, one page rendering.
2. **Writer** — `site.js`: root → home only (single page, hero + sections).
3. **Multi-page** — drawer grouping + nav across pages + relative cross-links +
   the portability golden test. *At this point the easy 90% is done.*
4. **Preset #1 to reference quality** — pick `marketing` (most patterns exercised).
   Real token block, real hero/CTA/feature-grid/footer composition. **Render it and
   look at it** (desktop + mobile). Iterate until it looks right. This proves the
   whole preset mechanism and sets the quality bar.
5. **Replicate to `personal` / `business` / `minimal`** — same shell + `data-preset`
   hook, each with its own token block and the deltas from the table. Visual-review
   each at both widths.
6. **Wire + route** — cook.js checklist + `sketch_plan`/`recommend_kind` copy.
7. **Companion catalyst** (fast-follow) — `design-a-site` over the shipped kind, so
   it's operable by framing, not mechanics.

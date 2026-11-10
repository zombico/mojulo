# Books: the press, its style library and the PDF

A book mojulo makes is one self-contained page that reads on a screen and prints as a book: its paper, margins,
columns, running title and page numbers set by `@page`, its type in faces that ship with the repo, its colours from a
named look. Headless Chromium prints it to PDF. The page is the recipe's deterministic artifact; the PDF is its print.

Code: [control/lib/graph/book/](../control/lib/graph/book/). First book on it: the table RPG's game book
([table-rpg.md](table-rpg.md)), `node scripts/table-rpg.mjs --book out.html --pdf out.pdf --style <preset>`.

## The style library

A **style** is a look × a format × faces, each named by key; a preset composes the three, and a book can name a preset,
a preset with any part swapped, or the parts alone (`readBookStyle`).

| Part | Vocabulary | Where it is defined |
|---|---|---|
| look | the presentation theme tokens (paper, sepia, newsprint, light, high-contrast, dark …): the words decks and charts already use | `PRESENTATION_THEMES` in `lib/visual-language/themes.js` |
| colours | `palette: { paper, tint, ink, muted, rule, accent }`, hex, over the look (a solved palette's `ui` from `pick_palette` maps straight on) | `readBookStyle` |
| format | how the page is used: one column held in the hand, two columns on a full page, one landscape sheet folded in three, a form a page | `BOOK_FORMATS` in `book-style.js` |
| paper | letter, A4, half-letter, A5 | `PAPERS` |
| faces | text, display and mono roles, each a font-shelf key | `FONT_SHELF` in `lib/graph/image-outcomes/fonts/font-shelf.js` |
| presets | the compositions: an old book, a photocopied zine, a typewritten dossier, a one-sheet pamphlet, a screen reader | `BOOK_STYLES` |

The look is a theme token on purpose: one vocabulary across every page mojulo makes, so a game's deck, book and
handouts can share a word. A dark look is a screen look; printing it is advised against (a finding), never refused.

## Faces

The font shelf is the one type vocabulary: covers carve from it and books set text in it. Every face is SIL OFL,
vendored unmodified beside its licence (`*.OFL.txt`), listed in `fonts/LICENSES.md` and `NOTICE`. The press inlines a
vendored face as `@font-face` for the styles its roles use (the text face its roman, italic and bold; a title or the
tables their roman), so a style's page carries only its own faces; a face not vendored inlines nothing and its stack
falls back to the host's. The PDF embeds the faces subset to the glyphs used.

## The press

`bookHtml({ title, style, chapters })`: chapters are a title page, text in the format's columns, or pages of their
own (forms, sheets). The blocks a book of play is made of are functions in `book-press.js` (a keyed entry, a stat
block, a roll table, a boxed note, a figure across the columns, a grid of boxes, ruled lines), each kept whole across a
page or column break. Pure: no clock, no fetch, no script.

## The PDF

`printPdf(html)` (`book-pdf.js`) prints through the same headless Chromium the scene bakes resolve
(`lib/graph/scene/chromium.js`: an explicit binary, the cached build, a system browser, or a fetch only with consent,
never under the Claude plugin profile): the page's own paper size, the colours printed, tagged, the headings as the
PDF's outline. The live suite `book-pdf.live.test.js` (the e2e tier) prints a book and a one-sheet pamphlet.

## Drawn plates

A book's illustrations can be drawn, not only diagrammed: `drawnPlate(spec, { style, caption, span, id })`
([drawn-plate.js](../control/lib/graph/book/drawn-plate.js)) returns the press's `plate` figure holding an SVG of
curves, in the book's own paper and ink. Nothing in a plate is placed in pixels. The spec is what a draughtsman is told:

| Part | What it says |
|---|---|
| `forms` | the things, each a list of field terms (what `mint_solid` reads: sphere, ellipsoid, box, capsule, lathe, sweep, blended or cut), standing on the ground in metres, z up; `tint` its local colour, `gloss` a highlight. `formsOfSolid(manifest)` takes a minted workbench solid's own `fields` |
| `station` | where the eye is: `turn` (how far the view is turned off the forms' y axis), `eye` height, `distance`, `lens`, `look`. The eye is level, so this is two-point perspective: verticals stay upright and the two vanishing points follow from the turn and the lens |
| `light` | one light as it is said at the easel: `azimuth` 0 from behind the eye, -90 from the left; `elevation` above the ground |
| `finish` | `wash` (tone in translucent steps), `engraving` (tone in hatch lines that follow the form), `woodcut` (one step, black and paper) |
| `frame` | `fit` (cropped to what is drawn, the default) or `full` (the whole picture plane); `construction: true` draws the horizon and the lines to the vanishing points |

How it draws: each sample of the picture plane is lit where the eye's ray meets a form (light, halftone, core shadow,
reflected light, cast and contact shadow); each tone step is the closed outline of "darker than this", laid over the
lighter one; a hatch line is a slice of the form by a plane square to the light; the contour is heavier on the side
away from the light. The outlines are fitted with cubic curves, so a plate is a vector figure at any print size.

Pure and deterministic (the same spec, the same bytes); a plate takes a second or two to several, by its size and how
many terms its forms have, and an engraving is the largest on the page because every hatch line is a path. Several
plates on one page each take an `id`, which keeps their clip ids apart. From the shell:

```bash
node scripts/drawn-plate.mjs <out-dir> [example,… | plate.json] [--finish wash,engraving,woodcut] [--construction] [--full]
node scripts/drawn-plate.mjs --book <out.html> [--style tome] [--pdf out.pdf]     # a sample book with three plates
```

What it does not do yet: a line-only finish, material texture, transparency, a second light, any surface but the
ground, labels with leaders, and solids that are not field terms (a face-list solid, a hero, a world). No door mints a
plate and no book calls for one on its own; a book's builder adds the block.

## Not yet on the press

The other books (the gameworld and character bibles, the structure, city and historic books) each carry their own
CSS, and the cooked publications (`cook` / `forge_publications`: novel, picture book, field guide, pamphlet …) set
type in host faces and reach PDF only through the browser's print dialog. Moving them onto the press would give each
the style library, the shelf's faces and a direct PDF; that is a separate step.

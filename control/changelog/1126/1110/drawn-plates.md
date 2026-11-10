### Drawn plates: a book's illustrations, drawn from solid forms in curves

- **A book can now carry drawn illustrations, not only diagrams.** `drawnPlate(spec, { style, caption, span, id })`
  (`lib/graph/book/drawn-plate.js`) returns the press's figure holding an SVG of curves in the book's own paper and
  ink. A plate is said the way a draughtsman is told, and no pixel is placed: the forms (field terms, what
  `mint_solid` reads, standing on the ground in metres; `formsOfSolid` takes a minted workbench solid's own `fields`),
  the station (a level eye, so two-point perspective: the vanishing points follow from the turn and the lens), one
  light, and a finish. Each sample of the picture plane is lit where the eye's ray meets a form, each tone step is the
  closed outline of "darker than this" laid over the lighter one, a hatch line is a slice of the form by a plane square
  to the light, and the contour is heavier on the side away from the light. Three finishes: a wash, an engraving, a
  woodcut. Round and blended forms, a shadow cast from one form onto another and inner edges are drawn; the plate is
  framed on what it holds. Deterministic: the same spec gives the same bytes.
- **From the shell:** `node scripts/drawn-plate.mjs <out-dir>` draws the examples (or a plate's JSON) in each finish;
  `--book <out.html> [--pdf out.pdf]` sets three of them in a sample book on the press.
- **Not yet:** no door mints a plate and no book calls for one on its own (a book's builder adds the block); a
  line-only finish, texture, transparency, a second light, a surface other than the ground, and solids that are not
  field terms are not drawn. The sketch expander (`neo-rembrandt`, `rendrant`) is unchanged: stored sketches still
  regenerate through it.

# plate: a drawn illustration of solid forms (spike)

A tractability probe for reviving the Rendrant / neo-rembrandt idea (chiaroscuro from superposed shapes, two-point
perspective) as a 2D renderer whose pictures are curves, for a book's plates and a world's flat surfaces.

```bash
cd control
node scripts/spikes/plate/render.mjs --out /tmp/plates                      # every subject, every finish
node scripts/spikes/plate/render.mjs --out /tmp/plates alchemy --finish engraving --construction
node scripts/spikes/plate/grimoire.mjs /tmp/grimoire.html tome              # three plates in a book on the press
```

## What changed in the approach

The old expander asks the agent for shapes in viewBox pixels and a 2D light direction, then clips each silhouette
against that direction to make value bands. Everything it knows is flat, so a form cannot turn, a shadow cannot fall
on another form, and every edge is a polygon's. The recipes, gates and contracts around it grew to make up for that.

The plate keeps the two ideas that were right and moves them into space:

| Principle | In the plate |
|---|---|
| The picture plane is a camera | A level eye, a horizon and two vanishing points fix one station point. The agent gives `station: { turn, eye, distance, lens, look }` and never a pixel; the vanishing points are derived and can be drawn (`--construction`). |
| Block in with solids | A form is a list of field terms (`lib/graph/polygonizer/field-terms.js`), the vocabulary `mint_solid` already reads. Blended terms are the "superposed blobs". |
| One light, five values | Light, halftone, core shadow, reflected light, cast and contact shadow are measured per sample of the picture plane (a ray march), not painted. |
| A tone is a shape over a shape | Each value step is the contour of "darker than this", laid translucent over the lighter one. Steps set the edge: six is a wash, one is a woodcut. |
| A hatch follows the form | A hatch line is a contour of "how far along the light", so it wraps a sphere, runs straight on a box and converges on the box's own vanishing points. |
| The line is lost and found | The silhouette's dark twin, slid away from the light, shows only on the shadow side. |

## What the spike showed (machine facts; the eyes gate is the operator's)

- It draws round and blended forms, forms shadowing forms, and inner edges, none of which the old expander can.
- Deterministic: two runs of a subject give the same bytes.
- Cost: 3 to 11 s for a wash and 8 to 19 s for an engraving at `res 2` (two samples per unit), unoptimised, single
  thread. Almost all of it is the per-sample march and the full-grid blurs, both of which shrink with the form's
  screen bounds.
- Size: a wash is 160 to 310 kB of SVG (50 kB gzipped); an engraving 290 to 600 kB (170 kB gzipped), because every
  hatch line is a path. `res 1.25` cuts a quarter off with little visible loss.
- The press takes it as it is: `plate(svg, { caption, span })` already exists. Ids need a prefix per plate
  (`renderPlate(..., { prefix })`) and `backdrop: false` lets the book's paper show through.

## What is not solved

- **Authoring is now the hard part, not rendering.** Writing an organic form (the skull subject) blind in metres took
  guesses; the agent needs the look-and-adjust loop the solid door already has, or to draw a solid that is already
  minted (a `ref`), which is the stronger path: every object, hero and prop in the studio becomes illustratable.
- Framing: the plate does not crop to its subject, so small subjects float in the frame.
- Curve fit is heuristic (simplify, then cubics with corner detection); thin forms and lathe profiles with kinks
  show a wobble in their tone edges.
- No line-only finish, no texture (wood grain, glass), no transparency, no text or labels with leaders.
- One light. A second (a rim or a candle as a point light) is a small change to the tone field.
- Ground only as a plane; no wall, no table edge.

## The old expander

`lib/graph/neo-rembrandt/` and `lib/graph/rendrant/` are not touched. Stored sketches regenerate through them on
every read, so their output is a compatibility promise; they cannot be rewritten into this, only frozen behind it.
"Combining" them means: one new renderer on these principles, the old one kept as the legacy path for the rows and
cards that already name it, and the cards that teach pixel-placed construction marks pointed at the new one once it
is a kind.

---
{
  "id": "furniture",
  "name": "Furniture (composed from forms and finishes, locked)",
  "family": "object",
  "entry": "mint_solid",
  "summary": "Compose a sofa, armchair, chair, table or piece of casework from a style to start from, one form per slot (arms, back, seat, legs, front), a finish (fabric, timber, board, paint) and a size. The composition is locked at mint into a display piece for furnishing houses and rooms — drawn as a room draws its furniture, filled to its size, flagged not buildable — and a patch restyles it in place. `buildable: true` stores the jointed build instead.",
  "when": "Reach for this on 'a chesterfield', 'a velvet sofa with rolled arms', 'a tuxedo sofa', 'a mid-century sofa on tapered legs', 'an armless settee on hairpin legs', 'a club chair', 'a farmhouse table with turned legs', 'a dining chair', 'a painted chest of drawers', 'a sideboard', 'a bookcase', 'furniture for my room', 'a couch in tartan', 'change the legs to turned', 'the same sofa in green linen'."
}
---

Name a style and change what you want. A piece is a KIND, one FORM in each of its slots, a FINISH and a size. A style is a worked piece over the same forms (a chesterfield is a sofa with high rolled arms, a tufted back and one bench seat, in velvet), so a piece nobody has listed is a style with a slot or two swapped. The mint resolves the composition and LOCKS it: the row stores the build's resolved dials, its cloth, tint and leg form, and its size.

**These are assets for furnishing houses, not plans for making.** By default a piece is a display piece (`buildable: false` in the result and in `stats.furniture`): drawn from a furniture build the way a room draws its furniture (no joints, pulls on, legs shaped), filled to the size you give it exactly, and carrying no construction report or cut list. Place it in a house with `rooms[i].items: [{ ref: '<its ref>', wall?, at?, size?, height? }]` (the house card), or in an assembly by ref. `buildable: true` stores the jointed build instead, one workbench frame (the workbench card's furniture and upholstery sections), which the furniture report (tip-over, racking, sag, seating), the manual, the cut list and the bill of materials read; it holds the build's own proportions and says where it could not take the size asked.

## Spec

```
{ like?:   '<style>',                                   // start from a style (below), or
  piece?:  'sofa' | 'chair' | 'table' | 'casework',     // start from a kind's defaults
  forms?:  { <slot>: '<form>', … },                     // swap per slot
  finish?: { fabric?, timber?, wood?, tint?, board?, paint?, piping? },
  size?:   [w, d, h],                                   // millimetres (default: the style's)
  buildable?: false | true,                             // false: a display asset (default); true: the jointed build
  title?, ref?, folder_ref? }
```

The result's `furniture` names the `basis` (the style it started from), what was `worn` (each slot and finish key you swapped), the resolved `forms` and `finish`, `size_mm` and `buildable`.

## Kinds and their slots

- **sofa** — `arms`: track · rolled · tuxedo (track, as high as the back) · rolled-high (rolled, as high as the back) · none. `back`: loose · tight · tufted (buttoned in a diamond). `seat`: loose (a cushion a sitter) · bench (one long cushion). `legs`. A one-seat sofa is an armchair; the seats follow the width.
- **chair** — `legs`. The seat height follows the back.
- **table** — `legs`.
- **casework** — `front`: open (shelves) · doors · doors-over-drawer · drawers (as many as the height takes) · two-drawers.

`legs`: block · tapered · turned · bun · hairpin. A leg form changes only what is drawn: the build cuts a square blank and a turned or tapered leg is turned from it, so the joints, the manual and the cut list stay the blank's. A turned leg keeps a square pommel where the rails meet it; a chair's back leg is turned only up to its rails. A hairpin leg is steel rods on a mounting plate.

## Finishes

What each kind wears (a key it does not wear is refused, naming the ones it does):

- **sofa** — `fabric` (a cloth preset: linen, canvas, twill, herringbone, houndstooth, gingham, tartan, ticking, velvet, boucle; or `{ preset?, weave, warp, weft? }`, the workbench card's cloth), `timber` (its legs and frame), `tint`, `piping` (true, false or '#rrggbb').
- **chair**, **table** — `timber` (oak, ash, keyaki, pine, douglas-fir, spruce, hinoki, sugi, walnut, cherry, maple, beech, birch), `wood` (raw, oil, wax, bengara, sumi, kakishibu, urushi, yakisugi, gofun, limewash), `tint` ('#rrggbb').
- **casework** — `board` (plywood, mfc, mdf …: the sheet materials), `wood` (its finish), `paint` ('#rrggbb', over the board).

## Styles

The room facades: `sofa`, `armchair`, `chesterfield`, `coffee-table`, `dining-table`, `chair`, `bookcase`, `media-console`, `sideboard`, `chest`, `nightstand`. Composed from the same forms: `tuxedo`, `english-roll-arm`, `mid-century-sofa`, `settee`, `club-chair`, `farmhouse-table`, `mid-century-table`, `windsor-side-chair`, `painted-dresser`.

```
{ like: 'chesterfield', forms: { legs: 'turned' }, finish: { fabric: 'tartan' } }
{ piece: 'sofa', forms: { arms: 'none', back: 'tufted', legs: 'bun' }, finish: { fabric: { preset: 'velvet', warp: 'mustard' } }, size: [1600, 850, 780] }
{ like: 'mid-century-table', forms: { legs: 'hairpin' }, size: [1600, 850, 750] }
{ like: 'chest', finish: { board: 'mfc', paint: '#c9a227' } }
```

## Editing a minted piece

A display piece is stored as `{ kind: 'workbench', units: 'mm', build: { type: 'furniture', piece, dials: { type, …the build's dials }, legs?, size, fabric?, tint? } }`. The dials are the truth; restyle in place with `update_sketch`:
`set /build/dials/arms 'rolled'`, `set /build/dials/back 'tufted'`, `set /build/dials/seats 2`, `set /build/legs 'turned'`, `set /build/fabric 'linen'`, `set /build/tint '#5a3a22'`, `set /build/size [1600, 850, 780]` (filled exactly). The build's own dials (the workbench card) are all open: `seatH`, `backH`, `armH`, `legH`, `pillows`, `piping` on a sofa; `top`, `leg`, `apron`, `overhang` on a table; `shelves`, `doors`, `drawers`, `drawerHeight` on casework.

A buildable piece is `{ frames: [{ id, unit: 'mm', build: { type, …dials }, fabric?, tint?, legs? }] }`: the same edits on `/frames/0/build/<dial>`, `/frames/0/fabric`, `/frames/0/legs`.

To compose again from a style (a different `like`, a size that re-derives the seats or the drawers), mint again. A minted piece never moves when the styles are retuned: it holds the dials, not the style's name.

## Gates

Machine: the mint lowers the build (a seat too low for its deck, arms too narrow, a back too short are refused with the numbers). A display piece is not checked for building and says so; a buildable piece's report rides `stats.frames`. Eyes: look at the piece in the World before calling it right; the leg forms and the cloth are drawn, not measured.

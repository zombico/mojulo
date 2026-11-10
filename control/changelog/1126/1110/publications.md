### Publications: the books a world keeps, printed and read in play

- **A grimoire, a bestiary, a manual or a notebook is now one small recipe, and it is read three ways.** Printed as a
  book on the press (with a PDF), opened as a book held in the hands (two pages side by side, turned with the arrows,
  a click or a swipe), and found in a level. The pages are the same in all three, so the book a player reads is the
  book that prints. A recipe is words and blocks, never html: paragraphs, headings, notes, remarks in the margin,
  numbered entries, a creature's numbers, tables, drawn plates, and figures another tool made.
- **A level can keep a library.** `play.library: [{ id, book, found? }]` puts books on a shelf the player opens with L.
  A book is there from the start, or joins the shelf when a flag is set (a scene, an answer or a cue sets it), and a
  word shows at the top when it does. The shelf holds the world as a menu does; a cover opens the book, the arrows
  turn it, Escape closes it. A level without a library is unchanged.
- **Illustrations without writing forms by hand.** A shelf of small things already built (a still, a vial, a cup, a
  candle, a book, an orb, a crystal, a sword, a shield, a skull, a toadstool) can be stood up to four in a row as a
  still life, each in a tint, and drawn as a plate with its viewpoint and light set for what it holds.
- **The lorecube's parts can be published.** A monster manual becomes a bestiary (a chapter an element, an entry a
  creature, with what it fears and its numbers once those are settled); a skill tree becomes a grimoire (the school,
  then a chapter a tier, each technique with how it is come by and what it costs). Both are written from the lore's
  own data, with its diagram set in, and leave out whatever a later pass has not yet said.
- **Three forms brought over from the studio's publisher.** A **comic** is a new kind of publication: each page is
  a grid of panels (seven layouts, from one full panel to a splash over three), each panel a picture with a caption
  box and up to three balloons, and a comic can be set to read right to left. A **specimen** is a field guide's entry:
  the picture, its number and name, a second name, its marks and a description; a bestiary is now made of them, one a
  creature. A **cover** gives a book a front: the studio's cover layouts with a drawn plate where the illustration
  goes, on a cloth of its kind's colour. The cover is the book's first page in print and in the open book, and it is
  what a level's shelf shows; a book without one keeps a plain binding.
- **From the shell:** `node scripts/publication.mjs <out-dir> [--pdf]` writes the examples (a notebook, a handbook, a
  comic, the sample bestiary and grimoire) as press pages, open books and PDFs.
- **Not yet:** no door mints a publication (a recipe is written into a level or handed to the functions); the game
  designer, the bibles and the table RPG's game book do not make one; a book is found by a flag, not as an item or a
  place in the world; publications are not a department and join no chapter of the game book. A level's page carries
  each book whole, so a book of engravings adds a megabyte or more to it.

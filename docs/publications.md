# Publications: the books a world keeps, printed and read in play

A **publication** is a book the studio makes for a game and its world: a grimoire, a bestiary, a manual, a notebook, a
comic.
It is one small recipe of data, and the same recipe is read three ways, so the book a player finds in a level is the
book that prints.

Code: [control/lib/graph/publication/](../control/lib/graph/publication/). It stands on the press
([books.md](books.md)) and its drawn plates, and is called by other tools; nothing here is a door of its own.

| Read as | By | What it is |
|---|---|---|
| a printed book | `publicationBook(P)` | the press's page: reads on a screen, prints as a book, PDF through `book-pdf.js` |
| an open book | `readerHtml(P)` | one self-contained page: two pages side by side (one on a narrow screen), turned with the arrows, a click or a swipe |
| a book in a level | `play.library` | a shelf the player opens with L; a book opens as the reader inside the game's page |

## The recipe

`{ kind, title, subtitle?, by?, style?, cover?, reads?, chapters: [{ id?, title?, blocks }] }`. The kind
(`PUBLICATION_KINDS`) says what it is and which book style it wears unless `style` names another; `reads: 'rtl'` turns
its pages right to left (a manga). A block is one key:

| Block | What it sets |
|---|---|
| `{ p, drop? }`, `{ h }` | a paragraph (a drop capital), a heading |
| `{ note, label? }`, `{ margin }` | a boxed note; a remark in the margin's hand |
| `{ facts }`, `{ stat }`, `{ table }` | label and value lines; a thing's numbers between two rules; a two-column table |
| `{ entry: { n, title, blocks } }` | a numbered entry, kept whole across a turn |
| `{ plate, caption?, span? }` | an illustration drawn from forms ([books.md](books.md#drawn-plates)) |
| `{ figure, caption?, span? }` | an SVG another tool made (a lorecube diagram, a map); refused if it carries script, an event handler or a link out |
| `{ specimen: { name, epithet?, plate? \| figure?, traits?, body? } }` | a field guide's entry: its picture, its number and name, its second name, its marks, a description |
| `{ panels, layout? }` | one page of a comic: its panels in a grid (`PANEL_LAYOUTS`: full, halves, thirds, strip, split, grid, splash), each a picture, a caption box and up to three balloons |
| `{ lines }` | ruled lines to write on |

Words are data and are escaped. `readPublication` refuses what is not one by naming what it takes.

## The cover

`cover: true | { props, plate, tagline, archetype, palette }` gives a book a front (`cover.js`): the studio's cover
grammar (where the picture, the title and the lines under it sit) with a drawn plate where a painted illustration
would go, on its kind's cloth. `props` is a still life from the shelf below; `true` takes the book's own first plate.
It is the book's first page in print and in the reader, and what a level's shelf shows; a book without one is a plain
binding in its kind's colour. Its words are set as type, in the book's faces where the page carries them.

## Illustrations that are not authored blind

A plate's forms are written in metres, which is hard to do by eye. The **prop shelf** (`props.js`) holds small things
already built (a still, a vial, a cup, a candle, a book, an orb, a crystal, a sword, a shield, a skull, a toadstool),
and `stillLife(['alembic', 'candle', 'tome'])` stands up to four in a row and returns the plate with its station and
light set. A word may carry a tint: `['crystal', '#a8cbd8']`. A new prop is a row.

## Lore, published

The lorecube's parts become the books a world keeps of them (`from-lore.js`), from the same data its game plays:

- `bestiaryOf(manual, { diagram? })`: a monster manual as a bestiary. A chapter an element, each creature a
  specimen under its element's sign, with what it fears and, once the manual is numbered, its measure.
- `grimoireOf(tree, { diagram? })`: a skill tree as a grimoire. The school, then a chapter a tier, each technique
  with how it is come by and what it costs.

A part at any depth is published: what a later pass will say is left out, never invented. `diagram` is the part's
own drawing, set as a figure. Both come with a cover. A creature is not drawn: its picture is its element's sign.

## In a level

```js
play: {
  library: [
    { id: 'handbook', book: { kind: 'manual', title: 'The Still-Room Handbook', chapters: [ … ] } },
    { id: 'grimoire', book: grimoireOf(tree), found: 'found-grimoire' },
  ],
  cues: [{ id: 'lectern', when: { use: 'lectern' }, then: { emit: 'flag:found-grimoire' } }],
}
```

A book with no `found` is on the shelf from the start; one with a flag joins it when the flag is set, and a word shows
at the top. L opens the shelf and holds the world as a menu does; a cover opens the book; the arrows turn it; Escape
closes the book, then the shelf. The book sits in a frame of its own, so its page reaches nothing of the game's. A
level without a library carries not a byte of this.

## From the shell

```bash
node scripts/publication.mjs <out-dir> [notebook,fieldManual,comic,bestiary,grimoire | recipe.json] [--pdf]
```

Writes each as `<name>.html` (the press), `<name>-reader.html` (the open book) and, with `--pdf`, its print. The
bestiary and the grimoire are made from the lorecube's sample manual and tree.

## What it costs, and what it does not do yet

- A book's plates are drawn when it is first read in a process (a second or two each, an engraving the largest), then
  kept for that process. A level's shelf holds at most eight books and draws its plates at a coarser grain.
- A level's page carries each book's reader whole; a book of engravings adds a megabyte or more to the page, and a
  bestiary, a plate a creature, the most. A cover adds a tenth to a few tenths of one.
- A comic's panels are still lifes or figures another tool made: no characters are drawn, and there is no lettering
  beyond a caption box and round balloons without tails.
- No door mints a publication: a recipe is written into a level's `play.library` or handed to the functions above.
  `design_game`, the bibles and the table RPG's game book do not make one yet.
- A book is found by a flag; there is no item, no place on a shelf in the world, and no page of a book that unlocks.
- Publications are not a department: they join no chapter of the game book yet.

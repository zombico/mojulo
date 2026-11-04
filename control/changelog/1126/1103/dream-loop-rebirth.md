### A character from the person's picture

The character-from-dream loop is gone, and a character creator from a picture the person gives the agent takes its place.
The old loop needed an image worker to dream a reference and refused anything it had not dreamed, so the Claude plugin
build left it out. It also tuned the old SVG figure, not the hero `create_character` mints. Now the agent reads the
person's own picture itself (a drawing, a photo, a figure, someone's OC): nothing is generated and no image is sent.

- **Retired: the dream loop.**
  - The tools `draft_figure_spec`, `get_figure_spec`, `resolve_figure_spec` and `build_figure_spec`, their spec store,
    the dream audit and the `character-from-dream` catalyst.
  - A figure's `dream_audit` now refuses, pointing at the new target. A figure minted with an audit still renders as
    it did.
  - A home's `data/figure-specs/` folder is left in place and never read.
- **Read the picture: `reference_protocol({ target: 'character' })`.** It tells the agent how to read the picture into
  the hero's own words, in this order: a thesis and its hook, proportions in head-heights, dress before body, hair and
  face, clothes as words, palette, which side the picture shows and what it does not, and what no word reaches.
  - A **look**: toon, anime, painterly anime, shonen, chibi, realistic or statue. Each look is a bundle of hero words
    with its own choices, such as the anime head casts and bodies, the realistic physique or the statue card.
  - A **register**: `round`, `lowpoly`, `chamfer` or `box`.
  - A look or register the person names wins. Otherwise the agent picks one from the picture and says why.
  - Every menu is read off the table that owns it, so a new cast or card is on it with no edit.
- **Make the hero: `capture_reference({ target: 'character', insights })`.** It mints the hero through `create_character`,
  so it is the hero those words make, and files the read in a reference stash.
  - A look's words win over the read's, except a choice the look offers. A word of the read that a look overrode is
    reported.
  - The answer shows the hero drawn at the picture's view, plus the back when the picture did not show it, one image
    per view. The same happens after every `update_character` on that hero, so the agent compares its render with the
    picture and moves one word at a time.
  - It draws with a browser already on the machine and never downloads one. Without one, it says so and gives the
    World page.
- **Likeness is the model's judgment.**
  - For identifiably trademarked work, the agent offers an "X-like" build: the spirit and the look are kept; the name,
    the emblems and the signature details are changed. It negotiates that with the person.
  - The hero carries the verdict as a `reference` word (`original` or `x-like`, what it is like, what changed). An
    x-like hero's readout captions it "X-like: inspired by …".
  - Nothing refuses on it. The person can edit the word or take it off.
- **Sculpting stays the person's.** After the capture, the hero is shaped prompt by prompt like any other. A second
  picture (`stash_ref`) refines it word by word, but never moves a word the person changed by hand since the last pass;
  `replace: true` takes the new read whole.
- **Non-human hair, coated like an animal.** The anime head's shaped hair now builds what no hair word reached, each
  style wearing a coat:
  - `gorgon`: thick bending tendrils, scaled like a snake;
  - `flame`: rising strands, hot at the root and pale at the tips;
  - `feathered`: swept, barred vanes with a crest;
  - `leafy`: cupped leaves;
  - `tentacled`: heavy curling falls with a pale, spotted underside;
  - `quilled`: raking, banded cones.

  Each is a `look` word any anime hero can wear, and the character target's protocol names them for non-human pictures.
  A coat is the beast-kin's own grammar read down each lock as down a tail: `coat: 'snake' | 'tiger' | 'barred' |
  'ember' | 'leaf' | 'banded'` on the shapes, a layer or a piece, or `{ from?, color?, cover?, pattern? }`. Covers are
  scales, fur, chitin or feathers, shading the lock on the page; patterns are stripes as rings, spots, a pale underside,
  dark tips, a line down the lock. The page draws the locks' coat beside the face's own paint. A hair with no coat
  draws exactly as before.
- **Xeno make-up: practical-effects alien appliances on any head.** A new hero word, `xenoHeaddress`, puts a make-up
  crew's pieces on the hero: sculpted, glued on with edges blended into the skin, and painted. It works on the landmark,
  the anime and the realistic head alike. Each piece is found on that head's own skin and pinned to it, so it turns and
  exports with the head. The first cards, named for what they are:
  - `forehead-ridges`: curving ridges up the forehead to the hairline;
  - `nose-ridges`: a stack of fine ridges across the nose's bridge;
  - `head-tails`: two thick tails from the back of the skull, over a bald cap;
  - `swept-horns`: two hollow horns rising from the top of the head and sweeping back;
  - `front-tails`: two head-tails from behind the temples, falling forward over the shoulders, over a bald cap;
  - `horned-tails`: swept horns, two front tails and one down the back, banded pale over dark, over a bald cap;
  - `chitin-crest`: two broad lobes off the brow that arch over the skull and fall beside the face to the shoulders
    like a hood. Each lobe's front is a hard, ribbed shell of plates, its back soft flesh, over a bald cap;
  - `cheek-ridges`: a fine ridge down each cheek.

  A protrusion no card names is written whole: `{ family: 'horn' | 'tail' | 'lobe', at: { az, el }, … }` grows a
  horn, a tail or a flat lobe from an address on the cap. It is shaped by its length, width and tip, a lift up or down off the skin, a sweep
  back, a spread out, and a droop under its own weight. Below the chin a tail falls on its own side of the body, held off
  it, and `pair` grows its mirror. `over` makes it hug the head first, carried over the cap a set distance off the skin.
  A lobe's `plates` lay hard ridges across its front: they wear the `shell` coat (chitin, say) and the lobe wears the
  soft `coat`. Every card is built in the same grammar.

  Each card says what screen alien it recalls, for the X-like stamp of a character read from a picture. `size` scales
  a card. `coat` paints it in the hair coat's grammar, the skin's own colour by default. `replaces: 'hair'` lays a bald
  cap that every head builds by its own rules; on the realistic skin, the scalp is painted bare (the dermis's
  `bareScalp`). The readout's `xeno` says what was placed where; the hero card's `hero-xeno` section and the character
  protocol name it.

  The coats of locks and appliances also draw in the World page's clip preview, on every head: alone on the landmark
  head, and stacked under the painted face's or the realistic skin's atlas on the others. An export's figure carries no
  coat yet.

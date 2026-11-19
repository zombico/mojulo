### The co-op kitchen: seats work the shift, in a kitchen of their own

The work shift (the Work Sim rail's kitchen, farm stand, site and roof) learns its seats, the first step toward the
co-op kitchen the cosmos registry refused: two to four cooks in one kitchen on one screen, an order carried from
station to station and handed between them.

- **Every seat works with its own hands.** A level with seats (`seats.bodies`, a cube's `soul.seats`) lowers the work
  mechanic once a seat: seat n's hands are the holder `hands<n>` (seat 1 keeps `bag`), its presses `s<n>:use-<place>`,
  its zones watching its own body. Stations, shelves, tickets and the clock stay shared. A station slot remembers who
  works it: walking off pauses only that cook's work, and what a run with no wait makes comes into that cook's hands.
- **The pass.** A shelf is put on from one pad and taken from the other by anyone, so a kitchen laid with the shelf
  between two cooks can only be worked by handing things across it.
- **The page.** Seats 2 to 4 each get their own reach and interact press (seat 1's is as it was), emitted only for a
  world with seats and a shift.
- **The proof.** `proveWork` plays several cooks, each its own spawn and reach, on the page's bus; a split kitchen is
  won only through the pass (machine gate). Whether it plays well together is the eyes gate, the operator's.
- **Opt-in, byte for byte.** A level with no seats lowers and emits what it did.
- **The kitchen, a designed arena** (`worksim/kitchen.js`). A card's places are read by role (crates, prep that takes
  only raw things, assembly that takes a made thing, shelves, the hand-in) and laid in a kitchen: `split` (prep on one
  side of a counter, assembly and the hand-in on the other, everything that crosses on a pass set in the counter) or
  `island` (one floor round an island of shelves). A new kitchen is a row. Its laws, measured on its floor and advised,
  never refused: every place reached from its side, the sides sealed (no way round, a counter the cooks cannot jump),
  every order crossing the pass, a pass for everything that crosses, a 760 mm walkway, the whole room on one screen.
- **Tuned to its cooks.** `tuneKitchen` tunes the card for that many hands, then plays the kitchen with its cooks on
  their sides and slows the orders until they keep up; the goal is four fifths of what they served. The simulator alone
  counts four cooks as four times one, and they fall short of that in a real kitchen.
- **The quick door.** `design_game({ quick: { goal: 'work', cooks: 2 | 4, kitchen?: 'split' | 'island' } })`: the
  cube's seats, and the level a kitchen room of its own (`gameworld/kitchen-level.js`), never laid by a trail: the game
  room's area (the trade's floor and walls, cut away on the camera's side), its places dressed as the trade's things,
  no recipe on the floor (the practice room's arrows teach; in the game the cooks work out what comes next), each cook
  on its own side, a seat nobody sits in held still, one fixed overhead
  station framing the whole room. One cook and no kitchen named is the line by the trail, as it was.
- **Each cook's corner.** Seated, each other seat's hands and what it holds stand in its own corner in its colour (P2
  bottom right, P3 top right, P4 bottom); seat 1's are where they were.
- **Made, not refused.** The registry marks `soul.dependence=handoff` (the work mechanic's kitchen) and
  `soul.frame=fixed` (the kitchen's fixed station, besides the versus fighter's) built: the co-op kitchen probe is
  makeable. The shared kitchen joins the Work Sim rail (its words point there; the not-yet list is empty), a quick work
  goal with cooks reads as the co-op kitchen genre, and a sentence asking for one is told the quick door that makes it,
  with its cooks. Proved through the real door: `design_game({ quick: { goal: 'work', cooks: 2 } })` made the game in
  one call, `export_game` wrote it, and in headless Chromium its shell's play button opened the kitchen, two pads sat
  down and a fish crossed the pass into the second cook's corner.
- **The kitchen, seen.** The open orders run along the top of the screen (the work mechanic's opt-in `rail`: each
  ticket in its order's colour, what it wants said, its bar the patience it has left; the 3D ticket markers and the
  order toast give way to it). A tag over every seated cook names its seat in its colour and what its hands hold, so a
  handoff is seen where it happens. The kitchen's dress has pieces of its own: plating stations a stainless counter with
  a plate and a board, a pass between cooks a stainless hatch with a warm lit top, the hand-in a servery with its bell;
  the counter between the sides stainless. A seated shift's seat strip sits at the bottom, the top being the rail's.
- **The food** (`control/lib/graph/food/`). What a card handles is drawn as it is read off the card, never modelled
  item by item. A dish's words compose its parts on its plate or bowl (nigiri, maki rings, a salad heaped in a bowl). An
  ingredient's words give the thing, in the state its words or its station give: worked by hand it is prepped (a fish
  becomes a fillet), run alone it is cooked (rice becomes a bowl of rice), packed by a bucket it goes in a crate or a sack.
  A produce grown from another thing is itself. A thing no row names is a block in a colour from its name. Ingredients,
  states, dishes and vessels are rows (`food/roster.js`); the forms are face lists from the lathe, box and prism, built
  at glyph scale and placed at a size: every round shaded smooth (each corner lit along the mean of the normals meeting
  there, creases over 50° kept sharp, carried as `cornerFills`) and every box chamfered (its faces set in, its edges and
  corners cut, each face lit as it faces). Laws, advised: every thing drawn, a card's things told apart, made unlike what it
  was made from, each in its box. Review: `node scripts/render-food.mjs <dir> [card|all]`, a captioned sheet raw → made
  → dishes. The kitchen's eyes gate is the operator's; the food is not on the page yet.
- **More recipes.** The kitchen gains menus beside the sushi counter, each a recipe shape (`worksim/scenarios.js`):
  `pasta` (pasta and sauce in two pots met on the plate; a tray layered and baked again), `wok` (fried rice and chow
  mein tossed in a wok that burns), `ramen` (a long stock, noodles and eggs boiled, pork sliced, a bowl of four),
  `diner` (a grill, a fryer, a burger stacked; a meal wants a burger and fries), `pizzeria` (dough kneaded and rolled,
  sauce, cheese, topped and baked). The food shelf draws them: arrangements for pasta twirled under its sauce, a toss, a
  bake in a tray, a curry beside its rice, a fold, dumplings, skewers, a soup with its noodles, egg halves and slices, a
  pizza in layers; a thing several things are cooked into that names its base is that base with the rest mixed through
  (fried rice); a dish put through an oven comes out browned; an ingredient's finer method is a row (an egg boiled is
  halved); poultry, pork, dough, bones, tofu and fries are rows. Every starter's food holds every law (a deep sweep).


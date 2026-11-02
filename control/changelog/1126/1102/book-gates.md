### The book tells the truth: the chase frames the hero, the first frame is judged honestly, the books read the run

An end-to-end sweep of the game book (a sentence to `design_game({ compose })`, run, exported, played) found the book
and its gates saying things the made game does not do. Each item below was seen in a run, and is held by a test.

- **The hero's chase frames the hero** (`playscape/hero-chase.js`). Every follow camera stands its eye 3 m short of the
  line the follow rule lays (the stand-off, `follow-pull-in.js`), and a hero's chase was laid at the framing it meant
  (5.5 m back, 2.4 m up), so the eye stood 1.15 m behind the hero: the first-frame gate measured a composed stealth
  hero at 47 % of the frame across outdoors and a crawler's at 88 % indoors (it reads 8–35 %). The chase is now laid
  long by the stand-off (`HERO_CHASE`: its eye 5.5 m behind the hero, 2.4 m up, as meant), for a hero on foot and
  a city level's stalker (a mascot keeps its own chase, tuned with the smaller stand-off its height gives it).
  - **Against a wall the eye stands half a metre off it** (and its near plane), never farther out than the open line
    would put it; it stood 3 m off any wall, so a hero 2.5 m inside a building's entry room had the camera on its back.
    With nothing in the way every follow camera frames as before.
  - Measured by the first-frame gate on a composed stealth game's three levels after a rerun: the hero 45–47 % → 27–28 %
    of the frame across (pass). On a composed crawler's entry room: 88 % → 36 % (a warn, a point over the band: the box
    it measures is coarser than the silhouette); in its exported page the eye stands in the doorway behind the hero, the
    room and its torches ahead.
  - Re-pinned: the emitted pages of every world whose follow camera now stands nearer a wall, and every level a hero on
    foot plays (its camera's numbers).
- **The first-frame gate judges the frame the player sees** (`game/first-frame.js`, `first-frame-check.js`).
  - **It reads the world's canvas.** It took the largest canvas on the page, and a level with a minimap (264 px square,
    transparent where nothing is drawn) is larger than a 16:9 world frame read small: every bright level with one was
    failed as "one colour (#101010) covers 94 % of the frame". It reads the renderer's own canvas now.
  - **Dark is judged against the level's own look.** A colour that is the level's own background (its sky, a space
    level's black; the capture page's view hands it in) is the level, and warns only past 98 % of the frame. A pixel the
    canvas leaves transparent (an image backdrop showing through) is no colour of the level's.
  - **A frame that does not render fails.** A page that timed out or crashed was "skipped": a black flight page went
    through ungated. Only an absent browser, or a level with no World form, is skipped.
  - **A run resumed after the tool's budget gates what it has not gated.** A run that kept everything skipped the gate
    ("nothing made or remade this run"), so a level made by a run whose readout never came back was never gated. Each
    level's verdict is kept in the run's record (`made[key].frame`, beside the print of the row it judged); a run gates
    every level no run has judged as it stands.
  - **The hero is drawn, and the game's pilot is the one it asks.** The hero's box is compared with the same frame
    rendered without its body (a capture page hands its bodies out): a hero standing in the frame with nothing of it
    drawn fails. Where the game asks a ride or an aircraft (its cube's `soul.hero`), the pilot the camera watches must
    run the drive or the fly rule: a racer laid without its car fails.
- **The books read from what the run made.**
  - The character book says a base the run made and pinned is made (its ref and revision; served live through its World
    on the dashboard), never "Not drawn yet"; and Adornment, Systems and Equipment are said made, with their rows, once a
    run made them, never "may start".
  - The world book says a hero or a foe the run made without a character book is made, not "Characters: Not on the
    ground".
  - The feel book marks each move its template shows that the made game does not carry (a wall kick, a ground pound, a
    charge shot …, the readout's "not carried") as the lab's, not the game's.
  - **Authorship** counts what game it is (the intent), the world named, its levels, the feel, the juice (not `auto`) and
    the bestiary; the systems count as written by their own settings (stats, scale, hud, powers, gear, a ui of its own),
    never by a `destruction` the levels copy or a ui left to propose.
  - **Grounding reads a negation**: "never floaty" rules "floaty" out instead of explaining it, and a choice the brief
    rules out is asked about as such.
  - **A clause is not a structure's name.** The technology tunnel took any clause naming a crafted form as an order and
    named the thing with the whole clause ("rampart = dark fantasy platformer where a cursed knight…: a wall, 30 gold").
    A thing is ordered only by a noun phrase (its word among the clause's first few), and a long clause names it by the
    phrase through its word; a sentence that mentions a gate orders none.
- **The feel's take-off is the card's in the game it ships** (`feel/lower.js`). A card with no gather wrote no
  `jumpWindup`, so the hero's own wind-up (playscape/player.js: 0.15 s with an animation library) survived in the
  shipped rule: a card that takes off on frame 0 took off on frame 9, its tap hop 0.43 m against the card's 0.71. It
  writes 0. A law holds the rule a made game ships (the lowered rule over the hero's own), in the feel tests and the
  action lab's `verify.mjs`.
- **An approval given before the first mint holds** (`character-review.js` `keepApproval`). Approving the hero's base
  before a run was undone by the run's own pin (the run then waited on "hero:base (changed)"); an approval current on
  the book as it was is kept on the base the run pinned from it. An approval already stale stays stale.
- **An honest Godot verdict** (`scene/engines/marks.js` `COSMETIC_EVENTS`). An absent dressing (a downed body's fade, a
  wreck's pieces, a trail, a rim light, the style floor, a register's motion, a carved title, the layer-0 looks) makes
  an export plays-partly, never hollow: a shooter whose downed bodies do not fade was called hollow, against the
  hillclimb's "plays in Godot".

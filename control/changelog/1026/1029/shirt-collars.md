### Shirt collars: one construction, stand, fall and front

Operator: "restructure shirt collars: first is the upper part, the V that goes up; loop it all around, you get a
turtleneck; if the V gets a flap down so it reads like an M, we get a collared shirt; opened or closed". A top's collar
was a tube round the neck on either body, with no opening, no points and no fall, whatever the card said.

- **The collar is built in stages** (`polygonizer/shirt-collar.js`, its words and measures `outfit/collar.js`), on the
  game body and the realistic body alike, from its STAND (the band rising from the neckline): a `band` is the stand alone,
  its V parted and widening up it (open by default) or a ring (closed); a `turtle` the stand looped round and tall, near
  level round the neck, its top rolled down over it all round; a `shirt` the stand and its FALL, a leaf folded down over
  it from its top, deepest at the front where its two points hang, its front edges parting down from the middle so the
  front reads as an M, the points nearly meeting closed (its default) and spread open, the stand parted in its V open.
- The language: `top.collar` false, true (a shirt collar, closed: every card that had one), a kind's name (`band`,
  `turtle`, `shirt`: `COLLAR_WORDS`) or `{ kind, open? }`, validated (it was never checked); the expander carries the kind
  and the front on the stand (`collar`, a garment field the game body's copy piece keeps) and runs the stand up the neck by
  its kind (a turtleneck's to under the jaw).
- The fall is a piece of its own (`<id>Fall_neck`), the collar's colour, carried by the stand's top ring's weights and
  following the dials; on the game body the stand is densified to 24 round first, so a point has slots to hang from.
- The realistic body's stand (`collarOn`) climbs past the neck's last ring, where the head's skin takes it over, along the
  neck's axis: every collar there had stopped 2 cm above the shirt's top.
- Pins moved, its reason in its header: the outfit laws' tucked shirt (laws and rings, rewritten in place, unreleased).
  A jacket test's refused cloth word (`silk`, a cloth word since the knits) is now `chainmail`.
- Not yet: the outer layer's collar (`outer.collar`: the flight jacket's leaves are their own patches), a deeper V down
  the shirt's front (its first buttons undone: the shirt's own neckline is its top ring).

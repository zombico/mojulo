### The crypt in ashlar: the dungeon room, graver

- **A second crypt, `gothic-ashlar`** (`era/stage.js`, `era/style/crypt.js` `CRYPT_SOBER`): the gothic-stone vault and
  its dressing in a graver register, for a room that should read as built stone at its own scale and not as a pattern
  of blocks. Gothic-stone outlines every stone (a deep black joint round a pillowed, bright face, each block its own
  value), frames its niches in pale stone, carves a key along its plinth and stands a barrel in its corner. The new
  card lays dressed ashlar (long low courses a third of a metre high and over a metre long, thin joints, a tooled
  face, each block's tone close to its neighbour's), which the form render reads as its true relief; a floor of large
  worn slabs; pilasters of one plain monolith's stone, slimmer, over a lower plinth and under a lighter cornice;
  arches, niches and the vault cut in more than twice the pieces, so a curve is a curve; its motif a low band of
  dentils under the cornice in the wall's own tone; torches set
  higher with a longer reach, so a tall wall is lit up its height and the vault is lost above them. Its dressing is
  the crypt's with the same principles, sober: thin dark-backed niches, a grey tomb that takes the candles' light
  and never burns white, fewer and lower candles, the accent wall in large calm blocks of the same dressed stone,
  moss and grime a stain and not a stripe, and the corner things a vault holds (stones, a boulder, planks, debris).
  It is made for tall rooms: give it height.
- **The seventh generation's laws, written down** (`era/laws.js`, the laws marked `form`). The rooms are placed by
  principles, not by hand: a style card states them, the laws table counts each as a shared law, and the dressing
  applies them by seeded dice. Those laws were the sixth generation's, and read again several were limits of its
  frame and its light, not tastes: detail sized to be read at 640 by 448, contrast drawn into the tile because the
  light could not make it, shapes faceted because a curve cost vertices, shade lifted because black was a hole. The
  form render answers each: `built-scale` (an element is the size it is built at), `relief-is-material` (a joint is
  relief the light finds, no line is drawn), `value-by-light` (a surface's elements close in tone, the contrast the
  light's), `true-curves`, `dark-is-a-place`, `live-emitters`. The composition laws (focus, the repeat, the accent
  wall, corners, causes, height) hold in both eras and are untouched.
- **The design pass stated as principles, and held to them.** The ashlar crypt's card states its form register's
  principles (`CRYPT_SOBER.form`, counted as `crypt/form`), and a kit is measured against the laws a card's numbers
  can answer (`era/form-laws.js` `readFormKit`: a course's height, a slab's size, what stands proud of a wall, the
  generator, a block's tone against its neighbour's, the pieces a curve is cut in, the torches' height, the
  vault's tint). The ashlar crypt keeps every one; gothic-stone, read the same way, is told which of its numbers
  are its era's (its blocks drawn and each its own value, its curves faceted). Writing the principles down
  corrected the pass itself: the first cut had dropped the crypt's motif, which its own principle keeps (a motif
  is small, in a band), so it is back as cut stone and not as paint.
- **More in the kit, each as a law first.** Three things the ashlar crypt gained, each stated as a principle, counted
  as a law and measured on the card:
  - *Nothing is a box on its first pass* (`no-voxel-first`, a craft law of both eras). Its torch is turned: a cone
    of iron, point down, with a rolled lip, held in a ring on an arm that is a rod (`era/stage.js` `torchFaces`, a
    kit's `torch.form: 'cone'`). The sixth generation's read stands its flame's two cards in the cone; the form
    render's its live flame.
  - *A column is worked, never a flat strip* (`pillars-are-worked`, both eras). Its pilasters are cut in parts as
    a column is (a base, a ring, a capital, each a little proud: a kit's `pilaster.bands`) over a fluted shaft
    (the dressed `fluted` cut as the pillars' own tile).
  - *A wall has layers* (`layers-stand-proud`, the seventh generation's). Its walls wear a coat of lime render
    over the ashlar, fallen away in patches to the courses behind (the dressed `render` cut). The coat stands
    proud, and in the form render its broken edge casts its shadow on the stone and takes the torch's light.
  Gothic-stone, measured by the same reader, is told its torch is boxes and its pilaster a flat strip; it is not
  changed.
- **A wall keeps a rhythm** (`wall-rhythm`, a craft law of both eras; `era/wall-rhythm.js`). Along one wall at most
  two neighbouring bays look alike, and a pair is never followed by the same pair: four bays are ABBA or BAAB, never
  AAAA or ABAB; five are AABAA or BBABB. The rule is local, two checks on what stands side by side, the same on a
  wall of two bays as on one of ten (a pair alike is allowed anywhere, so a short wall is solved as it stands), and
  that a wall needs two kinds follows from it. A mirrored order is taken where the length has one: a wall is built
  from its middle. Three is its own case: a wall of exactly three bays is ABA or BAB alone, the odd one in the
  middle (AAB keeps both checks and still reads lopsided). The second kind of bay is derived, the first with less on it: in the ashlar crypt a bay with one
  niche where its neighbour has two, and nothing in it (`era/crypt.js`, a card's `niches.rhythm`). The rhythm is
  what a wall reaches for unasked. A wall all alike is a stated choice (a stage's `rhythm: 'same'`), and then every
  bay is drawn clean and repeatable: no urn, no sealed niche, nothing that marks one bay from the next.
- **A wall's tile by the bay** (a kit's `tiles.wall.perBay`, as a floor's). Seen on the first render of the rhythm:
  the coat's patches were the same stamp in every bay. Each bay now takes its own variant of the wall's tile.
- **A floor is laid, not tiled** (`floor-is-laid`, a craft law of both eras; a kit's `floorPlan`, `era/stage.js`).
  The ashlar crypt's floor is no longer one field of tile. A border course runs round the room along its walls, its
  slabs' long side along the wall, a tone darker: nobody walks there. The walk runs down the room's long axis to
  the tomb, in larger slabs laid along the way, a tone lighter: worn. The fields either side are laid bay by bay,
  their joints on the pilasters' lines, and along the room they keep the walls' rhythm, the second kind of bay the
  same slabs turned a quarter. A stage's `rhythm: 'same'` lays every bay alike.
- **A threshold and an apron** (`floorPlan.threshold`, `floorPlan.apron`). Inside each doorway a threshold: larger
  slabs laid across the way in, worn by everyone who comes through. Round the tomb an apron, its dais and a walk
  round it, laid across the walk and darkened by its candles (`era/crypt.js` `tombSite`: where the tomb will stand,
  before it is built). Both are laid over the rest, which is cut round them: no part lies on another and none is
  missing (a test holds the floor's parts to the floor's whole).
- **Why a floor is not one shade** (`era/floor-shades.js`). The same stone laid the same way is seen in different
  shades across one room, and each shade has a cause, said in words beside its numbers: `worn` (feet polish stone:
  the walk, a threshold; lighter), `unwalked` (dust lies where nobody steps: the course along a wall; darker),
  `soot` (flame blackens what stands under it: the apron; darker and warmer), `damp` (water darkens stone and
  cools it; darker and cooler), `relaid` (a repair: newer slabs, paler and a little cooler), `plain` (the floor as
  laid). A part of a floor names its cause; a field bay now and then is relaid or damp by the room's dice. A floor
  meant all alike (`rhythm: 'same'`) is laid clean, every bay the floor as laid.
- **The new kit joins what reads a kit**: its starter rooms and the words people ask for it by (`era/entries.js`),
  and the place a level's score is suggested for (`beats/score-suggest.js`); the tier found both missing. The
  generated tool-surface pages name it.
- **Gothic-stone is as it was, byte for byte.** A kit's numbers are a promise over every room already made with
  it, so the pass is a new card, not a change to the old one. Two small openings were cut for it, each the old
  value where a card names none: a niche's head takes its card's `seg`, and the accent wall's stone may name its
  own generator (`era/crypt.js`).
- Seen in Chrome in gen-7: a 12 by 22 metre hall nine metres high, beside the gothic-stone room and the hangar.
  Still chunky, and said: the candles' glow; a column is fluted and cut in parts but not yet tapered or round.

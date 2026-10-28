### In-hall: rooms strung on a walk, the interior trail

The out-trail strings beats on a spine outdoors; a hall strings rooms on a walk indoors, the first rung of the rooms'
ladder (hall → section → floor) that the out-trail's header reserved. A stage recipe's `hall` is read against a card the
way a trail is, planned into rooms, links and two ports, built by the stage as any rooms are, and held by laws.

- **The card** (`era/in-hall.js` `IN_HALL`): an explorer's walk indoors (4.5 m/s, a run of 8–20 s, 60–150 s to explore),
  and the beats as rooms, each with its width, its depth along the walk, its share of the hall's height, its dwell and
  its words: `squeeze` (a low narrow passage), `reveal` (a tall wide room through a narrow door), `landmark` (the set
  piece's room, at the end of the sightline), `pocket` (a side room off the walk, a dead end), `rest` (an even room).
  `crossing`, `pit`, `stair` and `gate` are named and refused until the stage lays their geometry.
- **The grammar** (`hallOrderFaults`, `drawHallBeats`): never two alike together, a reveal always out of a squeeze
  (compression, then release), the landmark neither first nor past the middle (the mouth sees it), a pocket off the
  room before it; drawn by the seed when the recipe names none, a reveal, a landmark and a pocket always.
- **The plan** (`planInHall`): a straight spine from the mouth, each room centred on one axis with an even width, so
  every doorway stands on it; the heartbeat swings each beat's height and width, no ceiling under 3.5 m (`IN_HALL.floor`:
  a squeeze's doorway stays a full metre over the walker's eye); the spine's depths drawn in their
  ranges and scaled together to the run; a pocket off the side of the room before it, no deeper than its host; the
  landmark's link last, so the kit's dressing seats its set piece there; a mouth through the first room's `-y` and an
  exit through the last's `+y` (`exit: 'none'`, a dead end ending at its landmark). `mouth` and `exit` say how each is
  entered (`arch`, `door`, `portal`, `cave`), for the threshold that will read them.
- **The laws** (`inHallLaws`, on the stage's own plan): run, explore, order, release (every reveal half again as tall as
  its squeeze), landmark (the mouth's eye to the landmark's room through every doorway, under its head), ports (each
  through an outside wall), reach (every room from the mouth), fit (every beat laid).
- **Built by the stage** (`stage: { hall }`, `withHall`): the hall writes the rooms, links and ways (a recipe with a hall
  names none of them), in the recipe's kit or its cube's interior's bones (`geocubeBones`); the payload carries the
  hall's anchors (`beat`, `port`, tagged `hall: 'in-hall:<id>'`) and `hall: { beats, ports, laws }`. A recipe with no
  hall is as it was.
- **The geocube kind's `show: 'hall'`**: the cube's interior (its room, or an inside domain) walked as a hall from the
  seed, its kit dressed (the crypt's set piece in the landmark's room), the cube's accent on the landmark room's far wall
  unless the kit's dressing made it its own. Gen-7 lights it as any room.
- **Halls to walk** (`scripts/spikes/hall/halls.mjs`): limestone-crags' room and temple hall rolled as halls and one
  written on the crypt kit, each a walkable page in both eras beside its plan plate (the rooms by beat, the doorways, the
  ports, the sightline, each ceiling) and its laws, captured from the mouth and from the squeeze into the reveal. Every
  law holds on all three.

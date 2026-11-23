### Cinematic action game: the siege walker, fought as a boss on the boss director

- **The siege walker as a vehicle boss** (boss/vehicles.js `siege-walker`): the mecha shelf's siege walker on the boss
  director (worlds/controllable/boss.js). STANDING it lays a BARRAGE on you (a new pattern on the shelf, boss/patterns.js
  `barrage`: four shells and six missiles round where you stood, every landing marked as it is fired, a wall between the gun
  and you its cover; held to the pattern laws), then RELOADS with its tails (a window: no move), then WALKS its round.
  Mines on its round break its LEGS (two under one foot); a leg gone, it FOLDS onto its wheels and is a TANK, fought as the
  tank is (its states, its gun's lock and its coaxial fan are the tank row's own: a body that becomes a tank is beaten as
  one), its wheels mined to strand it and its engine open from behind then, and its folding opens its HIPS, bare between
  its folded legs, from its sides. Its RELOADERS, shot from behind, slow its reload (1.8 times for one, 2.6 for both).
- **The director, for a mecha** (boss.js, boss/vehicles.js): a vehicle of the mecha shelf (`frame`) is drawn as its own
  figure, its state playing its body (`form`: its tank form; `clip`: a state's own clip through it, its reload `loops`
  times, its fold once; its walk and its drive by the ground they cover, `stride`). A part may be `shown` in several
  states, and reached only `from` where it faces (`behind`, or its own `side`, within its `arc`); a round on a mecha is
  judged along the shot's line through its parts' boxes (a tall machine's parts lie inside the shape a round first
  meets); a part shot off hides its `bones`. A state's seconds may be `slower` for each of some parts broken. A WINDOW
  state lays no move and the laws do not ask it to. `E.bossHit` takes where a hit came from. Every vehicle without a
  frame is judged as it was.
- **Its figure** (gameworld/combat/boss-figures.js): the frame rigged as the artillery range rigs it, and its tails'
  reload as a clip (frames.js `frameBase(…, { reload: true })`: both tails from stowed to the spare behind their weapon,
  up to its magazine and stowed again, the backpack's own tail poses; opt-in, a frame asked for nothing new is as it
  was, and kept by its words as frames.js keeps its bases). Its parts' boxes are read off its bodies in each form
  (frames.js `places`), and held to them by boss-figures.test.js.
- **The page shows it** (boss-view.js): a mecha's parts are marks on its figure, not boxes (a weak spot a beating red glass
  and a counting part an amber one, each only while it can be hit, dim where the pilot stands out of its reach); a
  reloader shot off is gone from its back.
- **Played with the operative** (scripts/spikes/mission/boss.mjs `--boss siege-walker`): the test apron behind the hangar,
  barriers and containers against its barrage, its round past them, the carbine and land mines in the kit; `--tank`
  starts it folded. The hangar's hall opens onto it once the proof of the siege walker is held (hangar.mjs `apron-door`).
- What lifting it onto the rail would take: a level's boss as a recipe key the game rail reads (its row, its arena, its
  kit), the boss chapter of the game book, and the hangar's door as the play shell's hop.

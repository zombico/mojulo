### The run & gun on the belt: bullets that fly, its practice range

- The run & gun's guns (`brawl/brawl-guns.js`): a gun as its ROUND's flight, never a hitscan: its speed (mm a frame), its
  rate, its fan (pellets, spread) and its stream's wander (a fixed cycle of its shots, no dice), its damage and
  stagger, its life, how many bodies it passes through, the line across the belt it lands within, a knockdown, a burst
  where it lands, a lob, its ammo, the warning a foe aims for before it fires. The shelf: the players' sidearm (never
  out), machine gun, spread, flame, rocket and grenade, and the foes' rifle, burst, bazooka and lob, their rounds slow
  enough to see and step off. A gun passed into a practice room is its dials over a row (`readGun({ from, … })`).
- In the brawl's core a body with a `gun` fires rounds that fly along the belt and across it (eight aims on the floor,
  the across ones shallow so the depth reads under the side camera), land only within their line (step off it: dodged),
  pierce as their gun says, burst where they land (a rocket, a lobbed grenade), and never re-stun a body already reeling
  (a stream cannot pin it; its damage is whole, not scaled by its own count). A pick-up gun's ammo spent, the body is
  back on its sidearm; firing, it walks slower and faces its aim; `roll` is the gunner's dodge, untouchable as it goes.
- The gunner's buttons (`brawl/brawl-gunner.js`), no melee: the stick walks and aims (eight ways) while attack is held
  (auto-fire at the gun's rate), strong held plants the body so the stick only aims, special lobs a grenade, jump
  jumps (it fires in the air too), the stick tapped twice any way rolls.
- The shooting crowd: the rifleman, the gunner (a burst of three), the grenadier and the bazooka, each its gun and the
  `shoot` play: it holds its range along the belt and, given a token (its fire token), aims for its gun's warning (the
  aim fixed as the warning starts: the round goes where it pointed, so a player who steps off it is missed), then fires
  its volley.
- THE RANGE, the run & gun's practice room (`practiceOf({ …, range: { guns?, grenades? } })`): the guns passed in to be
  tried (names, or dials over one: `{ from: 'machine-gun', rate: 3 }`), the player holding the first over its sidearm;
  dummies that stand, walk, crowd as the shooting crowd, or SHOOT back on a slow beat (`{ mode: 'shoot', gun? }`); it
  never runs dry (a spent gun loaded again, the grenades back); it reads the rounds fired and landed, their damage, the
  rounds taken and each press's verdict (a shot taken, by its gun; a press while rolling dropped as rolling); its move
  list each gun's numbers (its round's speed, its rate, its reach, its burst, its ammo).
- The range on its page (`brawlLevel(level, { practice: { range: { guns, grenades }, dummies } })`): each round drawn as
  it flies (a tracer along its flight, warm a player's, hot red a foe's, its shadow on the street so its depth reads; a
  rocket's or a grenade's a ball on its arc), a foe's warning a thin red line along its aim, the gun out in both hands
  along the aim, a flash at a burst; the settings' Gun (the guns passed in) and a dummy's Shoot mode; the move list's
  Guns (each gun's numbers) and the gunner's moves; the gun meter on mana-ui's brawler shelf (`gun-meter`: the gun, its
  rounds left, the grenades, rounds landed of fired, their damage, the rounds taken). Rounds landing and bursts sound
  from the fight's shelf; a gunshot of its own is not there yet. The brawl yard's special in play no longer opens the
  move list (the back key does). The spike's `--range` plays it.

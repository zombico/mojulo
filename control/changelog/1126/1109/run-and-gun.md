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
- A gun reads as a rifle held in both hands: every gunner's hold is the genre's, a rifle of sorts at the chest, always
  ready (`brawl-pose.js` RIFLE: the lead hand forward on the foregrip, the rear on the grip by the chest, on one level
  line; the arm angles found on the rig, each body type's hands landing within a centimetre or two of it), drawn
  through its own hands: its stock behind the rear hand, its barrel on past the lead hand along the aim, a magazine
  under the grip, inked, each gun its length and girth (`gunShape`: a carbine for the sidearm, a long barrel for the
  machine gun, a fat tube for the rocket). A round leaves where the drawn barrel ends (`GUN_MUZZLE`, out along the aim),
  so a tracer leaves the muzzle; a character holds it as the figure poses it (its reactions still its own clips).
- Shot sounds, impact frames and hitstun by poise. Each gun names its voices on the SFX shelf (`sound`, `hit`: the
  machine gun's round and a body hit, the rocket's and the bazooka's shot and burst, the grenade's throw and blast, the
  flame's whoosh), a gun passed in bringing its own (`brawl/brawl-sfx.js` gunAudio, onto the range's page); the range
  adds a foe's round whizzing past close, a gun run dry and a magazine seated. A gun's weight: its `hitstop` (the body
  it makes flinch frozen), its `freeze` (a burst holds the whole street still) and its `impact` (IMPACT FRAMES: the
  picture flashed a few frames as a burst or a heavy round lands, inverted under the anime register, white otherwise).
  HITSTUN BY POISE: a light round staggers a body (its damage summed, drained a frame) and nudges it back; only past
  the body's poise does it flinch (a big body soaks a stream: the bazooka, the axe, the heavy carry more; a rifleman
  flinches almost at once), a flinch cuts short a foe's aim (its shot never comes), a heavy round floors; the range
  reads each dummy's stagger on its line mark.
- The range's WAVE TESTER (`brawl/brawl-waves.js`; `range: { waves, loop? }`, `waves: true` its sampler): a wave a
  group of the crowd's types (each `{ type, n, hp?, poise? }`) with its FORMATION (line, column, stairs, pincer,
  surround, back: where it comes in from and the stations it takes round the player as it starts, on the street and in
  the view) and its ATTACK PATTERN (tokens: the street's crowd; volley: all together on the beat; sweep: one after
  another down the formation; alternate: by halves, half a beat apart; pincer: by sides), its `beat` and its breath
  before (`after`). One wave at a time: its bodies come in from the view's edges or the street's back to their
  stations, its shooters fire to the pattern (each volley warned of, the aim fixed from its start, a flinch cutting it
  short), its brawlers fight as the street's crowd; cleared when its last falls (its time and the rounds taken kept),
  the next after its breath, the set over again. Its page: the wave meter on mana-ui's brawler shelf (`wave-meter`:
  which wave of how many, its name, its formation and pattern, the bodies left and its clock, the last clear) and the
  settings' Waves; the spike's `--waves` plays the sampler.
- How the crowd comes in and where it hides, for both games (the brawler's and the run & gun's). ENTRANCES
  (`brawl-core.js` enterBody): walking in from the view's edge, out of a door on the street's far side, DROPPING from
  above onto its spot, DIGGING up out of the ground (untouchable until it is out) or VAULTING the back fence in an arc.
  HIDING: a body ducks (`hide`: its crouch at 60% of its height, so a round at the chest passes over it) until a command
  brings it up. COVER (`THINGS.cover`: sandbags, a stack of crates, a low wall, each its size, health and the voice a
  round makes on it): a round meeting it is stopped and wears it down, unless its shooter stands right behind it (a body
  fires over its own cover); a grenade goes over it, a burst reaches behind it and breaks it, blows break it, no body
  walks through it. In the waves: a range wave's (and the brawler yard's own, `practice.waves`) `entrance`, `cover`
  (a piece between each station and the player: its shooters down behind it between volleys, up to fire over it) and
  `ambush` (hidden at its stations until the player comes near); a street wave's crowd entry `entrance` and `ambush`.
  The sampler gains dug in, from above, out of the ground and lying in wait; the page draws cover, a dig's dirt and the
  crouch, and sounds a round on cover and a body digging out; the spike's `--waves --melee` plays the brawler's.
- MOUNTED FOES, for both games. A body RIDES in (`enterBody` how 'ride', on a mount of `MOUNTS` in brawl-things.js: the
  motorcycle, fast with a hard ram, and the scooter, slower and nimbler) along the street from where it is put, steering
  onto its target's line while it comes at it, running over a body in its way (knocked down, once a pass; a body in the
  air clears it) and turning past the view for its `passes`. Knocked off (a blow, a flying kick the genre's answer, or a
  stream of rounds past its poise), it flies on and its mount skids into a WRECK, cover on the street (`THINGS.cover`
  motorcycle and scooter); `onFoot`, it gets up and fights on, else the crash knocks it out. Its passes done, it brakes
  in the view and steps off (on foot, its mount left standing) or rides away. Nobody takes hold of a rider; a rider
  with a gun fires from the saddle. In the waves: a range wave's (and the brawler yard's) `entrance: 'ride'` and its
  `mount` (kind, passes, onFoot), riders coming in one behind another; a street wave's crowd entry the same. The
  sampler gains the bikers. Its page: the mount drawn under its rider sat astride it, the wreck a mount on its side, the
  crash's flash and impact frames; the street's own sounds (a crash, metal, the ground dug out of) voiced on any brawl,
  with guns or without (`streetAudio`). Its engine and its tyres are held voices on the shelf, not played yet.

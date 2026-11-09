### The brawler: the belt

- A brawl's ground, the fight's lane opened up (`brawl/brawl-belt.js`): a straight BELT along a level with a depth band
  across it, cut into screens the camera scrolls through, a gate holding the camera at a screen's end until its wave is
  beaten, the last screen the boss's. The camera follows the body furthest on, never goes back and never shows past
  what is held; a body stays inside the view and the band. The camera's angle is locked per stage, a recipe word
  (`classic`, `high`, `low`, `ahead`), and never orbits.
- The levels a brawl is fought down (`brawl/brawl-levels.js`), a new kind a row: the greybox `street` (a road between
  kerbs, building fronts with framed doorways, lamps and things on the far pavement, the near side open to the camera,
  each held screen's line on the road), its belt's words over the preset's; `brawlLevel` gives the greybox world and its
  `brawl` block. A greybox takes a `brawl` block as it takes a fight's `versus`.
- The spike `scripts/spikes/brawler/belt.mjs` shoots the street from each angle.
- The brawl's sim (`brawl/brawl-core.js`): many bodies down a belt, two sides, each body a compiled fighter, so a thug's
  jab and a player's are the fight's frame data (the same frame, the same damage, the same recovery as in the fight,
  checked frame by frame). A blow lands only on bodies lined up across the belt, on every one of the other side its box
  meets; no block; a thrown body knocks down the bodies of its own side it flies into; a body rising from the floor is
  untouchable a moment; bodies push each other only when lined up; each faces its nearest foe. The camera goes on with
  the players and holds at a gate. Deterministic and hashed like the fight; the fight's own core is untouched.
- A brawl laid in the indoor level's rooms: the `stage` brawl level builds the belt on the stage kind building levels are
  made in, on its kits (the plaza's sunlit street, the nave, the stone hall, the catacomb, the lab): a room a screen,
  open to the camera, each into the next through a doorway the band runs through, deep enough before the band for the
  locked angle to see the floor; the open-air plaza one long street; a kit whose furnishing would stand on the fighting
  floor left undressed unless asked. It opens framed by the belt's angle. The spike shoots every kit.
- Timed states, one shelf for both games (`versus-library.js` STATES: power, haste, iron, fury): a body hits harder,
  moves faster or takes blows without flinching for a while. In the fight an INSTALL super grants one as it starts (the
  `super-install` row: no blow, a moment powering up, then ten seconds of power; a recipe's own install takes another
  state); in the brawl a thing on the floor will. A body holding none carries nothing of it.
- The desperation (`whirl` in the specials): an invincible spin at shoulder height that strikes behind as far as in
  front and knocks down, costing its thrower a slice of health the first time it lands, never the last of it. Any
  fighter may take it as a special; the brawler's attack and jump together throw it.
- The brawler's moves (`brawl/brawl-moves.js`): attack, jump, special and the stick. Attack runs a CHAIN, each press on
  a connect the next blow, the last knocking down, the stick toward the foe on the last press a different finisher; a
  whiff starts it over. In the air, a jump straight up and attack is a stomp, a jump with a direction a jump kick.
  Attack and jump together is the desperation. Special throws the fighter's signature special. A fighting style per
  archetype: the rushdown's longer, quicker chain, the grappler's heavy chain and its strongest grabs.
- The clinch, in the brawl's sim: walk into a foe lined up in front to take hold of it, then knee it (the third knocks
  it down), throw it forward into the crowd or behind, or, taken from behind, suplex it. A held body breaks free after a
  while, a holder struck lets go, and the desperation breaks out of a hold. A power-up's state works in the brawl as in
  the fight.
- The crowd's mind (`brawl/brawl-crowd.js`): a crowd that fights like one. Only two close in on a player at once, lining
  up across the street before they swing, and only one swings at a time, so a player always gets a moment to act
  between two attackers' blows; the rest circle in view, half of them working round to the player's back; a thug that
  is hurt backs off and waits before it comes in again. Its types are fighters: the thug, the knife, the charger (a
  rush from range), the jumper (a leaping overhead), the heavy (a big body that grabs, knees and throws).
- Waves: each held screen's crowd waits offstage until a player walks into the screen, then comes in from the right
  edge, the left and the street's back, six at most at once, and the gate opens when the last falls. A scripted player
  beats them all.
- The boss: any of the fight's characters at the stage's end, played by the fight's own opponent (its moveset, its
  reads, its combos), stepping onto the player's line before it swings and keeping the crowd's turn. It comes in first
  with its bar, its crowd behind it; beaten, the rest flee and the stage is clear. A held screen with no wave is open
  from the start, and two attackers can no longer start on the same player on the same frame.
- The street's things (`brawl/brawl-things.js`): food (an apple, a roast chicken, a joint of meat) gives health back,
  power-ups grant the fight's timed states, weapons (a pipe, a knife, a katana: the fight's own, the pipe new to its
  shelf) are picked up and swung by the chain, thrown with special at the first foe lined up ahead, and dropped when
  knocked down; barrels, crates and phone booths give way to a player's blows and leave what they hold. A player stands
  over a thing and presses attack to take it. A level places them along the street.
- The STRONG, a fourth button on the face's north (a pad's Y, the keyboard's I): one heavier blow of the style's
  (`BRAWL_STYLES[…].strong`: its slot, its air slot, its cooldown), slower than the fast attack and on its own cooldown
  (`cool`, frames from its start: the core starts no move with one while its body's `cd` runs), its effect by when it is
  thrown: from a stand the OPENER (it staggers long and the chain follows on from its second blow: St, A, A …), after a
  fast blow that hit the BREAKER (the chain ended early, the body knocked down: A, A, St) or, toward the foe, the BLOWOUT
  (a blow whose `knock` is 'fling': the body flung down the street as a thrown one, bowling over the crowd behind it),
  and in the air the DIVE (it knocks down). The rushdown's comes back soonest, the grappler's last.
- The fight's movement in the brawler: the stick tapped twice along the street runs the way it points (the fighter's
  forward dash's speed, held as long as the stick is: across the street too; attack from it the RUNNING BLOW, carried on
  by the run and knocking down; jump from it the LONG JUMP, `runJump` % further) or, away from the way the body faces,
  BACK-STEPS (the fighter's back dash: its distance, its frames, untouchable as it starts, still facing the foe). In the
  air every height of the fighter's: attack on a jump straight up the AIR PUNCH, on a jump with a direction the FLYING
  KICK; strong straight up the STOMP (straight down), with a direction the DIVE KICK (down at a slant: an air move's
  `dive` sets its flight), both knocking down. A move that passes THROUGH (the fight's roll, its blink) has no push box
  while it travels, so it goes through the crowd it would bump.
- Foes are bodies: a thug is a brawler as a player is, with every move a player has (the chain, the strong and its
  enders, the run, every air blow, the desperation, its specials), only its own TIMING AND DAMAGE and its REPERTOIRE.
  `brawlFighter(recipe, { tune })` lays a body's tune (`BRAWL_TUNE`: damage %, startup and recovery ± frames, the
  strong's cooldown %) on every normal, special, the throw and the desperation through the fight's own per-move tune, so
  its frames are re-laid; a crowd type (`CROWD_TYPES`) carries its tune and its `plays` (`CROWD_PLAYS`: chain, strong,
  break, blowout, run, kick, dive, grab, a special by direction, desperate: held, it breaks out). A body given a token
  picks one of its plays (by its own hash; a strong one only off its cooldown) and closes to where it starts: in reach
  for a blow (stopping as it touches, or its walk would take hold), a jump away for a leap, the ring's edge for a run.
  The token and one-attacker-at-a-time rules hold for every play. The thug sometimes breaks its chain off with a
  knockdown or leaps in; the knife runs in; the charger blows the player away; the jumper flying-kicks and dive-kicks;
  the heavy, slow and hard-hitting, swings its strong and breaks out of a hold.

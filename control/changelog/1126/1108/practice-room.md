### The practice room: an action game's swings, strings and weapons measured on the runtime it ships

- **Fable of Artesia, the Zelda-like template.** A new pole (`gameworld/feel/cards.js`) between Ebon Spirits (the Souls
  knight) and Fallen Angel (the stylish action game): an action-adventure's sword and shield.
- **The measures, headless** (`scripts/spikes/practice-room/measure.mjs`): a game's melee played on the runtime it
  ships (scripted presses at 60 Hz on `stepWorld`, as `feel/reach.js` measures a jump) against a foe that never dies,
  each beside what its feel card asks for, carried, partly or lost: press to contact, the swing to rest, when the next
  press is taken, the string mashed and with its sides alternated, the hitstop, the foe's stun and the advantage, the
  lunge, the reach, the dodge's frames and invincible frames, the guard. A template's rule (`--feel`, with a held
  weapon's class) or a built game's own pilot (`--page`). Machine gate only.
- **What it found** (the sword, normal class): every template swings the held weapon's 0.5 s whatever its card says (a
  card of 23 to 27 frames plays as 33 to 36), so Fallen Angel, Fable of Artesia and Ebon Spirits swing alike; the next
  press is taken only once the swing has ended (frame 34 to 37, where the cards cancel at 11 to 19); a string is the
  opener and one follow-up in another direction, then 2.5 s locked (alternated: hits 36 frames apart, then 186); mashed
  on one direction, an opener every swing and never a string. The hitstop is carried; the lunge, the card's hitstun
  (the world's combo rule is never set) and the guard and parry are lost; the dodge is invincible all through where the
  card opens a window. The foe reels 80 frames a hit, so every hit leaves the hero a second of advantage.
- **The room** (`scripts/spikes/practice-room/room.mjs`): a game's hero and one of its foes (or a pack) in a greybox
  ring, on the runtime the game ships: a `controllable` manifest from the game's first level (its pilot, its figures,
  its orbit camera and lock-on), resolved and emitted as `export_game` emits a level. The foe never dies and stands
  still until P switches its AI on; R sets it back. A HUD reads the live world: the last move's frame data beside the
  card's, and every press, taken or dropped with its reason. Checked headless: real clicks strike, the foe takes them
  and stands, each dropped click says why. Nobody has played it.
- **The combo manifest** (`gameworld/combos.js`): an action game's attacks and the strings that chain them. A move is an
  attack primitive: the swing it plays (the hero's cut, the thrust, the cleave, the rising cuts), its role (opener,
  filler, finisher, launcher), its length and its cancel in frames, how it covers ground (none: in place; step: a step
  into it before the blow; lunge: the swing carries the body through it, stopping at the body it strikes), its damage,
  impact, topple and launch. A combo is its beats, L (light), H (heavy), S (special) and `.` (a pause), one move a
  press; combos sharing their openings are one tree. The timing forgives: a press with a move to chain into is held to
  the live move's cancel however early, any other press is remembered a buffer's frames, a press just after a move ends
  still chains (`late`), a pause beat is a press in its window. Held and mashed beats are named and refused for now.
  The starter: L L L (two cuts and the cleave, which lunges and topples) and H (the thrust, a lunge). `readCombos` says what is
  wrong in words; `lowerCombos` is the platform rule's `moveset`; `comboList` the director's list.
- **The moveset in the runtime** (`worlds/controllable/combat-melee.js`, opt-in `moveset` on a platform rule with a
  melee strike): each press a beat, each move a swing of its own (its clip, length, travel and blow), chained at the
  cancel, every press saying what became of it (taken, and how; dropped, and why). Absent, the strike as it was.
- **L, H and S.** The pilot scheme's `melee` context: light on the left click and the pad's left face, heavy on the
  right click and the top face, special on the mouse's forward button and the right face; the bottom face jumps. Read
  only on a page where a body carries a moveset.
- **The room plays combos.** All combos unlocked; the HUD lists them, lights the beats of the string being played,
  shows the last move's frames, travel and hits, and logs the runtime's verdict on every press. The room writes the
  manifest it played beside the page (`combos.json`), the list a game's director takes; `--combos <file>` plays your own.
  Checked headless with real clicks: L L L plays the cut, the rising cut and the cleave, each chained at its cancel,
  three hits.
- **Fixed: the dodge rolled the wrong way under the camera's movement.** A hero that runs where the stick points (the
  orbit camera's `move: 'camera'`) faces its run, so S held turned it toward the camera and the dodge read S as a
  backflip, away from the camera. Under world or camera movement the roll goes along the stick, the body turned to face
  it (`beginDodge`'s `moveH`).
- **A swing carried by the whole body** (`polygonizer/hero-swing-body.js` `swingBody`, opt-in: a hero whose rule plays a
  moveset, baked through `world-scene.js` `swings.body`): the arm's arc on the strike solver's principles, on the
  structured core's left-forward stance, so the sword hand is the rear hand and a forehand cut drives through as a cross
  does. The hips lead the chest (turned back at the coil, coming forward at the cock while the chest is still wound),
  the weight moves back then onto the lead foot (`shift`), the rear foot pivots (its heel up, its toe in), the off hand
  counters a one-handed swing (out at the cock, home at the hip through the blow; a two-handed swing keeps its own), and
  each key sinks the body as little as lets both planted legs reach their feet on the rig. A backhand turns the other
  way. Absent, every swing as it was. Seen on the body study (the cut at its cock, strike and follow, with and without);
  nobody has played it.
- **The arsenal** (`gameworld/combos.js`): the weapons a hero steps through, each its own moves and strings, and the
  figure it shows (drawn: the blade in hand; sheathed: on the back). A move may play a body's strike (`strike`: the
  punch solver's jab and cross, the boxing solver's hook and uppercut) with its own contact window. The starter: the
  sword (L L L, H) and the fist (L L L the jab, the cross and the hook; H the uppercut). Not yet wired to the runtime.
- **The room's hero** (`--hero anime | tiered | <spec>`): another body on the game's rig and clips, its sword in hand and
  on its back; the room bakes its figures at the pose grade (one hero up close), `--grade play` for the game's.
- **Footwork: no foot teleports or skates through a string** (`polygonizer/hero-swing-body.js` `moveClip`, the law in
  its test). Each move of a moveset is baked as its own clip (`mv_<id>`): its travel is its footwork, every planted
  foot held where it stands on the floor while the runtime carries the body. A STEP is an advance (the lead foot out,
  then the rear, both down before the blow; at most 0.4 m). A LUNGE is not an advance: the lead foot drives out and
  lands with the blow while the rear foot holds, the rear leg extending behind as the body drops, then the rear foot
  recovers forward after the blow (at most 0.7 m, one stride). The body sinks as little as lets both legs reach. Every
  move ends in the stance it began in; a move blends into the next in four frames (the manifest's `blend`) and its
  travel waits that out, so the outgoing pose never rides the body. A move steps in only where all of its travel fits
  before the body ahead (else its `_still` clip, in place). In combat the hero idles in its fighting stance
  (`mv_ready`), so standing and striking share their feet. The law plays a string as the page does (the runtime's
  travel, its crossfade between clips) and measures each planted foot: through stand, L L L, stand, and through the
  thrust's lunge, no planted foot moves more than a centimetre a frame (the plain swings skated over half a metre).
  Seen headless in the room: the moves play their own clips, the thrust in place when the foe stands too close.
- **The action style: cartoon force, not a fencer's economy** (`hero-swing-body.js` `SWING_STYLES.action`, from the
  world's juice flavor: `fxStyle: { flavor: 'action' }`). A wider, lower stance; the WINGS on the wind-up and the
  follow-through (the arm's arc widened in yaw and pitch, its roll the swing's own, the elbow never over the head; the
  trunk's twist and the shoulders further), never on the blow, so the blade lands where it lands; the hips wound hard
  and thrown through (the chain kept); the weight thrown harder; the off arm flung wide. Measured on the rig: the
  shoulder line sweeps half as far again from the wind-up to the follow, the base is wider, every key stands and the
  sword hand stays clear of the head; the footwork law holds under it. The swing's action timing (a held cock, a
  snapped blow) comes with the same word.
- **The room plays the action style** by default (`--style action | none`): its swing timing, the wider body, the
  composed floor's blade trail and hits.
- **Fixed: a blade trail on a skinned hero.** The trail found a hand's blade as its bone mesh's farthest point; a
  skinned figure's bones carry no mesh (the page threw and stopped). It now reads the skinned mesh's corners the hand's
  bone holds whole, each in that bone's own frame (`trail-channel.js`). The trail is wired; nobody has seen it draw yet.
- **Weapon cycling: the sword and the fist** (`combat-melee.js` `r.weapons`, `gameworld/combos.js` the arsenal). The
  weapon cycle (R, a pad's right shoulder, now the mouse's back button too, its page navigation blocked) steps to the
  next weapon between moves, its string cleared; a cycle mid-swing is refused and says so. Each weapon is its own moves
  (`mv_<weapon>_<move>`), its reach and damage, its fighting stance as the hero's idle in combat (`mv_<weapon>_ready`)
  and the figure it shows: the fist the sheathed hero, its sword on its back, in combat too. The fist plays the body's
  own strikes (the punch solver's jab and cross, the boxing solver's hook and uppercut: `hero-swing-body.js`
  `strikeMoveClip`), from their guard, each window where its solver lands its blow, its footwork over the solver's own
  feet as a swing's: L L L the jab, the cross and the hook (a short lunge), H the uppercut. The footwork law holds the
  fist's string too. The room arms the arsenal (the HUD names the weapon and lists its combos; the foe's reset is now K)
  and writes it as the manifest. Fixed on the way: a figure baked after the blade's bake had armed the hero lost its
  moveset's clips (the sheathed hero's fist): a moveset's moves now bake on every figure its weapons show.
- **S, the sidearms: a hold, never a mash** (`gameworld/combos.js` the arsenal's `ranged`, `combat-melee.js`,
  `combat-ranged.js`). Each melee weapon names its sidearm (the sword the bow, the fist the pistols) and S fires it; the
  weapon cycle swaps both. Two kinds, each a hold: a DRAW (`mode: 'draw'`, the bow) loads while S is held, the walk
  slowed (`aimMove`) and the hero turned to the aim, and looses on release once ready (0.45 s); let go early and nothing
  flies (`early: 'none'`; `'tap'` keeps a charge shot's pellet), one arrow nocked at a time from a quiver. An AUTO
  (`mode: 'auto'`, the pistols) fires at its rate while S is held, weak and endless (`infinite`: its rounds never run
  out) or from a magazine that runs dry. S aims at the locked foe, else the nearest in front (35°) and in range (`mvAim`);
  the blades refuse a swing while the bow is drawn and a sidearm never fires mid-swing. The room's HUD shows the
  sidearm, its rounds, the draw bar and READY.
- **Fixed: a charged lob dealt its uncharged damage.** A projectile weapon's charged round (a bow drawn full) carried
  the weapon's base damage, not its `chargedDamage`; the arms kit's bows hit as hard as drawn now.

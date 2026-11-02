### The manual manipulator's controllers: hands in the headset

The headset's controllers become the player's hands: their poses are input, the game runs in the headset, the hero's
own hands, and what they hold, are drawn where the controllers are, and a swing or a shot from them lands in the game,
so a saber rhythm level, a gun held as a gun or VR boxing can be made. Played on a Quest by no one yet: the eyes gate
is the operator's.

- **Poses are input** (`controls/xr-driver.js`): the `xr` family carries the poses OpenXR names (`head`, each hand's
  `grip` and `aim`) beside its buttons and sticks; `xrPoses` reads them from a frame and `poseToWorld` carries one from
  the headset's y-up play space into the z-up world through the rig, so a recorded pose stream replays in Node.
- **The headset plays the game** (`scene/channels/xr.js`): on a page with a pilot, entering the headset no longer
  stops the game. The controllers read through the pilot scheme's `xr` bindings as a pad does (the left stick walks,
  the right turns, the right trigger fires, A jumps, the left grip uses), the pilot walks and turns on the body the
  headset estimates and looks where the head looks, a step in the play space moves the pilot (a wall stops it), the
  view stands where the pilot stands, and the pilot's body is hidden (first person). Any game level's live page takes it
  with `?xr=1`. A page without a pilot walks as before; a page without `xr` is unchanged byte for byte.
- **The hero's hands on the controllers** (`polygonizer/hero-xr-hands.js`): in the headset the hero's own hands are drawn
  where the controllers are, each on its grip pose (the hand's grip centre on the grip's origin, through the fist toward
  the thumb along its −Z, the back of the right hand along its +X, as WebXR defines the grip), its fingers following
  the controller: the grip closes the middle, ring and little fingers and points the index, the trigger closes the
  index, and the thumb comes down while it rests on a thumb button. The hands reuse the body's own bone meshes (no new
  geometry on the page); what rides the hero's figure is a small table per finger, its bones at seven curls, played as
  the page plays any clip, and it rides only a world a headset plays (its `xr`, or `?xr=` on the live page). A hero
  with mitten hands, or a page without a headset, is unchanged.
- **What the hands hold, and a shot from them**: a hero's held item (its `gear` right or left) is drawn in the headset
  apart from the hand that holds it, re-held for a controller: a blade comes out of the fist past the thumb, its edge
  leading with the knuckles; a gun is presented, its grip through the fist and its bore along the hand, raked a little
  toward the thumb; a bow or a long staff keeps the hero's own hold. A hand that holds something closes round it from
  the grip. The ranged weapon takes an opt-in aim (`input.aim`, `worlds/controllable/combat-ranged.js`): in the headset
  the round leaves from the held gun's muzzle along its bore, or, where the hand holds no gun, along the controller's
  own ray, so the controller is the gun whatever the body or the head faces. A game without a headset fires as before.
- **A hit from a swing** (`worlds/controllable/sweep.js`): in the headset, what each hand strikes with is handed to the
  game each frame (a held blade from its guard to its tip, an empty hand its fist's knuckles, the controller itself
  where the hero's hands are not drawn), and whatever it crosses as it moves is struck: the first hittable body its path
  meets, moving at a swing's pace (a blade resting in a body strikes nothing), once a pass. The blow lands as melee's
  does (the flash, the damage, the stagger, a spark at the point of contact), and the game hears the CUT, its
  direction in the player's view (up, down, left, right), its speed and the hand, as `cut` and `cut:<id>` beside the
  hit. The pass is composed only into a page a headset plays; every other page keeps every byte.
- **Notes to cut on the beat** (the `notes` mechanic, `game/mechanics.js`; its card `mechanic-cards/notes.md`): a rhythm
  chart played by note bodies the level mints asleep, a small pool per lane, each floating at its lane's height. A note
  wakes `lead` beats before its own at its lane's far end and walks in at the pace that puts it on the cutting line on
  its beat (the music's clock says a beat early, so it walks that much longer); a cut in its direction and with its
  hand scores it and sends it away, a wrong one leaves it walking, and one that passes the line, or that something stops
  on its walk, is a miss. Every note scored or missed wins; `misses` can lose. A pool too small for its chart is
  refused, naming the lane.
- **A saber level, as a concept** (the notes card, `mechanic-cards/notes.md`): a saber rhythm level is parts on any
  stage level, written out in the card: the level played in a headset, the hero holding two light blades (the `saber`
  equipment style: a neon blade, its own glow, out of a short machined hilt; red in the left hand, blue in the right),
  note blocks minted asleep per lane and cut (the glyph forms `note-up`, `note-down`, `note-left`, `note-right`,
  `note-any`: a cube with its arrow on every side; a glyph body now keeps its other fields, `hittable` and `egg`), a
  club score with its seed fixed so its beat is the chart's, and `notes` with `score`. And `xr` at the world (and the
  quick game's) level, carried onto every stage level, so any game's pages open a session that plays it.
- **The HUD in the headset** (`scene/channels/xr.js`): a game played in a headset shows its HUD there. The page's HUD is
  drawn on a panel in the play space, low on the floor ahead of the player and tilted up to the eye, under where a
  game's things come at the player: its left slots on the left, its right on the right, the rest in the middle, each
  widget its own text in its own colour and fade. It is the HUD the game already has (a saber game's notes and score, a
  shooter's rounds, a toast, a banner), not its keyboard legend; it is drawn again only when what it says changes.
  `xr: { hud: false }` leaves it out.

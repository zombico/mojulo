### The manual manipulator's controllers: hands in the headset

In progress. The headset's controllers become the player's hands: their poses are input, the game runs in the headset,
and (next) the hero's own hands, and what they hold, are drawn where the controllers are, so a saber rhythm game, a gun
held as a gun or VR boxing can be made.

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

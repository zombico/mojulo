### A frame level played again: a retry, a scan's ring, drones that are seen, rounds that can be dodged

- A retry (`game/objectives.js` `retry`, `RETRY`; a frame operation's `retry: true`): the player down while a task is in
  hand no longer ends the level on a card with nothing to press. The screen fades, the player stands up whole where it
  fell, the task in hand begins again (its foes up and whole, each fought group put back where it stood: a task's
  `again` ops), and the level goes on from there. A level that asks for none is lost on a death as before.
- A scan's ring (`scene/channels/guide.js` a step's `ring`, `GUIDE_RING`): a frame level's scan place lies ringed on
  the ground at its radius, and while it is stood in, rings pulse in from the edge toward the middle, one after another,
  until its clock is run and the ring goes. A guide with no ring carries none of it.
- The Gnat drone redrawn (`groundforce/index.js`): no fans; a lens of armour borne up on a ring of plasma round its
  waist, lit all the way round, a red eye in its rim, a chin gun, two fins aft; larger (its ring some 7 m across as
  drawn), and in its own colours (a card's new `livery`: bone white under a hazard-orange dome, a dark stripe), so it
  stands out against black space and grey ground.
- A foe's rounds can be dodged: an enemy frame's guns fire at where the pilot is as they leave the gun, no longer where
  it will be (`rules-frame.js`; a mind's `leadShots` leads them as before), and a drone's rounds fly slower (170 m/s,
  its range in over a second and a half), seen coming. Missiles still home.

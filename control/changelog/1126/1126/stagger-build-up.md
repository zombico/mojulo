### Stagger build-up: a frame's bar kept under pressure, and two seconds of a frame stood still

- A frame's stability bar builds under fire (`worlds/controllable/rules-frame.js`, `STAB`; a built frame's
  `stab.hold`, `assault-frame/assemble.js`): it comes back on its own only once the frame has gone `hold` s unhit (1 s),
  so fire kept on a frame breaks it where scattered hits never did (the bar had come back the moment a round landed,
  faster than a rifle could chip it).
- Broken, a frame reels for 2 s (it was 1.6) stood still: braked where it broke (`stab.brake`, its way checked by 8 a
  second), no keys, no guns, no dodge, still coming down if it was in the air; every hit on it lands 1.5 times as hard
  as before. Two seconds of a target that neither moves nor dodges, the moment to land everything.
- How a weapon hits (`assault-frame/parts.js` `IMPACTS`, a weapon's `impact`): ballistic rounds (rifle, shotgun,
  gatling, bazooka, mortar, missiles) build the bar fastest, a rifle or a gatling kept on breaking a medium frame in two
  to four seconds; energy weapons (the laser, the plasma cannon) build a fraction of that for their damage; a blade's blow
  shoves (melee); `stun` is reserved for weapons made to break the bar. The shelf's numbers are retuned to it.
- Every frame on every level plays by it: the pilot's, an enemy frame's, an ally's, a level 1 survey's and a Warlords
  operation's.

### The patrol ship: a building-sized boss over a frame's field, fought in two steps

- A frame operation's `ship` (`gameworld/frame-goal.js` `SHIP`): a Rock Hydra patrol ship, some 110 m long as drawn,
  hanging on four lift pods over the field (`groundforce/` cards `patrol`, `patrol-pod`, `patrol-gun`: parts of one
  boss, never on a stage's shelf). Its pods and its gun turrets are bodies of their own perched at their places on the
  hull and carried with it (`worlds/controllable/rules-frame.js` `frame-perch`, a body's `perch`).
- Fought in two steps, each a task's, by its two groups `<id>-pods` and `<id>-guns`: its pods first; with them all down
  it sinks, listing, to a fraction of its height over `fall` s (crippled, `frame-ship`); then its guns, shielded until
  the task that downs them begins (the cast's `expose` op) and each rebuilt after the ship's `regen` s unless every one
  is down together. It comes with its task (`comes`), asleep till then. Its bar on the HUD under its name, its armour
  the sum of its pods' and guns' standing, falling with them and rising as a gun comes back; the pilot's lock never
  takes the hull (a body's `noLock`), only its parts.
- A clear's `regen` (`game/objectives.js`, on any clear): each foe it downs comes back whole after its seconds while the
  task is in hand, its count taken back, so the task is met only by every one of them down together.
- Heard: a lift pod's drive held under it, a turret's heavy rounds, each a wreck as it goes (`sfx-shelf/frame-sounds.js`).
- The frame HUD's boss bar reads a body with no rule of its own (the ship's hull).
- The holo table's briefing knows the ship's two groups (`gameworld/frame-map.js`: a part group's bodies by its ship's
  names) and draws them, a lift pod as a gunship and a turret as a turret (`campaign/holo-minis.js`); a spider bot has its
  own miniature, a low body on six splayed legs.

### An action hero's combat stance, its weapon sheathed out of it

- **Combat is a state.** An action hero (the orbit camera and a blow: `camera: 'orbit'` with a strike in its right
  hand) enters combat when a foe stands within 10 m (held to 15 m once in it), a lock is held or a blow is struck, and
  leaves it 3 s after the last (the platform rule's `combat`, opt-in). In combat it walks a deliberate guard, its own
  walk at 2.4 m/s (`guard`), unless the sprint is held.
- **Sheathed out of combat.** Where its hand holds a blade, the run makes the SHEATHED HERO beside the equipped one
  (`hero-sheathed`: the same hero, the blade on its back, hilt up over the right shoulder, the hero door's `back` slot),
  and the level carries both: out of combat the sheathed figure plays, in combat the drawn one (the page builds both and
  swaps them, as a loadout's figures are swapped).
- **Pose layers.** A body's `layers` lay a pose over the clip a state plays, each a pivot bone turned and its chain
  carried round the pivot's head, eased in and out with its state: the run's legs set apart (out of combat, running), and
  combat's guard (leaning in, the weapon arm up and forward, the off arm raised, the feet wide; never over a strike, a
  dodge or a stagger, whose clip owns the body).
- **The HP at the bottom left** under the adventure look.

### Vayo moves: special abilities that move a hero on its own air

- **A dash and a flight as special abilities** (`rule.vayo`, or a power's `vayo-dash` / `vayo-flight`), moved by one law:
  a push against the air the hero moves through, so every vayo move is a curve, never a line. It eases in toward its
  speed and eases out as the air bleeds it, the same at any frame rate. The physical moves (the dodge, the tackle, the
  boost, the charged leap, the cleave step, the zip) keep their laws and their bytes.
  - **The dash** pushes to its peak in its `rise`, then carries its `carry` and hands back to walking at the run speed.
    In the air its own air bears the hero while it pushes. Invincible frames only where it names them.
  - **The flight** rises, hovers when let go, cruises and dives at will, steered by the stick and the jump and kneel
    keys, a boost on the boost key. It never stalls, and it lands when it comes down.
  - **The jetpack** (a power's `vayo-jetpack`): less controlled than the flight. It thrusts along the body's axis and
    goes where the hero leans: the stick tilts the body toward its way and turns it to face it, late, and its momentum
    carries. Its startup spools the thrust and leans the body into the launch before it lifts. The jump key is full
    thrust, nothing held a slow sink, kneel cuts it; its fuel is the meter, and empty it sputters out. Its exhaust blows on
    a fire under it.
  - **The air dash** (a power's `vayo-air-dash`): a dash only in the air, its `count` before the ground again, in its
    element's dash shape. V in the air dashes first; held a quarter second on, by a hero that flies, the dash carries on
    as flight at its speed.
  - **The jump** (an air jump, a power's `vayo-jump`): the jump key in the air, after the physical air jumps. Its air
    catches the hero and pushes it up, then gravity takes it: the same height from wherever it fires, and letting go of
    the key does not cut it. `count` of them before the ground again.
  - **Its own key:** V, or the pad's D-pad down. On the ground it dashes, in the air it air-dashes (while its count
    lasts) or takes flight, in flight it lets go; the vayo jump is the jump key in the air. No physical move's key is
    taken.
- **Elements tune the shape:** wind carries far, earth stops hard, lightning snaps, fire pushes hard, water rises
  smoothly. The game's feel card tunes it (its dash and jetpack), and the hero's own numbers come last.
- **Power sets the fiction, the cap the play:** a move's speed scales as the square root of its tier (a super's dash's
  fiction is 380 m/s), and the hero moves at most 40 m/s (`cap`). What the cap holds back shows in the trail, a boom past
  sound, and the wake.
- **No speed passes through a wall:** a vayo move sweeps its footprint along its path.
- **Its trail and its wake:** a ribbon of its element's colour behind the hero, and on the flow its wake pushes the
  world's air, so a super's dash past a fire puts it out and a human's fans it.
- A world whose hero has no vayo move changes no byte.

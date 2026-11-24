### The speed's look: speed lines in the air, dust in space, for Wolf Squadron and Rebel Storm

A flown craft's speed, and when it is driven hard, now reads off the world round it (`scene/channels/speed-fx.js`, a
page's `speedfx`). It is laid on every airspace level whose pilot flies a rail stage or a cockpit; absent, it emits
nothing.

- **In the air: speed lines.** Thin streaks of air rush past the camera on a tube round its line of sight, born far
  ahead and gone behind it, kept wider than the craft so they never cross it. At cruise there are a few and they are
  faint. Boosted they lengthen, grow in number and brighten; braked they thin away. Wolf Squadron's ground stages have
  them.
- **In space: dust.** Motes are held still in space round the camera, in a block that wraps as the camera moves. Each is
  drawn as a streak along the way it is passed, as long as the craft's speed makes it. At cruise they are a drift of
  short specks; boosted or with the throttle wide open, the streaks lengthen and brighten. They show which way the craft
  is turning. Wolf Squadron's space stage and Rebel Storm's cockpit missions have them.
- **Read off how the craft moves** (its position over the world's clock), so it is one cue for every rule that flies:
  - the rail's boost and brake;
  - a cockpit's throttle and its engines' power.

  Its drive runs 0 at cruise to 1 at the boost (`window.__mojSpeedFx`: mode, speed, drive). A jump in place is not
  speed.

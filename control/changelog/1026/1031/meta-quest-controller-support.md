### Meta Quest controllers: two sticks that go straight

Operator: "create sensible mapping of the WASD and game controls to meta quest devices … the controls are not consistent,
they don't always go straight … since there are 2 knobs, we can do 2 axis controls where move and rotate is possible so
the user doesn't have to rotate their head to turn". The headset walk (`xr` on a World, `?xr=1`) had three causes of a
bent path: it re-read the gaze every frame (a glance aside steered the walk), its dead zone was square (a worn stick's
drift, or a thumb a few degrees off true, leaked sideways), and its snap turn swung the rig about the play-space origin
rather than the player's head.

- **The xr family has its driver** (`controls/xr-driver.js`, `devices.js` `driver: 'webxr-gamepad'`): an XR session's
  input sources read by hand in the xr-standard mapping (Quest Touch, Touch Plus on the Quest 3 / 3S, Touch Pro), and
  the thumbstick shaping a headset walks through: a radial dead zone, the travel past it rescaled, a push within 12° of a
  cardinal snapped onto it. Its own closure and module, so only a page that can open a session carries it; the controls
  kernel, in every game page, is unchanged.
- **The headset reads the pilot scheme** (`scene/channels/xr.js`): forward, back, strafe and turn are the scheme's own xr
  bindings, read through the kernel and the driver, so the headset and the controls card agree and `xr.bind` remaps them.
  - Goes straight: the heading a push walks on is latched when the stick engages (`move: 'latch'`, the default); the
    right stick turns it with the body. `move: 'head'` steers by the gaze (the old way), `move: 'hand'` walks where the
    left controller points.
  - Turns on the right stick about the head: smooth by default (`turnSpeed`, 120°/s), or `turn: 'snap'` (`snap`
    degrees; `{ snap }` alone still means snap turning).
  - `?xr=` takes the mode words for an A/B in a headset without a re-mint: `?xr=snap`, `?xr=smooth,hand`, `?xr=head`.
- **The xr rows of the other schemes**: the action game (left stick moves and its click sprints, right trigger attacks,
  left guards, A jumps, B dodges, X shoots, Y switches, the left grip dashes, the right stick's click locks), the grid
  puzzle and the tactics board (the left stick moves the cursor, the right turns and zooms the view), with their legend
  rows. The pilot scheme's rows are as they were: they ride every game page, and no game page reads a headset yet.
- Gates: machine — the driver and the shaping, and the emitted block run against three's math with a fake session (a
  push with drift and a glance aside walks a straight line; a turn leaves the head where it stood; a remap swaps the
  hands). The two xr fixtures' byte pins moved; every other page is byte-identical. Eyes — the operator's Quest 3S, not
  yet run.
- Not yet: a game's hero is not driven in a headset (the rig replaces the hero's step on entering VR), and the session has
  no wall collision.

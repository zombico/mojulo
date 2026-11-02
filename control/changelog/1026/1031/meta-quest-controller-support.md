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
  - Feet, body, head: the feet go where the body points (the left stick, forward, back and sideways to it) and the
    head is a camera that looks without steering. What turns the body is the stance:
    - `move: 'seated'`, the default (the operator: "the sitting in couch action game mode"): the right stick alone.
    - `move: 'standing'` (the operator: "a game that cares about physical body rotation rather than right stick"):
      the player turns it by turning. WebXR tracks no torso, so it is estimated as an avatar's is: the point between
      the controllers held out in front leads it; with the hands down it catches up to where the head has stayed
      (about a second, so a glance barely moves it); the head never sits more than `neck` (50°) off it. The right
      stick snap-turns on top by default (a play space and a cable run out); `turn: 'off'` removes it.
    - For comparison, head-steered: `move: 'latch'` takes the gaze when a push begins and holds it, `move: 'head'`
      steers by the gaze every frame (the old way), `move: 'hand'` walks where the left controller points.
    Every mode goes straight.
  - Forward is where the body faces after a right-stick turn (the operator, on a Quest 3S: walking north, turned east,
    forward still walked north): the gaze is read from the frame's own viewer pose carried through the rig, not off
    three's XR camera, and the test's headset reports its pose rig-local as a real one does.
  - Turns on the right stick about the head: smooth by default (`turnSpeed`, 120°/s), or `turn: 'snap'` (`snap`
    degrees; `{ snap }` alone still means snap turning).
  - `?xr=` takes the mode words for an A/B in a headset without a re-mint: `?xr=standing`, `?xr=seated,snap`, `?xr=standing,off`, `?xr=head`.
    The live route applies them, and the page reads them itself too, so a downloaded or statically hosted copy takes them.
- **Test pages for a headset** (`scripts/xr-test-pages.mjs <out-dir>`): a Quest browser opens a WebXR session only over
  https, so the script writes static pages (three from the pinned CDN) for a host such as GitHub Pages: a course (a
  straight lane down +X with a post every 5 m and a goal at its end, the opening view standing on it) and the walkable
  fractal city, with an index linking each mode.
- **The xr rows of the other schemes**: the action game, the same verb on the same control as the pilot's (left stick
  moves and its click sprints, the triggers hold attack (right) and guard (left), A jumps, B dodges, X dashes like the
  pilot's tackle, Y switches, the right grip shoots, the right stick's click locks, the left grip stays the hands' use),
  the grid
  puzzle and the tactics board (the left stick moves the cursor, the right turns and zooms the view), with their legend
  rows. The pilot scheme's rows are as they were: they ride every game page, and no game page reads a headset yet.
- Gates: machine — the driver and the shaping, and the emitted block run against three's math with a fake session (a
  push with drift and a glance aside walks a straight line; a turn leaves the head where it stood; a remap swaps the
  hands). The two xr fixtures' byte pins moved; every other page is byte-identical. Eyes — the operator's Quest 3S, not
  yet run.
- Not yet: a game's hero is not driven in a headset (the rig replaces the hero's step on entering VR), and the session has
  no wall collision.

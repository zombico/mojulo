### A frame's plasma wake: streaks the pilot draws

- A booster names its propellant (`assault-frame/parts.js` `PROPELLANTS`: argon refined from Mars's air, violet; xenon
  shipped in, blue; krypton a cheap mixed fill, white-green). The drive is a pulsed plasma drive, not a fire: a frame's
  plume and its wake take the propellant's colour (the figure's `wake`), and the plume's tail deepens toward the dark
  where it was amber. A booster is read by its streak.
- The wake (`scene/channels/controllable/frame-wake.js`): a ribbon from each main bell, kept in the world where the bell
  has been, so the pilot's movement draws the streaks: white at its heart, the propellant's colour at its edges, thin to
  nothing as it ages. Bright beads along it are the drive's pulses, held where they were thrown, their spacing the speed.
  In air it curls and frays and fades sooner; in vacuum it runs straight and lasts. A quick boost burns it wide and
  white-hot and sheds a ring of light across the dash where it begins; an assault boost burns it wider while held.
- One mesh a frame, its pulses and its curl in the shader and the ribbon's sampling; emitted only on a page whose figures
  carry a wake, never in a capture.
- A look that fails never stops the game: the wake puts itself out, said once, and the world plays on (a sample past the
  ribbon's end once threw on a boost and a jump and froze the page).
- The frames take longer, heavier steps: each some 0.84 of a leg's reach (`assault-frame/clips.js` `FRAME_STEP`), the
  foot lifted higher through its swing and the pelvis dropping deeper onto it, and the walk's cycle covers the ground
  its own legs do (`frameStride`, the frame rule's `stride`), so a planted foot holds where it landed.
- The walk's cycle runs by the ground covered each step (the frame rule's gait phase had taken the speed for the
  distance, a cycle and more every frame: the legs flickered through their poses, a tiptoe), and a frame off its
  booster keeps its way on in the air: what it carries, and at least its walk, steered by the keys (it had been braked
  to a stand whenever a key was held).
- Sticky feet: a frame on its feet that has not jumped or climbed stays on the ground over a crest or a dip, held down
  by as much as `stick` metres a step (1.2) or its pace over the ground, so a bumpy field is walked, not floated over; a
  deeper drop is a ledge, and it goes over it into the air.
- A quick boost is steered: through its burst it turns toward the keys held, at its own speed (`qbTurn`, 9 rad/s).

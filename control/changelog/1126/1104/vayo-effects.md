### Effects on the flow: blasts and power-ups moved by the world's air (rupa-vayo)

- **`fxStyle: { flow: true }`** (any look, any flavor): a blast and a power-up drawn as the world's air moves them.
  When an effect goes off, the air round its spot is solved once: the ways it can go (rays against the level's walls,
  ceilings and floor), the wind, a pool it is in. Every puff then follows a formula of time, so the same blast differs
  by where it goes off. Against a wall it runs up the face; in a corridor it shoots down it and out of the open end;
  in the wind its smoke leans downwind; under water it is a pulsing bubble.
- **A blast in stages**: a fireball that races out and holds, then lifts and rolls into a ring (a mushroom needs no
  stem), its white-hot heart inside a coloured shell; a plume of smoke; debris thrown along the open ways; a third as
  many sparks, as embers that cool from white to red to dark; and the ground ring as a dust skirt running along the
  ground. Fewer, larger, bolder puffs.
- **A power-up**: flame tongues rising and turning round the body (a new tongue-shaped sprite), a white-hot core,
  motes drawn in on a spiral, pebbles lifting off the ground, and a gust of dust pushed out along it, in place of the
  spinning onions and rings of spikes.
- **The combat page on the flow**: a grenade's, a death's or a scripted blast's burst goes off as the flow's blast in
  place of the additive spheres, and a hit is a soft flash and a ring of air in place of a sphere, a torus and a star
  of lines.
- **Fixed**: a world whose play cues make its events now keeps its `fxStyle` and `fxLight` (they were laid on the
  events before the cues rebuilt them, and lost). Such worlds now draw the composed effects they ask for.
- A world without `flow` changes no byte.

---
{
  "id": "science-setting",
  "name": "A science demo stood in a world (a classical demo 1:1, any other as a bench prop)",
  "family": "world",
  "entry": "compose_world",
  "summary": "Stand a composed science world in ANY /world: a classical demo at true size where it happens (a cannon on the castle wall, a pendulum in the park, a ball dropped on the Moon), with the world's own ground as a law and every body's path checked against the world's surfaces; or a microscopic box, an orbital or an orbit round a black hole as a bench prop in a glass case, its true magnification on the panel.",
  "when": "Reach for this on framing like 'put the pendulum demo in the school courtyard', 'fire the cannon from the castle wall and show the arc', 'drop a ball on the Moon level', 'a physics demo the class can walk up to', 'show the molecules in a glass case in the lab', 'an orbital model on the classroom table'."
}
---

A science world is a channel any world kind takes: pass it to `compose_world` as `overrides.science` (any base), or
set `science` on a stored world's recipe and patch it in place. The demo is the same recipe `create_view` takes for
its kind (`get_view_vocab({ id: 'classical' })` and the other scales' cards), solved again on every read.

## Spec

```
science: {
  kind:      'classical' | 'microscopic' | 'quantum' | 'relativistic',
  model:     the scale's model (its card),   dress?, liberties?, title?
  at:        [x, y, z]   where the demo's origin stands in the world (metres)
  yaw?:      a turn about the vertical ('30°')
  ground?:   'from-world'   (classical) the world's surface under `at` becomes a plane law at its height
  setting?:  'earth' | 'moon' | 'mars'   where the world is (compose_world stamps it from the theme when it can)
  case?:     a bench prop's glass case, metres across (default 1)
}
```

## How it stands

- **A classical demo drawn at one metre per unit stands 1:1.** Both frames are z-up metres: a body the model starts
  2 m above its origin starts 2 m above `at`. The page opens on the demo's camera; the world's cameras follow.
  Its readout and its "what's real · what's drawn" panel ride the world page, and a walkable world lets you walk up
  to it. Its film is framed in the world.
- **Anything else is a bench prop**: a microscopic box, a quantum orbital or packet, an orbit or clocks world round
  a black hole, a classical solar system drawn shrunk. It is drawn inside a glass case at `at`, and the panel gives
  its true magnification. A relativistic light world, an orbital drawn as a volume and a quantum plane are drawn by
  shaders over the whole page and cannot stand in a world.

## The setting is dress: what touches a body is a law

- `ground: 'from-world'` takes the highest walkable surface of the world under `at` (within half a centimetre of
  `at`'s height) and adds it to the model as a flat `plane` at its height, with the panel saying so. The model may
  not have a floor of its own as well. The plane is flat: a sloping or uneven ground is not followed beyond it.
- `scenery-clear` checks every body's recorded path against the world's surfaces near the demo, and advises where
  one passes through a surface no law covers (a wall, a ceiling, the ground with no `ground`), naming the surface
  and the moment. It runs when the world renders, and the page's panel lists it.
- `setting-agrees` compares the model's gravity with the setting's (Earth 9.8, Moon 1.62, Mars 3.71 m/s²) and
  advises when they differ; `setting-air` advises on a drag row where there is no air. The setting never sets g:
  give `model.frame.g` (`'moon'`) when the demo is there.

`compose_world` solves the demo at mint (a bad model refuses the mint, teaching) and returns its solver's gates and
the setting's; the world's own surfaces are checked when it renders.

## Example

A ball thrown in a school courtyard, bouncing on the courtyard's own ground:

```
compose_world({ base: 'school', overrides: { science: {
  kind: 'classical', at: [0, 0, 0], ground: 'from-world',
  model: { bodies: [{ id: 'ball', mass: 0.45, radius: 0.11, at: [0, 0, 2], v: [1, 0, 3] }],
           laws: [{ law: 'gravity-uniform' }], duration: 2 } } } })
```

---
{
  "id": "creases",
  "name": "Creases (contact shadows where angular surfaces meet, drawn by the World)",
  "family": "world",
  "entry": "compose_world",
  "summary": "A pass over any /world that inks the concave creases of its built forms: a wall's foot on the ground, a tier on the one below, a column on its plinth, a roof on a parapet. A crisp line at the corner blending out across the face; never a convex edge or an outline, never a tree. One key on the recipe; the geometry is untouched.",
  "when": "Reach for this on framing like 'ground the buildings', 'the buildings look like they float', 'add contact shadows', 'darker where the walls meet the ground', 'ambient occlusion lines in the corners', 'make the steps read', 'more depth in the city', 'an illustrated / inked look on the architecture', 'a Wii-era look with shaded corners'."
}
---

`creases` is a kind-generic world key: set it on a stored world's recipe and patch it in place (`set /creases true`,
`set /creases/ink '#1b1d3e'`), or pass it to `compose_world` as `overrides.creases`. The World page draws it; stills,
the exported meshes and the engines do not (yet).

## Spec

```
creases: true | {
  ink?:   '#rrggbb'   the shadow's colour (default '#2b2116', a warm umber; on a geocube world use its shade, darkened),
  line?:  0..1        the line at the corner (0.85),
  wash?:  0..1        the blend out across the face (0.6),
  reach?: metres      how far the blend reaches (2; a room reads better at 0.5 to 1, a skyline at 3 to 5)
}
```

## What takes ink

Only surfaces the builders mark angular: buildings, landmarks, kerbs, steps, street furniture, the ground under them. A
tree is organic: neither it nor the ground at its foot is inked. Figures, walkers, cars, water and the sky never are.
A gentle curve (a dome, a vault) stays clean; the joint where it meets a drum or a wall is inked.

## Where it is built for

The outcomes outside the game loop: the fractal city (its metro and canal profiles too), the city plan, edifices,
historic places, the transit kinds, and the building interiors (floorplan, interior, restaurant, store, office, mall).
It reads every world, but a game's frame budget with it on is unmeasured.

Beside it: `ao` bakes occlusion into the vertex colours (soft, broad, exported); a geocube's `contrast` shapes the
whole world's light in the vertex. `creases` is the sharp, screen-sized line those two cannot draw on a stack of boxes.

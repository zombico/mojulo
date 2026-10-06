---
{
  "id": "amethyst-crystal",
  "name": "Amethyst crystal",
  "entry": "mint_solid",
  "family": "object",
  "summary": "A ready-to-mint turntable: a violet octahedron spinning live in the browser — the amethyst-crystal display piece, lit per frame so the highlight stays fixed while the form turns.",
  "when": "a spinning crystal or gem; a live rotating display piece; an octahedron / coordination polyhedron turntable; a jewel for a shop, inventory, or loading screen"
}
---

A worked example over the solid-turntable kind: an exact octahedron in
amethyst violet, tipped 24° toward the camera, one revolution every 14
seconds. The vexar surface re-shades per frame, so the highlight stays
pinned in the viewport while the facets turn under it — the thing that makes
it read as a lit crystal instead of a spinning flat card. Dependency-free
CSS `preserve-3d`; embed the scene URL in any `<iframe>`.

This is a Door-1 recipe: pure params, nothing to load. Mint it as-is, or use
it as a starting point — `dodecahedron` + `#c8a13a` is the gold coordination
polyhedron, `sphere` + `surface: 'glow'` is an energy orb, and
`spin_seconds: 6` makes any of them read urgent instead of ornamental.

## Recipe

See `recipe.json` beside this card — `kind: 'solid-turntable'` with the spec
above.

Pass the `kind` and `spec` to the solid mint. The full parameter manual for
the underlying kind is its own card (`id: 'solid-turntable'`).

---
{
  "id": "solid-turntable",
  "name": "Solid turntable",
  "family": "object",
  "entry": "mint_solid",
  "summary": "Mint a single convex 3D solid that spins live in the browser — a lit ball, a crystal / coordination polyhedron, a gem, a planet, a single atom — as a dependency-free CSS preserve-3d turntable.",
  "when": "Reach for this on 'spin a sphere / a lit ball / a dodecahedron / a crystal / a single atom, live in the browser'."
}
---

Mint a single 3D solid that SPINS LIVE in the browser — a lit ball, a crystal / coordination polyhedron, a gem, a planet, a single atom or orbital lobe. You pass a tiny recipe (a shape + a color); the substrate stores ONLY the recipe (`manifest.kind === 'css3d-turntable'`, no geometry, ~nothing tokenized) and regenerates the solid on render as a live, dependency-free CSS preserve-3d HTML scene served at `/api/sketches/<ref>/scene` (open it, or embed it in an `<iframe>`). It turns on a turntable with the highlight FIXED in the viewport (vexar Lambert re-shaded per frame), so it reads as a real lit object rather than a flat card.

SCOPE — a SINGLE CONVEX solid only: this is the class the live CSS engine renders exactly, because a convex hull never self-occludes. For a 3D object that DOES self-occlude or interpenetrate — a multi-atom ball-and-stick molecule, a chiral double helix, a mechanism — build a manji-tree and use the BAKED turntable path instead (it depth-sorts every frame). Reach for this on framing like 'spin a sphere / a lit ball / a dodecahedron / a crystal / a single atom, live in the browser'.

## Spec shape

`title`, `ref`, and `folder_ref` are top-level mint params; everything below is the recipe. Note the spec key is `spin_seconds`.

```
{
  shape?:        'sphere' | '<platonic>' | 'cylinder',
  color?:        '#rrggbb',
  surface?:      'vexar' | 'solid' | 'glow',
  tilt?:         <degrees>,
  spin_seconds?: <seconds per revolution>,
  lod?:          'draft' | 'default' | 'hero' | 'ultra',
  viewBox?:      { width, height }
}
```

## Fields

- `shape` — the convex solid to spin (default `sphere`). `sphere` → a lit ball; the platonic solids (`dodecahedron` / `octahedron` / `tetrahedron` / `cube`) read as crystals / coordination polyhedra; `cylinder` → a column / disc. An unrecognized value falls back to `sphere`.
- `color` — base fill as a `#rrggbb` hex (default `#5f86ad`). vexar shades it per face.
- `surface` — `'vexar'` (default; lit, re-shaded per frame), `'solid'` (flat fill), or `'glow'` (emissive rim).
- `tilt` (number) — turntable tilt in degrees, how far the top is tipped toward the camera (default 18).
- `spin_seconds` (number) — seconds per full revolution (default 12; min 2).
- `lod` — tessellation density for sphere / cylinder: `'draft'` / `'default'` / `'hero'` / `'ultra'` (default `'default'`). Platonic solids are exact regardless.
- `viewBox` (object) — optional render size `{ width, height }` (default 480×480).

## Worked example

A slow-spinning golden dodecahedron read as a coordination polyhedron, tipped a little further toward the camera:

```
{
  title: 'gold dodecahedron',
  shape: 'dodecahedron',
  color: '#c8a13a',
  surface: 'vexar',
  tilt: 22,
  spin_seconds: 16
}
```

Returns `{ ok, ref, sceneUrl, url, recipe, stats: { shape, surface, faces } }` — `sceneUrl` is the live preserve-3d scene, and a gallery preview PNG is pre-baked in the background.

---
{ "id": "image-outcome", "name": "image-outcome — directed scaffold for an external image render", "summary": "a single-shot director packet: camera-space polygon forms with strict/guided/loose preserve levels, horizon + vanishing point, protected/overlay zones, and a render brief — minted as a sketch whose SVG scaffold conditions an external image model; mojulo owns geometry, the model owns paint", "when": "generate an AI image with controlled composition, turn a blockout/world shot into a finished cinematic image, direct image generation instead of raw-prompting it, produce concept art / matte painting / interior render with fixed staging, image with a text-safe zone, AI image in a locked ink/manga/noir/cartoon style instead of the over-rendered default", "tier": "recipe" }
---

An `image-outcome` sketch is a **director packet** for external image
generation (see lib/graph/image-outcomes/image-outcomes.plan.md). The
manifest is the deterministic recipe; `/api/sketches/<ref>/svg` renders its
scaffold — depth-ranked color-coded forms over a horizon/vanishing-point
stage. The scaffold image (not just the prose) is fed to the image model;
the model paints a finished raster that preserves the geometry.

Division of labor (doctrine): **mojulo owns** camera, horizon, occlusion
order, form placement, protected zones, and all text; **the image model
owns** ink, light, texture, mood, and detail. Nothing readable may be
painted — text arrives later as a mojulo overlay.

## Shape

```
{
  kind: 'image-outcome',
  title, intent,
  viewBox: { width: 1536, height: 1024 },
  camera: { kind: 'wide-establishing' },  // CLOSED vocab: wide-establishing |
       // wide-cinematic | insert-close-up | close-up | low-angle-hero |
       // over-shoulder (default wide-establishing; freeform kinds rejected)
  horizonY: 405,
  vanishingPoint: [768, 405],
  forms: [           // depth-sorted at mint; first = deepest
    {
      id, role,                       // 'road', 'wet street plane'
      depthBand: 'background'|'midground'|'foreground',
      depthRank: 0,                   // ascending = nearer
      preserve: 'strict'|'guided'|'loose',
      materialHint: 'reflective asphalt, edges stay fixed',
      polygon: [[x,y], ...],          // screen-space; or bbox {x,y,w,h}
      notes: ''
    }
  ],
  figures: [{ id, x, y, scale, pose: 'stand' }],  // optional staged figures;
       // pose is the closed 12-entry stick vocabulary, or add
       // rig: { pose, proto?, garment?, view?, note? } for an exact
       // protoform-articulated silhouette (see the sequential-art card)
  protectedZones: [{ x, y, w, h, label: 'title zone' }],   // model must not fill
  overlayZones:   [{ x, y, w, h, label: 'caption safe' }], // mojulo overlays later
  renderBrief: {
    style, mood, lighting,
    mustPreserve: [...], mayInvent: [...], negative: [...]
  }
}
```

Preserve levels: **strict** — the form must not move (drawn amber, thick);
**guided** — position holds, style may change; **loose** — a suggestion.
Spend `strict` only on what the composition dies without (road edges, a
landmark, the floor plane) — over-constraining fights the model.

Style tuning: `renderBrief.preset` selects a CLOSED drawing-discipline
vocabulary — `gpen-shonen` (G-pen ink + screentones; dial `stylization`
∈ [0,1], realism ↔ expressive big-head; dial `palette`: ink-color |
bw-tones for classic black-and-white manga), `shojo-soft` (fine-line shojo
register — luminous eyes, flowing hair, elongated elegance; dials
`ornament` ∈ [0,1] and `palette`), `hard-boiled` (pulp noir black
and white; dial `tone`: none|red|yellow|blue spot color), `crosshatch`
(16th-century old-master ink — all value from hatch/cross-hatch line
systems; dials `technique`: pen|engraving|woodcut, `density` ∈ [0,1],
`ink`: black|sepia), `louvrijks` (old-master oil — Dutch Golden Age /
Italian Renaissance paint handling, anti-photographic; dials `school`:
dutch|italian, `drama` ∈ [0,1], `patina` ∈ [0,1]), `ukiyo-e` (Edo woodblock print — flat registered
color planes, keyblock contour, bokashi-only gradients; dials `palette`:
nishiki|aizuri|sumi, `weathering` ∈ [0,1]), `photo-realism` (deliberate max fidelity; dial
`medium` ∈ [0,1] photograph ↔ clearly-CG 3d-engine AAA render),
`art-nouveau` (whiplash line + ornament as
structure; dials `medium` ∈ [0,1] illustration ↔ glass-pane, `gilding`:
none|gold), `ink-brush` (East Asian sumi ink on absorbent
paper; dials `register` ∈ [0,1] sumi-e ↔ ink-wash, `tint`: none|pale),
`antiquity` (ancient-world artifact — Egyptian
tomb painting / cave painting / Greco-Roman; dials `tradition`:
egyptian|cave|greco-roman, `surface` ∈ [0,1] fresh ↔ ruin),
`silver-age` (American Silver Age comics — brush
ink, four-color newsprint flats, Ben-Day tone; dials `register` ∈ [0,1]
romance ↔ pulp-hero, `print` ∈ [0,1] crisp ↔ aged newsprint),
`tv-cartoon` (80s cel-animation page style —
outlined cel-flat characters over painted backgrounds, broadcast palette,
animation-budget fidelity; dial `register` ∈ [0,1] sitcom-family ↔
mutant-hero), `steamboat`
(rubber-hose classical cartoon; no dials). A preset fills brief defaults,
merges its negatives, and emits a "Style Lock" instruction section; no
preset = the model's freeform max-capability render (see the
sequential-art card for the full preset descriptions).

## Worked example

A rainy neon street: sky corridor (`loose`), two rows of street-wall
building masses converging on the vanishing point (`guided`, nearest pair
`strict`), a `road` plane (`strict`), a crosswalk (`guided`), one protected
title zone, one caption overlay zone. Brief: "cinematic rain-soaked neon
street concept art", mayInvent windows/cars/rain, negative "do not move
strict forms / no readable text". Rectangular masses are sufficient —
mojulo owns perspective and object order; facade detail is the model's.

Mint with `create_sketch { title, manifest }` → `/sketches/<ref>` shows the
scaffold. The render handoff (request → external worker → audit → bind) and
the final composite are the image-outcomes plan's I3–I5 surfaces.

A bound render can also SKIN a 3D object: a `create_workbench` lathe takes
`wrap: { source: { outcomeRef: '<this ref>' } }` — the latest bound PNG maps
around the cylinder wall (a can/bottle/cup label, package design) and
exports as a real texture in `.glb`.

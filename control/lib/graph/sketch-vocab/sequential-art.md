---
{ "id": "sequential-art", "name": "sequential-art — directed comic/manga page for external image render", "summary": "a page-grammar director packet: panels with camera beats, stick-pose figures, preserve-leveled forms, and blank bubble reserves — minted as a sketch whose scaffold conditions per-panel external image generation; mojulo composites borders, gutters, bubbles, and lettering afterward", "when": "make manga, make a comic page, manga page, sequential art, storyboard with panels, graphic-novel beat, four-panel strip, comic with speech bubbles, AI-generated comic where the text must stay crisp, G-pen inked shonen manga with screentones, soft shojo romance page with luminous expressive eyes and flowing hair, black-and-white pulp noir comic with one spot color, 16th-century engraving-style crosshatched ink drawing, ukiyo-e woodblock-print style page, classical oil-painting page in the Dutch master or Renaissance style, 80s saturday-morning cartoon style comic, silver-age four-color superhero or romance comic with Ben-Day dots, egyptian hieroglyphic-style or cave-painting or greco-roman ancient art page, sumi-e or ink-wash brush painting page, art nouveau poster or stained-glass style page, photorealistic or AAA game-render style image, rubber-hose classical cartoon strip", "tier": "recipe" }
---

A `sequential-art` sketch directs a comic/manga **page** (see
lib/graph/image-outcomes/image-outcomes.plan.md). Mojulo owns the page
grammar — panel bounds, gutters, camera per panel, pose silhouettes, bubble
reserves, reading flow — and the external image model paints ONLY the art
layer, panel by panel. Bubbles, borders, and lettering are composited by
mojulo afterward as SVG, so text never degrades through the generative
layer.

## Shape

```
{
  kind: 'sequential-art',
  title, intent,
  pageRecipe: 'manga-high-eye-control',
  readingFlow: 'left-to-right, top-to-bottom',
  renderStrategy: 'per-panel',   // default; 'whole-page' | 'hybrid'
  viewBox: { width: 1536, height: 2048 },
  panels: [
    {
      id: 'p1',
      beat: 'Hero enters a narrow corridor and notices something above.',
      bounds: { x, y, w, h },              // page coordinates
      camera: { kind: 'wide-establishing', horizonY, vanishingPoint },
      figures: [{ id: 'hero', x, y, scale, pose: 'stand'|'reach'|'crouch' }],
      forms: [{ id, polygon: [[x,y],...], preserve: 'strict'|'guided'|'loose' }],
      bubbleZones: [{ x, y, w, h, label: 'blank speech',
                      lettering: 'What is that light…?' }]  // composite-only
    }
  ],
  renderBrief: { style, mustPreserve: [...], mayInvent: [...], negative: [...] }
}
```

Rules that make it work:

- **renderStrategy `per-panel`** (default): each panel is generated as its
  own shot and mojulo composites the page — panel geometry cannot drift.
  `whole-page` trades geometry fidelity for one-pass color cohesion;
  `hybrid` does both (page pass for palette, panel passes for fidelity).
- **pageRecipe lays out the page for you.** Omit panel `bounds` and set
  `pageRecipe` to a panel-blocking paradigm — the SAME layout math as the
  deterministic comic pipeline computes them in panel order:
  `manga-high-eye-control` (5 panels ideal — full-width opener, two narrow
  reaction cuts, rising column, large emotional landing panel; defaults
  reading flow to right-to-left), `sunday-comic` (6 — punchline footer),
  `american-comic-widescreen-panels` (letterbox rows), `monoculous`
  (dominant panel + insets), `comic-page` (balanced grid, any count). The
  paradigm's eye-line phrase renders into the worker brief. Off-ideal
  panel counts fall back to the comic grid; explicit `bounds` and
  `readingFlow` always win; any freeform `pageRecipe` label is still fine
  when every panel carries bounds. So "make manga" is:
  `pageRecipe: 'manga-high-eye-control'` + a manga style preset + beats —
  no rectangle math required.
- **Stick poses steer action.** A figure is `{x, y, scale, pose}` — the
  simple silhouette is enough to carry a beat; no rendered character
  needed in the scaffold. `pose` is a CLOSED vocabulary (validation
  rejects anything else): `stand`, `reach`, `crouch`, `point`, `wave`,
  `run`, `walk`, `sit`, `kneel`, `fall`, `brace`, `embrace`.
- **Extremely detailed posing: add `rig`.** A figure may carry
  `rig: { motion?, phase?, pose?, proto?, garment?, view?, setup?, note? }`
  — the protoform figure rig behind create_figure, rendered as an exact
  articulated silhouette into the panel at the same `{x, y, scale}`
  anchor. PREFER the authored motion vocabulary over hand-guessed joint
  angles: `motion: 'walk' | 'wave' | 'stretch'` (or a gait/keyframe spec)
  sampled at `phase` ∈ [0,1) gives a choreographed pose — mid-stride,
  mid-wave — from the same motions create_figure animates. Raw per-joint
  `pose` DOF (+ spine dials) composes ON TOP: explicit keys override the
  sample (tilt just the head on a walking body). Joint limits clamp every
  value, so a rig can't break the form. Use rigs for hero/action key
  poses; leave background figures as sticks. `note` is the beat phrasing
  the render instructions use (the scaffold silhouette is the pose spec —
  instructions say "match it exactly").
- **Camera per panel is a CLOSED vocabulary** (validation rejects freeform
  kinds): `wide-establishing`, `wide-cinematic`, `insert-close-up`,
  `close-up`, `low-angle-hero`, `over-shoulder`. Each entry carries an
  instruction phrasing plus horizon/subject-framing bands the render audit
  checks against. Vary the camera per beat — a page of same-distance
  panels reads flat.
- **bubbleZones stay blank in the painted layer.** `lettering` text lives
  in the manifest for the composite pass ONLY — it never reaches the image
  model, and render instructions say "art layer only: no borders, no
  bubbles, no text".
- **Characters are identity metadata.** Declare the cast once at the top:
  `characters: [{ id, name?, description, outfits: [{ id, description }]?,
  rig? }]` — description is the face/hair/build the sheets will pin. A
  panel figure binds to one with `character: '<id>'` + optional
  `outfit: '<id>'` (membership validated at mint). The render packet then
  carries one reference-sheet brief per character — a neutral-lighting
  model-sheet turnaround (front/¾/side/back on a common ground line), one
  row per outfit, in the page's Style Lock — and the worker protocol says
  sheets are generated FIRST and every panel featuring a character is
  conditioned on its sheet. The sheets come back with the panels as the
  comic's cast metadata.
- **Reusable characters: mint the sheet as its own sketch.** For a cast
  that recurs across pages/artifacts, mint `create_sketch { manifest:
  { kind: 'character-sheet', title, character: { id, name?, description,
  outfits, rig? } } }` → its own `sk_` ref with a turnaround-strip
  scaffold. The worker pulls it via `get_image_render_packet`, generates
  the sheet, and saves the PNG back with `bind_character_sheet { ref,
  image_path }`. Any comic then casts it with `characters: [{ ref:
  'sk_…' }]` — the character inlines at mint (local overrides allowed)
  and the bound PNG rides every render packet as `boundSheet`, so the
  worker conditions on the SAME image every time instead of regenerating
  identity per artifact.
- **Style presets tune the drawing discipline** (CLOSED vocabulary on
  `renderBrief.preset`; unknown presets and dial values are rejected).
  Without a preset the model paints on its over-rendered freeform default —
  keep that only when maximum painterly capability is wanted. Presets:
  - `gpen-shonen` — G-pen inked shonen manga with screentones and solid
    spot blacks. Dial `stylization` ∈ [0,1] between two poles: 0 = realism
    (grounded anatomy, seinen-adjacent), 1 = stylized expressive big-head
    (enlarged heads/eyes, transformative expressions). Dial `palette`:
    `ink-color` (default; flat ink color under the tones) | `bw-tones`
    (classic black-and-white manga — no color; midtones only as
    screentone/hatching over paper white and solid black).
  - `shojo-soft` — gpen-shonen's sibling in the shojo register: fine
    maru-pen line, airy negative space; eyes are the focal instrument
    (large, luminous, layered highlights), hair as flowing strand groups,
    small delicate mouths, elongated elegant figures. Dial `ornament`
    ∈ [0,1]: 0 = restrained clean panels, 1 = full efflorescence (flower
    fields, starburst sparkles, halation, dissolved panel edges). Dial
    `palette`: `ink-color` (default; soft light-leaning flats) |
    `bw-tones`.
  - `hard-boiled` — classical pulp noir ink: pure black and white, hard
    chiaroscuro, shadows as shapes. Dial `tone`: `none` (default) | `red` |
    `yellow` | `blue` — at most ONE spot-color accent.
  - `crosshatch` — 16th-century European old-master ink: ALL value built
    from hatching/cross-hatch line systems that follow the form; paper
    white as the only white; no tones, washes, or gradients. Dials:
    `technique` (`pen` default | `engraving` | `woodcut`), `density`
    ∈ [0,1] (airy drawing ↔ densely worked plate), `ink` (`black` |
    `sepia`).
  - `louvrijks` — old-master oil painting (Dutch Golden Age + Italian
    Renaissance): visible glazing and brushwork, period pigments, painted
    chiaroscuro/sfumato. The one PAINTERLY preset — it bans the modern
    photographic layer instead (no HDR, bloom, bokeh, lens optics, plastic
    3D sheen). Dials: `school` (`dutch` default | `italian`), `drama`
    ∈ [0,1] (soft daylight ↔ deep tenebrism), `patina` ∈ [0,1] (fresh
    ↔ aged museum surface with craquelure).
  - `ukiyo-e` — Edo woodblock print: flat registered color planes inside
    a carved keyblock contour; bokashi gradation is the only gradient;
    pattern (seigaiha waves, karakusa scrolls) stands in for texture.
    Dials: `palette` (`nishiki` polychrome default | `aizuri` all
    Prussian-blue | `sumi` monochrome), `weathering` ∈ [0,1] (fresh
    impression ↔ aged Edo print with toned washi and registration drift).
  - `photo-realism` — opts INTO the maximum-fidelity register the other
    presets tune away from, but dialed rather than accidental. Dial
    `medium` ∈ [0,1]: 0 = photograph (real lens optics, grain, looks
    captured), 1 = 3d-engine (clearly-CG high-end renderer — immaculate
    PBR, ray-traced GI, AAA key-art polish). Commits to one register —
    no uncanny half-photo half-CG mix.
  - `art-nouveau` — whiplash organic line, flat decorative color inside
    firm contour, ornament as structure (halos, botanical borders),
    muted floral period palette. Dials: `medium` ∈ [0,1] (0 =
    Mucha-manner lithograph illustration; 1 = stained glass-pane —
    heavy leading, luminous translucent panes), `gilding` (`none`
    default | `gold` halos/borders).
  - `ink-brush` — East Asian brush painting: sumi ink on absorbent
    paper, every mark a loaded-brush stroke; emptiness is composition
    (untouched paper reads as air/water/light); wet-into-wet bleeds and
    dry-brush flying-white instead of hard contours. Dials: `register`
    ∈ [0,1] (0 = sumi-e — radical stroke economy; 1 = ink-wash — layered
    misty tonal washes), `tint` (`none` default | `pale` literati mineral
    tints).
  - `antiquity` — the image behaves like an ancient-world artifact:
    period pigments and conventions, depth by registers/overlap/scale
    hierarchy (never vanishing-point perspective), glyph-like framing
    kept decorative and non-legible. Dials: `tradition` (`egyptian`
    default — composite-view tomb painting | `cave` — ochre/charcoal
    silhouettes on rock | `greco-roman` — vase profile drawing +
    Pompeiian fresco flats), `surface` ∈ [0,1] (fresh commission ↔
    weathered ruin).
  - `silver-age` — the Western cousin of the manga pair: American Silver
    Age comics — brush-and-nib ink over plain four-color flats
    (deliberately looser lock than `tv-cartoon`; plain by default —
    ordinary builds, crisp press, Ben-Day tone only as a subtle accent,
    never a blanket filter). Dials: `register` ∈ [0,1] (0 = romance
    comics — glamour styling, tearful close-ups; mid = everyday
    plain-clothes register; 1 = pulp-hero — four-color heroics,
    Kirby-energy action), `print` ∈ [0,1] (crisp press default ↔ aged
    yellowed newsprint with off-register bleed).
  - `tv-cartoon` — 80s TV cel animation as page style: outlined cel-flat
    characters (two-tone cel shade) over softer painted no-outline
    backgrounds — the invariant is that characters stay distinct via
    their outlines; saturated broadcast palette; animation-budget
    fidelity (economy of line, never over-rendered); modern finishing
    allowed on top. Dial `register` ∈ [0,1]: 0 = sitcom-family (rounded
    domestic designs, gag staging), 1 = mutant-hero (heroes, muscles,
    action — still budget-fidelity clean).
  - `steamboat` — classical rubber-hose cartoon: noodle-cylinder bodies,
    thick even outlines, flat fills, simple dot/pie-cut eyes with
    transformative squash-and-stretch expressions. No dials.
  A preset fills `style`/`mood`/`lighting` defaults (explicit fields still
  override), merges its negatives into the Avoid list, and renders a
  "Style Lock" section into the worker instructions. Dial values live on
  the manifest: `renderBrief: { preset: 'gpen-shonen', dials:
  { stylization: 0.8 } }`.

## Worked example

Four-beat signal page: p1 wide-establishing (hero `stand` between two
`strict` corridor walls, blank speech bubble), p2 insert-close-up (`strict`
glowing device, `guided` hands, blank caption), p3 low-angle-hero (hero
`reach` at 1.85 scale toward a `strict` signal light, blank shout), p4
wide-cinematic reveal (hero `crouch` on a `strict` roof edge, `guided`
skyline, blank narration). Brief: cool dusk ink-and-watercolor; negative:
no readable text, do not merge panels, do not crop out the hero.

Mint with `create_sketch { title, manifest }` → `/sketches/<ref>` shows the
page scaffold.

## The full loop: mint → render → bind → final → book

1. `create_sketch` mints the page (scaffold = the nēmu).
2. The image worker pulls each target via `get_image_render_packet`,
   generates, and submits with `bind_image_render { ref, target,
   image_path }` (character sheets via `bind_character_sheet`).
3. Once every target is bound, `/api/sketches/<ref>/final.png` is the
   FINISHED page: panel renders fitted into their bounds, borders,
   gutters, bubbles, and lettering composited deterministically on top —
   editing lettering re-finals without re-rendering any art.
4. Publish: `gather` the page sketches into a stash and `cook
   { publication: { kind: 'comic', format } }` — bound pages publish as
   their final PNG, unbound ones as their scaffold, in any format
   (american-comic / sunday-strip / manga-tankobon RTL / webtoon scroll).

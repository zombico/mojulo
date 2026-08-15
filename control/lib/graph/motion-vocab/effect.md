---
{
  "id": "effect",
  "name": "Effect motion (materialize / transfigure a carved solid)",
  "family": "motion",
  "entry": "forge_motion",
  "summary": "Add TIME to a carved solid — a phase 0→1 that brings it into being (materialize) or turns it into another (transfigure). The temporal peers of the carved-solid mint.",
  "when": "Reach for this on 'make it appear / boot it up / materialize / dissolve / 3D-print the logo / beam it in / transporter effect' (materialize), or 'morph A into B / a rebrand reveal / before→after / liquid chrome / T1000' (transfigure)."
}
---

EFFECT motions add TIME to a CARVED SOLID (the temporal peers of the carved-solid mint): a phase 0→1 that brings it into being or turns it into something else.

## Subject

- `materialize` — `subject.carved_solid`: a carved-solid ref (`sk_…`) or an inline `{ shape, style?, material? }` — the subject that comes into being.
- `transfigure` — `subject.from` + `subject.to`: the start + end carved solids (the `to` lends the morph its material; liquid-metal uses a smooth carrier and does not require metal endpoints).

## Shot

`shot.motion`: `materialize` or `transfigure`. `shot.params.class` is the STYLE:
- materialize → `hologram` (wireframe boot-up, then skin), `doom` (a glowing scan plane prints the solid upward), or `transporter` (particles converge into the solid).
- transfigure → `galvatron` (de-skin to wireframe → morph the outline → re-skin) or `liquid-metal` (a smooth liquid carrier morphs outside the beveled renderer, T1000-style; loops ping-pong).

Optional liquid-metal tuning at `shot.params.liquid`: `{ carrier }` (material name / #hex / material object; default chrome), `{ blobRandomness }` 0..1, `{ highlightBias }` -1..1.

## Limits

Transfigure currently morphs a single outer contour, so shapes with different hole counts can swim. Effect shots use the fixed carved-solid hero framing (no camera override yet).

## Worked example

```
{ subject: { carved_solid: 'sk_logo' }, shot: { motion: 'materialize', params: { class: 'hologram' } } }
```

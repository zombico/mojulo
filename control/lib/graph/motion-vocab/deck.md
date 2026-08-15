---
{
  "id": "deck",
  "name": "Deck motion (slideshow / concept explainer)",
  "family": "motion",
  "entry": "forge_motion",
  "summary": "Play an ORDERED set of sketches/charts as a slideshow — the info-transfer path (chart decks, KPI walkthroughs, explainers, a report in motion). No camera; each slide plays one-per-beat with optional reveals + a coherent theme.",
  "when": "Reach for this on 'play these charts / make a slideshow / a deck / an explainer / a walkthrough / a report in motion / explain <concept> visually'."
}
---

DECK motion plays an ORDERED set of sketches/charts as a SLIDESHOW — INFO TRANSFER that needs no figure or scene animation. No camera; each sketch plays one-per-beat as a self-contained flipbook + GIF. Use a deck (not a camera motion) whenever the content is charts/text/diagrams rather than a 3D figure or scene.

## Subject

`subject.deck` — an ordered list of slides, each a sketch ref (`sk_…`) or an inline sketch manifest (≥2 still slides, or ≥1 reveal slide); OR `subject.stash_ref` — a stash whose `sketch`-typed items, in gather order, ARE the slides.

## Shot

`shot.motion: 'deck'` (implied for deck subjects). `shot.params`: `{ seconds_per_slide }` (default 2.5), `{ theme }`, `{ width, gif_width }`.

## Theme

Pass `shot.params.theme` to set ONE coherent look across slide ink, backdrop, and player chrome. `dark` is the default. Indicative vocabulary — pick what fits: `paper` / `sepia` (editorial or reflective info), `blueprint` (technical / schematic), `light` / `high-contrast` (maximum legibility), `midnight` (a warmer dark). Low-level `{ surface:'dark'|'light' }` and `{ bg }` still override.

## Reveals — build a slide in sequence

Annotate any of a slide's marks with `reveal: { step, enter, from?, dwell? }`:
- `step` — integer order; marks sharing a step enter together; marks WITHOUT `reveal` are the slide's base (shown from the start).
- `enter` — `fly-in` (slides in; `from`:'left'|'right'), `fade-up` (rises + fades), `type-on` (types out character by character), `fade` / `pop`.
- `dwell` — seconds to hold after this step lands (default 0.7).
A slide with reveals expands into a paced build; still slides hold for `seconds_per_slide`.

## Smooth 2D motion (`animate`)

A SINGLE-slide deck whose marks carry `animate: { channel, … }` renders smooth CSS-transform motion (the .svg plays live, the .gif is the bake). Channels: `spin`, `orbit` (`{center}`), `grow` (scaleY from the baseline — bars grow), `slide` (`{from}`), `fade`, `pulse`; with `{ duration, delay, loop }`.

## Explaining a concept

The deck+reveal IS a concept explainer: graduated, paced disclosure. Common shapes (compose freely): a CONCEPT LADDER (one idea at rising depth, each level a reveal slide); a PROCESS / MECHANISM (boxes + arrows built from MARKS — rect/line/polygon/text, since reveal only stages marks — each stage fly-in in causal order); a LABELED STRUCTURE (draw base marks, disclose callout labels one at a time); a STRATIFIED model; a QUANTITATIVE build (a chart whose marks appear a category per step); a FORMAL/DEFINITIONAL (type-on the equation, fade-up the gloss). FORK: if the concept is a 3D object that must ROTATE, leave the deck — use a `camera` turntable/orbit over a manji-tree. LIMIT: no sound (timing is the narration — pace with `dwell`).

## Worked example

```
{ subject: { deck: ['sk_chart1', 'sk_chart2', 'sk_chart3'] },
  shot: { motion: 'deck', params: { seconds_per_slide: 3, theme: 'paper' } } }
```

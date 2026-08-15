---
{
  "id": "emote",
  "name": "Emote (figure)",
  "family": "edit",
  "entry": "edit_solid",
  "summary": "Apply a named body-language emote (nod / bow / shrug / cheer / point / clap / think …) to a stored figure and render a looping GIF.",
  "when": "Reach for this on 'make the figure nod/bow/shrug…, have them emote/react/gesture'."
}
---

Make a stored figure EMOTE — apply a named body-language emote to an existing kind `figure` sketch and render it as a looping GIF beside the sketch, leaving the stored recipe untouched. Reach for this on "make the figure nod/bow/shrug…, have them emote/react/gesture". Emotes: nod, headshake, bow, shrug, cheer, point, clap, think — keyframe recipes over the posing engine, wrapped in the animation-principles layer so a held beat still breathes.

This is an EDIT op: the target figure is named by `ref` (an existing kind `figure` sketch), and the op params go in `spec`. Default is non-destructive — the emote renders as `emote-<name>.gif` in the sketch's outcome folder and the stored recipe is untouched. `mint` instead DERIVES a new figure sketch carrying the emote as its `motion` — a referenceable recipe a world's `figures` map can pick up via its `figureRef`.

## Spec shape

`ref` (the target figure) is passed at the op's top level. The rest go in `spec`.

```
ref: '<stored figure ref>',
spec: {
  emote:      'nod'|'headshake'|'bow'|'shrug'|'cheer'|'point'|'clap'|'think',
  intensity?: <number in (0, 3]>,           // 1 = as authored, >1 bolder
  view?:      'frontal'|'three-quarter'|'lateral'|'left'|'back' | <azimuth°>,
  animate?:   { frames, fps },              // defaults 30 / 18
  mint?:      <boolean> | { ref?, title? }
}
```

- `emote` (required) — the named emote to perform. One of: nod, headshake, bow, shrug, cheer, point, clap, think.
- `intensity` — exaggeration push in (0, 3]; 1 = as authored, >1 pushes every pose bolder.
- `view` — camera override: `'frontal'` | `'three-quarter'` | `'lateral'` | `'left'` | `'back'`, or azimuth degrees.
- `animate` — GIF control: `{ frames, fps }` (defaults 30 / 18).
- `mint` — mint a DERIVED figure sketch carrying the emote as its `motion` instead of a side GIF: `true` or `{ ref?, title? }`. The derived figure keeps the source body/garment/setup and is reusable in any world via the figures-map `figureRef`.

The target must be a stored kind `figure` sketch — a non-figure ref is refused.

## Worked example

Make a stored figure take a bold bow, viewed from the front.

```
{
  ref: 'reaching-study',
  spec: {
    emote: 'bow',
    intensity: 1.4,
    view: 'frontal'
  }
}
```

Returns `{ ok, ref, emote, url, gifUrl }` — the looping GIF renders as `emote-bow.gif` beside the sketch. Add `mint: true` to instead derive a new figure that carries the bow as its stored motion.

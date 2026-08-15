---
{
  "id": "stitch",
  "name": "Stitch motions into a film",
  "family": "motion",
  "entry": "stitch_motion",
  "summary": "Concatenate N already-forged motions (mo_… refs) end-to-end into ONE long-form, downloadable MP4/H.264 — the multi-clip sibling of a single forged clip.",
  "when": "Reach for this on 'stitch these together / combine the gifs / join the clips / make one long video / a movie out of these motions / concatenate the motions / play them back-to-back'."
}
---

STITCH plays N already-forged motions end-to-end as a single film. Forge the pieces first (each is a `forge_motion` clip), then pass them here in play order. A stitch is ITSELF a motion outcome (its own `mo_…` folder, filed under a Motion Project ops tag, listed in the same `/motion` gallery) — it just plays as a `<video>` and offers a download, where a single motion plays as a flipbook.

## Params

- `clips` (**required**, ≥2) — ordered list of clips. Each entry is a motion ref (`mo_…`) or `{ motion_ref, transition }`. Transition is CUT-only in this version (omit it).
- `fps` — output (constant) frame rate (default 24). Each clip is resampled to it, preserving its real-time duration.
- `width` — output width in px (default 720). Height is derived; clips letterbox into the canvas.
- `bg` — letterbox background colour (default `#000000`).
- `loop` — whether the `<video>` player loops (default true; the MP4 itself does not loop).
- `title` (**required**), `tag_ref` (optional existing Motion Project ops tag).

## Behavior + limits

SNAPSHOT-AT-BUILD: clip frames are baked into the MP4 now, so the stitch survives a source clip being deleted or re-forged afterward. Clips of different sizes are LETTERBOXED (never cropped/distorted). Transitions are CUT-ONLY (pure concatenation). MP4 is the only playable artifact (no GIF). For very long stitches the tool WARNS about build size/time but still proceeds — the operator owns the call.

Returns `{ motion_ref, tag_ref, stash_ref, url, mp4_path, clips, frames, duration_seconds, bytes, warning }`.

## Worked example

```
{ title: 'the whole tour', clips: ['mo_intro', 'mo_flythrough', 'mo_outro'], fps: 24 }
```

---
{
  "id": "stitch-film",
  "name": "Stitch clips into one long video",
  "summary": "Concatenate forged motions end-to-end into one downloadable MP4.",
  "when": "\"stitch these together\", \"combine the gifs\", \"join the clips\", \"make one long video\", \"a movie out of these motions\", \"play them back-to-back\", \"one downloadable file\"",
  "entry": "stitch_motion",
  "form": "motion"
}
---
→ `stitch_motion({ title, clips:[mo_…, mo_…] })`. Forge the pieces with `forge_motion` first, then pass their `mo_…` refs in play order. Outputs a long-form MP4 (broadly playable + downloadable) as its own Motion Project member at `/outcomes/<motion_ref>/`, played as `<video>`. Cut-only transitions, MP4-only; warns (never refuses) on very long builds. Snapshot-at-build: clip frames are baked in and survive source deletion; differently-sized clips letterbox into one canvas. Full family → `get_creative_toolset({ form: 'motion' })`.

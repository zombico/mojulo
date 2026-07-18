---
{
  "id": "motion-traversal",
  "name": "Replay a run through a world — prove it plays",
  "summary": "A deterministic, filmed run driving a world's live entities from a tick script.",
  "when": "\"walk through the dungeon and film it\", \"record a tour of the city\", \"show the character jumping the gap\", \"play the run back\", \"prove the level is beatable\", \"test-drive the world\"",
  "entry": "forge_motion",
  "form": "motion"
}
---
→ `forge_motion` TRAVERSAL: `subject.world_ref` + `shot.motion:'traversal'` + `shot.ticks` (one input snapshot per tick — {forward,strafe,jump,lookDX,…} at `shot.fps`). Drives the world's LIVE channels (controllable entities / physics / events) deterministically: same ticks → identical run. Yields the MP4/GIF of the run AND a per-tick probe stream (entity positions, HUD vars → `probes.json`, final probe in the result) to assert outcomes against. Camera: the world's camera entity (follow/FPV), or inject one via `shot.params.camera`. (Contrast: a camera flying over a self-animating world → the CAMERA family; walking to a named place without hand-authoring ticks → waypoints.) Full family → `get_creative_toolset({ form: 'motion' })`.

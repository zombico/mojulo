---
{
  "id": "world",
  "name": "World motion (camera moves + traversal over a three.js world)",
  "family": "motion",
  "entry": "forge_motion",
  "summary": "Move a camera over a traversable three.js World (city / hub / room / terrain / planet), baked via headless WebGL to GIF/MP4 — the same camera moves as the manji-tree family, plus a `traversal` input-script run that drives the world's live entities/physics.",
  "when": "Reach for this on 'fly through the city / a tour of the hub / walk through it / play the run back / record a tour / prove the dungeon is traversable / show the character doing X'."
}
---

WORLD motions apply the SAME camera motions (turntable / orbit / push_in / dolly_zoom / flythrough) to a traversable three.js World instead of a manji-tree, baked through headless WebGL. This is the door for the rich, occlusion-correct, fully-lit 3D scenes that only exist on the WebGL backend — a fractal-city skyline, a transportation hub, a furnished room, painted-landscape terrain, a planetary body, a floorplan house, a workbench object study, the operator-world.

## Subject

`subject.world_ref` — a stored sketch (`sk_…`) whose kind has a World form. The world's own first camera bookmark is the BASE shot the motion perturbs (a bounds-derived ¾ orbit if it ships none).

## Shot — camera

`shot.motion`: same names as the camera family. `shot.params`: same camera params, plus `{ width, height }` for the render canvas. A World is RASTER-NATIVE — there is NO durable flipbook SVG; it exports a looping `.gif` (preview) and, on `export:'mp4'|'both'`, a downloadable `.mp4`/H.264 (the better form for a smooth fly-through). Heavier than the SVG paths (headless Chromium + SwiftShader renders each frame), so keep frame counts modest.

## Shot — traversal (an input-script run)

`shot.motion: 'traversal'` drives the world's LIVE channels (controllable entities, physics, events) exactly as the interactive page would, instead of a camera path over passive time:
- `shot.ticks` — one normalized input snapshot per tick at `shot.fps` (`{ forward, strafe, turn, lift, jump, jumpHeld, lookDX, lookDY }`, each -1..1; `{}` = idle). The world advances one fixed dt per tick, so the same ticks reproduce the identical run.
- `shot.waypoints` — an alternative `[x,y]` route ('walk to X, then Y'); each leg is COMPILED into ticks against the world's live walk/platform rule (no pathfinding — a blocked leg reports `{ stuck:true, atTick }`). This is also the WALKABILITY AUDIT: compile entrance→exit and check the final probe / legs for arrival.
The run is DETERMINISTIC: ticks are stored in the recipe, the per-tick probe stream (entity positions, HUD vars, physics bodies) files as `probes.json` beside the video, and the final probe returns in the result — so a traversal is simultaneously the MP4 tour AND the assertion record ("the player reached the exit; score is 2"). Camera: a camera ENTITY in the world's manifest (follow/FPV) owns the view; `shot.params.camera` may inject one (`{ rule:'follow', target:'<entityId>', dist, height, … }`); otherwise the authored framing holds a static wide shot.

## Worked example

```
{ subject: { world_ref: 'sk_city' }, shot: { motion: 'orbit', params: { from: 0, to: 180 } }, export: 'mp4' }
```

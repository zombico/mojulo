---
{
  "id": "blender-film",
  "name": "Blender film (a world shot, lit and rendered in Blender)",
  "family": "motion",
  "entry": "forge_motion",
  "summary": "Hand a WORLD camera shot to Blender as a real, keyed camera over the world's Blender pack — light it once, upgrade the art, render a Cycles/EEVEE video on the exact frames the preview showed.",
  "when": "Reach for this on 'render it in Blender / make a real video of it / a high-quality render of the flythrough / Cycles / take the shot into Blender / upscale the motion / a film of the city'."
}
---

A world camera shot (`turntable` / `orbit` / `push_in` / `dolly_zoom` / `flythrough`) is a camera path over a static world. `export: 'blender'` writes that path as a Blender film pack beside the GIF preview, so the operator renders the SAME shot in Blender at any quality: light it, swap in better models, render Cycles — the framing and timing never move.

## Forge

```
forge_motion({ title, subject: { world_ref: 'sk_…' }, shot: { motion: 'orbit', params: { from: 0, to: 120 }, frames: 36 }, export: 'blender' })
```

The result's `blender` block names the folder (`<motion>/blender/`) and the one command. A `traversal` is an input script, not a camera path — refused. A re-forge (`recipe_ref` + `export: 'blender'`) writes a pack for an earlier shot.

## The pack

- the world's Blender pack (`model.glb`, `import_mojulo.py`, `README.md`, `ARTPASS-GUIDE.md`) — as `export_model({ format: 'blender' })` writes it;
- `shot.json` — the exact per-frame cameras the preview was rendered from (z-up world units, horizontal FOV, fps, frame size);
- `film_shots.py` — each shot as a camera keyed every frame, aimed by a Track To on a target empty (move the target to re-aim), FOV keyed only when the shot zooms, a timeline marker bound per shot so several shots play as cuts; `--verify` is the machine gate (every keyed frame read back against `shot.json` → `film-gate.json`); `--check 1,18,36` renders Workbench stills for the eyes gate;
- `atmosphere.json` + `film_light.py` — the world's lighting as its recipe declared it (the lit handoff the engine legs share): the sky preset (day; dawn/dusk with a low warm sun; night with a faint moon; interior with no sun), mojulo's street lamps — they arrive in `model.glb` as point lights — at street-lamp power, a ground fog that glows in its own colour like mojulo's when the recipe has `fog`, and the water surfaces the pack leaves out as a rippled, reflective mesh; plus a ground and AgX. Dials: `--preset`, `--lamp-gain`, `--fog-glow`, `--fog-scale`, `--sun*`. A scene with the operator's own light is left alone and a placed rig is kept, so the operator lights once (`--force` rebuilds);
- `film_render.py` — a PNG sequence (resumable) then H.264 in Blender's own sequencer: `--preset draft` (EEVEE) or `final` (Cycles, 128 samples, denoised, 200 %);
- `FILM.md` — the operator's page.

Blender runs on the operator's machine; the tool never launches it. The CLI does it in one go, and cuts several shots of ONE world into one film: `node scripts/export-blender-film.mjs --motion mo_a --motion mo_b --render draft` (any world motion ref — it rebuilds the pack from the recipe).

## What holds, what doesn't

- Holds: camera position, aim and FOV per frame, and the cuts. An art pass (new models, materials, light) changes the look, not the shot — a replacement that keeps its footprint and height keeps the composition.
- Resolution: keep the aspect and the framing holds. Frame rate: re-forge with more `frames` (and `fps`) instead of stretching keys.
- The set is static: traffic, walkers, fire and rig clips export at their rest pose; the camera is the only thing that moves.
- Not carried yet: night window glow, glow billboards and the cloud deck. The fog is a look-alike volume, not mojulo's ray-marched shader.
- Nothing checks a camera path against geometry: a `push_in` with a small `end_scale` can end inside a building. Read the GIF before a long render.

## Fork: preview, film, or stitch

A quick look or a shareable clip → `export: 'gif' | 'mp4'`. A film of mojulo's own render → `stitch_motion`. The shot rendered with real light and upgraded art → `export: 'blender'`.

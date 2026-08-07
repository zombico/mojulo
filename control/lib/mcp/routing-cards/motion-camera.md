---
{
  "id": "motion-camera",
  "name": "Make a visual move — camera motion",
  "summary": "Animate a static subject: turntable, orbit, push-in, dolly-zoom, flythrough.",
  "when": "\"animate it\", \"make it move\", \"turn it into a gif\", \"spin it\", \"a turntable\", \"fly through\", \"fly between\", \"zoom in on\", \"orbit it\"",
  "entry": "forge_motion",
  "form": "motion"
}
---
→ `forge_motion` CAMERA family over a manji-tree subject (stored `sk_…` sketch or inline): `turntable` / `orbit` / `push_in` / `dolly_zoom` / `flythrough`. The same camera motions run over a traversable world via `subject.world_ref`, baked headless to .gif/.mp4. Chem / structure modeling: ball-and-stick = lathes (ball = dome-profile lathe, rod = constant-radius lathe; `style.fill:'vexar'` for lit solids); bonds = the `vajra` primitive; chirality / double-helix = `taiji` (signed `twist` = handedness) — interpenetrating subjects stay BAKED via this family, never the live turntable. (Contrast: "draw me X" → `create_sketch` — static; a SINGLE convex solid live → `create_solid_turntable`.) Full family → `get_creative_toolset({ form: 'motion' })`.

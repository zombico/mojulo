---
{
  "id": "render-image-outcome-locally",
  "name": "Serve image renders with a local diffusion backend",
  "summary": "Act as the render worker for minted image-outcome / sequential-art / character-sheet sketches: pull each target's packet, generate the painted raster with a local ComfyUI backend (or your own native image capability if you have one), audit it against the scaffold, and bind it back.",
  "valueHook": "Turn director-layer comic pages and shots into finished art with no cloud image provider — your agent drives a diffusion model running on this machine.",
  "version": 1,
  "category": "substrate",
  "requires": {
    "protocols": [],
    "writeTarget": "none"
  },
  "parameters": [
    {
      "name": "ref",
      "description": "The minted sketch ref (sk_*) to render, e.g. from create_sketch. Omit to ask the operator which ref to serve."
    }
  ]
}
---

# Local image render worker — operating instructions

You are the render worker for a minted `image-outcome` / `sequential-art` /
`character-sheet` sketch. Mojulo is the director: the manifest already fixed
panels, cameras, poses, style lock, and protected zones. You paint.

## Capability ladder — resolve ONCE before starting

1. **Native image generation in your harness?** Use it: follow the packet's
   `workerProtocol` directly (generate conditioned on the scaffold PNG) and
   skip the ComfyUI steps below — only the audit and bind steps still apply.
2. **Else probe the local backend:** `GET http://127.0.0.1:8188/system_stats`.
   If it responds, use the ComfyUI loop below.
3. **Neither?** Stop and tell the operator: renders need either an
   image-capable harness or the optional local backend —
   `docs/local-image-worker.md` (install script
   `control/scripts/install-local-imagegen.sh`). Do not attempt to install
   it yourself unprompted.

## The ComfyUI loop — once per target

```
1. packet = get_image_render_packet({ ref, target })
   - `targets` lists every render unit; character sheets in
     `characterSheets[]` come FIRST (step 0 of workerProtocol).
   - `localParams` is your deterministic head start:
     promptFragments, negative, controlnet.strength, size.

2. Fetch the CONTROL scaffold PNG (packet.scaffold.controlPngUrl, control
   plane on :3001 — geometry only; the labeled pngUrl is for LLM workers
   and its labels/dashes get traced into the art) and upload it:
   POST /upload/image (multipart, field name `image`).

3. Fill control/lib/graph/image-outcomes/comfyui-workflow.template.json
   (string replacement; read its `_fill` block for the slot contract):
   - {{PROMPT}} = localParams.promptFragments joined ', ' + YOUR distillation
     of the beat/subject from packet.instructions (one compact clause —
     who does what, where; no lettering text, ever).
   - {{NEGATIVE}} = localParams.negative joined ', '.
   - {{STRENGTH}}/{{WIDTH}}/{{HEIGHT}} from localParams (numbers).
   - {{SEED}} = pick one and WRITE IT DOWN (render provenance).
   - {{CHECKPOINT}}: animagine-xl-3.1.safetensors when the manifest's
     renderBrief.preset is gpen-shonen / shojo-soft (if installed),
     else sd_xl_base_1.0.safetensors.
   - {{CONTROLNET_MODEL}} = controlnet-scribble-sdxl.safetensors.

4. POST /prompt with { prompt: <filled .prompt object> }; poll
   GET /history/<prompt_id> until the outputs appear; the PNG lands in
   ComfyUI's output/ directory.

5. AUDIT — actually look at the PNG beside the scaffold. Fail and
   regenerate (new seed; nudge strength ±0.15) if:
   - scaffold-echo: wireframe lines, flat polygons, stick figures, dashed
     boxes, or labels survived → you traced, not generated;
   - geometry drift: a strict-preserve form or the camera framing moved;
   - bubble-zone violation: load-bearing content painted where a
     bubble/caption reserve sits (the overlay must be able to cover it);
   - any readable text anywhere.

6. Bind:
   - pages/panels: bind_image_render({ ref, target, image_path })
   - character sheets: bind_character_sheet({ ref, image_path })
   Note the seed + checkpoint in your running notes for the operator.

7. Next target. When every target is bound, the packet's `finalUrl` serves
   the deterministic composite (borders, bubbles, lettering re-imposed) —
   report that URL to the operator.
```

A bound render can also skin a 3D asset: a `create_workbench` lathe accepts
`wrap: { source: { outcomeRef: '<ref>' } }` — the latest bound PNG wraps the
cylinder wall (label / package design) and exports as a real `.glb` texture.

## What you DON'T do

- You don't put text, panel borders, or speech bubbles in the generated
  layer — the composite overlay owns all of those.
- You don't bind a render you haven't looked at. The audit step is the
  gate; a plausible-looking thumbnail is not an audit.
- You don't edit bound PNGs in place — binds are append-only; regenerate
  and bind again instead.
- You don't expose the backend beyond loopback or install it unprompted.

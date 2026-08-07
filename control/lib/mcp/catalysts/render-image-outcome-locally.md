---
{
  "id": "render-image-outcome-locally",
  "name": "Serve image renders with a local diffusion backend",
  "summary": "Act as the render worker for minted image-outcome / sequential-art / character-sheet sketches: pull each target's packet, generate the painted raster with your own native image capability or the local ComfyUI backend (Qwen-Image-Edit instruction rung first, SDXL/ControlNet fallback), audit it against the scaffold, and bind it back.",
  "valueHook": "Turn director-layer comic pages and shots into finished art with no cloud image provider — your agent instructs an edit model running on this machine and looks at what comes back.",
  "version": 2,
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
   If it responds, use the **Qwen loop** below — it is the same worker shape
   as rung 1 (image in + instruction in → painted image out), just over
   loopback HTTP. Fall back to the SDXL loop only if the Qwen weights are
   missing (the fill step will error with a missing-model message).
3. **Neither?** Stop and tell the operator: renders need either an
   image-capable harness or the optional local backend —
   `docs/local-image-worker.md` (install script
   `control/scripts/install-local-imagegen.sh`). Do not attempt to install
   it yourself unprompted.

## The Qwen loop — once per target

Qwen-Image-Edit is an instruction-following edit model: you hand it the
scaffold as an image it actually reads, and you ask for preservation in
language. You steer with the positive instruction, not with strengths or
negatives.

```
1. packet = get_image_render_packet({ ref, target })
   - `targets` lists every render unit; character sheets in
     `characterSheets[]` come FIRST (step 0 of workerProtocol).
   - `localParams` is your deterministic head start: `edit`
     (instructionFragments + preserve tier), promptFragments, size.

2. Fetch the CONTROL scaffold PNG (packet.scaffold.controlPngUrl, control
   plane on :3001 — geometry only; Qwen renders text WELL, so the labeled
   pngUrl's labels would come back legible in the paint) and upload it:
   POST /upload/image (multipart, field name `image`).

3. Fill control/lib/graph/image-outcomes/comfyui-workflow-qwen.template.json
   (string replacement; read its `_fill` block for the slot contract):
   - {{PROMPT}} = localParams.edit.instructionFragments joined '. '
     + localParams.promptFragments joined ', ' + YOUR distillation of the
     beat/subject from packet.instructions (one compact clause — who does
     what, where; no lettering text, ever).
   - {{NEGATIVE}} = localParams.negative joined ', ' (inert at cfg 1.0;
     filled for graph validity).
   - {{WIDTH}}/{{HEIGHT}} from localParams.size (numbers).
   - {{SEED}} = pick one and WRITE IT DOWN (render provenance).
   - Identity: when the target has a bound character sheet, wire it as
     image2 (the template's `_fill.variants` shows how) and name the
     character in the instruction — this replaces the IP-Adapter rung.
   - Do NOT raise steps/cfg — 4 steps / cfg 1.0 / euler / simple is the
     Lightning LoRA's contract, and it makes regeneration cost seconds.

4. POST /prompt with { prompt: <filled .prompt object> }; poll
   GET /history/<prompt_id> until the outputs appear; the PNG lands in
   ComfyUI's output/ directory.

5. AUDIT — actually look at the PNG beside the scaffold. Fail and
   regenerate (new seed; sharpen the instruction — that is your knob) if:
   - scaffold-echo, edit-model edition: the diagram LANGUAGE survived
     (wireframe lines, flat polygons, dashed boxes, label text) — an edit
     model preserves what you didn't tell it to replace, so strengthen the
     repaint clause;
   - geometry drift: a strict-preserve form or the camera framing moved —
     strengthen the keep clause;
   - bubble-zone violation: load-bearing content painted where a
     bubble/caption reserve sits (the overlay must be able to cover it);
   - any readable text anywhere.

6. Bind:
   - pages/panels: bind_image_render({ ref, target, image_path })
   - character sheets: bind_character_sheet({ ref, image_path })
   Note the seed + model in your running notes for the operator.

7. Next target. When every target is bound, the packet's `finalUrl` serves
   the deterministic composite (borders, bubbles, lettering re-imposed) —
   report that URL to the operator.
```

## The SDXL fallback loop — only when the Qwen weights are absent

Same shape, different conditioning: fill
control/lib/graph/image-outcomes/comfyui-workflow.template.json instead —
{{PROMPT}}/{{NEGATIVE}} as above (no edit instructions — SDXL cannot follow
them), {{STRENGTH}} = localParams.controlnet.strength (nudge ±0.15 after a
drifted or over-traced result), {{CHECKPOINT}} = animagine-xl-3.1.safetensors
when renderBrief.preset is gpen-shonen / shojo-soft (if installed) else
sd_xl_base_1.0.safetensors, {{CONTROLNET_MODEL}} =
controlnet-scribble-sdxl.safetensors. Expect ~60–90s per generation and
weaker pose fidelity; the audit gate is identical.

A bound render can also skin a 3D asset: a `create_workbench` lathe accepts
`wrap: { source: { outcomeRef: '<ref>' } }` — the latest bound PNG wraps the
cylinder wall (label / package design) and exports as a real `.glb` texture.

## Also: pixel-art intake (paint → quantize, don't hand-draw)

The same painted PNG is the SOURCE for pixel-art assets — a sprite, a dialogue
portrait, a 16/32-bit cutscene face. Prefer this over hand-authoring pixel
cells: a model paint carries line fidelity a hand grid rarely matches. After
you have the PNG (a pure-dream text-to-image for a fresh subject, or a scaffold
edit to preserve a pose/identity), quantize it into the cell register with
`control/lib/graph/pixelizer/quantize.js` — `quantizeRgba(rgba, w, h, { grid,
budget })` bakes it to cells (`32bit` = 61 colors, `16bit` = 15), and
`diffRasters` / `bakeActor` extract blink/mouth sub-cels from meru-locked
variant renders for animation. Mount the raster in a `cutscene.js` recipe. The
recipe stays re-derivable from the archived PNG — carry the source sha + seed
as provenance, same as any bound render. (Routing card: `pixel-art`.)

## What you DON'T do

- You don't put text, panel borders, or speech bubbles in the generated
  layer — the composite overlay owns all of those.
- You don't bind a render you haven't looked at. The audit step is the
  gate; a plausible-looking thumbnail is not an audit.
- You don't edit bound PNGs in place — binds are append-only; regenerate
  and bind again instead.
- You don't expose the backend beyond loopback or install it unprompted.

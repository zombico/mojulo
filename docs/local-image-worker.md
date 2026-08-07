# Local Image Worker (optional)

An **optional** local image backend for the image-outcomes render seam
(`get_image_render_packet` → `bind_image_render` / `bind_character_sheet`).
Design + build log: [control/lib/graph/image-outcomes/local-render-worker.plan.md](../control/lib/graph/image-outcomes/local-render-worker.plan.md).

**Who needs this:** nobody by default. The renderer is a pluggable worker —
if the operator's driving agent has native image generation (Codex, an
image-capable ChatGPT plan), it serves renders directly and this page is
irrelevant. Install the local backend only when the driving agent has no
image capability of its own. Both worker shapes can coexist; renders record
their `source`.

**The shape (Ollama-like):** ComfyUI is a separate process on the host with
its own install, its own model store, and a loopback HTTP port (`:8188`).
Mojulo never starts it, checks for it, or depends on it — the driving agent
is the only bridge: it pulls the packet from mojulo's MCP, POSTs a job to
ComfyUI, and hands the PNG back to mojulo via the bind tools.

**The model (Qwen rung, primary since 2026-07-19):**
**Qwen-Image-Edit-2511** + the Lightning 4-step LoRA, with **Qwen2.5-VL-7B**
as the text encoder. This is the same *class* of worker as an image-capable
LLM harness — image(s) in + a natural-language instruction in → a painted
image out, structure preserved because the VL encoder understood it. The
driving agent steers by sharpening the instruction, not by tuning
ControlNet strengths; the local and native rungs become one protocol over
two transports. The previous SDXL/ControlNet/IP-Adapter stack remains as a
fallback rung (see below).

## Install

```bash
control/scripts/install-local-imagegen.sh                # ~31GB: ComfyUI + Qwen-Image-Edit-2511 fp8 + Qwen2.5-VL encoder + VAE + Lightning LoRA
control/scripts/install-local-imagegen.sh --gguf         # + the Q6_K GGUF quant (~17GB) for lower-RAM hosts (ComfyUI-GGUF node pack)
control/scripts/install-local-imagegen.sh --sdxl         # + the legacy SDXL rung (~15GB): SDXL base + scribble/openpose ControlNets + IP-Adapter
control/scripts/install-local-imagegen.sh --anime        # + Animagine XL 3.1 (~6.8GB) for the SDXL manga presets (implies you also want --sdxl)
control/scripts/install-local-imagegen.sh --skip-models  # clone + venv only
```

Then start it (loopback only — ComfyUI has no auth layer):

```bash
cd ~/mojulo-imagegen/ComfyUI && source venv/bin/activate
python main.py --listen 127.0.0.1 --port 8188
```

Verify: `curl -s http://127.0.0.1:8188/system_stats`.

The download URLs in the script are pinned Hugging Face paths; if one 404s
upstream, fix the pin in the script rather than switching to a floating
"latest" — pinned weights are the reproducibility anchor.

## How the worker drives it

The capability ladder and step-by-step loop live in the
`render-image-outcome-locally` catalyst
([control/lib/mcp/catalysts/render-image-outcome-locally.md](../control/lib/mcp/catalysts/render-image-outcome-locally.md)).
In short, per render target:

1. `get_image_render_packet({ ref, target })` — returns the worker brief,
   scaffold URLs, and `localParams`: deterministic prompt fragments, pixel
   size, and the `edit` brief (a preserve tier resolved to instruction
   language), built by
   [local-render-params.js](../control/lib/graph/image-outcomes/local-render-params.js).
2. Fetch the **control** scaffold PNG (`scaffold.controlPngUrl` — geometry
   only; Qwen renders text *well*, so the labeled default's labels would
   come back legible in the paint) and upload it to ComfyUI
   (`POST /upload/image`).
3. Fill [comfyui-workflow-qwen.template.json](../control/lib/graph/image-outcomes/comfyui-workflow-qwen.template.json)
   (string-replace the `{{SLOTS}}`; see its `_fill` block): the prompt is
   `edit.instructionFragments` + the style fragments + the agent's own
   distillation of the panel beat/subject. Keep the sampler contract as-is
   (4 steps, cfg 1.0 — the Lightning LoRA's terms; the negative is inert).
4. `POST /prompt`, poll `GET /history/<prompt_id>` until done, read the PNG
   from ComfyUI's `output/` directory.
5. **Look at the result** (the driving agent reads the PNG) and check the
   failure modes against the scaffold: surviving diagram language (an edit
   model preserves what you didn't tell it to replace), geometry drift on
   strict forms, painted content in bubble zones, any readable text. On
   failure, regenerate with a new seed and a *sharper instruction* — with
   an edit model, the instruction is the knob.
6. `bind_image_render { ref, target, image_path }` (or
   `bind_character_sheet` for sheets). Record the seed in your notes — the
   recipe stays timeless; seeds are render-event provenance.

## Notes

- **Character identity:** hand the bound character sheet to
  `TextEncodeQwenImageEditPlus` as a second reference image (`image2` — the
  template's `_fill.variants` shows the wiring) and name the character in
  the instruction. This replaces the SDXL IP-Adapter rig for the Qwen rung.
- **Pure dreams (no scaffold):** for design references — the
  shape-from-dream / vehicle-designer DREAM step — drop the image inputs
  and let the prompt stand alone; the graph degrades to the proven
  text-to-image pilot shape (see `_fill.variants`).
- **Performance (M1-class, 64GB):** a 4-step 1MP generation is roughly a
  minute of wall-clock — comparable to SDXL per image, but generations land
  far closer to the ask, so the audit loop converges in fewer tries. The
  first job after startup is much slower (a ~20GB model load).
- **Low RAM:** use the Q6_K GGUF (`--gguf`, swap the loader node per the
  template's `_fill.variants`).

## The SDXL fallback rung

The pre-2026-07-19 stack (SDXL base + scribble/openpose ControlNets +
IP-Adapter + optional Animagine XL 3.1, `--sdxl` / `--anime`) is kept as a
fallback and for the surfaces not yet re-proven on Qwen:

- The **keyframe-animation cel loop** conditions on OpenPose skeletons the
  figure rig emits directly, plus IP-Adapter identity (the
  compile/edit template
  [comfyui-workflow-compile.template.json](../control/lib/graph/image-outcomes/comfyui-workflow-compile.template.json),
  [animation-cheats.plan.md](../control/lib/graph/image-outcomes/animation-cheats.plan.md)).
  `localParams` still emits `controlnet` + `negative` for this rung, and
  the old workflow template
  ([comfyui-workflow.template.json](../control/lib/graph/image-outcomes/comfyui-workflow.template.json))
  remains valid — expect ~60–90s per 28-step image and the ~0.5–0.6
  strength window documented in the plan file.
- **MPS quirks:** if generation dies with an MPS out-of-memory on large
  sizes, reduce `localParams.size` proportionally (keep multiples of 64).

# Local Image Worker (optional)

An **optional** local diffusion backend for the image-outcomes render seam
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

## Install

```bash
control/scripts/install-local-imagegen.sh                # ~16GB: ComfyUI + SDXL base + scribble/openpose ControlNets + IP-Adapter
control/scripts/install-local-imagegen.sh --anime        # + Animagine XL 3.1 for the manga presets
control/scripts/install-local-imagegen.sh --skip-models  # clone + venv only
```

The script also clones the `ComfyUI_IPAdapter_plus` custom node pack
(IP-Adapter nodes are not in ComfyUI core) — restart the backend after a
first install or an upgrade so the nodes register.

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
   scaffold URLs, and `localParams`: deterministic prompt fragments,
   negatives, ControlNet strength (derived from preserve levels), and pixel
   size (derived from viewBox/panel bounds), built by
   [local-render-params.js](../control/lib/graph/image-outcomes/local-render-params.js).
2. Fetch the **control** scaffold PNG (`scaffold.controlPngUrl` —
   geometry-only; the labeled default is for LLM workers, and a ControlNet
   traces its labels/dashed boxes into the art) and upload it to ComfyUI
   (`POST /upload/image`).
3. Fill [comfyui-workflow.template.json](../control/lib/graph/image-outcomes/comfyui-workflow.template.json)
   (string-replace the `{{SLOTS}}`; see its `_fill` block), appending the
   agent's own distillation of the panel beat/subject to the prompt
   fragments. Choose the checkpoint by style preset (Animagine for
   `gpen-shonen`/`shojo-soft`, SDXL base otherwise).
4. `POST /prompt`, poll `GET /history/<prompt_id>` until done, read the PNG
   from ComfyUI's `output/` directory.
5. **Look at the result** (the driving agent reads the PNG) and check the
   three failure modes against the scaffold: scaffold-echo (wireframe
   language survived), geometry drift on strict forms, painted content in
   bubble zones. Regenerate (new seed, nudged strength) on failure.
6. `bind_image_render { ref, target, image_path }` (or
   `bind_character_sheet` for sheets). Record the seed in your notes — the
   recipe stays timeless; seeds are render-event provenance.

## Notes

- **Character identity:** IP-Adapter conditioning on the bound character
  sheet (`ip-adapter-plus_sdxl_vit-h` + the CLIP-ViT-H encoder, via the
  IPAdapter-plus node pack — all fetched by the install script). Used by the
  compile/edit template for the animation-cheats parts bank
  ([animation-cheats.plan.md](../control/lib/graph/image-outcomes/animation-cheats.plan.md)).
- **Pose:** the OpenPose ControlNet conditions on skeleton images the figure
  rig emits directly (declared-coordinate contracts) — prefer it over
  scribble for any target with a posed figure.
- **Performance (M1-class, 64GB):** expect roughly 30–60s per 1024px SDXL
  image; the first job after startup is slower (model load).
- **MPS quirks:** if generation dies with an MPS out-of-memory on large
  sizes, reduce `localParams.size` proportionally (keep multiples of 64).

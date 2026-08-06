#!/usr/bin/env bash
#
# Optional install: the local image-generation backend for the image-outcomes
# render worker (docs/local-image-worker.md, local-render-worker.plan.md L0).
#
# NOT part of any mojulo install path — run it only if your driving agent has
# no native image generation and you want renders served locally. Operators
# on Codex / image-capable ChatGPT plans never need this. Nothing lands in
# this repo; ComfyUI and its model weights live under INSTALL_DIR.
#
# Usage:
#   ./install-local-imagegen.sh [--dir <path>] [--gguf] [--sdxl] [--anime] [--skip-models]
#
#   --dir          install root (default: ~/mojulo-imagegen)
#   --gguf         also fetch the Q6_K GGUF quant of the Qwen edit model
#                  (~17GB) for lower-RAM hosts (loads via ComfyUI-GGUF)
#   --sdxl         also fetch the legacy SDXL rung (~15GB): SDXL base +
#                  scribble/openpose ControlNets + IP-Adapter (the
#                  keyframe-cel compile template still runs on it)
#   --anime        also fetch the Animagine XL 3.1 checkpoint (~6.8GB;
#                  SDXL manga presets gpen-shonen / shojo-soft — pair it
#                  with --sdxl, it is an SDXL-family checkpoint)
#   --skip-models  clone + venv only; fetch weights yourself
#
# The default fetch set is the Qwen rung (local-render-worker.plan.md L4):
# Qwen-Image-Edit-2511 fp8 + Qwen2.5-VL-7B text encoder + VAE + the
# Lightning 4-step LoRA — ~31GB. Downloads are pinned Hugging Face URLs,
# fetched with curl -L -C - (safe to re-run; resumes partial downloads).

set -euo pipefail

INSTALL_DIR="$HOME/mojulo-imagegen"
FETCH_GGUF=0
FETCH_SDXL=0
FETCH_ANIME=0
SKIP_MODELS=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir) INSTALL_DIR="$2"; shift 2 ;;
    --gguf) FETCH_GGUF=1; shift ;;
    --sdxl) FETCH_SDXL=1; shift ;;
    --anime) FETCH_ANIME=1; shift ;;
    --skip-models) SKIP_MODELS=1; shift ;;
    *) echo "unknown flag: $1" >&2; exit 1 ;;
  esac
done

COMFY_DIR="$INSTALL_DIR/ComfyUI"

echo "== local imagegen backend -> $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

if [[ ! -d "$COMFY_DIR" ]]; then
  git clone https://github.com/comfyanonymous/ComfyUI.git "$COMFY_DIR"
else
  echo "ComfyUI already cloned; skipping"
fi

cd "$COMFY_DIR"
if [[ ! -d venv ]]; then
  python3 -m venv venv
fi
# shellcheck disable=SC1091
source venv/bin/activate
pip install --upgrade pip
# On Apple Silicon the default torch wheel ships MPS support.
pip install torch torchvision torchaudio
pip install -r requirements.txt

# IP-Adapter nodes are not in ComfyUI core — the standard node pack is
# cubiq's ComfyUI_IPAdapter_plus (identity conditioning for the SDXL rung's
# parts bank / compile pass, animation-cheats.plan.md). Cloned like ComfyUI
# itself; restart the backend after first install so the nodes register.
IPADAPTER_NODE_DIR="$COMFY_DIR/custom_nodes/ComfyUI_IPAdapter_plus"
if [[ ! -d "$IPADAPTER_NODE_DIR" ]]; then
  git clone https://github.com/cubiq/ComfyUI_IPAdapter_plus.git "$IPADAPTER_NODE_DIR"
else
  echo "ComfyUI_IPAdapter_plus already cloned; skipping"
fi

# GGUF loader nodes (UnetLoaderGGUF) for the quantized Qwen edit model —
# a small pack, cloned unconditionally so --gguf weights load without a
# second install pass.
GGUF_NODE_DIR="$COMFY_DIR/custom_nodes/ComfyUI-GGUF"
if [[ ! -d "$GGUF_NODE_DIR" ]]; then
  git clone https://github.com/city96/ComfyUI-GGUF.git "$GGUF_NODE_DIR"
else
  echo "ComfyUI-GGUF already cloned; skipping"
fi

if [[ "$SKIP_MODELS" -eq 0 ]]; then
  mkdir -p models/checkpoints models/controlnet models/ipadapter models/clip_vision \
           models/diffusion_models models/text_encoders models/vae models/loras

  fetch() { # fetch <url> <dest>
    if [[ -f "$2" && ! -f "$2.part" ]]; then echo "have $(basename "$2"); skipping"; return; fi
    echo "fetching $(basename "$2")"
    curl -L -C - --fail -o "$2.part" "$1"
    mv "$2.part" "$2"
  }

  # ---- Qwen rung (default): the instruction-following edit model ----

  # Qwen-Image-Edit-2511, fp8 mixed — the edit model itself (~20.5GB).
  fetch \
    "https://huggingface.co/Comfy-Org/Qwen-Image-Edit_ComfyUI/resolve/main/split_files/diffusion_models/qwen_image_edit_2511_fp8mixed.safetensors" \
    "models/diffusion_models/qwen_image_edit_2511_fp8mixed.safetensors"

  # Qwen2.5-VL-7B text encoder — the VL half that reads the scaffold (~9GB).
  fetch \
    "https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors" \
    "models/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors"

  # Qwen image VAE (~0.25GB).
  fetch \
    "https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/vae/qwen_image_vae.safetensors" \
    "models/vae/qwen_image_vae.safetensors"

  # Lightning 4-step LoRA — the sampler contract in the qwen workflow
  # template (4 steps / cfg 1.0) is this LoRA's (~0.9GB).
  fetch \
    "https://huggingface.co/lightx2v/Qwen-Image-Edit-2511-Lightning/resolve/main/Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors" \
    "models/loras/Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors"

  if [[ "$FETCH_GGUF" -eq 1 ]]; then
    # Q6_K quant of the edit model for lower-RAM hosts (~17GB) — swap the
    # loader node per the template's _fill.variants.
    fetch \
      "https://huggingface.co/unsloth/Qwen-Image-Edit-2511-GGUF/resolve/main/qwen-image-edit-2511-Q6_K.gguf" \
      "models/diffusion_models/qwen-image-edit-2511-Q6_K.gguf"
  fi

  # ---- SDXL rung (legacy fallback, --sdxl) ----

  if [[ "$FETCH_SDXL" -eq 1 ]]; then
    # SDXL base — the general checkpoint (~6.9GB).
    fetch \
      "https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors" \
      "models/checkpoints/sd_xl_base_1.0.safetensors"

    # Scribble ControlNet for SDXL — the scaffold-conditioning model (~2.5GB).
    fetch \
      "https://huggingface.co/xinsir/controlnet-scribble-sdxl-1.0/resolve/main/diffusion_pytorch_model.safetensors" \
      "models/controlnet/controlnet-scribble-sdxl.safetensors"

    # OpenPose ControlNet for SDXL — pose conditioning from the rig's own
    # skeleton renders (animation-cheats.plan.md, declared-coordinate
    # contracts) (~2.5GB).
    fetch \
      "https://huggingface.co/xinsir/controlnet-openpose-sdxl-1.0/resolve/main/diffusion_pytorch_model.safetensors" \
      "models/controlnet/controlnet-openpose-sdxl.safetensors"

    # IP-Adapter (SDXL, plus variant) + its CLIP-ViT-H image encoder —
    # identity lock from a bound character sheet (~0.9GB + ~2.4GB).
    fetch \
      "https://huggingface.co/h94/IP-Adapter/resolve/main/sdxl_models/ip-adapter-plus_sdxl_vit-h.safetensors" \
      "models/ipadapter/ip-adapter-plus_sdxl_vit-h.safetensors"
    fetch \
      "https://huggingface.co/h94/IP-Adapter/resolve/main/models/image_encoder/model.safetensors" \
      "models/clip_vision/CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors"
  fi

  if [[ "$FETCH_ANIME" -eq 1 ]]; then
    # Animagine XL 3.1 — the SDXL manga/anime register (~6.8GB).
    fetch \
      "https://huggingface.co/cagliostrolab/animagine-xl-3.1/resolve/main/animagine-xl-3.1.safetensors" \
      "models/checkpoints/animagine-xl-3.1.safetensors"
  fi
fi

cat <<EOF

== done. Start the backend with:

  cd "$COMFY_DIR" && source venv/bin/activate && python main.py --listen 127.0.0.1 --port 8188

Then verify:  curl -s http://127.0.0.1:8188/system_stats | head -c 200

The worker flow is documented in docs/local-image-worker.md. Loopback only —
do not bind ComfyUI to a public interface; it has no auth layer.
EOF

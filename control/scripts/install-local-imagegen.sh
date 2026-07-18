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
#   ./install-local-imagegen.sh [--dir <path>] [--anime] [--skip-models]
#
#   --dir          install root (default: ~/mojulo-imagegen)
#   --anime        also fetch the Animagine XL 3.1 checkpoint (manga/anime
#                  presets: gpen-shonen, shojo-soft) — ~6.8GB extra
#   --skip-models  clone + venv only; fetch weights yourself
#
# Downloads are pinned Hugging Face URLs, fetched with curl -L -C - (safe to
# re-run; resumes partial downloads). Expect ~10GB total on the default path.

set -euo pipefail

INSTALL_DIR="$HOME/mojulo-imagegen"
FETCH_ANIME=0
SKIP_MODELS=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir) INSTALL_DIR="$2"; shift 2 ;;
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
# cubiq's ComfyUI_IPAdapter_plus (identity conditioning for the parts bank /
# compile pass, animation-cheats.plan.md). Cloned like ComfyUI itself;
# restart the backend after first install so the nodes register.
IPADAPTER_NODE_DIR="$COMFY_DIR/custom_nodes/ComfyUI_IPAdapter_plus"
if [[ ! -d "$IPADAPTER_NODE_DIR" ]]; then
  git clone https://github.com/cubiq/ComfyUI_IPAdapter_plus.git "$IPADAPTER_NODE_DIR"
else
  echo "ComfyUI_IPAdapter_plus already cloned; skipping"
fi

if [[ "$SKIP_MODELS" -eq 0 ]]; then
  mkdir -p models/checkpoints models/controlnet models/ipadapter models/clip_vision

  fetch() { # fetch <url> <dest>
    if [[ -f "$2" && ! -f "$2.part" ]]; then echo "have $(basename "$2"); skipping"; return; fi
    echo "fetching $(basename "$2")"
    curl -L -C - --fail -o "$2.part" "$1"
    mv "$2.part" "$2"
  }

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

  if [[ "$FETCH_ANIME" -eq 1 ]]; then
    # Animagine XL 3.1 — the manga/anime register (~6.8GB).
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

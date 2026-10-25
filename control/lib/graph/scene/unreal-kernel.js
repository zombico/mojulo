/**
 * unreal-kernel.js — the mojulo-unreal kernel (export-unreal U1): a pack-carried CODE PLUGIN (`MojuloKernel/`, copied to
 * `<Project>/Plugins/`) that the operator's project compiles itself — the sibling of Unity's `Runtime/*.cs` and the
 * Godot `godot-kernel/`. The kernel-language decision (U1): C++ source, NOT Python-built Blueprint assets — Blueprints
 * are opaque binary .uassets (non-diffable, non-deterministic); a plugin is deterministic text, name-independent (no
 * .uproject Modules edit, no Target.cs), and drops into a Blueprint-template project (UE prompts to compile on open).
 *
 * The plugin's files live in `unreal-kernel/MojuloKernel/` and ship as they are, as `godot-kernel/` does:
 *   MojuloScore.*        score/game.json readers + the C++ P()
 *   MojuloWalker.*       the first-person walker (Unity's Runtime/MojuloWalker.cs)
 *   MojuloGameMode.*     the level interpreter (Unity's MojuloLevel.cs + MojuloGame.cs), the figures' clips
 *   MojuloMenuGameMode.* the menu (+ its HUD)
 *   MojuloHUD.*          the canvas HUD
 * Progression: `Saved/mojulo.completed`, |-joined refs — the PlayerPrefs key's semantics, a plain file instead of a
 * platform registry.
 *
 * TWO implementations of the frame map exist on the Unreal leg (python for import-time actors, C++ for runtime
 * mechanics) — they MUST stay identical: P(v) = (x*100, -y*100, z*100). The gate's frame_landmark pins python's; the
 * kernel's spawn/zone positions ride the same numbers.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

// cwd-anchored (the control process and the CLI both run from control/) — lib files may be bundled, so
// import.meta-relative paths are not reliable (godot-pack.js reads godot-kernel/ the same way).
const kernelDir = () => path.join(process.cwd(), 'lib', 'graph', 'scene', 'unreal-kernel');

const KERNEL_ROOT = 'MojuloKernel';
const SRC = `${KERNEL_ROOT}/Source/MojuloKernel`;

// the plugin's files, in the order a pack lists them
const FILES = [
  `${KERNEL_ROOT}/MojuloKernel.uplugin`,
  `${SRC}/MojuloKernel.Build.cs`,
  `${SRC}/Private/MojuloKernelModule.cpp`,
  `${SRC}/Public/MojuloScore.h`,
  `${SRC}/Private/MojuloScore.cpp`,
  `${SRC}/Public/MojuloWalker.h`,
  `${SRC}/Private/MojuloWalker.cpp`,
  `${SRC}/Public/MojuloGameMode.h`,
  `${SRC}/Private/MojuloGameMode.cpp`,
  `${SRC}/Public/MojuloHUD.h`,
  `${SRC}/Private/MojuloHUD.cpp`,
  `${SRC}/Public/MojuloMenuGameMode.h`,
  `${SRC}/Private/MojuloMenuGameMode.cpp`,
];

/** The mojulo-unreal kernel as pack files. Copied by the operator (or the driver) to `<Project>/Plugins/MojuloKernel/`;
 * the project compiles it. */
export function emitUnrealKernel() {
  return FILES.map((file) => ({ file, text: readFileSync(path.join(kernelDir(), file), 'utf8') }));
}

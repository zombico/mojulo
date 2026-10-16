/**
 * Where this host's optional workers are: the programs mojulo runs itself when they are present (Blender, Godot, Unity,
 * Unreal, Electron, a slicer, ffmpeg, a Chromium browser, OpenSCAD-in-WASM). One place for each search order, so the export
 * scripts and `version({ workers: true })` find the same binary. Absence degrades a loop, never breaks one: each entry
 * says what still happens without it.
 *
 * `found` means a file is at that path; the script that uses it still runs its own check (a launch, `-version`).
 * Nothing here launches a program. Plain Node, no `@/` imports, so a script imports it without the loader.
 *
 * The generators an agent drives (an image model, an image-to-mesh service, a speech model) are not here: mojulo never
 * calls one. Their work arrives through render_handoff and bind_voice_sample.
 */
import { existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const hostWhich = (name) => {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [name], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.split(/\r?\n/)[0].trim() || null : null;
};
const hostReaddir = (dir) => { try { return readdirSync(dir); } catch { return []; } };
export const HOST = Object.freeze({ env: process.env, exists: existsSync, which: hostWhich, readdir: hostReaddir });

export const BLENDER_APP = '/Applications/Blender.app/Contents/MacOS/Blender';
export const GODOT_APP = '/Applications/Godot.app/Contents/MacOS/Godot';

/** $MOJULO_BLENDER, else the macOS app, else `blender` on PATH. */
export function findBlender({ env, exists, which } = HOST) {
  return env.MOJULO_BLENDER || (exists(BLENDER_APP) ? BLENDER_APP : which('blender'));
}

/** $MOJULO_GODOT, else the macOS app (null when it is not there). */
export function findGodot({ env, exists } = HOST) {
  if (env.MOJULO_GODOT) return env.MOJULO_GODOT;
  return exists(GODOT_APP) ? GODOT_APP : null;
}

/** $MOJULO_UNITY, else the newest editor under the Unity Hub. */
export function findUnity({ env, exists, readdir } = HOST) {
  if (env.MOJULO_UNITY) return env.MOJULO_UNITY;
  const hub = '/Applications/Unity/Hub/Editor';
  for (const v of readdir(hub).filter((d) => /^\d/.test(d)).sort().reverse()) {
    const bin = path.join(hub, v, 'Unity.app', 'Contents', 'MacOS', 'Unity');
    if (exists(bin)) return bin;
  }
  return null;
}

/** $MOJULO_UNREAL, else the newest UnrealEditor-Cmd under the Epic Games folder. */
export function findUnreal({ env, exists, readdir } = HOST) {
  if (env.MOJULO_UNREAL) return env.MOJULO_UNREAL;
  const hub = '/Users/Shared/Epic Games';
  for (const v of readdir(hub).filter((d) => /^UE_\d/.test(d)).sort().reverse()) {
    const bin = path.join(hub, v, 'Engine', 'Binaries', 'Mac', 'UnrealEditor-Cmd');
    if (exists(bin)) return bin;
  }
  return null;
}

/**
 * $MOJULO_ELECTRON, else the exported folder's own install (`npm install` in a desktop export), else `electron` on PATH.
 * mojulo never installs Electron: it is the exported folder's devDependency.
 */
export function findElectron({ env, exists, which } = HOST, { dir } = {}) {
  if (env.MOJULO_ELECTRON) return env.MOJULO_ELECTRON;
  const own = dir ? path.join(dir, 'node_modules', '.bin', process.platform === 'win32' ? 'electron.cmd' : 'electron') : null;
  return own && exists(own) ? own : which('electron');
}

/**
 * Every worker, `{ id, found, env, uses, without }`: the path found (or null), the variable that points at it, what
 * it runs, and what still happens without it. `slicer`, `ffmpeg` and `chromium` take their finders from the modules
 * that run them (passed in, so this file stays free of their imports).
 */
export function workersPresent({ host = HOST, findSlicer, chromiumCandidates = [], ffmpegCached = null } = {}) {
  const { env, exists, which } = host;
  const slicer = findSlicer ? findSlicer({ env, exists, which }) : null;
  let openscad = null;
  // a package directory up the tree from the working directory (entry points chdir to control/; an npx install hoists),
  // not a resolve: the package's exports refuse require(), and the Next bundle has no import.meta.resolve
  for (let dir = process.cwd(); !openscad; dir = path.dirname(dir)) {
    if (exists(path.join(dir, 'node_modules', 'openscad-wasm-prebuilt', 'package.json'))) openscad = 'in-process (openscad-wasm-prebuilt)';
    if (path.dirname(dir) === dir) break;
  }
  const chromium = (env.MOJULO_CHROMIUM && exists(env.MOJULO_CHROMIUM) ? env.MOJULO_CHROMIUM : null)
    || chromiumCandidates.find((p) => exists(p)) || null;
  const ffmpeg = (env.MOJULO_FFMPEG && exists(env.MOJULO_FFMPEG) ? env.MOJULO_FFMPEG : null)
    || which('ffmpeg') || (ffmpegCached && exists(ffmpegCached) ? ffmpegCached : null);
  return [
    { id: 'blender', found: findBlender(host), env: 'MOJULO_BLENDER', uses: 'the Blender pack gate, blender-bake (--fur), the GI bake, USD reads',
      without: 'the pack and its art-pass guide are still written; bakes and the gate skip' },
    { id: 'godot', found: findGodot(host), env: 'MOJULO_GODOT', uses: 'the headless Godot gate on an exported project',
      without: 'the project is still written; the gate skips' },
    { id: 'unity', found: findUnity(host), env: 'MOJULO_UNITY', uses: 'the advisory Unity import gate',
      without: 'the data pack and importer are still written' },
    { id: 'unreal', found: findUnreal(host), env: 'MOJULO_UNREAL', uses: 'the advisory Unreal import gate',
      without: 'the data pack and plugin are still written' },
    { id: 'electron', found: findElectron(host), env: 'MOJULO_ELECTRON', uses: 'the desktop app gate on an exported game (export_game target desktop, scripts/export-desktop.mjs)',
      without: 'the app folder is still written; the gate skips, or uses the folder\'s own install after npm install' },
    { id: 'slicer', found: slicer ? slicer.bin : null, env: 'MOJULO_SLICER', uses: 'slicing a print export (PrusaSlicer, SuperSlicer, OrcaSlicer, Bambu Studio)',
      without: 'the STL / 3MF and its print measure are still written; nothing is sliced' },
    { id: 'openscad', found: openscad, env: null, uses: 'meshing `scad` rows (an OpenSCAD program as the recipe)',
      without: 'a scad row cannot mesh; every other kind is unaffected' },
    { id: 'ffmpeg', found: ffmpeg, env: 'MOJULO_FFMPEG', uses: 'MP4 encodes of motion and world captures',
      without: 'GIF previews still encode; an MP4 fetches a pinned ffmpeg on first use (never under the Claude plugin)' },
    { id: 'chromium', found: chromium, env: 'MOJULO_CHROMIUM', uses: 'PNG bakes of CSS-3D scenes and world stills',
      without: 'an explicit render may fetch a pinned Chrome-for-Testing (never under the Claude plugin); the World page itself still opens' },
  ];
}

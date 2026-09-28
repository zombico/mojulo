/**
 * Resolve the mojulo home / data / models directories and seed the env vars
 * the rest of the control plane reads.
 *
 * Layered defaults:
 *   MOJULO_HOME       (default: ~/.mojulo)
 *   MOJULO_DATA_DIR   (default: $MOJULO_HOME/data)
 *   MOJULO_MODELS_DIR (default: $MOJULO_HOME/models)
 *
 * From those, sets — without overriding — the lower-level env vars the lib
 * code already honors:
 *   SQLITE_PATH         → $MOJULO_DATA_DIR/mojulo-lite.db
 *   STORAGE_ROOT        → $MOJULO_DATA_DIR/storage   (stash media)
 *   MOJULO_OUTCOMES_DIR → $MOJULO_DATA_DIR/outcomes   (export_model / export_game / cooks)
 *   MOJULO_EXPORTS_DIR  → $MOJULO_DATA_DIR/exports    (export_beats .wav)
 *   MOJULO_SCENE_PNG_DIR    → $MOJULO_DATA_DIR/scene-png     (baked gallery stills)
 *   MOJULO_TURNTABLE_DIR    → $MOJULO_DATA_DIR/turntable     (baked turntable strips)
 *   MOJULO_FIGURE_SPECS_DIR → $MOJULO_DATA_DIR/figure-specs  (draft figure specs, user state)
 *   MOJULO_CHROMIUM_DIR     → $MOJULO_HOME/chromium  (the lazily fetched Chrome for Testing)
 *   MOJULO_FFMPEG_DIR       → $MOJULO_HOME/ffmpeg    (the lazily fetched ffmpeg)
 *
 * All of these matter because their lib fallbacks are cwd-relative
 * (lib/outcomes-paths.js, lib/mcp/tools/exports-dir.js, chromium.js, ffmpeg.js,
 * sketch-png.js, turntable-bake.js, figure-spec-store.js) and every bin chdirs:
 * the stdio bin to the package root, the dashboard to .next/standalone. Left
 * unset, `export_model` wrote into node_modules/mojulo/data/outcomes/<ref>/
 * and the dashboard's /outcomes route read a different folder (the 2026-09-21
 * Grok sandbox report); under npx the browser and ffmpeg caches landed in the
 * _npx cache, so every new version fetched them again. The two binaries sit
 * beside recall/ and models/ rather than in data/, which stays the operator's
 * own state. Repo-dev `next dev` does not run this resolver and keeps its
 * control/data/ fallback.
 *
 * ARTIFACTS_DIR ($MOJULO_DATA_DIR/artifacts, the chatbot factory's bot zips) was seeded and
 * created here until the factory left in 3.0.0. An existing folder is left alone.
 *
 * Shared by [mcp-stdio.mjs](./mcp-stdio.mjs), [mcp-ui.mjs](./mcp-ui.mjs) and
 * [mcp-config.mjs](./mcp-config.mjs) so a fresh `~/.mojulo/` works for every bin.
 */

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

export function resolveMojuloPaths() {
  const home = process.env.MOJULO_HOME || path.join(os.homedir(), '.mojulo');
  const dataDir = process.env.MOJULO_DATA_DIR || path.join(home, 'data');
  const modelsDir = process.env.MOJULO_MODELS_DIR || path.join(home, 'models');

  process.env.MOJULO_HOME ??= home;
  process.env.MOJULO_DATA_DIR ??= dataDir;
  process.env.MOJULO_MODELS_DIR ??= modelsDir;
  process.env.SQLITE_PATH ??= path.join(dataDir, 'mojulo-lite.db');
  process.env.STORAGE_ROOT ??= path.join(dataDir, 'storage');
  process.env.MOJULO_OUTCOMES_DIR ??= path.join(dataDir, 'outcomes');
  process.env.MOJULO_EXPORTS_DIR ??= path.join(dataDir, 'exports');
  process.env.MOJULO_SCENE_PNG_DIR ??= path.join(dataDir, 'scene-png');
  process.env.MOJULO_TURNTABLE_DIR ??= path.join(dataDir, 'turntable');
  process.env.MOJULO_FIGURE_SPECS_DIR ??= path.join(dataDir, 'figure-specs');
  process.env.MOJULO_CHROMIUM_DIR ??= path.join(home, 'chromium');
  process.env.MOJULO_FFMPEG_DIR ??= path.join(home, 'ffmpeg');

  for (const dir of [home, dataDir, modelsDir, process.env.STORAGE_ROOT]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return {
    home,
    dataDir,
    modelsDir,
    dbPath: process.env.SQLITE_PATH,
    storageRoot: process.env.STORAGE_ROOT,
    outcomesDir: process.env.MOJULO_OUTCOMES_DIR,
    exportsDir: process.env.MOJULO_EXPORTS_DIR,
    scenePngDir: process.env.MOJULO_SCENE_PNG_DIR,
    turntableDir: process.env.MOJULO_TURNTABLE_DIR,
    figureSpecsDir: process.env.MOJULO_FIGURE_SPECS_DIR,
    chromiumDir: process.env.MOJULO_CHROMIUM_DIR,
    ffmpegDir: process.env.MOJULO_FFMPEG_DIR,
  };
}

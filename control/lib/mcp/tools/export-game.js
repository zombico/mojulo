/**
 * export_game — materialize a stored game as a SELF-CONTAINED folder
 * (game-publish.plan.md phase 2): the sharing seam for playable artifacts.
 *
 * The served form of a game is loopback-bound by design (`/api/sketches/<ref>/game`,
 * no-store, levels iframed off live routes). This tool bakes the SAME recipes into a
 * portable folder under `data/outcomes/<game_ref>/` — shell + inline levels + WAV
 * score + the sovereign recipes + a provenance README — so the existing `/outcomes/`
 * route doubles as a local preview of exactly what ships, and the folder itself is
 * `git init && gh repo create` away from a public GitHub-Pages playable URL.
 *
 * Determinism: same rows → same folder. Levels re-emit through the identical
 * resolveWorldScene → emitThreeWorld path the /world route runs for
 * `?walk=1&hud=0&download=1` (three.js + geometry inlined as data: modules — zero
 * external fetches); WAVs come from renderBeatsOffline (byte-identical per recipe);
 * the shell is emitShellFor (the arena's emitGameShell, or the play shell) over resolvers that return folder-relative paths
 * instead of API URLs (game-resolve's injectable-src seam — no resolver changes).
 *
 * Deliberate edges (from the plan):
 *  - The `_vertex_colored.glb` world-route override is bypassed by construction —
 *    we emit from the manifest, never from the override viewer (which runtime-fetches
 *    model.glb and is not standalone).
 *  - Opening game.html via file:// may block the music fetch (browser CORS on local
 *    files); play is unaffected. The README says "serve the folder" — Pages serves https.
 *  - Pixelizer games are already single-file: their export is game.html + recipe + README.
 */

import { readEra } from '@/lib/graph/era/eras';
import { eraReading } from '@/lib/graph/era/era-marks';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

import { registerTool } from '@/lib/mcp/server';
import { pluginProfileActive, withPluginProfile } from '@/lib/mcp/plugin-profile';
import { RENDER_TOOL_TIMEOUT_MS } from '@/lib/mcp/telemetry';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { resolveGame } from '@/lib/graph/game/game-resolve';
import { emitShellFor } from '@/lib/graph/game/shell-for';
import { resolveWorldScene, WALK_KINDS } from '@/lib/graph/worlds/world-scene';
import { emitThreeWorld } from '@/lib/graph/scene/scene-three';
import { renderBeatsOffline } from '@/lib/graph/beats/beats-render';
import { rasterizeSketchToPng } from '@/lib/graph/sketch/sketch-png';
import { withChromiumFetch } from '@/lib/graph/scene/chromium-consent';
import { outcomeDirFor, outcomeUrlFor } from '@/lib/outcomes-paths';
import { handoffForContext, fitsForContext } from '@/lib/mcp/hosts/handoff';
import { ELECTRON_TARGET, DESKTOP_GITIGNORE, desktopMainJs, desktopPackageJson, desktopReadmeLines } from '@/lib/graph/game/desktop-shell';
import { runDesktopGate, smokePages } from '@/lib/graph/game/desktop-gate';
import { findElectron } from '@/lib/workers/find';

// The recipe-hash style of image_render_requests.manifest_hash — short, stable,
// enough to tie a published render back to the exact recipe that minted it.
const manifestHash = (manifest) =>
  createHash('sha256').update(JSON.stringify(manifest)).digest('hex').slice(0, 16);

// Folder-relative src resolvers: the export twin of the /game route's API-URL
// resolvers. Whatever these return is BOTH the src baked into game.html and the
// path this tool writes — they cannot drift apart. Refs are [A-Za-z0-9_-]{1,64}
// at mint, so they are filesystem-safe as-is.
const LEVEL_SRC = (ref) => `levels/${ref}.html`;
const MENU_SRC = (ref) => `levels/menu-${ref}.html`;
const BEATS_SRC = (ref) => `assets/${ref}.wav`;
const PORTRAIT_SRC = (ref) => `assets/${ref}.png`;
const PREVIEW_SRC = (ref) => `levels/preview-${ref}.html`;

/**
 * Emit one world sketch as a self-contained page, mirroring the /world route's
 * flag logic for the three iframe roles a game shell requests:
 *   level   → ?walk=1&hud=0  (walk forced on, dev chrome off)
 *   menu    → ?hud=0         (walk per the world's own default)
 *   preview → ?spin=1&hud=0  (turntable read, orbit only)
 *
 * three.js delivery follows `cdn`. The default (false) is `inline: true`, the ?download=1
 * behavior: each page carries its own three.js and the folder contacts no third-party server.
 * `cdn: true` points the importmap at the pinned jsdelivr path, the only form a page door running
 * a CSP will execute (an artifact host refuses inline `data:` modules at ANY size), for publishing
 * a game as a page. 2.0.9 through 2.1 defaulted to the CDN; 2.2 made it opt-in.
 */
async function emitWorldPage(sketch, role, { cdn = false, era, reads = null } = {}) {
  const { payload, kind } = await resolveWorldScene(sketch, era ? { era } : {});
  // (what the era drew short of built, era/era-marks.js: each surface a gen-7 page draws as paint)
  if (era && reads && payload) for (const r of eraReading(payload, era).approximated) reads.set(r.input, r.how);
  if (!payload) {
    throw new Error(`'${sketch.ref}' has no traversable World form (kind '${kind ?? sketch.manifest?.kind}') — it cannot ship as a ${role} page`);
  }
  // backdrop image: a locally-bound /outcomes/… URL would leave the exported page fetching the
  // control plane — inline it as a data: URI instead so the page stays genuinely standalone.
  const bd = typeof payload.backdrop === 'string' ? payload.backdrop.match(/^\/outcomes\/([^/]+)\/(.+)$/) : null;
  if (bd) {
    const abs = path.join(outcomeDirFor(decodeURIComponent(bd[1])), decodeURIComponent(bd[2]));
    const mime = path.extname(abs).toLowerCase() === '.jpg' || path.extname(abs).toLowerCase() === '.jpeg' ? 'image/jpeg' : 'image/png';
    payload.backdrop = `data:${mime};base64,${(await fs.readFile(abs)).toString('base64')}`;
  }
  const exteriorView = sketch.manifest?.view === 'exterior';
  const walk = role === 'level'
    ? true
    : role === 'menu' && !exteriorView && (payload.walk || WALK_KINDS.has(kind));
  return emitThreeWorld({
    ...payload,
    wireframe: false,
    walk,
    spin: role === 'preview',
    decollide: true,
    hud: false,
    inline: !cdn,
    cdn,
  });
}

// ── shared figure bank (the GitHub-Pages fix, 2026-08-09) ──────────────────────────────────────
// A suit-roster level page is ~98% `const __FIG = {…}` — the packed rigged-figure bank — and every
// level/preview page inlines its own copy, so a 35-level game exports at ~5GB with single pages
// past GitHub's hard 100MB/file limit. The recipes already abstract suits from levels; this makes
// the EXPORT match: hoist the bank out of each page into content-hashed shared files
// (`assets/figures/<name>-<hash8>.json`, deduped across every page of the export) and replace the
// literal with a fetch shim (top-level await — the emitted script is a module). Pages drop to
// world-geometry size and the bank ships once, browser-cached across levels. Trade-off, recorded
// in the README: exported levels now fetch WITHIN the folder, so file:// no longer plays — any
// static server (GitHub Pages included) does.

// Scan a JSON object literal from `start` (must be '{') to its balanced close, string-aware.
// Returns the end index (inclusive). The bank is safeJson output, so this is plain JSON.
function scanJsonValue(s, start) {
  let i = start, depth = 0, inStr = false;
  for (;;) {
    const c = s[i];
    if (inStr) {
      if (c === '\\') i += 1;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{' || c === '[') depth += 1;
    else if (c === '}' || c === ']') {
      depth -= 1;
      if (depth === 0) return i;
    }
    i += 1;
    if (i > s.length) throw new Error('unbalanced JSON literal in emitted page');
  }
}

// Split the top level of a JSON object literal into [key, valueStart, valueEnd] spans without
// parsing the (hundred-MB) values — each figure's JSON ships to disk as a raw substring.
function topLevelEntries(s, objStart, objEnd) {
  const entries = [];
  let i = objStart + 1;
  while (i < objEnd) {
    while (i < objEnd && (s[i] === ',' || s[i] === ' ' || s[i] === '\n' || s[i] === '\t')) i += 1;
    if (i >= objEnd || s[i] !== '"') break;
    let k = i + 1;
    while (s[k] !== '"' || s[k - 1] === '\\') k += 1;
    const key = JSON.parse(s.slice(i, k + 1));
    i = k + 1;
    while (s[i] === ' ' || s[i] === ':') i += 1;
    const vStart = i;
    const vEnd = (s[i] === '{' || s[i] === '[') ? scanJsonValue(s, i) : (() => { throw new Error(`figure '${key}' is not an object literal`); })();
    entries.push([key, vStart, vEnd]);
    i = vEnd + 1;
  }
  return entries;
}

// The README's headline section: the game as the PLAYER meets it — the menu's mode tree
// (groups → modes with their subtitles + map labels), not the level-ref pack behind it.
// The refs stay discoverable in recipe/ for re-minting; they are provenance, not pitch.
function menuModeLines(menu) {
  if (!menu || !Array.isArray(menu.entries)) return [];
  const maps = (variants) => [...new Set((variants || []).map((v) => v && v.label).filter(Boolean))].join(' · ');
  const modeLine = (en) => {
    const m = maps(en.variants);
    return `- **${en.title}**${en.subtitle ? ` — ${en.subtitle}` : ''}${m ? ` *(maps: ${m})*` : ''}`;
  };
  const lines = [];
  for (const en of menu.entries) {
    if (!en) continue;
    if (en.kind === 'menu' && Array.isArray(en.entries)) {
      lines.push(`### ${en.title}${en.subtitle ? ` — ${en.subtitle}` : ''}`, '');
      for (const sub of en.entries) {
        if (!sub) continue;
        if (sub.kind === 'mode') lines.push(modeLine(sub));
        else if (sub.kind === 'soon') lines.push(`- **${sub.title}** — coming soon`);
        else if (sub.kind === 'world') lines.push(`- **${sub.title}**${sub.subtitle ? ` — ${sub.subtitle}` : ''}`);
      }
      lines.push('');
    } else if (en.kind === 'mode') {
      lines.push(modeLine(en), '');
    } else if (en.kind === 'world') {
      lines.push(`### ${en.title}${en.subtitle ? ` — ${en.subtitle}` : ''}`, '');
    } else if (en.kind === 'soon') {
      lines.push(`### ${en.title} — coming soon`, '');
    }
  }
  return lines;
}

function buildReadme({ manifest, ref, hash, files, engine, figureBank, geometryBank, desktop = false }) {
  const modeLines = engine === 'pixelizer' || engine === 'versus' || engine === 'tabletop' ? [] : menuModeLines(manifest.menu);
  const lines = [
    `# ${manifest.title}`,
    '',
    `A standalone playable game exported from [mojulo](https://github.com/zombico/mojulo) — recipes, not renders: \`recipe/\` is the sovereign source, everything else is its deterministic derived render.`,
    '',
    ...(manifest.menu?.tagline ? [`> ${manifest.menu.tagline}`, ''] : []),
    ...(modeLines.length ? ['## Game modes', '', ...modeLines] : []),
    '## Provenance',
    '',
    `- game ref: \`${ref}\``,
    `- manifest sha256/16: \`${hash}\``,
    ...(engine === 'pixelizer'
      ? [`- engine: pixelizer (single-file 2D reducer game)`]
      : engine === 'versus' ? [`- engine: versus (single-file side-view fighter; roster of ${(manifest.roster || []).length || 'the default'} fighters)`]
      : engine === 'tabletop' ? [`- engine: tabletop (single-file board game against the computer: ${typeof manifest.tabletop?.game === 'string' ? manifest.tabletop.game : 'a game written out'})`]
      : [`- levels: ${(manifest.levels || []).length} minted level worlds (one \`recipe/<ref>.json\` each)`]),
    '',
    '## How to play',
    '',
    'Serve this folder with any static server and open `game.html`:',
    '',
    '```bash',
    'npx serve .        # or: python3 -m http.server',
    '```',
    '',
    ...(figureBank
      ? ['GitHub Pages works as-is (the folder has zero EXTERNAL dependencies — no CDN).',
        'Level pages fetch the shared rigged-figure bank from `assets/figures/` within',
        'this folder (hoisted out of each page so no file tops static hosts\' size',
        'limits, and the browser caches the suits across levels) — so the folder needs',
        'an HTTP server; opening `game.html` via `file://` will not load levels.']
      : ['GitHub Pages works as-is (the folder has zero external dependencies — no CDN, no',
        'network fetches at play time). Opening `game.html` straight from the filesystem',
        '(`file://`) also plays, though some browsers block the music track there — a',
        'static server restores it.']),
    ...(geometryBank
      ? ['', 'World geometry is likewise hoisted into shared `assets/geometry/` files (levels',
        'that play on the same map fetch its terrain once and the browser caches it).']
      : []),
    '',
    ...(desktop ? desktopReadmeLines() : []),
    '## How to re-mint',
    '',
    'On any host running mojulo, the recipes under `recipe/` reproduce this artifact:',
    'each `recipe/<ref>.json` is a world manifest (`compose_world` + its `game:`',
    'channel mints the level), and `recipe/game.json` is the game manifest',
    '(`create_game` promotes the levels back into this shell). Same recipes → the',
    'same game, byte-for-byte where it matters.',
    '',
    '## Files',
    '',
    ...(() => {
      // a per-folder summary, not the full inventory — a 35-level game writes 100+ files
      // and the reader needs the shape, not the roll call (the result payload carries per-file
      // bytes for tooling).
      const dirs = new Map();
      for (const f of files) {
        const d = f.file.includes('/') ? `${f.file.split('/')[0]}/` : f.file;
        const cur = dirs.get(d) || { n: 0, bytes: 0 };
        cur.n += 1; cur.bytes += f.bytes;
        dirs.set(d, cur);
      }
      return [...dirs.entries()].map(([d, { n, bytes }]) =>
        `- \`${d}\` — ${n > 1 ? `${n} files, ` : ''}${bytes > 1024 * 1024 ? `${(bytes / 1048576).toFixed(0)} MB` : `${(bytes / 1024).toFixed(0)} KB`}`);
    })(),
    '',
  ];
  return lines.join('\n');
}

// The desktop export's machine gate, run in the tool when this host has Electron (lib/workers/find.js, the CLI's own
// search: MOJULO_ELECTRON, the folder's node_modules/.bin/electron, `electron` on the PATH): main.js in its
// `--mojulo-smoke` mode loads the shell and the first level hidden (desktop-gate.js). Advisory: it stamps what it saw and
// never fails the export. Bounded: the app reports by DESKTOP_SMOKE_MS and is killed 15 s after. No Electron: skipped,
// and the answer says so; mojulo never installs it. `find` / `run` are injectable for tests.
export const DESKTOP_SMOKE_MS = 60_000;
export async function desktopSmoke({ dir, files, find = findElectron, run = runDesktopGate } = {}) {
  const electron = find(undefined, { dir });
  if (!electron) {
    return { ran: false, skipped: 'no Electron on this host (MOJULO_ELECTRON, the folder\'s node_modules/.bin/electron, or `electron` on the PATH): the app folder is written, the smoke did not run' };
  }
  const pages = smokePages(files);
  const t0 = Date.now();
  const gate = await run({ dir, electron, pages, timeoutMs: DESKTOP_SMOKE_MS + 15_000, env: { MOJULO_SMOKE_TIMEOUT_MS: String(DESKTOP_SMOKE_MS) } });
  const ms = Date.now() - t0;
  if (!gate.ran) return { ran: false, skipped: gate.skipped, electron };
  const { ran: _ran, ...report } = gate;
  return { ran: true, ...report, ok: report.ok === true, electron, ms, eyes_gate: 'not run: the smoke saw pages load hidden, not how the game looks or plays (npm install && npm start, then play a level)' };
}

// Every folder export says the next move on THIS host (remote-worker exports P4): the
// single-file pixelizer game is a page; a shell game is a folder that needs an HTTP server,
// so its door is the branch or the disk, never a single download.
function withHandoff(result, context, artifact) {
  result.fits = fitsForContext(context, artifact);
  result.handoff = handoffForContext(context, artifact);
  result._structured = true;
  return result;
}

// `deps.smoke`: false skips the desktop smoke (the CLI runs its own, with --electron / --no-gate); { find, run } inject it.
export async function exportGameHandler(input, context = {}, deps = {}) {
  if (!input || typeof input !== 'object') throw new Error('export_game requires { ref }');
  const { ref, target, posture = null, cdn: cdnInput = false, era } = input;
  // The Claude plugin profile (lib/mcp/plugin-profile.js) writes only self-contained pages, and so does a desktop
  // app, which plays offline.
  const pluginBuild = pluginProfileActive();
  const desktop = target === 'desktop';
  const cdn = pluginBuild || desktop ? false : cdnInput;
  if (!ref || typeof ref !== 'string') throw new Error('`ref` is required (string)');
  // the era is the render's (era/eras.js), read by the pages: the engine packs carry the recipe's surfaces as they are
  // until the form render gives them materials, so an era there would change nothing, and says so
  if (era !== undefined) {
    readEra(era);
    if (target && target !== 'web' && target !== 'desktop') throw new Error(`export_game: era is read by the web and desktop pages; a ${target} pack carries the recipe's surfaces as they are until the form render (gen-7) gives them materials — export it without era`);
  }
  // Unreal takes mojulo's assets, not its games: the game's characters and solids go, each by its own ref
  if (target === 'unreal') {
    throw new Error("export_game: Unreal takes mojulo's assets, not its games or levels — export each character or solid "
      + "the game uses by its own ref with export_model { ref, format: 'unreal' }");
  }

  if (target === 'godot') {
    const { buildGodotGamePack } = await import('@/lib/graph/scene/godot-pack.js');
    const outDir = path.join(outcomeDirFor(ref), 'godot');
    const pack = await buildGodotGamePack({ ref, outDir, posture });
    const { exportVerdict } = await import('@/lib/graph/scene/engine-portability.js');
    const stamp = exportVerdict(pack.portability);
    return {
      ok: true,
      // plays | plays-partly | hollow, and what it rests on: a stamp beside ok, never a refusal
      verdict: stamp.verdict,
      lost: stamp.lost,
      ref,
      target: 'godot',
      dir: outDir,
      kernel: pack.kernelVersion,
      ...(posture ? { posture } : {}),
      files: pack.written.length,
      total_bytes: pack.written.reduce((s, f) => s + f.bytes, 0),
      portability: { portable: pack.portability.portable, flags: pack.portability.flags },
      ledger: pack.ledger,
      ...(pack.scope === 'arcade' ? { arcade: { reducer: pack.reducer, replay: pack.replay.file, replay_steps: pack.replay.steps } } : {}),
      note: 'Pack emitted (data + versioned kernel). Machine gate + web build live in the CLI: '
        + `node scripts/export-godot.mjs --ref ${ref} — or open the folder in Godot ≥4.5 and run.`,
    };
  }

  if (target === 'roblox') {
    const { buildRobloxGamePack } = await import('@/lib/graph/scene/roblox-pack.js');
    const outDir = path.join(outcomeDirFor(ref), 'roblox');
    const pack = await buildRobloxGamePack({ ref, outDir, posture });
    const { exportVerdict } = await import('@/lib/graph/scene/engine-portability.js');
    const stamp = exportVerdict(pack.portability, 'roblox');
    return {
      ok: true,
      verdict: stamp.verdict,
      lost: stamp.lost,
      ref,
      target: 'roblox',
      dir: outDir,
      ...(posture ? { posture } : {}),
      files: pack.written.length,
      total_bytes: pack.written.reduce((s, f) => s + f.bytes, 0),
      levels: pack.levels,
      portability: { portable: pack.portability.portable, flags: pack.portability.flags },
      note: 'Rojo project emitted (the Luau kernel, a greybox per level, one player driving). Machine gate lives in the CLI: '
        + `node scripts/export-roblox.mjs --ref ${ref} — or \`rojo build default.project.json -o game.rbxl\` in the folder and open it in Studio (Max Players 1).`,
    };
  }

  if (target === 'unity') {
    const { buildUnityGamePack } = await import('@/lib/graph/scene/unity-pack.js');
    const outDir = path.join(outcomeDirFor(ref), 'unity');
    const pack = await buildUnityGamePack({ ref, outDir, posture });
    return {
      ok: true,
      ref,
      target: 'unity',
      dir: outDir,
      leg: pack.legVersion,
      ...(posture ? { posture } : {}),
      files: pack.written.length,
      total_bytes: pack.written.reduce((s, f) => s + f.bytes, 0),
      portability: { portable: pack.portability.portable, flags: pack.portability.flags },
      ledger: pack.ledger,
      note: 'Pack emitted (data + mojulo-unity kernel). Machine gate lives in the CLI: '
        + `node scripts/export-unity.mjs --ref ${ref} — or follow the pack's IMPORT-GUIDE.md in Unity 6.`,
    };
  }


  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) throw new Error(`No sketch exists at ref '${ref}'`);
  if (!sketch.manifest || sketch.manifest.kind !== 'game') {
    throw new Error(`Sketch '${ref}' is not a game (kind '${sketch.manifest?.kind ?? 'none'}') — export_game covers create_game / create_pixelizer_game artifacts. For a single world use /world?download=1; for geometry use export_model.`);
  }

  const dir = outcomeDirFor(ref);
  const files = [];
  const eraReads = new Map();   // (each surface a page drew short of built in the asked era: era/era-marks.js)
  const write = async (rel, data) => {
    const abs = path.join(dir, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, data);
    files.push({ file: rel, bytes: Buffer.byteLength(data) });
  };
  const writeRecipe = async (rel, manifest) =>
    write(rel, `${JSON.stringify(manifest, null, 2)}\n`);

  // Hoist a page's inlined `__FIG` bank into shared assets/figures/ files (see the block comment
  // above scanJsonValue). Content-hashed + deduped across the whole export: identical bakes
  // (the same suit in 35 levels, a livery repeated by its preview turntable) ship exactly once.
  // Pages live in levels/, so the shim fetches ../assets/figures/….
  const figureFiles = new Map();   // rel path → true (written)
  const hoistFigures = async (html) => {
    // the figure-buffer POOL (channels/controllable poolFigureBuffers — packed buffers shared
    // across livery variants, referenced from __FIG by {__p:i} markers) is one big array literal
    // per page, identical across every level of a roster: hoist it like the bank, content-hashed
    // + deduped, BEFORE the __FIG hoist so both fetch shims resolve in emission order.
    const poolMarker = 'const __FIGPOOL = ';
    const poolAt = html.indexOf(poolMarker);
    if (poolAt >= 0 && html[poolAt + poolMarker.length] === '[') {
      const poolStart = poolAt + poolMarker.length;
      const poolEnd = scanJsonValue(html, poolStart);
      const body = html.slice(poolStart, poolEnd + 1);
      const h = createHash('sha256').update(body).digest('hex').slice(0, 8);
      const rel = `assets/figures/figpool-${h}.json`;
      if (!figureFiles.has(rel)) { figureFiles.set(rel, true); await write(rel, body); }
      html = html.slice(0, poolStart) + `await (await fetch(${JSON.stringify(`../${rel}`)})).json()` + html.slice(poolEnd + 1);
    }
    const marker = 'const __FIG = ';
    const at = html.indexOf(marker);
    if (at < 0) return html;
    const objStart = at + marker.length;
    if (html[objStart] !== '{') return html;
    const objEnd = scanJsonValue(html, objStart);
    const srcs = {};
    for (const [name, vStart, vEnd] of topLevelEntries(html, objStart, objEnd)) {
      const body = html.slice(vStart, vEnd + 1);
      const h = createHash('sha256').update(body).digest('hex').slice(0, 8);
      const rel = `assets/figures/${name.replace(/[^A-Za-z0-9_-]/g, '_')}-${h}.json`;
      if (!figureFiles.has(rel)) { figureFiles.set(rel, true); await write(rel, body); }
      srcs[name] = `../${rel}`;
    }
    const shim = 'Object.fromEntries(await Promise.all(Object.entries('
      + JSON.stringify(srcs)
      + ').map(async (e) => [e[0], await (await fetch(e[1])).json()])))';
    return html.slice(0, objStart) + shim + html.slice(objEnd + 1);
  };

  // ── shared world-geometry bank (match-modes.plan.md M2) ──────────────────────────────────────
  // The figure hoist's sibling: with mapRef terrain inheritance, a map's mode-variant levels bake
  // IDENTICAL geometry literals (`const GROUPS/REPEATS/TEXTURES = …` — safeJson output, plain JSON)
  // into every page. Hoist any big one into a content-hashed `assets/geometry/` file + a fetch
  // shim; identical literals across pages (7 variants of one map) ship exactly once. Small
  // literals stay inline — a fetch roundtrip isn't worth it under the threshold (env-overridable
  // for tests).
  const HOIST_MIN = Number(process.env.MOJULO_EXPORT_GEOMETRY_HOIST_MIN || 256 * 1024);
  const geometryFiles = new Map();   // rel path → true (written)
  const hoistGeometry = async (html) => {
    for (const name of ['GROUPS', 'REPEATS', 'TEXTURES']) {
      const marker = `const ${name} = `;
      const at = html.indexOf(marker);
      if (at < 0) continue;
      const start = at + marker.length;
      if (html[start] !== '{' && html[start] !== '[') continue;
      const end = scanJsonValue(html, start);
      if (end + 1 - start < HOIST_MIN) continue;
      const body = html.slice(start, end + 1);
      const h = createHash('sha256').update(body).digest('hex').slice(0, 8);
      const rel = `assets/geometry/${name.toLowerCase()}-${h}.json`;
      if (!geometryFiles.has(rel)) { geometryFiles.set(rel, true); await write(rel, body); }
      html = html.slice(0, start) + `await (await fetch(${JSON.stringify(`../${rel}`)})).json()` + html.slice(end + 1);
    }
    return html;
  };
  const hoistShared = async (html) => hoistGeometry(await hoistFigures(html));

  const manifest = sketch.manifest;
  const hash = manifestHash(manifest);

  // target 'desktop': the same folder plus the three root files that make it an Electron app (desktop-shell.js)
  const writeDesktop = async () => {
    // (the screen the game is made for sizes its window: desktop-shell.js desktopWindow)
    const app = { title: manifest.title || sketch.title, ref, ...(manifest.screen != null ? { screen: manifest.screen } : {}) };
    await write('package.json', desktopPackageJson(app));
    await write('main.js', desktopMainJs(app));
    await write('.gitignore', DESKTOP_GITIGNORE);
  };
  const desktopResult = async () => (desktop ? {
    target: 'desktop',
    desktop: {
      electron: ELECTRON_TARGET,
      play: `cd ${dir} && npm install && npm start`,
      package: 'npm run package (an unsigned app for this machine, under dist/)',
      gate: `node scripts/export-desktop.mjs --ref ${ref} runs the smoke below from a shell (--electron <path> to name the binary)`,
      ...(deps.smoke === false ? {} : { smoke: await desktopSmoke({ dir, files, ...(deps.smoke || {}) }) }),
    },
    ...(cdnInput && !pluginBuild ? { cdn_note: '`cdn: true` was ignored: a desktop app inlines three.js so it plays offline.' } : {}),
  } : {});

  // ── pixelizer branch: already single-file, the export is just the folder dressing ──
  if (era !== undefined && ['pixelizer', 'versus', 'tabletop'].includes(manifest.engine)) {
    throw new Error(`export_game: era is read by a game's World pages; a ${manifest.engine} game is drawn by its own single page, which no era changes — export it without era`);
  }
  if (manifest.engine === 'pixelizer') {
    const { emitPixelizerGame } = await import('@/lib/graph/pixelizer/pixelizer-games');
    await write('game.html', emitPixelizerGame(manifest, { title: sketch.title }));
    await writeRecipe('recipe/game.json', manifest);
    if (desktop) await writeDesktop();
    await write('README.md', buildReadme({ manifest, ref, hash, files, engine: 'pixelizer', desktop }));
    const totalBytes = files.reduce((n, f) => n + f.bytes, 0);
    return withHandoff({
      ok: true, ref, engine: 'pixelizer', dir,
      preview_url: `${outcomeUrlFor(ref)}game.html`,
      files, total_bytes: totalBytes,
      note: 'Single-file reducer game — game.html plays anywhere, file:// included.',
      ...(await desktopResult()),
    }, context, { kind: 'page', name: 'game.html', path: path.join(dir, 'game.html'), dir, bytes: totalBytes, download_url: `${outcomeUrlFor(ref)}game.html`, recipe: 'recipe/' });
  }

  // ── versus branch: a fighter's page is single-file too ──
  if (manifest.engine === 'versus') {
    const { emitVersusPage } = await import('@/lib/graph/versus/versus-page');
    const { withCharacters } = await import('@/lib/graph/versus/versus-character');
    await write('game.html', emitVersusPage(await withCharacters(manifest), { title: sketch.title }));
    await writeRecipe('recipe/game.json', manifest);
    await write('README.md', buildReadme({ manifest, ref, hash, files, engine: 'versus' }));
    const totalBytes = files.reduce((n, f) => n + f.bytes, 0);
    return withHandoff({
      ok: true, ref, engine: 'versus', dir,
      preview_url: `${outcomeUrlFor(ref)}game.html`,
      files, total_bytes: totalBytes,
      note: 'Single-file versus fighter: game.html plays anywhere, file:// included, two players on one keyboard or two pads.',
    }, context, { kind: 'page', name: 'game.html', path: path.join(dir, 'game.html'), dir, bytes: totalBytes, download_url: `${outcomeUrlFor(ref)}game.html`, recipe: 'recipe/' });
  }

  // ── tabletop branch: a board game's page is single-file, the kernel and the computer inside it ──
  if (manifest.engine === 'tabletop') {
    const { emitTabletopGame } = await import('@/lib/graph/tabletop/tabletop-manifest');
    await write('game.html', emitTabletopGame(manifest, { title: sketch.title }));
    await writeRecipe('recipe/game.json', manifest);
    await write('README.md', buildReadme({ manifest, ref, hash, files, engine: 'tabletop' }));
    const totalBytes = files.reduce((n, f) => n + f.bytes, 0);
    return withHandoff({
      ok: true, ref, engine: 'tabletop', dir,
      preview_url: `${outcomeUrlFor(ref)}game.html`,
      files, total_bytes: totalBytes,
      note: 'Single-file board game: game.html plays anywhere, file:// included, against the computer.',
    }, context, { kind: 'page', name: 'game.html', path: path.join(dir, 'game.html'), dir, bytes: totalBytes, download_url: `${outcomeUrlFor(ref)}game.html`, recipe: 'recipe/' });
  }

  // ── world/level games: resolve once with folder-relative resolvers, then bake each part ──
  const getSketch = (r) => SketchRepository.getByRef(r);
  const resolved = resolveGame(manifest, getSketch, LEVEL_SRC, MENU_SRC, BEATS_SRC, PORTRAIT_SRC, PREVIEW_SRC);
  const norm = resolved.manifest;

  // menu.art (title-card backdrop): copy a locally-bound image into assets/ and repoint the
  // SHELL's copy at the folder-relative path, so the export stays self-contained (zero network
  // fetches). Only /outcomes/… art is copied — an absolute http(s)/data: value passes
  // through untouched. The recipe keeps the SOVEREIGN serve-side value, not the assets/ path.
  let shellManifest = norm;
  for (const [key, base] of [['art', 'menu-art'], ['setupArt', 'setup-art']]) {
    const m = typeof shellManifest.menu?.[key] === 'string'
      ? shellManifest.menu[key].match(/^\/outcomes\/([^/]+)\/(.+)$/) : null;
    if (!m) continue;
    const srcAbs = path.join(outcomeDirFor(decodeURIComponent(m[1])), decodeURIComponent(m[2]));
    const ext = path.extname(srcAbs) || '.png';
    await write(`assets/${base}${ext}`, await fs.readFile(srcAbs));
    shellManifest = { ...shellManifest, menu: { ...shellManifest.menu, [key]: `assets/${base}${ext}` } };
  }

  // mode-variant map stills (`shot` on menu mode variants — the setup carousel): same treatment
  // as menu.art — locally-bound /outcomes/… images are copied into assets/maps/ and the SHELL's
  // resolved menu repointed, so the carousel works offline. Non-outcome URLs pass through; the
  // recipe keeps the sovereign serve-side values. The shell hides the carousel if an image is
  // missing, so an export baked before the stills existed still degrades to the label buttons.
  let shellMenu = resolved.menu;
  if (shellMenu) {
    const copied = new Map();   // sovereign URL → assets path (a shot shared across modes copies once)
    const repointShots = async (entries) => {
      const out = [];
      for (const en of entries) {
        if (en && en.kind === 'menu' && Array.isArray(en.entries)) { out.push({ ...en, entries: await repointShots(en.entries) }); continue; }
        if (!en || en.kind !== 'mode' || !Array.isArray(en.variants)) { out.push(en); continue; }
        const variants = [];
        for (const vr of en.variants) {
          const m = typeof vr?.shot === 'string' ? vr.shot.match(/^\/outcomes\/([^/]+)\/(.+)$/) : null;
          if (!m) { variants.push(vr); continue; }
          if (!copied.has(vr.shot)) {
            const srcAbs = path.join(outcomeDirFor(decodeURIComponent(m[1])), decodeURIComponent(m[2]));
            const rel = `assets/maps/${path.basename(srcAbs)}`;
            await write(rel, await fs.readFile(srcAbs));
            copied.set(vr.shot, rel);
          }
          variants.push({ ...vr, shot: copied.get(vr.shot) });
        }
        out.push({ ...en, variants });
      }
      return out;
    };
    shellMenu = await repointShots(shellMenu);
  }

  // front.cover (the light shell's title backdrop): a cover sketch's composite is written to assets/cover.png, a bound
  // /outcomes/… image is copied; the shell's copy points at the folder path, the recipe keeps the ref or the URL
  let frontArt = resolved.frontArt;
  if (frontArt) {
    const fc = norm.front.cover;
    if (typeof fc === 'string') {
      // loaded here, not at boot: the compositor needs sharp, which the stdio boot never loads
      const { compositeCoverForSketch } = await import('@/lib/graph/image-outcomes/cover-compositor');
      await write('assets/cover.png', await compositeCoverForSketch(getSketch(fc)));
      frontArt = { ...frontArt, src: 'assets/cover.png' };
    } else {
      const m = frontArt.src.match(/^\/outcomes\/([^/]+)\/(.+)$/);
      if (m) {
        const srcAbs = path.join(outcomeDirFor(decodeURIComponent(m[1])), decodeURIComponent(m[2]));
        const rel = `assets/front-art${path.extname(srcAbs) || '.png'}`;
        await write(rel, await fs.readFile(srcAbs));
        frontArt = { ...frontArt, src: rel };
      }
    }
  }

  await write('game.html', emitShellFor(resolved, { manifest: shellManifest, menu: shellMenu, frontArt }));
  await writeRecipe('recipe/game.json', norm);

  // levels — the ?walk=1&hud=0&download=1 bake, one page per level, figure bank hoisted shared.
  // A light level (mapRef terrain inheritance, worlds/map-ref.js) ships its MAP recipe beside it —
  // the level recipe alone can't re-mint without the map row it inherits from. Deduped: the whole
  // point of mapRef is that the map manifest exists ONCE for all its mode variants. A city's segment
  // level reads its city plan by ref (`city`) the same way, so the plan ships once beside its segments.
  const mapRecipes = new Set();
  for (const lv of resolved.levels) {
    const levelSketch = getSketch(lv.ref);
    await write(LEVEL_SRC(lv.ref), await hoistShared(await emitWorldPage(levelSketch, 'level', { cdn, era, reads: eraReads })));
    await writeRecipe(`recipe/${lv.ref}.json`, levelSketch.manifest);
    // a city's sites stand edifices by ref (city/plan/landmarks.js): each ships too, the city's and its segments'
    const standsOf = (m) => (m && m.kind === 'city' && Array.isArray(m.sites) ? m.sites.map((x) => x && x.from) : []);
    const lm = levelSketch.manifest ?? {}, queue = [lm.mapRef, lm.kind === 'city' ? lm.city : undefined, ...standsOf(lm)];
    while (queue.length) {
      const mapRef = queue.shift();
      if (typeof mapRef !== 'string' || mapRecipes.has(mapRef)) continue;
      mapRecipes.add(mapRef);
      const mapSketch = getSketch(mapRef);
      if (mapSketch?.manifest) { await writeRecipe(`recipe/${mapRef}.json`, mapSketch.manifest); queue.push(...standsOf(mapSketch.manifest)); }
    }
  }

  // menu worlds (a hangar, a viewer) — resolveGame already verified the refs exist
  for (const en of norm.menu?.entries || []) {
    if (en.kind !== 'world') continue;
    const menuSketch = getSketch(en.ref);
    await write(MENU_SRC(en.ref), await hoistShared(await emitWorldPage(menuSketch, 'menu', { cdn, era, reads: eraReads })));
    await writeRecipe(`recipe/${en.ref}.json`, menuSketch.manifest);
  }

  // music — the shell's score as offline WAV renders, looped like the served beats.wav?loop=1 (game-resolve.js)
  const stingers = new Set([norm.music?.victory, norm.music?.defeat].filter(Boolean));
  const beatsRefs = [...new Set([norm.music?.menu, norm.music?.about, ...(norm.music?.battle || []), ...stingers].filter(Boolean))];
  for (const br of beatsRefs) {
    const m = getSketch(br).manifest;
    // a stinger plays once (and an sfx is a one-shot): rendered whole, no loop fold
    const rendered = await renderBeatsOffline(m, m.kind === 'beats-sfx' || stingers.has(br) ? {} : { loop: true });
    await write(BEATS_SRC(br), rendered.wav);
  }

  // setup presentation — hangar card portraits (PNG stills) + preview turntables.
  // A 3D portrait bakes in headless Chromium; this export is an explicit render, so
  // it may download Chrome for Testing on a host without a browser (browser_download).
  let browserDownload = null;
  for (const slice of Object.values(norm.setup || {})) {
    if (slice.style !== 'hangar') continue;
    for (const card of Object.values(slice.cards || {})) {
      if (card.portrait) {
        const { value: png, fetched } = await withChromiumFetch(() => rasterizeSketchToPng(getSketch(card.portrait), { scale: 2 }));
        if (fetched) browserDownload = fetched.notice;
        await write(PORTRAIT_SRC(card.portrait), png);
      }
      if (card.preview) {
        await write(PREVIEW_SRC(card.preview), await hoistShared(await emitWorldPage(getSketch(card.preview), 'preview', { cdn, era, reads: eraReads })));
      }
      // per-livery preview turntables (livery-ingame): one page per swatch so the setup carousel
      // repaints offline too. De-duped against card.preview (the default livery reuses it).
      for (const l of (card.liveries || [])) {
        if (l && l.preview && l.preview !== card.preview) {
          await write(PREVIEW_SRC(l.preview), await hoistShared(await emitWorldPage(getSketch(l.preview), 'preview', { cdn, era, reads: eraReads })));
        }
      }
    }
  }

  if (desktop) await writeDesktop();
  await write('README.md', buildReadme({ manifest: norm, ref, hash, files, figureBank: figureFiles.size > 0, geometryBank: geometryFiles.size > 0, desktop }));

  const totalBytes = files.reduce((n, f) => n + f.bytes, 0);
  const heavy = files.filter((f) => f.bytes > 25 * 1024 * 1024).map((f) => f.file);
  return withHandoff({
    ok: true, ref, engine: 'shell', dir, ...(era !== undefined ? { era, era_marks: { approximated: Object.fromEntries([...eraReads].sort(([a], [b]) => a.localeCompare(b))) } } : {}),
    preview_url: `${outcomeUrlFor(ref)}game.html`,
    files, total_bytes: totalBytes,
    ...(figureFiles.size ? { figure_bank: { files: figureFiles.size, note: 'shared rigged-figure bank hoisted out of every page into assets/figures/ (deduped by content) — serve the folder over HTTP; file:// no longer loads levels' } } : {}),
    ...(geometryFiles.size ? { geometry_bank: { files: geometryFiles.size, note: 'shared world-geometry bank hoisted into assets/geometry/ (content-deduped — mode variants of one map ship its terrain once); same HTTP-server requirement as the figure bank' } } : {}),
    ...(heavy.length ? {
      note: `Files over 25MB (${heavy.join(', ')}) exceed some static hosts' per-file limits (e.g. Cloudflare Pages) — GitHub Pages allows up to 100MB/file. Level weight is geometry; a lighter world recipe shrinks it.`,
    } : {}),
    ...(browserDownload ? { browser_download: browserDownload } : {}),
    ...(pluginBuild && cdnInput ? { cdn_note: '`cdn: true` was ignored: the Claude plugin build of mojulo writes only self-contained pages.' } : {}),
    ...(await desktopResult()),
  }, context, { kind: 'folder', name: 'game.html', path: dir, dir, bytes: totalBytes, download_url: `${outcomeUrlFor(ref)}game.html`, recipe: 'recipe/' });
}

export function registerExportGameTools() {
  registerTool(withPluginProfile({
    name: 'export_game',
    // May fetch Chrome for Testing first, then bake: past the 120 s default.
    timeoutMs: RENDER_TOOL_TIMEOUT_MS,
    description:
      'Materialize a stored game as a portable folder — the game sibling of export_model / export_beats. '
      + 'Pass a game `ref` (a create_game / create_pixelizer_game sketch). The default writes `data/outcomes/<ref>/`: '
      + '`game.html` (the shell), `levels/<ref>.html` (three.js inlined; `cdn: true`: off the pinned CDN; banks hoisted '
      + 'to `assets/` — serve over HTTP, file:// does not load levels), `assets/<ref>.wav` (the score), `recipe/*.json` '
      + '(the SOVEREIGN manifests: re-mintable) + a README; `git init && gh repo create` away from a '
      + "GitHub-Pages URL. `target:'desktop'` adds `package.json` + `main.js`: the same folder is an Electron app "
      + '(`npm install && npm start`, offline). Deterministic; previews at `/outcomes/<ref>/game.html`, '
      + 'exactly what ships. Slow for big games (each level a full bake). Reach for "export this game", "make '
      + 'it playable outside mojulo", "publish it to GitHub Pages", "make it a desktop app". The engines get a '
      + "translation with a portability report: `target:'godot'` a Godot 4 pack under `<ref>/godot/` (per-level GLB, "
      + "score, audio, run by the versioned mojulo-godot kernel); `'unity'` the Unity 6 sibling (its "
      + "kernel + an import guide); `'roblox'` a Rojo project (the Luau kernel, a greybox, a Humanoid). Unreal takes "
      + "assets, not games: export_model { format: 'unreal' }.",
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'Existing game sketch ref (`sk_…`, kind `game`). Errors on other kinds.' },
        target: { type: 'string', enum: ['web', 'desktop', 'godot', 'unity', 'roblox'], description: 'Optional. Default `web` (the self-contained folder). `desktop`: that folder as an Electron app. `godot`/`unity`/`roblox` emit the engine pack instead.' },
        posture: { type: 'string', enum: ['greybox', 'final'], description: 'Optional operator-declared handoff posture for engine packs. `greybox` = blockout: geometry/scale/layout authoritative, surfaces placeholder — the ledger reframes surfacing losses as deferred and the import guide carries the handoff sentence. Never inferred; a manifest `posture` is the durable default.' },
        era: { type: 'string', enum: ['gen-6', 'gen-7'], description: "Optional. The era the pages are drawn in, the game's cube's by default: the same recipe, another render (`gen-7`: the form render, its surfaces drawn as paint under live light until it draws them). Web and desktop only." },
        cdn: { type: 'boolean', description: "web target only (a desktop app always inlines). Default false: every level/menu/preview page inlines three.js (~1 MB each) and contacts no server. `true` loads three.js from the pinned jsdelivr CDN, the only form a page door running a CSP will execute." },
      },
      required: ['ref'],
    },
    handler: exportGameHandler,
  }, {
    edits: [['; `cdn: true`: off the pinned CDN; banks hoisted', '; banks hoisted']],
    schema: (schema) => {
      delete schema.properties.cdn;
      return schema;
    },
  }));
}

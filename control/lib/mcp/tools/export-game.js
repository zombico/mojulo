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
 * the shell is emitGameShell over resolvers that return folder-relative paths
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

import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

import { registerTool } from '@/lib/mcp/server';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { resolveGame } from '@/lib/graph/game/game-resolve';
import { emitGameShell } from '@/lib/graph/game/game-shell';
import { resolveWorldScene, WALK_KINDS } from '@/lib/graph/worlds/world-scene';
import { emitThreeWorld } from '@/lib/graph/scene/scene-three';
import { renderBeatsOffline } from '@/lib/graph/beats/beats-render';
import { rasterizeSketchToPng } from '@/lib/graph/sketch/sketch-png';
import { outcomeDirFor, outcomeUrlFor } from '@/lib/outcomes/paths';

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
 * plus `inline: true` (the ?download=1 behavior) so the page carries its own three.js.
 */
async function emitWorldPage(sketch, role) {
  const { payload, kind } = await resolveWorldScene(sketch);
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
    inline: true,
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

function buildReadme({ manifest, ref, hash, files, engine, figureBank, geometryBank }) {
  const modeLines = engine === 'pixelizer' ? [] : menuModeLines(manifest.menu);
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

export async function exportGameHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('export_game requires { ref }');
  const { ref } = input;
  if (!ref || typeof ref !== 'string') throw new Error('`ref` is required (string)');

  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) throw new Error(`No sketch exists at ref '${ref}'`);
  if (!sketch.manifest || sketch.manifest.kind !== 'game') {
    throw new Error(`Sketch '${ref}' is not a game (kind '${sketch.manifest?.kind ?? 'none'}') — export_game covers create_game / create_pixelizer_game artifacts. For a single world use /world?download=1; for geometry use export_model.`);
  }

  const dir = outcomeDirFor(ref);
  const files = [];
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

  // ── pixelizer branch: already single-file, the export is just the folder dressing ──
  if (manifest.engine === 'pixelizer') {
    const { emitPixelizerGame } = await import('@/lib/graph/pixelizer/pixelizer-games');
    await write('game.html', emitPixelizerGame(manifest, { title: sketch.title }));
    await writeRecipe('recipe/game.json', manifest);
    await write('README.md', buildReadme({ manifest, ref, hash, files, engine: 'pixelizer' }));
    const totalBytes = files.reduce((n, f) => n + f.bytes, 0);
    return {
      ok: true, ref, engine: 'pixelizer', dir,
      preview_url: `${outcomeUrlFor(ref)}game.html`,
      files, total_bytes: totalBytes,
      note: 'Single-file reducer game — game.html plays anywhere, file:// included.',
    };
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

  await write('game.html', emitGameShell(shellManifest, resolved.levels, shellMenu, resolved.music, resolved.setup));
  await writeRecipe('recipe/game.json', norm);

  // levels — the ?walk=1&hud=0&download=1 bake, one page per level, figure bank hoisted shared.
  // A light level (mapRef terrain inheritance, worlds/map-ref.js) ships its MAP recipe beside it —
  // the level recipe alone can't re-mint without the map row it inherits from. Deduped: the whole
  // point of mapRef is that the map manifest exists ONCE for all its mode variants.
  const mapRecipes = new Set();
  for (const lv of resolved.levels) {
    const levelSketch = getSketch(lv.ref);
    await write(LEVEL_SRC(lv.ref), await hoistShared(await emitWorldPage(levelSketch, 'level')));
    await writeRecipe(`recipe/${lv.ref}.json`, levelSketch.manifest);
    const mapRef = levelSketch.manifest?.mapRef;
    if (typeof mapRef === 'string' && !mapRecipes.has(mapRef)) {
      mapRecipes.add(mapRef);
      const mapSketch = getSketch(mapRef);
      if (mapSketch?.manifest) await writeRecipe(`recipe/${mapRef}.json`, mapSketch.manifest);
    }
  }

  // menu worlds (a hangar, a viewer) — resolveGame already verified the refs exist
  for (const en of norm.menu?.entries || []) {
    if (en.kind !== 'world') continue;
    const menuSketch = getSketch(en.ref);
    await write(MENU_SRC(en.ref), await hoistShared(await emitWorldPage(menuSketch, 'menu')));
    await writeRecipe(`recipe/${en.ref}.json`, menuSketch.manifest);
  }

  // music — the shell's score as offline WAV renders (default opts match the served beats.wav)
  const beatsRefs = [...new Set([norm.music?.menu, norm.music?.about, ...(norm.music?.battle || [])].filter(Boolean))];
  for (const br of beatsRefs) {
    const rendered = await renderBeatsOffline(getSketch(br).manifest, {});
    await write(BEATS_SRC(br), rendered.wav);
  }

  // setup presentation — hangar card portraits (PNG stills) + preview turntables
  for (const slice of Object.values(norm.setup || {})) {
    if (slice.style !== 'hangar') continue;
    for (const card of Object.values(slice.cards || {})) {
      if (card.portrait) {
        await write(PORTRAIT_SRC(card.portrait), await rasterizeSketchToPng(getSketch(card.portrait), { scale: 2 }));
      }
      if (card.preview) {
        await write(PREVIEW_SRC(card.preview), await hoistShared(await emitWorldPage(getSketch(card.preview), 'preview')));
      }
      // per-livery preview turntables (livery-ingame): one page per swatch so the setup carousel
      // repaints offline too. De-duped against card.preview (the default livery reuses it).
      for (const l of (card.liveries || [])) {
        if (l && l.preview && l.preview !== card.preview) {
          await write(PREVIEW_SRC(l.preview), await hoistShared(await emitWorldPage(getSketch(l.preview), 'preview')));
        }
      }
    }
  }

  await write('README.md', buildReadme({ manifest: norm, ref, hash, files, figureBank: figureFiles.size > 0, geometryBank: geometryFiles.size > 0 }));

  const totalBytes = files.reduce((n, f) => n + f.bytes, 0);
  const heavy = files.filter((f) => f.bytes > 25 * 1024 * 1024).map((f) => f.file);
  return {
    ok: true, ref, engine: 'shell', dir,
    preview_url: `${outcomeUrlFor(ref)}game.html`,
    files, total_bytes: totalBytes,
    ...(figureFiles.size ? { figure_bank: { files: figureFiles.size, note: 'shared rigged-figure bank hoisted out of every page into assets/figures/ (deduped by content) — serve the folder over HTTP; file:// no longer loads levels' } } : {}),
    ...(geometryFiles.size ? { geometry_bank: { files: geometryFiles.size, note: 'shared world-geometry bank hoisted into assets/geometry/ (content-deduped — mode variants of one map ship its terrain once); same HTTP-server requirement as the figure bank' } } : {}),
    ...(heavy.length ? {
      note: `Files over 25MB (${heavy.join(', ')}) exceed some static hosts' per-file limits (e.g. Cloudflare Pages) — GitHub Pages allows up to 100MB/file. Level weight is geometry; a lighter world recipe shrinks it.`,
    } : {}),
  };
}

export function registerExportGameTools() {
  registerTool({
    name: 'export_game',
    description:
      'Materialize a stored game as a SELF-CONTAINED folder the operator can share — the game '
      + 'sibling of export_model / export_beats, and the first leg of publishing a playable artifact '
      + '(game-publish: the folder is `git init && gh repo create` away from a GitHub-Pages public URL). '
      + 'Pass the game `ref` (a create_game or create_pixelizer_game sketch). Writes '
      + '`data/outcomes/<ref>/`: `game.html` (the shell, srcs resolved folder-relative), '
      + '`levels/<ref>.html` (three.js + world geometry inlined; the heavy rigged-figure bank is '
      + 'hoisted into shared deduped `assets/figures/*.json`, so the folder needs an HTTP server — '
      + 'file:// does not load levels), '
      + '`assets/<ref>.wav` (the shell score via the deterministic offline render), hangar setup '
      + 'portraits/previews when declared, `recipe/*.json` (the SOVEREIGN game + level manifests — '
      + 'anyone with mojulo re-mints from these), and a provenance README (refs + manifest hash + how '
      + 'to play + how to re-mint). Deterministic: same rows → same folder. The folder previews '
      + 'locally at `/outcomes/<ref>/game.html` — exactly what ships. '
      + "Slow for big games (each level is a full world bake). Reach for \"export this game\", "
      + '"make the game shareable / playable outside mojulo", "publish the game to GitHub Pages".',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'Existing game sketch ref (`sk_…`, kind `game`). Errors on other kinds.' },
      },
      required: ['ref'],
    },
    handler: exportGameHandler,
  });
}

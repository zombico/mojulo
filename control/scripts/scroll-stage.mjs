#!/usr/bin/env node
/**
 * Blaze Gunner's scroll stage for the eyes gate (gameworld/scroll-stage/): an airspace `scroll` manifest built and shot on
 * its page from its own scroll camera at a few places down its track (the page's runtime places the camera: each shot is
 * the stage started there).
 *
 *   node scripts/scroll-stage.mjs [manifest.json | --stage stage-1] [--out dir] [--at 0,1.5,4] [--view side|top] [--scale 2]
 *
 * --at: the shots, in screens along the stage (default 0, the stage's middle and its end). With no manifest, a stage of
 * Blaze Gunner's first stage (gameworld/scroll-stage/stages.js), or the one `--stage` names. Prints what was laid.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const control = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
register(pathToFileURL(path.join(control, 'scripts/mcp-stdio-loader.mjs')).href);
const args = process.argv.slice(2), opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const file = args.find((a, i) => !a.startsWith('--') && !['--out', '--at', '--view', '--scale', '--stage'].includes(args[i - 1]));
const out = path.resolve(opt('--out') ?? 'scroll-stage-out');
const { stageManifest } = await import('../lib/graph/gameworld/scroll-stage/stages.js');
const m = file ? JSON.parse(readFileSync(file, 'utf8')) : stageManifest(opt('--stage') ?? 'stage-1');
if (opt('--view')) m.scroll = { ...m.scroll, view: opt('--view') };
mkdirSync(out, { recursive: true });

const { resolveWorldScene } = await import('../lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('../lib/graph/scene/scene-three.js');
const { renderWorldToPng } = await import('../lib/graph/scene/scene-png.js');
const { scrollStageOf, scrollStagePlay } = await import('../lib/graph/gameworld/scroll-stage/stage-scene.js');
const G = scrollStageOf(m), end = G.extent.u[1] / G.cam.screen.along;
const at = (opt('--at') ?? `0,${Math.round(end / 2)},${Math.max(0, Math.round(end) - 1)}`).split(',').map(Number);
console.log(`view ${G.view}: a screen ${G.cam.screen.along} × ${G.cam.screen.across} m from ${G.cam.dist} m, the ship ${G.ship.craft} ${G.ship.length} m`);
for (const a of at) {
  // (the ship flies its airframe: a page resolves a figure from the manifest, as a level carries it)
  const s0 = { ...m, scroll: { ...m.scroll, start: [a, 0] } }, shot = { ...s0, ...scrollStagePlay(s0) };
  const { payload } = await resolveWorldScene({ manifest: shot });
  if (a === at[0]) console.log('laid:', JSON.stringify(payload.meta.scroll.layers), (payload.meta.scroll.hulls || []).map((h) => `${h.label} at ${h.at}`).join('; '));
  const html = emitThreeWorld({ ...payload, inline: true, hud: false });
  const W = 1280, H = Math.round(W / G.cam.aspect);
  writeFileSync(path.join(out, `at-${a}.png`), await renderWorldToPng(html, { width: W, height: H, deviceScaleFactor: Number(opt('--scale') ?? 1) }));
  if (a === at[0]) writeFileSync(path.join(out, 'stage.html'), html);
  console.log(`  shot at ${a} screens: ${path.join(out, `at-${a}.png`)}`);
}

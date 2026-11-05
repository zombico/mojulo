#!/usr/bin/env node
// gameplay — a versus match recorded: two characters (hero specs, minted in memory) fighting with their own strikes
// (versus-hero.js, `moves: 'hero'`) on the versus game's own page (versus-page.js emitVersusPage, the fight drawn on the
// page), CPU against CPU, recorded by headless Chromium and cut to an MP4 and a GIF.
//
//   node control/scripts/spikes/fighter/gameplay.mjs [--a spec.json] [--b spec.json] [--seconds 20] [--mode watch|training]
//        [--boxes] [--out dir]
//
// --boxes turns the hit, hurt and push boxes on (the page's B). Needs Playwright's Chromium and ffmpeg.
import { register, createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, renameSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const HERE = path.dirname(fileURLToPath(import.meta.url)), CONTROL = path.resolve(HERE, '../../..');
const { values: opt } = parseArgs({ options: { a: { type: 'string', default: path.join(HERE, 'test-fighter.json') }, b: { type: 'string', default: path.join(HERE, 'test-opponent.json') }, seconds: { type: 'string', default: '20' }, mode: { type: 'string', default: 'watch' }, boxes: { type: 'boolean', default: false }, out: { type: 'string', default: path.join(os.tmpdir(), 'fighter-gameplay') } } });
const specA = JSON.parse(readFileSync(path.resolve(opt.a), 'utf8')), specB = JSON.parse(readFileSync(path.resolve(opt.b), 'utf8'));
const out = path.resolve(opt.out); mkdirSync(out, { recursive: true });
process.chdir(CONTROL);
register(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href);
const { heroRecord } = await import('@/lib/mcp/tools/layered.js');
const { withDefaultForm } = await import('@/lib/graph/polygonizer/motion-stamp.js');
const { resolveCharacters } = await import('@/lib/graph/versus/versus-character.js');
const { emitVersusPage } = await import('@/lib/graph/versus/versus-page.js');

// the two characters, as the store would keep them (their door clips aside: the fight solves its own strikes)
const strip = ({ motion: _m, gesture: _g, ...s }) => s;
const ROWS = { a: { kind: 'layered', hero: heroRecord(withDefaultForm(strip(specA))) }, b: { kind: 'layered', hero: heroRecord(withDefaultForm(strip(specB))) } };
console.log('measuring the two characters and solving their strikes …');
const roster = await resolveCharacters([
  { id: 'toji', name: 'Toji', tradition: 'boxing', hero: { ref: 'a' }, moves: 'hero', color: '#c8302c' },
  { id: 'satoru', name: 'Satoru', tradition: 'boxing', hero: { ref: 'b' }, moves: 'hero', color: '#2f5fbf' },
], (r) => ROWS[r]);
const page = path.join(out, 'versus.html');
writeFileSync(page, emitVersusPage({ title: 'Fighter wiring', roster }));
console.log(page);

const { chromium } = createRequire(path.join(CONTROL, 'package.json'))('playwright');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: out, size: { width: 1280, height: 720 } } });
const tab = await ctx.newPage();
await tab.goto(pathToFileURL(page).href);
await tab.waitForFunction(() => window.__versus);
// straight to the fight: the mode, both picks locked, the stage screen; then the confirm starts the match
await tab.evaluate((mode) => { const V = window.__versus, G = V.game; G.mode = mode; G.modeIx = 0; G.pick[0] = { ix: 0, scheme: 0, locked: true }; G.pick[1] = { ix: 1, scheme: 0, locked: true }; G.screen = 'stage'; }, opt.mode);
await tab.waitForTimeout(300);
await tab.keyboard.press('Space');
if (opt.boxes) { await tab.waitForTimeout(800); await tab.keyboard.press('KeyB'); }
await tab.waitForTimeout(Number(opt.seconds) * 1000);
const video = tab.video();
await ctx.close(); await browser.close();
const webm = await video.path(), mp4 = path.join(out, 'gameplay.mp4'), gif = path.join(out, 'gameplay.gif');
// (the first second is the page loading and the intro: cut from 1 s)
spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '1', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', mp4], { stdio: 'inherit' });
spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '1', '-t', '12', '-i', webm, '-vf', 'fps=15,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer', gif], { stdio: 'inherit' });
console.log(mp4); console.log(gif);

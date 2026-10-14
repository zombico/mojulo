// Shared helpers for the README media scripts: a headless Chrome from control/'s puppeteer-core,
// World-page captures through the page's own capture mode, and HTML snapshots.
//
// CHROME_BIN overrides the browser (default: Google Chrome on macOS). The World page needs real WebGL,
// so the launch routes GL through ANGLE.
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { mkdtempSync, openSync, closeSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const CONTROL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../control');
const req = createRequire(path.join(CONTROL, 'package.json'));
const { default: puppeteer } = await import(pathToFileURL(req.resolve('puppeteer-core')).href);

const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const GL_ARGS = ['--use-gl=angle', `--use-angle=${process.platform === 'darwin' ? 'metal' : 'swiftshader'}`, '--ignore-gpu-blocklist'];

export const launch = (gl = false) =>
  puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--allow-file-access-from-files', ...(gl ? GL_ARGS : [])] });

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A copy of an exported world.html with capture mode switched on, so a camera can be set per frame. */
export async function captureCopy(worldHtml) {
  const src = await readFile(worldHtml, 'utf8');
  if (!src.includes('const _capture = false;')) throw new Error(`${worldHtml}: no capture flag (is this an exported world.html?)`);
  const out = path.join(await mkdtemp(path.join(tmpdir(), 'mj-media-')), 'world.html');
  await writeFile(out, src.replace('const _capture = false;', 'const _capture = true;'));
  return out;
}

/** Render a world.html from one camera ({ pos, target, vfov } in the page's world units) to a PNG. */
export async function captureWorld(worldHtml, outPng, { width, height, dpr = 2, camera }) {
  const file = await captureCopy(worldHtml);
  const browser = await launch(true);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: dpr });
    await page.goto(pathToFileURL(file).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__mojCapture && window.__mojCapture.ready, { timeout: 60000 });
    await page.evaluate(() => {
      for (const b of document.querySelectorAll('button')) b.parentElement.style.display = 'none';
      for (const e of document.querySelectorAll('body *')) if (e.children.length === 0 && /drag to orbit|W A S D|scroll/.test(e.textContent)) e.style.display = 'none';
    });
    await page.evaluate((c) => window.__mojCapture.frame(c), camera);
    await sleep(300);
    await writeFile(outPng, await page.screenshot({ type: 'png' }));
  } finally { await browser.close(); }
}

/** Render a world.html through one of its own named shots (the dollhouse, a corner), with the shot's camera
 * replaced. Unlike captureWorld this runs the live page, so it looks exactly as the World page does on screen. */
export async function captureShot(worldHtml, outPng, { width, height, dpr = 2, shot, camera }) {
  const src = await readFile(worldHtml, 'utf8');
  const re = new RegExp(`"name":"${shot}","pos":\\[[^\\]]*\\],"target":\\[[^\\]]*\\],"vfov":[\\d.]+`);
  if (!re.test(src)) throw new Error(`${worldHtml}: no shot named ${shot}`);
  const file = path.join(await mkdtemp(path.join(tmpdir(), 'mj-media-')), 'world.html');
  await writeFile(file, src.replace(re, `"name":"${shot}","pos":${JSON.stringify(camera.pos)},"target":${JSON.stringify(camera.target)},"vfov":${camera.vfov}`));
  const browser = await launch(true);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: dpr });
    await page.goto(pathToFileURL(file).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(3500);
    await page.evaluate((name) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === name).click(), shot);
    await sleep(1800);
    await page.evaluate(() => {
      for (const b of document.querySelectorAll('button')) b.parentElement.style.display = 'none';
      for (const e of document.querySelectorAll('body *')) if (e.children.length === 0 && /drag to orbit|W A S D|scroll/.test(e.textContent)) e.style.display = 'none';
    });
    await sleep(300);
    await writeFile(outPng, await page.screenshot({ type: 'png' }));
  } finally { await browser.close(); }
}

/** Screenshot a static HTML page at a fixed size. */
export async function snapHtml(htmlFile, outPng, { width, height, dpr = 1 }) {
  const browser = await launch(false);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: dpr });
    await page.goto(pathToFileURL(path.resolve(htmlFile)).href);
    await sleep(400);
    await writeFile(outPng, await page.screenshot({ type: 'png' }));
  } finally { await browser.close(); }
}

/** Run control/scripts/<script> and parse its JSON answer. stdout goes to a file: mcp-stdio exits before a pipe
 * drains, which cuts a large answer (a mint's stats) at 64 KB. */
export function runJson(env, args) {
  const dir = mkdtempSync(path.join(tmpdir(), 'mj-out-')), file = path.join(dir, 'out.json');
  const fd = openSync(file, 'w');
  const r = spawnSync(process.execPath, args, { cwd: CONTROL, env, stdio: ['ignore', fd, 'pipe'], encoding: 'utf8' });
  closeSync(fd);
  const out = readFileSync(file, 'utf8'); const i = out.indexOf('{');
  if (r.status !== 0 || i < 0) throw new Error(`${args.join(' ')}\n${(r.stderr || out).slice(-2000)}`);
  return JSON.parse(out.slice(i, out.lastIndexOf('}') + 1));
}

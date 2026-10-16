// level-demo.gif, end to end: a sentence composed into a gameworld, its geocube's island and room, its world map and
// first level's walk from the bible, the level made and walked; then compose and encode the GIF.
//
//   node docs/images/src/level-demo/run.mjs [workDir]
//
// Runs mojulo from this checkout's control/ through scripts/mcp-stdio.mjs. Without MOJULO_DATA_DIR it uses a fresh
// data dir under the work dir, so nothing touches ~/.mojulo. Needs Chrome (CHROME_BIN) and ffmpeg (FFMPEG, else
// `ffmpeg` on PATH).
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { captureShot, captureWorld, runJson, launch, sleep } from '../lib/browser.mjs';
import { compose } from './compose.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const work = path.resolve(process.argv[2] || path.join(tmpdir(), 'mj-level-demo'));
mkdirSync(work, { recursive: true });
const env = { ...process.env };
env.MOJULO_DATA_DIR ||= path.join(work, 'data');
env.MOJULO_OUTCOMES_DIR ||= path.join(env.MOJULO_DATA_DIR, 'outcomes');
mkdirSync(env.MOJULO_OUTCOMES_DIR, { recursive: true });

const node = (args) => runJson(env, args);
const call = (tool, args) => {
  const res = node(['scripts/mcp-stdio.mjs', 'call', tool, '--json', JSON.stringify(args)]);
  if (res.ok === false) throw new Error(`${tool}: ${res.error}`);
  return res;
};
const manifestOf = (ref) => JSON.parse(spawnSync('sqlite3', [path.join(env.MOJULO_DATA_DIR, 'mojulo-lite.db'), `select manifest_json from sketches where ref='${ref}';`], { encoding: 'utf8' }).stdout);
const worldOf = (ref) => path.join(env.MOJULO_OUTCOMES_DIR, ref, 'world.html');
// a page's own named shot, its camera as the page wrote it (captureShot re-sets it, so the click lands on it)
const shotOf = (html, name) => {
  const m = readFileSync(html, 'utf8').match(new RegExp(`"name":"${name}","pos":(\\[[^\\]]*\\]),"target":(\\[[^\\]]*\\]),"vfov":([\\d.]+)`));
  if (!m) throw new Error(`${html}: no shot named ${name}`);
  return { pos: JSON.parse(m[1]), target: JSON.parse(m[2]), vfov: Number(m[3]) };
};

export const PROMPT = 'a sunny island coast with arches and a timber village';
const WORLD = 'isle_demo';
// The stamp rolls a palette seed where the world is stored; pin the one the committed GIF was made with, so it re-shoots
const PALETTE_SEED = Number(process.env.LEVEL_DEMO_SEED || 7);
// over the level: its cliff-top shot, this much further from its target and this many metres higher
const AERIAL = { back: 2.6, up: 30 };
// the orbit's own camera stands far off in the haze: this share of its distance from the level
const ORBIT_IN = 0.2;

// 1. the words, read into a world
const composed = call('design_game', { ref: WORLD, compose: { prompt: PROMPT, levels: 2, seed: 2 } });
const pinned = (p) => ({ ...p, seed: PALETTE_SEED });
const stored0 = manifestOf(WORLD);
call('design_game', { ref: WORLD, patch: [
  { op: 'set', path: '/style/geocube', value: { ...stored0.style.geocube, palette: pinned(stored0.style.geocube.palette) } },
  { op: 'set', path: '/style/palette', value: pinned(stored0.style.palette) },
] });

// 2. the level made: a world before its people makes its levels at once
const ran = call('design_game', { ref: WORLD, run: true, readout: 'changed' });
const world = manifestOf(WORLD);
const levelRefs = Object.entries(world.made ?? {}).filter(([k]) => k.startsWith('level-')).map(([, v]) => v.ref ?? v);
writeFileSync(path.join(work, 'world.json'), JSON.stringify(world, null, 1));

// 3. the bible, and its sections as stills
spawnSync(process.execPath, [path.join(here, 'bible.mjs'), path.join(work, 'world.json'), path.join(work, 'bible.html'), path.join(work, 'cube.json')], { stdio: 'inherit' });
const firstLevel = Object.keys(world.levels)[0];
// each section at the page width it reads best at in the view: the brief wrapped narrow, the map cropped to what it draws
const sections = { brief: ['details.brief', 640], map: ['#map .canvas svg', 1100], walk: [`#level-${firstLevel} .walk`, 1100] };
const browser = await launch(false);
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 900, deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(path.join(work, 'bible.html')).href, { waitUntil: 'networkidle0', timeout: 60000 });
  await sleep(500);
  // the sticky section tabs would sit over whatever is scrolled under them
  await page.evaluate(() => { for (const n of document.querySelectorAll('nav.tabs')) n.style.display = 'none'; });
  await page.evaluate(() => {
    const svg = document.querySelector('#map .canvas svg'), b = svg.getBBox(), pad = 18;
    svg.setAttribute('viewBox', `${b.x - pad} ${b.y - pad} ${b.width + 2 * pad} ${b.height + 2 * pad}`);
    svg.removeAttribute('height'); svg.style.width = '1000px'; svg.style.height = 'auto';
  });
  for (const [name, [sel, width]] of Object.entries(sections)) {
    await page.setViewport({ width, height: 900, deviceScaleFactor: 2 });
    await sleep(300);
    const el = await page.$(sel);
    if (!el) throw new Error(`bible: no ${sel}`);
    await el.screenshot({ path: path.join(work, `bible-${name}.png`) });
  }
} finally { await browser.close(); }

// 4. the cube's island and room: the geocube kind on the world's own stored cube
for (const show of ['land', 'room']) {
  const ref = `${WORLD}_cube_${show}`;
  call('create_sketch', { ref, title: `${world.name} · cube · ${show}`, manifest: { kind: 'geocube', cube: world.style.geocube, show } });
  call('export_model', { ref, format: 'html' });
  const shot = show === 'land' ? 'wide' : 'set';
  await captureShot(worldOf(ref), path.join(work, `cube-${show}.png`), { width: 600, height: 444, shot, camera: shotOf(worldOf(ref), shot) });
}

// 5. the level's World page, through its own shots
call('export_model', { ref: levelRefs[0], format: 'html' });
const html = worldOf(levelRefs[0]);
// the level's World page is a playable one: it opens on its walker, whatever shot is asked of it, so its cameras are
// set through the capture mode (captureWorld). Its cliff-top view, that view pulled back and up, then its orbit pulled in
const cliff = shotOf(html, 'cliff-top'), orbit = shotOf(html, 'orbit');
const toward = (c, k, up = 0) => { const pos = c.pos.map((v, i) => c.target[i] + (v - c.target[i]) * k); pos[2] += up; return { ...c, pos: pos.map((x) => Math.round(x * 100) / 100) }; };
const LEVEL_SHOTS = [['level-1', cliff], ['level-2', toward(cliff, AERIAL.back, AERIAL.up)], ['level-aerial', toward(orbit, ORBIT_IN)]];
for (const [name, camera] of LEVEL_SHOTS) await captureWorld(html, path.join(work, `${name}.png`), { width: 600, height: 444, camera });
const picks = LEVEL_SHOTS.map(([name]) => name);

const levels = Object.entries(world.levels).map(([id, L]) => ({ id, name: L.name, seed: L.seed, sections: Object.entries(L.walk?.nodes ?? {}).map(([n, v]) => `${n} · ${v.meru ? 'climb' : 'trail'}`), places: Object.keys(L.places ?? {}).filter((k) => L.places[k]) }));
const facts = { prompt: PROMPT, cube: JSON.parse(readFileSync(path.join(work, 'cube.json'), 'utf8')), levels, laid: world.brief.levels, composed: composed.composed, world: { name: world.name, kit: world.style.kit, levels: Object.keys(world.levels).length, cube: world.style.geocube }, levelRef: levelRefs[0], levelShots: picks, ran: (ran.ran ?? []).map((r) => `${r.key}: ${r.action}`) };
writeFileSync(path.join(work, 'facts.json'), JSON.stringify(facts, null, 1));
const gif = await compose(work, facts);
console.log(existsSync(gif) ? gif : 'compose failed');

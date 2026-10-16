// Compose level-demo.gif from the stills run.mjs leaves in the work dir: bible-brief / bible-map / bible-walk.png (the
// world bible's sections), cube-land / cube-room.png (the geocube's island and room), level-1 / level-2 /
// level-aerial.png (the level's World page), and facts.json (the prompt, what each word decided, the cube as solved,
// the levels as laid).
//
//   node docs/images/src/level-demo/compose.mjs <workDir>      # re-compose without re-rendering
//
// Frames are 900×500 @2x through stage.html, then ffmpeg: one 128-colour palette, bayer dither, 12 fps.
import { readFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch } from '../lib/browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const k = (x) => `<span class="k">"${esc(x)}"</span>`;
const v = (x) => (typeof x === 'string' ? `<span class="s">"${esc(x)}"</span>` : esc(JSON.stringify(x)));
const lines = (ls) => ls.map(([t, cls]) => `<div class="ln${cls ? ` ${cls}` : ''}">${t}</div>`).join('');

export async function compose(work, facts) {
  const img = (n) => pathToFileURL(path.join(work, `${n}.png`)).href;
  const { prompt, composed, cube, levels, laid } = facts;

  // 1. the words read: each word and what it decided, revealed one by one
  const read = composed.read.map((r) => { const [w, d] = r.split(': '); return [w, d]; });
  const wordsCard = (n) => `<div class="h"><b>the words, read</b><span>design_game · compose</span></div>` + lines([
    ...read.map(([w, d], i) => [`<span class="w">${esc(w)}</span> → ${esc(d)}`, i < n ? (i === n - 1 ? 'new' : '') : 'dim']),
    ...(composed.unread?.length ? [[`<span class="w">${esc(composed.unread.join(', '))}</span> → not read`, n > read.length ? '' : 'dim']] : []),
    [`the rest → the seed`, n > read.length ? '' : 'dim'],
  ]);
  // 2. the cube as stored and as solved: its spec, then its colours
  const P = cube.palette, swatch = (name, stops) => `<div class="sw"><span>${esc(name)}</span>${stops.map((h) => `<i style="background:${h}"></i>`).join('')}</div>`;
  const cubeCard = `<div class="h"><b>the geocube</b><span>${esc(P.id)}</span></div>` + lines([
    [`{ ${k('from')}: ${v(cube.id.replace(/-variant$/, ''))},`], [`  ${k('palette')}: { ${k('key')}: ${v(P.key)}, ${k('heat')}: ${v(P.heat)},`],
    [`    ${k('scheme')}: ${v(P.scheme)}, ${k('seed')}: ${v(P.seed)} } }`, 'new'],
  ]) + `<div style="height:6px"></div>` + ['stone', 'floor', 'trim', 'grass', 'foliage', 'water', 'accent'].map((r) => swatch(r, cube.ramps[r])).join('')
    + swatch('sky', [cube.sky.zenith, cube.sky.horizon, cube.sky.fog]);
  // 3. the levels as laid: each its sections and places, and the seed its town's laws held on
  const levelsCard = `<div class="h"><b>the levels, laid</b><span>${levels.length} · from the graph</span></div>` + lines(levels.flatMap((L, i) => [
    [`<span class="w">${esc(L.name)}</span>`],
    ...L.sections.map((s) => [`  ${esc(s)}`]),
    ...L.places.map((p) => [`  ${esc(p)} · by its builders`, 'new']),
    [`  laid on seed ${laid[i]?.seed ?? L.seed}${laid[i]?.laws?.length ? '' : ' · laws hold'}`],
  ]));
  // 4. the run
  const madeCard = `<div class="h"><b>design_game</b><span>run: true</span></div>` + lines((facts.ran ?? []).filter((r) => /: (make|remake)$/.test(r)).map((r) => [esc(r.replace(/: make$/, ' · made')), 'new']));

  const t = (tag, text) => `<span class="t">${tag}</span><span class="r">${text}</span>`;
  const caps = {
    words: t('design_game → compose', 'Each word read against a lexicon and the land, building and tech tunnels. What no word decides, the seed does.'),
    cube: t(`the color theorist → ${P.id}`, `One style for the level's inside and outside: ${esc(P.reads)}. The same palette paints the land, the sky and the HUD.`),
    map: t('the world, from its graph', `${levels.length} levels joined by a road: trails, a climb, a town and its castle.`),
    walk: t('the first level, laid', 'Each section on its own ground: the walk, its beats, the climb to the lookout.'),
    level: t('design_game → run', 'A world before its people: its levels made at once, walked in first person.'),
  };
  const end = `<div class="a">A game level from a sentence.</div><div class="b">Words read into a world, a geocube the color theorist solved,<br>trails and a map laid from a graph, and the level, walkable: the same recipe on every read.</div><div class="c">MOJULO</div>`;

  const F = [];
  const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * x);
  const type = (p, n, base) => { for (let i = 1; i <= n; i++) F.push({ ...base, prompt: p.slice(0, Math.round(p.length * i / n)), cursor: true }); };
  const hold = (n, f) => { for (let i = 0; i < n; i++) F.push({ ...f, cursor: f.cursor && (i % 8 < 4) }); };
  const fade = (n, from, to, extra = {}) => { for (let i = 1; i <= n; i++) F.push({ ...from, ...extra, b: to.a, bSheet: to.aSheet, mix: ease(i / n), ...(to.card ? { card: to.card } : {}), ...(to.cap ? { cap: to.cap, capOp: from.cap === to.cap ? 1 : ease(i / n) } : {}) }); };

  // 1. intent
  hold(4, { prompt: '', cursor: true });
  type(prompt, 22, {});
  hold(3, { prompt });
  for (let i = 0; i < 6; i++) F.push({ prompt, busy: `design_game · compose${'.'.repeat(i % 4)}` });
  const brief = { prompt, a: img('bible-brief'), aSheet: true, cap: caps.words };
  for (let n = 1; n <= read.length + 1; n++) hold(n === 1 ? 6 : 5, { ...brief, card: wordsCard(n) });
  hold(14, { ...brief, card: wordsCard(read.length + 1) });
  // 2. the geocube: its island, its room
  const land = { prompt, a: img('cube-land'), card: cubeCard, cap: caps.cube };
  fade(6, { ...brief, card: wordsCard(read.length + 1) }, land);
  hold(16, land);
  const room = { ...land, a: img('cube-room') };
  fade(6, land, room);
  hold(16, room);
  // 3. the map, then the first level's walk
  const map = { prompt, a: img('bible-map'), aSheet: true, card: levelsCard, cap: caps.map };
  fade(6, room, map);
  hold(20, map);
  const walk = { ...map, a: img('bible-walk'), cap: caps.walk };
  fade(6, map, walk);
  hold(20, walk);
  // 4. the level: two of its own shots, then over the whole of it
  const lv = (n) => ({ prompt, a: img(n), card: madeCard, cap: caps.level });
  for (let i = 0; i < 6; i++) F.push({ ...walk, busy: '', cap: caps.level, card: madeCard });
  fade(6, { ...walk, card: madeCard, cap: caps.level }, lv('level-1'));
  hold(16, lv('level-1'));
  fade(6, lv('level-1'), lv('level-2'));
  hold(14, lv('level-2'));
  fade(8, lv('level-2'), lv('level-aerial'));
  hold(16, lv('level-aerial'));
  const last = lv('level-aerial');
  for (let i = 1; i <= 5; i++) F.push({ ...last, end, endOp: ease(i / 5) });
  hold(24, { ...last, end });

  const frames = path.join(work, 'frames');
  rmSync(frames, { recursive: true, force: true }); mkdirSync(frames);
  const browser = await launch(false);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 500, deviceScaleFactor: 2 });
    await page.goto(pathToFileURL(path.join(here, 'stage.html')).href);
    for (let i = 0; i < F.length; i++) {
      await page.evaluate((f) => window.setFrame(f), F[i]);
      writeFileSync(path.join(frames, `${String(i).padStart(4, '0')}.png`), await page.screenshot({ type: 'png' }));
    }
  } finally { await browser.close(); }

  const pal = path.join(work, 'palette.png'), gif = path.join(work, 'level-demo.gif');
  const ff = (args) => { const r = spawnSync(FFMPEG, ['-loglevel', 'error', '-y', ...args], { stdio: 'inherit' }); if (r.status !== 0) throw new Error('ffmpeg failed'); };
  ff(['-framerate', '12', '-i', path.join(frames, '%04d.png'), '-vf', 'scale=900:500:flags=lanczos,palettegen=max_colors=128:stats_mode=full', pal]);
  ff(['-framerate', '12', '-i', path.join(frames, '%04d.png'), '-i', pal, '-lavfi', 'scale=900:500:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle', '-loop', '0', gif]);
  console.log(`${F.length} frames, ${(F.length / 12).toFixed(1)} s → ${gif}`);
  return gif;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const work = path.resolve(process.argv[2] || '.');
  await compose(work, JSON.parse(readFileSync(path.join(work, 'facts.json'), 'utf8')));
}

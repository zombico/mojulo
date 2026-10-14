// Compose interior-demo.gif from the stills run.mjs leaves in the work dir: state-1..3.png (the room at each
// revision, 600×444 @2x), c1-exterior / c2-day / c3-potlights.png (Cycles, 1200×888) and recipes.json.
//
//   node docs/images/src/interior-demo/compose.mjs <workDir>      # re-compose without re-rendering
//
// Frames are 900×500 @2x through stage.html, then ffmpeg: one 128-colour palette, bayer dither, 12 fps.
import { readFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch } from '../lib/browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const k = (x) => `<span class="k">"${x}"</span>`;
const v = (x) => (typeof x === 'string' ? `<span class="s">"${x}"</span>` : JSON.stringify(x));
const obj = (o) => `{ ${Object.entries(o).map(([a, b]) => `${k(a)}: ${v(b)}`).join(', ')} }`;

/** The recipe as card lines, one key per line, with what changed since the last revision marked. */
function cardLines(rec, prev) {
  const keys = ['kind', 'house', 'room', 'style', 'surface', 'pieces', 'brief'].filter((key) => rec[key] !== undefined);
  const out = [];
  keys.forEach((key, i) => {
    const changed = prev && JSON.stringify(rec[key]) !== JSON.stringify(prev[key]);
    const end = i === keys.length - 1 ? ' }' : ',';
    let ls;
    if (key === 'surface') ls = [`  ${k('surface')}: { ${k('features')}: [`, ...rec.surface.features.map((f, j, a) => `    ${obj(f)}${j === a.length - 1 ? ']}' : ','}`)];
    else if (key === 'pieces') ls = rec.pieces.flatMap((p, j, a) => {
      const { id, ...rest } = p;
      return [`  ${j ? '  ' : `${k('pieces')}: [`}{ ${k('id')}: ${v(id)},`, `    ${Object.entries(rest).map(([a, b]) => `${k(a)}: ${typeof b === 'object' ? obj(b) : v(b)}`).join(', ')} }${j === a.length - 1 ? ']' : ','}`];
    });
    else if (key === 'brief') ls = [`  ${k('brief')}: ${obj(rec.brief)}`];
    else ls = [`${key === 'kind' ? '{ ' : '  '}${k(key)}: ${v(rec[key])}`];
    ls[ls.length - 1] += end;
    for (const l of ls) out.push([l, changed]);
  });
  return out;
}

export async function compose(work, { house, recipes }) {
  const img = (n) => pathToFileURL(path.join(work, `${n}.png`)).href;
  const card = (i) => `<div class="h"><b>the recipe</b><span>${JSON.stringify(recipes[i]).length} bytes · v${i + 1}</span></div>` +
    cardLines(recipes[i], recipes[i - 1]).map(([t, n]) => `<div class="ln${n ? ' new' : ''}">${t}</div>`).join('');
  const houseCard = `<div class="h"><b>the house</b><span>${house} · excerpt</span></div>` + [
    [`{ ${k('kind')}: ${v('floorplan')},`], [`  ${k('rooms')}: [ … ], ${k('doors')}: [ … ],`], [`  ${k('windows')}: true,`],
    [`  ${k('roof')}: true,`, 1], [`  ${k('ceilings')}: true,`, 1], [`  ${k('potLights')}: true }`, 1],
  ].map(([t, n]) => `<div class="ln${n ? ' new' : ''}">${t}</div>`).join('');
  const prompts = [
    'Design my living room: 14 × 18 ft, window to the south, fireplace on the east wall. Japandi.',
    'Make it mid-century, and put the sofa in velvet.',
    'Lose the TV. It’s a reading room now.',
    'Give the house a roof and pot lights, and render it in Blender.',
  ];
  const t = (tag, text) => `<span class="t">${tag}</span><span class="r">${text}</span>`;
  const caps = [
    t('design_interior → v1', 'A house drafted round the room, 10 pieces at true size, focal point the fireplace.'),
    t('design_interior → v2', 'Same room, same pieces by id: restyled mid-century, the sofa in velvet.'),
    t('design_interior → v3', 'TV and console out; the seating re-laid round the fireplace.'),
  ];
  const capCy = [
    t('update_sketch → the house', 'Three fields on the house. Blender Cycles, 160 samples: the roofed exterior.'),
    t('blender-bake --render', 'The room inherits the house: daylight through the south window.'),
    t('blender-bake --render', 'Lights on: 12 recessed cans, exported as real spot lights.'),
  ];
  const end = `<div class="a">Text-to-3D that compiles.</div><div class="b">A ${JSON.stringify(recipes[2]).length}-byte room over a house, revised by conversation.<br>world.html · .glb · .stl · a drawing set · Blender Cycles: the same room on every read.</div><div class="c">MOJULO</div>`;

  const F = [];
  const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * x);
  const type = (p, n, base) => { for (let i = 1; i <= n; i++) F.push({ ...base, prompt: p.slice(0, Math.round(p.length * i / n)), cursor: true }); };
  const hold = (n, f) => { for (let i = 0; i < n; i++) F.push({ ...f, cursor: f.cursor && (i % 8 < 4) }); };

  // v1: the room is made
  hold(4, { prompt: '', cursor: true });
  type(prompts[0], 22, {});
  hold(3, { prompt: prompts[0] });
  for (let i = 0; i < 6; i++) F.push({ prompt: prompts[0], busy: 'design_interior' + '.'.repeat(i % 4) });
  for (let i = 1; i <= 6; i++) { const e = ease(i / 6); F.push({ prompt: prompts[0], a: img('state-1'), aOp: e, card: card(0), cardOp: e, cap: caps[0], capOp: e }); }
  hold(14, { prompt: prompts[0], a: img('state-1'), card: card(0), cap: caps[0] });
  // v2, v3: the same recipe revised
  for (const si of [1, 2]) {
    const prev = { a: img(`state-${si}`), card: card(si - 1) };
    hold(3, { ...prev, prompt: '', cursor: true });
    type(prompts[si], 14, prev);
    hold(4, { ...prev, prompt: prompts[si] });
    for (let i = 1; i <= 5; i++) F.push({ ...prev, prompt: prompts[si], b: img(`state-${si + 1}`), mix: ease(i / 5), card: card(si), cap: caps[si], capOp: ease(i / 5) });
    hold(18, { prompt: prompts[si], a: img(`state-${si + 1}`), card: card(si), cap: caps[si] });
  }
  // the house edit, then Cycles
  const w = { a: img('state-3'), card: card(2), cap: caps[2] };
  hold(3, { ...w, prompt: '', cursor: true });
  type(prompts[3], 16, w);
  hold(3, { ...w, prompt: prompts[3] });
  for (let i = 0; i < 6; i++) F.push({ ...w, prompt: prompts[3], card: houseCard, cap: capCy[0], capOp: 0 });
  let prev = img('state-3');
  ['c1-exterior', 'c2-day', 'c3-potlights'].forEach((sh, j) => {
    for (let i = 1; i <= 6; i++) F.push({ prompt: prompts[3], a: prev, b: img(sh), mix: ease(i / 6), card: houseCard, cap: capCy[j], capOp: j ? 1 : ease(i / 6) });
    hold(j === 2 ? 18 : 14, { prompt: prompts[3], a: img(sh), card: houseCard, cap: capCy[j] });
    prev = img(sh);
  });
  const last = { prompt: prompts[3], a: img('c3-potlights'), card: houseCard, cap: capCy[2] };
  for (let i = 1; i <= 5; i++) F.push({ ...last, end, endOp: ease(i / 5) });
  hold(22, { ...last, end });

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

  const pal = path.join(work, 'palette.png'), gif = path.join(work, 'interior-demo.gif');
  const ff = (args) => { const r = spawnSync(FFMPEG, ['-loglevel', 'error', '-y', ...args], { stdio: 'inherit' }); if (r.status !== 0) throw new Error('ffmpeg failed'); };
  ff(['-framerate', '12', '-i', path.join(frames, '%04d.png'), '-vf', 'scale=900:500:flags=lanczos,palettegen=max_colors=128:stats_mode=full', pal]);
  ff(['-framerate', '12', '-i', path.join(frames, '%04d.png'), '-i', pal, '-lavfi', 'scale=900:500:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle', '-loop', '0', gif]);
  console.log(`${F.length} frames, ${(F.length / 12).toFixed(1)} s → ${gif}`);
  return gif;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const work = path.resolve(process.argv[2] || '.');
  await compose(work, JSON.parse(readFileSync(path.join(work, 'recipes.json'), 'utf8')));
}

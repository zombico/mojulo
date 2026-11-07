// landscape-gen6.jpg and landscape-gen7.jpg: one landscape from a sentence, drawn in two generations of realism.
// The landscape is minted from words (it draws in gen-7, the form render); the same recipe with its cube's `era` set
// to 'gen-6' is the painted render. Both are exported as World pages and shot from the same named camera.
//
//   node docs/images/src/landscape-eras/run.mjs [workDir] [shot]
//
// Same environment as the other runners (a scratch MOJULO_DATA_DIR unless one is set; CHROME_BIN; ffmpeg on PATH).
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { captureShot, runJson } from '../lib/browser.mjs';

const WORDS = 'a lake in the hills at sunset';
const work = path.resolve(process.argv[2] || path.join(tmpdir(), 'mj-landscape-eras'));
const SHOT = process.argv[3] || 'lake';
mkdirSync(work, { recursive: true });
const env = { ...process.env };
env.MOJULO_DATA_DIR ||= path.join(work, 'data');
env.MOJULO_OUTCOMES_DIR ||= path.join(env.MOJULO_DATA_DIR, 'outcomes');
mkdirSync(env.MOJULO_OUTCOMES_DIR, { recursive: true });
const call = (tool, args) => {
  const res = runJson(env, ['scripts/mcp-stdio.mjs', 'call', tool, '--json', JSON.stringify(args)]);
  if (res.ok === false) throw new Error(`${tool}: ${res.error}`);
  return res;
};

// gen-7 from the words, then the same land as the painted gen-6 render: the recipe the words wrote, its era changed
call('create_sketch', { title: 'A lake in the hills (gen-7)', ref: 'land_gen7', manifest: { kind: 'geocube', words: WORDS } }); // no seed: a new scene, so it draws in gen-7
const recipe = call('export_model', { ref: 'land_gen7', format: 'html' });
if (!recipe.ok) throw new Error('export failed');
const stored = JSON.parse(readFileSync(path.join(env.MOJULO_OUTCOMES_DIR, 'land_gen7', 'recipe.json'), 'utf8'));
const m = stored.manifest ?? stored;
if (m.cube?.era !== 'gen-7') throw new Error(`the words minted era ${m.cube?.era}, not gen-7`);
const { words, brief, ...rest } = m;
call('create_sketch', { title: 'A lake in the hills (gen-6)', ref: 'land_gen6', manifest: { ...rest, cube: { ...rest.cube, era: 'gen-6' } } });
call('export_model', { ref: 'land_gen6', format: 'html' });

for (const era of ['gen7', 'gen6']) {
  const page = path.join(env.MOJULO_OUTCOMES_DIR, `land_${era}`, 'world.html');
  const src = readFileSync(page, 'utf8');
  const hit = src.match(new RegExp(`"name":"${SHOT}","pos":(\\[[^\\]]*\\]),"target":(\\[[^\\]]*\\]),"vfov":([\\d.]+)`));
  if (!hit) throw new Error(`${page}: no shot named ${SHOT}`);
  const camera = { pos: JSON.parse(hit[1]), target: JSON.parse(hit[2]), vfov: Number(hit[3]) };
  const raw = path.join(work, `landscape-${era}.png`);
  await captureShot(page, raw, { width: 960, height: 540, shot: SHOT, camera });
  const out = path.join(work, `landscape-${era}.jpg`);
  spawnSync(process.env.FFMPEG || 'ffmpeg', ['-loglevel', 'error', '-y', '-i', raw, '-q:v', '3', out], { stdio: 'inherit' });
  console.log(out);
}

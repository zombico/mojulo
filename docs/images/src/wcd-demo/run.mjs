// The walled-core dungeon demo, cooked: a multi-level military base for a stealth game, from its recipe (world.json)
// to its book and its levels as stills, with no agent in the loop. A new checkout runs it as it is.
//
//   node docs/images/src/wcd-demo/run.mjs [workDir]
//
// Runs mojulo from this checkout's control/ through scripts/mcp-stdio.mjs: the world minted by design_game, every
// part approved, the rail run (its levels made, composed and stocked); then stills.mjs draws the book and each level.
// Without MOJULO_DATA_DIR it uses a fresh data dir under the work dir, so nothing touches ~/.mojulo. Needs a Chromium
// for the stills (MOJULO_CHROMIUM, or a browser on the machine).
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runJson } from '../lib/browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const work = path.resolve(process.argv[2] || path.join(tmpdir(), 'mj-wcd-demo'));
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
export const REF = 'outer_works';
const world = JSON.parse(readFileSync(path.join(here, 'world.json'), 'utf8'));

// 1. the recipe, written; every part approved as the creator would; the rail run
const made = call('design_game', { ref: REF, title: 'Outer works', world });
call('design_game', { ref: REF, approve: made.parts.map((p) => p.id) });
const ran = call('design_game', { ref: REF, run: true });
const levels = Object.fromEntries(Object.entries(ran.made ?? {}).filter(([k]) => k.startsWith('level-')).map(([k, v]) => [k.replace(/^level-|-\d+$/g, ''), v.ref ?? v]));
writeFileSync(path.join(work, 'made.json'), JSON.stringify({ world: REF, levels, game: ran.made?.game?.ref ?? ran.made?.game, advice: ran.advice ?? null }, null, 1));
console.log('made', Object.keys(levels).join(', '));

// 2. the book and the levels as stills
const r = spawnSync(process.execPath, [path.join(here, 'stills.mjs'), work], { stdio: 'inherit', env });
process.exit(r.status ?? 1);

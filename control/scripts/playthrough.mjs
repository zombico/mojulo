// THE PLAYTHROUGH, from the shell: a made game's levels played by a scripted player on the runtime they ship
// (lib/graph/gameworld/playthrough.js), each level resolved as its page resolves it. The machine gate behind "a made game
// is one a player can win": PASS where the basic player wins a level and the still player does not, else what happened.
// Nobody has looked: the eyes gate is the operator's.
//
//   node scripts/playthrough.mjs <world ref> [--level <key>] [--seconds <n>] [--json <path>]
//   (from control/, the database the game was made in: repo-dev exports MOJULO_DATA_DIR and MOJULO_OUTCOMES_DIR, or
//   SQLITE_PATH; a level key is the world's made key, `level-<id>-<n>`; every made level by default)
//
// A level resolves as its page does (the world's scene: its faces, colliders, entities and bus), which takes seconds to a
// minute or two a level; the play itself is under a second.
import { register } from 'node:module';
import { writeFileSync } from 'node:fs';

register('./mcp-stdio-loader.mjs', import.meta.url);
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const ref = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (!ref) { console.error('playthrough: node scripts/playthrough.mjs <world ref> [--level <key>] [--seconds <n>] [--json <path>]'); process.exit(2); }

const { SketchRepository } = await import('../lib/db/repositories/sketches.js');
const { resolveWorldScene } = await import('../lib/graph/worlds/world-scene.js');
const { playLevel, playthroughSummary } = await import('../lib/graph/gameworld/playthrough.js');

const row = SketchRepository.getByRef(ref);
if (!row) { console.error(`playthrough: no sketch '${ref}'`); process.exit(2); }
const made = (row.manifest ?? JSON.parse(row.manifest_json ?? '{}')).made ?? {};
const want = opt('--level'), seconds = Number(opt('--seconds') ?? 180);
const levels = Object.entries(made).filter(([k, v]) => k.startsWith('level-') && v?.ref && (!want || k === want));
if (!levels.length) { console.error(`playthrough: '${ref}' has made no level${want ? ` '${want}'` : ''}`); process.exit(2); }

const out = [];
let fails = 0;
for (const [key, { ref: levelRef }] of levels) {
  const lr = SketchRepository.getByRef(levelRef);
  if (!lr) { console.log(`${key}: no level row ${levelRef}`); continue; }
  const t0 = Date.now();
  const { payload } = await resolveWorldScene(lr);
  const basic = playLevel(payload, { player: 'basic', seconds }), still = playLevel(payload, { player: 'still', seconds });
  const pass = basic.won && !still.won;
  if (!pass) fails++;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${key} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  console.log(`  ${playthroughSummary(basic)}`);
  console.log(`  ${playthroughSummary(still)}`);
  out.push({ key, ref: levelRef, pass, basic, still });
}
const json = opt('--json');
if (json) writeFileSync(json, JSON.stringify(out, null, 2));
console.log(`${out.length - fails}/${out.length} levels won by the basic player and not by the still one`);
process.exit(0);

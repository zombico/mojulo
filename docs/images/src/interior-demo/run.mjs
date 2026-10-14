// interior-demo.gif, end to end: mint the room, revise it twice, give its house a roof and pot lights,
// render three Cycles stills, then compose and encode the GIF.
//
//   node docs/images/src/interior-demo/run.mjs [workDir]
//
// Runs mojulo from this checkout's control/ through scripts/mcp-stdio.mjs. Without MOJULO_DATA_DIR it uses a
// fresh data dir under the work dir, so nothing touches ~/.mojulo. Needs Chrome (CHROME_BIN), Blender
// (MOJULO_BLENDER, or the macOS default) and ffmpeg (FFMPEG, else `ffmpeg` on PATH).
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { captureShot, runJson } from '../lib/browser.mjs';
import { compose } from './compose.mjs';

const work = path.resolve(process.argv[2] || path.join(tmpdir(), 'mj-interior-demo'));
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
const ROOM = 'living_room_demo';
const worldOf = (ref) => path.join(env.MOJULO_OUTCOMES_DIR, ref, 'world.html');

// The pinned dollhouse camera, in the World page's units (feet, y negated). The room's own dollhouse shot
// picks a new corner when the layout changes; one camera for all three keeps the change readable.
const HOUSE_SEED = 1551582078;
const DOLLHOUSE = { pos: [-3.5, -42.1, 40], target: [11.0, -21.6, 0], vfov: 38.910712759307025 };

const steps = [
  { style: 'japandi', ref: ROOM, title: 'Living room',
    section: { room: 'living', size: ['14ft', '18ft'], windows: ['S'], doors: [{ wall: 'W', to: 'hall', at: 0.2 }] },
    surface: { features: [{ type: 'fireplace', wall: 'E' }] } },
  { ref: ROOM, style: 'mid-century', pieces: [{ id: 'conversation.sofa', finish: { fabric: 'velvet' } }] },
  { ref: ROOM, brief: { tags: ['no-tv'] } },
];
const recipes = [];
let house;
for (const [i, args] of steps.entries()) {
  const res = call('design_interior', args);
  if (!house) {
    // A drafted house draws its own seed, and the seed picks its finishes. Pin the one the committed GIF was
    // made with; the interior never writes the house, and the edit reaches every design over it.
    house = res.interior.house;
    call('update_sketch', { ref: house, patch: [{ op: 'set', path: '/seed', value: HOUSE_SEED }] });
  }
  call('export_model', { ref: ROOM, format: 'html' });
  await captureShot(worldOf(ROOM), path.join(work, `state-${i + 1}.png`), { width: 600, height: 444, shot: 'dollhouse', camera: DOLLHOUSE });
  recipes.push(JSON.parse(spawnSync('sqlite3', [path.join(env.MOJULO_DATA_DIR, 'mojulo-lite.db'), `select manifest_json from sketches where ref='${ROOM}';`], { encoding: 'utf8' }).stdout));
  console.log(`v${i + 1}`, JSON.stringify(recipes.at(-1)).length, 'bytes');
}

// The house edit the room inherits, then Cycles. Camera and look are in the recipe frame (feet; blender-bake
// scales by metersPerUnit).
call('update_sketch', { ref: house, patch: [
  { op: 'set', path: '/potLights', value: true }, { op: 'set', path: '/roof', value: true }, { op: 'set', path: '/ceilings', value: true },
] });
const bake = (ref, out, extra) => node(['scripts/blender-bake.mjs', '--ref', ref, '--render', '--res', '1200x888', '--samples', '160', '--out', path.join(work, out), ...extra]);
bake(house, 'c1-exterior.png', ['--camera=-24,-62,30', '--look=15,-14,3', '--fov', '46']);
bake(ROOM, 'c2-day.png', ['--camera=5.2,-12.8,5.2', '--look=12,-19.6,1.8', '--fov', '72']);
bake(ROOM, 'c3-potlights.png', ['--camera=5.6,-13.2,4.4', '--look=13,-20.5,4.2', '--fov', '78', '--sun=-8,30', '--sky', '0.02', '--exposure', '3']);

writeFileSync(path.join(work, 'recipes.json'), JSON.stringify({ house, recipes }, null, 1));
const gif = await compose(work, { house, recipes });
console.log(existsSync(gif) ? gif : 'compose failed');

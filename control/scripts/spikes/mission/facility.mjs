#!/usr/bin/env node
/**
 * THE FACILITY — the infiltration yard's operative, its kit and a guard stood in a geocube level of the seventh
 * generation: a military hangar bay on a land, its hall dressed as a garage, a siege walker parked in it. A spike: the
 * geocube recipe takes no pilot, so the hero's camera and its events are laid on the resolved payload here.
 *
 *   cd control
 *   node scripts/spikes/mission/facility.mjs --out /abs/dir [--cube jungle-haze] [--hour 17] [--hero <ref>] [--guard <ref>]
 *     [--vault speedVault] [--roll rollForward] [--climb climbUp] [--crouch a,b] [--prone a,b] [--cdn] [--capture]
 *
 * `--hero` and `--guard` need the database they were minted in (MOJULO_DATA_DIR), as room.mjs does.
 */
import { register } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const argv = process.argv.slice(2);
const opt = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const hero = opt('--hero'), guard = opt('--guard'), out = path.resolve(opt('--out', 'facility'));
if (!hero && !guard) process.env.SQLITE_PATH ??= ':memory:';
else if (process.env.MOJULO_DATA_DIR) process.env.SQLITE_PATH ??= path.join(process.env.MOJULO_DATA_DIR, 'mojulo-lite.db');
process.env.MOJULO_SEMANTIC_INDEX_DISABLED ??= '1';

const { infiltrationRoom } = await import('../../../lib/graph/gameworld/infiltration-room.js');
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const { RADAR_LOOK } = await import('./lib.mjs');
const { levelHud } = await import('../../../lib/graph/game/hud-mana.js');
const pair = (k) => (opt(k) ? opt(k).split(',') : null);
const G = { id: 'steel-serpents', name: 'Steel Serpents', feel: opt('--feel', 'steel-serpents') };
const room = infiltrationRoom(G, { refs: { ...(hero ? { hero } : {}), ...(guard ? { guard } : {}) }, vault: opt('--vault'), roll: opt('--roll'), climb: opt('--climb'),
  crouch: pair('--crouch') ? { idle: pair('--crouch')[0], walk: pair('--crouch')[1] } : null, prone: pair('--prone') ? { idle: pair('--prone')[0], crawl: pair('--prone')[1] } : null });

const base = { kind: 'geocube', cube: { from: opt('--cube', 'jungle-haze'), era: 'gen-7' }, show: 'path', hour: Number(opt('--hour', 17)), shadows: { actors: true, hour: true },
  buildings: [{ use: 'hangar-bay', look: { construction: 'military', dressing: 'garage' }, yard: { floods: 2, containers: 6 }, apron: 'slab' }] };
// (the first read says where the hall is: its box on the land)
const first = (await resolveWorldScene({ ref: 'steel-serpents-facility', title: 'facility', manifest: base }, { era: 'gen-7', live: true })).payload;
const B = first.anchors.find((a) => a.kind === 'building'), hall = B.rooms.find((r) => /^hangar/.test(r.id)).box;
const feet = [first.walk.spawn[0], first.walk.spawn[1], first.walk.spawn[2] - (first.walk.minEye ?? 1.7)];
const mid = [(hall.min[0] + hall.max[0]) / 2, (hall.min[1] + hall.max[1]) / 2], long = hall.max[0] - hall.min[0] >= hall.max[1] - hall.min[1] ? 0 : 1;
const floor = hall.min[2];
console.log(`facility: hall ${JSON.stringify({ min: hall.min.map((v) => +v.toFixed(1)), max: hall.max.map((v) => +v.toFixed(1)) })} floor ${B.floor} entry ${JSON.stringify(B.entry)} goal ${JSON.stringify(B.goalAt ?? B.goal)} spawn feet ${feet.map((v) => +v.toFixed(2))}`);
// the walker in the hall's middle, along its length; the guard walking its round down one side of it; the yard's
// targets left behind
// (its step a walker's, 0.35: a stair's tread rises 0.3)
// (the hero starts in the hall's far corner (room behind it for the chase), on its floor: the level's own start is the walk's, under the hall's slab)
const at = (dx, dy, z) => (long === 0 ? [mid[0] + dx, mid[1] + dy, z] : [mid[0] + dy, mid[1] + dx, z]);
const start = at(-(hall.max[long] - hall.min[long]) / 2 + 8, (hall.max[1 - long] - hall.min[1 - long]) / 2 - 7, floor + 0.05);
const entities = room.manifest.entities.filter((e) => !/^target-/.test(e.id)).map((e) => (e.id === 'hero' ? { ...e, rule: { ...e.rule, step: 0.35 }, transform: { pos: start, heading: Math.atan2(mid[1] - start[1], mid[0] - start[0]) } }
  : e.id === 'guard-1' ? { ...e, transform: { pos: at(-5, -7, floor), heading: long === 0 ? 0 : Math.PI / 2 } } : e));
const manifest = { ...base, figures: room.manifest.figures, entities, fxStyle: room.manifest.fxStyle,
  parked: [{ vehicle: 'siege walker', at: at(2, 2, floor), heading: long === 0 ? Math.PI : -Math.PI / 2 }] };
const { payload } = await resolveWorldScene({ ref: 'steel-serpents-facility', title: `Facility · ${G.name}`, manifest }, { era: 'gen-7', live: true });
const cdn = argv.includes('--cdn');
// THE BOUNDS. The level's are its trail's: walls along the path a walking tour keeps to, and the building stands across
// them (one splits its hall). A piloted body goes anywhere, so they give way to one perimeter round the trail and the
// building together.
const isBound = (c) => /^bound:/.test(c.of ?? ''), bounds = payload.colliders.filter(isBound), built = payload.colliders.filter((c) => /^hangar-bay/.test(c.of ?? ''));
const lo = (k, m) => Math.min(...bounds.map((c) => c.max[k]), ...built.map((c) => c.min[k] - m)), hi = (k, m) => Math.max(...bounds.map((c) => c.min[k]), ...built.map((c) => c.max[k] + m));
const X0 = lo(0, 3), X1 = hi(0, 3), Y0 = lo(1, 3), Y1 = hi(1, 3), Z0 = Math.min(...bounds.map((c) => c.min[2])) - 4, Z1 = Math.max(...bounds.map((c) => c.max[2])) + 12;
const wallOf = (id, min, max) => ({ of: `bound:facility:${id}`, min: [min[0], min[1], Z0], max: [max[0], max[1], Z1] });
payload.colliders = [...payload.colliders.filter((c) => !isBound(c)),
  wallOf('-x', [X0 - 0.5, Y0 - 0.5], [X0, Y1 + 0.5]), wallOf('+x', [X1, Y0 - 0.5], [X1 + 0.5, Y1 + 0.5]), wallOf('-y', [X0 - 0.5, Y0 - 0.5], [X1 + 0.5, Y0]), wallOf('+y', [X0 - 0.5, Y1], [X1 + 0.5, Y1 + 0.5])];
console.log(`facility: bounds ${bounds.length} of the trail's given way to a perimeter x ${X0.toFixed(1)}..${X1.toFixed(1)}, y ${Y0.toFixed(1)}..${Y1.toFixed(1)}`);
const { walkers: _w, ...P } = payload;
const html = emitThreeWorld({ ...P, camera: room.manifest.camera, events: room.manifest.events, walk: false, spin: false, hud: false, manaHud: levelHud(opt('--theme', 'field-brief'), { radar: RADAR_LOOK }), inline: !cdn, cdn, ...(argv.includes('--capture') ? { capture: true } : {}) });
await fs.mkdir(out, { recursive: true });
if (argv.includes('--dump')) await fs.writeFile(path.join(out, 'level.json'), JSON.stringify({ colliders: payload.colliders, anchors: payload.anchors, walk: payload.walk, keys: Object.keys(payload), hero: payload.entities.find((e) => e.id === 'hero').rule, form: payload.form && Object.keys(payload.form), roofs: payload.roofs && payload.roofs.length }));
const file = path.join(out, 'facility.html');
await fs.writeFile(file, html);
console.log(`facility: ${file} (${(html.length / 1e6).toFixed(1)} MB) · hero ${room.hero} · entities ${payload.entities.map((e) => e.id).join(', ')} · colliders ${payload.colliders.length}`);
process.exit(0);

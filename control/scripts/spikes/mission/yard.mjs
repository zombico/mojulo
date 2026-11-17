#!/usr/bin/env node
/**
 * THE PERIMETER YARD, PLAYED — level 1's second outdoor segment (level1.json) as one page: the stage the game rail lays
 * for the level's `perimeter` section (gameworld/levels.js gameStages: its trail on the geocube's land, the hangar
 * behind its door, the barracks walked into), the operative and its kit, two guards on their rounds, the hangar's key
 * in the barracks' day room, the hangar's door as the way into the hangar's page (hangar.mjs) and the way back, and the
 * mission's one result at the trail's head (worlds/controllable/mission.js). A spike: the stage recipe takes no pilot,
 * so the hero's camera and events are laid on the resolved payload here, and the trail's bounds give way to a perimeter.
 *
 *   cd control
 *   node scripts/spikes/mission/yard.mjs --out /abs/dir [--dry] [--cube jungle-haze] [--hero <ref>] [--guard <ref>]
 *     [--vault …] [--roll …] [--climb …] [--crouch a,b] [--prone a,b] [--hangar-page level-1-hangar.html] [--capture]
 */
import { register } from 'node:module';
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url)), argv = process.argv.slice(2);
const opt = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const hero = opt('--hero'), guard = opt('--guard'), out = path.resolve(opt('--out', 'yard'));
if (!hero && !guard) process.env.SQLITE_PATH ??= ':memory:';
else if (process.env.MOJULO_DATA_DIR) process.env.SQLITE_PATH ??= path.join(process.env.MOJULO_DATA_DIR, 'mojulo-lite.db');
process.env.MOJULO_SEMANTIC_INDEX_DISABLED ??= '1';

const { infiltrationRoom } = await import('../../../lib/graph/gameworld/infiltration-room.js');
const { readGameworld } = await import('../../../lib/graph/gameworld/index.js');
const { gameStages, stageEnds } = await import('../../../lib/graph/gameworld/levels.js');
const { assembleStageScene } = await import('../../../lib/graph/era/stage.js');
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const M = JSON.parse(fss.readFileSync(path.join(here, 'level1.json'), 'utf8')), W0 = JSON.parse(fss.readFileSync(path.join(here, 'world.json'), 'utf8'));
const pair = (k) => (opt(k) ? opt(k).split(',') : null);
const G0 = { id: 'steel-serpents', name: 'Steel Serpents', feel: 'steel-serpents' };
const room = infiltrationRoom(G0, { refs: { ...(hero ? { hero } : {}), ...(guard ? { guard } : {}) }, vault: opt('--vault'), roll: opt('--roll'), climb: opt('--climb'),
  crouch: pair('--crouch') ? { idle: pair('--crouch')[0], walk: pair('--crouch')[1] } : null, prone: pair('--prone') ? { idle: pair('--prone')[0], crawl: pair('--prone')[1] } : null });

// THE STAGE, as the rail lays it for the level's section
const SEG = M.segments.perimeter.stage, { wcd: _game, ...rest } = W0;
const G = readGameworld({ ...rest, style: { ...W0.style, geocube: opt('--cube', 'jungle-haze') }, levels: { infiltration: M.level } });
const laid = gameStages(G).find((s) => s.node === SEG);
if (!laid) { console.error(`yard: the rail lays no stage '${SEG}'`); process.exit(1); }
const stage = laid.manifest, dry = assembleStageScene(stage), ends = stageEnds(stage);
const r2 = (p) => p.map((v) => +v.toFixed(2));
const eye = dry.walk.minEye ?? 1.7, door = ends.doors.find((d) => /hangar/.test(d.id)), barracks = dry.anchors.find((a) => a.kind === 'building' && a.use === 'barracks');
if (!door || !barracks) { console.error('yard: the stage lays no hangar door or no barracks'); process.exit(1); }
const dayRoom = barracks.rooms.find((r) => /^day-room-1/.test(r.id)).box, mid = (b) => [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, b.min[2]];
const beat = (name, k = 0) => ends.beats.filter((b) => b.beat === name)[k]?.at;
// (the start: the trail's head, stood clear of what is built beside it. The rail stands the hangar's shut shell along
// the trail, its corner on the trailhead, so a chase camera behind a body there is in its wall: the body starts six
// metres clear of any building's box, on the side the trail's bounds leave open)
const shut = dry.colliders.filter((c) => /:shut$/.test(c.of ?? '') || /^(hangar-bay|barracks)/.test(c.of ?? ''));
const clear = (x, y) => !shut.some((c) => x > c.min[0] - 6 && x < c.max[0] + 6 && y > c.min[1] - 2 && y < c.max[1] + 2);
let sx = ends.spawn[0]; while (!clear(sx, ends.spawn[1] + 3.5) && sx > ends.spawn[0] - 20) sx -= 0.5;
const start = r2([sx, ends.spawn[1] + 3.5, ends.spawn[2] + 1.2]), outside = r2([door.spawn[0], door.spawn[1], door.spawn[2] - eye + 0.3]);
const mission = {
  items: [{ id: 'hangar-key', name: M.items['hangar-key'].reads, at: r2(mid(dayRoom)) }],
  exits: [{ id: 'hangar-door', name: 'The hangar\'s side door', at: outside, radius: 1.8, needs: { items: ['hangar-key'] }, to: opt('--hangar-page', 'level-1-hangar.html'), door: 'lobby-door' }],
  arrivals: { 'hangar-bay-1': { at: outside, heading: door.heading } },
  objectives: [
    { id: 'key', says: 'find a way into the hangar', done: 'hangar-key' },
    { id: 'brief', says: M.objectives.brief.reads, done: 'intel-manifest' },
    { id: 'true', says: M.objectives.true.reads, after: M.reveal.flag, done: 'intel-siege' },
  ],
  unsure: 'something in that hangar does not add up: go back in',
  result: { at: start, radius: 3.5, when: M.result.when },
};
// the guards: one on the trail between the pockets, one past the buildings, each walking a round along the trail
const g0 = room.manifest.entities.find((e) => e.id === 'guard-1'), lm = beat('landmark') ?? ends.exit, rv = beat('reveal') ?? ends.exit;
const rounds = [{ id: 'guard-1', at: [lm[0] - 2, lm[1] - 6, lm[2] + 0.2], heading: Math.PI / 2 }, { id: 'guard-2', at: [rv[0], rv[1] + 4, rv[2] + 0.2], heading: -Math.PI / 2 }];
const entities = [
  ...room.manifest.entities.filter((e) => e.id === 'hero').map((e) => ({ ...e, rule: { ...e.rule, step: 0.35, mission }, transform: { pos: start, heading: Math.PI / 2 } })),
  ...rounds.map((g) => ({ ...g0, id: g.id, transform: { pos: r2(g.at), heading: g.heading } })),
];
console.log(`yard: start ${start} · hangar door ${outside} · key ${mission.items[0].at} (the barracks' ${barracks.rooms.find((r) => /^day-room-1/.test(r.id)).id}) · guards ${rounds.map((g) => r2(g.at)).join(' | ')}`);
if (argv.includes('--dry')) process.exit(0);

const manifest = { ...stage, figures: room.manifest.figures, entities, fxStyle: room.manifest.fxStyle };
const { payload } = await resolveWorldScene({ ref: 'steel-serpents-level-1-perimeter', title: `${M.name} · the perimeter`, manifest }, { era: 'gen-7', live: true });
// THE BOUNDS: the trail's walls give way to one perimeter round the trail and what is built beside it
const isBound = (c) => /^bound:/.test(c.of ?? ''), bounds = payload.colliders.filter(isBound), built = payload.colliders.filter((c) => /^(hangar-bay|barracks)/.test(c.of ?? ''));
if (bounds.length) {
  const all = [...bounds, ...built], lo = (k) => Math.min(...bounds.map((c) => c.max[k]), ...built.map((c) => c.min[k] - 3)), hi = (k) => Math.max(...bounds.map((c) => c.min[k]), ...built.map((c) => c.max[k] + 3));
  const X0 = lo(0), X1 = hi(0), Y0 = Math.min(lo(1), start[1] - 6), Y1 = hi(1), Z0 = Math.min(...all.map((c) => c.min[2])) - 6, Z1 = Math.max(...all.map((c) => c.max[2])) + 12;
  const wallOf = (id, min, max) => ({ of: `bound:yard:${id}`, min: [min[0], min[1], Z0], max: [max[0], max[1], Z1] });
  payload.colliders = [...payload.colliders.filter((c) => !isBound(c)), wallOf('-x', [X0 - 0.5, Y0 - 0.5], [X0, Y1 + 0.5]), wallOf('+x', [X1, Y0 - 0.5], [X1 + 0.5, Y1 + 0.5]), wallOf('-y', [X0 - 0.5, Y0 - 0.5], [X1 + 0.5, Y0]), wallOf('+y', [X0 - 0.5, Y1], [X1 + 0.5, Y1 + 0.5])];
  console.log(`yard: bounds x ${X0.toFixed(1)}..${X1.toFixed(1)}, y ${Y0.toFixed(1)}..${Y1.toFixed(1)}`);
}
const { walkers: _w, ...P } = payload;
const html = emitThreeWorld({ ...P, camera: room.manifest.camera, events: room.manifest.events, walk: false, spin: false, hud: false, inline: true, ...(argv.includes('--capture') ? { capture: true } : {}) });
await fs.mkdir(out, { recursive: true });
const file = path.join(out, 'level-1-perimeter.html');
await fs.writeFile(file, html);
console.log(`yard: ${file} (${(html.length / 1e6).toFixed(1)} MB) · hero ${room.hero} · entities ${payload.entities.map((e) => e.id).join(', ')} · colliders ${payload.colliders.length}`);
process.exit(0);

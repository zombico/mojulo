#!/usr/bin/env node
/**
 * THE PERIMETER YARD, PLAYED — level 1's second outdoor segment (level1.json) as one page: the stage the game rail lays
 * for the level's `perimeter` section (gameworld/levels.js gameStages: its trail on the geocube's land, the hangar
 * behind its door, the barracks walked into), the operative and its kit, two guards on their rounds, the hangar's key
 * in the barracks' day room, the hangar's door as the way into the hangar's page (hangar.mjs) and the way back, and the
 * mission's one result at the trail's head (worlds/controllable/mission.js). A spike: the stage recipe takes no pilot,
 * so the hero's camera and events are laid on the resolved payload here, and the trail's bounds give way to a perimeter.
 * The section is read as the geocube's own path in the seventh generation, so its land is the form render's, as the
 * hangar's rooms are.
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
const { gameStages } = await import('../../../lib/graph/gameworld/levels.js');
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const { levelHud } = await import('../../../lib/graph/game/hud-mana.js');
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
// THE SEVENTH GENERATION. The rail's stage is `kind: 'stage'` painted by the level's geocube, and the form render (the
// land, the trail and the plants as material under the cube's light) is a geocube scene's alone (worlds/world-scene.js),
// so the stage read as it stands is the painted land beside a form-lit hangar. The same section is asked for here as
// the geocube's own path, in gen-7: its cube, its seed, its trail and its buildings the rail's, dressed as a yard.
const stage = laid.manifest, cubeName = opt('--cube', 'jungle-haze');
const dress = (b) => (b.enter === 'door' ? b : { ...b, apron: 'slab', yard: { floods: 2, containers: 6 } });
const scene = { kind: 'geocube', cube: { from: cubeName, era: 'gen-7' }, show: 'path', seed: stage.seed, trail: stage.trail, hour: Number(opt('--hour', 17)), shadows: { actors: true, hour: true }, solid: true,
  buildings: stage.buildings.map(dress) };
const r2 = (p) => p.map((v) => +v.toFixed(2));
const g0 = room.manifest.entities.find((e) => e.id === 'guard-1'), h0 = room.manifest.entities.find((e) => e.id === 'hero');
// (the bodies stand where the land is read to be: placed on the resolved payload, below)
const manifest = { ...scene, figures: room.manifest.figures, entities: [h0, g0, { ...g0, id: 'guard-2' }], fxStyle: room.manifest.fxStyle, figureGrade: room.manifest.figureGrade };
if (argv.includes('--dry')) { console.log(`yard: ${JSON.stringify(scene)}`); process.exit(0); }
const { payload } = await resolveWorldScene({ ref: 'steel-serpents-level-1-perimeter', title: `${M.name} · the perimeter`, manifest }, { era: 'gen-7', live: true });

// WHERE THINGS ARE, read off the land as it was laid
const A = payload.anchors ?? [], eye = payload.walk?.minEye ?? 1.7;
const hangar = A.find((a) => a.kind === 'building' && a.use === 'hangar-bay'), barracks = A.find((a) => a.kind === 'building' && a.use === 'barracks');
if (!hangar?.door || !barracks?.rooms) { console.error(`yard: the land lays no hangar door or no barracks (${A.filter((a) => a.kind === 'building').map((a) => `${a.use} by ${a.enter}`).join(', ')})`); process.exit(1); }
const door = hangar.door, dayRoomOf = barracks.rooms.find((r) => /^day-room-1/.test(r.id)), dayRoom = dayRoomOf.box, mid = (b) => [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, b.min[2]];
const beats = A.filter((a) => a.kind === 'beat'), beat = (re) => beats.find((b) => re.test(b.id))?.at;
const spawn = [payload.walk.spawn[0], payload.walk.spawn[1], payload.walk.spawn[2] - eye];
// (the start: the trail's head, stood clear of what is built beside it. The rail stands the hangar's shut shell along
// the trail, its corner on the trailhead, so a chase camera behind a body there is in its wall: the body starts six
// metres clear of any building's box)
const shut = payload.colliders.filter((c) => /:shut$/.test(c.of ?? '') || /^(hangar-bay|barracks)/.test(c.of ?? ''));
const clear = (x, y) => !shut.some((c) => x > c.min[0] - 6 && x < c.max[0] + 6 && y > c.min[1] - 2 && y < c.max[1] + 2);
let sx = spawn[0]; while (!clear(sx, spawn[1] + 3.5) && sx > spawn[0] - 20) sx -= 0.5;
const start = r2([sx, spawn[1] + 3.5, spawn[2] + 1.2]), outside = r2([door.spawn[0], door.spawn[1], door.spawn[2] - eye + 0.3]);
const mission = {
  items: [{ id: 'hangar-key', name: M.items['hangar-key'].reads, at: r2(mid(dayRoom)) }],
  exits: [{ id: 'hangar-door', name: 'The hangar\'s side door', at: outside, radius: 1.8, needs: { items: ['hangar-key'] }, to: opt('--hangar-page', 'level-1-hangar.html'), door: 'lobby-door' }],
  // (from the hangar, at its door; from level 0, the approach, at the trail's head)
  arrivals: { 'hangar-bay-1': { at: outside, heading: door.heading }, trailhead: { at: start, heading: Math.PI / 2 } },
  objectives: [
    { id: 'key', says: 'find a way into the hangar', done: 'hangar-key' },
    { id: 'brief', says: M.objectives.brief.reads, done: 'intel-manifest' },
    { id: 'true', says: M.objectives.true.reads, after: M.reveal.flag, done: 'intel-siege' },
  ],
  unsure: 'something in that hangar does not add up: go back in',
  result: { at: start, radius: 3.5, when: M.result.when },
};
// the guards: one on the trail between the pockets, one past the buildings, each walking a round along the trail
const exitAt = beat(/^exit/) ?? spawn, lm = beat(/^landmark/) ?? exitAt, rv = beat(/^reveal/) ?? exitAt;
const rounds = { 'guard-1': { at: [lm[0] - 2, lm[1] - 6, lm[2] + 0.2], heading: Math.PI / 2 }, 'guard-2': { at: [rv[0], rv[1] + 4, rv[2] + 0.2], heading: -Math.PI / 2 } };
payload.entities = payload.entities.map((e) => (e.id === 'hero' ? { ...e, rule: { ...e.rule, step: 0.35, mission }, transform: { pos: start, heading: Math.PI / 2 } }
  : rounds[e.id] ? { ...e, transform: { pos: r2(rounds[e.id].at), heading: rounds[e.id].heading } } : e));
console.log(`yard: start ${start} · hangar door ${outside} · key ${mission.items[0].at} (the barracks' ${dayRoomOf.id}) · guards ${Object.values(rounds).map((g) => r2(g.at)).join(' | ')} · form ${payload.form ? 'yes' : 'NO'}`);
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
const html = emitThreeWorld({ ...P, camera: room.manifest.camera, events: room.manifest.events, walk: false, spin: false, hud: false, manaHud: levelHud(opt('--theme', 'field-brief')), inline: true, ...(argv.includes('--capture') ? { capture: true } : {}) });
await fs.mkdir(out, { recursive: true });
const file = path.join(out, 'level-1-perimeter.html');
await fs.writeFile(file, html);
console.log(`yard: ${file} (${(html.length / 1e6).toFixed(1)} MB) · hero ${room.hero} · entities ${payload.entities.map((e) => e.id).join(', ')} · colliders ${payload.colliders.length}`);
process.exit(0);

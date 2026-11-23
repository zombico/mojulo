#!/usr/bin/env node
/**
 * THE PERIMETER YARD, PLAYED — level 1's second outdoor segment (level1.json) as one page: the stage the game rail lays
 * for the level's `perimeter` section (gameworld/levels.js gameStages: its trail on the geocube's land, the hangar
 * behind its door, the barracks walked into, past it: the segment's `barracks`, its place and plan), the operative and
 * its kit, two guards on their rounds outside and a sentry walking the barracks' corridor to the key (the segment's
 * `barracks.sentry`), the hangar's key in the room the segment names (`barracks.key`), the hangar's door as the way into the hangar's page (hangar.mjs) and the way back, and the
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
const { RADAR_LOOK } = await import('./lib.mjs');
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
// (the barracks: where the segment seats it and how it is planned, its own words over the rail's)
const BK = M.segments.perimeter.barracks ?? null, plan = BK ? Object.fromEntries(['at', 'storeys', 'wings', 'loading', 'bays', 'scale'].filter((k) => BK[k] !== undefined).map((k) => [k, BK[k]])) : {};
const dress = (b) => (b.enter === 'door' ? b : { ...b, ...(b.use === 'barracks' ? plan : {}), apron: 'slab', yard: { floods: 2, containers: 6 } });
// (the segment's night: its hour, the cube's light over the preset's (the night's register, its sky), its air and the
// frame's grade, as level 0's approach is; `--hour` a number over it)
const PS = M.segments.perimeter, hourOf = opt('--hour') != null ? Number(opt('--hour')) : PS.hour ?? 17;
const scene = { kind: 'geocube', cube: { from: cubeName, era: 'gen-7', ...(PS.light ? { light: PS.light } : {}) }, show: 'path', seed: stage.seed, trail: stage.trail, hour: hourOf, shadows: { actors: true, hour: true },
  ...(PS.air ? { air: PS.air } : {}), ...(PS.grade ? { grade: PS.grade } : {}), ...(Number.isFinite(PS.cone) ? { cone: PS.cone } : {}), solid: true,
  buildings: stage.buildings.map(dress) };
const r2 = (p) => p.map((v) => +v.toFixed(2));
const g0 = room.manifest.entities.find((e) => e.id === 'guard-1'), h0 = room.manifest.entities.find((e) => e.id === 'hero');
// (the bodies stand where the land is read to be: placed on the resolved payload, below)
const manifest = { ...scene, figures: room.manifest.figures, entities: [h0, g0, { ...g0, id: 'guard-2' }, ...(BK?.sentry ? [{ ...g0, id: 'guard-3' }] : [])], fxStyle: room.manifest.fxStyle, figureGrade: room.manifest.figureGrade };
if (argv.includes('--dry')) { console.log(`yard: ${JSON.stringify(scene)}`); process.exit(0); }
const { payload } = await resolveWorldScene({ ref: 'steel-serpents-level-1-perimeter', title: `${M.name} · the perimeter`, manifest }, { era: 'gen-7', live: true });

// WHERE THINGS ARE, read off the land as it was laid
const A = payload.anchors ?? [], eye = payload.walk?.minEye ?? 1.7;
const hangar = A.find((a) => a.kind === 'building' && a.use === 'hangar-bay'), barracks = A.find((a) => a.kind === 'building' && a.use === 'barracks');
if (!hangar?.door || !barracks?.rooms) { console.error(`yard: the land lays no hangar door or no barracks (${A.filter((a) => a.kind === 'building').map((a) => `${a.use} by ${a.enter}`).join(', ')})`); process.exit(1); }
// (each building's extent on the yard, said: where a larger one fits is read off this)
for (const a of A.filter((x) => x.kind === 'building')) { const bs = (a.rooms ?? []).map((r) => r.box), b = bs.length ? [Math.min(...bs.map((q) => q.min[0])), Math.min(...bs.map((q) => q.min[1])), Math.max(...bs.map((q) => q.max[0])), Math.max(...bs.map((q) => q.max[1]))] : null; console.log(`yard: building ${a.id ?? a.use} ${b ? `x ${b[0].toFixed(1)}..${b[2].toFixed(1)}, y ${b[1].toFixed(1)}..${b[3].toFixed(1)}` : `(a shell: ${Object.keys(a).join(', ')}; ${JSON.stringify(a.footprint ?? a.box ?? a.rect ?? a.door ?? null)})`}`); }
const door = hangar.door, dayRoomOf = barracks.rooms.find((r) => r.id === BK?.key) ?? barracks.rooms.find((r) => /^day-room-1/.test(r.id)), dayRoom = dayRoomOf.box, mid = (b) => [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, b.min[2]];
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
  items: [{ id: 'hangar-key', name: M.items['hangar-key'].reads, look: 'keycard', at: r2(mid(dayRoom)) }],
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
// (with the barracks past the hangar's door, the second walks the trail between the two)
const pd = beat(/^pocket-2/) ?? rv, mid2 = BK ? [(pd[0] + rv[0]) / 2, (pd[1] + rv[1]) / 2, (pd[2] + rv[2]) / 2] : [rv[0], rv[1] + 4, rv[2]];
// (a guard's post out of every building's walls: slid back along the trail toward the pocket until it stands clear)
const walls = [...payload.colliders.filter((c) => c.max[2] - c.min[2] > 1.2 && (c.max[0] - c.min[0]) * (c.max[1] - c.min[1]) > 0.5), ...barracks.rooms.map((r) => r.box)];
const inWalls = (x, y) => walls.some((c) => x > c.min[0] - 1.5 && x < c.max[0] + 1.5 && y > c.min[1] - 1.5 && y < c.max[1] + 1.5);
for (let k = 0; k <= 40 && inWalls(mid2[0], mid2[1]); k++) { const t = 0.025; mid2[0] += (pd[0] - mid2[0]) * t * 4; mid2[1] += (pd[1] - mid2[1]) * t * 4; }
const rounds = { 'guard-1': { at: [lm[0] - 2, lm[1] - 6, lm[2] + 0.2], heading: Math.PI / 2 }, 'guard-2': { at: [mid2[0], mid2[1], mid2[2] + 0.2], heading: -Math.PI / 2 } };
// THE SENTRY: the barracks' corridor to the key walked end to end (a patrol's ends, as level 0 lays them), from a metre
// short of the core to the key room's near edge, looking round at each end; in the corridor it sees a body at its elbow
let sentry = null;
if (BK?.sentry) {
  const S = BK.sentry, C = barracks.rooms.find((r) => r.id === S.corridor)?.box;
  if (!C) { console.error(`yard: the barracks lays no corridor '${S.corridor}' (${barracks.rooms.map((r) => r.id).join(', ')})`); process.exit(1); }
  const ax = C.max[0] - C.min[0] > C.max[1] - C.min[1] ? 0 : 1, cx = (C.min[1 - ax] + C.max[1 - ax]) / 2, K = dayRoom, kc = (K.min[ax] + K.max[ax]) / 2;
  // (the key's end of the corridor: the end its room is nearer; the far end its other)
  const keyEnd = Math.abs(kc - C.min[ax]) < Math.abs(kc - C.max[ax]) ? 'min' : 'max', far = keyEnd === 'min' ? C.max[ax] - 1 : C.min[ax] + 1;
  // (a corridor too short for a round between the key's room and its far end, a wing a bay long: walked end to end)
  const near0 = keyEnd === 'min' ? K.max[ax] + 0.8 : K.min[ax] - 0.8, near = Math.abs(near0 - far) < 4 ? (keyEnd === 'min' ? C.min[ax] + 1 : C.max[ax] - 1) : near0;
  const pt = (u) => r2(ax ? [cx, u, C.min[2] + 0.2] : [u, cx, C.min[2] + 0.2]);
  sentry = { from: pt(far), to: pt(near), S };
}
const sentryOf = (e) => {
  const { from, to, S } = sentry, heading = Math.atan2(to[1] - from[1], to[0] - from[0]);
  return { ...e, rule: { ...e.rule, speed: S.speed ?? 1.2, sightCone: S.cone ?? 0.8, sightRange: S.range ?? 12, ...(S.near ? { near: S.near } : {}),
    foe: { ...e.rule.foe, stretch: +Math.hypot(to[0] - from[0], to[1] - from[1]).toFixed(2), ends: [from, to], ...(S.look ? { patrol: { ...(e.rule.foe?.patrol ?? {}), look: S.look } } : {}) } }, transform: { pos: from, heading } };
};
payload.entities = payload.entities.map((e) => (e.id === 'hero' ? { ...e, rule: { ...e.rule, step: 0.35, mission }, transform: { pos: start, heading: Math.PI / 2 } }
  : e.id === 'guard-3' && sentry ? sentryOf(e)
  : rounds[e.id] ? { ...e, transform: { pos: r2(rounds[e.id].at), heading: rounds[e.id].heading } } : e));
// THE FLOODLIGHTS (the segment's `floods`: scene/channels/form-floods.js), seated on the land where it was laid: each lamp
// `height` metres over its ground, on a mast where it says one (else on the wall it hangs from), aimed at the ground
if (PS.floods && payload.form?.land) {
  const { readFloods } = await import('../../../lib/graph/scene/channels/form-floods.js');
  const { groundOf } = await import('./lib.mjs');
  const gz = groundOf(payload), zAt = (p) => gz(p[0], p[1]) ?? spawn[2];
  payload.form.land.floods = readFloods(PS.floods.map((f) => ({ at: r2([f.at[0], f.at[1], zAt(f.at) + (f.height ?? 6)]), aim: r2([f.aim[0], f.aim[1], zAt(f.aim)]),
    ...(f.mast ? { mast: +zAt(f.at).toFixed(2) } : {}), ...Object.fromEntries(Object.entries(f).filter(([k]) => ['colour', 'power', 'cone', 'reach', 'shadow'].includes(k))) })));
}
console.log(`yard: start ${start} · hangar door ${outside} · key ${mission.items[0].at} (the barracks' ${dayRoomOf.id}) · guards ${Object.values(rounds).map((g) => r2(g.at)).join(' | ')}${sentry ? ` · sentry ${sentry.from} ↔ ${sentry.to}` : ''} · ${scene.hour} h${payload.form?.land?.floods ? ` · floods ${payload.form.land.floods.length}` : ''} · form ${payload.form ? 'yes' : 'NO'}`);
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
const html = emitThreeWorld({ ...P, camera: room.manifest.camera, events: room.manifest.events, walk: false, spin: false, hud: false, manaHud: levelHud(opt('--theme', 'field-brief'), { radar: RADAR_LOOK }), inline: true, ...(argv.includes('--capture') ? { capture: true } : {}) });
await fs.mkdir(out, { recursive: true });
const file = path.join(out, 'level-1-perimeter.html');
await fs.writeFile(file, html);
console.log(`yard: ${file} (${(html.length / 1e6).toFixed(1)} MB) · hero ${room.hero} · entities ${payload.entities.map((e) => e.id).join(', ')} · colliders ${payload.colliders.length}`);
process.exit(0);

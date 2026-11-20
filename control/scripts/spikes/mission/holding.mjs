#!/usr/bin/env node
/**
 * THE HOLDING BLOCK, PLAYED — a level of the `holding` kind (gameworld/level-kinds.js) as one page: the cell block
 * (era/programs.js `cell-block`: a sally port and processing, the cells both sides of a long corridor), the operative
 * in its last cell with the kit taken (worlds/controllable/carry.js `locked`: bare hands until the kit is held), the kit
 * on the processing desk, a turnkey walking the cell corridor end to end and a desk sergeant crossing the sally port,
 * each looking round at its ends (their routine: the ways out are timed against it), and the front door the way out,
 * reached holding the kit (worlds/controllable/mission.js `result`). Its design is holding.json, in the building's own
 * room names; this lays it on the rooms the building has.
 *
 * THE LAWS (`--plan`, no page): the route search (gameworld/stealth-routes.js) over the building's own walls, the
 * guards on their rounds: from the cell to the door, the straight way is seen and a way unseen exists by the round alone
 * (bare hands, no takedown); the kit is on a way out (a way unseen from the cell to it, and from it to the door); and a
 * vent (era/vents.js) runs from the cell to the kit's room, the corridors shut: a crawl the guards never see.
 *
 *   cd control
 *   node scripts/spikes/mission/holding.mjs --plan
 *   node scripts/spikes/mission/holding.mjs --out /abs/dir [--hero <ref>] [--guard <ref>] [--vault …] [--roll …]
 *     [--climb …] [--crouch a,b] [--prone a,b] [--cdn] [--capture]
 */
import { register } from 'node:module';
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const { options, database, starterRoom, writePage } = await import('./lib.mjs');
const o = options(process.argv.slice(2)), out = path.resolve(o.opt('--out', 'holding'));
database(o.opt('--hero'), o.opt('--guard'));

const { buildingStage } = await import('../../../lib/graph/gameworld/levels.js');
const { assembleStageScene } = await import('../../../lib/graph/era/stage.js');
const { sneakRoutes } = await import('../../../lib/graph/gameworld/stealth-routes.js');
const L = JSON.parse(fss.readFileSync(path.join(here, 'holding.json'), 'utf8'));
const r2 = (p) => p.map((v) => +v.toFixed(2));
const mid = (b, dx = 0, dy = 0) => [(b.min[0] + b.max[0]) / 2 + dx, (b.min[1] + b.max[1]) / 2 + dy, b.min[2]];

// THE BUILDING, and its rooms by name
const stage = buildingStage({ use: L.building.use, seed: L.building.seed, ...(L.building.scale ? { scale: L.building.scale } : {}), ...(L.building.vents ? { vents: L.building.vents } : {}) });
const dry = assembleStageScene(stage), R = Object.fromEntries(dry.rooms.map((r) => [r.id.replace(/@\d+$/, ''), r.box]));
const need = [L.start.room, L.kit.room, L.exit.room, ...L.watchers.map((w) => w.room)].filter((id) => !R[id]);
if (need.length) { console.error(`holding: the building lays no ${need.join(', ')} (rooms: ${Object.keys(R).join(', ')})`); process.exit(1); }
const core = Object.keys(R).find((id) => /^core/.test(id));
const start = r2(mid(R[L.start.room])), kit = r2(mid(R[L.kit.room]));
// (the way out: the exit room's front, the building's way in, half a metre in from its outer wall)
const X = R[L.exit.room], door = r2([(X.min[0] + X.max[0]) / 2, X.min[1] + 0.5, X.min[2]]);

// THE GUARDS' ROUNDS: a patrol along its room's long axis (or the axis it names), from the end it names (`far`: the end
// away from the core) to the other, `inset` metres in from each end
const roundOf = (w) => {
  const B = R[w.room], ax = w.axis ? (w.axis === 'x' ? 0 : 1) : B.max[0] - B.min[0] > B.max[1] - B.min[1] ? 0 : 1, c = (B.min[1 - ax] + B.max[1 - ax]) / 2, ins = w.inset ?? 1;
  const C = R[core], cc = C ? (C.min[ax] + C.max[ax]) / 2 : B.min[ax], nearLo = Math.abs(B.min[ax] - cc) < Math.abs(B.max[ax] - cc);
  const lo = B.min[ax] + ins, hi = B.max[ax] - ins, [a, b] = w.from === 'far' ? (nearLo ? [hi, lo] : [lo, hi]) : nearLo ? [lo, hi] : [hi, lo];
  const pt = (u) => r2(ax ? [c, u, B.min[2]] : [u, c, B.min[2]]);
  return { ...w, at: pt(a), to: pt(b) };
};
const rounds = L.watchers.map(roundOf);

// THE LAWS: the route search over the building's walls, the guards on their rounds
const boxes = (dry.colliders ?? []).map((c) => ({ min: c.min, max: c.max }));
const xs = dry.rooms.flatMap((r) => [r.box.min[0], r.box.max[0]]), ys = dry.rooms.flatMap((r) => [r.box.min[1], r.box.max[1]]);
const bounds = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
const watchers = rounds.map((w) => ({ id: w.id, at: [w.at[0], w.at[1]], to: [w.to[0], w.to[1]], speed: w.speed, cone: w.cone, range: w.range, eye: 1.35, hear: 7, ...(w.look ? { look: w.look } : {}), ...(w.near ? { near: w.near } : {}) }));
const search = (a, b) => sneakRoutes({ bounds, boxes, watchers, start: [a[0], a[1]], goal: [b[0], b[1]], goalRadius: 1.2, seconds: 300, cell: 0.5 });
const say = (r) => (r ? `${r.seconds} s (waits ${r.waits}, crouches ${r.crouch} m, crawls ${r.crawl} m, ${r.detour}× the straight way, never nearer a watcher than ${r.nearest} m)` : 'none');
const out1 = search(start, door), toKit = search(start, kit), fromKit = search(kit, door);
// (the vent: the corridors shut to the search, so the only way from the cell to the kit is the duct behind the row)
const shutCorridors = dry.rooms.filter((r) => /^corridor/.test(r.id)).map((r) => ({ min: [r.box.min[0], r.box.min[1], 0], max: [r.box.max[0], r.box.max[1], 3] }));
const vented = (dry.vents ?? []).length ? sneakRoutes({ bounds, boxes: [...boxes, ...shutCorridors], watchers, start: [start[0], start[1]], goal: [kit[0], kit[1]], goalRadius: 1.2, seconds: 300, cell: 0.5 }) : null;
const laws = [
  { law: 'the-kit-is-taken', holds: true, says: 'bare hands until the kit is held (carry.js `locked`)' },
  { law: 'the-straight-way-out-is-seen', holds: !!out1.direct.seen, says: out1.direct.seen ? `seen by ${out1.direct.seen.by} after ${out1.direct.seen.t} s` : 'the straight way is not seen' },
  { law: 'a-way-out-unseen-by-the-round-alone', holds: !!out1.sneak, says: say(out1.sneak) },
  { law: 'the-kit-is-on-a-way-out', holds: !!(toKit.sneak && fromKit.sneak), says: `to it ${say(toKit.sneak)}; from it to the door ${say(fromKit.sneak)}` },
  { law: 'a-vent-to-the-kit', holds: !!vented?.sneak && vented.sneak.crawl > 3, says: vented?.sneak ? `the corridor shut, through the duct behind the row: ${say(vented.sneak)}` : (dry.vents ?? []).length ? 'no way from the cell to the kit but the corridor' : 'the building has no vents' },
  { law: 'no-way-out-needs-a-kill', holds: !!out1.sneak, says: out1.sneak ? 'a way unseen with bare hands and no takedown' : 'none without one' },
];
console.log(`holding: start ${start} (${L.start.room}) · kit ${kit} (${L.kit.room}) · door ${door} · rounds ${rounds.map((w) => `${w.id} ${w.at} ↔ ${w.to}`).join(' | ')}`);
for (const l of laws) console.log(`holding:   ${l.holds ? 'holds' : 'BREAKS'} · ${l.law}: ${l.says}`);
if (o.has('--plan')) process.exit(laws.every((l) => l.holds) ? 0 : 2);

// THE PAGE: the operative in its cell, the kit taken; the guards on their rounds; the kit on the desk; the front door
const { room, hero: h0, guard: g0 } = await starterRoom(o);
const mission = {
  items: [{ id: 'kit', name: L.kit.reads, look: 'document', at: kit }],
  objectives: [{ id: 'kit', says: 'get the kit back, then out the front door', done: 'kit' }],
  result: { at: door, radius: 2.2, when: ['kit'] },
  unsure: 'not without the kit',
  hints: [{ at: start, radius: 2.5, says: 'The kit is gone: bare hands. The turnkey walks the corridor and looks round at each end; go while his back is turned.' }],
};
const guardOf = (w) => {
  const heading = Math.atan2(w.to[1] - w.at[1], w.to[0] - w.at[0]);
  return { ...g0, id: w.id, rule: { ...g0.rule, speed: w.speed, sightCone: w.cone, sightRange: w.range, ...(w.near ? { near: w.near } : {}),
    foe: { ...g0.rule.foe, stretch: +Math.hypot(w.to[0] - w.at[0], w.to[1] - w.at[1]).toFixed(2), ends: [w.at, w.to], ...(w.look ? { patrol: { ...(g0.rule.foe?.patrol ?? {}), look: w.look } } : {}) } },
    transform: { pos: r2([w.at[0], w.at[1], w.at[2] + 0.05]), heading } };
};
const entities = [
  { ...h0, rule: { ...h0.rule, step: 0.35, mission, carry: { ...(h0.rule.carry ?? {}), locked: 'kit' } }, transform: { pos: r2([start[0], start[1], start[2] + 0.05]), heading: Math.PI / 2 } },
  ...rounds.map(guardOf),
];
const manifest = { ...stage, figures: room.manifest.figures, entities, fxStyle: room.manifest.fxStyle, figureGrade: room.manifest.figureGrade };
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { payload } = await resolveWorldScene({ ref: 'steel-serpents-holding-block', title: `${L.name} · Steel Serpents`, manifest }, { era: 'gen-7', live: true });
const page = await writePage(payload, room, path.join(out, 'holding-block.html'), { capture: o.has('--capture'), cdn: o.has('--cdn') });
console.log(`holding: ${page.file} (${page.mb} MB) · entities ${payload.entities.map((e) => e.id).join(', ')} · colliders ${payload.colliders.length}`);
process.exit(0);

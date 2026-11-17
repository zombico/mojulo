#!/usr/bin/env node
/**
 * LEVEL 0, THE APPROACH — the starter's first segment as one page: the geocube's land and nothing built on it, the
 * controls told where they are first needed, and two places that ask for a sneak (level0.json: a chokepoint, an
 * outpost). Its cover is what a patrol parked and laid and what the land grew; its ways through are FOUND, not drawn:
 * the planner (level0-plan.mjs on gameworld/stealth-routes.js) searches each point and says whether the first try is
 * seen, whether a way unseen is left, what it costs, and whether there is a second.
 *
 *   cd control
 *   node scripts/spikes/mission/level0.mjs --out /abs/dir [--plan] [--hero <ref>] [--guard <ref>] [--vault …] [--roll …]
 *     [--climb …] [--crouch a,b] [--prone a,b] [--next level-1-perimeter.html] [--capture]
 *
 * `--plan`: the plan alone (its laws printed, its map written as level-0-plan.svg), no page; it needs the land's facts,
 * kept beside the page from the last build (level-0-facts.json), else it lays the land first. A change to level0.json is
 * tried with `--plan` in a second, and built once it holds.
 */
import { register } from 'node:module';
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const { options, database, starterRoom, groundOf, writePage } = await import('./lib.mjs');
const o = options(process.argv.slice(2)), out = path.resolve(o.opt('--out', 'level-0'));
database(o.opt('--hero'), o.opt('--guard'));
const { planLevel, planSvg, coverOf, watchersOf, GUARD } = await import('./level0-plan.mjs');
const { readGameworld } = await import('../../../lib/graph/gameworld/index.js');
const { gameStages } = await import('../../../lib/graph/gameworld/levels.js');
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const L = JSON.parse(fss.readFileSync(path.join(here, 'level0.json'), 'utf8')), M1 = JSON.parse(fss.readFileSync(path.join(here, 'level1.json'), 'utf8')), W0 = JSON.parse(fss.readFileSync(path.join(here, 'world.json'), 'utf8'));
const factsFile = path.join(out, 'level-0-facts.json'), r2 = (p) => p.map((v) => +v.toFixed(2));

// THE LAND, as the rail lays the level's section, asked for as the geocube's own path in the seventh generation
const { wcd: _game, ...rest } = W0;
const G = readGameworld({ ...rest, style: { ...W0.style, geocube: L.cube }, levels: { infiltration: M1.level } });
const stage = gameStages(G).find((s) => s.node === L.section)?.manifest;
if (!stage) { console.error(`level 0: the rail lays no section '${L.section}'`); process.exit(1); }
const cover = coverOf(L);
const report = (plan) => { for (const P of plan.points) { const R = P.routes, w = (x) => (x ? `${x.seconds} s (waits ${x.waits}, crouches ${x.crouch} m, crawls ${x.crawl} m, ${x.detour}× the straight way)` : 'none'); console.log(`level 0: ${P.id}: first try ${R.direct?.seen ? `seen by ${R.direct.seen.by} after ${R.direct.seen.t} s` : 'not seen'} · unseen ${w(R.sneak)} · second ${w(R.other)}`); } for (const l of plan.laws) console.log(`level 0:   ${l.holds ? 'holds' : 'ADVISED'} · ${l.law}: ${l.says}`); };
const fieldOf = (colliders) => { const B = colliders.filter((c) => /^bound:/.test(c.of ?? '')); return B.length === 4 ? [Math.min(...B.map((c) => c.max[0])), Math.min(...B.map((c) => c.max[1])), Math.max(...B.map((c) => c.min[0])), Math.max(...B.map((c) => c.min[1]))] : [-8, 0, 30, 75.5]; };

if (o.has('--plan') && fss.existsSync(factsFile)) {
  const F = JSON.parse(fss.readFileSync(factsFile, 'utf8')), plan = planLevel(L, F.colliders, F.field);
  report(plan); await fs.writeFile(path.join(out, 'level-0-plan.svg'), planSvg(L, plan, F.field, F.trail));
  console.log(`level 0: ${path.join(out, 'level-0-plan.svg')}`); process.exit(0);
}

const { room, hero: h0, guard: g0 } = await starterRoom(o);
const scene = { kind: 'geocube', cube: { from: L.cube, era: 'gen-7' }, show: 'path', seed: stage.seed, trail: stage.trail, hour: L.hour, shadows: { actors: true, hour: true }, parked: cover.parked,
  figures: room.manifest.figures, entities: [h0, ...L.watchers.map((w) => ({ ...g0, id: w.id }))], fxStyle: room.manifest.fxStyle };
const { payload } = await resolveWorldScene({ ref: 'steel-serpents-level-0', title: `${L.name} · Steel Serpents`, manifest: scene }, { era: 'gen-7', live: true });

// THE GROUND: everything stands on the land as it was laid
const ground = groundOf(payload), zAt = (p) => ground(p[0], p[1]) ?? 0, on = (p, lift = 0) => r2([p[0], p[1], zAt(p) + lift]);
const field = fieldOf(payload.colliders), trail = (payload.anchors ?? []).filter((a) => a.kind === 'beat').map((a) => a.at);
await fs.mkdir(out, { recursive: true });
await fs.writeFile(factsFile, JSON.stringify({ field, trail, colliders: payload.colliders.filter((c) => /^(shrub|bound)/.test(c.of ?? '')) }));
const plan = planLevel(L, payload.colliders, field);
report(plan); await fs.writeFile(path.join(out, 'level-0-plan.svg'), planSvg(L, plan, field, trail));
if (o.has('--plan')) process.exit(0);

// what is parked is set on the ground under it (the recipe gave it no height), its box with it
const parkedIds = payload.entities.filter((e) => /^parked-/.test(e.id)).map((e) => e.id);
payload.entities = payload.entities.map((e) => { const k = parkedIds.indexOf(e.id); if (k < 0) return e; const z = zAt(e.transform.pos); return { ...e, transform: { ...e.transform, pos: [e.transform.pos[0], e.transform.pos[1], e.transform.pos[2] + z] } }; });
payload.colliders = payload.colliders.map((c) => { if (c.of || !cover.parked.length) return c; const z = zAt([(c.min[0] + c.max[0]) / 2, (c.min[1] + c.max[1]) / 2]); return { ...c, min: [c.min[0], c.min[1], c.min[2] + z - 0.6], max: [c.max[0], c.max[1], c.max[2] + z] }; });
// what is laid: a box on the ground, a body to see and a collider to hide behind
const LOOK = { log: 0x5b4630, crate: 0x6b6a4a };
for (const b of cover.laid) {
  const z = zAt(b.at), low = b.size[2] < 0.7;
  payload.entities.push({ id: `cover-${b.id}`, rule: { type: 'static' }, transform: { pos: [b.at[0], b.at[1], z + b.size[2] / 2], heading: 0 }, body: { type: 'mesh', shape: 'box', size: b.size, color: low ? LOOK.log : LOOK.crate, marker: false } });
  payload.colliders.push({ of: `cover:${b.id}`, min: [b.at[0] - b.size[0] / 2, b.at[1] - b.size[1] / 2, z - 0.4], max: [b.at[0] + b.size[0] / 2, b.at[1] + b.size[1] / 2, z + b.size[2]] });
}
// THE WATCHERS: the starter's guard on each round (a patrol between its posts; a post stood still, looking one way)
const W = Object.fromEntries(L.watchers.map((w) => [w.id, w]));
const mission = {
  hints: L.hints.map((h) => ({ at: on(h.at), says: h.says, radius: h.radius ?? 3.5 })),
  exits: [{ id: 'trail-end', name: 'On to the base', at: on(L.exit, 0.3), radius: 3, to: o.opt('--next', 'level-1-perimeter.html'), door: 'trailhead' }],
  objectives: [{ id: 'reach', says: 'follow the trail up to the base, unseen', done: 'the-base' }],
};
payload.entities = payload.entities.map((e) => {
  if (e.id === 'hero') return { ...e, rule: { ...e.rule, step: 0.35, mission }, transform: { pos: on(L.start, 0.3), heading: Math.PI / 2 } };
  const w = W[e.id]; if (!w) return e;
  const to = w.kind === 'patrol' ? w.to : w.facing, heading = Math.atan2(to[1] - w.at[1], to[0] - w.at[0]);
  return { ...e, rule: { ...e.rule, speed: w.kind === 'patrol' ? (w.speed ?? GUARD.speed) : 0, sightCone: w.cone ?? GUARD.cone, sightRange: w.range ?? GUARD.range,
    foe: { ...e.rule.foe, stretch: w.kind === 'patrol' ? +Math.hypot(to[0] - w.at[0], to[1] - w.at[1]).toFixed(2) : 10 } }, transform: { pos: on(w.at, 0.2), heading } };
});
console.log(`level 0: start ${on(L.start)} · exit ${on(L.exit)} · watchers ${watchersOf(L).map((w) => w.id).join(', ')} · parked ${parkedIds.length} · laid ${cover.laid.length} · form ${payload.form ? 'yes' : 'NO'}`);
const page = await writePage(payload, room, path.join(out, 'level-0-approach.html'), { capture: o.has('--capture'), events: { ...(room.manifest.events ?? {}), hud: [] } });
console.log(`level 0: ${page.file} (${page.mb} MB) · entities ${payload.entities.map((e) => e.id).join(', ')}`);
process.exit(0);

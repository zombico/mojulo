#!/usr/bin/env node
/**
 * THE OFFSHORE RIG, PROVED AND PLAYED — a rig from the shelf (lib/graph/offshore/rigs.js) planned from its tiles
 * (offshore/plan.js: the floors of its decks, the rails and columns found on them, its legs, stairs and modules), held
 * to its laws (offshore/laws.js), and each deck crossed by the route search (gameworld/stealth-routes.js) from the way
 * onto it to the way off it under the rounds that watch it. The page is the rig built (offshore/build.js) over the
 * sea on the controllable world: the operative at the boat landing, the guards on their rounds, the driller's cabin the
 * goal. A designer's walk: it starts in invisible mode (worlds/controllable/ghost.js; I toggles it, `--seen` starts seen).
 *
 *   cd control
 *   node scripts/spikes/mission/rig.mjs --plan [--rig <id>] [--deck <id>] [--svg /abs/dir]
 *   node scripts/spikes/mission/rig.mjs --out /abs/dir [--rig <id>] [--seen] [--hero <ref>] [--guard <ref>] [--cdn] [--capture]
 */
import { register } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { options, database, starterRoom, writePage } = await import('./lib.mjs');
const o = options(process.argv.slice(2));
database(o.opt('--hero'), o.opt('--guard'));

const { RIGS, RIG_IDS } = await import('../../../lib/graph/offshore/rigs.js');
const { planRig, deckBoxes } = await import('../../../lib/graph/offshore/plan.js');
const { rigLaws } = await import('../../../lib/graph/offshore/laws.js');
const { rigWorld } = await import('../../../lib/graph/offshore/build.js');
const { rigMapSvg } = await import('../../../lib/graph/offshore/map.js');
const { sneakRoutes } = await import('../../../lib/graph/gameworld/stealth-routes.js');
const r2 = (v) => +v.toFixed(2);

const id = o.opt('--rig', RIG_IDS[0]);
if (!RIGS[id]) { console.error(`rig: '${id}' is not one (${RIG_IDS.join(', ')})`); process.exit(1); }
const P = planRig(RIGS[id]);
// the rounds as the route search reads them: a patrol walked end to end looking round at each end, a post looking one way
const watcherOf = (w) => ({ id: w.id, at: w.at, ...(w.to ? { to: w.to, speed: w.speed ?? 1, look: { secs: w.look ?? 4 } } : { heading: Math.atan2(w.facing[1] - w.at[1], w.facing[0] - w.at[0]) }), cone: w.cone ?? 0.8, range: w.range ?? 14, eye: 1.35, hear: 6, near: { r: 2, back: 100 } });
// each deck's crossing: from the way onto it (the start, a stair's head) to the way off it (a stair's foot, the goal)
const legs = P.decks.map((d) => {
  const on = P.ports.find((p) => p.deck === d.id && (p.of === 'start' || /:head$/.test(p.of))), off = P.ports.find((p) => p.deck === d.id && (p.of === 'goal' || /:foot$/.test(p.of)));
  return on && off ? { deck: d.id, from: on, to: off } : null;
}).filter(Boolean);
const say = (s) => (s ? `${s.seconds} s (waits ${s.waits}, crouches ${s.crouch} m, crawls ${s.crawl} m, never nearer a watcher than ${s.nearest} m)` : 'none');

if (o.has('--plan')) {
  console.log(`${P.name}: ${P.decks.map((d) => `${d.id} ${d.z} m`).join(' · ')} · ${P.pillars.filter((p) => p.kind === 'column').length} columns, ${P.pillars.filter((p) => p.kind === 'leg').length} legs, ${P.rails.length} rail runs, ${P.stairs.length} stairs, ${P.modules.length} modules`);
  for (const l of rigLaws(P)) console.log(`  ${l.holds ? 'holds  ' : 'ADVISED'} · ${l.law}: ${l.says}`);
  const svgDir = o.opt('--svg');
  let ok = true;
  for (const L of legs) {
    if (o.opt('--deck') && o.opt('--deck') !== L.deck) continue;
    const watchers = P.watch.filter((w) => w.deck === L.deck).map(watcherOf);
    const R = sneakRoutes({ bounds: P.bounds, boxes: deckBoxes(P, L.deck), watchers, start: L.from.at, goal: L.to.at, goalRadius: 1.2, seconds: 300, cell: 0.5 });
    ok &&= !!R.sneak;
    console.log(`  ${L.deck}: ${L.from.of} → ${L.to.of} under ${watchers.map((w) => w.id).join(', ') || 'no one'}: the straight way ${!R.direct ? 'none' : R.direct.seen ? `seen by ${R.direct.seen.by} after ${R.direct.seen.t} s` : 'unseen'}, a way unseen ${say(R.sneak)}`);
    if (svgDir) { fs.mkdirSync(svgDir, { recursive: true }); fs.writeFileSync(path.join(svgDir, `${id}-${L.deck}.svg`), rigMapSvg(P, { deck: L.deck, patrols: P.watch.filter((w) => w.deck === L.deck), ...(R.sneak?.path ? { path: R.sneak.path.map((p) => p.at) } : {}) })); }
  }
  process.exit(ok ? 0 : 2);
}

// THE PAGE: the rig over the sea, the operative at the landing, the guards on their rounds
const out = path.resolve(o.opt('--out', 'rig'));
const B = rigWorld(P);
const { room, hero: h0, guard: g0 } = await starterRoom(o);
const zOf = (deck) => P.decks.find((d) => d.id === deck).z;
const guardOf = (w) => {
  const z = zOf(w.deck) + 0.05, to = w.to ?? w.facing, heading = Math.atan2(to[1] - w.at[1], to[0] - w.at[0]);
  return { ...g0, id: w.id, rule: { ...g0.rule, speed: w.to ? (w.speed ?? 1) : 0, sightCone: w.cone ?? 0.8, sightRange: w.range ?? 14, near: { r: 2, back: 100 },
    foe: { ...g0.rule.foe, stretch: w.to ? r2(Math.hypot(w.to[0] - w.at[0], w.to[1] - w.at[1])) : 10, ...(w.to ? { ends: [[...w.at, z], [...w.to, z]] } : {}), patrol: { ...(g0.rule.foe?.patrol ?? {}), look: { secs: w.look ?? 4 } } } },
    transform: { pos: [w.at[0], w.at[1], z], heading } };
};
const ghost = { on: !o.has('--seen') };
const start = [...P.start.at, zOf(P.start.deck) + 0.05], goal = [...P.goal.at, zOf(P.goal.deck)];
const mission = { result: { at: goal, radius: 2, when: [] }, hints: [{ at: start, radius: 3, says: `${P.start.says ?? ''} I: walk unseen or be seen.` }] };
const entities = [{ ...h0, rule: { ...h0.rule, step: 0.35, mission, ghost }, transform: { pos: start, heading: 0 } }, ...P.watch.map(guardOf)];
// (the rig's hour, its air and its weather: the builder's page; the rain a weather the world reads, its decks its roofs)
const manifest = { kind: 'controllable', faces: B.faces, colliders: B.colliders, entities, figures: room.manifest.figures, fxStyle: room.manifest.fxStyle, figureGrade: room.manifest.figureGrade,
  bg: B.page.bg, sky: B.page.sky, ...(B.page.weather ? { weather: B.page.weather, seed: P.seed } : {}) };
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { payload } = await resolveWorldScene({ ref: `steel-serpents-rig-${id}`, title: `${P.name} · Steel Serpents`, manifest }, { era: 'gen-7', live: true });
payload.barriers = B.barriers;
for (const k of ['haze', 'roofs', 'wetRoad']) if (B.page[k]) payload[k] = B.page[k];
const page = await writePage(payload, room, path.join(out, `${id}.html`), { capture: o.has('--capture'), cdn: o.has('--cdn') });
console.log(`rig: ${page.file} (${page.mb} MB) · ${P.hour}${P.weather ? `, ${Object.keys(P.weather.climate).join('/')}` : ''} · ${B.counts.lamps} lamps, ${B.counts.wet} wet tiles · ${B.counts.faces} faces, ${B.counts.colliders} colliders, ${B.counts.barriers} barriers · guards ${P.watch.map((w) => w.id).join(', ')} · ${ghost.on ? 'unseen (I to be seen)' : 'seen (I to walk unseen)'}`);
process.exit(0);

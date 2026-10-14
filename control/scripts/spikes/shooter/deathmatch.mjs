// SPIKE shooter: is a deathmatch one step away? Takes the quick shoot level's stage and gunners, turns them on each
// other (`rule.target: 'all'`), and hands the world the engine's match layer (combat-match.js: kills credited to the
// last hitter, the fallen respawn at the spawn farthest from the living, first to `killTarget` wins). Measures what a
// two-minute bout does on a stage laid for a corridor fight.
//   node scripts/spikes/shooter/deathmatch.mjs [bots=4] [seconds=120]      DM_MIND=hunt for the hunters it stalled with
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { register } from 'node:module';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { designGameHandler } = await import('../../../lib/mcp/tools/design-game.js');
const { SketchRepository } = await import('../../../lib/db/repositories/sketches.js');
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { stageEnds } = await import('../../../lib/graph/gameworld/levels.js');
const { composeLive } = await import('../../../lib/graph/worlds/controllable/compose.js');

const bots = Number(process.argv[2] ?? 4), seconds = Number(process.argv[3] ?? 120);
await designGameHandler({ quick: { goal: 'shoot', foes: bots, world: { id: 'dm', style: { kit: 'trail-valley' } } }, ref: 'd' });
const L = SketchRepository.getByRef('d-level-run-0').manifest;
const { payload } = await resolveWorldScene(SketchRepository.getByRef('d-level-run-0'));
const land = stageEnds(L).ground, E = composeLive();
const gunners = payload.entities.filter((e) => e.id.startsWith('foe-'));
// every gunner everyone's foe; the player stands aside, out of the bout (unhittable, far off)
const entities = payload.entities.map((e) => {
  if (e.id === 'player') return { ...e, body: { ...e.body, hittable: false }, transform: { ...e.transform, pos: [9999, 9999, 0] } };
  if (!e.id.startsWith('foe-')) return e;
  // DM_MIND=hunt: the hunter on target 'all' (the spike's first run); frag (default): the match player (mind.js)
  return { ...e, team: undefined, rule: process.env.DM_MIND === 'hunt' ? { ...e.rule, target: 'all' } : { ...e.rule, mind: { ...e.rule.mind, motivation: 'frag' } } };
});
const spawns = gunners.map((g) => [...g.transform.pos]);
const W = E.createWorld({ entities, colliders: payload.colliders, match: { killTarget: 5, respawnDelay: 3, spawns } });
const hooks = { ground: (x, y) => land(x, y) };
const r1 = (v) => Math.round(v * 10) / 10;
let t = 0, firstKill = null, seenPairs = new Set(), idle = {};
for (const g of gunners) idle[g.id] = 0;
for (; t < seconds && !W.match.over; t += 1 / 30) {
  E.stepWorld(W, {}, 1 / 30, hooks);
  if (firstKill == null && W.match.feed.length) firstKill = t;
  if (process.env.DM_TRACE && Math.round(t * 30) % 300 === 0) console.error(r1(t), gunners.map((g) => { const e = W.byId[g.id]; return `${g.id}@${e.transform.pos.slice(0, 2).map(Math.round)} seen=${e.lastSeen ? 'y' : 'n'} cover=${e.coverAt ? "y" : "n"}`; }).join(' | '));
  for (const g of gunners) {
    const e = W.byId[g.id];
    if (e.lastSeen) seenPairs.add(g.id);
    const v = e.vel ?? [0, 0, 0];
    if (!e.downed && Math.hypot(v[0], v[1]) < 0.05 && !(e.weapon && e.weapon.ammo < e.weapon.magazine)) idle[g.id] += 1 / 30;
  }
}
const m = W.match;
console.log(JSON.stringify({
  bots: gunners.length, ran: r1(t), over: m.over, winner: m.winner,
  kills: m.kills, deaths: Object.fromEntries(Object.entries(m.stats).map(([k, s]) => [k, s.deaths])),
  shots: Object.fromEntries(Object.entries(m.stats).map(([k, s]) => [k, s.shots])),
  hits: Object.fromEntries(Object.entries(m.stats).map(([k, s]) => [k, s.hits])),
  firstKillAt: firstKill && r1(firstKill), feed: m.feed.length,
  everSawSomeone: [...seenPairs], standingIdleS: Object.fromEntries(Object.entries(idle).map(([k, v]) => [k, r1(v)])),
}, null, 1));
process.exit(0);

// SPIKE shooter: the machine gate's measurements of today's shooter, through the real handlers. Mints the quick
// `goal: 'shoot'` game, resolves its level, and measures the map (sightlines, cover, routes, height) and the fight
// (weapon arithmetic, a headless duel). Nothing registers; nothing is asserted beyond PASS/FAIL lines on the
// conventions the README names, so the numbers say which concepts are missing or weak.
//   node scripts/spikes/shooter/probe.mjs [foes=4] [kit=trail-valley]
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { register } from 'node:module';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { designGameHandler } = await import('../../../lib/mcp/tools/design-game.js');
const { SketchRepository } = await import('../../../lib/db/repositories/sketches.js');
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { stageEnds } = await import('../../../lib/graph/gameworld/levels.js');
const { simLevel } = await import('../../../lib/graph/game/level-sim.js');
const { composeLive } = await import('../../../lib/graph/worlds/controllable/compose.js');
const { SHOOT } = await import('../../../lib/graph/gameworld/quick.js');

const foes = Number(process.argv[2] ?? 4), kit = process.argv[3] ?? 'trail-valley';
const results = [], measured = {};
const check = (name, ok, info) => { results.push({ name, ok: !!ok }); if (info !== undefined) measured[name] = info; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info !== undefined ? '  ' + JSON.stringify(info) : ''}`); };
const note = (name, info) => { measured[name] = info; console.log(`  ·  ${name}  ${JSON.stringify(info)}`); };
const r1 = (v) => Math.round(v * 10) / 10;

await designGameHandler({ quick: { goal: 'shoot', foes, world: { id: 'probe', style: { kit } } }, ref: 'p' });
const L = SketchRepository.getByRef('p-level-run-0').manifest;
const { payload } = await resolveWorldScene(SketchRepository.getByRef('p-level-run-0'));
const ends = stageEnds(L), land = ends.ground, ground = (x, y) => land(x, y) ?? 0;
const E = composeLive(), cols = payload.colliders;
const posts = payload.entities.filter((e) => e.id.startsWith('foe-'));
const spawn = ends.spawn, exit = ends.exit;
const way = [spawn, ...(ends.beats ?? []).filter((b) => b.beat !== 'trailhead' && b.beat !== 'exit').map((b) => b.at), exit];

// ── 1. the map's shape ────────────────────────────────────────────────────────────────────────────────────────────
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const wayLen = way.slice(1).reduce((s, q, i) => s + d2(q, way[i]), 0);
const xs = way.map((p) => p[0]), ys = way.map((p) => p[1]), zs = way.map((p) => p[2]);
note('map: the way (spawn → beats → exit)', { metres: r1(wayLen), points: way.length, extent: [r1(Math.max(...xs) - Math.min(...xs)), r1(Math.max(...ys) - Math.min(...ys))], heightSpan: r1(Math.max(...zs) - Math.min(...zs)) });
note('map: blocks laid', L.blocks?.reduce((m, b) => ((m[b.form] = (m[b.form] ?? 0) + 1), m), {}));
note('map: colliders', { all: cols.length, blocks: cols.filter((c) => c.of?.startsWith('block:')).length });
// a shooter map loops back on itself: distinct routes between any two places. A trail is one line: route count 1.
const loopsBack = d2(spawn, exit) < 0.25 * wayLen;
check('map: routes loop (spawn and the far end are close for the length walked: an arena, not a corridor)', loopsBack, { spawnToExit: r1(d2(spawn, exit)), walked: r1(wayLen) });

// ── 2. sightlines: sample the way every 2 m at eye height; which posts see each sample, over a person's chest ─────
const EYE = 1.6, CHEST = 1.3;
const samples = [];
for (let i = 1; i < way.length; i++) {
  const a = way[i - 1], b = way[i], n = Math.max(1, Math.round(d2(a, b) / 2));
  for (let k = 0; k < n; k++) { const t = k / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t; samples.push([x, y, ground(x, y)]); }
}
const sees = (post, p) => {
  const q = post.transform.pos, d = d2(q, p);
  return d <= (post.weapon?.range ?? 28) && !E.sightBlocked([q[0], q[1], q[2] + EYE], [p[0], p[1], p[2] + CHEST], cols);
};
const pressure = samples.map((p) => posts.filter((f) => sees(f, p)).length);
const hist = pressure.reduce((m, n) => ((m[n] = (m[n] ?? 0) + 1), m), {});
note('sight: posts seeing each 2 m of the way (count → samples)', hist);
const crossfire = pressure.filter((n) => n >= 2).length / samples.length;
check('sight: some crossfire (2+ posts on one spot) on 10–40% of the way', crossfire >= 0.1 && crossfire <= 0.4, { share: r1(crossfire * 100) + '%' });
// sightline lengths from each post along the way it sees
const lens = [];
for (const f of posts) for (const p of samples) if (sees(f, p)) lens.push(d2(f.transform.pos, p));
lens.sort((a, b) => a - b);
const pct = (q) => r1(lens[Math.floor(q * (lens.length - 1))] ?? 0);
note('sight: seen sightline lengths, m (p10 / p50 / p90 / max)', [pct(0.1), pct(0.5), pct(0.9), r1(lens.at(-1) ?? 0)]);
check('sight: a mix of short (<10 m) and long (>25 m) lines', lens.some((l) => l < 10) && lens.some((l) => l > 25), { short: lens.filter((l) => l < 10).length, long: lens.filter((l) => l > 25).length });
// spawn safety: no post sees the spawn
const seeSpawn = posts.filter((f) => sees(f, spawn)).map((f) => f.id);
check('sight: no post sees the spawn', !seeSpawn.length, seeSpawn);

// ── 3. cover along the way: for each seen sample, a spot within 3 m out of every post's sight ──────────────────────
const hidden = (p) => !posts.some((f) => !f.downed && sees(f, p));
const ring = (p, r) => Array.from({ length: 12 }, (_, k) => { const a = (k * Math.PI) / 6, x = p[0] + Math.cos(a) * r, y = p[1] + Math.sin(a) * r; return [x, y, ground(x, y)]; });
const exposed = samples.filter((p) => !hidden(p));
const covered = exposed.filter((p) => [1.5, 3].some((r) => ring(p, r).some((q) => hidden(q) && !cols.some((c) => q[0] >= c.min[0] && q[0] <= c.max[0] && q[1] >= c.min[1] && q[1] <= c.max[1] && q[2] + 0.5 >= c.min[2] && q[2] + 0.5 <= c.max[2]))));
check('cover: from 80%+ of exposed spots a hidden spot is within 3 m', exposed.length ? covered.length / exposed.length >= 0.8 : true, { exposed: exposed.length, withCover: covered.length });
// half cover: cover a standing body sees over (waist high). Read off the laid blocks (their colliders are bricks): a
// wall's height, a crate stack's count. No crouch in the rules, so half cover would only cover a kneel.
note('cover: laid cover by height (full ≥ 1.3 m, half under)', (L.blocks ?? []).reduce((m, b) => { const h = b.form === 'wall' ? b.height : b.form === 'crate' ? (b.stack ?? 1) * 0.8 : 0; m[h >= 1.3 ? 'full' : 'half'] = (m[h >= 1.3 ? 'full' : 'half'] ?? 0) + 1; return m; }, {}));

// ── 4. weapon arithmetic ───────────────────────────────────────────────────────────────────────────────────────────
const ttk = (w, hp, dmg = w.damage) => {
  const shots = Math.ceil(hp / dmg), mags = Math.floor((shots - 1) / w.magazine);
  return { shots, seconds: r1((shots - 1) * w.cooldown + mags * w.reload) };
};
const P0 = payload.entities.find((e) => e.id === 'player');
note('fight: player rifle vs a foe (perfect aim)', ttk(SHOOT.rifle, SHOOT.foeHp));
note('fight: one foe\'s gun vs the player (every shot lands)', ttk({ ...SHOOT.gun, damage: SHOOT.hit }, SHOOT.hp));
note('fight: the rifle\'s rounds vs every foe\'s hp', { rounds: SHOOT.rifle.magazine + SHOOT.rifle.reserve, needed: foes * SHOOT.foeHp });
note('fight: what the player carries', { weapon: P0?.weapon && Object.keys(P0.weapon).sort(), slots: Array.isArray(P0?.weapons) ? P0.weapons.length : 1 });

// ── 5. a headless duel: the player at 15 m in front of foe-1 with a clear line, perfect aim, firing at will ─────────
{
  const sim = simLevel({ entities: payload.entities, events: payload.events, colliders: cols }, { ground: (q) => land(q[0], q[1]) });
  const W = sim.world, P = W.byId[W.pilotId], f1 = W.byId['foe-1'], q0 = f1.transform.pos;
  const spot = [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9].map((da) => { const a = f1.transform.heading + da, x = q0[0] + Math.cos(a) * 15, y = q0[1] + Math.sin(a) * 15; return [x, y, ground(x, y) + 1.7]; })
    .find((p) => !E.sightBlocked([p[0], p[1], p[2] - 0.4], [q0[0], q0[1], q0[2] + 1.3], cols));
  if (!spot) check('duel: a clear line to foe-1 from 15 m', false);
  else {
    P.transform.pos = spot;
    let t = 0, coverTime = 0, shots = 0, last = P.weapon.ammo;
    for (; t < 30 && !f1.downed; t += 1 / 30) {
      const q = f1.transform.pos, d = d2(q, P.transform.pos);
      P.transform.heading = Math.atan2(q[1] - P.transform.pos[1], q[0] - P.transform.pos[0]);
      P.transform.pitch = Math.atan2(q[2] + 1.5 - P.transform.pos[2], d);
      sim.input.fire = Math.round(t * 30) % 2;
      sim.frame(1 / 30);
      if (f1.coverAt) coverTime += 1 / 30;
      if (P.weapon.ammo < last) shots++;
      last = P.weapon.ammo;
    }
    note('duel: foe-1 at 15 m, perfect aim', { seconds: r1(t), downed: !!f1.downed, shotsFired: shots, foeInCoverS: r1(coverTime), playerHp: sim.bus.vars.hp });
    check('duel: a 1v1 at 15 m lasts 2–10 s (a fight, not a click, not a siege)', f1.downed && t >= 2 && t <= 10, { seconds: r1(t) });
  }
}

// ── 6. what a match needs that the level carries ──────────────────────────────────────────────────────────────────
const kinds = L.game.mechanics.map((m) => m.kind);
note('match: mechanics', kinds);
// a fall's `respawn` puts a walker back on the ground; a match's respawn (combat-match.js, `match.respawnDelay`) brings
// a downed body back to fight
check('match: someone respawns after going down (a match layer: respawnDelay, spawns)', !!(L.match ?? payload.match), L.match ?? payload.match ?? null);
check('match: a score or time limit ends it (frags, time)', kinds.includes('score') || kinds.includes('survive'), kinds);
check('match: bots fight each other (more than two teams, or free-for-all)', new Set(payload.entities.filter((e) => e.team).map((e) => e.team)).size > 1 || payload.entities.some((e) => e.rule?.mind?.squad === 'free-for-all'), [...new Set(payload.entities.map((e) => e.team).filter(Boolean))]);

const pass = results.filter((r) => r.ok).length;
console.log(`\n${pass}/${results.length} conventions hold`);
if (process.env.PROBE_JSON) (await import('node:fs')).writeFileSync(process.env.PROBE_JSON, JSON.stringify({ foes, kit, results, measured }, null, 2));
process.exit(0);

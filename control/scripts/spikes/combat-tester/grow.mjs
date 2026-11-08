// SPIKE combat tester, phase 3: GROWN, NOT LAID. The meru island's flow for gameplay: the gym is the seed (a game's
// numbers, measured on its runtime); the arena is grown from it. The arena grammar (gameworld/tunnel-arena.js) takes its
// size from the game's run, and the arena is held to laws in the game's own numbers where the arena concern's laws hold
// fixed ones (an eye at 1.6 m, cover within 3.5 m, any box counted as cover): cover that hides THIS body's eye within a
// second of ITS run, sightlines ITS guns can use, stairs ITS rule climbs, perches ITS jump makes. Then drawn and played
// as the game plays, as the gym is.
//
//   node scripts/spikes/combat-tester/grow.mjs <out-dir> [game …] [--quick '<json>'] [--words '<arena words>']
//     [--cross <s>] [--cover <s>] [--check]
//   (from control/; games as measure.mjs; --words the arena asked for (default 'a three-lane arena with high ground');
//   --cross the seconds the run takes across it (default 8); --cover the seconds of run to cover that hides the eye
//   (default 1); --check drives each page's own runtime in headless Chromium)
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { register, createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { GAMES, mint, measureGame, laws } = await import('./measure.mjs');
const { box, label, G, WALL_FILL, groundOf, reachOnBoxes, page, otherCamera } = await import('./gym.mjs');
const { tunnel } = await import('../../../lib/graph/gameworld/tunnel.js');
const { arenaDomain, ARENA_RAILS } = await import('../../../lib/graph/gameworld/tunnel-arena.js');
const { arenaLayout, askBoxes, arenaSightlines, lineBlocked, concernLaws, TOWER, ARENA } = await import('../../../lib/graph/gameworld/lay-concerns.js');
const { composeLive } = await import('../../../lib/graph/worlds/controllable/compose.js');

const FPS = 60, DT = 1 / FPS, E = composeLive();
const r2 = (v) => Math.round(v * 100) / 100;

// ── the seed's numbers: what the gym measured, read as the arena's ─────────────────────────────────────────────────────
// a gun serves the bands at which it drops the foe within twice its time at 5 m (past that the fight is the other gun's,
// or a walk), fired as it is best fired there, from the hip or aimed (a sniper is aimed); its reach is the farthest
// such band
export function seedOf(m, R, pilot, { cross = 8, cover = 1 } = {}) {
  const rule = pilot.rule, eye = rule.type === 'walk' ? rule.eye ?? 1.7 : pilot.weapon?.eye ?? 1.5;
  const guns = Object.entries(m.slots).filter(([, s]) => !s.skipped).map(([k, s]) => {
    const best = (d) => { const T = s.ttk[d]; if (!T) return null; const c = [T.still, T.aimed].filter((x) => typeof x?.s === 'number'); return c.length ? Math.min(...c.map((x) => x.s)) : null; };
    const t5 = best(5), ok = (d) => best(d) != null && t5 != null && best(d) <= Math.max(2 * t5, t5 + 0.5);
    const bands = Object.keys(s.ttk).map(Number).filter(ok);
    return { gun: k, reach: bands.length ? Math.max(...bands) : 0 };
  });
  return {
    run: m.mobility.top, eye: r2(eye), step: rule.step ?? 0.35, ledge: R?.ledge ?? null, gap: R?.gap ?? null,
    cross, cover, coverAt: r2(m.mobility.top * cover), guns, reach: Math.max(0, ...guns.map((g) => g.reach)),
    half: r2(Math.max(ARENA_RAILS.half[0], Math.min(ARENA_RAILS.half[1], (m.mobility.top * cross) / 2))),
  };
}

// ── the arena, grown: the grammar's own tunnel, its size the seed's ───────────────────────────────────────────────────
export function growArena(S, words, seed = 1) {
  const rec = tunnel(arenaDomain({ spawns: 8 }), { intent: words, seed, passes: 12, base: { half: S.half } });
  return layOut(rec, rec.plan);
}
// the plan laid, its boxes and their forms, and the arena concern's own laws over it (as the tunnel's build runs them)
function layOut(rec, plan) {
  const L = arenaLayout({ centre: [0, 0], z: 0, plan });
  const frame = { centre: [0, 0], half: plan.half, z: 0, spawns: L.spawns, longest: 2 * plan.half, ...(plan.bases ? { bases: plan.bases } : {}), ...(plan.floors ? { floors: plan.floors } : {}) };
  rec = { ...rec, plan, built: { ...rec.built, laws: concernLaws(['arena'], { ends: { spawn: [0, 0, 0] }, blocks: L.blocks, arena: frame }).filter((l) => l.law !== 'floor-clear') } };
  // (each block one box, in order: a box's form is its block's, a wall round the floor its own)
  const boxes = askBoxes(L.blocks), H = plan.half;
  const forms = L.blocks.map((b, k) => (b.form === 'wall' && boxes[k].max[2] - boxes[k].min[2] >= ARENA.wall - 0.01 && Math.max(boxes[k].max[0] - boxes[k].min[0], boxes[k].max[1] - boxes[k].min[1]) >= 2 * H - 0.01 ? 'bound' : b.form === 'pillar' ? 'tower' : b.form));
  return { rec, L, boxes, forms, half: H };
}

// ── tended by the game's laws: a crate the jump reaches that sees a spawn is stacked over the jump (with its turned
// partner, so neither side has the better ground), and every law is run again; a few passes at most ─────────────────────
export function tendArena(A, S, pilot, passes = 3) {
  const log = [];
  for (let k = 0; k < passes; k++) {
    const GL = grownLaws(S, A, pilot), seeing = GL.perches.filter((B) => GL.spotting.has(B));
    if (!seeing.length) return { A, GL, log };
    const pieces = A.rec.plan.pieces.map((q) => ({ ...q })), over = Math.ceil((S.ledge + 0.01) / 1);
    let raised = 0;
    for (const B of seeing) {
      const u = (B.min[0] + B.max[0]) / 2, v = (B.min[1] + B.max[1]) / 2;
      for (const q of pieces) if (q.form === 'crate' && ((Math.abs(q.u - u) < 0.01 && Math.abs(q.v - v) < 0.01) || (Math.abs(q.u + u) < 0.01 && Math.abs(q.v + v) < 0.01)) && (q.stack ?? 1) < over) { q.stack = over; raised++; }
    }
    log.push(`pass ${k + 1}: ${raised} crates stacked ${over} high, over the jump's ${S.ledge} m (they saw a spawn)`);
    A = layOut(A.rec, { ...A.rec.plan, pieces });
  }
  return { A, GL: grownLaws(S, A, pilot), log };
}

// ── the laws in the game's own numbers ───────────────────────────────────────────────────────────────────────────────
function climbFlight(pilot, boxes, F) {
  const fl = F.flights[0], z0 = pilot.rule.eye ?? (pilot.rule.type === 'walk' ? 1.7 : 0), flat = { ground: groundOf(boxes) };
  const from = fl.bottom, to = fl.top, heading = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const w = E.createWorld({ entities: [{ ...JSON.parse(JSON.stringify(pilot)), id: 'p', pilotable: true, transform: { pos: [from[0], from[1], from[2] + z0], heading, pitch: 0 } }], colliders: boxes });
  const e = w.byId.p;
  for (let f = 0; f < 300 && Math.hypot(e.transform.pos[0] - from[0], e.transform.pos[1] - from[1]) < Math.hypot(to[0] - from[0], to[1] - from[1]); f++) E.stepWorld(w, { forward: 1 }, DT, flat);
  for (let k = 0; k < 20; k++) E.stepWorld(w, {}, DT, flat);
  return r2(e.transform.pos[2] - z0);
}
export function grownLaws(S, A, pilot) {
  const { boxes, forms, L, half: H } = A, out = [], law = (name, ok, says) => out.push({ name, ok: !!ok, says });
  const frame = { centre: [0, 0], half: H, z: 0 };
  // the size: the run across it, in seconds
  const across = r2((2 * H) / S.run);
  law('crossed in the seed\'s time (the run across it)', Math.abs(across - S.cross) <= 0.25 * S.cross || H === ARENA_RAILS.half[0] || H === ARENA_RAILS.half[1], `${2 * H} m across at ${S.run} m/s: ${across} s (${S.cross} s asked${H === ARENA_RAILS.half[0] || H === ARENA_RAILS.half[1] ? `, held at the grammar's rail ${H}` : ''})`);
  // cover that hides the eye (no crouch: a box under the eye hides nothing), within a second's run
  const inner = boxes.filter((B, k) => forms[k] !== 'bound');
  const floor = [];
  for (let u = -H + 1; u <= H - 1; u += 2) for (let v = -H + 1; v <= H - 1; v += 2) if (!boxes.some((B) => u > B.min[0] - 0.3 && u < B.max[0] + 0.3 && v > B.min[1] - 0.3 && v < B.max[1] + 0.3)) floor.push([u, v]);
  const near = (p, r, tall) => boxes.some((B) => (!tall || B.max[2] >= S.eye + 0.05) && Math.hypot(Math.max(B.min[0] - p[0], 0, p[0] - B.max[0]), Math.max(B.min[1] - p[1], 0, p[1] - B.max[1])) <= r);
  const hides = floor.filter((p) => near(p, S.coverAt, true)).length / floor.length, any = floor.filter((p) => near(p, S.coverAt, false)).length / floor.length;
  const half = inner.filter((B) => B.max[2] < S.eye + 0.05).length;
  law('cover that hides the eye within a second\'s run', hides >= ARENA.covered, `${Math.round(100 * hides)}% of the floor has cover over the eye (${S.eye} m) within ${S.coverAt} m; ${Math.round(100 * any)}% has any cover; ${half} of ${inner.length} pieces are under the eye (half cover, and no crouch to use it)`);
  // sightlines the guns use
  const lines = arenaSightlines(frame, boxes), served = lines.filter((d) => d <= S.reach + 1e-9).length / Math.max(1, lines.length);
  law('sightlines the guns use (the kit\'s reach)', served >= 0.9, `${Math.round(100 * served)}% of ${lines.length} clear lines are within ${S.reach} m (${S.guns.map((g) => `${g.gun} ${g.reach} m`).join(', ')}); the longest ${r2(lines.at(-1) ?? 0)} m`);
  // the stairs the rule climbs
  const floors = L.floors ?? [];
  if (floors.length) {
    const tops = floors.map((F) => ({ want: F.z, got: climbFlight(pilot, boxes, F) }));
    law('each tower\'s stair is climbed by the game\'s rule', TOWER.rise <= S.step && tops.every((t) => t.got >= t.want - 0.06), `riser ${TOWER.rise} m, the step ${S.step} m; up the flights to ${tops.map((t) => `${t.got} of ${t.want} m`).join(', ')}`);
    law('no tower top is jumped onto from the floor (the stair is the way up)', S.ledge == null || S.ledge < Math.min(...floors.map((F) => F.z)), `the jump reaches a ${S.ledge ?? '–'} m ledge; the tops are ${floors.map((F) => F.z).join(', ')} m`);
  }
  // perches the jump makes: the tops of crates and walls it reaches from the floor (over the step; a tower and its stair
  // are the stair's way up, the arena's own high ground), and what they see
  const perches = S.ledge == null ? [] : boxes.filter((B, k) => (forms[k] === 'crate' || forms[k] === 'wall') && B.max[2] > S.step + 0.01 && B.max[2] <= S.ledge);
  const spawns = L.spawns, spotted = [], spotting = new Set();
  for (const B of perches) {
    const top = [(B.min[0] + B.max[0]) / 2, (B.min[1] + B.max[1]) / 2, B.max[2] + S.eye];
    const seen = spawns.filter((s) => !lineBlocked(top, [s[0], s[1], 1.2], boxes.filter((b) => b !== B)));
    if (seen.length) { spotted.push(`[${top[0].toFixed(1)}, ${top[1].toFixed(1)}] sees ${seen.length}`); spotting.add(B); }
  }
  law('no perch the jump makes sees a spawn', !spotted.length, perches.length ? `${perches.length} tops the jump reaches (${[...new Set(perches.map((B) => r2(B.max[2])))].join(', ')} m)${spotted.length ? `; ${spotted.length} see a spawn: ${spotted.slice(0, 3).join('; ')}${spotted.length > 3 ? ' …' : ''}` : ', none sees a spawn'}` : 'the jump reaches no top over the step');
  return { laws: out, perches, spotting };
}

// ── the arena drawn: the gym's graybox, the game's player at the first spawn, its foe at the next ──────────────────────
// (crates are pine, the rest concrete: the matter each is marked as)
const MATTER_OF = (form) => (form === 'crate' ? 'pine' : 'concrete');
function drawArena(A, S, G_) {
  const { boxes, forms, L, half: H } = A, faces = [], signs = [], walls = [];
  for (let i = -Math.ceil(H); i < Math.ceil(H); i++) for (let j = -Math.ceil(H); j < Math.ceil(H); j++) {
    const five = ((i % 5) + 5) % 5 === 0 || ((j % 5) + 5) % 5 === 0;
    faces.push({ corners: [[i, j, 0], [i + 1, j, 0], [i + 1, j + 1, 0], [i, j + 1, 0]], fill: five ? G.line : G.floor[(i + j) & 1], group: 'floor' });
  }
  const perch = new Set(G_.perches);
  boxes.forEach((B, k) => {
    const mt = MATTER_OF(forms[k]), fill = perch.has(B) ? '#c9b25a' : forms[k] === 'crate' ? WALL_FILL.pine : forms[k] === 'bound' ? G.line : G.block;
    faces.push(...box(B.min[0], B.min[1], B.max[0], B.max[1], B.max[2] - B.min[2], fill, `arena:${forms[k]}:${k}`, B.min[2]).faces);
    walls.push({ min: B.min, max: B.max, matter: mt });
  });
  L.spawns.forEach((s, k) => { faces.push({ corners: [[s[0] - 0.5, s[1] - 0.5, 0.012], [s[0] + 0.5, s[1] - 0.5, 0.012], [s[0] + 0.5, s[1] + 0.5, 0.012], [s[0] - 0.5, s[1] + 0.5, 0.012]], fill: '#6f8fb3', group: 'spawn' }); signs.push(label(`spawn-${k}`, [s[0], s[1], 2.3], `spawn ${k + 1}`)); });
  for (const F of L.floors ?? []) signs.push(label(`top-${F.area[0]}`, [(F.area[0] + F.area[2]) / 2, (F.area[1] + F.area[3]) / 2, F.z + 2.2], `high ground ${F.z} m · stair rise ${TOWER.rise} m (the step ${S.step} m)`));
  if (G_.perches.length) { const B = G_.perches[0]; signs.push(label('perch', [(B.min[0] + B.max[0]) / 2, (B.min[1] + B.max[1]) / 2, B.max[2] + 1.6], `a perch the jump makes (${r2(B.max[2])} m; it reaches ${S.ledge} m)`)); }
  const face = (p) => Math.atan2(-p[1], -p[0]);
  const s0 = L.spawns[0];
  return { faces, colliders: boxes, signs, walls, spawn: [s0[0], s0[1], 0], heading: face(s0), dummies: L.spawns.slice(1, 5).map((s, k) => ({ id: `foe-at-${k + 2}`, at: [s[0], s[1], 0], heading: face(s) })) };
}
function readoutOf(m, S, A, G_) {
  const held = (A.rec.built.laws ?? []).filter((l) => l.law !== 'floor-clear');
  return [
    `the seed: run ${S.run} m/s · eye ${S.eye} m · step ${S.step} m · ledge ${S.ledge ?? '–'} m · gap ${S.gap ?? '–'} m · guns ${S.guns.map((g) => `${g.gun} to ${g.reach} m`).join(', ')}`,
    ...(G_.log ?? []).map((t) => `tended: ${t}`),
    `grown: ${2 * A.half} m across (${S.cross} s of run), ${A.rec.plan.topology}${A.rec.plan.lanes ? ` ${A.rec.plan.lanes} lanes` : ''}, ${(A.L.floors ?? []).length} tops, ${A.L.spawns.length} spawns`,
    ...G_.laws.map((l) => `${l.ok ? '✓' : '✗'} ${l.name}: ${l.says}`),
    `the arena's own laws: ${held.filter((l) => l.holds).length} of ${held.length} hold${held.some((l) => !l.holds) ? ` (${held.filter((l) => !l.holds).map((l) => l.law).join(', ')} not)` : ''}`,
  ];
}

// ── the page, driven (as gym.mjs --check): it loads clean, the stair is climbed on the page, a round drops a foe ───────
async function checkArena(browser, file, A) {
  const page_ = await browser.newPage({ viewport: { width: 1120, height: 700 } }), errors = [];
  page_.on('pageerror', (e) => errors.push(String(e.message ?? e)));
  await page_.goto('file://' + path.resolve(file));
  await page_.waitForFunction(() => !!window.__mojCtrl, null, { timeout: 120000 });
  const F = (A.L.floors ?? [])[0] ?? null;
  const got = await page_.evaluate(`(() => {
    const C = window.__mojCtrl, w = C.world, e = Object.values(w.byId).find((x) => x.pilotable), F = ${JSON.stringify(F)};
    const drive = (n, input) => { for (let i = 0; i < n; i++) C.step(1 / 60, typeof input === 'function' ? input(i) : input); };
    const z0 = e.transform.pos[2], out = {};
    for (const W of e.loadoutWeapons ?? [e.weapon]) if (W) W.converge = false;
    if (F) {
      const a = F.flights[0].bottom, b = F.flights[0].top;
      e.transform.pos = [a[0], a[1], z0]; e.transform.heading = Math.atan2(b[1] - a[1], b[0] - a[0]); e.vel = [0, 0, 0];
      // (up the flight and no further: driven on, the body crosses the top and walks off its far side)
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let f = 0; f < 300 && Math.hypot(e.transform.pos[0] - a[0], e.transform.pos[1] - a[1]) < L; f++) drive(1, { forward: 1 });
      drive(20, {}); out.top = +(e.transform.pos[2] - z0).toFixed(2);
    }
    const D = Object.values(w.byId).find((x) => x.id.startsWith('foe-at-'));
    const c = [-D.transform.pos[0], -D.transform.pos[1]], L = Math.hypot(c[0], c[1]) || 1;
    // (2.5 m in front of it, toward the middle: a spawn stands clear of the boxes by 0.8 m, so nothing is between)
    e.transform.pos = [D.transform.pos[0] + (c[0] / L) * 2.5, D.transform.pos[1] + (c[1] / L) * 2.5, z0];
    e.transform.heading = Math.atan2(D.transform.pos[1] - e.transform.pos[1], D.transform.pos[0] - e.transform.pos[0]);
    e.transform.pitch = Math.atan2(1.2 - z0 - (e.weapon?.eye ?? 0), 2.5);
    const W = e.weapon; if (W) { W.ammo = W.magazine; W.reloading = false; }
    drive(240, (i) => ({ fire: W && W.auto ? true : i % 2 === 0 }));
    out.drops = w.match?.feed?.length ?? 0;
    return out;
  })()`);
  await page_.close();
  return [
    { name: 'loads without a page error', ok: !errors.length, info: errors.slice(0, 2) },
    ...(F ? [{ name: 'a tower\'s stair is climbed on the page', ok: got.top >= F.z - 0.1, info: { top: got.top, want: F.z } }] : []),
    { name: 'a round drops a foe at its spawn (the match counts it)', ok: got.drops >= 1, info: { drops: got.drops } },
  ];
}

// ── the command line ─────────────────────────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2), out = args.shift();
if (!out) { console.error('usage: grow.mjs <out-dir> [game …] [--quick json] [--words \'…\'] [--cross s] [--cover s] [--check]'); process.exit(2); }
const opt = (k) => { const i = args.indexOf(k); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const quickArg = opt('--quick'), words = opt('--words') ?? 'a three-lane arena with high ground', cross = Number(opt('--cross') ?? 8), coverS = Number(opt('--cover') ?? 1);
const ci = args.indexOf('--check'), check = ci >= 0; if (check) args.splice(ci, 1);
const chosen = quickArg ? { mine: { says: 'a recipe of your own', quick: JSON.parse(quickArg) } } : Object.fromEntries((args.length ? args : ['conscription-hero', 'infinity-crisis', 'cogs-of-combat', 'steel-serpents']).map((k) => { if (!GAMES[k]) throw new Error(`no game '${k}'`); return [k, GAMES[k]]; }));
const browser = check ? await createRequire(import.meta.url)('playwright').chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }) : null;
mkdirSync(out, { recursive: true });
for (const [name, Gm] of Object.entries(chosen)) {
  const minted = await mint(name, Gm.quick), m = await measureGame(name, Gm, minted);
  m.laws = laws(m);
  const R = reachOnBoxes(minted.pilot, m.mobility), S = seedOf(m, R, minted.pilot, { cross, cover: coverS });
  const T = tendArena(growArena(S, words), S, minted.pilot), A = T.A, GL = T.GL;
  console.log(`\n━━ ${name}: the arena grown from its gym ('${words}')`);
  console.log(`   the seed  run ${S.run} m/s · eye ${S.eye} m · step ${S.step} m · ledge ${S.ledge ?? '–'} m · guns ${S.guns.map((g) => `${g.gun} to ${g.reach} m`).join(', ')}`);
  console.log(`   grown     ${2 * A.half} m across, ${A.rec.plan.topology}${A.rec.plan.lanes ? ` of ${A.rec.plan.lanes} lanes` : ''}, ${(A.L.floors ?? []).length} tops, ${A.L.spawns.length} spawns, ${A.rec.passes.length} passes${A.rec.gaps.length ? `, gaps: ${A.rec.gaps.map((g) => g.word).join(', ')}` : ''}`);
  for (const t of T.log) console.log(`   tended    ${t}`);
  for (const l of (A.rec.built.laws ?? []).filter((x) => x.law !== 'floor-clear')) console.log(`   ${l.holds ? 'PASS' : 'FAIL'} arena: ${l.law}  ${l.says}`);
  for (const l of GL.laws) console.log(`   ${l.ok ? 'PASS' : 'FAIL'} grown: ${l.name}  ${l.says}`);
  const D = drawArena(A, S, GL), lines = readoutOf(m, S, A, { ...GL, log: T.log });
  const files = [[`${out}/${name}.html`, page(minted, m, D, [], { tag: 'its own camera', lines, kind: 'arena' })]];
  const O = otherCamera(minted.payload.camera, minted.pilot);
  if (O) files.push([`${out}/${name}-${O.name}.html`, page(minted, m, D, [], { cam: O.cam, extraRule: O.rule, tag: `seen from the ${O.name}`, lines, kind: 'arena' })]);
  for (const [f, html] of files) {
    writeFileSync(f, html); console.log(`   wrote ${f}`);
    if (browser) for (const l of await checkArena(browser, f, A)) console.log(`   ${l.ok ? 'PASS' : 'FAIL'} page ${path.basename(f)}: ${l.name}  ${JSON.stringify(l.info)}`);
  }
}
if (browser) await browser.close();
process.exit(0);

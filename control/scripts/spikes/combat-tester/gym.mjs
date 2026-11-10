// SPIKE combat tester, phase 2: THE GYM. A game's seed, drawn: a graybox laid from the game's own measured numbers
// (measure.mjs), played as the game plays (its player, its camera, its guns), so what the measures say can be seen and
// tried. The meru island's flow for gameplay: the gym is the small seed at the game's scale; its levels are grown from
// the same numbers (phase 3).
//
//   node scripts/spikes/combat-tester/gym.mjs <out-dir> [game …] [--quick '<json>'] [--camera own|other|both] [--check]
//   (from control/; games as measure.mjs; writes <game>.html, <game>-<camera>.html for the other camera, and prints the
//   gym's own gate: the game's rule driven over the gym's stations headless. --check opens each page in headless
//   Chromium and drives the page's OWN runtime (window.__mojCtrl.step, frame by frame: software rendering is too slow
//   to play in real time): it loads clean, a round drops the 15 m dummy, each wall takes its matter's mark, the green
//   step is climbed and the red one is not)
//
// Three stations round a start pad (the player stands on it facing the range, +x):
//   the RANGE (ahead)     the game's own foe, standing at 5, 15 and 30 m, back on its feet a moment after it drops (the
//                         match layer, its scoreboard counting rounds and hits); distance posts every 5 m; a backstop
//   the WALL YARD (right) five walls 10 m off, brick, concrete, pine, sheet metal, steel, each marked as its own matter
//                         (rupa's scars: nothing breaks, every round leaves its mark)
//   the LANE (left)       the run's strip (a line to let go at, the stop box the measured stop long), the step (one a
//                         rise inside the rule's step, one over it), the ledge (at the measured jump's height and over
//                         it), the gap (the measured jump's length short of it and past it), half and full cover
// Green is meant to be made, red is not: the gym's gate drives the game's own rule at each and says whether it is so.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { register } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { GAMES, mint, measureGame, laws } = await import('./measure.mjs');
const { G, WALL_FILL, box, CHROME, label, layGym, groundOf, station, gymGate, reachOnBoxes, otherCamera, gymPageHtml } = await import('../../../lib/graph/gameworld/combat/gym.js');

// the gym lives in lib (gameworld/combat/gym.js); this spike writes its pages and drives them in a browser
export { G, WALL_FILL, box, CHROME, label, layGym, groundOf, station, gymGate, reachOnBoxes, otherCamera };
export const page = gymPageHtml;

// ── the page, driven: its own runtime stepped frame by frame in headless Chromium ─────────────────────────────────────
// (the aim set on the body; over the shoulder a round goes to the camera's crosshair, `converge`, which a script that
// turns the body does not move, so the check aims the body's own line: the gun and the dummy are tested, not the camera)
const DRIVE = `
  const C = window.__mojCtrl, w = C.world, e = Object.values(w.byId).find((x) => x.pilotable);
  // (a player's hand: the climb pulled down each frame as it rises, so a round leaves where the aim is)
  const drive = (n, input) => { for (let i = 0; i < n; i++) { const k0 = (e.weapon && e.weapon.kickNow) || 0; C.step(1 / 60, typeof input === 'function' ? input(i) : input); e.transform.pitch -= (((e.weapon && e.weapon.kickNow) || 0) - k0) * Math.PI / 180; } };
  const face = (x, y, z) => { const d = [x - e.transform.pos[0], y - e.transform.pos[1]]; e.transform.heading = Math.atan2(d[1], d[0]); e.transform.pitch = Math.atan2(z - e.transform.pos[2] - (e.weapon?.eye ?? 0), Math.hypot(d[0], d[1])); };
  for (const W of e.loadoutWeapons ?? [e.weapon]) if (W) W.converge = false;
  const out = {};
  const z0 = e.transform.pos[2];
  // (the trigger as a player works it: an automatic in short bursts, three rounds and a rest past its wait (a held spray
  // blooms, as the measures say), a semi pulled; a full magazine before each target)
  const pull = (i) => ({ fire: e.weapon && e.weapon.auto ? i % 36 < 18 : i % 2 === 0 });
  // (and a settled aim: the last target's bloom and climb let go, as a player's rest between targets does)
  const full = () => { const W = e.weapon; if (W) { W.ammo = W.magazine; W.reloading = false; W.reloadT = 0; W.bloomNow = 0; W.kickNow = 0; } };
  // (fired until the foe drops, ten seconds at most: a foe of the pole's 200 hp takes a rifle's 22 rounds)
  full(); face(15, 0, 1.2); for (let f = 0; f < 600 && !((w.match && w.match.feed.length) || 0); f++) { if (e.weapon && e.weapon.ammo <= 0) full(); drive(1, pull(f)); }
  out.drops = w.match?.feed?.length ?? 0;
  out.walls = {};
  for (const q of WALLS) {
    const y = (q.min[1] + q.max[1]) / 2, before = w.rupa.scars.marks.length;
    full(); face(q.min[0], y, 1.3); drive(60, pull);
    const mine = w.rupa.scars.marks.filter((m) => m.at[1] >= q.min[1] - 0.01 && m.at[1] <= q.max[1] + 0.01 && Math.abs(m.at[0] - q.min[0]) < 0.05);
    out.walls[q.matter] = [...new Set(mine.map((m) => m.kind))].join('/') || 'none';
  }
  out.steps = {};
  for (const S of STEPS) {
    e.transform.pos = [S.x - 3, S.y, z0]; e.transform.heading = 0; e.transform.pitch = 0; e.vel = [0, 0, 0];
    drive(20, {}); let f = 0; for (; f < 240 && e.transform.pos[0] < S.x + 1; f++) drive(1, { forward: 1 }); drive(20, {});
    out.steps[S.meant] = e.transform.pos[0] > S.x + 0.2 && e.transform.pos[2] - z0 >= S.h - 0.06;
  }
  return out;`;
async function checkPage(browser, file, gym) {
  const page = await browser.newPage({ viewport: { width: 1120, height: 700 } }), errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message ?? e)));
  await page.goto('file://' + path.resolve(file));
  await page.waitForFunction(() => !!window.__mojCtrl, null, { timeout: 120000 });
  const STEPS = gym.stations.filter((S) => S.kind === 'climb' && S.how === 'walk');
  const got = await page.evaluate(`(() => { const WALLS = ${JSON.stringify(gym.walls)}, STEPS = ${JSON.stringify(STEPS)};${DRIVE} })()`);
  await page.close();
  const kind = (mt) => (mt === 'steel' || mt === 'sheet-metal' ? 'dent' : 'chip');
  return [
    { name: 'loads without a page error', ok: errors.length === 0, info: errors.slice(0, 2) },
    { name: 'a round drops the 15 m dummy (the match counts it)', ok: got.drops >= 1, info: { drops: got.drops } },
    { name: 'each wall takes its own matter\'s mark', ok: Object.entries(got.walls).every(([mt, k]) => k === kind(mt)), info: got.walls },
    { name: 'the green step is climbed, the red one is not', ok: got.steps.made === true && got.steps.not === false, info: got.steps },
  ];
}

// ── the command line (when run, not imported: grow.mjs imports the gym's parts) ────────────────────────────────────────
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
async function main() {
const args = process.argv.slice(2), out = args.shift();
if (!out) { console.error('usage: gym.mjs <out-dir> [game …] [--quick json] [--camera own|other|both]'); process.exit(2); }
const opt = (k) => { const i = args.indexOf(k); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const quickArg = opt('--quick'), camArg = opt('--camera') ?? 'both';
const ci = args.indexOf('--check'), check = ci >= 0; if (check) args.splice(ci, 1);
let browser = null;
if (check) {
  const { chromium } = createRequire(import.meta.url)('playwright');
  browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
}
const report = async (file, gym) => { if (!browser) return; for (const l of await checkPage(browser, file, gym)) console.log(`   ${l.ok ? 'PASS' : 'FAIL'} page ${path.basename(file)}: ${l.name}  ${JSON.stringify(l.info)}`); };
const chosen = quickArg ? { mine: { says: 'a recipe of your own', quick: JSON.parse(quickArg) } } : Object.fromEntries((args.length ? args : ['conscription-hero', 'infinity-crisis', 'cogs-of-combat', 'steel-serpents']).map((k) => { if (!GAMES[k]) throw new Error(`no game '${k}'`); return [k, GAMES[k]]; }));
mkdirSync(out, { recursive: true });
for (const [name, Gm] of Object.entries(chosen)) {
  const minted = await mint(name, Gm.quick), m = await measureGame(name, Gm, minted);
  m.laws = laws(m);
  const R = reachOnBoxes(minted.pilot, m.mobility);
  m.reach = R;
  const gym = layGym(m, minted.pilot.rule, R), gate = gymGate(minted.pilot, gym);
  console.log(`\n━━ ${name}: the gym`);
  const J = m.mobility.jump;
  if (R) console.log(`   reach on boxes  a ledge of ${R.ledge} m (the jump ${J.height} m, plus the step ${minted.pilot.rule.step ?? 0.35} m: ${J.reach} m) · a gap of ${R.gap} m (the arc ${J.long} m, ${J.catch} m to a lip a step down)`);
  for (const g of gate) console.log(`   ${g.ok === null ? '  · ' : g.ok ? 'PASS' : 'FAIL'} ${g.id} (meant ${g.meant === 'made' ? 'to be made' : 'not to be'}): ${g.saw}`);
  if (camArg !== 'other') { const f = `${out}/${name}.html`; writeFileSync(f, page(minted, m, gym, gate, { tag: 'its own camera' })); console.log(`   wrote ${f}`); await report(f, gym); }
  const O = camArg === 'own' ? null : otherCamera(minted.payload.camera, minted.pilot);
  if (O) { const f = `${out}/${name}-${O.name}.html`; writeFileSync(f, page(minted, m, gym, gate, { cam: O.cam, extraRule: O.rule, tag: `seen from the ${O.name}` })); console.log(`   wrote ${f}`); await report(f, gym); }
}
if (browser) await browser.close();
process.exit(0);
}

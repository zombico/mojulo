// SPIKE combat tester, phase 1: THE MEASURES. A game's weapons, movement, feel and physics, measured on the runtime the
// game ships. Each game is a recipe played its own way (its feel, its kit, its camera, its goal): the game is minted
// through the real handlers, its level resolved, and the player it gives (its rule, its weapon, its kit) and the foe it
// gives (its body) are taken from the payload. Every number below is that rule stepped on the controllable runtime at
// 60 Hz on scripted presses, as feel/reach.js measures a jump. The measures are lib's now (gameworld/combat/measure.js,
// phase 5); this script mints the games and prints them. The machine gate is PASS/FAIL lines.
//
//   node scripts/spikes/combat-tester/measure.mjs [game …] [--quick '<json>'] [--json <path>] [--twice]
//   (from control/; games: see GAMES, all of them by default; --quick measures a recipe of your own)
//
// mobility   top speed, the time to reach it, the stop (from the run to rest), the counter-strafe (full one way to full
//            the other), the walk and the boost held, the jump's height and length, each beside what the feel's card
//            asked for: what the runtime does not carry is named
// lethality  each carried gun: rounds and seconds to drop the game's own foe at 5, 15 and 30 m, standing, strafing and
//            aimed, and aimed at the head; the cone the runtime fired its first round in, still, on the move,
//            aimed, and after a ten-round spray
// marks      destruction as it is seen (rupa's scars, nothing breaks): each carried gun's ten rounds at a wall 10 m off,
//            in brick, concrete, pine, sheet metal and steel: the marks' kind, size, depth and spall, and where they sit
// switching  from each carried gun to each other: press to the incoming gun's first round; each gun's reload, emptied and
//            asked for (R)
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { register } from 'node:module';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { designGameHandler } = await import('../../../lib/mcp/tools/design-game.js');
const { SketchRepository } = await import('../../../lib/db/repositories/sketches.js');
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { measureCombat, combatLaws, combatantsOf, BANDS, MATTERS } = await import('../../../lib/graph/gameworld/combat/measure.js');

// ── the games: each a recipe, played its own way ─────────────────────────────────────────────────────────────────────
// (a foe each: the tester needs the game's own foe body, not a fight; first person with no hero is the walker, a hero
// is the platform rule the feel is lowered over)
export const GAMES = {
  conscription: { says: 'the contemporary FPS, as its template plays: first person, a rifle, a sidearm and a shotgun', quick: { goal: 'shoot', foes: 1, arms: ['rifle', 'handgun', 'shotgun'], camera: 'first-person', world: { id: 'ct-conscription', feel: { pole: 'conscription', takes: true } } } },
  'conscription-hero': { says: 'the same with a body: the platform rule the feel is lowered over, seen from the eye', quick: { goal: 'shoot', foes: 1, hero: {}, arms: ['rifle', 'handgun', 'shotgun'], camera: 'first-person', world: { id: 'ct-conscription-hero', feel: { pole: 'conscription', takes: true } } } },
  'infinity-crisis': { says: 'the arena and hero shooter: the stylized pole, its kit, its feel', quick: { goal: 'deathmatch', bots: 1, pole: 'stylized', arms: ['rifle', 'smg'], camera: 'first-person', hero: {}, world: { id: 'ct-infinity', feel: { pole: 'infinity-crisis', takes: true } } } },
  'cogs-of-combat': { says: 'the third-person cover shooter: over the shoulder, heavy bodies, a rifle and a shotgun', quick: { goal: 'shoot', foes: 1, hero: {}, arms: ['rifle', 'shotgun'], camera: 'third-person', world: { id: 'ct-cogs', feel: { pole: 'cogs-of-combat', takes: true } } } },
  'steel-serpents': { says: 'the military sim\'s body over the shoulder: a careful walk, a sidearm and a sniper', quick: { goal: 'shoot', foes: 1, hero: {}, arms: ['handgun', 'sniper'], camera: 'third-person', world: { id: 'ct-serpents', feel: { pole: 'steel-serpents', takes: true } } } },
  'pole-realistic': { says: 'the shooter pole alone at its realistic end (no feel): its own feet and its own gun', quick: { goal: 'deathmatch', bots: 1, pole: 'realistic', arms: ['rifle'], world: { id: 'ct-pole-r' } } },
  'pole-stylized': { says: 'the shooter pole alone at its stylized end (no feel)', quick: { goal: 'deathmatch', bots: 1, pole: 'stylized', arms: ['rifle'], world: { id: 'ct-pole-s' } } },
};

// the measures live in lib (gameworld/combat/measure.js); this spike mints a game and hands them its player and foe
export { BANDS, MATTERS };
export const laws = combatLaws;

// ── the game, minted: its pilot and its foe ──────────────────────────────────────────────────────────────────────────
export async function mint(name, quick) {
  const ref = `ct-${name}`.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 40);
  const out = await designGameHandler({ quick, ref });
  if (out?.ok === false) throw new Error(`${name}: ${JSON.stringify(out).slice(0, 400)}`);
  const row = SketchRepository.getByRef(`${ref}-level-run-0`);
  if (!row) throw new Error(`${name}: no level run`);
  const { payload } = await resolveWorldScene(row);
  const { pilot, foe } = combatantsOf(payload);
  if (!pilot) throw new Error(`${name}: no pilot in the level`);
  return { pilot, foe, camera: payload.camera ?? null, payload };
}

// ── a game, measured ─────────────────────────────────────────────────────────────────────────────────────────────────
export async function measureGame(name, G, minted = null) {
  const { pilot, foe } = minted ?? await mint(name, G.quick);
  return measureCombat(pilot, foe, { feel: G.quick.world?.feel ?? null, camera: G.quick.camera ?? null, name, says: G.says });
}

// ── the readout ──────────────────────────────────────────────────────────────────────────────────────────────────────
export function print(m, L) {
  const A = m.asked, M = m.mobility;
  console.log(`\n━━ ${m.game}: ${m.says}`);
  console.log(`   rule ${m.rule} · camera ${m.camera ?? 'the goal\'s'} · foe hp ${m.foe?.hp ?? '–'}${A ? ` · template ${A.template} (after ${A.after}, viewer ${A.view})` : ''}`);
  console.log(`   mobility  run ${M.top} m/s in ${M.toTop} s · stop ${M.stop.s} s over ${M.stop.m} m · strafe ${M.strafe ? `${M.strafe.speed} m/s, reversed in ${M.strafe.reverse} s` : 'none'} · walk ${M.walk ?? '–'} · sprint ${M.sprint ?? '–'} · boost ${M.boost ?? '–'} · jump ${M.jump ? `${M.jump.height} m high (a ledge of ${M.jump.reach} m with the step), ${M.jump.long} m long (${M.jump.catch} m to a lip a step down), ${M.jump.commit} s to leave` : 'none'}`);
  if (A) console.log(`   the card  walk ${A.ground.walk} · run ${A.ground.run} · sprint ${A.ground.sprint} · accel ${A.ground.accel} · decel ${A.ground.decel} · jump ${A.jump} m · dodge ${A.dodge ?? '–'}${A.needs.length ? `\n   needs     ${A.needs.join('; ')}` : ''}`);
  for (const [k, s] of Object.entries(m.slots)) {
    if (s.skipped) { console.log(`   ${k}: ${s.skipped}`); continue; }
    console.log(`   ${k}  dmg ${s.dmg} · ${s.rof ? `${s.rof}/s` : `every ${s.cooldown} s`}${s.headshot ? ` · head ×${s.headshot}` : ''} · cone ${s.cone.first}° still, ${s.cone.moving}° moving, ${s.cone.aimed}° aimed, ${s.cone.spray10 ?? '–'}° at the 10th · climb ${s.cone.climb10 ?? '–'}° under the 10th`);
    for (const d of BANDS) { const t = s.ttk[d]; console.log(`      ${String(d).padStart(2)} m  still ${t.still.rounds} rds ${t.still.s} s · moving ${t.moving.rounds} rds ${t.moving.s} s · aimed ${t.aimed.rounds} rds ${t.aimed.s} s · aimed at the head ${t.head.rounds} rds ${t.head.s} s${t.burst ? ` · aimed in bursts ${t.burst.rounds} rds ${t.burst.s} s` : ''}`); }
    console.log(`      reload ${s.reload.asked} s asked · emptied ${s.reload.empty ?? '–'} s · on R ${s.reload.asked3 ?? '–'} s`);
    console.log(`      marks (ten rounds at a wall 10 m off)  ${MATTERS.map((mt) => { const W = s.walls[mt]; return `${mt} ${W.kinds.join('/') || 'none'} ${W.cm} cm ${W.mm} mm, ${W.spall} spalls`; }).join(' · ')}`);
  }
  if (m.switching) console.log(`   switching  ${Object.entries(m.switching).map(([k, v]) => `${k} ${v.s} s (asked ${v.asked})`).join(' · ')}`);
  for (const l of L) console.log(`   ${l.ok ? 'PASS' : 'FAIL'} ${l.name}${l.info !== undefined ? `  ${JSON.stringify(l.info)}` : ''}`);
}

// ── the command line (when run, not imported: gym.mjs imports the measures) ───────────────────────────────────────────
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
async function main() {
const args = process.argv.slice(2), opt = (k) => { const i = args.indexOf(k); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const flag = (k) => { const i = args.indexOf(k); if (i < 0) return false; args.splice(i, 1); return true; };
const jsonOut = opt('--json'), quickArg = opt('--quick'), twice = flag('--twice');
const chosen = quickArg ? { mine: { says: 'a recipe of your own', quick: JSON.parse(quickArg) } } : Object.fromEntries((args.length ? args : Object.keys(GAMES)).map((k) => { if (!GAMES[k]) throw new Error(`no game '${k}' (${Object.keys(GAMES).join(', ')})`); return [k, GAMES[k]]; }));
const all = [];
for (const [name, G] of Object.entries(chosen)) {
  try {
    const m = await measureGame(name, G), L = laws(m);
    print(m, L);
    if (twice) { const again = await measureGame(`${name}`, G); console.log(`   ${JSON.stringify(again) === JSON.stringify(m) ? 'PASS' : 'FAIL'} deterministic: measured twice, byte-equal`); }
    all.push({ ...m, laws: L });
  } catch (err) { console.log(`\n━━ ${name}: could not be measured: ${err.message}`); all.push({ game: name, error: err.message }); }
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(all, null, 1));
process.exit(0);
}

// SPIKE combat tester: THE FIRING RANGE for a game being designed (lib: gameworld/combat/range.js). The weapons the game
// needs, by fire type and numbers, optionally their skins: carried by a person into the gym, measured on the runtime,
// the gym's page written. No game is minted: the range comes before the levels.
//
//   node scripts/spikes/combat-tester/range.mjs [--spec '<json>'] [--out <page.html>] [--json <path>]
//   (from control/; without --spec, EXAMPLE below)
//
// spec: { weapons: [ 'rifle' | { name, fire: 'hitscan' | 'projectile' | 'melee', ...numbers } | { name, weapon } ],
//         skins?: { <name>: <kit word> | { item, model?, parts? } }, foe?: { hp } }
// Prints each weapon's measures and the laws (PASS / FAIL lines: the machine gate).
import { register } from 'node:module';
import { writeFileSync } from 'node:fs';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { rangeOf } = await import('../../../lib/graph/gameworld/combat/range.js');
const { gymPageHtml } = await import('../../../lib/graph/gameworld/combat/gym.js');

// a game being designed: a service rifle from the kit, an automatic of its own skinned as an SMG, a rocket launcher with
// no skin (a graybox tube), and a blade skinned as a tanto
export const EXAMPLE = {
  weapons: ['rifle', { name: 'zapper', fire: 'hitscan', rof: 12, damage: 9, magazine: 40, reload: 2.2, range: 40, spread: { base: 0.8, move: 2, bloom: 0.3, recover: 6, max: 4, wait: 0.15 } },
    { name: 'launcher', fire: 'projectile', speed: 35, splash: 3, damage: 60, magazine: 1, reserve: 6, reload: 2.8 }, { name: 'blade', fire: 'melee', damage: 50 }],
  skins: { zapper: 'smg', blade: { item: 'knife', model: 'tanto' } },
};

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const spec = arg('--spec') ? JSON.parse(arg('--spec')) : EXAMPLE;
const S = rangeOf(spec), m = S.m;
console.log(`the firing range: ${spec.weapons.map((w) => (typeof w === 'string' ? w : `${w.name} (${w.fire ?? w.weapon.fireClass})`)).join(', ')}`);
for (const [k, s] of Object.entries(m.slots)) {
  if (s.skipped) { console.log(`  ${k}: ${s.skipped}`); continue; }
  const t = (d) => `${d} m ${s.ttk[d].still.rounds} rds ${s.ttk[d].still.s} s${s.ttk[d].flight != null ? ` (flies ${s.ttk[d].flight} s)` : ''}`;
  console.log(`  ${k} [${s.fire}]: ${[5, 15, 30].map(t).join(' · ')} · reload ${s.reload.asked} s${s.cone ? ` · cone ${s.cone.first}° / ${s.cone.moving}° moving / ${s.cone.aimed}° aimed` : ` · burst ${s.splash} m`}${s.walls ? ` · brick ${s.walls.brick.cm} cm` : ''}`);
}
if (m.melee) console.log(`  ${m.melee.name} [melee]: reach ${m.melee.reach} m · ${m.melee.cuts} cuts, ${m.melee.s} s · past its reach ${m.melee.past ? 'untouched' : 'cut'}`);
if (m.switching) console.log(`  switch: ${Object.entries(m.switching).map(([k, v]) => `${k} ${v.s} s`).join(' · ')}`);
for (const l of m.laws) console.log(`${l.ok ? 'PASS' : 'FAIL'}  ${l.name}${l.ok ? '' : `  ${JSON.stringify(l.info ?? '')}`}`);
const out = arg('--out');
if (out) { writeFileSync(out, gymPageHtml(S.minted, m, S.gym, S.gate, { kind: 'firing range', tag: `${spec.weapons.length} weapons` })); console.log(`wrote ${out}`); }
if (arg('--json')) writeFileSync(arg('--json'), JSON.stringify({ spec, m, gate: S.gate }, null, 1));

// SPIKE combat tester: THE ARTILLERY RANGE (lib: gameworld/combat/artillery.js). A game's big gun: its mount, its rounds,
// its base, laid on the range (stands of matter at 250, 500, 1000 and 2000 m, and with the indirect shell the far field at
// 3 to 5 km), measured on the runtime, the page written.
//
//   node scripts/spikes/combat-tester/artillery.mjs [--spec '<json>'] [--out <page.html>]
//   (from control/; without --spec, a battle tank's gun on a fixed base)
//
// spec: { mount?: 'battle-tank' | 'light-tank' | 'field-gun' | 'howitzer' | 'tower' | { class, ...over },
//         ordnance?: [ 'apfsds' | 'heat' | 'he' | 'indirect' ], base?: 'fixed' | 'hull', reload?, sounds?: { shot?, reload?, burst? } }
// Prints each round's flight at its bands, what it does to each stand there, and the laws (PASS / FAIL: the machine gate).
import { register } from 'node:module';
import { writeFileSync } from 'node:fs';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { artilleryOf, artilleryHtml, artilleryReadout } = await import('../../../lib/graph/gameworld/combat/artillery.js');

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const spec = arg('--spec') ? JSON.parse(arg('--spec')) : {};
const A = artilleryOf(spec);
console.log(artilleryReadout(A).join('\n'));
for (const w of A.ordnance) {
  for (const [d, row] of Object.entries(A.terminal[w].bands)) {
    console.log(`  ${w} at ${d} m: ${Object.entries(row).map(([k, s]) => `${k} ${s.effect}${s.perforated ? '+' : ''}`).join(' · ')}`);
  }
}
for (const l of A.laws) console.log(`${l.ok ? 'PASS' : 'FAIL'} ${l.name}${l.info !== undefined ? ` (${typeof l.info === 'object' ? JSON.stringify(l.info) : l.info})` : ''}`);
const out = arg('--out');
if (out) { writeFileSync(out, artilleryHtml(spec)); console.log(`wrote ${out}`); }

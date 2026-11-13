#!/usr/bin/env node
/**
 * The Shovels & Buckets spike's board: every starter card (or the ones named) solved at each preset (or the challenge
 * given), printed as the closed form's loads, the measured session and the lever moves that got there.
 *
 *   node scripts/spikes/worksim/solve.mjs                       every card, every preset
 *   node scripts/spikes/worksim/solve.mjs kitchen roof          those cards
 *   node scripts/spikes/worksim/solve.mjs farm --challenge 0.7  one challenge between the presets
 *   node scripts/spikes/worksim/solve.mjs --card my-card.json   a card of your own
 *   --json                                                      the solver's results as JSON
 *
 * Machine gate only: it measures challenge; whether that challenge is fun is the eyes gate's (someone plays it).
 */
import { readFileSync } from 'node:fs';
import { SCENARIOS } from '../../../lib/graph/worksim/scenarios.js';
import { solve, PRESETS } from '../../../lib/graph/worksim/solve.js';

const argv = process.argv.slice(2);
const flag = (k) => { const i = argv.indexOf(k); return i < 0 ? null : argv.splice(i, 2)[1]; };
const json = argv.includes('--json'); if (json) argv.splice(argv.indexOf('--json'), 1);
const challenge = flag('--challenge'), file = flag('--card');
const cards = file ? [JSON.parse(readFileSync(file, 'utf8'))] : (argv.length ? argv : Object.keys(SCENARIOS)).map((id) => {
  if (!SCENARIOS[id]) { console.error(`no card '${id}' (${Object.keys(SCENARIOS).join(', ')})`); process.exit(1); }
  return SCENARIOS[id];
});
const targets = challenge !== null ? [Number(challenge)] : Object.keys(PRESETS);

const out = [];
for (const card of cards) {
  for (const t of targets) {
    const r = solve(card, t);
    out.push(r);
    if (json) continue;
    const m = r.metrics, a = r.analysis, D = r.card.demand;
    console.log(`\n${card.name ?? card.id} · ${r.target.name} · ${r.verdict}`);
    console.log(`  closed form   labour ${a.labour.total}s an order (shovel ${a.labour.shovel}, bucket ${a.labour.bucket}, travel ${a.labour.travel}; shovel share ${a.shovelShare}), crew load ${a.crew}, bottleneck ${a.bottleneck.at} ${a.bottleneck.load}, critical path ${a.criticalPath}s`);
    console.log(`  measured      pressure ${m.pressure}  miss ${m.miss}  slack ${m.slack}  juggle ${m.juggle} (peak ${m.jugglePeak})  burned ${m.burned}  spoiled ${m.spoiled}  served ${m.served}/session`);
    console.log(`  demand        ${D.mode === 'backlog' ? `backlog ${D.backlog}, regrowth every ${D.every ?? '-'}s` : `every ${D.every}s, patience ${D.patience}s`}, ${D.cadence}${D.rush ? `, rush ×${D.rush.factor} for ${D.rush.length}s in ${D.rush.period}s` : ''}, ${D.orders.length} order${D.orders.length > 1 ? 's' : ''}`);
    for (const mv of r.moves) console.log(`  ${mv.family.padEnd(9)} ${mv.lever}: ${JSON.stringify(mv.from)} → ${JSON.stringify(mv.to)}  (${mv.because})`);
    if (r.verdict !== 'tuned') console.log(`  ${r.says}`);
  }
}
if (json) console.log(JSON.stringify(out, null, 2));

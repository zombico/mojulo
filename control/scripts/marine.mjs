#!/usr/bin/env node
// THE SEA'S ROSTERS, SEARCHED AND CALLED (lib/graph/marine/): what grows on a bed and who lives in the water, by the
// words people say, and the cast a depth and a composition call, with what was left out and why.
//
//   node scripts/marine.mjs search <words…> [--depth <m>] [--what fauna|flora]
//   node scripts/marine.mjs cast [--mix reef|kelp|meadow|wall|deep|vents] [--depth <m>] [--find '<words>'] [--rocks n] [--anemones n] [--seed n]
//   node scripts/marine.mjs list                      every row, by where it lives
import { register } from 'node:module';

register('./mcp-stdio-loader.mjs', import.meta.url);
const { searchMarine, castMarine, checkSeaFauna, MARINE_FAUNA, MARINE_HABITS, marineAbout } = await import('@/lib/graph/marine/fauna');
const { MARINE_KINDS, MARINE_MIXES } = await import('@/lib/graph/marine/roster');
const { marineLength } = await import('@/lib/graph/worlds/marine-fauna');

const [cmd, ...rest] = process.argv.slice(2), flag = (k, d) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : d; };
const words = rest.filter((w, i) => !w.startsWith('--') && !(i > 0 && rest[i - 1].startsWith('--'))).join(' ');
const depth = flag('--depth') === undefined ? null : Number(flag('--depth'));
const line = (r) => `${r.fits ? ' ' : '✗'} ${r.what.padEnd(5)} ${r.id.padEnd(18)} ${String(r.name).padEnd(22)} ${(r.lives ?? r.seat).padEnd(8)} ${`${r.depth[0]}–${r.depth[1]} m`.padEnd(12)} ${r.why ?? r.reads}`;

if (cmd === 'search') {
  const R = searchMarine(words, { depth, what: flag('--what', null) });
  console.log(R.length ? R.map(line).join('\n') : `nothing in the sea's rosters is called '${words}'`);
} else if (cmd === 'cast') {
  const mix = flag('--mix', 'reef'), d = depth ?? 14;
  if (!MARINE_MIXES[mix]) { console.error(`--mix is one of: ${Object.keys(MARINE_MIXES).join(', ')}`); process.exit(1); }
  const C = castMarine(checkSeaFauna(flag('--find') ? { find: flag('--find') } : true), { mix, depth: d, has: { rock: Number(flag('--rocks', 5)), anemone: Number(flag('--anemones', 5)) }, lengthOf: marineLength, seed: Number(flag('--seed', 1)) });
  console.log(`${mix} under ${d} m calls:`);
  for (const c of C.cast) console.log(`  ${c.species.padEnd(18)} × ${String(c.count).padEnd(3)} ${c.lives.padEnd(8)} ${MARINE_HABITS[c.lives].reads}${c.asked ? '  (asked for)' : ''}`);
  if (C.left.length) console.log('left out:\n' + C.left.map((l) => `  ${l.species.padEnd(18)} ${l.why}`).join('\n'));
  if (C.offered.length) console.log(`also lives here: ${C.offered.join(', ')}`);
} else if (cmd === 'list') {
  for (const h of Object.keys(MARINE_HABITS)) console.log(`${h}: ${MARINE_HABITS[h].reads}\n  ${Object.keys(MARINE_FAUNA).filter((id) => MARINE_FAUNA[id].lives === h).map((id) => `${id} (${marineAbout(id).common}, ${MARINE_FAUNA[id].depth.join('–')} m${MARINE_FAUNA[id].fresh ? ', fresh water' : MARINE_FAUNA[id].ancient ? ', extinct' : ''})`).join(', ')}`);
  console.log(`grows: ${Object.entries(MARINE_KINDS).map(([id, K]) => `${id} (${K.seat}, ${K.depth.join('–')} m)`).join(', ')}`);
} else { console.log('usage: marine.mjs search <words> [--depth m] [--what fauna|flora] | cast [--mix …] [--depth m] [--find words] | list'); process.exit(cmd ? 1 : 0); }
process.exit(0);

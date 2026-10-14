#!/usr/bin/env node
/**
 * Roll vehicle sheets from a shell and print them: the design notes per channel and the dials each can land on
 * (lib/graph/car-designer/sheet.js). It builds nothing and reads no database.
 *
 *   node scripts/vehicle-roll.mjs [--brief "a rusty lifted pickup"] [--seed 1] [--n 1] [--set key=value …] [--json]
 *
 *   --brief  words the lexicon reads (lib/graph/car-designer/lexicon.js); unread words are listed
 *   --n      roll n sheets on seeds seed … seed+n-1
 *   --set    an explicit facet (pole, class, silhouette, stance, cockpit, engine, era, motif, drive, wear, livery,
 *            exaggeration); repeatable
 */
import { fileURLToPath } from 'node:url';
import { rollVehicleSheet } from '../lib/graph/car-designer/sheet.js';

export function printSheet(s) {
  const out = [`══ ${s.pole} · ${s.facets.class} · seed ${s.seed}${s.attempt ? ` (attempt ${s.attempt})` : ''} ══`, ...s.reads.map((r) => `  ${r}`)];
  for (const [ch, notes] of Object.entries(s.notes)) {
    out.push(`  ${ch}:`);
    for (const n of notes) out.push(`    · ${n.line}  [${n.from}]`);
    for (const d of s.derives[ch] ?? []) out.push(`    → ${d}`);
  }
  for (const [ch, ds] of Object.entries(s.derives)) if (!s.notes[ch]) { out.push(`  ${ch}:`); for (const d of ds) out.push(`    → ${d}`); }
  if (s.faults.length) out.push(`  faults: ${s.faults.map((f) => `${f.id}${f.held ? ' (held)' : ''}`).join(', ')}`);
  if (s.unread.words.length) out.push(`  unread: ${s.unread.words.join(' ')}`);
  return out.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), opts = { brief: '', seed: 1, n: 1, facets: {}, json: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--brief') opts.brief = args[++i];
    else if (a === '--seed') opts.seed = Number(args[++i]);
    else if (a === '--n') opts.n = Number(args[++i]);
    else if (a === '--json') opts.json = true;
    else if (a === '--set') { const [k, v] = args[++i].split('='); opts.facets[k] = k === 'exaggeration' ? Number(v) : v; }
    else { console.error(`vehicle-roll: unknown argument ${a}`); process.exit(2); }
  }
  const sheets = Array.from({ length: opts.n }, (_, k) => rollVehicleSheet({ brief: opts.brief, facets: opts.facets, seed: opts.seed + k }));
  console.log(opts.json ? JSON.stringify(sheets, null, 2) : sheets.map(printSheet).join('\n\n'));
}

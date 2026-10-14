#!/usr/bin/env node
/**
 * Roll Egocubes from a shell and print their sheets: the design notes per channel and the dials each can land on
 * (lib/graph/egocube/egocube.js). It builds nothing and reads no database.
 *
 *   node scripts/egocube-roll.mjs [--brief "a weary paladin"] [--seed 1] [--n 1] [--set key=value …] [--json]
 *
 *   --brief  words the lexicon reads (lib/graph/egocube/lexicon.js); unread words are listed
 *   --n      roll n sheets on seeds seed … seed+n-1
 *   --set    an explicit facet (age, pole, ancestry, humanity, build, role, archetype, motivation, order); repeatable
 *   --plan   also compile each sheet (lib/graph/egocube/plan.js): the thesis, the door, and the ledger's pending rows
 *   --dress  with --plan: 'designed' for the outfit designed from the sheet and the body drawn for its target (outfit.js)
 *   --out    with --plan: write each create_character call to <out>/<seed>.create.json and its after-patches beside it
 *   --audit  <file>: a plan you wrote (a create_character call, a creature spec or a bare ring plan), read against the
 *            sheet these arguments roll (lib/graph/egocube/audit.js): the ledger, the lessons, sameness
 *   --dials  with --audit: the stored dial values once minted, as JSON ('{"lean":18}')
 *   --contrast <facet>=<value>: the sheet twice, the second with one facet changed, and the first-reading choices that
 *            moved (a contrast pair: the mapping from a note to a choice, not a body to copy)
 *   --years  an age in years (it sets the age band)
 *   --skip   with --years: a fate thread, one node per skip: `--skip 5` or `--skip 5:war,training` (years, then chapter
 *            words); prints every node's sheet and what moved (lib/graph/egocube/thread.js); with --audit, `--node <i>`
 *            audits against that node's sheet (0 the canonical one)
 *   --lineages  a JSON file of your own peoples ({ id: lineage }, the shape of ancestry.js LINEAGES); roll one with
 *               --set ancestry=<id> and --n for variations of the same people
 */
import { readFileSync as readFile } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { rollEgocube } from '../lib/graph/egocube/egocube.js';
import { planFromSheet, contrastPair } from '../lib/graph/egocube/plan.js';
import { auditPlan } from '../lib/graph/egocube/audit.js';
import { rollThread } from '../lib/graph/egocube/thread.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { CHANNELS } from '../lib/graph/egocube/channels.js';

export function parseArgs(argv) {
  const opts = { brief: '', seed: 1, n: 1, facets: {}, lineages: {}, json: false, plan: false, out: null, audit: null, dials: null, contrast: null, years: null, skips: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--plan') opts.plan = true;
    else if (a === '--dress') opts.dress = argv[++i];
    else if (a === '--years') opts.years = Number(argv[++i]);
    else if (a === '--node') opts.node = Number(argv[++i]);
    else if (a === '--skip') { const [y, w] = String(argv[++i] ?? '').split(':'); opts.skips.push({ chapter: 'time', years: Number(y), ...(w ? { words: w.split(',') } : {}) }); }
    else if (a === '--audit') opts.audit = argv[++i];
    else if (a === '--dials') opts.dials = JSON.parse(argv[++i]);
    else if (a === '--contrast') { const [k, v] = String(argv[++i] ?? '').split('='); opts.contrast = { [k]: ['motivation', 'order', 'humanity'].includes(k) ? Number(v) : v }; }
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--brief') opts.brief = argv[++i] ?? '';
    else if (a === '--lineages') opts.lineages = JSON.parse(readFile(argv[++i], 'utf8'));
    else if (a === '--set') {
      const [k, v] = String(argv[++i] ?? '').split('=');
      opts.facets[k] = ['motivation', 'order', 'humanity'].includes(k) ? Number(v) : v;
    } else if (a === '--seed' || a === '--n') {
      const v = Number(argv[++i]);
      if (!Number.isInteger(v)) throw new Error(`${a} takes an integer`);
      opts[a.slice(2)] = v;
    } else throw new Error(`unknown argument '${a}'`);
  }
  return opts;
}

export function printSheet(sheet) {
  const out = [];
  out.push(`── ${sheet.path} · seed ${sheet.seed}${sheet.attempt ? ` (attempt ${sheet.attempt})` : ''} ──`);
  const f = sheet.facets;
  out.push(`  ${f.age} · ${f.pole} ${f.ancestry}${f.humanity < 1 ? ` (humanity ${f.humanity})` : ''} · ${f.build} · ${f.role} · ${f.archetype} · motivation ${f.motivation} · order ${f.order}   (given: ${sheet.given.join(', ') || 'none'})`);
  for (const r of sheet.reads) out.push(`  ${r}`);
  const c = sheet.ancestry.colours;
  out.push(`  door: ${sheet.ancestry.door} · colours: ${Object.entries(c).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  for (const [ch, notes] of Object.entries(sheet.notes)) {
    out.push(`  ${ch} (${CHANNELS[ch].life})`);
    for (const n of notes) out.push(`    · ${n.line}   [${n.from}]`);
    if (sheet.derives[ch]) out.push(`    → ${sheet.derives[ch].join(', ')}`);
  }
  if (sheet.unread.words.length) out.push(`  unread words: ${sheet.unread.words.join(', ')}`);
  if (sheet.unread.channels.length) out.push(`  no dial yet: ${sheet.unread.channels.join(', ')}`);
  for (const g of sheet.gaps) out.push(`  gap: ${g}`);
  for (const x of sheet.faults) out.push(`  fault ${x.id}${x.held ? ' (held: asked for)' : ''}: ${x.why}`);
  return out.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.skips.length) {
    const t = rollThread({ brief: opts.brief, facets: opts.facets, lineages: opts.lineages, seed: opts.seed, years: opts.years, chapters: opts.skips });
    if (opts.audit) opts.thread = t;
  }
  if (opts.skips.length && !opts.audit) {
    const t = opts.thread || rollThread({ brief: opts.brief, facets: opts.facets, lineages: opts.lineages, seed: opts.seed, years: opts.years, chapters: opts.skips });
    if (opts.json) { console.log(JSON.stringify(t, null, 2)); process.exit(0); }
    console.log(`══ fate thread · seed ${opts.seed} · kept marker: ${t.keep} ══`);
    for (const n of t.nodes) {
      console.log(`\n▶ age ${n.years} (${n.band})${n.chapter ? ` after ${n.chapter.years} years${n.chapter.words ? ` of ${n.chapter.words.join(', ')}` : ''}` : ' — the canonical node'}`);
      for (const c of n.changes) console.log(`  ${c.facet ? `${c.facet}: ${c.from} → ${c.to}` : c.came ? `+ ${c.came}` : `− ${c.went}`}`);
      console.log(printSheet(n.sheet));
    }
    process.exit(0);
  }
  const sheets = Array.from({ length: opts.n }, (_, i) => rollEgocube({ brief: opts.brief, facets: opts.facets, lineages: opts.lineages, seed: opts.seed + i, ...(opts.years != null ? { years: opts.years } : {}) }));
  if (opts.audit) {
    const sheet = opts.thread ? opts.thread.nodes[opts.node ?? 0].sheet : sheets[0], r = auditPlan(sheet, JSON.parse(readFile(opts.audit, 'utf8')), { dials: opts.dials || undefined });
    if (opts.json) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }
    console.log(`── audit · seed ${sheet.seed} · ${r.door} · ${r.expands ? 'expands' : `REFUSED: ${r.error}`} ──`);
    console.log(`  ledger: ${r.summary.carried} carried · ${r.summary.missing} missing · ${r.summary.eyes} for the eyes`);
    for (const row of r.ledger.filter((x) => x.verdict === 'missing')) console.log(`  missing ${row.channel}: ${row.line} — ${row.evidence}`);
    for (const l of r.lessons.filter((x) => !x.ok)) console.log(`  lesson ${l.id}: ${l.note}`);
    console.log(`  sameness: ${r.door === 'hero' ? 'n/a (the hero door has no joint table)' : r.sameness.flagged ? r.sameness.note : r.sameness.checked === false ? `NOT CHECKED (${r.sameness.against.map((x) => `${x.template}: ${x.unchecked}`).join(', ')})` : `designed (${r.sameness.against.map((x) => (x.worst != null ? `${x.template} worst ${x.worst}` : `${x.template} ${x.unchecked}`)).join(', ')})`}`);
    console.log(`  ${r.summary.note || ''}`);
    process.exit(0);
  }
  if (opts.contrast) {
    const pair = contrastPair({ brief: opts.brief, facets: opts.facets, lineages: opts.lineages, seed: opts.seed }, opts.contrast, rollEgocube);
    if (opts.json) { console.log(JSON.stringify(pair, null, 2)); process.exit(0); }
    console.log(`── contrast · ${JSON.stringify(pair.change)} ──\n  ${pair.note}`);
    console.log(`  a: ${pair.a.reads.slice(2, 4).join(' / ')}\n  b: ${pair.b.reads.slice(2, 4).join(' / ')}`);
    for (const m of pair.moved) console.log(`  ${m.choice}\n    a: ${m.a}\n    b: ${m.b}`);
    process.exit(0);
  }
  if (!opts.plan) console.log(opts.json ? JSON.stringify(sheets, null, 2) : sheets.map(printSheet).join('\n\n'));
  else for (const sheet of sheets) {
    const p = planFromSheet(sheet, { ...(opts.dress ? { dress: opts.dress } : {}) });
    console.log(`── seed ${sheet.seed} · ${p.door} door ──\n  thesis: ${p.thesis}`);
    for (const r of p.ledger.filter((x) => x.pending)) console.log(`  pending ${r.channel}: ${r.line} — ${r.pending}`);
    console.log(`  landed ${p.ledger.filter((x) => x.at).length} of ${p.ledger.length} notes`);
    if (opts.out) { mkdirSync(opts.out, { recursive: true }); writeFileSync(`${opts.out}/${sheet.seed}.create.json`, JSON.stringify(p.create)); writeFileSync(`${opts.out}/${sheet.seed}.after.json`, JSON.stringify(p.after)); }
  }
}

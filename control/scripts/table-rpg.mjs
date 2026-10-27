#!/usr/bin/env node
// table-rpg — a pen-and-paper module played in text at the terminal: the table RPG kernel
// (lib/graph/table-rpg/) with a prompt, no picture. The module is the bundled test module (The Sunken
// Chapel) unless a JSON file is named; the rules a starter's (target when none) or the module's own card.
//
//   node scripts/table-rpg.mjs [--module <file.json>] [--system <id>]     play: type a move, `help` for the moves, `quit`
//   node scripts/table-rpg.mjs --packet [--tape <n>]                      the referee packet (markdown) and exit
//   node scripts/table-rpg.mjs --commands 'travel standing-stones; look'  play those moves, print the transcript, exit
//   node scripts/table-rpg.mjs --book <out.html> [--style <preset>] [--parts party,…] [--pdf <out.pdf>]
//                                                         the game book (the press's page), and its print by headless
//                                                         Chromium when --pdf names a file
//
// The command list is the save: the same module and the same commands are the same game, die for die.
import { readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { register } from 'node:module';

// the table's modules reach the building programs and the browser through imports by the `@/` alias, which plain Node
// resolves only with the stdio entry's loader
register('./mcp-stdio-loader.mjs', import.meta.url);
const { readModule, refereePacket, playScript } = await import('../lib/graph/table-rpg/table-rpg-module.js');
const { tableStart, tableAct, tableLegal } = await import('../lib/graph/table-rpg/table-rpg-kernel.js');
const { TABLE_RPG_SYSTEM_IDS } = await import('../lib/graph/table-rpg/table-rpg-systems.js');
const { SUNKEN_CHAPEL } = await import('../lib/graph/table-rpg/fixtures/sunken-chapel.js');
const { tableRpgBook } = await import('../lib/graph/table-rpg/table-rpg-book.js');
const { BOOK_STYLES } = await import('../lib/graph/book/book-style.js');

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
if (argv.includes('--help')) {
  console.log(`usage: node scripts/table-rpg.mjs [--module <file.json>] [--system ${TABLE_RPG_SYSTEM_IDS.join('|')}] [--packet [--tape n]] [--commands 'a; b'] [--book out.html [--style ${Object.keys(BOOK_STYLES).join('|')}] [--pdf out.pdf]]`);
  process.exit(0);
}
const file = opt('--module');
const raw = file ? JSON.parse(readFileSync(file, 'utf8')) : SUNKEN_CHAPEL;
const system = opt('--system') ?? raw.system ?? 'target';
let read;
try { read = readModule({ ...raw, system }); } catch (err) { console.error(err.message); process.exit(1); }
const { K, checks } = read;
for (const [where, c] of [['world', checks.world], ...Object.entries(checks.dungeons)]) for (const f of c.findings) console.error(`${f.level} (${where}): ${f.text}`);

if (opt('--book') !== undefined || opt('--pdf') !== undefined) {
  let book;
  try { book = tableRpgBook(K, { style: opt('--style') ?? 'tome', ...(opt('--parts') ? { parts: opt('--parts').split(',') } : {}) }); } catch (err) { console.error(err.message); process.exit(1); }
  for (const f of book.findings) console.error(`${f.level} (style): ${f.text}`);
  if (opt('--book')) { writeFileSync(opt('--book'), book.html); console.error(`book: ${opt('--book')} (${Math.round(book.html.length / 1024)} KB)`); }
  if (opt('--pdf')) {
    const { printPdf } = await import('../lib/graph/book/book-pdf.js');
    try { writeFileSync(opt('--pdf'), await printPdf(book.html, { allowFetch: false })); console.error(`pdf: ${opt('--pdf')}`); } catch (err) { console.error(`pdf: ${err.message}`); process.exit(1); }
  }
  process.exit(0);
}
if (argv.includes('--packet')) { console.log(refereePacket(K, { tape: +(opt('--tape') ?? 20) })); process.exit(0); }
if (opt('--commands') !== undefined) {
  console.log(playScript(K, opt('--commands').split(';').map((c) => c.trim()).filter(Boolean)).lines.join('\n'));
  process.exit(0);
}

let { S, lines } = tableStart(K);
console.log(lines.join('\n'));
const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: '> ' });
rl.prompt();
rl.on('line', (text) => {
  const t = text.trim();
  if (t === 'quit' || t === 'exit') { rl.close(); return; }
  if (t === 'help') console.log(tableLegal(K, S).map((m) => `  ${m.name}`).join('\n'));
  else if (t) { const r = tableAct(K, S, t); S = r.S; console.log(r.lines.join('\n')); }
  if (S.over) { rl.close(); return; }
  rl.prompt();
});

#!/usr/bin/env node
// table-rpg — a pen-and-paper module played in text at the terminal: the table RPG kernel
// (lib/graph/table-rpg/) with a prompt, no picture. The module is the bundled test module (The Sunken
// Chapel) unless a JSON file is named; the rules a starter's (target when none) or the module's own card.
//
//   node scripts/table-rpg.mjs [--module <file.json>] [--system <id>]     play: type a move, `help` for the moves, `quit`
//   node scripts/table-rpg.mjs --packet [--tape <n>]                      the referee packet (markdown) and exit
//   node scripts/table-rpg.mjs --commands 'travel standing-stones; look'  play those moves, print the transcript, exit
//
// The command list is the save: the same module and the same commands are the same game, die for die.
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { readModule, refereePacket, playScript } from '../lib/graph/table-rpg/table-rpg-module.js';
import { tableStart, tableAct, tableLegal } from '../lib/graph/table-rpg/table-rpg-kernel.js';
import { TABLE_RPG_SYSTEM_IDS } from '../lib/graph/table-rpg/table-rpg-systems.js';
import { SUNKEN_CHAPEL } from '../lib/graph/table-rpg/fixtures/sunken-chapel.js';

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
if (argv.includes('--help')) {
  console.log(`usage: node scripts/table-rpg.mjs [--module <file.json>] [--system ${TABLE_RPG_SYSTEM_IDS.join('|')}] [--packet [--tape n]] [--commands 'a; b']`);
  process.exit(0);
}
const file = opt('--module');
const raw = file ? JSON.parse(readFileSync(file, 'utf8')) : SUNKEN_CHAPEL;
const system = opt('--system') ?? raw.system ?? 'target';
let read;
try { read = readModule({ ...raw, system }); } catch (err) { console.error(err.message); process.exit(1); }
const { K, checks } = read;
for (const [where, c] of [['world', checks.world], ...Object.entries(checks.dungeons)]) for (const f of c.findings) console.error(`${f.level} (${where}): ${f.text}`);

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

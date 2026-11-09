#!/usr/bin/env node
/**
 * THE PRACTICE ROOM'S MEASURES — the CLI over lib/graph/gameworld/feel/measure.js (the feel chapter's machine gate): a
 * game's swings and strings played headless on the runtime it ships, each number beside what its kit and its feel card
 * ask: carried, partly or lost. design_game's readout carries the same (`feel.measured`).
 *
 *   cd control
 *   node scripts/spikes/practice-room/measure.mjs                           # every template that fights hand to hand, its room
 *   node scripts/spikes/practice-room/measure.mjs --feel fable-of-artesia   # one template's room
 *   node scripts/spikes/practice-room/measure.mjs --game keep-hero          # a stored game's room (MOJULO_DATA_DIR)
 *   node scripts/spikes/practice-room/measure.mjs --page <level.html> [--feel <feel>]   # a built level's own pilot
 *   node scripts/spikes/practice-room/measure.mjs --json                    # the numbers alone
 *
 * Machine gate only: nobody has looked.
 */
import { register } from 'node:module';
import fs from 'node:fs';
register('../../mcp-stdio-loader.mjs', import.meta.url);

const argv = process.argv.slice(2);
const opt = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const { measureRule, measureRoom } = await import('../../../lib/graph/gameworld/feel/measure.js');
const { POLES } = await import('../../../lib/graph/gameworld/feel/cards.js');

/** a built level page's pilot rule, as the page plays it (its world's entities, inlined) */
export function pageRule(html) {
  const at = html.indexOf('createWorld({ entities: ');
  if (at < 0) throw new Error('measure: no controllable world on that page');
  let i = html.indexOf('[', at), depth = 0, j = i, str = false;
  for (; j < html.length; j++) {
    const ch = html[j];
    if (str) { if (ch === '\\') j++; else if (ch === '"') str = false; continue; }
    if (ch === '"') str = true; else if (ch === '[' || ch === '{') depth++; else if (ch === ']' || ch === '}') { depth--; if (!depth) break; }
  }
  const ents = JSON.parse(html.slice(i, j + 1)), p = ents.find((e) => e.pilotable) ?? ents[0];
  return p.rule;
}

function report(name, M) {
  console.log(`\n${name}  carried ${M.tally.carried} · partly ${M.tally.partly} · lost ${M.tally.lost}`);
  for (const W of M.weapons) for (const C of W.combos) {
    if (C.skipped) { console.log(`  ${W.id} ${C.id} (${C.beats}): not measured, ${C.skipped}`); continue; }
    console.log(`  ${W.id} ${C.id} (${C.beats})`);
    for (const m of C.moves) {
      const cell = (k, unit) => (m.asked?.[k] !== undefined ? `${k} ${JSON.stringify(m.ran[k])}${unit} (asked ${JSON.stringify(m.asked[k])}) ${m.verdicts[k === 'next' ? 'chain' : k === 'frames' ? 'length' : k]}` : null);
      console.log(`    ${m.move.padEnd(16)}${[cell('contact', ' f'), cell('next', ' f'), cell('frames', ' f'), cell('travel', ' m')].filter(Boolean).join(' · ') || Object.values(m.verdicts).join(' ')}`);
    }
  }
  for (const r of M.card) console.log(`  the card's ${r.measure.padEnd(10)}${r.ran.padEnd(22)}(asked ${r.asked}) ${r.verdict}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = {};
  if (opt('--page')) {
    const feel = opt('--feel') ? (opt('--feel').startsWith('{') ? JSON.parse(opt('--feel')) : opt('--feel')) : null;
    out.page = measureRule(pageRule(fs.readFileSync(opt('--page'), 'utf8')), feel);
  } else if (opt('--game')) {
    if (!process.env.MOJULO_DATA_DIR && !process.env.MOJULO_HOME) { console.error('measure: set MOJULO_DATA_DIR to the data directory the game was made in'); process.exit(2); }
    (await import('../../mojulo-paths.mjs')).resolveMojuloPaths();
    const { SketchRepository } = await import('../../../lib/db/repositories/sketches.js');
    const { gameworldOf } = await import('../../../lib/graph/gameworld/gameworld-kind.js');
    const row = SketchRepository.getByRef(opt('--game'));
    if (!row) throw new Error(`measure: no gameworld '${opt('--game')}'`);
    out[opt('--game')] = measureRoom(gameworldOf(row.manifest));
    if (!out[opt('--game')]) throw new Error('measure: that game has no practice room (its feel does not fight hand to hand)');
  } else for (const f of opt('--feel') ? [opt('--feel')] : Object.keys(POLES).filter((id) => POLES[id].demo.includes('attack'))) { const M = measureRoom({ feel: f }); if (M) out[f] = M; }
  if (argv.includes('--json')) console.log(JSON.stringify(out, null, 1));
  else for (const [k, M] of Object.entries(out)) report(k, M);
  process.exit(0);
}

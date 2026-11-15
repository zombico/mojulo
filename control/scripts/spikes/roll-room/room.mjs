#!/usr/bin/env node
/**
 * THE ROLL ROOM — the CLI over lib/graph/gameworld/practice-room-page.js rollRoomHtml (the room itself: roll-room.js),
 * the same page a gameworld serves as `bible?book=practice&room=roll`. No level and no database are needed: the hero
 * is a stand-in on the feel template named.
 *
 *   cd control
 *   node scripts/spikes/roll-room/room.mjs --feel conscription --out /abs/dir [--cast female] [--sound realistic|none] [--cdn]
 *   node scripts/spikes/roll-room/room.mjs --measure            # every feel template: the seeds audit, the forms that stop it
 *   node scripts/spikes/roll-room/room.mjs --feel commuter-rail-runner --map --out /abs/dir   # the course map (a momentum hero's)
 *
 * Open the page with ?seed=<n> for a roll (R the next, Shift+R the one before). A spike: the eyes gate is the operator's.
 */
import { register } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
register('../../mcp-stdio-loader.mjs', import.meta.url);
process.env.SQLITE_PATH ??= ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED ??= '1';

const argv = process.argv.slice(2);
const opt = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const { POLES } = await import('../../../lib/graph/gameworld/feel/cards.js');
if (argv.includes('--measure')) {
  const { rollRoomMeasured } = await import('../../../lib/graph/gameworld/roll-room.js');
  for (const feel of Object.keys(POLES)) { const M = rollRoomMeasured({ id: 'g', feel, roll: true }); console.log(`${feel.padEnd(22)} ${M.seeds} seeds, ${M.distinct} yards · lost: ${M.lost.join(', ') || 'none'} · stopped by: ${M.forms.stops.join(', ') || 'nothing'}`); }
  process.exit(0);
}
const feel = opt('--feel', 'conscription'), out = path.resolve(opt('--out', 'roll-room'));
if (!POLES[feel]) { console.error(`room: feel is one of ${Object.keys(POLES).join(', ')}`); process.exit(2); }
const { rollRoomHtml, practiceHtml } = await import('../../../lib/graph/gameworld/practice-room-page.js');
if (argv.includes('--map')) {
  const M = await practiceHtml({ id: 'roll-room', name: POLES[feel].name, feel, roll: true }, 'roll', { view: 'map' });
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(path.join(out, 'course-map.html'), M.html);
  console.log(`room: ${path.join(out, 'course-map.html')} (${(M.html.length / 1024).toFixed(0)} KB)`);
  process.exit(0);
}
const P = await rollRoomHtml({ id: 'roll-room', name: POLES[feel].name, feel, roll: true }, { cast: opt('--cast', 'male'), sound: opt('--sound', 'realistic'), cdn: argv.includes('--cdn') });
await fs.mkdir(out, { recursive: true });
const file = path.join(out, 'roll-room.html');
await fs.writeFile(file, P.html);
console.log(`room: ${file} (${(P.html.length / 1e6).toFixed(1)} MB) · ${P.room.ways} yards · measured ${JSON.stringify(P.measured)}`);
process.exit(0);

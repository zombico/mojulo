#!/usr/bin/env node
/**
 * THE MOUNT TREADMILL (the mount lane) — the CLI over lib/graph/gameworld/practice-room-page.js mountLaneHtml (the room itself: mount-lane.js),
 * the same page a gameworld serves as `bible?book=practice&room=mount`. No level needs to be built:
 * the run's hero and foes play where it has made them, stand-ins where not.
 *
 *   cd control
 *   export MOJULO_DATA_DIR=… MOJULO_OUTCOMES_DIR=…          # a database a game was made in
 *   node scripts/spikes/mount-treadmill/room.mjs --game keep-hero --out /abs/dir [--cast female] [--coat chestnut] [--sound realistic|none] [--cdn]
 *
 * A spike: the eyes gate is the operator's.
 */
import { register } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
register('../../mcp-stdio-loader.mjs', import.meta.url);
if (!process.env.MOJULO_DATA_DIR && !process.env.MOJULO_HOME) { console.error('room: set MOJULO_DATA_DIR to the data directory a game was made in'); process.exit(2); }
(await import('../../mojulo-paths.mjs')).resolveMojuloPaths();

const argv = process.argv.slice(2);
const opt = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const game = opt('--game', 'keep-hero'), out = path.resolve(opt('--out', 'mount-treadmill'));
const { SketchRepository } = await import('../../../lib/db/repositories/sketches.js');
const { gameworldOf } = await import('../../../lib/graph/gameworld/gameworld-kind.js');
const { mountLaneHtml, roomRefs } = await import('../../../lib/graph/gameworld/practice-room-page.js');
const row = SketchRepository.getByRef(game);
if (!row) throw new Error(`room: no gameworld '${game}' in this database (MOJULO_DATA_DIR)`);
const G = gameworldOf(row.manifest);
const refs = await roomRefs(G, game, (r) => !!SketchRepository.getByRef(r));
const P = await mountLaneHtml(G, { refs, cast: opt('--cast', 'male'), sound: opt('--sound', 'realistic'), cdn: argv.includes('--cdn'), ...(opt('--coat') ? { coat: opt('--coat') } : {}) });
await fs.mkdir(out, { recursive: true });
const file = path.join(out, 'mount-treadmill.html');
await fs.writeFile(file, P.html);
console.log(`room: ${file} (${(P.html.length / 1e6).toFixed(1)} MB) · the card ${JSON.stringify(P.card)}`);
process.exit(0);

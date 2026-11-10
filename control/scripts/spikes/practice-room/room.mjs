#!/usr/bin/env node
/**
 * THE PRACTICE ROOM — a game's hero and one of its foes on its feel template's stage, greyboxed, on the runtime the game
 * ships: the CLI over lib/graph/gameworld/practice-room.js (the room) and practice-room-page.js (its page and HUD), the
 * same page a gameworld serves as `bible?book=practice`. No level needs to be built: the run's hero and foes play where
 * it has made them, stand-ins where it has not.
 *
 *   cd control
 *   export MOJULO_DATA_DIR=… MOJULO_OUTCOMES_DIR=…          # a database a game was made in (README of the-old-keep)
 *   node scripts/spikes/practice-room/room.mjs --game keep-hero --out /abs/dir [--pack 3] [--strings 2.5] [--cast female]
 *     [--kit fallen-angel] [--art inspired] [--combos my.json] [--hero anime | tiered | <spec>] [--sound none] [--cdn]
 *
 * The arsenal: the game's `arsenal`, else its feel template's kit, else the basic one; --kit a template's kit over it,
 * --combos an arsenal (or one weapon's combo manifest) over both, --art the sword art over whichever. --hero a stand-in body
 * in place of the game's hero. Keys in the room: P the foe's AI on / off, K the foe set back, H the HUD. The eyes gate is
 * the operator's.
 */
import { register } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
register('../../mcp-stdio-loader.mjs', import.meta.url);
// (the database the bins use, ~/.mojulo or MOJULO_DATA_DIR, never control/data: scripts/mojulo-paths.mjs, as mcp-stdio does)
if (!process.env.MOJULO_DATA_DIR && !process.env.MOJULO_HOME) { console.error('room: set MOJULO_DATA_DIR to the data directory a game was made in'); process.exit(2); }
(await import('../../mojulo-paths.mjs')).resolveMojuloPaths();

const argv = process.argv.slice(2);
const opt = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const game = opt('--game', 'keep-hero'), out = path.resolve(opt('--out', 'practice-room'));

const { SketchRepository } = await import('../../../lib/db/repositories/sketches.js');
const { gameworldOf } = await import('../../../lib/graph/gameworld/gameworld-kind.js');
const { TEMPLATE_ARSENALS, readCombos, readArsenal, comboList } = await import('../../../lib/graph/gameworld/combos.js');
const { roomArsenal } = await import('../../../lib/graph/gameworld/practice-room.js');
const { practiceRoomHtml, roomRefs } = await import('../../../lib/graph/gameworld/practice-room-page.js');
const row = SketchRepository.getByRef(game);
if (!row) throw new Error(`room: no gameworld '${game}' in this database (MOJULO_DATA_DIR)`);
const G = gameworldOf(row.manifest);

// THE ARSENAL: the game's (roomArsenal), --kit over it, --combos over both, --art over whichever
const kit = opt('--kit');
if (kit && !TEMPLATE_ARSENALS[kit]) throw new Error(`room: --kit is ${Object.keys(TEMPLATE_ARSENALS).join(' | ')}`);
const given = opt('--combos') ? JSON.parse(await fs.readFile(opt('--combos'), 'utf8')) : null;
const base = given ? (given.weapons ? given : { ...(given.timing ? { timing: given.timing } : {}), weapons: [{ id: 'sword', name: 'Sword', figure: 'drawn', ...readCombos(given) }] })
  : kit ? structuredClone(TEMPLATE_ARSENALS[kit]) : roomArsenal(G).arsenal;
const arsenal = readArsenal({ ...base, ...(opt('--art') ? { art: opt('--art') } : {}) });

// THE HERO: the game's own, or (--hero) a stand-in body: `anime` the anime hero on the tiered body, `tiered`, or a spec
const HEROES = { anime: { head: 'anime', proportions: 'anime', form: 'tiered' }, tiered: { form: 'tiered' } };
const heroArg = opt('--hero'), standIn = heroArg ? (HEROES[heroArg] ?? JSON.parse(heroArg)) : null;
const refs = await roomRefs(G, game, (r) => !!SketchRepository.getByRef(r));
if (standIn) { delete refs.hero; delete refs.sheathed; }

const P = await practiceRoomHtml(G, { refs, arsenal, ...(standIn ? { standIn } : {}), cast: opt('--cast', 'male'), pack: Math.max(1, Number(opt('--pack', '1'))),
  strings: Number(opt('--strings', '2.5')), sound: opt('--sound', 'realistic'), cdn: argv.includes('--cdn') });
await fs.mkdir(out, { recursive: true });
const file = path.join(out, 'practice-room.html');
await fs.writeFile(file, P.html);
// THE COMBO MANIFEST: what the room played, every combo unlocked, for the game's director (its `arsenal`)
await fs.writeFile(path.join(out, 'combos.json'), JSON.stringify(arsenal, null, 2));
const R = P.room;
const label = kit ?? (given ? 'given' : roomArsenal(G).kit ?? 'basic');
console.log(`room (${label} kit, ${arsenal.art ?? 'realistic'}): ${arsenal.weapons.map((W) => `${W.name ?? W.id}: ${comboList({ moves: W.moves, combos: W.combos }).map((c) => `${c.beats} ${c.name}`).join(', ')}`).join(' · ')} → ${path.join(out, 'combos.json')}`);
console.log(`room: ${file} (${(P.html.length / 1e6).toFixed(1)} MB) · on ${R.stage} · the hero ${R.hero}, the foe ${R.foe.eid} (${R.foe.made ? 'made' : 'standing in'}) at ${P.foeHp} hp (${P.string.beats}: ${P.string.damage} a string, ${P.string.hits} hits)`);
process.exit(0);

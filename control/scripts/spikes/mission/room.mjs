#!/usr/bin/env node
/**
 * THE INFILTRATION YARD — the CLI over lib/graph/gameworld/infiltration-room.js: the page of a stealth action game's
 * practice room, written to a folder. A spike: the room is not on the practice door yet.
 *
 *   cd control
 *   node scripts/spikes/mission/room.mjs --out /abs/dir [--hero <a stored hero's ref>] [--guard <a stored figure's ref>] [--vault speedVault] [--roll rollForward] [--climb climbUp] [--throw throwOverhand] [--prone proneIdle,proneCrawl] [--crouch crouchIdle,crouchWalk] [--feel steel-serpents] [--arms rifle,sniper] [--cdn] [--capture]
 *
 * `--hero` needs the database the hero was minted in (MOJULO_DATA_DIR); without it the hero is a stand-in person and
 * no database is read. `--vault`, `--roll` and `--climb` name the hero's own clips for each (its motion words speedVault, rollForward; a clip of its own, climbUp). `--capture` exposes the page's bodies to a headless test (window.__mojCtrl.bodies).
 */
import { register } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const argv = process.argv.slice(2);
const opt = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const hero = opt('--hero'), feel = opt('--feel', 'steel-serpents'), out = path.resolve(opt('--out', 'infiltration-yard'));
if (!hero && !argv.includes('--guard')) process.env.SQLITE_PATH ??= ':memory:';
// (the hero's database: the data directory's, as the bins read it)
else if (process.env.MOJULO_DATA_DIR) process.env.SQLITE_PATH ??= path.join(process.env.MOJULO_DATA_DIR, 'mojulo-lite.db');
process.env.MOJULO_SEMANTIC_INDEX_DISABLED ??= '1';

const { infiltrationRoom } = await import('../../../lib/graph/gameworld/infiltration-room.js');
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
// (`--arms rifle,sniper`: a carried kit of the arms kit's words in place of the feel template's, to try a gun in the yard)
const arms = opt('--arms');
const G = { id: 'steel-serpents', name: 'Steel Serpents', feel, ...(arms ? { quick: { arms: arms.split(',') } } : {}) };
const guard = opt('--guard');
const room = infiltrationRoom(G, { refs: { ...(hero ? { hero } : {}), ...(guard ? { guard } : {}) }, vault: opt('--vault'), roll: opt('--roll'), climb: opt('--climb'), toss: opt('--throw'), crouch: opt('--crouch') ? { idle: opt('--crouch').split(',')[0], walk: opt('--crouch').split(',')[1] } : null, prone: opt('--prone') ? { idle: opt('--prone').split(',')[0], crawl: opt('--prone').split(',')[1] } : null });
const { payload } = await resolveWorldScene({ ref: 'steel-serpents-infiltration-yard', manifest: room.manifest }, {});
const cdn = argv.includes('--cdn');
// (the game's HUD: the guard's sight is drawn on its radar)
const { levelHud } = await import('../../../lib/graph/game/hud-mana.js');
const html = emitThreeWorld({ ...payload, wireframe: false, walk: true, spin: false, decollide: true, hud: false, manaHud: levelHud('field-brief'), inline: !cdn, cdn, ...(argv.includes('--capture') ? { capture: true } : {}) });
await fs.mkdir(out, { recursive: true });
const file = path.join(out, 'infiltration-yard.html');
await fs.writeFile(file, html);
const HF = payload.figures?.hero ?? {};
console.log(`room: clips ${Object.keys(HF.clips ?? {}).join(', ')} · vault plays ${room.manifest.figures.hero.clips.vault ?? '(nothing)'}, mantle ${room.manifest.figures.hero.clips.mantle ?? '(nothing)'}, dive ${room.manifest.figures.hero.clips.dodge_roll ?? '(the page\'s tumble)'}`);
console.log(`room: ${file} (${(html.length / 1e6).toFixed(1)} MB) · hero ${room.hero} · kit ${room.kit.join(', ') || 'none'}${room.knife ? ' + knife' : ''} · targets ${room.targets.length}`);
process.exit(0);

// board channel: a tactics board over the world's ground (lib/graph/board). Opt-in on a world's `board` key (the
// board's data: board/board-page.js boardChannelData); absent, it adds nothing to the page.
//
// One block, so none of the board's names reach the page's scope: the board kernel and the tactical camera from their
// own source (buildBoard, buildBoardCamera, buildBoardMind: the code Node tests), and the page (boardPage) that draws the grid, the
// highlights, the cursor and the units, reads the keys and the pointer, and drives the camera. It hands the page its
// frame step through `stepBoard` (a let the page declares when the block is present) and publishes `window.__mojBoard`
// for probes. It owns the camera (`__ctrlOwnsCamera`), so a board carries no pilot. A battle brings the party battles'
// kernel and the carry (board-carry.js) with it, so a game's party fights as the store has it and keeps its spoils; a
// battle, or a level whose scenes fill a story slot, brings the effects (board-fx.js), played on the map itself; a
// tower defence (`td`) brings its kernel and its page (board-td.js, board-td-page.js), and the effects for its shots.

import { safeJson } from '../emit-util.js';
import { buildBoard } from '../../board/board-kernel.js';
import { buildBoardCamera } from '../../board/board-camera.js';
import { boardPage } from '../../board/board-page.js';
import { buildBoardMind } from '../../board/board-mind.js';
import { buildBoardCarry } from '../../board/board-carry.js';
import { buildBoardFx } from '../../board/board-fx.js';
import { buildBoardTd } from '../../board/board-td.js';
import { boardTdPage } from '../../board/board-td-page.js';
import { buildRpg } from '../../playscape/rpg/kernel.js';

export function boardChannelScript(cfg) {
  // the trailing arguments a page needs, each null when a later one is there and it is not
  const carry = cfg.battle && cfg.battle.rpg, td = !!cfg.td, fx = cfg.battle || (cfg.slots && cfg.slots.length) || td;
  const args = [carry && `(${buildRpg.toString()})()`, carry && `(${buildBoardCarry.toString()})()`, fx && `(${buildBoardFx.toString()})()`, td && `(${buildBoardTd.toString()})()`, td && `(${boardTdPage.toString()})`];
  while (args.length && !args[args.length - 1]) args.pop();
  const rest = args.map((a) => a || 'null');
  return `
// ── board: the tactics board on this world ──
{
stepBoard = (${boardPage.toString()})(${safeJson(cfg)}, (${buildBoard.toString()})(), (${buildBoardCamera.toString()})(), (${buildBoardMind.toString()})()${rest.map((x) => `, ${x}`).join('')});
}`;
}

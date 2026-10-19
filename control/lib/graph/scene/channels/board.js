// board channel: a tactics board over the world's ground (lib/graph/board). Opt-in on a world's `board` key (the
// board's data: board/board-page.js boardChannelData); absent, it adds nothing to the page.
//
// One block, so none of the board's names reach the page's scope: the board kernel and the tactical camera from their
// own source (buildBoard, buildBoardCamera: the code Node tests), and the page (boardPage) that draws the grid, the
// highlights, the cursor and the units, reads the keys and the pointer, and drives the camera. It hands the page its
// frame step through `stepBoard` (a let the page declares when the block is present) and publishes `window.__mojBoard`
// for probes. It owns the camera (`__ctrlOwnsCamera`), so a board carries no pilot.

import { safeJson } from '../emit-util.js';
import { buildBoard } from '../../board/board-kernel.js';
import { buildBoardCamera } from '../../board/board-camera.js';
import { boardPage } from '../../board/board-page.js';

export function boardChannelScript(cfg) {
  return `
// ── board: the tactics board on this world ──
{
stepBoard = (${boardPage.toString()})(${safeJson(cfg)}, (${buildBoard.toString()})(), (${buildBoardCamera.toString()})());
}`;
}

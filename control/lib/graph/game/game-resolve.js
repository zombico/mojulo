/**
 * game-resolve — turn a stored game manifest into `emitGameShell` inputs by resolving each
 * level ref to its level sketch's `game` contract (game-metacontext.plan.md).
 *
 * Contracts live on the LEVEL sketches (their world manifest's `game` channel), not baked into
 * the game row — the game manifest is a pure recipe of refs, resolved on demand exactly like a
 * world's `beatsRef` (recipes, not renders; no staleness). This module is the resolution seam,
 * shared by the mint (verify-at-author-time) and the /game serve route (assemble-at-play-time).
 *
 * `src` for each level points at that level's live World page — the shell hosts it in an
 * iframe and speaks the postMessage contract to it. (The portable standalone-folder export,
 * where levels are inlined self-contained HTML, is a later phase; this is the served form.)
 */

import { validateGameManifest, normalizeGameManifest } from './game-manifest.js';
import { validateLevelContract, normalizeLevelContract } from './level-contract.js';

/**
 * @param {object} manifest        a game manifest (validated here)
 * @param {(ref:string)=>object|null} getSketch  ref → stored sketch ({ manifest, ... }) | null
 * @param {(ref:string)=>string} levelSrc        ref → the level's playable URL (iframe src)
 * @returns {{ manifest, levels }}  normalized manifest + emitGameShell level entries
 * @throws  with a teaching message listing every fault (manifest, missing level, bad contract)
 */
export function resolveGame(manifest, getSketch, levelSrc) {
  const v = validateGameManifest(manifest);
  if (!v.ok) throw new Error(`game manifest is invalid:\n- ${v.errors.join('\n- ')}`);
  const norm = normalizeGameManifest(manifest);

  const errors = [];
  const levels = [];
  for (const lv of norm.levels) {
    const sketch = getSketch(lv.ref);
    if (!sketch || !sketch.manifest) { errors.push(`level '${lv.ref}': no sketch with that ref`); continue; }
    const game = sketch.manifest.game;
    if (!game || typeof game !== 'object') {
      errors.push(`level '${lv.ref}': its sketch carries no \`game\` channel — a level is a world minted WITH a level contract (compose_world … { game: { levelRef, produces, … } })`);
      continue;
    }
    const cv = validateLevelContract(game, norm.store);
    if (!cv.ok) { errors.push(`level '${lv.ref}' contract (against this game's store): ${cv.errors.join('; ')}`); continue; }
    levels.push({ ref: lv.ref, title: lv.title, contract: normalizeLevelContract(game), src: levelSrc(lv.ref) });
  }
  if (errors.length) throw new Error(`cannot assemble game '${norm.title}':\n- ${errors.join('\n- ')}`);
  return { manifest: norm, levels };
}

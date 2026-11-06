/**
 * THE WORKSHOP — where a game can be made and where it can be seen, said BEFORE the work commits to a direction.
 *
 * A cloud box (Claude Code on the web's, a Codex cloud task's) builds any game and runs its machine gates (the laws, the
 * walk compiled without drawing, the desktop smoke); what it cannot always do is SHOW it: a level reaches the operator
 * as a page only under the box's page limit (an artifact is 16 MB a file), the box draws WebGL in software (`gpu:
 * false` on its handoff row: it checks, it does not play), and it forgets everything when the session ends (the
 * database lives in its container). A game whose level outgrows the page limit is played on the operator's machine,
 * one of two ways, and the operator chooses before the chapter is built, not after.
 *
 *   gameWeight(world)  → { levels: [{ level, estimated, tiles?, faces?, bytes? }], heaviest } — an ESTIMATE from the recipe,
 *                        nothing built: a glyph map's tiles by kind × WEIGHT (measured on a 48-tile chapter map, 2026-11-06);
 *                        any other level is not estimated (said so, never guessed)
 *   workshopAdvice({ box, surface, weight }) → null | { fits: false, over: [...], says, paths, card }
 *                        null where nothing needs saying: on the operator's own machine, or every estimated level within
 *                        the box's limit. `box`: the host's handoff box row (null: not known); `surface`: 'local' | 'box' |
 *                        null (unknown: said, as the handoff note says both rows)
 *
 * The paths (the gameworld-workshop card says them in the operator's words):
 *   local    install mojulo on the laptop and carry the work over: the database packed into one file
 *            (scripts/pack-data.mjs) and dropped in; the game seen at speed there, each change on the next reload
 *   desktop  keep building in the box; each look a desktop export (export_game target 'desktop') downloaded and
 *            started (npm install && npm start); the box's machine gates still run every time
 *   small    keep each level under the box's limit (fewer tiles, a lighter dress) and play it as a page
 * Pure.
 */
import { readGrid } from '../level/grid.js';

// a glyph map's tile on the page, by kind: its faces and its geometry's bytes (a path or a place: the kit's 0.5 m
// ground, its path, its dress; open land: the 1 m ground, LAND_CELL). Measured, not derived (the 6×8 chapter map: 18
// dressed tiles and 30 open, 727k faces, 51 MB): re-measure when a tile's dress changes much (docs/workshop.md says how)
export const WEIGHT = Object.freeze({ path: { faces: 22000, bytes: 1.5e6 }, place: { faces: 22000, bytes: 1.5e6 }, land: { faces: 11000, bytes: 0.75e6 } });

export function gameWeight(world = {}) {
  const levels = [];
  for (const [id, L] of Object.entries(world.levels ?? {})) {
    if (!L?.glyphs?.rows) { levels.push({ level: id, estimated: false }); continue; }
    let G; try { G = readGrid({ rows: L.glyphs.rows, ...(L.glyphs.key ? { key: L.glyphs.key } : {}), ...(L.glyphs.tile !== undefined ? { tile: L.glyphs.tile } : {}) }); } catch { levels.push({ level: id, estimated: false }); continue; }
    // (a tile's weight scales with its area: the measure is a 48 m tile's)
    const k = (G.tile / 48) ** 2, faces = Math.round(G.cells.reduce((a, x) => a + WEIGHT[x.kind].faces * k, 0)), bytes = Math.round(G.cells.reduce((a, x) => a + WEIGHT[x.kind].bytes * k, 0));
    levels.push({ level: id, estimated: true, tiles: G.cells.length, faces, bytes });
  }
  const heaviest = levels.filter((l) => l.estimated).reduce((m, l) => (!m || l.bytes > m.bytes ? l : m), null);
  return { levels, heaviest: heaviest?.level ?? null };
}

const MB = (n) => `${Math.round(n / 1048576)} MB`;   // (MiB, as the hosts' limits are written)

export function workshopAdvice({ box = null, surface = null, weight } = {}) {
  if (surface === 'local' || !weight) return null;
  const limit = box?.pageMaxBytes ?? null;
  const over = limit ? weight.levels.filter((l) => l.estimated && l.bytes > limit) : [];
  if (!over.length) return null;
  const where = surface === 'box' ? `this box (${box.name})` : `a cloud box like ${box.name} (if that is where this runs)`;
  const also = [box.gpu === false ? 'draws WebGL in software (it checks a level, it does not play one)' : null, box.ephemeral ? 'forgets the work when the session ends' : null].filter(Boolean);
  const says = `${over.map((l) => `'${l.level}' (about ${MB(l.bytes)} of geometry, ${Math.round(l.faces / 1000)}k faces)`).join(', ')} will not reach you as a page from ${where}, whose limit is ${MB(limit)} a file.${also.length ? ` The box also ${also.join(' and ')}.` : ''} Choose where it is seen before it is built.`;
  return {
    fits: false, over: over.map((l) => l.level), says,
    paths: [
      { path: 'local', recommended: true, does: 'install mojulo on your laptop and carry this work over (one packed file); see it at speed there, each change on the next reload' },
      { path: 'desktop', does: 'keep building here; each look is a desktop export you download and start (npm install && npm start); the checks still run here every time' },
      { path: 'small', does: `keep each level under ${MB(limit)} (fewer tiles, a lighter dress) and play it here as a page` },
    ],
    card: 'gameworld-workshop',
  };
}

/**
 * A MAP'S CLIFFS — where a glyph map's land stands as a cliff, read from its heights and its ways so every cliff makes
 * sense: a cliff is where the land steps and NOBODY WALKS. Between two tiles side by side whose heights stand
 * MAP_CLIFF.drop metres or more apart, the land does not ease from one to the other across both tiles (a long ramp
 * nobody asked for): it holds each tile's height to their shared edge and steps there (era/out-tile.js riseAt, a scarp),
 * rock on its face as the kit draws any steep ground. Where a way crosses that edge, a path into a path or a path to a
 * place's door, there is no cliff: the way keeps its eased climb, a pass through the scarp, so a cliff never lies across a
 * trail and a trail is where a cliff is passed. Water's own edge is its body's (era/out-tile-water.js), never a scarp.
 *
 * A TERRACED LAND ROLLS LESS: the level's own hills (era/out-tile.js LEVEL_LAND, about 5 m either way) would lose a 3 m
 * terrace in their roll, so a map that asks for its cliffs lays its hills at MAP_CLIFF.hills, and a terrace reads as one.
 *
 *   cliffRise(G, rise) → the rise a map that asks its cliffs is read with: its scarps (where it has any) and its hills
 *   mapScarps(G, rise) → { e: [0 | 1 per tile: its edge to the east], s: [to the south], count } | null (no cliff)
 *   MAP_CLIFF          the least step a cliff stands, and a terraced land's hills (metres)
 * Pure: G readGrid's read, rise its tiles' heights ({ tile, cols, rows, z }).
 */
export const MAP_CLIFF = Object.freeze({ drop: 6, hills: 2 });

/** The rise of a map that asks for its cliffs: its scarps and its gentler hills (riding in the rise, so every reader of
 *  the level's land reads the same one). */
export function cliffRise(G, rise) {
  if (!rise) return rise;
  const S = mapScarps(G, rise);
  return { ...rise, hills: MAP_CLIFF.hills, ...(S ? { scarps: { e: S.e, s: S.s } } : {}) };
}

export function mapScarps(G, rise) {
  if (!rise) return null;
  const { cols, rows, z } = rise, e = new Array(cols * rows).fill(0), s = new Array(cols * rows).fill(0);
  // (a way across the edge: either tile open toward the other; a place opens on its door only, grid.js)
  const crossed = (a, b, side, back) => (a?.open ?? []).includes(side) || (b?.open ?? []).includes(back);
  let count = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = G.at(r, c), k = r * cols + c;
    if (c + 1 < cols) { const b = G.at(r, c + 1); if (Math.abs(z[k] - z[k + 1]) >= MAP_CLIFF.drop - 1e-9 && !a.water && !b.water && !crossed(a, b, 'e', 'w')) { e[k] = 1; count++; } }
    if (r + 1 < rows) { const b = G.at(r + 1, c); if (Math.abs(z[k] - z[k + cols]) >= MAP_CLIFF.drop - 1e-9 && !a.water && !b.water && !crossed(a, b, 's', 'n')) { s[k] = 1; count++; } }
  }
  return count ? { e, s, count } : null;
}

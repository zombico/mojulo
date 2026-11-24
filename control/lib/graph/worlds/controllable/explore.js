/**
 * THE EXPLORED MAP's record (an opt-in builder; gameworld/metroidvania/explored.js): where the target has been, a tile a
 * screen, and what map rooms have shown it. The map is drawn from this and the box's own rooms, so it is a record of the
 * walk, never a picture of the level ahead of it.
 *
 *   spec.explored: { target, tile: [W, H], tiles: ['c,r'], maps?: [{ room, name, rect: [s0, s1, z0, z1], reveals: ['c,r'] }] }
 *     a TILE      walked the moment the target stands in it (its feet a little over its floor in the tile's screen)
 *     a MAP ROOM  walked into, its region's tiles known: drawn as outlines, never as walked
 *   state.explored: { visited: { <c,r>: time }, known: { <c,r>: time }, at: [c, r] | null, maps: { <room>: time },
 *                     got: [{ id, name, t }], percent() }   what the page's map reads (its got list a toast)
 *
 * Import-free (the page runs this source, compose.js); emitted only into a page whose world has an explored map. Wraps
 * createWorld and stepWorld.
 */
export function buildExplore(E) {
  const make = E.createWorld, step = E.stepWorld;
  E.createWorld = function createWithExplore(spec) {
    const s = make(spec), X = spec && spec.explored;
    if (!X || typeof X !== 'object') return s;
    const tiles = {};
    for (const k of X.tiles || []) tiles[k] = true;
    s.explored = { spec: X, tiles, visited: {}, known: {}, at: null, maps: {}, got: [] };
    s.explored.percent = () => Math.round((100 * Object.keys(s.explored.visited).length) / Math.max(1, (X.tiles || []).length));
    return s;
  };
  E.stepWorld = function stepWithExplore(state, input, dt, hooks) {
    const out = step(state, input, dt, hooks), X = state.explored;
    if (!X) return out;
    const T = state.byId ? state.byId[X.spec.target] : null;
    if (!T || !T.transform) return out;
    const [W, H] = X.spec.tile, p = T.transform.pos, c = Math.floor(p[1] / W), r = Math.floor((p[2] + 0.5) / H), k = `${c},${r}`;
    if (X.tiles[k]) {
      X.at = [c, r];
      if (X.visited[k] == null) X.visited[k] = state.time || 0;
    }
    // (a map room walked into: its region's tiles known)
    for (const m of X.spec.maps || []) {
      if (X.maps[m.room] != null) continue;
      const [s0, s1, z0, z1] = m.rect;
      if (p[1] < s0 || p[1] > s1 || p[2] < z0 || p[2] > z1) continue;
      X.maps[m.room] = state.time || 0;
      for (const q of m.reveals) if (X.known[q] == null) X.known[q] = state.time || 0;
      X.got.push({ id: `map-${m.room}`, name: m.name, t: state.time || 0 });
    }
    return out;
  };
}

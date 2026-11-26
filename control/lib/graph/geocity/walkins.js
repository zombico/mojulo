/**
 * THE CITY'S WALK-INS (a geocity's `enter`): its civic buildings walked into on a page of their own, the museum's way
 * (museum.js) for every kind: a block across a street from where its walk starts built as the building, its front on its
 * street, its door a level's door into its inside (gameworld/levels.js geocityEnds, interiorStage), the hero back at its
 * steps on the way out. What is inside composes with the rest of the game: an arcade's floor keeps the world's
 * minigames (gameworld/minigames.js ROOMS_KEPT), a library's reading room one too. A new kind is a row.
 *
 *   enter: ['arcade' | 'library', …]          on the geocity's spec (metro.js reads it); none ⇒ the city as it was
 *   WALKINS         { <use>: { name, front, program, kit, least, compose?, hall, colours } }   (`least`: its block's narrower
 *                   side at least this, m)
 *     front         how its street front reads (scene.js `civicFront`): `marquee` (a lit sign band over a glass front, a
 *                   box with its name in colour), `portico` (steps, columns, a pediment), each at its hall's size
 *     program       its inside's program (era/programs.js), laid in `kit`, composed to `compose` (era/compose.js axes)
 *   pickWalkins(blocks, shown, uses, taken) → [{ use, block }]: each use the next block of the built fabric, wide enough,
 *                   nearest the evocation's middle after the walk's own and those taken (a museum's)
 *
 * Pure: the blocks in, the blocks out; the scene builds them.
 */
import { MUSEUM } from './museum.js';

export const WALKINS = Object.freeze({
  // an ARCADE: a box with a lit marquee band along its front, glass doors under it; inside a games floor of cabinets
  // under cyan light on carpet, a prize counter at its end
  arcade: Object.freeze({ name: 'Arcade', front: 'marquee', program: 'arcade', kit: 'bay-everyday', least: 24,
    compose: Object.freeze({ construction: 'everyday', palette: 'everyday', plot: 'science', dressing: 'everyday' }),
    hall: Object.freeze({ wide: 30, deep: 24, high: 9 }),
    colours: Object.freeze({ wall: '#2c2a36', band: '#ff3fa4', trim: '#36e0ff', glass: '#1c2a3a', door: '#101418' }) }),
  // a LIBRARY: a small portico on a stone hall; inside its reading room, the stacks behind and the archive, in the
  // gallery's plaster and oak
  library: Object.freeze({ name: 'Public Library', front: 'portico', program: 'library', kit: 'bay-gallery', least: 26,
    compose: Object.freeze({ construction: 'gallery', palette: 'gallery', plot: 'gallery', dressing: 'gallery' }),
    hall: Object.freeze({ wide: 30, deep: 22, high: 12 }),
    colours: Object.freeze({ stone: '#d6cfbd', column: '#ece6d8', roof: '#7c766c', door: '#2b2620', steps: '#d8d1c1', banners: Object.freeze(['#1f4e79']) }) }),
});
export const WALKIN_USES = Object.freeze(Object.keys(WALKINS));

const mid = (b) => [(b.rect[0] + b.rect[2]) / 2, (b.rect[1] + b.rect[3]) / 2];
const narrow = (b) => Math.min(b.rect[2] - b.rect[0], b.rect[3] - b.rect[1]);

/** The blocks the walk-ins stand on (see the header): `taken` the blocks already given (a museum's), never reused. */
export function pickWalkins(blocks, shown, uses, taken = []) {
  const ids = new Set(shown ?? []), evoked = blocks.filter((b) => ids.has(b.id) && Array.isArray(b.rect));
  if (evoked.length < 2 || !uses?.length) return [];
  const x0 = Math.min(...evoked.map((b) => b.rect[0])), y0 = Math.min(...evoked.map((b) => b.rect[1])), x1 = Math.max(...evoked.map((b) => b.rect[2])), y1 = Math.max(...evoked.map((b) => b.rect[3]));
  const c = [(x0 + x1) / 2, (y0 + y1) / 2], dist = (b) => Math.hypot(mid(b)[0] - c[0], mid(b)[1] - c[1]);
  const byNear = evoked.slice().sort((a, b) => dist(a) - dist(b) || (a.id < b.id ? -1 : 1));
  // (the nearest is where its walk starts; each walk-in the next host free of the others)
  const used = new Set([byNear[0].id, ...taken.map((b) => b.id)]), out = [];
  for (const use of uses) {
    // (a walk-in's front is smaller than the museum's: its own least width, `least`)
    const b = byNear.find((x) => !used.has(x.id) && MUSEUM.hosts.includes(x.kind) && narrow(x) >= (WALKINS[use]?.least ?? MUSEUM.least));
    if (!b) continue;
    used.add(b.id);
    out.push({ use, block: b });
  }
  return out;
}

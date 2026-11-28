/**
 * THE CITY'S WALK-INS (a geocity's `enter`): its civic buildings walked into on a page of their own, the museum's way
 * (museum.js) for every kind: a block across a street from where its walk starts built as the building, its front on its
 * street, its door a level's door into its inside (gameworld/levels.js geocityEnds, interiorStage), the hero back at its
 * steps on the way out. What is inside composes with the rest of the game: an arcade's floor keeps the world's
 * minigames (gameworld/minigames.js ROOMS_KEPT), a library's reading room one too. A new kind is a row.
 *
 *   enter: ['arcade' | 'library' | 'aquarium', …]   on the geocity's spec (and 'zoo') (metro.js reads it); none ⇒ the city as it was
 *   WALKINS         { <use>: { name, front, program, kit, least, compose?, hall, colours, tanks? } }   (`tanks`: an
 *                   aquarium's collections, era/aquarium.js)   (`least`: its block's narrower
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
  // an AQUARIUM: a deep blue marquee; inside the museum's T of galleries in cold light, a tank in each gallery and a big
  // one in each wing's hall, the sea's animals swimming in them (era/aquarium.js, marine/tank.js), a collection a wing
  aquarium: Object.freeze({ name: 'Aquarium', front: 'marquee', program: 'museum', kit: 'bay-gallery', least: 26,
    compose: Object.freeze({ construction: 'gallery', palette: 'science', plot: 'science', dressing: 'gallery' }),
    hall: Object.freeze({ wide: 32, deep: 26, high: 10 }),
    colours: Object.freeze({ wall: '#1b2a3d', band: '#2fb6e8', trim: '#f2f6f8', glass: '#16324a', door: '#0d1620' }),
    tanks: Object.freeze([
      Object.freeze({ title: 'The Reef', life: Object.freeze(['clownfish', 'angelfish', 'pufferfish', 'cuttlefish']) }),
      Object.freeze({ title: 'Life on the Bed', life: Object.freeze(['octopus', 'morayEel', 'pufferfish']) }),
      Object.freeze({ title: 'Open Water', life: Object.freeze(['seaTurtle', 'mantaRay', 'squid']) }),
    ]) }),
  // a ZOO: a gate on its street (railings, two posts and a lit sign over the way in, a ticket booth); inside, open to the
  // sky (the plaza kit under a noon sun), the museum's T of wings, each room a pen fenced in mesh round its animals and a
  // walk round it, each wing's hall its big enclosure (era/zoo.js, fauna/pen.js), a collection a wing
  zoo: Object.freeze({ name: 'City Zoo', front: 'gate', program: 'museum', kit: 'island-plaza', reference: 'island-noon', compose: false, least: 26, scale: 2,
    hall: Object.freeze({ wide: 34, deep: 26, high: 6 }),
    colours: Object.freeze({ rail: '#2f4a2a', post: '#5a4630', band: '#e6b23a', booth: '#c8b89a', door: '#1f2a1a' }),
    pens: Object.freeze([
      Object.freeze({ title: 'The Savanna', life: Object.freeze(['zebra', 'ostrich', 'giraffe', 'elephant']) }),
      Object.freeze({ title: 'Big Cats and Bears', life: Object.freeze(['lion', 'tiger', 'brown bear', 'polar bear']) }),
      Object.freeze({ title: 'Around the World', life: Object.freeze(['kangaroo', 'flamingo', 'penguin', 'meerkat', 'camel']) }),
    ]) }),
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

/**
 * THE CITY'S MUSEUM (a geocity's `museum`): a block beside the one its walk starts at built as a museum, the way a city
 * keeps a civic building on a block of its own: a forecourt paved from its front street, a flight of steps up to a
 * portico of columns under a pediment, a stone hall behind it, banners hung either side of its door. Its door is a
 * level's door (gameworld/levels.js geocityEnds): walked through, the museum's own building is entered on a page of its
 * own (era/programs.js `museum`, its galleries era/exhibits.js), and walked out of, the hero is on its steps again.
 *
 *   museum: true | { name?, exhibits?, scale? }   on the geocity's spec (metro.js reads it); `exhibits` and `scale` are
 *                                                 the inside's, the city draws the front alone
 *   pickMuseum(blocks, shown)  → the block it stands on, or null: of the evoked blocks (`shown`, their ids), the one of
 *                                the built fabric wide enough for its front nearest the evocation's middle after the one
 *                                its walk starts at (the nearest); a district evoked with none, no museum
 *   MUSEUM                       its measures (m) and colours
 *
 * Pure: the blocks in, the block out; the scene builds it (scene.js `museum`).
 */
export const MUSEUM = Object.freeze({
  // (the blocks it may take: the built fabric's, never a park, a church, a site)
  hosts: Object.freeze(['podium', 'midrise', 'main-street', 'lowrise', 'apartments', 'slab', 'tower', 'edge']),
  least: 36,                    // its block's narrower side at least this (m)
  court: 7,                     // the forecourt's depth before its steps
  steps: Object.freeze({ n: 3, rise: 0.15, run: 0.7 }),
  portico: Object.freeze({ deep: 4.5, columns: 6, column: 1.1, high: 8.5, entablature: 1.4, pediment: 3.2 }),
  hall: Object.freeze({ wide: 44, deep: 30, high: 16, cornice: 0.9, over: 0.5 }),
  door: Object.freeze({ wide: 3.4, high: 5.2 }),
  banner: Object.freeze({ wide: 2.4, high: 6.6, lift: 1.4 }),
  colours: Object.freeze({ stone: '#cfc5b0', column: '#ece6d8', roof: '#8c8578', door: '#2b2620', steps: '#d8d1c1', banners: Object.freeze(['#a3262a', '#1f4e79']) }),
});

const mid = (b) => [(b.rect[0] + b.rect[2]) / 2, (b.rect[1] + b.rect[3]) / 2];
const narrow = (b) => Math.min(b.rect[2] - b.rect[0], b.rect[3] - b.rect[1]);

/** The block the museum stands on (see the header). `blocks`: every block of the design; `shown`: the evoked ones' ids. */
export function pickMuseum(blocks, shown) {
  const ids = new Set(shown ?? []), evoked = blocks.filter((b) => ids.has(b.id) && Array.isArray(b.rect));
  if (evoked.length < 2) return null;
  const x0 = Math.min(...evoked.map((b) => b.rect[0])), y0 = Math.min(...evoked.map((b) => b.rect[1])), x1 = Math.max(...evoked.map((b) => b.rect[2])), y1 = Math.max(...evoked.map((b) => b.rect[3]));
  const c = [(x0 + x1) / 2, (y0 + y1) / 2], dist = (b) => Math.hypot(mid(b)[0] - c[0], mid(b)[1] - c[1]);
  const byNear = evoked.slice().sort((a, b) => dist(a) - dist(b) || (a.id < b.id ? -1 : 1));
  // (the nearest is where its walk starts; the museum stands across a street from it)
  return byNear.slice(1).find((b) => MUSEUM.hosts.includes(b.kind) && narrow(b) >= MUSEUM.least) ?? null;
}

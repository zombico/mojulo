/**
 * THE HEAVENS — what hangs in a world's sky, as a geocube's `light.heavens` says it: whether it has air (`void`: none, the
 * stars out by day, the sky the darkest thing; or `false`, an airless card given air), how wide its sun stands
 * (`disc`), and the body nearest in its sky (`companion`: the Earth over the Moon, Charon over Pluto, Phobos over Mars).
 * The children of Sol (sol/geocubes.js) are its first readers; any cube may say it. (A ringed giant's rings arch over its
 * flight, channels/flight-sky.js: a giant has no ground for a geocube.)
 *
 *   readHeavens(h, no)          → the heavens checked (`no` throws, teaching), or undefined
 *   heavensCard(card, h)        → the outside's look card (era/isekai.js) under them: its void, its sun, its companion;
 *                                 a card the cube says nothing of is returned as it was
 *
 * A heavens: { void?, disc?, companion? }
 *   void       false (the card's void dropped: a sky of air, the cube's own colours) | { stars?, glow? } (no air: the
 *              stars by day, 0..1, and the sun's glow)
 *   disc       false (no sun seen: a lid of cloud) | { size, glow? }: the sun's disc (1 Earth's; Mercury's 2.6, Pluto's a
 *              point) and its glow
 *   companion  { azimuth, elevation, size?, phase?, color?, spots? }: a body hanging in the sky (degrees; size the dome's
 *              moon's, 1 our Moon's drawn size; phase its lit share; color #rrggbb; spots, up to 3 #rrggbb blotted over
 *              its lit face, a world's land and clouds)
 *
 * Pure.
 */
const HEX = /^#[0-9a-fA-F]{6}$/;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const only = (o, keys, at, no) => { for (const k of Object.keys(o)) if (!keys.includes(k)) no(`${at}.${k} is not one of its words (${keys.join(', ')})`); };
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

export function readHeavens(h, no) {
  if (h === undefined) return undefined;
  const at = 'light.heavens';
  if (!isObj(h)) no(`${at} is { void?, disc?, companion? }: what hangs in the world's sky`);
  only(h, ['void', 'disc', 'companion'], at, no);
  if (h.void !== undefined && h.void !== false) {
    if (!isObj(h.void)) no(`${at}.void is false (a sky of air) or { stars?, glow? } (no air)`);
    only(h.void, ['stars', 'glow'], `${at}.void`, no);
    for (const k of ['stars', 'glow']) if (h.void[k] !== undefined && !(h.void[k] >= 0 && h.void[k] <= 1)) no(`${at}.void.${k} is 0 to 1`);
  }
  if (h.disc !== undefined && h.disc !== false) {
    if (!isObj(h.disc)) no(`${at}.disc is false (no sun seen) or { size, glow? }: the sun's disc`);
    only(h.disc, ['size', 'glow'], `${at}.disc`, no);
    if (!(h.disc.size > 0 && h.disc.size <= 4)) no(`${at}.disc.size is the sun's width against Earth's, above 0 and at most 4`);
    if (h.disc.glow !== undefined && !(h.disc.glow >= 0 && h.disc.glow <= 3)) no(`${at}.disc.glow is 0 to 3`);
  }
  if (h.companion !== undefined) {
    const C = h.companion, a = `${at}.companion`;
    if (!isObj(C)) no(`${a} is { azimuth, elevation, size?, phase?, color?, spots? }`);
    only(C, ['azimuth', 'elevation', 'size', 'phase', 'color', 'spots'], a, no);
    if (!Number.isFinite(C.azimuth) || !(C.elevation > 0 && C.elevation < 90)) no(`${a} stands at an azimuth and an elevation (degrees, 0 to 90)`);
    if (C.size !== undefined && !(C.size > 0 && C.size <= 12)) no(`${a}.size is above 0 and at most 12`);
    if (C.phase !== undefined && !(C.phase >= 0 && C.phase <= 1)) no(`${a}.phase is its lit share, 0 to 1`);
    if (C.color !== undefined && !HEX.test(C.color)) no(`${a}.color is a #rrggbb colour`);
    if (C.spots !== undefined && !(Array.isArray(C.spots) && C.spots.length <= 3 && C.spots.every((s) => HEX.test(s)))) no(`${a}.spots are up to 3 #rrggbb colours`);
  }
  return h;
}

export function heavensCard(card, h) {
  if (!h) return card;
  const out = { ...card };
  const C = h.companion ? { azimuth: h.companion.azimuth, elevation: h.companion.elevation, size: h.companion.size ?? 4, phase: h.companion.phase ?? 0.6,
    ...(h.companion.color ? { color: rgb(h.companion.color) } : {}), ...(h.companion.spots ? { spots: h.companion.spots.map(rgb) } : {}) } : null;
  if (h.void === false) delete out.void;
  else if (h.void) out.void = { ...(card.void ?? {}), stars: h.void.stars ?? card.void?.stars ?? 1, glow: h.void.glow ?? card.void?.glow ?? 0.45 };
  // (the companion hangs in the void if there is one, else in the day sky)
  if (C) { if (out.void) out.void = { ...out.void, companion: C }; else out.companion = C; }
  if (h.disc === false) out.sun = null;   // (no sun seen: the sky draws none, era/isekai.js)
  else if (h.disc) out.sun = { size: h.disc.size, glow: h.disc.glow ?? card.sun?.glow ?? 1 };
  return out;
}

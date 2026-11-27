/**
 * cover-kernel — what the land is used for, read off the land itself, as one self-contained function (as
 * terrain-kernel.js is: no imports, no module state). The server calls it (the country's report, its tests); the World
 * page inlines its source (`coverKernel.toString()`) and bakes it to a texture over the map's grid, which the ground's
 * shader reads (scene/channels/aerial.js). Both read the same land the same way.
 *
 * The rules are a pilot's reading of farmed country, not a survey:
 *
 *   beach    the land within a few metres of the sea: sand
 *   forest   the slopes too steep to plough, the high ground, and woodlots scattered by a slow noise, thinned round the
 *            settlements (cleared for their fields long ago) and off their land
 *   scrub    the highest, most exposed ground (heath, moor), and rough ground near the coast
 *   arable   of what is left, the flat low ground near the settlements: ploughed and cropped parcels; the rest pasture
 *
 * C: { seed, lo, hi (the land's relief, m), sea (m | null), towns: [[x0, y0, x1, y1]…] (settlements' land) }.
 * ground: { groundAt(x, y) → m } (the ground as built: terrain-kernel's `heightAt`, its settlements and pads graded, so
 * a town's raised edge is not read as a beach).
 *
 *   coverKernel(C, ground) → { at(x, y) → [forest, arable, scrub, beach] each 0…1 (pasture what is left) }
 *
 * Only + − × ÷, Math.floor, Math.sqrt, Math.imul, Math.min, Math.max: the same answers in every engine.
 */
export function coverKernel(C, ground) {
  const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  function hash(i, j, s) { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(s, 1274126177); h = Math.imul(h ^ (h >>> 13), 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  // value noise, smoothed, 0…1
  function vn(x, y, s) {
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = hash(i, j, s), b = hash(i + 1, j, s), c = hash(i, j + 1, s), d = hash(i + 1, j + 1, s);
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  }
  const fbm = (x, y, s) => (vn(x, y, s) * 0.55 + vn(2.03 * x, 2.03 * y, s + 1) * 0.3 + vn(4.1 * x, 4.1 * y, s + 2) * 0.15);
  const seed = C.seed | 0, span = C.hi - C.lo || 1, sea = C.sea, towns = C.towns || [];
  const E = 30;
  function townNear(x, y) {
    let d = 1e9;
    for (let k = 0; k < towns.length; k++) { const q = towns[k], dx = Math.max(q[0] - x, 0, x - q[2]), dy = Math.max(q[1] - y, 0, y - q[3]), r = Math.sqrt(dx * dx + dy * dy); if (r < d) d = r; }
    return d;
  }
  function at(x, y) {
    const z = ground.groundAt(x, y);
    if (sea !== null && z < sea + 0.3) return [0, 0, 0, 0];
    const gx = (ground.groundAt(x + E, y) - ground.groundAt(x - E, y)) / (2 * E), gy = (ground.groundAt(x, y + E) - ground.groundAt(x, y - E)) / (2 * E);
    const g = Math.sqrt(gx * gx + gy * gy), hh = clamp01((z - C.lo) / span);
    const beach = sea === null ? 0 : 1 - smooth(sea + 2, sea + 5, z);
    const near = townNear(x, y), cleared = smooth(150, 700, near);
    const lots = fbm(x / 700, y / 700, seed + 11), region = fbm(x / 2600, y / 2600, seed + 23);
    let forest = Math.max(smooth(0.11, 0.2, g), smooth(0.6, 0.78, hh), smooth(0.56 - 0.12 * region, 0.66 - 0.12 * region, lots));
    forest *= 0.25 + 0.75 * cleared; if (near <= 0) forest = 0;
    forest *= 1 - beach;
    const scrub = Math.max(smooth(0.8, 0.94, hh), sea === null ? 0 : (1 - smooth(sea + 5, sea + 14, z)) * smooth(0.4, 0.7, lots) * 0.8) * (1 - forest) * (1 - beach);
    // the flat low ground near the settlements is cropped; farther and steeper it is grazed
    const flat = 1 - smooth(0.04, 0.1, g), lowland = 1 - smooth(0.45, 0.7, hh), reach = 1 - smooth(1500, 5000, near);
    const arable = clamp01(flat * lowland * (0.25 + 0.55 * reach) * (0.5 + 0.8 * region)) * (1 - forest) * (1 - scrub) * (1 - beach);
    return [forest, arable, scrub, beach];
  }
  return { at };
}

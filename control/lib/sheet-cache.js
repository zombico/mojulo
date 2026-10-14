// The drawn pages, kept in memory a while: a world bible is ~16 MB of SVG and two seconds to draw, a flora sheet up to
// eight. Every page is a pure function of what keys it (a recipe's ref and revision, or a repertoire sheet's id, kit
// and seed), so a hit is the page a fresh draw would make. Least recently used goes first; nothing touches disk.

const MAX = 8;
const pages = new Map();

/** The page for `key`, drawn by `draw()` when it is not kept (a draw in flight is shared, not repeated). */
export async function cachedPage(key, draw) {
  if (pages.has(key)) {
    const hit = pages.get(key);
    pages.delete(key);
    pages.set(key, hit);
    return hit;
  }
  const pending = Promise.resolve().then(draw);
  pages.set(key, pending);
  try {
    const html = await pending;
    while (pages.size > MAX) pages.delete(pages.keys().next().value);
    return html;
  } catch (err) {
    pages.delete(key);
    throw err;
  }
}

/** For tests: forget every page. */
export const clearPageCache = () => pages.clear();

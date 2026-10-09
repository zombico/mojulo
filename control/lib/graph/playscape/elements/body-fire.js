/**
 * body-fire — a look's `fire` layer (playscape/elements) as the world's own fire. Every status a play block's cues or
 * menu choices may put on a character with a look that burns is one fire source, lit at build
 * (the fire channel's sources are fixed, so a replay is the same) and carried by that body on the page: it burns
 * only while the body carries that status in that colour, where its feet are, and stands on no prop.
 *
 *   bodyFires(play, entities) → [{ kind, at: [0, 0, 0], size, color?, follow, el, key, rise }]   for resolveFire's sources
 *   fireKey(color)            the colour a status burns in, as the page matches it ('' for the element's own)
 */
import { readCues } from '../ui/cues.js';
import { readMenus } from '../ui/menus.js';

export const fireKey = (color) => (color == null ? '' : typeof color === 'string' ? color : JSON.stringify(color));
const hex = (c) => '#' + c.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');

/** Every status whose look carries fire, as one fire source a body may carry. */
export function bodyFires(play, entities = []) {
  if (!play || typeof play !== 'object' || (!play.cues && !play.menus)) return [];
  const ids = new Set((entities || []).map((e) => e && e.id)), seen = new Set(), out = [];
  const effects = [...readCues(play).flatMap((c) => c.then), ...readMenus(play).flatMap((m) => m.picks.flatMap((p) => p.then))];
  for (const t of effects) {
    if (t.kind !== 'cast' || t.op !== 'status' || !t.look || !t.look.fire || !ids.has(t.who)) continue;
    const key = fireKey(t.color), id = `${t.who}|${t.is}|${key}`;
    if (seen.has(id)) continue;
    seen.add(id);
    // one fire, by size: a small one licks up from near the top of the body, a big one engulfs it from the feet
    const F = t.look.fire, size = F.size, c = t.color ?? F.color ?? null;
    out.push({ kind: size >= 2.5 ? 'campfire' : 'brazier', at: [0, 0, 0], size, ...(c != null ? { color: Array.isArray(c) ? hex(c) : c } : {}), follow: t.who, el: t.is, key, rise: size >= 2.5 ? 0 : 0.85 });
  }
  return out;
}

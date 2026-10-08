/**
 * body-fire — the burning elements (playscape/elements: `burning`, `blaze`) as the world's own fires. Every status a
 * play block's cues or menu choices may put on a character with a burning element is one fire source, lit at build
 * (the fire channel's sources are fixed, so a replay is the same) and carried by that body on the page: it burns
 * only while the body carries that status in that colour, where its feet are, and stands on no prop.
 *
 *   bodyFires(play, entities) → [{ kind, at: [0, 0, 0], size, color?, follow, el, key, rise }]   for resolveFire's sources
 *   fireKey(color)            the colour a status burns in, as the page matches it ('' for the element's own)
 */
import { readCues } from '../ui/cues.js';
import { readMenus } from '../ui/menus.js';
import { ELEMENTS } from './elements.js';

export const fireKey = (color) => (color == null ? '' : typeof color === 'string' ? color : JSON.stringify(color));

export function bodyFires(play, entities = []) {
  if (!play || typeof play !== 'object' || (!play.cues && !play.menus)) return [];
  const ids = new Set((entities || []).map((e) => e && e.id)), seen = new Set(), out = [];
  const effects = [...readCues(play).flatMap((c) => c.then), ...readMenus(play).flatMap((m) => m.picks.flatMap((p) => p.then))];
  for (const t of effects) {
    if (t.kind !== 'cast' || t.op !== 'status' || !ELEMENTS[t.is] || !ELEMENTS[t.is].fire || !ids.has(t.who)) continue;
    const key = fireKey(t.color), id = `${t.who}|${t.is}|${key}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const F = ELEMENTS[t.is].fire;
    out.push({ kind: F.kind, at: [0, 0, 0], size: F.size, ...(t.color != null ? { color: t.color } : {}), follow: t.who, el: t.is, key, rise: F.rise });
  }
  return out;
}

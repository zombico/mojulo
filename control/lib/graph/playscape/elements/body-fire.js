/**
 * body-fire — a look's `fire` layer (playscape/elements) as the world's own fire. Every status a play block's cues or
 * menu choices may put on a character with a look that burns is one fire source, lit at build
 * (the fire channel's sources are fixed, so a replay is the same) and carried by that body on the page: it burns
 * only while the body carries that status in that colour, where its feet are, and stands on no prop.
 *
 *   bodyFires(play, entities) → [{ kind, at: [0, 0, 0], size, color?, follow, el, key, rise, char? }]   for resolveFire's sources
 *                             (a play block's cues and menus, and the statuses an entity is born under: `e.statuses`)
 *   fireKey(color)            the colour a status burns in, as the page matches it ('' for the element's own)
 */
import { readCues } from '../ui/cues.js';
import { readMenus } from '../ui/menus.js';
import { LOOKS } from './elements.js';

export const fireKey = (color) => (color == null ? '' : typeof color === 'string' ? color : JSON.stringify(color));
const hex = (c) => '#' + c.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');

/** Every status whose look carries fire, as one fire source a body may carry. */
export function bodyFires(play, entities = []) {
  const ids = new Set((entities || []).map((e) => e && e.id)), seen = new Set(), out = [];
  const cued = play && typeof play === 'object' && (play.cues || play.menus);
  // (and a status a body is BORN under, `e.statuses` on the entity: a foe's base state, foes/states.js)
  const born = (entities || []).flatMap((e) => (e && e.statuses ? Object.entries(e.statuses).map(([is, st]) => ({ kind: 'cast', op: 'status', who: e.id, is, look: LOOKS[is], ...(st && st.color != null ? { color: st.color } : {}), ...(st && Number.isFinite(st.char) ? { char: st.char } : {}) })) : []));
  if (!cued && !born.length) return [];
  const effects = [...(cued ? [...readCues(play).flatMap((c) => c.then), ...readMenus(play).flatMap((m) => m.picks.flatMap((p) => p.then))] : []), ...born];
  for (const t of effects) {
    if (t.kind !== 'cast' || t.op !== 'status' || !t.look || !t.look.fire || !ids.has(t.who)) continue;
    const key = fireKey(t.color), id = `${t.who}|${t.is}|${key}`;
    if (seen.has(id)) continue;
    seen.add(id);
    // one fire, by size: a small one licks up from near the top of the body, a big one engulfs it from the feet
    const F = t.look.fire, size = F.size, c = t.color ?? F.color ?? null;
    // (a body that chars as it burns, `char`: the share of its own colour it keeps while lit)
    out.push({ kind: size >= 2.5 ? 'campfire' : 'brazier', at: [0, 0, 0], size, ...(c != null ? { color: Array.isArray(c) ? hex(c) : c } : {}), follow: t.who, el: t.is, key, rise: size >= 2.5 ? 0 : 0.85, ...(Number.isFinite(t.char) && t.char < 1 ? { char: t.char } : {}) });
  }
  return out;
}

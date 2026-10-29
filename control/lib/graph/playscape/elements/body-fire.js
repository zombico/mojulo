/**
 * body-fire — a look's `fire` layer (playscape/elements) as the world's own fire. Every status a play block's cues or
 * menu choices may put on a character with a look that burns is one fire source, lit at build
 * (the fire channel's sources are fixed, so a replay is the same) and carried by that body on the page: it burns
 * only while the body carries that status in that colour, where its feet are, and stands on no prop.
 *
 *   bodyFires(play, entities) → [{ kind, at: [0, 0, 0], size, color?, follow, el, key, rise, char?, lift? }]   for resolveFire's sources
 *                             (a born status's `fires`, a column: one source each, `lift` metres over the body's feet)
 *                             (a play block's cues and menus, and the statuses a body is born under: `body.born`)
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
  // (and a status a body is BORN under, `body.born.statuses`: a foe's base state, foes/states.js)
  const bornOf = (e) => (e && e.body && e.body.born && e.body.born.statuses) || null;
  const born = (entities || []).flatMap((e) => (bornOf(e) ? Object.entries(bornOf(e)).map(([is, st]) => ({ kind: 'cast', op: 'status', who: e.id, is, look: LOOKS[is], ...(st && st.color != null ? { color: st.color } : {}), ...(st && Number.isFinite(st.char) ? { char: st.char } : {}), ...(st && Array.isArray(st.fires) && st.fires.length ? { fires: st.fires } : {}) })) : []));
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
    // (a born status may name its own fires, a column up the body: a foe's flaming, each its kind, its size and its
    // lift, metres over the body's feet; else the look's one fire)
    const col = c != null ? { color: Array.isArray(c) ? hex(c) : c } : {}, chars = Number.isFinite(t.char) && t.char < 1 ? { char: t.char } : {};
    if (Array.isArray(t.fires)) { for (const f of t.fires) out.push({ kind: f.kind, at: [0, 0, 0], size: f.size, ...col, follow: t.who, el: t.is, key, rise: 0, ...chars, lift: f.lift }); continue; }
    const kind = size >= 2.5 ? 'campfire' : 'brazier';
    out.push({ kind, at: [0, 0, 0], size, ...col, follow: t.who, el: t.is, key, rise: kind === 'campfire' ? 0 : 0.85, ...chars });
  }
  return out;
}

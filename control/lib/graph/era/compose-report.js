/**
 * THE COMPOSER'S REPORT (the scene composer, era/compose.js): what the light plot (compose-plot.js) reached, measured on
 * the bake itself where the seventh generation's bake ran (each face's `cornerLight`, linear: the ambient and every
 * steady lamp where it sees the corner, its bounce), else read from the plot's model and said so. Laws that advise and
 * stamp, never refuse:
 *
 *   focus    each room with a key: the light on the surfaces round its focus (corners within its reach in plan, compose-plot.js
 *            focusReach: a share of the room's diagonal) over the
 *            room's mean, at least SEEN (a focus that reads brighter at all), beside the plot's target
 *   way-on   the walk's way on lit over its dead ends: the arrivals' and passages' foci over the pockets' and rests' means
 *   lit      no room dark: every room's mean light over DARK of the rooms' mean (a key past the tuner's cap burns
 *            nothing out to skew it)
 *   palette  the colour theorist reached the paint's targets (its solve's unreached, none)
 *
 *   composeReport(plan, faces, { unreached?, plot, roomOf? }) → { measured: 'bake' | 'model', rooms, unreached, laws }
 *   mergeReports(reports) → one report over a storeyed building's, its laws read across every storey's rooms
 *     unreached  the solve's ({ role: want }); plot  compose-plot.js's; tuned  the bake's tuner's record (keyTuner);
 *                roomOf  a point's room id (by default the room round it, its height too)
 *     a room the tuner could not bring to its ratio is `short` (the key would burn its focus out first)
 *     faces    the baked faces (cornerLight on each), or null where no bake of light ran (the model's figures then)
 *
 * A beat's light (compose-plot.js BEATS) is in no corner: the page lays it. The report measures the room without it and
 * names the beat.
 */
import { focusReach, roomOfPoint } from './compose-plot.js';

const SEEN = 1.2, DARK = 0.2;
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const r3 = (v) => Math.round(v * 1000) / 1000;
const mid = (f) => [0, 1, 2].map((k) => f.corners.reduce((s, p) => s + p[k], 0) / f.corners.length);

/** What the plot reached, measured on the bake where it ran, and the laws on it. */
export function composeReport(plan, faces, { roomOf, unreached = {}, plot = [], tuned = null } = {}) {
  roomOf = roomOf ?? ((p) => roomOfPoint(plan, p));
  const C = plan.compose, roles = new Map(C.roles.map((r) => [r.room, r])), byPlot = new Map(plot.map((p) => [p.room, p]));
  let rooms;
  if (faces) {
    // each lit corner, its light and the room its face looks into
    const corners = new Map(plan.rooms.map((r) => [r.id, []]));
    for (const f of faces) {
      if (!f.cornerLight) continue;
      const at = mid(f), room = roomOf([at[0] + f.normal[0] * 0.15, at[1] + f.normal[1] * 0.15, at[2] + f.normal[2] * 0.15]);
      if (!room || !corners.has(room)) continue;
      const ls = f.cornerLight.length === f.corners.length ? f.cornerLight : f.corners.map(() => f.cornerLight[0]);
      f.corners.forEach((p, i) => corners.get(room).push([p, lum(ls[i])]));
    }
    rooms = plan.rooms.map((r) => {
      const R = roles.get(r.id), cs = corners.get(r.id), mean = cs.length ? cs.reduce((s, c) => s + c[1], 0) / cs.length : 0;
      const reach = focusReach(r), near = cs.filter(([p]) => Math.hypot(p[0] - R.focus[0], p[1] - R.focus[1]) <= reach);
      const focus = near.length ? near.reduce((s, c) => s + c[1], 0) / near.length : null;
      const P = byPlot.get(r.id), T = tuned?.[r.id];
      // (a beat's room is read at its peak, its key's light the bake's shares at full: the bake itself holds none of it)
      const ratio = T?.peak ? T.ratio : focus !== null && mean > 0 ? r3(focus / mean) : null;
      return { room: r.id, role: R.role, mean: r3(mean), focus: focus === null ? null : r3(focus), ratio, target: P?.target ?? null, ...(P?.beat ? { beat: P.beat, at: 'peak' } : {}), ...(T?.short ? { short: true } : {}) };
    });
  } else {
    rooms = plot.map((p) => ({ room: p.room, role: p.role, mean: null, focus: null, ratio: p.ratio, target: p.target, ...(p.beat ? { beat: p.beat } : {}) }));
  }
  const miss = Object.keys(unreached || {});
  return { measured: faces ? 'bake' : 'model', rooms, unreached: miss, laws: lawsOf(rooms, faces ? 'bake' : 'model', miss) };
}


// the laws on the rooms' figures (a storeyed building's from every storey's: mergeReports)
function lawsOf(rooms, measured, miss) {
  const keyed = rooms.filter((r) => r.target !== null), laws = [];
  const dim = keyed.filter((r) => !(r.ratio >= SEEN));
  laws.push({ id: 'focus', ok: !dim.length, says: dim.length ? `${dim.map((r) => `the ${r.room}'s focus ${r.ratio ?? 'unmeasured'} of its room (asked ${r.target})`).join('; ')}: under ${SEEN}, it does not read brighter` : `every keyed room's focus reads brighter than its room (${keyed.map((r) => `${r.room} ${r.ratio}/${r.target}`).join(', ')})` });
  if (measured === 'bake') {
    const on = rooms.filter((r) => ['arrival', 'passage'].includes(r.role) && r.focus !== null), ends = rooms.filter((r) => ['pocket', 'rest'].includes(r.role));
    const onL = on.length ? on.reduce((s, r) => s + r.focus, 0) / on.length : null, endL = ends.length ? ends.reduce((s, r) => s + r.mean, 0) / ends.length : null;
    laws.push({ id: 'way-on', ok: onL === null || endL === null || onL > endL, says: onL === null || endL === null ? 'no way on and dead end to compare' : `the way on ${r3(onL)}, the dead ends ${r3(endL)}${onL > endL ? '' : ': the dead ends are as lit as the way on'}` });
    const avg = rooms.reduce((t, r) => t + r.mean, 0) / rooms.length, dark = rooms.filter((r) => r.mean < DARK * avg);
    laws.push({ id: 'lit', ok: !dark.length, says: dark.length ? `${dark.map((r) => r.room).join(', ')}: under ${DARK} of the rooms' mean light` : 'no room left dark' });
      laws.push({ id: 'palette', ok: !miss.length, says: miss.length ? `the solve left ${miss.length} target(s) unreached: ${miss.slice(0, 4).join(', ')}` : 'the palette\'s targets reached' });
  }
  return laws;
}

/** A storeyed building's report: each storey's rooms, the laws read again across them all. */
export function mergeReports(reports) {
  const rooms = reports.flatMap((r) => r.rooms), measured = reports.every((r) => r.measured === 'bake') ? 'bake' : 'model', miss = [...new Set(reports.flatMap((r) => r.unreached || []))];
  return { measured, rooms, unreached: miss, laws: lawsOf(rooms, measured, miss) };
}

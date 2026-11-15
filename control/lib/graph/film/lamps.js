/**
 * lamps — THE SET'S LAMPS BY THE HOUR: a street's lamps are lit when the scene is shot at night, at dusk or at dawn, and
 * dark by day, whatever hour the set was made at. Most worlds stand their lamps as form only (a post and its head, no
 * light declared), so the film finds them: what a world's faces or its instanced things call a lamp (the last word of
 * a `group`: `geotown:lamp`, `geocity:lamp`), each one's head read from its own form, and lights the nearest to the
 * cast (actor/scene-film.js actors.py `posts`). A world that does declare its lamps (payload.lights) has them put out
 * by day (motion/blender-film.js film_light.py, atmosphere.json `lamps_lit`).
 *
 *   LAMP_WORDS                the words a lamp's group ends in
 *   lampsLit(preset)          → whether the film's light at that preset has the lamps on
 *   lampHeads(payload, { floor?, about, reach?, most? }) → [{ at: [x, y, z], h }] the lamps' heads near the cast, in
 *     the scene's frame (metres, the set's floor at z 0), the nearest first
 *   lampPosts(payload, opts)  → [{ at, watts, color, radius }] each as the light the film stands under its head
 *
 * Pure and deterministic.
 */
export const LAMP_WORDS = Object.freeze(['lamp', 'lamps', 'lamppost', 'streetlight', 'streetlamp', 'lantern']);
/** how far about the cast lamps are lit, metres; how many at most; a lit lamp (a sodium street lamp: W of a Blender point
 *  light, its colour, its size); how far under its head's top the light sits; how near two lamp faces are one lamp */
export const LAMP_REACH = 45, LAMP_MOST = 16;
export const POST = Object.freeze({ watts: 900, color: [1, 0.78, 0.52], radius: 0.12, drop: 0.5, join: 1.2 });
const r3 = (v) => Math.round(v * 1000) / 1000;
const isLamp = (group) => typeof group === 'string' && LAMP_WORDS.includes(group.toLowerCase().split(/[^a-z]+/).filter(Boolean).at(-1));

export const lampsLit = (preset) => preset === 'night' || preset === 'dusk' || preset === 'dawn';

// a lamp's head from its own form: its top, and the middle of what is within a head's depth of it (an arm's end, a lantern)
function headOf(corners) {
  let top = -Infinity, foot = Infinity;
  for (const c of corners) { top = Math.max(top, c[2]); foot = Math.min(foot, c[2]); }
  const depth = Math.max(0.3, (top - foot) * 0.08), hi = corners.filter((c) => c[2] >= top - depth);
  return { x: hi.reduce((n, c) => n + c[0], 0) / hi.length, y: hi.reduce((n, c) => n + c[1], 0) / hi.length, top, h: top - foot };
}

export function lampHeads(payload, { floor = 0, about, reach = LAMP_REACH, most = LAMP_MOST } = {}) {
  if (!Array.isArray(about)) return [];
  const k = Number.isFinite(payload?.metersPerUnit) && payload.metersPerUnit > 0 ? payload.metersPerUnit : 1, out = [];
  const near = (x, y) => Math.hypot(x * k - about[0], y * k - about[1]);
  // (a lamp laid by instancing: its template's head through each instance's place, scale and turn)
  for (const R of Array.isArray(payload?.repeats) ? payload.repeats : []) {
    if (!isLamp(R?.group) || !Array.isArray(R.template) || !Array.isArray(R.transforms)) continue;
    const H = headOf(R.template.flatMap((f) => (Array.isArray(f?.corners) ? f.corners : [])));
    if (!Number.isFinite(H.top)) continue;
    for (const T of R.transforms) {
      if (!Array.isArray(T?.pos)) continue;
      const s = Number.isFinite(T.scale) ? T.scale : 1, a = Number.isFinite(T.yaw) ? T.yaw : Number.isFinite(T.rot) ? T.rot : 0, c = Math.cos(a), sn = Math.sin(a);
      const x = T.pos[0] + (H.x * c - H.y * sn) * s, y = T.pos[1] + (H.x * sn + H.y * c) * s, d = near(x, y);
      if (d <= reach) out.push({ d, at: [x * k, y * k, (T.pos[2] + H.top * s) * k - floor], h: H.h * s * k });
    }
  }
  // (lamps among a world's own faces: the faces of one lamp are those that stand together)
  const groups = [];
  for (const f of Array.isArray(payload?.faces) ? payload.faces : []) {
    if (!isLamp(f?.group) || !Array.isArray(f.corners) || !f.corners.length) continue;
    const x = f.corners.reduce((n, c) => n + c[0], 0) / f.corners.length, y = f.corners.reduce((n, c) => n + c[1], 0) / f.corners.length;
    if (near(x, y) > reach + 5) continue;
    const G = groups.find((g) => Math.hypot(g.x - x, g.y - y) * k <= POST.join);
    if (G) { G.corners.push(...f.corners); G.n += 1; G.x += (x - G.x) / G.n; G.y += (y - G.y) / G.n; } else groups.push({ x, y, n: 1, corners: [...f.corners] });
  }
  for (const G of groups) { const H = headOf(G.corners), d = near(H.x, H.y); if (d <= reach) out.push({ d, at: [H.x * k, H.y * k, H.top * k - floor], h: H.h * k }); }
  return out.sort((a, b) => a.d - b.d || a.at[0] - b.at[0] || a.at[1] - b.at[1]).slice(0, most).map((L) => ({ at: L.at.map(r3), h: r3(L.h) }));
}

/** Each lamp near the cast as the light the film stands under its head. */
export function lampPosts(payload, opts = {}) {
  return lampHeads(payload, opts).map((L) => ({ at: [L.at[0], L.at[1], r3(L.at[2] - Math.min(POST.drop, L.h * 0.25))], watts: POST.watts, color: [...POST.color], radius: POST.radius }));
}

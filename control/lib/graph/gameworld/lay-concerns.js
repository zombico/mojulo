/**
 * THE CONCERNS LAID — what the world does for its cube's concerns (concerns.js), at two layers, so the land is made
 * for the game before any goal reads it:
 *
 *   GROUND   (world.js resolveLevel) the land shaped before a stage is laid. The level's own ground wins: an intent's
 *            dials go under the level's `tune`, and its edits after the creator's, each named `intent-<concern>`.
 *     fields     a field flattened beside the start, on the open side of the walk (the first trail's rows 2 to 3)
 *     drivable   the heartbeat eased: a lower climb and fall, the bumps all but gone
 *   STAGE    (levels.js stageLevelOrder) what stands on the laid stage, on its anchors (`ends`)
 *     fields     the field's centre, where the plots go (ends.field)
 *     circuit    checkpoints spaced (ends.spacing): a beat nearer the last kept than SPACING metres is no checkpoint
 *     cover      cover at the fighting posts: the goal's own posts, else the trail's beats (coverBlocks)
 *
 *   LAID                                 { <concern id>: ['ground' | 'stage'] } what is laid where
 *   groundLays(ids, level, frame)        → { tune?, edits, laid: [concern id] } for a level (layLevel's recipe)
 *   fieldSite(frame)                     → { at: '<cells>', centre: [x, y] } the field, in the level's frame
 *   beatPosts(ends, n?)                  → [{ id, at, heading, from, back }] posts on the beats (n: spread to n)
 *   coverBlocks(posts, ends)             → playscape terrain asks: a wall by each post, a crate stack, a wall between
 *   concernLaws(ids, { ends, blocks, posts, mechanics }) → [{ concern, law, holds, says }] the laws over a laid stage
 */
const r3 = (v) => Math.round(v * 1000) / 1000;

export const LAID = Object.freeze({ fields: ['ground', 'stage'], drivable: ['ground'], circuit: ['stage'], cover: ['stage'] });
export const SPACING = 12;           // metres a checkpoint keeps from the last
export const DRIVABLE = Object.freeze({ amplitude: 3, depth: 2, bump: { height: 0.2 } });

/** The field beside the start: two cells by two, on the walk's open side (toward the site's open edge), rows 2 to 3. */
export function fieldSite(F) {
  const root = F.spans.find((s) => s.section === 'trail');
  if (!root) return null;
  const y0 = F.cell, y1 = F.cell * 3 - 0.01, wx = root.trailX(F.cell * 2);
  const a = F.cellOf(wx + 4, y0), b = F.cellOf(wx + 4 + F.cell * 2 - 0.01, y1);
  return { at: `${a}:${b}`, centre: [r3(wx + 4 + F.cell), r3(F.cell * 2)] };
}

export function groundLays(ids, level, F) {
  const out = { edits: [], laid: [] };
  if (!F) return out;
  if (ids.includes('fields')) {
    const site = fieldSite(F);
    if (site) { out.edits.push({ op: 'flatten', at: site.at, id: 'intent-fields' }); out.laid.push('fields'); }
  }
  if (ids.includes('drivable')) { out.tune = { ...DRIVABLE }; out.laid.push('drivable'); }
  return out;
}

/** Posts on a stage's beats (the way's own places), spread to `n` when given, each facing back toward the one before
 * it (the start for the first), with its approach (`from`, the unit step from that one to it) and that one (`back`). */
export function beatPosts(ends, n) {
  const along = (ends.beats ?? []).filter((b) => b.beat !== 'exit' && b.beat !== 'trailhead');
  const k = Math.min(n ?? along.length, along.length);
  const picks = Array.from({ length: k }, (_, i) => along[Math.min(along.length - 1, Math.floor(((i + 0.5) * along.length) / k))]);
  return picks.map((b, i) => {
    const back = i ? picks[i - 1].at : ends.spawn, d = Math.hypot(b.at[0] - back[0], b.at[1] - back[1]) || 1;
    return { id: `post-${i + 1}`, at: b.at, heading: r3(Math.atan2(back[1] - b.at[1], back[0] - b.at[0])), from: [(b.at[0] - back[0]) / d, (b.at[1] - back[1]) / d], back };
  });
}

/** Cover at each post: a wall across the approach (taller than a person: cover is round its ends, not over it) 1.2 m
 * in front of the post and starting half a metre to one side, so the post sees down the way it holds and its cover is
 * a sidestep away; a crate stack on the other side; and a wall half way back for whoever comes on. Walls run square to
 * the world (colliders are boxes), across the approach's main axis; each stands on the land (`ends.ground`). */
export function coverBlocks(posts, ends) {
  const blocks = [];
  const at = (x, y, z0) => { const z = ends.ground ? ends.ground(x, y) : null; return [r3(x), r3(y), z ?? z0]; };
  const axes = (from) => { const N = Math.abs(from[0]) >= Math.abs(from[1]) ? [Math.sign(from[0]) || 1, 0] : [0, Math.sign(from[1]) || 1]; return [N, [-N[1], N[0]]]; };
  const wall = (c, N, z0, length) => blocks.push({ form: 'wall', at: at(c[0], c[1], z0), N, length, height: 2, thick: 0.5, value: 0.5 });
  posts.forEach((p, k) => {
    const [N, U] = axes(p.from), side = k % 2 ? -1 : 1, L = 3, off = (L / 2 + 0.5) * side;
    wall([p.at[0] - N[0] * 1.2 + U[0] * off, p.at[1] - N[1] * 1.2 + U[1] * off], N, p.at[2], L);
    blocks.push({ form: 'crate', at: at(p.at[0] - N[0] * 1.2 - U[0] * 2 * side, p.at[1] - N[1] * 1.2 - U[1] * 2 * side, p.at[2]), stack: 2, value: 0.42 });
    const mid = [(p.at[0] + p.back[0]) / 2, (p.at[1] + p.back[1]) / 2];
    wall([mid[0] - U[0] * 2.5 * side, mid[1] - U[1] * 2.5 * side], N, p.at[2], 2.5);
  });
  return blocks;
}

/** The concerns' laws over a laid stage: measured, advisory (a law that breaks says so; nothing refuses). Each row
 * { concern, law, holds, says }; a concern with nothing on the stage to measure has no row.
 *   cover      every fighting post has cover (a wall or crate) within 4.5 m
 *   circuit    no two checkpoints in a row nearer than SPACING metres
 *   fields     the plots lie level: their heights within half a metre
 *   drivable   the way, start to beats to exit, climbs no steeper than 1 in 4 between places */
export function concernLaws(ids, { ends, blocks = [], posts = [], mechanics = [] }) {
  const out = [], d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  if (ids.includes('cover') && posts.length) {
    const bare = posts.filter((p) => !blocks.some((b) => d2(b.at, p.at) <= 4.5)).map((p) => p.id);
    out.push({ concern: 'cover', law: 'cover-by-every-post', holds: !bare.length, says: bare.length ? `no cover within 4.5 m of ${bare.join(', ')}` : `cover by all ${posts.length} posts` });
  }
  const laps = mechanics.find((m) => m.kind === 'laps');
  if (ids.includes('circuit') && laps) {
    const at = [ends.spawn, ...laps.checkpoints.map((c) => c.at)], gaps = at.slice(1).map((p, i) => d2(p, at[i])), least = Math.min(...gaps);
    out.push({ concern: 'circuit', law: 'checkpoints-spaced', holds: least >= SPACING - 1e-6, says: `the shortest leg is ${least.toFixed(1)} m (${SPACING} wanted)` });
  }
  const crops = mechanics.find((m) => m.kind === 'crops');
  if (ids.includes('fields') && crops) {
    const zs = crops.plots.map((p) => p.at[2] ?? 0), spread = Math.max(...zs) - Math.min(...zs);
    out.push({ concern: 'fields', law: 'plots-level', holds: spread <= 0.5, says: `the plots' heights span ${spread.toFixed(2)} m (0.5 at most)` });
  }
  if (ids.includes('drivable') && ends.ground) {
    const way = [ends.spawn, ...(ends.beats ?? []).filter((b) => b.beat !== 'trailhead' && b.beat !== 'exit').map((b) => b.at), ends.exit];
    let steep = 0;
    for (let i = 1; i < way.length; i++) { const run = d2(way[i], way[i - 1]); if (run > 1) steep = Math.max(steep, Math.abs((way[i][2] ?? 0) - (way[i - 1][2] ?? 0)) / run); }
    out.push({ concern: 'drivable', law: 'grade-drivable', holds: steep <= 0.25, says: `the steepest leg climbs ${(steep * 100).toFixed(0)}% (25% at most)` });
  }
  return out;
}

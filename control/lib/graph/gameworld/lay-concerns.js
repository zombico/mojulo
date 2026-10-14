/**
 * THE CONCERNS LAID — what the world does for its cube's concerns (concerns.js), at two layers, so the land is made
 * for the game before any goal reads it:
 *
 *   GROUND   (world.js resolveLevel) the land shaped before a stage is laid. The level's own ground wins: an intent's
 *            dials go under the level's `tune`, and its edits after the creator's, each named `intent-<concern>`.
 *     fields     a field flattened beside the start, on the open side of the walk (the first trail's rows 2 to 3)
 *     board      a puzzle's board flattened further on (rows 5 to 7, three cells across)
 *     drivable   the heartbeat eased: a lower climb and fall, the bumps all but gone
 *     loop       a track that comes round: the land flattened under an oval about the first trail's walk (loopSite)
 *     arena      a match's ground: the land flattened under a square on the first trail's land, nothing growing on it
 *   STAGE    (levels.js stageLevelOrder) what stands on the laid stage, on its anchors (`ends`)
 *     fields     the field's centre, where the plots go (ends.field); board likewise (ends.board), the grid's centre
 *     circuit    checkpoints spaced (ends.spacing): a beat nearer the last kept than SPACING metres is no checkpoint
 *     loop       the oval's line, its start and a low wall down its middle (ends.loop, loopBlocks): a race goes round it
 *     arena      the arena on its square (ends.arena, arenaLayout): its plan, tunnelled from words (tunnel-arena.js): a
 *                wall round it, lanes or a court whose ways all loop, cover, all of it the same turned half round its
 *                centre, the spawns out of each other's sight and supplies on the floor
 *     cover      cover at the fighting posts: the goal's own posts, else the trail's beats (coverBlocks)
 *     road       a defence's pads beside its road, on land level with it (padSites)
 *     reachable  with a hero that jumps, every other pickup on crate steps, each rise within its jump (raisePickups)
 *     watchers   a wall on each watcher's approach, off the line, with a spot behind it the watcher cannot see
 *                (blindBlocks): a sneak can wait there and time the sweep
 *
 *   LAID                                 { <concern id>: ['ground' | 'stage'] } what is laid where
 *   groundLays(ids, level, frame)        → { tune?, edits, laid: [concern id] } for a level (layLevel's recipe)
 *   fieldSite(frame) / boardSite(frame)  → { at: '<cells>', centre: [x, y] } the field, the board, in the level's frame
 *   loopSite(frame)                      → { at: '<cells>', line: [[x, y]], start, heading, median, width, keep } the
 *                                          oval (`keep`: the ground nothing grows on, a stage's `_keepOut`)
 *   loopOn(loop, ends) / loopBlocks(loop, ends)   the oval on a stage's land (its line's heights); the wall down it
 *   arenaSite(frame, half?)              → { at: '<cells>', centre: [x, y], half, keep } the arena's square
 *   arenaOn(arena, ends) / arenaLayout(arena)   the square on a stage's land; its plan's walls and cover (`blocks`),
 *                                          `spawns` and `drops` there (the plan: gameworld/tunnel-arena.js)
 *   arenaAsks(pieces, at) / arenaSpawns(pieces, half, n)   a plan's pieces as terrain asks; spawns out of each other's sight
 *   beatPosts(ends, n?)                  → [{ id, at, heading, from, back }] posts on the beats (n: spread to n)
 *   coverBlocks(posts, ends)             → playscape terrain asks: a wall by each post, a crate stack, a wall between
 *   jumpHeight(rule) / raisePickups(mechanics, ends, jump)   how high a pilot jumps; pickups raised within it
 *   padSites(posts, ends)                → [[x, y, z]] a pad beside the road at each post, on level land
 *   blindBlocks(posts, ends)             → a wall on each watcher's approach, a place behind it out of its sight
 *   askBoxes(blocks) / blindSpots(post, ends, boxes)   the asks' boxes; the places on an approach out of a watcher's sight
 *   concernLaws(ids, { ends, blocks, posts, watchers, mechanics }) → [{ concern, law, holds, says }] the laws over a laid stage
 */
import { buildNav } from '../worlds/controllable/nav.js';

const r3 = (v) => Math.round(v * 1000) / 1000;

export const LAID = Object.freeze({ fields: ['ground', 'stage'], drivable: ['ground'], loop: ['ground', 'stage'], circuit: ['stage'], cover: ['stage'], watchers: ['stage'], 'road-to-base': ['stage'], board: ['ground', 'stage'], reachable: ['stage'], arena: ['ground', 'stage'] });
export const SIGHT = 14;             // metres a watcher's sight is measured over (a sneak guard's sightRange)
export const EYE = 1.275;            // a person's eye over its feet (the minds' collideHeight 1.7 × 0.75)
export const SPACING = 12;           // metres a checkpoint keeps from the last
export const DRIVABLE = Object.freeze({ amplitude: 3, depth: 2, bump: { height: 0.2 } });
// the oval a race goes round (metres): its turns' radius, the track's width, the room kept at the trail's ends, the
// spacing of its line's points, and how far past the turn the start line stands (the grid stands behind it)
export const LOOP_TUNE = Object.freeze({ amplitude: 0, depth: 0, bump: { height: 0 } });
export const LOOP = Object.freeze({ radius: 9, width: 8, margin: 3, step: 2, start: 12 });
// a match's arena (metres): half its side when its plan names none (36 m across), how far up the first trail it
// starts, its wall's height, how far a spawn stands in from the wall; its laws' numbers: how near cover must be, the
// share of the floor it must be near (the longest clear line is its plan's: its side, unless it asks for long lines)
export const ARENA = Object.freeze({ half: 18, start: 24, wall: 3, inset: 2.5, coverNear: 3.5, covered: 0.8 });

// a block of cells beside the walk on its open side (toward the site's open edge): `cols` across from 4 m off the walk,
// rows r0 to r1 of the first trail; → { at: '<cells>', centre: [x, y] } in the level's frame
function sideSite(F, r0, r1, cols) {
  const root = F.spans.find((s) => s.section === 'trail');
  if (!root || r1 * F.cell > root.D) return null;
  const y0 = (r0 - 1) * F.cell, y1 = r1 * F.cell - 0.01, wx = root.trailX((y0 + y1) / 2);
  const a = F.cellOf(wx + 4, y0), b = F.cellOf(wx + 4 + F.cell * cols - 0.01, y1);
  return { at: `${a}:${b}`, centre: [r3(wx + 4 + (F.cell * cols) / 2), r3((y0 + y1 + 0.01) / 2)] };
}
/** The field beside the start: two cells by two, rows 2 to 3. */
export const fieldSite = (F) => sideSite(F, 2, 3, 2);
/** The puzzle's board further on: three cells by three (its grid's 12.5 m and room round it), rows 5 to 7. */
export const boardSite = (F) => sideSite(F, 5, 7, 3);

/** The loop on the first trail's land: an oval (two straights along the walk, a half circle at each end) about the
 * walk's mean line, held on the site, from LOOP.margin past the trailhead to as far before the trail's end. Gone round
 * anticlockwise: up the straight on the open side, back down the other. Its line is points LOOP.step apart, the first
 * the start line, LOOP.start metres up the open straight. The land under it, and a margin, is flattened. → null when
 * the trail is too short to hold it. */
export function loopSite(F) {
  const root = F.spans.find((s) => s.section === 'trail');
  const R = LOOP.radius, half = LOOP.width / 2;
  if (!root) return null;
  const y0 = root.origin + R + LOOP.margin, y1 = root.origin + root.D - R - LOOP.margin;
  if (y1 - y0 < LOOP.start + 2 * half) return null;
  const xs = Array.from({ length: 9 }, (_, i) => root.trailX(y0 + ((y1 - y0) * i) / 8)), mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const cx = Math.max(F.x0 + R + half + 1, Math.min(F.x1 - R - half - 1, mean));
  // the oval by its length along: up the open straight, the far turn, down the other, the near turn
  const S = y1 - y0, arc = Math.PI * R, L = 2 * S + 2 * arc;
  const at = (u) => {
    u = ((u % L) + L) % L;
    if (u < S) return [cx + R, y0 + u];
    if (u < S + arc) { const a = (u - S) / R; return [cx + R * Math.cos(a), y1 + R * Math.sin(a)]; }
    if (u < 2 * S + arc) return [cx - R, y1 - (u - S - arc)];
    const a = Math.PI + (u - 2 * S - arc) / R; return [cx + R * Math.cos(a), y0 + R * Math.sin(a)];
  };
  const n = Math.round(L / LOOP.step), line = Array.from({ length: n }, (_, i) => at(LOOP.start + (i * L) / n).map(r3));
  const a = F.cellOf(cx - R - half - 2, y0 - R - half), b = F.cellOf(cx + R + half + 2, y1 + R + half);
  // the ground kept clear of what grows (era/reserve.js `_keepOut`): the straights' bands and a box over each turn
  const o = half + 1, keep = [[cx + R - o, y0, cx + R + o, y1], [cx - R - o, y0, cx - R + o, y1], [cx - R - o, y1, cx + R + o, y1 + R + o], [cx - R - o, y0 - R - o, cx + R + o, y0]].map((q) => q.map(r3));
  return { at: `${a}:${b}`, line, start: line[0], heading: r3(Math.PI / 2), length: r3(L), width: LOOP.width, median: { at: [r3(cx), r3((y0 + y1) / 2)], length: r3(S) }, keep };
}

/** The loop on a stage's land: its line's points at the land's height there, its walk included (null off the land). */
export function loopOn(loop, ends) {
  const at = ends.surface ?? ends.ground, z = (x, y) => (at ? at(x, y) : null);
  return { ...loop, line: loop.line.map(([x, y]) => [x, y, z(x, y)]), start: [loop.start[0], loop.start[1], z(loop.start[0], loop.start[1]) ?? ends.spawn[2]] };
}
/** A low wall down the oval's middle, between its straights: the infield is not a way round. */
export function loopBlocks(loop, ends) {
  const [x, y] = loop.median.at, z = ends.ground ? ends.ground(x, y) : null;
  return [{ form: 'wall', at: [x, y, z ?? ends.spawn[2]], N: [1, 0], length: loop.median.length, height: 1, thick: 0.6, value: 0.55 }];
}

/** The arena on the first trail's land: a square `half` (its plan's, else ARENA.half) either side of a centre on the
 * walk's mean line, ARENA.start up the trail, held on the site. The land under it, and a margin, is flattened; nothing
 * grows on it. → null when the trail is too short or too narrow to hold it. */
export function arenaSite(F, half = ARENA.half) {
  const root = F.spans.find((s) => s.section === 'trail'), H = half;
  if (!root || F.x1 - F.x0 < 2 * H + 2) return null;
  const y0 = root.origin + ARENA.start, y1 = y0 + 2 * H;
  if (y1 + 3 > root.origin + root.D) return null;
  const xs = Array.from({ length: 5 }, (_, i) => root.trailX(y0 + ((y1 - y0) * i) / 4)), mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const cx = Math.max(F.x0 + H + 1, Math.min(F.x1 - H - 1, mean)), cy = (y0 + y1) / 2;
  const a = F.cellOf(cx - H - 1, cy - H - 1), b = F.cellOf(cx + H + 1, cy + H + 1);
  return { at: `${a}:${b}`, centre: [r3(cx), r3(cy)], half: H, keep: [[cx - H - 1, cy - H - 1, cx + H + 1, cy + H + 1].map(r3)] };
}
/** The arena on a stage's land: its floor's height at its centre (the land is flat under it). */
export function arenaOn(arena, ends) {
  const [x, y] = arena.centre, z = ends.ground ? ends.ground(x, y) : null;
  return { ...arena, z: z ?? ends.spawn[2] };
}
/** An arena plan's pieces (gameworld/tunnel-arena.js: walls { form: 'wall', u, v, along: 'u' | 'v', length, height,
 * thick? } and crates { form: 'crate', u, v, stack }, in the arena's own frame) as terrain asks, each one collider,
 * placed by `at(u, v)`. */
export function arenaAsks(pieces, at) {
  return pieces.map((q) => (q.form === 'wall'
    ? { form: 'wall', at: at(q.u, q.v), N: q.along === 'v' ? [1, 0] : [0, 1], length: q.length, height: q.height, thick: q.thick ?? 0.5, value: 0.55, whole: true }
    : { form: 'crate', at: at(q.u, q.v), stack: q.stack ?? 1, value: 0.42, whole: true }));
}
// where the spawns may stand: round the inside of the wall, a corner first, ARENA.inset from it, every 3.5 m; then
// the floor inside it every 3 m (a pocket behind a blocker hides a spawn as well as a corner does)
function spawnRing(H) {
  const d = H - ARENA.inset, out = [[d, d]];
  for (let k = 1; k * 3.5 < 2 * d; k++) { const t = d - k * 3.5; out.push([d, r3(t)], [r3(t), d]); }
  for (let u = -d + 3; u < d - 1; u += 3) for (let v = 1.5; v < d - 1; v += 3) out.push([r3(u), r3(v)]);
  return out;
}
/** The spawns on an arena's floor (its own frame, the floor at 0): `n` of them, turned pairs off the ring inside its
 * wall and the floor within it, a corner first, then the farthest from those taken, each pair out of sight of every spawn taken (eye to chest).
 * When the floor holds no more pairs out of sight, the rest are the farthest left, and the law says so. → [[u, v]] */
export function arenaSpawns(pieces, half, n) {
  const boxes = askBoxes(arenaAsks(pieces, (u, v) => [u, v, 0])), eye = (p) => [p[0], p[1], 1.6], chest = (p) => [p[0], p[1], 1.2];
  const clear = (p) => !boxes.some((B) => p[0] > B.min[0] - 0.8 && p[0] < B.max[0] + 0.8 && p[1] > B.min[1] - 0.8 && p[1] < B.max[1] + 0.8);
  const unseen = (p, q) => blocked(eye(p), chest(q), boxes) && blocked(eye(q), chest(p), boxes);
  const ring = spawnRing(half).map(([u, v]) => [[u, v], [-u, -v]]).filter(([p, q]) => clear(p) && clear(q));
  const spawns = [];
  const far = (p) => (spawns.length ? Math.min(...spawns.map((s) => Math.hypot(s[0] - p[0], s[1] - p[1]))) : 0);
  for (const strict of [true, false]) {
    while (spawns.length < n) {
      const fits = ring.filter(([p, q]) => !spawns.some((s) => s[0] === p[0] && s[1] === p[1]) && (!strict || (unseen(p, q) && spawns.every((s) => unseen(s, p) && unseen(s, q)))));
      if (!fits.length) break;
      const [p, q] = fits.reduce((m, c) => (far(c[0]) > far(m[0]) + 1e-9 ? c : m));
      spawns.push(p); if (spawns.length < n) spawns.push(q);
    }
  }
  return spawns;
}

/** The arena laid on its square from its plan (`arena.plan`: { half, pieces, spawns, drops, longest } in its own
 * frame): `blocks` (each piece one collider), `spawns` and `drops` ({ at, gives }) on the land, and the longest clear
 * line its plan allows. */
export function arenaLayout(arena) {
  const [cx, cy] = arena.centre, z = arena.z ?? 0, P = arena.plan;
  const at = (u, v) => [r3(cx + u), r3(cy + v), z];
  return { blocks: arenaAsks(P.pieces, at), spawns: P.spawns.map(([u, v]) => at(u, v)), drops: P.drops.map((d) => ({ at: at(d.u, d.v), gives: d.gives })), longest: P.longest };
}

export function groundLays(ids, level, F, { arena = null } = {}) {
  const out = { edits: [], laid: [] };
  if (!F) return out;
  if (ids.includes('fields')) {
    const site = fieldSite(F);
    if (site) { out.edits.push({ op: 'flatten', at: site.at, id: 'intent-fields' }); out.laid.push('fields'); }
  }
  if (ids.includes('board')) {
    const site = boardSite(F);
    if (site) { out.edits.push({ op: 'flatten', at: site.at, id: 'intent-board' }); out.laid.push('board'); }
  }
  if (ids.includes('drivable')) { out.tune = { ...DRIVABLE }; out.laid.push('drivable'); }
  if (ids.includes('loop')) {
    // the walk crosses the oval at its turns: its heartbeat laid flat, so the walk lies at the flattened land's height
    const site = loopSite(F);
    if (site) { out.tune = { ...(out.tune ?? {}), ...LOOP_TUNE }; out.edits.push({ op: 'flatten', at: site.at, id: 'intent-loop' }); out.laid.push('loop'); }
  }
  if (ids.includes('arena')) {
    // its plan's size (gameworld/tunnel-arena.js), else the default square
    const site = arenaSite(F, arena?.half ?? ARENA.half);
    if (site) { out.edits.push({ op: 'flatten', at: site.at, id: 'intent-arena' }); out.laid.push('arena'); }
  }
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

/** A wall on each watcher's approach: 8 m out from it (inside its sight), 2.5 m off the line (sides by turns),
 * across the approach's main axis, taller than a person; behind it, from the watcher, a place to wait unseen. */
export function blindBlocks(posts, ends) {
  const blocks = [];
  const at = (x, y, z0) => { const z = ends.ground ? ends.ground(x, y) : null; return [r3(x), r3(y), z ?? z0]; };
  posts.forEach((p, k) => {
    const N = Math.abs(p.from[0]) >= Math.abs(p.from[1]) ? [Math.sign(p.from[0]) || 1, 0] : [0, Math.sign(p.from[1]) || 1], U = [-N[1], N[0]], side = k % 2 ? 1 : -1;
    // inside its sight: 8 m out from the watcher (half the approach when that is shorter)
    const len = Math.hypot(p.at[0] - p.back[0], p.at[1] - p.back[1]), d = Math.min(8, len / 2);
    const m = [p.at[0] - p.from[0] * d, p.at[1] - p.from[1] * d];
    blocks.push({ form: 'wall', at: at(m[0] + U[0] * 2.5 * side, m[1] + U[1] * 2.5 * side, p.at[2]), N, length: 3, height: 2, thick: 0.5, value: 0.5 });
  });
  return blocks;
}

/** How high a pilot's rule jumps (metres; 0 for one that does not): the platform rule's apex, v² / 2g. */
export const jumpHeight = (rule) => (rule?.type === 'platform' ? ((rule.jumpSpeed ?? 8.5) ** 2) / (2 * (rule.gravity ?? 20)) : 0);

/** Every other pickup of a level's collect raised onto steps a jump climbs: a crate beside it, a stack of two under it,
 * each rise three quarters of the jump (0.8 m at most), the pickup 0.8 m over the top and reached by height (planar:
 * false). → { mechanics, blocks, raised: [{ at, rises, above }] } (the mechanics as they were when nothing is raised). */
export function raisePickups(mechanics, ends, jump) {
  const s = Math.min(0.8, r3(jump * 0.75)), blocks = [], raised = [];
  if (!(s > 0.2)) return { mechanics, blocks, raised };
  const g = (x, y, z0) => (ends.ground ? ends.ground(x, y) ?? z0 : z0);
  const out = mechanics.map((m) => {
    if (m.kind !== 'collect') return m;
    let prev = ends.spawn;
    return { ...m, pickups: m.pickups.map((pk, j) => {
      const here = pk.at, d = Math.hypot(here[0] - prev[0], here[1] - prev[1]) || 1, f = [(here[0] - prev[0]) / d, (here[1] - prev[1]) / d];
      prev = here;
      if (j % 2 === 0) return pk;
      const z = g(here[0], here[1], here[2]), sz = [1.2, 1.2, s];
      blocks.push({ form: 'crate', at: [r3(here[0] - f[0] * 1.3), r3(here[1] - f[1] * 1.3), g(here[0] - f[0] * 1.3, here[1] - f[1] * 1.3, z)], size: sz, value: 0.45 });
      blocks.push({ form: 'crate', at: [r3(here[0]), r3(here[1]), z], size: sz, stack: 2, value: 0.4 });
      const at = [here[0], here[1], r3(z + 2 * s + 0.8)];
      raised.push({ at, rises: [s, s], above: 0.8 });
      return { ...pk, at, planar: false };
    }) };
  });
  return { mechanics: out, blocks, raised };
}

/** Pads beside a road at its posts: off the line by 4 to 6 m (sides by turns, the other side when that one will not
 * do), where the land is within 0.6 m of the road's, on the land. → [[x, y, z]] */
export function padSites(posts, ends) {
  const g = (x, y, z0) => (ends.ground ? ends.ground(x, y) ?? z0 : z0);
  return posts.map((p, k) => {
    const U = [-p.from[1], p.from[0]], side = k % 2 ? -1 : 1, z0 = p.at[2];
    const tries = [4, 5, 6].flatMap((d) => [d * side, -d * side]).map((d) => { const x = p.at[0] + U[0] * d, y = p.at[1] + U[1] * d; return [r3(x), r3(y), g(x, y, z0)]; });
    return tries.find((q) => Math.abs(q[2] - z0) <= 0.6) ?? tries[0];
  });
}

/** The boxes a list of terrain asks stands (walls and crates; what the laws measure sight against). */
export function askBoxes(blocks) {
  return blocks.flatMap((b) => {
    const [x, y, z] = b.at;
    if (b.form === 'wall') {
      const ax = Math.abs(b.N[0]) >= Math.abs(b.N[1]) ? 0 : 1, h = [0, 0], L = (b.length ?? 4) / 2, T = (b.thick ?? 0.4) / 2;
      h[ax] = T; h[1 - ax] = L;
      return [{ min: [x - h[0], y - h[1], z], max: [x + h[0], y + h[1], z + (b.height ?? 2.5)] }];
    }
    if (b.form === 'crate') { const sz = b.size ?? [1, 1, 1]; return [{ min: [x - sz[0] / 2, y - sz[1] / 2, z], max: [x + sz[0] / 2, y + sz[1] / 2, z + sz[2] * (b.stack ?? 1)] }]; }
    return [];
  });
}
// is a box's footprint within r of the point p (in plan)?
function boxNear(c, p, r) {
  const dx = Math.max(c.min[0] - p[0], 0, p[0] - c.max[0]), dy = Math.max(c.min[1] - p[1], 0, p[1] - c.max[1]);
  return Math.hypot(dx, dy) < r;
}
// does a box stand across the segment a → b (strictly between them)?
function blocked(a, b, boxes) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  return boxes.some((B) => {
    let t0 = 0, t1 = 1;
    for (let k = 0; k < 3; k++) {
      if (Math.abs(d[k]) < 1e-12) { if (a[k] < B.min[k] || a[k] > B.max[k]) return false; continue; }
      let u = (B.min[k] - a[k]) / d[k], v = (B.max[k] - a[k]) / d[k];
      if (u > v) [u, v] = [v, u];
      t0 = Math.max(t0, u); t1 = Math.min(t1, v);
      if (t0 > t1) return false;
    }
    return t0 > 1e-3 && t0 < 1 - 1e-3;
  });
}

/** The places on a watcher's approach (from the one before to it, 3 m either side of the line) that its eye cannot
 * see for the boxes, inside its sight: [[x, y, z]]. */
export function blindSpots(post, ends, boxes) {
  const out = [], g = (x, y) => (ends.ground ? ends.ground(x, y) ?? post.at[2] : post.at[2]);
  const eye = [post.at[0], post.at[1], post.at[2] + EYE], U = [-post.from[1], post.from[0]];
  for (let i = 1; i < 10; i++) for (let j = -3; j <= 3; j++) {
    const t = i / 10, x = post.back[0] + (post.at[0] - post.back[0]) * t + U[0] * j, y = post.back[1] + (post.at[1] - post.back[1]) * t + U[1] * j;
    if (Math.hypot(x - post.at[0], y - post.at[1]) > SIGHT) continue;
    const q = [x, y, g(x, y) + EYE];
    if (boxes.some((B) => x > B.min[0] - 0.3 && x < B.max[0] + 0.3 && y > B.min[1] - 0.3 && y < B.max[1] + 0.3)) continue;
    if (blocked(eye, q, boxes)) out.push([r3(x), r3(y), r3(q[2] - EYE)]);
  }
  return out;
}

export const ROAD = 40;              // metres a defence's road wants, to fight along
// the nearest point of a polyline to q, and q's distance to a segment
function segDist(q, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L)) : 0;
  return Math.hypot(q[0] - a[0] - dx * t, q[1] - a[1] - dy * t);
}
function nearestOn(q, line) {
  let best = null, bd = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L)) : 0;
    const p = [a[0] + dx * t, a[1] + dy * t], d = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

/** The concerns' laws over a laid stage: measured, advisory (a law that breaks says so; nothing refuses). Each row
 * { concern, law, holds, says }; a concern with nothing on the stage to measure has no row.
 *   road       a defence's road runs ROAD m or more; its pads stand 3 to 7 m off it, within 1 m of its level
 *   watchers   every watcher's approach has a place out of its sight, inside it (SIGHT m)
 *   cover      every fighting post has cover (a wall or crate) within 4.5 m
 *   circuit    no two checkpoints in a row nearer than SPACING metres
 *   reachable  every raised pickup's rises within the pilot's jump, the pickup within 1.2 m over the top
 *   fields     the plots lie level: their heights within half a metre
 *   board      the puzzle's cells lie level: within half a metre
 *   drivable   the way, start to beats to exit, climbs no steeper than 1 in 4 between places
 *   arena      every spawn reaches every other, still with any one stretch of the way between them closed (no single
 *              chokepoint); no spawn sees another; cover within ARENA.coverNear of most of the floor; no clear line
 *              across the floor longer than its plan allows (its side); nothing of the stage's own standing on the floor
 *   loop       the oval lies on the land, climbs no steeper than 1 in 4, nothing stands on it (but its own wall), and
 *              its checkpoints come round to the start */
export function concernLaws(ids, { ends, blocks = [], posts = [], watchers = [], pads = [], raised = [], jump = 0, mechanics = [], loop = null, arena = null }) {
  const out = [], d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  if (ids.includes('arena') && arena) {
    out.push(...arenaLaws(arena, blocks, ends));
    // what its words asked that the grammar cannot show (tunnel-arena.js gaps): said, never filled
    const gaps = arena.tunnel?.gaps ?? [];
    if (arena.tunnel) out.push({ concern: 'arena', law: 'words-shown', holds: !gaps.length, says: gaps.length ? gaps.map((g) => `'${g.word}' is not laid yet (${g.why}; ${g.proposal})`).join('; ') : `every word of '${arena.tunnel.words}' shown` });
  }
  const waves = mechanics.find((m) => m.kind === 'waves');
  if (ids.includes('road-to-base') && waves) {
    const road = waves.path, long = road.slice(1).reduce((a, q, i) => a + d2(q, road[i]), 0);
    out.push({ concern: 'road-to-base', law: 'road-long-enough', holds: long >= ROAD, says: `the road runs ${long.toFixed(0)} m (${ROAD} wanted)` });
    if (pads.length) {
      const off = (q) => Math.min(...road.slice(1).map((b, i) => segDist(q, road[i], b)));
      const bad = pads.filter((q) => { const d = off(q); return d < 3 || d > 7 || Math.abs((q[2] ?? 0) - (ends.ground ? ends.ground(...nearestOn(q, road)) ?? q[2] : q[2])) > 1; });
      out.push({ concern: 'road-to-base', law: 'pads-beside-the-road', holds: !bad.length, says: bad.length ? `${bad.length} of ${pads.length} pads are on the road, far from it or off its level` : `all ${pads.length} pads beside the road, level with it` });
    }
  }
  if (ids.includes('watchers') && watchers.length) {
    const boxes = askBoxes(blocks), open = watchers.filter((w) => !blindSpots(w, ends, boxes).length).map((w) => w.id);
    out.push({ concern: 'watchers', law: 'a-blind-spot-on-every-approach', holds: !open.length, says: open.length ? `nowhere on the way to ${open.join(', ')} is out of its sight` : `a place out of sight on the way to each of ${watchers.length}` });
  }
  if (ids.includes('cover') && posts.length) {
    const bare = posts.filter((p) => !blocks.some((b) => d2(b.at, p.at) <= 4.5)).map((p) => p.id);
    out.push({ concern: 'cover', law: 'cover-by-every-post', holds: !bare.length, says: bare.length ? `no cover within 4.5 m of ${bare.join(', ')}` : `cover by all ${posts.length} posts` });
  }
  const laps = mechanics.find((m) => m.kind === 'laps');
  if (ids.includes('circuit') && laps) {
    const at = [ends.spawn, ...laps.checkpoints.map((c) => c.at)], gaps = at.slice(1).map((p, i) => d2(p, at[i])), least = Math.min(...gaps);
    out.push({ concern: 'circuit', law: 'checkpoints-spaced', holds: least >= SPACING - 1e-6, says: `the shortest leg is ${least.toFixed(1)} m (${SPACING} wanted)` });
  }
  if (ids.includes('reachable') && raised.length) {
    const far = raised.filter((r) => r.rises.some((h) => h > jump + 1e-6) || r.above > 1.2);
    out.push({ concern: 'reachable', law: 'within-a-jump', holds: !far.length, says: far.length ? `${far.length} of ${raised.length} raised pickups need more than a ${jump.toFixed(2)} m jump` : `all ${raised.length} raised pickups within a ${jump.toFixed(2)} m jump` });
  }
  const push = mechanics.find((m) => m.kind === 'push');
  if (ids.includes('board') && push?.heights) {
    const zs = push.heights.flat(), spread = Math.max(...zs) - Math.min(...zs);
    out.push({ concern: 'board', law: 'board-level', holds: spread <= 0.5, says: `the board's cells span ${spread.toFixed(2)} m in height (0.5 at most)` });
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
  if (ids.includes('loop') && loop) {
    const L = loop.line, off = L.filter((p) => p[2] == null).length;
    out.push({ concern: 'loop', law: 'loop-on-the-land', holds: !off, says: off ? `${off} of ${L.length} points of the line are off the land` : `all ${L.length} points of the line on the land` });
    let steep = 0;
    L.forEach((p, i) => { const q = L[(i + 1) % L.length], run = d2(p, q); if (p[2] != null && q[2] != null && run > 0.5) steep = Math.max(steep, Math.abs(q[2] - p[2]) / run); });
    out.push({ concern: 'loop', law: 'loop-grade', holds: steep <= 0.25, says: `the line climbs ${(steep * 100).toFixed(0)}% at its steepest (25% at most)` });
    const own = (b) => b.form === 'wall' && b.at[0] === loop.median.at[0] && b.at[1] === loop.median.at[1];
    const boxes = askBoxes(blocks.filter((b) => !own(b))), half = loop.width / 2;
    const hit = (ends.colliders ?? []).concat(boxes).filter((c) => L.some((p) => boxNear(c, p, half - 1))).length;
    // rock a wheel would climb: its top over the line's height, across the track
    const rocky = ends.rocks ? L.filter((p) => p[2] != null && [-1, 0, 1].some((k) => { const i = L.indexOf(p), q = L[(i + 1) % L.length], d = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, x = p[0] - ((q[1] - p[1]) / d) * k * (half - 1), y = p[1] + ((q[0] - p[0]) / d) * k * (half - 1), z = ends.rocks(x, y); return z != null && z > p[2] + 0.4; })).length : 0;
    const says = [hit ? `${hit} thing${hit > 1 ? 's' : ''} stand on the track` : '', rocky ? `rock stands on ${rocky} of ${L.length} points of the line` : ''].filter(Boolean).join('; ');
    out.push({ concern: 'loop', law: 'loop-clear', holds: !hit && !rocky, says: says || 'nothing stands on the track' });
    if (laps) {
      const last = laps.checkpoints[laps.checkpoints.length - 1].at, home = d2(last, loop.start);
      out.push({ concern: 'loop', law: 'finish-at-the-start', holds: home <= 1, says: `the finish is ${home.toFixed(1)} m from the start line` });
    }
  }
  return out;
}

/** The longest clear line across an arena's floor, eye to eye, between points of a 4 m grid inside its wall that no
 * box stands on: { longest, from, to } (from and to null when nothing is clear). `boxes`: the arena's (askBoxes). */
export function arenaLongest(arena, boxes) {
  const [cx, cy] = arena.centre, z = arena.z ?? 0, H = arena.half, pts = [];
  for (let u = -H + 1; u <= H - 1; u += 4) for (let v = -H + 1; v <= H - 1; v += 4) {
    const p = [cx + u, cy + v, z + 1.6];
    if (!boxes.some((B) => p[0] > B.min[0] - 0.3 && p[0] < B.max[0] + 0.3 && p[1] > B.min[1] - 0.3 && p[1] < B.max[1] + 0.3)) pts.push(p);
  }
  let longest = 0, from = null, to = null;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const a = pts[i], b = pts[j], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (d > longest + 1e-9 && !blocked(a, b, boxes)) { longest = d; from = a; to = b; }
  }
  return { longest, from, to };
}

// the arena's laws over what was laid on it (concernLaws): measured on its floor, a 2 m grid inside its wall
function arenaLaws(arena, blocks, ends) {
  const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const out = [], [cx, cy] = arena.centre, z = arena.z ?? 0, H = arena.half, spawns = arena.spawns ?? [];
  const boxes = askBoxes(blocks);
  const inBox = (p, pad) => boxes.some((B) => p[0] > B.min[0] - pad && p[0] < B.max[0] + pad && p[1] > B.min[1] - pad && p[1] < B.max[1] + pad);
  const floor = [];
  for (let u = -H + 1; u <= H - 1; u += 2) for (let v = -H + 1; v <= H - 1; v += 2) { const p = [cx + u, cy + v, z]; if (!inBox(p, 0.3)) floor.push(p); }
  // routes: a path between every pair of spawns, and still one with any stretch of the first path closed
  const N = {}; buildNav(N);
  const world = { colliders: boxes }, opts = { radius: 0.4, height: 1.8, footZ: z, step: 0.35, cell: 0.5 };
  // the way from a to b on the floor: its corners, [a, b] when the line is clear, null when there is none
  const way = (a, b, w) => { const P = N.navPath(w, a, b, opts); return P === null ? null : P.length ? [a, ...P.map((q) => [q[0], q[1], z])] : [a, b]; };
  let cut = null, lost = null;
  for (let i = 0; i < spawns.length && !cut && !lost; i++) for (let j = i + 1; j < spawns.length && !cut && !lost; j++) {
    const P = way(spawns[i], spawns[j], world);
    if (!P) { lost = [i, j]; break; }
    const len = P.slice(1).reduce((a, q, k) => a + d2(q, P[k]), 0);
    for (const f of [0.3, 0.5, 0.7]) {
      // the point f of the way along, closed by a box 3 m across
      let left = f * len, k = 1;
      while (k < P.length - 1 && left > d2(P[k], P[k - 1])) { left -= d2(P[k], P[k - 1]); k++; }
      const a = P[k - 1], b = P[k], L = d2(a, b) || 1, q = [a[0] + ((b[0] - a[0]) * left) / L, a[1] + ((b[1] - a[1]) * left) / L];
      if (Math.hypot(q[0] - spawns[i][0], q[1] - spawns[i][1]) < 3 || Math.hypot(q[0] - spawns[j][0], q[1] - spawns[j][1]) < 3) continue;
      const plug = { min: [q[0] - 1.5, q[1] - 1.5, z], max: [q[0] + 1.5, q[1] + 1.5, z + 3] };
      if (!way(spawns[i], spawns[j], { colliders: [...boxes, plug] })) { cut = [i, j, q]; break; }
    }
  }
  out.push({ concern: 'arena', law: 'routes-loop', holds: !cut && !lost && spawns.length > 1, says: lost ? `spawn ${lost[0] + 1} cannot reach spawn ${lost[1] + 1}` : cut ? `closing the way at [${cut[2].map((v) => v.toFixed(1))}] cuts spawn ${cut[0] + 1} off from spawn ${cut[1] + 1}` : `every way between the ${spawns.length} spawns has another round any stretch of it` });
  // spawns out of each other's sight, eye to chest
  const seen = [];
  for (let i = 0; i < spawns.length; i++) for (let j = i + 1; j < spawns.length; j++) {
    const a = spawns[i], b = spawns[j];
    if (!blocked([a[0], a[1], z + 1.6], [b[0], b[1], z + 1.2], boxes) || !blocked([b[0], b[1], z + 1.6], [a[0], a[1], z + 1.2], boxes)) seen.push(`${i + 1}-${j + 1}`);
  }
  out.push({ concern: 'arena', law: 'spawns-unseen', holds: !seen.length, says: seen.length ? `spawns in sight of each other: ${seen.join(', ')}` : `none of the ${spawns.length} spawns sees another` });
  // cover near most of the floor
  const near = floor.filter((p) => boxes.some((B) => boxNear(B, p, ARENA.coverNear))).length;
  out.push({ concern: 'arena', law: 'cover-near', holds: near >= ARENA.covered * floor.length, says: `${Math.round((100 * near) / (floor.length || 1))}% of the floor has cover within ${ARENA.coverNear} m (${Math.round(ARENA.covered * 100)}% wanted)` });
  // the longest clear line across the floor, eye to eye
  const { longest } = arenaLongest(arena, boxes);
  const most = arena.longest ?? 2 * H;
  out.push({ concern: 'arena', law: 'no-line-across', holds: longest <= most, says: `the longest clear line on the floor is ${longest.toFixed(1)} m (${most} at most)` });
  // nothing of the stage's own (rock, a stand of trees' trunks) standing on the floor
  const own = (ends.colliders ?? []).filter((c) => !String(c.of ?? '').startsWith('bound:') && !String(c.of ?? '').startsWith('block:') && floor.some((p) => boxNear(c, p, 0.5) && c.max[2] > z + 0.4)).length;
  const rocky = ends.rocks ? floor.filter((p) => { const r = ends.rocks(p[0], p[1]); return r != null && r > z + 0.4; }).length : 0;
  out.push({ concern: 'arena', law: 'floor-clear', holds: !own && !rocky, says: own || rocky ? `${own} of the stage's own colliders and ${rocky} rocky spots stand on the floor` : 'nothing of the stage stands on the floor' });
  return out;
}

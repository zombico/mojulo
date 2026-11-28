/**
 * THE OPERATION MAP — a frame level as its pilot reads it before the drop: the field seen from above, as the radar and
 * the beacons will tell it (a frame's level has no trail: the land is read off its radar and fought for its beacons).
 * The game book's plate for a level with a `frame` (gameworld/bible-html.js), in place of the flight map a plain airspace
 * level draws.
 *
 *   frameMapSvg(G, id, { px? }) → an SVG string: the field's ground shaded from the north-west (its rock by its height,
 *                                its walls dark, its water blue), the square a frame keeps to, the frame's drop and the
 *                                exit, every group of the operation where it stands (by kind), each reach task's beacon
 *                                with its radius and its order, and the radar's ring round the drop
 *   frameMapData(G, id)        → what the map draws, as numbers: { field: { centre, half, bound, sea }, spawn, exit,
 *                                radar, groups: [{ id, kind, members: [[x, y, z]] }], beacons: [{ task, at, radius }] }
 *
 * Pure: the same world, the same map. The ground is the field's own (assault-frame/field.js frameField), the operation's
 * places its own (gameworld/frame-goal.js), so the map and the level agree.
 */
import { resolveLevel } from './world.js';
import { frameLevelManifest, frameFieldEnds } from './levels.js';
import { readOperation, operationMechanics, operationCast } from './frame-goal.js';
import { frameField } from '../assault-frame/field.js';
import { encodePng } from '../landscape/surface-textures.js';

const r1 = (v) => Math.round(v * 10) / 10;
// the radar's reach on a frame's page when its rule names none (scene/channels/controllable/index.js)
const RADAR = 620;
const KIND_MARK = Object.freeze({ turret: 'square', tank: 'diamond', walker: 'circle', frame: 'chevron' });

/** The numbers the map draws. */
export function frameMapData(G, id) {
  const R = resolveLevel(G, id);
  if (!R.airspace?.frame) throw new Error(`frame map: level '${id}' is not a frame's (an airspace level with a frame)`);
  const stage = { manifest: frameLevelManifest(R), frame: R.airspace.frame }, ends = frameFieldEnds(stage), F = frameField(stage.manifest.cube);
  const goal = G.levels[id]?.goal, op = goal?.operation !== undefined ? readOperation(goal.operation) : { groups: [], tasks: [] };
  const cast = operationCast(op, ends), mech = operationMechanics(op, ends)[0];
  const groups = op.groups.map((g) => ({ id: g.id, kind: g.kind, members: cast.entities.filter((e) => e.id === g.id || e.id.startsWith(`${g.id}-`)).map((e) => e.transform.pos.slice()) }));
  const beacons = mech.tasks.map((t, i) => (t.kind === 'reach' || t.kind === 'scan' ? { task: i + 1, at: t.at, radius: t.radius } : null)).filter(Boolean);
  return { field: { centre: F.centre, half: F.half, bound: ends.frame.bound, sea: F.sea }, spawn: ends.spawn, exit: ends.exit, radar: RADAR, groups, beacons, heightAt: F.landAt };
}

/** The operation map as an SVG string, `px` wide. */
export function frameMapSvg(G, id, { px = 300 } = {}) {
  const D = frameMapData(G, id), { centre: [cx, cy], half, sea } = D.field, reach = half * 1.12;
  // (the ground: a raster at N cells, shaded from the north-west, its walls dark, its water blue)
  const N = 160, cell = (2 * reach) / N, H = new Float64Array((N + 1) * (N + 1));
  let lo = Infinity, hi = -Infinity;
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { const z = D.heightAt(cx - reach + i * cell, cy + reach - j * cell); H[j * (N + 1) + i] = z; lo = Math.min(lo, z); hi = Math.max(hi, z); }
  const rgb = Buffer.alloc(N * N * 3), span = Math.max(1, hi - Math.max(lo, sea));
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = H[j * (N + 1) + i], b = H[j * (N + 1) + i + 1], c = H[(j + 1) * (N + 1) + i], z = (a + b + c + H[(j + 1) * (N + 1) + i + 1]) / 4;
    const gx = (b - a) / cell, gy = (a - c) / cell, g = Math.hypot(gx, gy), q = (j * N + i) * 3;
    if (z < sea) { rgb[q] = 64; rgb[q + 1] = 132; rgb[q + 2] = 168; continue; }
    const t = Math.min(1, Math.max(0, (z - Math.max(lo, sea)) / span)), lit = Math.max(0.25, Math.min(1.2, 0.8 + (-gx * 0.6 + gy * 0.6) / Math.sqrt(1 + g * g) * 0.9));
    const wall = g > 2.75 ? 0.45 : g > 0.7 ? 0.75 : 1;
    const base = [214 - 70 * t, 186 - 78 * t, 150 - 74 * t];
    for (let k = 0; k < 3; k++) rgb[q + k] = Math.max(0, Math.min(255, Math.round(base[k] * lit * wall)));
  }
  const img = `data:image/png;base64,${encodePng(rgb, N, N).toString('base64')}`;
  const k = px / (2 * reach), X = (x) => r1((x - (cx - reach)) * k), Y = (y) => r1(((cy + reach) - y) * k), L = (m) => r1(m * k);
  const [bx0, by0, bx1, by1] = D.field.bound, foe = '#d8452c', ally = '#2f7fd0', beacon = '#0e9fb0';
  const mark = (kind, x, y) => {
    const s = 3.6, at = `${X(x)},${Y(y)}`;
    if (KIND_MARK[kind] === 'square') return `<rect x="${r1(X(x) - s)}" y="${r1(Y(y) - s)}" width="${2 * s}" height="${2 * s}" fill="${foe}"/>`;
    if (KIND_MARK[kind] === 'diamond') return `<path d="M${X(x)} ${r1(Y(y) - s * 1.3)}l${s * 1.3} ${s * 1.3}l${-s * 1.3} ${s * 1.3}l${-s * 1.3} ${-s * 1.3}z" fill="${foe}"/>`;
    if (KIND_MARK[kind] === 'chevron') return `<path d="M${r1(X(x) - s * 1.4)} ${r1(Y(y) + s)}L${X(x)} ${r1(Y(y) - s * 1.4)}L${r1(X(x) + s * 1.4)} ${r1(Y(y) + s)}L${X(x)} ${r1(Y(y))}z" fill="${foe}" stroke="#fff" stroke-width="0.6"/>`;
    return `<circle cx="${X(x)}" cy="${Y(y)}" r="${s}" fill="${foe}"/><title>${at}</title>`;
  };
  const groups = D.groups.map((g) => `<g data-group="${g.id}">${g.members.map((m) => mark(g.kind, m[0], m[1])).join('')}</g>`).join('');
  const beacons = D.beacons.map((b) => `<g data-beacon="${b.task}"><circle cx="${X(b.at[0])}" cy="${Y(b.at[1])}" r="${L(b.radius)}" fill="${beacon}" fill-opacity="0.18" stroke="${beacon}" stroke-width="1.4"/><text x="${X(b.at[0])}" y="${r1(Y(b.at[1]) + 3.5)}" font-size="10" font-weight="700" text-anchor="middle" fill="#fff" stroke="${beacon}" stroke-width="2.4" paint-order="stroke">${b.task}</text></g>`).join('');
  const [sx, sy] = D.spawn, [ex, ey] = D.exit;
  const drop = `<path d="M${X(sx)} ${r1(Y(sy) - 7)}l5 10l-5 -3l-5 3z" fill="${ally}" stroke="#fff" stroke-width="0.8"/>`;
  const exit = `<path d="M${r1(X(ex) - 5)} ${Y(ey)}h10M${X(ex)} ${r1(Y(ey) - 5)}v10" stroke="${ally}" stroke-width="2"/>`;
  const radar = `<circle cx="${X(sx)}" cy="${Y(sy)}" r="${L(D.radar)}" fill="none" stroke="${ally}" stroke-opacity="0.55" stroke-dasharray="3 4"/>`;
  const bound = `<rect x="${X(bx0)}" y="${Y(by1)}" width="${L(bx1 - bx0)}" height="${L(by1 - by0)}" fill="none" stroke="#1d2433" stroke-opacity="0.6" stroke-dasharray="6 4"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${px} ${px}" width="${px}" data-map="frame-operation"><image href="${img}" x="0" y="0" width="${px}" height="${px}" preserveAspectRatio="none" style="image-rendering:auto"/>${bound}${radar}${beacons}${groups}${exit}${drop}<text x="${px - 6}" y="14" font-size="10" text-anchor="end" fill="#1d2433">N ↑</text></svg>`;
}

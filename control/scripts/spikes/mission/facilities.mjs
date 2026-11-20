#!/usr/bin/env node
/**
 * FACILITIES, PROVED AND PLAYED — each facility (era/facilities.js: a use, its plan's fighting dials, its rooms' floors
 * laid in figures by era/room-layouts.js, its look) laid as a building level, its rooms held to their layouts' laws
 * (compose-dress.js layoutReport), and its main hall crossed by the route search under a watcher walking it, beside the
 * same building bare (its use, look and dials, no layouts): what the layouts buy a sneaking body, measured.
 *
 *   cd control
 *   node scripts/spikes/mission/facilities.mjs --plan [--facility <id>] [--svg /abs/dir]
 *   node scripts/spikes/mission/facilities.mjs --out /abs/dir --facility <id> [--hero <ref>] [--guard <ref>] [--cdn] [--capture]
 *
 * `--svg` draws each one's ground storey from above: its rooms, its doorways (gold) and ways out (green), its pieces by
 * what they hide (red: a standing body, amber: a crouch, blue: a body lying down), the hall's way across unseen (white).
 */
import { register } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { options, database, starterRoom, writePage } = await import('./lib.mjs');
const o = options(process.argv.slice(2));
database(o.opt('--hero'), o.opt('--guard'));

const { buildingStage } = await import('../../../lib/graph/gameworld/levels.js');
const { planStage } = await import('../../../lib/graph/era/stage.js');
const { withProgram } = await import('../../../lib/graph/era/programs.js');
const { PIECES, footprintOf } = await import('../../../lib/graph/era/compose-dress.js');
const { FACILITIES, FACILITY_IDS } = await import('../../../lib/graph/era/facilities.js');
const { sneakRoutes } = await import('../../../lib/graph/gameworld/stealth-routes.js');
const r2 = (v) => +v.toFixed(2);

const planOf = (B) => planStage(withProgram(buildingStage({ seed: 1, ...B })));
// a room's doorways' insides (a link's or a way's middle, 0.8 m in)
const doorsOf = (P, r) => {
  const out = [];
  for (const l of P.links) if (l.from === r.id || l.to === r.id) { const X = l.wall.endsWith('x'), s = l.wall.startsWith('+') ? 1 : -1, into = l.to === r.id ? s : -s, m = (l.lo + l.hi) / 2; out.push(X ? [l.at + into * 0.8, m] : [m, l.at + into * 0.8]); }
  for (const w of P.ways ?? []) if (w.room === r.id) { const X = w.side.endsWith('x'), s = w.side.startsWith('+') ? 1 : -1, m = (w.lo + w.hi) / 2; out.push(X ? [w.at - s * 0.8, m] : [m, w.at - s * 0.8]); }
  return out;
};
// THE HALL: the facility's biggest room on the ground; crossed from its first doorway to the one farthest from it (one
// doorway: to its far end), a watcher walking its long axis and looking round at each end
// (a stair's core is no hall: a facility with none has its rooms for its ground, and no crossing)
const hallOf = (P) => P.rooms.filter((r) => (r.storey ?? 0) === 0 && !/^(core|lobby|corridor)/.test(r.id)).reduce((a, r) => (!a || (r.x1 - r.x0) * (r.y1 - r.y0) > (a.x1 - a.x0) * (a.y1 - a.y0) ? r : a), null);
function crossing(P, r) {
  const D = doorsOf(P, r), a = D[0], far = (q) => Math.hypot(q[0] - a[0], q[1] - a[1]);
  const b = D.length > 1 ? D.reduce((p, q) => (far(q) > far(p) ? q : p)) : [r.x0 + r.x1 - a[0], r.y0 + r.y1 - a[1]].map((v, k) => Math.min((k ? r.y1 : r.x1) - 0.8, Math.max((k ? r.y0 : r.x0) + 0.8, v)));
  const alongX = r.x1 - r.x0 >= r.y1 - r.y0, c = alongX ? (r.y0 + r.y1) / 2 : (r.x0 + r.x1) / 2, lo = (alongX ? r.x0 : r.y0) + 2, hi = (alongX ? r.x1 : r.y1) - 2;
  const pt = (u) => (alongX ? [u, c] : [c, u]);
  const watcher = { id: 'hall', at: pt(hi), to: pt(lo), speed: 1, cone: 0.8, range: 16, eye: 1.35, hear: 6, look: { secs: 4 }, near: { r: 2, back: 100 } };
  const boxes = (P.props ?? []).filter((it) => it.room === r.id && PIECES[it.kind]?.solid !== false && !it.wall).map((it) => { const f = footprintOf(it); return { min: [f.min[0], f.min[1], 0], max: [f.max[0], f.max[1], PIECES[it.kind].h * (it.scale ?? 1) * ((it.level ?? 0) + 1)] }; });
  // (one doorway: its far end, slid across the hall to the nearest place no piece stands on)
  if (D.length === 1) {
    const clear = (q) => !boxes.some((B) => q[0] > B.min[0] - 0.6 && q[0] < B.max[0] + 0.6 && q[1] > B.min[1] - 0.6 && q[1] < B.max[1] + 0.6);
    const ax = Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]) ? 1 : 0;
    for (let d = 0; d < 12 && !clear(b); d += 0.25) { const p = [...b], m = [...b]; p[ax] += d; m[ax] -= d; if (clear(p)) { b[ax] = p[ax]; break; } if (clear(m)) { b[ax] = m[ax]; break; } }
  }
  const R = sneakRoutes({ bounds: [r.x0, r.y0, r.x1, r.y1], boxes, watchers: [watcher], start: a, goal: b, goalRadius: 1.2, seconds: 240, cell: 0.5 });
  return { a: a.map(r2), b: b.map(r2), watcher, R };
}
const say = (s) => (s ? `${s.seconds} s (waits ${s.waits}, crouches ${s.crouch} m, crawls ${s.crawl} m, never nearer the watcher than ${s.nearest} m)` : 'none');

function svgOf(id, P, cross) {
  const rooms = P.rooms.filter((r) => (r.storey ?? 0) === 0), S = 14;
  const X0 = Math.min(...rooms.map((r) => r.x0)) - 1, Y0 = Math.min(...rooms.map((r) => r.y0)) - 3, X1 = Math.max(...rooms.map((r) => r.x1)) + 1, Y1 = Math.max(...rooms.map((r) => r.y1)) + 1;
  const x = (v) => r2((v - X0) * S), y = (v) => r2((Y1 - v) * S), F = FACILITIES[id];
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${x(X1)}" height="${y(Y0)}" style="background:#1c1f22" font-family="ui-monospace,monospace">`;
  for (const r of rooms) s += `<rect x="${x(r.x0)}" y="${y(r.y1)}" width="${r2((r.x1 - r.x0) * S)}" height="${r2((r.y1 - r.y0) * S)}" fill="#3a3f44" stroke="#8a8f94" stroke-width="2"/><text x="${x(r.x0) + 4}" y="${y(r.y1) + 14}" fill="#9ab" font-size="11">${r.id}</text>`;
  const gap = (X, at, lo, hi, c) => (X ? `<rect x="${x(at) - 3}" y="${y(hi)}" width="6" height="${r2((hi - lo) * S)}" fill="${c}"/>` : `<rect x="${x(lo)}" y="${y(at) - 3}" width="${r2((hi - lo) * S)}" height="6" fill="${c}"/>`);
  for (const l of P.links) if (rooms.some((r) => r.id === l.from) && rooms.some((r) => r.id === l.to)) s += gap(l.wall.endsWith('x'), l.at, l.lo, l.hi, '#e8c46a');
  for (const w of P.ways ?? []) if (rooms.some((r) => r.id === w.room)) s += gap(w.side.endsWith('x'), w.at, w.lo, w.hi, '#6ae88a');
  const tall = new Map();
  for (const it of P.props ?? []) { const base = it.id.replace(/@\d+$/, ''); tall.set(base, Math.max(tall.get(base) ?? 0, PIECES[it.kind].h * (it.scale ?? 1) * ((it.level ?? 0) + 1))); }
  for (const it of (P.props ?? []).filter((it) => !it.level && rooms.some((r) => r.id === it.room))) {
    const f = footprintOf(it), h = tall.get(it.id), c = h >= 1.6 ? '#c9553f' : h >= 0.85 ? '#d99a3c' : '#6f8fa6';
    s += `<rect x="${x(f.min[0])}" y="${y(f.max[1])}" width="${r2((f.max[0] - f.min[0]) * S)}" height="${r2((f.max[1] - f.min[1]) * S)}" fill="${c}" stroke="#111" stroke-width="0.5"/>`;
  }
  if (cross?.R.sneak?.path) s += `<polyline points="${cross.R.sneak.path.map((p) => `${x(p.at[0])},${y(p.at[1])}`).join(' ')}" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="5 3"/>`;
  if (cross) s += `<line x1="${x(cross.watcher.at[0])}" y1="${y(cross.watcher.at[1])}" x2="${x(cross.watcher.to[0])}" y2="${y(cross.watcher.to[1])}" stroke="#ff5a5a" stroke-width="2" opacity="0.7"/>`;
  s += `<text x="8" y="${y(Y0) - 10}" fill="#dde" font-size="13">${id}: a ${F.use} in ${F.look.construction} · ${F.look.palette}</text></svg>`;
  return s;
}

const ids = o.opt('--facility') ? [o.opt('--facility')] : FACILITY_IDS;
for (const id of ids) if (!FACILITIES[id]) { console.error(`facilities: '${id}' is not one (${FACILITY_IDS.join(', ')})`); process.exit(1); }

if (o.has('--plan')) {
  const svgDir = o.opt('--svg');
  let ok = true;
  for (const id of ids) {
    const F = FACILITIES[id], P = planOf({ facility: id }), bare = planOf({ use: F.use, look: F.look, fight: F.fight });
    console.log(`\n${id}: ${F.reads}`);
    for (const [room, L] of Object.entries(P.compose?.layouts ?? {})) console.log(`  ${room.padEnd(16)} ${L.layout.padEnd(10)} ${String(L.pieces).padStart(3)} pieces${L.stocked ? ' (could not hold it: stocked)' : ''} · ${L.laws.map((l) => `${l.holds ? '' : 'BREAKS '}${l.law}`).join(', ')}`);
    const H = hallOf(P);
    if ((H.x1 - H.x0) * (H.y1 - H.y0) < 150) { console.log(`  no hall: its rooms are its ground (the biggest, ${H.id}, is a room)`); if (svgDir) { fs.mkdirSync(svgDir, { recursive: true }); fs.writeFileSync(path.join(svgDir, `${id}.svg`), svgOf(id, P, null)); } continue; }
    const laid = crossing(P, H), plain = crossing(bare, hallOf(bare));
    const holds = !!laid.R.sneak;
    ok &&= holds;
    console.log(`  the ${H.id}, crossed ${laid.a} → ${laid.b} under a watcher walking it: laid, the straight way ${!laid.R.direct ? 'none' : laid.R.direct.seen ? `seen after ${laid.R.direct.seen.t} s` : 'unseen'}, a way unseen ${say(laid.R.sneak)}; bare, ${!plain.R.direct ? 'no way' : plain.R.direct.seen ? `seen after ${plain.R.direct.seen.t} s` : 'unseen'}, a way unseen ${say(plain.R.sneak)}`);
    if (svgDir) { fs.mkdirSync(svgDir, { recursive: true }); fs.writeFileSync(path.join(svgDir, `${id}.svg`), svgOf(id, P, laid)); }
  }
  process.exit(ok ? 0 : 2);
}

// THE PAGE: the operative at the way in, a guard walking the hall, the facility as built
const id = ids[0], out = path.resolve(o.opt('--out', 'facility')), F = FACILITIES[id];
const stage = buildingStage({ facility: id, seed: 1 }), P = planOf({ facility: id }), H = hallOf(P), cross = crossing(P, H);
const { room, hero: h0, guard: g0 } = await starterRoom(o);
const lobby = P.rooms.find((r) => r.id === 'lobby'), way = (P.ways ?? []).find((w) => w.room === 'lobby'), start = [r2((way.lo + way.hi) / 2), r2(lobby.y0 + 1.5), 0];
const w = cross.watcher, heading = Math.atan2(w.to[1] - w.at[1], w.to[0] - w.at[0]);
const guard = { ...g0, id: 'hall-guard', rule: { ...g0.rule, speed: w.speed, sightCone: w.cone, sightRange: w.range, near: w.near, foe: { ...g0.rule.foe, stretch: r2(Math.hypot(w.to[0] - w.at[0], w.to[1] - w.at[1])), ends: [[...w.at, 0], [...w.to, 0]], patrol: { ...(g0.rule.foe?.patrol ?? {}), look: w.look } } }, transform: { pos: [w.at[0], w.at[1], 0.05], heading } };
const mission = { objectives: [{ id: 'cross', says: `cross the ${H.id} unseen`, done: 'cross' }], result: { at: [...cross.b, 0], radius: 2 }, hints: [{ at: start, radius: 3, says: `${F.reads}. ${F.moves}.` }] };
const entities = [{ ...h0, rule: { ...h0.rule, step: 0.35, mission }, transform: { pos: [start[0], start[1], 0.05], heading: Math.PI / 2 } }, guard];
const manifest = { ...stage, figures: room.manifest.figures, entities, fxStyle: room.manifest.fxStyle, figureGrade: room.manifest.figureGrade };
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { payload } = await resolveWorldScene({ ref: `steel-serpents-facility-${id}`, title: `${id} · Steel Serpents`, manifest }, { era: 'gen-7', live: true });
const page = await writePage(payload, room, path.join(out, `${id}.html`), { capture: o.has('--capture'), cdn: o.has('--cdn') });
console.log(`facilities: ${page.file} (${page.mb} MB) · ${F.use} in ${F.look.construction} · hall ${H.id} · colliders ${payload.colliders.length}`);
process.exit(0);

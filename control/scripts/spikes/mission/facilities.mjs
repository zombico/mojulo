#!/usr/bin/env node
/**
 * FACILITIES, PROVED AND PLAYED — each facility (era/facilities.js: a use, its plan's fighting dials, its rooms' floors
 * laid in figures by era/room-layouts.js, its look) laid as a building level, its rooms held to their layouts' laws
 * (compose-dress.js layoutReport), and its main hall crossed by the route search under a watcher walking it, beside the
 * same building bare (its use, look and dials, no layouts): what the layouts buy a sneaking body, measured.
 *
 *   cd control
 *   node scripts/spikes/mission/facilities.mjs --plan [--facility <id>] [--svg /abs/dir]
 *   node scripts/spikes/mission/facilities.mjs --out /abs/dir --facility <id> [--seen] [--hero <ref>] [--guard <ref>] [--cdn] [--capture]
 *
 * The page is a designer's walk: the operative starts INVISIBLE (worlds/controllable/ghost.js: no guard sees it; I
 * toggles it, `--seen` starts seen), a guard walks the hall and one each ground corridor, looking round at their ends.
 *
 * `--svg` draws each one's ground storey from above as the game book's facility maps do (gameworld/facility-maps.js),
 * the hall's way across unseen (white, dashed) and the watcher's walk (red) over it.
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
const { facilityMapSvg } = await import('../../../lib/graph/gameworld/facility-maps.js');
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
// a room's pieces as boxes (their stacked heights), and a watcher's walk down its long axis on the clear line nearest its
// middle (a line no piece stands on, a body's width either side), two metres in from each end, looking round at each
// (a see-through piece, mesh, stands in the way and stops no gaze: `sight: false`, the route search's own word)
const boxesIn = (P, r) => (P.props ?? []).filter((it) => it.room === r.id && PIECES[it.kind]?.solid !== false && !it.wall).map((it) => { const f = footprintOf(it); return { min: [f.min[0], f.min[1], 0], max: [f.max[0], f.max[1], PIECES[it.kind].h * (it.scale ?? 1) * ((it.level ?? 0) + 1)], ...(PIECES[it.kind].see ? { sight: false } : {}) }; });
function patrolOf(r, boxes, { id, speed = 1, range = 14, inset = 2 } = {}) {
  const alongX = r.x1 - r.x0 >= r.y1 - r.y0, lo = (alongX ? r.x0 : r.y0) + inset, hi = (alongX ? r.x1 : r.y1) - inset;
  const mid = alongX ? (r.y0 + r.y1) / 2 : (r.x0 + r.x1) / 2, k = alongX ? 1 : 0;
  const clearLine = (v) => !boxes.some((B) => B.min[k] - 0.6 < v && B.max[k] + 0.6 > v && B.max[1 - k] > lo && B.min[1 - k] < hi);
  // (inside the room only: a body's width off its walls)
  const half = (alongX ? r.y1 - r.y0 : r.x1 - r.x0) / 2 - 0.7;
  let c = null;
  for (let d = 0; d <= half; d += 0.25) { if (clearLine(mid + d)) { c = mid + d; break; } if (clearLine(mid - d)) { c = mid - d; break; } }
  let a = hi, b = lo;
  if (c === null) {
    // (no line runs its length clear, a chicane's corridor: of every line across it, the longest clear stretch, walked
    // end to end; along one wall only that wall's blocks cut it)
    const stretch = (v) => {
      const cuts = boxes.filter((B) => B.min[k] - 0.6 < v && B.max[k] + 0.6 > v).map((B) => [B.min[1 - k] - 0.8, B.max[1 - k] + 0.8]).sort((p, q) => p[0] - q[0]);
      let best = [lo, lo], at = lo;
      for (const [u0, u1] of [...cuts, [hi, hi]]) { const e = Math.min(u0, hi); if (e - at > best[1] - best[0]) best = [at, e]; at = Math.max(at, u1); }
      return best;
    };
    let top = { len: -1 };
    for (let v = mid - half; v <= mid + half + 1e-9; v += 0.25) { const S = stretch(v); if (S[1] - S[0] > top.len + 1e-9) top = { len: S[1] - S[0], v, S }; }
    c = top.v;
    [b, a] = top.len >= 1 ? top.S : [lo, lo + 1];
  }
  const pt = (u) => (alongX ? [u, c] : [c, u]);
  return { id, at: pt(a), to: pt(b), speed, cone: 0.8, range, eye: 1.35, hear: 6, look: { secs: 4 }, near: { r: 2, back: 100 } };
}
function crossing(P, r) {
  const D = doorsOf(P, r), a = D[0], far = (q) => Math.hypot(q[0] - a[0], q[1] - a[1]);
  const b = D.length > 1 ? D.reduce((p, q) => (far(q) > far(p) ? q : p)) : [r.x0 + r.x1 - a[0], r.y0 + r.y1 - a[1]].map((v, k) => Math.min((k ? r.y1 : r.x1) - 0.8, Math.max((k ? r.y0 : r.x0) + 0.8, v)));
  const boxes = boxesIn(P, r);
  const watcher = patrolOf(r, boxes, { id: 'hall', speed: 1, range: 16 });
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

// (drawn as the game book draws it, gameworld/facility-maps.js: its way across unseen dashed, the watcher's walk red)
const svgOf = (id, P, cross) => facilityMapSvg(P, { storey: 0, title: `${id}: a ${FACILITIES[id].use} in ${FACILITIES[id].look.construction} · ${FACILITIES[id].look.palette}`, ...(cross?.R.sneak?.path ? { path: cross.R.sneak.path.map((p) => p.at) } : {}), ...(cross ? { patrol: [cross.watcher.at, cross.watcher.to] } : {}) });

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
// the guards: one walking the hall, one walking each corridor of the ground storey, each looking round at its ends
const ground = Math.min(...P.rooms.map((r) => r.storey ?? 0));
const corridors = P.rooms.filter((r) => (r.storey ?? 0) === ground && /^corridor/.test(r.id));
const rounds = [cross.watcher, ...corridors.map((r) => patrolOf(r, boxesIn(P, r), { id: `${r.id}-sentry`, speed: 1.1, range: 14, inset: 1.2 }))];
const guardOf = (w) => ({ ...g0, id: w.id === 'hall' ? 'hall-guard' : w.id, rule: { ...g0.rule, speed: w.speed, sightCone: w.cone, sightRange: w.range, near: w.near, foe: { ...g0.rule.foe, stretch: r2(Math.hypot(w.to[0] - w.at[0], w.to[1] - w.at[1])), ends: [[...w.at, 0], [...w.to, 0]], patrol: { ...(g0.rule.foe?.patrol ?? {}), look: w.look } } }, transform: { pos: [w.at[0], w.at[1], 0.05], heading: Math.atan2(w.to[1] - w.at[1], w.to[0] - w.at[0]) } });
// (the hall's far doorway the end: nothing to hold on the way, mission.js `result.when` empty)
// (invisible mode, worlds/controllable/ghost.js: the walk starts unseen, I to be seen; `--seen` starts seen)
const ghost = { on: !o.has('--seen') };
const mission = { result: { at: [...cross.b, 0], radius: 2, when: [] }, hints: [{ at: start, radius: 3, says: `${F.reads}. ${F.moves}. I: walk unseen or be seen.` }] };
const entities = [{ ...h0, rule: { ...h0.rule, step: 0.35, mission, ghost }, transform: { pos: [start[0], start[1], 0.05], heading: Math.PI / 2 } }, ...rounds.map(guardOf)];
const manifest = { ...stage, figures: room.manifest.figures, entities, fxStyle: room.manifest.fxStyle, figureGrade: room.manifest.figureGrade };
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { payload } = await resolveWorldScene({ ref: `steel-serpents-facility-${id}`, title: `${id} · Steel Serpents`, manifest }, { era: 'gen-7', live: true });
const page = await writePage(payload, room, path.join(out, `${id}.html`), { capture: o.has('--capture'), cdn: o.has('--cdn') });
console.log(`facilities: ${page.file} (${page.mb} MB) · ${F.use} in ${F.look.construction} · hall ${H.id} · guards ${rounds.map((w) => w.id).join(', ')} · ${ghost.on ? 'unseen (I to be seen)' : 'seen (I to walk unseen)'} · colliders ${payload.colliders.length}`);
process.exit(0);

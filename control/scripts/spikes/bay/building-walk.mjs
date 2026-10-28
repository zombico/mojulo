// A BUILDING WALKED (era/program-core.js on a bay kit): the page's own walk (channels/walk.js: a ray down from the eye
// finds the floor, rays at the eye and at the shin stop a step, the body's radius kept off what they hit), run in node
// on three's raycaster over the assembled storeys, steered from the way in through each doorway on the plan's links
// and up each stair from its approach to its arrival (then round its railed hole, as a walker goes), to the deepest room of every storey. The machine gate for a
// building's plan: every storey's farthest room is reached on foot, standing on that storey's floor.
//
//   node scripts/spikes/bay/building-walk.mjs [--use office] [--program '{"storeys":3}']
import { register } from 'node:module';
import path from 'node:path';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const THREE = await import(path.resolve('public/vendor/three/three.module.min.js'));
const { planStage, assembleStageScene } = await import('@/lib/graph/era/stage');
const { withProgram } = await import('@/lib/graph/era/programs');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const use = arg('--use', 'office'), extra = JSON.parse(arg('--program', '{}'));
const manifest = { kind: 'stage', program: { use, ...extra } };
const m = withProgram(manifest), plan = planStage(m), scene = assembleStageScene(manifest, {});
const pos = [];
for (const f of scene.faces) for (let i = 1; i + 1 < f.corners.length; i++) for (const c of [f.corners[0], f.corners[i], f.corners[i + 1]]) pos.push(...c);
const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeBoundingSphere();
const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); mesh.updateMatrixWorld();
const EYE = 1.7, RADIUS = 0.4, SPEED = 5, DT = 1 / 30, ray = new THREE.Raycaster();
const ground = (x, y, z) => { ray.set(new THREE.Vector3(x, y, z), new THREE.Vector3(0, 0, -1)); const h = ray.intersectObject(mesh, false)[0]; return h ? h.point.z : null; };
const z0Of = new Map(plan.rooms.map((r) => [r.id, plan.storeys ? plan.storeys[r.storey ?? 0].z0 : 0]));
const room = new Map(plan.rooms.map((r) => [r.id, r]));

// the walker, as the page walks, steered at a waypoint until it is within reach of it (or out of time)
const p = new THREE.Vector3();
let vz = 0;
const at = (r) => [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2];
{ const e = room.get(m._program.entry), [x, y] = [(e.x0 + e.x1) / 2, e.y0 + 1.2]; p.set(x, y, (ground(x, y, EYE + 0.5) ?? 0) + EYE); }
function steer([tx, ty], seconds = 12) {
  for (let t = 0; t < seconds; t += DT) {
    const dx = tx - p.x, dy = ty - p.y, dist = Math.hypot(dx, dy);
    if (dist < 0.35) return true;
    for (const [ax, ay] of [[dx / dist, 0], [0, dy / dist]]) {
      const len = Math.min(dist, Math.hypot(ax, ay) * SPEED * DT); if (len < 1e-9) continue;
      const u = new THREE.Vector3(ax, ay, 0).normalize();
      let allow = len;
      for (const zo of [0, -EYE * 0.6]) { ray.set(new THREE.Vector3(p.x, p.y, p.z + zo), u); const h = ray.intersectObject(mesh, false)[0]; if (h) allow = Math.min(allow, Math.max(0, h.distance - RADIUS)); }
      p.x += u.x * allow; p.y += u.y * allow;
    }
    vz -= 22 * DT; p.z += vz * DT;
    const gz = ground(p.x, p.y, p.z);
    if (gz != null && p.z <= gz + EYE) { p.z = gz + EYE; vz = 0; }
  }
  return false;
}
// the plan's graph: a doorway's middle a step into each side; a stair from its approach to its arrival
const edges = new Map(plan.rooms.map((r) => [r.id, []]));
for (const l of plan.links) {
  const mid = (l.lo + l.hi) / 2, X = l.wall.endsWith('x'), s = l.wall.startsWith('+') ? 1 : -1;
  const a = X ? [l.at - s * 0.7, mid] : [mid, l.at - s * 0.7], b = X ? [l.at + s * 0.7, mid] : [mid, l.at + s * 0.7];
  edges.get(l.from).push({ to: l.to, via: [a, b] }); edges.get(l.to).push({ to: l.from, via: [b, a] });
}
// (up a stair, then off its head and round its railed hole on the side with room, as a walker does, to the hole's foot)
for (const st of plan.stairs || []) {
  const U = room.get(st.upper), [x0, y0, x1, y1] = st.rect, Y = st.axis === 'y', d = st.dir, arr = [st.arrival[0], st.arrival[1]];
  const beyond = Y ? [arr[0], arr[1] + d * 1.0] : [arr[0] + d * 1.0, arr[1]];
  const lo = Y ? x0 - U.x0 : y0 - U.y0, hi = Y ? U.x1 - x1 : U.y1 - y1, side = hi > lo ? (Y ? x1 : y1) + 0.8 : (Y ? x0 : y0) - 0.8;
  const foot = d > 0 ? (Y ? y0 : x0) - 0.8 : (Y ? y1 : x1) + 0.8;
  const round = Y ? [[side, beyond[1]], [side, foot]] : [[beyond[0], side], [foot, side]];
  edges.get(st.lower).push({ to: st.upper, via: [[st.approach[0], st.approach[1]], arr, beyond, ...round] });
}
const prev = new Map([[m._program.entry, null]]), q = [m._program.entry];
while (q.length) { const id = q.shift(); for (const e of edges.get(id)) if (!prev.has(e.to)) { prev.set(e.to, { from: id, via: e.via }); q.push(e.to); } }
const depthOf = (id) => { let n = 0; for (let c = prev.get(id); c; c = prev.get(c.from)) n++; return n; };
const storeys = [...new Set(plan.rooms.map((r) => r.storey ?? 0))].sort();
const checks = [];
for (const s of storeys) {
  const target = plan.rooms.filter((r) => (r.storey ?? 0) === s && prev.has(r.id)).sort((a, b) => depthOf(b.id) - depthOf(a.id) || (a.id < b.id ? -1 : 1))[0];
  // the route from where the walker stands: back to the entry's room is not needed; walk the target's route from the way in
  const route = []; for (let c = target.id; prev.get(c); c = prev.get(c).from) route.unshift(prev.get(c).via);
  { const e = room.get(m._program.entry), [x, y] = [(e.x0 + e.x1) / 2, e.y0 + 1.2]; p.set(x, y, (ground(x, y, EYE + 0.5) ?? 0) + EYE); vz = 0; }
  let ok = true;
  for (const via of route) {
    const r = via.every((w) => steer(w));
    if (process.argv.includes('--trace')) console.log('   ', JSON.stringify(via), r, [p.x, p.y, p.z - EYE].map((v) => v.toFixed(2)).join(','));
    if (!r) { ok = false; break; }
  }
  ok = ok && steer(at(target));
  const inside = p.x > target.x0 && p.x < target.x1 && p.y > target.y0 && p.y < target.y1, feet = +(p.z - EYE).toFixed(2), on = Math.abs(feet - z0Of.get(target.id)) < 0.1;
  checks.push(ok && inside && on);
  console.log(`${ok && inside && on ? 'ok ' : 'NO '} storey ${s}: the ${target.id}, ${route.length} doorways and stairs from the way in: at ${[p.x, p.y].map((v) => v.toFixed(1))}, feet ${feet} (its floor ${z0Of.get(target.id)})`);
}
console.log(checks.every(Boolean) ? `every storey of the ${use} walks` : `a storey of the ${use} did not walk`);
process.exit(checks.every(Boolean) ? 0 : 1);

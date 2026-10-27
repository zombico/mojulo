// THE WALKWAYS WALKED (era/bay.js): a bay's catwalk, its stairs and its railings put to the World page's own walk
// (channels/walk.js: a ray down from the eye finds the floor, rays at the eye and at the shin stop a step, the body's
// radius kept off what they hit), run in node on three's raycaster over the stage's faces. The machine gate for the
// walkway's rules: up the near stair onto the deck; along the deck to its far end; stopped by the front railing, by the
// far end's railing and by the stair's skirt from the floor; up the second stair through its gap.
//
//   node scripts/spikes/bay/walkways.mjs [--kit bay-military]
import { register } from 'node:module';
import path from 'node:path';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const THREE = await import(path.resolve('public/vendor/three/three.module.min.js'));
const { planStage, buildStageGeometry } = await import('@/lib/graph/era/stage');
const { wallFrameOf } = await import('@/lib/graph/era/lab');
const { onWall } = await import('@/lib/graph/era/geom');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const kit = arg('--kit', 'bay-military');
const SUITE = { kind: 'stage', kit, rooms: [{ id: 'corridor', x: 0, y: 0, w: 6, d: 12, h: 3.5 }, { id: 'bay', x: -6, y: 12, w: 18, d: 30, h: 12 }], links: [{ from: 'corridor', to: 'bay' }] };
const plan = planStage(SUITE), geom = buildStageGeometry(plan);
// every face as triangles in one double-sided mesh (the page's walk hits both sides of its fills)
const pos = [];
for (const f of geom.faces) for (let i = 1; i + 1 < f.corners.length; i++) for (const c of [f.corners[0], f.corners[i], f.corners[i + 1]]) pos.push(...c);
const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeBoundingSphere();
const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
mesh.updateMatrixWorld();
const EYE = 1.7, RADIUS = 0.4, SPEED = 7, DT = 1 / 60, ray = new THREE.Raycaster();
const ground = (x, y, z) => { ray.set(new THREE.Vector3(x, y, z), new THREE.Vector3(0, 0, -1)); const h = ray.intersectObject(mesh, false)[0]; return h ? h.point.z : null; };
// one walker, as the page walks: slide on each axis held off what the eye's and the shin's rays hit, then the floor
function walk(start, dir, seconds) {
  const p = new THREE.Vector3(start[0], start[1], (ground(start[0], start[1], start[2] + EYE) ?? 0) + EYE);
  let vz = 0;
  const d = new THREE.Vector3(dir[0], dir[1], 0).normalize();
  for (let t = 0; t < seconds; t += DT) {
    for (const [ax, ay] of [[d.x, 0], [0, d.y]]) {
      const len = Math.hypot(ax, ay) * SPEED * DT; if (len < 1e-9) continue;
      const u = new THREE.Vector3(ax, ay, 0).normalize();
      let allow = len;
      for (const zo of [0, -EYE * 0.6]) { ray.set(new THREE.Vector3(p.x, p.y, p.z + zo), u); const h = ray.intersectObject(mesh, false)[0]; if (h) allow = Math.min(allow, Math.max(0, h.distance - RADIUS)); }
      p.x += u.x * allow; p.y += u.y * allow;
    }
    vz -= 22 * DT; p.z += vz * DT;
    const gz = ground(p.x, p.y, p.z);
    if (gz != null && p.z <= gz + EYE) { p.z = gz + EYE; vz = 0; }
  }
  return { at: [p.x, p.y].map((v) => +v.toFixed(2)), feet: +(p.z - EYE).toFixed(2) };
}
const R = geom.bayRooms.find((b) => b.walkways.length), W = R.walkways[0], F = wallFrameOf(R.r, W.side), o = 0.42 + 0.7, cz = W.z;
const P = (u, off, z = 0) => onWall(F, u, off, z), U = [F.U[0], F.U[1]], N = [F.N[0], F.N[1]], neg = (v) => v.map((x) => -x);
const checks = [];
const check = (name, ok, got) => { checks.push({ name, ok }); console.log(`${ok ? 'ok ' : 'NO '} ${name}: ${JSON.stringify(got)}`); };
// up the near stair (from its foot, along the wall) and on along the deck
const up = walk(P(W.stairs[0][0] - 1.2, o), U, 4.5);
check('up the near stair onto the deck', Math.abs(up.feet - cz) < 0.05, up);
const along = walk(P(W.deck[0] + 1, o, cz), U, 6);
check('along the deck', Math.abs(along.feet - cz) < 0.05, along);
// on the deck, into the front railing: held on the deck
const front = walk(P((W.deck[0] + W.deck[1]) / 2, o, cz), N, 2);
check('the front railing blocks', Math.abs(front.feet - cz) < 0.05, front);
// on the deck, at its far end, on into the end railing
const far = walk(P(W.deck[1] - 2, o, cz), U, 2);
check('the far end railing blocks', Math.abs(far.feet - cz) < 0.05, far);
// from the floor beside the near stair, walking in at its side: the skirt stops it, the feet stay on the floor
const skirt = walk(P((W.stairs[0][0] + W.stairs[0][1]) / 2, o + 2.5), neg(N), 2);
check('the stair\'s skirt blocks from the floor', skirt.feet < 0.05 && Math.abs(skirt.at[0] - P(0, o + 2.5)[0]) + Math.abs(skirt.at[1] - P(0, o + 2.5)[1]) > 0, skirt);
// up the second stair, through its gap, onto the deck
if (W.stairs[1]) {
  const [ga, gb] = W.stairs[1], sLen = Math.ceil(cz / 0.19) * 0.27;
  const second = walk(P((ga + gb) / 2, 0.42 + 1.4 + sLen + 1.5), neg(N), 4);
  check('up the second stair through its gap', Math.abs(second.feet - cz) < 0.05, second);
}
console.log(checks.every((c) => c.ok) ? 'every walkway rule walks' : 'a walkway rule failed');
process.exit(checks.every((c) => c.ok) ? 0 : 1);

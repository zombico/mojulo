// In-page script: the RUNNER's view (worlds/controllable/runner.js), the controllable channel's for a world with a
// runner. The world comes at the pilot, so it is drawn round it: the runway (its lanes, its edges, posts along it) as
// tiles recycled ahead, and the rows the runner lays (blocks, hurdles, bars, coins) as meshes made when a row is laid
// and dropped when it falls behind. Flat-shaded boxes in a palette (`runner.palette`: ground, lane, edge, block,
// hurdle, bar, coin, post), lit by their own face colours, so the view needs no light of the world's. The pilot's body
// crouches while it slides.

const PALETTE = { ground: '#3b4254', lane: '#e8e4d8', edge: '#f2b84b', block: '#c9473d', hurdle: '#f0c040', bar: '#4aa3df', coin: '#ffd23f', post: '#7a8296' };

/** The view's script for a runner spec (its palette over the defaults). Reads `__world`, `__bodies`, `scene`, `THREE`. */
export function runnerViewScript(spec = {}) {
  const P = { ...PALETTE, ...(spec.palette && typeof spec.palette === 'object' ? spec.palette : {}) };
  for (const k of Object.keys(P)) if (!/^#[0-9a-fA-F]{6}$/.test(String(P[k]))) P[k] = PALETTE[k] || '#888888';
  // every other tile a shade darker, so the run's speed reads on the ground
  P.ground2 = '#' + [1, 3, 5].map((i) => Math.round(parseInt(P.ground.slice(i, i + 2), 16) * 0.88).toString(16).padStart(2, '0')).join('');
  return `// ---- THE RUNNER's view (channels/controllable/runner-view.js): the runway and its rows, drawn round the pilot ----
const __RUN = __world.runner;
const __RP = ${JSON.stringify(P)};
// a box shaded by its faces: the top lit, the sides a step darker, the front darker still (no light of the world's)
function __runBox(w, l, h, hex) {
  const g = new THREE.BoxGeometry(l, w, h), c = new THREE.Color(hex), col = [];
  const shade = [0.78, 0.78, 0.62, 0.62, 1, 0.45];   // +x -x +y -y +z -z
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) col.push(c.r * shade[f], c.g * shade[f], c.b * shade[f]);
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true }));
  m.rotation.z = __RUN ? __RUN.heading : 0;
  scene.add(m);
  return m;
}
const __runAt = (m, s, lat, z) => { m.position.set(__RUN.origin[0] + __RUN.f[0] * s + __RUN.r[0] * lat, __RUN.origin[1] + __RUN.f[1] * s + __RUN.r[1] * lat, __RUN.z0 + z); };
const __RUN_TILE = 20, __RUN_TILES = 9;
const __runW = __RUN ? __RUN.spec.lanes * __RUN.spec.laneW : 0;
const __runTiles = [];
if (__RUN) for (let k = 0; k < __RUN_TILES; k++) {
  const t = { ground: __runBox(__runW + 1.6, __RUN_TILE - 0.08, 0.2, k % 2 ? __RP.ground : __RP.ground2), lines: [], edges: [], posts: [] };
  for (let i = 1; i < __RUN.spec.lanes; i++) t.lines.push(__runBox(0.12, __RUN_TILE * 0.45, 0.02, __RP.lane));
  for (const side of [-1, 1]) { t.edges.push(__runBox(0.35, __RUN_TILE, 0.18, __RP.edge)); t.posts.push(__runBox(0.4, 0.4, 2.6, __RP.post)); }
  __runTiles.push(t);
}
const __runItems = {};
const __RUN_LOOK = { block: [1.4, 2.6, 'block'], hurdle: [0.5, 0.75, 'hurdle'], bar: [0.4, 0.45, 'bar'] };
function __runMake(it) {
  if (it.kind === 'coin') {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.13, 8, 18), new THREE.MeshBasicMaterial({ color: __RP.coin }));
    scene.add(m); return m;
  }
  const [l, h, k] = __RUN_LOOK[it.kind], w = it.lane < 0 ? __runW : __RUN.spec.laneW * 0.86;
  return __runBox(w, l, h, __RP[k]);
}
function __updateRunner(dt) {
  const R = __world.runner;
  if (!R) return;
  // the runway: tiles from a little behind to far ahead, each recycled forward as the run passes it
  const base = Math.floor(R.s / __RUN_TILE) * __RUN_TILE - __RUN_TILE;
  __runTiles.forEach((t, k) => {
    const s = base + k * __RUN_TILE + __RUN_TILE / 2;
    __runAt(t.ground, s, 0, -0.1);
    t.lines.forEach((m, i) => __runAt(m, s, (i + 1 - R.spec.lanes / 2) * R.spec.laneW, 0.01));
    t.edges.forEach((m, i) => __runAt(m, s, (i ? 1 : -1) * (__runW / 2 + 0.6), 0.09));
    t.posts.forEach((m, i) => __runAt(m, s - __RUN_TILE / 2, (i ? 1 : -1) * (__runW / 2 + 1.6), 1.3));
  });
  // the rows: made as they are laid, gone as they fall behind (a coin taken goes at once)
  const live = {};
  for (const it of R.items) {
    if (it.gone) continue;
    live[it.id] = true;
    let m = __runItems[it.id];
    if (!m) m = __runItems[it.id] = __runMake(it);
    const lat = it.lane < 0 ? 0 : (it.lane - R.mid) * R.spec.laneW;
    if (it.kind === 'coin') { __runAt(m, it.s, lat, 1); m.rotation.set(Math.PI / 2, 0, R.heading + __world.time * 4); }
    else if (it.kind === 'bar') __runAt(m, it.s, lat, 1.05 + 0.6);
    else __runAt(m, it.s, lat, __RUN_LOOK[it.kind][1] / 2);
  }
  for (const id of Object.keys(__runItems)) if (!live[id]) { const m = __runItems[id]; scene.remove(m); m.geometry.dispose(); m.material.dispose(); delete __runItems[id]; }
  // the slide: the pilot's body crouches, eased
  const body = __bodies[__world.pilotId];
  if (body) { const want = __world.byId[__world.pilotId].sliding ? 0.5 : 1; body.scale.z += (want - body.scale.z) * Math.min(1, dt * 18); }
}
`;
}

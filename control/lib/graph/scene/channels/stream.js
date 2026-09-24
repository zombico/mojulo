import { safeJson } from '../emit-util.js';

// World STREAMING (opt-in via emitThreeWorld({ stream }) — the fractal city's large-city page). The
// page inlines only a cheap horizon: the base (grounds + roads) and the whole city at massing, each
// tile's massing in its own render group `massing:i,j`. This block fetches FULL-detail tiles from
// the tile route (lib/graph/city/city-tiles.js packs them: u32 'MJT1' · u32 H · H bytes JSON ·
// Float32 data) nearest-first around the camera focus with capped concurrency, keeps them out to
// `cache` (an LRU capped at `max` tiles), and disposes their GPU buffers beyond. A landed tile hides
// its massing group by moving it to layer 1 (neither drawn nor raycast, and the wireframe toggle's
// visible flag cannot bring it back); an evicted tile shows it again. Tile meshes join `solids`
// (pick, wireframe) and the walk colliders when a walk channel is emitted (typeof-guarded).
// Bespoke block spliced after the runtime channels; absent `stream` ⇒ NOT emitted, so every
// existing World stays byte-identical (emit char pins).
// `cfg`: { url, grid: { x0, y0, tile, cols, rows }, tiles: ['i,j', …], near, cache, max, conc }.
export function streamChannelScript(cfg) {
  return `
// --- world streaming (opt-in): full-detail tiles near the camera over an inlined massing horizon ---
const STREAM = ${safeJson(cfg)};
const __stTiles = new Map();   // id → { state: 'loading'|'ready'|'failed', meshes, wires, used }
const __stTex = {};            // texture key → THREE.Texture, shared across tiles
const __stStat = { fetched: 0, bytes: 0, evicted: 0, failed: 0 };
let __stInflight = 0;
window.__mojStream = { tiles: __stTiles, stat: __stStat, cfg: STREAM };
function __stCenter(id){ const k = id.indexOf(','), g = STREAM.grid; return [g.x0 + (+id.slice(0, k) + 0.5) * g.tile, g.y0 + (+id.slice(k + 1) + 0.5) * g.tile]; }
// the focus the tiles gather around: the eye when walking / flying / in a headset, else the orbit target
function __stFocus(){ return (walkOn || (typeof __xrOn !== 'undefined' && __xrOn)) ? camera.position : controls.target; }
function __stMassing(id, show){ const m = meshes['massing:' + id]; if (m) m.layers.set(show ? 0 : 1); }
function __stAdd(rec, id, geo, mat, order){
  geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, mat); m.renderOrder = order; m.userData.g = 'tile:' + id;
  m.visible = !wireframeOn;
  scene.add(m); solids.push(m); rec.meshes.push(m);
  if (typeof walkColliders !== 'undefined') walkColliders.push(m);
  if (wiresBuilt) {
    const w = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 1), new THREE.LineBasicMaterial({ color: 0xa9c7ee }));
    w.renderOrder = 2; w.visible = wireframeOn; scene.add(w); wires.push(w); rec.wires.push(w);
  }
}
async function __stLoad(id){
  const rec = { state: 'loading', meshes: [], wires: [], used: performance.now() };
  __stTiles.set(id, rec); __stInflight++;
  try {
    const res = await fetch(STREAM.url + '?t=' + id + '&lod=full', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const buf = await res.arrayBuffer();
    if (__stTiles.get(id) !== rec) return;   // evicted while in flight
    const dv = new DataView(buf);
    if (dv.getUint32(0, true) !== 0x31544a4d) throw new Error('not a tile');
    const H = dv.getUint32(4, true), D = 8 + H;
    const head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, H)));
    const f32 = (r) => new Float32Array(buf, D + r[0], r[1]);
    for (const p of head.parts) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(f32(p.pos), 3));
      if (!p.key) {
        geo.setAttribute('color', new THREE.BufferAttribute(f32(p.col), 3));
        __stAdd(rec, id, geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), 0);
        continue;
      }
      let tex = __stTex[p.key];
      if (!tex) {
        const url = (head.textures && head.textures[p.key]) || TEXTURES[p.key];
        if (!url) { geo.dispose(); continue; }
        tex = __stTex[p.key] = new THREE.TextureLoader().load(url);
        tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 8;
      }
      geo.setAttribute('uv', new THREE.BufferAttribute(f32(p.uv), 2));
      if (p.lit) geo.setAttribute('color', new THREE.BufferAttribute(f32(p.col), 3));
      __stAdd(rec, id, geo, new THREE.MeshBasicMaterial({ map: tex, vertexColors: !!p.lit, side: THREE.DoubleSide }), 0.6);
    }
    rec.state = 'ready';
    __stMassing(id, false);
    __stStat.fetched++; __stStat.bytes += buf.byteLength;
  } catch (err) {
    rec.state = 'failed'; __stStat.failed++;
    console.warn('[mojulo stream] tile ' + id + ' failed: ' + (err && err.message));
  } finally { __stInflight--; }
}
function __stDrop(id){
  const rec = __stTiles.get(id);
  if (!rec) return;
  __stTiles.delete(id);
  for (const m of rec.meshes) {
    scene.remove(m); m.geometry.dispose(); m.material.dispose();
    const k = solids.indexOf(m); if (k >= 0) solids.splice(k, 1);
    if (typeof walkColliders !== 'undefined') { const q = walkColliders.indexOf(m); if (q >= 0) walkColliders.splice(q, 1); }
  }
  for (const w of rec.wires) { scene.remove(w); w.geometry.dispose(); w.material.dispose(); const k = wires.indexOf(w); if (k >= 0) wires.splice(k, 1); }
  __stMassing(id, true);
  __stStat.evicted++;
}
function __stTick(){
  const f = __stFocus(), now = performance.now(), slack = STREAM.grid.tile * 0.7072, want = [];
  for (const id of STREAM.tiles) {
    const c = __stCenter(id), d = Math.max(0, Math.hypot(c[0] - f.x, c[1] - f.y) - slack);
    const rec = __stTiles.get(id);
    if (rec) { if (d > STREAM.cache) __stDrop(id); else if (d <= STREAM.near) rec.used = now; }
    else if (d <= STREAM.near) want.push([d, id]);
  }
  if (__stTiles.size > STREAM.max) {   // LRU inside the cache ring: least recently wanted goes first
    const idle = [...__stTiles].filter(([, r]) => r.state !== 'loading' && r.used !== now).sort((a, b) => a[1].used - b[1].used);
    for (let i = 0; i < idle.length && __stTiles.size > STREAM.max; i++) __stDrop(idle[i][0]);
  }
  want.sort((a, b) => a[0] - b[0]);
  for (const [, id] of want) { if (__stInflight >= STREAM.conc) break; __stLoad(id); }
}
setInterval(__stTick, 200);
__stTick();
`;
}

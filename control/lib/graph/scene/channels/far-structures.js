// In-page script (part of the form channel, channels/form-land.js): THE FAR STRUCTURES, what stands on a form page that
// is not the land or a plant (a town's buildings, its fences and poles, a car), on gameplay's camera past the view
// cone's reach (channels/view-cone.js). The page's painted groups are merged a mesh a group across the whole level, so
// one far building cannot be left out without its neighbours; here each is drawn instead as a BatchedMesh (one draw,
// as before) of TILES (FAR_STRUCTURES.tile m of the plan), each shown or left out on its own, and each tile has its
// CARD: itself from that side, solved from its own triangles, not rendered, baked once at load from `bearings` sides at
// `texels`, each texel its front-most triangle's colour (the light is baked into the painted groups' colours, so the
// card carries it), turned to the eye about the tile's foot and casting from the sun's side.
//
//   what stands   a triangle whose middle stands more than `ground` m over the land there (the form's own land, a
//                 heightfield of it at `cell` m) and less than `tall` m: the land, its roads, kerbs and pads stay live
//                 everywhere, and so does what is higher than anything that stands (the clouds)
//   the ladder    a tile is live while any of it is inside the cone's reach, or its card's texel (its width over
//                 `texels`) is over `px` pixels at its distance; past both, its card. The aerial camera draws all of it
//                 live, as before
//
// `window.__formStructures()` → { tiles, cards, batches } what is drawn now.
export const FAR_STRUCTURES = Object.freeze({ tile: 16, cell: 2, ground: 0.5, tall: 60, bearings: 8, texels: Object.freeze([64, 96]), px: 1, step: 0.5 });

/** The far structures' page source, after the form's land (its POS, the land's triangles) in the form channel's scope
 *  (THREE, scene, POS, __formMeshes). */
export function farStructuresScript() {
  return `
  // --- the far structures: what stands, in tiles, each its card past the view cone's reach (channels/far-structures.js) ---
  (function () {
    const FS = ${JSON.stringify(FAR_STRUCTURES)}, CO = window.__mojCone; if (!CO) return;
    // (the land's own height at a point: the highest of its triangles' corners in each cell of a coarse heightfield)
    let lx0 = Infinity, ly0 = Infinity, lx1 = -Infinity, ly1 = -Infinity;
    for (let i = 0; i < POS.length; i += 3) { lx0 = Math.min(lx0, POS[i]); lx1 = Math.max(lx1, POS[i]); ly0 = Math.min(ly0, POS[i + 1]); ly1 = Math.max(ly1, POS[i + 1]); }
    const hn = [Math.max(1, Math.ceil((lx1 - lx0) / FS.cell) + 1), Math.max(1, Math.ceil((ly1 - ly0) / FS.cell) + 1)], HF = new Float32Array(hn[0] * hn[1]).fill(-Infinity);
    for (let i = 0; i < POS.length; i += 3) { const k = Math.round((POS[i + 1] - ly0) / FS.cell) * hn[0] + Math.round((POS[i] - lx0) / FS.cell); HF[k] = Math.max(HF[k], POS[i + 2]); }
    const landAt = (x, y) => { const i = Math.round((x - lx0) / FS.cell), j = Math.round((y - ly0) / FS.cell); if (i < 0 || j < 0 || i >= hn[0] || j >= hn[1]) return -Infinity; for (let r = 0; r <= 2; r++) { let m = -Infinity; for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) { const ii = i + a, jj = j + b; if (ii >= 0 && jj >= 0 && ii < hn[0] && jj < hn[1]) m = Math.max(m, HF[jj * hn[0] + ii]); } if (m > -Infinity) return m; } return -Infinity; };
    // (the painted groups that stand: plain meshes of the page's groups, opaque and shown, not the form's own)
    const formOwn = new Set(__formMeshes), cands = [];
    scene.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && !o.isBatchedMesh && !o.geometry.isInstancedBufferGeometry && o.visible && o.userData.g !== undefined && !formOwn.has(o) && o.material && o.material.isMeshBasicMaterial && !o.material.transparent && !String(o.userData.g).startsWith('shell:')) cands.push(o); });
    const tileOf = (x, y) => Math.floor(x / FS.tile) + ',' + Math.floor(y / FS.tile), tiles = new Map(), batches = [], pairs = [];
    const tileRec = (k) => { let t = tiles.get(k); if (!t) { const [i, j] = k.split(',').map(Number); t = { i, j, tris: [], lo: Infinity, hi: -Infinity, x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, ids: [], card: false }; tiles.set(k, t); } return t; };
    for (const m of cands) {
      const g0 = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry, P = g0.getAttribute('position').array, C = g0.getAttribute('color'), n = P.length / 9;
      const keyOf = new Array(n); let any = false;
      for (let f = 0; f < n; f++) {
        const o = f * 9, cx = (P[o] + P[o + 3] + P[o + 6]) / 3, cy = (P[o + 1] + P[o + 4] + P[o + 7]) / 3, cz = (P[o + 2] + P[o + 5] + P[o + 8]) / 3, h = cz - landAt(cx, cy);
        if (!(h > FS.ground && h < FS.tall)) { keyOf[f] = null; continue; }
        const k = tileOf(cx, cy), t = tileRec(k); keyOf[f] = k; any = true;
        for (let v = 0; v < 3; v++) { const x = P[o + v * 3], y = P[o + v * 3 + 1], z = P[o + v * 3 + 2]; t.lo = Math.min(t.lo, z); t.hi = Math.max(t.hi, z); t.x0 = Math.min(t.x0, x); t.x1 = Math.max(t.x1, x); t.y0 = Math.min(t.y0, y); t.y1 = Math.max(t.y1, y); }
        const c = C ? [C.getX(o / 3), C.getY(o / 3), C.getZ(o / 3)] : [0.6, 0.6, 0.6];
        t.tris.push([P[o], P[o + 1], P[o + 2], P[o + 3], P[o + 4], P[o + 5], P[o + 6], P[o + 7], P[o + 8], c[0], c[1], c[2]]);
      }
      if (!any) continue;
      // (the mesh again as a batch: what does not stand one geometry always shown, each tile's its own)
      const parts = new Map(); for (let f = 0; f < n; f++) { const k = keyOf[f] || '-'; let L = parts.get(k); if (!L) parts.set(k, (L = [])); L.push(f); }
      const names = Object.keys(g0.attributes), geos = [];
      let nv = 0; for (const [k, L] of parts) { const g = new THREE.BufferGeometry(); for (const nm of names) { const A = g0.attributes[nm], w = A.itemSize, src = A.array, a = new src.constructor(L.length * 3 * w); L.forEach((f, q) => a.set(src.subarray(f * 3 * w, (f + 1) * 3 * w), q * 3 * w)); g.setAttribute(nm, new THREE.BufferAttribute(a, w, A.normalized)); } geos.push([k, g]); nv += L.length * 3; }
      const B = new THREE.BatchedMesh(geos.length, nv, 0, m.material);
      for (const [k, g] of geos) { const id = B.addInstance(B.addGeometry(g)); if (k !== '-') tiles.get(k).ids.push([B, id]); }
      B.castShadow = m.castShadow; B.receiveShadow = m.receiveShadow; B.renderOrder = m.renderOrder; B.userData = m.userData;
      m.visible = false; scene.add(B); batches.push(B); pairs.push([m, B, m.material]);
    }
    // (each tile's card: its triangles from each bearing, the front-most's colour a texel, baked once)
    const L = [...tiles.values()].filter((t) => t.tris.length), IB = FS.bearings, [IW, IH] = FS.texels;
    const atlas = new Uint8Array(Math.max(1, L.length) * IH * IB * IW * 4), depth = new Float32Array(IW * IH);
    L.forEach((t, row) => {
      const cx = (t.x0 + t.x1) / 2, cy = (t.y0 + t.y1) / 2, R = Math.max(0.5, Math.hypot(t.x1 - t.x0, t.y1 - t.y0) / 2), H = Math.max(0.5, t.hi - t.lo);
      Object.assign(t, { row, cx, cy, R, H, texel: (2 * R) / IW });
      for (let k = 0; k < IB; k++) {
        const th = (2 * Math.PI * k) / IB, rx = -Math.sin(th), ry = Math.cos(th), tx = Math.cos(th), ty = Math.sin(th);
        depth.fill(-Infinity);
        for (const T of t.tris) {
          const V = [0, 1, 2].map((v) => [((T[v * 3] - cx) * rx + (T[v * 3 + 1] - cy) * ry + R) / (2 * R) * IW, (T[v * 3 + 2] - t.lo) / H * IH, (T[v * 3] - cx) * tx + (T[v * 3 + 1] - cy) * ty]);
          const area = (V[1][0] - V[0][0]) * (V[2][1] - V[0][1]) - (V[2][0] - V[0][0]) * (V[1][1] - V[0][1]), f = (V[0][2] + V[1][2] + V[2][2]) / 3;
          for (let iv = Math.max(0, Math.floor(Math.min(V[0][1], V[1][1], V[2][1]) - 0.5)); iv <= Math.min(IH - 1, Math.floor(Math.max(V[0][1], V[1][1], V[2][1]) + 0.5)); iv++)
            for (let iu = Math.max(0, Math.floor(Math.min(V[0][0], V[1][0], V[2][0]) - 0.5)); iu <= Math.min(IW - 1, Math.floor(Math.max(V[0][0], V[1][0], V[2][0]) + 0.5)); iu++) {
              const px = iu + 0.5, py = iv + 0.5; let ok = true;
              for (let e = 0; e < 3 && ok; e++) { const a = V[e], b = V[(e + 1) % 3], ex = b[0] - a[0], ey = b[1] - a[1], el = Math.hypot(ex, ey) || 1e-6; if ((Math.sign(area || 1) * (ex * (py - a[1]) - ey * (px - a[0]))) / el < -0.5) ok = false; }
              const q = iv * IW + iu; if (!ok || f <= depth[q]) continue; depth[q] = f;
              const o = (((row * IH + iv) * IB + k) * IW + iu) * 4;
              atlas[o] = Math.round(Math.sqrt(Math.min(1, T[9])) * 255); atlas[o + 1] = Math.round(Math.sqrt(Math.min(1, T[10])) * 255); atlas[o + 2] = Math.round(Math.sqrt(Math.min(1, T[11])) * 255); atlas[o + 3] = 255;
            }
        }
      }
      t.tris = null;
    });
    const tex = new THREE.DataTexture(atlas, IB * IW, Math.max(1, L.length) * IH, THREE.RGBAFormat); tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.needsUpdate = true;
    const cg = new THREE.InstancedBufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 1, 0, 1, -1, 0, 1], 3)); cg.setIndex([0, 1, 2, 0, 2, 3]);
    const aT = new Float32Array(Math.max(1, L.length) * 4), aS = new Float32Array(Math.max(1, L.length) * 3);
    cg.setAttribute('aTile', new THREE.InstancedBufferAttribute(aT, 4).setUsage(THREE.DynamicDrawUsage)); cg.setAttribute('aSize', new THREE.InstancedBufferAttribute(aS, 3).setUsage(THREE.DynamicDrawUsage)); cg.instanceCount = 0;
    const U = { tCard: { value: tex }, uRows: { value: Math.max(1, L.length) } };
    const VH = 'attribute vec4 aTile;\\nattribute vec3 aSize;\\nuniform float uRows;\\nvarying vec2 vAt;\\n';
    const PLACE = ['vec2 to = cameraPosition.xy - aTile.xy; float Lt = length( to ); vec2 tw = Lt > 1e-4 ? to / Lt : vec2( 1.0, 0.0 ), rt = vec2( -tw.y, tw.x );',
      'float bk = mod( floor( atan( tw.y, tw.x ) / 6.2831853 * ' + FS.bearings.toFixed(1) + ' + 0.5 ), ' + FS.bearings.toFixed(1) + ' );',
      'vec3 transformed = vec3( aTile.xy + rt * position.x * aSize.x, aTile.z + position.z * aSize.y );',
      'vAt = vec2( ( bk + position.x * 0.5 + 0.5 ) / ' + FS.bearings.toFixed(1) + ', ( aSize.z + position.z ) / uRows );'].join('\\n');
    const cm = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    cm.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, U); sh.vertexShader = VH + sh.vertexShader.replace('#include <begin_vertex>', PLACE);
      sh.fragmentShader = 'uniform sampler2D tCard;\\nvarying vec2 vAt;\\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\\n  vec4 cA = texture2D( tCard, vAt ); if ( cA.a < 0.5 ) discard;\\n  diffuseColor.rgb *= cA.rgb * cA.rgb;'); };
    cm.customProgramCacheKey = () => 'far-structure-card';
    const cdm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    cdm.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, U); sh.vertexShader = VH + sh.vertexShader.replace('#include <begin_vertex>', PLACE);
      sh.fragmentShader = 'uniform sampler2D tCard;\\nvarying vec2 vAt;\\n' + sh.fragmentShader.replace('void main() {', 'void main() {\\n  if ( texture2D( tCard, vAt ).a < 0.5 ) discard;'); };
    cdm.customProgramCacheKey = () => 'far-structure-card-depth';
    const cards = new THREE.Mesh(cg, cm); cards.customDepthMaterial = cdm; cards.castShadow = cards.receiveShadow = true; cards.frustumCulled = false; cards.userData.ink = true; scene.add(cards);
    // (each frame, after the cone has its eye: the ladder again when the eye has moved, the reach or the mode changed)
    let at = null, nCards = 0;
    const ladder = (pov) => {
      nCards = 0;
      for (const t of L) {
        const d = Math.hypot(t.cx - CO.eye.x, t.cy - CO.eye.y) - t.R, card = pov && d > CO.reach && t.texel / (CO.px * Math.max(d, 0.1)) < FS.px;
        if (card !== t.card) { t.card = card; for (const [B, id] of t.ids) B.setVisibleAt(id, !card); }
        if (card) { aT.set([t.cx, t.cy, t.lo, 0], nCards * 4); aS.set([t.R, t.H, t.row], nCards * 3); nCards++; }
      }
      cg.instanceCount = nCards; cg.getAttribute('aTile').needsUpdate = cg.getAttribute('aSize').needsUpdate = true;
    };
    // (a pass that draws the scene in a material of its own, swapped onto each mesh (the creases' and the occlusion's
    // prepass: channels/creases.js), has no batched variant: for that render the merged mesh stands in, in the swapped
    // material, and the batch stands aside; both are put back after it. The cards sit out such passes: userData.ink)
    const swapped = [], prevA = scene.onAfterRender;
    scene.onAfterRender = function (r, s, cam, rt) {
      if (prevA) prevA.call(this, r, s, cam, rt);
      for (const [m, B, own] of swapped) { m.material = own; m.visible = false; B.visible = true; }
      swapped.length = 0;
    };
    const prev = scene.onBeforeRender;
    scene.onBeforeRender = function (r, s, cam, rt) {
      if (prev) prev.call(this, r, s, cam, rt);
      for (const P of pairs) if (P[1].material !== P[2] && P[1].visible) { P[0].material = P[1].material; P[0].visible = true; P[1].visible = false; swapped.push(P); }
      if (!cam.isPerspectiveCamera) return;
      const pov = CO.reach < 1e5 && (!window.__formFar || window.__formFar.pov()) && (!window.__formFarField || window.__formFarField.on);
      if (at && at.pov === pov && Math.abs(at.reach - CO.reach) < 0.5 && at.eye.distanceTo(CO.eye) < FS.step) return;
      at = { pov, reach: CO.reach, eye: CO.eye.clone() }; ladder(pov);
    };
    window.__formStructures = () => ({ tiles: L.length, cards: nCards, batches: batches.length });
  })();
`;
}

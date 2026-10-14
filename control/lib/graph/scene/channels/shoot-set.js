import { safeJson } from '../emit-util.js';

// In-page SHOOT SET channel: a shoot plan's set pieces (lib/graph/shoot/pieces.js), the walls, floors, ceilings, pipes
// and frames placed for the camera, and the ones its transitions expand into. Unlike the shoot channel's gizmos these
// are PICTURE: the channel is emitted on capture runs too, so a render carries them. Each piece is posed from the
// per-frame track the kernel sampled, at the world clock __mojStep runs on, and shows only while one of its shots
// plays (`__shSetShot`: the shoot channel sets it live, a capture frame's `spec.shot` sets it in a render), at that
// shot's own time (`__shSetT`, set by a live world's clock, where a cued shot's time runs from its event). A frame
// rebuilds its hole when its aperture moves. A PORTAL frame's hole is a window into another camera: each frame the
// scene is rendered into the hole's own target from that camera's place composed with where the viewer stands relative
// to the frame (so the view through it shifts as through a doorway), behind a clipping plane at the far camera, with
// every portal and gizmo hidden; the hole samples it in screen space, so at the instant the viewer reaches the frame
// it sees exactly the far camera's picture. Nothing here is a face, so no mesh export carries it. Assigns the
// module-scoped `stepShootSet`. Absent pieces ⇒ this block is not emitted.
export function shootSetScript(pieces) {
  return `
// --- shoot set (pieces placed for the camera; picture, so captures carry them) ---
{
  const SP = ${safeJson(pieces)};
  const __spCol = (h) => new THREE.Color(h);
  // a flat drawn in x-y (x across, y up) stood in the piece's frame: across → frame right (−y), up → z, facing along x
  const __spM = new THREE.Matrix4().set(0, 0, -1, 0, -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1);
  const __spFace = (g) => g.applyMatrix4(__spM);
  // a portal's hole: a disc or a rectangle the size its aperture opens to
  const __spHoleR = (p, open) => Math.max(1e-4, (Math.min(p.size[0], p.size[1]) / 2 - p.border) * open);
  const __spHoleGeo = (p, open) => (p.shape === 'square'
    ? __spFace(new THREE.PlaneGeometry(Math.max(1e-4, (p.size[0] - 2 * p.border) * open), Math.max(1e-4, (p.size[1] - 2 * p.border) * open)))
    : __spFace(new THREE.CircleGeometry(__spHoleR(p, open), 64)));
  const __spFrameGeo = (p, open) => {
    const w = p.size[0], h = p.size[1];
    if (p.portal && p.shape !== 'square') {   // a round portal's frame is only its rim, \`border\` wide round the hole
      const r = __spHoleR(p, open);
      return p.border > 0 ? __spFace(new THREE.RingGeometry(r, r + p.border, 64)) : new THREE.BufferGeometry();
    }
    if (p.shape === 'square') {
      const s = new THREE.Shape(); s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2); s.lineTo(-w / 2, -h / 2);
      const hw = Math.max(0, (w / 2 - p.border) * open), hh = Math.max(0, (h / 2 - p.border) * open);
      if (hw > 1e-4 && hh > 1e-4) { const o = new THREE.Path(); o.moveTo(-hw, -hh); o.lineTo(-hw, hh); o.lineTo(hw, hh); o.lineTo(hw, -hh); o.lineTo(-hw, -hh); s.holes.push(o); }
      return __spFace(new THREE.ShapeGeometry(s));
    }
    const outer = Math.hypot(w, h) * 0.6;
    return __spFace(new THREE.RingGeometry(Math.max(1e-4, outer * open * 0.999), outer, 64));
  };
  // a pipe: a straight tube along its x, or (\`path\`) a tube swept along a camera's path in world coordinates; its
  // rings alternate colour by distance along it
  const __spPipeGeo = (p) => {
    const segs = Math.max(1, p.rings * 2);
    let g, along;
    if (p.path) {
      const curve = new THREE.CatmullRomCurve3(p.path.map((q) => new THREE.Vector3(q[0], q[1], q[2])), false, 'centripetal');
      g = new THREE.TubeGeometry(curve, Math.min(1200, Math.max(segs * 2, p.path.length * 2)), p.radius, 40, false).toNonIndexed();
      const uv = g.attributes.uv; along = (i) => (uv.getX(i) + uv.getX(i + 1) + uv.getX(i + 2)) / 3;
    } else {
      g = new THREE.CylinderGeometry(p.radius, p.radius, p.length, 40, segs, true).rotateZ(-Math.PI / 2).toNonIndexed();
      const ps = g.attributes.position; along = (i) => ((ps.getX(i) + ps.getX(i + 1) + ps.getX(i + 2)) / 3 + p.length / 2) / p.length;
    }
    const pos = g.attributes.position, cols = new Float32Array(pos.count * 3), c1 = __spCol(p.color), c2 = __spCol(p.color2);
    for (let i = 0; i < pos.count; i += 3) {
      const c = p.rings && Math.floor(Math.min(0.999999, along(i)) * segs) % 2 ? c2 : c1;
      for (let k = 0; k < 3; k++) { cols[(i + k) * 3] = c.r; cols[(i + k) * 3 + 1] = c.g; cols[(i + k) * 3 + 2] = c.b; }
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    return g;
  };
  // a box corridor along a path: each side a strip between two rails, banded by distance along it; caps are the
  // section's rectangle at an end
  const __spBoxGeo = (p) => {
    const P = p.path, R = p.rails.right, U = p.rails.up, w2 = p.size[0] / 2, h2 = p.size[1] / 2;
    const at = (i, a, b) => [P[i][0] + R[i][0] * a + U[i][0] * b, P[i][1] + R[i][1] * a + U[i][1] * b, P[i][2] + R[i][2] * a + U[i][2] * b];
    const EDGES = { floor: [[-w2, -h2], [w2, -h2]], ceiling: [[-w2, h2], [w2, h2]], left: [[-w2, -h2], [-w2, h2]], right: [[w2, -h2], [w2, h2]] };
    const cum = [0];
    for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]));
    const total = cum[cum.length - 1] || 1, segs = Math.max(1, p.rings * 2), c1 = __spCol(p.color), c2 = __spCol(p.color2);
    const pos = [], col = [];
    const tri = (a, b, c, k) => { pos.push(...a, ...b, ...c); for (let n = 0; n < 3; n++) col.push(k.r, k.g, k.b); };
    for (const side of p.sides) {
      const [e0, e1] = EDGES[side];
      for (let i = 0; i + 1 < P.length; i++) {
        const k = p.rings && Math.floor(Math.min(0.999999, (cum[i] + cum[i + 1]) / 2 / total) * segs) % 2 ? c2 : c1;
        const a0 = at(i, ...e0), a1 = at(i, ...e1), b0 = at(i + 1, ...e0), b1 = at(i + 1, ...e1);
        tri(a0, a1, b1, k); tri(a0, b1, b0, k);
      }
    }
    for (const end of p.cap === 'both' ? [0, P.length - 1] : p.cap === 'far' ? [P.length - 1] : p.cap === 'near' ? [0] : []) {
      const q = [at(end, -w2, -h2), at(end, w2, -h2), at(end, w2, h2), at(end, -w2, h2)];
      tri(q[0], q[1], q[2], c1); tri(q[0], q[2], q[3], c1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return g;
  };
  const __sp = SP.map((p) => {
    const mat = new THREE.MeshBasicMaterial({ color: p.kind === 'pipe' ? 0xffffff : __spCol(p.color), vertexColors: p.kind === 'pipe', side: THREE.DoubleSide, transparent: true });
    let geo;
    if (p.kind === 'wall') geo = __spFace(new THREE.PlaneGeometry(p.size[0], p.size[1]));
    else if (p.kind === 'floor' || p.kind === 'ceiling') geo = new THREE.PlaneGeometry(p.size[0], p.size[1]);
    else if (p.kind === 'pipe') geo = p.rails ? __spBoxGeo(p) : __spPipeGeo(p);
    else geo = __spFrameGeo(p, 1);
    const obj = new THREE.Group();
    const mesh = new THREE.Mesh(geo, mat);
    obj.add(mesh);
    if (p.kind === 'pipe' && p.cap && !p.rails) {
      for (const end of p.cap === 'both' ? ['near', 'far'] : [p.cap]) {
        const cap = new THREE.Mesh(new THREE.CircleGeometry(p.radius, 40), new THREE.MeshBasicMaterial({ color: __spCol(p.color), side: THREE.DoubleSide, transparent: true }));
        if (p.path) {   // the disc at the path's end, facing along it
          const k = end === 'far' ? p.path.length - 1 : 0, j = end === 'far' ? k - 1 : 1, a = p.path[k], b = p.path[j];
          cap.position.set(a[0], a[1], a[2]); cap.lookAt(2 * a[0] - b[0], 2 * a[1] - b[1], 2 * a[2] - b[2]);
        } else { cap.geometry.rotateY(-Math.PI / 2); cap.position.x = (end === 'far' ? 1 : -1) * p.length / 2; }
        obj.add(cap);
      }
    }
    let portal = null;
    if (p.portal) {   // the hole and the target the far camera's view is rendered into, sampled in screen space
      const rt = new THREE.WebGLRenderTarget(1, 1, { samples: 4 });
      const res = { value: new THREE.Vector2(1, 1) };
      const hm = new THREE.MeshBasicMaterial({ map: rt.texture, side: THREE.DoubleSide, transparent: true });
      hm.onBeforeCompile = (sh) => {
        sh.uniforms.uSpRes = res;
        sh.fragmentShader = 'uniform vec2 uSpRes;\\n' + sh.fragmentShader.replace('#include <map_fragment>', 'diffuseColor *= texture2D( map, gl_FragCoord.xy / uSpRes );');
      };
      const hole = new THREE.Mesh(__spHoleGeo(p, 1), hm);
      obj.add(hole);
      portal = { rt, res, hole, pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
    }
    obj.visible = false;
    scene.add(obj);
    return { p, obj, mesh, open: 1, portal };
  });
  const __spVC = new THREE.PerspectiveCamera();
  __spVC.matrixAutoUpdate = false; __spVC.matrixWorldAutoUpdate = false;
  const __spMP = new THREE.Matrix4(), __spMD = new THREE.Matrix4(), __spOne = new THREE.Vector3(1, 1, 1), __spV2 = new THREE.Vector2();
  const __spPlane = new THREE.Plane(), __spFwd = new THREE.Vector3();
  // render every showing portal's far view, before the page renders the frame
  const __spPortals = () => {
    const showing = __sp.filter((r) => r.portal && r.obj.visible);
    if (!showing.length) return;
    camera.updateMatrixWorld();
    const size = renderer.getDrawingBufferSize(__spV2);
    const hide = [...__sp.filter((r) => r.portal && r.obj.visible).map((r) => r.obj), ...(window.__mojShootGizmos || []).filter((g) => g.visible)];
    hide.forEach((o) => { o.visible = false; });
    const clip = renderer.clippingPlanes, target = renderer.getRenderTarget();
    for (const r of showing) {
      const P = r.portal;
      if (P.rt.width !== size.x || P.rt.height !== size.y) P.rt.setSize(size.x, size.y);
      P.res.value.set(size.x, size.y);
      __spMP.compose(r.obj.position, r.obj.quaternion, __spOne).invert();
      __spMD.compose(P.pos, P.quat, __spOne);
      __spVC.matrixWorld.copy(__spMD).multiply(__spMP).multiply(camera.matrixWorld);
      __spVC.matrixWorldInverse.copy(__spVC.matrixWorld).invert();
      __spVC.projectionMatrix.copy(camera.projectionMatrix); __spVC.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
      __spVC.near = camera.near; __spVC.far = camera.far;
      __spPlane.setFromNormalAndCoplanarPoint(__spFwd.set(1, 0, 0).applyQuaternion(P.quat), P.pos);   // nothing behind the far camera
      renderer.clippingPlanes = [__spPlane];
      renderer.setRenderTarget(P.rt); renderer.render(scene, __spVC);
    }
    renderer.setRenderTarget(target); renderer.clippingPlanes = clip;
    hide.forEach((o) => { o.visible = true; });
  };
  const __spQ = new THREE.Quaternion(), __spQ2 = new THREE.Quaternion();
  stepShootSet = (t) => {
    const sec = (__shSetT != null ? __shSetT : (t || 0)) / 1000;
    for (const r of __sp) {
      const tr = r.p.track;
      const on = r.p.shots.includes(__shSetShot) && sec >= tr.t0 - 1e-6 && sec <= tr.t1 + 1e-6;
      if (!on) { r.obj.visible = false; continue; }
      const f = Math.max(0, Math.min(tr.n - 1, (sec - tr.t0) * tr.fps));
      const i = Math.min(Math.max(0, tr.n - 2), Math.floor(f)), j = Math.min(tr.n - 1, i + 1), a = tr.n > 1 ? f - i : 0;
      const L = (arr, d, k) => arr[i * d + k] + (arr[j * d + k] - arr[i * d + k]) * a;
      const opacity = L(tr.opacity, 1, 0), open = L(tr.open, 1, 0);
      if (opacity < 0.002 || (r.p.kind === 'frame' && !r.portal && open > 0.995) || (r.portal && open < 0.002)) { r.obj.visible = false; continue; }
      r.obj.visible = true;
      r.obj.position.set(L(tr.pos, 3, 0), L(tr.pos, 3, 1), L(tr.pos, 3, 2));
      __spQ.set(tr.quat[i * 4], tr.quat[i * 4 + 1], tr.quat[i * 4 + 2], tr.quat[i * 4 + 3]);
      __spQ2.set(tr.quat[j * 4], tr.quat[j * 4 + 1], tr.quat[j * 4 + 2], tr.quat[j * 4 + 3]);
      r.obj.quaternion.copy(__spQ).slerp(__spQ2, a);
      r.obj.scale.set(L(tr.scale, 3, 0), L(tr.scale, 3, 1), L(tr.scale, 3, 2));
      r.obj.traverse((o) => { if (o.material) { o.material.opacity = opacity; o.material.depthWrite = opacity > 0.999; } });
      if (r.p.kind === 'frame' && Math.abs(open - r.open) > 1e-3) {
        r.mesh.geometry.dispose(); r.mesh.geometry = __spFrameGeo(r.p, open);
        if (r.portal) { r.portal.hole.geometry.dispose(); r.portal.hole.geometry = __spHoleGeo(r.p, open); }
        r.open = open;
      }
      if (r.portal) {   // where the far camera stands at this frame
        const d = r.p.portal;
        r.portal.pos.set(L(d.pos, 3, 0), L(d.pos, 3, 1), L(d.pos, 3, 2));
        __spQ.set(d.quat[i * 4], d.quat[i * 4 + 1], d.quat[i * 4 + 2], d.quat[i * 4 + 3]);
        __spQ2.set(d.quat[j * 4], d.quat[j * 4 + 1], d.quat[j * 4 + 2], d.quat[j * 4 + 3]);
        r.portal.quat.copy(__spQ).slerp(__spQ2, a);
      }
    }
    __spPortals();
  };
  window.__mojShootSet = { pieces: __sp.length, portals: __sp.filter((r) => r.portal).length, visible: () => __sp.filter((r) => r.obj.visible).map((r) => r.p.id) };
}`;
}

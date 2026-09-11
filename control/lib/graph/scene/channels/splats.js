import { b64 } from '../emit-util.js';

/**
 * splats — the coat channel (field-splats.plan.md phase 2). Renders the gaussians
 * `surfaceSplats` grows off a polygonizer field (polygonizer/field-splats.js).
 *
 * A SETUP row, not a runtime one: the cloud is static geometry, and its only
 * per-frame work is the depth sort, which rides an `onBeforeRender` hook — the same
 * move the raymarch effects layer uses to feed its camera (docs/raymarch-effects-layer.md,
 * reconciliation 3). No `__mojStep` slot, no registry let.
 *
 * Each splat is a SURFEL: a camera-independent quad spanned by the two tangent axes
 * the emission already computed (`t1 * scale[0]`, `t2 * scale[1]`), so it lies IN the
 * surface's tangent plane rather than facing the camera. That is what makes a coat
 * read as volume from every angle instead of as a billboard sheet — and it is why this
 * cannot reuse glow.js's THREE.Sprite, which is camera-facing by construction.
 *
 * Blending: premultiplied alpha, `depthWrite:false` (splats must not occlude each
 * other in the depth buffer) with `depthTest:true` (the baked body mesh DOES occlude
 * them). Sorted back-to-front per frame, because alpha blending is order-dependent.
 *
 * Payload is packed base64 f32/u8 through the page's existing decodeF32/decodeU8 — a
 * coat is tens of thousands of gaussians and will not ride safeJson.
 */
export function splatChannelScript(splats, opts = {}) {
  const n = splats.length;
  const ctr = new Float32Array(n * 3);
  const ax1 = new Float32Array(n * 3);
  const ax2 = new Float32Array(n * 3);
  const col = new Uint8Array(n * 3);
  const alp = new Float32Array(n);
  const fallbackHex = typeof opts.color === 'string' ? opts.color : '#b9b2a6';
  for (let i = 0; i < n; i++) {
    const s = splats[i];
    ctr[i * 3] = s.c[0]; ctr[i * 3 + 1] = s.c[1]; ctr[i * 3 + 2] = s.c[2];
    ax1[i * 3] = s.t1[0] * s.scale[0]; ax1[i * 3 + 1] = s.t1[1] * s.scale[0]; ax1[i * 3 + 2] = s.t1[2] * s.scale[0];
    ax2[i * 3] = s.t2[0] * s.scale[1]; ax2[i * 3 + 1] = s.t2[1] * s.scale[1]; ax2[i * 3 + 2] = s.t2[2] * s.scale[1];
    const hex = typeof s.color === 'string' ? s.color : fallbackHex;
    col[i * 3] = parseInt(hex.slice(1, 3), 16);
    col[i * 3 + 1] = parseInt(hex.slice(3, 5), 16);
    col[i * 3 + 2] = parseInt(hex.slice(5, 7), 16);
    alp[i] = Number.isFinite(s.alpha) ? s.alpha : 1;
  }
  // Sorting every frame is wasted work when the camera has not moved far enough to
  // reorder anything; the hook re-sorts on a squared-distance threshold instead.
  const resortEps = Number.isFinite(opts.resortEps) ? opts.resortEps : 0.002;

  return `
// --- coat splats (surfaceSplats — field-splats.js) ---
{
  const SP_N = ${n};
  const spC = decodeF32('${b64(ctr)}'), spA1 = decodeF32('${b64(ax1)}'), spA2 = decodeF32('${b64(ax2)}');
  const spAl = decodeF32('${b64(alp)}'), spCol = decodeU8('${b64(col)}');
  const spGeo = new THREE.InstancedBufferGeometry();
  spGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1,-1,0, 1,-1,0, 1,1,0, -1,1,0]), 3));
  spGeo.setIndex([0,1,2, 0,2,3]);
  // The attributes get their OWN arrays: the sort READS the decoded source every frame and
  // WRITES the reordered copy, so aliasing the two would let the first sort scramble its own
  // input and every later frame would read garbage.
  spGeo.setAttribute('iC', new THREE.InstancedBufferAttribute(spC.slice(), 3));
  spGeo.setAttribute('iA1', new THREE.InstancedBufferAttribute(spA1.slice(), 3));
  spGeo.setAttribute('iA2', new THREE.InstancedBufferAttribute(spA2.slice(), 3));
  spGeo.setAttribute('iCol', new THREE.InstancedBufferAttribute(spCol.slice(), 3, true));
  spGeo.setAttribute('iAl', new THREE.InstancedBufferAttribute(spAl.slice(), 1));
  spGeo.instanceCount = SP_N;
  // the sort writes ORDER into the instance attributes, so the draw stays one call
  const spOrder = new Uint32Array(SP_N); for (let i = 0; i < SP_N; i++) spOrder[i] = i;
  const spKey = new Float32Array(SP_N);
  const spSrc = { iC: spC, iA1: spA1, iA2: spA2, iAl: spAl };
  const spDst = { iC: new Float32Array(SP_N*3), iA1: new Float32Array(SP_N*3), iA2: new Float32Array(SP_N*3), iAl: new Float32Array(SP_N) };
  const spColDst = new Uint8Array(SP_N*3);
  const spMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    vertexShader: \`
      attribute vec3 iC; attribute vec3 iA1; attribute vec3 iA2; attribute vec3 iCol; attribute float iAl;
      varying vec2 vQ; varying vec3 vCol; varying float vAl;
      void main(){
        vQ = position.xy; vCol = iCol; vAl = iAl;
        vec3 w = iC + iA1 * position.x + iA2 * position.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(w, 1.0);
      }\`,
    fragmentShader: \`
      precision mediump float;
      varying vec2 vQ; varying vec3 vCol; varying float vAl;
      void main(){
        float r2 = dot(vQ, vQ);
        if (r2 > 1.0) discard;
        float a = exp(-2.5 * r2) * vAl;
        gl_FragColor = vec4(vCol * a, a);   // premultiplied
      }\`,
  });
  const spMesh = new THREE.Mesh(spGeo, spMat);
  spMesh.frustumCulled = false;
  spMesh.renderOrder = 7;
  let spLast = new THREE.Vector3(1e9, 1e9, 1e9);
  spMesh.onBeforeRender = function (r, sc, cam) {
    if (cam.position.distanceToSquared(spLast) < ${resortEps}) return;
    spLast.copy(cam.position);
    const cx = cam.position.x, cy = cam.position.y, cz = cam.position.z;
    for (let i = 0; i < SP_N; i++) {
      const dx = spC[i*3]-cx, dy = spC[i*3+1]-cy, dz = spC[i*3+2]-cz;
      spKey[i] = -(dx*dx + dy*dy + dz*dz);        // negated → ascending sort is back-to-front
    }
    const ord = Array.prototype.slice.call(spOrder);
    ord.sort((a, b) => spKey[a] - spKey[b]);
    for (let i = 0; i < SP_N; i++) {
      const s = ord[i];
      spDst.iC[i*3]=spC[s*3]; spDst.iC[i*3+1]=spC[s*3+1]; spDst.iC[i*3+2]=spC[s*3+2];
      spDst.iA1[i*3]=spA1[s*3]; spDst.iA1[i*3+1]=spA1[s*3+1]; spDst.iA1[i*3+2]=spA1[s*3+2];
      spDst.iA2[i*3]=spA2[s*3]; spDst.iA2[i*3+1]=spA2[s*3+1]; spDst.iA2[i*3+2]=spA2[s*3+2];
      spColDst[i*3]=spCol[s*3]; spColDst[i*3+1]=spCol[s*3+1]; spColDst[i*3+2]=spCol[s*3+2];
      spDst.iAl[i]=spAl[s];
    }
    for (const k of ['iC','iA1','iA2','iAl']) { spGeo.getAttribute(k).array.set(spDst[k]); spGeo.getAttribute(k).needsUpdate = true; }
    spGeo.getAttribute('iCol').array.set(spColDst); spGeo.getAttribute('iCol').needsUpdate = true;
  };
  scene.add(spMesh);
  window.__mojSplats = { mesh: spMesh, count: SP_N };
  const spBtn = document.createElement('button');
  spBtn.textContent = 'coat'; spBtn.className = 'on';
  spBtn.onclick = () => { spMesh.visible = !spMesh.visible; spBtn.className = spMesh.visible ? 'on' : 'off'; };
  hud.appendChild(spBtn);
}`;
}

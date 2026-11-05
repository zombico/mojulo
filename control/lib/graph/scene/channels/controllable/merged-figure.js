/**
 * ONE DRAW A FIGURE — a rigid rig (one mesh a bone, `__makeRigGroup`) drawn as ONE skinned mesh: every part's corners in
 * one geometry, each bound wholly to its own bone (skinIndex its bone, weight 1), the bones posed by the sync exactly as
 * the bone meshes were (each Bone's matrix the bone mesh's). It draws what the bone meshes drew, in one call a pass
 * instead of one a part: a person of 59 parts is 59 draws in the frame, its shadow map and its occlusion prepass; merged,
 * 3. Bound at the identity, as the skinned rig (`__makeSkinGroup`) is: a part's corners are in its bone's frame.
 *
 *   mergeableFigure(fig)    → whether a baked fig is drawn merged: its parts plain (indexed and quantized, coloured) and
 *                             nothing that needs a bone's own mesh (a paint, a face's morphs, a form's materials, spec or
 *                             metal patches, a weapon or shield bone shown and hidden by itself, a muzzle, thrusters, a
 *                             racer's juice or life, forms, a skin of its own)
 *   mergedFigureScript(o)   → the page's builder, `__makeMergedGroup(fig, b, group)`, and `__mergeable` (this predicate)
 *
 * Off where a per-bone mesh is read: the toon ink (a hull on each part), a headset (its hands drawn from the bone meshes).
 * A wreck (wreck-channel.js) reads the bone meshes too: a merged figure is not broken into pieces, it goes as it falls.
 */

/** Whether a baked figure is drawn as one skinned mesh. Pure; also emitted onto the page by its source. */
export function mergeableFigure(fig) {
  if (!fig || !fig.rig || fig.skin || fig.form || fig.paintTex || fig.face || fig.rim || fig.muzzle || fig.thrusters || fig.juice || fig.live || fig.forms) return false;
  if (!Array.isArray(fig.parts) || !Array.isArray(fig.bones) || !fig.parts.some(Boolean)) return false;
  for (const b of fig.bones) if (b && typeof b.id === 'string' && (b.id.indexOf('weapon_') === 0 || b.id === 'shield')) return false;
  for (const p of fig.parts) {
    if (!p) continue;
    if (!p.q || !p.idx || !p.col || p.form || p.uv || p.morph || p.metal || p.spec || p.spec8) return false;
  }
  return true;
}

/** The page's merged builder (needs the page's `__decodeU16`, `__decodeU32`, `decodeU8`, `scene`). `cast`: the figure
 * casts into the live shadows; `scaled`: a body may carry its own scale. */
export function mergedFigureScript({ cast = false, scaled = false } = {}) {
  return `
// ONE DRAW A FIGURE (merged-figure.js): a rigid rig's parts in one skinned mesh, each part's corners bound to its bone
const __mergeable = ${mergeableFigure.toString()};
function __makeMergedGroup(fig, b, group) {
  const bones = fig.bones.map(() => { const o = new THREE.Bone(); o.matrixAutoUpdate = false; group.add(o); return o; });
  const D = fig.parts.map((P) => (P ? { P, q: __decodeU16(P.q), c: decodeU8(P.col), I: P.n > 65535 ? __decodeU32(P.idx) : __decodeU16(P.idx) } : null));
  let nv = 0, ni = 0;
  for (const d of D) if (d) { nv += d.P.n; ni += d.I.length; }
  const pos = new Float32Array(nv * 3), col = new Uint8Array(nv * 3), jnt = new Uint16Array(nv * 4);
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let v = 0, k = 0;
  D.forEach((d, bi) => {
    if (!d) return;
    const { P, q, c, I } = d, o = P.o, s = P.s;
    for (let i = 0; i < P.n; i++) {
      const a = (v + i) * 3, j = i * 3;
      pos[a] = o[0] + q[j] * s[0]; pos[a + 1] = o[1] + q[j + 1] * s[1]; pos[a + 2] = o[2] + q[j + 2] * s[2];
      jnt[(v + i) * 4] = bi;
    }
    col.set(c.subarray(0, P.n * 3), v * 3);
    for (let i = 0; i < I.length; i++) idx[k + i] = I[i] + v;
    v += P.n; k += I.length;
  });
  const geo = __mergedGeo(pos, col, jnt, idx);
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  // (culled as a whole: a sphere round the figure's height over its feet holds it in any pose, so a figure out of a
  // render's view, behind the camera or outside the shadow's box, is not drawn there)
  const H = fig.figH || 1.7;
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, H * 0.5), H * 0.85); mesh.raycast = function () {};${cast ? '\n  mesh.castShadow = true;' : ''}
  group.add(mesh); scene.add(group);${scaled ? `
  if (b.scale > 0) group.scale.setScalar(b.scale);` : ''}
  group.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones, bones.map(() => new THREE.Matrix4())));
  group.userData.rigFig = { fig, boneMeshes: bones, mix: {}, blendTime: b.blendTime, lookA: 0, yaw: b.yawOffset != null ? b.yawOffset : -Math.PI / 2, headTrack: b.headTrack || null, skin: mesh, merged: true };
  return group;
}
function __mergedGeo(pos, col, jnt, idx) {
  const geo = new THREE.BufferGeometry(), n = pos.length / 3, wgt = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) wgt[i * 4] = 1;
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(jnt, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(wgt, 4));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  return geo;
}
`;
}

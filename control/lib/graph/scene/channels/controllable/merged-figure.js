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
 *   mergedFigureScript(o)   → the page's builder, `__makeMergedGroup(fig, b, group)`, and `__mergeable` (this predicate);
 *                             `pose`: a figure with a pose twin (figure-grades.js, `fig.pose` its name in the bank) has it
 *                             cut in while a close shot is on it (`__poseFrame()`, each frame), a second skinned mesh on
 *                             the same bones, built the first time it is wanted
 *
 * Off where a per-bone mesh is read: the toon ink (a hull on each part), a headset (its hands drawn from the bone meshes).
 * A wreck (wreck-channel.js) reads the bone meshes too: a merged figure is not broken into pieces, it goes as it falls.
 */

/** Whether a baked figure is drawn as one skinned mesh. Pure; also emitted onto the page by its source. */
export function mergeableFigure(fig) {
  // (a cel body, world-scene.js heroFigure `cel`, steps each part between its two tones: drawn part by part)
  if (!fig || !fig.rig || fig.skin || fig.form || fig.paintTex || fig.face || fig.rim || fig.muzzle || fig.thrusters || fig.juice || fig.live || fig.forms || fig.toon) return false;
  if (!Array.isArray(fig.parts) || !Array.isArray(fig.bones) || !fig.parts.some(Boolean)) return false;
  for (const b of fig.bones) if (b && typeof b.id === 'string' && (b.id.indexOf('weapon_') === 0 || b.id === 'shield')) return false;
  for (const p of fig.parts) {
    if (!p) continue;
    if (!p.q || !p.idx || !p.col || p.form || p.uv || p.morph || p.metal || p.spec || p.spec8) return false;
  }
  return true;
}

/**
 * ONE DRAW A LIT FIGURE — a layered body (the realistic hero, its garments and gear: painted, lit by the cast rig, its
 * parts in their bones' frames) drawn as one skinned mesh a material, where `__makeMergedGroup` takes only a plain rigid
 * rig. Its bone meshes are built as ever and KEPT, hidden, as the bones the sync poses and every reader reads (an aim's
 * eye, a held gun's hands, a rim, a hit): the skinned mesh draws their corners bound wholly to them (skinIndex its
 * bone, weight 1, bound at the identity), so it draws what they drew in one call a pass instead of one a part. A part
 * that carries the face's morphs stays its own mesh (its expressions are its own).
 *
 *   oneDrawFigure(fig) → whether a baked fig may be drawn so: a rig (not a skinned, a form's or a forms' figure) with no
 *                        bone shown or hidden by itself (a weapon's, a shield's), no muzzle, thrusters, juice, live
 *                        overlay or rim, and no part with a form's, a metal's or a specular's material of its own.
 *                        A world marks such a figure `oneDraw` (world-scene.js, the play grade); none marked, not a byte
 */
export function oneDrawFigure(fig) {
  if (!fig || !fig.rig || fig.skin || fig.form || fig.forms || fig.rim || fig.muzzle || fig.thrusters || fig.juice || fig.live) return false;
  if (!Array.isArray(fig.parts) || !Array.isArray(fig.bones) || fig.parts.filter(Boolean).length < 2) return false;
  for (const b of fig.bones) if (b && typeof b.id === 'string' && (b.id.indexOf('weapon_') === 0 || b.id === 'shield')) return false;
  for (const p of fig.parts) if (p && (p.form || p.metal || p.spec || p.spec8 || p.tan)) return false;
  return true;
}

/** The page's lit merge, `__oneDraw(fig, group, boneMeshes)`: run on a rig group once its bone meshes are built. */
export function oneDrawScript() {
  return `
// ONE DRAW A LIT FIGURE (merged-figure.js oneDrawFigure): the bone meshes kept, hidden, as the bones; their corners drawn
// as one skinned mesh a material (a face's morphing parts left their own)
function __oneDraw(fig, group, boneMeshes) {
  const sets = new Map();
  boneMeshes.forEach((m, bi) => {
    if (!m || !m.isMesh || m.isSkinnedMesh || m.morphTargetInfluences || !m.geometry || !m.geometry.attributes.position) return;
    const g = m.geometry, key = Object.keys(g.attributes).sort().join(',') + '|' + (m.material.map ? m.material.map.uuid : '') + '|' + (m.material.alphaTest || 0);
    if (!sets.has(key)) sets.set(key, []);
    sets.get(key).push([m, bi]);
  });
  const bones = boneMeshes.map((m) => m || group), skins = [];
  for (const list of sets.values()) {
    if (list.length < 2) continue;
    const first = list[0][0], names = Object.keys(first.geometry.attributes);
    let nv = 0, ni = 0;
    for (const [m] of list) { const g = m.geometry, n = g.attributes.position.count; nv += n; ni += g.index ? g.index.count : n; }
    // (an attribute every part carries in one type is copied as it is; one carried in two, a lit read's normals as bytes
    // here and as floats there, is read back to floats)
    const out = {};
    for (const k of names) {
      const a = first.geometry.attributes[k], same = list.every(([m]) => { const b = m.geometry.attributes[k]; return b && !b.isInterleavedBufferAttribute && b.array.constructor === a.array.constructor && b.normalized === a.normalized && b.itemSize === a.itemSize; });
      out[k] = { n: a.itemSize, raw: same, norm: same && a.normalized, arr: same ? new a.array.constructor(nv * a.itemSize) : new Float32Array(nv * a.itemSize) };
    }
    const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni), jnt = new Uint16Array(nv * 4), wgt = new Float32Array(nv * 4);
    let v = 0, k = 0;
    for (const [m, bi] of list) {
      const g = m.geometry, n = g.attributes.position.count;
      for (const name of names) {
        const a = g.attributes[name], o = out[name];
        if (o.raw) o.arr.set(a.array.subarray(0, n * o.n), v * o.n);
        else for (let i = 0; i < n; i++) { const t = (v + i) * o.n; o.arr[t] = a.getX(i); if (o.n > 1) o.arr[t + 1] = a.getY(i); if (o.n > 2) o.arr[t + 2] = a.getZ(i); if (o.n > 3) o.arr[t + 3] = a.getW(i); }
      }
      for (let i = 0; i < n; i++) { jnt[(v + i) * 4] = bi; wgt[(v + i) * 4] = 1; }
      if (g.index) { const I = g.index.array; for (let i = 0; i < I.length; i++) idx[k + i] = I[i] + v; k += I.length; }
      else { for (let i = 0; i < n; i++) idx[k + i] = v + i; k += n; }
      v += n;
      m.visible = false;
    }
    const geo = new THREE.BufferGeometry();
    for (const name of names) geo.setAttribute(name, new THREE.BufferAttribute(out[name].arr, out[name].n, out[name].norm));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(jnt, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(wgt, 4));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const mesh = new THREE.SkinnedMesh(geo, first.material);
    mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow; mesh.raycast = function () {};
    // (culled as a whole: a sphere round the figure's height over its feet holds it in any pose)
    const H = fig.figH || 1.7;
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, H * 0.5), H * 0.85);
    group.add(mesh);
    mesh.bind(new THREE.Skeleton(bones, bones.map(() => new THREE.Matrix4())), new THREE.Matrix4());
    skins.push(mesh);
  }
  const rf = group.userData.rigFig;
  if (rf && skins.length) { rf.skin = skins[0]; rf.skins = skins; rf.merged = true; }
}
`;
}

/** The page's merged builder (needs the page's `__decodeU16`, `__decodeU32`, `decodeU8`, `scene`). `cast`: the figure
 * casts into the live shadows; `scaled`: a body may carry its own scale; `rig`: a figure that carries the cast rig
 * (its `cast`, ../cast-rig.js) is drawn with the cast material, its normals its mesh's own (needs the page's `__castMat`). */
export function mergedFigureScript({ cast = false, scaled = false, pose = false, rig = false, resp = false } = {}) {
  return `
// ONE DRAW A FIGURE (merged-figure.js): a rigid rig's parts in one skinned mesh, each part's corners bound to its bone
const __mergeable = ${mergeableFigure.toString()};
function __makeMergedGroup(fig, b, group) {
  const bones = fig.bones.map(() => { const o = new THREE.Bone(); o.matrixAutoUpdate = false; group.add(o); return o; });
  const mesh = __mergedMesh(fig, group);
  scene.add(group);${scaled ? `
  if (b.scale > 0) group.scale.setScalar(b.scale);` : ''}
  group.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones, bones.map(() => new THREE.Matrix4())));
  group.userData.rigFig = { fig, boneMeshes: bones, mix: {}, blendTime: b.blendTime, lookA: 0, yaw: b.yawOffset != null ? b.yawOffset : -Math.PI / 2, headTrack: b.headTrack || null, skin: mesh, merged: true };
  return group;
}
// a figure's parts as one skinned mesh in its group (bound by the caller)
function __mergedMesh(fig, group) {
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
${resp ? "  if (fig.cast && Array.isArray(fig.response)) geo.setAttribute('aMR', new THREE.BufferAttribute(__castMR(fig, col, nv), 2, true));\n" : ''}  const mesh = new THREE.SkinnedMesh(geo, ${rig ? 'fig.cast ? (geo.computeVertexNormals(), __castMat(fig, { vertexColors: true, side: THREE.DoubleSide })) : ' : ''}new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));${rig ? '\n  if (fig.cast) mesh.receiveShadow = true;' : ''}
  // (culled as a whole: a sphere round the figure's height over its feet holds it in any pose, so a figure out of a
  // render's view, behind the camera or outside the shadow's box, is not drawn there)
  const H = fig.figH || 1.7;
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, H * 0.5), H * 0.85); mesh.raycast = function () {};${cast ? '\n  mesh.castShadow = true;' : ''}
  group.add(mesh);
  return mesh;
}${pose ? `
// THE POSE GRADE CUT IN (figure-grades.js): the figures a close shot is on (a scene's close, over-the-shoulder or
// two-shot, the battle's film: window.__mojFilmPose) show their pose twin, a second mesh on the same bones; the rest
// their play grade. The twin is built the first time it is wanted and kept
const __CLOSE_FRAMES = ${JSON.stringify(['close', 'over', 'two'])};
const __posed = new Set();
function __poseGrade(id, on) {
  const g = __bodies[id], rf = g && g.userData.rigFig;
  if (!rf || !rf.merged || !rf.fig.pose) return;
  const P = __FIG[rf.fig.pose];
  if (on && !rf.poseSkin && P && __mergeable(P) && P.bones.length === rf.fig.bones.length) {
    rf.poseSkin = __mergedMesh(P, g); g.updateMatrixWorld(true);
    rf.poseSkin.bind(new THREE.Skeleton(rf.boneMeshes, rf.boneMeshes.map(() => new THREE.Matrix4())));
  }
  if (!rf.poseSkin) return;
  rf.poseSkin.visible = !!on; rf.skin.visible = !on;
}
function __poseFrame() {
  const C = __world.camera, R = C && C.rule, want = new Set(window.__mojFilmPose || []);
  if (R && R.type === 'shot' && __CLOSE_FRAMES.indexOf(R.frame) >= 0) for (const id of R.on || []) want.add(id);
  for (const id of __posed) if (!want.has(id)) { __poseGrade(id, false); __posed.delete(id); }
  for (const id of want) if (!__posed.has(id)) { __poseGrade(id, true); __posed.add(id); }
}` : ''}
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

/**
 * FAR FIGURES — a figure seen far off drawn as its far twin (`fig.far`, its name in the bank: the same character baked
 * coarse, figures/figure-lod.js, its face dropped; world-scene.js under a world's `farFigures`) past `fig.farAt` metres
 * from the eye, two metres' grace back: a second rig group built the first time it is wanted, never hit by a ray, posed
 * each frame from the figure's own bones (each bone's matrix copied) and placed where its body stands, shown only while
 * the body is. The figure's own skins and bone meshes are hidden while its twin shows; nothing else of it is touched.
 *
 *   farFigureScript() → `__farFrame()`, run each frame after the camera moves (needs the page's `__bodies`, `__FIG`,
 *                       `__makeRigGroup`, `__world`, `camera`)
 */
export function farFigureScript() {
  return `
// FAR FIGURES (merged-figure.js farFigureScript): past its far distance a figure shows its far twin, posed from its bones
function __farFrame() {
  const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
  for (const id in __bodies) {
    const g = __bodies[id], rf = g && g.userData && g.userData.rigFig, e = __world.byId[id];
    if (!rf || !rf.fig.far || !e) continue;
    const F = __FIG[rf.fig.far];
    if (!F) continue;
    const q = e.transform.pos, d = Math.hypot(q[0] - cx, q[1] - cy, q[2] - cz), at = rf.fig.farAt || 24;
    const far = rf.farOn ? d > at - 2 : d > at;
    if (far && !rf.farG) {
      rf.farG = __makeRigGroup(F, e.body || {});
      rf.farG.traverse((o) => { o.raycast = function () {}; });
      rf.drawn = [...(rf.skins || (rf.skin ? [rf.skin] : [])), ...rf.boneMeshes.filter((m) => m && m.visible)];
    }
    if (far !== !!rf.farOn && rf.drawn) { for (const o of rf.drawn) o.visible = !far; rf.farOn = far; }
    if (!rf.farG) continue;
    const G = rf.farG;
    G.visible = far && g.visible;
    if (!G.visible) continue;
    G.position.copy(g.position); G.quaternion.copy(g.quaternion); G.scale.copy(g.scale);
    const A = rf.boneMeshes, B = G.userData.rigFig.boneMeshes;
    for (let k = 0; k < A.length; k++) if (A[k] && B[k]) B[k].matrix.copy(A[k].matrix);
  }
}
`;
}

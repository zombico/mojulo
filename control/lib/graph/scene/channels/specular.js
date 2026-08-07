import { safeJson } from '../emit-util.js';

// In-page script: the specular channel (material-response.plan.md P2) — the view-dependent
// half of the material response. Groups whose geometry carries a per-vertex `aSpec`
// [strength, power] attribute (packed by faceListToMesh from faces tagged `spec`) get their
// MeshBasicMaterial patched with a Blinn-Phong term against the FIXED baked light direction
// and the LIVE camera: baked solve, live reconstruction — the AO posture. Flat normals are
// derived in-fragment (dFdx × dFdy of the world position), so the triangle-soup geometry
// needs no normal attribute. A one-shot setup block like glow/shadow/pick: scenes with no
// spec faces emit ZERO bytes of this and stay byte-identical.
export function specularChannelScript(toLight) {
  return `
// --- specular channel (material response): baked light dir + live camera highlight ---
const SPEC_L = ${safeJson(toLight.map((v) => +v.toFixed(6)))};
const __specPatch = (m) => {
  m.material.onBeforeCompile = (sh) => {
    sh.uniforms.uSpecL = { value: new THREE.Vector3(SPEC_L[0], SPEC_L[1], SPEC_L[2]) };
    sh.vertexShader = 'attribute vec2 aSpec;\\nvarying vec2 vSpec;\\nvarying vec3 vSpecWp;\\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\\nvSpec = aSpec;\\nvSpecWp = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = 'uniform vec3 uSpecL;\\nvarying vec2 vSpec;\\nvarying vec3 vSpecWp;\\n' + sh.fragmentShader.replace(
      '#include <dithering_fragment>',
      'vec3 sN = normalize(cross(dFdx(vSpecWp), dFdy(vSpecWp)));\\n' +
      'vec3 sV = normalize(cameraPosition - vSpecWp);\\n' +
      'if (dot(sN, sV) < 0.0) sN = -sN;\\n' +
      'float sNdH = max(0.0, dot(sN, normalize(uSpecL + sV)));\\n' +
      'gl_FragColor.rgb += vSpec.x * pow(sNdH, max(vSpec.y, 1.0));\\n' +
      '#include <dithering_fragment>');
  };
  m.material.needsUpdate = true;
};
for (const grp of GROUPS) {
  if (grp.spec) {
    const sm = meshes[grp.name];
    if (sm) { sm.geometry.setAttribute('aSpec', new THREE.BufferAttribute(decodeF32(grp.spec), 2)); __specPatch(sm); }
  }
  // textured sub-meshes (texture × material — a marble floor that gleams): the static loop
  // gives them no name handle, so re-find each by its EXACT position buffer (both sides
  // decode the same base64, so float equality is exact).
  for (const t of (grp.tex || [])) {
    if (!t.spec) continue;
    const tp = decodeF32(t.pos);
    let tm = null;
    scene.traverse((o) => {
      if (tm || !o.isMesh || !o.material || !o.material.map) return;
      const a = o.geometry.getAttribute('position');
      if (a && a.array.length === tp.length && a.array[0] === tp[0] && a.array[a.array.length - 1] === tp[tp.length - 1]) tm = o;
    });
    if (!tm) continue;
    tm.geometry.setAttribute('aSpec', new THREE.BufferAttribute(decodeF32(t.spec), 2));
    __specPatch(tm);
  }
}`;
}

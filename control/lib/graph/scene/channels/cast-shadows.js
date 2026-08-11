import { safeJson } from '../emit-util.js';

// In-page script: CAST SHADOWS (opt-in world `shadows.cast`) — real shadow-map silhouettes for
// ANY emitted world: every opaque mass and figure casts its actual posed geometry instead of a
// stylized blob. The vexar identity stays baked-unlit: no lit materials are introduced — each
// opaque fill's own MeshBasicMaterial is PATCHED (onBeforeCompile) to sample the shadow map and
// darken in place. In-place sampling is load-bearing, not a nicety: the first cut drew
// ShadowMaterial twin meshes over the fills, and the twin loses the depth test whenever a world
// layers faces inside one merged group (fractal-city roads ride above the ground plane, so the
// depth buffer holds a surface the twin doesn't own — no fixed log-depth nudge is right for
// every scene). Sampling inside the fill's own fragment has no second draw, no depth fight, and
// covers instanced repeats, which a twin never could.
//
// The channel owns the rig; moving actors are integrations:
//   • static solids cast + receive at init (buildings shade the ground with zero wiring);
//   • dynamic channels flag their meshes (`mesh.castShadow = true` at CONSTRUCTION — a traverse
//     after the fact loses to rebuilds, e.g. the hangar loadout stepper) or hand a subtree to
//     `window.__mojCast.adopt(root)`;
//   • the shadow ortho box starts in FIT mode — sized once to the static bounds, no per-frame
//     work, which is also what frame()-driven captures see (they never step) — and any channel
//     with a focus (the controllable pilot) may call `window.__mojCast.follow(x, y, z)` per
//     frame to tighten the box to `span` around the action for texel density on big maps.
//
// Light direction comes from the payload's baked light when it has one (arena-atmosphere and
// relit worlds — actors tie into the keyed stage), else cfg.toLight's default mid-elevation sun.
export function castShadowScript(cfg) {
  // Non-casting groups (interiors): a face `group` listed in cfg.noCast still RECEIVES shadows but
  // does not CAST — the fix for an enclosed roof/ceiling that would otherwise blanket the whole
  // floor in the sun's shadow, killing every suit/pillar silhouette (a directional shadow map
  // records the nearest occluder; an overhead ceiling wins for every floor texel). Emitted ONLY
  // when a world declares noCast, so every existing cast-shadow world stays byte-identical.
  const noCastGuard = Array.isArray(cfg.noCast) && cfg.noCast.length
    ? `\n  if (m.userData && __CS.noCast.indexOf(m.userData.g) !== -1) m.castShadow = false;   // roof/ceiling receives but never casts`
    : '';
  return `
// --- cast shadows (opt-in world 'shadows.cast'): shadow-map silhouettes ---
const __CS = ${safeJson(cfg)};
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const __csL = new THREE.DirectionalLight(0xffffff, 1);   // invisible to the MeshBasic fills — only its shadow camera matters
__csL.castShadow = true;
__csL.shadow.mapSize.set(__CS.mapSize, __CS.mapSize);
scene.add(__csL); scene.add(__csL.target);
const __csDir = new THREE.Vector3(__CS.toLight[0], __CS.toLight[1], __CS.toLight[2]).normalize();
// FIT-mode bounds: union of the static solids' geometry bounding spheres (world = local — the
// merged group meshes sit at the origin). Instanced repeats under-report (their sphere ignores
// instanceMatrix), but the ground/floor mesh of any repeat-dressed world spans the map and
// dominates the union, so the fit stays honest.
const __csC = new THREE.Vector3(); let __csR = 0;
{
  let n = 0;
  for (const m of solids) { if (m.geometry.boundingSphere) { __csC.add(m.geometry.boundingSphere.center); n++; } }
  if (n) __csC.multiplyScalar(1 / n);
  for (const m of solids) {
    const bs = m.geometry.boundingSphere;
    if (bs) __csR = Math.max(__csR, __csC.distanceTo(bs.center) + bs.radius);
  }
  __csR = Math.min(Math.max(__csR, 60), 1600);   // degenerate scenes get a floor; huge maps a texel-density cap
}
// shared uniform cells — every patched program points at these objects, so one write reaches all.
// csMat is the LIVE shadow.matrix (same Matrix4 identity; three refreshes it each shadow pass);
// csMap binds lazily (the depth target exists only after the first shadow render, which happens
// inside the same renderer.render() that first draws the fills). csBias is a constant-depth
// sampling bias in DEPTH units — ortho depth is linear, so world-units ÷ (far − near); the
// merged fills carry no normal attribute, so a normal-slide bias is not available here.
const __csMatU = { value: __csL.shadow.matrix };
const __csMapU = { value: null };
const __csBiasU = { value: 0 };
const __csTexelU = { value: 1 / __CS.mapSize };
function __csFrustum(half) {
  const c = __csL.shadow.camera;
  c.left = -half; c.right = half; c.top = half; c.bottom = -half;
  c.near = 0.5; c.far = half * 5;
  c.updateProjectionMatrix();
  __csBiasU.value = 1.1 / (c.far - c.near);   // ~1.1 world units of contact slack, scale-aware
}
function __csAim(x, y, z, dist) {
  __csL.target.position.set(x, y, z);
  __csL.position.set(x + __csDir.x * dist, y + __csDir.y * dist, z + __csDir.z * dist);
}
__csFrustum(__csR); __csAim(__csC.x, __csC.y, __csC.z, __csR * 2.2);   // FIT: the whole static stage, seated once
let __csFollowing = false;
// the receive patch: project this fragment into the shadow map (r184 renders shadow maps into a
// hardware-compare DepthTexture — sampler2DShadow, texture() returns lit∈[0,1] with free 4-tap
// PCF) and multiply the fill by the occlusion. Injected into each opaque fill's OWN material;
// instanced fills ride the USE_INSTANCING branch.
function __csPatch(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.csMat = __csMatU; sh.uniforms.csMap = __csMapU;
    sh.uniforms.csBias = __csBiasU; sh.uniforms.csTexel = __csTexelU;
    sh.vertexShader = 'uniform mat4 csMat;\\nvarying vec4 vCsCoord;\\n' + sh.vertexShader.replace('#include <project_vertex>', \`#include <project_vertex>
#ifdef USE_INSTANCING
  vCsCoord = csMat * ( modelMatrix * instanceMatrix * vec4( transformed, 1.0 ) );
#else
  vCsCoord = csMat * ( modelMatrix * vec4( transformed, 1.0 ) );
#endif\`);
    sh.fragmentShader = ('uniform sampler2DShadow csMap;\\nuniform float csBias;\\nuniform float csTexel;\\nvarying vec4 vCsCoord;\\n'
      + sh.fragmentShader).replace('#include <dithering_fragment>', \`#include <dithering_fragment>
{
  vec3 sc = vCsCoord.xyz / vCsCoord.w;
  if ( sc.x > 0.0 && sc.x < 1.0 && sc.y > 0.0 && sc.y < 1.0 && sc.z < 1.0 ) {
    float z = sc.z - csBias, t = csTexel * 0.9;
    float lit = 0.25 * ( texture( csMap, vec3( sc.xy + vec2( -t, -t ), z ) )
                       + texture( csMap, vec3( sc.xy + vec2(  t, -t ), z ) )
                       + texture( csMap, vec3( sc.xy + vec2( -t,  t ), z ) )
                       + texture( csMap, vec3( sc.xy + vec2(  t,  t ), z ) ) );
    gl_FragColor.rgb *= 1.0 - ${Number(cfg.alpha).toFixed(3)} * ( 1.0 - lit );
  }
}\`);
  };
  mat.needsUpdate = true;
}
window.__mojCast = {   // the channel's public seam (spikes/debug + dynamic-channel integration)
  light: __csL, dir: __csDir, mapU: __csMapU, biasU: __csBiasU,
  dbg: { renderer, THREE, scene, patch: __csPatch },   // headless spikes drive shadow-pass diagnostics through here
  adopt(root) { root.traverse((o) => { if (o.isMesh && o.material && !o.material.transparent) o.castShadow = true; }); },
  follow(x, y, z) {   // tighten the box to the action (controllable pilot, or any future focus)
    if (!__csFollowing) { __csFollowing = true; __csFrustum(__CS.span); }
    __csAim(x, y, z, __CS.span * 2.2);
  },
};
for (const m of solids) {
  m.castShadow = true;   // static masses cast (walls/buildings shade the ground)${noCastGuard}
  __csPatch(m.material); // …and receive, textured + instanced fills included
  // lazy map bind: the depth target is allocated by the first shadow pass, which runs at the top
  // of the same renderer.render() that first draws these fills — bound by first onBeforeRender.
  m.onBeforeRender = () => { if (!__csMapU.value && __csL.shadow.map) __csMapU.value = __csL.shadow.map.depthTexture; };
}`;
}

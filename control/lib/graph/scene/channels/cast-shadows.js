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
  // Rock-scale subjects: the contact slack (1.1 world units) and the FIT floor (60) were
  // sized for city worlds and swallow a sub-metre caster's shadow. `bias` / `fitMin` override them; the literals are
  // emitted unchanged when a world declares neither, so every existing cast-shadow world stays byte-identical. A
  // declared floor also lets the near plane follow a small box (a fixed 0.5 would clip it).
  const biasLit = Number.isFinite(cfg.bias) && cfg.bias > 0 ? String(cfg.bias) : '1.1';
  const fitMinLit = Number.isFinite(cfg.fitMin) && cfg.fitMin > 0 ? String(cfg.fitMin) : '60';
  const nearExpr = Number.isFinite(cfg.fitMin) && cfg.fitMin > 0 ? 'Math.min(0.5, half * 0.05)' : '0.5';
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
  __csR = Math.min(Math.max(__csR, ${fitMinLit}), 1600);   // degenerate scenes get a floor; huge maps a texel-density cap
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
  c.near = ${nearExpr}; c.far = half * 5;
  c.updateProjectionMatrix();
  __csBiasU.value = ${biasLit} / (c.far - c.near);   // ~1.1 world units of contact slack, scale-aware
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

// In-page script: LIVE LIGHT's shadows (opt-in world `shadows.actors` / `shadows.hour`, scene/live-light.js), the cast
// channel split by what moves. Same rig as above (MeshBasic fills patched in place, hardware-compare depth maps, FIT and
// FOLLOW), two maps instead of one:
//   • ACTORS: only what moves casts (the pilot and the seats' bodies, walkers, cars, fauna on the ground, a subtree a
//     channel hands to `adopt`), into a map three draws each frame; the static world never casts there, it receives;
//   • HOUR: the static world in its own map (`__hrL`), drawn once at load, and again only when `__mojCast.hour([x, y,
//     z])` is called: its shadow's `autoUpdate` is off, so three skips it on every other frame.
//     THE SUN DOES NOT MOVE, live or within a level (the operator's principle, era/geocube-hours.js): the `hour` seam
//     redraws the static map for a recipe's hour once at load; it is not a clock. Never drive it per frame or on a timer.
//     For the frame it is drawn, the static solids cast and the actors do not, and the actors' map holds its last
//     frame (the same frame's map would hold the static world). `__mojHourPass` (spliced before every render) arms it
//     and restores the flags on the next frame.
// The receive patch reads both (the nearer occluder wins: lit = min) and darkens a fragment by its SUN SHARE where the
// world bakes its sun (the `aSun` attribute, the bake's `sunShare`: an actor's shadow takes a lit floor down to the
// baked shade beside it, and a corner already in the baked shadow is not darkened again), else by the cast's alpha. A
// patch chains whatever patch the material carries already. `__mojLight` counts the frames, the hour map's arms
// (`hourMaps`) and the renders that drew it (`hourDraws`).
// INDOORS (`cfg.indoor`: the world declares itself an interior, so its bake has no sun): the hour is never drawn (there
// is no sun to move; `hour()` is a no-op), and the actors' map is drawn from BELOW, straight up (`cfg.toLight` points
// down): what it holds per texel is the lowest surface of what moves above it. A receiver darkens by how much of a small
// disc round it has something standing within a hand, a knee and a hip's height above it (and nothing below it): a soft
// CONTACT BLOB under each actor, darkest under the feet, fading as it leaves the floor, never a sun-directed shadow.
// THE FOCUS: a channel with a focus (the controllable: the pilot, or the seats' centre) hands `__mojCast.focus(fn)` a
// function that answers [x, y, z, spread]; the pass before every render (captures included, which never step) asks it
// and seats the actors' box round it, so the box is tight from the first frame. Without a focus the box stays FIT.
export function liveShadowScript(cfg) {
  const A = !!cfg.actors, H = !!cfg.hour, B = A && !!cfg.indoor;
  // the blob's three bands, in world units: the height above the receiver, the disc's radius, the weight
  const u = cfg.unit || 1, wl = (m) => (Math.round((m / u) * 1e4) / 1e4).toFixed(4);   // (a GLSL float: always a point)
  // seating the actors' box (half-width, centre): indoors it also hands the blob its units
  const seatA = (args) => {
    if (B) return `__csSeatA(${args})`;
    const [half, ...xyz] = args.split(/, (?![^(]*\))/);
    return `__csSeat(__csL, __csBiasU, ${half}, ${xyz.join(', ')}, __csActorBias)`;
  };
  const fitMinLit = Number.isFinite(cfg.fitMin) && cfg.fitMin > 0 ? String(cfg.fitMin) : '60';
  const noCast = Array.isArray(cfg.noCast) && cfg.noCast.length;
  const light = (v) => `const ${v} = new THREE.DirectionalLight(0xffffff, 1);   // invisible to the MeshBasic fills: only its shadow camera matters
${v}.castShadow = true; ${v}.shadow.mapSize.set(__CS.mapSize, __CS.mapSize);
scene.add(${v}); scene.add(${v}.target);`;
  // (the hour's map is read with its receiver's slope in its bias, csLitR: the static world casts and receives there)
  const tap = (p) => `csLit${p === 'hr' ? 'R' : ''}( ${p}Map, v${p === 'cs' ? 'Cs' : 'Hr'}Coord, ${p}Bias, ${p}Texel )`;
  const litExpr = B ? '1.0 - csBlob( csMap, vCsCoord )' : A && H ? `min( ${tap('cs')}, ${tap('hr')} )` : A ? tap('cs') : tap('hr');
  const vDecl = [A ? 'uniform mat4 csMat;\\nvarying vec4 vCsCoord;\\n' : '', H ? 'uniform mat4 hrMat;\\nvarying vec4 vHrCoord;\\n' : ''].join('');
  const fDecl = [A ? `uniform sampler2DShadow csMap;\\nuniform float csBias;\\nuniform float csTexel;\\n${B ? 'uniform vec2 csBlobK;\\n' : ''}varying vec4 vCsCoord;\\n` : '', H ? 'uniform sampler2DShadow hrMap;\\nuniform float hrBias;\\nuniform float hrTexel;\\nvarying vec4 vHrCoord;\\n' : ''].join('');
  const what = [A ? (B ? 'what moves lays a contact blob each frame (indoors)' : 'what moves casts each frame') : '', H ? 'the static world its own map, drawn when the hour changes' : ''].filter(Boolean).join('; ');
  return `
// --- live light (opt-in world 'shadows.${[A ? 'actors' : '', H ? 'hour' : ''].filter(Boolean).join(' + ')}'): ${what} ---
const __CS = ${safeJson(cfg)};
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const __mojLight = window.__mojLight = Object.assign(window.__mojLight || {}, { frames: 0${H ? ', hourMaps: 0, hourDraws: 0' : ''} });
const __csDir = new THREE.Vector3(__CS.toLight[0], __CS.toLight[1], __CS.toLight[2]).normalize();
// FIT bounds: the static solids' union (the cast channel's)
const __csC = new THREE.Vector3(); let __csR = 0;
{
  let n = 0;
  for (const m of solids) { if (m.geometry.boundingSphere) { __csC.add(m.geometry.boundingSphere.center); n++; } }
  if (n) __csC.multiplyScalar(1 / n);
  for (const m of solids) {
    const bs = m.geometry.boundingSphere;
    if (bs) __csR = Math.max(__csR, __csC.distanceTo(bs.center) + bs.radius);
  }
  __csR = Math.min(Math.max(__csR, ${fitMinLit}), 1600);
}
// a box round (x, y, z), \`half\` across, aimed along the sun; its constant-depth bias in DEPTH units (ortho depth is linear)
function __csSeat(L, biasU, half, x, y, z, bias) {
  const c = L.shadow.camera;
  c.left = -half; c.right = half; c.top = half; c.bottom = -half;
  c.near = Math.min(0.5, half * 0.05); c.far = half * 5;
  c.updateProjectionMatrix();
  biasU.value = bias / (c.far - c.near);
  L.target.position.set(x, y, z);
  L.position.set(x + __csDir.x * half * 2.2, y + __csDir.y * half * 2.2, z + __csDir.z * half * 2.2);
}
const __csStatic = new Set(solids);${noCast ? `
const __csNoCast = (m) => !!(m.userData && __CS.noCast.indexOf(m.userData.g) !== -1);   // a roof/ceiling receives but never casts` : ''}${A ? `
// THE ACTORS' MAP: in the scene, drawn by three each frame; only what moves casts into it. The static solids receive
// and never cast there, so a receiver never shadows itself and the bias is only the contact's (a few centimetres)
${light('__csL')}
const __csMatU = { value: __csL.shadow.matrix }, __csMapU = { value: null }, __csBiasU = { value: 0 }, __csTexelU = { value: 1 / __CS.mapSize };
// (a contact's bias, a few millimetres: no receiver casts here, so there is no self-shadowing to hide)
const __csActorBias = __CS.bias || 0.005 / (__CS.unit || 1);${B ? `
// (the blob reads its bands in the map's own units: depth per world unit, map uv per world unit)
const __csBlobU = { value: new THREE.Vector2() };` : ''}
${B ? `const __csSeatA = (half, x, y, z) => { __csSeat(__csL, __csBiasU, half, x, y, z, __csActorBias); const c = __csL.shadow.camera; __csBlobU.value.set(1 / (c.far - c.near), 1 / (2 * half)); };
` : ''}${seatA('__csR, __csC.x, __csC.y, __csC.z')};   // FIT until a focus follows
let __csFollowing = false, __csFocus = null;${cfg.lead ? ' const __csFw = new THREE.Vector3();' : ''}
const __csSteer = () => { const f = __csFocus && __csFocus(); if (f) window.__mojCast.follow(f[0], f[1], f[2], f[3] || 0); };` : ''}${H ? `
// THE HOUR'S MAP: in the scene, its autoUpdate off, so three draws it only when __mojHourPass arms it (at load, and
// when the hour changes); FIT over the whole static stage, its bias a few of its own texels (statics cast and receive)
${light('__hrL')}
__hrL.shadow.autoUpdate = false; __hrL.shadow.needsUpdate = false;
const __hrMatU = { value: __hrL.shadow.matrix }, __hrMapU = { value: null }, __hrBiasU = { value: 0 }, __hrTexelU = { value: 1 / __CS.mapSize };
const __hrSeat = () => __csSeat(__hrL, __hrBiasU, __csR, __csC.x, __csC.y, __csC.z, __CS.hourBias || 6 * __csR / __CS.mapSize);
__hrSeat();
let __hrDirty = true, __hrArmed = null;
// (an honest count of the renders that drew it: a static solid's onBeforeShadow under the hour's camera, once a render)
let __hrStamp = -1;
const __hrSeen = (r, o, cam, shCam) => { if (shCam === __hrL.shadow.camera && __hrStamp !== renderer.info.render.frame) { __hrStamp = renderer.info.render.frame; __mojLight.hourDraws++; } };
const __mojHourPass = () => {
  __mojLight.frames++;${A ? `
  __csSteer();` : ''}
  if (__hrArmed) {   // the frame after: the flags back, the actors' map live again
    for (const [o, c] of __hrArmed) o.castShadow = c;
    __hrArmed = null;${A ? `
    __csL.shadow.autoUpdate = true;` : ''}
  }
  if (!__hrDirty) return;
  __hrDirty = false; __hrArmed = [];
  scene.traverse((o) => {
    if (!(o.isMesh || o.isLine || o.isPoints)) return;
    const want = __csStatic.has(o)${noCast ? ' && !__csNoCast(o)' : ''};
    if (o.castShadow !== want) { __hrArmed.push([o, o.castShadow]); o.castShadow = want; }
  });
  __hrL.shadow.needsUpdate = true;${A ? `
  __csL.shadow.autoUpdate = false; __csL.shadow.needsUpdate = false;   // (this frame its map would hold the static world)` : ''}
  __mojLight.hourMaps++;
};` : `
const __mojHourPass = () => { __mojLight.frames++;${A ? ' __csSteer();' : ''} };`}
// the receive patch, chained over the material's own: project the fragment into each map (four taps of hardware PCF)
// and darken by its sun share (aSun, where the world bakes its sun) or the cast's alpha
const __csVS = '${vDecl}#ifdef CS_SUN\\nattribute float aSun;\\nvarying float vCsSun;\\n#endif\\n';
const __csFS = '${fDecl}#ifdef CS_SUN\\nvarying float vCsSun;\\n#endif\\n'
  + 'float csLit( sampler2DShadow map, vec4 co, float bias, float texel ) {\\n'
  + '  vec3 sc = co.xyz / co.w;\\n'
  + '  if ( !( sc.x > 0.0 && sc.x < 1.0 && sc.y > 0.0 && sc.y < 1.0 && sc.z < 1.0 ) ) return 1.0;\\n'
  + '  float z = sc.z - bias, t = texel * 0.9;\\n'
  + '  return 0.25 * ( texture( map, vec3( sc.xy + vec2( -t, -t ), z ) ) + texture( map, vec3( sc.xy + vec2( t, -t ), z ) )\\n'
  + '                + texture( map, vec3( sc.xy + vec2( -t, t ), z ) ) + texture( map, vec3( sc.xy + vec2( t, t ), z ) ) );\\n}\\n'${H ? `
  // the hour's map, where the static world shadows itself: the bias grows with the receiver's own slope in the map (its
  // light-space depth's derivatives, solved for dz/du and dz/dv), a texel and a half's climb, capped at eight times the
  // map's own; without it a low sun over wide terrain lays the map's steps on the ground as moire (live-light.js receiverBias)
  + 'float csLitR( sampler2DShadow map, vec4 co, float bias, float texel ) {\\n'
  + '  vec3 sc = co.xyz / co.w, dx = dFdx( sc ), dy = dFdy( sc );\\n'
  + '  float det = dx.x * dy.y - dx.y * dy.x;\\n'
  + '  vec2 g = abs( det ) > 1e-14 ? vec2( dy.y * dx.z - dx.y * dy.z, dx.x * dy.z - dy.x * dx.z ) / det : vec2( 0.0 );\\n'
  + '  return csLit( map, co, bias + min( 8.0 * bias, 1.5 * texel * ( abs( g.x ) + abs( g.y ) ) ), texel );\\n}\\n'` : ''}${B ? `
  // the contact blob: per band, the share of a disc (its centre and six round it) whose lowest actor surface stands
  // above this receiver within the band's height (the map is drawn from below: depth grows upward) with nothing below
  + 'float csBlob( sampler2DShadow map, vec4 co ) {\\n'
  + '  vec3 sc = co.xyz / co.w;\\n'
  + '  if ( !( sc.x > 0.0 && sc.x < 1.0 && sc.y > 0.0 && sc.y < 1.0 && sc.z > 0.0 && sc.z < 1.0 ) ) return 0.0;\\n'
  + '  float o = 0.0, lo = sc.z - ${wl(0.02)} * csBlobK.x;\\n'
  + '  for ( int j = 0; j < 3; j++ ) {\\n'
  + '    float h = sc.z + ( j == 0 ? ${wl(0.12)} : j == 1 ? ${wl(0.45)} : ${wl(1)} ) * csBlobK.x, r = ( j == 0 ? ${wl(0.1)} : j == 1 ? ${wl(0.2)} : ${wl(0.32)} ) * csBlobK.y, w = j == 0 ? 0.45 : j == 1 ? 0.35 : 0.2;\\n'
  + '    for ( int i = 0; i < 7; i++ ) {\\n'
  + '      float a = float( i ) * 1.0472 + float( j ) * 0.5236;\\n'
  + '      vec2 q = sc.xy + ( i == 6 ? vec2( 0.0 ) : r * vec2( cos( a ), sin( a ) ) );\\n'
  + '      o += w * max( 0.0, texture( map, vec3( q, lo ) ) - texture( map, vec3( q, h ) ) );\\n'
  + '    }\\n  }\\n'
  + '  return min( 1.0, o * 2.5 / 7.0 );\\n}\\n'` : ''};
function __csPatch(m) {
  const mat = m.material;
  if (!mat || mat.userData.__live) return;
  mat.userData.__live = true;
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey && mat.customProgramCacheKey.call(mat);
  if (m.geometry && m.geometry.getAttribute('aSun')) mat.defines = Object.assign({}, mat.defines, { CS_SUN: '' });
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(mat, sh, r);
    ${[A ? `sh.uniforms.csMat = __csMatU; sh.uniforms.csMap = __csMapU; sh.uniforms.csBias = __csBiasU; sh.uniforms.csTexel = __csTexelU;${B ? ' sh.uniforms.csBlobK = __csBlobU;' : ''}` : '', H ? 'sh.uniforms.hrMat = __hrMatU; sh.uniforms.hrMap = __hrMapU; sh.uniforms.hrBias = __hrBiasU; sh.uniforms.hrTexel = __hrTexelU;' : ''].filter(Boolean).join('\n    ')}
    sh.vertexShader = __csVS + sh.vertexShader.replace('#include <project_vertex>', \`#include <project_vertex>
#ifdef USE_INSTANCING
  vec4 csW = modelMatrix * instanceMatrix * vec4( transformed, 1.0 );
#else
  vec4 csW = modelMatrix * vec4( transformed, 1.0 );
#endif
${A ? '  vCsCoord = csMat * csW;\n' : ''}${H ? '  vHrCoord = hrMat * csW;\n' : ''}#ifdef CS_SUN
  vCsSun = aSun;
#endif\`);
    sh.fragmentShader = (__csFS + sh.fragmentShader).replace('#include <dithering_fragment>', \`#include <dithering_fragment>
{
  float lit = ${litExpr};
#ifdef CS_SUN
  float k = vCsSun;
#else
  float k = ${Number(cfg.alpha).toFixed(3)};
#endif
  gl_FragColor.rgb *= 1.0 - k * ( 1.0 - lit );
}\`);
  };
  mat.customProgramCacheKey = () => 'mojulo-live-light|' + (prevKey || '');
  mat.needsUpdate = true;
}
window.__mojCast = {   // the channel's public seam: dynamic channels hand their casters in, a focus steers the box, the hour moves the sun
  dir: __csDir, dbg: { renderer, THREE, scene, patch: __csPatch },${A ? `
  light: __csL, mapU: __csMapU, biasU: __csBiasU,
  // a subtree that moves (a channel's bodies): its opaque meshes cast into the actors' map, both sides drawn into it (a
  // single-sided mesh casts by its back faces, and a foot's sole is then the floor's own depth: the contact lost)
  adopt(root) { root.traverse((o) => { if (o.isMesh && o.material && !o.material.transparent) { o.castShadow = true; if (o.material.shadowSide == null) o.material.shadowSide = THREE.DoubleSide; } }); },
  // tighten the actors' box round the action (the pilot, or the seats' centre with \`r\` their spread)
  follow(x, y, z, r = 0) {
    __csFollowing = true;${cfg.lead ? `
    // one focus (no seats' spread): the box led ahead along the camera's ground, where the frame looks, the hero kept
    // inside it behind its middle
    if (!r) { camera.getWorldDirection(__csFw); x += __csFw.x * __CS.lead; y += __csFw.y * __CS.lead; }` : ''}
    ${seatA('Math.max(__CS.span, r + __CS.span * 0.5), x, y, z')};
  },
  // the focus the box follows, asked before every render: fn() → [x, y, z, spread] (or nothing: the box stays)
  focus(fn) { __csFocus = typeof fn === 'function' ? fn : null; },` : `
  adopt() {}, follow() {}, focus() {},`}${H ? `
  hourLight: __hrL, hourMapU: __hrMapU,
  // the recipe's hour (toward its sun, z-up): the static map drawn for it on the next frame. THE SUN DOES NOT MOVE,
  // live or within a level: this redraws the map once at load for the hour a recipe names; it is not a clock, and is
  // never driven per frame or on a timer
  hour(toLight) { if (toLight) __csDir.set(toLight[0], toLight[1], toLight[2]).normalize(); __hrSeat();${A ? ` if (!__csFollowing) ${seatA('__csR, __csC.x, __csC.y, __csC.z')};` : ''} __hrDirty = true; },` : cfg.indoor ? `
  hour() {},   // indoors: no sun to move` : ''}
};
for (const m of solids) {
  m.castShadow = false;   // the static world receives; ${H ? 'it casts only into the hour\'s map, when that is drawn' : 'what moves casts'}
  __csPatch(m);           // textured, instanced and sun-shared fills included
  // lazy map binds: a map exists after its first shadow pass, at the top of the render that first draws these fills
  m.onBeforeRender = () => {${A ? ' if (!__csMapU.value && __csL.shadow.map) __csMapU.value = __csL.shadow.map.depthTexture;' : ''}${H ? ' if (!__hrMapU.value && __hrL.shadow.map) __hrMapU.value = __hrL.shadow.map.depthTexture;' : ''} };${H ? `
  m.onBeforeShadow = __hrSeen;` : ''}
}`;
}

// In-page script: the LIVE LIGHT'S BUDGET (a page world-scene gave a tier: scene/live-light.js liveLightDefaults), what
// the page draws a frame, counted (never timed: a software GPU's milliseconds mean nothing). It wraps the renderer's
// render (every scene render: the frame, the prepass, the occlusion and ink passes) and its shadow map's (the maps drawn
// inside a render and the draws they took, from the renderer's own call count either side of it); a render to the screen
// closes a frame. `__mojLight.budget()` → { tier, frames, frame: the last frame's { renders, shadowPasses, shadowMaps,
// shadowDraws, draws }, maps: the shadow maps' sizes, targets: the live passes' render targets' sizes }.
export function liveBudgetScript(T) {
  return `
// --- live light's budget (tier '${T.tier}'): what the page draws a frame, counted ---
{
  const __lbL = window.__mojLight = Object.assign(window.__mojLight || {}, { tier: '${T.tier}' });
  let __lbCur = { renders: 0, shadowPasses: 0, shadowMaps: 0, shadowDraws: 0, draws: 0 }, __lbLast = null, __lbFrames = 0;
  const __lbR = renderer.render.bind(renderer), __lbSM = renderer.shadowMap, __lbS = __lbSM.render.bind(__lbSM);
  renderer.render = (s, c) => {
    __lbCur.renders++;
    const out = __lbR(s, c);
    __lbCur.draws += renderer.info.render.calls;
    if (renderer.getRenderTarget() === null && s === scene) { __lbLast = __lbCur; __lbFrames++; __lbCur = { renders: 0, shadowPasses: 0, shadowMaps: 0, shadowDraws: 0, draws: 0 }; }
    return out;
  };
  __lbSM.render = (lights, s, c) => {
    let n = 0;
    if (__lbSM.enabled && (__lbSM.autoUpdate || __lbSM.needsUpdate)) for (const l of lights) if (l.castShadow && (l.shadow.autoUpdate || l.shadow.needsUpdate)) n++;
    const c0 = renderer.info.render.calls, out = __lbS(lights, s, c);
    if (n) { __lbCur.shadowPasses++; __lbCur.shadowMaps += n; __lbCur.shadowDraws += renderer.info.render.calls - c0; }
    return out;
  };
  const __lbSize = (t) => (t ? [t.width, t.height] : null);
  __lbL.budget = () => {
    const maps = [];
    scene.traverse((o) => { if (o.isLight && o.castShadow && o.shadow) maps.push(o.shadow.mapSize.x); });
    const targets = {};
    if (typeof __crRT !== 'undefined') targets.prepass = __lbSize(__crRT);
    if (typeof __aoRT !== 'undefined') targets.occlusion = __lbSize(__aoRT);
    if (typeof __crInkRT !== 'undefined') targets.ink = __lbSize(__crInkRT);
    return { tier: '${T.tier}', frames: __lbFrames, frame: __lbLast, maps, targets };
  };
}`;
}

import { safeJson } from '../emit-util.js';

// In-page script: THE FORM RENDER INDOORS (gen-7: form/room-light.js, form/room-form.js, era/stage.js). The build baked the
// room as a lightmap is, its colour and its light apart: each corner its base (the colour its palette asks for under no
// light) and its light (`aLit`, linear: the ambient, every lamp by its solved key where it can see the corner, the bounce),
// and read each tile as material (its colour under no light, a tangent-space normal, occlusion + roughness + height). Here
// each surface's material (three's MeshBasicMaterial, as the paint's: no light of three's is evaluated) multiplies its
// colour by that light, and adds only what a bake cannot hold, near the eye (its frame from the screen's derivatives).
//
//   colour    the tile divided by its mean (`mean`), times the corner's base: the base sets the colour, the tile the detail
//   bake      the corner's light as the indirect (the tile's occlusion darkens it): out = base × light, the solve's law
//   relief    the `live` lamps nearest the eye (no shadow maps): what each does to the relief, the normal map's slope
//             against the face's own (its light at the pixel's normal less its light at the face's), and its sheen; both
//             scaled by how lit the bake says that spot is by them (the baked light over what they would lay unshadowed),
//             so nothing shines in a baked shadow. A lamp coming into the set fades in, one leaving fades out; far off
//             (`relief`: the distances it fades out between) a pixel is its bake alone
//   parallax  near the eye each tile's height (the ORM's blue, 1 the crest) is marched along the view (`pom`: steps, and the
//             distances it fades out between), so a joint sinks and a stone stands; far off the map lies flat
//   tone      the frame is tone-mapped (three's Neutral, exposure 1: what the solve solved for)
//
// A mesh with no baked light, and the `keep` groups (the torches' flames and iron, glass), stay as built and untoned. The
// live light's actors' shadow (channels/cast-shadows.js) patches these materials as it patched the paint's.
// `__mojForm` is the machine gate's probe: the lamps, the live set, the maps and how each was read, the materials made.
// Absent `form` ⇒ NOT emitted.
// `cfg`: { lights: [{ at, key, radius, live }], ambient: [r, g, b] (linear), fall, maps: { key: { normal?, orm?, read,
//          depth?, mean } }, live, pom: { steps, near, far }, relief: { near, far }, keep: [group], void?: '#rrggbb' (a toned room's) }
export function formScript(cfg) {
  return `
// --- form: a room's surfaces as material over its baked light (gen-7) ---
const __mojForm = (function () {
  const F = ${safeJson(cfg)}, keep = new Set(F.keep), loader = new THREE.TextureLoader(), K = Math.max(1, F.live);
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1;
  const U = { uFLp: { value: Array.from({ length: K }, () => new THREE.Vector3()) }, uFLk: { value: Array.from({ length: K }, () => new THREE.Vector3()) },
    uFLr: { value: new Array(K).fill(1) }, uFFall: { value: F.fall }, uFAmb: { value: new THREE.Vector3(...F.ambient) }, uFPom: { value: new THREE.Vector4(F.pom.near, F.pom.far, F.relief.near, F.relief.far) } };
  const VERT = 'attribute vec3 aLit;\\nvarying vec3 vFLit;\\nvarying vec3 vFPos;\\n';
  const FRAG = 'uniform vec3 uFLp[' + K + '];\\nuniform vec3 uFLk[' + K + '];\\nuniform float uFLr[' + K + '];\\nuniform float uFFall;\\nuniform vec3 uFAmb;\\nuniform vec4 uFPom;\\nuniform vec3 uFMean;\\nuniform float uFDepth;\\nuniform sampler2D uFNorm;\\nvarying vec3 vFLit;\\nvarying vec3 vFPos;\\n'
    + 'float fLum( vec3 c ) { return dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ); }\\n';
  // the face's own frame from the screen's derivatives (its normal, and the tile's directions on it), then the parallax:
  // the tile's height marched along the view in that frame, near the eye
  const POM = \`vec3 fq0 = dFdx( vFPos ), fq1 = dFdy( vFPos ), fN = normalize( cross( fq0, fq1 ) ), fT = vec3( 0.0 ), fB = vec3( 0.0 );
float fD = length( vFPos );
#ifdef USE_MAP
  vec2 fUV = vMapUv, fs0 = dFdx( vMapUv ), fs1 = dFdy( vMapUv );
  { vec3 q1p = cross( fq1, fN ), q0p = cross( fN, fq0 ); fT = q1p * fs0.x + q0p * fs1.x; fB = q1p * fs0.y + q0p * fs1.y;
    fT = dot( fT, fT ) > 0.0 ? normalize( fT ) : fT; fB = dot( fB, fB ) > 0.0 ? normalize( fB ) : fB; }
#else
  vec2 fUV = vec2( 0.0 );
#endif
#if defined( FORM_POM ) && defined( USE_AOMAP ) && defined( USE_MAP )
{
  float fk = 1.0 - smoothstep( uFPom.x, uFPom.y, fD );
  if ( fk > 0.0 ) {
    vec3 V = - vFPos / fD, vt = vec3( dot( V, fT ), dot( V, fB ), dot( V, fN ) );
    vec2 dP = vt.xy / max( abs( vt.z ), 0.25 ) * uFDepth * fk / float( FORM_POM );
    float lay = 0.0, hh = 1.0 - textureGrad( aoMap, fUV, fs0, fs1 ).b;
    for ( int k = 0; k < FORM_POM; k++ ) { if ( lay >= hh ) break; fUV -= dP; hh = 1.0 - textureGrad( aoMap, fUV, fs0, fs1 ).b; lay += 1.0 / float( FORM_POM ); }
  }
}
#endif
\`;
  // (the chunks that read the tile, read where the march landed)
  const at = (chunk, uv) => THREE.ShaderChunk[chunk].split(uv).join('fUV');
  const MAP = POM + at('map_fragment', 'vMapUv') + '\\n#ifdef USE_MAP\\n  diffuseColor.rgb /= uFMean;\\n#endif\\n';
  // the bake as the light (the tile's occlusion darkens it), and near the eye what the live lamps add to the relief: the
  // normal map against the face's own, and a sheen (normalised Blinn-Phong at the tile's roughness, a dielectric's 4%)
  const LIGHT = \`reflectedLight.indirectDiffuse *= vFLit;
\` + at('aomap_fragment', 'vAoMapUv') + \`
vec3 fDirect = vec3( 0.0 );
#if defined( FORM_RELIEF ) && defined( USE_AOMAP )
float fNear = 1.0 - smoothstep( uFPom.z, uFPom.w, fD );
if ( fNear > 0.0 ) {
  vec3 tn = texture2D( uFNorm, fUV ).xyz * 2.0 - 1.0, n = normalize( fT * tn.x + fB * tn.y + fN * tn.z ), V = - vFPos / fD;
  float rough = max( texture2D( aoMap, fUV ).g, 0.08 ), shine = clamp( 2.0 / ( rough * rough * rough * rough ) - 2.0, 1.0, 512.0 );
  vec3 fSum = vec3( 0.0 ), fAdd = vec3( 0.0 ), fSpec = vec3( 0.0 );
  for ( int i = 0; i < \${K}; i++ ) {
    vec3 d = uFLp[ i ] - vFPos; float r = length( d ); vec3 L = d / max( r, 1e-3 );
    float t = clamp( 1.0 - max( r, 1.1 ) / uFLr[ i ], 0.0, 1.0 );
    vec3 c = uFLk[ i ] * pow( t * t, uFFall );
    float ng = max( dot( fN, L ), 0.0 ), np = max( dot( n, L ), 0.0 );
    fSum += c * ng; fAdd += c * ( np - ng );
    fSpec += c * np * 0.04 * ( shine + 8.0 ) / 8.0 * pow( max( dot( n, normalize( L + V ) ), 0.0 ), shine );
  }
  float fVis = fNear * clamp( ( fLum( vFLit ) - fLum( uFAmb ) ) / max( fLum( fSum ), 1e-3 ), 0.0, 1.0 );
  fDirect = fVis * ( fAdd * diffuseColor.rgb + fSpec );
}
#endif
\`;
  const lit = (params, M) => {
    const mat = new THREE.MeshBasicMaterial(params);
    const pom = M && M.depth > 0 && F.pom.steps > 0 ? F.pom.steps : 0, relief = !!(M && M.normal);
    mat.defines = { ...(pom ? { FORM_POM: pom } : {}), ...(relief ? { FORM_RELIEF: 1 } : {}) };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U, { uFMean: { value: new THREE.Vector3(...(M ? M.mean : [1, 1, 1])) }, uFDepth: { value: M && M.depth ? M.depth : 0 }, uFNorm: { value: relief ? M.normal : null } });
      sh.vertexShader = VERT + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\\n  vFLit = aLit;\\n  vFPos = mvPosition.xyz;');
      sh.fragmentShader = FRAG + sh.fragmentShader.replace('#include <map_fragment>', MAP)
        .replace('#include <aomap_fragment>', LIGHT)
        .replace('vec3 outgoingLight = reflectedLight.indirectDiffuse;', 'vec3 outgoingLight = reflectedLight.indirectDiffuse + fDirect;');
    };
    mat.customProgramCacheKey = () => 'form-room' + pom + (relief ? 'r' : '');
    return mat;
  };
  const map = (url) => { const t = loader.load(url); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = THREE.NoColorSpace; t.channel = 0; return t; };
  const maps = {}, made = { material: 0, colour: 0, pom: 0 };
  for (const [k, m] of Object.entries(F.maps)) maps[k] = { ...m, normal: m.normal ? map(m.normal) : null, orm: m.orm ? map(m.orm) : null };
  // every surface of the room that carries its baked light; the rest keep their look, untoned
  scene.traverse((o) => {
    if (!o.material) return;
    const b = o.material;
    if (!o.isMesh || o.isInstancedMesh || !b.isMeshBasicMaterial || typeof o.userData.g !== 'string' || keep.has(o.userData.g) || !o.geometry.getAttribute('aLit')) { (Array.isArray(b) ? b : [b]).forEach((m) => { m.toneMapped = false; }); return; }
    const M = maps[o.userData.key];
    o.material = lit({ map: b.map, vertexColors: b.vertexColors, side: b.side, transparent: b.transparent, opacity: b.opacity, depthWrite: b.depthWrite, alphaTest: b.alphaTest,
      ...(M && M.orm ? { aoMap: M.orm } : {}) }, M);
    if (M && M.normal) made.material++; else made.colour++;
    if (M && M.depth > 0 && F.pom.steps > 0) made.pom++;
  });
  // the live set: the nearest lamps that may light the relief, each slot fading to its next lamp
  const lamps = F.lights.map((l, i) => ({ i, at: new THREE.Vector3(...l.at), key: new THREE.Vector3(...l.key), r: l.radius })).filter((l, i) => F.lights[i].live);
  const slots = Array.from({ length: Math.min(F.live, lamps.length) }, () => ({ lamp: null, next: null, w: 0 }));
  const eye = new THREE.Vector3(), tmp = new THREE.Vector3();
  let lastPick = -1, lastT = -1;
  const pick = () => {
    const want = lamps.map((l) => [l, l.at.distanceToSquared(eye)]).sort((a, b) => a[1] - b[1] || a[0].i - b[0].i).slice(0, slots.length).map(([l]) => l);
    const held = new Set(slots.map((s) => s.next || s.lamp));
    const free = slots.filter((s) => !(s.next || s.lamp) || !want.includes(s.next || s.lamp));
    for (const l of want) if (!held.has(l)) { const s = free.shift(); if (s) s.next = l; }
    for (const s of slots) if (s.next === s.lamp) s.next = null;
  };
  const probe = { lamps: lamps.length, live: slots.length, made, reads: Object.fromEntries(Object.entries(F.maps).map(([k, m]) => [k, m.read])), on: () => slots.map((s) => (s.lamp ? s.lamp.i : -1)) };
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = function (r, s, cam, rt) {
    if (prev) prev.call(this, r, s, cam, rt);
    if (rt) return;
    const t = performance.now(), dt = lastT < 0 ? 1 : Math.min(0.1, (t - lastT) / 1000);
    lastT = t;
    cam.getWorldPosition(eye);
    // (a toned room's void and its haze are its ramp's darkest colour, as its toned page paints them: set at the first
    // frame, after the page's own haze has laid its colour)
    if (F.void && !probe.first) { scene.background = new THREE.Color(F.void); if (scene.fog) scene.fog.color.set(F.void); }
    if (t - lastPick > 250) { lastPick = t; pick(); }
    slots.forEach((sl, k) => {
      // (a slot taking a new lamp fades its old one out first, then the new one in; the first frame's come in whole)
      if (sl.next && (!sl.lamp || sl.w < 0.02)) { sl.lamp = sl.next; sl.next = null; }
      sl.w = !sl.lamp ? 0 : !probe.first ? 1 : sl.w + ((sl.next ? 0 : 1) - sl.w) * Math.min(1, dt * 8);
      U.uFLp.value[k].copy(sl.lamp ? sl.lamp.at : tmp.set(0, 0, -1e4)).applyMatrix4(cam.matrixWorldInverse);
      U.uFLk.value[k].copy(sl.lamp ? sl.lamp.key : tmp.set(0, 0, 0)).multiplyScalar(sl.w);
      U.uFLr.value[k] = sl.lamp ? sl.lamp.r : 1;
    });
    probe.first = true;
  };
  return probe;
})();
window.__mojForm = __mojForm;
`;
}

/** The page's defaults under a form cfg: how many lamps light the relief live and the distances that fades out between,
 *  the parallax (its steps, and the distances it fades out between), the groups kept as built. */
export const FORM_PAGE = Object.freeze({ live: 4, pom: Object.freeze({ steps: 6, near: 4, far: 8 }), relief: Object.freeze({ near: 12, far: 22 }), keep: Object.freeze(['stage:fixture', 'stage:glass']) });

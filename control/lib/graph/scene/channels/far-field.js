// THE FAR FIELD: what gameplay's camera (POV) draws past the view cone's reach (channels/view-cone.js), where the eye
// cannot resolve what is there and the page paints an impression instead, in the one pass it already draws. Mojulo web
// only.
//
//   the blanket  (FAR_BLANKET_GLSL, in the ground's own shader, channels/form-land.js) the grass past the reach
//                is its colour on the ground, nothing standing: the grass's (a standing drift's where one holds the
//                cell), offset by its cell's dice, lit and shadowed as the ground is, and SPECKLED: world-anchored
//                specks about FAR_FIELD.speck.px pixels at their distance (the grain snapped to powers of two, so it
//                holds while the eye walks), each a flower's colour where flowers grow, a weed's head in the weeds'
//                loose patches (their own `cell`), or a lighter or a darker fleck (FAR_FIELD.speck). It reads the
//                grass's FAR MAP (channels/form-grass.js `window.__formFar`: a strand a cell, its colour slot and
//                dice). No draw, no triangle
//   aerial       (a cutscene's camera, the grass's `aerial`) draws the whole field live: no blanket
//
// The contour technique (form/survey.js contourScan: the land's silhouette solved from a point of view) is kept for
// the objects that stand past the reach (trees, rocks, buildings), not the grass: a stroke tall enough to see there
// reads as a tree. `window.__formFarField` ({ on, set(bool) }) and F toggle the far field on a walkable page.
export const FAR_FIELD = Object.freeze({
  blend: 0.9,
  tone: Object.freeze([0.85, 1.15]),
  speck: Object.freeze({ px: 1.5, flowers: 0.3, weeds: 0.12, light: 0.1, dark: 0.1, lift: 1.3, shade: 0.7 }),
});

const C = FAR_FIELD, S = C.speck;

/** The blanket, in the ground's fragment shader: its uniforms and `farBlanket(P, nW)` → the blanket's albedo over the
 *  ground point P (rgb) and its weight (a: 0 inside the reach, 1 past it, eased in over the last of it). */
export const FAR_BLANKET_GLSL = `uniform sampler2D tFarG;
uniform vec2 uFGo;
uniform ivec2 uFGn;
uniform float uFGc, uFGfl[ 16 ], uFarOn, uFarR, uFarPxm, uFGweedN, uFGweedS, uFGweedC;
uniform vec3 uFGcol[ 16 ], uFGweed[ 4 ];
float farHash( vec2 p ) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }
vec4 farBlanket( vec3 P, vec3 nW ) {
  if ( uFarOn < 0.5 || nW.z < 0.5 ) return vec4( 0.0 );
  float d = length( P.xy - cameraPosition.xy ), k = smoothstep( uFarR * ${C.blend.toFixed(2)}, uFarR, d );
  if ( k <= 0.0 ) return vec4( 0.0 );
  ivec2 c = ivec2( floor( ( P.xy - uFGo ) / uFGc ) );
  if ( c.x < 0 || c.y < 0 || c.x >= uFGn.x || c.y >= uFGn.y ) return vec4( 0.0 );
  vec4 t = texelFetch( tFarG, c, 0 );
  if ( t.r <= 0.0 ) return vec4( 0.0 );
  int si = int( t.g * 255.0 + 0.5 );
  bool flowering = uFGfl[ si ] > 0.5;
  // (the base: the grass's colour, or a standing drift's where one holds the cell; offset by the cell's dice)
  vec3 a = ( si > 0 && !flowering ? uFGcol[ si ] : uFGcol[ 0 ] ) * mix( ${C.tone[0].toFixed(2)}, ${C.tone[1].toFixed(2)}, t.a );
  // (the specks: a grain about ${S.px} px here, snapped to a power of two; a flower's, a weed's, or a fleck)
  float g = exp2( ceil( log2( max( ${S.px.toFixed(2)} * uFarPxm * d, 1e-3 ) ) ) ), h = farHash( floor( P.xy / g ) );
  bool weedy = uFGweedN > 0.5 && farHash( floor( P.xy / uFGweedC ) + 31.7 ) < uFGweedS;
  if ( flowering && h < ${S.flowers.toFixed(2)} ) a = uFGcol[ si ];
  else if ( weedy && h < ${S.weeds.toFixed(2)} ) a = uFGweed[ int( farHash( floor( P.xy / g ) + 7.1 ) * uFGweedN ) ];
  else if ( h > ${(1 - S.light).toFixed(2)} ) a *= ${S.lift.toFixed(2)};
  else if ( h > ${(1 - S.light - S.dark).toFixed(2)} ) a *= ${S.shade.toFixed(2)};
  return vec4( a, k );
}
`;

/** The blanket's uniforms, the ground's, set by the grass (its far map) and each frame (on, the reach, the pixel). */
export const farBlanketUniforms = () => `{ uFarOn: { value: 0 }, uFarR: { value: 1e6 }, uFarPxm: { value: 0.001 }, tFarG: { value: new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat) }, uFGo: { value: new THREE.Vector2() }, uFGn: { value: new THREE.Vector2(1, 1) }, uFGc: { value: 1 }, uFGfl: { value: new Array(16).fill(0) }, uFGcol: { value: Array.from({ length: 16 }, () => new THREE.Vector3()) }, uFGweed: { value: Array.from({ length: 4 }, () => new THREE.Vector3()) }, uFGweedN: { value: 0 }, uFGweedS: { value: 0 }, uFGweedC: { value: 1 } }`;

/** The far field's page source, after the grass and the view cone, in the form channel's scope (THREE, scene, LAYER_U:
 *  the ground's uniforms, which carry the blanket's). */
export function farFieldScript() {
  return `
  // --- the far field: the grass past the view cone's reach as its colour, speckled (channels/far-field.js) ---
  (function () {
    const CO = window.__mojCone, FF = window.__formFar; if (!CO || !FF) return;
    // (the blanket's far map, on the ground's uniforms)
    LAYER_U.tFarG.value = FF.tex; LAYER_U.uFGo.value.set(...FF.origin); LAYER_U.uFGn.value.set(...FF.n); LAYER_U.uFGc.value = FF.cell;
    LAYER_U.uFGcol.value = FF.cols; LAYER_U.uFGfl.value = FF.flowers;
    FF.weeds.forEach((w, i) => LAYER_U.uFGweed.value[i].copy(w)); LAYER_U.uFGweedN.value = FF.weeds.length; LAYER_U.uFGweedS.value = FF.weedShare; LAYER_U.uFGweedC.value = FF.weedCell;
    let on = true;
    window.__formFarField = { get on() { return on; }, set: (v) => { on = !!v; return on; } };
    window.addEventListener('keydown', (e) => { if (e.key === 'f' || e.key === 'F') console.log('far field', window.__formFarField.set(!on)); });
    const prev = scene.onBeforeRender;
    scene.onBeforeRender = function (r, s, cam, rt) {
      if (prev) prev.call(this, r, s, cam, rt);
      if (!cam.isPerspectiveCamera) return;
      const live = on && FF.pov() && CO.reach < 1e5;
      LAYER_U.uFarOn.value = live ? 1 : 0; LAYER_U.uFarR.value = live ? CO.reach : 1e6; LAYER_U.uFarPxm.value = CO.px;
    };
  })();
`;
}

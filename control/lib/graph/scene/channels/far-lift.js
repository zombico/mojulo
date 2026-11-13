// In-page script (part of the form channel, channels/form-land.js): THE FAR LIFT, the grass past the view cone's reach
// given its HEIGHT. The far field (channels/far-field.js) paints that grass as a colour on the ground: nothing stands,
// so nothing is in front of anything. The lift is the ground drawn a second time where grass grows, pushed up to the
// sward's height: the same triangles, lit and shadowed as the ground is, one more draw and no blade.
//
//   where    past the reach only (the blanket's own weight: none inside it, none where no grass grows)
//   how high the sward's height (tall, medium, short: GRASS_TIERS) × the cover, read smoothly from the grass map, so
//            the sheet comes down to the ground where the grass thins and ends: no wall, no floating edge
//   the seam it rises from nothing at the reach to its full height over FAR_LIFT.rise of the reach beyond it, so
//            there is no step where the real blades end
//   colour   the blanket's (the grass's, a standing drift's, speckled), so the lift and the ground under it agree
//
// Opt-in (a land's `farLift: true`); absent, the page carries none of it. Height and coverage only: no blade's edge, no
// wind. `window.__formFarLift` ({ on, set(bool), meshes }) and B toggle it on a walkable page. Mojulo web only.
import { GRASS_TIERS, BLADE_RISE, SWARD_LENGTH } from './form-grass.js';
import { FAR_BLANKET_GLSL, FAR_FIELD } from './far-field.js';

/** The lift's numbers: how far over a sward's tallest tip it stands (over it: far off, the sheet is all that hides the
 *  ground and what stands in it); the cover it starts and is full at; how far
 *  past the reach (× the reach) it takes to stand to its full height; the least cover it is drawn at. */
export const FAR_LIFT = Object.freeze({ stand: 1.3, cover: Object.freeze([0.1, 0.6]), rise: 0.35, least: 0.12 });

/** Each sward's height (m): its tier's tallest tip × FAR_LIFT.stand, in SWARD order (tall, medium, short). */
export const FAR_LIFT_HEIGHTS = Object.freeze(['tall', 'medium', 'short'].map((s) => {
  const t = GRASS_TIERS.find((q) => q.sward === s);
  return Math.round(t.scale * t.clump.height[1] * (BLADE_RISE[s][0] + BLADE_RISE[s][1]) * FAR_LIFT.stand * 1000) / 1000;
}));

/** A land's `farLift` read: true → on; absent or false → null. */
export function readFarLift(v) {
  if (v === undefined || v === null || v === false) return null;
  if (v !== true) throw new Error('farLift is true (the grass past the reach lifted to its height) or absent');
  return {};
}

const f = (n) => n.toFixed(3), [H0, H1, H2] = FAR_LIFT_HEIGHTS, B = SWARD_LENGTH.band;
// (the lift at a point of the plan: the sward's height there × its cover, risen over the distance past the reach)
const LIFT_GLSL = `uniform sampler2D tGrassL; uniform vec2 uGOl, uGMl; uniform float uFarOn, uFarR;
varying vec3 vLiftP; varying float vLiftC;
float liftAt( vec2 p, out float cov ) {
  vec4 g = texture2D( tGrassL, ( p - uGOl ) / uGMl ); cov = g.b;
  float h = mix( mix( ${f(H0)}, ${f(H1)}, smoothstep( ${f(B - 0.1)}, ${f(B + 0.1)}, g.a ) ), ${f(H2)}, smoothstep( ${f(1 - B - 0.1)}, ${f(1 - B + 0.1)}, g.a ) );
  float d = length( p - cameraPosition.xy ), r0 = uFarR * ${f(FAR_FIELD.blend)};
  return uFarOn * h * smoothstep( ${f(FAR_LIFT.cover[0])}, ${f(FAR_LIFT.cover[1])}, g.b ) * smoothstep( r0, r0 + uFarR * ${f(FAR_LIFT.rise)}, d );
}
`;

/** The lift's page source; `lift` a read lift (readFarLift). Expects the form channel's scope after the grass and the
 *  far field: THREE, scene, D, LAYER_U (the ground's uniforms: the grass map, the blanket's), __formMeshes. */
export function farLiftScript(lift) {
  if (!lift) return '';
  return `
  // --- the far lift: the grass past the reach at its height, the ground drawn again (channels/far-lift.js) ---
  if (D.grass && window.__formFar) (function () {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, LAYER_U);
      sh.vertexShader = ${JSON.stringify(LIFT_GLSL)} + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\\n  vLiftP = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz; transformed.z += liftAt( vLiftP.xy, vLiftC );');
      sh.fragmentShader = 'varying vec3 vLiftP; varying float vLiftC;\\n' + ${JSON.stringify(FAR_BLANKET_GLSL)} + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\\n  { vec4 fb = farBlanket( vLiftP, vec3( 0.0, 0.0, 1.0 ) ); if ( fb.a <= 0.0 || vLiftC < ${f(FAR_LIFT.least)} ) discard; diffuseColor.rgb = fb.rgb; }');
    };
    // (the ground's meshes: the land's parts that carry its layers)
    const meshes = __formMeshes.filter((q) => q.geometry && q.geometry.attributes.splat).map((q) => { const l = new THREE.Mesh(q.geometry, m); l.receiveShadow = true; l.frustumCulled = false; scene.add(l); return l; });
    let on = true;
    window.__formFarLift = { meshes: meshes.length, heights: ${JSON.stringify(FAR_LIFT_HEIGHTS)}, blend: ${FAR_FIELD.blend}, rise: ${FAR_LIFT.rise}, get on() { return on; }, set: (v) => { on = !!v; meshes.forEach((l) => { l.visible = on; }); return on; } };
    window.addEventListener('keydown', (e) => { if (e.key === 'b' || e.key === 'B') console.log('far lift', window.__formFarLift.set(!on)); });
  })();
`;
}

// In-page script (part of the form channel, channels/form-land.js): THE FAR LIFT, the grass past the view cone's reach
// given its HEIGHT. The far field (channels/far-field.js) paints that grass as a colour on the ground: nothing stands,
// so nothing is in front of anything. The lift is the ground drawn a second time where grass grows, pushed up to the
// sward's height: the same triangles, lit and shadowed as the ground is, one more draw and no blade.
//
//   where    from where the real blades begin to thin (FAR_LIFT.from of the reach), under them, to past the reach;
//            none where no grass grows
//   how high the sward's height (tall, medium, short: GRASS_TIERS) × the cover, read smoothly from the grass map, so
//            the sheet comes down to the ground where the grass thins and ends: no wall, no floating edge
//   the seam the blades thin out from `from` of the reach to the reach; over the same stretch the lift rises from
//            nothing to its full height among them and FILLS IN, a stipple of blade-sized cells whose share grows
//            with the distance, so the blades are never seen to stop and the sheet is never seen to start
//   colour   the blanket's (the grass's, a standing drift's, speckled), so the lift and the ground under it agree
//
// Opt-in (a land's `farLift: true`); absent, the page carries none of it. Height and coverage only: no blade's edge, no
// wind. `window.__formFarLift` ({ on, set(bool), meshes }) and B toggle it on a walkable page. Mojulo web only.
import { GRASS_TIERS, BLADE_RISE, SWARD_LENGTH, POV_GRASS } from './form-grass.js';
import { FAR_BLANKET_GLSL, FAR_FIELD } from './far-field.js';

/** The lift's numbers: how far over a sward's tallest tip it stands (over it: far off, the sheet is all that hides the
 *  ground and what stands in it); the cover it starts and is full at; where it begins and where it is whole (× the
 *  reach: `from` the blades' thinning, POV_GRASS.thin, `full` the reach); the stipple's cell (m); its colour over the
 *  far field's (`gain`); the least cover it is drawn at. */
export const FAR_LIFT = Object.freeze({ stand: 1.3, cover: Object.freeze([0.1, 0.6]), from: POV_GRASS.thin, full: 1, cell: 0.09, gain: 1, least: 0.12 });

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
// (the lift at a point of the plan: the sward's height there × its cover, risen over the stretch the blades thin in;
// uLiftR: where it begins and where it is whole, m from the eye)
const LIFT_GLSL = `uniform sampler2D tGrassL; uniform vec2 uGOl, uGMl, uLiftR; uniform float uFarOn;
varying vec3 vLiftP; varying vec2 vLiftC;
float liftAt( vec2 p, out vec2 ck ) {
  vec4 g = texture2D( tGrassL, ( p - uGOl ) / uGMl );
  float h = mix( mix( ${f(H0)}, ${f(H1)}, smoothstep( ${f(B - 0.1)}, ${f(B + 0.1)}, g.a ) ), ${f(H2)}, smoothstep( ${f(1 - B - 0.1)}, ${f(1 - B + 0.1)}, g.a ) );
  float k = smoothstep( uLiftR.x, uLiftR.y, length( p - cameraPosition.xy ) ); ck = vec2( g.b, k );
  return uFarOn * h * smoothstep( ${f(FAR_LIFT.cover[0])}, ${f(FAR_LIFT.cover[1])}, g.b ) * k;
}
`;

/** The lift's page source; `lift` a read lift (readFarLift). Expects the form channel's scope after the grass and the
 *  far field: THREE, scene, D, LAYER_U (the ground's uniforms: the grass map, the blanket's), __formMeshes. */
export function farLiftScript(lift) {
  if (!lift) return '';
  return `
  // --- the far lift: the grass past the reach at its height, the ground drawn again (channels/far-lift.js) ---
  if (D.grass && window.__formFar) (function () {
    const LR = { value: 1e6 }, LD = { value: new THREE.Vector2(1e6, 2e6) }, FLT = ${JSON.stringify({ from: FAR_LIFT.from, full: FAR_LIFT.full, blend: FAR_FIELD.blend })};
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    m.onBeforeCompile = (sh) => {
      // (the ground's uniforms, with a reach of the lift's own for the blanket's colour: it begins where the lift does)
      Object.assign(sh.uniforms, LAYER_U, { uFarR: LR, uLiftR: LD });
      sh.vertexShader = ${JSON.stringify(LIFT_GLSL)} + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\\n  vLiftP = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz; transformed.z += liftAt( vLiftP.xy, vLiftC );');
      sh.fragmentShader = 'varying vec3 vLiftP; varying vec2 vLiftC;\\n' + ${JSON.stringify(FAR_BLANKET_GLSL)} + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\\n  { vec4 fb = farBlanket( vLiftP, vec3( 0.0, 0.0, 1.0 ) ); if ( fb.a <= 0.0 || vLiftC.x < ${f(FAR_LIFT.least)} || farHash( floor( vLiftP.xy / ${f(FAR_LIFT.cell)} ) + 3.7 ) > vLiftC.y * 1.1 ) discard; diffuseColor.rgb = fb.rgb * ${f(FAR_LIFT.gain)}; }');
    };
    // (the ground's meshes: the land's parts that carry its layers)
    const meshes = __formMeshes.filter((q) => q.geometry && q.geometry.attributes.splat).map((q) => { const l = new THREE.Mesh(q.geometry, m); l.receiveShadow = true; l.frustumCulled = false; scene.add(l); return l; });
    let on = true;
    // (each frame: where the lift begins and is whole, from the cone's reach; nothing where the far field is off)
    const prevL = scene.onBeforeRender;
    scene.onBeforeRender = function (r, sc, cam, rt) {
      if (prevL) prevL.call(this, r, sc, cam, rt);
      const C = window.__mojCone; if (!C || !cam.isPerspectiveCamera) return;
      const live = C.reach < 1e5; LR.value = live ? C.reach * FLT.from / FLT.blend : 1e6; LD.value.set(live ? C.reach * FLT.from : 1e6, live ? C.reach * FLT.full : 2e6);
    };
    window.__formFarLift = { meshes: meshes.length, heights: ${JSON.stringify(FAR_LIFT_HEIGHTS)}, from: ${FAR_LIFT.from}, full: ${FAR_LIFT.full}, get on() { return on; }, set: (v) => { on = !!v; meshes.forEach((l) => { l.visible = on; }); return on; } };
    window.addEventListener('keydown', (e) => { if (e.key === 'b' || e.key === 'B') console.log('far lift', window.__formFarLift.set(!on)); });
  })();
`;
}

// In-page script (part of the form channel, channels/form-land.js): THE FAR LIFT, the grass past the view cone's reach
// given its HEIGHT. The far field (channels/far-field.js) paints that grass as a colour on the ground: nothing stands,
// so nothing is in front of anything. The lift is the ground drawn a second time where grass grows, pushed up to the
// sward's height: the same triangles, lit and shadowed as the ground is, one more draw and no blade.
//
//   where    from where the real blades begin to thin (FAR_LIFT.from of the reach), under them, to past the reach;
//            none where no grass grows
//   where    where the grass is, as the page places it: the far map (channels/form-grass.js `window.__formFar`: a
//            strand a cell of the grass map where a clump stands, its height its own; none on the trail, in a claim,
//            on bare ground, fewer where the cover thins), not the cover alone
//   how high the MEAN of those strands round a point (FAR_LIFT.mean m about it, the cells with none counted as
//            nothing) × FAR_LIFT.stand: tall where the grass is tall and thick, low where it is short or sparse,
//            nothing where there is none, so the land far off is the land met close by
//   walls    where the mean falls to FAR_LIFT.least the sheet comes down to the ground, a side of the same triangles
//            and material, so a raised plain is closed all round; the side's lower part fills in as the seam does
//   the seam the blades thin out from `from` of the reach to the reach; over the same stretch the lift rises from
//            nothing to its full height among them and FILLS IN, a stipple of blade-sized cells whose share grows
//            with the distance, so the blades are never seen to stop and the sheet is never seen to start
//   colour   the blanket's (the grass's, a standing drift's, speckled), so the lift and the ground under it agree
//
// Opt-in (a land's `farLift: true`); absent, the page carries none of it. Height and coverage only: no blade's edge, no
// wind. `window.__formFarLift` ({ on, set(bool), meshes }) and B toggle it on a walkable page. Mojulo web only.
import { POV_GRASS } from './form-grass.js';
import { FAR_BLANKET_GLSL, FAR_FIELD } from './far-field.js';

/** The lift's numbers: how far over the grass's mean height it stands (over it: far off, the sheet is all that hides
 *  the ground and what stands in it); the radius the mean is taken over (m); the least mean height it is drawn at
 *  (m), the mean its side is whole at (`wall`, m) and the mean it has risen clear of the ground by (`foot`, m); where
 *  it begins and where it is whole (× the reach: `from` the blades' thinning, POV_GRASS.thin, `full` the reach); the
 *  stipple's cell (m); its colour over the far field's (`gain`). */
export const FAR_LIFT = Object.freeze({ stand: 1.5, mean: 1, least: 0.1, wall: 0.16, foot: 0.2, from: POV_GRASS.thin, full: 1, cell: 0.09, gain: 1 });

/**
 * The lift's field: the far map's strand heights (`h8`, a byte a cell, 0 none; `nx` × `ny`) averaged over the cells
 * within `r` cells of each (a box, the cells with no strand counted as nothing), as bytes on the same scale.
 * Self-contained: the page runs this very function.
 */
export function liftField(h8, nx, ny, r) {
  const a = new Float32Array(nx * ny), out = new Uint8Array(nx * ny), w = 2 * r + 1;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { let t = 0; for (let d = -r; d <= r; d++) { const q = i + d; if (q >= 0 && q < nx) t += h8[j * nx + q]; } a[j * nx + i] = t / w; }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { let t = 0; for (let d = -r; d <= r; d++) { const q = j + d; if (q >= 0 && q < ny) t += a[q * nx + i]; } out[j * nx + i] = Math.round(t / w); }
  return out;
}

/** A land's `farLift` read: true → on; absent or false → null. */
export function readFarLift(v) {
  if (v === undefined || v === null || v === false) return null;
  if (v !== true) throw new Error('farLift is true (the grass past the reach lifted to its height) or absent');
  return {};
}

const f = (n) => n.toFixed(3);
// (the lift at a point of the plan: the grass's mean height there, tLift × uLiftH (m), × the lift's stand, risen clear
// of the ground past its foot and over the stretch the blades thin in; uLiftR: where it begins and where it is whole,
// m from the eye. ck: the mean (m) and the seam's share)
const LIFT_GLSL = `uniform sampler2D tLift; uniform vec2 uGOl, uGMl, uLiftR; uniform float uFarOn, uLiftH;
varying vec3 vLiftP; varying vec2 vLiftC;
float liftAt( vec2 p, out vec2 ck ) {
  float m = texture2D( tLift, ( p - uGOl ) / uGMl ).r * uLiftH;
  float k = smoothstep( uLiftR.x, uLiftR.y, length( p - cameraPosition.xy ) ); ck = vec2( m, k );
  return uFarOn * m * ${f(FAR_LIFT.stand)} * smoothstep( ${f(FAR_LIFT.least)}, ${f(FAR_LIFT.foot)}, m ) * k;
}
`;

/** The lift's page source; `lift` a read lift (readFarLift). Expects the form channel's scope after the grass and the
 *  far field: THREE, scene, D, LAYER_U (the ground's uniforms: the grass map, the blanket's), __formMeshes. */
export function farLiftScript(lift) {
  if (!lift) return '';
  return `
  // --- the far lift: the grass past the reach at its height, the ground drawn again (channels/far-lift.js) ---
  if (D.grass && window.__formFar) (function () {
    ${liftField.toString()}
    // (the field: the far map's strands, their mean round each cell, read smoothly)
    const FF = window.__formFar, fd = FF.tex.image.data, h8 = new Uint8Array(FF.n[0] * FF.n[1]); for (let q = 0; q < h8.length; q++) h8[q] = fd[q * 4];
    const lt = new THREE.DataTexture(liftField(h8, FF.n[0], FF.n[1], Math.max(1, Math.round(${FAR_LIFT.mean} / FF.cell))), FF.n[0], FF.n[1], THREE.RedFormat); lt.magFilter = lt.minFilter = THREE.LinearFilter; lt.needsUpdate = true;
    const LR = { value: 1e6 }, LD = { value: new THREE.Vector2(1e6, 2e6) }, FLT = ${JSON.stringify({ from: FAR_LIFT.from, full: FAR_LIFT.full, blend: FAR_FIELD.blend })};
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    m.onBeforeCompile = (sh) => {
      // (the ground's uniforms, with a reach of the lift's own for the blanket's colour: it begins where the lift does)
      Object.assign(sh.uniforms, LAYER_U, { uFarR: LR, uLiftR: LD, tLift: { value: lt }, uLiftH: { value: FF.hMax } });
      sh.vertexShader = ${JSON.stringify(LIFT_GLSL)} + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\\n  vLiftP = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz; transformed.z += liftAt( vLiftP.xy, vLiftC );');
      sh.fragmentShader = 'varying vec3 vLiftP; varying vec2 vLiftC;\\n' + ${JSON.stringify(FAR_BLANKET_GLSL)} + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\\n  { vec4 fb = farBlanket( vLiftP, vec3( 0.0, 0.0, 1.0 ) ); float hs = farHash( floor( vLiftP.xy / ${f(FAR_LIFT.cell)} ) + 3.7 ); if ( uFarOn < 0.5 || vLiftC.x < ${f(FAR_LIFT.least)} || hs > vLiftC.y * 1.1 || hs > smoothstep( ${f(FAR_LIFT.least)}, ${f(FAR_LIFT.wall)}, vLiftC.x ) * 1.2 ) discard; if ( fb.a <= 0.0 ) fb.rgb = uFGcol[ 0 ]; diffuseColor.rgb = fb.rgb * ${f(FAR_LIFT.gain)}; }');
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
    window.__formFarLift = { meshes: meshes.length, get on() { return on; }, set: (v) => { on = !!v; meshes.forEach((l) => { l.visible = on; }); return on; } };
    window.addEventListener('keydown', (e) => { if (e.key === 'b' || e.key === 'B') console.log('far lift', window.__formFarLift.set(!on)); });
  })();
`;
}

/**
 * THE MOLTEN METAL on the page (a works' `runners` and `ladles`, local-meru/works.js: the land's `melt`): a ribbon along
 * each runner's trough at the metal's level, where it pours a stream falling into the ladle, and the ladle's pool. The
 * metal lights itself (no lamp is needed to see it; the works' glows light what is round it): white-yellow where it runs
 * deepest down the middle, orange to its banks, and a dark crust skinning over it in plates that drift down the runner
 * with the flow, thicker at the banks where it cools; the stream falls faster than the runner flows, a pool's crust
 * drifts in from its rim. Through the hall's haze as all else is.
 *
 *   MELT        the numbers: the flow and the fall in m/s, the crust's scale along and across
 *   meltScript() the page script: the ribbons built from `D.melt` ([{ pts: [[x, y, z], …], w, fall?, pool? }]: a
 *                runner's ribbon, a falling stream, a ladle's pool), one mesh
 */
export const MELT = Object.freeze({ flow: 1.6, fall: 7, pool: 0.4, crust: Object.freeze([0.35, 1.5]) });

// (patched into the basic material, so the page's fog, its colour space and its pipeline are three's own)
const VERT_HEAD = 'attribute float aFlow; attribute float aAcross; attribute float aSpeed; varying float vF; varying float vA; varying float vS;\n';
const VERT_BODY = 'vF = aFlow; vA = aAcross; vS = aSpeed;';
const FRAG_HEAD = `uniform float uT; varying float vF; varying float vA; varying float vS;
float mh( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float mn( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f ); return mix( mix( mh( i ), mh( i + vec2( 1.0, 0.0 ) ), f.x ), mix( mh( i + vec2( 0.0, 1.0 ) ), mh( i + vec2( 1.0, 1.0 ) ), f.x ), f.y ); }
`;
const FRAG_BODY = `float f = vF - uT * vS, e = abs( vA );
  float c = mn( vec2( f * ${MELT.crust[0]}, vA * ${MELT.crust[1]} ) ) * 0.6 + mn( vec2( f * 1.1, vA * 4.0 + 3.0 ) ) * 0.4;
  float crust = smoothstep( 0.56, 0.74, c + 0.18 * smoothstep( 0.3, 1.0, e ) );
  vec3 mcol = mix( vec3( 1.0, 0.88, 0.5 ), vec3( 1.0, 0.42, 0.07 ), smoothstep( 0.0, 0.95, e ) );
  mcol = mix( mcol, vec3( 0.2, 0.045, 0.02 ), crust * 0.88 ) * ( 0.88 + 0.24 * mn( vec2( f * 3.0, vA * 6.0 + uT ) ) );
  vec4 diffuseColor = vec4( mcol, opacity );`;

export function meltScript() {
  return `  // THE MOLTEN METAL (a works' runners, channels/works-melt.js): ribbons along the troughs and the streams they pour
  { const pos = [], flow = [], across = [], speed = [];
    const tri = (A, B, C, fa, fb, fc, aa, ab, ac, sp) => { pos.push(...A, ...B, ...C); flow.push(fa, fb, fc); across.push(aa, ab, ac); speed.push(sp, sp, sp); };
    const strip = (a, b, d, w, fa, fb, sp) => { const A = [a[0] - d[0] * w, a[1] - d[1] * w, a[2] - d[2] * w], B = [b[0] - d[0] * w, b[1] - d[1] * w, b[2] - d[2] * w], C = [b[0] + d[0] * w, b[1] + d[1] * w, b[2] + d[2] * w], E = [a[0] + d[0] * w, a[1] + d[1] * w, a[2] + d[2] * w];
      tri(A, B, C, fa, fb, fb, -1, -1, 1, sp); tri(A, C, E, fa, fb, fa, -1, 1, 1, sp); };
    for (const M of D.melt) {
      const P = M.pts, w = M.w / 2;
      // (a pool: a disc, its crust drifting in toward the middle from the rim where it cools)
      if (M.pool) { const [c] = P, n = 24; for (let i = 0; i < n; i++) { const a0 = (2 * Math.PI * i) / n, a1 = (2 * Math.PI * (i + 1)) / n, R0 = [c[0] + w * Math.cos(a0), c[1] + w * Math.sin(a0), c[2]], R1 = [c[0] + w * Math.cos(a1), c[1] + w * Math.sin(a1), c[2]]; tri(c, R0, R1, w, 0, 0, 0, 1, 1, ${MELT.pool}); } continue; }
      if (M.fall) { const [a, b] = P; for (const d of [[1, 0, 0], [0, 1, 0]]) strip(a, b, d, w, 0, a[2] - b[2], ${MELT.fall}); continue; }
      let s = 0;
      for (let i = 0; i + 1 < P.length; i++) {
        const a = P[i], b = P[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6, u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], e = w;
        // (each piece run on past its ends by its half width, so a turn is covered)
        strip([a[0] - u[0] * e, a[1] - u[1] * e, a[2]], [b[0] + u[0] * e, b[1] + u[1] * e, b[2]], [-u[1], u[0], 0], w, s - e, s + L + e, ${MELT.flow}); s += L;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 1)); g.setAttribute('aAcross', new THREE.Float32BufferAttribute(across, 1)); g.setAttribute('aSpeed', new THREE.Float32BufferAttribute(speed, 1));
    const MU = { uT: { value: 0 } }, mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false });
    mat.onBeforeCompile = (sh) => { sh.uniforms.uT = MU.uT;
      sh.vertexShader = ${JSON.stringify(VERT_HEAD)} + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\\n  ' + ${JSON.stringify(VERT_BODY)});
      sh.fragmentShader = ${JSON.stringify(FRAG_HEAD)} + sh.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', ${JSON.stringify(FRAG_BODY)}); };
    mat.customProgramCacheKey = () => 'works-melt';
    const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.onBeforeRender = () => { MU.uT.value = performance.now() / 1000; };
    scene.add(mesh); }
`;
}

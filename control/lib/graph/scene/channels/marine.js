// In-page script: WHAT GROWS ON A SEABED (opt-in: a geocube's biocube with `flora.marine`, marine/roster.js), drawn where
// the placer stood it (marine/place.js). The page grows each template itself from the marine kernel (marine/forms.js,
// inlined: a branch, a plate, a dome, a fan, a tuft, a rock…), so it carries only where each copy stands; each template
// is one instanced mesh.
//
//   the light   the cube's sun and sky, in the vertex: a kind's colour carries no light (a solid half-lit round its
//               shade side, a blade lit through from either side), then the page's fog: under a `sea`
//               (channels/sea.js) the water takes it as it takes the land, so a coral's red goes with the depth
//   the sway    every vertex moves by its own measure (0 at a foot, the kind's `sway` at a free end) in a slow current,
//               its phase by where its copy stands, so a stand of kelp leans together and a reef's anemones do not beat
//               as one
//
// Absent => NOT emitted. `window.__mojMarine` is the probe: { count, tris, templates, kinds }.
import { safeJson } from '../emit-util.js';
import { marineKernel } from '../../marine/forms.js';

/** The ways of growing that are blades, lit from either side and drawn from both. */
export const MARINE_BLADES = Object.freeze(['fan', 'pen', 'kelp', 'grass', 'lettuce', 'worms']);
/** The sky's light on a kind against the land's solved ambient: a thing standing on the bed takes the bed's bounce too. */
export const MARINE_SKY = 1.6;
const DEFAULT_LIGHT = Object.freeze({ dir: [0.35, 0.3, 0.89], sun: [0.8, 0.76, 0.66], ambient: [0.3, 0.36, 0.45] });
const r4 = (x) => Math.round(x * 1e4) / 1e4;

/** The page's input from a laid seabed (placeMarine): its groups, and the light they stand in (the page's sun's
 *  direction, the form land's solved sun and sky where it has them). Nothing laid => null. */
export function marineInput(placed, { sun = null, light = null } = {}) {
  if (!placed || !placed.count) return null;
  const n = sun && sun.length === 3 ? Math.hypot(...sun) : 0;
  // (the page's alone: where the animals' seats are stays with the placer)
  return { groups: placed.groups.map((g) => ({ ...g, blade: MARINE_BLADES.includes(g.grow) })), count: placed.count,
    light: { dir: (n > 0 && sun[2] > 0 ? sun.map((c) => c / n) : DEFAULT_LIGHT.dir).map(r4), sun: (light?.sun ?? DEFAULT_LIGHT.sun).map(r4), ambient: (light?.ambient ?? DEFAULT_LIGHT.ambient).map(r4) } };
}

const f = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x));
const v3 = (a) => `vec3( ${a.map(f).join(', ')} )`;

/** The seabed's page source; `cfg` a marineInput. */
export function marineScript(cfg) {
  const L = cfg.light;
  const lit = (blade) => `  { vec3 mn = normalize( mat3( instanceMatrix ) * normal ); float md = dot( mn, ${v3(L.dir)} );
    vColor.rgb *= ${v3(L.ambient)} * ${f(MARINE_SKY)} * ( 0.75 + 0.25 * mn.z ) + ${v3(L.sun)} * ${blade ? '( 0.3 + 0.7 * abs( md ) )' : '( 0.75 * max( md, 0.0 ) + 0.25 * ( 0.5 + 0.5 * md ) )'}; }`;
  const sway = `  { float mp = instanceMatrix[ 3 ].x * 0.37 + instanceMatrix[ 3 ].y * 0.29;
    transformed.xy += aSway * vec2( sin( uMarT * 0.9 + mp ) + 0.35 * sin( uMarT * 2.3 + mp * 1.7 ), 0.6 * cos( uMarT * 0.7 + mp * 1.3 ) ); }`;
  return `
// --- the seabed's flora: what grows there and does not swim (channels/marine.js, marine/forms.js) ---
(function () {
  const MR = ${safeJson({ groups: cfg.groups })}, K = (${marineKernel.toString()})();
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)), U = { value: 0 };
  const mat = (blade) => { const m = new THREE.MeshBasicMaterial({ vertexColors: true, side: blade ? THREE.DoubleSide : THREE.FrontSide, fog: true });
    m.onBeforeCompile = (sh) => { sh.uniforms.uMarT = U;
      sh.vertexShader = 'attribute float aSway;\\nuniform float uMarT;\\n' + sh.vertexShader.replace('#include <color_vertex>', '#include <color_vertex>\\n' + (blade ? ${JSON.stringify(lit(true))} : ${JSON.stringify(lit(false))})).replace('#include <begin_vertex>', '#include <begin_vertex>\\n' + ${JSON.stringify(sway)}); };
    m.customProgramCacheKey = () => 'marine-' + blade; return m; };
  const M = [mat(false), mat(true)], probe = window.__mojMarine = { count: 0, tris: 0, templates: 0, kinds: {} };
  const P = new THREE.Vector3(), Q = new THREE.Quaternion(), Y = new THREE.Quaternion(), S = new THREE.Vector3(), X = new THREE.Matrix4(), UP = new THREE.Vector3(0, 0, 1), D = new THREE.Vector3();
  for (const G of MR.groups) {
    const F = K.form(G.grow, G), g = new THREE.BufferGeometry(), n = G.items.length / 7;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(F.pos), 3));
    g.setAttribute('color', new THREE.BufferAttribute(Float32Array.from(F.col, lin), 3));
    g.setAttribute('aSway', new THREE.BufferAttribute(new Float32Array(F.sway), 1));
    g.setIndex(F.idx); g.computeVertexNormals();
    const mesh = new THREE.InstancedMesh(g, M[G.blade ? 1 : 0], n);
    for (let i = 0; i < n; i++) {
      const o = i * 7, s = G.items[o + 4];
      P.set(G.items[o], G.items[o + 1], G.items[o + 2]); Y.setFromAxisAngle(UP, G.items[o + 3]);
      Q.setFromUnitVectors(UP, D.set(G.items[o + 5], G.items[o + 6], 1).normalize()).multiply(Y);
      mesh.setMatrixAt(i, X.compose(P, Q, S.set(s, s, s)));
    }
    mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false; mesh.raycast = () => {}; mesh.userData.g = 'marine:' + G.kind; scene.add(mesh);
    probe.count += n; probe.tris += n * F.tris; probe.templates++; probe.kinds[G.kind] = (probe.kinds[G.kind] || 0) + n;
  }
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = function (r, s, cam, rt) { if (prev) prev.call(this, r, s, cam, rt); U.value = (window.__mojClock != null ? window.__mojClock : performance.now()) / 1000; };
})();
`;
}

import { SKY_ENV } from '../page-light.js';

// In-page script: CAR PAINT (a city's vehicles under a sky: the flow channel's traffic, channels/flow.js, and the cars a
// player takes, channels/cab-pool.js). Their pooled bodies are drawn as paint (three's MeshBasicMaterial, the light baked
// into their colours); here each material is patched with what a bake cannot hold, a clear coat over the paint: the sky
// it stands under, mirrored by Fresnel (Schlick from a lacquer's few parts in a hundred) along the reflected view, so a
// roof gives back the zenith and a door the horizon, the paint under it dimmed by what the coat takes; the sun's glint,
// tight, where a panel turns the sun into the eye; and a metallic paint's broad sheen in its own colour. The trim (glass,
// rubber, chrome as one mesh) takes a softer coat. The panels are flat: each face's normal from the screen's derivatives,
// as the specular channel's (channels/specular.js), so a faceted body throws back its sky panel by panel.
//
//   carPaintScript(env, toLight)   env: scene/page-light.js skyEnv (display rgb 0..1); toLight: the page's sun, toward it
//                                  → defines `__carCoat(material, 'paint' | 'trim')` → the material, patched
//   CAR_COAT                       each part's coat: f0, how much of the coat is laid (`coat`), the glint's power and
//                                  strength, the sheen's (a metallic flake's: in the paint's own colour)
//
// Only a page whose finish asks to reflect, and that draws pooled vehicles, carries this (scene/scene-three.js); every
// other page is byte for byte as it was.
export const CAR_COAT = Object.freeze({
  paint: Object.freeze({ f0: 0.05, coat: 1, glint: 900, shine: 1.6, sheen: 0.22, broad: 18 }),
  trim: Object.freeze({ f0: 0.04, coat: 0.7, glint: 300, shine: 0.7, sheen: 0, broad: 1 }),
});

export function carPaintScript(env, toLight) {
  const f = (v) => (+v).toFixed(4), v3 = (c) => `vec3(${c.map(f).join(', ')})`, K = SKY_ENV;
  const L = toLight.map((v) => +v), n = Math.hypot(...L) || 1;
  // (the sun's glint as bright as the sky round it is: a dim sky's sun a dim glint)
  const day = Math.min(1, 0.2126 * env.zenith[0] + 0.7152 * env.zenith[1] + 0.0722 * env.zenith[2] + 0.35);
  return `
// --- car paint: a clear coat over the pooled vehicles' paint, the sky by Fresnel and the sun's glint ---
const __CAR_COAT = ${JSON.stringify(CAR_COAT)};
const __carCoat = (mat, part) => {
  const C = __CAR_COAT[part];
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'varying vec3 vCcW;\\n' + sh.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\\n#ifdef USE_INSTANCING\\n  vCcW = ( modelMatrix * instanceMatrix * vec4( transformed, 1.0 ) ).xyz;\\n#else\\n  vCcW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;\\n#endif');
    sh.fragmentShader = 'varying vec3 vCcW;\\n' + sh.fragmentShader.replace('#include <dithering_fragment>',
      'vec3 cN = normalize( cross( dFdx( vCcW ), dFdy( vCcW ) ) ), cV = normalize( cameraPosition - vCcW ); if ( dot( cN, cV ) < 0.0 ) cN = - cN;\\n' +
      'vec3 cR = reflect( - cV, cN );\\n' +
      'vec3 cE = cR.z > 0.0 ? mix( ${v3(env.horizon)}, ${v3(env.zenith)}, pow( cR.z, ${f(K.rise)} ) ) : mix( ${v3(env.ground)}, ${v3(env.horizon)} * ${f(K.under)}, exp( ${f(K.fall)} * cR.z ) );\\n' +
      'float cF = ' + C.f0.toFixed(4) + ' + ' + (1 - C.f0).toFixed(4) + ' * pow( 1.0 - max( dot( cN, cV ), 0.0 ), 5.0 );\\n' +
      'vec3 cH = normalize( ${v3(L.map((v) => v / n))} + cV ); float cNh = max( dot( cN, cH ), 0.0 );\\n' +
      'gl_FragColor.rgb = mix( gl_FragColor.rgb, cE, cF * ' + C.coat.toFixed(4) + ' );\\n' +
      'gl_FragColor.rgb += gl_FragColor.rgb * cE * ' + C.sheen.toFixed(4) + ' * pow( cNh, ' + C.broad.toFixed(1) + ' );\\n' +
      'gl_FragColor.rgb += vec3( 1.0, 0.97, 0.9 ) * ${f(day)} * ' + C.shine.toFixed(4) + ' * pow( cNh, ' + C.glint.toFixed(1) + ' );\\n' +
      '#include <dithering_fragment>');
  };
  mat.customProgramCacheKey = () => 'car-coat-' + part;
  mat.needsUpdate = true;
  return mat;
};
`;
}

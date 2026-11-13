// THE CAST MATERIAL (the cast rig on the page): a body drawn under the one rig the colour theorist solves
// (color-theorist/cast-rig.js castRig), over paint and over form alike. The fight's rig lit its bodies with lights of
// three's because its room is unlit; a form page's land is lit by those same lights, so here only the KEY is a light
// (the page's one sun) and the rest is in the body's own shader, where it lights nothing else:
//
//   the hemisphere   the body's indirect light: the rig's sky on a face turned up, its ground on one turned down, in
//                    the place of the page's ambient (which is the land's), × the body's own fill
//   the key's gain   the body's own lift over the world's key: its direct light alone × the gain
//   the rim          a fresnel edge in the horizon's hue, added on the body's own surface (as the fight's coat is);
//                    the cel steps it
//   the tone         on a form page the renderer's curve tones the body with the land; on a painted page (the paint is
//                    drawn as it is, the renderer tones nothing) the body tones itself, the same curve in its shader
//
//   castRigInput(rig)    a rig → what the page carries of it (its lights and laws' results, not their prose)
//   castKitSource()      the kit as page source: an expression a page assigns (`const castKit = ${castKitSource()};`),
//                        in a scope with THREE
//   buildCastKit(THREE)  the kit, live (Node imports it for tests): { uniforms, patch, material, key, ramp }
//     uniforms(input)                    the rig's uniforms, one set a rig, shared by every body under it
//     patch(material, U, { register, surface })   lays the rig on a material of three's (standard, physical or toon),
//                        after whatever `onBeforeCompile` it already has; → the material
//     material(input, { register?, surface, uniforms?, ...three's options })   a body's material: MeshStandardMaterial
//                        ('western') or MeshToonMaterial over the rig's ramp ('anime')
//     key(scene, input, { sun? })        the page's one key for its bodies: `sun` (a form page's own, the land's: taken
//                        as it is), else the page's shadow-casting light given the key's colour and level (a painted
//                        world is unlit, so only bodies see it) and every other directional light put out, else a
//                        light of its own along the rig's key. → the light. Called once, where the page builds its bodies
//     ramp(bands)                        the cel's tones as a gradient map
//
// Absent, a page carries none of it. Pure source: no dice, no clock.

/** What a page carries of a rig (castRig's result): numbers only. */
export function castRigInput(rig) {
  return {
    register: rig.register,
    key: { toLight: rig.key.toLight, linear: rig.key.linear, gain: rig.key.gain },
    hemi: { sky: rig.hemi.sky, ground: rig.hemi.ground, gain: rig.hemi.gain },
    rim: { linear: rig.rim.linear, strength: rig.rim.strength, power: rig.rim.power },
    ...(rig.bands ? { bands: rig.bands } : {}),
    tone: { exposure: rig.tone.exposure },
  };
}

/** The shader text the kit lays in, by the chunk it follows (three's standard and toon fragments both carry each). */
export const CAST_ANCHORS = Object.freeze(['#include <emissivemap_fragment>', '#include <lights_fragment_begin>', '#include <tonemapping_fragment>']);

export function buildCastKit(THREE) {
  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  function uniforms(R) {
    return {
      uCastSky: { value: v3(R.hemi.sky) }, uCastGround: { value: v3(R.hemi.ground) }, uCastFill: { value: R.hemi.gain },
      uCastKey: { value: R.key.gain }, uCastRim: { value: v3(R.rim.linear) }, uCastRimK: { value: R.rim.strength },
      uCastRimP: { value: R.rim.power }, uCastExposure: { value: (R.tone && R.tone.exposure) || 1 },
    };
  }
  // (Khronos PBR neutral, as three's NeutralToneMapping: a painted page's renderer tones nothing, so the body does)
  const NEUTRAL = `
vec3 castNeutral( vec3 color ) {
  const float start = 0.8 - 0.04, desat = 0.15;
  float x = min( color.r, min( color.g, color.b ) ), offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max( color.r, max( color.g, color.b ) );
  if ( peak < start ) return color;
  float d = 1.0 - start, newPeak = 1.0 - d * d / ( peak + d - start );
  color *= newPeak / peak;
  return mix( color, vec3( newPeak ), 1.0 - 1.0 / ( desat * ( peak - newPeak ) + 1.0 ) );
}`;
  function patch(material, U, opts) {
    const cel = opts.register === 'anime', own = opts.surface !== 'form', before = material.onBeforeCompile, beforeKey = material.customProgramCacheKey;
    // (a body that says how its materials answer, color-theorist/cast-response.js: each corner's roughness and metal)
    const resp = !!opts.response && !cel;
    material.onBeforeCompile = function (sh, renderer) {
      if (before) before.call(this, sh, renderer);
      Object.assign(sh.uniforms, U);
      const put = (anchor, text, after) => {
        if (sh.fragmentShader.indexOf(anchor) < 0) throw new Error('cast material: the shader has no ' + anchor);
        sh.fragmentShader = sh.fragmentShader.replace(anchor, after ? anchor + '\n' + text : text + '\n' + anchor);
      };
      sh.fragmentShader = 'uniform vec3 uCastSky, uCastGround, uCastRim;\nuniform float uCastFill, uCastKey, uCastRimK, uCastRimP, uCastExposure;' + (own ? NEUTRAL : '') + '\n' + sh.fragmentShader;
      // the rim: on the body's own surface, where it turns from the eye
      put('#include <emissivemap_fragment>', `  {
    float castF = pow( 1.0 - clamp( abs( dot( normalize( normal ), normalize( vViewPosition ) ) ), 0.0, 1.0 ), uCastRimP );
    ${cel ? 'castF = step( 0.42, castF ) * 0.55 + step( 0.7, castF ) * 0.45;' : ''}
    totalEmissiveRadiance += uCastRim * uCastRimK * castF;
  }`, true);
      if (resp) {
        sh.vertexShader = 'attribute vec2 aMR;\nvarying vec2 vCastMR;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vCastMR = aMR;');
        sh.fragmentShader = 'varying vec2 vCastMR;\n' + sh.fragmentShader;
        put('#include <roughnessmap_fragment>', '  roughnessFactor = clamp( vCastMR.x, 0.05, 1.0 );', true);
        put('#include <metalnessmap_fragment>', '  metalnessFactor = vCastMR.y;', true);
      }
      // the hemisphere in the page's ambient's place, and the body's own key gain on its direct light
      put('#include <lights_fragment_begin>', `  {
    vec3 castN = inverseTransformDirection( geometryNormal, viewMatrix );
    irradiance = PI * uCastFill * mix( uCastGround, uCastSky, 0.5 + 0.5 * castN.z );
    reflectedLight.directDiffuse *= uCastKey;
    reflectedLight.directSpecular *= uCastKey;${resp ? `
    // (and what the surface gives back of the rig's own sky and ground, by its response: a metal is this, in its colour;
    // skin and an eye a faint sheen; cloth next to nothing)
    vec3 castRw = inverseTransformDirection( reflect( - normalize( vViewPosition ), normalize( normal ) ), viewMatrix );
    reflectedLight.indirectSpecular += uCastFill * mix( uCastGround, uCastSky, smoothstep( -0.3, 0.5, castRw.z ) ) * material.specularColor * ( 1.0 - 0.6 * material.roughness ) * 3.0;` : ''}
  }`, true);
      if (own) put('#include <tonemapping_fragment>', '  gl_FragColor.rgb = castNeutral( gl_FragColor.rgb * uCastExposure );', false);
    };
    material.customProgramCacheKey = function () { return (beforeKey ? beforeKey.call(this) + '+' : '') + 'cast-' + (cel ? 'cel' : 'lit') + (own ? '-own' : '-form') + (resp ? '-resp' : ''); };
    material.needsUpdate = true;
    return material;
  }
  function ramp(bands) {
    const px = new Uint8Array(bands.ramp.length * 4);
    bands.ramp.forEach((v, i) => { const b = Math.round(255 * v); px[i * 4] = b; px[i * 4 + 1] = b; px[i * 4 + 2] = b; px[i * 4 + 3] = 255; });
    const t = new THREE.DataTexture(px, bands.ramp.length, 1);
    t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
    return t;
  }
  function material(R, opts) {
    const o = Object.assign({}, opts), register = o.register || R.register || 'western', surface = o.surface || 'paint', U = o.uniforms || uniforms(R);
    const response = !!o.response; delete o.register; delete o.surface; delete o.uniforms; delete o.response;
    const cel = register === 'anime';
    const m = cel ? new THREE.MeshToonMaterial(Object.assign({ gradientMap: ramp(R.bands || { ramp: [0.36, 0.65, 1] }) }, o))
      : new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.62, metalness: 0 }, o));
    return patch(m, U, { register, surface, response });
  }
  function key(scene, R, opts) {
    const sun = opts && opts.sun;
    if (sun) return sun;
    const lin = R.key.linear, m = Math.max(lin[0], lin[1], lin[2], 1e-9), colour = new THREE.Color().setRGB(lin[0] / m, lin[1] / m, lin[2] / m, THREE.LinearSRGBColorSpace), level = Math.PI * m;
    const dirs = [];
    scene.traverse((o) => { if (o.isDirectionalLight) dirs.push(o); });
    let light = dirs.find((l) => l.castShadow) || null;
    if (!light) {
      light = new THREE.DirectionalLight(colour, level);
      light.position.set(R.key.toLight[0], R.key.toLight[1], R.key.toLight[2]).multiplyScalar(100);
      scene.add(light, light.target);
    }
    for (const l of dirs) l.intensity = 0;
    light.color.copy(colour); light.intensity = level;
    return light;
  }
  return { uniforms, patch, material, key, ramp };
}

/** The kit as page source: an expression a page assigns, in a scope with THREE. */
export const castKitSource = () => `(${buildCastKit.toString()})(THREE)`;

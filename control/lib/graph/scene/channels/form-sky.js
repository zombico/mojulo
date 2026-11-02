// In-page script (part of the form channel, channels/form-land.js): THE FORM RENDER'S SKY (gen-7), the light that lights
// its land, seen. The land is lit by the cube's solved sun and sky light (form/land-read.js `light`); the sky drawn over
// it is that same light, not a palette painted behind it:
//
//   the air      its radiance a shape over the dome, its level set so its average as the ground receives it (cosine-
//                weighted over the upper half, by luminance) IS the solved sky light's: the cube's horizon and zenith
//                colours its hue and its gradient, more air toward the horizon (`horizon`), the sky's scattering round the sun
//                (Rayleigh, `rayleigh`) and the forward glow at it (Mie, Henyey-Greenstein `mie.g`, × the solved sun)
//   the sun      a disc where the solved sun stands (D.sun), at the solved sun's light × `sun.disc`, darker at its limb
//   the clouds   a layer at `clouds.alt` m, its cover the recipe's weather (a geocube's `clouds`: clear, fair, overcast,
//                storm, haze, high, and its cover; absent, fair where the stage painted clouds and clear (a few
//                fair-weather clouds) where it painted none), each cloud its noise over the plane under the eye's own position (so it passes over
//                as the eye walks), lit by the solved sun through its own depth toward the sun (a step `clouds.step`
//                along it) with a silver edge facing the sun, and by the sky light from below; past `clouds.fade` m
//                of its plane, the horizon's air over it. Drifting with the page's wind when it has one
//   the haze     the page's distance haze takes the air where the far land stands (`haze.h` over the horizon, a shade
//                deeper: `haze.depth`), so the far land fades into the sky just over it; the stage's painted far land
//                takes the haze too
//
// A gen-7 geocube page without the form render (a geocity) carries it too (formSkyInput: its light the cube's own sky
// colours). Drawn through the land's own tone curve. It replaces what the stage painted for the sky (its painted clouds, its
// cloud band, its painted sun), its painted clouds' cut-out cards with them; the stars and the moon of a night sky stay. `window.__formSky` { cover, kind, A }.
export const FORM_SKY = Object.freeze({
  radius: 3000,
  horizon: Object.freeze({ lift: 0.6, sharp: 8 }),
  rayleigh: 0.45,
  painted: Object.freeze({ sun: 2.6, warm: Object.freeze([1, 0.96, 0.88]) }),
  haze: Object.freeze({ h: 0.04, depth: 0.92 }),
  mie: Object.freeze({ g: 0.8, gain: 0.35 }),
  sun: Object.freeze({ radius: 0.6, disc: 60 }),
  clouds: Object.freeze({
    alt: 1500, scale: 900, fade: 9000, step: 0.06, albedo: 0.9, drift: 4,
    kinds: Object.freeze({
      clear: Object.freeze({ cover: [0.22, 0.34], dark: 0, veil: 0, stretch: 1 }),
      fair: Object.freeze({ cover: [0.25, 0.6], dark: 0.1, veil: 0, stretch: 1 }),
      overcast: Object.freeze({ cover: [0.82, 0.95], dark: 0.45, veil: 0.2, stretch: 1.4 }),
      storm: Object.freeze({ cover: [0.9, 1], dark: 0.7, veil: 0.3, stretch: 1.6 }),
      haze: Object.freeze({ cover: [0.1, 0.3], dark: 0.1, veil: 0.55, stretch: 3 }),
      high: Object.freeze({ cover: [0.3, 0.6], dark: 0, veil: 0, stretch: 6, thin: 0.55, alt: 6000 }),
    }),
  }),
});

const C = FORM_SKY, CL = C.clouds;

const SKY_FRAG = `uniform vec3 uSun, uSunL, uAmb, uZen, uHor, uA;
uniform float uCover, uDark, uVeil, uStretch, uThin, uAlt, uTime, uSeed;
uniform vec2 uDrift;
varying vec3 vWorld;
float h21( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) + uSeed * 0.137 ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
float vnoise( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( h21( i ), h21( i + vec2( 1.0, 0.0 ) ), f.x ), mix( h21( i + vec2( 0.0, 1.0 ) ), h21( i + vec2( 1.0, 1.0 ) ), f.x ), f.y ); }
float fbm( vec2 p ) { float s = 0.0, a = 0.5; for ( int o = 0; o < 6; o++ ) { s += a * vnoise( p ); p = p * 2.03 + vec2( 17.1, 9.3 ); a *= 0.5; } return s / 0.984; }
float hg( float mu, float g ) { return ( 1.0 - g * g ) / ( 4.0 * 3.14159265 * pow( 1.0 + g * g - 2.0 * g * mu, 1.5 ) ); }
// (the air: the solved sky light's hue and level, shaped)
vec3 air( vec3 v, float mu ) {
  float h = clamp( v.z, 0.0, 1.0 );
  vec3 hue = mix( uHor, uZen, pow( h, 0.45 ) );
  return uA * hue * ( 1.0 - ${C.rayleigh.toFixed(2)} + ${C.rayleigh.toFixed(2)} * 0.75 * ( 1.0 + mu * mu ) ) * ( 1.0 + ${C.horizon.lift.toFixed(2)} * exp( -h * ${C.horizon.sharp.toFixed(1)} ) );
}
void main() {
  vec3 v = normalize( vWorld - cameraPosition );
  float mu = dot( v, uSun );
  vec3 col = air( v, mu ) + uSunL * hg( mu, ${C.mie.g.toFixed(2)} ) * ${C.mie.gain.toFixed(2)} * ( 0.3 + 0.7 * exp( -max( v.z, 0.0 ) * 3.0 ) );
  // (under the horizon: the horizon's air, deepening)
  if ( v.z < 0.0 ) col = air( vec3( v.xy, 0.0 ), mu ) * mix( 1.0, 0.7, clamp( -v.z * 4.0, 0.0, 1.0 ) );
  // the sun's disc, darker at its limb
  float cr = cos( ${(C.sun.radius * Math.PI / 180).toFixed(5)} );
  if ( mu > cr && v.z > -0.02 ) col += uSunL * ${C.sun.disc.toFixed(1)} * ( 0.55 + 0.45 * sqrt( clamp( 1.0 - ( 1.0 - mu ) / ( 1.0 - cr ), 0.0, 1.0 ) ) );
  // the clouds: a layer over the eye, lit through itself by the sun and from below by the sky
  if ( v.z > 0.0 && uCover > 0.0 ) {
    float t = uAlt / max( v.z, 0.015 );
    vec2 q = ( cameraPosition.xy + v.xy * t ) / ${CL.scale.toFixed(1)} + uDrift * uTime;
    q.x /= uStretch;
    float n = fbm( q + 0.35 * vec2( fbm( q * 0.5 + 3.1 ), fbm( q * 0.5 + 7.7 ) ) ), lo = 1.0 - uCover;
    float dens = smoothstep( lo, lo + 0.22, n ) * uThin;
    if ( dens > 0.0 ) {
      float n2 = fbm( q + uSun.xy * ${CL.step.toFixed(3)} * 10.0 + 0.35 * vec2( fbm( q * 0.5 + 3.1 ), fbm( q * 0.5 + 7.7 ) ) );
      float through = exp( -4.0 * max( 0.0, n2 - lo ) ), deep = smoothstep( lo, 1.0, n );
      vec3 lit = uSunL * max( uSun.z, 0.0 ) * through * ( 0.55 + 2.2 * hg( mu, 0.6 ) ) + uAmb * ( 1.25 - 0.5 * deep );
      vec3 cloud = ${CL.albedo.toFixed(2)} * lit * ( 1.0 - uDark * deep );
      cloud = mix( cloud, air( vec3( v.xy, 0.02 ), mu ), clamp( t / ${CL.fade.toFixed(1)}, 0.0, 1.0 ) );
      col = mix( col, cloud, dens * smoothstep( 0.0, 0.06, v.z ) );
    }
  }
  // (a hazy weather's veil: the air whitened toward the horizon)
  col = mix( col, uAmb * 1.6, uVeil * exp( -max( v.z, 0.0 ) * 2.5 ) );
  gl_FragColor = vec4( col, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** The sky's input on a page without the form render (a gen-7 geocity, scene-three.js `formSky`): no solved light there,
 *  so its sky light is the cube's own sky colours (linear, their mean) and its sun that light's level × `painted.sun`, warm. */
export function formSkyInput({ sun, zenith, horizon, clouds }) {
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const amb = [0, 1, 2].map((c) => (lin(zenith[c]) + lin(horizon[c])) / 2), L = 0.2126 * amb[0] + 0.7152 * amb[1] + 0.0722 * amb[2];
  const r4 = (v) => Math.round(v * 1e4) / 1e4;
  return { sun, sky: { zenith, horizon }, light: { ambient: amb.map(r4), sun: C.painted.warm.map((w) => r4(w * L * C.painted.sun)) }, ...(clouds ? { clouds } : {}) };
}

/** The sky's page source, in the form channel's scope (THREE, scene, D: the form input, its `sky`, `sun`, `light` and
 *  `clouds`, meshes: the page's painted groups). */
export function formSkyScript() {
  return `
  // --- the form render's sky: the light that lights the land, seen (channels/form-sky.js) ---
  (function () {
    const FSK = ${JSON.stringify(C)}, CK = FSK.clouds.kinds;
    const lin = (a) => a.map((c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
    const sun = new THREE.Vector3(...D.sun).normalize(), zen = lin(D.sky.zenith), hor = lin(D.sky.horizon), amb = D.light.ambient, sunL = D.light.sun;
    // (the air's level: the shape's cosine-weighted average over the upper half, channel by channel, is the solved sky light)
    const shape = [0, 0, 0]; let wsum = 0;
    for (let j = 0; j < 24; j++) for (let i = 0; i < 48; i++) {
      const el = ((j + 0.5) / 24) * Math.PI / 2, az = ((i + 0.5) / 48) * Math.PI * 2, ce = Math.cos(el), v = [ce * Math.cos(az), ce * Math.sin(az), Math.sin(el)];
      const mu = v[0] * sun.x + v[1] * sun.y + v[2] * sun.z, h = v[2], w = Math.sin(el) * ce, t = Math.pow(h, 0.45);
      const k = (1 - FSK.rayleigh + FSK.rayleigh * 0.75 * (1 + mu * mu)) * (1 + FSK.horizon.lift * Math.exp(-h * FSK.horizon.sharp));
      for (let c = 0; c < 3; c++) shape[c] += w * (hor[c] + (zen[c] - hor[c]) * t) * k;
      wsum += w;
    }
    const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], a = lum(amb) / Math.max(1e-6, lum(shape) / wsum), A = [a, a, a];
    // (the clouds: the recipe's weather and cover; absent, fair where the stage painted clouds, clear where it painted none)
    const painted = !!meshes['isekai:cloud'], W = D.clouds || { kind: painted ? 'fair' : 'clear', cover: 0.5, seed: 1 }, K = CK[W.kind] || CK.fair;
    const cover = K.cover[0] + (K.cover[1] - K.cover[0]) * (W.cover ?? 0.5);
    const U = { uSun: { value: sun }, uSunL: { value: new THREE.Vector3(...sunL) }, uAmb: { value: new THREE.Vector3(...amb) }, uZen: { value: new THREE.Vector3(...zen) }, uHor: { value: new THREE.Vector3(...hor) },
      uA: { value: new THREE.Vector3(...A) }, uCover: { value: cover }, uDark: { value: K.dark }, uVeil: { value: K.veil }, uStretch: { value: K.stretch }, uThin: { value: K.thin ?? 1 },
      uAlt: { value: K.alt ?? FSK.clouds.alt }, uTime: { value: 0 }, uSeed: { value: W.seed ?? 1 }, uDrift: { value: new THREE.Vector2(FSK.clouds.drift / FSK.clouds.scale, 0) } };
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), new THREE.ShaderMaterial({ uniforms: U, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vWorld;\\nvoid main() { vec4 w = modelMatrix * vec4( position, 1.0 ); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: ${JSON.stringify(SKY_FRAG)} }));
    dome.renderOrder = -1.9; dome.frustumCulled = false; dome.raycast = () => {}; scene.add(dome);
    // (what the stage painted for the sky leaves: its clouds, its cloud band, its painted sun by day; a night's stars and moon stay)
    let day = 1; try { day = SKY.day; } catch (e) { /* no sky dome on the page */ }
    scene.traverse((o) => { if (o.userData.g === 'isekai:cloud' || o.renderOrder === -1.5 || (o.isSprite && o.renderOrder === -1 && day >= 0.5)) o.visible = false; });
    // (the haze takes the air where the far land stands, a little over the horizon (FSK.haze.h), round the turn: the far
    // land fades into the sky just over it; the stage's painted far land takes the haze too)
    const hh = FSK.haze.h, ht = Math.pow(hh, 0.45), hk = (1 - FSK.rayleigh + FSK.rayleigh * 0.75 * (1 + 0.5)) * (1 + FSK.horizon.lift * Math.exp(-hh * FSK.horizon.sharp));
    const hz = [0, 1, 2].map((c) => A[c] * (hor[c] + (zen[c] - hor[c]) * ht) * hk * FSK.haze.depth);
    if (scene.fog) scene.fog.color.setRGB(hz[0], hz[1], hz[2], THREE.LinearSRGBColorSpace);
    if (typeof FAR_AIR !== 'undefined') FAR_AIR.value.set(hz[0], hz[1], hz[2]);
    scene.traverse((o) => { if (o.isMesh && o.visible && o.material && !o.material.fog && /^isekai:/.test(String(o.userData.g || ''))) { o.material.fog = true; o.material.needsUpdate = true; } });
    // (each frame: the dome round the eye, inside the camera's far plane; the clouds' clock the page's wind's, else its own)
    const prev = scene.onBeforeRender, wind = () => window.__mojTerrain && window.__mojTerrain.wind && window.__mojTerrain.wind.uniforms;
    scene.onBeforeRender = function (r, s, cam, rt) {
      if (prev) prev.call(this, r, s, cam, rt);
      dome.position.setFromMatrixPosition(cam.matrixWorld); dome.scale.setScalar(Math.min(FSK.radius, (cam.far || 8000) * 0.9)); dome.updateMatrixWorld();
      const W2 = wind(); U.uTime.value = W2 && W2.uWindT ? W2.uWindT.value : performance.now() / 1000;
    };
    window.__formSky = { kind: W.kind, cover, A };
  })();
`;
}

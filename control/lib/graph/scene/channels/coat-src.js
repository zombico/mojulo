/**
 * THE COAT'S SOURCE — a rim light drawn on a body: a second draw of each of its meshes (the same triangles, a patched
 * basic material, so the page's log depth holds, pushed a hair along the normal), lit pow(1 - |n·v|, p) in a colour,
 * soft or as a cel BAND. One source for the pages that draw one: a status's coat (status-channel.js) and a thing
 * indicated (a highlight, fx.js). Each page names its own copy, so two channels on a page never declare one name twice.
 *
 *   coatMatSrc(name, band)       `function <name>(color, dark, p[, band])` → the material; its strength is
 *                                `material.userData.uK.value`. `band`: whether the page needs the cel band's uniform
 *   smoothNormalsSrc(name)       `function <name>(geo)`: smooth normals for a geometry that carries none (its corners
 *                                averaged where they meet), so a coat sits on it
 * The text is a compatibility promise: the status channel's pages are pinned on it.
 */
export function coatMatSrc(name, band) {
  return `function ${name}(color, dark, p${band ? ', band' : ''}) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color[0], color[1], color[2]), transparent: true, depthWrite: false, blending: dark ? THREE.NormalBlending : THREE.AdditiveBlending });
  m.userData.uK = { value: 0 }; m.userData.__fire = true;   // its own light: the fire channel leaves it unlit
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRimK = m.userData.uK; sh.uniforms.uRimP = { value: p }; sh.uniforms.uRimDark = { value: dark ? 1 : 0 };${band ? `
    sh.uniforms.uRimBand = { value: band || 0 };` : ''}
    sh.vertexShader = 'varying vec3 vRimN;\\nvarying vec3 vRimV;\\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\\ntransformed += normal * 0.015;').replace('#include <project_vertex>', '#include <project_vertex>\\nvRimN = normalize(normalMatrix * normal);\\nvRimV = normalize(-mvPosition.xyz);');
    sh.fragmentShader = 'uniform float uRimK;\\nuniform float uRimP;\\nuniform float uRimDark;\\n${band ? 'uniform float uRimBand;\\n' : ''}varying vec3 vRimN;\\nvarying vec3 vRimV;\\n' + sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\\n${band ? `float rimF = pow(1.0 - abs(dot(normalize(vRimN), normalize(vRimV))), uRimP);\\nfloat rim = clamp((uRimBand > 0.0 ? step(uRimBand, rimF) : rimF) * uRimK, 0.0, 1.0);` : 'float rim = clamp(pow(1.0 - abs(dot(normalize(vRimN), normalize(vRimV))), uRimP) * uRimK, 0.0, 1.0);'}\\ngl_FragColor = uRimDark > 0.5 ? vec4(0.0, 0.0, 0.0, rim) : vec4(gl_FragColor.rgb * rim, 1.0);');
  };
  return m;
}
`;
}

export function smoothNormalsSrc(name) {
  return `function ${name}(geo) {
  const P = geo.attributes.position.array, N = new Float32Array(P.length), acc = new Map(), key = (i) => Math.round(P[i] * 1e4) + ',' + Math.round(P[i + 1] * 1e4) + ',' + Math.round(P[i + 2] * 1e4);
  for (let t = 0; t + 8 < P.length; t += 9) {
    const ax = P[t + 3] - P[t], ay = P[t + 4] - P[t + 1], az = P[t + 5] - P[t + 2], bx = P[t + 6] - P[t], by = P[t + 7] - P[t + 1], bz = P[t + 8] - P[t + 2];
    const n = [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
    for (let k = 0; k < 9; k += 3) { const q = key(t + k), a = acc.get(q) || [0, 0, 0]; a[0] += n[0]; a[1] += n[1]; a[2] += n[2]; acc.set(q, a); }
  }
  for (let i = 0; i < P.length; i += 3) { const a = acc.get(key(i)) || [0, 0, 1], l = Math.hypot(a[0], a[1], a[2]) || 1; N[i] = a[0] / l; N[i + 1] = a[1] / l; N[i + 2] = a[2] / l; }
  geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
}
`;
}

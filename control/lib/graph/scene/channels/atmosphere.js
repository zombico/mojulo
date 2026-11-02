// In-page script: THE AIR of a gen-7 geocube page (opt-in, the recipe's `air`): the outside's path, trail and geocity, and
// the inside's hall, rooms and cavern. Two things, one source:
//
//   the fog    three's own fog chunk, patched once before any material compiles, so every surface that takes the page's
//              fog takes this one (the form's land, its grass and far field, its trees and their cards, the far structures'
//              tiles, a room's baked surfaces, the painted far ring). Beer-Lambert, its extinction set by a VISIBILITY in
//              metres (the distance where a dark thing's contrast against the air falls to 2%: sigma = 3.912 / (V - clear)),
//              past a CLEAR distance at the eye. Outside it LIES LOW: its density falls with height over the layer's base
//              (the walk's ground at the spawn) by a scale height, so a valley's mist sits at the walker's feet and a hill
//              top stands over it; the optical depth along each ray is integrated in closed form. Toward the sun it glows
//              (forward scattering, `glow`). Its colour is the page's (the form sky's haze where it stands, the city's air,
//              a cavern's dark), a room's its own light (roomAirColour), and anything that thickens or thins the page's fog (the weather, an eye's height
//              over a terrain) thickens or thins this one: `scene.fog.density` is its extinction at the base, per unit.
//   the sky    the gen-7 sky (channels/form-sky.js) veiled to the air at its horizon, in a band as thick as the air
//              (`band`), so the land and the sky meet in one colour where the fog swallows the land.
//   the blur   a depth-aware softening of the far (`blur`, css pixels at its most), drawn by the frame pass
//              (channels/frame-pass.js, shared with the view cone's `soften`): each pixel spread by how much air lies
//              between it and the eye (the same optical depth, rebuilt from the depth), only past the view cone's reach
//              where the page has one (where the impostors begin: the trees' and the buildings' cards, the far field's
//              colour) and never nearer than `from` x the visibility.
//
// Absent `air` => NOT emitted: the page's fog chunk, its sky and its frame are untouched. `window.__mojAir` is the probe:
// { kind, visibility, sigma, height, blur, sky (veiled), fog(), depth(ez, rx, ry, rz),
// taken(ez, rx, ry, rz) (past ATMOSPHERE.cull), set({ blur? }) }.
import { safeJson } from '../emit-util.js';

/** The kinds of air and their measures. `outside` (a path, a trail, a town), `city` (a geocity: a metro kilometres across)
 *  and `inside` each a visibility (m, the 2% contrast distance), a clear distance at the eye (m) and, but inside, a scale
 *  height (m: the density falls by e over it); `glow` how much brighter the air is toward the sun, `band` how high the
 *  sky's veil rises (its e-folding, in the sine of the elevation). */
export const ATMOSPHERE = Object.freeze({
  contrast: 0.02,
  kinds: Object.freeze({
    haze: Object.freeze({ read: 'a soft haze: the far land paled into the sky, the near clear', outside: Object.freeze({ visibility: 300, clear: 30, height: 200 }), city: Object.freeze({ visibility: 6000, clear: 300, height: 800 }), inside: Object.freeze({ visibility: 80, clear: 6 }), glow: 0.5, band: 0.15 }),
    mist: Object.freeze({ read: 'a low mist lying on the ground, the hill tops over it', outside: Object.freeze({ visibility: 160, clear: 10, height: 15 }), city: Object.freeze({ visibility: 2000, clear: 100, height: 40 }), inside: Object.freeze({ visibility: 45, clear: 4 }), glow: 0.8, band: 0.08 }),
    fog: Object.freeze({ read: 'a thick fog: the near world grey within a hundred metres, the sky white over it', outside: Object.freeze({ visibility: 90, clear: 4, height: 40 }), city: Object.freeze({ visibility: 600, clear: 30, height: 150 }), inside: Object.freeze({ visibility: 18, clear: 2 }), glow: 0.35, band: 2 }),
  }),
  range: Object.freeze({ visibility: Object.freeze([10, 20000]), height: Object.freeze([1, 5000]), clear: Object.freeze([0, 500]), glow: Object.freeze([0, 3]), blur: Object.freeze([0, 8]) }),
  // the blur: its most in css pixels, its taps, and where it begins on a page with no view cone (x the visibility)
  blur: Object.freeze({ px: 3, taps: 16, from: 0.2 }),
  // how far the sky is read at (m): its veil's ray is the horizon's at this distance
  sky: 3000,
  // the optical depth past which the air has taken a thing (a contrast of e^-6, a quarter of a percent): a page may leave
  // it undrawn (the city's kit and trees, channels/city-cone.js; the far trees and buildings, form-flora.js, far-structures.js)
  cull: 6,
});

const KEYS = ['kind', 'visibility', 'clear', 'height', 'glow', 'blur', 'colour'];
const inRange = (v, [lo, hi]) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** A recipe's `air`, read: a kind's word (`haze`, `mist`, `fog`), `true` (haze), or `{ kind?, visibility?, clear?, height?,
 *  glow?, blur? }` over a kind (haze unless named), at the measures of `where` it is: 'outside' (the default), 'city' (a
 *  geocity) or 'inside' (a hall, a room, a cavern: the air lies even, no height; `inside: true` says the same).
 *  `height: false` lies even outside too; `blur: false` (or 0) keeps the frame sharp, `true` the default, a number its
 *  most in css pixels; `colour` (#rrggbb) the air's own colour as the eye sees it (a neon night's glow), else the page's. Absent / false / null => null. Anything malformed throws, naming the setting. */
export function readAtmosphere(v, { where = 'outside', inside = where === 'inside' } = {}) {
  if (v === undefined || v === null || v === false) return null;
  const K = ATMOSPHERE.kinds, R = ATMOSPHERE.range, names = Object.keys(K).join(', ');
  const say = `air is a kind (${names}), true (haze), or { ${KEYS.join(', ')} }: the fog a gen-7 page is seen through, lying low outside, and the far softened`;
  const o = v === true ? {} : typeof v === 'string' ? { kind: v } : v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  if (!o) throw new Error(say);
  for (const k of Object.keys(o)) if (!KEYS.includes(k)) throw new Error(`air.${k} is not a setting (${KEYS.join(', ')})`);
  const kind = o.kind ?? 'haze';
  if (!Object.hasOwn(K, kind)) throw new Error(`air.kind is one of: ${names}`);
  const k = K[kind], m = inside ? k.inside : where === 'city' ? k.city : k.outside;
  const visibility = o.visibility ?? m.visibility, clear = o.clear ?? m.clear;
  if (!inRange(visibility, R.visibility)) throw new Error(`air.visibility is the distance in metres where the far fades into the air (${R.visibility[0]} to ${R.visibility[1]})`);
  if (!inRange(clear, R.clear) || clear >= visibility) throw new Error(`air.clear is the clear distance at the eye in metres (${R.clear[0]} to ${R.clear[1]}), under the visibility`);
  let height = inside ? null : m.height;
  if (o.height !== undefined) {
    if (o.height === false) height = null;
    else if (inside) throw new Error('air.height is the outside\'s: inside, the air lies even (height: false, or leave it out)');
    else if (!inRange(o.height, R.height)) throw new Error(`air.height is the air's scale height in metres (${R.height[0]} to ${R.height[1]}: it thins by e over it), or false to lie even`);
    else height = o.height;
  }
  const glow = o.glow ?? k.glow;
  if (!inRange(glow, R.glow)) throw new Error(`air.glow is how much brighter the air is toward the sun (${R.glow[0]} to ${R.glow[1]})`);
  const b = o.blur;
  if (b !== undefined && typeof b !== 'boolean' && !inRange(b, R.blur)) throw new Error(`air.blur is true, false, or the far's softening at its most in css pixels (${R.blur[0]} to ${R.blur[1]})`);
  const blur = b === undefined || b === true ? ATMOSPHERE.blur.px : b === false ? 0 : b;
  if (o.colour !== undefined && !(typeof o.colour === 'string' && /^#[0-9a-f]{6}$/i.test(o.colour))) throw new Error('air.colour is the air\'s own colour as the eye sees it, #rrggbb (a neon night\'s glow); absent, the page\'s');
  const colour = o.colour ? [1, 3, 5].map((i) => Math.round((parseInt(o.colour.slice(i, i + 2), 16) / 255) * 1e4) / 1e4) : null;
  const r4 = (x) => Math.round(x * 1e6) / 1e6;
  return { kind, visibility, clear, height, glow, band: k.band, blur, colour, sigma: r4(-Math.log(ATMOSPHERE.contrast) / (visibility - clear)) };
}

/** The air's colour in a room under no sun (a gen-7 room's form: its solved light, linear): the room's light scattered by
 *  it, its ambient and a share of its lamps (`lamps`) over its void, as the eye reads it (encoded: three lays the fog over
 *  the encoded frame). */
export const ROOM_AIR = Object.freeze({ lamps: 0.05 });
export function roomAirColour({ ambient, lights = [], void: shade = null }) {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)), enc = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
  const base = typeof shade === 'string' && /^#[0-9a-f]{6}$/i.test(shade) ? [1, 3, 5].map((i) => lin(parseInt(shade.slice(i, i + 2), 16) / 255)) : [0, 0, 0];
  const mean = [0, 1, 2].map((c) => (lights.length ? lights.reduce((a, l) => a + l.key[c], 0) / lights.length : 0));
  return [0, 1, 2].map((c) => Math.round(Math.min(1, enc(base[c] + (ambient?.[c] ?? 0) + ROOM_AIR.lamps * mean[c])) * 1e4) / 1e4);
}

/** The page's input from a read air: its measures in the page's units (`unit` metres a unit), the layer's base (the walk's
 *  ground at its spawn, z), the sun's direction where the page has one (outside), and its own colour where it has one (a
 *  room's: roomAirColour; else the page's fog colour stands). */
export function atmosphereInput(A, { base = 0, sun = null, unit = 1, colour = null } = {}) {
  const r5 = (x) => Math.round(x * 1e5) / 1e5, u = unit > 0 ? unit : 1;
  const s = sun && sun.length === 3 ? Math.hypot(...sun) : 0;
  return {
    kind: A.kind, visibility: r5(A.visibility / u), clear: r5(A.clear / u), height: A.height === null ? null : r5(A.height / u), sigma: r5(A.sigma * u),
    base: r5(base), glow: s > 0 ? A.glow : 0, sun: s > 0 ? sun.map((c) => r5(c / s)) : null, band: A.band, blur: A.blur,
    from: r5((A.visibility * ATMOSPHERE.blur.from) / u), sky: r5(ATMOSPHERE.sky / u), ...(colour ? { colour } : {}),
  };
}

const f = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x));

/** The air's GLSL: the optical depth along a ray `r` from the eye (world units, z up) at extinction `s` at the base, and
 *  the air's colour along it. Literals from the page's air; `cameraPosition` the eye (three's, or the blur's own). */
export function atmosphereGlsl(cfg, eye = 'cameraPosition') {
  const H = cfg.height;
  const depth = H === null
    ? `  return s * max( L - ${f(cfg.clear)}, 0.0 );`
    : `  float h0 = max( ${eye}.z - ${f(cfg.base)}, 0.0 ), h1 = max( ${eye}.z + r.z - ${f(cfg.base)}, 0.0 ), dh = ( h1 - h0 ) / ${f(H)};
  float e0 = exp( - h0 / ${f(H)} ), mean = abs( dh ) > 1e-4 ? ( e0 - exp( - h1 / ${f(H)} ) ) / dh : e0;
  return s * max( L - ${f(cfg.clear)}, 0.0 ) * mean;`;
  const colour = cfg.sun && cfg.glow > 0
    ? `  float mu = max( dot( r / max( length( r ), 1e-4 ), vec3( ${cfg.sun.map(f).join(', ')} ) ), 0.0 );
  return c * ( 1.0 + ${f(cfg.glow)} * mu * mu * mu * mu * mu * mu * mu * mu );`
    : '  return c;';
  return `float airDepth( vec3 r, float s ) {
  float L = length( r );
${depth}
}
vec3 airColour( vec3 r, vec3 c ) {
${colour}
}
`;
}


/** The air's EARLY page source, placed right after the scene is made (scene-three.js): three's fog chunk patched before any
 *  material is made, and the probe. Its blur is the frame pass's (channels/frame-pass.js), emitted beside it. */
export function atmosphereEarlyScript(cfg) {
  const GL = atmosphereGlsl(cfg);
  return `
// --- the air, first: three's fog chunk (channels/atmosphere.js; its blur is the frame pass's, channels/frame-pass.js) ---
(function () {
  const AT = ${safeJson(cfg)}, GL = ${JSON.stringify(GL)};
  // (three's fog chunk, once, before any material compiles: the ray from the eye in world space, its optical depth)
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = C.fog_pars_vertex.replace('varying float vFogDepth;', 'varying float vFogDepth;\\n\\tvarying vec3 vAirRay;');
  C.fog_vertex = C.fog_vertex.replace('vFogDepth = - mvPosition.z;', 'vFogDepth = - mvPosition.z;\\n\\tvAirRay = ( vec4( mvPosition.xyz, 0.0 ) * viewMatrix ).xyz;');
  C.fog_pars_fragment = C.fog_pars_fragment.replace('varying float vFogDepth;', 'varying float vFogDepth;\\n\\tvarying vec3 vAirRay;\\n' + GL);
  C.fog_fragment = C.fog_fragment.replace('float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );', 'float fogFactor = 1.0 - exp( - airDepth( vAirRay, fogDensity ) );')
    .replace('gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );', 'gl_FragColor.rgb = mix( gl_FragColor.rgb, airColour( vAirRay, fogColor ), fogFactor );');
  window.__mojAir = { kind: AT.kind, visibility: AT.visibility, sigma: AT.sigma, height: AT.height, blur: AT.blur, sky: false,
    set(o) { if (o && Number.isFinite(o.blur)) { this.blur = Math.max(0, o.blur); if (window.__mojFrame) window.__mojFrame.set({ air: this.blur }); } return this; },
    fog: () => (scene.fog ? { density: scene.fog.density, color: '#' + scene.fog.color.getHexString(), chunk: C.fog_fragment.indexOf('airDepth') >= 0 } : null),
    // (the optical depth along a ray r from an eye at height ez, at the page's fog now: the GLSL's airDepth, for what a
    // page may leave undrawn where the air has taken it, channels/city-cone.js)
    depth(ez, rx, ry, rz) {
      const sg = scene.fog ? scene.fog.density : AT.sigma, run = Math.max(Math.hypot(rx, ry, rz) - AT.clear, 0);
      if (AT.height === null) return sg * run;
      const h0 = Math.max(ez - AT.base, 0), h1 = Math.max(ez + rz - AT.base, 0), dh = (h1 - h0) / AT.height, e0 = Math.exp(-h0 / AT.height);
      return sg * run * (Math.abs(dh) > 1e-4 ? (e0 - Math.exp(-h1 / AT.height)) / dh : e0);
    },
    // (taken: past the air's cull, nothing of it reaches the eye)
    taken(ez, rx, ry, rz) { return this.depth(ez, rx, ry, rz) > ${ATMOSPHERE.cull}; } };
})();
`;
}

/** The air's page source; `cfg` an atmosphereInput. Runs before the weather's block (which reads and thickens the fog it
 *  sets) and after the room's form (whose toned void it colours over, where the recipe gave the air a colour); the sky's
 *  veil takes the dome as it is added to the scene. */
export function atmosphereScript(cfg) {
  const GL = atmosphereGlsl(cfg);
  return `
// --- the air: a fog by its visibility, lying low outside, the sky veiled to it (channels/atmosphere.js) ---
(function () {
  const AT = ${safeJson(cfg)}, GL = ${JSON.stringify(GL)}, probe = window.__mojAir;
  // (the page's fog, its colour kept unless the air has its own: its density is the air's extinction at the base, per unit)
  if (!scene.fog || !scene.fog.isFogExp2) scene.fog = new THREE.FogExp2(scene.fog ? scene.fog.color.clone() : scene.background && scene.background.isColor ? scene.background.clone() : new THREE.Color(0xb8c4cc), AT.sigma);
  scene.fog.density = AT.sigma;
  const tint = () => { if (AT.colour) scene.fog.color.setRGB(AT.colour[0], AT.colour[1], AT.colour[2], THREE.LinearSRGBColorSpace); };
  tint();
  // the sky's veil: the gen-7 dome takes the air at its horizon, in its band (patched before it compiles)
  const SU = { fogColor: { value: scene.fog.color }, fogDensity: { value: AT.sigma } };
  const veil = (o) => {
    const m = o.material;
    if (!m || !m.isShaderMaterial || !m.uniforms || !m.uniforms.uCover || probe.sky) return;
    Object.assign(m.uniforms, SU);
    m.fragmentShader = 'uniform vec3 fogColor;\\nuniform float fogDensity;\\n' + GL + m.fragmentShader.replace(/}\\s*$/, '  { vec3 hr = normalize( vec3( v.xy, 0.0 ) ) * ' + ${JSON.stringify(f(cfg.sky))} + ';\\n    float hz = 1.0 - exp( - airDepth( hr, fogDensity ) );\\n    gl_FragColor.rgb = mix( gl_FragColor.rgb, airColour( v, fogColor ), hz * exp( - max( v.z, 0.0 ) / ' + ${JSON.stringify(f(cfg.band))} + ' ) ); }\\n}\\n');
    m.needsUpdate = true; probe.sky = true; probe.veiled = m;
  };
  // (the dome is built when its land's maps have loaded, frames in: veiled as it is added to the scene, before it compiles)
  scene.traverse(veil);
  const add = scene.add;
  scene.add = function (...objs) { if (!probe.sky) for (const o of objs) if (o && o.isObject3D) o.traverse(veil); return add.apply(this, objs); };
  // (the air's own colour laid again after the first frame's hooks, over a toned room's void; each frame the veil's fog
  // the page's as the weather moves it)
  const prev = scene.onBeforeRender;
  let first = true;
  scene.onBeforeRender = function (r, s, cam, rt) {
    if (prev) prev.call(this, r, s, cam, rt);
    if (first) { first = false; tint(); }
    if (scene.fog) { SU.fogColor.value = scene.fog.color; SU.fogDensity.value = scene.fog.density; }
  };
})();
`;
}

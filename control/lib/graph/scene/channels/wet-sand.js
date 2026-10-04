import { safeJson } from '../emit-util.js';
import { WS_CAP, WS_DARK, WS_DRAIN, WS_FILM, WS_FOAM, WS_GLSL } from '../../materials/shore-moisture.js';

// In-page script: the beach's sand darkens where the swash has been and shines where it has just left a film
// (materials/shore-moisture.js). A patch on a material — no new geometry. The film reflects the water's sky (the aqua
// look's zenith/horizon) by Fresnel and catches the sun; a lace of foam rides the sheet's leading edge. Time rides the
// channel clock (stepWetSand), the same t the surface channel's swash reads.
//
// `__wsPatch(material, { baked, hole })` is shared with the soft-ground window (channels/soft-ground.js):
//   baked  the material's colours already carry the t = 0 moisture (the static sand faces, so exports keep the band):
//          the shader divides it out before applying the live one. The window's colours are dry sand: no division.
//   hole   discard inside `__wsShared.uWsHole` (x0, y0, x1, y1): the static sand steps aside where the window draws.

// value noise for the film's draining patches and the lace (hash per lattice point, smoothstep-blended)
const NOISE = `
float wsHash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float wsNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), w = f * f * (3.0 - 2.0 * f);
  return mix(mix(wsHash(i), wsHash(i + vec2(1.0, 0.0)), w.x), mix(wsHash(i + vec2(0.0, 1.0)), wsHash(i + vec2(1.0, 1.0)), w.x), w.y);
}
`;

const DECL = 'varying vec3 vWsP;\nuniform float uWsEdge, uWsRange, uWsOm, uWsTime;\nuniform vec3 uWsZen, uWsHor, uWsSun;\nuniform vec4 uWsHole;\n' + WS_GLSL + NOISE;

const live = (baked) => `{
  float wsT = wsDryTime(vWsP.y, uWsTime);
  float wsCap = vWsP.y > uWsEdge ? ${WS_CAP.toFixed(2)} * exp(-(vWsP.y - uWsEdge) / (uWsRange * 0.5)) : ${WS_CAP.toFixed(2)};
  float wsDark = max(exp(-wsT / ${WS_DRAIN.toFixed(1)}), wsCap), wsFilm = exp(-wsT / ${WS_FILM.toFixed(2)});
  // the film only where the sheet runs over sand above the sea; the darkening everywhere (under water the sand is wet)
  float wsOn = smoothstep(uWsEdge - uWsRange * 1.1, uWsEdge - uWsRange * 0.8, vWsP.y);
${baked ? `  // the faces are baked with this moisture at t = 0 (the export's frame): divide that out, apply the live one
  float wsDark0 = max(exp(-wsDryTime(vWsP.y, 0.0) / ${WS_DRAIN.toFixed(1)}), wsCap);
  gl_FragColor.rgb *= (1.0 - ${WS_DARK.toFixed(2)} * wsDark) / (1.0 - ${WS_DARK.toFixed(2)} * wsDark0);
` : `  gl_FragColor.rgb *= 1.0 - ${WS_DARK.toFixed(2)} * wsDark;
`}  // the film: a near-mirror, faintly rippled, reflecting the sky by Fresnel and the sun as a tight glint
  vec3 wsV = normalize(cameraPosition - vWsP);
  vec3 wsN = normalize(vec3(0.04 * sin(vWsP.x * 1.7 + vWsP.y * 0.6), 0.04 * sin(vWsP.y * 2.3 - vWsP.x * 0.4), 1.0));
  vec3 wsR = reflect(-wsV, wsN);
  float wsF = 0.02 + 0.98 * pow(1.0 - clamp(dot(wsV, wsN), 0.0, 1.0), 5.0);
  vec3 wsSky = mix(uWsHor, uWsZen, pow(max(wsR.z, 0.0), 0.55));
  // the sheet drains unevenly: patches of film linger in the hollows
  float wsPatch = 0.2 + 1.2 * wsNoise(vWsP.xy * 0.55 + 3.1);
  float wsW = wsFilm * wsOn * clamp(wsPatch + wsFilm * 0.5, 0.0, 1.0);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, wsSky, clamp(wsF * 1.2, 0.0, 0.6) * wsW)
    + vec3(1.0, 0.95, 0.86) * pow(max(dot(wsR, uWsSun), 0.0), 220.0) * 3.0 * wsW;
  // the sheet's leading edge: a lace of foam riding the run-up (the backwash's edge carries none)
  float wsPh = uWsOm * uWsTime, wsFront = uWsEdge - uWsRange * (0.5 - 0.5 * sin(wsPh));
  float wsLace = exp(-pow((vWsP.y - wsFront) / 0.7, 2.0)) * step(vWsP.y, wsFront + 0.4) * wsOn * smoothstep(-0.3, 0.3, cos(wsPh))
    * smoothstep(0.42, 0.7, 0.65 * wsNoise(vWsP.xy * vec2(1.6, 3.2) + vec2(0.0, uWsTime * 0.3)) + 0.35 * wsNoise(vWsP.xy * 5.0));
  // the foam the front leaves behind: stranded where it passed, carried down by the backwash while the water still
  // covers it (the pattern rides the sheet, then stops where the sheet leaves it), opening into holes as it pops
  float wsK = exp(-wsWetAge(vWsP.y, uWsTime) / ${WS_FOAM.toFixed(1)});
  vec2 wsQ = vec2(vWsP.x, vWsP.y + 0.6 * (uWsEdge - max(wsFront, vWsP.y)));
  float wsBub = 0.6 * wsNoise(wsQ * vec2(1.4, 2.6) + 7.3) + 0.4 * wsNoise(wsQ * 6.0);
  float wsTrail = wsOn * sqrt(wsK) * smoothstep(1.0 - 0.55 * wsK, 1.08 - 0.55 * wsK, wsBub);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.93, 0.96, 0.97), max(wsLace * 0.85, wsTrail * 0.75));
}
#include <tonemapping_fragment>`;

/** The shared page helpers: `__wsShared` (uniforms both materials read) and `__wsPatch`. Idempotent (`var`). */
export function wetSandHelpers(ws) {
  const cfg = { edge: ws.edgeY, range: ws.swashRange, om: ws.omSwash, zen: ws.zen, hor: ws.hor, sun: ws.sun };
  return `
var __wsShared = window.__wsShared || (window.__wsShared = (() => {
  const C = ${safeJson(cfg)}, v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  return { uWsEdge: { value: C.edge }, uWsRange: { value: C.range }, uWsOm: { value: C.om }, uWsTime: { value: 0 },
    uWsZen: { value: v3(C.zen) }, uWsHor: { value: v3(C.hor) }, uWsSun: { value: v3(C.sun).normalize() }, uWsHole: { value: new THREE.Vector4(1e9, 1e9, -1e9, -1e9) } };
})());
var __wsPatch = function (mat, o) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, __wsShared);
    sh.vertexShader = 'varying vec3 vWsP;\\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\\nvWsP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    let fs = sh.fragmentShader.replace('#include <tonemapping_fragment>', o.baked ? ${safeJson(live(true))} : ${safeJson(live(false))});
    if (o.hole) fs = fs.replace('void main() {', 'void main() {\\n  if (vWsP.x > uWsHole.x && vWsP.y > uWsHole.y && vWsP.x < uWsHole.z && vWsP.y < uWsHole.w) discard;');
    sh.fragmentShader = ${safeJson(DECL)} + fs;
  };
  mat.customProgramCacheKey = () => 'wetSand' + (o.baked ? 'Baked' : '') + (o.hole ? 'Hole' : '');
  mat.needsUpdate = true;
};`;
}

export function wetSandScript(ws) {
  return `${wetSandHelpers(ws)}
// --- wet sand (the swash's film and dampness on the sand group) ---
let stepWetSand = () => {};
{
  const m = meshes[${safeJson(ws.group || 'sand')}];
  if (m) __wsPatch(m.material, { baked: true, hole: ${ws.hole ? 'true' : 'false'} });
  stepWetSand = (t) => { __wsShared.uWsTime.value = t / 1000; };
}`;
}

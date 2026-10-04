import { safeJson } from '../emit-util.js';
import { WS_CAP, WS_DARK, WS_DRAIN, WS_FILM, WS_GLSL } from '../../materials/shore-moisture.js';

// In-page script: the beach's sand group darkens where the swash has been and shines where it has just left a film
// (materials/shore-moisture.js). A patch on the group's own baked material — no new geometry. The film reflects the
// water's sky (the aqua look's zenith/horizon) by Fresnel and catches the sun; rows under the still sea are left alone.
// Time rides the channel clock (stepWetSand), the same t the surface channel's swash reads.
// value noise for the film's draining patches and the lace (hash per lattice point, smoothstep-blended)
const NOISE = `
float wsHash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float wsNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), w = f * f * (3.0 - 2.0 * f);
  return mix(mix(wsHash(i), wsHash(i + vec2(1.0, 0.0)), w.x), mix(wsHash(i + vec2(0.0, 1.0)), wsHash(i + vec2(1.0, 1.0)), w.x), w.y);
}
`;

export function wetSandScript(ws) {
  const cfg = {
    group: ws.group || 'sand', edge: ws.edgeY, range: ws.swashRange, om: ws.omSwash,
    zen: ws.zen, hor: ws.hor, sun: ws.sun, film: WS_FILM, drain: WS_DRAIN, cap: WS_CAP,
  };
  return `
// --- wet sand (the swash's film and dampness on the sand group) ---
let stepWetSand = () => {};
{
  const WS = ${safeJson(cfg)}, m = meshes[WS.group];
  if (m) {
    const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
    const U = { uWsEdge: { value: WS.edge }, uWsRange: { value: WS.range }, uWsOm: { value: WS.om }, uWsTime: { value: 0 },
      uWsZen: { value: v3(WS.zen) }, uWsHor: { value: v3(WS.hor) }, uWsSun: { value: v3(WS.sun).normalize() } };
    m.material.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = 'varying vec3 vWsP;\\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\\nvWsP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'varying vec3 vWsP;\\nuniform float uWsEdge, uWsRange, uWsOm, uWsTime;\\nuniform vec3 uWsZen, uWsHor, uWsSun;\\n' + ${safeJson(WS_GLSL + NOISE)}
        + sh.fragmentShader.replace('#include <tonemapping_fragment>', ${safeJson(`{
  float wsT = wsDryTime(vWsP.y, uWsTime);
  float wsCap = vWsP.y > uWsEdge ? ${WS_CAP.toFixed(2)} * exp(-(vWsP.y - uWsEdge) / (uWsRange * 0.5)) : ${WS_CAP.toFixed(2)};
  float wsDark = max(exp(-wsT / ${WS_DRAIN.toFixed(1)}), wsCap), wsFilm = exp(-wsT / ${WS_FILM.toFixed(2)});
  // the film only where the sheet runs over sand above the sea; the darkening everywhere (under water the sand is wet)
  float wsOn = smoothstep(uWsEdge - uWsRange * 1.1, uWsEdge - uWsRange * 0.8, vWsP.y);
  // the faces are baked with this moisture at t = 0 (the export's frame): divide that out, apply the live one
  float wsT0 = wsDryTime(vWsP.y, 0.0);
  float wsCap0 = wsCap, wsDark0 = max(exp(-wsT0 / ${WS_DRAIN.toFixed(1)}), wsCap0);
  gl_FragColor.rgb *= (1.0 - ${WS_DARK.toFixed(2)} * wsDark) / (1.0 - ${WS_DARK.toFixed(2)} * wsDark0);
  // the film: a near-mirror, faintly rippled, reflecting the sky by Fresnel and the sun as a tight glint
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
  // the sheet's leading edge: a lace of foam riding the run-up
  float wsFront = uWsEdge - uWsRange * (0.5 - 0.5 * sin(uWsOm * uWsTime));
  float wsLace = exp(-pow((vWsP.y - wsFront) / 0.7, 2.0)) * step(vWsP.y, wsFront + 0.4) * wsOn
    * smoothstep(0.42, 0.7, 0.65 * wsNoise(vWsP.xy * vec2(1.6, 3.2) + vec2(0.0, uWsTime * 0.3)) + 0.35 * wsNoise(vWsP.xy * 5.0));
  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.93, 0.96, 0.97), wsLace * 0.85);
}
#include <tonemapping_fragment>`)});
    };
    m.material.customProgramCacheKey = () => 'wetSand';
    m.material.needsUpdate = true;
    stepWetSand = (t) => { U.uWsTime.value = t / 1000; };
  }
}`;
}

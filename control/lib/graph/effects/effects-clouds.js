/**
 * effects-clouds — the productized CLOUD DECK: fog's sibling (effects-fog.js). One call turns a world's
 * occluder boxes + a tuning object into an `effects[]` overlay layer emitThreeWorld composites over the
 * mesh. Salvaged from the 2026-09-17 smoke-and-cloud spike, whose round-3 composite showed that a lit,
 * Worley-eroded deck through the existing overlay seam reads as cumulus (lit tops, shaded troughs) and
 * clips behind the world's towers with the same box occluder the fog uses.
 *
 * Two modes, because a full-screen volumetric march every frame is the exception on the browser
 * /world path, not the default (the spike's budget rule):
 *   • `undershot` (default) — NOT a march. One plane intersection per pixel: the view ray meets the
 *     deck's base (camera below) or top (camera above); coverage + Worley erosion are sampled there;
 *     the slab's optical depth becomes alpha; the sample is lit by the sun transmitted through the
 *     slab (thin edges glow), a normalised phase lobe and a ground→sky ambient, then faded toward the
 *     horizon (aerial perspective, and it kills grazing-angle noise aliasing). No occluder: the band
 *     defaults to ABOVE the tallest box, so nothing solid crosses it. Cost ≈ one fbm + one Worley per
 *     pixel, no loop.
 *   • `full` — the spike's composite: buildVolumeFrag({ overlay:true }) over the band, Worley-eroded
 *     density, sun light-march + dual-lobe HG + powder + ambient, clipped by the box occluder when a
 *     box crosses the band (a `base` set below a tower). The light march samples an fbm-only shadow
 *     density (Worley inside the march was the spike's cost cliff).
 *
 * Both return the overlay-layer shape `{ frag, customUniforms, dataTextures, meta }`; `meta` publishes
 * the band (`base`, `top`) so cameras and walk eyes can stay out of it (a camera inside the band is a
 * whiteout — the spike's round-2 lesson). Deterministic: same boxes + opts → same bytes. The shared
 * GLSL (noise, Worley, phase, light march) is effects/volume-lib.js.
 */
import { SDF_GLSL } from './sdf-glsl.js';
import { bakeBoxField, boxFieldGLSL } from './effects-occluder.js';
import { buildVolumeFrag } from './volume-raymarch.js';
import { VOLUME_NOISE_GLSL, VOLUME_PHASE_GLSL, VOLUME_ENERGY, volumeSunGLSL, volumeLightGLSL } from './volume-lib.js';

export const CLOUD_DECK_MODES = Object.freeze(['undershot', 'full']);
// direction TOWARD the sun per frame: high and a little off-axis, so tops light and troughs shade.
const DEFAULT_SUN = Object.freeze({ z: [0.35, -0.25, 0.75], y: [0.35, 0.75, 0.25] });

const f = (x) => (+x).toFixed(4);
const v3 = (a) => `vec3(${a.map(f).join(', ')})`;
const isVec3 = (a) => Array.isArray(a) && a.length === 3 && a.every((c) => Number.isFinite(+c));
const boxOk = (b) => b && ['cx', 'cy', 'cz', 'hx', 'hy', 'hz'].every((k) => Number.isFinite(+b[k]));

/**
 * Compose a cloud deck over a box world.
 * @param {Array<{cx,cy,cz,hx,hy,hz}>} boxes  the world's solids: the band defaults to above their tallest
 *   top, and `full` mode clips against the ones that cross the band. May be empty.
 * @param {object} [opts]
 * @param {'y'|'z'} [opts.up='z']            vertical axis (World mesh = 'z'; raymarch render frame = 'y').
 * @param {'undershot'|'full'} [opts.mode='undershot']
 * @param {number} [opts.base]               deck bottom (default: ceil(max(tallest box top, floor)) + clearance).
 * @param {number} [opts.top]                deck top (default: base + thickness).
 * @param {number} [opts.floor=0]            a height the default band must also clear (the mesh's tallest vertex).
 * @param {number} [opts.clearance=12] · [opts.thickness=13]   the band defaults, world units.
 * @param {number} [opts.coverage=0.35]      0 (a few puffs) … 1 (overcast).
 * @param {number[]} [opts.sun]              direction toward the sun, in the `up` frame.
 * @param {number[]} [opts.color=[0.95,0.95,0.95]]  cloud albedo.
 * @param {number} [opts.density=0.42]       extinction per unit inside a puff.
 * @param {number} [opts.scale=0.045]        noise frequency (1 / world units); smaller ⇒ bigger clouds.
 * @param {number} [opts.drift=1]            wind: multiplies the deck's slow uTime drift (0 = still).
 * @param {number} [opts.maxDist]            how far a ray may reach the deck (undershot 900, full 260).
 * @param {number} [opts.fade=420]           undershot horizon fade distance (alpha × exp(−t / fade)).
 * @param {number} [opts.steps=160] · [opts.traceSteps=120]   full-mode march / occluder trace steps.
 * @param {number} [opts.cell=5] · [opts.margin=3] · [opts.K=12]   full-mode box-field grid.
 * @returns {{ frag: string, customUniforms: object, dataTextures: object, meta: { mode, base, top, count?, overflow? } }}
 */
export function composeCloudDeck(boxes = [], opts = {}) {
  const {
    up = 'z', mode = 'undershot', base, top, floor = 0, clearance = 12, thickness = 13, coverage = 0.35, sun,
    color = [0.95, 0.95, 0.95], density = 0.42, scale = 0.045, drift = 1, maxDist, fade = 420,
    steps = 160, traceSteps = 120, cell = 5, margin = 3, K = 12,
  } = opts && typeof opts === 'object' ? opts : {};

  if (up !== 'y' && up !== 'z') throw new Error(`composeCloudDeck: up must be 'y' or 'z', got ${JSON.stringify(up)}`);
  if (!CLOUD_DECK_MODES.includes(mode)) throw new Error(`composeCloudDeck: mode must be one of ${CLOUD_DECK_MODES.join(' | ')}, got ${JSON.stringify(mode)}`);
  if (!(Number.isFinite(+coverage) && +coverage >= 0 && +coverage <= 1)) throw new Error(`composeCloudDeck: coverage must be a number in [0, 1], got ${JSON.stringify(coverage)}`);
  if (sun !== undefined && !isVec3(sun)) throw new Error(`composeCloudDeck: sun must be [x, y, z], got ${JSON.stringify(sun)}`);
  if (!isVec3(color)) throw new Error(`composeCloudDeck: color must be [r, g, b] in 0..1, got ${JSON.stringify(color)}`);
  for (const [k, v] of Object.entries({ density, scale, drift, fade, clearance, thickness, steps, traceSteps })) {
    if (!(Number.isFinite(+v) && +v >= 0)) throw new Error(`composeCloudDeck: ${k} must be a non-negative number, got ${JSON.stringify(v)}`);
  }
  if (!Number.isFinite(+floor)) throw new Error(`composeCloudDeck: floor must be a number, got ${JSON.stringify(floor)}`);
  if (base !== undefined && !Number.isFinite(+base)) throw new Error(`composeCloudDeck: base must be a number, got ${JSON.stringify(base)}`);
  if (top !== undefined && !Number.isFinite(+top)) throw new Error(`composeCloudDeck: top must be a number, got ${JSON.stringify(top)}`);

  const list = (Array.isArray(boxes) ? boxes : []).filter(boxOk);
  const [cU, hU] = up === 'z' ? ['cz', 'hz'] : ['cy', 'hy'];
  const tallest = list.reduce((m, b) => Math.max(m, +b[cU] + +b[hU]), 0);
  const base_ = base !== undefined ? +base : Math.ceil(Math.max(tallest, +floor)) + +clearance;
  const top_ = top !== undefined ? +top : base_ + +thickness;
  if (!(top_ > base_)) throw new Error(`composeCloudDeck: top (${top_}) must be above base (${base_})`);

  const U = up;
  const T = top_ - base_;
  // coverage → the shape threshold pair. 0.25 is the spike's round-3 "sparse" deck (0.62 / 0.90),
  // 0.6 its round-1 stratus (0.48 / 0.76).
  const lo = 0.72 - 0.40 * +coverage, hi = lo + 0.28;
  const sunV = sun ? sun.map(Number) : DEFAULT_SUN[up];
  const dr = +drift;
  const driftGlsl = up === 'z'
    ? `vec3(uTime * ${f(0.010 * dr)}, uTime * ${f(0.006 * dr)}, 0.0)`
    : `vec3(uTime * ${f(0.010 * dr)}, 0.0, uTime * ${f(0.006 * dr)})`;
  const shapeGlsl = `
const float SV_BASE = ${f(base_)}; const float SV_TOP = ${f(top_)}; const float SV_THICK = ${f(T)};
const float SV_DENS = ${f(density)}; const vec3 SV_ALBEDO = ${v3(color)};
// coverage at p: fbm base + Worley puff erosion through a threshold pair (the coverage dial)
float svDeckShape(vec3 p){
  vec3 q = p * ${f(scale)} + ${driftGlsl};
  float b = svFbm(q);
  float puff = 1.0 - svWorley(p * ${f(scale * 2.2)});
  return smoothstep(${f(lo)}, ${f(hi)}, b + 0.24 * puff);
}`;
  const sunGlsl = volumeSunGLSL({ sun: sunV });
  const meta = { mode, base: base_, top: top_ };

  // the occluder earns its trace only when a solid actually crosses the band (the operator set
  // `base` below a tower); above every box it can clip nothing, and the grid-culled SDF's cell-margin
  // artifacts on long aerial rays would show for no gain.
  const crossing = list.filter((b) => +b[cU] + +b[hU] > base_);
  if (mode === 'full') return composeFull({ list: crossing, U, up, shapeGlsl, sunGlsl, lo, hi, scale, driftGlsl, maxDist: maxDist ?? 260, steps, traceSteps, cell, margin, K, meta });
  return composeUndershot({ U, shapeGlsl, sunGlsl, scale, maxDist: maxDist ?? 900, fade, meta });
}

// ---- undershot: the plane deck ---------------------------------------------------------------
function composeUndershot({ U, shapeGlsl, sunGlsl, scale, maxDist, fade, meta }) {
  // in-plane offset toward the sun for the top-side self-shadow: a quarter of a noise period
  const reach = f(0.25 / scale);
  const frag = `precision highp float;
uniform vec3 uCamPos; uniform mat3 uCamBasis; uniform vec2 uRes; uniform float uTime; uniform float uFov;
uniform float uMaxDist; uniform float uFade;
${VOLUME_NOISE_GLSL}
${VOLUME_PHASE_GLSL}
${sunGlsl}
${shapeGlsl}
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * uRes.y);
  float tanf = tan(uFov * 0.5);
  vec3 rd = normalize(uCamBasis * vec3(uv.x * tanf, uv.y * tanf, 1.0));
  vec3 ro = uCamPos;
  float hCam = ro.${U}, dU = rd.${U};
  bool below = hCam < SV_BASE, above = hCam > SV_TOP;
  // inside the band, or looking away from the deck: nothing (the band is published as meta.base/top)
  if ((!below && !above) || (below && dU <= 1e-4) || (above && dU >= -1e-4)) { gl_FragColor = vec4(0.0); return; }
  float t = ((below ? SV_BASE : SV_TOP) - hCam) / dU;
  if (t > uMaxDist) { gl_FragColor = vec4(0.0); return; }
  vec3 P = ro + rd * t;
  float shape = svDeckShape(P);
  if (shape < 0.002) { gl_FragColor = vec4(0.0); return; }
  float od = shape * SV_THICK * SV_DENS;                       // slab optical depth
  float alpha = 1.0 - exp(-od);
  float mu = dot(rd, SV_SUN);
  float phase = svPhase(mu, 0.45, -0.18, 0.32, ${f(VOLUME_ENERGY.phaseCap)});
  vec3 L;
  if (below) {
    float T = exp(-od * 0.6);                                  // sun through the slab: thin edges glow, cores go dark
    L = SV_SUNCOL * mix(0.12, 1.0, T) * phase + mix(SV_GNDCOL, SV_SKYCOL, 0.35) * 0.9;
  } else {
    vec3 sunFlat = SV_SUN; sunFlat.${U} = 0.0;                 // upsun neighbour thick ⇒ this top is in its shadow
    float toward = svDeckShape(P + sunFlat * ${reach});
    float sh = exp(-toward * SV_THICK * SV_DENS * 0.35);
    L = SV_SUNCOL * sh * phase + SV_SKYCOL * 0.65;
  }
  float a = alpha * exp(-t / uFade);                           // aerial perspective; also tames grazing-angle noise
  gl_FragColor = vec4(SV_ALBEDO * L * a, a);                   // premultiplied, blended over the mesh
}
`;
  return { frag, customUniforms: { uMaxDist: +maxDist, uFade: +fade }, dataTextures: {}, meta };
}

// ---- full: the volumetric band ---------------------------------------------------------------
function composeFull({ list, U, up, shapeGlsl, sunGlsl, lo, hi, scale, driftGlsl, maxDist, steps, traceSteps, cell, margin, K, meta }) {
  const occluded = list.length > 0;
  const baked = occluded ? bakeBoxField(list, { cell, margin, K, up }) : null;
  const cloudGlsl = `${shapeGlsl}
float svBand(float hgt){ return smoothstep(SV_BASE, SV_BASE + SV_THICK * 0.27, hgt) * (1.0 - smoothstep(SV_TOP - SV_THICK * 0.38, SV_TOP, hgt)); }
float density(vec3 p){
  float hgt = p.${U};
  float band = svBand(hgt);
  if (band <= 0.0) return 0.0;
  float shape = svDeckShape(p);
  float hp = clamp((hgt - SV_BASE) / SV_THICK, 0.0, 1.0);
  shape *= smoothstep(0.0, 0.12, hp) * (1.0 - 0.35 * hp);       // flat base, softer thinning top
  return shape * band * SV_DENS;
}
// the light march's cheap twin: fbm only, no Worley (the spike's cost cliff was Worley in the march)
float densityShadow(vec3 p){
  float band = svBand(p.${U});
  if (band <= 0.0) return 0.0;
  float b = svFbm(p * ${f(scale)} + ${driftGlsl});
  return smoothstep(${f(lo)}, ${f(hi)}, b + 0.12) * band * SV_DENS;
}
${volumeLightGLSL({ shadowFn: 'densityShadow', gFwd: 0.55, gBack: -0.18, wBack: 0.32 })}
void volSample(vec3 p, vec3 rd, out vec3 emis, out vec3 ext){
  float d = density(p); if (d < 0.0015) { emis = vec3(0.0); ext = vec3(0.0); return; }
  float sigma = 1.0;
  vec3 L = svLight(p, rd, d, sigma, (p.${U} - SV_BASE) / SV_THICK, 0.60, 3.0);
  emis = SV_ALBEDO * d * sigma * L; ext = vec3(d * sigma);
}`;
  const frag = buildVolumeFrag({
    globals: `${occluded ? `${SDF_GLSL}\n${boxFieldGLSL({ K, up })}\n` : ''}${VOLUME_NOISE_GLSL}\n${VOLUME_PHASE_GLSL}\n${sunGlsl}\n${cloudGlsl}`,
    uniforms: ['uniform float uMaxDist;'],
    rayDirArg: true,
    overlay: true,
    boundsRadius: 'uMaxDist',
    steps,
    occluder: occluded ? { sdfFn: 'sdfScene', traceSteps, surfEps: '0.02', minStep: '0.05' } : null,
  });
  return {
    frag,
    customUniforms: {
      uMaxDist: +maxDist,
      ...(occluded ? {
        uBoxCount: baked.count,
        uGridO: [baked.grid.ox, baked.grid.oz, baked.grid.cell],
        uGridN: [baked.grid.cols, baked.grid.rows, baked.grid.tpc],
      } : {}),
    },
    dataTextures: occluded ? { uBoxTex: baked.boxData, uCellTex: baked.cellData } : {},
    meta: occluded ? { ...meta, count: baked.count, overflow: baked.overflow } : meta,
  };
}

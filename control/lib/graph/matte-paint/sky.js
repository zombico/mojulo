/**
 * THE PAINTED SKY — a cloud band round the dome, painted once on the CPU by the old Photoshop recipe, nothing
 * volumetric. Each sheet of a weather is a flat deck overhead; a pixel of the band (its azimuth round the dome, its
 * elevation over the horizon) looks up into the deck where the view ray meets it, so the clouds crowd and stretch toward
 * the horizon by themselves (the recipe's Scale and Motion Blur, by perspective), and the band wraps round the dome
 * without a seam. On each sheet:
 *
 *   Render Clouds       value fbm on the deck (a `billow` heap for cumulus), stretched along the wind
 *   Difference Clouds   |a − b| of two renders, inverted: the churn of a storm's shelf
 *   Levels              a black and a white point cut the cover and set the edge's softness (the weather's `cover`
 *                       slides both)
 *   Emboss toward sun   the sheet less the sheet a step toward the sun: the rims that face it lit, the bellies shaded,
 *                       thick cloud darker
 *   Gradient Map        the lit value from the belly's colour (the sky overhead, darkened) to the top's (the key, the
 *                       sun's or the moon's); thin edges glow where the sun stands behind them
 *   the horizon         far deck fades into the horizon's colour, the band's top into the clear sky
 *
 * The sheets are laid high first, each over the last. Only the dice are seeded; the light and colours are the hour's.
 *
 *   WEATHERS                      the skies by weather: their sheets, and how each leans the light
 *   readClouds(v)                 a recipe's `clouds`: 'fair' | { kind, cover?, seed? } → { kind, cover, seed }, or throws
 *   CLOUDS_OF_WEATHER             the sky a live weather state (weather/weather.js) is painted under: a recipe's
 *                                 `clouds: 'weather'`
 *   paintCloudBand(spec, opts)    → { rgba, W, H, top } (top: the band's upper edge, degrees over the horizon)
 *   cloudBand(spec)               → { src, top }: the band as the dome draws it (a PNG data URL), painted once a spec
 *
 * Pure.
 */
import { gnoise2 } from '../noise/noise.js';
import { encodePngRgba } from '../landscape/surface-textures.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a || 1e-6), 0, 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgbOf = (h) => (Array.isArray(h) ? h : [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));

// a sheet: `noise` (fbm | billow | difference), `scale` (a cloud's breadth in deck units: the deck stands 1 over the
// eye), `stretch` along the wind, `octaves`, `levels` [black, white] on the 0…1 render, `opacity`, `emboss` (how much
// the rim facing the sun lifts), `thick` (how much dense cloud darkens), `alt` (the deck's height: a higher deck reads
// smaller and nearer the horizon's middle), `grey` (how far its top is the sky's grey rather than the key's), `veil` (a haze: no tops or bellies, the
// horizon's colour lifted toward a pale grey by this much, thickest low)
const CIRRUS = { noise: 'fbm', scale: 2.2, stretch: 5, octaves: 4, levels: [0.62, 0.9], opacity: 0.45, emboss: 0.2, thick: 0.05, alt: 1.8, grey: 0.2 };
export const WEATHERS = Object.freeze({
  clear: { sheets: [{ ...CIRRUS, opacity: 0.35 }, { noise: 'billow', scale: 0.5, stretch: 1.2, octaves: 4, levels: [0.7, 0.82], opacity: 0.9, emboss: 0.9, thick: 0.3, alt: 1, grey: 0.15 }],
    light: { gain: 1, ambient: 0, fog: 1, disc: true } },
  fair: { sheets: [{ ...CIRRUS, opacity: 0.3 }, { noise: 'billow', scale: 0.6, stretch: 1.3, octaves: 5, levels: [0.56, 0.74], opacity: 0.97, emboss: 1, thick: 0.45, alt: 1, grey: 0.15 }],
    light: { gain: 1, ambient: 0, fog: 1, disc: true } },
  overcast: { sheets: [{ noise: 'fbm', scale: 1.5, stretch: 1.4, octaves: 5, levels: [0.18, 0.62], opacity: 0.97, emboss: 0.35, thick: 0.5, alt: 1.2, grey: 0.75 },
    { noise: 'fbm', scale: 0.5, stretch: 2.6, octaves: 4, levels: [0.48, 0.76], opacity: 0.6, emboss: 0.5, thick: 0.6, alt: 0.8, grey: 0.8 }],
    light: { gain: 0.55, ambient: 0.35, fog: 1.6, disc: false } },
  storm: { sheets: [{ noise: 'difference', scale: 0.8, stretch: 1.6, octaves: 5, levels: [0.2, 0.55], opacity: 1, emboss: 0.6, thick: 0.9, alt: 0.9, grey: 0.9 },
    { noise: 'fbm', scale: 0.35, stretch: 3, octaves: 4, levels: [0.55, 0.8], opacity: 0.7, emboss: 0.3, thick: 0.9, alt: 0.6, grey: 0.95 }],
    light: { gain: 0.4, ambient: 0.25, fog: 2.2, disc: false } },
  haze: { sheets: [{ noise: 'fbm', scale: 3, stretch: 4, octaves: 3, levels: [0.05, 0.85], opacity: 0.75, emboss: 0, thick: 0, alt: 1.5, grey: 0.6, veil: 0.4 }],
    light: { gain: 0.85, ambient: 0.2, fog: 2.5, disc: true } },
  high: { sheets: [{ ...CIRRUS, stretch: 7, levels: [0.55, 0.82], opacity: 0.8 }, { noise: 'billow', scale: 0.14, stretch: 1.5, octaves: 3, levels: [0.66, 0.8], opacity: 0.5, emboss: 0.3, thick: 0.1, alt: 1.7, grey: 0.25 }],
    light: { gain: 1, ambient: 0, fog: 1, disc: true } },
});
const KINDS = Object.keys(WEATHERS);

/** A recipe's clouds → { kind, cover (0…1, the weather's own at 0.5), seed }. */
export function readClouds(v) {
  const bad = () => { throw new Error(`clouds is one of ${KINDS.join(', ')}, or { kind, cover?: 0–1, seed? }; got ${JSON.stringify(v)}`); };
  if (typeof v === 'string') return KINDS.includes(v) ? { kind: v, cover: 0.5, seed: 1 } : bad();
  if (!v || typeof v !== 'object' || Array.isArray(v) || !KINDS.includes(v.kind)) return bad();
  for (const k of Object.keys(v)) if (!['kind', 'cover', 'seed'].includes(k)) throw new Error(`clouds.${k} is not a clouds setting (kind, cover, seed)`);
  const cover = v.cover ?? 0.5, seed = v.seed ?? 1;
  if (typeof cover !== 'number' || !(cover >= 0 && cover <= 1)) throw new Error(`clouds.cover is 0–1, got ${JSON.stringify(cover)}`);
  if (!Number.isInteger(seed) || seed < 0) throw new Error(`clouds.seed is a whole number, got ${JSON.stringify(seed)}`);
  return { kind: v.kind, cover, seed };
}

/** The sky a live weather state is painted under (its rain, fog and air are the live channel's own). */
export const CLOUDS_OF_WEATHER = Object.freeze({ clear: 'clear', haze: 'haze', mist: 'haze', fog: 'haze', dust: 'haze', overcast: 'overcast', drizzle: 'overcast',
  snow: 'overcast', rain: 'storm', downpour: 'storm', thunderstorm: 'storm', blizzard: 'storm', duststorm: 'storm', petals: 'fair', leaves: 'fair' });

// the render, 0…1: fbm (or its billow) over `octaves`, or the difference of two
function render(x, y, S, sd, octaves = S.octaves) {
  const one = (sx) => {
    let s = 0, a = 0.5, f = 1;
    for (let o = 0; o < octaves; o++) { const n = gnoise2(x * f, y * f, sx + o * 101); s += a * (S.noise === 'billow' ? 2 * Math.abs(n) - 1 : n); a *= 0.5; f *= 2.03; }
    return s;
  };
  // (each normalised to a mean of ½ and a spread of 0.17, measured: so a sheet's levels read as its cover)
  if (S.noise === 'difference') return clamp(1 - 2 * Math.abs(one(sd) - one(sd + 977)), 0, 1);
  return clamp(0.5 + (S.noise === 'billow' ? (one(sd) + 0.48) * 0.85 : one(sd) * 0.96), 0, 1);
}

/**
 * The band. `spec`: { clouds: { kind, cover, seed }, sun (toward it, z-up), key, zenith, horizon, belly? (hex or
 * rgb) , night (0…1) }. `W` round the dome (u = azimuth from +x toward +y over 2π), `H` up it (row 0 at `top`).
 */
export function paintCloudBand(spec, { W = 1536, H = 192, top = 62 } = {}) {
  const Wx = WEATHERS[spec.clouds.kind], cover = spec.clouds.cover, sd0 = (spec.clouds.seed | 0) * 7919 + 17;
  const key = rgbOf(spec.key), zen = rgbOf(spec.zenith), hor = rgbOf(spec.horizon), night = spec.night ?? 0;
  const sl = Math.hypot(spec.sun[0], spec.sun[1]) || 1, sunH = [spec.sun[0] / sl, spec.sun[1] / sl], sun = spec.sun;
  // the tops: the key lit toward white by day, dimmed at night; the bellies: the sky overhead, darkened
  const keyTop = mix(key, [255, 255, 255], 0.45 * (1 - night)).map((v) => v * (1 - 0.6 * night));
  const belly0 = mix(zen, hor, 0.35).map((v) => v * 0.72);
  const rgba = Buffer.alloc(W * H * 4), acc = new Float32Array(4);
  // the wind: one direction for the weather, from its dice
  const wind = gnoise2(0.37, 0.71, sd0) * Math.PI, wc = Math.cos(wind), ws = Math.sin(wind);
  const dE = (top * Math.PI) / 180 / H;
  for (let y = 0; y < H; y++) {
    const e = (top * (1 - (y + 0.5) / H) * Math.PI) / 180, ce = Math.cos(e), se = Math.sin(e), te = Math.max(Math.tan(e), 0.012);
    const topFade = 1 - smoothstep(top * 0.72, top, (e * 180) / Math.PI);
    for (let x = 0; x < W; x++) {
      const az = (2 * Math.PI * (x + 0.5)) / W, ca = Math.cos(az), sa = Math.sin(az);
      const view = [ce * ca, ce * sa, se], behind = Math.max(0, view[0] * sun[0] + view[1] * sun[1] + view[2] * sun[2]) ** 8;
      acc.fill(0);
      Wx.sheets.forEach((S, si) => {
        const d = S.alt / te, px = d * ca, py = d * sa, sd = sd0 + si * 131;
        // the deck point in the wind's frame, stretched along it
        // (the octaves a pixel can hold: far deck, under a pixel many metres deep, keeps only the broad ones, or the
        // horizon speckles)
        const foot = (S.alt * dE) / (se * se + 1e-4), oct = clamp(Math.floor(Math.log2(S.scale / (2 * foot))) + 1, 1, S.octaves);
        const at = (qx, qy) => { const u = (qx * wc + qy * ws) / (S.scale * S.stretch), v = (-qx * ws + qy * wc) / S.scale; return render(u, v, S, sd, oct); };
        const shift = (cover - 0.5) * 0.3, lo = S.levels[0] - shift, hi = S.levels[1] - shift;
        const r = at(px, py), D = smoothstep(lo, hi, r);
        if (D <= 0.002) return;
        const step = S.scale * 0.18, rim = D - smoothstep(lo, hi, at(px + sunH[0] * step, py + sunH[1] * step));
        const lit = clamp(0.62 + 1.5 * S.emboss * rim - 0.55 * S.thick * D, 0, 1.15);
        const topC = S.veil ? mix(hor, [236, 236, 236].map((v) => v * (1 - 0.7 * night)), S.veil) : mix(keyTop, mix(hor, zen, 0.3), S.grey), bellyC = S.veil ? topC : belly0.map((v) => v * (1 - 0.45 * S.thick * S.grey));
        let c = mix(bellyC, topC, lit);
        // the silver lining: thin cloud between the eye and the sun glows in the key
        c = mix(c, keyTop, clamp(behind * (1 - D) * 1.4, 0, 0.85));
        // far deck into the horizon's colour
        const far = 1 - Math.exp(-d / 9);
        c = mix(c, hor, far * 0.85);
        // (a veil thickens toward the horizon, where the eye looks through most of it)
        const a = D * S.opacity * (S.veil ? 1 - smoothstep(0, 0.45, se) * 0.8 : 1 - far ** 3) * topFade;
        // over: this sheet on the ones behind it
        acc[0] = c[0] * a + acc[0] * (1 - a); acc[1] = c[1] * a + acc[1] * (1 - a); acc[2] = c[2] * a + acc[2] * (1 - a); acc[3] = a + acc[3] * (1 - a);
      });
      const k = (y * W + x) * 4, A = acc[3];
      // (a clear pixel carries the horizon's colour, so a filtered edge fades to sky, not to black)
      if (A > 0.004) { rgba[k] = clamp(Math.round(acc[0] / A), 0, 255); rgba[k + 1] = clamp(Math.round(acc[1] / A), 0, 255); rgba[k + 2] = clamp(Math.round(acc[2] / A), 0, 255); }
      else { rgba[k] = hor[0]; rgba[k + 1] = hor[1]; rgba[k + 2] = hor[2]; }
      rgba[k + 3] = clamp(Math.round(A * 255), 0, 255);
    }
  }
  return { rgba, W, H, top };
}

// the bands painted, by spec: a page is built many times a session, and the same sky paints the same band
const BANDS = new Map();
/** A cloud band as the dome takes it: { src (a PNG data URL), top (degrees) }. */
export function cloudBand(spec) {
  const k = JSON.stringify(spec);
  if (!BANDS.has(k)) {
    if (BANDS.size >= 16) BANDS.clear();
    const B = paintCloudBand(spec);
    BANDS.set(k, { src: `data:image/png;base64,${encodePngRgba(B.rgba, B.W, B.H).toString('base64')}`, top: B.top });
  }
  return BANDS.get(k);
}

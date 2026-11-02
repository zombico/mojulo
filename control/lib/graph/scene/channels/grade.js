// THE GRADE: the World page's compositing stage, the last thing laid over the frame. It rides the frame pass (channels/
// frame-pass.js: the frame drawn once to a target and laid on the canvas once), as a third stage beside the air and the
// crust, so the page has one full-frame pass however many ask for one.
//
//   dials (each neutral at its rest; GRADE_DIALS gives each its range):
//     exposure    stops, ± (the frame brighter or darker)
//     contrast    1 at rest: under it flatter, over it harder, round middle grey
//     saturation  1 at rest: 0 is grey, over 1 richer
//     warmth      ±: toward amber (+) or toward blue (−), the shadows a little the other way (a split tone)
//     vignette    the corners darkened, 0 … 1
//     grain       film grain, 0 … 1 (a seeded hash of the pixel and the frame: no dice)
//     aberration  css pixels the red and the blue are split by at the frame's edge (a lens's fringes)
//     zoom        a zoom blur toward `at` (the frame's centre unless a moment gives its contact), 0 … 1
//     bars        the letterbox: each bar's share of the frame's height, 0 … 0.2
//     flash       the frame washed white, 0 … 1
//     invert      the IMPACT FRAME: the frame inverted, hard, 0 … 1
//     shake       the frame shaken in the screen's plane, 0 … 1 (a share of a hundredth of the frame)
//
//   a world's `grade`: a word (GRADE_PRESETS: film, noir, bleach, vivid, dream, cold, warm), dials, or { from: word,
//   …dials } (a word's dials, some changed). A moment's look (world-clock.js) overlays its own dials on the base, eased by
//   the moment's weight.
//
//   readGrade(raw)        → { …dials } the dials it sets, or null; throws naming what it takes
//   gradeGlsl()           → the GLSL the frame pass's composite takes (its uniforms and `vec4 gradeFrame(vec2 uv)`)
//   gradePageScript(base) → the page's probe `window.__mojGrade` and its per-frame uniforms (`__gradeU(BU, t)`)
//
// Absent (no grade and no moment with a look) the frame pass emits nothing of it, and every page keeps every byte.
import { safeJson } from '../emit-util.js';

/** each dial's [rest, least, most] */
export const GRADE_DIALS = Object.freeze({
  exposure: [0, -3, 3], contrast: [1, 0, 2], saturation: [1, 0, 2], warmth: [0, -1, 1], vignette: [0, 0, 1], grain: [0, 0, 1],
  aberration: [0, 0, 12], zoom: [0, 0, 1], bars: [0, 0, 0.2], flash: [0, 0, 1], invert: [0, 0, 1], shake: [0, 0, 1],
});
export const GRADE_DIAL_NAMES = Object.freeze(Object.keys(GRADE_DIALS));
/** the words for a world's look */
export const GRADE_PRESETS = Object.freeze({
  film: { contrast: 1.08, saturation: 0.94, warmth: 0.06, vignette: 0.28, grain: 0.12 },
  noir: { contrast: 1.35, saturation: 0, vignette: 0.5, grain: 0.25 },
  bleach: { contrast: 1.3, saturation: 0.45, vignette: 0.2, grain: 0.1 },
  vivid: { contrast: 1.1, saturation: 1.3 },
  dream: { exposure: 0.2, contrast: 0.88, saturation: 1.1, warmth: 0.12, vignette: 0.32 },
  cold: { saturation: 0.85, warmth: -0.35, vignette: 0.15 },
  warm: { saturation: 1.05, warmth: 0.3, vignette: 0.15 },
});

/** A grade's dials (only those it sets), or null; throws naming what it takes (`where` names it in the message). */
export function readGrade(raw, where = 'grade') {
  if (raw == null || raw === false) return null;
  if (typeof raw === 'string') {
    if (!GRADE_PRESETS[raw]) throw new Error(`${where}: '${raw}' is not a grade (words: ${Object.keys(GRADE_PRESETS).join(', ')}; or dials: ${GRADE_DIAL_NAMES.join(', ')})`);
    return { ...GRADE_PRESETS[raw] };
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${where}: a grade is a word (${Object.keys(GRADE_PRESETS).join(', ')}) or dials { ${GRADE_DIAL_NAMES.join(', ')} }`);
  const { from, ...dials } = raw, out = from !== undefined ? { ...(readGrade(from, `${where}.from`) || {}) } : {};
  for (const [k, v] of Object.entries(dials)) {
    const D = GRADE_DIALS[k];
    if (!D) throw new Error(`${where}: '${k}' is not a dial (dials: ${GRADE_DIAL_NAMES.join(', ')}; from: a word)`);
    if (!(typeof v === 'number' && Number.isFinite(v) && v >= D[1] && v <= D[2])) throw new Error(`${where}.${k} is ${D[1]} to ${D[2]} (rest ${D[0]}), not ${JSON.stringify(v)}`);
    out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

const g = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x));

/** The grade's GLSL: its uniforms and gradeFrame(uv), the frame at uv graded; `tC` and `uRes` are the frame pass's. `base`
 *  is how a pixel is read before the grade (the pass's own composite where it softens the far, else the frame). */
export function gradeGlsl() {
  return `uniform vec4 uG0, uG1, uG2;
uniform vec3 uG3;
float gHash( vec2 p ) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }
vec4 gradeFrame( vec2 uv0 ) {
  // the shake: the whole frame moved in the screen's plane
  vec2 uv = uv0 + uG2.w * 0.01 * vec2( gHash( vec2( uG3.z, 1.7 ) ) - 0.5, gHash( vec2( uG3.z, 9.1 ) ) - 0.5 );
  vec4 c = gradeBase( uv );
  // the lens's fringes: red and blue split along the radius, most at the edge
  if ( uG1.z > 0.0 ) {
    vec2 d = ( uv - 0.5 ) * uG1.z / uRes * 2.0;
    c.r = gradeBase( uv + d ).r; c.b = gradeBase( uv - d ).b;
  }
  // the zoom blur toward the point it is aimed at
  if ( uG1.w > 0.0 ) {
    vec3 acc = c.rgb; vec2 to = uG3.xy - uv;
    for ( int i = 1; i < 10; i++ ) acc += gradeBase( uv + to * uG1.w * 0.06 * float( i ) ).rgb;
    c.rgb = acc / 10.0;
  }
  vec3 col = c.rgb * exp2( uG0.x );
  col = ( col - 0.18 ) * uG0.y + 0.18;
  float l = dot( col, vec3( 0.2126, 0.7152, 0.0722 ) );
  col = mix( vec3( l ), col, uG0.z );
  // warmth: the highlights toward amber, the shadows a little toward blue (a split tone), or the other way round
  vec3 warm = vec3( 1.0, 0.86, 0.66 ), cool = vec3( 0.7, 0.84, 1.0 );
  float w = uG0.w, hl = smoothstep( 0.15, 0.85, l );
  col *= mix( vec3( 1.0 ), w > 0.0 ? mix( cool, warm, hl ) : mix( warm, cool, hl ), abs( w ) * ${g(0.6)} );
  // the vignette, the grain
  vec2 q = uv0 - 0.5; q.x *= uRes.x / uRes.y;
  col *= 1.0 - uG1.x * smoothstep( 0.35, 1.05, length( q ) * 1.25 );
  col += uG1.y * 0.12 * ( gHash( uv0 * uRes + uG3.z * 61.0 ) - 0.5 );
  // the impact frame, the flash
  col = mix( col, vec3( 1.0 ) - clamp( ( col - 0.5 ) * 2.4 + 0.5, 0.0, 1.0 ), uG2.z );
  col = mix( col, vec3( 1.0 ), uG2.y );
  // the letterbox
  if ( uv0.y < uG2.x || uv0.y > 1.0 - uG2.x ) col = vec3( 0.0 );
  return vec4( clamp( col, 0.0, 1.0 ), c.a );
}
`;
}

/** The page's grade probe (the base grade, the moment's overlay, the frame pass's uniforms each frame). */
export function gradePageScript(base) {
  const rest = Object.fromEntries(Object.entries(GRADE_DIALS).map(([k, D]) => [k, D[0]]));
  return `
  // the grade (channels/grade.js): the base, a moment's look over it by its weight, and set by hand
  const GR = ${safeJson({ rest, base: base || {} })};
  const grade = window.__mojGrade = { base: { ...GR.rest, ...GR.base }, look: null, w: 0, at: null, frames: 0,
    set(o) { for (const k in o || {}) if (k in GR.rest && Number.isFinite(o[k])) this.base[k] = o[k]; return this; },
    moment(look, w, at) { this.look = look || null; this.w = look ? Math.max(0, Math.min(1, w)) : 0; this.at = at || null; return this; },
    now() { const o = {}; for (const k in GR.rest) { const L = this.look && Number.isFinite(this.look[k]) ? this.look[k] : null; o[k] = L === null ? this.base[k] : this.base[k] + (L - this.base[k]) * this.w; } return o; },
    on() { const n = this.now(); for (const k in GR.rest) if (Math.abs(n[k] - GR.rest[k]) > 1e-4) return true; return false; } };
  const __gradeU = (BU, t) => {
    const n = grade.now(), dpr = renderer.getPixelRatio();
    BU.uG0.value.set(n.exposure, n.contrast, n.saturation, n.warmth); BU.uG1.value.set(n.vignette, n.grain, n.aberration * dpr, n.zoom);
    BU.uG2.value.set(n.bars, n.flash, n.invert, n.shake); BU.uG3.value.set(grade.at ? grade.at[0] : 0.5, grade.at ? grade.at[1] : 0.5, Math.floor(t * 24) / 24);
    grade.frames++;
  };`;
}

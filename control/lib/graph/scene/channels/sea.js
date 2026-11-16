// In-page script: THE SEA a gen-7 geocube page is seen through (opt-in, the recipe's `sea`): any land or room the cube
// makes, put under water by its light alone. Nothing is built for it: the land is the land, and the water is what the
// light does on the way down to it and on the way back to the eye. One source, three's own fog chunk patched once before
// any material compiles (as the air's, channels/atmosphere.js: the two never share a page), so every surface that takes
// the page's fog takes the water:
//
//   the light down   the sun's light at a depth, colour by colour (a WATER's diffuse attenuation, per metre: red goes in
//                    the first metres, green next, blue last), so a thing loses its reds as it lies deeper and takes
//                    them back as it nears the surface. The eye adapts: the light at the walk's ground is normalised to
//                    its strongest colour and laid at the zone's LEVEL, never black (a zone is read, not measured).
//   the way back     Beer-Lambert along the view, colour by colour again (absorption and the scattering a VISIBILITY
//                    sets), toward the water's own body colour: the light down times what the water scatters of it,
//                    lighter looking up, darker looking down.
//   caustics         the surface's ripples focusing the sun on what faces it, a net of light whose mean is 1 (light is
//                    moved, never made: 1 / |det| of the refraction's Jacobian over a few waves), fading by depth.
//   shafts           the same net read along the view where the sun's rays pass, a few steps a pixel.
//   the surface      seen from below: the sky through Snell's window overhead, rippled at its rim, a mirror of the water
//                    outside it; dimmed by the water between, so by twenty metres it is a glow and deeper a gradient.
//                    What stands over the surface, and what the water has wholly taken, is not drawn at all.
//   lamps            where the sun does not reach, a place reads by its own light: a lamp lights what faces it (falling
//                    by the square of the distance and by the water, so a warm lamp turns green then blue with reach)
//                    and glows in the water round it (the airlight integral, in closed form); `torch` is one at the eye.
//   snow             marine snow: specks sinking round the eye, lit as any surface is, so they show in a lamp's beam.
//
// The page's sky (its dome, its clouds, its sun) is hidden: over the eye is water. The page's fog stays an honest one for
// whatever else reads it (the contact occlusion fades by it): its density is the water's extinction in its clearest
// colour, and the page's clock rides on it to every material (the density grows by a quarter over SEA.clock seconds,
// then starts again: the one uniform every fog-taking material is given each frame). Absent `sea` => NOT emitted.
// `window.__mojSea` is the probe: { zone, depth, water, level, surface, lamps, snow, clock() }.
import { safeJson } from '../emit-util.js';

const fz = Object.freeze;

/** The caustic net's waves: [cos, sin] its direction, `k` its wavenumber, `g` how hard it bends the light (its amplitude
 *  × k² × the depth it focuses over), `w` its speed (rad/s), `f` its phase. Read by the GLSL and its JS twin alike. */
export const SEA_NET = fz([
  fz({ c: 0.966, s: 0.259, k: 1.0, g: 0.42, w: 0.9, f: 0 }),
  fz({ c: -0.342, s: 0.94, k: 1.37, g: 0.4, w: -1.1, f: 1.7 }),
  fz({ c: 0.643, s: -0.766, k: 1.93, g: 0.36, w: 1.3, f: 4.1 }),
  fz({ c: -0.866, s: -0.5, k: 2.71, g: 0.3, w: -1.6, f: 2.9 }),
  fz({ c: 0.174, s: 0.985, k: 3.61, g: 0.24, w: 1.9, f: 5.3 }),
]);
const NET = fz({ soft: 0.12, top: 5 });
const netRaw = (x, y, t) => {
  let xx = 0, yy = 0, xy = 0;
  for (const W of SEA_NET) { const p = Math.sin((x * W.c + y * W.s) * W.k + t * W.w + W.f) * W.g; xx += p * W.c * W.c; yy += p * W.s * W.s; xy += p * W.c * W.s; }
  return Math.min(1 / (Math.abs((1 - xx) * (1 - yy) - xy * xy) + NET.soft), NET.top);
};
// (the net's mean over a wide patch, measured once: what it is divided by, so the light it lays sums to the light there was)
const NET_MEAN = (() => { let a = 0; const n = 96; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) a += netRaw(i * 0.731 + 0.17, j * 0.689 + 0.41, 0); return Math.round((a / (n * n)) * 1e4) / 1e4; })();
/** The caustic net at a point (pattern units) and a time (s): the sun's light there against the light with no ripple, mean 1. */
export const seaNet = (x, y, t = 0) => netRaw(x, y, t) / NET_MEAN;

/** The waters, the zones and their measures.
 *  A WATER is what the sea is made of: `k` its diffuse attenuation per metre for red, green and blue (how fast the sun's
 *  light dies going down), `visibility` the distance in metres where a dark thing's contrast against the water falls to 2%,
 *  `deep` the colour of its last light (what the eye makes of the one band left: never a primary), the floor its tint keeps.
 *  A ZONE is a depth and how it READS: `depth` metres of water over the walk's ground, `level` the light there as the
 *  adapted eye takes it (1 the page's own, never 0), `caustics`, `shafts` and `snow` their strengths, `carries` what the
 *  read stands on at that depth. A depth between two zones takes their measures between them (by the depth's logarithm). */
export const SEA = fz({
  contrast: 0.02,
  waters: fz({
    ocean: fz({ read: 'clear blue open water: red gone in the first metres, the far a deep blue', k: fz([0.35, 0.065, 0.02]), visibility: 45, deep: fz([0.02, 0.24, 1]) }),
    coast: fz({ read: 'green coastal water: plankton and silt take the blue too, the far a soft green', k: fz([0.45, 0.12, 0.2]), visibility: 15, deep: fz([0.06, 1, 0.5]) }),
    murk: fz({ read: 'a harbour\'s or a river mouth\'s murk: a few metres seen, the far a dull olive', k: fz([0.7, 0.45, 0.9]), visibility: 4.5, deep: fz([0.42, 1, 0.22]) }),
  }),
  zones: fz({
    shallows: fz({ read: 'the sunlit shallows, a few metres down', depth: 4, level: 1, caustics: 1, shafts: 0.7, snow: 0, carries: 'caustics crawling on the bed, shafts of sun, the surface a bright rippled window overhead' }),
    reef: fz({ read: 'a reef\'s depth: the sun still shapes it, the reds going', depth: 14, level: 0.85, caustics: 0.5, shafts: 0.5, snow: 0.05, carries: 'soft caustics, long shafts, colour only near the eye, the surface a pale glow' }),
    blue: fz({ read: 'the blue: one colour, light from above only', depth: 40, level: 0.6, caustics: 0, shafts: 0.2, snow: 0.15, carries: 'value alone: shapes as blue silhouettes against the lighter water over them' }),
    twilight: fz({ read: 'the twilight zone: the last of the sun, a dim blue overhead', depth: 200, level: 0.24, caustics: 0, shafts: 0, snow: 0.5, carries: 'the gradient overhead, things seen from below against it, and the first lamps' }),
    midnight: fz({ read: 'the midnight zone: no sun at all', depth: 1000, level: 0.035, caustics: 0, shafts: 0, snow: 1, carries: 'lamps: their pools on what they face, their glow in the water, the snow in their beams' }),
  }),
  range: fz({ depth: fz([1, 11000]), visibility: fz([1, 120]), level: fz([0.01, 1.5]), caustics: fz([0, 2]), shafts: fz([0, 2]), snow: fz([0, 3]), power: fz([0.1, 400]), cone: fz([5, 170]) }),
  // the lamps a page carries at most (each is a term of every pixel), a lamp's own colour, power and a torch's
  lamps: fz({ most: 6, colour: '#fff1d0', power: 12, cone: 50 }),
  torch: fz({ colour: '#f4f8ff', power: 10, cone: 38 }),
  // the water's body against the light on a surface there; how much lighter it is looking up than level (e-folding in
  // the ray's rise); the sky through the window against the light at the surface; how deep the caustics reach (m, their
  // e-folding), their cell (pattern units a metre) and the shafts'; the shafts' steps; the snow's specks at strength 1,
  // the box round the eye they fill (m) and how fast they sink (m/s); a lamp's glow in the water
  body: 0.4, rise: 1.1, window: 1.1, snell: 0.661, ripple: 1.2,
  caustics: fz({ fade: 9, cell: 2.2, widen: 0.06 }),
  shafts: fz({ cell: 0.3, steps: 8, gain: 2.2 }),
  snow: fz({ count: 900, box: 18, sink: 0.06, size: 0.035 }),
  halo: 0.07, back: 0.05, self: fz([0.8, 1]),
  // how much brighter a colour may stand over the walk's ground than at it (the exponent's cap: e³, twenty times), so a
  // colour all but gone at the depth is not blown out on a height
  gain: 3,
  // the share of its light past which the water has taken a thing: it is left undrawn, and the open water stands there
  taken: 0.004,
  // water's refractive index: the sun's rays stand steeper under it
  index: 1.333,
  // the clock's period (s), and the share of the fog's density it rides on
  clock: 4096, ride: 0.25,
});

const KEYS = ['zone', 'depth', 'water', 'visibility', 'level', 'caustics', 'shafts', 'snow', 'lamps', 'torch'];
const LAMP_KEYS = ['at', 'colour', 'power', 'aim', 'cone'];
const inRange = (v, [lo, hi]) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const isHex = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const isPoint = (v) => Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'number' && Number.isFinite(x));
const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const enc = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const hexLin = (h) => [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255));
const r5 = (x) => Math.round(x * 1e5) / 1e5;

// a depth's measures between the zones it lies between (by the depth's logarithm; past either end, the end's)
function measuresAt(depth) {
  const Z = Object.values(SEA.zones), ks = ['level', 'caustics', 'shafts', 'snow'];
  if (depth <= Z[0].depth) return Object.fromEntries(ks.map((k) => [k, Z[0][k]]));
  for (let i = 1; i < Z.length; i++) {
    if (depth > Z[i].depth) continue;
    const u = Math.log(depth / Z[i - 1].depth) / Math.log(Z[i].depth / Z[i - 1].depth);
    return Object.fromEntries(ks.map((k) => [k, r5(Z[i - 1][k] + (Z[i][k] - Z[i - 1][k]) * u)]));
  }
  return Object.fromEntries(ks.map((k) => [k, Z.at(-1)[k]]));
}
// the zone a depth lies in: the deepest whose depth it has reached (the shallows over that)
const zoneAt = (depth) => Object.entries(SEA.zones).reduce((m, [id, z]) => (depth >= z.depth ? id : m), Object.keys(SEA.zones)[0]);

/** A recipe's `sea`, read: a zone's word, `true` (the reef), a depth in metres, or `{ zone?, depth?, water?, visibility?,
 *  level?, caustics?, shafts?, snow?, lamps?, torch? }` over a zone (the reef unless named; a depth alone names its own).
 *  `lamps`: up to SEA.lamps.most of `{ at: [x, y, z] (the page's units), colour?, power?, aim?: [x, y, z] (the point it
 *  shines at: a spot), cone? (degrees, a spot's whole angle) }`. `torch`: true or `{ colour?, power?, cone? }`, a lamp at
 *  the eye. `inside` (a flooded hall, room or cavern): no sun reaches it, so no light down, caustics, shafts or surface:
 *  the room's own light, seen through the water. Absent / false / null => null. Anything malformed throws, naming the setting. */
export function readSea(v, { inside = false } = {}) {
  if (v === undefined || v === null || v === false) return null;
  const Z = SEA.zones, W = SEA.waters, R = SEA.range, zones = Object.keys(Z).join(', '), waters = Object.keys(W).join(', ');
  const say = `sea is a zone (${zones}), true (reef), a depth in metres, or { ${KEYS.join(', ')} }: the water a gen-7 page is seen through, its land put under it by light alone`;
  const o = v === true ? {} : typeof v === 'string' ? { zone: v } : typeof v === 'number' ? { depth: v } : v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  if (!o) throw new Error(say);
  for (const k of Object.keys(o)) if (!KEYS.includes(k)) throw new Error(`sea.${k} is not a setting (${KEYS.join(', ')})`);
  if (o.zone !== undefined && !Object.hasOwn(Z, o.zone)) throw new Error(`sea.zone is one of: ${zones}`);
  if (o.depth !== undefined && !inRange(o.depth, R.depth)) throw new Error(`sea.depth is the water over the walk's ground in metres (${R.depth[0]} to ${R.depth[1]})`);
  const depth = o.depth ?? Z[o.zone ?? 'reef'].depth, zone = o.zone ?? (o.depth !== undefined ? zoneAt(depth) : 'reef');
  const water = o.water ?? 'ocean';
  if (!Object.hasOwn(W, water)) throw new Error(`sea.water is one of: ${waters}`);
  const visibility = o.visibility ?? W[water].visibility;
  if (!inRange(visibility, R.visibility)) throw new Error(`sea.visibility is the distance in metres where the far fades into the water (${R.visibility[0]} to ${R.visibility[1]})`);
  const M = o.depth !== undefined ? measuresAt(depth) : Z[zone], out = { zone, depth, water, visibility, inside: !!inside };
  for (const k of ['level', 'caustics', 'shafts', 'snow']) {
    const x = o[k] === false ? 0 : o[k] === true ? M[k] || 1 : o[k] ?? M[k];
    if (k === 'level' ? !inRange(x, R.level) : !inRange(x, R[k])) throw new Error(`sea.${k} is ${k === 'level' ? `the light at the walk's ground as the adapted eye takes it (${R.level[0]} to ${R.level[1]}: never black)` : `a strength, ${R[k][0]} to ${R[k][1]} (false: none)`}`);
    out[k] = inside && k !== 'level' && k !== 'snow' ? 0 : x;
  }
  const lampOf = (l, at, D) => {
    const keys = at ? LAMP_KEYS : LAMP_KEYS.filter((k) => k !== 'at' && k !== 'aim');
    if (!l || typeof l !== 'object' || Array.isArray(l)) throw new Error(`${D.name} is { ${keys.join(', ')} }`);
    for (const k of Object.keys(l)) if (!keys.includes(k)) throw new Error(`${D.name}.${k} is not a setting (${keys.join(', ')})`);
    if (at && !isPoint(l.at)) throw new Error(`${D.name}.at is where it hangs, [x, y, z] in the page's units`);
    if (l.colour !== undefined && !isHex(l.colour)) throw new Error(`${D.name}.colour is its light, #rrggbb`);
    if (l.power !== undefined && !inRange(l.power, R.power)) throw new Error(`${D.name}.power is how strong it is (${R.power[0]} to ${R.power[1]}: at 1, a white thing a metre off is lit to the page's white)`);
    if (l.aim !== undefined && !isPoint(l.aim)) throw new Error(`${D.name}.aim is the point it shines at, [x, y, z] (a spot; absent, it shines all round)`);
    if (l.cone !== undefined && !inRange(l.cone, R.cone)) throw new Error(`${D.name}.cone is a spot's whole angle in degrees (${R.cone[0]} to ${R.cone[1]})`);
    if (l.cone !== undefined && at && l.aim === undefined) throw new Error(`${D.name}.cone is a spot's: give it an aim`);
    return { ...(at ? { at: l.at } : {}), colour: l.colour ?? D.colour, power: l.power ?? D.power, ...(at && l.aim ? { aim: l.aim } : {}), ...(!at || l.aim ? { cone: l.cone ?? D.cone } : {}) };
  };
  if (o.lamps !== undefined && o.lamps !== false) {
    if (!Array.isArray(o.lamps) || o.lamps.length > SEA.lamps.most) throw new Error(`sea.lamps is a list of at most ${SEA.lamps.most} lamps, each { ${LAMP_KEYS.join(', ')} }`);
    out.lamps = o.lamps.map((l, i) => lampOf(l, true, { ...SEA.lamps, name: `sea.lamps[${i}]` }));
  } else out.lamps = [];
  out.torch = o.torch === undefined || o.torch === false ? null : lampOf(o.torch === true ? {} : o.torch, false, { ...SEA.torch, name: 'sea.torch' });
  return out;
}

/** The light a read sea solves to, in metres and linear light: `c` the water's attenuation along the view per metre (its
 *  absorption `k` and the scattering `s` its visibility sets), `tint` the sun's light at the depth normalised to its
 *  strongest colour, `e0` that at the zone's level (what a white thing at the walk's ground shows), `top` the light just
 *  under the surface on the same scale, `body` the water's own colour looking level. Inside, no sun: `e0` is 1 (the
 *  room's own light stands) and the body the water's hue at the level. */
export function seaLight(S) {
  const W = SEA.waters[S.water], k = W.k, s = Math.max(-Math.log(SEA.contrast) / S.visibility - Math.min(...k), 0.01), c = k.map((x) => x + s);
  const hue = c.map((x) => s / x), hm = Math.max(...hue);
  if (S.inside) return { k: [0, 0, 0], s: r5(s), c: c.map(r5), tint: [1, 1, 1], e0: [1, 1, 1], top: [1, 1, 1], body: hue.map((x) => r5((x / hm) * S.level * SEA.body)) };
  const down = k.map((x) => Math.exp(-x * S.depth)), m = Math.max(...down), tint = down.map((x, i) => Math.max(x / m, W.deep[i]));
  const body = tint.map((x, i) => x * hue[i]), bm = Math.max(...body);
  return { k: [...k], s: r5(s), c: c.map(r5), tint: tint.map(r5), e0: tint.map((x) => r5(x * S.level)), top: tint.map((x, i) => r5(x * S.level * Math.exp(Math.min(k[i] * S.depth, SEA.gain)))), body: body.map((x) => r5((x / bm) * S.level * SEA.body)) };
}

/** The page's input from a read sea: its light in the page's units (`unit` metres a unit), the walk's ground (`base`, z)
 *  and the surface over it, the sun as its rays stand under water (refracted; absent or under the horizon, no caustics
 *  or shafts), the lamps in linear light. */
export function seaInput(S, { base = 0, sun = null, unit = 1 } = {}) {
  const u = unit > 0 ? unit : 1, L = seaLight(S), n = sun && sun.length === 3 ? Math.hypot(...sun) : 0;
  let ray = null;
  if (!S.inside && n > 0 && sun[2] / n > 0.03) {
    const h = Math.hypot(sun[0], sun[1]) / n, hw = h / SEA.index, zw = Math.sqrt(1 - hw * hw);
    ray = h > 1e-6 ? [r5((sun[0] / n / h) * hw), r5((sun[1] / n / h) * hw), r5(zw)] : [0, 0, 1];
  }
  const lamp = (l) => ({ ...(l.at ? { at: l.at.map(r5) } : {}), i: hexLin(l.colour).map((x) => r5(x * l.power)),
    ...(l.aim ? { aim: ((d) => { const m = Math.hypot(...d) || 1; return d.map((x) => r5(x / m)); })(l.aim.map((x, i) => x - l.at[i])) } : {}),
    ...(l.cone !== undefined ? { cos: [r5(Math.cos(Math.min((l.cone / 2) * (l.at ? 1.25 : 1.7), 89) * Math.PI / 180)), r5(Math.cos((l.cone / 2) * (l.at ? 0.7 : 0.25) * Math.PI / 180))] } : {}) });
  return {
    zone: S.zone, depth: S.depth, water: S.water, visibility: S.visibility, level: S.level, inside: S.inside, unit: r5(u),
    base: r5(base), surface: r5(base + S.depth / u), c: L.c.map((x) => r5(x * u)), k: L.k.map((x) => r5(x * u)), s: L.s,
    sigma: r5(Math.min(...L.c) * u), e0: L.e0, top: L.top, body: L.body, hex: '#' + L.body.map((x) => Math.round(Math.min(1, enc(x)) * 255).toString(16).padStart(2, '0')).join(''),
    sun: ray, caustics: ray ? S.caustics : 0, shafts: ray ? S.shafts : 0, snow: S.snow,
    lamps: S.lamps.map(lamp), torch: S.torch ? lamp(S.torch) : null,
  };
}

const f = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x));
const v3 = (a) => `vec3( ${a.map(f).join(', ')} )`;

/** The sea's GLSL, literals from the page's sea: `seaThrough` (a surface's colour as the page drew it, the ray to it from
 *  the eye in world space, the clock, the pixel → what the eye sees of it through the water) and `seaOpen` (the open
 *  water along a ray: its body, the surface from below, and what glows in it). */
export function seaGlsl(cfg) {
  const U = cfg.unit, open = !cfg.inside, sun = cfg.sun, D0 = cfg.depth / U;
  const waves = SEA_NET.map((W) => `  { float p = sin( ( q.x * ${f(W.c)} + q.y * ${f(W.s)} ) * ${f(W.k)} + t * ${f(W.w)} + ${f(W.f)} ) * ${f(W.g)}; xx += p * ${f(r5(W.c * W.c))}; yy += p * ${f(r5(W.s * W.s))}; xy += p * ${f(r5(W.c * W.s))}; }`).join('\n');
  const cone = (l, dir) => (l.cos ? ` * smoothstep( ${f(l.cos[0])}, ${f(l.cos[1])}, dot( ${dir}, ${l.aim ? v3(l.aim) : 'seaFwd()'} ) )` : '');
  // a lamp on a surface: the square of the distance (m), the water between, how it faces
  const lampOn = cfg.lamps.map((l) => `  { vec3 l = ${v3(l.at)} - wp; float dl = length( l ); l /= max( dl, 1e-4 ); float dm = dl * ${f(U)};
    lamp += ${v3(l.i)} * exp( - SEA_C * dl ) * ( 0.15 + 0.85 * max( dot( n, l ), 0.0 ) ) / ( dm * dm + 1.0 )${cone(l, '- l')}; }`).join('\n');
  // a lamp's glow in the water along a ray: the integral of 1 / distance² along it, closed (the airlight integral)
  const halo = cfg.lamps.map((l) => `  { vec3 op = ${v3(l.at)} - O; float t0 = dot( op, d ), h = sqrt( max( dot( op, op ) - t0 * t0, 0.0 ) ) + ${f(r5(0.12 / U))}, tc = clamp( t0, 0.0, L );
    vec3 x = O + d * tc - ${v3(l.at)}; float xl = length( x );
    g += ${v3(l.i)} * ( ( atan( ( L - t0 ) / h ) + atan( t0 / h ) ) / ( h * ${f(U)} ) ) * exp( - SEA_C * ( xl + tc ) )${cone(l, 'x / max( xl, 1e-4 )')}; }`).join('\n');
  const T = cfg.torch;
  return `const vec3 SEA_C = ${v3(cfg.c)};
const vec3 SEA_K = ${v3(cfg.k)};
const vec3 SEA_E0 = ${v3(cfg.e0)};
const vec3 SEA_BODY = ${v3(cfg.body)};
float seaNet( vec2 q, float t ) {
  float xx = 0.0, yy = 0.0, xy = 0.0;
${waves}
  return min( 1.0 / ( abs( ( 1.0 - xx ) * ( 1.0 - yy ) - xy * xy ) + ${f(NET.soft)} ), ${f(NET.top)} ) / ${f(NET_MEAN)};
}
vec3 seaFwd() { return - vec3( viewMatrix[ 0 ][ 2 ], viewMatrix[ 1 ][ 2 ], viewMatrix[ 2 ][ 2 ] ); }
vec3 seaDown( float z ) {
${open ? `  return SEA_E0 * exp( clamp( - SEA_K * ( max( ${f(cfg.surface)} - z, 0.0 ) - ${f(r5(D0))} ), - 30.0, ${f(SEA.gain)} ) );`: '  return SEA_E0;'}
}
vec3 seaBody( vec3 d ) { return SEA_BODY * exp( ${f(SEA.rise)} * d.z ); }
vec3 seaGlow( vec3 O, vec3 d, float L, float t, vec2 px ) {
  vec3 g = vec3( 0.0 );
${open ? `  if ( d.z > 1e-3 && O.z < ${f(cfg.surface)} ) L = min( L, ( ${f(cfg.surface)} - O.z ) / d.z );
` : ''}${halo ? `${halo}\n  g *= ${f(r5(cfg.s * SEA.halo))};\n` : ''}${T ? `  g += ${v3(T.i)} * ${f(r5(cfg.s * SEA.back))} * ( 1.0 - exp( - L * ${f(r5(0.5 * U))} ) )${cone(T, 'd')};\n` : ''}${cfg.shafts > 0 ? `  { float reach = min( L, ${f(r5(Math.min(cfg.visibility * 0.5, 24) / U))} ), dt = reach / ${f(SEA.shafts.steps)}, j = 0.5; vec3 sum = vec3( 0.0 );
    for ( int i = 0; i < ${SEA.shafts.steps}; i++ ) {
      float s = ( float( i ) + j ) * dt; vec3 p = O + d * s; float dz = ${f(cfg.surface)} - p.z;
      if ( dz > 0.0 ) sum += smoothstep( 0.9, 2.3, seaNet( ( p.xy + ${`vec2( ${f(r5(sun[0] / sun[2]))}, ${f(r5(sun[1] / sun[2]))} )`} * dz ) * ${f(r5(U * SEA.shafts.cell))}, t * 0.5 ) ) * seaDown( p.z ) * exp( - SEA_C * s );
    }
    float mu = max( dot( d, ${v3(sun)} ), 0.0 );
    g += sum * dt * ${f(r5(U * cfg.s * SEA.shafts.gain * cfg.shafts))} * ( 0.35 + 0.65 * mu * mu * mu ); }
` : ''}  return g;
}
vec3 seaFar( vec3 O, vec3 d, float t ) {
  vec3 col = seaBody( d );
${open ? `  if ( d.z > 0.02 && O.z < ${f(cfg.surface)} ) {
    float ts = ( ${f(cfg.surface)} - O.z ) / d.z, w = seaNet( ( O.xy + d.xy * ts ) * ${f(r5(U * SEA.ripple))}, t * 0.6 );
    float win = smoothstep( ${f(SEA.snell - 0.06)}, ${f(SEA.snell + 0.04)}, d.z + clamp( w - 1.0, - 1.0, 1.0 ) * 0.03 );
    vec3 up = ${v3(cfg.top.map((x, i) => r5(x * SEA.window * [0.8, 0.93, 1][i])))} * ( 0.55 + 0.45 * w )${sun ? ` * ( 1.0 + 6.0 * pow( max( dot( d, ${v3(sun)} ), 0.0 ), 90.0 ) * w )` : ''};
    col = mix( col, mix( seaBody( vec3( d.xy, - d.z ) ) * ( 0.75 + 0.25 * w ), up, win ), exp( - SEA_C * ts ) );
  }
` : ''}  return col;
}
vec3 seaOpen( vec3 O, vec3 d, float t, vec2 px ) { return seaFar( O, d, t ) + seaGlow( O, d, ${f(r5(4000 / U))}, t, px ); }
vec3 seaThrough( vec3 enc, vec3 r, float t, vec2 px ) {
  vec3 c = pow( max( enc, 0.0 ), vec3( 2.2 ) );
  float L = length( r ); vec3 d = r / max( L, 1e-5 ), wp = cameraPosition + r;
  vec3 nx = cross( dFdx( r ), dFdy( r ) ); float nl = length( nx ); vec3 n = nl > 1e-12 ? nx / nl : - d;
  if ( dot( n, d ) > 0.0 ) n = - n;
  vec3 E = seaDown( wp.z ), lamp = vec3( 0.0 );
${cfg.caustics > 0 ? `  { float dz = max( ${f(cfg.surface)} - wp.z, 0.0 );
    float w = seaNet( ( wp.xy + vec2( ${f(r5(sun[0] / sun[2]))}, ${f(r5(sun[1] / sun[2]))} ) * dz ) * ${f(r5(U * SEA.caustics.cell))} / ( 1.0 + dz * ${f(r5(U * SEA.caustics.widen))} ), t );
    E *= max( 1.0 + ${f(cfg.caustics)} * ( w - 1.0 ) * exp( - dz * ${f(r5(U / SEA.caustics.fade))} ) * smoothstep( 0.0, 0.5, dot( n, ${v3(sun)} ) ), 0.2 ); }
` : ''}${lampOn ? `${lampOn}\n` : ''}${T ? `  { float dm = L * ${f(U)}; lamp += ${v3(T.i)} * exp( - SEA_C * L ) * ( 0.15 + 0.85 * max( dot( n, - d ), 0.0 ) ) / ( dm * dm + 1.0 )${cone(T, 'd')}; }\n` : ''}  float self = smoothstep( ${f(SEA.self[0])}, ${f(SEA.self[1])}, max( c.r, max( c.g, c.b ) ) ) * ${f(r5(Math.max(0, 1 - cfg.level)))};
  vec3 T = exp( - SEA_C * L );
  // (what the water has taken is not drawn: the open water shows in its place, whatever the page lays over its fog
  // after it, a live shadow's shade among them${open ? '; nor what stands out of the water, seen from under it' : ''})
  if ( max( T.r, max( T.g, T.b ) ) < ${f(SEA.taken)}${open ? ` || ( wp.z > ${f(cfg.surface)} && cameraPosition.z < ${f(cfg.surface)} )` : ''} ) discard;
  vec3 o = c * mix( E + lamp, vec3( 1.0 ), self ) * T + seaFar( cameraPosition, d, t ) * ( 1.0 - T ) + seaGlow( cameraPosition, d, L, t, px );
  return pow( max( o, 0.0 ), vec3( 0.4545 ) );
}
`;
}

/** The sea's EARLY page source, placed right after the scene is made (scene-three.js): three's fog chunk patched before
 *  any material is made, and the probe. */
export function seaEarlyScript(cfg) {
  const GL = seaGlsl(cfg);
  return `
// --- the sea, first: three's fog chunk (channels/sea.js) ---
(function () {
  const SE = ${safeJson({ zone: cfg.zone, depth: cfg.depth, water: cfg.water, level: cfg.level, surface: cfg.surface, lamps: cfg.lamps.length + (cfg.torch ? 1 : 0) })}, GL = ${JSON.stringify(GL)};
  // (three's fog chunk, once, before any material compiles: the ray from the eye in world space, and the water along it)
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = C.fog_pars_vertex.replace('varying float vFogDepth;', 'varying float vFogDepth;\\n\\tvarying vec3 vSeaRay;');
  C.fog_vertex = C.fog_vertex.replace('vFogDepth = - mvPosition.z;', 'vFogDepth = - mvPosition.z;\\n\\tvSeaRay = ( vec4( mvPosition.xyz, 0.0 ) * viewMatrix ).xyz;');
  C.fog_pars_fragment = C.fog_pars_fragment.replace('varying float vFogDepth;', 'varying float vFogDepth;\\n\\tvarying vec3 vSeaRay;\\n' + GL);
  C.fog_fragment = '#ifdef USE_FOG\\n\\tgl_FragColor.rgb = seaThrough( gl_FragColor.rgb, vSeaRay, ( fogDensity / ${f(cfg.sigma)} - 1.0 ) * ${f(SEA.clock / SEA.ride)}, gl_FragCoord.xy );\\n#endif';
  window.__mojSea = { ...SE, snow: 0, chunk: () => C.fog_fragment.indexOf('seaThrough') >= 0,
    clock: () => ((window.__mojClock != null ? window.__mojClock : performance.now()) / 1000) % ${SEA.clock} };
})();
`;
}

/** The sea's page source; `cfg` a seaInput. Runs where the air's would (after the page's haze and its sky are made):
 *  the page's fog made the water's, its sky hidden behind the open water's dome and the surface over the land, the
 *  snow, and the clock each frame. */
export function seaScript(cfg) {
  const GL = seaGlsl(cfg), N = Math.round(SEA.snow.count * cfg.snow), box = r5(SEA.snow.box / cfg.unit), sink = r5(SEA.snow.sink / cfg.unit), size = r5(SEA.snow.size / cfg.unit);
  return `
// --- the sea: the open water, the surface from below, the snow (channels/sea.js) ---
(function () {
  const SE = ${safeJson({ hex: cfg.hex, sigma: cfg.sigma, surface: cfg.surface, inside: cfg.inside, snow: N, box })}, GL = ${JSON.stringify(GL)}, probe = window.__mojSea;
  // (the page's fog is the water: its colour the water's body, its density the water's extinction with the clock riding on it)
  if (!scene.fog || !scene.fog.isFogExp2) scene.fog = new THREE.FogExp2(new THREE.Color(SE.hex), SE.sigma);
  scene.fog.color.set(SE.hex);
  if (scene.background && scene.background.isColor) scene.background.set(SE.hex);
  // the open water: a dome round the eye, drawn first, under everything
  const U = { uT: { value: 0 } };
  const VS = '#include <common>\\n#include <logdepthbuf_pars_vertex>\\nvarying vec3 vD;\\nvoid main() { vec4 w = modelMatrix * vec4( position, 1.0 ); vD = w.xyz - cameraPosition; gl_Position = projectionMatrix * viewMatrix * w;\\n#include <logdepthbuf_vertex>\\n}';
  const FS = '#include <common>\\n#include <logdepthbuf_pars_fragment>\\nuniform float uT;\\nvarying vec3 vD;\\n' + GL + 'void main() {\\n#include <logdepthbuf_fragment>\\n  gl_FragColor = vec4( pow( max( seaOpen( cameraPosition, normalize( vD ), uT, gl_FragCoord.xy ), 0.0 ), vec3( 0.4545 ) ), 1.0 ); }';
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: FS, fog: false, toneMapped: false, side: THREE.BackSide, depthWrite: false, depthTest: false }));
  dome.frustumCulled = false; dome.raycast = () => {}; dome.userData.sea = true; dome.renderOrder = -3; scene.add(dome);
  // the snow: specks in a box that follows the eye, sinking, lit as a surface is (so a lamp's beam shows them)
  let snow = null;
  if (SE.snow > 0) {
    const hh = (a, b) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const pos = new Float32Array(SE.snow * 3);
    for (let i = 0; i < SE.snow; i++) for (let c = 0; c < 3; c++) pos[i * 3 + c] = hh(i, c + 1) * SE.box;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const SU = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uPx: { value: 1 } }]);
    snow = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: SU, fog: true, transparent: true, depthWrite: false, toneMapped: false,
      vertexShader: ${JSON.stringify(`#include <common>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
uniform float uT, uPx;
varying float vA;
void main() {
  vec3 p = position; float ph = p.x * 7.1 + p.y * 3.3;
  p.z -= uT * ${f(sink)} * ( 0.6 + 0.8 * fract( ph ) ); p.xy += ${f(r5(box * 0.012))} * vec2( sin( uT * 0.31 + ph ), cos( uT * 0.27 + ph * 1.7 ) );
  p = mod( p - cameraPosition + ${f(r5(box / 2))}, ${f(box)} ) - ${f(r5(box / 2))} + cameraPosition;
  vec4 mvPosition = viewMatrix * vec4( p, 1.0 ); gl_Position = projectionMatrix * mvPosition;
  float dist = - mvPosition.z; gl_PointSize = clamp( ${f(size)} * ( 0.5 + fract( ph * 1.9 ) ) * uPx / max( dist, 1e-3 ), 1.0, 14.0 );
  vA = smoothstep( ${f(r5(box / 2))}, ${f(r5(box * 0.35))}, dist ) * smoothstep( 0.0, ${f(r5(box * 0.03))}, dist );
#include <logdepthbuf_vertex>
#include <fog_vertex>
}`)},
      fragmentShader: '#include <common>\\n#include <fog_pars_fragment>\\n#include <logdepthbuf_pars_fragment>\\nvarying float vA;\\nvoid main() {\\n#include <logdepthbuf_fragment>\\n  vec2 q = gl_PointCoord - 0.5; float a = smoothstep( 0.5, 0.1, length( q ) ) * vA * 0.75;\\n  if ( a < 0.01 ) discard;\\n  gl_FragColor = vec4( vec3( 0.86 ), a );\\n#include <fog_fragment>\\n}' }));
    snow.frustumCulled = false; snow.raycast = () => {}; snow.userData.sea = true; snow.renderOrder = 5; scene.add(snow);
    probe.snow = SE.snow;
  }
  // each frame: the clock to every material, the water round the eye, the page's sky hidden (over the eye is water)
  const prev = scene.onBeforeRender, sz = new THREE.Vector2();
  scene.onBeforeRender = function (r, s, cam, rt) {
    if (prev) prev.call(this, r, s, cam, rt);
    const t = probe.clock();
    scene.fog.density = SE.sigma * (1 + t / ${SEA.clock / SEA.ride}); U.uT.value = t;
    const far = cam.far || 2000;
    dome.position.copy(cam.position); dome.scale.setScalar(far * 0.5); dome.updateMatrixWorld();
    if (snow) { snow.material.uniforms.uT.value = t; r.getDrawingBufferSize(sz); snow.material.uniforms.uPx.value = sz.y * 0.5 * (cam.projectionMatrix ? cam.projectionMatrix.elements[5] : 1); }
    // (and the land's own sea, a glossy sheet with the sky in it: under the water there is no waterline)
    for (const o of scene.children) { if (!o.visible || o.userData.sea) continue; const m = o.material;
      if (o.renderOrder <= -1 || o.userData.g === 'isekai:cloud' || (m && m.isMeshStandardMaterial && m.transparent && m.envMap && !m.depthWrite)) o.visible = false; }
  };
})();
`;
}

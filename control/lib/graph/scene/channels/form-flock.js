/**
 * A REALISTIC CROWN AS FLOCK (gen-7, channels/form-flora.js): its puffs (form/flora-read.js REALISTIC, PUFF) drawn as a
 * model maker's clump foliage is cut, a porous sponge the light passes through, not a felt ball; its skin carrying its
 * species' own leaves at their true size, so its edge breaks into leaves as a real crown's does. The page's GLSL, one
 * source for the colour pass and the shadow pass (the needles' sleeve, form-flora.js NEEDLE_LOOK, is the same move for a
 * needled crown).
 *
 * THE SPONGE (`FLOCK_LOOK.sponge`): a pixel of a puff marches into it along the eye's ray (`steps` samples across `span`
 * of its radius, in the template's own metres, so the holes stay with the tree and run on across puffs that overlap);
 * the first sample whose field passes the threshold is the pixel; a ray that meets none went out through the holes and
 * is not drawn (the sky through). The field is two octaves of value noise at leaf-cluster grain (`grain` m and `fine`
 * m); the threshold falls from `skin` at the puff's skin to `core` within `close` of the way in: porous outside, dense
 * inside, as a trimmed sponge is.
 * ITS SHADE (`FLOCK_LOOK.shade`): the hit's depth its own shade (`skin` at the skin to `core` by `deep` of the way in,
 * the sponge's inside in its own shadow), each leaf-cluster cell (`cell` m) toned its own way within `vary`.
 * THE LIGHT THROUGH (`FLOCK_LOOK.glow`): seen against the sun (`power`: how near it the eye must look), the sun comes
 * through what is thin (a shallow hit, within `thin` of the way in, and every leaf), `k` × the sun's light.
 * THE LEAVES AT THE ENDS (`FLOCK_LOOK.leaf`): a leaf a cell (`cell` × its length) on the sponge's skin where the sponge
 * under it holds (`on`), its base jittered in the cell, its midrib out of the puff (`lean`) and a little down
 * (`droop`), turned its own way; its blade its species' outline (vegetation/twigs.js LEAF_SHAPES, a table of its
 * half-width along the midrib, FLOCK_TABLE entries) at the grower's own leaf length (form/flora-read.js flockLeaf). A
 * pixel walks the cells its ray crosses in the skin (`steps` half-cells in) and takes the nearest leaf it meets, drawn
 * where it is nearer than the sponge, lit by its face to the sun (`lit`, either side), toned its own (`tone`). Seen
 * small, leaves thin out by the share their size in pixels allows (`px`: none under the first, all past the second), so
 * far off the crown is its sponge alone.
 * Its SHADOW (form/flora-read.js FLOCK.shadow): 'sponge' the same field in the crown's depth pass (light through its
 * thin parts; its leaves cast none of their own), 'solid' the puffs whole, 'none' no crown shadow.
 *
 *   flockGlsl({ leaves }) → GLSL: spongeMarchT, spongeMarch, and (leaves) leafMarch over `uLeafL`, `uLeafW`
 *   FLOCK_VARYINGS, FLOCK_VERTEX: the template-space position, the puff's centre and radius, the eye and the sun there
 *   flockFragment({ leaves }), flockLight(): the colour pass's puff and its light through, as GLSL statements
 */
export const FLOCK_TABLE = 24;
export const FLOCK_LOOK = Object.freeze({
  sponge: Object.freeze({ steps: 9, span: 1.8, skin: 0.6, core: 0.28, close: 0.55, grain: 0.32, fine: 0.13 }),
  shade: Object.freeze({ skin: 1.12, core: 0.38, deep: 0.6, cell: 0.2, vary: Object.freeze([0.85, 1.15]) }),
  glow: Object.freeze({ k: 0.9, power: 3, thin: 0.45 }),
  leaf: Object.freeze({ cell: 1.25, on: 0.42, lean: 0.9, droop: 0.25, steps: 6, px: Object.freeze([1.5, 4]), lit: Object.freeze([0.85, 1.35]), tone: Object.freeze([0.88, 1.15]) }),
});
const f = (v) => v.toFixed(3);

/** The sponge's field and its march (and, with `leaves`, the leaves' walk). */
export function flockGlsl({ leaves = false } = {}) {
  const S = FLOCK_LOOK.sponge, L = FLOCK_LOOK.leaf;
  return `
float spH( vec3 p ) { return fract( sin( dot( p, vec3( 127.1, 311.7, 74.7 ) ) ) * 43758.5453 ); }
float spN( vec3 p ) { vec3 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( mix( spH( i ), spH( i + vec3( 1, 0, 0 ) ), f.x ), mix( spH( i + vec3( 0, 1, 0 ) ), spH( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
              mix( mix( spH( i + vec3( 0, 0, 1 ) ), spH( i + vec3( 1, 0, 1 ) ), f.x ), mix( spH( i + vec3( 0, 1, 1 ) ), spH( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z ); }
float sponge( vec3 q ) { return 0.65 * spN( q / ${f(S.grain)} ) + 0.35 * spN( q / ${f(S.fine)} + 11.0 ); }
float spongeMarchT( vec3 P, vec3 D, vec3 C, float R, out float tHit ) {
  float span = ${f(S.span)} * R; tHit = 1e9;
  for ( int i = 0; i < ${S.steps}; i++ ) {
    float t = ( float( i ) + 0.25 ) / ${S.steps.toFixed(1)} * span; vec3 Q = P + D * t; float r = length( Q - C );
    if ( r > R * 1.03 && i > 0 ) break;
    float dn = clamp( 1.0 - r / R, 0.0, 1.0 ), th = mix( ${f(S.skin)}, ${f(S.core)}, smoothstep( 0.0, ${f(S.close)}, dn ) );
    if ( sponge( Q ) > th ) { tHit = t; return dn; }
  }
  return -1.0;
}
float spongeMarch( vec3 P, vec3 D, vec3 C, float R ) { float t; return spongeMarchT( P, D, C, R, t ); }
${leaves ? `uniform float uLeafL; uniform float uLeafW[ ${FLOCK_TABLE} ];
float leafW( float u ) { float x = clamp( u, 0.0, 1.0 ) * ${(FLOCK_TABLE - 1).toFixed(1)}; int i = int( floor( x ) ); return mix( uLeafW[ i ], uLeafW[ min( i + 1, ${FLOCK_TABLE - 1} ) ], x - float( i ) ); }
float leafMarch( vec3 P, vec3 D, vec3 C, vec3 S, float share, out float lit, out float tone ) {
  float L = uLeafL, c = ${f(L.cell)} * L, best = 1e9; vec3 last = vec3( 1e9 ); lit = 0.0; tone = 0.5;
  for ( int i = 0; i < ${L.steps}; i++ ) {
    vec3 Q = P + D * ( float( i ) * 0.5 * c ), cell = floor( Q / c );
    if ( cell == last ) continue; last = cell;
    float h1 = spH( cell ), h2 = spH( cell + 3.1 ), h3 = spH( cell + 7.7 ), h4 = spH( cell + 5.3 );
    if ( h4 > share ) continue;
    vec3 b = ( cell + 0.5 + ( vec3( h1, h2, h3 ) - 0.5 ) * 0.5 ) * c;
    if ( sponge( b ) < ${f(L.on)} ) continue;
    vec3 o = normalize( b - C ), rn = normalize( vec3( h2, h3, h1 ) - 0.5 + 1e-3 );
    vec3 m = normalize( o * ${f(L.lean)} + rn + vec3( 0.0, 0.0, -${f(L.droop)} ) ), sd = normalize( cross( m, rn ) + 1e-4 ), n = cross( sd, m );
    float dn = dot( D, n ); if ( abs( dn ) < 1e-3 ) continue;
    float t = dot( b - P, n ) / dn; if ( t < 0.0 || t >= best ) continue;
    vec3 H = P + D * t - b; float u = dot( H, m ) / L, v = dot( H, sd ) / L;
    if ( u < 0.0 || u > 1.0 || abs( v ) > leafW( u ) ) continue;
    best = t; lit = abs( dot( n, S ) ); tone = h4 / max( share, 1e-3 );
  }
  return best;
}
` : ''}`;
}
/** The varyings both passes share (declared in each stage), and the vertex statements that fill them (after
 *  `aSite`, `uSunW` and the instance matrix are in scope). */
export const FLOCK_VARYINGS = 'varying vec3 vPosT;\nvarying vec3 vCenT;\nvarying float vRadT;\nvarying vec3 vCamT;\nvarying vec3 vSunT;\n';
export const FLOCK_VERTEX = '  vPosT = position; vCenT = aSite; vRadT = length( position - aSite ); vCamT = ( inverse( modelMatrix * instanceMatrix ) * vec4( cameraPosition, 1.0 ) ).xyz; vSunT = normalize( inverse( mat3( modelMatrix * instanceMatrix ) ) * uSunW );';
/** The colour pass's puff (in place of form-flora.js MASS_CELLS; `spThin` and `spMpp` declared at the top of main). */
export function flockFragment({ leaves = false } = {}) {
  const H = FLOCK_LOOK.shade, G = FLOCK_LOOK.glow, L = FLOCK_LOOK.leaf;
  const sponge = `if ( spHit < 0.0 ) discard; spThin = 1.0 - smoothstep( 0.0, ${f(G.thin)}, spHit ); diffuseColor.rgb *= mix( ${f(H.skin)}, ${f(H.core)}, smoothstep( 0.0, ${f(H.deep)}, spHit ) ) * mix( ${f(H.vary[0])}, ${f(H.vary[1])}, spH( floor( vPosT / ${f(H.cell)} ) ) );`;
  const head = ' if ( vMass > 0.5 ) { vec3 spD = normalize( vPosT - vCamT ); float spTs; float spHit = spongeMarchT( vPosT, spD, vCenT, vRadT, spTs );';
  if (!leaves) return `${head} ${sponge} }`;
  return `${head} float spShare = smoothstep( ${f(L.px[0])}, ${f(L.px[1])}, uLeafL / max( spMpp, 1e-5 ) ), spLit, spTone, spTl = spShare > 0.0 && uLeafL > 0.0 ? leafMarch( vPosT, spD, vCenT, vSunT, spShare, spLit, spTone ) : 1e9;`
    + ` if ( spTl < 1e8 && ( spHit < 0.0 || spTl < spTs ) ) { spThin = 1.0; diffuseColor.rgb *= mix( ${f(L.lit[0])}, ${f(L.lit[1])}, spLit ) * mix( ${f(L.tone[0])}, ${f(L.tone[1])}, spTone ); } else { ${sponge} } }`;
}
/** The colour pass's light through the thin parts, seen against the sun (after the lights). */
export function flockLight() {
  const G = FLOCK_LOOK.glow;
  return ` if ( vMass > 0.5 ) { vec3 spLs = normalize( ( viewMatrix * vec4( uSunW, 0.0 ) ).xyz ); float spBack = pow( max( 0.0, dot( normalize( -vViewPosition ), spLs ) ), ${G.power.toFixed(1)} ); reflectedLight.indirectDiffuse += diffuseColor.rgb * uSunC * spBack * spThin * ${f(G.k)}; }`;
}

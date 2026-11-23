// THE SPONGE (the flock spike): a realistic crown's puff drawn as a miniature maker's clump foliage is cut, a porous
// sponge the light passes through, not a felt ball. A pixel of a puff marches into it along the eye's ray (`STEPS`
// samples across `SPAN` of its radius); the first sample whose field passes the threshold is the pixel, its depth (0 at
// the skin, 1 at the core) its own shade; a ray that meets none went out through the holes and is not drawn (the sky
// through). The threshold falls from `SKIN` at the skin to `CORE` within `CLOSE` of the way in: porous outside, dense
// inside, as a trimmed sponge is. The field is two octaves of value noise at leaf-cluster grain (`GRAIN` m, and a finer
// third of it), in the template's own metres, so the holes stay with the tree and run across puffs that overlap.
// Self-contained GLSL: the colour pass and the shadow pass inline the same text. `spongeMarchT` gives the hit's distance
// along the ray too, so a leaf in front of the sponge is drawn over it.
export const SPONGE = Object.freeze({ STEPS: 9, SPAN: 1.8, SKIN: 0.6, CORE: 0.28, CLOSE: 0.55, GRAIN: 0.32, FINE: 0.13 });
const f = (v) => v.toFixed(3);
export const spongeGlsl = (S = SPONGE) => `
float spH( vec3 p ) { return fract( sin( dot( p, vec3( 127.1, 311.7, 74.7 ) ) ) * 43758.5453 ); }
float spN( vec3 p ) { vec3 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( mix( spH( i ), spH( i + vec3( 1, 0, 0 ) ), f.x ), mix( spH( i + vec3( 0, 1, 0 ) ), spH( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
              mix( mix( spH( i + vec3( 0, 0, 1 ) ), spH( i + vec3( 1, 0, 1 ) ), f.x ), mix( spH( i + vec3( 0, 1, 1 ) ), spH( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z ); }
float sponge( vec3 q ) { return 0.65 * spN( q / ${f(S.GRAIN)} ) + 0.35 * spN( q / ${f(S.FINE)} + 11.0 ); }
float spongeMarchT( vec3 P, vec3 D, vec3 C, float R, out float tHit ) {
  const int N = ${S.STEPS}; float span = ${f(S.SPAN)} * R; tHit = 1e9;
  for ( int i = 0; i < N; i++ ) {
    float t = ( float( i ) + 0.25 ) / float( N ) * span; vec3 Q = P + D * t; float r = length( Q - C );
    if ( r > R * 1.03 && i > 0 ) break;
    float dn = clamp( 1.0 - r / R, 0.0, 1.0 ), th = mix( ${f(S.SKIN)}, ${f(S.CORE)}, smoothstep( 0.0, ${f(S.CLOSE)}, dn ) );
    if ( sponge( Q ) > th ) { tHit = t; return dn; }
  }
  return -1.0;
}
float spongeMarch( vec3 P, vec3 D, vec3 C, float R ) { float t; return spongeMarchT( P, D, C, R, t ); }
`;

/**
 * THE LEAVES AT THE ENDS: the sponge's skin carries its species' own leaves at their true size, so the crown's edge
 * breaks into leaves as a real one does and its near face shows them. A leaf a cell (`cell` × its length), where the
 * sponge under it holds (`on`): its base jittered in the cell, its midrib out of the puff (`lean`) and a little down
 * (`droop`), turned its own way round it; its blade the species' outline (vegetation/twigs.js LEAF_SHAPES, its half-width
 * along the midrib as a table, `uLeafW`) at the grower's leaf length (`uLeafL` m, never the species' stylized scale). A
 * pixel walks the cells its ray crosses in the skin (`steps` half-cells in) and takes the nearest leaf its ray meets;
 * it draws the leaf where it is nearer than the sponge. Seen small, leaves thin out by the share their size in pixels
 * allows (`px`: none under the first, all past the second), so far off the crown is its sponge alone.
 * The leaf lit by its face to the sun (`lit`, either side), toned its own (`tone`), and thin: the sun comes through it.
 */
export const LEAF = Object.freeze({ cell: 1.25, on: 0.42, lean: 0.9, droop: 0.25, steps: 6, px: Object.freeze([1.5, 4]), lit: Object.freeze([0.85, 1.35]), tone: Object.freeze([0.88, 1.15]), table: 24 });
export const leafGlsl = (L = LEAF) => `
uniform float uLeafL; uniform float uLeafW[ ${L.table} ];
float leafW( float u ) { float x = clamp( u, 0.0, 1.0 ) * ${(L.table - 1).toFixed(1)}; int i = int( floor( x ) ); return mix( uLeafW[ i ], uLeafW[ min( i + 1, ${L.table - 1} ) ], x - float( i ) ); }
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
`;

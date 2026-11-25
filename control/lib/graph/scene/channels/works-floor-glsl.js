/**
 * THE WORKS' FLOOR on the page (local-meru/works-floor.js designs it): the land's layered ground drawn, where it lies flat
 * and is the floor's (its soil and its sand), as the plan's zones. Each zone its own way, never one tile repeated:
 *
 *   YARD     gravel (stones a hand across, domed, each its own shade) or concrete in long strip pours, each strip sawcut
 *            across at no rhythm (no running bond), a slab patched here and there
 *   PAD      a pour under a unit, sawcut into slabs at its own spacing from its own corner (no running bond), each slab its
 *            own tone, a crack through one in a few, a kerb round what is bunded; a rack's footings blocks stepped along it
 *   APRON    heavy steel plates round what burns, a six-metre square whole, halved either way or quartered by its dice,
 *            welded at their seams and bolted at their corners
 *   LANE     smoother and darker, its edges lined in paint, a dashed line down it, worn in two tracks, sawcut across only
 *   TRENCH   an angle at each lip, grating over a pit: the pit seen between the bars shifted along the view by its depth
 *            (PARALLAX: its wall where the deeper point is past the lip), as a real pit is
 *
 * and KIBBLE over the pads, the yard and a little on the lanes: a manhole's studded cover, a drain's grate over its own
 * pit (parallax again), an anchor plate bolted down, a stain of oil; one at most in a cell, kept off a zone's edge. The
 * floor's relief (joints, kerbs, bolts, plates) is a height the normal is taken from, near; far off only its tones.
 *
 *   FLOOR_HEAD             the fragment's functions and uniforms
 *   FLOOR_PASS             the pass, run after the land's layers are blended (diffuse, roughness, metalness, `mn`)
 *   floorUniforms()        the page script's expression for the uniforms, from `D.floor`
 */
import { CELL_MAX, FOOTINGS, FOOTING_STEP } from '../../local-meru/works-floor.js';

const n1 = (v) => (Number.isInteger(v) ? `${v}.0` : `${v}`);
const STEP = n1(FOOTING_STEP), HALF_STEP = n1(FOOTING_STEP / 2), FOOT = n1(FOOTINGS - 0.5);

export const FLOOR_HEAD = `
uniform sampler2D tFlS, tFlC; uniform vec2 uFlO, uFlN; uniform float uFlCell, uFlKib, uFlYard, uFlTop; uniform vec3 uFlPaint;
vec4 flA[ ${CELL_MAX} ]; vec4 flB[ ${CELL_MAX} ]; int flN = 0; float flK = 0.0;
void flLoad( vec2 p ) {
  flN = 0;
  ivec2 c = ivec2( floor( ( p - uFlO ) / uFlCell ) );
  if ( c.x < 0 || c.y < 0 || c.x >= int( uFlN.x ) || c.y >= int( uFlN.y ) ) return;
  for ( int t = 0; t < ${CELL_MAX / 4}; t++ ) {
    vec4 q = texelFetch( tFlC, ivec2( c.x * ${CELL_MAX / 4} + t, c.y ), 0 ) * 255.0;
    for ( int j = 0; j < 4; j++ ) {
      int s = int( q[ j ] + 0.5 );
      if ( s > 0 ) { flA[ flN ] = texelFetch( tFlS, ivec2( ( s - 1 ) * 2, 0 ), 0 ); flB[ flN ] = texelFetch( tFlS, ivec2( ( s - 1 ) * 2 + 1, 0 ), 0 ); flN++; }
    }
  }
}
float flSd( vec4 A, vec4 B, vec2 p ) {
  vec2 q = p - A.xy;
  if ( B.y > 0.0 ) return length( q ) - B.y;
  vec2 d = abs( q ) - A.zw; float s = length( max( d, 0.0 ) ) + min( max( d.x, d.y ), 0.0 );
  if ( B.w > ${FOOT} ) { float al = ( A.z >= A.w ? q.x + A.z : q.y + A.w ) - 1.6; s = max( s, abs( mod( al + ${HALF_STEP}, ${STEP} ) - ${HALF_STEP} ) - 1.6 ); }
  return s;
}
float flZone( vec2 p, out vec4 A, out vec4 B, out float din ) {
  for ( int i = 0; i < ${CELL_MAX}; i++ ) { if ( i >= flN ) break; float d = flSd( flA[ i ], flB[ i ], p ); if ( d < 0.0 ) { A = flA[ i ]; B = flB[ i ]; din = -d; return B.x; } }
  A = vec4( 0.0 ); B = vec4( 0.0 ); din = 99.0; return 0.0;
}
float flLine( float d, float w, float px ) { return 1.0 - smoothstep( w, w + px, d ); }
// the floor at p: its height (metres, its normal's), and its tone, paint, metal and roughness (-1: the layers')
float flSurf( vec2 p, vec2 vt, float px, float near, out float tone, out float paint, out float metal, out float rough ) {
  vec4 A, B; float din; float k = flZone( p, A, B, din );
  float h = 0.0, kib = 0.0; tone = 1.0; paint = 0.0; metal = 0.0; rough = -1.0; flK = k;
  if ( k < 0.5 ) {
    if ( uFlYard > 0.5 ) {
      // (gravel: stones a hand across, each domed and its own shade, resolved as their cells grow past a pixel)
      float gd = 1.0 - smoothstep( 0.04, 0.12, px ); vec3 v = vor5( p / 0.32 + 7.0 );
      float r = mix( 0.3, 0.46, fract( v.z * 7.3 ) ), q = clamp( v.x / r, 0.0, 1.0 ), st = sqrt( 1.0 - q * q );
      tone = ( 0.8 + 0.3 * vn( p / 9.0 + 3.0 ) ) * mix( 1.0, mix( 0.55, 1.25, v.z ) * mix( 0.55, 1.0, st ), gd ); h = 0.06 * st * gd; rough = 0.85; kib = 0.4;
    }
    else {
      // (concrete poured in long strips along x: each 24 m band split in two or three strips of their own widths, each
      // strip sawcut across; a slab in a few patched darker, a crack through one in a few)
      float b0 = floor( p.y / 24.0 ), fy = p.y / 24.0 - b0, s1 = 0.3 + 0.2 * hn( vec2( b0, 1.0 ) );
      float s2 = hn( vec2( b0, 2.0 ) ) < 0.5 ? 1.0 : s1 + ( 1.0 - s1 ) * ( 0.4 + 0.2 * hn( vec2( b0, 3.0 ) ) );
      float si = fy < s1 ? 0.0 : fy < s2 ? 1.0 : 2.0, lo = si < 0.5 ? 0.0 : si < 1.5 ? s1 : s2, hi = si < 0.5 ? s1 : si < 1.5 ? s2 : 1.0;
      // (its cross joints at no rhythm: in each 9 m along the strip a joint at a place of its own, or none, so its slabs
      // run 2 m to 25 m and no two strips' joints keep step)
      float sd = b0 * 3.0 + si, c0 = floor( p.x / 9.0 ), dx = 99.0, last = -99.0;
      for ( int m = -2; m <= 1; m++ ) { float cm = c0 + float( m ), jx = ( cm + 0.15 + 0.7 * hn( vec2( cm, sd + 0.5 ) ) ) * 9.0;
        if ( hn( vec2( cm, sd + 1.7 ) ) < 0.72 ) { dx = min( dx, abs( p.x - jx ) ); if ( jx <= p.x ) last = cm; } }
      float dy = min( fy - lo, hi - fy ) * 24.0, j = flLine( min( dx, dy ), 0.04, px );
      vec2 slab = vec2( last, sd ); float sh = hn( slab + 5.0 ), sw = ( hi - lo ) * 24.0;
      tone = ( 0.86 + 0.2 * sh ) * ( 1.0 - 0.5 * j ) * ( 0.92 + 0.16 * vn( p / 3.0 + slab.x ) ); h = -0.03 * j;
      if ( hn( slab + 9.0 ) > 0.9 ) { tone *= 0.72; rough = 0.6; }
      if ( sh > 0.75 ) { vec2 q = vec2( p.x - ( last + 0.5 ) * 9.0, ( fy - ( lo + hi ) * 0.5 ) * 24.0 ) / sw; float a = sh * 40.0, cd = abs( dot( q, vec2( cos( a ), sin( a ) ) ) + 0.08 * ( vn( q * 6.0 + sh * 9.0 ) - 0.5 ) ) * sw, cr = flLine( cd, 0.012, px ); tone *= 1.0 - 0.4 * cr; h -= 0.01 * cr; }
      kib = 1.0;
    }
  } else if ( k < 1.5 ) {
    if ( B.w > ${FOOT} ) {
      vec2 q = p - A.xy; float al = ( A.z >= A.w ? q.x + A.z : q.y + A.w ) - 1.6, ac = A.z >= A.w ? q.y : q.x;
      vec2 f2 = vec2( mod( al + ${HALF_STEP}, ${STEP} ) - ${HALF_STEP}, ac );
      float e = flLine( din, 0.14, px ), bo = 1.0 - smoothstep( 0.09, 0.09 + px, length( abs( f2 ) - 0.95 ) );
      tone = ( 1.28 - 0.75 * e ) * ( 1.0 + 0.3 * bo ) * ( 0.94 + 0.12 * hn( vec2( floor( al / ${STEP} + 0.5 ), B.z ) ) ); h = 0.3 * smoothstep( 0.0, 0.15, din ) + 0.06 * bo; metal = 0.6 * bo; rough = 0.9;
    } else {
      float S = 4.5 + 2.5 * fract( B.z * 0.618 ); vec2 o = B.y > 0.0 ? A.xy : A.xy - A.zw, g = ( p - o ) / S, f = fract( g ), c = floor( g );
      float jd = min( min( f.x, 1.0 - f.x ), min( f.y, 1.0 - f.y ) ) * S, j = flLine( jd, 0.035, px ), sh = hn( c + B.z * 7.1 );
      tone = ( 0.95 + 0.14 * sh ) * ( 1.0 - 0.45 * j ) * ( 0.94 + 0.12 * vn( p / 2.2 + B.z ) ); h = -0.025 * j;
      if ( sh > 0.78 ) { vec2 q = f - 0.5; float a = sh * 40.0, cd = abs( dot( q, vec2( cos( a ), sin( a ) ) ) + 0.08 * ( vn( g * 6.0 + sh * 9.0 ) - 0.5 ) ) * S, cr = flLine( cd, 0.012, px ); tone *= 1.0 - 0.4 * cr; h -= 0.01 * cr; }
      if ( B.w > 0.5 ) { float kb = smoothstep( 0.6, 0.45, din ); h += 0.25 * kb; tone = mix( tone, 1.1 * ( 0.92 + 0.12 * hn( floor( p / 1.5 ) ) ), kb ); }
      else { float e = flLine( din, 0.05, px ); tone *= 1.0 - 0.5 * e; h -= 0.03 * e; }
      kib = 1.0;
    }
  } else if ( k < 2.5 ) {
    vec2 sc = floor( ( p - A.xy ) / 6.0 ), sf = ( p - A.xy ) / 6.0 - sc; float r = hn( sc + 4.4 );
    vec2 n = r < 0.3 ? vec2( 1.0 ) : r < 0.55 ? vec2( 2.0, 1.0 ) : r < 0.8 ? vec2( 1.0, 2.0 ) : vec2( 2.0 );
    vec2 pg = sf * n, pf = fract( pg ), pc = floor( pg ) + sc * 2.0, ps = 6.0 / n;
    float sd = min( min( pf.x, 1.0 - pf.x ) * ps.x, min( pf.y, 1.0 - pf.y ) * ps.y ), s = flLine( sd, 0.03, px );
    float bolt = 1.0 - smoothstep( 0.06, 0.06 + px, length( min( pf, 1.0 - pf ) * ps - 0.28 ) );
    tone = ( 0.8 + 0.28 * hn( pc + 2.2 ) ) * ( 1.0 - 0.55 * s ) * ( 1.0 + 0.25 * bolt ); h = -0.02 * s + 0.04 * bolt + 0.02 * vn( p * 0.7 );
    metal = 0.85; rough = mix( 0.4, 0.72, vn( p / 3.0 + 9.0 ) );
  } else if ( k < 3.5 ) {
    bool ax = A.z >= A.w; float hw = ax ? A.w : A.z, ac = ax ? p.y - A.y : p.x - A.x, al = ax ? p.x : p.y;
    float ln = 1.0 - smoothstep( 0.0, px, abs( din - 0.75 ) - 0.25 );
    float dash = ( 1.0 - smoothstep( 0.0, px, abs( ac ) - 0.18 ) ) * step( fract( al / 7.0 ), 0.55 ) * step( 1.2, din );
    float tr = smoothstep( hw * 0.22, 0.0, abs( abs( ac ) - hw * 0.45 ) );
    float jc = flLine( abs( fract( al / 8.0 + 0.5 ) - 0.5 ) * 8.0, 0.03, px );
    tone = ( 0.86 - 0.14 * tr * ( 0.6 + 0.4 * vn( p / 2.0 ) ) ) * ( 1.0 - 0.4 * jc ); h = -0.02 * jc;
    paint = max( ln, dash ) * ( 0.45 + 0.35 * vn( p * 1.3 ) ) * ( 1.0 - 0.7 * tr ); rough = mix( 0.78, 0.5, tr );
    kib = 0.25;
  } else {
    bool ax = A.z >= A.w; float ac = ax ? p.y - A.y : p.x - A.x, al = ax ? p.x : p.y;
    float bar = step( fract( ac / 0.24 ), 0.32 ), crs = step( fract( al / 1.4 ), 0.06 );
    if ( din < 0.16 ) { tone = 0.9; metal = 0.8; rough = 0.45; }
    else if ( max( bar, crs ) * step( 0.5, near ) > 0.5 ) { tone = 0.62 + 0.2 * hn( vec2( floor( al / 1.4 ), B.z ) ); metal = 0.75; rough = 0.5; }
    else { float dd = flSd( A, B, p - vt * 0.8 ); tone = mix( 0.4, dd < -0.16 ? 0.1 : 0.28, near ); rough = 0.3; h = -0.05; }
  }
  if ( kib > 0.0 && near > 0.0 ) {
    vec2 kc = floor( p / 7.0 ); float kh = hn( kc + 31.7 );
    if ( kh < uFlKib * kib * 0.6 ) {
      float t = floor( hn( kc + 3.3 ) * 4.0 ), keep = smoothstep( 1.4, 2.2, din ) * near; vec2 q = p - ( kc + 0.2 + 0.6 * vec2( hn( kc + 1.1 ), hn( kc + 2.2 ) ) ) * 7.0;
      float rr = rough < 0.0 ? 0.8 : rough;
      if ( t < 0.5 ) {
        float r = length( q ), ring = 1.0 - smoothstep( 0.03, 0.03 + px, abs( r - 0.72 ) ), cov = step( r, 0.72 ), stud = step( 0.5, fract( q.x / 0.18 ) ) * step( 0.5, fract( q.y / 0.18 ) );
        tone = mix( tone, mix( 0.55 * ( 1.0 + 0.25 * stud ), 0.2, ring ), max( cov, ring ) * keep ); metal = mix( metal, 0.6, cov * keep ); rough = mix( rr, 0.55, cov * keep ); h += ( 0.015 * cov * stud - 0.03 * ring ) * keep;
      } else if ( t < 1.5 ) {
        vec2 a2 = abs( q ); float m2 = max( a2.x, a2.y ), inG = step( m2, 0.6 ), fr = inG * step( 0.5, m2 ), bars = step( fract( q.x / 0.15 ), 0.35 );
        vec2 qd = q - vt * 0.5; float pit = step( max( abs( qd.x ), abs( qd.y ) ), 0.5 );
        float g = fr > 0.5 ? 0.85 : bars > 0.5 ? 0.6 : pit > 0.5 ? 0.1 : 0.28;
        tone = mix( tone, g, inG * keep ); metal = mix( metal, 0.7, inG * keep * max( fr, bars ) ); h -= 0.02 * inG * keep * ( 1.0 - fr );
      } else if ( t < 2.5 ) {
        vec2 a2 = abs( q ); float pl = step( max( a2.x, a2.y ), 0.65 ), bo = 1.0 - smoothstep( 0.08, 0.08 + px, length( a2 - 0.45 ) );
        tone = mix( tone, ( 0.7 + 0.35 * bo ) * mix( 1.0, 0.8, vn( q * 4.0 ) ), pl * keep ); metal = mix( metal, 0.75, pl * keep ); rough = mix( rr, 0.5, pl * keep ); h += ( 0.04 * pl + 0.06 * bo ) * keep;
      } else {
        float r = 1.0 + 1.6 * fract( kh * 13.0 ), st = 1.0 - smoothstep( r * 0.6, r, length( q ) + ( vn( q * 1.2 + kh * 9.0 ) - 0.5 ) * r * 0.8 );
        tone *= 1.0 - 0.4 * st * keep; rough = mix( rr, 0.25, st * keep );
      }
    }
  }
  return h;
}
`;

// (run where the land's layers are blended: its soil's and sand's share, lying flat and no higher than `top`, is the
// floor's (a deck's top and a pipe's crown are not); near, its relief
// turned into the normal by two more reads a step apart)
export const FLOOR_PASS = `
    { float wF = ( ws[ 2 ] + ws[ 3 ] ) / max( 1e-4, tw ) * smoothstep( 0.85, 0.95, nW.z ) * ( 1.0 - smoothstep( uFlTop - 0.8, uFlTop, vWPos.z ) ), flPx = length( fwidth( vWPos.xy ) );
      if ( wF > 0.01 ) {
        flLoad( vWPos.xy );
        vec3 Vf = normalize( cameraPosition - vWPos ); vec2 vtF = Vf.xy / max( Vf.z, 0.25 );
        float nearF = 1.0 - smoothstep( 45.0, 75.0, camD ), tF, pF, mF, rF, d1, d2, d3, d4;
        float h0 = flSurf( vWPos.xy, vtF, flPx, nearF, tF, pF, mF, rF );
        if ( nearF > 0.0 ) {
          float e = max( 0.03, flPx ), hx = flSurf( vWPos.xy + vec2( e, 0.0 ), vtF, flPx, nearF, d1, d2, d3, d4 ), hy = flSurf( vWPos.xy + vec2( 0.0, e ), vtF, flPx, nearF, d1, d2, d3, d4 );
          mn = normalize( mix( mn, normalize( vec3( ( h0 - hx ) / e, ( h0 - hy ) / e, 1.0 ) ), wF * nearF ) );
        }
        diffuseColor.rgb *= mix( 1.0, tF, wF ); diffuseColor.rgb = mix( diffuseColor.rgb, uFlPaint, pF * wF );
        metalnessFactor = mix( metalnessFactor, mF, wF );
        if ( rF >= 0.0 ) roughnessFactor = mix( roughnessFactor, rF, wF );
      }
    }
`;

/** The page script's uniforms from `D.floor`: the shapes a float texture (two texels each), the cells a byte one. */
export const floorUniforms = () => `(() => { const F = D.floor, S = new Float32Array(bytes(F.shapes).buffer), tS = new THREE.DataTexture(S, S.length / 4, 1, THREE.RGBAFormat, THREE.FloatType), tC = new THREE.DataTexture(bytes(F.cells), F.n[0] * ${CELL_MAX / 4}, F.n[1], THREE.RGBAFormat);
    tS.needsUpdate = true; tC.needsUpdate = true;
    return { tFlS: { value: tS }, tFlC: { value: tC }, uFlO: { value: new THREE.Vector2(...F.o) }, uFlN: { value: new THREE.Vector2(...F.n) }, uFlCell: { value: F.cell }, uFlKib: { value: F.kibble }, uFlYard: { value: F.yard }, uFlTop: { value: F.top }, uFlPaint: { value: new THREE.Vector3(...F.paint) } }; })()`;

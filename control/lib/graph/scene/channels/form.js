import { safeJson } from '../emit-util.js';

// In-page script: THE FORM RENDER INDOORS (gen-7: form/room-light.js, form/room-form.js, era/stage.js). The build baked the
// room as a lightmap is, its colour and its light apart: each corner its base (the colour its palette asks for under no
// light) and its light (`aLit`, linear: the ambient, every lamp by its solved key where it can see the corner, the bounce),
// and read each tile as material (its colour under no light, a tangent-space normal, occlusion + roughness + height). Here
// each surface's material (three's MeshBasicMaterial, as the paint's: no light of three's is evaluated) multiplies its
// colour by that light, and adds only what a bake cannot hold, near the eye (its frame from the screen's derivatives).
//
//   colour    the tile divided by its mean (`mean`), times the corner's base: the base sets the colour, the tile the detail
//   bake      the corner's light as the indirect (the tile's occlusion darkens it): out = base × light, the solve's law
//   relief    the `live` lamps nearest the eye (no shadow maps): what each does to the relief, the normal map's slope
//             against the face's own (its light at the pixel's normal less its light at the face's), and its sheen; both
//             scaled by how lit the bake says that spot is by them (the baked light over what they would lay unshadowed),
//             so nothing shines in a baked shadow. A lamp coming into the set fades in, one leaving fades out; far off
//             (`relief`: the distances it fades out between) a pixel is its bake alone
//   parallax  near the eye each tile's height (the ORM's blue, 1 the crest) is marched along the view (`pom`: steps, and the
//             distances it fades out between), so a joint sinks and a stone stands; far off the map lies flat
//   tone      the frame is tone-mapped (three's Neutral, exposure 1: what the solve solved for)
//   beats     a lamp a beat changes (`beat`: alarm, pulse, flicker; its `rate`, era/compose-plot.js BEATS) is in no corner's
//             bake: the page lays its light whole (its falloff and its cosine on the face, no shadow), its key swung by the
//             beat in time. Only a room with one carries this code
//
// OUTDOORS (a town's buildings, form/sun-light.js, and a stage under a sun or a moon, era/stage.js: `cfg.sun`) the sun is
// a lamp set far off along its way, always in the live set (a town's one lamp), its
// falloff whole; a corner's light without it is the sky's by how the face turns (the sky up, `sun.ground` down, their mean
// on a wall), so the relief is lit only by the share of the bake the sun gave. A room's page carries none of this.
//
// A mesh with no baked light, and the `keep` groups (the torches' flames and iron, glass), stay as built and untoned; the
// `panes` (see-through glass) reflect the room by Fresnel from `f0`, and the painted glints are hidden. The
// live light's actors' shadow (channels/cast-shadows.js) patches these materials as it patched the paint's.
// `__mojForm` is the machine gate's probe: the lamps, the live set, the maps and how each was read, the materials made.
// Absent `form` ⇒ NOT emitted.
// `cfg`: { lights: [{ at, key, radius, live, beat?, rate? }], ambient: [r, g, b] (linear), fall, maps: { key: { normal?, orm?, read,
//          depth?, mean } }, live, pom: { steps, near, far }, relief: { near, far }, keep: [group], panes: [group], f0,
//          void?: '#rrggbb' (a toned room's), sun?: { ground: [r, g, b] } (linear: a town's, the light a face turned down takes),
//          reflect?: { env: { zenith, horizon, ground } (linear), surfaces: { group: { rough, metal?, clear?, film? } }, wet?: { amount, seed, groups, damp?, walls?, pools?, rain?, spots?: [{ at, r, amount, pool }] }, floods?: [{ at, key, radius }] (lamps out of doors the page lays whole: the nearest four),
//          probe?: { at: [x, y, z], box: [[x0, y0, z0], [x1, y1, z1]] } (a room's capture and the box it is corrected to), size? } }
// WHAT A SURFACE GIVES BACK (`cfg.reflect`, a page whose built things stand under a sky): the sky by Fresnel, blurred by
// the surface's roughness, and the sun's highlight where the bake says the sun reaches; a metal's base colours both and
// it keeps no diffuse. WET (`reflect.wet`): one field of water over the ground, by the world's own place (so the same
// recipe is the same puddles): standing water where the field is over its level, a soaked band at its edge, damp past
// that; each darkens the colour, smooths the surface and flattens its relief, so the sky lies in a puddle and only
// sheens on damp ground. Only a page that carries `reflect` carries this code.
const ENV_HEAD = 'uniform vec3 uFEnvZ;\nuniform vec3 uFEnvH;\nuniform vec3 uFEnvG;\nuniform vec4 uFSurf;\nuniform vec4 uFWet;\nuniform float uFWetW;\nuniform vec4 uFSpot[ 6 ];\nuniform vec2 uFSpotK[ 6 ];\nuniform float uFNow;\nuniform vec4 uFFlood[ 4 ];\nuniform vec3 uFFloodK[ 4 ];\nfloat fCsKeep = 0.0;\n#ifdef FORM_POOL\nuniform vec4 uFRip[ 8 ];\nuniform float uFTime;\n#endif\n#ifdef FORM_ENVMAP\nuniform samplerCube uFCube;\nuniform vec3 uFProbe;\nuniform vec3 uFBoxA;\nuniform vec3 uFBoxB;\n#endif\n'
  + 'float fH2( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }\n'
  + 'float fVN( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f ); return mix( mix( fH2( i ), fH2( i + vec2( 1.0, 0.0 ) ), f.x ), mix( fH2( i + vec2( 0.0, 1.0 ) ), fH2( i + vec2( 1.0, 1.0 ) ), f.x ), f.y ); }\n';
const ENV_BODY = `
#ifdef FORM_ENV
{
  // (the face's normal toward the eye: the screen's derivatives give it either way round)
  vec3 eV = - vFPos / fD, eG = dot( fN, eV ) < 0.0 ? - fN : fN, eN = eG;
#if defined( FORM_RELIEF ) && defined( USE_AOMAP )
  { vec3 etn = texture2D( uFNorm, fUV ).xyz * 2.0 - 1.0; eN = normalize( fT * etn.x + fB * etn.y + eG * etn.z ); }
#endif
  float eR = uFSurf.x, eM = uFSurf.y;
#ifdef USE_AOMAP
  eR = clamp( mix( eR, texture2D( aoMap, fUV ).g, 0.5 ), 0.05, 1.0 );
#endif
#ifdef FORM_WET
  {
    // (the place in the world: the view's offset turned back, unnormalised)
    vec3 eP = cameraPosition + ( vec4( vFPos, 0.0 ) * viewMatrix ).xyz;
    float eUpF = smoothstep( 0.7, 0.95, inverseTransformDirection( eG, viewMatrix ).z );
    float ew = fVN( eP.xy * 0.11 + uFWet.y ) * 0.6 + fVN( eP.xy * 0.37 + uFWet.y * 1.7 ) * 0.28 + fVN( eP.xy * 1.9 + 3.1 ) * 0.12;
    float eDepth = ew - ( 1.0 - 0.4 * uFWet.x );
    float ePud = smoothstep( 0.0, 0.03, eDepth ) * eUpF, eSoak = smoothstep( -0.08, 0.0, eDepth ) * eUpF;
    float eDamp = ( 0.45 + 0.55 * smoothstep( -0.34, -0.06, eDepth ) ) * uFWet.x * mix( 0.5, 1.0, eUpF );
    diffuseColor.rgb *= mix( 1.0, 0.5, eDamp ) * mix( 1.0, 0.72, eSoak );
    diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * 0.55, ePud );
    eR = mix( eR, 0.4, eDamp ); eR = mix( eR, 0.2, eSoak ); eR = mix( eR, 0.05, ePud );
    eN = normalize( mix( eN, eG, max( ePud, eSoak * 0.6 ) ) );
  }
#endif
#ifdef FORM_DAMP
  {
    // WET WITHOUT DEPTH (a wetness that hugs the surface: no thickness, no edge of its own). The surface keeps its
    // relief; the water lies by HEIGHT, the tile's own: its low parts (joints, pits) fill first and lie flat and
    // mirror-smooth, its high faces only darken and take a sheen. One dial: damp, wet, brimming. It thins
    // and thickens over the floor by the world's place, so no two slabs are wet alike
    vec3 eP = cameraPosition + ( vec4( vFPos, 0.0 ) * viewMatrix ).xyz;
    vec3 eGw = inverseTransformDirection( eG, viewMatrix );
    float eUpF = smoothstep( 0.55, 0.9, eGw.z );
    float eVar = 0.72 + 0.28 * ( fVN( eP.xy * 0.23 + uFWet.y ) * 0.6 + fVN( eP.xy * 0.9 + uFWet.y * 1.7 ) * 0.4 );
    // (ON A WALL water does not lie, it RUNS: in streaks down the face, by the wall's own length and stretched along
    // its height, heaviest at its foot where it gathers and thinning up it; a ledge or a joint still holds it)
    float eAlong = eP.y * eGw.x - eP.x * eGw.y;
    float eRun = fVN( vec2( eAlong * 1.3 + uFWet.y, eP.z * 0.1 ) ) * 0.65 + fVN( vec2( eAlong * 4.3 + 5.0, eP.z * 0.33 + 3.0 ) ) * 0.35;
    float eWallF = ( 1.0 - eUpF ) * ( 1.0 - smoothstep( 0.4, 0.6, abs( eGw.z ) ) ) * smoothstep( 0.38, 0.7, eRun ) * mix( 1.0, 0.5, smoothstep( 0.3, 4.0, eP.z ) );
    // (while it RAINS nothing out of doors is dry: every face that is not a floor is wet all over, the runs only the
    // heavier part of it)
    float eSide = 1.0 - eUpF, eAll = uFWet.w * eSide * 0.62;
    float eAmt = uFWet.x * max( eVar * eUpF + eWallF * uFWetW, eAll );
    // A SPOT (a leak, a spill, a hose: a wetness with a cause somewhere): wet at its heart, fading with distance and
    // never at a line; its edge wanders by the world's place. Where it is asked to, its heart stands as water
    float ePool = 0.0;
    for ( int i = 0; i < 6; i++ ) {
      if ( uFSpot[ i ].w <= 0.0 ) continue;
      float eSd = length( eP - uFSpot[ i ].xyz ) / uFSpot[ i ].w + ( fVN( eP.xy * 1.7 + float( i ) * 9.1 ) - 0.5 ) * 0.34;
      eAmt = max( eAmt, uFSpotK[ i ].x * ( 1.0 - smoothstep( 0.3, 1.0, eSd ) ) * max( eUpF, 0.7 * ( 1.0 - smoothstep( 0.4, 0.6, abs( eGw.z ) ) ) ) );
      ePool = max( ePool, uFSpotK[ i ].y * ( 1.0 - smoothstep( 0.34, 0.42, eSd ) ) * eUpF );
    }
    // POOLS IN THE HOLLOWS (open ground that has been rained on): the ground's own slow unevenness, by the world's
    // place; the share of it that lies low stands in water, level with the ground, ringed by a soaked band
    if ( uFWet.z > 0.0 ) {
      float eHol = fVN( eP.xy * 0.13 + uFWet.y * 2.3 ) * 0.6 + fVN( eP.xy * 0.41 + uFWet.y ) * 0.3 + fVN( eP.xy * 1.3 + 4.0 ) * 0.1, eTh = 1.0 - uFWet.z * 0.62;
      ePool = max( ePool, smoothstep( eTh, eTh + 0.025, eHol ) * eUpF );
      eAmt = max( eAmt, smoothstep( eTh - 0.16, eTh, eHol ) * eUpF );
    }
#ifdef USE_AOMAP
    float eHt = texture2D( aoMap, fUV ).b;
#else
    float eHt = 0.6;
#endif
    float eFill = ( 1.0 - smoothstep( eAmt * 0.95 - 0.14, eAmt * 0.95 + 0.02, eHt ) ) * step( 0.02, eAmt );
    eFill = max( eFill, ePool );
    float eDamp = smoothstep( 0.0, 0.35, eAmt );
    diffuseColor.rgb *= mix( 1.0, uFSurf.z > 0.0 ? uFSurf.z : 0.55, eDamp );
    diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * 0.7, eFill );
    eR = mix( eR, min( eR, 0.34 ), eDamp ); eR = mix( eR, 0.06, eFill );
    // (a face running with rain is a film of water: smooth, whatever it is made of)
    eR = mix( eR, min( eR, 0.16 ), eAll * uFWet.x );
    eN = normalize( mix( eN, eG, eFill ) );
    // (while it rains, standing water is struck: a ring in every cell of it, each on its own beat, bending what it holds)
    if ( uFWet.w > 0.0 && ePool > 0.01 ) {
      vec2 eCell = floor( eP.xy / 0.42 ), eIn = fract( eP.xy / 0.42 ) - 0.5; float eH = fH2( eCell + 3.7 );
      vec2 eC2 = eIn - ( vec2( fH2( eCell + 1.3 ), fH2( eCell + 7.9 ) ) - 0.5 ) * 0.5; float eBeat = fract( uFNow * ( 0.7 + 0.5 * eH ) + eH * 7.0 ), eLr = length( eC2 ) + 1e-4;
      float eRing = exp( - pow( ( eLr - eBeat * 0.42 ) / 0.035, 2.0 ) ) * ( 1.0 - eBeat );
      vec3 eNw2 = normalize( inverseTransformDirection( eN, viewMatrix ) + vec3( eC2 / eLr * eRing * 0.35 * ePool * uFWet.w, 0.0 ) );
      eN = normalize( ( viewMatrix * vec4( eNw2, 0.0 ) ).xyz );
    }
  }
#endif
#ifdef FORM_POOL
  {
    // (a footfall's rings: each a band running out from where the foot came down, dying as its liquid lets it; it
    // bends the face's normal along its way, so what the pool holds shivers and settles)
    vec3 eW = cameraPosition + ( vec4( vFPos, 0.0 ) * viewMatrix ).xyz; vec2 eTilt = vec2( 0.0 );
    for ( int i = 0; i < 8; i++ ) {
      float eAge = uFTime - uFRip[ i ].z; if ( eAge < 0.0 || eAge > 6.0 || uFRip[ i ].w <= 0.0 ) continue;
      vec2 eD = eW.xy - uFRip[ i ].xy; float eL = length( eD ) + 1e-4, eRr = 0.08 + 0.5 * eAge;
      float eBand = exp( - pow( ( eL - eRr ) / 0.09, 2.0 ) ) + 0.6 * exp( - pow( ( eL - eRr * 0.62 ) / 0.07, 2.0 ) );
      eTilt += eD / eL * eBand * sin( ( eL - eRr ) * 46.0 ) * uFRip[ i ].w * exp( - eAge * 1.3 ) * 0.22;
    }
    vec3 eNw = normalize( inverseTransformDirection( eN, viewMatrix ) + vec3( eTilt, 0.0 ) );
    eN = normalize( ( viewMatrix * vec4( eNw, 0.0 ) ).xyz );
  }
#endif
  vec3 eRw = inverseTransformDirection( reflect( - eV, eN ), viewMatrix );
  float eB = eR * eR, eUp = eRw.z;
  vec3 eSky = mix( uFEnvH, uFEnvZ, pow( clamp( eUp, 0.0, 1.0 ), 0.45 ) );
  vec3 eEnv = mix( uFEnvG, eSky, smoothstep( -0.05 - eB * 0.6, 0.05 + eB * 0.6, eUp ) );
  eEnv = mix( eEnv, ( uFEnvZ + uFEnvH * 2.0 + uFEnvG ) * 0.25, eB );
#ifdef FORM_ENVMAP
  {
    // THE ROOM ITSELF, held in a capture taken from the probe once the room stands lit: looked up along the reflected
    // ray where it meets the room's own box (so what a floor or a pool holds lies where it stands, not at infinity),
    // blurred down its mips by the surface's roughness
    vec3 ePw = cameraPosition + ( vec4( vFPos, 0.0 ) * viewMatrix ).xyz;
    vec3 eInv = 1.0 / ( abs( eRw ) + 1e-5 ) * sign( eRw + 1e-9 );
    vec3 eT = max( ( uFBoxA - ePw ) * eInv, ( uFBoxB - ePw ) * eInv );
    float eHit = max( min( eT.x, min( eT.y, eT.z ) ), 0.0 );
    vec3 eDir = ePw + eRw * eHit - uFProbe;
    eEnv = textureLod( uFCube, eDir, eR * 6.0 ).rgb;
  }
#endif
  float eC = clamp( dot( eN, eV ), 0.0, 1.0 );
  vec3 eF0 = mix( vec3( 0.04 ), diffuseColor.rgb, eM ), eF = eF0 + ( max( vec3( 1.0 - eR ), eF0 ) - eF0 ) * pow( 1.0 - eC, 5.0 );
  float eO = clamp( fLum( vFLit ) / max( fLum( uFAmb ), 1e-3 ), 0.25, 1.0 );
#ifdef FORM_FILM
  // (a thin film, a fuel's: what it gives back is coloured by the film's thickness, which wanders over the pool by
  // the world's place, and by how low it is looked along, so its bands of colour slide as the eye moves)
  { vec3 eQ = cameraPosition + ( vec4( vFPos, 0.0 ) * viewMatrix ).xyz;
    float eTh = fVN( eQ.xy * 1.3 + 7.0 ) * 0.6 + fVN( eQ.xy * 4.1 + 2.0 ) * 0.4;
    vec3 eIr = 0.5 + 0.5 * cos( 6.2832 * ( eTh * 2.4 + eC * 1.7 + vec3( 0.0, 0.33, 0.67 ) ) );
    eF *= mix( vec3( 1.0 ), eIr * 1.7, uFSurf.w ); }
#endif
  vec3 eAdd = eEnv * eF * eO;
  float eShine = clamp( 2.0 / ( eB * eB ) - 2.0, 1.0, 4096.0 );
#ifdef FORM_SUNLIT
  vec3 eSkyOnly = mix( uFGround, uFAmb, 0.5 + 0.5 * inverseTransformDirection( eG, viewMatrix ).z );
  for ( int i = 0; i < __K__; i++ ) {
    if ( uFLr[ i ] < 1e8 ) continue;
    vec3 eL = normalize( uFLp[ i ] - vFPos );
    float eNg = max( dot( eG, eL ), 0.0 ), eNl = max( dot( eN, eL ), 0.0 );
    float eSun = clamp( ( fLum( vFLit ) - fLum( eSkyOnly ) ) / max( fLum( uFLk[ i ] ) * eNg, 1e-3 ), 0.0, 1.0 );
    eAdd += uFLk[ i ] * eF * eNl * min( ( eShine + 8.0 ) / 8.0, 64.0 ) * pow( max( dot( eN, normalize( eL + eV ) ), 0.0 ), eShine ) * eSun;
  }
#else
  // (a room under its lamps alone: each live lamp's highlight, by its own falloff, where the bake says the spot is lit)
  { float eLitK = clamp( ( fLum( vFLit ) - fLum( uFAmb ) ) / max( fLum( vFLit ), 1e-3 ), 0.0, 1.0 );
    for ( int i = 0; i < __K__; i++ ) {
      vec3 eLd = uFLp[ i ] - vFPos; float eLr = length( eLd ); vec3 eL = eLd / max( eLr, 1e-3 );
      float eT = clamp( 1.0 - max( eLr, 1.1 ) / uFLr[ i ], 0.0, 1.0 );
      eAdd += uFLk[ i ] * pow( eT * eT, uFFall ) * eF * max( dot( eN, eL ), 0.0 ) * min( ( eShine + 8.0 ) / 8.0, 64.0 ) * pow( max( dot( eN, normalize( eL + eV ) ), 0.0 ), eShine ) * eLitK;
    } }
#endif
  // (a FLOODLIGHT, a lamp standing out of doors: no bake holds it, so its own light is laid here whole, by its falloff
  // and the pixel's turn to it, and its highlight; no shadow of its own)
  vec3 eFloodSum = vec3( 0.0 );
  for ( int i = 0; i < 4; i++ ) {
    if ( uFFlood[ i ].w <= 0.0 ) continue;
    vec3 eFd = uFFlood[ i ].xyz - vFPos; float eFr = length( eFd ); vec3 eFl = eFd / max( eFr, 1e-3 );
    float eFt = clamp( 1.0 - max( eFr, 1.1 ) / uFFlood[ i ].w, 0.0, 1.0 ); vec3 eFc = uFFloodK[ i ] * eFt * eFt;
    // (its head is turned down: a cone under it, soft at its edge)
    eFc *= smoothstep( 0.2, 0.62, dot( - eFl, normalize( ( viewMatrix * vec4( 0.0, 0.0, -1.0, 0.0 ) ).xyz ) ) );
    eFloodSum += eFc * max( dot( eN, eFl ), 0.0 ) * ( diffuseColor.rgb * ( 1.0 - eM ) + eF * min( ( eShine + 8.0 ) / 8.0, 64.0 ) * pow( max( dot( eN, normalize( eFl + eV ) ), 0.0 ), eShine ) );
  }
  // (what a flood lays is no part of the sun's or the moon's light: the hour's shadow leaves it standing)
  fCsKeep = fLum( eFloodSum ) / max( fLum( eFloodSum ) + fLum( eAdd ) + fLum( vFLit * diffuseColor.rgb ), 1e-4 );
  eAdd += eFloodSum;
#ifdef FORM_CLEAR
  // (seen through: square on it keeps a share of its own colour and lets the floor show; the lower it is looked
  // along the more it mirrors and the less it shows. What it gives back is laid whole, whatever its cover)
  { float eA = clamp( uFSurf.z + ( 1.0 - uFSurf.z ) * max( eF.r, max( eF.g, eF.b ) ), 0.0, 1.0 ); diffuseColor.a = eA; eAdd /= max( eA, 0.05 ); }
#endif
  fDirect += eAdd;
  diffuseColor.rgb *= 1.0 - eM;
}
#endif
`;

export function formScript(cfg) {
  // (the beats' code only in a room with a beat: a room without one is byte for byte as it was)
  const NB = cfg.lights.filter((l) => l.beat).length;
  return `
// --- form: a room's surfaces as material over its baked light (gen-7) ---
const __mojForm = (function () {
  const F = ${safeJson(cfg)}, keep = new Set(F.keep), loader = new THREE.TextureLoader(), K = Math.max(1, F.live);
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1;
  const U = { uFLp: { value: Array.from({ length: K }, () => new THREE.Vector3()) }, uFLk: { value: Array.from({ length: K }, () => new THREE.Vector3()) },
    uFLr: { value: new Array(K).fill(1) }, uFFall: { value: F.fall }, uFAmb: { value: new THREE.Vector3(...F.ambient) }, uFPom: { value: new THREE.Vector4(F.pom.near, F.pom.far, F.relief.near, F.relief.far) } };${cfg.reflect ? `
  Object.assign(U, { uFEnvZ: { value: new THREE.Vector3(...F.reflect.env.zenith) }, uFEnvH: { value: new THREE.Vector3(...F.reflect.env.horizon) }, uFEnvG: { value: new THREE.Vector3(...F.reflect.env.ground) },
    uFWet: { value: new THREE.Vector4(F.reflect.wet ? F.reflect.wet.amount : 0, F.reflect.wet ? F.reflect.wet.seed : 0, F.reflect.wet ? F.reflect.wet.pools || 0 : 0, F.reflect.wet ? F.reflect.wet.rain || 0 : 0) },
    uFWetW: { value: F.reflect.wet && F.reflect.wet.walls !== undefined ? F.reflect.wet.walls : 1 }, uFNow: { value: 0 },
    uFFlood: { value: Array.from({ length: 4 }, () => new THREE.Vector4(0, 0, 0, 0)) }, uFFloodK: { value: Array.from({ length: 4 }, () => new THREE.Vector3()) },
    uFSpot: { value: Array.from({ length: 6 }, (_, i) => { const q = ((F.reflect.wet && F.reflect.wet.spots) || [])[i]; return q ? new THREE.Vector4(q.at[0], q.at[1], q.at[2], q.r) : new THREE.Vector4(0, 0, 0, 0); }) },
    uFSpotK: { value: Array.from({ length: 6 }, (_, i) => { const q = ((F.reflect.wet && F.reflect.wet.spots) || [])[i]; return q ? new THREE.Vector2(q.amount, q.pool ? 1 : 0) : new THREE.Vector2(0, 0); }) } });
  const SURF = F.reflect.surfaces || {}, WETG = new Set(F.reflect.wet ? F.reflect.wet.groups : []);
  const DAMP = !!(F.reflect.wet && F.reflect.wet.damp), SUNLIT = !!F.sun;
  // (the room's capture: a cube of the room as it stands lit, taken from the probe a few frames in, once the hour's
  // map is drawn; half-float, with its mips for the blur. Until it is taken it is black, and the gradient stands)
  // (its pools: a footfall in one rings it, and past its edge leaves wet steps that dry; below)
  const POOLS = F.reflect.pools || [], POOLG = new Set(POOLS.map((p) => p.group));
  Object.assign(U, { uFRip: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, -1e3, 0)) }, uFTime: { value: 0 } });
  const PR = F.reflect.probe || null;
  const cubeRT = PR ? new THREE.WebGLCubeRenderTarget(F.reflect.size || 256, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter }) : null;
  const cubeCam = PR ? new THREE.CubeCamera(0.1, 400, cubeRT) : null;
  if (PR) { cubeCam.position.set(...PR.at); Object.assign(U, { uFCube: { value: cubeRT.texture }, uFProbe: { value: new THREE.Vector3(...PR.at) }, uFBoxA: { value: new THREE.Vector3(...PR.box[0]) }, uFBoxB: { value: new THREE.Vector3(...PR.box[1]) } }); }` : ''}
${NB ? `  const BL = F.lights.map((l, i) => ({ l, i })).filter(({ l }) => l.beat);
  Object.assign(U, { uFBp: { value: BL.map(() => new THREE.Vector3()) }, uFBk: { value: BL.map(() => new THREE.Vector3()) }, uFBr: { value: BL.map(({ l }) => l.radius) } });
` : ''}  const VERT = 'attribute vec3 aLit;\\nvarying vec3 vFLit;\\nvarying vec3 vFPos;\\n';
  const FRAG = 'uniform vec3 uFLp[' + K + '];\\nuniform vec3 uFLk[' + K + '];\\nuniform float uFLr[' + K + '];\\nuniform float uFFall;\\nuniform vec3 uFAmb;\\nuniform vec4 uFPom;\\nuniform vec3 uFMean;\\nuniform float uFDepth;\\nuniform sampler2D uFNorm;\\nvarying vec3 vFLit;\\nvarying vec3 vFPos;\\n'
    + 'float fLum( vec3 c ) { return dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ); }\\n'${cfg.reflect ? `
    + ${safeJson(ENV_HEAD)}` : ''}${cfg.sun ? `
    + 'uniform vec3 uFGround;\\n'` : ''}${NB ? `
    + 'uniform vec3 uFBp[${NB}];\\nuniform vec3 uFBk[${NB}];\\nuniform float uFBr[${NB}];\\n'` : ''};
  // the face's own frame from the screen's derivatives (its normal, and the tile's directions on it), then the parallax:
  // the tile's height marched along the view in that frame, near the eye
  const POM = \`vec3 fq0 = dFdx( vFPos ), fq1 = dFdy( vFPos ), fN = normalize( cross( fq0, fq1 ) ), fT = vec3( 0.0 ), fB = vec3( 0.0 );
float fD = length( vFPos );
#ifdef USE_MAP
  vec2 fUV = vMapUv, fs0 = dFdx( vMapUv ), fs1 = dFdy( vMapUv );
  { vec3 q1p = cross( fq1, fN ), q0p = cross( fN, fq0 ); fT = q1p * fs0.x + q0p * fs1.x; fB = q1p * fs0.y + q0p * fs1.y;
    fT = dot( fT, fT ) > 0.0 ? normalize( fT ) : fT; fB = dot( fB, fB ) > 0.0 ? normalize( fB ) : fB; }
#else
  vec2 fUV = vec2( 0.0 );
#endif
#if defined( FORM_POM ) && defined( USE_AOMAP ) && defined( USE_MAP )
{
  float fk = 1.0 - smoothstep( uFPom.x, uFPom.y, fD );
  if ( fk > 0.0 ) {
    vec3 V = - vFPos / fD, vt = vec3( dot( V, fT ), dot( V, fB ), dot( V, fN ) );
    vec2 dP = vt.xy / max( abs( vt.z ), 0.25 ) * uFDepth * fk / float( FORM_POM );
    float lay = 0.0, hh = 1.0 - textureGrad( aoMap, fUV, fs0, fs1 ).b;
    for ( int k = 0; k < FORM_POM; k++ ) { if ( lay >= hh ) break; fUV -= dP; hh = 1.0 - textureGrad( aoMap, fUV, fs0, fs1 ).b; lay += 1.0 / float( FORM_POM ); }
  }
}
#endif
\`;
  // (the chunks that read the tile, read where the march landed)
  const at = (chunk, uv) => THREE.ShaderChunk[chunk].split(uv).join('fUV');
  const MAP = POM + at('map_fragment', 'vMapUv') + '\\n#ifdef USE_MAP\\n  diffuseColor.rgb /= uFMean;\\n#endif\\n';
  // the bake as the light (the tile's occlusion darkens it), and near the eye what the live lamps add to the relief: the
  // normal map against the face's own, and a sheen (normalised Blinn-Phong at the tile's roughness, a dielectric's 4%)
  const LIGHT = \`reflectedLight.indirectDiffuse *= vFLit;
\` + at('aomap_fragment', 'vAoMapUv') + \`
vec3 fDirect = vec3( 0.0 );
#if defined( FORM_RELIEF ) && defined( USE_AOMAP )
float fNear = 1.0 - smoothstep( uFPom.z, uFPom.w, fD );
if ( fNear > 0.0 ) {
  vec3 tn = texture2D( uFNorm, fUV ).xyz * 2.0 - 1.0, n = normalize( fT * tn.x + fB * tn.y + fN * tn.z ), V = - vFPos / fD;
  float rough = max( texture2D( aoMap, fUV ).g, 0.08 ), shine = clamp( 2.0 / ( rough * rough * rough * rough ) - 2.0, 1.0, 512.0 );
  vec3 fSum = vec3( 0.0 ), fAdd = vec3( 0.0 ), fSpec = vec3( 0.0 );
  for ( int i = 0; i < \${K}; i++ ) {
    vec3 d = uFLp[ i ] - vFPos; float r = length( d ); vec3 L = d / max( r, 1e-3 );
    float t = clamp( 1.0 - max( r, 1.1 ) / uFLr[ i ], 0.0, 1.0 );
    vec3 c = uFLk[ i ] * pow( t * t, uFFall );
    float ng = max( dot( fN, L ), 0.0 ), np = max( dot( n, L ), 0.0 );
    fSum += c * ng; fAdd += c * ( np - ng );
    fSpec += c * np * 0.04 * ( shine + 8.0 ) / 8.0 * pow( max( dot( n, normalize( L + V ) ), 0.0 ), shine );
  }
  float fVis = fNear * clamp( ( fLum( vFLit ) - fLum( ${cfg.sun ? 'mix( uFGround, uFAmb, 0.5 + 0.5 * inverseTransformDirection( fN, viewMatrix ).z )' : 'uFAmb'} ) ) / max( fLum( fSum ), 1e-3 ), 0.0, 1.0 );
  fDirect = fVis * ( fAdd * diffuseColor.rgb + fSpec );
}
#endif
${NB ? `vec3 fBeat = vec3( 0.0 );
for ( int i = 0; i < ${NB}; i++ ) {
  vec3 d = uFBp[ i ] - vFPos; float r = length( d );
  float t = clamp( 1.0 - max( r, 1.1 ) / uFBr[ i ], 0.0, 1.0 );
  fBeat += uFBk[ i ] * pow( t * t, uFFall ) * max( dot( fN, d / max( r, 1e-3 ) ), 0.0 );
}
fDirect += fBeat * diffuseColor.rgb;
` : ''}\`${cfg.reflect ? ` + ${safeJson(ENV_BODY)}.split('__K__').join(String(K))` : ''};
  const lit = (params, M${cfg.reflect ? ', S, wet, o_g' : ''}) => {
    const mat = new THREE.MeshBasicMaterial(params);
    const pom = M && M.depth > 0 && F.pom.steps > 0 ? F.pom.steps : 0, relief = !!(M && M.normal);
    mat.defines = { ...(pom ? { FORM_POM: pom } : {}), ...(relief ? { FORM_RELIEF: 1 } : {})${cfg.reflect ? ', ...(S ? { FORM_ENV: 1 } : {}), ...(S && wet ? (DAMP ? { FORM_DAMP: 1 } : { FORM_WET: 1 }) : {}), ...(S && SUNLIT ? { FORM_SUNLIT: 1 } : {}), ...(S && PR ? { FORM_ENVMAP: 1 } : {}), ...(S && S.clear ? { FORM_CLEAR: 1 } : {}), ...(S && S.film ? { FORM_FILM: 1 } : {}), ...(S && POOLG.has(o_g) ? { FORM_POOL: 1 } : {})' : ''} };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U, { ${cfg.sun ? 'uFGround: { value: new THREE.Vector3(...F.sun.ground) }, ' : ''}uFMean: { value: new THREE.Vector3(...(M ? M.mean : [1, 1, 1])) }, uFDepth: { value: M && M.depth ? M.depth : 0 }, uFNorm: { value: relief ? M.normal : null }${cfg.reflect ? ', uFSurf: { value: new THREE.Vector4(S ? S.rough : 1, S ? S.metal || 0 : 0, S ? S.clear || 0 : 0, S ? S.film || 0 : 0) }' : ''} });
      sh.vertexShader = VERT + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\\n  vFLit = aLit;\\n  vFPos = mvPosition.xyz;');
      sh.fragmentShader = FRAG + sh.fragmentShader.replace('#include <map_fragment>', MAP)
        .replace('#include <aomap_fragment>', LIGHT)
        .replace('vec3 outgoingLight = reflectedLight.indirectDiffuse;', 'vec3 outgoingLight = reflectedLight.indirectDiffuse + fDirect;');
    };
    mat.customProgramCacheKey = () => 'form-room' + pom + (relief ? 'r' : '')${cfg.reflect ? " + (S ? 'e' : '') + (S && wet ? (DAMP ? 'd' : 'w') : '') + (S && SUNLIT ? 's' : '') + (S && PR ? 'c' : '') + (S && S.clear ? 't' : '') + (S && S.film ? 'f' : '') + (S && POOLG.has(o_g) ? 'p' : '')" : ''};${cfg.sun ? `
    // (lit by the day: toned with the land, channels/form-land.js leaves it so)
    mat.userData.cast = true;` : ''}
    return mat;
  };
  const map = (url) => { const t = loader.load(url); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = THREE.NoColorSpace; t.channel = 0; return t; };
  const maps = {}, made = { material: 0, colour: 0, pom: 0 };
  for (const [k, m] of Object.entries(F.maps)) maps[k] = { ...m, normal: m.normal ? map(m.normal) : null, orm: m.orm ? map(m.orm) : null };
  // every surface of the room that carries its baked light; the rest keep their look, untoned
${cfg.sun ? `  const shared = new Map();
` : ''}  scene.traverse((o) => {
    if (!o.material) return;
    const b = o.material;${cfg.sun ? `
    // (a body under the cast rig, channels/cast-rig.js, is lit and toned as these are: left as it is)
    if (!Array.isArray(b) && b.userData && b.userData.cast) return;` : ''}
${cfg.sun ? `
    // (a street's repeated pieces, baked a template: the tiles of one repeat share one material, so they share its form)
    if (o.isInstancedMesh && !Array.isArray(b) && b.isMeshBasicMaterial && typeof o.userData.g === 'string' && !keep.has(o.userData.g) && o.geometry.getAttribute('aLit')) {
      let m = shared.get(b);
      if (!m) { m = lit({ map: b.map, vertexColors: b.vertexColors, side: b.side, transparent: b.transparent, opacity: b.opacity, depthWrite: b.depthWrite, alphaTest: b.alphaTest }, null); shared.set(b, m); made.colour++; }
      o.material = m; return;
    }` : ''}
    if (!o.isMesh || o.isInstancedMesh || !b.isMeshBasicMaterial || typeof o.userData.g !== 'string' || keep.has(o.userData.g) || !o.geometry.getAttribute('aLit')) { (Array.isArray(b) ? b : [b]).forEach((m) => { m.toneMapped = false; }); return; }
    const M = maps[o.userData.key];
    o.material = lit({ map: b.map, vertexColors: b.vertexColors, side: b.side, transparent: b.transparent, opacity: b.opacity, depthWrite: b.depthWrite, alphaTest: b.alphaTest,
      ...(M && M.orm ? { aoMap: M.orm } : {})${cfg.reflect ? ', ...(SURF[o.userData.g] && SURF[o.userData.g].clear ? { transparent: true, depthWrite: false } : {})' : ''} }, M${cfg.reflect ? ', SURF[o.userData.g] || null, WETG.has(o.userData.g), o.userData.g' : ''});
${cfg.reflect && cfg.sun ? `    // (a built thing out of doors is closed and drawn both sides: into the shadow map it casts by its far faces only,
    // so its lit faces never shade themselves in bands)
    if (SURF[o.userData.g]) o.material.shadowSide = THREE.BackSide;
` : ''}    if (M && M.normal) made.material++; else made.colour++;
    if (M && M.depth > 0 && F.pom.steps > 0) made.pom++;
  });
  // the glass: a pane reflects by Fresnel (Schlick from F0, \`F.f0\`, held up a little: a game's glass must be seen), the room in it (the floor's dark under its horizon,
  // the lamps' light over it, a lamp's streak toward the zenith), its opacity rising toward a grazing view; the sixth
  // generation's painted glints give way to it
  const PANES = new Set(F.panes || []), lampMean = F.lights.length ? F.lights.reduce((a, l) => a.map((v, i) => v + l.key[i] / F.lights.length), [0, 0, 0]) : [1, 1, 1];
  const lY = Math.max(1e-4, 0.2126 * lampMean[0] + 0.7152 * lampMean[1] + 0.0722 * lampMean[2]), enc = (v) => Math.pow(Math.min(1, Math.max(0, v)), 1 / 2.2);
  const up = new THREE.Color(...lampMean.map((v) => enc((v / lY) * 0.8))), down = new THREE.Color(...F.ambient.map((v) => enc(v * 1.6)));
  let panes = 0;
  scene.traverse((o) => {
    if (!o.isMesh || typeof o.userData.g !== 'string') return;
    if (o.userData.g === 'stage:glint') { o.visible = false; return; }
    if (!PANES.has(o.userData.g)) return;
    const a0 = o.material.opacity;
    o.material = new THREE.ShaderMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
      uniforms: { uA: { value: a0 }, uF0: { value: F.f0 }, uUp: { value: up }, uDown: { value: down } },
      vertexShader: 'varying vec3 vC;\\nvarying vec3 vW;\\nvoid main() { vC = color; vec4 w = modelMatrix * vec4( position, 1.0 ); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform float uA;\\nuniform float uF0;\\nuniform vec3 uUp;\\nuniform vec3 uDown;\\nvarying vec3 vC;\\nvarying vec3 vW;\\n'
        + 'void main() { vec3 N = normalize( cross( dFdx( vW ), dFdy( vW ) ) ), V = normalize( cameraPosition - vW ); if ( dot( N, V ) < 0.0 ) N = - N;\\n'
        + '  float c = clamp( dot( N, V ), 0.0, 1.0 ), fr = uF0 + ( 1.0 - uF0 ) * pow( 1.0 - c, 5.0 ); vec3 R = reflect( - V, N );\\n'
        + '  vec3 env = mix( uDown, uUp, smoothstep( -0.25, 0.35, R.z ) ) + uUp * pow( max( R.z, 0.0 ), 12.0 ) * 0.6;\\n'
        + '  float k = clamp( fr * 2.2, 0.0, 1.0 ); gl_FragColor = vec4( mix( vC, env, k ), uA + ( 1.0 - uA ) * k * 0.85 ); }' });
    o.renderOrder = 2; panes++;
  });

  // the live set: the nearest lamps that may light the relief, each slot fading to its next lamp
  const lamps = F.lights.map((l, i) => ({ i, at: new THREE.Vector3(...l.at), key: new THREE.Vector3(...l.key), r: l.radius })).filter((l, i) => F.lights[i].live${NB ? ' && !F.lights[i].beat' : ''});
  const slots = Array.from({ length: Math.min(F.live, lamps.length) }, () => ({ lamp: null, next: null, w: 0 }));
  const eye = new THREE.Vector3(), tmp = new THREE.Vector3();
  let lastPick = -1, lastT = -1;
  const pick = () => {
    const want = lamps.map((l) => [l, ${cfg.sun ? 'l.r > 1e8 ? -1 : ' : ''}l.at.distanceToSquared(eye)]).sort((a, b) => a[1] - b[1] || a[0].i - b[0].i).slice(0, slots.length).map(([l]) => l);
    const held = new Set(slots.map((s) => s.next || s.lamp));
    const free = slots.filter((s) => !(s.next || s.lamp) || !want.includes(s.next || s.lamp));
    for (const l of want) if (!held.has(l)) { const s = free.shift(); if (s) s.next = l; }
    for (const s of slots) if (s.next === s.lamp) s.next = null;
  };
  const probe = { lamps: lamps.length, live: slots.length, made, panes, reads: Object.fromEntries(Object.entries(F.maps).map(([k, m]) => [k, m.read])), on: () => slots.map((s) => (s.lamp ? s.lamp.i : -1)) };
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = function (r, s, cam, rt) {
    if (prev) prev.call(this, r, s, cam, rt);
    if (rt) return;
    const t = performance.now(), dt = lastT < 0 ? 1 : Math.min(0.1, (t - lastT) / 1000);
    lastT = t;
${cfg.reflect ? `    U.uFNow.value = window.__mojClock != null && window.__mojClock > 0 ? window.__mojClock : t / 1000;
` : ''}${cfg.reflect && cfg.reflect.floods ? `    (F.reflect.floods || []).map((f) => ({ f, d: tmp.set(...f.at).distanceToSquared(eye) })).sort((a, b) => a.d - b.d).slice(0, 4).forEach(({ f }, k) => { tmp.set(...f.at).applyMatrix4(cam.matrixWorldInverse); U.uFFlood.value[k].set(tmp.x, tmp.y, tmp.z, f.radius); U.uFFloodK.value[k].set(...f.key); });
` : ''}    cam.getWorldPosition(eye);
    // (a toned room's void and its haze are its ramp's darkest colour, as its toned page paints them: set at the first
    // frame, after the page's own haze has laid its colour)
    if (F.void && !probe.first) { scene.background = new THREE.Color(F.void); if (scene.fog) scene.fog.color.set(F.void); }
    if (t - lastPick > 250) { lastPick = t; pick(); }
    slots.forEach((sl, k) => {
      // (a slot taking a new lamp fades its old one out first, then the new one in; the first frame's come in whole)
      if (sl.next && (!sl.lamp || sl.w < 0.02)) { sl.lamp = sl.next; sl.next = null; }
      sl.w = !sl.lamp ? 0 : !probe.first ? 1 : sl.w + ((sl.next ? 0 : 1) - sl.w) * Math.min(1, dt * 8);
      U.uFLp.value[k].copy(sl.lamp ? sl.lamp.at : tmp.set(0, 0, -1e4)).applyMatrix4(cam.matrixWorldInverse);
      U.uFLk.value[k].copy(sl.lamp ? sl.lamp.key : tmp.set(0, 0, 0)).multiplyScalar(sl.w);
      U.uFLr.value[k] = sl.lamp ? sl.lamp.r : 1;
    });
${NB ? `    // the beats: each key swung in time (an alarm's sweep, a pulse's breath, a flicker's drops), at \`probe.at\` when set
    const now = probe.at ?? t / 1000;
    BL.forEach(({ l, i }, k) => {
      const ph = 2 * Math.PI * l.rate * now, step = Math.floor(now * l.rate), h = ((Math.sin((step + i * 17.17) * 12.9898) * 43758.5453) % 1 + 1) % 1;
      const w = l.beat === 'alarm' ? Math.pow(0.5 + 0.5 * Math.sin(ph), 6) : l.beat === 'pulse' ? 0.55 + 0.45 * Math.sin(ph) : h < 0.15 ? 0.15 + h * 2 : 1;
      U.uFBp.value[k].set(...l.at).applyMatrix4(cam.matrixWorldInverse);
      U.uFBk.value[k].set(...l.key).multiplyScalar(w);
    });
` : ''}    probe.first = true;
  };
${cfg.reflect && cfg.reflect.pools && cfg.reflect.pools.length ? `  // FOOTFALLS IN A LIQUID (visual cues, no solve): a step that comes down inside a pool's outline rings it (the rings bend
  // what it holds, as its liquid answers: rupa/liquid-look.js); the steps after it, past the pool's edge, are WET: a dark
  // print each, fainter step by step, drying away. A step is a gait's half crossing (a piloted figure) or a stride of the
  // walk's own travel. \`probe.step(x, y, dx, dy, z)\` lays one by hand
  const inPool = (p, x, y) => { const dx = (x - p.at[0]) / 1.5, dy = y - p.at[1], a = Math.atan2(dy, dx), r = p.r * (0.9 + 0.1 * Math.sin(a * 2 + p.ph[0]) + 0.06 * Math.sin(a * 3 + p.ph[1]) + 0.03 * Math.sin(a * 5 + p.ph[2])); return Math.hypot(dx, dy) < r; };
  const NP = 40, pg = new THREE.PlaneGeometry(1, 1), pInfo = new THREE.InstancedBufferAttribute(new Float32Array(NP * 4).fill(-1e3), 4), pTint = new THREE.InstancedBufferAttribute(new Float32Array(NP * 3), 3);
  pg.setAttribute('aInfo', pInfo); pg.setAttribute('aTint', pTint);
  const pm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false, uniforms: { uT: U.uFTime },
    vertexShader: 'attribute vec4 aInfo;\\nattribute vec3 aTint;\\nvarying vec2 vQ;\\nvarying vec4 vI;\\nvarying vec3 vT;\\n#include <common>\\n#include <logdepthbuf_pars_vertex>\\nvoid main() { vQ = uv * 2.0 - 1.0; vI = aInfo; vT = aTint; vec4 mv = modelViewMatrix * instanceMatrix * vec4( position, 1.0 ); gl_Position = projectionMatrix * mv;\\n#include <logdepthbuf_vertex>\\n}',
    fragmentShader: 'uniform float uT;\\nvarying vec2 vQ;\\nvarying vec4 vI;\\nvarying vec3 vT;\\n#include <common>\\n#include <logdepthbuf_pars_fragment>\\nvoid main() {\\n#include <logdepthbuf_fragment>\\n  float age = uT - vI.x; if ( age < 0.0 || age > vI.z ) discard;\\n  float m = 1.0 - smoothstep( 0.55, 1.0, length( vQ * vec2( 1.0, 0.82 ) ) );\\n  float heel = 1.0 - smoothstep( 0.3, 0.5, length( ( vQ - vec2( 0.0, -0.62 ) ) * vec2( 1.3, 2.4 ) ) );\\n  gl_FragColor = vec4( vT, max( m, heel ) * vI.y * ( 1.0 - age / vI.z ) * 0.62 );\\n}' });
  const prints = new THREE.InstancedMesh(pg, pm, NP); prints.frustumCulled = false; prints.renderOrder = 3; scene.add(prints);
  const pM = new THREE.Matrix4(), pQ = new THREE.Quaternion(), pS = new THREE.Vector3(0.12, 0.3, 1), pP = new THREE.Vector3(), pZ = new THREE.Vector3(0, 0, 1);
  let ripI = 0, prI = 0, wet = 0, wetOf = null, side = 1;
  probe.step = (x, y, dx, dy, z) => {
    const now = U.uFTime.value, p = POOLS.find((q) => inPool(q, x, y));
    if (p) { U.uFRip.value[ripI++ % 8].set(x, y, now, p.ripple.amp); wet = p.print; wetOf = p; probe.rings = (probe.rings || 0) + 1; return; }
    if (wet <= 0 || !wetOf) return;
    const l = Math.hypot(dx, dy) || 1, k = prI++ % NP; side = -side;
    pQ.setFromAxisAngle(pZ, Math.atan2(dy, dx) - Math.PI / 2);
    pM.compose(pP.set(x - (dy / l) * 0.09 * side, y + (dx / l) * 0.09 * side, (z || 0) + 0.004), pQ, pS); prints.setMatrixAt(k, pM); prints.instanceMatrix.needsUpdate = true;
    pInfo.setXYZW(k, now, wet / wetOf.print, 14 + 10 * (wet / wetOf.print), 0); pInfo.needsUpdate = true;
    pTint.setXYZ(k, wetOf.tint[0] * 0.5, wetOf.tint[1] * 0.5, wetOf.tint[2] * 0.5); pTint.needsUpdate = true;
    wet--; probe.prints = (probe.prints || 0) + 1;
  };
  const gaitLast = {}; let travel = 0, px = null, py = null;
  probe.feet = () => {
    U.uFTime.value = window.__mojClock != null && window.__mojClock > 0 ? window.__mojClock : performance.now() / 1000;
    const ctrl = window.__mojCtrl && window.__mojCtrl.world;
    if (ctrl) for (const e of ctrl.entities) { if (ctrl.pilotId && e.id !== ctrl.pilotId) continue;
      const ix = Math.floor((e.gaitPhase || 0) * 2), was = gaitLast[e.id];
      if (was !== undefined && ix !== was && e.moving && e.grounded !== false) { const t = e.transform || e, q = t.pos || [e.x || 0, e.y || 0, e.z || 0], h = t.heading || 0; probe.step(q[0], q[1], Math.cos(h), Math.sin(h), 0); }
      gaitLast[e.id] = ix; }
    if (typeof walkOn !== 'undefined' && walkOn) { if (px !== null) { const dx = camera.position.x - px, dy = camera.position.y - py; travel += Math.hypot(dx, dy); if (travel > 0.72) { travel = 0; probe.step(camera.position.x, camera.position.y, dx, dy, 0); } }
      px = camera.position.x; py = camera.position.y; } else { px = null; py = null; }
  };
` : ''}${cfg.reflect && cfg.reflect.probe ? `  // the capture, taken before a frame is drawn (the page calls it: scene/scene-three.js), a few frames in
  let capN = 0;
  probe.capture = () => {
    if (probe.captured || !probe.first || ++capN < 3) return;
    const rt = renderer.getRenderTarget(), xr = renderer.xr.enabled; renderer.xr.enabled = false;
    cubeCam.update(renderer, scene);
    renderer.xr.enabled = xr; renderer.setRenderTarget(rt);
    probe.captured = true;
  };
` : ''}  return probe;
})();
window.__mojForm = __mojForm;
`;
}

/** The page's defaults under a form cfg: how many lamps light the relief live and the distances that fades out between,
 *  the parallax (its steps, and the distances it fades out between), the groups kept as built. */
export const FORM_PAGE = Object.freeze({ live: 4, pom: Object.freeze({ steps: 6, near: 4, far: 8 }), relief: Object.freeze({ near: 12, far: 22 }), keep: Object.freeze(['stage:fixture', 'stage:glass']), panes: Object.freeze(['stage:pane', 'stage:wired']), f0: 0.04 });

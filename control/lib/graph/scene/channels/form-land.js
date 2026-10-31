/**
 * THE FORM RENDER'S LAND (gen-7), on the World page: the `form` input (form/land-read.js formPayload) drawn as material
 * under the cube's light, in place of the painted land. The island spike's page (scripts/spikes/form/island.mjs), lifted:
 * the layered ground (each layer's texture along the face's dominant axis, blended by weight and by its own height, its
 * colour about its mean over the palette-solved base; the scree thinning by its stones' dice; the trail's dress: its
 * powder and clay, its patches, its dust; the undergrowth on a green land; the wet line by height), the land shaded
 * smooth, the sea one surface faded over the depth under it, the scree's stones instanced, the cube's sun and sky light.
 *
 *   formLandScript(form, flora?) → the channel's page source (one block, after the page's own; absent `form`, the page has
 *     none); `flora`, a form read's plants (channels/form-flora.js), grown inside it under its light
 *     `form.cone`, a world's fixed view-cone reach (channels/view-cone.js readCone): the cone is the form's, read by its grass
 *
 * It hides the painted groups it draws in their place (`form.hides`) and the painted water sheet under its sea; every
 * other painted thing is left unlit as it was (the renderer's tone curve is set, those materials marked untouched by
 * it). A live light's own sun (channels/cast-shadows.js) is shadow only here too: its intensity is taken to nothing, so
 * the land is lit once. `window.__formReady` when it has drawn (its textures load first).
 */
import { safeJson } from '../emit-util.js';
import { formGrassScript } from './form-grass.js';
import { viewConeScript } from './view-cone.js';
import { farFieldScript, FAR_BLANKET_GLSL, farBlanketUniforms } from './far-field.js';
import { formFloraScript } from './form-flora.js';

/** THE GROUND'S OWN PARALLAX KINDS, procedural (a Voronoi field, no texture): `pebbles` (domes strewn `cell` m apart over the soil, a cell in four bare,
 *  `depth` m tall), `cracks` (dry mud in plates `cell` m across, cracks `depth` m deep, their edges curled up), `plates`
 *  (a second rock, slabs `cell` m across stepped `depth` m). Bare soil takes pebbles where it is damp and cracks where it
 *  is dry (a field `dry` m across); the trail varies by stretches (a field `stretch` m across) between its powder, a
 *  pebbled stretch and a cracked one; marched within `near` m. */
export const GROUND_PARALLAX = Object.freeze({ pebbles: Object.freeze({ cell: 0.09, depth: 0.03 }), cracks: Object.freeze({ cell: 0.34, depth: 0.035 }),
  plates: Object.freeze({ cell: 0.75, depth: 0.06 }), dry: 9, stretch: 7, near: 30 });
export function formLandScript(form, flora = null) {
  return `
// --- the form render (gen-7): the land as material, lit by the cube's light (channels/form-land.js) ---
(async function () {
  const D = ${safeJson(form)}, __formMeshes = [];
  // (what was drawn before it keeps its look: the tone curve is the form's)
  const __formBefore = []; scene.traverse((o) => { if (o.material) __formBefore.push(o); });
  const bytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  // (the fills and colours are sRGB bytes; three's vertex colours are linear)
  const LIN = Float32Array.from({ length: 256 }, (_, v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  const linear = (b) => Float32Array.from(b, (v, i) => (i % 4 === 3 ? v / 255 : LIN[v]));
  const POS = new Float32Array(bytes(D.pos).buffer), C7 = linear(bytes(D.c7)), SPL = bytes(D.spl), NRM = new Int8Array(bytes(D.nrm).buffer);
  const rgb = (a) => new THREE.Color().setRGB(a[0] / 255, a[1] / 255, a[2] / 255, THREE.SRGBColorSpace);

  // the sky: a dome from the horizon's colour to the zenith's, behind both halves and the gen-7 side's light and reflections
  function skyDome() {
    const g = new THREE.SphereGeometry(4000, 48, 24), p = g.attributes.position, col = new Float32Array(p.count * 3), z = rgb(D.sky.zenith), h = rgb(D.sky.horizon);
    for (let i = 0; i < p.count; i++) { const t = Math.pow(Math.max(0, p.getZ(i) / 4000), 0.6), c = h.clone().lerp(z, t); col.set([c.r, c.g, c.b], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.rotateX(0);
    return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
  }
  function part(R, colours, extra = {}) {
    const g = new THREE.BufferGeometry();
    if (extra.smooth) g.setAttribute('normal', new THREE.BufferAttribute(NRM.subarray(R.start * 3, (R.start + R.count) * 3), 3, true));
    if (extra.splat) g.setAttribute('splat', new THREE.BufferAttribute(SPL.subarray(R.start * 4, (R.start + R.count) * 4), 4, true));
    g.setAttribute('position', new THREE.BufferAttribute(POS.subarray(R.start * 3, (R.start + R.count) * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(colours.subarray(R.start * 4, (R.start + R.count) * 4), 4));
    return g;
  }
  // (the sky in the sea's reflections only: the land's light is the solved sun and sky light, nothing over it)
  const pm = new THREE.PMREMGenerator(renderer), envScene = new THREE.Scene(); envScene.add(skyDome());
  const skyEnv = pm.fromScene(envScene, 0, 1, 6000).texture;
  // the solved light in three's units: its diffuse is base × light / π, so each light is π × the solve's level
  const solved = (lin) => { const m = Math.max(...lin, 1e-9); return [new THREE.Color().setRGB(lin[0] / m, lin[1] / m, lin[2] / m, THREE.LinearSRGBColorSpace), Math.PI * m]; };
  const __formAmb = new THREE.AmbientLight(...solved(D.light.ambient)); scene.add(__formAmb);
  // the layered ground's shader, chained over the standard material's: each layer along the face's dominant axis, its
  // weight raised by its own height (the border decided by the relief), its normal, roughness and occlusion, and its
  // colour about its mean over the corner's base
  // (each layer its own slice of an array, repeating on its own: an atlas's cells bleed into each other's mips as seams)
  const loadImg = (u) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.src = u; });
  const mipped = (t, srgb) => { t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 8; t.needsUpdate = true; return t; };
  async function layerArray(u, srgb) {
    const im = await loadImg(u), T = D.layers.size, cv2 = document.createElement('canvas'); cv2.width = im.width; cv2.height = im.height;
    const x = cv2.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0);
    const data = new Uint8Array(T * T * 4 * 7);
    for (let i = 0; i < 7; i++) data.set(x.getImageData((i % 3) * T, Math.floor(i / 3) * T, T, T).data, i * T * T * 4);
    return mipped(new THREE.DataArrayTexture(data, T, T, 7), srgb);
  }
  const [tBase, tNorm, tOrm] = await Promise.all([layerArray(D.layers.base, true), layerArray(D.layers.normal), layerArray(D.layers.orm)]);
  const tDice = mipped(await new THREE.TextureLoader().loadAsync(D.layers.dice), false); tDice.minFilter = THREE.NearestMipmapNearestFilter; tDice.magFilter = THREE.NearestFilter;
  // (the path's mask: the weight in red, the trail's height in green and blue; none without a trail)
  const pathMap = D.path ? new THREE.DataTexture(bytes(D.path.px), D.path.size[0], D.path.size[1], THREE.RGBAFormat) : new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat);
  pathMap.magFilter = pathMap.minFilter = THREE.LinearFilter; pathMap.needsUpdate = true;
  const LAYER_U = { tGrassL: { value: new THREE.DataTexture(new Uint8Array([0, 0, 255, 255]), 1, 1, THREE.RGBAFormat) }, uGOl: { value: new THREE.Vector2() }, uGMl: { value: new THREE.Vector2(1, 1) }, uHasG: { value: 0 },
    // (the far field's blanket past the view cone's reach: channels/far-field.js)
    ...${farBlanketUniforms()},
    tBase: { value: tBase }, tNorm: { value: tNorm }, tOrm: { value: tOrm }, tDice: { value: tDice }, uTile: { value: D.layers.tile }, uMean: { value: D.layers.mean.map((m) => new THREE.Vector3(...m)) },
    tPath: { value: pathMap }, uPathO: { value: new THREE.Vector2(...(D.path ? D.path.origin.map((v) => v - D.path.cell / 2) : [0, 0])) }, uPathM: { value: new THREE.Vector2(...(D.path ? D.path.metres : [1, 1])) },
    uPathZ: { value: new THREE.Vector2(...(D.path ? D.path.z : [0, 1])) }, uHasPath: { value: D.path ? 1 : 0 }, uDress: { value: new THREE.Vector3(D.dress.rubble, D.dress.dust, D.dress.reach) }, uSdIn: { value: D.dress.sdIn }, uPatch: { value: new THREE.Vector3(...D.dress.patches) }, uPathBase: { value: new THREE.Vector3(...D.layers.pathBase) }, uStoneBase: { value: new THREE.Vector3(...D.layers.stoneBase) }, uClayBase: { value: new THREE.Vector3(...D.layers.clayBase) }, uUnderBase: { value: new THREE.Vector3(...D.layers.underBase) }, uUnder: { value: D.layers.green ? 1 : 0 }, uMoss: { value: D.layers.moss ?? 0 }, uClay: { value: D.dress.surface === 'sand' ? 0 : D.dress.clay }, uWet: { value: new THREE.Vector4(D.wet.z ?? -1e9, D.wet.band, D.wet.tone, D.wet.rough) } };
${form.dunes ? duneScript() : ''}${form.snow ? snowScript() : ''}${form.dunes || form.snow ? printScript(form) : ''}  function layeredGround(m, roughScale) {
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, LAYER_U, { uRough: { value: roughScale } });
      sh.vertexShader = 'attribute vec4 splat;\\nvarying vec4 vSplat;\\nvarying vec3 vWPos;\\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\\n  vSplat = splat; vWPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
      sh.fragmentShader = 'uniform sampler2DArray tBase, tNorm, tOrm;\\nuniform sampler2D tPath, tDice;\\nuniform float uTile[7];\\nuniform vec3 uMean[7];\\nuniform float uRough, uHasPath;\\nuniform vec2 uPathO, uPathM, uPathZ;\\nuniform vec3 uPathBase, uStoneBase, uClayBase;\\nuniform float uClay, uUnder, uHasG, uMoss;\\nuniform sampler2D tGrassL;\\nuniform vec2 uGOl, uGMl;\\nuniform vec3 uUnderBase;\\nuniform vec4 uWet;\\nuniform vec3 uDress, uPatch;\\nuniform float uSdIn;\\nvarying vec4 vSplat;\\nvarying vec3 vWPos;\\nfloat hn( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }\\nfloat vn( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f ); return mix( mix( hn( i ), hn( i + vec2( 1.0, 0.0 ) ), f.x ), mix( hn( i + vec2( 0.0, 1.0 ) ), hn( i + vec2( 1.0, 1.0 ) ), f.x ), f.y ); }\\n'
        + ${JSON.stringify(FAR_BLANKET_GLSL)}
        // (the ground's own parallax kinds, procedural: a Voronoi cell's distance, its edge and its dice; and each kind's
        // height over its cells, GROUND_PARALLAX)
        + 'vec3 vor5( vec2 p ) { vec2 i = floor( p ), f = fract( p ); float d1 = 8.0, d2 = 8.0; vec2 id = vec2( 0.0 ); for ( int y = -1; y <= 1; y++ ) for ( int x = -1; x <= 1; x++ ) { vec2 g = vec2( float( x ), float( y ) ), o = vec2( hn( i + g ), hn( i + g + 17.3 ) ) * 0.8 + 0.1; float d = length( g + o - f ); if ( d < d1 ) { d2 = d1; d1 = d; id = i + g; } else if ( d < d2 ) d2 = d; } return vec3( d1, d2 - d1, hn( id + 5.1 ) ); }\\n'
        + 'float gHt( int k, vec2 p ) { if ( k > 0 ) p += vec2( vn( p * 0.45 ), vn( p * 0.45 + 7.7 ) ) * ( k == 1 ? 0.8 : 1.6 ); vec3 v = vor5( p ); if ( k == 0 ) { float r = mix( 0.22, 0.46, fract( v.z * 7.3 ) ), q = clamp( v.x / r, 0.0, 1.0 ); return v.z < 0.28 ? 0.0 : sqrt( 1.0 - q * q ) * mix( 0.6, 1.0, v.z ); } if ( k == 1 ) return smoothstep( 0.0, mix( 0.012, 0.09, vn( p * 1.7 + 3.0 ) ), v.y ) * ( 0.8 + 0.2 * v.x ); return smoothstep( 0.0, 0.05, v.y ) * mix( 0.35, 1.0, v.z ); }\\n'
        + sh.fragmentShader.replace('#include <normal_fragment_maps>', \`
    vec3 nW = normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz ), aN = abs( nW );
    vec2 uvW; vec3 tT, tB;
    if ( aN.z >= aN.x && aN.z >= aN.y ) { uvW = vWPos.xy; tT = vec3( 1.0, 0.0, 0.0 ); tB = vec3( 0.0, 1.0, 0.0 ); }
    else if ( aN.x >= aN.y ) { uvW = vec2( vWPos.y * sign( nW.x ), vWPos.z ); tT = vec3( 0.0, sign( nW.x ), 0.0 ); tB = vec3( 0.0, 0.0, 1.0 ); }
    else { uvW = vec2( -vWPos.x * sign( nW.y ), vWPos.z ); tT = vec3( -sign( nW.y ), 0.0, 0.0 ); tB = vec3( 0.0, 0.0, 1.0 ); }
    // the path: the mask at this point of the plan, on ground that faces up and at the trail's own height (not the flank
    // under a shelf), every natural layer giving way to it
    float pw = 0.0, pd = 99.0;
    if ( uHasPath > 0.5 ) {
      vec2 pu = ( vWPos.xy - uPathO ) / uPathM;
      if ( pu.x > 0.0 && pu.y > 0.0 && pu.x < 1.0 && pu.y < 1.0 ) {
        vec4 pm = texture2D( tPath, pu );
        float pz = uPathZ.x + ( pm.b * 255.0 * 256.0 + pm.a * 255.0 ) / 65535.0 * uPathZ.y;
        float onIt = smoothstep( 0.6, 0.85, nW.z ) * ( 1.0 - smoothstep( 0.6, 1.5, abs( vWPos.z - pz ) ) );
        pd = onIt > 0.0 ? pm.g * ( uSdIn + uDress.z ) - uSdIn : 99.0;
        // (the path's edge from the signed distance, broken by noise at two scales and wandering in its reach: it feathers
        // into the ribbon as well as out of it, so where the colour turns is never the ribbon's edge)
        float eN = vn( vWPos.xy / 0.9 + 3.7 ) * 0.65 + vn( vWPos.xy / 0.22 + 8.1 ) * 0.35 - 0.5, eW = 0.35 + 0.55 * vn( vWPos.xy / 1.6 + 1.3 );
        pw = ( 1.0 - smoothstep( -0.25, eW, pd + eN * 0.75 ) ) * onIt;
      }
    }
    // (a face with no natural layer, the trail's own ribbons and the walls of its shelves: the path's material all over it)
    if ( vSplat.x + vSplat.y + vSplat.z + vSplat.w < 0.01 ) pw = 1.0;
    float hgt[7]; vec3 bs[7]; vec3 ns[7]; vec2 rs[7];
    // the scree's PARALLAX (near, and only where there is scree): its height map marched along the view in the face's
    // frame, so its stones stand up and hide what is behind them; fading out with distance to the flat map
    vec2 scUV = uvW / uTile[ 1 ];
    float camD = length( cameraPosition - vWPos ), pomK = 1.0 - smoothstep( 18.0, 36.0, camD );
    if ( vSplat.y > 0.001 && pomK > 0.0 ) {
      vec3 V = normalize( cameraPosition - vWPos ), vt = vec3( dot( V, tT ), dot( V, tB ), dot( V, nW ) );
      vec2 gx = dFdx( scUV ), gy = dFdy( scUV ), dP = vt.xy / max( vt.z, 0.25 ) * ( 0.08 / uTile[ 1 ] ) * pomK / 16.0;
      float lay = 0.0, hh = 1.0 - textureGrad( tOrm, vec3( scUV, 1.0 ), gx, gy ).b;
      for ( int k = 0; k < 16; k++ ) { if ( lay >= hh ) break; scUV -= dP; hh = 1.0 - textureGrad( tOrm, vec3( scUV, 1.0 ), gx, gy ).b; lay += 1.0 / 16.0; }
    }
    // the CLAY's parallax, cheap: one fetch of its height and the coordinate offset along the view by it, near only
    vec2 clUV = uvW / uTile[ 5 ];
    if ( pw > 0.001 && uClay > 0.0 && camD < 30.0 ) {
      vec3 V2 = normalize( cameraPosition - vWPos ), vt2 = vec3( dot( V2, tT ), dot( V2, tB ), dot( V2, nW ) );
      clUV -= vt2.xy / max( vt2.z, 0.3 ) * ( texture( tOrm, vec3( clUV, 5.0 ) ).b - 0.5 ) * ( 0.035 / uTile[ 5 ] ) * ( 1.0 - smoothstep( 15.0, 30.0, camD ) );
    }
    // the UNDERGROWTH's parallax: a short march (four steps) near, where the green land's cover is
    vec2 ugUV = uvW / uTile[ 6 ];
    if ( uUnder > 0.5 && vSplat.z > 0.05 && camD < 20.0 ) {
      vec3 V3 = normalize( cameraPosition - vWPos ), vt3 = vec3( dot( V3, tT ), dot( V3, tB ), dot( V3, nW ) );
      vec2 dU = vt3.xy / max( vt3.z, 0.3 ) * ( 0.02 / uTile[ 6 ] ) * ( 1.0 - smoothstep( 10.0, 20.0, camD ) ) / 4.0;
      float l3 = 0.0, h3 = 1.0 - texture( tOrm, vec3( ugUV, 6.0 ) ).b;
      for ( int k = 0; k < 4; k++ ) { if ( l3 >= h3 ) break; ugUV -= dU; h3 = 1.0 - texture( tOrm, vec3( ugUV, 6.0 ) ).b; l3 += 0.25; }
    }
    // the ROCK: on a face turning between the two side axes (a cone's flank) sampled along both and blended, half each at
    // the turn, so its beds (level in the world on either axis) never snap; its PARALLAX near, where there is rock
    vec2 rkUV = uvW / uTile[ 0 ], rk2 = vec2( 0.0 ); vec3 rT2 = tT, rB2 = tB; float rkB = 0.0;
    if ( aN.z < max( aN.x, aN.y ) && vSplat.x > 0.001 ) {
      float bx = aN.x / max( 1e-4, aN.x + aN.y );
      if ( aN.x >= aN.y ) { rk2 = vec2( -vWPos.x * sign( nW.y ), vWPos.z ); rT2 = vec3( -sign( nW.y ), 0.0, 0.0 ); rkB = 0.5 * ( 1.0 - smoothstep( 0.0, 0.12, bx - 0.5 ) ); }
      else { rk2 = vec2( vWPos.y * sign( nW.x ), vWPos.z ); rT2 = vec3( 0.0, sign( nW.x ), 0.0 ); rkB = 0.5 * ( 1.0 - smoothstep( 0.0, 0.12, 0.5 - bx ) ); }
      rB2 = vec3( 0.0, 0.0, 1.0 ); rk2 /= uTile[ 0 ];
    }
    if ( vSplat.x > 0.05 && camD < 26.0 ) {
      vec3 V4 = normalize( cameraPosition - vWPos ), vt4 = vec3( dot( V4, tT ), dot( V4, tB ), dot( V4, nW ) );
      vec2 gx4 = dFdx( rkUV ), gy4 = dFdy( rkUV ), dR = vt4.xy / max( vt4.z, 0.3 ) * ( 0.06 / uTile[ 0 ] ) * ( 1.0 - smoothstep( 14.0, 26.0, camD ) ) / 8.0;
      float l4 = 0.0, h4 = 1.0 - textureGrad( tOrm, vec3( rkUV, 0.0 ), gx4, gy4 ).b;
      for ( int k = 0; k < 8; k++ ) { if ( l4 >= h4 ) break; rkUV -= dR; h4 = 1.0 - textureGrad( tOrm, vec3( rkUV, 0.0 ), gx4, gy4 ).b; l4 += 0.125; }
    }
    for ( int i = 0; i < 7; i++ ) {
      vec3 a = vec3( i == 0 ? rkUV : i == 1 ? scUV : i == 5 ? clUV : i == 6 ? ugUV : uvW / uTile[ i ], float( i ) );
      vec4 o = texture( tOrm, a );
      hgt[ i ] = o.b; rs[ i ] = o.rg;
      bs[ i ] = texture( tBase, a ).rgb / uMean[ i ];
      ns[ i ] = texture( tNorm, a ).xyz * 2.0 - 1.0;
    }
    if ( rkB > 0.001 ) {
      vec3 a2 = vec3( rk2, 0.0 ); vec4 o2 = texture( tOrm, a2 ); vec3 n2 = texture( tNorm, a2 ).xyz * 2.0 - 1.0;
      // (the second sample's normal into the world by its own frame, then into the first's)
      vec3 w1 = tT * ns[ 0 ].x + tB * ns[ 0 ].y + nW * ns[ 0 ].z, w2 = rT2 * n2.x + rB2 * n2.y + nW * n2.z, wb = normalize( mix( w1, w2, rkB ) );
      ns[ 0 ] = vec3( dot( wb, tT ), dot( wb, tB ), dot( wb, nW ) );
      hgt[ 0 ] = mix( hgt[ 0 ], o2.b, rkB ); rs[ 0 ] = mix( rs[ 0 ], o2.rg, rkB ); bs[ 0 ] = mix( bs[ 0 ], texture( tBase, a2 ).rgb / uMean[ 0 ], rkB );
    }
    // (dirt settles on the rock's ledges: where its own relief faces up, and more on a face that leans back)
    float ledge = vSplat.x > 0.001 ? smoothstep( 0.5, 0.85, ( tT * ns[ 0 ].x + tB * ns[ 0 ].y + nW * ns[ 0 ].z ).z ) * ( 0.55 + 0.45 * vn( vWPos.xy / 1.2 + vWPos.z * 0.7 + 63.0 ) ) + 0.3 * smoothstep( 0.62, 0.85, nW.z ) * smoothstep( 0.5, 0.75, vn( vWPos.xy / 2.0 + 29.0 ) ) : 0.0;
    // (the trail's dirt two: powder and clay by a wandering field, its share of clay the dress's)
    float clayK = clamp( uClay * ( 1.0 + 2.2 * ( vn( vWPos.xy / 1.6 + 91.0 ) * 0.7 + vn( vWPos.xy / 0.55 + 13.0 ) * 0.3 - 0.5 ) ), 0.0, 1.0 );
    // (the ROAD's core: deeper in than its edge, its own border broken by its own noise; the clay's clods there, the dry
    // powder out at the edge: the two overlap in ragged alpha, never along a line)
    float cN = vn( vWPos.xy / 0.7 + 21.0 ) * 0.6 + vn( vWPos.xy / 0.18 + 5.5 ) * 0.4 - 0.5;
    float core = pd < 98.0 ? 1.0 - smoothstep( -0.7, -0.1, pd + cN * 0.6 ) : 0.0;
    clayK = clamp( clayK * mix( 0.25, 1.0, core ) + core * 0.35 * step( 0.001, uClay ), 0.0, 1.0 );
    // (the cover on a green land: the undergrowth over the dirt, thinning in wandering patches)
    float gcov = uHasG > 0.5 ? texture2D( tGrassL, ( vWPos.xy - uGOl ) / uGMl ).b : 1.0;
    float ugK = uUnder * clamp( 0.62 + 0.5 * ( vn( vWPos.xy / 3.5 + 47.0 ) - 0.5 ), 0.0, 1.0 ) * mix( 0.6, 1.0, gcov );
    float ws[7]; ws[0] = vSplat.x * ( 1.0 - pw ); ws[1] = vSplat.y * ( 1.0 - pw ); ws[2] = vSplat.z * ( 1.0 - pw ) * ( 1.0 - ugK ); ws[3] = vSplat.w * ( 1.0 - pw ); ws[4] = pw * ( 1.0 - clayK ); ws[5] = pw * clayK; ws[6] = vSplat.z * ( 1.0 - pw ) * ugK;
    float toDirt = ws[ 0 ] * min( 1.0, ledge ) * 0.7; ws[ 0 ] -= toDirt; ws[ 2 ] += toDirt; float dirtFrac = toDirt / max( 1e-4, ws[ 2 ] );
    // (the MOSS, as much as the biocube asks (flora.moss): on the rock where its relief faces up, in patches over metres,
    // in the undergrowth's cushions, its colour the palette's grass darkened)
    float mossK = uMoss > 0.0 ? uMoss * smoothstep( 0.3, 0.75, ( tT * ns[ 0 ].x + tB * ns[ 0 ].y + nW * ns[ 0 ].z ).z ) * smoothstep( 0.3, 0.6, vn( vWPos.xy / 1.8 + vWPos.z * 0.6 + 81.0 ) * 0.7 + vn( vWPos.xy / 0.5 + 7.0 ) * 0.3 ) : 0.0;
    float toMoss = ws[ 0 ] * min( 1.0, mossK * 1.6 ); ws[ 0 ] -= toMoss; ws[ 6 ] += toMoss;
    // (each layer present here nudged by its own noise over the plan, a few metres across: the corners' weights run
    // straight across a triangle, the border they give must not)
    // the scree thins out by its stones: a stone is kept whole where its dice fall under the scree's share here (nudged
    // like the rest), and then it lies over whatever else is here; between the kept stones the others show
    float wsum = max( 1e-4, ws[0] + ws[1] + ws[2] + ws[3] + ws[4] + ws[5] + ws[6] ), sh = ws[1] / wsum * smoothstep( 0.55, 0.8, nW.z );
    // (scree lies no steeper than its angle of repose, ~38°: on a cliff's face its share is none, whatever its corners say)
    float sn = vn( vWPos.xy / 2.5 + 17.3 ) * 0.7 + vn( vWPos.xy / 0.8 + 5.1 ) * 0.3 - 0.5;
    // (the trail's verge: its rubble's share, the stones the dice keep along its edges as the real ones lie, a few on it)
    float vergeW = uDress.x * ( pd <= 0.05 ? 0.15 : exp( -pow( ( pd - 0.45 ) / 0.7, 2.0 ) ) ) * smoothstep( 0.6, 0.85, nW.z );
    sh = max( sh, pd < 98.0 ? vergeW * 0.9 : 0.0 );
    // (the noise nudges the share as far as there is one: where the scree is a trace, a trace of its stones, never a
    // scatter of them far from any scree)
    float kept = sh > 0.001 ? step( texture( tDice, scUV ).r, min( 1.0, sh * 1.2 + sn * 0.3 * min( 1.0, sh * 4.0 ) ) ) : 0.0;
    float top = 0.0, steepF = 1.0 - smoothstep( 0.5, 0.8, abs( nW.z ) );
    for ( int i = 0; i < 7; i++ ) {
      float nz = vn( vWPos.xy / 2.5 + float( i ) * 17.3 ) * 0.7 + vn( vWPos.xy / 0.8 + float( i ) * 5.1 ) * 0.3 - 0.5;
      // (a layer's relief and its noise lift it as far as it is here: a trace of turf under the trail never wins on its blades)
      // (on a steep face the relief decides more and the noise breaks finer: the soil and scree lie in the rock's joints
      // and soft beds, their border the strata's, never the line a corner's weight runs across a face)
      float nzF = vn( vWPos.xy / 0.35 + vWPos.z * 1.7 + float( i ) * 3.1 ) - 0.5;
      ws[ i ] = i == 1 ? kept * 4.0 : ws[ i ] > 0.001 ? ws[ i ] + ( hgt[ i ] * mix( 0.35, 0.95, steepF ) + nz * 0.35 + nzF * 0.35 * steepF ) * min( 1.0, ws[ i ] * 3.0 ) : 0.0; top = max( top, ws[ i ] );
    }
    float tw = 0.0; vec3 mb = vec3( 0.0 ), mn = vec3( 0.0 ); vec2 mr = vec2( 0.0 );
    for ( int i = 0; i < 7; i++ ) { float w = max( ws[ i ] - ( top - 0.08 ), 0.0 ); tw += w; mb += bs[ i ] * w; mr += rs[ i ] * w; mn += ns[ i ] * w; ws[ i ] = w; }
    mb /= max( 1e-4, tw ); mr /= max( 1e-4, tw ); mn = normalize( mn );
    // the trail's PATCHES (its dress's kinds): blobs along it a couple of metres across, on its own share only: worn lighter
    // and smoother, damp darker and glossier, gravel the scree's small stones
    float tsh = ( ws[ 4 ] + ws[ 5 ] ) / max( 1e-4, tw );
    float pkW = smoothstep( 0.62, 0.72, vn( vWPos.xy / 2.2 + 11.0 ) ) * uPatch.x * tsh, pkD = smoothstep( 0.7, 0.8, vn( vWPos.xy / 2.0 + 37.0 ) ) * uPatch.y * tsh;
    float pkG = smoothstep( 0.6, 0.7, vn( vWPos.xy / 1.8 + 71.0 ) ) * uPatch.z * tsh;
    mb = mix( mb, bs[ 1 ], pkG ); mn = normalize( mix( mn, ns[ 1 ], pkG ) ); mr = mix( mr, rs[ 1 ], pkG );
    mb *= mix( 1.0, 1.15, pkW ) * mix( 1.0, 0.78, pkD ); mn = normalize( mix( mn, vec3( 0.0, 0.0, 1.0 ), 0.5 * pkW ) ); mr.y = mix( mr.y, 0.45, pkD );
    // the trail's DUST: a pale fine powder worn out from it over the land (its reach wandering), thinner on the trail
    // itself; it pales, flattens and dulls what it lies on
    float dust = ( 1.0 - 0.7 * ws[ 6 ] / max( 1e-4, tw ) ) * uDress.y * ( pd < 98.0 ? ( 1.0 - smoothstep( 0.1, uDress.z * ( 0.45 + 0.55 * vn( vWPos.xy / 3.0 + 5.0 ) ), pd ) ) * mix( 0.45, 1.0, smoothstep( 0.0, 0.6, pd ) ) : 0.0 ) * smoothstep( 0.6, 0.85, nW.z );
    // (the path's own base under its share: the floor the palette names, whatever the ground round it)
    diffuseColor.rgb = mix( diffuseColor.rgb, uPathBase, ws[ 4 ] / max( 1e-4, tw ) );
    diffuseColor.rgb = mix( diffuseColor.rgb, uClayBase, ws[ 5 ] / max( 1e-4, tw ) );
    diffuseColor.rgb = mix( diffuseColor.rgb, uUnderBase, ws[ 6 ] / max( 1e-4, tw ) );
    // (and a kept scree stone its stone's, wherever it lies: on a trail the corners under it are the land's, not rock's)
    diffuseColor.rgb = mix( diffuseColor.rgb, uStoneBase, ws[ 1 ] / max( 1e-4, tw ) );
    // (the ledges' dirt toward the dry powder's tone: the rock's own grit and the dust blown onto it)
    diffuseColor.rgb = mix( diffuseColor.rgb, mix( diffuseColor.rgb, uPathBase, 0.55 ), dirtFrac * ws[ 2 ] / max( 1e-4, tw ) );
    diffuseColor.rgb *= mb * mix( 1.0, mr.x, 0.5 );
    roughnessFactor = clamp( mr.y * uRough, 0.04, 1.0 );
    // the ground's own PARALLAX KINDS (GROUND_PARALLAX): PEBBLES packed in the bare soil where it is damp, in the scree's
    // fines between its stones and on a pebbled stretch of trail; CRACKED EARTH, dry mud in curled plates, in the bare soil
    // where it is dry and on a cracked stretch of trail; FRACTURED PLATES, a second rock in patches over the rock. Each
    // marched along the view near (eight steps), its normal from its own height, its detail fading by its cells' size on
    // the screen, so nothing sparkles far off
    {
      float sS = ws[ 2 ] / max( 1e-4, tw ), rS = ws[ 0 ] / max( 1e-4, tw );
      float gBare = uHasG > 0.5 ? 1.0 - texture2D( tGrassL, ( vWPos.xy - uGOl ) / uGMl ).b : 1.0;
      float bare = sS * smoothstep( 0.15, 0.7, gBare ) * smoothstep( 0.55, 0.8, nW.z );
      float dryF = smoothstep( 0.45, 0.65, vn( vWPos.xy / ${GROUND_PARALLAX.dry.toFixed(1)} + 4.2 ) );
      float tvF = vn( vWPos.xy / ${GROUND_PARALLAX.stretch.toFixed(1)} + 55.0 ), tPeb = 1.0 - smoothstep( 0.28, 0.38, tvF ), tCrk = smoothstep( 0.62, 0.72, tvF );
      float fines = vSplat.y * ( 1.0 - kept ) * smoothstep( 0.55, 0.8, nW.z ) * ( 1.0 - pw );
      float wK0 = clamp( bare * ( 1.0 - dryF ) + tsh * tPeb + fines * 0.9, 0.0, 1.0 ), wK1 = clamp( bare * dryF + tsh * tCrk, 0.0, 1.0 );
      float wK2 = rS * 0.85 * smoothstep( 0.5, 0.62, vn( vWPos.xy / 6.0 + vWPos.z * 0.35 + 9.0 ) ), wMax = max( wK0, max( wK1, wK2 ) );
      if ( wMax > 0.02 ) {
        int kd = wK0 >= wMax ? 0 : wK1 >= wMax ? 1 : 2;
        float cellK = kd == 0 ? ${GROUND_PARALLAX.pebbles.cell.toFixed(3)} : kd == 1 ? ${GROUND_PARALLAX.cracks.cell.toFixed(3)} : ${GROUND_PARALLAX.plates.cell.toFixed(3)};
        float depK = kd == 0 ? ${GROUND_PARALLAX.pebbles.depth.toFixed(3)} : kd == 1 ? ${GROUND_PARALLAX.cracks.depth.toFixed(3)} : ${GROUND_PARALLAX.plates.depth.toFixed(3)};
        vec2 gp = uvW / cellK;
        float detK = 1.0 - smoothstep( 0.25, 0.7, length( fwidth( gp ) ) );
        if ( detK > 0.0 ) {
          if ( camD < ${GROUND_PARALLAX.near.toFixed(1)} ) {
            vec3 V5 = normalize( cameraPosition - vWPos ), vt5 = vec3( dot( V5, tT ), dot( V5, tB ), dot( V5, nW ) );
            vec2 dG = vt5.xy / max( vt5.z, 0.3 ) * ( depK / cellK ) * ( 1.0 - smoothstep( ${(GROUND_PARALLAX.near * 0.6).toFixed(1)}, ${GROUND_PARALLAX.near.toFixed(1)}, camD ) ) / 8.0;
            float lG = 0.0, hG = 1.0 - gHt( kd, gp );
            for ( int k = 0; k < 8; k++ ) { if ( lG >= hG ) break; gp -= dG; hG = 1.0 - gHt( kd, gp ); lG += 0.125; }
          }
          float h0 = gHt( kd, gp ), hx = gHt( kd, gp + vec2( 0.04, 0.0 ) ), hy = gHt( kd, gp + vec2( 0.0, 0.04 ) );
          vec3 gN = normalize( vec3( ( h0 - hx ) * depK / ( 0.04 * cellK ), ( h0 - hy ) * depK / ( 0.04 * cellK ), 1.0 ) );
          float wG = wMax * detK, cz = vor5( gp ).z;
          mn = normalize( mix( mn, gN, wG ) );
          float peb = step( 0.001, h0 ), tone = kd == 0 ? mix( 0.9, mix( 0.72, 1.2, cz ) * mix( 0.7, 1.05, h0 ), peb ) : kd == 1 ? mix( 0.42, 1.08, smoothstep( 0.0, 0.6, h0 ) ) : mix( 0.62, 1.12, cz ) * mix( 0.55, 1.0, h0 );
          // (a pebble takes a stone's own colour more than the soil's)
          diffuseColor.rgb *= mix( 1.0, tone, wG );
          if ( kd == 0 ) diffuseColor.rgb = mix( diffuseColor.rgb, uStoneBase * tone * mix( 0.85, 1.1, fract( cz * 13.0 ) ), 0.7 * peb * wG );
          roughnessFactor = mix( roughnessFactor, kd == 1 ? 0.95 : 0.8, wG * 0.5 );
        }
      }
    }
    vec3 dustC = mix( uPathBase, vec3( dot( uPathBase, vec3( 0.2126, 0.7152, 0.0722 ) ) ), 0.35 ) * 1.25 * mix( vec3( 1.0 ), mb, 0.3 );
    diffuseColor.rgb = mix( diffuseColor.rgb, dustC, dust * 0.85 ); roughnessFactor = mix( roughnessFactor, 1.0, dust ); mn = normalize( mix( mn, vec3( 0.0, 0.0, 1.0 ), dust * 0.6 ) );
    // (the sand WET by its height over the water, at this point, not face by face: the line it leaves follows the
    // shore smoothly, wandering a little, and only the sand's share darkens and shines; under the line its own colour
    // takes over, the sea's)
    float wet = ( 1.0 - smoothstep( 0.0, uWet.y, abs( vWPos.z - uWet.x + ( vn( vWPos.xy / 1.7 + 3.1 ) - 0.5 ) * uWet.y * 0.8 ) ) ) * ws[ 3 ] / max( 1e-4, tw );
    diffuseColor.rgb *= mix( 1.0, uWet.z, wet );
    roughnessFactor = mix( roughnessFactor, uWet.w, wet );
    // the FAR FIELD's blanket past the view cone's reach: the grass one colour, offset by its cells (channels/far-field.js)
    { vec4 fb = farBlanket( vWPos, nW ); if ( fb.a > 0.0 ) { diffuseColor.rgb = mix( diffuseColor.rgb, fb.rgb, fb.a ); roughnessFactor = mix( roughnessFactor, 0.8, fb.a ); mn = normalize( mix( mn, vec3( 0.0, 0.0, 1.0 ), fb.a ) ); } }
    normal = normalize( ( viewMatrix * vec4( normalize( tT * mn.x + tB * mn.y + nW * mn.z ), 0.0 ) ).xyz );\`);
${form.dunes ? `      sh.fragmentShader = DUNE_HEAD + sh.fragmentShader.replace('    // (the sand WET', DUNE_SAND + '    // (the sand WET'); Object.assign(sh.uniforms, DUNE_U);\n` : ''}${form.snow ? `      sh.fragmentShader = SNOW_HEAD + sh.fragmentShader.replace('    // (the sand WET', SNOW_COVER + '    // (the sand WET'); Object.assign(sh.uniforms, SNOW_U);\n` : ''}${form.dunes || form.snow ? `      sh.fragmentShader = PRINT_HEAD + sh.fragmentShader.replace('    // (the sand WET', PRINT_PRESS + '    // (the sand WET'); Object.assign(sh.uniforms, PRINT_U);\n` : ''}    };
    m.customProgramCacheKey = () => 'layered-ground${form.dunes ? '-dunes' : ''}${form.snow ? '-snow' : ''}';
    return m;
  }
  // the ROCK'S RELIEF (form/rock-relief.js): the cliff's steep faces cut finer and pushed in and out along their normals by
  // the relief's map, sampled along both side axes and blended as the rock's texture is (its beds level on either);
  // nothing moves on level ground (benches and tops stay as walked) or at a corner another class shares (no cracks), and a
  // face left whole has its every edge so; normals rebuilt over the points the cut faces share. It only carves: the map's
  // highest point at the land as built, so nothing stands proud of it (a house set against a cliff, a stair at its foot
  // stay in front of the rock; the walker, who stands on the land as built, never stands inside it)
  const RF = D.relief && (() => { const q = new Uint16Array(bytes(D.relief.px).buffer), sp = D.relief.hi - D.relief.lo; return { N: D.relief.size, T: D.relief.tile, h: Float32Array.from(q, (v) => (v / 65535 - 1) * sp) }; })();
  const sst = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const steepOf = (nz) => 1 - sst(0.5, 0.8, Math.abs(nz));
  function reliefAt(x, y, z, nx, ny, nz) {
    const st = steepOf(nz); if (st <= 0) return 0;
    const { N, T, h } = RF, samp = (u, v) => {
      const fx = (((u / T) % 1) + 1) % 1 * N - 0.5, fy = (((v / T) % 1) + 1) % 1 * N - 0.5, i = Math.floor(fx), j = Math.floor(fy), ax = fx - i, ay = fy - j;
      const at = (a, b) => h[(((b % N) + N) % N) * N + (((a % N) + N) % N)];
      return (at(i, j) * (1 - ax) + at(i + 1, j) * ax) * (1 - ay) + (at(i, j + 1) * (1 - ax) + at(i + 1, j + 1) * ax) * ay;
    };
    const aX = Math.abs(nx), aY = Math.abs(ny), bx = aX / Math.max(1e-4, aX + aY);
    const [u1, u2, w2] = aX >= aY ? [y * Math.sign(nx), -x * Math.sign(ny), 0.5 * (1 - sst(0, 0.12, bx - 0.5))] : [-x * Math.sign(ny), y * Math.sign(nx), 0.5 * (1 - sst(0, 0.12, 0.5 - bx))];
    return st * ((1 - w2) * samp(u1, z) + w2 * samp(u2, z));
  }
  function reliefPart(R) {
    const key = (x, y, z) => Math.round(x * 500) + ',' + Math.round(y * 500) + ',' + Math.round(z * 500), NS = 6;
    const others = new Set(); for (const Q of D.ranges) if (Q !== R) for (let v = Q.start; v < Q.start + Q.count; v++) others.add(key(POS[v * 3], POS[v * 3 + 1], POS[v * 3 + 2]));
    const P = [], CO = [], SP = [], NI = [], WK = [], cut = [];
    const push = (p, c, s, n, w, k) => { P.push(p[0], p[1], p[2]); CO.push(c[0], c[1], c[2], c[3]); SP.push(s[0], s[1], s[2], s[3]); NI.push(n[0], n[1], n[2]); WK.push(w); cut.push(k); };
    const corner = (v) => ({ p: [POS[v * 3], POS[v * 3 + 1], POS[v * 3 + 2]], c: [C7[v * 4], C7[v * 4 + 1], C7[v * 4 + 2], C7[v * 4 + 3]], s: [SPL[v * 4], SPL[v * 4 + 1], SPL[v * 4 + 2], SPL[v * 4 + 3]], n: [NRM[v * 3] / 127, NRM[v * 3 + 1] / 127, NRM[v * 3 + 2] / 127] });
    const mix3 = (A, B, Cc, a, b, c) => A.map((_, k) => A[k] * c + B[k] * a + Cc[k] * b);
    for (let v = R.start; v < R.start + R.count; v += 3) {
      const K = [corner(v), corner(v + 1), corner(v + 2)], free = K.map((q) => (others.has(key(...q.p)) ? 0 : 1));
      // (left whole: every corner shared, or every corner level, so its every edge stands still on the cut side too)
      if (free.every((f) => !f) || K.every((q) => steepOf(q.n[2]) <= 0)) { for (const q of K) push(q.p, q.c, q.s, q.n, 0, 0); continue; }
      const idx = (i, j) => i * (NS + 1) - (i * (i - 1)) / 2 + j, pts = [];
      for (let i = 0; i <= NS; i++) for (let j = 0; j <= NS - i; j++) {
        const a = i / NS, b = j / NS, c = 1 - a - b, p = mix3(K[0].p, K[1].p, K[2].p, a, b, c), nr = mix3(K[0].n, K[1].n, K[2].n, a, b, c), l = Math.hypot(...nr) || 1, n = nr.map((x) => x / l);
        const w = free[0] * c + free[1] * a + free[2] * b, d = w * reliefAt(p[0], p[1], p[2], n[0], n[1], n[2]);
        pts.push([p.map((x, k) => x + n[k] * d), mix3(K[0].c, K[1].c, K[2].c, a, b, c), mix3(K[0].s, K[1].s, K[2].s, a, b, c), n, w * steepOf(n[2])]);
      }
      const tri = (q0, q1, q2) => { for (const q of [q0, q1, q2]) { const t = pts[q]; push(t[0], t[1], t[2], t[3], t[4], 1); } };
      for (let i = 0; i < NS; i++) for (let j = 0; j < NS - i; j++) {
        tri(idx(i, j), idx(i + 1, j), idx(i, j + 1));
        if (j < NS - i - 1) tri(idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1));
      }
    }
    // (the cut faces' normals: each point's the area-weighted mean of the faces round it, by where it stands; blended back
    // to the land's own where nothing moved, so the cut and the whole meet without a crease)
    const n = P.length / 3, acc = new Map(), fn = new Float32Array(n * 3);
    for (let t = 0; t < n; t += 3) {
      if (!cut[t]) continue;
      const a = t * 3, e1 = [P[a + 3] - P[a], P[a + 4] - P[a + 1], P[a + 5] - P[a + 2]], e2 = [P[a + 6] - P[a], P[a + 7] - P[a + 1], P[a + 8] - P[a + 2]];
      const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      for (let k = 0; k < 3; k++) { const q = key(P[(t + k) * 3], P[(t + k) * 3 + 1], P[(t + k) * 3 + 2]), s = acc.get(q) ?? [0, 0, 0]; s[0] += cr[0]; s[1] += cr[1]; s[2] += cr[2]; acc.set(q, s); }
    }
    for (let v = 0; v < n; v++) {
      let nx = NI[v * 3], ny = NI[v * 3 + 1], nz = NI[v * 3 + 2];
      if (cut[v]) {
        const s = acc.get(key(P[v * 3], P[v * 3 + 1], P[v * 3 + 2])), l = Math.hypot(...s) || 1, k = sst(0, 0.25, WK[v]);
        nx += (s[0] / l - nx) * k; ny += (s[1] / l - ny) * k; nz += (s[2] / l - nz) * k;
      }
      const l = Math.hypot(nx, ny, nz) || 1; fn[v * 3] = nx / l; fn[v * 3 + 1] = ny / l; fn[v * 3 + 2] = nz / l;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(P), 3));
    g.setAttribute('color', new THREE.BufferAttribute(Float32Array.from(CO), 4));
    g.setAttribute('splat', new THREE.BufferAttribute(Uint8Array.from(SP, (x) => Math.round(x)), 4, true));
    g.setAttribute('normal', new THREE.BufferAttribute(fn, 3));
    window.__formRelief = { triangles: n / 3, cut: cut.filter(Boolean).length / 3 };
    return g;
  }
  const sunLight = window.__formSun = new THREE.DirectionalLight(...solved(D.light.sun)); sunLight.castShadow = true;
  const [bx, by, bz] = D.box, mid = new THREE.Vector3((bx[0] + bx[1]) / 2, (by[0] + by[1]) / 2, (bz[0] + bz[1]) / 2), rad = Math.hypot(bx[1] - bx[0], by[1] - by[0], bz[1] - bz[0]) / 2;
  Object.assign(sunLight.shadow.camera, { left: -rad, right: rad, top: rad, bottom: -rad, near: 0.5, far: rad * 4 });
  sunLight.shadow.mapSize.set(4096, 4096); sunLight.shadow.bias = -0.0004; sunLight.shadow.normalBias = 0.04;
  // (the cube's sun at its hour: from the light's direction, far off the land's middle)
  sunLight.target.position.copy(mid); sunLight.position.copy(mid).addScaledVector(new THREE.Vector3(...D.sun).normalize(), rad * 2); scene.add(sunLight, sunLight.target);
  for (const R of D.ranges) {
    const water = R.key === 'water';
    // (the sea one plane where there is a depth to fade it by; what the read could not class stays painted)
    if ((water && D.depth) || R.key === 'unread') continue;
    const m = water
      ? new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: R.rough, metalness: 0, transparent: true, depthWrite: false, envMap: skyEnv, envMapIntensity: 1 })
      : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: R.rough, metalness: 0, side: THREE.DoubleSide });
    const ground = !water && D.layers.keys.includes(R.key.split(':')[0]);
    if (ground) layeredGround(m, 1);
    // (the land is shaded flat, its normals the faces'; the sea's are its own; the shallows' floor, all but level, lit as
    // one surface facing up, so its faces never show through the sea as facets)
    const floor = R.key === 'sand:under', g = RF && R.key === 'cliff' ? reliefPart(R) : part(R, C7, { splat: ground, smooth: !water && !floor && R.key !== 'unread' });
    if (water) g.computeVertexNormals();
    if (floor) g.setAttribute('normal', new THREE.BufferAttribute(Float32Array.from({ length: R.count * 3 }, (_, i) => (i % 3 === 2 ? 1 : 0)), 3));
    const mesh = new THREE.Mesh(g, m); mesh.castShadow = !water; mesh.receiveShadow = true; scene.add(mesh); __formMeshes.push(mesh);
  }
  if (D.depth) {
    const Q = D.depth, dm = new THREE.DataTexture(bytes(Q.px), Q.size[0], Q.size[1], THREE.RGBAFormat); dm.magFilter = dm.minFilter = THREE.LinearFilter; dm.needsUpdate = true;
    const w = Q.size[0] * Q.cell, h = Q.size[1] * Q.cell, B = D.seabed, g = new THREE.PlaneGeometry(B.x[1] - B.x[0], B.y[1] - B.y[0]); g.translate((B.x[0] + B.x[1]) / 2, (B.y[0] + B.y[1]) / 2, D.waterZ);
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(D.light.sea.base), roughness: D.classes.water, metalness: 0, transparent: true, depthWrite: false, envMap: skyEnv, envMapIntensity: 1, opacity: 0.9 });
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { tDepth: { value: dm }, uDO: { value: new THREE.Vector2(Q.origin[0] - Q.cell / 2, Q.origin[1] - Q.cell / 2) }, uDM: { value: new THREE.Vector2(w, h) }, uDMax: { value: Q.max } });
      sh.vertexShader = 'varying vec2 vSeaXY;\\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\\n  vSeaXY = ( modelMatrix * vec4( transformed, 1.0 ) ).xy;');
      sh.fragmentShader = 'uniform sampler2D tDepth;\\nuniform vec2 uDO, uDM;\\nuniform float uDMax;\\nvarying vec2 vSeaXY;\\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\\n  vec2 du = ( vSeaXY - uDO ) / uDM;\\n  diffuseColor.a *= du.x < 0.0 || du.y < 0.0 || du.x > 1.0 || du.y > 1.0 ? 1.0 : smoothstep( 0.0, uDMax, texture2D( tDepth, du ).r * uDMax );');
    };
    m.customProgramCacheKey = () => 'sea-plane';
    const sea = new THREE.Mesh(g, m); sea.receiveShadow = true; scene.add(sea);
  }
  // the stones: a few shapes (broken as the rock studies break a rock), each drawn instanced, every stone turned to its
  // ground's normal, yawed by its index (no light is baked in them, so a turn is free), toned about the stone's base
  if (D.stones.n) {
    const SP = new Float32Array(bytes(D.stones.px).buffer), per = 9, hsh = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(...D.stones.base.map((v) => Math.min(1, v)), THREE.LinearSRGBColorSpace), roughness: 0.85, metalness: 0 });
    // (its skin the rock layer's, the crag's, mapped in the world along the dominant axis as the ground's is, its colour
    // about the layer's mean over the stone's solved base)
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { tBase: LAYER_U.tBase, uTile0: { value: D.layers.tile[0] / 6 }, uMean0: { value: LAYER_U.uMean.value[0] } });
      sh.vertexShader = 'varying vec3 vSW;\\nvarying vec3 vSN;\\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\\n  vec4 sw = modelMatrix * instanceMatrix * vec4( transformed, 1.0 ); vSW = sw.xyz; vSN = normalize( mat3( modelMatrix * instanceMatrix ) * objectNormal );');
      sh.fragmentShader = 'uniform sampler2DArray tBase;\\nuniform float uTile0;\\nuniform vec3 uMean0;\\nvarying vec3 vSW;\\nvarying vec3 vSN;\\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\\n  vec3 aN = abs( vSN ); vec2 su = aN.z >= aN.x && aN.z >= aN.y ? vSW.xy : aN.x >= aN.y ? vSW.yz : vSW.xz;\\n  diffuseColor.rgb *= texture( tBase, vec3( su / uTile0, 0.0 ) ).rgb / uMean0;');
    };
    mat.customProgramCacheKey = () => 'scree-stone';
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qy = new THREE.Quaternion(), up = new THREE.Vector3(0, 0, 1), nv = new THREE.Vector3(), pv = new THREE.Vector3(), sv = new THREE.Vector3(), col = new THREE.Color();
    // (each shape as the rock studies break a rock: chipped for the stones that cast, its block of fractures for the
    // small; creased normals, so a fracture's edge stays sharp; land-stones.js stoneForms)
    const formGeo = (F) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bytes(F.pos).buffer), 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(bytes(F.nrm).buffer), 3, true)); return g; };
    for (let v = 0; v < D.stones.shapes; v++) {
      const geo = { true: formGeo(D.stones.forms.near[v]), false: formGeo(D.stones.forms.far[v]) };
      // (a stone under CAST_R casts nothing: its shadow is finer than the map's texel, a smudge beside it)
      const CAST_R = 0.18;
      for (const big of [true, false]) {
      const idx = []; for (let i = 0; i < D.stones.n; i++) if (SP[i * per + 8] === v && (SP[i * per + 3] >= CAST_R) === big) idx.push(i);
      if (!idx.length) continue;
      const im = new THREE.InstancedMesh(geo[big], mat, idx.length);
      idx.forEach((i, k) => {
        const o = i * per, r = SP[o + 3]; nv.set(SP[o + 4], SP[o + 5], SP[o + 6]).normalize();
        q.setFromUnitVectors(up, nv); qy.setFromAxisAngle(up, i * 2.399); q.multiply(qy);
        m4.compose(pv.set(SP[o], SP[o + 1], SP[o + 2]), q, sv.set(r * (0.9 + 0.3 * hsh(i, 1)), r * (0.8 + 0.3 * hsh(i, 2)), r)); im.setMatrixAt(k, m4);
        im.setColorAt(k, col.setRGB(SP[o + 7], SP[o + 7], SP[o + 7]));
      });
      im.castShadow = big; im.receiveShadow = true; scene.add(im);
      }
    }
  }
${viewConeScript(form.cone || null)}${formGrassScript()}${flora ? formFloraScript(flora, { snow: !!form.snow }) : ''}${farFieldScript()}
  // open sea: deep water's colour under it, where the recipe lays no floor (the shallows' floor fades into the same colour)
  if (D.seabed) { const B = D.seabed, g = new THREE.PlaneGeometry(B.x[1] - B.x[0], B.y[1] - B.y[0]); g.translate((B.x[0] + B.x[1]) / 2, (B.y[0] + B.y[1]) / 2, B.z);
    scene.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: rgb(D.deep), roughness: 1, metalness: 0 }))); }
  // the painted land it draws in its place, and the painted water sheet under its sea (a standalone sheet: per-vertex
  // alpha, not one of the named groups)
  const __formNamed = new Set(Object.values(meshes));
  for (const g of D.hides) if (meshes[g]) meshes[g].visible = false;${flora ? `
  // (the plants' groups wholly: a group drawn in several meshes, its faces split by their tiles, is one name in \`meshes\`)
  { const H = new Set(D.hides); scene.traverse((o) => { if (o.isMesh && H.has(o.userData.g)) o.visible = false; }); }` : ''}
  if (D.depth) for (const o of __formBefore) if (o.isMesh && !__formNamed.has(o) && o.material.isMeshBasicMaterial && o.material.transparent && o.geometry.getAttribute('color')?.itemSize === 4) o.visible = false;
  for (const o of __formBefore) for (const m of [].concat(o.material)) { m.toneMapped = false; m.needsUpdate = true; }
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  // (a live light's sun casts its shadows still, but lights nothing: the form's sun is the land's one sun)
  scene.traverse((o) => { if (o.isDirectionalLight && o !== sunLight) o.intensity = 0; });
  // (the land and the sun stand still: its map drawn once, not every frame, as the live light's hour map is)
  sunLight.shadow.autoUpdate = false; sunLight.shadow.needsUpdate = true;
  window.__formReady = true;
})();
`;
}

/** The dunes' sand (era/out-dunes.js duneMap, `form.dunes`): its uniforms and the shader's piece, spliced in before the wet
 *  sand; a land with no dunes has none of it. */
function duneScript() {
  return `  // the DUNES' sand (era/out-dunes.js): ripples across the wind, streaks down a slip face, grains catching the sun
  const DM = new THREE.DataTexture(bytes(D.dunes.px), D.dunes.size[0], D.dunes.size[1], THREE.RGBAFormat); DM.magFilter = DM.minFilter = THREE.LinearFilter; DM.needsUpdate = true;
  const DUNE_U = { tDune: { value: DM }, uDuneW: { value: new THREE.Vector2(...D.dunes.wind) }, uDuneO: { value: new THREE.Vector2(...D.dunes.origin.map((v) => v - D.dunes.cell / 2)) }, uDuneM: { value: new THREE.Vector2(D.dunes.size[0] * D.dunes.cell, D.dunes.size[1] * D.dunes.cell) } };
  const DUNE_HEAD = ${JSON.stringify(DUNE_HEAD)}, DUNE_SAND = ${JSON.stringify(DUNE_SAND)};
`;
}
// (the wind the way the sand travels; the map's red how much dune stands there, its green near a crest)
const DUNE_HEAD = 'uniform sampler2D tDune;\nuniform vec2 uDuneW, uDuneO, uDuneM;\n';
// RIPPLES: crests across the wind ~11 cm apart, their stoss gentle and their lee steep, wandering and forking, on the
// dunes' backs and the flats between, none on a slip face; they fade before they alias, and the sand's own tile is calmed
// under them. A SLIP FACE (steep, falling downwind): the sand avalanched down it in streaks along the fall line. GLINT: a
// grain in a hundred, a centimetre across, turned its own way and polished, so the sun's highlight catches it (lit and
// shadowed by the light, never drawn over it).
const DUNE_SAND = `    float sandK = ws[ 3 ] / max( 1e-4, tw );
    if ( sandK > 0.01 ) {
      vec4 dm = texture2D( tDune, ( vWPos.xy - uDuneO ) / uDuneM );
      vec2 Wd = uDuneW, Pd = vec2( -Wd.y, Wd.x ), gd = nW.xy;
      float slope = length( gd ) / max( 0.2, nW.z ); vec2 down = length( gd ) > 1e-4 ? normalize( gd ) : Wd;
      float lee = smoothstep( 0.35, 0.55, slope ) * smoothstep( 0.1, 0.5, dot( down, Wd ) ), flt = 1.0 - smoothstep( 0.4, 0.65, slope );
      vec3 nw = normalize( tT * mn.x + tB * mn.y + nW * mn.z );
      float sd = dot( vWPos.xy, Wd ), qd = dot( vWPos.xy, Pd );
      // (their spacing wanders over a couple of metres, so crests merge and fork where it tightens; each crest wavers)
      float lam = 0.11 * ( 0.8 + 0.4 * vn( vWPos.xy / 2.2 + 41.0 ) );
      float ph = ( sd + 0.09 * ( vn( vec2( qd / 0.6, sd / 1.8 ) + 9.0 ) - 0.5 ) + 0.04 * ( vn( vec2( qd / 0.22, sd / 0.5 ) + 2.0 ) - 0.5 ) ) / lam;
      float aa = 1.0 - smoothstep( 0.12, 0.35, fwidth( ph ) );
      float rk = sandK * aa * flt * ( 1.0 - lee ) * mix( 0.55, 1.0, dm.r ) * ( 0.75 + 0.5 * vn( vec2( qd / 3.0, sd / 6.0 ) + 31.0 ) );
      if ( rk > 0.001 ) {
        float t = fract( ph ), w = t < 0.7 ? t / 0.7 * 0.5 : 0.5 + ( t - 0.7 ) / 0.3 * 0.5, dw = t < 0.7 ? 0.5 / 0.7 : 0.5 / 0.3;
        float dh = 0.0032 * 3.14159 * sin( 6.28318 * w ) * dw / lam;
        nw = normalize( mix( nw, nW, 0.45 * rk ) - vec3( Wd * dh * rk, 0.0 ) );
        // (the coarser grains gather on a crest: a shade paler there)
        diffuseColor.rgb *= 1.0 + 0.05 * rk * ( 0.5 - 0.5 * cos( 6.28318 * w ) - 0.5 );
      }
      float sk = sandK * lee * ( 1.0 - smoothstep( 0.3, 0.8, fwidth( dot( vWPos.xy, vec2( -down.y, down.x ) ) / 0.12 ) ) * 0.5 );
      if ( sk > 0.001 ) {
        vec2 sp = vec2( -down.y, down.x ); float sa = dot( vWPos.xy, sp ), sb = dot( vWPos.xy, down );
        float st = vn( vec2( sa / 0.35, sb / 4.0 ) + 5.0 ) * 0.7 + vn( vec2( sa / 0.12, sb / 1.4 ) + 13.0 ) * 0.3 - 0.5;
        diffuseColor.rgb *= 1.0 + st * 0.22 * sk; roughnessFactor = mix( roughnessFactor, roughnessFactor * ( 1.0 - 0.25 * st ), sk );
      }
      vec2 gc = floor( vWPos.xy / 0.012 ); float gh = hn( gc + 0.5 ), ga = sandK * ( 1.0 - smoothstep( 0.35, 0.9, fwidth( vWPos.x / 0.012 ) ) );
      if ( gh > 0.99 && ga > 0.001 ) {
        vec3 gj = vec3( hn( gc + 7.3 ) - 0.5, hn( gc + 3.1 ) - 0.5, 0.0 ) * 1.4;
        nw = normalize( mix( nw, normalize( nw + gj ), ga ) ); roughnessFactor = mix( roughnessFactor, 0.06, ga ); metalnessFactor = mix( metalnessFactor, 0.5, ga );
      }
      mn = vec3( dot( nw, tT ), dot( nw, tB ), dot( nw, nW ) );
    }
`;

/** The snow over the ground (era/snow.js snowMap, `form.snow`): its uniforms and the shader's piece, spliced in before
 *  the wet sand; a land with no snow has none of it. */
function snowScript() {
  return `  // the SNOW over the ground (era/snow.js): as it lies, level enough to hold it, its path trodden
  const SM = new THREE.DataTexture(bytes(D.snow.px), D.snow.size[0], D.snow.size[1], THREE.RGBAFormat); SM.magFilter = SM.minFilter = THREE.LinearFilter; SM.needsUpdate = true;
  const SNOW_U = { tSnow: { value: SM }, uSnowO: { value: new THREE.Vector2(...D.snow.origin.map((v) => v - D.snow.cell / 2)) }, uSnowM: { value: new THREE.Vector2(D.snow.size[0] * D.snow.cell, D.snow.size[1] * D.snow.cell) },
    uSnowD: { value: new THREE.Vector4(D.snow.depth, D.snow.hold, D.snow.depth >= 0.1 ? 0.2 : 0.5, D.snow.drift) }, uSnowBase: { value: new THREE.Vector3(...D.snow.base) } };
  const SNOW_HEAD = ${JSON.stringify(SNOW_HEAD)}, SNOW_COVER = ${JSON.stringify(SNOW_COVER)};
`;
}
// (the map's red how much snow lies there; depth, hold, how worn the trodden path, drift)
const SNOW_HEAD = 'uniform sampler2D tSnow;\nuniform vec2 uSnowO, uSnowM;\nuniform vec4 uSnowD;\nuniform vec3 uSnowBase;\n';
// THE SNOW: laid over whatever ground is here as the map says it lies, held per pixel only where the ground is level
// enough (its own normal: a rock's ledge white, its face bare), its edge wandering in and out over a metre and finer; it
// buries the ground's own detail (deeper, more), swells in soft drifts, and glitters (a grain in fifty, turned its own way
// and polished, lit through the light). On the trail it is trodden: packed, greyed, the soil showing through as far as it
// is shallow.
const SNOW_COVER = `    float snowKo = 0.0;
    {
      vec2 su = ( vWPos.xy - uSnowO ) / uSnowM;
      float sc = ( su.x > 0.0 && su.y > 0.0 && su.x < 1.0 && su.y < 1.0 ) ? texture2D( tSnow, su ).r : 0.0;
      float hold = smoothstep( uSnowD.y - 0.1, uSnowD.y + 0.03, nW.z );
      float en = vn( vWPos.xy / 1.1 + 71.0 ) * 0.6 + vn( vWPos.xy / 0.28 + 3.0 ) * 0.4 - 0.5;
      float snowK = smoothstep( 0.3, 0.5, sc * hold + en * 0.3 ); snowKo = snowK;
      if ( snowK > 0.001 ) {
        vec3 nw = normalize( tT * mn.x + tB * mn.y + nW * mn.z );
        // (it buries the ground's detail, and swells in drifts a couple of metres across)
        float bury = clamp( 0.55 + uSnowD.x * 2.5, 0.55, 0.95 );
        vec2 e = vec2( 0.35, 0.0 ), q = vWPos.xy / 2.2;
        vec2 dg = vec2( vn( q + e.xy ) - vn( q - e.xy ), vn( q + e.yx ) - vn( q - e.yx ) ) / ( 2.0 * 0.35 * 2.2 );
        vec3 ns = normalize( mix( nw, nW, bury ) - vec3( dg * 0.35 * min( 1.0, uSnowD.x * 6.0 ), 0.0 ) );
        vec3 sb = uSnowBase * ( 0.97 + 0.06 * vn( vWPos.xy / 3.0 + 13.0 ) );
        // (trodden on the trail: packed and greyed, the soil through it as far as it is shallow)
        float trod = pw * snowK;
        sb = mix( sb, mix( sb * 0.86, uPathBase, uSnowD.z ), trod );
        float rs = mix( 0.72, 0.55, trod );
        vec2 gc = floor( vWPos.xy / 0.008 ); float gh = hn( gc + 0.5 ), ga = ( 1.0 - trod ) * ( 1.0 - smoothstep( 0.35, 0.9, fwidth( vWPos.x / 0.008 ) ) );
        if ( gh > 0.98 && ga > 0.001 ) { vec3 gj = vec3( hn( gc + 7.3 ) - 0.5, hn( gc + 3.1 ) - 0.5, 0.0 ) * 1.6; ns = normalize( mix( ns, normalize( ns + gj ), ga ) ); rs = mix( rs, 0.05, ga ); metalnessFactor = mix( metalnessFactor, 0.6 * snowK, ga ); }
        diffuseColor.rgb = mix( diffuseColor.rgb, sb, snowK );
        roughnessFactor = mix( roughnessFactor, rs, snowK );
        nw = normalize( mix( nw, ns, snowK ) );
        mn = vec3( dot( nw, tT ), dot( nw, tB ), dot( nw, nW ) );
      }
    }
`;

/** The PRINTS (sand: the dunes; snow: era/snow.js): the walker's feet pressed into what is soft under them, drawn by the
 *  layered ground from a map that moves with the walker; the wind fills them back. Only on a land with dunes or snow. */
export const PRINTS = Object.freeze({ texels: 512, metres: 12, step: 0.8, apart: 0.1, max: 320, sand: { depth: 0.035, fill: 60 }, snow: { most: 0.12, fill: 600 } });
function printScript(form) {
  return `  // the PRINTS: each step of the walker on sand or snow pressed into it (a sole, its rim pushed up), on a map that moves
  // with the walker (PRINTS.metres across, PRINTS.texels a side), the wind filling each back over its own time (sand
  // quickly, snow slowly); window.__formPrints: stamp, walk (a line of steps), stats
  const PR = ${JSON.stringify(PRINTS)}, PRT = new THREE.DataTexture(new Uint8Array(PR.texels * PR.texels).fill(128), PR.texels, PR.texels, THREE.RedFormat);
  PRT.magFilter = PRT.minFilter = THREE.LinearFilter; PRT.needsUpdate = true;
  const PRINT_U = { tPrint: { value: PRT }, uPrintO: { value: new THREE.Vector2(-1e4, -1e4) }, uPrintM: { value: PR.metres }, uPrintD: { value: new THREE.Vector2(PR.sand.depth, ${form.snow ? 'Math.min(PR.snow.most, D.snow.depth * 0.6)' : '0'}) } };
  const prints = [], prTx = PR.metres / PR.texels;
  // what the foot lands in: snow where the map lays it, else sand
  const onSnowAt = ${form.snow ? `(x, y) => { const i = Math.round((x - D.snow.origin[0]) / D.snow.cell), j = Math.round((y - D.snow.origin[1]) / D.snow.cell); return i >= 0 && j >= 0 && i < D.snow.size[0] && j < D.snow.size[1] && SM.image.data[(j * D.snow.size[0] + i) * 4] > 90; }` : '() => false'};
  // a sole in its own frame (u along the step, v across, metres): heel and ball joined, its depth with a soft wall, its rim
  const sole = (u, v) => {
    const e = (cu, ru, rv) => Math.hypot((u - cu) / ru, v / rv) - 1, a = e(-0.075, 0.05, 0.042), b = e(0.05, 0.075, 0.05);
    const k = 0.6, h = Math.max(0, Math.min(1, 0.5 + 0.5 * (b - a) / k)), d = (b * (1 - h) + a * h - k * h * (1 - h)) * 0.045;
    return d < 0 ? -Math.min(1, -d / 0.012) * (0.85 + 0.15 * Math.sin(u * 160)) : 0.35 * Math.exp(-(((d - 0.01) / 0.01) ** 2));
  };
  function rasterPrints(now) {
    const N = PR.texels, A = PRT.image.data, [ox, oy] = PRINT_U.uPrintO.value.toArray(), H = new Float32Array(N * N);
    for (let k = prints.length - 1; k >= 0; k--) {
      const p = prints[k], amp = Math.exp(-(now - p.t) / (p.snow ? PR.snow.fill : PR.sand.fill));
      if (amp < 0.03) { prints.splice(k, 1); continue; }
      const c = Math.cos(p.yaw), s = Math.sin(p.yaw), i0 = Math.floor((p.x - 0.2 - ox) / prTx), i1 = Math.ceil((p.x + 0.2 - ox) / prTx), j0 = Math.floor((p.y - 0.2 - oy) / prTx), j1 = Math.ceil((p.y + 0.2 - oy) / prTx);
      for (let j = Math.max(0, j0); j <= Math.min(N - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(N - 1, i1); i++) {
        const dx = ox + (i + 0.5) * prTx - p.x, dy = oy + (j + 0.5) * prTx - p.y, h = sole(dx * c + dy * s, -dx * s + dy * c) * amp, q = j * N + i;
        H[q] = h < 0 ? Math.min(H[q], h) : H[q] < 0 ? H[q] : Math.max(H[q], h);
      }
    }
    for (let q = 0; q < N * N; q++) A[q] = Math.max(0, Math.min(255, Math.round(128 + H[q] * 127)));
    PRT.needsUpdate = true;
  }
  function recentre(x, y) { PRINT_U.uPrintO.value.set(Math.round((x - PR.metres / 2) / prTx) * prTx, Math.round((y - PR.metres / 2) / prTx) * prTx); }
  function stamp(x, y, yaw, side, t = performance.now() / 1000) {
    const o = PRINT_U.uPrintO.value; if (Math.abs(x - o.x - PR.metres / 2) > PR.metres / 4 || Math.abs(y - o.y - PR.metres / 2) > PR.metres / 4) recentre(x, y);
    prints.push({ x: x - Math.sin(yaw) * side * PR.apart, y: y + Math.cos(yaw) * side * PR.apart, yaw, t, snow: onSnowAt(x, y) });
    if (prints.length > PR.max) prints.shift();
    rasterPrints(t);
  }
  let prSide = 1, prAcc = 0, prLast = null, prRaster = 0;
  (function printTick() {
    const now = performance.now() / 1000;
    if (typeof walkOn !== 'undefined' && walkOn && walkMode === 'walk' && walkGround) {
      const x = camera.position.x, y = camera.position.y;
      if (prLast) { const dx = x - prLast[0], dy = y - prLast[1], d = Math.hypot(dx, dy); prAcc += d; if (prAcc >= PR.step && d > 1e-4) { prAcc = 0; prSide = -prSide; stamp(x, y, Math.atan2(dy, dx), prSide, now); } }
      prLast = [x, y];
    } else prLast = null;
    if (prints.length && now - prRaster > 0.5) { prRaster = now; rasterPrints(now); }
    requestAnimationFrame(printTick);
  })();
  const PRINT_HEAD = ${JSON.stringify(PRINT_HEAD)}, PRINT_PRESS = ${JSON.stringify(form.snow ? PRINT_PRESS : PRINT_PRESS.replace('onSn = snowKo', 'onSn = 0.0'))};
  window.__formPrints = { stamp, walk: (pts) => { let side = 1, acc = 0; for (let k = 1; k < pts.length; k++) { const [ax, ay] = pts[k - 1], [bx, by] = pts[k], L = Math.hypot(bx - ax, by - ay), yaw = Math.atan2(by - ay, bx - ax); for (let s = acc; s < L; s += PR.step) { side = -side; stamp(ax + (bx - ax) * s / L, ay + (by - ay) * s / L, yaw, side); } acc = 0; } }, stats: () => ({ prints: prints.length, snow: prints.filter((p) => p.snow).length }), debug: () => { const o = PRINT_U.uPrintO.value, A = PRT.image.data, N = PR.texels; let n = 0, lo = [1e9, 1e9], hi = [-1e9, -1e9]; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (A[j * N + i] < 100) { n++; const x = o.x + (i + 0.5) * prTx, y = o.y + (j + 0.5) * prTx; lo = [Math.min(lo[0], x), Math.min(lo[1], y)]; hi = [Math.max(hi[0], x), Math.max(hi[1], y)]; } return { o: [o.x, o.y], n, lo, hi, first: prints[0], last: prints[prints.length - 1] }; } };
`;
}
const PRINT_HEAD = 'uniform sampler2D tPrint;\nuniform vec2 uPrintO, uPrintD;\nuniform float uPrintM;\n';
// THE PRINTS pressed into the sand and the snow: the map's height (its depth the surface's: a shallow sand print, a snow
// print as deep as the snow lets it) read a step along the view into it (parallax), its walls lit from its slopes, the
// ripples and the drifts' detail gone where the foot pressed, the inside shaded as deep as it goes
const PRINT_PRESS = `    {
      vec2 pu0 = ( vWPos.xy - uPrintO ) / uPrintM;
      float onSa = ws[ 3 ] / max( 1e-4, tw ), onSn = snowKo, softK = max( onSa, onSn );
      if ( softK > 0.01 && pu0.x > 0.0 && pu0.y > 0.0 && pu0.x < 1.0 && pu0.y < 1.0 && camD < 14.0 ) {
        float dep = onSn > onSa ? uPrintD.y : uPrintD.x, tx = 1.0 / 512.0;
        float h0 = texture2D( tPrint, pu0 ).r * 255.0 / 127.0 - 128.0 / 127.0;
        if ( abs( h0 ) > 0.004 || texture2D( tPrint, pu0 + vec2( 6.0 * tx, 0.0 ) ).r != texture2D( tPrint, pu0 - vec2( 6.0 * tx, 0.0 ) ).r ) {
          // (the view marched down into the print, eight layers, till it meets the pressed surface: its far wall seen, its
          // near wall hidden, as deep as the surface's depth makes it)
          vec3 V5 = normalize( cameraPosition - vWPos );
          vec2 dU = -( V5.xy / max( V5.z, 0.35 ) ) * dep / uPrintM / 8.0, pu = pu0;
          float lay = 0.0, dd = max( 0.0, -h0 );
          for ( int k = 0; k < 8; k++ ) { if ( lay >= dd ) break; pu += dU; lay += 0.125; dd = max( 0.0, -( texture2D( tPrint, pu ).r * 255.0 / 127.0 - 128.0 / 127.0 ) ); }
          float hc = texture2D( tPrint, pu ).r * 255.0 / 127.0 - 128.0 / 127.0;
          float hx = ( texture2D( tPrint, pu + vec2( tx, 0.0 ) ).r - texture2D( tPrint, pu - vec2( tx, 0.0 ) ).r ) * 255.0 / 127.0;
          float hy = ( texture2D( tPrint, pu + vec2( 0.0, tx ) ).r - texture2D( tPrint, pu - vec2( 0.0, tx ) ).r ) * 255.0 / 127.0;
          vec2 grad = vec2( hx, hy ) * dep / ( 2.0 * uPrintM * tx );
          float inK = softK * ( 1.0 - smoothstep( 9.0, 14.0, camD ) ), pressed = smoothstep( 0.02, 0.25, -hc );
          vec3 nw = normalize( tT * mn.x + tB * mn.y + nW * mn.z );
          nw = normalize( mix( nw, nW, pressed * 0.9 * inK ) - vec3( grad * inK, 0.0 ) );
          // (sand disturbed a shade darker; snow pressed deep holds a blue shade the sky fills it with)
          diffuseColor.rgb *= onSn > onSa ? mix( vec3( 1.0 ), vec3( 0.72, 0.8, 0.95 ), inK * max( 0.0, -hc ) ) : vec3( 1.0 - inK * ( 0.05 * pressed + 0.08 * max( 0.0, -hc ) ) );
          roughnessFactor = mix( roughnessFactor, min( 1.0, roughnessFactor * 1.15 + 0.05 ), pressed * inK );
          mn = vec3( dot( nw, tT ), dot( nw, tB ), dot( nw, nW ) );
        }
      }
    }
`;

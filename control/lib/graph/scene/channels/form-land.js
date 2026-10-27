/**
 * THE FORM RENDER'S LAND (gen-7), on the World page: the `form` input (form/land-read.js formPayload) drawn as material
 * under the cube's light, in place of the painted land. The island spike's page (scripts/spikes/form/island.mjs), lifted:
 * the layered ground (each layer's texture along the face's dominant axis, blended by weight and by its own height, its
 * colour about its mean over the palette-solved base; the scree thinning by its stones' dice; the trail's dress: its
 * powder and clay, its patches, its dust; the undergrowth on a green land; the wet line by height), the land shaded
 * smooth, the sea one surface faded over the depth under it, the scree's stones instanced, the cube's sun and sky light.
 *
 *   formLandScript(form) → the channel's page source (one block, after the page's own; absent `form`, the page has none)
 *
 * It hides the painted groups it draws in their place (`form.hides`) and the painted water sheet under its sea; every
 * other painted thing is left unlit as it was (the renderer's tone curve is set, those materials marked untouched by
 * it). A live light's own sun (channels/cast-shadows.js) is shadow only here too: its intensity is taken to nothing, so
 * the land is lit once. `window.__formReady` when it has drawn (its textures load first).
 */
import { safeJson } from '../emit-util.js';

export function formLandScript(form) {
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
  const LAYER_U = { tGrassL: { value: new THREE.DataTexture(new Uint8Array([0, 0, 255, 255]), 1, 1, THREE.RGBAFormat) }, uGOl: { value: new THREE.Vector2() }, uGMl: { value: new THREE.Vector2(1, 1) }, uHasG: { value: 0 }, tBase: { value: tBase }, tNorm: { value: tNorm }, tOrm: { value: tOrm }, tDice: { value: tDice }, uTile: { value: D.layers.tile }, uMean: { value: D.layers.mean.map((m) => new THREE.Vector3(...m)) },
    tPath: { value: pathMap }, uPathO: { value: new THREE.Vector2(...(D.path ? D.path.origin.map((v) => v - D.path.cell / 2) : [0, 0])) }, uPathM: { value: new THREE.Vector2(...(D.path ? D.path.metres : [1, 1])) },
    uPathZ: { value: new THREE.Vector2(...(D.path ? D.path.z : [0, 1])) }, uHasPath: { value: D.path ? 1 : 0 }, uDress: { value: new THREE.Vector3(D.dress.rubble, D.dress.dust, D.dress.reach) }, uSdIn: { value: D.dress.sdIn }, uPatch: { value: new THREE.Vector3(...D.dress.patches) }, uPathBase: { value: new THREE.Vector3(...D.layers.pathBase) }, uStoneBase: { value: new THREE.Vector3(...D.layers.stoneBase) }, uClayBase: { value: new THREE.Vector3(...D.layers.clayBase) }, uUnderBase: { value: new THREE.Vector3(...D.layers.underBase) }, uUnder: { value: D.layers.green ? 1 : 0 }, uClay: { value: D.dress.surface === 'sand' ? 0 : D.dress.clay }, uWet: { value: new THREE.Vector4(D.wet.z ?? -1e9, D.wet.band, D.wet.tone, D.wet.rough) } };
  function layeredGround(m, roughScale) {
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, LAYER_U, { uRough: { value: roughScale } });
      sh.vertexShader = 'attribute vec4 splat;\\nvarying vec4 vSplat;\\nvarying vec3 vWPos;\\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\\n  vSplat = splat; vWPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
      sh.fragmentShader = 'uniform sampler2DArray tBase, tNorm, tOrm;\\nuniform sampler2D tPath, tDice;\\nuniform float uTile[7];\\nuniform vec3 uMean[7];\\nuniform float uRough, uHasPath;\\nuniform vec2 uPathO, uPathM, uPathZ;\\nuniform vec3 uPathBase, uStoneBase, uClayBase;\\nuniform float uClay, uUnder, uHasG;\\nuniform sampler2D tGrassL;\\nuniform vec2 uGOl, uGMl;\\nuniform vec3 uUnderBase;\\nuniform vec4 uWet;\\nuniform vec3 uDress, uPatch;\\nuniform float uSdIn;\\nvarying vec4 vSplat;\\nvarying vec3 vWPos;\\nfloat hn( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }\\nfloat vn( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f ); return mix( mix( hn( i ), hn( i + vec2( 1.0, 0.0 ) ), f.x ), mix( hn( i + vec2( 0.0, 1.0 ) ), hn( i + vec2( 1.0, 1.0 ) ), f.x ), f.y ); }\\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>', \`
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
    // (each layer present here nudged by its own noise over the plan, a few metres across: the corners' weights run
    // straight across a triangle, the border they give must not)
    // the scree thins out by its stones: a stone is kept whole where its dice fall under the scree's share here (nudged
    // like the rest), and then it lies over whatever else is here; between the kept stones the others show
    float wsum = max( 1e-4, ws[0] + ws[1] + ws[2] + ws[3] + ws[4] + ws[5] + ws[6] ), sh = ws[1] / wsum;
    float sn = vn( vWPos.xy / 2.5 + 17.3 ) * 0.7 + vn( vWPos.xy / 0.8 + 5.1 ) * 0.3 - 0.5;
    // (the trail's verge: its rubble's share, the stones the dice keep along its edges as the real ones lie, a few on it)
    float vergeW = uDress.x * ( pd <= 0.05 ? 0.15 : exp( -pow( ( pd - 0.45 ) / 0.7, 2.0 ) ) ) * smoothstep( 0.6, 0.85, nW.z );
    sh = max( sh, pd < 98.0 ? vergeW * 0.9 : 0.0 );
    float kept = sh > 0.001 ? step( texture( tDice, scUV ).r, min( 1.0, sh * 1.2 + sn * 0.3 ) ) : 0.0;
    float top = 0.0;
    for ( int i = 0; i < 7; i++ ) {
      float nz = vn( vWPos.xy / 2.5 + float( i ) * 17.3 ) * 0.7 + vn( vWPos.xy / 0.8 + float( i ) * 5.1 ) * 0.3 - 0.5;
      // (a layer's relief and its noise lift it as far as it is here: a trace of turf under the trail never wins on its blades)
      ws[ i ] = i == 1 ? kept * 4.0 : ws[ i ] > 0.001 ? ws[ i ] + ( hgt[ i ] * 0.35 + nz * 0.35 ) * min( 1.0, ws[ i ] * 3.0 ) : 0.0; top = max( top, ws[ i ] );
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
    vec3 dustC = mix( uPathBase, vec3( dot( uPathBase, vec3( 0.2126, 0.7152, 0.0722 ) ) ), 0.35 ) * 1.25 * mix( vec3( 1.0 ), mb, 0.3 );
    diffuseColor.rgb = mix( diffuseColor.rgb, dustC, dust * 0.85 ); roughnessFactor = mix( roughnessFactor, 1.0, dust ); mn = normalize( mix( mn, vec3( 0.0, 0.0, 1.0 ), dust * 0.6 ) );
    // (the sand WET by its height over the water, at this point, not face by face: the line it leaves follows the
    // shore smoothly, wandering a little, and only the sand's share darkens and shines; under the line its own colour
    // takes over, the sea's)
    float wet = ( 1.0 - smoothstep( 0.0, uWet.y, abs( vWPos.z - uWet.x + ( vn( vWPos.xy / 1.7 + 3.1 ) - 0.5 ) * uWet.y * 0.8 ) ) ) * ws[ 3 ] / max( 1e-4, tw );
    diffuseColor.rgb *= mix( 1.0, uWet.z, wet );
    roughnessFactor = mix( roughnessFactor, uWet.w, wet );
    normal = normalize( ( viewMatrix * vec4( normalize( tT * mn.x + tB * mn.y + nW * mn.z ), 0.0 ) ).xyz );\`);
    };
    m.customProgramCacheKey = () => 'layered-ground';
    return m;
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
    const floor = R.key === 'sand:under', g = part(R, C7, { splat: ground, smooth: !water && !floor && R.key !== 'unread' });
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
  // the stones: a few shapes (an icosahedron's corners pushed about by their dice, squashed along its up), each drawn
  // instanced, every stone turned to its ground's normal, yawed by its index, toned about the stone's solved base
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
    for (let v = 0; v < D.stones.shapes; v++) {
      const g = new THREE.IcosahedronGeometry(1, 1), P = g.attributes.position;
      // (a corner's push keyed to where it is, so the copies of a shared corner move together and the stone stays whole;
      // its normal the sphere's, squashed with it: shaded round, never faceted)
      const N = new Float32Array(P.count * 3);
      for (let k = 0; k < P.count; k++) {
        const x = P.getX(k), y = P.getY(k), z = P.getZ(k), f = 0.75 + 0.5 * hsh(v * 17 + Math.round(x * 9), Math.round(y * 9) * 3 + Math.round(z * 9));
        P.setXYZ(k, x * f, y * f, z * f * 0.62); const l = Math.hypot(x, y, z / 0.62); N.set([x / l, y / l, z / 0.62 / l], k * 3);
      }
      g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
      // (a stone under CAST_R casts nothing: its shadow is finer than the map's texel, a smudge beside it)
      const CAST_R = 0.18;
      for (const big of [true, false]) {
      const idx = []; for (let i = 0; i < D.stones.n; i++) if (SP[i * per + 8] === v && (SP[i * per + 3] >= CAST_R) === big) idx.push(i);
      if (!idx.length) continue;
      const im = new THREE.InstancedMesh(g, mat, idx.length);
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
  // open sea: deep water's colour under it, where the recipe lays no floor (the shallows' floor fades into the same colour)
  if (D.seabed) { const B = D.seabed, g = new THREE.PlaneGeometry(B.x[1] - B.x[0], B.y[1] - B.y[0]); g.translate((B.x[0] + B.x[1]) / 2, (B.y[0] + B.y[1]) / 2, B.z);
    scene.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: rgb(D.deep), roughness: 1, metalness: 0 }))); }
  // the painted land it draws in its place, and the painted water sheet under its sea (a standalone sheet: per-vertex
  // alpha, not one of the named groups)
  const __formNamed = new Set(Object.values(meshes));
  for (const g of D.hides) if (meshes[g]) meshes[g].visible = false;
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

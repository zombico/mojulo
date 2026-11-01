// In-page script (part of the form channel, channels/form-land.js): THE GRASS of the form render (gen-7), real blades
// lit by the form's sun, no card and no painted light. It reads the land read's ground map (form/land-read.js `grass`:
// the ground's height and where grass grows, at half a metre) and the trail's mask (its signed distance), and draws:
//
//   field   the grass placed once over the whole map, the same at every distance (STILL_FIELD): each clump's place,
//           turn, height and tone its cell's dice, nothing that follows the eye. Which grows where is the SWARD, a mood's
//           choice (the biocube's `flora.grass.sward`, in the map's fourth channel, its length: 0 tall, a half medium, 1
//           short): the TALL clump (five blades, three segments) where the sward is long; the MEDIUM one, the same clump
//           lower on a finer grid, in the medium areas; the SHORT sward a bed of bristles (a triangle each, scattered over
//           the whole cell, near one height, lit as one pile, each with a darker twin just behind it, a line of shade that
//           gives the pile its depth) where it is kept short, turned away from the trail, so the eye on the trail meets
//           their faces. An area is wholly one length: at a seam the longer shrinks, never interspersed, never one over
//           another. Fewer and lower where the cover thins; none in a claim or on the trail (the map's)
//   drifts  wheat, chaff, any grass kind and the flowers, each in areas of its own (form/grass-drifts.js: the library's
//           plants, their colours carried into the cube's light, a channel each of a second map), placed once on grids
//           of their own, grown full, one plant a cell picked by its dice and its form's weight; a kind that stands
//           (wheat) takes the blades' place, a low one (chaff, the flowers) stands among them
//   views   by the camera's mode (POV_GRASS): AERIAL, a cutscene's, the whole field; POV, gameplay's, real grass to a
//           share of the map, thinning, and STRANDS past it
//   wind    the page's one gust field (channels/terrain-wind.js, the gen-6 live grass's wind kept on a form page with its
//           blades off: the trees' crowns sway in it): every blade, strand and plant bends downwind by the gust at its
//           root, its top the most, with a quiver of its own, and a gust's band reads a shade brighter as it passes, so
//           the field waves as one with the trees. No wind: all stands still
//
// GRASS_TIERS is the table the page reads; a new grass is a row (its clump, its spacing and where it grows).
//
// The block expects the form channel's scope: THREE, scene, D (the form input), LAYER_U (the ground's uniforms: the
// undergrowth thins where the grass is), bytes().
import { WIND_AT_GLSL } from './terrain-wind.js';

/** The grass the page draws: each tier's clump (blades, segments, height m, width m, lean, spread m, X-crossed or all
 *  round; a `bed` of bristles, its blades scattered over its whole cell, one triangle each, so the cells run together as
 *  one even pile, a toothbrush, not tufts; `dark`, each bristle a darker twin just behind it), its grid's spacing (m),
 *  and the sward it grows in, alone (SWARD_LENGTH: its length on the map). */
export const GRASS_TIERS = Object.freeze([
  Object.freeze({ id: 'tall', clump: { blades: 5, segs: 3, height: [0.65, 1], width: [0.02, 0.029], lean: [0.12, 0.3], spread: [0.03, 0.12], cross: false }, spacing: 0.31, scale: 1, sward: 'tall' }),
  Object.freeze({ id: 'medium', clump: { blades: 5, segs: 3, height: [0.65, 1], width: [0.018, 0.025], lean: [0.1, 0.24], spread: [0.03, 0.1], cross: false }, spacing: 0.183, scale: 0.55, sward: 'medium' }),
  Object.freeze({ id: 'short', clump: { blades: 10, segs: 1, height: [0.8, 1], width: [0.008, 0.012], lean: [0.02, 0.06], spread: [0, 0], cross: true, bed: true, dark: true }, spacing: 0.137, scale: 0.24, sward: 'short' }),
]);
/** THE FIELD: the grass and the drifts placed once over the whole map, the same at every distance, as the gen-6 cards
 *  stood. Each section's clump on a grid `spread` × its spacing; the drifts their grown forms on their grids. Drawn in
 *  tiles of `tile` m, so what is out of view is culled. */
export const STILL_FIELD = Object.freeze({ spread: Object.freeze({ tall: 1, medium: 1, short: 1 }), tile: 24 });
/** The field as the eye sees it, by the CAMERA'S MODE: AERIAL (a cutscene's camera) the whole field; POV (gameplay, the
 *  walker's eye, the default) real grass only out to `share` of the map's length, thinning past `thin` of that, each
 *  clump going whole at a distance of its own, and past it STRANDS: one sliver a strand, `spacing` m apart over all the
 *  grass, kept `px` pixels wide whatever its distance (the perspective's own measure), shaded root to tip as the blades
 *  are and swaying in the same wind, each coming in at its own distance as the grass thins.
 *  `window.__formGrassView('aerial' | 'pov')` sets it; V toggles it on a walkable page. */
export const POV_GRASS = Object.freeze({ share: 1 / 3, thin: 0.5, strands: Object.freeze({ spacing: 0.45, px: 1.6, height: Object.freeze([0.55, 1]) }) });
/** How the grass's height wanders: a slow field over the land (`cell` m), taller and shorter stretches between `range`
 *  × the sward's own, and each clump its own share more or less (± `clump`). */
export const GRASS_HEIGHT = Object.freeze({ cell: 6, range: Object.freeze([0.72, 1.28]), clump: 0.2 });
/** Each sward's length on the grass map (its fourth channel) and the half-width of its band there. */
export const SWARD_LENGTH = Object.freeze({ tall: 0, medium: 0.5, short: 1, band: 0.25 });
/** How a short sward's bristle's dark twin sits: behind it (m), its height (× the bristle's) and its shade (× its colour). */
export const DARK_TWIN = Object.freeze({ back: 0.022, height: 0.72, shade: 0.4 });
/** A blade's height over its clump's, by its cell's dice: the least and the spread (a tall sward wandering, a short one
 *  near one height). */
export const BLADE_RISE = Object.freeze({ tall: Object.freeze([0.5, 0.55]), medium: Object.freeze([0.6, 0.45]), short: Object.freeze([0.85, 0.2]) });
/** The wind on a blade: its top's lean per m/s of gust (× its height, at most `max`), and its quiver (× its height). */
export const GRASS_WIND = Object.freeze({ lean: 0.055, max: 0.85, quiver: 0.035, sheen: 0.12 });
/** The drifts' grids, for a kind that stands, one that lies among the blades, and the flowers: spacing (m) and how many
 *  cells hold a plant. One plant a cell, its form by the cell's dice, so every form of a kind draws the kind's one grid:
 *  a sparse kind is a wide grid, not a dense one kept thin. */
const fz = Object.freeze;
export const DRIFT_TIERS = fz({ stands: fz({ spacing: 0.36, keep: 0.9 }), among: fz({ spacing: 0.5, keep: 0.7 }), flowers: fz({ spacing: 0.9, keep: 0.8 }) });

// the wind's GLSL: the page's gust field (WIND_AT_GLSL) and a blade's bend in it; without wind, the same calls bend nothing
const BEND_GLSL = `vec3 fgBend( vec2 root, float hgt, float s, float ph ) {
  vec2 u = mojWindAt( root, 0.5 * hgt, uWindT ); float m = length( u );
  vec2 d = m > 1e-4 ? u / m : vec2( 0.0 );
  float k = clamp( ${GRASS_WIND.lean} * m, 0.0, ${GRASS_WIND.max} ) + ${GRASS_WIND.quiver} * min( 1.0, m / 4.0 ) * sin( uWindT * ( 6.0 + 3.0 * fract( ph * 0.37 ) ) + ph * 40.0 );
  vec2 b = d * k * hgt * s * s;
  return vec3( b, -dot( b, b ) / ( 2.0 * max( hgt, 0.05 ) ) );
}
float fgGust( vec2 root ) { return clamp( length( mojWindAt( root, 1.0, uWindT ) ) / max( uWindA.x, 0.1 ) - 1.0, -1.0, 1.5 ) * ${GRASS_WIND.sheen}; }
`;
const WIND_HEAD = 'uniform float uWindT; uniform vec4 uWindA; uniform vec4 uWindB; uniform sampler2D uWindNoise;\n' + WIND_AT_GLSL + BEND_GLSL;
const STILL_HEAD = 'vec3 fgBend( vec2 root, float hgt, float s, float ph ) { return vec3( 0.0 ); }\nfloat fgGust( vec2 root ) { return 0.0; }\n';

export function formGrassScript() {
  return `
  // --- the form render's grass (channels/form-grass.js) ---
  if (D.grass) {
    const Gm = D.grass, GTIERS = ${JSON.stringify(GRASS_TIERS)}, DT = ${JSON.stringify(DRIFT_TIERS)}, TWIN = ${JSON.stringify(DARK_TWIN)}, SL = ${JSON.stringify(SWARD_LENGTH)}, BR = ${JSON.stringify(BLADE_RISE)};
    // (the wind: the page's gust field when it has one, read when a material compiles, after every script has run)
    const WIND_HEAD = ${JSON.stringify(WIND_HEAD)}, STILL_HEAD = ${JSON.stringify(STILL_HEAD)}, windU = () => window.__mojTerrain && window.__mojTerrain.wind && window.__mojTerrain.wind.uniforms;
    const windHead = (sh) => { const W = windU(); if (!W) return STILL_HEAD; Object.assign(sh.uniforms, { uWindT: W.uWindT, uWindA: W.uWindA, uWindB: W.uWindB, uWindNoise: W.uWindNoise }); return WIND_HEAD; };
    const gpx = bytes(Gm.px), gmap = new THREE.DataTexture(gpx, Gm.size[0], Gm.size[1], THREE.RGBAFormat); gmap.magFilter = gmap.minFilter = THREE.NearestFilter; gmap.needsUpdate = true;
    const GO = new THREE.Vector2(Gm.origin[0] - Gm.cell / 2, Gm.origin[1] - Gm.cell / 2), GM = new THREE.Vector2(Gm.size[0] * Gm.cell, Gm.size[1] * Gm.cell);
    // (the ground's undergrowth reads the same map, smoothly: thinner where the grass is)
    const gmapL = new THREE.DataTexture(gpx, Gm.size[0], Gm.size[1], THREE.RGBAFormat); gmapL.magFilter = gmapL.minFilter = THREE.LinearFilter; gmapL.needsUpdate = true;
    LAYER_U.tGrassL.value = gmapL; LAYER_U.uGOl.value.copy(GO); LAYER_U.uGMl.value.copy(GM); LAYER_U.uHasG.value = 1;
    // (the drifts, and which of their kinds stand in the blades' place)
    const Dr = Gm.drifts;
    const replace = new THREE.Vector4(...[0, 1, 2, 3].map((c) => (Dr?.kinds[c]?.stands ? 1 : 0)));
    const grassCol = new THREE.Color().setRGB(...Gm.base.map((v) => Math.min(1, v)), THREE.LinearSRGBColorSpace);
    const GU = { tGrass: { value: gmap }, uGO: { value: GO }, uGM: { value: GM }, uGZ: { value: new THREE.Vector2(...Gm.z) }, tPath: LAYER_U.tPath, uPathO: LAYER_U.uPathO, uPathM: LAYER_U.uPathM, uHasPath: LAYER_U.uHasPath, uDress: LAYER_U.uDress, uSdIn: LAYER_U.uSdIn };
    const GHEAD = 'uniform sampler2D tGrass, tPath;\\nuniform vec2 uGO, uGM, uGZ, uPathO, uPathM;\\nuniform float uHasPath, uSdIn, uShort;\\nuniform vec3 uDress;\\n'
      // (the trail's signed distance at a point of the plan, from its mask: far off it, or with no trail, 99)
      + 'float pdAt( vec2 p ) { if ( uHasPath < 0.5 ) return 99.0; vec2 u = ( p - uPathO ) / uPathM; if ( u.x <= 0.0 || u.y <= 0.0 || u.x >= 1.0 || u.y >= 1.0 ) return 99.0; return texture( tPath, u ).g * ( uSdIn + uDress.z ) - uSdIn; }\\n';
    const hb = (a, b) => { const x = Math.sin(a * 91.7 + b * 47.3) * 43758.5453; return x - Math.floor(x); };
    // (a clump: its blades, each a tapered strip in segments, leaning and bending its own way; crossed, three blades in an
    // X about the clump's facing, all leaning forward: the eye in front meets their faces)
    function clumpGeometry(C, seed, sp) {
      const bp = [], bt = [], bi = [], lerp = (r, t) => r[0] + (r[1] - r[0]) * t;
      for (let b = 0; b < C.blades; b++) {
        const yaw = C.cross ? [-0.55, 0.08, 0.55][b % 3] + (hb(b, seed + 9) - 0.5) * 0.3 : b * (6.2832 / C.blades) + hb(b, seed + 1);
        const r = lerp(C.spread, hb(b, seed + 2)), oa = C.cross ? yaw + 3.1416 : yaw * 1.7;
        // (a bed's bristles anywhere in the cell, a little past it, so neighbouring cells run together)
        const ox = C.bed ? (hb(b, seed + 6) - 0.5) * sp * 1.15 : Math.cos(oa) * r, oy = C.bed ? (hb(b, seed + 7) - 0.5) * sp * 1.15 : Math.sin(oa) * r;
        const ht = lerp(C.height, hb(b, seed + 3)), lean = lerp(C.lean, hb(b, seed + 4)), w = lerp(C.width, hb(b, seed + 5)), base = bp.length / 3;
        if (C.segs === 1) {
          // (a bristle: one triangle, its tip a point)
          const sx = -Math.sin(yaw) * w, sy = Math.cos(yaw) * w;
          bp.push(ox - sx, oy - sy, 0, ox + sx, oy + sy, 0, ox + Math.cos(yaw) * lean, oy + Math.sin(yaw) * lean, ht); bt.push(0, 0, 1); bi.push(base, base + 1, base + 2);
          // (its dark twin: a little behind it, lower, its coordinate up the blade carried past 2 to say so)
          if (C.dark) { const bx = ox + Math.cos(yaw) * TWIN.back, by = oy + Math.sin(yaw) * TWIN.back;
            bp.push(bx - sx, by - sy, 0, bx + sx, by + sy, 0, bx + Math.cos(yaw) * lean, by + Math.sin(yaw) * lean, ht * TWIN.height); bt.push(2, 2, 3); bi.push(base + 3, base + 4, base + 5); }
          continue;
        }
        for (let k = 0; k <= C.segs; k++) {
          const t = k / C.segs, wd = w * (1 - t * 0.92), dx = Math.cos(yaw) * lean * t * t, dy = Math.sin(yaw) * lean * t * t, sx = -Math.sin(yaw) * wd, sy = Math.cos(yaw) * wd;
          bp.push(ox + dx - sx, oy + dy - sy, ht * t, ox + dx + sx, oy + dy + sy, ht * t); bt.push(t, t);
        }
        for (let k = 0; k < C.segs; k++) { const a = base + k * 2; bi.push(a, a + 1, a + 3, a, a + 3, a + 2); }
      }
      const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)); g.setAttribute('bt', new THREE.Float32BufferAttribute(bt, 1)); g.setIndex(bi);
      g.setAttribute('normal', new THREE.Float32BufferAttribute(bp.map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
      return g;
    }
    // (the FIELD: every tuft and every drift plant placed once, over the whole map: the sward's lengths and seams, the
    // cover, the claims, the trail; nothing that follows the eye)
    (function () {
      const SF = ${JSON.stringify(STILL_FIELD)}, PG = ${JSON.stringify(POV_GRASS)}, GH = ${JSON.stringify(GRASS_HEIGHT)}, [nx, ny] = Gm.size, cAt = (i, j) => (Math.min(ny - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))) * 4;
      const zT = (q) => Gm.z[0] + ((gpx[q] * 256 + gpx[q + 1]) / 65535) * Gm.z[1], dpx = Dr ? bytes(Dr.px) : null;
      const zAt = (x, y) => { const u = (x - Gm.origin[0]) / Gm.cell, v = (y - Gm.origin[1]) / Gm.cell, i = Math.floor(u), j = Math.floor(v), f = u - i, g = v - j;
        return (zT(cAt(i, j)) * (1 - f) + zT(cAt(i + 1, j)) * f) * (1 - g) + (zT(cAt(i, j + 1)) * (1 - f) + zT(cAt(i + 1, j + 1)) * f) * g; };
      const x0 = Gm.origin[0], y0 = Gm.origin[1], X1 = x0 + (nx - 1) * Gm.cell, Y1 = y0 + (ny - 1) * Gm.cell;
      const sm = (e0, e1, v) => { const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
      // (a slow field over the land, 0 to 1, by the corners' dice; and the grass's height there, × its sward's)
      const vn = (x, y) => { const i = Math.floor(x), j = Math.floor(y), f = x - i, g = y - j, a = f * f * (3 - 2 * f), b = g * g * (3 - 2 * g);
        return (hb(i, j) * (1 - a) + hb(i + 1, j) * a) * (1 - b) + (hb(i, j + 1) * (1 - a) + hb(i + 1, j + 1) * a) * b; };
      const tall = (x, y) => GH.range[0] + (GH.range[1] - GH.range[0]) * vn(x / GH.cell, y / GH.cell);
      // (the tips of the grass where the sward is a length: a clump's tallest blade at its mean rise)
      const tipAt = (sw) => { const q = GTIERS.find((t) => t.sward === (sw < 0.25 ? 'tall' : sw < 0.75 ? 'medium' : 'short')); return q.scale * q.clump.height[1] * (BR[q.sward][0] + BR[q.sward][1] * 0.5); };
      // (the camera's mode: POV draws real grass out to R and strands past it, AERIAL all the grass; a tile wholly past
      // what its mode draws is not drawn at all)
      const RP = PG.share * Math.max(nx, ny) * Gm.cell, PV = { uPovR: { value: RP }, uPx: { value: new THREE.Vector2(PG.strands.px, 0.001) } }, TILES = [];
      let view = 'pov';
      window.__formGrassView = (v) => { view = v === 'aerial' ? 'aerial' : 'pov'; PV.uPovR.value = view === 'pov' ? RP : 1e6; return view; };
      window.addEventListener('keydown', (e) => { if (e.key === 'v' || e.key === 'V') console.log('grass view', window.__formGrassView(view === 'pov' ? 'aerial' : 'pov')); });
      // (every cell of a grid sp apart over the map: its point, a little off its place by its dice, and the map there)
      const each = (sp, salt, fn) => { for (let j = Math.floor(y0 / sp); j * sp <= Y1; j++) for (let i = Math.floor(x0 / sp); i * sp <= X1; i++) {
        const x = (i + hb(i * 1.7 + salt, j * 2.3)) * sp, y = (j + hb(j * 3.1, i * 0.7 + salt)) * sp; if (x < x0 || y < y0 || x > X1 || y > Y1) continue;
        const q = cAt(Math.round((x - x0) / Gm.cell), Math.round((y - y0) / Gm.cell));
        fn(x, y, { cov: gpx[q + 2] / 255, sw: gpx[q + 3] / 255, dr: dpx ? [dpx[q], dpx[q + 1], dpx[q + 2], dpx[q + 3]].map((v) => v / 255) : [0, 0, 0, 0] }, (a, b) => hb(i * a + salt, j * b)); } };
      // (a stand: a shape instanced at its rows, each row its root and height, its turn and its tone; in tiles of SF.tile m,
      // each its own mesh round its rows, so what is behind the eye is not drawn: the same field, only culled)
      const stand = (tg, R, mat, kind = 'grass') => {
        const by = new Map(); for (let r = 0; r < R.length; r += 6) { const k = Math.floor(R[r] / SF.tile) + ',' + Math.floor(R[r + 1] / SF.tile); let L = by.get(k); if (!L) by.set(k, (L = [])); for (let c = 0; c < 6; c++) L.push(R[r + c]); }
        tg.computeBoundingBox(); const top = tg.boundingBox.max.z;
        by.forEach((L) => {
          const g = new THREE.InstancedBufferGeometry(); g.setIndex(tg.index); for (const nm in tg.attributes) g.setAttribute(nm, tg.attributes[nm]);
          const IB = new THREE.InstancedInterleavedBuffer(new Float32Array(L), 6, 1);
          g.setAttribute('aRoot', new THREE.InterleavedBufferAttribute(IB, 4, 0)); g.setAttribute('aTurn', new THREE.InterleavedBufferAttribute(IB, 2, 4)); g.instanceCount = L.length / 6;
          const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (let r = 0; r < L.length; r += 6) for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], L[r + c]); hi[c] = Math.max(hi[c], L[r + c] + (c === 2 ? top * L[r + 3] + 1 : 1)); }
          g.boundingSphere = new THREE.Box3(new THREE.Vector3(lo[0] - 1, lo[1] - 1, lo[2] - 1), new THREE.Vector3(...hi)).getBoundingSphere(new THREE.Sphere());
          const m = new THREE.Mesh(g, mat); m.receiveShadow = true; scene.add(m); __formMeshes.push(m); TILES.push({ m, s: g.boundingSphere, kind });
        });
        return R.length / 6; };
      // (a plant's height as the mode has it: in POV gone past its own distance, short of R, the further the more gone)
      const ROOT = 'uniform float uPovR;\\nattribute vec4 aRoot;\\nattribute vec2 aTurn;\\n';
      const POVH = 'float dP = length( aRoot.xy - cameraPosition.xy ), rP = fract( aTurn.y * 7.31 + aTurn.x * 1.37 ), kP = mix( uPovR * ' + PG.thin.toFixed(2) + ', uPovR, sqrt( rP ) ), hP = aRoot.w * ( 1.0 - smoothstep( kP - 0.6, kP, dP ) );';
      const PLACE = 'vec3 transformed = vec3( aRoot.xy + rotG * position.xy * step( 0.001, hP ), aRoot.z + position.z * hP ) + fgBend( aRoot.xy, hP, clamp( position.z, 0.0, 1.0 ), aTurn.x * 2.1 + aTurn.y );';
      // the grass: each length's clump where the sward is that length, fewer and lower where the cover thins, shrinking
      // toward a seam with another length, none where a standing drift has the ground
      GTIERS.forEach((T, ti) => {
        const tg = clumpGeometry(T.clump, ti * 31, T.spacing), R = [];
        each(T.spacing * SF.spread[T.sward], ti, (x, y, m, h) => {
          const dL = Math.abs(m.sw - SL[T.sward]) / SL.band; if (dL >= 1) return;
          if (m.dr.reduce((a, v, c) => a + v * replace.getComponent(c), 0) >= 0.5) return;
          if (h(5.3, 1.9) >= m.cov * (T.sward === 'short' ? 2 : 1.2)) return;
          const ht = sm(0.08, 0.6, m.cov) * (BR[T.sward][0] + BR[T.sward][1] * h(0.37, 0.91)) * (1 - 0.55 * sm(0.2, 1, dL)) * T.scale * tall(x, y) * (1 + GH.clump * (2 * h(4.7, 8.3) - 1));
          if (ht > 0.001) R.push(x, y, zAt(x, y), ht, h(2.9, 4.1) * 6.2832, h(7.7, 0.3));
        });
        const bm = new THREE.MeshStandardMaterial({ color: grassCol, roughness: 0.75, metalness: 0, side: THREE.DoubleSide });
        bm.onBeforeCompile = (sh) => {
          Object.assign(sh.uniforms, GU, PV, { uShort: { value: T.sward === 'short' ? 1 : 0 } });
          sh.vertexShader = GHEAD + windHead(sh) + ROOT + 'attribute float bt;\\nvarying float vBt;\\nvarying float vTone;\\n' + sh.vertexShader
            .replace('#include <beginnormal_vertex>', [
              POVH,
              // (a short clump turned away from the trail, by the mask's slope, a little off, so the eye on the trail meets
              // its faces; a tall one any way)
              'float pd = pdAt( aRoot.xy );',
              'vec2 away = vec2( pdAt( aRoot.xy + vec2( 0.4, 0.0 ) ) - pdAt( aRoot.xy - vec2( 0.4, 0.0 ) ), pdAt( aRoot.xy + vec2( 0.0, 0.4 ) ) - pdAt( aRoot.xy - vec2( 0.0, 0.4 ) ) );',
              'float yawG = uShort > 0.5 && pd < 98.0 && dot( away, away ) > 1e-6 ? atan( away.y, away.x ) + ( aTurn.y - 0.5 ) * 0.8 : aTurn.x;',
              'mat2 rotG = mat2( cos( yawG ), sin( yawG ), -sin( yawG ), cos( yawG ) );',
              'vec3 objectNormal = normalize( vec3( rotG * vec2( 0.35, 0.0 ), 1.0 ) );',
              'vBt = bt; vTone = ( 0.85 + 0.3 * aTurn.y ) * ( uShort > 0.5 ? 1.08 : 1.0 ) * ( 1.0 + fgGust( aRoot.xy ) );'].join('\\n'))
            .replace('#include <begin_vertex>', PLACE);
          sh.fragmentShader = 'uniform float uShort;\\nvarying float vBt;\\nvarying float vTone;\\n' + sh.fragmentShader
            .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\\n  if ( uShort > 0.5 ) normal *= faceDirection;')
            .replace('#include <color_fragment>', '#include <color_fragment>\\n  float dk = step( 1.5, vBt );\\n  diffuseColor.rgb *= mix( 0.45, 1.1, vBt - 2.0 * dk ) * vTone * mix( 1.0, ' + TWIN.shade.toFixed(3) + ', dk );');
        };
        bm.customProgramCacheKey = () => 'form-grass-' + T.id + (windU() ? '-wind' : '');
        window.__formGrass = (window.__formGrass || 0) + stand(tg, R, bm) * tg.index.count / 3;
      });
      // (a plant's material: a drift's or a weed's, its own colours, lit as one, bending in the wind)
      const plantMat = () => {
        const dm = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
        dm.onBeforeCompile = (sh) => {
          Object.assign(sh.uniforms, GU, PV);
          sh.vertexShader = GHEAD + windHead(sh) + ROOT + 'varying float vBt;\\n' + sh.vertexShader
            .replace('#include <beginnormal_vertex>', [POVH, 'mat2 rotG = mat2( cos( aTurn.x ), sin( aTurn.x ), -sin( aTurn.x ), cos( aTurn.x ) );', 'vec3 objectNormal = normalize( vec3( rotG * vec2( 0.35, 0.0 ), 1.0 ) );', 'vBt = position.z;'].join('\\n'))
            .replace('#include <begin_vertex>', 'vec3 transformed = vec3( aRoot.xy + rotG * position.xy * hP, aRoot.z + position.z * hP ) + fgBend( aRoot.xy, hP, clamp( position.z, 0.0, 1.0 ), aTurn.x * 2.1 + aTurn.y );');
          sh.fragmentShader = 'varying float vBt;\\n' + sh.fragmentShader
            .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\\n  normal *= faceDirection;')
            .replace('#include <color_fragment>', '#include <color_fragment>\\n  diffuseColor.rgb *= mix( 0.6, 1.05, clamp( vBt, 0.0, 1.0 ) );');
        };
        dm.customProgramCacheKey = () => 'form-grass-plant' + (windU() ? '-wind' : '');
        return dm;
      };
      // the drifts: each kind's grown form (its near one) on its near grid, over all its ground, one plant a cell by the
      // cell's dice against the forms' weights, grown where the kind's channel is past a half, eased in from its seam
      if (Dr) Dr.kinds.forEach((K, k) => {
        let w0 = 0;
        const CL = DT[K.id === 'flowers' ? 'flowers' : K.stands ? 'stands' : 'among'];
        K.forms.forEach((Fm, fi) => {
          const w = [w0, fi === K.forms.length - 1 ? 1.01 : w0 + Fm.w]; w0 += Fm.w;
          const L = Fm, tg = new THREE.InstancedBufferGeometry(), R = [];
          tg.setAttribute('position', new THREE.Float32BufferAttribute(L.p, 3)); tg.setAttribute('color', new THREE.Float32BufferAttribute(L.c, 3));
          tg.setAttribute('normal', new THREE.Float32BufferAttribute(L.p.map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
          each(CL.spacing, 40 + k * 7, (x, y, m, h) => {
            const inD = m.dr[k], pick = h(17.13, 5.71); if (inD < 0.5 || pick < w[0] || pick >= w[1]) return;
            if (h(29.1, 7.7) >= CL.keep * Math.min(1, m.cov * 1.3)) return;
            R.push(x, y, zAt(x, y), (K.heights[0] + (K.heights[1] - K.heights[0]) * h(3.3, 0.7)) * (0.45 + 0.55 * sm(0.5, 0.85, inD)) * (K.id === 'flowers' ? 1 - 0.4 * m.sw : 1), h(2.9, 4.1) * 6.2832, h(0.3, 7.7));
          });
          const dm = plantMat();
          window.__formDrift = (window.__formDrift || 0) + stand(tg, R, dm) * L.p.length / 9;
        });
      });
      // the WEEDS (form/grass-drifts.js weedForms): a few of the grass's cells, gathered in loose patches, a weed each of
      // any kind and variant by the cell's dice; none where a drift has the ground
      const Wd = Gm.weeds;
      if (Wd) { let w0 = 0; Wd.forms.forEach((Fm, fi) => {
        const w = [w0, fi === Wd.forms.length - 1 ? 1.01 : w0 + Fm.w]; w0 += Fm.w;
        const tg = new THREE.InstancedBufferGeometry(), R = [];
        tg.setAttribute('position', new THREE.Float32BufferAttribute(Fm.p, 3)); tg.setAttribute('color', new THREE.Float32BufferAttribute(Fm.c, 3));
        tg.setAttribute('normal', new THREE.Float32BufferAttribute(Fm.p.map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
        each(Wd.spacing, 90, (x, y, m, h) => {
          const pick = h(13.7, 2.9); if (pick < w[0] || pick >= w[1] || m.dr.some((v) => v >= 0.5)) return;
          const patch = vn(x / Wd.cell + 31.7, y / Wd.cell + 7.3);
          if (h(23.1, 4.3) >= Wd.share * 3 * patch * patch * Math.min(1, m.cov * 1.3)) return;
          R.push(x, y, zAt(x, y), tipAt(m.sw) * tall(x, y) * (Wd.heights[0] + (Wd.heights[1] - Wd.heights[0]) * h(3.1, 9.7)), h(2.9, 4.1) * 6.2832, h(0.3, 7.7));
        });
        window.__formWeeds = (window.__formWeeds || 0) + stand(tg, R, plantMat()) * Fm.p.length / 9;
      }); }
      // the STRANDS (POV, past the real grass): over all the grass, a strand a cell, its height its section's tips', one
      // sliver turned to the eye and kept PG.strands.px pixels wide, coming in at its own distance as the grass thins.
      // A strand is the colour of what grows where it stands: the grass's, a standing drift's (wheat) whole, one that lies
      // among the blades (chaff) on a share of them, a flower's at its tip on a share of them (each form's colour its
      // tip's, a slot of its own)
      (function () {
        const tip = (q) => q.scale * q.clump.height[1] * (BR[q.sward][0] + BR[q.sward][1]), R = [];
        const SC = [grassCol.r, grassCol.g, grassCol.b], SFL = [0], slot = [];
        if (Dr) Dr.kinds.forEach((K, k) => { slot[k] = K.forms.map((Fm) => {
          if (SFL.length >= 16) return 0;
          const P = Fm.p, C = Fm.c; let top = 0; for (let i = 2; i < P.length; i += 3) top = Math.max(top, P[i]);
          const c = [0, 0, 0]; let n = 0; for (let i = 2; i < P.length; i += 3) if (P[i] > top * 0.6) { for (let q = 0; q < 3; q++) c[q] += C[i - 2 + q]; n++; }
          SC.push(...c.map((v) => v / Math.max(1, n))); SFL.push(K.id === 'flowers' ? 1 : 0); return SFL.length - 1; }); });
        each(PG.strands.spacing, 77, (x, y, m, h) => {
          if (h(5.3, 1.9) >= m.cov * 1.2) return;
          const q = GTIERS.find((t) => t.sward === (m.sw < 0.25 ? 'tall' : m.sw < 0.75 ? 'medium' : 'short'));
          let ht = tip(q), si = 0;
          if (Dr) Dr.kinds.some((K, k) => {
            if (m.dr[k] < 0.5 || h(11.3 + k, 3.7) >= (K.stands ? 1 : K.id === 'flowers' ? DT.flowers.keep * 0.5 : 0.5)) return false;
            let w0 = 0; const pk = h(17.13, 5.71), fi = Math.max(0, K.forms.findIndex((Fm) => (w0 += Fm.w) > pk));
            si = slot[k][fi]; if (K.stands) ht = (K.heights[0] + K.heights[1]) / 2; return true; });
          R.push(x, y, zAt(x, y), ht * tall(x, y) * (PG.strands.height[0] + (PG.strands.height[1] - PG.strands.height[0]) * h(0.37, 0.91)) * sm(0.08, 0.6, m.cov), h(2.9, 4.1) * 6.2832, si + 0.98 * h(7.7, 0.3));
        });
        while (SFL.length < 16) { SC.push(0, 0, 0); SFL.push(0); }
        const tg = new THREE.InstancedBufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0, 0, 1], 3)); tg.setAttribute('bt', new THREE.Float32BufferAttribute([0, 0, 1], 1)); tg.setIndex([0, 1, 2]);
        const sm0 = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
        const SCU = { uSC: { value: Array.from({ length: 16 }, (_, i) => new THREE.Vector3(SC[i * 3], SC[i * 3 + 1], SC[i * 3 + 2])) }, uSF: { value: SFL } };
        sm0.onBeforeCompile = (sh) => {
          Object.assign(sh.uniforms, GU, PV, SCU);
          sh.vertexShader = GHEAD + windHead(sh) + ROOT + 'uniform vec2 uPx;\\nuniform vec3 uSC[16];\\nuniform float uSF[16];\\nattribute float bt;\\nvarying float vBt;\\nvarying float vTone;\\nvarying float vFl;\\nvarying vec3 vCol;\\nvarying vec3 vBase;\\n' + sh.vertexShader
            .replace('#include <beginnormal_vertex>', [
              // (in where the grass thins, at its own distance; its width the pixels it is held to at its distance)
              'float dP = length( aRoot.xy - cameraPosition.xy ), rP = fract( fract( aTurn.y ) * 5.17 + aTurn.x * 2.03 ), aP = mix( uPovR * ' + PG.thin.toFixed(2) + ', uPovR, sqrt( rP ) );',
              'float hP = aRoot.w * smoothstep( aP, aP + 0.6, dP ) * step( uPovR, 1e5 );',
              'vec2 eye = normalize( aRoot.xy - cameraPosition.xy + vec2( 1e-4, 0.0 ) ), side = vec2( -eye.y, eye.x ) * uPx.x * uPx.y * dP;',
              'vec3 objectNormal = vec3( 0.0, 0.0, 1.0 );',
              'int si = int( floor( aTurn.y ) ); vCol = uSC[si]; vFl = uSF[si]; vBase = uSC[0];',
              'vBt = bt; vTone = ( 0.85 + 0.3 * fract( aTurn.y ) ) * ( 1.0 + fgGust( aRoot.xy ) );'].join('\\n'))
            .replace('#include <begin_vertex>', 'vec3 transformed = vec3( aRoot.xy + side * position.x * step( 0.001, hP ), aRoot.z + position.z * hP ) + fgBend( aRoot.xy, hP, position.z, aTurn.x * 2.1 + aTurn.y );');
          sh.fragmentShader = 'varying float vBt;\\nvarying float vTone;\\nvarying float vFl;\\nvarying vec3 vCol;\\nvarying vec3 vBase;\\n' + sh.fragmentShader
            // (a flower's colour at its tip, the grass's under it; any other strand its colour root to tip)
            .replace('#include <color_fragment>', '#include <color_fragment>\\n  diffuseColor.rgb *= mix( vBase, vCol, vFl > 0.5 ? smoothstep( 0.55, 0.9, vBt ) : 1.0 ) * mix( 0.45, 1.1, vBt ) * vTone;');
        };
        sm0.customProgramCacheKey = () => 'form-grass-strands' + (windU() ? '-wind' : '');
        window.__formStrands = stand(tg, R, sm0, 'strands');
      })();
      // (each frame: the eye's pixel at a metre, for the strands; and the tiles its mode does not reach left undrawn)
      const hook = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3)), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
      hook.frustumCulled = false; scene.add(hook);
      const bufV = new THREE.Vector2();
      hook.onBeforeRender = (r, sc, cam) => {
        if (cam.isPerspectiveCamera) PV.uPx.value.y = 2 * Math.tan(cam.fov * Math.PI / 360) / Math.max(1, r.getDrawingBufferSize(bufV).y);
        const cx = cam.position.x, cy = cam.position.y, pov = view === 'pov';
        for (const T of TILES) { const d = Math.hypot(T.s.center.x - cx, T.s.center.y - cy); T.m.visible = T.kind === 'strands' ? pov && d + T.s.radius > RP * PG.thin : !pov || d - T.s.radius < RP; }
      };
    })();
  }
`;
}

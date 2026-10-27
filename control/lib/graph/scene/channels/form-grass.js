// In-page script (part of the form channel, channels/form-land.js): THE GRASS of the form render (gen-7), real blades
// lit by the form's sun, no card and no painted light. It reads the land read's ground map (form/land-read.js `grass`:
// the ground's height and where grass grows, at half a metre) and the trail's mask (its signed distance), and draws:
//
//   tiers   clumps instanced on grids that walk with the camera, each clump's place, turn, height and tone its world
//           cell's dice (nothing shuffles as the eye moves; within a tier's last reach it shrinks and dissolves, never
//           swaps). Which grows where is the SWARD, a mood's choice (the biocube's `flora.grass.sward`, in the map's fourth
//           channel): the TALL clump (five blades, three segments) on two grids, a finer one near, where the sward is
//           long; the SHORT sward a bed of bristles (a triangle each, scattered over the whole cell, near one height, lit
//           as one pile, each with a darker twin just behind it, a line of shade that gives the pile its depth) where it
//           is kept short, turned away from the trail, so the eye on the trail meets their faces. An area is wholly one
//           or the other: at a seam the tall shrinks and the short rises, never interspersed. Each blade stands inside the
//           carpet and, past its reach, dissolves into it, never shrinking to nothing
//   carpet  the grass as a pile, wherever grass grows, near and far: the ground drawn again as thin shells stacked to
//           the sward's height (a grid that walks with the camera, each shell keeping only its slice of the strands), the
//           strands drawn from the blades' own numbers (their spacing, height, lean, base-to-tip shade, the short
//           sward's dark twin), wheat's and chaff's drifts in their colours; far off it thins its shells and flattens into
//           the ground's lines. Nothing sprouts from nothing: the ground's lines, then the carpet, then the blades
//   drifts  wheat, chaff, any grass kind and the flowers, each in areas of its own (form/grass-drifts.js: the library's
//           plants, their colours carried into the cube's light, a channel each of a second map), on grids of their own,
//           near grown full (L1), far plain (L0), one plant a cell picked by its dice and its form's weight; a kind that
//           stands (wheat) takes the blades' place, a low one (chaff, the flowers) stands among them
//   wind    the page's one gust field (channels/terrain-wind.js, the gen-6 live grass's wind kept on a form page with its
//           blades off: the trees' crowns sway in it): every blade, point and plant bends downwind by the gust at its root,
//           its top the most, with a quiver of its own, and a gust's band reads a shade brighter as it passes, so the
//           field waves as one with the trees; the carpet's upper shells lean a little with it. No wind: all stands still
//
// GRASS_TIERS is the table the page reads; a new grass is a row (its clump, its spacing and reach, where it grows).
//
// The block expects the form channel's scope: THREE, scene, D (the form input), LAYER_U (the ground's uniforms: the
// undergrowth thins where the grass is), bytes().
import { WIND_AT_GLSL } from './terrain-wind.js';

/** The grass the page draws: each tier's clump (blades, segments, height m, width m, lean, spread m, X-crossed or all
 *  round; a `bed` of bristles, its blades scattered over its whole cell, one triangle each, so the cells run together as
 *  one even pile, a toothbrush, not tufts; `dark`, each bristle a darker twin just behind it), its grid's spacing and
 *  reach (m), and the sward it grows in. */
export const GRASS_TIERS = Object.freeze([
  Object.freeze({ id: 'tall', clump: { blades: 5, segs: 3, height: [0.65, 1], width: [0.022, 0.032], lean: [0.12, 0.3], spread: [0.03, 0.12], cross: false }, spacing: 0.34, reach: 13, scale: 1, sward: 'tall' }),
  Object.freeze({ id: 'tall-near', clump: { blades: 5, segs: 3, height: [0.65, 1], width: [0.022, 0.032], lean: [0.12, 0.3], spread: [0.03, 0.12], cross: false }, spacing: 0.17, reach: 5, scale: 0.85, sward: 'tall' }),
  Object.freeze({ id: 'short', clump: { blades: 10, segs: 1, height: [0.8, 1], width: [0.009, 0.013], lean: [0.02, 0.06], spread: [0, 0], cross: true, bed: true, dark: true }, spacing: 0.15, reach: 6, scale: 0.24, sward: 'short' }),
]);
/** How a short sward's bristle's dark twin sits: behind it (m), its height (× the bristle's) and its shade (× its colour). */
export const DARK_TWIN = Object.freeze({ back: 0.022, height: 0.72, shade: 0.4 });
/** How tall a blade stays as it dissolves into the carpet past its reach (× its height): it goes into the pile, it does
 *  not shrink out of the world. */
export const BLADE_KEEP = 0.8;
/** The carpet: its grid (radius and cell, m), its shells (near, and the share kept far off), where it thins and
 *  flattens into the ground (m), each sward's strands (the carpet's height, m, the blades' tops; the strands' cell, m;
 *  their width at the foot, × the cell; their lean, × the height; a dark twin, the short sward's), and how low it sits
 *  right by the eye, where the blades are the grass (× its height). */
/** A blade's height over its clump's, by its cell's dice: the least and the spread (a tall sward wandering, a short one
 *  near one height); and a carpet strand's over the carpet's. */
export const BLADE_RISE = Object.freeze({ tall: Object.freeze([0.5, 0.55]), short: Object.freeze([0.85, 0.2]) });
export const STRAND_RISE = Object.freeze([0.55, 0.45]);
const meanOf = (r) => r[0] + r[1] / 2;
// (the carpet's height: its strands' mean top where the sward's blades' mean top is, so a blade hands over at its own height)
const carpetHeight = (id, rise) => { const T = GRASS_TIERS.find((t) => t.id === id); return Math.round((T.scale * meanOf([T.clump.height[0], T.clump.height[1] - T.clump.height[0]]) * meanOf(rise)) / meanOf(STRAND_RISE) * 1000) / 1000; };
export const CARPET = Object.freeze({ radius: 40, cell: 1, shells: 10, farShells: 0.5, thin: [18, 32], flat: [30, 40],
  // (each sward's strands: blades seen wide, fewer and coarser than the blades they stand for, two to a cell)
  tall: Object.freeze({ height: carpetHeight('tall', BLADE_RISE.tall), cell: 0.16, width: 0.46, thick: 0.17, lean: 0.25 }),
  short: Object.freeze({ height: carpetHeight('short', BLADE_RISE.short), cell: 0.075, width: 0.46, thick: 0.2, lean: 0.12, twin: true }),
  near: 0.18 });
/** A drift's tint on the carpet over it (× its plants' mean colour): a kind that stands takes it whole and its height, a
 *  low one tints it. */
export const CARPET_DRIFT = Object.freeze({ stands: 1, among: 0.35 });
/** The wind on a blade: its top's lean per m/s of gust (× its height, at most `max`), and its quiver (× its height). */
export const GRASS_WIND = Object.freeze({ lean: 0.055, max: 0.85, quiver: 0.035, sheen: 0.12 });
/** The drifts' grids, for a kind that stands, one that lies among the blades, and the flowers: near (the plant grown
 *  full) and far (plain), spacing and reach (m), and how many cells hold a plant. One plant a cell, its form by the
 *  cell's dice, so every form of a kind draws the kind's one grid: a sparse kind is a wide grid, not a dense one kept thin. */
const fz = Object.freeze;
export const DRIFT_TIERS = fz({
  stands: fz({ near: fz({ spacing: 0.36, reach: 7 }), far: fz({ spacing: 0.55, reach: 16 }), keep: 0.9 }),
  among: fz({ near: fz({ spacing: 0.5, reach: 6 }), far: fz({ spacing: 0.8, reach: 14 }), keep: 0.7 }),
  flowers: fz({ near: fz({ spacing: 0.9, reach: 7 }), far: fz({ spacing: 1.3, reach: 16 }), keep: 0.8 }),
});

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
    const Gm = D.grass, GTIERS = ${JSON.stringify(GRASS_TIERS)}, DT = ${JSON.stringify(DRIFT_TIERS)}, TWIN = ${JSON.stringify(DARK_TWIN)};
    // (the wind: the page's gust field when it has one, read when a material compiles, after every script has run)
    const WIND_HEAD = ${JSON.stringify(WIND_HEAD)}, STILL_HEAD = ${JSON.stringify(STILL_HEAD)}, windU = () => window.__mojTerrain && window.__mojTerrain.wind && window.__mojTerrain.wind.uniforms;
    const windHead = (sh) => { const W = windU(); if (!W) return STILL_HEAD; Object.assign(sh.uniforms, { uWindT: W.uWindT, uWindA: W.uWindA, uWindB: W.uWindB, uWindNoise: W.uWindNoise }); return WIND_HEAD; };
    const gpx = bytes(Gm.px), gmap = new THREE.DataTexture(gpx, Gm.size[0], Gm.size[1], THREE.RGBAFormat); gmap.magFilter = gmap.minFilter = THREE.NearestFilter; gmap.needsUpdate = true;
    const GO = new THREE.Vector2(Gm.origin[0] - Gm.cell / 2, Gm.origin[1] - Gm.cell / 2), GM = new THREE.Vector2(Gm.size[0] * Gm.cell, Gm.size[1] * Gm.cell);
    // (the ground's undergrowth reads the same map, smoothly: thinner where the grass is)
    const gmapL = new THREE.DataTexture(gpx, Gm.size[0], Gm.size[1], THREE.RGBAFormat); gmapL.magFilter = gmapL.minFilter = THREE.LinearFilter; gmapL.needsUpdate = true;
    LAYER_U.tGrassL.value = gmapL; LAYER_U.uGOl.value.copy(GO); LAYER_U.uGMl.value.copy(GM); LAYER_U.uHasG.value = 1;
    // (the drifts' map, a channel each, or none: a cell of nothing)
    const Dr = Gm.drifts, dmap = Dr ? new THREE.DataTexture(bytes(Dr.px), Gm.size[0], Gm.size[1], THREE.RGBAFormat) : new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat);
    dmap.magFilter = dmap.minFilter = THREE.NearestFilter; dmap.needsUpdate = true;
    const chan = (k) => new THREE.Vector4(...[0, 1, 2, 3].map((c) => (c === k ? 1 : 0)));
    const replace = new THREE.Vector4(...[0, 1, 2, 3].map((c) => (Dr?.kinds[c]?.stands ? 1 : 0)));
    const grassCol = new THREE.Color().setRGB(...Gm.base.map((v) => Math.min(1, v)), THREE.LinearSRGBColorSpace);
    const GU = { tGrass: { value: gmap }, uGO: { value: GO }, uGM: { value: GM }, uGZ: { value: new THREE.Vector2(...Gm.z) }, tPath: LAYER_U.tPath, uPathO: LAYER_U.uPathO, uPathM: LAYER_U.uPathM, uHasPath: LAYER_U.uHasPath, uDress: LAYER_U.uDress, uSdIn: LAYER_U.uSdIn, tDrift: { value: dmap }, uReplace: { value: replace } };
    const GHEAD = 'uniform sampler2D tGrass, tPath, tDrift;\\nuniform vec2 uGO, uGM, uGZ, uPathO, uPathM;\\nuniform float uSp, uGR, uHs, uHasPath, uSdIn, uShort;\\nuniform vec3 uDress;\\nuniform vec4 uReplace;\\n'
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
    // (a tier: the clump instanced on its grid, SP apart out to GR, dissolving over its last reach)
    GTIERS.forEach((T, ti) => {
      const tg = clumpGeometry(T.clump, ti * 31, T.spacing), offs = [], n = Math.ceil(T.reach / T.spacing);
      for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) if (Math.hypot(i, j) * T.spacing <= T.reach + T.spacing) offs.push(i, j);
      tg.setAttribute('aOff', new THREE.InstancedBufferAttribute(new Float32Array(offs), 2)); tg.instanceCount = offs.length / 2;
      const TU = { ...GU, uSp: { value: T.spacing }, uGR: { value: T.reach }, uHs: { value: T.scale }, uShort: { value: T.sward === 'short' ? 1 : 0 } };
      const bm = new THREE.MeshStandardMaterial({ color: grassCol, roughness: 0.75, metalness: 0, side: THREE.DoubleSide });
      bm.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, TU);
        sh.vertexShader = GHEAD + windHead(sh) + 'attribute vec2 aOff;\\nattribute float bt;\\nvarying float vBt;\\nvarying float vFade;\\nvarying float vTone;\\n' + sh.vertexShader
          .replace('#include <beginnormal_vertex>', [
            'vec2 cellG = floor( cameraPosition.xy / uSp ) + aOff;',
            'vec2 hsh = fract( sin( vec2( dot( cellG, vec2( 12.9898, 78.233 ) ), dot( cellG, vec2( 39.3468, 11.135 ) ) ) ) * 43758.5453 );',
            'vec2 wpG = ( cellG + hsh ) * uSp;',
            'vec4 gq = texture( tGrass, ( wpG - uGO ) / uGM );',
            'float gz = uGZ.x + ( gq.r * 255.0 * 256.0 + gq.g * 255.0 ) / 65535.0 * uGZ.y;',
            'float dG = length( wpG - cameraPosition.xy ), sw = gq.a;',
            // (out to its reach, dissolving into the carpet over its last)
            'float fadeG = 1.0 - smoothstep( uGR * 0.55, uGR * 0.95, dG );',
            // (the sward here: a tall clump where it is long, shrinking toward a seam; a short one where it is kept short,
            // rising out of it; never both)
            'float mine = uShort > 0.5 ? step( 0.5, sw ) : 1.0 - step( 0.5, sw );',
            'float ease = uShort > 0.5 ? mix( 0.5, 1.0, smoothstep( 0.5, 0.9, sw ) ) : mix( 1.0, 0.4, smoothstep( 0.1, 0.5, sw ) );',
            // (and none where a drift that stands has taken the grass's place)
            'mine *= 1.0 - step( 0.5, dot( texture( tDrift, ( wpG - uGO ) / uGM ), uReplace ) );',
            'float keepG = step( fract( hsh.y * 13.7 + hsh.x * 3.1 ), gq.b * ( uShort > 0.5 ? 2.0 : 1.2 ) ) * mine;   // (fewer clumps where the grass thins, by their dice; a pile thins late)',
            // (a short sward near one height, a pile; a tall one wandering)
            'float hsG = keepG * smoothstep( 0.08, 0.6, gq.b ) * ( uShort > 0.5 ? ${BLADE_RISE.short[0]} + ${BLADE_RISE.short[1]} * hsh.y : ${BLADE_RISE.tall[0]} + ${BLADE_RISE.tall[1]} * hsh.y ) * mix( ${BLADE_KEEP}, 1.0, fadeG ) * ease * uHs;',
            'float pd = pdAt( wpG );',
            // (a short clump turned away from the trail, by the mask's slope, a little off; a tall one any way)
            'vec2 away = vec2( pdAt( wpG + vec2( 0.4, 0.0 ) ) - pdAt( wpG - vec2( 0.4, 0.0 ) ), pdAt( wpG + vec2( 0.0, 0.4 ) ) - pdAt( wpG - vec2( 0.0, 0.4 ) ) );',
            'float yawG = uShort > 0.5 && pd < 98.0 && dot( away, away ) > 1e-6 ? atan( away.y, away.x ) + ( hsh.x - 0.5 ) * 0.8 : hsh.x * 6.2831;',
            'mat2 rotG = mat2( cos( yawG ), sin( yawG ), -sin( yawG ), cos( yawG ) );',
            'vec3 objectNormal = normalize( vec3( rotG * vec2( 0.35, 0.0 ), 1.0 ) );',
            'vBt = bt; vFade = fadeG; vTone = ( 0.85 + 0.3 * fract( hsh.x * 7.31 ) ) * ( uShort > 0.5 ? 1.08 : 1.0 ) * ( 1.0 + fgGust( wpG ) );'].join('\\n'))
          .replace('#include <begin_vertex>', '// (no grass here: the clump gathered to a point, not laid flat; bent downwind by the gust at its root)\\n  vec3 transformed = vec3( wpG + rotG * position.xy * step( 0.001, hsG ), gz + position.z * hsG ) + fgBend( wpG, hsG, clamp( position.z, 0.0, 1.0 ), hsh.x * 13.0 + hsh.y );');
        sh.fragmentShader = 'uniform float uShort;\\nvarying float vBt;\\nvarying float vFade;\\nvarying float vTone;\\n' + sh.fragmentShader
          // (a short sward lit as one pile: a bristle seen from behind keeps its normal up, not flipped under)
          .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\\n  if ( uShort > 0.5 ) normal *= faceDirection;')
          // (a dark twin's coordinate is carried past 2: its own shade)
          .replace('#include <color_fragment>', '#include <color_fragment>\\n  if ( fract( sin( dot( floor( gl_FragCoord.xy ), vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ) > vFade ) discard;\\n  float dk = step( 1.5, vBt );\\n  diffuseColor.rgb *= mix( 0.45, 1.1, vBt - 2.0 * dk ) * vTone * mix( 1.0, ' + TWIN.shade.toFixed(3) + ', dk );');
      };
      bm.customProgramCacheKey = () => 'form-grass-' + T.id + (windU() ? '-wind' : '');
      const blades = new THREE.Mesh(tg, bm); blades.frustumCulled = false; blades.receiveShadow = true; scene.add(blades); __formMeshes.push(blades);
      window.__formGrass = (window.__formGrass || 0) + tg.instanceCount * tg.index.count / 3;
    });
    // the drifts: each kind's forms on a near grid and a far one, one plant a cell (its form by the cell's dice against the
    // forms' weights), grown where the kind's channel is past a half, eased in from its seam
    if (Dr) Dr.kinds.forEach((K, k) => {
      let w0 = 0;
      const CL = DT[K.id === 'flowers' ? 'flowers' : K.stands ? 'stands' : 'among'], keep = CL.keep;
      K.forms.forEach((Fm, fi) => {
        const win = new THREE.Vector2(w0, fi === K.forms.length - 1 ? 1.01 : w0 + Fm.w); w0 += Fm.w;
        ['near', 'far'].forEach((lv) => {
          const T = CL[lv], L = Fm[lv], tg = new THREE.InstancedBufferGeometry(), offs = [], n = Math.ceil(T.reach / T.spacing);
          tg.setAttribute('position', new THREE.Float32BufferAttribute(L.p, 3)); tg.setAttribute('color', new THREE.Float32BufferAttribute(L.c, 3));
          tg.setAttribute('normal', new THREE.Float32BufferAttribute(L.p.map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
          for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) if (Math.hypot(i, j) * T.spacing <= T.reach + T.spacing) offs.push(i, j);
          tg.setAttribute('aOff', new THREE.InstancedBufferAttribute(new Float32Array(offs), 2)); tg.instanceCount = offs.length / 2;
          const TU = { ...GU, uSp: { value: T.spacing }, uGR: { value: T.reach }, uIn: { value: lv === 'far' ? CL.near.reach : 0 }, uDrift: { value: chan(k) }, uW: { value: win },
            uH: { value: new THREE.Vector2(...K.heights) }, uKeep: { value: keep }, uFl: { value: K.id === 'flowers' ? 1 : 0 } };
          const dm = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
          dm.onBeforeCompile = (sh) => {
            Object.assign(sh.uniforms, TU);
            sh.vertexShader = GHEAD + windHead(sh) + 'uniform float uIn, uKeep, uFl;\\nuniform vec4 uDrift;\\nuniform vec2 uW, uH;\\nattribute vec2 aOff;\\nvarying float vBt;\\nvarying float vFade;\\n' + sh.vertexShader
              .replace('#include <beginnormal_vertex>', [
                'vec2 cellG = floor( cameraPosition.xy / uSp ) + aOff;',
                'vec2 hsh = fract( sin( vec2( dot( cellG, vec2( 12.9898, 78.233 ) ), dot( cellG, vec2( 39.3468, 11.135 ) ) ) ) * 43758.5453 );',
                'vec2 wpG = ( cellG + hsh ) * uSp;',
                'vec2 uvG = ( wpG - uGO ) / uGM;',
                'vec4 gq = texture( tGrass, uvG );',
                'float inD = dot( texture( tDrift, uvG ), uDrift );',
                'float gz = uGZ.x + ( gq.r * 255.0 * 256.0 + gq.g * 255.0 ) / 65535.0 * uGZ.y;',
                'float dG = length( wpG - cameraPosition.xy );',
                // (out to its reach, shrinking over its last; the far grid not within the near one's, the two swapping by scale)
                'float fadeG = ( 1.0 - smoothstep( uGR * 0.55, uGR * 0.95, dG ) ) * ( uIn > 0.0 ? smoothstep( uIn * 0.6, uIn * 0.95, dG ) : 1.0 );',
                'float pick = fract( hsh.x * 17.13 + hsh.y * 5.71 );',
                'float mine = step( 0.5, inD ) * step( uW.x, pick ) * ( 1.0 - step( uW.y, pick ) ) * step( fract( hsh.y * 29.1 + hsh.x * 7.7 ), uKeep * min( 1.0, gq.b * 1.3 ) );',
                'float hsG = mine * mix( uH.x, uH.y, fract( hsh.y * 3.3 ) ) * mix( 0.45, 1.0, smoothstep( 0.5, 0.85, inD ) ) * mix( 0.35, 1.0, fadeG ) * step( 0.02, fadeG ) * ( uFl > 0.5 ? mix( 1.0, 0.6, gq.a ) : 1.0 );',
                'float yawG = hsh.x * 6.2831;',
                'mat2 rotG = mat2( cos( yawG ), sin( yawG ), -sin( yawG ), cos( yawG ) );',
                'vec3 objectNormal = normalize( vec3( rotG * vec2( 0.35, 0.0 ), 1.0 ) );',
                'vBt = position.z; vFade = fadeG;'].join('\\n'))
              .replace('#include <begin_vertex>', 'vec3 transformed = vec3( wpG + rotG * position.xy * hsG, gz + position.z * hsG ) + fgBend( wpG, hsG, clamp( position.z, 0.0, 1.0 ), hsh.x * 13.0 + hsh.y );');
            sh.fragmentShader = 'varying float vBt;\\nvarying float vFade;\\n' + sh.fragmentShader
              // (a plant lit as one: a blade seen from behind keeps its normal up, not flipped under)
              .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\\n  normal *= faceDirection;')
              .replace('#include <color_fragment>', '#include <color_fragment>\\n  if ( fract( sin( dot( floor( gl_FragCoord.xy ), vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ) > vFade ) discard;\\n  diffuseColor.rgb *= mix( 0.6, 1.05, clamp( vBt, 0.0, 1.0 ) );');
          };
          dm.customProgramCacheKey = () => 'form-grass-drift' + (windU() ? '-wind' : '');
          const m = new THREE.Mesh(tg, dm); m.frustumCulled = false; m.receiveShadow = true; scene.add(m); __formMeshes.push(m);
          window.__formDrift = (window.__formDrift || 0) + tg.instanceCount * L.p.length / 9;
        });
      });
    });
    // the carpet: a grid round the camera drawn as shells stacked to the sward's height, each keeping its slice of the
    // strands (the blades' own numbers), the drifts' colours over theirs; thinning far off and flattening into the ground
    (function () {
      const CP = ${JSON.stringify(CARPET)}, CD = ${JSON.stringify(CARPET_DRIFT)}, n = Math.round((2 * CP.radius) / CP.cell), pos = [], idx = [];
      for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) pos.push(-CP.radius + i * CP.cell, -CP.radius + j * CP.cell, 0);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i; idx.push(a, a + 1, a + n + 2, a, a + n + 2, a + n + 1); }
      const cg = new THREE.InstancedBufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); cg.setIndex(idx);
      cg.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
      cg.setAttribute('aShell', new THREE.InstancedBufferAttribute(Float32Array.from({ length: CP.shells }, (_, k) => k), 1)); cg.instanceCount = CP.shells;
      // (each drift's tint and height over the carpet: its plants' mean colour, a kind that stands whole and at its height)
      const tone = [0, 1, 2, 3].map((k) => { const K = Dr && Dr.kinds[k]; if (!K || K.id === 'flowers') return [0, 0, 0, 0];
        let r = 0, g = 0, b = 0, m = 0; for (const F of K.forms) for (let q = 0; q < F.near.c.length; q += 3) { r += F.near.c[q]; g += F.near.c[q + 1]; b += F.near.c[q + 2]; m++; }
        return [r / m, g / m, b / m, K.stands ? CD.stands : CD.among]; });
      const dh = new THREE.Vector4(...[0, 1, 2, 3].map((k) => { const K = Dr && Dr.kinds[k]; return K && K.stands ? ((K.heights[0] + K.heights[1]) / 2) * 0.8 : 0; }));
      const CU = { ...GU, uGS: { value: new THREE.Vector2(Gm.size[0], Gm.size[1]) }, uCP: { value: new THREE.Vector4(CP.radius, CP.cell, CP.shells, CP.farShells) },
        uThin: { value: new THREE.Vector4(CP.thin[0], CP.thin[1], CP.flat[0], CP.flat[1]) }, uTallC: { value: new THREE.Vector4(CP.tall.height, CP.tall.cell, CP.tall.width, CP.tall.lean) },
        uShortC: { value: new THREE.Vector4(CP.short.height, CP.short.cell, CP.short.width, CP.short.lean) }, uNearC: { value: CP.near },
        uThick: { value: new THREE.Vector2(CP.tall.thick, CP.short.thick) },
        uDTone: { value: tone.map((t) => new THREE.Vector4(...t)) }, uDH: { value: dh }, uTwin: { value: new THREE.Vector2(TWIN.back, TWIN.height) }, uTwinS: { value: TWIN.shade } };
      const cm = new THREE.MeshStandardMaterial({ color: grassCol, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
      cm.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, CU);
        const HEAD = GHEAD + windHead(sh) + 'uniform vec2 uGS;\\nuniform vec4 uCP, uThin, uTallC, uShortC, uDH;\\nuniform float uNearC;\\n'
          + 'varying float vT, vSw, vCov;\\nvarying vec2 vXY;\\nvarying vec4 vDr;\\n'
          // (the ground's height between the map's cells, bilinear over its 16-bit heights)
          + 'float gzT( vec2 i ) { vec4 q = texture( tGrass, ( i + 0.5 ) / uGS ); return uGZ.x + ( q.r * 255.0 * 256.0 + q.g * 255.0 ) / 65535.0 * uGZ.y; }\\n'
          + 'float gzAt( vec2 p ) { vec2 g = ( p - uGO ) / uGM * uGS - 0.5, i = floor( g ), f = g - i; return mix( mix( gzT( i ), gzT( i + vec2( 1.0, 0.0 ) ), f.x ), mix( gzT( i + vec2( 0.0, 1.0 ) ), gzT( i + 1.0 ), f.x ), f.y ); }\\n';
        sh.vertexShader = HEAD + 'attribute float aShell;\\n' + sh.vertexShader
          .replace('#include <beginnormal_vertex>', [
            'vec2 wpC = floor( cameraPosition.xy / uCP.y ) * uCP.y + position.xy;',
            'vec2 uvC = ( wpC - uGO ) / uGM;',
            'vec4 gq = texture( tGrass, uvC ); vec4 dq = texture( tDrift, uvC );',
            'float dC = length( wpC - cameraPosition.xy );',
            // (the shells kept here: all near, a share far off; past them nothing drawn)
            'float keepS = step( aShell, uCP.z * mix( 1.0, uCP.w, smoothstep( uThin.x, uThin.y, dC ) ) - 0.5 );',
            'float sw = smoothstep( 0.3, 0.7, gq.a ), cov = smoothstep( 0.08, 0.6, gq.b );',
            // (its height: the sward's, a standing drift's where one stands; lower right by the eye, where the blades are the
            // grass; flat far off, where the ground's lines carry it)
            'float hC = mix( uTallC.x, uShortC.x, sw ); float dh = dot( step( 0.5, dq ), uDH ); hC = dh > 0.0 ? dh : hC;',
            'hC *= cov * mix( uNearC, 1.0, smoothstep( 1.0, 5.0, dC ) ) * ( 1.0 - smoothstep( uThin.z, uThin.w, dC ) );',
            'float tC = ( aShell + 1.0 ) / uCP.z;',
            'vec3 objectNormal = vec3( 0.0, 0.0, 1.0 );',
            'vT = tC; vSw = gq.a; vCov = gq.b * keepS * step( 0.004, hC ); vXY = wpC; vDr = dq;'].join('\\n'))
          .replace('#include <begin_vertex>', 'vec3 transformed = vec3( wpC, gzAt( wpC ) + 0.01 + tC * hC ) + fgBend( wpC, hC, tC, 0.0 ) * 0.6;');
        sh.fragmentShader = 'uniform vec4 uTallC, uShortC;\\nuniform vec2 uThick;\\nuniform vec4 uDTone[4];\\nuniform vec2 uTwin;\\nuniform float uTwinS;\\nvarying float vT, vSw, vCov;\\nvarying vec2 vXY;\\nvarying vec4 vDr;\\n'
          // (a strand's slice at height t: a blade seen wide, a strand a cell of a lattice shifted by sh, jittered, its height,
          // facing and lean its own, wide along its facing and thin across it, tapering to its tip; its coordinate up the
          // strand, or -1 where this shell has none here)
          + 'float strand( vec2 p, float t, vec4 C, float th, vec2 sh, float off, float hk ) { vec2 q = p / C.y + sh, c = floor( q ); vec2 h = fract( sin( vec2( dot( c, vec2( 127.1, 311.7 ) ), dot( c, vec2( 269.5, 183.3 ) ) ) ) * 43758.5453 );'
          + ' float hs = ( ${STRAND_RISE[0]} + ${STRAND_RISE[1]} * h.y ) * hk; if ( t > hs ) return -1.0; vec2 d = vec2( cos( h.x * 6.2832 ), sin( h.x * 6.2832 ) );'
          + ' vec2 ctr = c + 0.25 + 0.5 * h + d * ( C.w * t * t / hs ) * 4.0 + off * d / C.y; vec2 r = q - ctr; float k = 1.0 - t / hs;'
          + ' return abs( dot( r, d ) ) < C.z * k && abs( r.x * d.y - r.y * d.x ) < th * ( 0.4 + 0.6 * k ) ? t / hs : -1.0; }\\n'
          + sh.fragmentShader
          .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\\n  normal *= faceDirection;')
          .replace('#include <color_fragment>', [
            '#include <color_fragment>',
            '  if ( vCov < 0.02 ) discard;',
            '  bool shortS = vSw > 0.5; vec4 C = shortS ? uShortC : uTallC;',
            '  float th = shortS ? uThick.y : uThick.x, u = strand( vXY, vT, C, th, vec2( 0.0 ), 0.0, 1.0 ), dk = 0.0;',
            // (two strands a cell, the second on a lattice shifted half a cell: wide coverage from few strands)
            '  if ( u < 0.0 ) u = strand( vXY, vT, C, th, vec2( 0.5 ), 0.0, 1.0 );',
            // (the short sward's dark twin: a little behind, lower, its own shade)
            '  if ( u < 0.0 && shortS ) { u = strand( vXY, vT, C, th, vec2( 0.0 ), uTwin.x, uTwin.y ); dk = 1.0; }',
            // (fewer strands where the grass thins, by their cell's dice)
            '  vec2 cc = floor( vXY / C.y ); if ( u < 0.0 || fract( sin( dot( cc, vec2( 41.3, 289.1 ) ) ) * 43758.5453 ) > vCov * 1.3 ) discard;',
            '  float tn = 0.85 + 0.3 * fract( sin( dot( cc, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );',
            '  diffuseColor.rgb *= mix( 0.45, 1.1, u ) * tn * mix( 1.0, uTwinS, dk ) * ( shortS ? 1.08 : 1.0 );',
            // (a drift's colour over the carpet in its area)
            '  for ( int k = 0; k < 4; k++ ) { float on = step( 0.5, vDr[k] ) * uDTone[k].w; if ( on > 0.0 ) diffuseColor.rgb = mix( diffuseColor.rgb, uDTone[k].rgb * mix( 0.5, 1.15, u ) * tn, on ); }'].join('\\n'));
      };
      cm.customProgramCacheKey = () => 'form-grass-carpet' + (windU() ? '-wind' : '');
      const carpet = new THREE.Mesh(cg, cm); carpet.frustumCulled = false; carpet.receiveShadow = true; scene.add(carpet); __formMeshes.push(carpet);
      window.__formCarpet = (cg.instanceCount * idx.length) / 3;
    })();
  }
`;
}

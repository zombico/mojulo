// In-page script (part of the form channel, channels/form-land.js): THE GRASS of the form render (gen-7), real blades
// lit by the form's sun, no card and no painted light. It reads the land read's ground map (form/land-read.js `grass`:
// the ground's height and where grass grows, at half a metre) and the trail's mask (its signed distance), and draws:
//
//   tiers   clumps instanced on grids that walk with the camera, each clump's place, turn, height and tone its world
//           cell's dice (nothing shuffles as the eye moves; toward a tier's reach it thins, each clump going whole at a
//           distance of its own, never a ring at once). Which grows where is the SWARD, a mood's choice (the biocube's `flora.grass.sward`, in the map's fourth
//           channel, its length: 0 tall, a half medium, 1 short): the TALL clump (five blades, three segments) where the
//           sward is long; the MEDIUM one, the same clump lower on a finer grid, in the medium areas; the SHORT sward a
//           bed of bristles (a triangle each, scattered over the whole cell, near one height, lit as one pile, each with a
//           darker twin just behind it, a line of shade that gives the pile its depth) where it is kept short, turned
//           away from the trail, so the eye on the trail meets their faces. An area is wholly one length: at a seam the
//           longer shrinks and the shorter rises, never interspersed, never one over another. Past its reach each
//           tier thins, each clump gone whole at its own distance, among the patches risen under it
//   carpet  the far grass, every length's (PATCHES): wandering patches that fit one another, each a low tile a little
//           under its grass's tips, ringed by a skirt of real blades and a few out of its top; near the eye they sink
//           under the near blades, so close enough it is real grass
//   drifts  wheat, chaff, any grass kind and the flowers, each in areas of its own (form/grass-drifts.js: the library's
//           plants, their colours carried into the cube's light, a channel each of a second map), on grids of their own,
//           near grown full (L1), far plain (L0), one plant a cell picked by its dice and its form's weight; a kind that
//           stands (wheat) takes the blades' place, a low one (chaff, the flowers) stands among them
//   wind    the page's one gust field (channels/terrain-wind.js, the gen-6 live grass's wind kept on a form page with its
//           blades off: the trees' crowns sway in it): every blade, point and plant bends downwind by the gust at its root,
//           its top the most, with a quiver of its own, and a gust's band reads a shade brighter as it passes, so the
//           field waves as one with the trees. No wind: all stands still
//
// GRASS_TIERS is the table the page reads; a new grass is a row (its clump, its spacing and reach, where it grows, and
// the near tier it takes over from).
//
// The block expects the form channel's scope: THREE, scene, D (the form input), LAYER_U (the ground's uniforms: the
// undergrowth thins where the grass is), bytes().
import { WIND_AT_GLSL } from './terrain-wind.js';

/** The grass the page draws: each tier's clump (blades, segments, height m, width m, lean, spread m, X-crossed or all
 *  round; a `bed` of bristles, its blades scattered over its whole cell, one triangle each, so the cells run together as
 *  one even pile, a toothbrush, not tufts; `dark`, each bristle a darker twin just behind it), its grid's spacing and
 *  reach (m), and the sward it grows in, alone (SWARD_LENGTH: its length on the map). */
export const GRASS_TIERS = Object.freeze([
  Object.freeze({ id: 'tall', clump: { blades: 5, segs: 3, height: [0.65, 1], width: [0.02, 0.029], lean: [0.12, 0.3], spread: [0.03, 0.12], cross: false }, spacing: 0.31, reach: 42, scale: 1, sward: 'tall' }),
  Object.freeze({ id: 'medium', clump: { blades: 5, segs: 3, height: [0.65, 1], width: [0.018, 0.025], lean: [0.1, 0.24], spread: [0.03, 0.1], cross: false }, spacing: 0.183, reach: 20, scale: 0.55, sward: 'medium' }),
  Object.freeze({ id: 'short', clump: { blades: 10, segs: 1, height: [0.8, 1], width: [0.008, 0.012], lean: [0.02, 0.06], spread: [0, 0], cross: true, bed: true, dark: true }, spacing: 0.137, reach: 18, scale: 0.24, sward: 'short' }),
]);
/** How a near tier hands over to the patches (× its reach), timed so nothing grows as the eye walks: the patches RISE
 *  under the near blades while they still stand full (`rise`), hidden in them; then the blades THIN (`thin`), each clump
 *  at a distance of its own, picked by its dice from the band (most late: thick near, thinning fast toward the end),
 *  so the further off the fewer, down to none at the reach,
 *  their last ones standing among the patches' own blades. A clump goes whole, over `grow` m of the eye's walk, never
 *  all of a ring at once and never dithered. */
export const HANDOVER = Object.freeze({ rise: Object.freeze([0.17, 0.3]), thin: Object.freeze([0.3, 1]), grow: 0.6 });
/** The near tiers reach to the eye's horizon of attention, so where real grass gives out is never where one looks; their
 *  far rings cost what they show. A tier is drawn in RINGS (`rings`: their outer bounds × its reach, the last the reach):
 *  the first on its own grid, each further one on a grid twice as coarse, its cells a fixed one of the four under it
 *  (by the coarse cell's dice), so a ring draws only the clumps that live that far, and draws them exactly as the ring
 *  within it did: a clump crossing a ring's bound changes grids, not form. A clump's own distance, where it goes, falls
 *  in the thinning band short of the bound of the last ring it belongs to; so three in four are gone by the first bound,
 *  and so on out. */
export const GRASS_RINGS = Object.freeze({ rings: Object.freeze([0.55, 0.78]) });
/** THE CARPET, the far grass of every length: PATCHES laid over the grass, each standing for the grass it covers, of its
 *  own kind (the near tall clump, `paradigm`, at the section's height): a low top `top` of the way to its grass's tips
 *  (each section's near blades' tips) with a few real tufts out of it (`tufts`, each reaching `tuft` × the tips over it)
 *  to indicate it. The patches are a grid of `size` m, every point of it moved by one smooth field over the world (`warp`:
 *  its reach × the size, its cell × the size), so they fit one another exactly yet wander: no grid, no shape that
 *  repeats. Where a patch has no neighbour its side is the SKIRT, real clumps of its kind one every `gap` m along it (their
 *  spread covering `cover` of it at the least), standing from the ground to `tip` × the tips, before a backing shaded as a
 *  stand of blades is through its middle; where patches meet, no side. And the BLEND: on the sides that face the eye in
 *  the ring where the live grass thins (`blend`: × the section's near reach), the same clumps, so the live grass runs
 *  into the patches; each comes and goes whole at a distance of its own. A patch only where grass is (its middle past `on` of the map's cover), none across a drop (its
 *  corners' ground spanning past `steep` × the size); its height the grass's where each point of it stands, wandering a
 *  little (± `vary`), so two patches meet at one height and no seam opens. Its shade is the near blades' rule, root to
 *  tip, its tone the ground's wandering over metres and a blade's its own dice, so no patch reads as a patch. FAR, the
 *  patches are their green alone, the tops and their sides' backing; within `near` m the blades come in, the tufts,
 *  the skirts and the blend, the skirt on a side facing the eye DENSE (`dense`: its clumps a gap apart in rows, each
 *  row staggered and a step further out), the rest one row a `gap` apart; the near set chosen again as the eye crosses a
 *  cell, so its cost is what stands near, each piece going whole at its own distance toward `near`. Near the eye the
 *  patches sink under the near blades (HANDOVER): close enough it is real grass. */
export const PATCHES = Object.freeze({ size: 2, top: 0.75, tip: Object.freeze([0.95, 1.1]), paradigm: 'tall', gap: 0.24, dense: Object.freeze({ gap: 0.16, rows: 2, step: 0.05 }), cover: 0.8, tufts: 3, tuft: Object.freeze([0.25, 0.45]),
  near: 36, blend: Object.freeze([0.3, 0.6]), warp: Object.freeze({ reach: 0.38, cell: 1.3 }), edge: 8, vary: 0.03, on: 0.3, steep: 0.6 });
/** Each sward's length on the grass map (its fourth channel) and the half-width of its band there. */
export const SWARD_LENGTH = Object.freeze({ tall: 0, medium: 0.5, short: 1, band: 0.25 });
/** How a short sward's bristle's dark twin sits: behind it (m), its height (× the bristle's) and its shade (× its colour). */
export const DARK_TWIN = Object.freeze({ back: 0.022, height: 0.72, shade: 0.4 });
/** A blade's height over its clump's, by its cell's dice: the least and the spread (a tall sward wandering, a short one
 *  near one height). */
export const BLADE_RISE = Object.freeze({ tall: Object.freeze([0.5, 0.55]), medium: Object.freeze([0.6, 0.45]), short: Object.freeze([0.85, 0.2]) });
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
    const Gm = D.grass, GTIERS = ${JSON.stringify(GRASS_TIERS)}, DT = ${JSON.stringify(DRIFT_TIERS)}, TWIN = ${JSON.stringify(DARK_TWIN)}, SL = ${JSON.stringify(SWARD_LENGTH)}, GRG = ${JSON.stringify(GRASS_RINGS.rings)}, BR = ${JSON.stringify(BLADE_RISE)}, HO = ${JSON.stringify(HANDOVER)};
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
      // (a thing's own distance out of a band, by its dice r: whole short of it, gone past it, going over w m)
      // (which of a coarse cell's four cells it keeps for the ring of its level: a fixed one, by its dice)
      + 'vec2 fgPick( vec2 c, float l ) { return floor( fract( sin( vec2( dot( c, vec2( 27.17, 91.3 ) ) + l * 13.1, dot( c, vec2( 63.7, 17.9 ) ) + l * 7.7 ) ) * 43758.5453 ) * 2.0 ); }\\n'
      + 'float fgStage( float d, float a, float b, float r, float w ) { float k = mix( a, b, r ); return 1.0 - smoothstep( k - w, k, d ); }\\n'
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
    // (a tier: the clump instanced on its grid, SP apart out to GR, in rings, each further one a coarser grid of the
    // clumps that live that far, thinning toward the reach)
    GTIERS.forEach((T, ti) => {
      const tg0 = clumpGeometry(T.clump, ti * 31, T.spacing), RB = [0, ...GRG.map((f) => f * T.reach), T.reach];
      RB.slice(1).forEach((rOut, lv) => {
        const sp = T.spacing * 2 ** lv, rIn = RB[lv], tg = lv ? tg0.clone() : tg0, offs = [], n = Math.ceil(rOut / sp) + 1;
        for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) { const r = Math.hypot(i, j) * sp; if (r <= rOut + sp * 1.5 && r >= rIn - sp * 1.5) offs.push(i, j); }
        tg.setAttribute('aOff', new THREE.InstancedBufferAttribute(new Float32Array(offs), 2)); tg.instanceCount = offs.length / 2;
        const TU = { ...GU, uSp: { value: T.spacing }, uGR: { value: T.reach }, uHs: { value: T.scale }, uShort: { value: T.sward === 'short' ? 1 : 0 }, uLen: { value: SL[T.sward] }, uRise: { value: new THREE.Vector2(...BR[T.sward]) },
          uLv: { value: lv }, uBand: { value: new THREE.Vector2(rIn, lv === RB.length - 2 ? 1e6 : rOut) }, uRings: { value: new THREE.Vector2(RB[1], RB[2]) } };
        const bm = new THREE.MeshStandardMaterial({ color: grassCol, roughness: 0.75, metalness: 0, side: THREE.DoubleSide });
        bm.onBeforeCompile = (sh) => {
          Object.assign(sh.uniforms, TU);
          sh.vertexShader = GHEAD + windHead(sh) + 'uniform float uLen, uLv;\\nuniform vec2 uRise, uBand, uRings;\\nattribute vec2 aOff;\\nattribute float bt;\\nvarying float vBt;\\nvarying float vTone;\\n' + sh.vertexShader
            .replace('#include <beginnormal_vertex>', [
              // (its cell on its ring's grid, down to the fine cell it keeps; and the furthest ring that fine cell lives in)
              'vec2 cellG = floor( cameraPosition.xy / ( uSp * exp2( uLv ) ) ) + aOff;',
              'for ( int l = 2; l >= 1; l-- ) if ( float( l ) <= uLv ) cellG = 2.0 * cellG + fgPick( cellG, float( l ) );',
              'float lvC = 0.0; vec2 cQ = cellG;',
              'for ( int l = 1; l <= 2; l++ ) { vec2 cP = floor( cQ * 0.5 ); if ( lvC > float( l ) - 1.5 && all( equal( cQ - 2.0 * cP, fgPick( cP, float( l ) ) ) ) ) { lvC = float( l ); cQ = cP; } }',
              'vec2 hsh = fract( sin( vec2( dot( cellG, vec2( 12.9898, 78.233 ) ), dot( cellG, vec2( 39.3468, 11.135 ) ) ) ) * 43758.5453 );',
              'vec2 wpG = ( cellG + hsh ) * uSp;',
              'vec4 gq = texture( tGrass, ( wpG - uGO ) / uGM );',
              'float gz = uGZ.x + ( gq.r * 255.0 * 256.0 + gq.g * 255.0 ) / 65535.0 * uGZ.y;',
              'float dG = length( wpG - cameraPosition.xy ), sw = gq.a;',
              // (thinning toward its reach: each clump gone whole at its own distance, short of the bound of the last ring it
              // lives in, the further the fewer; drawn by this ring's grid only within its band)
              'float kEnd = lvC < 0.5 ? uRings.x : ( lvC < 1.5 ? uRings.y : uGR * ${HANDOVER.thin[1].toFixed(2)} );',
              'float outG = fgStage( dG, uGR * ${HANDOVER.thin[0].toFixed(2)}, kEnd, sqrt( fract( hsh.x * 91.7 + hsh.y * 17.3 ) ), ${HANDOVER.grow.toFixed(2)} ) * step( uBand.x, dG ) * ( 1.0 - step( uBand.y, dG ) );',
              // (the sward here: this tier's clump only where the sward is its length, shrinking toward a seam; never two
              // lengths in one place)
              'float dL = abs( sw - uLen ) / ${SWARD_LENGTH.band};',
              'float mine = 1.0 - step( 1.0, dL );',
              'float ease = mix( 1.0, 0.45, smoothstep( 0.2, 1.0, dL ) );',
              // (and none where a drift that stands has taken the grass's place)
              'mine *= 1.0 - step( 0.5, dot( texture( tDrift, ( wpG - uGO ) / uGM ), uReplace ) );',
              'float keepG = step( fract( hsh.y * 13.7 + hsh.x * 3.1 ), gq.b * ( uShort > 0.5 ? 2.0 : 1.2 ) ) * mine;   // (fewer clumps where the grass thins, by their dice; a pile thins late)',
              // (a short sward near one height, a pile; a tall one wandering)
              'float hsG = keepG * smoothstep( 0.08, 0.6, gq.b ) * ( uRise.x + uRise.y * hsh.y ) * outG * ease * uHs;',
              'float pd = pdAt( wpG );',
              // (a short clump turned away from the trail, by the mask's slope, a little off; a tall one any way)
              'vec2 away = vec2( pdAt( wpG + vec2( 0.4, 0.0 ) ) - pdAt( wpG - vec2( 0.4, 0.0 ) ), pdAt( wpG + vec2( 0.0, 0.4 ) ) - pdAt( wpG - vec2( 0.0, 0.4 ) ) );',
              'float yawG = uShort > 0.5 && pd < 98.0 && dot( away, away ) > 1e-6 ? atan( away.y, away.x ) + ( hsh.x - 0.5 ) * 0.8 : hsh.x * 6.2831;',
              'mat2 rotG = mat2( cos( yawG ), sin( yawG ), -sin( yawG ), cos( yawG ) );',
              'vec3 objectNormal = normalize( vec3( rotG * vec2( 0.35, 0.0 ), 1.0 ) );',
              'vBt = bt; vTone = ( 0.85 + 0.3 * fract( hsh.x * 7.31 ) ) * ( uShort > 0.5 ? 1.08 : 1.0 ) * ( 1.0 + fgGust( wpG ) );'].join('\\n'))
            .replace('#include <begin_vertex>', '// (no grass here: the clump gathered to a point, not laid flat; bent downwind by the gust at its root)\\n  vec3 transformed = vec3( wpG + rotG * position.xy * step( 0.001, hsG ), gz + position.z * hsG ) + fgBend( wpG, hsG, clamp( position.z, 0.0, 1.0 ), hsh.x * 13.0 + hsh.y );');
          sh.fragmentShader = 'uniform float uShort;\\nvarying float vBt;\\nvarying float vTone;\\n' + sh.fragmentShader
            // (a short sward lit as one pile: a bristle seen from behind keeps its normal up, not flipped under)
            .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\\n  if ( uShort > 0.5 ) normal *= faceDirection;')
            // (a dark twin's coordinate is carried past 2: its own shade)
            .replace('#include <color_fragment>', '#include <color_fragment>\\n  float dk = step( 1.5, vBt );\\n  diffuseColor.rgb *= mix( 0.45, 1.1, vBt - 2.0 * dk ) * vTone * mix( 1.0, ' + TWIN.shade.toFixed(3) + ', dk );');
        };
        bm.customProgramCacheKey = () => 'form-grass-' + T.id + (windU() ? '-wind' : '');
        const blades = new THREE.Mesh(tg, bm); blades.frustumCulled = false; blades.receiveShadow = true; scene.add(blades); __formMeshes.push(blades);
        window.__formGrass = (window.__formGrass || 0) + tg.instanceCount * tg.index.count / 3;
      });
    });
    // the CARPET: patches over the grass, past the near blades, each a low top with a few real tufts out of it; on each
    // side no patch borders the skirt, real clumps of its kind; on the sides facing the eye where the live grass hands
    // over, the blend, the same clumps. One shape for every top and one for every side, warped where it stands
    (function () {
      const JG = ${JSON.stringify(PATCHES)}, S = JG.size, secV = (f) => new THREE.Vector3(...['tall', 'medium', 'short'].map((w) => f(GTIERS.find((q) => q.sward === w))));
      // (each section's tips, where the near blades' reach out; and the reach, where the patches rise)
      const tipTop = (q) => q.scale * q.clump.height[1] * (BR[q.sward][0] + BR[q.sward][1]), JH = secV(tipTop), JN = secV((q) => q.reach);
      const secOf = (v, sw) => (sw < 0.5 ? v.x + (v.y - v.x) * Math.min(1, Math.max(0, (sw - 0.15) / 0.2)) : v.y + (v.z - v.y) * Math.min(1, Math.max(0, (sw - 0.65) / 0.2)));
      // (a shape's vertices: its place (a top's in its cell; a side's along it and out of it, m), its height as a share of
      // the tips (zf), its shade up a blade (bt) and whether it is a blade (bl, the wind's to bend))
      const shape = () => { const S0 = { pos: [], zf: [], bt: [], bl: [], idx: [] }; S0.v = (x, y, z, b, l) => { S0.pos.push(x, y, 0); S0.zf.push(z); S0.bt.push(b); S0.bl.push(l); return S0.pos.length / 3 - 1; }; return S0; };
      const geoOf = (S0) => { const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(S0.pos, 3)); for (const a of ['zf', 'bt', 'bl']) g.setAttribute(a, new THREE.Float32BufferAttribute(S0[a], 1)); g.setIndex(S0.idx); g.setAttribute('normal', new THREE.Float32BufferAttribute(S0.pos.map((_, q) => (q % 3 === 2 ? 1 : 0)), 3)); return g; };
      // (a real clump of the patch's kind into a shape: the near tier's own blades, its xy in metres (sx, sy: the
      // shape's units a metre), its height from zf0, the clump's tips at zf0 + reach)
      const PD = GTIERS.find((q) => q.sward === JG.paradigm), ptop = PD.clump.height[1];
      const clumpInto = (S0, seed, x, y, sx, sy, zf0, reach) => {
        const g = clumpGeometry(PD.clump, seed, PD.spacing), P = g.getAttribute('position').array, B = g.getAttribute('bt').array, I = g.index.array, base = S0.pos.length / 3, yw = hb(seed, 3) * 6.2832, c = Math.cos(yw), sn = Math.sin(yw);
        for (let k = 0; k < P.length / 3; k++) { const px = P[k * 3], py = P[k * 3 + 1]; S0.v(x + (px * c - py * sn) * sx, y + (px * sn + py * c) * sy, zf0 + (P[k * 3 + 2] / ptop) * reach, B[k], 1); }
        for (const q of I) S0.idx.push(base + q);
      };
      // (the top: its outline the cell's square, edge points a side, a fan from its middle; the tufts a shape of their own)
      const T = shape(), TU = shape(), O = []; for (let e = 0; e < 4; e++) for (let k = 0; k < JG.edge; k++) { const t = k / JG.edge; O.push([[t, 0], [1, t], [1 - t, 1], [0, 1 - t]][e]); }
      const c0 = T.v(0.5, 0.5, JG.top, 0.8, 0), ring = O.map(([x, y]) => T.v(x, y, JG.top, 0.8, 0));
      for (let k = 0; k < O.length; k++) T.idx.push(c0, ring[k], ring[(k + 1) % O.length]);
      for (let q = 0; q < JG.tufts; q++) clumpInto(TU, 501 + q * 7, 0.15 + 0.7 * hb(q, 61), 0.15 + 0.7 * hb(q, 67), 1 / S, 1 / S, JG.top * 0.8, JG.tuft[0] + (JG.tuft[1] - JG.tuft[0]) * hb(q, 73) + JG.top * 0.2);
      // (a side: along it (x, 0..1) and out of it (y, m): its backing from the ground to the top, far and near; its clumps
      // near, from the ground to past the top: a sparse row, or the dense rows on a side facing the eye)
      const WB = shape(), WS = shape(), WD = shape();
      for (let k = 0; k < JG.edge; k++) { const a = WB.v(k / JG.edge, -0.02, 0, 0.35, 0), b = WB.v((k + 1) / JG.edge, -0.02, 0, 0.35, 0), d = WB.v((k + 1) / JG.edge, -0.02, JG.top, 0.8, 0), e = WB.v(k / JG.edge, -0.02, JG.top, 0.8, 0); WB.idx.push(a, b, d, a, d, e); }
      const rowInto = (S0, gap, r, off, seed) => { for (let t = (0.5 + 0.5 * r) * gap / S, n = 0; t < 1; t += gap / S, n++) clumpInto(S0, seed + n * 13, t + (hb(n + r * 97, 81) - 0.5) * 0.3 * gap / S, off + 0.04 * hb(n + r * 97, 83), 1 / S, 1, 0, JG.tip[0] + (JG.tip[1] - JG.tip[0]) * hb(n + r * 97, 87)); };
      rowInto(WS, JG.gap, 0, 0.02, 701);
      for (let r = 0; r < JG.dense.rows; r++) rowInto(WD, JG.dense.gap, r, 0.02 + r * JG.dense.step, 901 + r * 331);
      // (the patches: every cell of the grid over the map whose middle is grass and whose corners do not span a drop)
      const [nx, ny] = Gm.size, mapAt = (x, y) => { const i = Math.round((x - Gm.origin[0]) / Gm.cell), j = Math.round((y - Gm.origin[1]) / Gm.cell); if (i < 0 || j < 0 || i >= nx || j >= ny) return null; const q = (j * nx + i) * 4; return { z: Gm.z[0] + ((gpx[q] * 256 + gpx[q + 1]) / 65535) * Gm.z[1], c: gpx[q + 2] / 255, sw: gpx[q + 3] / 255 }; };
      const x0 = Gm.origin[0], y0 = Gm.origin[1], X1 = x0 + (nx - 1) * Gm.cell, Y1 = y0 + (ny - 1) * Gm.cell, at = new Map(), key = (i, j) => i + ',' + j;
      for (let j = Math.floor(y0 / S); j * S < Y1; j++) for (let i = Math.floor(x0 / S); i * S < X1; i++) {
        const m = mapAt((i + 0.5) * S, (j + 0.5) * S); if (!m || m.c < JG.on) continue;
        const cs = [[i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]].map(([a, b]) => mapAt(a * S, b * S)); if (cs.some((q) => !q)) continue;
        const zs = cs.map((q) => q.z); if (Math.max(...zs) - Math.min(...zs) > JG.steep * S) continue;
        at.set(key(i, j), { i, j, nR: secOf(JN, m.sw), d: hb(i * 3.3, j * 5.9) });
      }
      if (!at.size) return;
      const SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]], OUT = SIDES, MID = [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]];
      const tops = [], backs = [];
      for (const P of at.values()) { tops.push(P.i, P.j, 0, 0, P.d); SIDES.forEach(([di, dj], sd) => { if (!at.has(key(P.i + di, P.j + dj))) backs.push(P.i, P.j, sd, 0, 0, P.d); }); }
      const JU = { ...GU, uGS: { value: new THREE.Vector2(Gm.size[0], Gm.size[1]) }, uS: { value: S }, uJH: { value: JH }, uJN: { value: JN }, uNear: { value: JG.near } };
      const mat = (kind, near) => {
        const side = kind === 'side';
        const m = new THREE.MeshStandardMaterial({ color: grassCol, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
        m.onBeforeCompile = (sh) => {
          Object.assign(sh.uniforms, JU);
          sh.vertexShader = GHEAD + windHead(sh) + 'uniform vec2 uGS;\\nuniform float uS, uNear;\\nuniform vec3 uJH, uJN;\\nattribute vec' + (side ? 3 : 2) + ' aCell;\\nattribute vec3 aPiece;\\nattribute float zf;\\nattribute float bt;\\nattribute float bl;\\nvarying float vBt;\\nvarying float vTone;\\n'
            + 'float gzT( vec2 i ) { vec4 q = texture( tGrass, ( i + 0.5 ) / uGS ); return uGZ.x + ( q.r * 255.0 * 256.0 + q.g * 255.0 ) / 65535.0 * uGZ.y; }\\n'
            + 'float gzAt( vec2 p ) { vec2 g = ( p - uGO ) / uGM * uGS - 0.5, i = floor( g ), f = g - i; return mix( mix( gzT( i ), gzT( i + vec2( 1.0, 0.0 ) ), f.x ), mix( gzT( i + vec2( 0.0, 1.0 ) ), gzT( i + 1.0 ), f.x ), f.y ); }\\n'
            + 'float vnJ( vec2 p ) { vec2 i = floor( p ), f = p - i; f = f * f * ( 3.0 - 2.0 * f ); float a = fract( sin( dot( i, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ), b = fract( sin( dot( i + vec2( 1.0, 0.0 ), vec2( 127.1, 311.7 ) ) ) * 43758.5453 ), c = fract( sin( dot( i + vec2( 0.0, 1.0 ), vec2( 127.1, 311.7 ) ) ) * 43758.5453 ), d = fract( sin( dot( i + 1.0, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); return mix( mix( a, b, f.x ), mix( c, d, f.x ), f.y ); }\\n'
            + 'float secOf( vec3 v, float sw ) { return sw < 0.5 ? mix( v.x, v.y, smoothstep( 0.15, 0.35, sw ) ) : mix( v.y, v.z, smoothstep( 0.65, 0.85, sw ) ); }\\n'
            + 'vec2 warpJ( vec2 g0 ) { vec2 wq = g0 / ( uS * ' + JG.warp.cell.toFixed(2) + ' ); return g0 + ( vec2( vnJ( wq ), vnJ( wq + vec2( 17.3, 5.1 ) ) ) - 0.5 ) * 2.0 * ' + JG.warp.reach.toFixed(2) + ' * uS; }\\n'
            + sh.vertexShader
              .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\\n  objectNormal = vec3( 0.0, 0.0, 1.0 );')
              .replace('#include <begin_vertex>', [
                // (its place in the world: a top's point in its cell, a side's along it and out of it, the grid's point moved
                // by the one field, so a side stands on its top's edge and neighbours fit)
                side ? 'vec2 SD[4]; SD[0] = vec2( 1.0, 0.0 ); SD[1] = vec2( 0.0, 1.0 ); SD[2] = vec2( -1.0, 0.0 ); SD[3] = vec2( 0.0, -1.0 ); vec2 C0[4]; C0[0] = vec2( 0.0, 0.0 ); C0[1] = vec2( 1.0, 0.0 ); C0[2] = vec2( 1.0, 1.0 ); C0[3] = vec2( 0.0, 1.0 ); int sd = int( aCell.z + 0.5 ); vec2 dir = SD[sd];' : '',
                side ? 'vec2 g0 = ( aCell.xy + C0[sd] + dir * position.x ) * uS; vec2 eW = warpJ( g0 + dir * 0.05 * uS ) - warpJ( g0 - dir * 0.05 * uS ); vec2 oW = normalize( vec2( eW.y, -eW.x ) ); vec2 wpJ = warpJ( g0 ) + oW * position.y;' : 'vec2 wpJ = warpJ( ( aCell + position.xy ) * uS );',
                // (its height the grass's where the point stands, risen under the near blades while they stand full: a point two
                // patches share stands as high in both, so no seam opens between them; close enough, real grass)
                'float swJ = texture( tGrass, ( wpJ - uGO ) / uGM ).a, dJ = length( wpJ - cameraPosition.xy ), nRJ = secOf( uJN, swJ );',
                'float lift = smoothstep( nRJ * ${HANDOVER.rise[0].toFixed(2)}, nRJ * ${HANDOVER.rise[1].toFixed(2)}, dJ );',
                // (a piece comes and goes whole, at a distance of its own by its dice, measured to its middle)
                side ? 'vec2 mP = warpJ( ( aCell.xy + C0[sd] + dir * 0.5 ) * uS );' : 'vec2 mP = warpJ( ( aCell + 0.5 ) * uS );',
                'float dP = length( mP - cameraPosition.xy ), rP = fract( aPiece.z * 7.13 + ' + (side ? 'aCell.z * 0.29' : '0.0') + ' ), rQ = fract( rP * 13.7 + 0.41 );',
                // (a blend side at its full height, the live grass's and the patch's at once, where the live grass thins)
                'lift = mix( lift, ( 1.0 - fgStage( dP, nRJ * ${PATCHES.blend[0].toFixed(2)}, nRJ * ${(PATCHES.blend[0] + 0.1).toFixed(2)}, rP, ${HANDOVER.grow.toFixed(2)} ) ) * fgStage( dP, nRJ * ${(PATCHES.blend[1] - 0.15).toFixed(2)}, nRJ * ${PATCHES.blend[1].toFixed(2)}, rQ, ${HANDOVER.grow.toFixed(2)} ), step( 0.5, aPiece.x ) );',
                // (the near set's blades going, each piece whole, toward the near edge: past it, the far carpet, its green alone)
                near ? 'lift *= fgStage( dP, uNear * 0.6, uNear * 0.95, rQ, 0.8 );' : '',
                'float hJ = zf * secOf( uJH, swJ ) * ( 1.0 + ${PATCHES.vary.toFixed(3)} * ( 2.0 * vnJ( wpJ / 4.3 + 9.1 ) - 1.0 ) ) * lift;',
                'vec3 transformed = vec3( wpJ, gzAt( wpJ ) + hJ - 0.08 * ( 1.0 - lift ) ) + fgBend( wpJ, hJ, bl * bt, aPiece.z * 13.0 ) * bl;',
                // (its tone the ground's, wandering over metres, and a blade's its own dice: no patch a shade of its own)
                'float bJ = fract( sin( dot( floor( position.xy * 31.0 ) + aCell.xy, vec2( 41.3, 289.1 ) ) ) * 43758.5453 );',
                'vBt = bt; vTone = ( 0.88 + 0.18 * vnJ( wpJ / 3.7 ) + 0.1 * ( bJ - 0.5 ) * bl ) * ( 1.0 + fgGust( wpJ ) );'].join('\\n'));
          sh.fragmentShader = 'varying float vBt;\\nvarying float vTone;\\n' + sh.fragmentShader
            // (one rule for all of it, the near blades': root to tip, its tone the ground's and its dice)
            .replace('#include <color_fragment>', '#include <color_fragment>\\n  diffuseColor.rgb *= mix( 0.45, 1.1, vBt ) * vTone;');
        };
        m.customProgramCacheKey = () => 'form-grass-patch-' + kind + (near ? '-near' : '-far') + (windU() ? '-wind' : '');
        return m;
      };
      // (a layer: a shape instanced, its instances' buffer as large as it may need)
      const layer = (S0, kind, near, cap) => {
        const g = geoOf(S0), n = kind === 'side' ? 6 : 5, A = new Float32Array(Math.max(1, cap) * n), IB = new THREE.InstancedInterleavedBuffer(A, n, 1);
        IB.setUsage(THREE.DynamicDrawUsage); g.setAttribute('aCell', new THREE.InterleavedBufferAttribute(IB, kind === 'side' ? 3 : 2, 0)); g.setAttribute('aPiece', new THREE.InterleavedBufferAttribute(IB, 3, kind === 'side' ? 3 : 2)); g.instanceCount = 0;
        const mesh = new THREE.Mesh(g, mat(kind, near)); mesh.frustumCulled = false; mesh.receiveShadow = true; scene.add(mesh); __formMeshes.push(mesh);
        return { mesh, g, A, IB, n, fill(L) { A.set(L.slice(0, A.length)); IB.needsUpdate = true; g.instanceCount = Math.min(L.length, A.length) / n; } };
      };
      // the FAR carpet: every patch's top and every open side's backing, its green alone
      const farTop = layer(T, 'top', false, tops.length / 5), farBack = layer(WB, 'side', false, backs.length / 6);
      farTop.fill(tops); farBack.fill(backs);
      // the NEAR carpet: within near m, the tufts, the skirts (dense facing the eye) and the blend; chosen again as the eye
      // crosses a cell
      const capP = Math.ceil(Math.PI * (JG.near / S + 2) ** 2), nearTufts = layer(TU, 'top', true, capP), skirtS = layer(WS, 'side', true, capP * 4), skirtD = layer(WD, 'side', true, capP * 4);
      let lastCell = null;
      const choose = (cx, cy) => {
        const tu = [], ss = [], sdn = [], ci = Math.floor(cx / S), cj = Math.floor(cy / S), R = Math.ceil(JG.near / S) + 1;
        for (let j = cj - R; j <= cj + R; j++) for (let i = ci - R; i <= ci + R; i++) {
          const P = at.get(key(i, j)); if (!P) continue;
          const d = Math.hypot((i + 0.5) * S - cx, (j + 0.5) * S - cy); if (d > JG.near + S) continue;
          tu.push(i, j, 0, 0, P.d);
          SIDES.forEach(([di, dj], sd) => {
            const mx = (i + MID[sd][0]) * S, my = (j + MID[sd][1]) * S, dm = Math.hypot(mx - cx, my - cy), faces = (OUT[sd][0] * (cx - mx) + OUT[sd][1] * (cy - my)) / Math.max(1e-6, dm) > 0.15;
            if (!at.has(key(i + di, j + dj))) (faces ? sdn : ss).push(i, j, sd, 0, 0, P.d);
            // (the blend: an inner side facing the eye in the hand-over's ring, at its full height)
            else if (faces && dm > P.nR * JG.blend[0] - S && dm < P.nR * JG.blend[1] + S) sdn.push(i, j, sd, 1, 0, P.d);
          });
        }
        nearTufts.fill(tu); skirtS.fill(ss); skirtD.fill(sdn);
        window.__formCarpet = [farTop, farBack, nearTufts, skirtS, skirtD].reduce((a, L) => a + L.g.instanceCount * L.g.index.count / 3, 0);
      };
      farTop.mesh.onBeforeRender = (r, sc, cam) => { const k = Math.floor(cam.position.x / S) + ',' + Math.floor(cam.position.y / S); if (k !== lastCell) { lastCell = k; choose(cam.position.x, cam.position.y); } };
    })();
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
            sh.vertexShader = GHEAD + windHead(sh) + 'uniform float uIn, uKeep, uFl;\\nuniform vec4 uDrift;\\nuniform vec2 uW, uH;\\nattribute vec2 aOff;\\nvarying float vBt;\\n' + sh.vertexShader
              .replace('#include <beginnormal_vertex>', [
                'vec2 cellG = floor( cameraPosition.xy / uSp ) + aOff;',
                'vec2 hsh = fract( sin( vec2( dot( cellG, vec2( 12.9898, 78.233 ) ), dot( cellG, vec2( 39.3468, 11.135 ) ) ) ) * 43758.5453 );',
                'vec2 wpG = ( cellG + hsh ) * uSp;',
                'vec2 uvG = ( wpG - uGO ) / uGM;',
                'vec4 gq = texture( tGrass, uvG );',
                'float inD = dot( texture( tDrift, uvG ), uDrift );',
                'float gz = uGZ.x + ( gq.r * 255.0 * 256.0 + gq.g * 255.0 ) / 65535.0 * uGZ.y;',
                'float dG = length( wpG - cameraPosition.xy );',
                // (out to its reach, thinning over its last; the far grid not within the near one's, the two swapping, each plant
                // whole at a distance of its own: never a ring growing as the eye walks, never dithered)
                'float rS = fract( hsh.x * 91.7 + hsh.y * 17.3 );',
                'float fadeG = fgStage( dG, uGR * 0.55, uGR * 0.95, rS, ${HANDOVER.grow.toFixed(2)} ) * ( uIn > 0.0 ? 1.0 - fgStage( dG, uIn * 0.6, uIn * 0.95, rS, ${HANDOVER.grow.toFixed(2)} ) : 1.0 );',
                'float pick = fract( hsh.x * 17.13 + hsh.y * 5.71 );',
                'float mine = step( 0.5, inD ) * step( uW.x, pick ) * ( 1.0 - step( uW.y, pick ) ) * step( fract( hsh.y * 29.1 + hsh.x * 7.7 ), uKeep * min( 1.0, gq.b * 1.3 ) );',
                'float hsG = mine * mix( uH.x, uH.y, fract( hsh.y * 3.3 ) ) * mix( 0.45, 1.0, smoothstep( 0.5, 0.85, inD ) ) * fadeG * ( uFl > 0.5 ? mix( 1.0, 0.6, gq.a ) : 1.0 );',
                'float yawG = hsh.x * 6.2831;',
                'mat2 rotG = mat2( cos( yawG ), sin( yawG ), -sin( yawG ), cos( yawG ) );',
                'vec3 objectNormal = normalize( vec3( rotG * vec2( 0.35, 0.0 ), 1.0 ) );',
                'vBt = position.z;'].join('\\n'))
              .replace('#include <begin_vertex>', 'vec3 transformed = vec3( wpG + rotG * position.xy * hsG, gz + position.z * hsG ) + fgBend( wpG, hsG, clamp( position.z, 0.0, 1.0 ), hsh.x * 13.0 + hsh.y );');
            sh.fragmentShader = 'varying float vBt;\\n' + sh.fragmentShader
              // (a plant lit as one: a blade seen from behind keeps its normal up, not flipped under)
              .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\\n  normal *= faceDirection;')
              .replace('#include <color_fragment>', '#include <color_fragment>\\n  diffuseColor.rgb *= mix( 0.6, 1.05, clamp( vBt, 0.0, 1.0 ) );');
          };
          dm.customProgramCacheKey = () => 'form-grass-drift' + (windU() ? '-wind' : '');
          const m = new THREE.Mesh(tg, dm); m.frustumCulled = false; m.receiveShadow = true; scene.add(m); __formMeshes.push(m);
          window.__formDrift = (window.__formDrift || 0) + tg.instanceCount * L.p.length / 9;
        });
      });
    });
  }
`;
}

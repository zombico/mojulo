// In-page script (part of the form channel, channels/form-land.js): THE GRASS of the form render (gen-7), real blades
// lit by the form's sun, no card and no painted light. It reads the land read's ground map (form/land-read.js `grass`:
// the ground's height and where grass grows, at half a metre) and the trail's mask (its signed distance), and draws:
//
//   tiers   clumps instanced on grids that walk with the camera, each clump's place, turn, height and tone its world
//           cell's dice (nothing shuffles as the eye moves; within a tier's last reach it shrinks and dissolves, never
//           swaps). Which grows where is the SWARD, a mood's choice (the biocube's `flora.grass.sward`, in the map's fourth
//           channel): the TALL clump (five blades, three segments) on two grids, a finer one near, where the sward is
//           long; the SHORT sward a bed of bristles (a triangle each, scattered over the whole cell, near one height, lit
//           as one pile) where it is kept short, turned away from the trail, so the eye on the trail meets their faces.
//           An area is wholly one or the other: at a seam the tall shrinks and the short rises, never interspersed
//   drifts  wheat, chaff, any grass kind and the flowers, each in areas of its own (form/grass-drifts.js: the library's
//           plants, their colours carried into the cube's light, a channel each of a second map), on grids of their own,
//           near grown full (L1), far plain (L0), one plant a cell picked by its dice and its form's weight; a kind that
//           stands (wheat) takes the blades' place, a low one (chaff, the flowers) stands among them
//   brush   the far: fins in rows three ways (60° apart, their lines wandering), grown here from the map (no bytes in the
//           payload), their bristles drawn in the fin, lower over a short sward, dissolving in past the blades' reach
//
// GRASS_TIERS is the table the page reads; a new grass is a row (its clump, its spacing and reach, where it grows).
//
// The block expects the form channel's scope: THREE, scene, D (the form input), LAYER_U (the ground's uniforms: the
// undergrowth thins where the grass is), bytes().

/** The grass the page draws: each tier's clump (blades, segments, height m, width m, lean, spread m, X-crossed or all
 *  round; a `bed` of bristles, its blades scattered over its whole cell, one triangle each, so the cells run together as
 *  one even pile, a toothbrush, not tufts), its grid's spacing and reach (m), and the sward it grows in. */
export const GRASS_TIERS = Object.freeze([
  Object.freeze({ id: 'tall', clump: { blades: 5, segs: 3, height: [0.65, 1], width: [0.022, 0.032], lean: [0.12, 0.3], spread: [0.03, 0.12], cross: false }, spacing: 0.42, reach: 13, scale: 1, sward: 'tall' }),
  Object.freeze({ id: 'tall-near', clump: { blades: 5, segs: 3, height: [0.65, 1], width: [0.022, 0.032], lean: [0.12, 0.3], spread: [0.03, 0.12], cross: false }, spacing: 0.21, reach: 5, scale: 0.85, sward: 'tall' }),
  Object.freeze({ id: 'short', clump: { blades: 10, segs: 1, height: [0.8, 1], width: [0.009, 0.013], lean: [0.02, 0.06], spread: [0, 0], cross: true, bed: true }, spacing: 0.15, reach: 6, scale: 0.24, sward: 'short' }),
]);
/** The drifts' grids: near (the plant grown full) and far (plain), spacing and reach (m); how many cells hold a plant,
 *  for a kind that stands, one that lies among the blades, and the flowers. */
export const DRIFT_TIERS = Object.freeze({ near: Object.freeze({ spacing: 0.38, reach: 7 }), far: Object.freeze({ spacing: 0.55, reach: 16 }),
  keep: Object.freeze({ stands: 0.9, among: 0.45, flowers: 0.3 }) });
/** How low the far brush stands over a short sward (× its height). */
export const BRUSH_SHORT = 0.3;
/** The far brush: its rows' spacing and their fins' length (metres). */
export const GRASS_BRUSH = Object.freeze({ row: 0.9, seg: 0.8 });

export function formGrassScript() {
  return `
  // --- the form render's grass (channels/form-grass.js) ---
  if (D.grass) {
    const Gm = D.grass, GTIERS = ${JSON.stringify(GRASS_TIERS)}, BR = ${JSON.stringify(GRASS_BRUSH)}, BRUSH_SHORT = ${BRUSH_SHORT}, DT = ${JSON.stringify(DRIFT_TIERS)};
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
        sh.vertexShader = GHEAD + 'attribute vec2 aOff;\\nattribute float bt;\\nvarying float vBt;\\nvarying float vFade;\\nvarying float vTone;\\n' + sh.vertexShader
          .replace('#include <beginnormal_vertex>', [
            'vec2 cellG = floor( cameraPosition.xy / uSp ) + aOff;',
            'vec2 hsh = fract( sin( vec2( dot( cellG, vec2( 12.9898, 78.233 ) ), dot( cellG, vec2( 39.3468, 11.135 ) ) ) ) * 43758.5453 );',
            'vec2 wpG = ( cellG + hsh ) * uSp;',
            'vec4 gq = texture( tGrass, ( wpG - uGO ) / uGM );',
            'float gz = uGZ.x + ( gq.r * 255.0 * 256.0 + gq.g * 255.0 ) / 65535.0 * uGZ.y;',
            'float fadeG = 1.0 - smoothstep( uGR * 0.55, uGR * 0.95, length( wpG - cameraPosition.xy ) );',
            // (the sward here: a tall clump where it is long, shrinking toward a seam; a short one where it is kept short,
            // rising out of it; never both)
            'float sw = gq.a, mine = uShort > 0.5 ? step( 0.5, sw ) : 1.0 - step( 0.5, sw );',
            'float ease = uShort > 0.5 ? mix( 0.5, 1.0, smoothstep( 0.5, 0.9, sw ) ) : mix( 1.0, 0.4, smoothstep( 0.1, 0.5, sw ) );',
            // (and none where a drift that stands has taken the grass's place)
            'mine *= 1.0 - step( 0.5, dot( texture( tDrift, ( wpG - uGO ) / uGM ), uReplace ) );',
            'float keepG = step( fract( hsh.y * 13.7 + hsh.x * 3.1 ), gq.b * ( uShort > 0.5 ? 2.0 : 1.2 ) ) * mine;   // (fewer clumps where the grass thins, by their dice; a pile thins late)',
            // (a short sward near one height, a pile; a tall one wandering)
            'float hsG = keepG * smoothstep( 0.08, 0.6, gq.b ) * ( uShort > 0.5 ? 0.85 + 0.2 * hsh.y : 0.5 + 0.55 * hsh.y ) * mix( 0.35, 1.0, fadeG ) * ease * uHs;',
            'float pd = pdAt( wpG );',
            // (a short clump turned away from the trail, by the mask's slope, a little off; a tall one any way)
            'vec2 away = vec2( pdAt( wpG + vec2( 0.4, 0.0 ) ) - pdAt( wpG - vec2( 0.4, 0.0 ) ), pdAt( wpG + vec2( 0.0, 0.4 ) ) - pdAt( wpG - vec2( 0.0, 0.4 ) ) );',
            'float yawG = uShort > 0.5 && pd < 98.0 && dot( away, away ) > 1e-6 ? atan( away.y, away.x ) + ( hsh.x - 0.5 ) * 0.8 : hsh.x * 6.2831;',
            'mat2 rotG = mat2( cos( yawG ), sin( yawG ), -sin( yawG ), cos( yawG ) );',
            'vec3 objectNormal = normalize( vec3( rotG * vec2( 0.35, 0.0 ), 1.0 ) );',
            'vBt = bt; vFade = fadeG; vTone = ( 0.85 + 0.3 * fract( hsh.x * 7.31 ) ) * ( uShort > 0.5 ? 1.08 : 1.0 );'].join('\\n'))
          .replace('#include <begin_vertex>', '// (no grass here: the clump gathered to a point, not laid flat)\\n  vec3 transformed = vec3( wpG + rotG * position.xy * step( 0.001, hsG ), gz + position.z * hsG );');
        sh.fragmentShader = 'uniform float uShort;\\nvarying float vBt;\\nvarying float vFade;\\nvarying float vTone;\\n' + sh.fragmentShader
          // (a short sward lit as one pile: a bristle seen from behind keeps its normal up, not flipped under)
          .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\\n  if ( uShort > 0.5 ) normal *= faceDirection;')
          .replace('#include <color_fragment>', '#include <color_fragment>\\n  if ( fract( sin( dot( floor( gl_FragCoord.xy ), vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ) > vFade ) discard;\\n  diffuseColor.rgb *= mix( 0.45, 1.1, vBt ) * vTone;');
      };
      bm.customProgramCacheKey = () => 'form-grass-' + T.id;
      const blades = new THREE.Mesh(tg, bm); blades.frustumCulled = false; blades.receiveShadow = true; scene.add(blades); __formMeshes.push(blades);
      window.__formGrass = (window.__formGrass || 0) + tg.instanceCount * tg.index.count / 3;
    });
    // the drifts: each kind's forms on a near grid and a far one, one plant a cell (its form by the cell's dice against the
    // forms' weights), grown where the kind's channel is past a half, eased in from its seam
    if (Dr) Dr.kinds.forEach((K, k) => {
      let w0 = 0;
      const keep = K.id === 'flowers' ? DT.keep.flowers : K.stands ? DT.keep.stands : DT.keep.among;
      K.forms.forEach((Fm, fi) => {
        const win = new THREE.Vector2(w0, fi === K.forms.length - 1 ? 1.01 : w0 + Fm.w); w0 += Fm.w;
        ['near', 'far'].forEach((lv) => {
          const T = DT[lv], L = Fm[lv], tg = new THREE.InstancedBufferGeometry(), offs = [], n = Math.ceil(T.reach / T.spacing);
          tg.setAttribute('position', new THREE.Float32BufferAttribute(L.p, 3)); tg.setAttribute('color', new THREE.Float32BufferAttribute(L.c, 3));
          tg.setAttribute('normal', new THREE.Float32BufferAttribute(L.p.map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
          for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) if (Math.hypot(i, j) * T.spacing <= T.reach + T.spacing) offs.push(i, j);
          tg.setAttribute('aOff', new THREE.InstancedBufferAttribute(new Float32Array(offs), 2)); tg.instanceCount = offs.length / 2;
          const TU = { ...GU, uSp: { value: T.spacing }, uGR: { value: T.reach }, uIn: { value: lv === 'far' ? DT.near.reach : 0 }, uDrift: { value: chan(k) }, uW: { value: win },
            uH: { value: new THREE.Vector2(...K.heights) }, uKeep: { value: keep }, uFl: { value: K.id === 'flowers' ? 1 : 0 } };
          const dm = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
          dm.onBeforeCompile = (sh) => {
            Object.assign(sh.uniforms, TU);
            sh.vertexShader = GHEAD + 'uniform float uIn, uKeep, uFl;\\nuniform vec4 uDrift;\\nuniform vec2 uW, uH;\\nattribute vec2 aOff;\\nvarying float vBt;\\nvarying float vFade;\\n' + sh.vertexShader
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
              .replace('#include <begin_vertex>', 'vec3 transformed = vec3( wpG + rotG * position.xy * hsG, gz + position.z * hsG );');
            sh.fragmentShader = 'varying float vBt;\\nvarying float vFade;\\n' + sh.fragmentShader
              // (a plant lit as one: a blade seen from behind keeps its normal up, not flipped under)
              .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\\n  normal *= faceDirection;')
              .replace('#include <color_fragment>', '#include <color_fragment>\\n  if ( fract( sin( dot( floor( gl_FragCoord.xy ), vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ) > vFade ) discard;\\n  diffuseColor.rgb *= mix( 0.6, 1.05, clamp( vBt, 0.0, 1.0 ) );');
          };
          dm.customProgramCacheKey = () => 'form-grass-drift';
          const m = new THREE.Mesh(tg, dm); m.frustumCulled = false; m.receiveShadow = true; scene.add(m); __formMeshes.push(m);
          window.__formDrift = (window.__formDrift || 0) + tg.instanceCount * L.p.length / 9;
        });
      });
    });
    // the far brush: grown here from the map, rows three ways, each row's line wandering so the rows weave rather than
    // rule, a fin from the ground up a wandering height only where the grass is full
    const nx = Gm.size[0], ny = Gm.size[1], zAt = (q) => Gm.z[0] + ((gpx[q * 4] * 256 + gpx[q * 4 + 1]) / 65535) * Gm.z[1];
    const mapAt = (x, y) => { const i = Math.round((x - Gm.origin[0]) / Gm.cell), j = Math.round((y - Gm.origin[1]) / Gm.cell); if (i < 0 || j < 0 || i >= nx || j >= ny) return null; const q = j * nx + i; return { z: zAt(q), c: gpx[q * 4 + 2] / 255, s: gpx[q * 4 + 3] / 255 }; };
    const cx0 = Gm.origin[0] + (nx * Gm.cell) / 2, cy0 = Gm.origin[1] + (ny * Gm.cell) / 2, half = Math.hypot(nx, ny) * Gm.cell / 2, fp = [], fu = [];
    for (let dir = 0; dir < 3; dir++) {
      const a = (dir * Math.PI) / 3 + 0.21, ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
      for (let r = -half; r <= half; r += BR.row) for (let u = -half; u < half; u += BR.seg) {
        const off = (uu) => (hb(dir * 7.1 + r * 1.3, uu * 0.77) - 0.5) * BR.row * 0.7;
        const P0 = [cx0 + ux * u + vx * (r + off(u)), cy0 + uy * u + vy * (r + off(u))], P1 = [cx0 + ux * (u + BR.seg) + vx * (r + off(u + BR.seg)), cy0 + uy * (u + BR.seg) + vy * (r + off(u + BR.seg))];
        const g0 = mapAt(...P0), g1 = mapAt(...P1);
        if (!g0 || !g1 || g0.c < 0.5 || g1.c < 0.5) continue;
        const low = (g) => 1 - (1 - BRUSH_SHORT) * g.s, h0 = (0.18 + 0.24 * hb(dir + r, u + 3.3)) * (0.5 + 0.5 * g0.c) * low(g0), h1 = (0.18 + 0.24 * hb(dir + r, u + BR.seg + 3.3)) * (0.5 + 0.5 * g1.c) * low(g1);
        const q = [[...P0, g0.z - 0.02], [...P1, g1.z - 0.02], [...P1, g1.z + h1], [...P0, g0.z + h0]];
        for (const k of [0, 1, 2, 0, 2, 3]) { fp.push(...q[k]); fu.push(u + (k === 1 || k === 2 ? BR.seg : 0), k >= 2 ? 1 : 0, k === 2 ? h1 : k === 3 ? h0 : 0); }
      }
    }
    if (fp.length) {
      const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); fg.setAttribute('uvh', new THREE.Float32BufferAttribute(fu, 3));
      fg.setAttribute('normal', new THREE.Float32BufferAttribute(fp.map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
      const fm = new THREE.MeshStandardMaterial({ color: grassCol, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
      const FU = { ...GU, uGR: { value: GTIERS[0].reach } };
      fm.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, FU);
        sh.vertexShader = 'attribute vec3 uvh;\\nvarying vec3 vUvh;\\nvarying vec3 vFW;\\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\\n  vUvh = uvh; vFW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
        sh.fragmentShader = 'uniform float uGR;\\nvarying vec3 vUvh;\\nvarying vec3 vFW;\\nfloat hb1( float a ) { return fract( sin( a * 127.1 ) * 43758.5453 ); }\\n' + sh.fragmentShader
          .replace('#include <color_fragment>', [
            '#include <color_fragment>',
            '  float fadeIn = smoothstep( uGR * 0.5, uGR * 0.9, length( vFW.xy - cameraPosition.xy ) );',
            '  if ( fract( sin( dot( floor( gl_FragCoord.xy ), vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ) > fadeIn ) discard;',
            '  float su = vUvh.x * 60.0, si = floor( su ) + floor( vFW.x * 3.1 + vFW.y * 5.7 ) * 131.0, top = 0.35 + 0.65 * hb1( si );',
            '  float hv = vUvh.y, lean = ( hb1( si + 3.0 ) - 0.5 ) * 0.6 * hv;',
            '  float wdt = mix( 0.85, 0.2, hv / top ), cx = abs( fract( su + lean ) - 0.5 ) * 2.0;',
            '  if ( hv > top || cx > wdt || hb1( si + 7.0 ) < 0.12 ) discard;',
            '  diffuseColor.rgb *= mix( 0.5, 1.05, hv / top ) * ( 0.85 + 0.3 * hb1( si + 11.0 ) );'].join('\\n'));
      };
      fm.customProgramCacheKey = () => 'form-grass-brush';
      const fins = new THREE.Mesh(fg, fm); fins.receiveShadow = true; scene.add(fins); __formMeshes.push(fins);
    }
  }
`;
}

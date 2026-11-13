// In-page script (part of the form channel, channels/form-land.js): THE FAR BOX, the grass past the view cone's reach
// as a volume and not as blades: the cheapest thing that stands. The grass map (form/land-read.js `grass`: the
// ground's height, where grass grows and how long its sward is, at half a metre) read coarsely, a cell of `cell` m:
//
//   a cell is grass      where at least half of its ground is under grass
//   its floor            the ground at its corners, so the box takes the land's bumps
//   its top              the ground and its sward's height over it (tall, medium, short: GRASS_TIERS)
//   its walls            only where grass meets no grass (the trail, a claim, bare ground): the fence round the field
//
// Opt-in (`form.farBox`: true, or { cell }); absent, the page carries none of it. This is its first form: a WIREFRAME
// (the tops' edges, the walls' edges), coloured by the sward's length, the walls white, drawn past the cone's reach
// only, so it can be seen to follow the ground and the grass's edges before anything is filled or carved.
// `window.__formFarBox` ({ lines, cells, mode, set(mode) }) and B cycle its mode on a walkable page: 'far' (past the
// reach), 'all' (everywhere), 'off'. Mojulo web only.
import { GRASS_TIERS, BLADE_RISE, SWARD_LENGTH } from './form-grass.js';

/** The box's numbers: a cell's size (m) and its range, the least cover a map cell counts as grass at, the share of a
 *  cell that makes it grass, and how much of a sward's tallest tip the box stands to. */
export const FAR_BOX = Object.freeze({ cell: 2, range: Object.freeze([0.5, 16]), cover: 0.3, share: 0.5, rise: 0.8 });

/** Each sward's height (m): its tier's tallest tip × FAR_BOX.rise, in SWARD order (tall, medium, short). */
export const FAR_BOX_HEIGHTS = Object.freeze(['tall', 'medium', 'short'].map((s) => {
  const t = GRASS_TIERS.find((q) => q.sward === s);
  return Math.round(t.scale * t.clump.height[1] * (BLADE_RISE[s][0] + BLADE_RISE[s][1]) * FAR_BOX.rise * 1000) / 1000;
}));

/** A world's `farBox` read: true → the default cell; { cell } within FAR_BOX.range; absent or false → null. */
export function readFarBox(v) {
  if (v === undefined || v === null || v === false) return null;
  if (v === true) return { cell: FAR_BOX.cell };
  const [lo, hi] = FAR_BOX.range;
  if (typeof v !== 'object' || Array.isArray(v)) throw new Error(`farBox is true or { cell } (a cell's size in metres, ${lo} to ${hi})`);
  for (const k of Object.keys(v)) if (k !== 'cell') throw new Error(`farBox.${k} is not a setting (cell)`);
  const cell = v.cell ?? FAR_BOX.cell;
  if (!Number.isFinite(cell) || cell < lo || cell > hi) throw new Error(`farBox.cell is a cell's size in metres, ${lo} to ${hi}`);
  return { cell };
}

/**
 * The box's lines from a grass map. `px` the map's bytes (RGBA a cell: the ground's height in 16 bits over `z`
 * [low, span], the cover, the sward's length), `size` [nx, ny], `cell` and `origin` the map's; `K` { cell, cover,
 * share, heights (tall, medium, short), band (SWARD_LENGTH.band) }. → { pos (xyz a vertex, two a line), kind (a
 * vertex: 0 tall, 1 medium, 2 short, 3 a wall), cells (grass cells), size [NX, NY], step }. Self-contained: the page
 * runs this very function.
 */
export function farBoxLines(px, size, cell, origin, z, K) {
  const nx = size[0], ny = size[1], s = Math.max(1, Math.round(K.cell / cell)), NX = Math.ceil(nx / s), NY = Math.ceil(ny / s);
  // (each coarse cell: grass or not, and its sward)
  const G = new Uint8Array(NX * NY), SW = new Uint8Array(NX * NY);
  let cells = 0;
  for (let J = 0; J < NY; J++) for (let I = 0; I < NX; I++) {
    let n = 0, g = 0, len = 0;
    for (let j = J * s; j < Math.min(ny, J * s + s); j++) for (let i = I * s; i < Math.min(nx, I * s + s); i++) {
      const q = (j * nx + i) * 4; n++;
      if (px[q + 2] / 255 >= K.cover) { g++; len += px[q + 3] / 255; }
    }
    if (n && g / n >= K.share) { const l = len / g; G[J * NX + I] = 1; SW[J * NX + I] = l < 0.5 - K.band ? 0 : l < 1 - K.band ? 1 : 2; cells++; }
  }
  const at = (I, J) => (I < 0 || J < 0 || I >= NX || J >= NY ? 0 : G[J * NX + I]);
  // (each corner: the ground there, the mean of the map cells round it that hold ground, and the tallest sward of the
  // grass cells that share it, so the top is one surface)
  const CX = NX + 1, zs = new Float32Array(CX * (NY + 1)), hs = new Float32Array(CX * (NY + 1)), ks = new Uint8Array(CX * (NY + 1));
  for (let J = 0; J <= NY; J++) for (let I = 0; I <= NX; I++) {
    let zq = 0, m = 0;
    for (let b = -1; b <= 0; b++) for (let a = -1; a <= 0; a++) {
      const i = Math.min(nx - 1, Math.max(0, I * s + a)), j = Math.min(ny - 1, Math.max(0, J * s + b)), q = (j * nx + i) * 4, v = px[q] * 256 + px[q + 1];
      if (v > 0) { zq += v; m++; }
    }
    const c = J * CX + I; zs[c] = z[0] + (m ? zq / m / 65535 : 0) * z[1];
    let h = 0, k = 2;
    for (let b = -1; b <= 0; b++) for (let a = -1; a <= 0; a++) if (at(I + a, J + b)) { const w = SW[(J + b) * NX + I + a]; if (K.heights[w] > h) { h = K.heights[w]; k = w; } }
    hs[c] = h; ks[c] = k;
  }
  const pos = [], kind = [], step = s * cell, x0 = origin[0] - cell / 2, y0 = origin[1] - cell / 2;
  const line = (c0, c1, top0, top1, k) => {
    const I0 = c0 % CX, J0 = (c0 - I0) / CX, I1 = c1 % CX, J1 = (c1 - I1) / CX;
    pos.push(x0 + I0 * step, y0 + J0 * step, zs[c0] + (top0 ? hs[c0] : 0), x0 + I1 * step, y0 + J1 * step, zs[c1] + (top1 ? hs[c1] : 0));
    kind.push(k, k);
  };
  const post = new Uint8Array(CX * (NY + 1));
  // (an edge between two cells: the top's where either is grass; a wall's where only one is, its foot and its posts)
  const edge = (c0, c1, a, b) => {
    if (!a && !b) return;
    if (a && b) { line(c0, c1, 1, 1, Math.min(ks[c0], ks[c1])); return; }
    line(c0, c1, 1, 1, 3); line(c0, c1, 0, 0, 3);
    for (const c of [c0, c1]) if (!post[c]) { post[c] = 1; line(c, c, 0, 1, 3); }
  };
  for (let J = 0; J <= NY; J++) for (let I = 0; I <= NX; I++) {
    const c = J * CX + I;
    if (I < NX) edge(c, c + 1, at(I, J - 1), at(I, J));
    if (J < NY) edge(c, c + CX, at(I - 1, J), at(I, J));
  }
  return { pos: new Float32Array(pos), kind: new Float32Array(kind), cells, size: [NX, NY], step };
}

/** The box's page source; `box` a read box (readFarBox). Expects the form channel's scope: THREE, scene, D, bytes(). */
export function farBoxScript(box) {
  if (!box) return '';
  const K = { cell: box.cell, cover: FAR_BOX.cover, share: FAR_BOX.share, heights: FAR_BOX_HEIGHTS, band: SWARD_LENGTH.band };
  return `
  // --- the far box: the grass past the reach as a volume, its wireframe (channels/far-box.js) ---
  if (D.grass) (function () {
    ${farBoxLines.toString()}
    const Gm = D.grass, B = farBoxLines(bytes(Gm.px), Gm.size, Gm.cell, Gm.origin, Gm.z, ${JSON.stringify(K)});
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(B.pos, 3));
    // (the page's own line material, so the lines take its depth; the reach cut in its fragment)
    const COL = [[0.75, 1, 0.2], [0.2, 0.9, 1], [1, 0.35, 0.9], [1, 1, 1]], col = new Float32Array(B.kind.length * 3);
    for (let i = 0; i < B.kind.length; i++) col.set(COL[B.kind[i]], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const U = { uR: { value: 0 } }, m = new THREE.LineBasicMaterial({ vertexColors: true, fog: false, toneMapped: false });
    m.onBeforeCompile = (sh) => { sh.uniforms.uR = U.uR;
      sh.vertexShader = 'varying vec2 vBoxXY;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvBoxXY = ( modelMatrix * vec4( transformed, 1.0 ) ).xy;');
      sh.fragmentShader = 'uniform float uR; varying vec2 vBoxXY;\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif ( length( vBoxXY - cameraPosition.xy ) < uR ) discard;'); };
    const L = new THREE.LineSegments(g, m); L.frustumCulled = false; L.renderOrder = 5; scene.add(L);
    let mode = 'far';
    L.onBeforeRender = () => { const C = window.__mojCone, pov = !window.__formFar || window.__formFar.pov(); U.uR.value = mode === 'all' ? 0 : C && pov ? C.reach : 1e9; };
    window.__formFarBox = { lines: B.pos.length / 6, cells: B.cells, size: B.size, step: B.step, get mode() { return mode; },
      set: (v) => { mode = v === 'all' || v === 'off' ? v : 'far'; L.visible = mode !== 'off'; return mode; } };
    window.addEventListener('keydown', (e) => { if (e.key === 'b' || e.key === 'B') console.log('far box', window.__formFarBox.set(mode === 'far' ? 'all' : mode === 'all' ? 'off' : 'far')); });
  })();
`;
}

import { safeJson } from '../emit-util.js';
import { GLYPHS_SRC } from './moment-channel.js';
import { SEMANTIC_COLORS, styleTokens } from '../../game/hud-widgets.js';

/**
 * title-channel — the page's side of the HUD's TITLES (hud-widgets.js `as: 'title'`; game/title-carve.js carved them):
 * a title's words put on the screen as 3D letters when its event fires, the way a game announces a round, a K.O., a
 * clear — not a plate with words on it. Spliced into the HUD block (events.js hudScript) only when a world carries a
 * title the carver could carve; every other world is byte-identical.
 *
 *   the run     the text (its `{var}`s filled at the firing; in capitals when the theme says so) laid out from the
 *               glyph atlas by advance at the theme's tracking, centred, scaled to the screen (a letter stands 0.17 of
 *               the screen's height times the theme's scale, the word within 0.84 of its width), leaning by the theme's
 *               tilt, in a rig that follows the camera each frame one unit ahead of it (no parenting: a camera a
 *               controller drives is not touched); a character the atlas lacks is a space
 *   the look    baked into vertex colour from each face's winding under a light at the viewer's upper left, so the
 *               material is unlit and the scene's lights do not matter: anime (the composed floor's register, or the
 *               default) three flat cel bands; western lambert and a specular glint. A row's MATERIAL (title-material.js)
 *               replaces the look: a metal's face reflects the studio sweep top to bottom of the line (its gradient a
 *               texture, the stops the broadcast's metal; three hard bands in the anime register), its walls the metal's
 *               middle, lit; a finish shades by its shelf row (cel bands, a glint, emission, glass's opacity). A material's
 *               colours are decoded from sRGB as the world's baked colours are. A row's BLOCK makes the depth show, the
 *               letter's back pulled away from its face: drop (deep, down and to the right, the comic and cartoon block
 *               letter), perspective (deep, its sides running to a vanishing point under the word, the action-movie
 *               logo), stack (the comic masthead's receding copies, a stepped stack in alternating shades); the sides in
 *               the block colour (the row's, or the face's own darkened), two flat tones in the anime register, shading
 *               toward the back in the western. Behind each letter the theme's
 *               EDGE: an ink hull, a dark drop copy, both, a glow (the title's colour, added, larger), or nothing
 *   the juice   on the frame clock from the firing's time (a capture draws the same frame), the theme's dials over it
 *               (TITLE_THEMES: how hard the landing flashes, whether it throws sparks or a halo ring):
 *                 slam   scaled down onto the screen with an overshoot and a settling tilt; on landing a flash, a jolt,
 *                        sparks and the ring; leaves growing and fading
 *                 rise   each letter rises from below in turn, stretched, and squashes as it lands; leaves falling
 *                 stamp  punched in from the viewer's eye, a bounce and a harder jolt; leaves scattering, each letter
 *                        flying out on its own line and spin
 *                 fade   in slowly, drifting down a little as it sharpens, nothing else; leaves fading
 *                 slide  in from the right, stretched along its flight, streaks behind it; leaves out to the left
 *               every number of chance (a tilt, a jolt's direction, a spark's line) is hashed from the firing's count,
 *               never drawn
 *
 *   titleScript(titles, { register })   the in-page block (defines __ttFire / __ttStep for the HUD block)
 *   titleHex(color, style)              a widget colour as the six-digit hex the letters are baked in
 *   titleBlock(block, faceHex, sideHex)  a row's block as the page bakes it: { kind, side, edge } (sideHex null ⇒ the
 *                                        face's own hue, darkened)
 */

const HEX = /^#[0-9a-fA-F]{3,8}$/;
/** A widget's colour (hex, a semantic name, a token: accent, accent2, ink) → '#rrggbb' for the letters; the accent when unnamed. */
export function titleHex(color, style) {
  const tok = styleTokens(style);
  let h = typeof color === 'string' && HEX.test(color) ? color : SEMANTIC_COLORS[color] || (color === 'accent' || color === 'accent2' || color === 'ink' ? tok[color] : tok.accent);
  if (!HEX.test(h)) h = tok.accent;
  let d = h.slice(1);
  if (d.length === 3 || d.length === 4) d = d.slice(0, 3).split('').map((c) => c + c).join('');
  return '#' + d.slice(0, 6).toLowerCase();
}

// the block's sides from the face: its hue, darker and a little richer (the comic block under a red or gold face);
// the far edge darker again
const hexHsl = (h) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn), hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [hh / 6, s, l];
};
const hslHex = ([h, s, l]) => {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const ch = (t) => { t = (t + 1) % 1; const v = t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; return Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0'); };
  return '#' + ch(h + 1 / 3) + ch(h) + ch(h - 1 / 3);
};
export function titleBlock(block, faceHex, sideHex = null) {
  const [h, s, l] = hexHsl(sideHex || faceHex);
  const side = sideHex || hslHex([h, Math.min(1, s * 1.1 + 0.08), l * 0.45]);
  return { kind: block, side, edge: hslHex([h, Math.min(1, s * 1.1 + 0.08), (sideHex ? l : l * 0.45) * 0.45]) };
}

export function titleScript(titles, { register = 'anime', material = false, block = false } = {}) {
  const cel = register !== 'western';
  return `
// TITLES: the carved banners (game/title-carve.js) — a title's words as 3D letters put on the screen when its event
// fires: laid out from the glyph atlas by advance, baked in the ${cel ? 'anime (cel)' : 'western (metal)'} look, played
// on the frame clock from the firing in the row's theme (title-channel.js)
const __TT = ${safeJson(titles)};
const __TT_CEL = ${cel};
const __ttGlyphs = ${GLYPHS_SRC};
const __ttD = 1.0, __ttGeo = {};
const __ttRig = new THREE.Group(); __ttRig.renderOrder = 990; scene.add(__ttRig);
const __ttFlash = document.createElement('div'); __ttFlash.style.cssText = 'position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:11'; wrap.appendChild(__ttFlash);
const __ttHash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const __ttHexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const __ttBack = (k) => 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2);   // ease out, overshooting
const __ttOut = (k) => 1 - (1 - k) * (1 - k) * (1 - k);                                      // ease out
const __ttLands = (look) => look === 'slam' || look === 'stamp' || look === 'slide';           // the looks that land
const __ttL = (() => { const l = [-0.4, 0.8, 0.6], n = Math.hypot(l[0], l[1], l[2]); return [l[0] / n, l[1] / n, l[2] / n]; })();
const __ttH = (() => { const h = [__ttL[0], __ttL[1], __ttL[2] + 1], n = Math.hypot(h[0], h[1], h[2]); return [h[0] / n, h[1] / n, h[2] / n]; })();
// a glyph in a colour: the atlas's indexed triangles unshared, each face's normal from its winding, the look baked into
// vertex colour (cel: three flat bands; metal: lambert and a specular glint) — the material is unlit
function __ttGeometry(style, ch, hex${material ? ', mat' : ''}) {
${material ? `  if (mat) return __ttMatGeometry(style, ch, hex, mat);
` : ''}  const key = style + '/' + ch + '/' + hex; if (__ttGeo[key]) return __ttGeo[key];
  const g = __TT.styles[style].glyphs[ch], P = g.p, I = g.i, n = I.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), rgb = __ttHexRgb(hex);
  for (let k = 0; k < n; k += 3) {
    for (let j = 0; j < 3; j++) { const v = I[k + j] * 3, o = (k + j) * 3; pos[o] = P[v] / 1000; pos[o + 1] = P[v + 1] / 1000; pos[o + 2] = P[v + 2] / 1000; }
    const a = k * 3, b = a + 3, c = a + 6;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const lam = Math.max(0, nx * __ttL[0] + ny * __ttL[1] + nz * __ttL[2]);
    let r, gg, bb;
    if (__TT_CEL) { const band = lam > 0.75 ? 1 : lam > 0.42 ? 0.78 : 0.48; r = rgb[0] * band; gg = rgb[1] * band; bb = rgb[2] * band; }
    else { const sp = 0.75 * Math.pow(Math.max(0, nx * __ttH[0] + ny * __ttH[1] + nz * __ttH[2]), 28), d = 0.22 + 0.78 * lam; r = Math.min(1, rgb[0] * d + sp); gg = Math.min(1, rgb[1] * d + sp); bb = Math.min(1, rgb[2] * d + sp); }
    for (let j = 0; j < 3; j++) { const o = (k + j) * 3; col[o] = r; col[o + 1] = gg; col[o + 2] = bb; }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return (__ttGeo[key] = geo);
}
${material ? `// a glyph in a material (title-material.js): a metal's faces toward the viewer take the sweep from its texture by their
// height in the line (u in the texture's first column; the second is white, for the walls, which bake the metal's middle
// lit); a finish shades each face by its shelf row. Colours decoded from sRGB, as the world's are
const __ttLin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const __ttMaps = {};
function __ttMetalMap(stops) {
  const key = JSON.stringify(stops); if (__ttMaps[key]) return __ttMaps[key];
  const c = document.createElement('canvas'); c.width = 2; c.height = 128; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, 128); for (const [o, h] of stops) gr.addColorStop(o, h);
  x.fillStyle = gr; x.fillRect(0, 0, 1, 128); x.fillStyle = '#fff'; x.fillRect(1, 0, 1, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false;
  t.minFilter = t.magFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return (__ttMaps[key] = t);
}
function __ttMatGeometry(style, ch, hex, mat) {
  const key = style + '/' + ch + '/' + hex + '/' + (mat.metal || JSON.stringify(mat.shade)); if (__ttGeo[key]) return __ttGeo[key];
  const g = __TT.styles[style].glyphs[ch], P = g.p, I = g.i, n = I.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const uv = mat.metal ? new Float32Array(n * 2) : null, sh = mat.shade || {}, rgb = __ttHexRgb(mat.metal ? mat.hex : hex);
  for (let k = 0; k < n; k += 3) {
    for (let j = 0; j < 3; j++) { const v = I[k + j] * 3, o = (k + j) * 3; pos[o] = P[v] / 1000; pos[o + 1] = P[v + 1] / 1000; pos[o + 2] = P[v + 2] / 1000; }
    const a = k * 3, b = a + 3, c = a + 6;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const lam = Math.max(0, nx * __ttL[0] + ny * __ttL[1] + nz * __ttL[2]), nh = Math.max(0, nx * __ttH[0] + ny * __ttH[1] + nz * __ttH[2]);
    let r, gg, bb, u = 0.75;
    if (mat.metal) {
      if (nz > 0.2) {   // the face and the bevel reflect the sweep, a bevel's facet dimmed by its turn from the light
        u = 0.25; const f = nz > 0.98 ? 1 : Math.min(1.15, 0.62 + 0.45 * lam + 0.6 * Math.pow(nh, 24)); r = gg = bb = f;
      } else { const f = 0.3 + 0.7 * lam, sp = 0.5 * Math.pow(nh, 22); r = rgb[0] * f + sp; gg = rgb[1] * f + sp; bb = rgb[2] * f + sp; }
    } else {
      let lm = lam; if (sh.cel) lm = Math.round(lm * sh.cel) / sh.cel;
      const f = (sh.ambient ?? 0.26) + (sh.diffuse ?? 0.7) * lm, sp = sh.specular ? sh.specular * Math.pow(nh, sh.shininess || 16) : 0, e = sh.emissive || 0;
      r = (rgb[0] * f + sp) * (1 - e) + rgb[0] * e; gg = (rgb[1] * f + sp) * (1 - e) + rgb[1] * e; bb = (rgb[2] * f + sp) * (1 - e) + rgb[2] * e;
    }
    r = __ttLin(Math.min(1, r)); gg = __ttLin(Math.min(1, gg)); bb = __ttLin(Math.min(1, bb));
    for (let j = 0; j < 3; j++) { const o = (k + j) * 3; col[o] = r; col[o + 1] = gg; col[o + 2] = bb; if (uv) { uv[(k + j) * 2] = u; uv[(k + j) * 2 + 1] = pos[o + 1]; } }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (uv) geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return (__ttGeo[key] = geo);
}
// the letter's own material: unlit, the metal's sweep its map, a finish's opacity (glass) its own
function __ttLetterMat(mat) {
  const o = { vertexColors: true, transparent: true };
  if (mat && mat.metal) o.map = __ttMetalMap(mat.stops);
  const m = new THREE.MeshBasicMaterial(o); if (mat && mat.shade && mat.shade.opacity) { m.opacity = mat.shade.opacity; m.userData.op = mat.shade.opacity; }
  return m;
}
` : ''}${block ? `// a letter's BLOCK: its geometry with the back pulled away from the face (drop: down and to the right; perspective:
// toward a vanishing point under the word, the letter's place in the run given as ox), the walls and the back recoloured
// in the block's side colour by the way each wall faces (the right side lit, the underside dark), flat in the anime
// register, shading toward the back in the western; the face and its bevel keep their look
const __TT_BLK = { drop: [0.17, -0.24, -0.62], perspective: [0, 0, -0.7] }, __ttBlkGeo = {};
const __ttBlkLin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
function __ttBlock(geo, key, blk, depth, ox, W) {
  const k = key + '/' + blk.kind + '/' + blk.side + (blk.kind === 'perspective' ? '/' + ox.toFixed(3) : ''); if (__ttBlkGeo[k]) return __ttBlkGeo[k];
  const P0 = geo.attributes.position.array, C0 = geo.attributes.color.array, n = P0.length / 3, P = new Float32Array(P0), C = new Float32Array(C0);
  const side = __ttHexRgb(blk.side).map(__ttBlkLin), D = __TT_BLK[blk.kind], vx = -ox, vy = -2.2;   // the vanishing point, in the letter's frame
  for (let v = 0; v < n * 3; v += 9) {
    const ux = P0[v + 3] - P0[v], uy = P0[v + 4] - P0[v + 1], uz = P0[v + 5] - P0[v + 2], wx = P0[v + 6] - P0[v], wy = P0[v + 7] - P0[v + 1], wz = P0[v + 8] - P0[v + 2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    if (nz > 0.2) continue;   // the face and its bevel keep their look
    const tone = nz < -0.5 ? 0.5 : Math.max(0.42, Math.min(1, 0.72 + 0.28 * nx - 0.3 * Math.max(0, -ny) + 0.1 * Math.max(0, ny)));
    for (let j = 0; j < 9; j += 3) {
      const f = Math.min(1, -P0[v + j + 2] / depth), t = __TT_CEL ? (tone > 0.7 ? 0.95 : 0.62) : tone * (1 - 0.42 * f);
      C[v + j] = side[0] * t; C[v + j + 1] = side[1] * t; C[v + j + 2] = side[2] * t;
    }
  }
  for (let v = 0; v < n * 3; v += 3) {
    if (-P0[v + 2] < depth * 0.5) continue;   // the face's ring and the bevel stay; the back ring is pulled away
    if (blk.kind === 'perspective') { const q = 0.2; P[v] = P0[v] + (vx - P0[v]) * q; P[v + 1] = P0[v + 1] + (vy - P0[v + 1]) * q; }
    else { P[v] = P0[v] + D[0]; P[v + 1] = P0[v + 1] + D[1]; }
    P[v + 2] = D[2];
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  if (geo.attributes.uv) g.setAttribute('uv', geo.attributes.uv);
  return (__ttBlkGeo[k] = g);
}
// the stack: the letter's receding copies, each a step further back and down-right, the shades alternating, the last darkest
const __TT_STACK = 6;
` : ''}// the run: letters by advance at the theme's tracking, centred on x = 0; a character the atlas lacks is a space
function __ttLayout(style, text, tracking) {
  const S = __TT.styles[style], tr = Number.isFinite(tracking) ? tracking : __TT.tracking, letters = []; let x = 0;
  for (const ch of String(text)) { const g = S.glyphs[ch]; if (!g || !g.i.length) { x += __TT.space + tr; continue; } letters.push({ ch, x, a: g.a }); x += g.a + tr; }
  return { letters, width: Math.max(0.001, x - tr) };
}
function __ttBuild(tt, text, t) {
  const w = tt.w, words = w.caps ? String(text).toUpperCase() : String(text), L = __ttLayout(w.style, words, w.tracking), depth = __TT.styles[w.style].depth;
  const run = { w, t0: t, seq: tt.seq, grp: new THREE.Group(), letters: [], width: L.width, sparks: [], ring: null };
  const dark = '#' + __ttHexRgb(w.hex).map((v) => Math.round(v * 0.16 * 255).toString(16).padStart(2, '0')).join('');
  ${block ? `let edge = w.edge || 'ink';
  // a block IS the drop: the drop copy would stand in front of its sides or its steps, so the block takes its place
  // (both keeps the ink)
  if (w.blk && (edge === 'shadow' || edge === 'both')) edge = edge === 'both' ? 'ink' : 'none';` : "const edge = w.edge || 'ink';"}
  for (const l of L.letters) {
    // the letter's group sits at its centre, so a hull scales and a letter spins about it
    const lg = new THREE.Group(); lg.position.set(l.x + l.a / 2 - L.width / 2, 0, 0);
    ${block ? 'let ' : 'const '}geo = __ttGeometry(w.style, l.ch, w.hex${material ? ', w.mat' : ''});${block ? `
    if (w.blk && w.blk.kind !== 'stack') geo = __ttBlock(geo, w.style + '/' + l.ch + '/' + w.hex${material ? " + '/' + (w.mat ? (w.mat.metal || JSON.stringify(w.mat.shade)) : '')" : ''}, w.blk, depth, l.x + l.a / 2 - L.width / 2 - l.a / 2, L.width);` : ''}
    const m = new THREE.Mesh(geo, ${material ? 'w.mat ? __ttLetterMat(w.mat) : ' : ''}new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true })); m.position.set(-l.a / 2, -0.5, depth / 2); m.frustumCulled = false; m.renderOrder = 992;
    const letter = { lg, m, hull: null, shadow: null, glow: null, mats: [m.material]${block ? ', stack: null' : ''} };${block ? `
    if (w.blk && w.blk.kind === 'stack') {   // the receding copies, flat, behind the letter
      letter.stack = []; let off = 0;
      for (let i = 1; i <= __TT_STACK; i++) {
        const c = i === __TT_STACK ? w.blk.edge : i % 2 ? w.blk.side : w.hex;
        off += i % 2 || i === __TT_STACK ? 1 : 0.5;   // the face-coloured steps are thinner bands between the dark ones
        const s = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(c), transparent: true }));
        s.position.set(m.position.x + 0.036 * off, m.position.y - 0.05 * off, m.position.z - 0.07 * i);
        s.frustumCulled = false; s.renderOrder = 990; lg.add(s); letter.stack.push(s); letter.mats.push(s.material);
      }
    }` : ''}
    if (edge === 'ink' || edge === 'both') {   // the ink hull: the same letter, back faces, dark, a little larger
      const h = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: dark, side: THREE.BackSide, transparent: true })); h.scale.setScalar(1.07); h.position.copy(m.position).multiplyScalar(1.07);
      h.frustumCulled = false; h.renderOrder = 991; lg.add(h); letter.hull = h; letter.mats.push(h.material);
    }
    if (edge === 'shadow' || edge === 'both') {   // the drop copy: the same letter, dark, behind and down-right
      const s = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: dark, transparent: true })); s.position.set(m.position.x + 0.05, m.position.y - 0.06, m.position.z - 0.12);
      s.frustumCulled = false; s.renderOrder = 990; lg.add(s); letter.shadow = s; letter.mats.push(s.material);
    }
    if (edge === 'glow') {   // the glow: the same letter in the title's colour, added, larger, behind
      const g = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(w.hex), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); g.scale.setScalar(1.16); g.position.copy(m.position).multiplyScalar(1.16); g.position.z -= 0.02;
      g.frustumCulled = false; g.renderOrder = 990; lg.add(g); letter.glow = g; letter.mats.push(g.material);
    }
    lg.add(m); run.grp.add(lg); run.letters.push(letter);
  }
  if (__ttLands(w.look) && w.sparks) {
    // the landing's sparks: a slide leaves streaks behind it; the anime look throws its spark glyph in the title's
    // colour, the western look streaks, warm white
    const streak = w.look === 'slide' || !__TT_CEL, G = __ttGlyphs[streak ? 'streak' : 'spark'] || __ttGlyphs.dot, col = __TT_CEL && !streak ? w.hex : '#fff2d0';
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.tex, color: new THREE.Color(col), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true }));
      s.visible = false; s.raycast = function () {}; s.renderOrder = 993; run.grp.add(s);
      const ang = w.look === 'slide' ? Math.PI + (__ttHash(tt.seq + 1, 100 + i) - 0.5) * 0.9 : __ttHash(tt.seq + 1, 100 + i) * 6.2832, sp = 2.2 + 2.6 * __ttHash(tt.seq + 1, 200 + i);
      run.sparks.push({ s, ang, sp, size: 0.34 + 0.3 * __ttHash(tt.seq + 1, 300 + i), stretch: !!G.stretch });
    }
  }
  if (w.ring && (w.look === 'slam' || w.look === 'stamp')) {
    run.ring = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(w.hex), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, side: THREE.DoubleSide }));
    run.ring.visible = false; run.ring.renderOrder = 993; run.grp.add(run.ring);
  }
  __ttRig.add(run.grp);
  return run;
}
function __ttDrop(run) {
  __ttRig.remove(run.grp);
  for (const L of run.letters) for (const mt of L.mats) mt.dispose();
  for (const p of run.sparks) p.s.material.dispose();
  if (run.ring) { run.ring.geometry.dispose(); run.ring.material.dispose(); }
}
function __ttFire(tt, text, t) { if (tt.run) __ttDrop(tt.run); tt.seq++; tt.run = __ttBuild(tt, text, t || 0); }
// the landing's sparks and ring from \`when\` seconds after the firing, in the run's own frame (letter units); a slide's
// streaks start at the word's trailing edge
function __ttSparks(run, u, when, show) {
  const d = u - when, life = 0.5, p = d / life, ox = run.w.look === 'slide' ? run.width / 2 : 0;
  for (const q of run.sparks) {
    if (!show || d < 0 || p >= 1) { q.s.visible = false; continue; }
    q.s.visible = true; q.s.position.set(ox + Math.cos(q.ang) * q.sp * d * 0.9, Math.sin(q.ang) * q.sp * d - 2.4 * d * d, 0.3);
    const sz = q.size * (1 - p * p); q.s.scale.set(sz, sz, 1); q.s.material.opacity = 1 - p;
    if (q.stretch) { q.s.material.rotation = q.ang; q.s.scale.set(sz * 2.4, sz * 0.5, 1); }
  }
  if (run.ring) {
    const rp = d / 0.38;
    if (!show || d < 0 || rp >= 1) run.ring.visible = false;
    else { run.ring.visible = true; run.ring.position.set(0, 0, 0.25); const rs = run.width * (0.12 + 0.4 * Math.sqrt(rp)); run.ring.scale.set(rs, rs * 0.5, 1); run.ring.material.opacity = 0.9 * (1 - rp); }
  }
}
function __ttStep(t) {
  let live = false, flash = 0;
  for (const tt of __hudTitles) if (tt.run) live = true;
  if (!live) { if (__ttFlash.style.opacity !== '0') __ttFlash.style.opacity = '0'; return; }
  __ttRig.position.copy(camera.position); __ttRig.quaternion.copy(camera.quaternion);
  const H = 2 * __ttD * Math.tan((camera.fov || 50) * Math.PI / 360), W = H * (camera.aspect || 1.6);
  for (const tt of __hudTitles) {
    const r = tt.run; if (!r) continue;
    const u = (t - r.t0) / 1000, ttl = r.w.ttl, look = r.w.look, hit = Number.isFinite(r.w.flash) ? r.w.flash : 1;
    // the register's motion: its tempo scales the entrance, its steps hold it in that many drawings (the UI sheet's steps())
    const tempo = Number.isFinite(r.w.tempo) && r.w.tempo > 0 ? r.w.tempo : 1, steps = Number.isInteger(r.w.steps) && r.w.steps > 0 ? r.w.steps : 0;
    const held = (k) => (steps ? Math.min(1, Math.floor(k * steps + 1e-9) / steps) : k);
    if (u >= ttl) { __ttDrop(r); tt.run = null; continue; }
    const exitFor = look === 'fade' ? 0.5 : 0.32, ex = Math.max(0, (u - (ttl - exitFor)) / exitFor);   // the exit, over the last seconds
    const s = Math.min(0.17 * H * (Number.isFinite(r.w.scale) ? r.w.scale : 1), 0.84 * W / r.width), slot = r.w.slot;
    const y = slot === 'top' || slot === 'top-left' || slot === 'top-right' ? 0.3 * H : slot === 'bottom' || slot === 'bottom-left' || slot === 'bottom-right' ? -0.3 * H : 0;
    const seed = (k) => __ttHash(r.seq + 1, k);
    r.grp.position.set(0, y, -__ttD); r.grp.scale.setScalar(s); r.grp.rotation.set(0, 0, Number.isFinite(r.w.tilt) ? r.w.tilt : 0);
    const jolt = (k0, when, amp) => { const d = u - when; if (d < 0) return; const e = Math.exp(-d * 14) * amp * hit * H; r.grp.position.x += (seed(k0) - 0.5) * 2 * e * Math.sin(d * 90); r.grp.position.y += (seed(k0 + 1) - 0.5) * 2 * e * Math.sin(d * 70); };
    let land = 0, wordA = 1, sx = 1;
    if (look === 'slam') {
      land = 0.22 * tempo; const k = held(Math.min(1, u / land)), e = __ttBack(k);
      r.grp.scale.setScalar(s * (1 + 2.0 * (1 - e)) * (1 + 0.5 * ex * ex));
      r.grp.rotation.z += (seed(3) - 0.5) * 0.16 * (1 - k);
      if (u >= land) { jolt(5, land, 0.05); flash = Math.max(flash, hit * 0.42 * Math.max(0, 1 - (u - land) / 0.18)); }
    } else if (look === 'stamp') {
      land = 0.16 * tempo; const k = held(Math.min(1, u / land)), e = k * k;
      r.grp.position.z = -__ttD + 0.7 * __ttD * (1 - e);
      if (u >= land) { const d = u - land; r.grp.scale.setScalar(s * (1 + 0.14 * Math.sin(d * 28) * Math.exp(-d * 9))); jolt(7, land, 0.07); flash = Math.max(flash, hit * 0.55 * Math.max(0, 1 - d / 0.2)); }
    } else if (look === 'fade') {
      const k = held(Math.min(1, u / (0.55 * tempo))), e = k * k * (3 - 2 * k);
      wordA = e; r.grp.scale.setScalar(s * (1.06 - 0.06 * e)); r.grp.position.y += 0.06 * H * (1 - e);
    } else if (look === 'slide') {
      land = 0.18 * tempo; const k = held(Math.min(1, u / land)), e = __ttOut(k);
      r.grp.position.x += 0.7 * W * (1 - e) - 0.8 * W * ex * ex; sx = 1 + 0.9 * (1 - e) + 0.9 * ex;
      if (u >= land) { jolt(9, land, 0.03); flash = Math.max(flash, hit * 0.4 * Math.max(0, 1 - (u - land) / 0.15)); }
    }
    r.letters.forEach((L, i) => {
      L.lg.position.y = 0; L.lg.position.z = 0; L.lg.scale.set(sx, 1, 1); L.lg.rotation.set(0, 0, 0);
      let a = wordA;
      if (look === 'rise') {
        const p = held(Math.max(0, Math.min(1, (u - i * 0.045 * tempo) / (0.2 * tempo)))), e = 1 - (1 - p) * (1 - p), sy = 1 + 0.45 * (1 - e);
        L.lg.position.y = -0.9 * (1 - e); L.lg.scale.set(1 / sy, sy, 1); a = Math.min(1, p * 3);
        if (ex > 0) { const q = Math.max(0, Math.min(1, (ex * 1.3 - i * 0.04))); L.lg.position.y -= 1.4 * q * q; }
      } else if (look === 'stamp' && ex > 0) {
        const ang = seed(20 + i) * 6.2832; L.lg.position.x += Math.cos(ang) * 1.6 * ex * ex; L.lg.position.y += Math.sin(ang) * 1.6 * ex * ex - 0.6 * ex * ex; L.lg.rotation.z = (seed(60 + i) - 0.5) * 3 * ex;
      }
      a *= 1 - ex;
      L.m.material.opacity = a${material ? ' * (L.m.material.userData.op || 1)' : ''};
      if (L.hull) L.hull.material.opacity = a;
      if (L.shadow) L.shadow.material.opacity = a * 0.85;
      if (L.glow) L.glow.material.opacity = a * 0.45;${block ? `
      if (L.stack) for (const s of L.stack) s.material.opacity = a;` : ''}
    });
    if (__ttHasFx(r)) __ttSparks(r, u, land, ex < 0.6);
  }
  __ttFlash.style.opacity = flash.toFixed(3);
}
function __ttHasFx(r) { return r.sparks.length > 0 || !!r.ring; }`;
}

/**
 * solid-turntable — a single convex solid spinning LIVE in dependency-free CSS-3D.
 *
 * The third `/scene` form (alongside the room and fractal-city renderers). Where those
 * keep a STATIC camera and walk through a separated scene, this SPINS one centred convex
 * solid on a turntable, with the highlight fixed in the viewport so it reads as a real lit
 * object (a planet, a single atom / orbital lobe, a crystal unit cell / coordination
 * polyhedron, a gem). Promoted from the 0610 `css3d-turntable/surface-gallery` spike.
 *
 * Why ONLY a single convex solid: the live CSS backend's wall is INTERPENETRATION, not
 * occlusion (see the spike). A convex solid never self-occludes → plain backface culling
 * renders it exactly. Interpenetrating ball-and-stick molecules and self-folding chiral
 * helices stay on the baked `forge_motion` turntable (which depth-sorts per frame).
 *
 * Lighting (the one subtlety): a naive live `rotateY` with a baked per-face fill glues the
 * highlight to the surface — it travels around with the ball, which is wrong for teaching.
 * So we drive the rotation in JS (rAF), emit each face's OBJECT-space normal, and re-shade
 * every frame against a light FIXED in the viewport: `litFactor(Rx(-tilt)·Ry(yaw)·n)`. The
 * highlight then stays put as the solid turns. Mirrors `vexar.js` Lambert exactly.
 *
 * Stored manifest IS the recipe (fractal-generation philosophy — geometry regenerated on
 * render, ~nothing stored): { kind:'css3d-turntable', shape, color, surface, tilt?,
 * spinSeconds?, lod?, viewBox?, title? }.
 */

import { litFactor, makeLight, shadeHex, lodCount } from '../polygonizer/vexar.js';

// ── vector helpers (lifted from the spike; small + local so the room/city code is untouched)
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]) || 1;
const norm = (a) => scl(a, 1 / len(a));
const centroid = (ps) => scl(ps.reduce(add, [0, 0, 0]), 1 / ps.length);
function newell(ps) { // robust polygon normal (any planar winding order)
  let n = [0, 0, 0];
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i], b = ps[(i + 1) % ps.length];
    n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])];
  }
  return norm(n);
}
const normalizeRadius = (verts) => { const r = Math.max(...verts.map(len)); return verts.map((p) => scl(p, 1 / r)); };

// ── geometry: each generator → { vertices:[[x,y,z]], faces:[[idx,…]] }, unit circumradius ──
function cube() {
  const v = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
  const faces = [[4, 5, 6, 7], [1, 0, 3, 2], [5, 1, 2, 6], [0, 4, 7, 3], [7, 6, 2, 3], [0, 1, 5, 4]];
  return { vertices: normalizeRadius(v), faces };
}

function cylinder(sides = 28, R = 0.8, hH = 1.0) {
  const v = [], faces = [], top = [], bot = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2, x = Math.cos(a) * R, z = Math.sin(a) * R;
    v.push([x, hH, z]); top.push(v.length - 1);
    v.push([x, -hH, z]); bot.push(v.length - 1);
  }
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    faces.push([i * 2 + 1, j * 2 + 1, j * 2, i * 2]); // side quad, CCW from outside
  }
  faces.push(top.slice());            // top cap (N-gon)
  faces.push(bot.slice().reverse());  // bottom cap
  return { vertices: normalizeRadius(v), faces };
}

// faceted UV-sphere: quad bands + triangle pole caps. CONVEX → backface culling alone
// renders it exactly; vexar (per-face Lambert, re-shaded each frame) reads it as a smooth ball.
function uvSphere(longs = 20, lats = 12) {
  const v = [], faces = [], grid = [];
  for (let j = 0; j <= lats; j++) {
    grid[j] = [];
    for (let i = 0; i < longs; i++) {
      const th = -Math.PI / 2 + Math.PI * (j / lats), ph = 2 * Math.PI * (i / longs);
      v.push([Math.cos(th) * Math.cos(ph), Math.sin(th), Math.cos(th) * Math.sin(ph)]);
      grid[j][i] = v.length - 1;
    }
  }
  for (let j = 0; j < lats; j++) for (let i = 0; i < longs; i++) {
    const a = grid[j][i], b = grid[j][(i + 1) % longs], c = grid[j + 1][(i + 1) % longs], d = grid[j + 1][i];
    if (j === 0) faces.push([a, c, d]);             // south pole cap (a = pole)
    else if (j === lats - 1) faces.push([a, b, d]); // north pole cap (d = pole)
    else faces.push([a, b, c, d]);
  }
  return { vertices: v, faces }; // already unit radius
}

function dodecahedron() {
  const p = (1 + Math.sqrt(5)) / 2, i = 1 / p;
  const v = [
    [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1], [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1],
    [0, i, p], [0, i, -p], [0, -i, p], [0, -i, -p],
    [i, p, 0], [i, -p, 0], [-i, p, 0], [-i, -p, 0],
    [p, 0, i], [p, 0, -i], [-p, 0, i], [-p, 0, -i],
  ];
  const faces = [
    [0, 8, 10, 2, 16], [0, 16, 17, 1, 12], [0, 12, 14, 4, 8], [1, 17, 3, 11, 9], [1, 9, 5, 14, 12],
    [2, 10, 6, 15, 13], [2, 13, 3, 17, 16], [3, 13, 15, 7, 11], [4, 14, 5, 19, 18], [4, 18, 6, 10, 8],
    [5, 9, 11, 7, 19], [6, 18, 19, 7, 15],
  ];
  return { vertices: normalizeRadius(v), faces };
}

function octahedron() {
  const v = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const faces = [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]];
  return { vertices: v, faces };
}

function tetrahedron() {
  const v = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
  const faces = [[0, 2, 1], [0, 1, 3], [0, 3, 2], [1, 2, 3]];
  return { vertices: normalizeRadius(v), faces };
}

const SHAPES = { sphere: uvSphere, cube, cylinder, dodecahedron, octahedron, tetrahedron };
export const SOLID_SHAPES = Object.freeze(Object.keys(SHAPES));
export const SOLID_SURFACES = Object.freeze(['vexar', 'solid', 'glow']);

// Fixed viewport-space light. CSS coords: x right, y DOWN, z toward viewer → toLight points
// upper-left and somewhat toward the camera, raking enough that the visible hemisphere carries
// a clear light→shadow gradient (a hero turntable key, not vexar's flatter ambient-heavy scene
// default). Used both server-side (first frame) and inlined for the rAF re-shade.
const TURNTABLE_LIGHT = makeLight({ direction: [0.66, 0.46, -0.6], ambient: 0.34, diffuse: 0.74 });
const TO_LIGHT = TURNTABLE_LIGHT.toLight;

/**
 * Resolve a recipe into placed faces (object-space corners + outward normal + base hex) plus
 * render params. Pure — no DB, no HTML. Reused by the renderer and by tests.
 */
export function planSolidTurntable(recipe = {}) {
  const shape = SHAPES[recipe.shape] ? recipe.shape : 'sphere';
  const surface = SOLID_SURFACES.includes(recipe.surface) ? recipe.surface : 'vexar';
  const color = /^#[0-9a-fA-F]{6}$/.test(recipe.color || '') ? recipe.color : '#5f86ad';
  const tilt = Number.isFinite(+recipe.tilt) ? +recipe.tilt : 18;
  const spinSeconds = Number.isFinite(+recipe.spinSeconds) ? Math.max(2, +recipe.spinSeconds) : 12;
  const quality = recipe.lod || 'default';

  // LOD only widens the tessellated sphere/cylinder; the platonic solids are exact.
  const geom = shape === 'sphere'
    ? uvSphere(lodCount(20, quality, 10), lodCount(12, quality, 6))
    : shape === 'cylinder'
      ? cylinder(lodCount(28, quality, 12))
      : SHAPES[shape]();

  const faces = geom.faces.map((idx) => {
    const corners = idx.map((i) => geom.vertices[i]);
    const C = centroid(corners);
    let N = newell(corners);
    if (dot(N, C) < 0) N = scl(N, -1); // orient outward (solids are origin-centred)
    return { corners, normal: N, hex: color };
  });

  return { shape, surface, color, tilt, spinSeconds, faces, light: TURNTABLE_LIGHT };
}

// ── place one face: a clip-masked planar div via a matrix3d basis (lifted faceDiv) ──
const SCALE = 130; // px per world unit; shapes normalized to circumradius 1

function faceDiv(corners, normal, hex, surface) {
  const C = centroid(corners);
  const N = normal;
  let u = sub(corners[1], corners[0]); u = norm(sub(u, scl(N, dot(u, N)))); // u ⟂ N
  const v = cross(N, u);                                                    // u × v = N (front faces out)
  const loc = corners.map((P) => { const d = sub(P, C); return [dot(d, u) * SCALE, dot(d, v) * SCALE]; });
  const xs = loc.map((q) => q[0]), ys = loc.map((q) => q[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const W = maxX - minX, H = maxY - minY;
  const T = add(scl(C, SCALE), add(scl(u, minX), scl(v, minY)));            // world-px of the div's (0,0) corner
  const clip = loc.map((q) => `${((q[0] - minX) / W * 100).toFixed(2)}% ${((q[1] - minY) / H * 100).toFixed(2)}%`).join(',');
  const m = [u[0], u[1], u[2], 0, v[0], v[1], v[2], 0, N[0], N[1], N[2], 0, T[0], T[1], T[2], 1].map((n) => n.toFixed(5)).join(',');
  // first-frame fill (also the no-JS fallback): vexar shade against the fixed light at yaw 0
  const fill = surface === 'vexar' ? shadeHex(hex, N, TURNTABLE_LIGHT) : hex;
  const data = surface === 'vexar'
    ? ` data-nx="${N[0].toFixed(4)}" data-ny="${N[1].toFixed(4)}" data-nz="${N[2].toFixed(4)}" data-hex="${hex}"`
    : '';
  return `        <div class="f${surface === 'glow' ? ' glow' : ''}"${data} style="width:${W.toFixed(2)}px;height:${H.toFixed(2)}px;background:${fill};transform:matrix3d(${m});clip-path:polygon(${clip})"></div>`;
}

/**
 * Render a recipe into a self-contained, dependency-free preserve-3d HTML page: a single
 * convex solid spinning on a turntable, the highlight fixed in the viewport (vexar surface
 * re-shaded per frame). `?a=DEG` freezes a yaw (headless capture); hover pauses.
 */
export function renderSolidTurntableToHtml(recipe = {}) {
  const plan = planSolidTurntable(recipe);
  const vb = recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 480, height: 480 };
  const W = Number.isFinite(+vb.width) ? +vb.width : 480, H = Number.isFinite(+vb.height) ? +vb.height : 480;
  const title = recipe.title || `mojulo · ${plan.shape}`;
  const dom = plan.faces.map((f) => faceDiv(f.corners, f.normal, f.hex, plan.surface)).join('\n');
  // Inline Lambert (mirrors vexar.litFactor) — the rAF loop re-shades the vexar surface each frame
  // so the highlight stays fixed while the solid turns (Rx(-tilt)·Ry(yaw) applied to each normal).
  const reshade = plan.surface === 'vexar';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;min-height:100vh;background:#0b1220;color:#cfe3ff;font:13px/1.4 system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .stage{width:${W}px;height:${H}px;max-width:100%;perspective:${Math.round(Math.max(W, H) * 2.2)}px}
  .turn{width:100%;height:100%;position:relative;transform-style:preserve-3d;transform:rotateX(-${plan.tilt}deg) rotateY(0deg)}
  .f{position:absolute;top:50%;left:50%;transform-origin:0 0;backface-visibility:hidden;box-sizing:border-box;overflow:hidden}
  .f.glow{box-shadow:inset 0 0 0 2px #2bd6ff,inset 0 0 22px #2bd6ffaa,0 0 26px #2bd6ff77;filter:saturate(1.2)}
  .stage:hover .turn{--paused:1}
</style></head><body>
  <div class="stage"><div class="turn" id="turn">
${dom}
  </div></div>
<script>
  var turn = document.getElementById('turn');
  var TILT = ${plan.tilt} * Math.PI / 180;
  var SPIN = ${plan.spinSeconds};                 // seconds per full turn
  var L = [${TO_LIGHT.map((n) => n.toFixed(5)).join(',')}];   // viewport-fixed light (toLight)
  var AMB = ${plan.light.ambient}, DIF = ${plan.light.diffuse};
  var lit = ${reshade};
  var faces = lit ? [].slice.call(turn.querySelectorAll('.f[data-hex]')) : [];
  var norms = faces.map(function(el){ return [+el.dataset.nx, +el.dataset.ny, +el.dataset.nz]; });
  var rgbs = faces.map(function(el){ var s = el.dataset.hex.slice(1); return [0,2,4].map(function(i){ return parseInt(s.substr(i,2),16); }); });
  function hex2(v){ v = Math.max(0, Math.min(255, Math.round(v))); return (v<16?'0':'')+v.toString(16); }
  // R = Rx(-tilt)·Ry(yaw) — the same transform the browser applies to .turn, so the lit side
  // matches what's visible while the light stays fixed in the viewport.
  function shade(yaw){
    var cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(-TILT), sx = Math.sin(-TILT);
    for (var k = 0; k < faces.length; k++){
      var n = norms[k];
      var x = n[0]*cy + n[2]*sy, y = n[1], z = -n[0]*sy + n[2]*cy;   // Ry(yaw)
      var ry = y*cx - z*sx, rz = y*sx + z*cx;                        // Rx(-tilt)
      var d = x*L[0] + ry*L[1] + rz*L[2];
      var f = AMB + DIF * (d > 0 ? d : 0);
      var c = rgbs[k];
      faces[k].style.background = '#' + hex2(c[0]*f) + hex2(c[1]*f) + hex2(c[2]*f);
    }
  }
  var frozen = new URLSearchParams(location.search).get('a');
  if (frozen !== null){
    var ya = +frozen * Math.PI / 180;
    turn.style.transform = 'rotateX(-${plan.tilt}deg) rotateY(' + frozen + 'deg)';
    if (lit) shade(ya);
  } else {
    var acc = 0, last = 0;
    function frame(t){
      var paused = getComputedStyle(turn).getPropertyValue('--paused').trim() === '1';
      if (!paused) acc += (t - last);
      last = t;
      var yaw = (acc / 1000) / SPIN * Math.PI * 2;
      turn.style.transform = 'rotateX(-${plan.tilt}deg) rotateY(' + (yaw * 180 / Math.PI) + 'deg)';
      if (lit) shade(yaw);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(function(t){ last = t; requestAnimationFrame(frame); });
  }
</script>
</body></html>
`;
}

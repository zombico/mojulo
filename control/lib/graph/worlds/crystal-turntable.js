/**
 * crystal-turntable — the solid turntable's `crystal` shape (crystal-shine S3).
 *
 * A gem is an exact convex polytope (crystal-optics.js), so it belongs on the CSS turntable, which renders exactly the
 * convex class. What changes is the surface: instead of a Lambert shade, each facet is shaded every frame by the
 * crystal response (crystal-shine.js: glint, the view ray refracted per channel through the exact stone, colour by path,
 * glow, opal's flashes), and under the stone a floor that does not spin carries its print (crystal-print.js: the
 * shadow and the caustic it throws, re-traced as it turns, a few times a second). Both kernels ride the page verbatim,
 * so the page computes exactly what the server computes; nothing is baked.
 *
 * Frames. The turntable's object space is CSS (x right, y down, z toward the viewer), spun by Ry(yaw) and tipped by
 * Rx(−tilt), the light fixed in the viewport (solid-turntable.js). The crystal frame (c = z up) maps into it by
 * (x, y, z) → (x, −z, y); the z-up frame the print traces in is (x, z, −y) of CSS, which makes it the crystal frame
 * itself, spun by Rz(−yaw).
 */

import { crystalPolytope, crystalOptics, CRYSTAL_GEMS, CRYSTAL_CUTS } from '../polygonizer/crystal-optics.js';
import { shineKernel, shineOptics, faceShine } from '../polygonizer/crystal-shine.js';
import { printKernel, printOptics } from '../polygonizer/crystal-print.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const centroid = (ps) => scl(ps.reduce(add, [0, 0, 0]), 1 / ps.length);
const toCss = (v) => [v[0], -v[2], v[1]];                                        // crystal (c = z) → turntable CSS space
const SCALE = 130;                                                                // px per unit, as the turntable
const EXPOSURE = 1.5;
export const CRYSTAL_DEFAULTS = Object.freeze({ gem: 'quartz', cut: 'natural', sizeCm: 1.2 });

/** A crystal recipe → the turntable plan: faces (CSS object space, circumradius 1) and what the page's kernels need. */
export function planCrystalTurntable(recipe = {}, { light, tilt, spinSeconds }) {
  const gem = CRYSTAL_GEMS.includes(recipe.gem) ? recipe.gem : CRYSTAL_DEFAULTS.gem;
  const cut = CRYSTAL_CUTS.includes(recipe.cut) ? recipe.cut : CRYSTAL_DEFAULTS.cut;
  const sizeCm = Number.isFinite(+recipe.size) && +recipe.size > 0 ? +recipe.size : CRYSTAL_DEFAULTS.sizeCm;
  const glow = Number.isFinite(+recipe.glow) && +recipe.glow > 0 ? Math.min(1, +recipe.glow) : 0;   // the glow dial (crystal-shine.js)
  const p = crystalPolytope(gem, { size: 1, cut });
  const r = Math.max(...p.vertices.map((v) => Math.hypot(v[0], v[1], v[2])));
  const verts = p.vertices.map((v) => scl(v, 1 / r));
  const tint = crystalOptics(gem).tint;
  const faces = p.faces.map((ix, i) => ({ corners: ix.map((k) => toCss(verts[k])), normal: toCss(p.normals[i]), hex: tint, index: i }));
  return {
    shape: 'crystal', surface: 'crystal', color: tint, tilt, spinSeconds, faces, light,
    crystal: { gem, cut, sizeCm, glow, key: glow ? `${gem}~${glow}` : gem, cmPerUnit: sizeCm / 2, planes: p.planes.map((pl) => ({ n: toCss(pl.n), d: pl.d / r })),
      poly: { vertices: verts, faces: p.faces, normals: p.normals }, floorZ: -1.04 },
  };
}

const aces = (x) => Math.max(0, Math.min(1, (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)));
const srgb = (c) => { const x = Math.max(0, Math.min(1, c)); return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055; };
const hexOf = (rgb) => `#${rgb.map((c) => Math.round(255 * srgb(aces(c * EXPOSURE))).toString(16).padStart(2, '0')).join('')}`;

/** The first frame's colour of each facet (yaw 0): the no-JS fallback and the World page's baked fill. */
export function crystalFirstFrame(plan, toLight) {
  const t = (plan.tilt * Math.PI) / 180; const cx = Math.cos(-t), sx = Math.sin(-t);
  const rx = (v) => [v[0], v[1] * cx - v[2] * sx, v[1] * sx + v[2] * cx];     // Rx(−tilt): object → view (yaw 0)
  const optics = shineOptics(plan.crystal.key); const planes = plan.crystal.planes.map((pl) => ({ n: rx(pl.n), d: pl.d }));
  const up = rx([0, -1, 0]), axis = rx([0, -1, 0]); const eye = [0, 0, 8];
  return plan.faces.map((f) => {
    const c = rx(centroid(f.corners)), n = rx(f.normal);
    const { rgb } = faceShine({ optics, planes, face: { centroid: c, normal: n, index: f.index }, V: norm(sub(eye, c)), L: toLight, up, axis, cmPerUnit: plan.crystal.cmPerUnit });
    return hexOf(rgb);
  });
}

/**
 * The crystal turntable page. One canvas, no 3D layers: a convex stone's front facets never overlap on screen (the
 * reason the CSS turntable renders the convex class exactly), so each frame projects them and fills each with the
 * crystal response; the floor under it carries the print, re-traced as the stone turns. Cost is the shading's, not the
 * compositor's, whatever the facet count.
 */
export function renderCrystalTurntableToHtml(plan, { title, width: W, height: H, toLight }) {
  const k = plan.crystal; const first = crystalFirstFrame(plan, toLight);
  const data = {
    faces: plan.faces.map((f) => ({ i: f.index, c: centroid(f.corners), n: f.normal, v: f.corners })), planes: k.planes, poly: k.poly,
    optics: shineOptics(k.key), print: printOptics(k.gem, 3), cmu: k.cmPerUnit, floorZ: k.floorZ, first,
  };
  const persp = Math.round(Math.max(W, H) * 2.2);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;min-height:100vh;background:#0b1220;color:#cfe3ff;font:13px/1.4 system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center}
  canvas{width:${W}px;height:${H}px;max-width:100%;display:block}
</style></head><body>
  <canvas id="stage"></canvas>
<script>
  var D = ${JSON.stringify(data)};
  var S = (${shineKernel.toString()})();
  var P = (${printKernel.toString()})();
  var cv = document.getElementById('stage'), DPR = Math.min(2, window.devicePixelRatio || 1), W = ${W}, H = ${H};
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); var g = cv.getContext('2d'); g.scale(DPR, DPR);
  var TILT = ${plan.tilt} * Math.PI / 180, SPIN = ${plan.spinSeconds}, EXPO = ${EXPOSURE}, SC = ${SCALE}, PER = ${persp};
  var L = [${toLight.map((n) => n.toFixed(5)).join(',')}];                  // viewport-fixed light (toLight)
  function aces(x) { return Math.max(0, Math.min(1, (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14))); }
  function enc(c) { var x = aces(c * EXPO); x = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055; var v = Math.round(255 * x); return (v < 16 ? '0' : '') + v.toString(16); }
  function view(v, cy, sy, cx, sx) { var x = v[0] * cy + v[2] * sy, y = v[1], z = -v[0] * sy + v[2] * cy; return [x, y * cx - z * sx, y * sx + z * cx]; }   // Rx(-tilt)·Ry(yaw)
  function proj(p) { var s = PER / (PER - SC * p[2]); return [W / 2 + SC * p[0] * s, H / 2 + SC * p[1] * s]; }   // the CSS perspective
  var cxT = Math.cos(-TILT), sxT = Math.sin(-TILT);
  var UP = view([0, -1, 0], 1, 0, cxT, sxT), EYE = [0, 0, PER / SC];
  // the light in the turntable's own (pre-tilt) frame, then z-up for the print: (x, z, -y) of CSS
  var Lo = (function () { var c = Math.cos(TILT), s = Math.sin(TILT); return [L[0], L[1] * c - L[2] * s, L[1] * s + L[2] * c]; })();
  var LT = [Lo[0], Lo[2], -Lo[1]];
  var tToView = function (p) { return view([p[0], -p[2], p[1]], 1, 0, cxT, sxT); };   // the floor does not spin
  function path(pts) { g.beginPath(); for (var i = 0; i < pts.length; i++) { var q = proj(pts[i]); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); } g.closePath(); }
  var printed = null;
  // the print's budget: re-trace only when the stone has turned a little, and no more often than six times its own
  // cost (a 20-facet habit re-traces at ~10 Hz, a 121-facet brilliant less often), so the frame stays the shading's
  var lastPrint = -1e9, lastYaw = null, gap = 90;
  function print(yaw, t) {
    if (LT[2] <= 0.05) return;                                                // a light from below throws no print on the floor
    if (lastYaw !== null && (t - lastPrint < gap || Math.abs(yaw - lastYaw) < 0.02)) return;
    lastPrint = t; lastYaw = yaw; var t0 = performance.now();
    var cz = Math.cos(-yaw), sz = Math.sin(-yaw);
    var r = P.tracePrint({ optics: D.print, poly: D.poly, pose: { R: [[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]], at: [0, 0, 0] }, light: { dir: [-LT[0], -LT[1], -LT[2]] }, receiver: { z: D.floorZ }, depth: 1, maxPolygons: 240, unit: 100 / D.cmu, minFace: 0.03 });
    printed = { shadow: r.shadow.map(tToView), polys: r.polygons.map(function (q) { var lit = 0.35; return { v: q.corners.map(tToView), fill: '#' + enc(q.rgb[0] * lit) + enc(q.rgb[1] * lit) + enc(q.rgb[2] * lit) }; }) };
    gap = Math.max(90, 6 * (performance.now() - t0));
  }
  var FLOOR = []; for (var i = 0; i < 72; i++) { var a = i / 72 * Math.PI * 2; FLOOR.push(tToView([2 * Math.cos(a), 2 * Math.sin(a), D.floorZ])); }
  function draw(yaw) {
    g.globalCompositeOperation = 'source-over'; g.fillStyle = '#0b1220'; g.fillRect(0, 0, W, H);
    var c0 = proj(tToView([0, 0, D.floorZ])); var gr = g.createRadialGradient(c0[0], c0[1], 0, c0[0], c0[1], SC * 1.9);
    gr.addColorStop(0, '#262a33'); gr.addColorStop(0.7, '#171a21'); gr.addColorStop(1, 'rgba(11,18,32,0)'); path(FLOOR); g.fillStyle = gr; g.fill();
    if (printed) {
      if (printed.shadow.length) { path(printed.shadow); g.fillStyle = 'rgba(5,6,10,0.72)'; g.fill(); }
      g.globalCompositeOperation = 'lighter'; for (var q = 0; q < printed.polys.length; q++) { path(printed.polys[q].v); g.fillStyle = printed.polys[q].fill; g.fill(); }
      g.globalCompositeOperation = 'source-over';
    }
    var cy = Math.cos(yaw), sy = Math.sin(yaw);
    var planes = D.planes.map(function (p) { return { n: view(p.n, cy, sy, cxT, sxT), d: p.d }; });
    var axis = view([0, -1, 0], cy, sy, cxT, sxT);
    for (var k = 0; k < D.faces.length; k++) {
      var f = D.faces[k], c = view(f.c, cy, sy, cxT, sxT), n = view(f.n, cy, sy, cxT, sxT);
      var V = [EYE[0] - c[0], EYE[1] - c[1], EYE[2] - c[2]], l = Math.hypot(V[0], V[1], V[2]); V = [V[0] / l, V[1] / l, V[2] / l];
      if (n[0] * V[0] + n[1] * V[1] + n[2] * V[2] <= 0) continue;              // a back facet: the convex stone hides it
      var rgb = S.faceShine({ optics: D.optics, planes: planes, face: { centroid: c, normal: n, index: f.i }, V: V, L: L, up: UP, axis: axis, cmPerUnit: D.cmu }).rgb;
      var col = '#' + enc(rgb[0]) + enc(rgb[1]) + enc(rgb[2]);
      path(f.v.map(function (p) { return view(p, cy, sy, cxT, sxT); })); g.fillStyle = col; g.fill(); g.strokeStyle = col; g.lineWidth = 0.6; g.stroke();   // the stroke closes seams
    }
  }
  window.__crystal = { shade: function (yaw) { draw(yaw); }, print: function (yaw) { lastYaw = null; print(yaw, 0); } };   // for the budget ledger
  var frozen = new URLSearchParams(location.search).get('a');
  if (frozen !== null) { var ya = +frozen * Math.PI / 180; print(ya, 0); draw(ya); }
  else {
    var acc = 0, last = 0, paused = false; cv.addEventListener('mouseenter', function () { paused = true; }); cv.addEventListener('mouseleave', function () { paused = false; });
    function frame(t) { if (!paused) acc += (t - last); last = t; var yaw = (acc / 1000) / SPIN * Math.PI * 2; print(yaw, t); draw(yaw); requestAnimationFrame(frame); }
    requestAnimationFrame(function (t) { last = t; requestAnimationFrame(frame); });
  }
</script>
</body></html>
`;
}

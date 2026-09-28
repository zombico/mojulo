import { safeJson } from '../emit-util.js';

// The STROKE OVERLAY channel (stroke-affordances plan, S3): drawing on the World page of a `layered` solid.
// An INPUT channel, not a writer: the page snaps its camera to a named view (the wire's pinhole basis,
// depth-raster.js LAYERED_VIEW_AZ, so a stroke drawn here resolves exactly as one drawn on the wire SVG),
// takes pointer strokes with pressure on a square canvas over the view, and on release hands the stroke
// back as the `update_sketch` patch that stores it — in a copy block and on `window.__mojStroke` (the probe
// seam). The operator's host agent writes it; the page changes nothing.
//
// Stored strokes are listed: choosing one snaps the camera to the camera it was drawn against and draws it,
// with its residual (the pixels where a silhouette and this form disagree, computed at emit as scanline runs)
// as a band, so the person sees what was not reached where they drew it.
//
// `?draw=<view>` opens in drawing mode at that view. Emitted only when the layered manifest opts in with
// `channels: { strokes: true }`; a page without it is byte-identical. No step function: nothing animates.
export function strokeOverlayChannelScript(spec) {
  return `
// ---- stroke overlay channel (drawing on a layered solid; an input channel, the page writes nothing) ----
{
const SOV = ${safeJson(spec)};
const __soVIEWS = SOV.views, __soF = SOV.framing, __soDZ = SOV.dz || 0;
const __soBar = document.createElement('div');
// top-right: the page's own preset strip and view cube sit top-left, the rig preview's clip selector bottom-left
__soBar.style.cssText = 'position:fixed;right:12px;top:12px;z-index:31;display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end;max-width:min(92vw,640px);font:12px/1.4 system-ui,sans-serif;background:rgba(14,16,20,.88);color:#e8ecf1;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:6px 8px';
const __soEl = (tag, css, text) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; };
const __soSel = (opts, value) => { const s = __soEl('select', 'font:inherit;background:#1b1f26;color:inherit;border:1px solid rgba(255,255,255,.2);border-radius:5px;padding:3px 6px'); for (const [v, t] of opts) { const o = document.createElement('option'); o.value = v; o.textContent = t; s.appendChild(o); } if (value != null) s.value = value; return s; };
const __soView = __soSel(Object.keys(__soVIEWS).map((v) => [v, 'view: ' + v]));
const __soIntent = __soSel([['silhouette', 'silhouette: outline → dials'], ['contour', 'contour: line → strip'], ['brush', 'brush: push the skin'], ['fold', 'fold: waves'], ['landmark', 'landmark: name a point']]);
const __soMirror = __soEl('label', 'display:flex;gap:4px;align-items:center'); const __soMirrorBox = document.createElement('input'); __soMirrorBox.type = 'checkbox'; __soMirror.append(__soMirrorBox, 'mirror');
const __soDraw = __soEl('button', 'font:inherit;background:#2b6cb0;color:#fff;border:0;border-radius:5px;padding:4px 10px;cursor:pointer', 'draw');
const __soClear = __soEl('button', 'font:inherit;background:#1b1f26;color:inherit;border:1px solid rgba(255,255,255,.2);border-radius:5px;padding:4px 8px;cursor:pointer', 'clear');
const __soStored = __soSel([['', 'stored strokes: ' + SOV.strokes.length], ...SOV.strokes.map((s) => [s.id, s.id + ' · ' + s.intent + ' · ' + (typeof s.view === 'string' ? s.view : 'az ' + s.view.azimuth) + (s.solved ? ' · IoU ' + s.solved.iou : '')])], '');
const __soNote = __soEl('span', 'opacity:.75', 'the page writes nothing: hand the patch to your agent');
__soBar.append(__soView, __soIntent, __soMirror, __soDraw, __soClear, __soStored, __soNote);
document.body.appendChild(__soBar);
const __soOut = __soEl('pre', 'position:fixed;right:12px;top:56px;z-index:31;display:none;max-width:min(92vw,640px);max-height:40vh;overflow:auto;font:11px/1.35 ui-monospace,monospace;background:rgba(14,16,20,.92);color:#e8ecf1;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:8px 10px;white-space:pre-wrap;user-select:all');
document.body.appendChild(__soOut);
const __soShow = (text) => { __soOut.textContent = text; __soOut.style.top = (12 + __soBar.offsetHeight + 8) + 'px'; __soOut.style.display = 'block'; };
// the drawing surface: a square of side min(w, h), centred over the view — the pinhole's image square
const __soCv = document.createElement('canvas');
__soCv.style.cssText = 'position:absolute;z-index:20;pointer-events:none;touch-action:none';
wrap.style.position = wrap.style.position || 'relative'; wrap.appendChild(__soCv);
const __soCx = __soCv.getContext('2d');
let __soSq = { side: 1, x0: 0, y0: 0 };
function __soLayout() {
  const w = wrap.clientWidth, h = wrap.clientHeight, side = Math.min(w, h);
  __soSq = { side, x0: (w - side) / 2, y0: (h - side) / 2 };
  __soCv.width = side; __soCv.height = side; __soCv.style.left = __soSq.x0 + 'px'; __soCv.style.top = __soSq.y0 + 'px'; __soCv.style.width = side + 'px'; __soCv.style.height = side + 'px';
  __soRepaint();
}
// the pinhole as this page's camera: az/el about the framing target (seated by dz), the lens's vertical fov at
// this pane's aspect so the image square is the wire's square
function __soSnap(cam) {
  const a = cam.azimuth * Math.PI / 180, e = cam.elevation * Math.PI / 180, T = cam.target, d = cam.distance;
  controls.target.set(T[0], T[1], T[2] + __soDZ);
  camera.position.set(T[0] + d * Math.cos(e) * Math.sin(a), T[1] - d * Math.cos(e) * Math.cos(a), T[2] + __soDZ + d * Math.sin(e));
  const half = Math.atan(cam.size / (2 * cam.focalPixels)); const w = wrap.clientWidth, h = wrap.clientHeight;
  camera.fov = 2 * (h <= w ? half : Math.atan(Math.tan(half) * h / w)) * 180 / Math.PI; camera.updateProjectionMatrix();
  controls.update();
}
const __soCamOf = (view) => ({ azimuth: __soVIEWS[view], elevation: 10, target: __soF.target, distance: __soF.distance, focalPixels: __soF.focalPixels, size: __soF.size });
let __soDrawing = false, __soPts = [], __soShown = null, __soLive = null;
function __soPaint(pts, closed, color, width) {
  const s = __soSq.side; if (!pts || pts.length < 1) return;
  __soCx.beginPath(); pts.forEach(([x, y], i) => (i ? __soCx.lineTo(x * s, y * s) : __soCx.moveTo(x * s, y * s))); if (closed) __soCx.closePath();
  __soCx.strokeStyle = color; __soCx.lineWidth = width; __soCx.lineJoin = 'round'; __soCx.lineCap = 'round'; __soCx.stroke();
}
function __soRepaint() {
  const s = __soSq.side; __soCx.clearRect(0, 0, s, s);
  if (__soShown) {
    const R = SOV.residuals[__soShown.id]; if (R) { const k = s / R.res; __soCx.fillStyle = 'rgba(255,120,60,.62)'; for (const [j, i0, i1] of R.runs) __soCx.fillRect(i0 * k, j * k, (i1 - i0) * k, k); }
    __soPaint(__soShown.points, __soShown.closed || __soShown.intent === 'silhouette', '#c8401f', 3);
  }
  if (__soLive) __soPaint(__soLive.points, false, '#2b6cb0', 3);
}
const __soNorm = (ev) => { const r = __soCv.getBoundingClientRect(); return [Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)), Number.isFinite(ev.pressure) && ev.pressure > 0 ? Math.round(ev.pressure * 100) / 100 : 0.5]; };
const __soR4 = (v) => Math.round(v * 1e4) / 1e4;
function __soFinish() {
  if (__soPts.length < 2) { __soLive = null; __soRepaint(); return; }
  const intent = __soIntent.value; const view = __soView.value; const cam = __soCamOf(view);
  // resample to at most 64 points, so the stored bytes never depend on the pointer's sample rate
  const n = Math.min(64, __soPts.length); const pts = Array.from({ length: n }, (_, k) => __soPts[Math.round(k * (__soPts.length - 1) / (n - 1))]).map(([x, y, p]) => [__soR4(x), __soR4(y), p]);
  window.__mojStrokeCount = (window.__mojStrokeCount || 0) + 1; const id = 's' + (SOV.strokes.length + window.__mojStrokeCount);
  const stroke = { id, view, intent, points: pts, ...(intent === 'silhouette' ? { closed: true } : {}), ...(__soMirrorBox.checked ? { mirror: true } : {}), camera: { azimuth: cam.azimuth, elevation: cam.elevation, target: cam.target, distance: cam.distance, focalPixels: cam.focalPixels, size: cam.size } };
  window.__mojStroke = stroke;
  const patch = [{ op: 'set', path: '/strokes/-', value: stroke }, ...(intent === 'silhouette' ? [{ op: 'solve', from: '/strokes/' + id }] : [])];
  __soShow('update_sketch ' + JSON.stringify({ ref: SOV.ref || '<ref>', patch }, null, 1));
  __soShown = { ...stroke, closed: intent === 'silhouette' }; __soLive = null; __soRepaint();
}
__soCv.addEventListener('pointerdown', (ev) => { if (!__soDrawing) return; __soCv.setPointerCapture(ev.pointerId); __soPts = [__soNorm(ev)]; __soLive = { points: __soPts }; __soShown = null; __soRepaint(); ev.preventDefault(); });
__soCv.addEventListener('pointermove', (ev) => { if (!__soDrawing || !__soLive) return; __soPts.push(__soNorm(ev)); __soRepaint(); });
__soCv.addEventListener('pointerup', (ev) => { if (!__soDrawing || !__soLive) return; __soPts.push(__soNorm(ev)); __soFinish(); });
function __soSetDrawing(on) {
  __soDrawing = on; controls.enabled = !on; __soCv.style.pointerEvents = on ? 'auto' : 'none'; __soCv.style.cursor = on ? 'crosshair' : '';
  __soDraw.textContent = on ? 'drawing… (click to stop)' : 'draw'; __soDraw.style.background = on ? '#c8401f' : '#2b6cb0';
  if (on) { __soSnap(__soCamOf(__soView.value)); __soStored.value = ''; __soShown = null; __soRepaint(); }
}
__soDraw.addEventListener('click', () => __soSetDrawing(!__soDrawing));
__soClear.addEventListener('click', () => { __soLive = null; __soShown = null; __soOut.style.display = 'none'; __soRepaint(); });
__soView.addEventListener('change', () => { if (__soDrawing) __soSnap(__soCamOf(__soView.value)); });
__soStored.addEventListener('change', () => {
  const s = SOV.strokes.find((x) => x.id === __soStored.value); if (!s) { __soShown = null; __soRepaint(); return; }
  if (__soDrawing) __soSetDrawing(false);
  if (typeof s.view === 'string' && __soVIEWS[s.view] !== undefined) __soView.value = s.view;
  __soSnap(s.camera || __soCamOf(typeof s.view === 'string' ? s.view : 'frontal')); __soShown = s; __soRepaint();
  __soShow(JSON.stringify({ id: s.id, intent: s.intent, view: s.view, ...(s.solved ? { solved: s.solved } : {}), ...(SOV.residuals[s.id] ? { now: SOV.residuals[s.id].now } : {}) }, null, 1));
});
window.addEventListener('resize', __soLayout); __soLayout();
const __soParam = new URLSearchParams(location.search).get('draw');
if (__soParam && __soVIEWS[__soParam] !== undefined) { __soView.value = __soParam; __soSetDrawing(true); }
window.__mojStrokeOverlay = { views: Object.keys(__soVIEWS), stored: SOV.strokes.map((s) => s.id), drawing: () => __soDrawing, square: () => __soSq };
}`;
}

/** The residual mask (res × res, 1 where the outline and the solid disagree) as scanline runs [[j, i0, i1], …]. */
export function residualRuns(mask, res) {
  const runs = [];
  for (let j = 0; j < res; j++) { let i = 0; while (i < res) { if (!mask[j * res + i]) { i++; continue; } let e = i; while (e < res && mask[j * res + e]) e++; runs.push([j, i, e]); i = e; } }
  return runs;
}

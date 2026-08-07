import { safeJson } from '../emit-util.js';

// In-page script: the PICK channel (emitThreeWorld picks option). Click a pickable sub-mesh
// (keyed by its render-group name via mesh.userData.g) → raise a DOM metadata popup. A small
// pointer-movement threshold distinguishes a click from an orbit-drag, so it composes with
// OrbitControls. Raycasts every fill mesh (incl. wireframe-hidden ones, so picking still works
// in construction mode). Only emitted when the caller passes a non-empty `picks`.
export function pickChannelScript(pickMeta) {
  return `
const PICK_META = ${safeJson(pickMeta)};
const molPopup = document.getElementById('molPopup');
const pickRay = new THREE.Raycaster(), pickNdc = new THREE.Vector2();
let pickDown = null;
const escHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function hidePick() { if (molPopup) { molPopup.hidden = true; } }
function showPick(p, clientX, clientY) {
  if (!molPopup) return;
  const rows = (p.fields || []).map((f) => '<div class="pk-row"><span class="pk-k">' + escHtml(f.k) + '</span><span class="pk-v">' + escHtml(f.v) + '</span></div>').join('');
  molPopup.innerHTML = '<div class="pk-label">' + escHtml(p.label || p.name) + '</div>' + rows;
  const r = wrap.getBoundingClientRect();
  molPopup.hidden = false;
  const pw = molPopup.offsetWidth, ph = molPopup.offsetHeight;
  let x = clientX - r.left + 12, y = clientY - r.top + 12;
  x = Math.max(4, Math.min(x, r.width - pw - 4));
  y = Math.max(4, Math.min(y, r.height - ph - 4));
  molPopup.style.left = x + 'px'; molPopup.style.top = y + 'px';
}
canvas.addEventListener('pointerdown', (e) => { pickDown = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', (e) => {
  if (!pickDown) return;
  const moved = Math.hypot(e.clientX - pickDown[0], e.clientY - pickDown[1]);
  pickDown = null;
  if (moved > 5) return;                 // it was an orbit-drag, not a click
  const r = canvas.getBoundingClientRect();
  pickNdc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  pickNdc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  pickRay.setFromCamera(pickNdc, camera);
  const hits = pickRay.intersectObjects(solids, false);
  for (const h of hits) {
    const meta = h.object && h.object.userData && PICK_META[h.object.userData.g];
    if (meta) { showPick(meta, e.clientX, e.clientY); return; }
  }
  hidePick();                            // clicked empty space → dismiss
});`;
}

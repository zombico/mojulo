import { safeJson } from '../emit-util.js';

// In-page script: the adaptive-signage channel (emitThreeWorld signs option). A DOM overlay layer
// of notes — tooltip / popup / toast — billboarded over the free-orbit scene: each frame, a sign's
// world anchor (an explicit point, or the centre of the mesh whose render-group name matches its
// { object } anchor) is projected to screen and the div re-positioned (hidden when behind). Toast
// timing is real-time (setTimeout, like the CSS-3D path); popup pages via its down-button (no wheel
// scroll); tooltip shows on hover/tap. Chrome is pre-derived from the scene palette. Only emitted
// when the caller passes a non-empty `signs` — every existing World is byte-for-byte unchanged.
export function signageChannelScript(signs) {
  return `
const SIGNS = ${safeJson(signs)};
const signLayer = document.getElementById('mojSigns');
const _signEls = {}, _signAnchors = {};
const _signVp = new THREE.Vector3();
const escS = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function signCardCss(c) { const sh = c.glow && c.glow !== 'none' ? c.glow : (c.shadow && c.shadow !== 'none' ? c.shadow : 'none'); return 'background:' + c.bg + ';color:' + c.color + ';border:' + c.border + ';border-radius:' + c.radius + ';box-shadow:' + sh + ';font-family:' + c.font + ';font-size:' + c.fontSize + 'px;font-weight:' + c.fontWeight + ';padding:' + c.padding + ';'; }
function signMeshCenter(name) { let found = null; scene.traverse((o) => { if (!found && o.isMesh && o.userData && o.userData.g === name) found = o; }); if (!found) return null; const g = found.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); const ctr = g.boundingSphere.center.clone(); found.localToWorld(ctr); return ctr; }
SIGNS.forEach((s) => {
  const el = document.createElement('div'); el.className = 'moj-sign moj-sign--' + s.variant; el.dataset.signId = s.id;
  if (s.variant === 'tooltip') {
    el.tabIndex = 0;
    el.innerHTML = '<span class="moj-dot" style="background:' + (s.chrome.color || '#fff') + '"></span><div class="moj-tip" style="' + signCardCss(s.chrome) + '">' + escS(s.text) + '</div>';
    el.addEventListener('click', () => el.classList.toggle('tapped'));
  } else if (s.variant === 'popup') {
    el.setAttribute('style', signCardCss(s.chrome));
    const perPage = s.pageLines || 4; const pages = []; for (let i = 0; i < s.body.length; i += perPage) pages.push(s.body.slice(i, i + perPage));
    const pg = pages.length ? pages : [[s.text || '']];
    el.innerHTML = '<div class="moj-pages">' + pg.map((p, pi) => '<div class="moj-pg' + (pi === 0 ? ' on' : '') + '">' + p.map((l) => '<div>' + escS(l) + '</div>').join('') + '</div>').join('') + '</div>' + (pages.length > 1 ? '<button class="moj-pg-down">▾ <span class="moj-pg-ind">1/' + pages.length + '</span></button>' : '');
    const pEls = [...el.querySelectorAll('.moj-pg')], ind = el.querySelector('.moj-pg-ind'), btn = el.querySelector('.moj-pg-down'); let pi = 0;
    if (btn) btn.addEventListener('click', () => { pEls[pi].classList.remove('on'); pi = (pi + 1) % pEls.length; pEls[pi].classList.add('on'); if (ind) ind.textContent = (pi + 1) + '/' + pEls.length; });
  } else {
    el.setAttribute('style', signCardCss(s.chrome));
    el.innerHTML = (s.body.length ? s.body : [s.text || '']).map((l) => '<div>' + escS(l) + '</div>').join('');
    const a = s.after || 0, ttl = s.ttl || 2.5; setTimeout(() => { el.classList.add('show'); setTimeout(() => el.classList.remove('show'), ttl * 1000); }, a * 1000);
  }
  const an = s.anchor || {};
  if (an.kind === 'slot') el.classList.add('moj-slot-' + an.slot);
  else if (an.kind === 'xy') { el.style.left = an.xy[0] + 'px'; el.style.top = an.xy[1] + 'px'; el.classList.add('moj-sign-pt'); }
  else { el.classList.add('moj-sign-track'); _signAnchors[s.id] = an.kind === 'world' ? new THREE.Vector3(an.world[0], an.world[1], an.world[2]) : null; }
  signLayer.appendChild(el); _signEls[s.id] = el;
});
stepSigns = function () {
  for (const s of SIGNS) {
    const el = _signEls[s.id]; if (!el || !el.classList.contains('moj-sign-track')) continue;
    let p = _signAnchors[s.id];
    if (!p) { p = signMeshCenter((s.anchor || {}).object); if (p) _signAnchors[s.id] = p; }
    if (!p) { el.style.display = 'none'; continue; }
    _signVp.copy(p).project(camera);
    if (_signVp.z > 1) { el.style.display = 'none'; continue; }
    el.style.display = '';
    el.style.left = (_signVp.x * 0.5 + 0.5) * wrap.clientWidth + 'px';
    el.style.top = (-_signVp.y * 0.5 + 0.5) * wrap.clientHeight + 'px';
  }
};`;
}

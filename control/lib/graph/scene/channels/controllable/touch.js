// In-page script: the TOUCH layer of the controllable channel (index.js), a game made for a screen's (game/screen.js).
//
// A VIRTUAL standard-mapping gamepad drawn on the screen (controls/devices.js `touch`): a floating stick under the left
// thumb (it rises where the thumb lands, the mobile convention), buttons under the right, and a look zone the right
// thumb drags. The stick and buttons are the pad's own controls (left stick, south, east, west, rt), so __pollPad reads
// them through the pilot scheme's gamepad bindings exactly as it reads a real pad: a remap moves them too, and no rule
// learns which device spoke. The look drag feeds the same accumulators the mouse does.
//
// The layout is the pilot's, read off its rule and the camera, never off a genre (touchLayout): `look` a look zone (a
// mouselook camera, a craft's pitch), `lane` a stick held to left and right (a side camera's lane), `jump` / `fire` /
// `lift` the buttons the pilot answers to; use shows only while the figure stands in reach. On by default on a coarse
// pointer; `?touch=1` forces it on, `?touch=0` off. A real pad, once connected, wins.

/** The touch layout for a level's pilot and camera: { look, lane, jump, fire, lift }. Pure. */
export function touchLayout(entities, camera) {
  const pilot = (entities || []).find((e) => e && e.pilotable) || null;
  const r = (pilot && pilot.rule) || {};
  const fly = r.type === 'fly';
  return {
    look: !!(camera && (camera.mouseLook || camera.turnMode === 'look')) || fly,
    lane: !!(camera && camera.rule === 'side'),
    jump: !fly && (r.type === 'platform' || Number.isFinite(r.jumpSpeed)),
    fire: (entities || []).some((e) => e && (e.weapon || (e.rule && Array.isArray(e.rule.loadout) && e.rule.loadout.length))),
    lift: fly || r.space === true,
  };
}

/** The layer's script, for a layout (touchLayout's). Defines __touchPad() (the virtual pad, or null while the layer is
 * off) and __touchOn(). Reads the channel's __lookDX / __lookDY / __MOUSELOOK and the page's `wrap`. */
export function touchScript(L) {
  return `// ---- TOUCH (channels/controllable/touch.js): a virtual standard pad drawn on the screen ----
const __TL = ${JSON.stringify(L)};
const __touchOpt = new URLSearchParams(location.search).get('touch');
let __tOn = __touchOpt === '1' || (__touchOpt !== '0' && !!(window.matchMedia && matchMedia('(pointer: coarse)').matches));
const __tAxes = [0, 0, 0, 0], __tBtn = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
const __tPad = { id: 'mojulo touch pad (STANDARD GAMEPAD)', mapping: 'standard', connected: true, index: -1, axes: __tAxes, buttons: __tBtn };
const __tEl = document.createElement('div');
__tEl.id = 'moj-touch';
__tEl.style.cssText = 'position:absolute;inset:0;z-index:20;pointer-events:none;touch-action:none;user-select:none;-webkit-user-select:none';
const __tCss = document.createElement('style');
__tCss.textContent = '#moj-touch .z{position:absolute;bottom:0;pointer-events:auto;touch-action:none}'
  + '#moj-touch .ring{position:absolute;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;border:2px solid rgba(255,255,255,.28);background:rgba(10,14,24,.18)}'
  + '#moj-touch .ring.lane{height:56px;margin-top:-28px;border-radius:28px}'
  + '#moj-touch .nub{position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;background:rgba(255,255,255,.42)}'
  + '#moj-touch .b{position:absolute;pointer-events:auto;touch-action:none;display:flex;align-items:center;justify-content:center;border-radius:50%;border:2px solid rgba(255,255,255,.36);background:rgba(10,14,24,.32);color:rgba(255,255,255,.88);font:600 13px system-ui,sans-serif;letter-spacing:.04em}'
  + '#moj-touch .b.on{background:rgba(255,255,255,.34)}';
document.head.appendChild(__tCss);
// the stick: the left of the screen's lower half; it rises where the thumb lands, at rest a ring at its place
const __tZone = document.createElement('div');
__tZone.className = 'z';
__tZone.style.cssText = 'left:0;width:50%;height:55%';
const __tRing = document.createElement('div'), __tNub = document.createElement('div');
__tRing.className = 'ring' + (__TL.lane ? ' lane' : ''); __tNub.className = 'nub';
__tRing.appendChild(__tNub); __tZone.appendChild(__tRing); __tEl.appendChild(__tZone);
const __tRest = () => { __tRing.style.left = 'calc(96px + var(--safe-l, 0px))'; __tRing.style.top = 'calc(100% - 104px - var(--safe-b, 0px))'; __tNub.style.transform = ''; };
__tRest();
const __T_R = 56;   // the stick's travel, px: full deflection at its edge
let __tStick = null, __tLook = null;
__tZone.addEventListener('pointerdown', (e) => {
  if (__tStick) return;
  e.preventDefault(); __tZone.setPointerCapture(e.pointerId);
  const b = __tZone.getBoundingClientRect();
  __tStick = { id: e.pointerId, ox: e.clientX, oy: e.clientY };
  __tRing.style.left = (e.clientX - b.left) + 'px'; __tRing.style.top = (e.clientY - b.top) + 'px';
});
__tZone.addEventListener('pointermove', (e) => {
  if (!__tStick || e.pointerId !== __tStick.id) return;
  let dx = e.clientX - __tStick.ox, dy = __TL.lane ? 0 : e.clientY - __tStick.oy;
  const m = Math.hypot(dx, dy); if (m > __T_R) { dx *= __T_R / m; dy *= __T_R / m; }
  __tAxes[0] = dx / __T_R; __tAxes[1] = dy / __T_R;
  __tNub.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
});
const __tStickEnd = (e) => { if (!__tStick || e.pointerId !== __tStick.id) return; __tStick = null; __tAxes[0] = 0; __tAxes[1] = 0; __tRest(); };
__tZone.addEventListener('pointerup', __tStickEnd); __tZone.addEventListener('pointercancel', __tStickEnd);
// the look zone: the right of the screen, above the buttons; a drag looks as the mouse does
if (__TL.look) {
  const z = document.createElement('div');
  z.className = 'z'; z.style.cssText = 'right:0;width:50%;top:0;bottom:0';
  z.addEventListener('pointerdown', (e) => { if (__tLook) return; e.preventDefault(); z.setPointerCapture(e.pointerId); __tLook = { id: e.pointerId, x: e.clientX, y: e.clientY }; });
  z.addEventListener('pointermove', (e) => {
    if (!__tLook || e.pointerId !== __tLook.id) return;
    const dx = e.clientX - __tLook.x, dy = e.clientY - __tLook.y; __tLook.x = e.clientX; __tLook.y = e.clientY;
    if (__MOUSELOOK) { __lookDX -= dx; __lookDY -= dy; } else { __lookDX += dx; __lookDY += dy; }
  });
  const end = (e) => { if (__tLook && e.pointerId === __tLook.id) __tLook = null; };
  z.addEventListener('pointerup', end); z.addEventListener('pointercancel', end);
  __tEl.appendChild(z);
}
// the buttons: the pad's own positions (south jump, east kneel / down, west use, rt fire), under the right thumb
const __tButton = (label, idx, size, right, bottom) => {
  const b = document.createElement('div');
  b.className = 'b'; b.textContent = label;
  b.style.cssText = 'width:' + size + 'px;height:' + size + 'px;right:calc(' + right + 'px + var(--safe-r, 0px));bottom:calc(' + bottom + 'px + var(--safe-b, 0px))';
  const set = (on) => { __tBtn[idx].pressed = on; __tBtn[idx].value = on ? 1 : 0; b.classList.toggle('on', on); };
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); set(true); });
  b.addEventListener('pointerup', () => set(false)); b.addEventListener('pointercancel', () => set(false));
  __tEl.appendChild(b);
  return b;
};
if (__TL.jump) __tButton('jump', 0, 76, 24, 28);
if (__TL.lift) { __tButton('up', 0, 64, 24, 104); __tButton('down', 1, 64, 24, 28); }
if (__TL.fire) __tButton('fire', 7, 68, __TL.jump || __TL.lift ? 112 : 24, __TL.jump || __TL.lift ? 52 : 28);
const __tUse = __tButton('use', 2, 60, 24, __TL.jump || __TL.lift ? (__TL.lift ? 180 : 116) : 104);
(typeof wrap !== 'undefined' ? wrap : document.body).appendChild(__tEl);
const __touchOn = () => __tOn;
function __touchPad() {
  __tEl.style.display = __tOn ? '' : 'none';
  if (!__tOn) return null;
  // use: shown while the figure stands where it is used (the events channel's reach), released when it leaves
  const reach = !!window.__mojReach;
  __tUse.style.display = reach ? 'flex' : 'none';
  if (!reach) { __tBtn[2].pressed = false; __tBtn[2].value = 0; }
  return __tPad;
}
window.__mojTouch = { on: () => __tOn, set: (v) => { __tOn = !!v; }, layout: __TL };
`;
}

import { safeJson } from '../emit-util.js';

// DOORS (opt-in via emitThreeWorld({ doors, items }), a stage's door ends and items — era/doors.js). Rides the WALK
// channel: each frame the walk camera inside an end's trigger asks the parent page to cross, and a walker who comes
// within reach of an item takes it; the parent decides (a locked end stays shut) and places the walker at an end.
// The wire (both directions, unversioned while it is a spike):
//   page → parent  { moj: MSG_MAP_READY, doors }      the map is up and listening
//   page → parent  { moj: MSG_MAP_DOOR, door }        the walker stepped into end `door` (once per entry)
//   page → parent  { moj: MSG_MAP_TAKE, item }        the walker took `item` (its group is already hidden)
//   parent → page  { moj: MSG_MAP_ENTER, door, state } stand at end `door`'s spawn, facing in; `state.taken` lists the
//                                                     items already taken here (hidden on entry)
//   parent → page  { moj: MSG_MAP_REFUSE, door, need } the end is locked: the page says what it needs
// With no parent (the page opened on its own) a crossing only shows a toast naming where the door leads.
export const MSG_MAP_READY = 'map-ready';
export const MSG_MAP_DOOR = 'map-door';
export const MSG_MAP_ENTER = 'map-enter';
export const MSG_MAP_TAKE = 'map-take';
export const MSG_MAP_REFUSE = 'map-refuse';

export function doorsChannelScript(doors, items = []) {
  return `
// --- doors: an end's trigger asks the parent to cross; the parent places the walker at an end; items are taken ---
const __DOORS = ${safeJson(doors)};
const __ITEMS = ${safeJson(items)};
const __taken = new Set();
function __itemHide(id) { __taken.add(id); const m = meshes['item:' + id]; if (m) m.visible = false; }
// an item turns on its plinth (the era's pickup): its mesh re-centred on its own axis, so it spins in place
for (const it of __ITEMS) { const m = meshes['item:' + it.id]; if (m) { m.geometry.translate(-it.at[0], -it.at[1], 0); m.position.set(it.at[0], it.at[1], 0); } }
const __doorParent = window.parent !== window;
let __doorIn = null;
const __doorToastEl = document.createElement('div');
__doorToastEl.style.cssText = 'position:absolute;left:50%;bottom:64px;transform:translateX(-50%);padding:6px 14px;border-radius:8px;background:rgba(0,0,0,.6);color:#fff;font:600 15px system-ui;opacity:0;transition:opacity .3s;pointer-events:none;z-index:20';
(document.getElementById('wrap') || document.body).appendChild(__doorToastEl);
let __doorToastT = 0;
function __doorToast(text) { __doorToastEl.textContent = text; __doorToastEl.style.opacity = '1'; __doorToastT = 90; }
// stand at an end's spawn, facing into the room; its trigger is behind you, so you are not inside it
function __doorPlace(id, state) {
  for (const it of (state && state.taken) || []) __itemHide(it);
  const d = __DOORS.find((x) => x.id === id);
  if (!d) return;
  WALK.spawn = d.spawn.slice();
  enterFirstPerson('walk');
  walkYaw = Math.atan2(d.face[1], d.face[0]); walkPitch = 0;
  __doorIn = null;
}
function stepDoors(t) {
  if (__doorToastT > 0 && --__doorToastT === 0) __doorToastEl.style.opacity = '0';
  for (const it of __ITEMS) { const m = meshes['item:' + it.id]; if (m) m.rotation.z = t * 0.0015; }
  if (!walkOn) return;
  const p = camera.position;
  for (const it of __ITEMS) {
    if (__taken.has(it.id) || Math.hypot(p.x - it.at[0], p.y - it.at[1]) > it.r || Math.abs(p.z - it.at[2]) > 2.5) continue;
    __itemHide(it.id);
    if (__doorParent) { try { window.parent.postMessage({ moj: '${MSG_MAP_TAKE}', item: it.id }, '*'); } catch (err) { /* opaque parent */ } }
    __doorToast('took ' + it.id);
  }
  const hit = __DOORS.find((d) => p.x >= d.trigger.min[0] && p.x <= d.trigger.max[0] && p.y >= d.trigger.min[1] && p.y <= d.trigger.max[1] && p.z >= d.trigger.min[2] && p.z <= d.trigger.max[2] + 2);
  if (!hit) { __doorIn = null; return; }
  if (__doorIn === hit.id) return;
  __doorIn = hit.id;
  if (__doorParent) { try { window.parent.postMessage({ moj: '${MSG_MAP_DOOR}', door: hit.id }, '*'); } catch (err) { /* opaque parent */ } }
  else __doorToast('door to ' + hit.to.map + ' · ' + hit.to.door);
}
addEventListener('message', (e) => {
  const d = e.data;
  if (d && d.moj === '${MSG_MAP_ENTER}') __doorPlace(d.door, d.state);
  else if (d && d.moj === '${MSG_MAP_REFUSE}') __doorToast('locked · needs ' + d.need);
});
if (__doorParent) { try { window.parent.postMessage({ moj: '${MSG_MAP_READY}', doors: __DOORS.map((d) => d.id) }, '*'); } catch (err) { /* opaque parent */ } }
`;
}

// In-page script: THE BOSS ROOM'S SHUTTER on a side map's page (worlds/controllable/sidemap.js, a camera zone's `shut`;
// gameworld/side-map/play.js): the doorway open as the hero comes in, then, as the runtime walls the room up behind the
// hero (the camera's `_shut`, the time it closed by zone), a steel shutter slamming down across it, hazard bars on its
// face, out of the wall above where it waited unseen. Appended after the controllable channel's own script (it wraps
// stepControllable) on a page whose side map has a room that shuts only, so every other page keeps every byte.
//
//   SHUTTER  its fall (s) and the share of its height its bars take; the steel's and the bars' colours

export const SHUTTER = Object.freeze({ fall: 0.32, steel: 0x4c535c, edge: 0x2a2e34, bar: 0xf2b316, bars: 3, deep: 3.1 });

export function shutterScript() {
  return `
// THE BOSS ROOM'S SHUTTER (shutter-view.js): down across the way in once the room has shut behind the hero
const __SHUT = ${JSON.stringify(SHUTTER)};
const __shRecs = {};
function __shBuild(S) {
  const h = S.z1 - S.z0, g = new THREE.Group(), mat = (c) => new THREE.MeshBasicMaterial({ color: c });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(__SHUT.deep, S.w, h), mat(__SHUT.steel));
  g.add(slab);
  // (its bars on the face the camera sees, hazard yellow, between dark seams)
  for (let i = 0; i < __SHUT.bars; i++) {
    const zc = -h / 2 + (h * (i + 0.5)) / __SHUT.bars;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.02, S.w * 0.92, h * 0.14), mat(__SHUT.bar));
    bar.position.set(__SHUT.deep / 2 + 0.011, 0, zc); g.add(bar);
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.02, S.w, h * 0.03), mat(__SHUT.edge));
    seam.position.set(__SHUT.deep / 2 + 0.011, 0, zc + h * 0.5 / __SHUT.bars); g.add(seam);
  }
  g.traverse((o) => { o.raycast = function () {}; });
  g.visible = false; scene.add(g);
  return { g, h };
}
function __shFrame() {
  const cam = __world.camera, Zs = cam && cam.rule && cam.rule.zones;
  if (!Zs) return;
  const at = cam._shut || {};
  for (let k = 0; k < Zs.length; k++) {
    const S = Zs[k].shut;
    if (!S) continue;
    const R = __shRecs[k] || (__shRecs[k] = __shBuild(S)), t0 = at[k];
    if (t0 == null) { R.g.visible = false; continue; }
    const f = Math.min(1, Math.max(0, (__world.time - t0) / __SHUT.fall)), down = f * f;   // (falling: it gathers speed)
    R.g.visible = true;
    R.g.position.set(0, S.s - S.w / 2, S.z0 + R.h / 2 + (1 - down) * R.h);
  }
}
const __shStep0 = stepControllable;
stepControllable = (dt, inputOverride) => { __shStep0(dt, inputOverride); __shFrame(); };
`;
}

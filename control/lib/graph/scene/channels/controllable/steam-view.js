// In-page script: STEAM from a body's vents (a worker bot's exhausts, workbots/: `body.steam` { vents: [{ at, dir }] }, at
// in the figure's own frame, +y its front, grounded, at the body's scale): soft puffs leaving each vent along the way it
// points, slowing, rising and swelling as they thin out, on the world's clock. Appended after the controllable channel's
// own script (it wraps stepControllable) on a page with a body that steams only, so every other page keeps every byte.
//
//   STEAM  a puff every `every` s a vent, its `life` s, its speed out of the vent and its rise, its size at birth and at
//          its end, its colour and opacity

export const STEAM = Object.freeze({ every: 0.11, life: 1.3, out: 1.6, rise: 0.9, size: [0.28, 1.1], color: 0xe9eef2, opacity: 0.55 });

export function steamScript() {
  return `
// THE STEAM (steam-view.js): puffs from each vent of a body that steams, out along its pipe, rising and thinning
const __STEAM = ${JSON.stringify(STEAM)};
const __stTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const __stPuffs = [], __stLast = {};
// a vent's point and way in the world: the figure's frame turned by the body's heading and the rig's yaw (its +y nose on
// heading-forward), at the body's scale, from its feet
function __stWorld(e, v) {
  const a = (e.transform.heading || 0) - Math.PI / 2, c = Math.cos(a), s = Math.sin(a), k = (e.body && e.body.scale) || 1, p = e.transform.pos, eye = (e.rule && e.rule.eye) || 0;
  const rot = (q) => [q[0] * c - q[1] * s, q[0] * s + q[1] * c, q[2]];
  const at = rot(v.at), d = rot(v.dir);
  return { at: [p[0] + at[0] * k, p[1] + at[1] * k, p[2] - eye + at[2] * k], dir: d, k };
}
function __stFrame() {
  const t = __world.time;
  for (const e of __world.entities) {
    const S = e.body && e.body.steam;
    if (!S || !S.vents || e.gone) continue;
    if (__stLast[e.id] != null && t - __stLast[e.id] < __STEAM.every) continue;
    __stLast[e.id] = t;
    for (const v of S.vents) {
      const W = __stWorld(e, v), m = new THREE.Sprite(new THREE.SpriteMaterial({ map: __stTex, color: __STEAM.color, transparent: true, opacity: __STEAM.opacity, depthWrite: false }));
      m.position.set(W.at[0], W.at[1], W.at[2]); m.raycast = function () {}; scene.add(m);
      __stPuffs.push({ m, born: t, at: W.at, dir: W.dir, k: W.k });
    }
  }
  for (let i = __stPuffs.length - 1; i >= 0; i--) {
    const P = __stPuffs[i], u = (t - P.born) / __STEAM.life;
    if (u >= 1 || u < 0) { scene.remove(P.m); P.m.material.dispose(); __stPuffs.splice(i, 1); continue; }
    // (out along the pipe, slowing; up as it cools; swelling as it thins)
    const go = __STEAM.out * P.k * (1 - (1 - u) * (1 - u)) * 0.5, up = __STEAM.rise * P.k * u * u;
    P.m.position.set(P.at[0] + P.dir[0] * go, P.at[1] + P.dir[1] * go, P.at[2] + P.dir[2] * go + up);
    const sz = (__STEAM.size[0] + (__STEAM.size[1] - __STEAM.size[0]) * u) * P.k; P.m.scale.set(sz, sz, 1);
    P.m.material.opacity = __STEAM.opacity * (1 - u) * Math.min(1, u * 8);
  }
}
const __stStep0 = stepControllable;
stepControllable = (dt, inputOverride) => { __stStep0(dt, inputOverride); __stFrame(); };
`;
}

/**
 * THE SPACE BLAST — a ship blown up in space the way the miniature effects shops filmed it: a real FIREBALL, not a
 * graphic. Pyrotechnics shot at high speed against black and comped in: a hot white core that is gone in a blink, a
 * billowing mass of flame rolling out from it, each lobe cooling from yellow through orange to a deep red and on into
 * dark smoke that hangs, and through it all hard DEBRIS (chunks of the model, tumbling, flying straight on: there is no
 * air to slow them and nothing to pull them down), some of it still burning, and a spray of embers. No shock rings, no
 * graphic halos: what reads is mass, heat and wreckage.
 *
 *   FLASH      one white-hot sprite, a tenth of a second
 *   FIREBALL   lobes thrown out from the heart, each its own way and pace (seeded by the blast), slowing as they
 *              billow, growing; each a fire sprite (additive, its colour down the cooling ramp) over a smoke sprite
 *              (dark, blended, rising as the fire fades and hanging after it)
 *   DEBRIS     chunks (shards and plates, shaded hard, a hull's greys) flung straight on, tumbling, a third of them
 *              burning (an ember riding them, guttering out)
 *   EMBERS     fast sparks thrown straight out, cooling and gone
 *
 * The page runs it for a craft's burst on a starfighter's page (a fighter, and every blast of a capital ship's
 * blow-up): `__spaceBlast(at, size, seed)`, aged by `__spaceBlastAge()` each frame. Its textures are painted once on
 * the page from seeded dice (a billow of overlapping lobes, a hard-edged ember), never an image. SPACE_BLAST the numbers.
 */

export const SPACE_BLAST = Object.freeze({
  flash: Object.freeze({ life: 0.12, size: 1.3 }),
  // (lobes: their count by the blast's size, their life, their pace out and their growth, all as shares of its size)
  fire: Object.freeze({ lobes: [7, 16], perSize: 6, life: [0.9, 1.6], pace: [0.5, 1.5], start: 0.3, grow: [0.75, 1.2] }),
  smoke: Object.freeze({ life: [2.6, 4.2], alpha: 0.6, grow: 1.6, tint: Object.freeze(['#2a221d', '#3a332e', '#1d1b1a']) }),
  // (the fire's cooling: white-hot, yellow, orange, deep red, soot; the stop each colour holds at)
  ramp: Object.freeze([[0, '#fffbe6'], [0.12, '#ffe08a'], [0.32, '#ff9a32'], [0.55, '#c8441a'], [0.78, '#5a2a18'], [1, '#2a1a12']]),
  debris: Object.freeze({ chunks: [6, 26], perSize: 3, pace: [1.4, 4], life: [4, 7], size: [0.04, 0.12], burning: 3, tones: Object.freeze(['#6f747a', '#4a4e54', '#8b9096', '#2f3236']) }),
  embers: Object.freeze({ count: [14, 40], pace: [3, 7], life: [0.5, 1.1], size: 0.03 }),
});

/** The page script: the textures, the blast and its ageing (its numbers inlined). */
export function spaceBlastScript() {
  return `// THE SPACE BLAST (space-blast.js): a ship blown up as the effects shops filmed one: flash, fireball, smoke, debris
const __SB = ${JSON.stringify(SPACE_BLAST)};
const __sbTex = (() => {
  // (seeded dice for the paint: the same page, the same billow)
  let a = 0x5b1a57;
  const rnd = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const mk = (n, paint) => { const c = document.createElement('canvas'); c.width = c.height = n; paint(c.getContext('2d'), n); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  // a billow: a lobe of overlapping soft balls, denser at the heart, its edge broken into cauliflower
  const billow = (k) => mk(128, (x, n) => {
    for (let i = 0; i < 46; i++) {
      const r = n * (0.08 + 0.14 * rnd()), th = rnd() * Math.PI * 2, d = n * 0.3 * Math.sqrt(rnd()), cx = n / 2 + Math.cos(th) * d, cy = n / 2 + Math.sin(th) * d;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, 'rgba(255,255,255,' + (0.35 + 0.3 * rnd()) + ')'); g.addColorStop(0.7, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, n, n);
    }
    void k;
  });
  const soft = mk(64, (x, n) => { const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); });
  const ember = mk(32, (x, n) => { const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); });
  return { billows: [billow(0), billow(1), billow(2)], soft, ember };
})();
const __sbRamp = __SB.ramp.map((s) => [s[0], new THREE.Color(s[1])]);
function __sbHeat(u, c) { for (let i = 1; i < __sbRamp.length; i++) if (u <= __sbRamp[i][0]) { const a = __sbRamp[i - 1], b = __sbRamp[i]; return c.copy(a[1]).lerp(b[1], (u - a[0]) / (b[0] - a[0])); } return c.copy(__sbRamp[__sbRamp.length - 1][1]); }
// (a chunk of a hull: a shard or a plate, its faces shaded hard from one side, in a hull's grey)
const __sbChunkGeo = (() => {
  const shade = (geo, k) => { const g = geo.toNonIndexed(); g.computeVertexNormals(); const n = g.getAttribute('normal'), col = new Float32Array(n.count * 3), L = new THREE.Vector3(0.45, -0.35, 0.82).normalize(); for (let i = 0; i < n.count; i++) { const s = 0.3 + 0.7 * Math.max(0, n.getX(i) * L.x + n.getY(i) * L.y + n.getZ(i) * L.z); col[3 * i] = col[3 * i + 1] = col[3 * i + 2] = s; } g.setAttribute('color', new THREE.BufferAttribute(col, 3)); void k; return g; };
  return [shade(new THREE.TetrahedronGeometry(1, 0), 0), shade(new THREE.BoxGeometry(1.6, 1, 0.25), 1), shade(new THREE.BoxGeometry(1, 0.6, 0.6), 2), shade(new THREE.OctahedronGeometry(0.9, 0), 3)];
})();
const __sbs = [];
function __spaceBlast(at, size, seed) {
  let a = (Math.imul((seed | 0) + 1, 2654435761) ^ Math.floor(at[0] * 13 + at[1] * 7 + at[2] * 3)) | 0;
  const rnd = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const span = (r) => r[0] + (r[1] - r[0]) * rnd(), within = (r, n) => Math.max(r[0], Math.min(r[1], Math.round(n)));
  const dir = () => { const z = 2 * rnd() - 1, th = 2 * Math.PI * rnd(), q = Math.sqrt(1 - z * z); return [q * Math.cos(th), q * Math.sin(th), z]; };
  const B = { at: at.slice(), born: __world.time, size, parts: [] }, F = __SB.fire, S = __SB.smoke, D = __SB.debris, E = __SB.embers;
  const sprite = (tex, col, blend) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(col), transparent: true, opacity: 0, blending: blend, depthWrite: false })); s.raycast = function () {}; s.position.set(at[0], at[1], at[2]); s.material.rotation = rnd() * Math.PI * 2; scene.add(s); return s; };
  // the flash
  B.parts.push({ kind: 'flash', s: sprite(__sbTex.soft, '#ffffff', THREE.AdditiveBlending), life: __SB.flash.life });
  // the fireball's lobes, each a fire over a smoke
  const nl = within(F.lobes, F.lobes[0] + size / F.perSize);
  for (let i = 0; i < nl; i++) {
    const d = dir(), pace = span(F.pace) * size, life = span(F.life), tex = __sbTex.billows[i % 3], grow = span(F.grow);
    B.parts.push({ kind: 'lobe', fire: sprite(tex, '#ffffff', THREE.AdditiveBlending), smoke: sprite(tex, S.tint[i % S.tint.length], THREE.NormalBlending), d, pace, life, slife: span(S.life), grow, spin: (rnd() - 0.5) * 0.6, delay: rnd() * 0.08 });
  }
  // the debris, flying straight on, tumbling, a third of it burning
  const nd = within(D.chunks, size / D.perSize);
  for (let i = 0; i < nd; i++) {
    const d = dir(), m = new THREE.Mesh(__sbChunkGeo[i % __sbChunkGeo.length], new THREE.MeshBasicMaterial({ color: new THREE.Color(D.tones[i % D.tones.length]), vertexColors: true, transparent: true, opacity: 1 }));
    m.raycast = function () {}; m.position.set(at[0], at[1], at[2]); m.scale.setScalar(size * span(D.size)); scene.add(m);
    const ember = i % D.burning === 0 ? sprite(__sbTex.ember, '#ffb040', THREE.AdditiveBlending) : null;
    B.parts.push({ kind: 'chunk', m, ember, d, pace: span(D.pace) * size * 0.5, life: span(D.life), w: [(rnd() - 0.5) * 6, (rnd() - 0.5) * 6, (rnd() - 0.5) * 6] });
  }
  // the embers: one Points, each straight out, cooling
  const ne = within(E.count, 10 + size), pos = new Float32Array(ne * 3), vel = [];
  for (let i = 0; i < ne; i++) { const d = dir(), p = span(E.pace) * size; vel.push([d[0] * p, d[1] * p, d[2] * p]); pos[3 * i] = at[0]; pos[3 * i + 1] = at[1]; pos[3 * i + 2] = at[2]; }
  const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(eg, new THREE.PointsMaterial({ map: __sbTex.ember, color: new THREE.Color('#ffc060'), size: Math.max(0.3, size * E.size), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
  pts.raycast = function () {}; scene.add(pts);
  B.parts.push({ kind: 'embers', pts, vel, life: span(E.life) });
  B.end = Math.max(...B.parts.map((p) => (p.kind === 'lobe' ? p.delay + Math.max(p.life, p.slife) : p.life)));
  __sbs.push(B);
}
function __spaceBlastAge() {
  const c = new THREE.Color();
  for (let i = __sbs.length - 1; i >= 0; i--) {
    const B = __sbs[i], t = __world.time - B.born, z = B.size, at = B.at;
    if (t > B.end) {
      for (const p of B.parts) for (const o of [p.s, p.fire, p.smoke, p.m, p.ember, p.pts]) if (o) { scene.remove(o); if (o.isPoints) o.geometry.dispose(); if (o.material) o.material.dispose(); }
      __sbs.splice(i, 1); continue;
    }
    for (const p of B.parts) {
      if (p.kind === 'flash') { const u = t / p.life; p.s.material.opacity = u < 1 ? 1 - u : 0; p.s.scale.setScalar(z * __SB.flash.size * (0.6 + 0.6 * Math.min(1, u * 3))); continue; }
      if (p.kind === 'lobe') {
        const tt = Math.max(0, t - p.delay), u = Math.min(1, tt / p.life);
        // (out from the heart and slowing as it billows: its reach eases out; growing as it goes)
        const reach = p.pace * (1 - Math.exp(-tt * 1.8)) / 1.8, sz = z * (__SB.fire.start + p.grow * (1 - Math.pow(1 - Math.min(1, tt / (p.life * 0.8)), 2)));
        const x = at[0] + p.d[0] * reach, y = at[1] + p.d[1] * reach, w = at[2] + p.d[2] * reach;
        p.fire.position.set(x, y, w); p.fire.scale.setScalar(sz); p.fire.material.rotation += p.spin * 0.016;
        __sbHeat(u, c); p.fire.material.color.copy(c); p.fire.material.opacity = t < p.delay ? 0 : u < 1 ? Math.min(1, tt * 12) * (1 - Math.pow(u, 2.2)) : 0;
        // (the smoke behind it: rising as the fire cools, hanging, spreading, gone slowly)
        const v = Math.min(1, tt / p.slife), sm = Math.min(1, Math.max(0, (u - 0.25) / 0.35)) * (1 - Math.pow(v, 1.5));
        p.smoke.position.set(x, y, w); p.smoke.scale.setScalar(sz * (1 + (__SB.smoke.grow - 1) * v)); p.smoke.material.rotation -= p.spin * 0.008;
        p.smoke.material.opacity = t < p.delay ? 0 : __SB.smoke.alpha * sm;
        p.fire.renderOrder = 2; p.smoke.renderOrder = 1;
        continue;
      }
      if (p.kind === 'chunk') {
        const u = t / p.life, r = p.pace * t;
        p.m.position.set(at[0] + p.d[0] * r, at[1] + p.d[1] * r, at[2] + p.d[2] * r);
        p.m.rotation.set(p.w[0] * t, p.w[1] * t, p.w[2] * t);
        p.m.material.opacity = u < 0.85 ? 1 : Math.max(0, (1 - u) / 0.15); p.m.visible = u < 1;
        if (p.ember) { const e = Math.max(0, 1 - t / 1.6); p.ember.position.copy(p.m.position); p.ember.scale.setScalar(z * 0.12 * (0.4 + 0.6 * e) * (0.8 + 0.2 * Math.sin(t * 40 + p.w[0]))); p.ember.material.opacity = e; }
        continue;
      }
      if (p.kind === 'embers') {
        const u = t / p.life, P = p.pts.geometry.getAttribute('position');
        for (let k = 0; k < p.vel.length; k++) P.setXYZ(k, at[0] + p.vel[k][0] * t, at[1] + p.vel[k][1] * t, at[2] + p.vel[k][2] * t);
        P.needsUpdate = true; __sbHeat(Math.min(1, 0.1 + u * 0.6), c); p.pts.material.color.copy(c); p.pts.material.opacity = Math.max(0, 1 - u); p.pts.visible = u < 1;
      }
    }
  }
}
`;
}

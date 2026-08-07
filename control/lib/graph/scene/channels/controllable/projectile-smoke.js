import { safeJson } from '../../emit-util.js';

// PROJECTILE SMOKE (bazooka fire trails + explosion smoke — the smoke-test experiment): soft
// NORMAL-blended gray puff sprites, pooled and re-used (the comet-tail lesson: fixed pool, no
// allocation churn). Two sources, both read off engine state the renderer already mirrors:
//   • TRAIL — while a round flies (__world.projectiles), drop a puff every `cadence` of SIM time
//     at the shell's position; each puff hangs in the air, drifts, expands, and thins — so the
//     shell drags a dissipating exhaust column that persists after the round is gone.
//   • BURST — on each new __world.bursts seq (own edge counter, beside the fx fireball), a SEEDED
//     cluster of bigger, darker puffs thrown out + up from the detonation (the clash-spark recipe:
//     mulberry32 over the seq, analytic age-driven motion — a replay scatters identically).
// Puff textures are lumpy billow silhouettes — a base blob ringed by sub-blobs whose radii ride
// low-order harmonics (n 3/5, the wave-manji cloud construction idea) — so smoke reads billowy,
// not disc-shaped. Sprites: depthTest ON (real occlusion behind cover — the depth buffer is
// correct for transient mid-air media, unlike the ground-hugging shadow blob), depthWrite off,
// raycast no-op (E8). Interpolated into the controllable channel ONLY when the world opts in
// (`smoke` manifest setting); absent ⇒ byte-identical emission.
export function projectileSmokeBlock(cfg) {
  return `
// --- projectile smoke (opt-in world 'smoke') ---
const __SMK = ${safeJson(cfg)};
function __smkRng(a) { a = a >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function __smkTex(seed) {   // lumpy billow silhouette: base blob + harmonic sub-blobs (wave-manji cloud idea)
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const x = cv.getContext('2d');
  const rnd = __smkRng(0xC10D ^ Math.imul(seed + 1, 2654435761));
  const blob = (bx, by, br, a) => {
    const g = x.createRadialGradient(bx, by, 0, bx, by, br);
    g.addColorStop(0, 'rgba(255,255,255,' + a + ')'); g.addColorStop(0.55, 'rgba(255,255,255,' + (a * 0.5).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(bx, by, br, 0, 7); x.fill();
  };
  blob(64, 64, 44, 0.8);
  const p3 = rnd() * 6.283, p5 = rnd() * 6.283, n = 8;
  for (let i = 0; i < n; i++) {
    const th = (i / n) * 6.283 + rnd() * 0.35;
    const ro = 26 + 9 * Math.sin(3 * th + p3) + 6 * Math.sin(5 * th + p5);
    blob(64 + Math.cos(th) * ro, 64 + Math.sin(th) * ro, 20 + rnd() * 9, 0.5);
  }
  return new THREE.CanvasTexture(cv);
}
const __smkTexs = [__smkTex(1), __smkTex(2), __smkTex(3)];
const __smkPool = [];   // fixed-cap pool of { s, live, born, ttl, p0, vel, rise, r0, r1, a0, rot0, spin }
window.__mojSmoke = __smkPool;   // introspection surface (spikes/debug), like __mojShadows
function __smkSpawn(p0, vel, rise, r0, r1, a0, ttl, tint, rnd, delay) {
  let k = __smkPool.find((q) => !q.live);
  if (!k && __smkPool.length < __SMK.max) {
    const mat = new THREE.SpriteMaterial({ map: __smkTexs[__smkPool.length % 3], transparent: true, opacity: 0, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.raycast = function () {};   // decoration — never footing, never a pick (E8)
    s.renderOrder = 2; s.visible = false;
    scene.add(s);
    k = { s: s, live: false }; __smkPool.push(k);
  }
  if (!k) { let old = __smkPool[0]; for (const q of __smkPool) if (q.born < old.born) old = q; k = old; }   // pool full → steal the oldest
  k.live = true; k.born = __world.time; k.delay = delay || 0; k.ttl = ttl; k.p0 = p0; k.vel = vel; k.rise = rise;
  k.r0 = r0; k.r1 = r1; k.a0 = a0; k.rot0 = rnd() * 6.283; k.spin = (rnd() - 0.5) * 1.1;
  k.s.material.color.set(tint); k.s.material.map = __smkTexs[(rnd() * 3) | 0];
  return k;
}
let __smkSeen = -1;         // burst seq edge (own counter beside the fx fireball's)
const __smkTrail = {};      // projectile id -> { last: [x,y,z], carry: leftover dist, n: puffs dropped }
const __smkDust = {};       // entity id -> { last: [x,y,z], carry: leftover dist, n: puffs dropped }
const __smkTopple = {};     // entity id -> topple impact edge armed while flat/downed
function __smkHash(str) { let h = 0; for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0; return h >>> 0; }
function __smkGround(e, maxH) {
  const p = e && e.transform && e.transform.pos;
  if (!p) return null;
  const gz = (typeof __ground === 'function') ? __ground([p[0], p[1], p[2] + maxH + 0.2]) : null;
  return (gz != null && p[2] - gz <= maxH + 1e-4) ? gz : null;
}
function __smkDropDust(id, p, gz, dir, count, D, seedMix) {
  const dx = dir && Number.isFinite(dir[0]) ? dir[0] : 1, dy = dir && Number.isFinite(dir[1]) ? dir[1] : 0;
  const dl = Math.hypot(dx, dy) || 1;
  const ux = dx / dl, uy = dy / dl, sideX = -uy, sideY = ux;
  const n = Math.max(1, count | 0);
  for (let i = 0; i < n; i++) {
    const rnd = __smkRng(__smkHash(id) ^ Math.imul(i + 1, seedMix || 0x85EBCA6B));
    const lane = (rnd() - 0.5) * (D.width || 8.5);
    const back = (D.back || 5.5) * (0.55 + rnd() * 0.9);
    const wash = 0.65 + rnd() * 0.7;
    __smkSpawn([p[0] - ux * back + sideX * lane, p[1] - uy * back + sideY * lane, gz + (D.z || 0.35) + rnd() * 0.35],
      [-ux * wash + sideX * (rnd() - 0.5) * 1.2, -uy * wash + sideY * (rnd() - 0.5) * 1.2, 0],
      D.rise || 0.55, D.r0 || 2.6, D.r1 || 8.8, D.alpha || 0.42, D.ttl || 1.05, D.tint, rnd);
  }
}
function __updateSmoke() {
  const t = __world.time;
  const live = {};
  for (const p of (__world.projectiles || [])) {   // TRAIL: puffs every SMK.spacing units of TRAVEL.
    if (p.smokeTrail === false) continue;          // grenades stay visually clean; bazookas/default lob rounds keep trails
    // Distance-based, not time-based — an R27 shell covers ~38u per 24fps tick, so puffs must be
    // laid ALONG the tick's segment (several per tick), or a fast round leaves no trail at all.
    live[p.id] = true;
    let tr = __smkTrail[p.id];
    if (!tr) tr = __smkTrail[p.id] = { last: [p.pos[0], p.pos[1], p.pos[2]], carry: 0, n: 0 };
    const sx = p.pos[0] - tr.last[0], sy = p.pos[1] - tr.last[1], sz = p.pos[2] - tr.last[2];
    const L = Math.hypot(sx, sy, sz);
    if (L > 1e-6) {
      let off = __SMK.spacing - tr.carry;
      while (off <= L) {
        tr.n += 1;
        const f = off / L;
        const rnd = __smkRng(__smkHash(p.id) ^ Math.imul(tr.n, 0x9E3779B9));
        const j = () => (rnd() - 0.5) * 2.4;
        __smkSpawn([tr.last[0] + sx * f + j(), tr.last[1] + sy * f + j(), tr.last[2] + sz * f + j()],
          [j() * 0.9, j() * 0.9, 0], 2.4 + rnd() * 1.8,
          2.2 + rnd() * 1.0, 6.2 + rnd() * 2.6, __SMK.alpha * 0.85, 1.25 + rnd() * 0.55, __SMK.trailTint, rnd);
        off += __SMK.spacing;
      }
      tr.carry = L - (off - __SMK.spacing);
      tr.last[0] = p.pos[0]; tr.last[1] = p.pos[1]; tr.last[2] = p.pos[2];
    }
  }
  for (const id in __smkTrail) if (!live[id]) delete __smkTrail[id];   // round gone → stop emitting (its puffs age out on their own)
  if (__SMK.dust && __SMK.dust.enabled !== false) {   // BOOST/DODGE/TOPPLE DUST: tan wakes and ground-hit slaps.
    const D = __SMK.dust, dustLive = {};
    const spacing = Math.max(1, D.spacing || 4.2), maxH = Math.max(0.05, D.maxHeight || 2.2);
    for (const e of (__world.entities || [])) {
      if (!e || !e.id || (e.rule && e.rule.space)) continue;
      const p = e.transform && e.transform.pos; if (!p) continue;
      const gz = __smkGround(e, maxH);
      if (gz == null) { delete __smkDust[e.id + ':boost']; delete __smkDust[e.id + ':dodge']; continue; }

      const toppleImpact = e.staggerT != null && (e.reactClip === 'downpause' || (e.reactClip === 'topple' && e.staggerT >= 1));
      if (toppleImpact && !__smkTopple[e.id]) {   // TOPPLE DUST: one heavy floor slap when the fall reaches the heap.
        const tv = e.vel || [Math.cos(e.transform.heading || 0), Math.sin(e.transform.heading || 0), 0];
        __smkDropDust(e.id + ':topple', p, gz, [tv[0], tv[1]], D.toppleCount || 12,
          { ...D, width: D.toppleWidth || 13, back: D.toppleBack || 2.5, r0: D.toppleR0 || 3.4, r1: D.toppleR1 || 12, alpha: D.toppleAlpha || 0.5, ttl: D.toppleTtl || 1.35, rise: D.toppleRise || 0.75 },
          0xC2B2AE35);
      }
      __smkTopple[e.id] = toppleImpact;

      const dodgeDust = e.dodgeT != null && e.dodgeDir;
      const boostDust = e.boosting && e.thrust > 0.15;
      if (!boostDust && !dodgeDust) continue;
      const mode = dodgeDust ? 'dodge' : 'boost';
      const key = e.id + ':' + mode;
      dustLive[key] = true;
      let tr = __smkDust[key];
      if (!tr) tr = __smkDust[key] = { last: [p[0], p[1], gz], carry: 0, n: 0 };
      const sx = p[0] - tr.last[0], sy = p[1] - tr.last[1], L = Math.hypot(sx, sy);
      if (L <= 1e-6) continue;
      const moveH = Math.atan2(sy, sx), sideX = -Math.sin(moveH), sideY = Math.cos(moveH);
      const modeSpacing = dodgeDust ? Math.max(1, D.dodgeSpacing || spacing * 0.85) : spacing;
      let off = modeSpacing - tr.carry;
      while (off <= L) {
        tr.n += 1;
        const f = off / L;
        const rnd = __smkRng(__smkHash(key) ^ Math.imul(tr.n, dodgeDust ? 0x27D4EB2F : 0x85EBCA6B));
        const lane = (rnd() - 0.5) * (dodgeDust ? (D.dodgeWidth || 10.5) : (D.width || 8.5));
        const back = (dodgeDust ? (D.dodgeBack || 3.2) : (D.back || 5.5)) * (0.55 + rnd() * 0.9);
        const x = tr.last[0] + sx * f - Math.cos(moveH) * back + sideX * lane;
        const y = tr.last[1] + sy * f - Math.sin(moveH) * back + sideY * lane;
        const wash = 0.65 + rnd() * 0.7;
        __smkSpawn([x, y, gz + (D.z || 0.35) + rnd() * 0.35],
          [-Math.cos(moveH) * wash + sideX * (rnd() - 0.5) * 1.2, -Math.sin(moveH) * wash + sideY * (rnd() - 0.5) * 1.2, 0],
          D.rise || 0.55, dodgeDust ? (D.dodgeR0 || 3.0) : (D.r0 || 2.6), dodgeDust ? (D.dodgeR1 || 9.8) : (D.r1 || 8.8),
          dodgeDust ? (D.dodgeAlpha || 0.46) : (D.alpha || 0.42), dodgeDust ? (D.dodgeTtl || 1.1) : (D.ttl || 1.05), D.tint, rnd);
        off += modeSpacing;
      }
      tr.carry = L - (off - modeSpacing);
      tr.last[0] = p[0]; tr.last[1] = p[1]; tr.last[2] = gz;
    }
    for (const id in __smkDust) if (!dustLive[id]) delete __smkDust[id];
    for (const id in __smkTopple) if (!(__world.byId && __world.byId[id])) delete __smkTopple[id];
  }
  for (const b of (__world.bursts || [])) {        // BURST: a seeded rolling cloud at the detonation
    if (b.seq <= __smkSeen) continue;
    __smkSeen = b.seq;
    const rnd = __smkRng(0x50FF ^ Math.imul(b.seq + 1, 2654435761));
    const R = b.fxRadius || b.radius || 12;        // a death blast's fxRadius outsizes its shove (R34.1)
    const big = Math.min(2, Math.max(1, R / 12));  // bigger bursts roll MORE smoke, a touch longer-lived
    const n = Math.round(__SMK.burstCount * big);
    for (let i = 0; i < n; i++) {
      const az = rnd() * 6.283, up = 0.2 + rnd() * 0.8, sp = R * (0.5 + rnd() * 0.7);
      const horiz = Math.sqrt(Math.max(0, 1 - up * up));
      __smkSpawn([b.pos[0] + (rnd() - 0.5) * R * 0.3, b.pos[1] + (rnd() - 0.5) * R * 0.3, b.pos[2] + (rnd() - 0.5) * R * 0.25],
        [Math.cos(az) * sp * horiz, Math.sin(az) * sp * horiz, sp * up * 0.7], 1.6 + rnd() * 1.5,
        R * 0.22 + rnd() * 1.5, R * (0.55 + rnd() * 0.3), __SMK.alpha, (2.1 + rnd() * 1.5) * (0.8 + 0.2 * big), __SMK.burstTint, rnd,
        0.12 + (i / n) * 0.3 + rnd() * 0.12);
    }
  }
  for (const k of __smkPool) {                     // AGE: analytic per-frame update (no integration state)
    if (!k.live) continue;
    const age = (t - k.born - k.delay) / k.ttl;
    if (age >= 1) { k.live = false; k.s.visible = false; continue; }
    if (age < 0) { k.s.visible = false; continue; }   // burst puffs stagger in AFTER the fireball flash
    const tt = age * k.ttl, dec = (1 - Math.exp(-2.2 * tt)) / 2.2;   // thrown velocity decays — the puff coasts, then hangs
    k.s.position.set(k.p0[0] + k.vel[0] * dec, k.p0[1] + k.vel[1] * dec, k.p0[2] + k.vel[2] * dec + k.rise * tt);
    const r = k.r0 + (k.r1 - k.r0) * Math.pow(age, 0.55);            // fast early swell, slow late spread
    k.s.scale.set(r * 2, r * 2, 1);
    k.s.material.rotation = k.rot0 + k.spin * tt;
    k.s.material.opacity = k.a0 * (age < 0.14 ? age / 0.14 : Math.pow(1 - (age - 0.14) / 0.86, 1.25));
    k.s.visible = true;
  }
}`;
}

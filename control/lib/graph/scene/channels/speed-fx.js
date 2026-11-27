// In-page script (post-capture): THE SPEED'S LOOK, how fast a flown craft is going and when it is driven hard, read off
// the world round it as a pilot reads it. Opt-in: a flown level's `speedfx`; absent, not one byte of this is emitted.
//
//   air     SPEED LINES: thin streaks of air rushing past the camera on a tube round its line of sight, born far ahead
//           and gone behind it. At the craft's cruise a few, faint; boosted they lengthen, thicken in number and brighten
//           as the craft goes from its cruise to its boost; braked, they thin away
//   space   DUST: motes held still in space round the camera (a block of them that wraps as the camera moves, so there
//           are always some), each drawn as a streak along the way it is passed, as long as the craft's speed makes it.
//           Space has no wind, so it is the motes going by, and how fast, that say the speed: at cruise a drift of short
//           specks; turned hard the streaks lengthen and brighten; and they show which way the craft is turning
//
// The craft's speed is read off how it moves (its position over the world's clock), so it is the same cue for any rule
// that flies (the rail's boost and brake, a cockpit's throttle and its engines' power). `window.__mojSpeedFx` → { mode,
// speed, drive } (drive 0 at cruise, 1 at boost).
//
//   SPEED_FX                   the look's numbers
//   speedFxConfig(manifest, { space }) → { mode, base, turbo } | null   from a level's pilot: a rail stage (its speed, its
//                              boost), a cockpit (its top speed and its cruise); `space` (skyscape/airspace.js isSpace) its
//                              dust, else its air's lines
//   speedFxScript(cfg)         → the page's block

export const SPEED_FX = Object.freeze({
  // the air's streaks: how many, the tube round the line of sight (m), how far ahead they are born (m), their length per
  // m/s (and its least and most), their alpha at cruise and at boost
  air: Object.freeze({ n: 140, r: [6, 22], ahead: 160, len: [0.05, 2, 26], alpha: [0.1, 0.45] }),
  // space's motes: how many, the block they fill (half its side, m), their streak per m/s (least, most), their light at
  // rest, at cruise and at boost
  space: Object.freeze({ n: 900, half: 170, len: [0.035, 0.5, 18], light: [0.18, 0.4, 1] }),
});

/** A flown level's speed look, from its pilot: null when nothing in it flies. */
export function speedFxConfig(manifest, { space = false } = {}) {
  const P = (manifest?.entities || []).find((e) => e && e.pilotable && e.rule && (e.rule.type === 'rail' || e.rule.type === 'starfighter'));
  if (!P) return null;
  const r = P.rule;
  const r1 = (v) => Math.round(v * 10) / 10;
  if (r.type === 'rail') {
    const v = r.speed > 0 ? r.speed : 60;
    return { mode: space ? 'space' : 'air', base: r1(v), turbo: r1(v * (r.boost?.mul ?? 1.7)) };
  }
  // (a cockpit: its cruise its throttle's third, its turn hard its engines full on)
  const top = r.speed || 100;
  return { mode: space ? 'space' : 'air', base: r1(top / 3), turbo: r1(top * 1.1) };
}

/** The page's block: the speed lines or the dust, driven each frame by the pilot's speed. */
export function speedFxScript(cfg) {
  const A = SPEED_FX.air, S = SPEED_FX.space;
  return `
// --- the speed's look (scene/channels/speed-fx.js): ${cfg.mode === 'space' ? 'dust in space' : 'speed lines in the air'} ---
(function () {
  const CFG = ${JSON.stringify(cfg)}, A = ${JSON.stringify(A)}, S = ${JSON.stringify(S)};
  if (typeof THREE === 'undefined' || typeof scene === 'undefined' || typeof camera === 'undefined') return;
  let seed = 0x5eed1;
  const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const out = window.__mojSpeedFx = { mode: CFG.mode, speed: 0, drive: 0 };
  const space = CFG.mode === 'space', N = space ? S.n : A.n;
  const pos = new Float32Array(N * 6), col = new Float32Array(N * 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const lines = new THREE.LineSegments(geo, mat); lines.frustumCulled = false; lines.renderOrder = 5;
  // (the air's streaks ride with the camera, in its own frame; space's motes stand in the world)
  if (space) scene.add(lines); else { if (!camera.parent) scene.add(camera); camera.add(lines); }
  const st = [];
  for (let i = 0; i < N; i++) {
    if (space) st.push([(rnd() * 2 - 1) * S.half, (rnd() * 2 - 1) * S.half, (rnd() * 2 - 1) * S.half, 0.55 + 0.45 * rnd()]);
    else st.push({ a: rnd() * 6.2832, r: A.r[0] + (A.r[1] - A.r[0]) * Math.sqrt(rnd()), z: -A.ahead * rnd(), k: 0.6 + 0.4 * rnd(), on: rnd() });
  }
  let last = null, lastT = null, v = 0, dir = [1, 0, 0], drive = 0, prevT = performance.now();
  function step() {
    const now = performance.now(), dtR = Math.min(0.1, (now - prevT) / 1000); prevT = now;
    const C = window.__mojCtrl, W = C && C.world, P = W && W.pilotId && W.byId[W.pilotId];
    if (P && P.transform) {
      const p = P.transform.pos, t = W.time;
      if (last && t > lastT) {
        const dt = t - lastT, d = [p[0] - last[0], p[1] - last[1], p[2] - last[2]], m = Math.hypot(d[0], d[1], d[2]) / dt;
        // (a jump in place, a respawn or a teleport, is not speed)
        if (m < CFG.turbo * 3) { v += (m - v) * Math.min(1, dt * 6); if (m > 0.5) dir = [d[0] / (m * dt), d[1] / (m * dt), d[2] / (m * dt)]; }
      } else if (last && t === lastT) v *= 1 - Math.min(1, dtR * 2);
      last = p.slice(); lastT = t;
    }
    // (drive: 0 at cruise, 1 at the boost's speed; under cruise the look thins, braked it is nearly gone)
    const want = sm(CFG.base * 1.04, CFG.turbo, v); drive += (want - drive) * Math.min(1, dtR * 5);
    const slow = sm(CFG.base * 0.35, CFG.base * 0.95, v);
    out.speed = Math.round(v * 10) / 10; out.drive = Math.round(drive * 100) / 100;
    if (space) {
      const c = camera.position, h = S.half, L = Math.min(S.len[2], Math.max(S.len[1], v * S.len[0] * (1 + 1.4 * drive)));
      const lit = (S.light[0] + (S.light[1] - S.light[0]) * slow) + (S.light[2] - S.light[1]) * drive;
      for (let i = 0; i < N; i++) {
        const m = st[i];
        // (the mote's place in the block round the camera: its own place, wrapped)
        const x = c.x + ((((m[0] - c.x + h) % (2 * h)) + 2 * h) % (2 * h)) - h, y = c.y + ((((m[1] - c.y + h) % (2 * h)) + 2 * h) % (2 * h)) - h, z = c.z + ((((m[2] - c.z + h) % (2 * h)) + 2 * h) % (2 * h)) - h;
        const dd = Math.hypot(x - c.x, y - c.y, z - c.z), f = (1 - sm(h * 0.55, h, dd)) * sm(2, 10, dd) * m[3] * lit, o = i * 6;
        pos[o] = x; pos[o + 1] = y; pos[o + 2] = z; pos[o + 3] = x - dir[0] * L; pos[o + 4] = y - dir[1] * L; pos[o + 5] = z - dir[2] * L;
        col[o] = col[o + 1] = col[o + 2] = f * 0.9; col[o + 3] = col[o + 4] = col[o + 5] = f * 0.15;
      }
    } else {
      // (the air rushes past at a share of the craft's speed: the lines come toward the camera down its line of sight)
      const rush = v * 0.9, L = Math.min(A.len[2], Math.max(A.len[1], v * A.len[0] * (1 + 1.6 * drive)));
      const alpha = (A.alpha[0] * slow + (A.alpha[1] - A.alpha[0]) * drive), share = 0.35 + 0.65 * drive;
      for (let i = 0; i < N; i++) {
        const s = st[i];
        s.z += rush * dtR * s.k;
        if (s.z > 4) { s.z -= A.ahead + 4; s.a = rnd() * 6.2832; s.r = A.r[0] + (A.r[1] - A.r[0]) * Math.sqrt(rnd()); s.on = rnd(); }
        const x = Math.cos(s.a) * s.r, y = Math.sin(s.a) * s.r, o = i * 6;
        // (a share of them shown: more as the craft is driven harder; each brightest near the camera)
        const f = s.on < share ? alpha * sm(-A.ahead, -A.ahead * 0.4, s.z) * (1 - sm(-6, 3, s.z)) : 0;
        pos[o] = x; pos[o + 1] = y; pos[o + 2] = s.z; pos[o + 3] = x; pos[o + 4] = y; pos[o + 5] = s.z - L * s.k;
        col[o] = col[o + 1] = col[o + 2] = f; col[o + 3] = col[o + 4] = col[o + 5] = 0;
      }
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
})();
`;
}

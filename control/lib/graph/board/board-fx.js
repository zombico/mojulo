/**
 * EFFECTS IN THE WORLD — the board's special animations: a spell, a blow, a summon, played on the map itself, not cut
 * away to. An effect is a timeline of TRACKS; each track starts at its time, runs its seconds and is gone: the camera
 * (shake, orbit, a shot), the light (the world dimmed, a flash, a tint) and 3D pieces drawn into the world (a ring, a
 * rune circle, a pillar, an orb, sparks, shards, spikes, a bolt, a beam, a fall from the sky, a rising mist). Pieces are
 * additive, so they glow in a dimmed world, and every scatter in them is seeded: the same act, the same pieces.
 *
 *   PRESETS            { <id>: { land, tracks } }   land: when the effect's hit lands (the numbers wait for it)
 *   ELEMENT_FX         an element's effect (fire → flare, ice → frost, thunder → bolt, …)
 *   fxOf(skill)        → the effect a skill (or item) plays: its own `fx`, its element's, a mending's, a blow's
 *   create(env) → { play(id, ctx) → { land, dur } | null, step(dt), busy() → effects playing, pieces() → pieces standing, clear() }
 *     env: { THREE, root (the group pieces go in), scene (its lights dim), CAM, C (the board camera and its state) }
 *     ctx: { from: [x, y, z] (the actor's feet), at: [x, y, z] (where it is aimed), targets: [[x, y, z]], seed }
 *
 *   a track: { kind, t?: start s, dur, at?: 'targets' | 'at' | 'from' (where its pieces stand; each target its own),
 *              color?, …its own }
 *
 * SUMMONS (`being` tracks): a summoned being built in 3D from plain shapes and animated where it stands, behind the
 * place aimed at as the camera sees it: it rises out of a rune circle, acts and dissolves, while the world is dimmed, the
 * camera orbits the place and the map shakes as it strikes. BEINGS: inferno (a fire giant raining fire), glacier (an
 * ice colossus raising spikes), tempest (a storm crown calling bolts), colossus (a stone fist that quakes the ground),
 * wyrm (a serpent of light that circles, then breathes).
 *
 * The board kernel's discipline: one closure, `buildBoardFx()`, referencing nothing outside itself; the page runs it
 * from its source (scene/channels/board.js), handed THREE. Node tests the presets and the effect a skill plays.
 */

export function buildBoardFx() {
  const TAU = Math.PI * 2;
  function dice(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(s) {
    let h = 2166136261;
    const k = String(s);
    for (let i = 0; i < k.length; i++) { h ^= k.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const easeOut = (u) => 1 - (1 - u) * (1 - u);
  // in over the first share of a track, out over the last
  const envelope = (u, a, b) => clamp01(Math.min(u / (a || 0.15), (1 - u) / (b || 0.25)));

  const ELEMENT_FX = { fire: 'flare', ice: 'frost', thunder: 'bolt', dark: 'shade', light: 'radiance', poison: 'venom', earth: 'quake', wind: 'gale', water: 'frost' };
  const PRESETS = {
    hit: { land: 0.1, tracks: [
      { kind: 'sparks', t: 0.06, dur: 0.4, color: '#fff2c0', n: 12, speed: 3 },
      { kind: 'shake', t: 0.08, dur: 0.2, k: 0.12 },
    ] },
    strike: { land: 0.18, tracks: [
      { kind: 'ring', t: 0.1, dur: 0.35, color: '#fff2c0', r0: 0.2, r1: 1.2 },
      { kind: 'sparks', t: 0.12, dur: 0.5, color: '#ffd27a', n: 22, speed: 4 },
      { kind: 'shake', t: 0.14, dur: 0.3, k: 0.3 },
    ] },
    flare: { land: 0.5, tracks: [
      { kind: 'rune', at: 'at', dur: 1.0, color: '#ff8a3d', r: 1.1 },
      { kind: 'orb', t: 0.2, dur: 0.55, color: '#ff6a1a', r: 0.6 },
      { kind: 'pillar', t: 0.4, dur: 0.6, color: '#ff4d00', r: 0.5, h: 3.2 },
      { kind: 'sparks', t: 0.48, dur: 0.7, color: '#ffb04d', n: 28, speed: 4.5 },
      { kind: 'shake', t: 0.5, dur: 0.3, k: 0.25 },
    ] },
    frost: { land: 0.45, tracks: [
      { kind: 'ring', at: 'at', dur: 0.5, color: '#bfefff', r0: 0.2, r1: 2.2 },
      { kind: 'spikes', t: 0.3, dur: 1.0, color: '#a8e8ff', n: 7, h: 1.5 },
      { kind: 'shards', t: 0.45, dur: 0.8, color: '#e6fbff', n: 16, speed: 3.5 },
      { kind: 'shake', t: 0.45, dur: 0.25, k: 0.2 },
    ] },
    bolt: { land: 0.38, tracks: [
      { kind: 'dim', dur: 0.8, k: 0.45 },
      { kind: 'bolt', t: 0.25, dur: 0.45, color: '#dfe9ff', h: 9 },
      { kind: 'flash', t: 0.34, dur: 0.18, color: '#dfe9ff' },
      { kind: 'ring', t: 0.36, dur: 0.4, color: '#9fc2ff', r0: 0.2, r1: 1.6 },
      { kind: 'shake', t: 0.38, dur: 0.35, k: 0.4 },
    ] },
    shade: { land: 0.55, tracks: [
      { kind: 'orb', dur: 0.6, color: '#6a35a8', r: 1.1, implode: true },
      { kind: 'ring', t: 0.5, dur: 0.45, color: '#a070ff', r0: 0.1, r1: 1.4 },
      { kind: 'sparks', t: 0.52, dur: 0.6, color: '#c9a6ff', n: 18, speed: 2.5 },
    ] },
    radiance: { land: 0.45, tracks: [
      { kind: 'pillar', dur: 0.9, color: '#fff3b0', r: 0.65, h: 7 },
      { kind: 'ring', t: 0.4, dur: 0.5, color: '#ffe27a', r0: 0.2, r1: 1.8 },
      { kind: 'sparks', t: 0.42, dur: 0.7, color: '#fff7d6', n: 24, speed: 3 },
    ] },
    venom: { land: 0.35, tracks: [
      { kind: 'orb', dur: 0.5, color: '#5fd35a', r: 0.45 },
      { kind: 'sparks', t: 0.3, dur: 0.6, color: '#9cff7a', n: 14, speed: 2 },
    ] },
    gale: { land: 0.4, tracks: [
      { kind: 'ring', dur: 0.6, color: '#d8fff2', r0: 0.3, r1: 1.4 },
      { kind: 'rise', t: 0.1, dur: 0.8, color: '#e9fff8', n: 20, speed: 3 },
    ] },
    arcane: { land: 0.4, tracks: [
      { kind: 'rune', at: 'at', dur: 0.8, color: '#8fb4ff', r: 0.9 },
      { kind: 'orb', t: 0.2, dur: 0.5, color: '#6f9bff', r: 0.45 },
      { kind: 'sparks', t: 0.4, dur: 0.5, color: '#c7d8ff', n: 16, speed: 3 },
    ] },
    mend: { land: 0.35, tracks: [
      { kind: 'ring', dur: 0.7, color: '#7dffb0', r0: 0.3, r1: 0.9 },
      { kind: 'rise', dur: 1.0, color: '#b6ffd4', n: 22, speed: 1.6 },
    ] },
    aura: { land: 0.3, tracks: [
      { kind: 'rune', dur: 0.7, color: '#ffd23d', r: 0.6 },
      { kind: 'rise', t: 0.1, dur: 0.7, color: '#fff0a8', n: 12, speed: 1.4 },
    ] },
    // the summons: the world dimmed, the camera orbiting the place, the being risen behind it, its strike landing
    inferno: { land: 2.6, summon: true, tracks: [
      { kind: 'dim', dur: 4.6, k: 0.7 }, { kind: 'orbit', t: 0.2, dur: 4.0, rate: 0.35 }, { kind: 'shot', at: 'at', dur: 4.4, share: 0.55 },
      { kind: 'rune', at: 'at', dur: 4.4, color: '#ff8a3d', r: 2.6 },
      { kind: 'being', at: 'at', t: 0.3, dur: 4.1, being: 'inferno' },
      { kind: 'fall', t: 1.8, dur: 0.8, color: '#ffb04d', r: 0.55, from: 9 },
      { kind: 'pillar', t: 2.6, dur: 0.9, color: '#ff4d00', r: 0.7, h: 5 },
      { kind: 'sparks', t: 2.6, dur: 0.9, color: '#ffd27a', n: 40, speed: 6 },
      { kind: 'flash', t: 2.6, dur: 0.25, color: '#ffd8a0' }, { kind: 'shake', t: 2.6, dur: 0.9, k: 0.85 },
    ] },
    glacier: { land: 2.5, summon: true, tracks: [
      { kind: 'dim', dur: 4.6, k: 0.7 }, { kind: 'orbit', t: 0.2, dur: 4.0, rate: -0.35 }, { kind: 'shot', at: 'at', dur: 4.4, share: 0.55 },
      { kind: 'rune', at: 'at', dur: 4.4, color: '#bfefff', r: 2.6 },
      { kind: 'being', at: 'at', t: 0.3, dur: 4.1, being: 'glacier' },
      { kind: 'ring', at: 'at', t: 2.2, dur: 0.6, color: '#e6fbff', r0: 0.5, r1: 5 },
      { kind: 'spikes', t: 2.5, dur: 1.4, color: '#a8e8ff', n: 9, h: 2.6 },
      { kind: 'shards', t: 2.5, dur: 1.0, color: '#e6fbff', n: 24, speed: 5 },
      { kind: 'flash', t: 2.5, dur: 0.2, color: '#e6fbff' }, { kind: 'shake', t: 2.5, dur: 0.7, k: 0.7 },
    ] },
    tempest: { land: 2.3, summon: true, tracks: [
      { kind: 'dim', dur: 4.4, k: 0.8 }, { kind: 'orbit', t: 0.2, dur: 3.8, rate: 0.4 }, { kind: 'shot', at: 'at', dur: 4.2, share: 0.6, },
      { kind: 'rune', at: 'at', dur: 4.2, color: '#9fc2ff', r: 2.6 },
      { kind: 'being', at: 'at', t: 0.2, dur: 4.0, being: 'tempest', back: 0 },
      { kind: 'bolt', t: 2.0, dur: 0.35, color: '#dfe9ff', h: 8 }, { kind: 'bolt', t: 2.3, dur: 0.4, color: '#ffffff', h: 8 }, { kind: 'bolt', t: 2.7, dur: 0.4, color: '#dfe9ff', h: 8 },
      { kind: 'flash', t: 2.3, dur: 0.15, color: '#dfe9ff' }, { kind: 'flash', t: 2.7, dur: 0.15, color: '#ffffff' },
      { kind: 'ring', t: 2.3, dur: 0.5, color: '#9fc2ff', r0: 0.2, r1: 2.2 }, { kind: 'shake', t: 2.3, dur: 0.8, k: 0.8 },
    ] },
    colossus: { land: 2.3, summon: true, tracks: [
      { kind: 'dim', dur: 4.4, k: 0.6 }, { kind: 'orbit', t: 0.2, dur: 3.8, rate: 0.3 }, { kind: 'shot', at: 'at', dur: 4.2, share: 0.6 },
      { kind: 'rune', at: 'at', dur: 4.2, color: '#ffcf8a', r: 2.6 },
      { kind: 'being', at: 'at', t: 0.3, dur: 4.0, being: 'colossus', back: 2.4 },
      { kind: 'ring', at: 'at', t: 2.3, dur: 1.0, color: '#c9a27a', r0: 0.5, r1: 8 },
      { kind: 'shards', t: 2.3, dur: 1.2, color: '#8a6a4a', n: 30, speed: 6, solid: true },
      { kind: 'spikes', t: 2.35, dur: 1.2, color: '#c9a27a', n: 6, h: 1.6 },
      { kind: 'flash', t: 2.3, dur: 0.15, color: '#ffe0b0' }, { kind: 'shake', t: 2.3, dur: 1.2, k: 1 },
    ] },
    wyrm: { land: 2.9, summon: true, tracks: [
      { kind: 'dim', dur: 4.8, k: 0.75 }, { kind: 'orbit', t: 0.2, dur: 4.2, rate: -0.3 }, { kind: 'shot', at: 'at', dur: 4.6, share: 0.6 },
      { kind: 'rune', at: 'at', dur: 4.6, color: '#fff3b0', r: 2.8 },
      { kind: 'being', at: 'at', t: 0.2, dur: 4.4, being: 'wyrm', back: 0 },
      { kind: 'pillar', t: 2.7, dur: 1.1, color: '#fff7d6', r: 0.9, h: 8 },
      { kind: 'ring', t: 2.9, dur: 0.7, color: '#ffe27a', r0: 0.5, r1: 3 },
      { kind: 'sparks', t: 2.9, dur: 1.0, color: '#fff7d6', n: 40, speed: 5 },
      { kind: 'flash', t: 2.9, dur: 0.3, color: '#ffffff' }, { kind: 'shake', t: 2.9, dur: 0.9, k: 0.8 },
    ] },
    // for a scene to call on the bus (fx:quake, fx:meteor)
    quake: { land: 0.2, tracks: [
      { kind: 'shake', dur: 1.2, k: 0.9 },
      { kind: 'ring', at: 'at', dur: 0.9, color: '#c9a27a', r0: 0.5, r1: 6 },
      { kind: 'shards', at: 'at', dur: 1.1, color: '#8a6a4a', n: 26, speed: 5, solid: true },
    ] },
    meteor: { land: 0.8, tracks: [
      { kind: 'dim', dur: 1.6, k: 0.55 },
      { kind: 'fall', at: 'at', dur: 0.8, color: '#ff7a1a', r: 0.9, from: 18 },
      { kind: 'flash', t: 0.8, dur: 0.2, color: '#ffd8a0' },
      { kind: 'ring', at: 'at', t: 0.8, dur: 0.6, color: '#ffb04d', r0: 0.5, r1: 4.5 },
      { kind: 'shards', at: 'at', t: 0.8, dur: 1.0, color: '#ff8a3d', n: 30, speed: 6 },
      { kind: 'shake', t: 0.8, dur: 0.8, k: 0.85 },
    ] },
  };
  // the effect a skill or item plays: its own, its element's, a mending's or a blessing's, a blow's
  function fxOf(sk) {
    if (!sk) return null;
    if (sk.fx && PRESETS[sk.fx]) return sk.fx;
    if (sk.harm) return (sk.element && ELEMENT_FX[sk.element]) || (sk.status && sk.status.is === 'poison' ? 'venom' : sk.stat === 'atk' ? (sk.power >= 8 ? 'strike' : 'hit') : 'arcane');
    if (sk.heal || sk.revive || sk.mpGive || (sk.cure && sk.cure.length)) return 'mend';
    if (sk.buff || sk.status) return sk.status && sk.status.is === 'poison' ? 'venom' : 'aura';
    return null;
  }

  function create(env) {
    const THREE = env.THREE, root = env.root, CAM = env.CAM, C = env.C, scene = env.scene;
    const live = [];
    let n = 0;
    const add = (c) => ({ color: new THREE.Color(c || '#ffffff'), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    // a cylinder from a to b (its axis the unit y of three's, turned onto the way between them)
    const Y = new THREE.Vector3(0, 1, 0);
    function between(mesh, a, b, r) {
      const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length() || 1e-3;
      mesh.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
      mesh.quaternion.setFromUnitVectors(Y, d.normalize());
      mesh.scale.set(r, len, r);
    }

    // ── the pieces: each made at a point, stepped by its track's share u (0..1) and the frame's dt, then disposed ──
    const MAKE = {
      ring(tr, p) {
        const m = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 56), new THREE.MeshBasicMaterial(add(tr.color)));
        m.position.set(p[0], p[1], p[2] + 0.06);
        return { obj: m, step(u) { const s = (tr.r0 || 0.2) + ((tr.r1 || 1.5) - (tr.r0 || 0.2)) * easeOut(u); m.scale.set(s, s, 1); m.material.opacity = (1 - u) * 0.9; } };
      },
      rune(tr, p) {
        const g = new THREE.Group(), r = tr.r || 1, mat = new THREE.MeshBasicMaterial(add(tr.color));
        g.add(new THREE.Mesh(new THREE.RingGeometry(r * 0.94, r, 64), mat));
        g.add(new THREE.Mesh(new THREE.RingGeometry(r * 0.7, r * 0.74, 64), mat));
        // a six-pointed star inside, its strokes thin quads
        const pts = [];
        for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; pts.push([Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7]); }
        for (const [i, j] of [[0, 2], [2, 4], [4, 0], [1, 3], [3, 5], [5, 1]]) {
          const a = pts[i], b = pts[j], q = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.035), mat);
          q.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0);
          q.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]);
          q.scale.x = Math.hypot(b[0] - a[0], b[1] - a[1]);
          g.add(q);
        }
        g.position.set(p[0], p[1], p[2] + 0.07);
        return { obj: g, step(u, dt) { g.rotation.z += dt * 1.6; mat.opacity = envelope(u, 0.2, 0.3) * 0.85; const s = 0.6 + 0.4 * easeOut(clamp01(u * 3)); g.scale.set(s, s, 1); } };
      },
      pillar(tr, p) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 28, 1, true), new THREE.MeshBasicMaterial(add(tr.color)));
        const r = tr.r || 0.5, h = tr.h || 3;
        return { obj: m, step(u) { const hh = h * easeOut(clamp01(u * 2.5)); between(m, [p[0], p[1], p[2]], [p[0], p[1], p[2] + Math.max(0.01, hh)], r * (1 - 0.4 * u)); m.material.opacity = envelope(u, 0.1, 0.4) * 0.75; } };
      },
      orb(tr, p) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial(add(tr.color)));
        m.position.set(p[0], p[1], p[2] + 0.9);
        const r = tr.r || 0.5;
        return { obj: m, step(u) { const g = tr.implode ? 1 - easeOut(u) * 0.9 : easeOut(clamp01(u * 2)) * (1 + 0.08 * Math.sin(u * 40)); m.scale.setScalar(Math.max(0.01, r * g)); m.material.opacity = envelope(u, 0.15, 0.35) * 0.8; } };
      },
      sparks(tr, p, rnd) { return particles(tr, p, rnd, false); },
      rise(tr, p, rnd) { return particles(tr, p, rnd, true); },
      shards(tr, p, rnd) {
        const g = new THREE.Group(), geo = new THREE.TetrahedronGeometry(tr.solid ? 0.2 : 0.13), mat = new THREE.MeshBasicMaterial(add(tr.color)), bits = [];
        for (let k = 0; k < (tr.n || 14); k++) {
          const a = rnd() * TAU, up = 0.4 + rnd() * 0.8, s = (tr.speed || 3) * (0.5 + rnd() * 0.7), m = new THREE.Mesh(geo, mat);
          bits.push({ m, v: [Math.cos(a) * s, Math.sin(a) * s, up * s], spin: [rnd() * 8, rnd() * 8] });
          m.position.set(p[0], p[1], p[2] + 0.3);
          g.add(m);
        }
        return { obj: g, step(u, dt) {
          for (const b of bits) {
            b.v[2] -= 9.8 * dt;
            b.m.position.x += b.v[0] * dt; b.m.position.y += b.v[1] * dt; b.m.position.z = Math.max(p[2] + 0.05, b.m.position.z + b.v[2] * dt);
            b.m.rotation.x += b.spin[0] * dt; b.m.rotation.y += b.spin[1] * dt;
          }
          mat.opacity = 1 - u;
        } };
      },
      spikes(tr, p, rnd) {
        const g = new THREE.Group(), geo = new THREE.ConeGeometry(0.16, 1, 6), mat = new THREE.MeshBasicMaterial(add(tr.color)), bits = [];
        for (let k = 0; k < (tr.n || 6); k++) {
          const a = (k / (tr.n || 6)) * TAU + rnd() * 0.5, d = 0.25 + rnd() * 0.55, h = (tr.h || 1.4) * (0.6 + rnd() * 0.6), m = new THREE.Mesh(geo, mat);
          m.rotation.x = Math.PI / 2;
          m.rotation.y = (rnd() - 0.5) * 0.6;
          m.position.set(p[0] + Math.cos(a) * d, p[1] + Math.sin(a) * d, p[2]);
          bits.push({ m, h });
          g.add(m);
        }
        return { obj: g, step(u) {
          const up = easeOut(clamp01(u * 5)), down = clamp01((u - 0.7) / 0.3);
          for (const b of bits) { const s = Math.max(0.01, b.h * up * (1 - down)); b.m.scale.set(1, s, 1); b.m.position.z = p[2] + s / 2; }
          mat.opacity = 0.9 * (1 - down);
        } };
      },
      bolt(tr, p, rnd) {
        const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial(add(tr.color)), geo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true), segs = [];
        for (let k = 0; k < 9; k++) { const m = new THREE.Mesh(geo, mat); segs.push(m); g.add(m); }
        let next = 0;
        const zig = () => {
          const h = tr.h || 9, pts = [];
          for (let k = 0; k <= segs.length; k++) { const f = k / segs.length, j = k === 0 || k === segs.length ? 0 : 0.45; pts.push([p[0] + (rnd() - 0.5) * j, p[1] + (rnd() - 0.5) * j, p[2] + h * (1 - f)]); }
          segs.forEach((m, k) => between(m, pts[k], pts[k + 1], 0.06));
        };
        return { obj: g, step(u, dt) { next -= dt; if (next <= 0) { zig(); next = 0.06; } mat.opacity = u < 0.8 ? 0.95 : (1 - u) * 4.5; } };
      },
      beam(tr, p, rnd, ctx) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 16, 1, true), new THREE.MeshBasicMaterial(add(tr.color)));
        const a = [ctx.from[0], ctx.from[1], ctx.from[2] + 1.1], b = [p[0], p[1], p[2] + 0.9];
        return { obj: m, step(u) { between(m, a, b, (tr.r || 0.18) * (0.7 + 0.3 * Math.sin(u * 50))); m.material.opacity = envelope(u, 0.1, 0.3) * 0.85; } };
      },
      fall(tr, p) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial(add(tr.color)));
        const h = tr.from || 16, r = tr.r || 0.6, s = [p[0] - h * 0.25, p[1] - h * 0.25, p[2] + h];
        return { obj: m, step(u) { const f = u * u; m.position.set(s[0] + (p[0] - s[0]) * f, s[1] + (p[1] - s[1]) * f, s[2] + (p[2] + r - s[2]) * f); m.scale.setScalar(r * (0.7 + 0.3 * Math.sin(u * 30))); m.material.opacity = u > 0.95 ? (1 - u) * 20 : 0.95; } };
      },
    };
    // ── the summoned: each a group of plain shapes, glowing, stepped by its own share u of the track ─────────────────
    const BEINGS = {
      inferno(mat) {
        const g = new THREE.Group(), body = mat('#ff6a1a', 0.55), core = mat('#ffd27a', 0.7), horn = mat('#ffb04d', 0.8);
        const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), body); torso.scale.set(1.3, 0.9, 1.7); torso.position.z = 3.2;
        const heart = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), core); heart.position.z = 3.3;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), body); head.position.z = 5.3;
        const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.9, 8), horn), hornR = hornL.clone();
        hornL.position.set(0.35, 0, 5.85); hornL.rotation.y = -0.5; hornR.position.set(-0.35, 0, 5.85); hornR.rotation.y = 0.5;
        const flame = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.6, 18, 1, true), body); flame.rotation.x = -Math.PI / 2; flame.position.z = 1.1;
        const arm = (side) => { const a = new THREE.Group(), m = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 2.4, 10), body); m.position.y = -1.2; a.add(m); const fist = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), core); fist.position.y = -2.5; a.add(fist); a.position.set(side * 1.45, 0, 4.2); a.rotation.x = Math.PI / 2; a.rotation.y = side * 0.4; return a; };
        const L = arm(1), R = arm(-1);
        g.add(torso, heart, head, hornL, hornR, flame, L, R);
        return { g, step(u, t) { const lift = Math.min(1, u * 4); L.rotation.y = 0.4 + lift * 1.6 + Math.sin(t * 3) * 0.1; R.rotation.y = -0.4 - lift * 1.6 - Math.sin(t * 3) * 0.1; heart.scale.setScalar(1 + 0.15 * Math.sin(t * 9)); flame.scale.set(1 + 0.1 * Math.sin(t * 13), 1 + 0.15 * Math.sin(t * 11), 1); } };
      },
      glacier(mat) {
        const g = new THREE.Group(), ice = mat('#9fe4ff', 0.45), bright = mat('#e6fbff', 0.7), geo = new THREE.OctahedronGeometry(1, 0), bits = [];
        // a colossus of crystals: legs, a torso, shoulders, a crown
        const put = (x, y, z, sx, sy, sz, m) => { const c = new THREE.Mesh(geo, m || ice); c.position.set(x, y, z); c.scale.set(sx, sy, sz); g.add(c); bits.push(c); return c; };
        put(0.6, 0, 1.0, 0.45, 0.45, 1.1); put(-0.6, 0, 1.0, 0.45, 0.45, 1.1);
        put(0, 0, 3.0, 1.1, 0.8, 1.4); put(0, 0, 3.1, 0.5, 0.4, 0.7, bright);
        put(1.4, 0, 3.9, 0.6, 0.6, 0.9); put(-1.4, 0, 3.9, 0.6, 0.6, 0.9);
        put(1.6, 0, 2.6, 0.35, 0.35, 1.0); put(-1.6, 0, 2.6, 0.35, 0.35, 1.0);
        put(0, 0, 4.9, 0.45, 0.45, 0.6, bright); put(0.35, 0, 5.5, 0.12, 0.12, 0.5, bright); put(-0.35, 0, 5.5, 0.12, 0.12, 0.5, bright); put(0, 0, 5.7, 0.14, 0.14, 0.7, bright);
        return { g, step(u, t) { g.rotation.z = Math.sin(t * 0.8) * 0.25; bits.forEach((b, k) => { b.rotation.z = t * (0.3 + (k % 3) * 0.2); }); } };
      },
      tempest(mat) {
        const g = new THREE.Group(), cloud = mat('#5b6b8f', 0.35), glow = mat('#dfe9ff', 0.8), ring = new THREE.Group();
        for (let k = 0; k < 7; k++) { const c = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), cloud), a = (k / 7) * TAU; c.position.set(Math.cos(a) * 1.6, Math.sin(a) * 1.6, 8); c.scale.set(1.4, 1.4, 0.55); g.add(c); }
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), glow); eye.position.z = 7.6; g.add(eye);
        for (let k = 0; k < 8; k++) { const o = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), glow), a = (k / 8) * TAU; o.position.set(Math.cos(a) * 3, Math.sin(a) * 3, 7.4); ring.add(o); }
        g.add(ring);
        return { g, step(u, t) { ring.rotation.z = t * 2.2; eye.scale.setScalar(1 + 0.3 * Math.sin(t * 17)); } };
      },
      colossus(mat) {
        const g = new THREE.Group(), stone = mat('#c9a27a', 0.5), vein = mat('#ffcf8a', 0.75), arm = new THREE.Group();
        const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 4.5, 8), stone); fore.rotation.x = Math.PI / 2; fore.position.z = 2.25;
        const fist = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.0, 1.9), stone); fist.position.z = 5.2;
        for (let k = 0; k < 4; k++) { const n = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.6), vein); n.position.set(-0.9 + k * 0.6, -1.05, 5.6); arm.add(n); }
        const seam = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.1, 1.9), vein); seam.position.set(0, 0, 5.2);
        arm.add(fore, fist, seam);
        g.add(arm);
        // up out of the ground, raised high, then down on the place at the strike (the effect's land)
        return { g, step(u) { const up = Math.min(1, u * 3.5), slam = u < 0.45 ? 0 : Math.min(1, (u - 0.45) / 0.08); arm.rotation.y = -1.2 * up + 2.4 * slam * up; arm.position.x = -2.2 * slam; } };
      },
      wyrm(mat) {
        const g = new THREE.Group(), scale = mat('#fff3b0', 0.55), fire = mat('#ffffff', 0.85), segs = [];
        for (let k = 0; k < 18; k++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.55 - k * 0.022, 12, 10), k === 0 ? fire : scale); segs.push(m); g.add(m); }
        const jaw = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.1, 10), fire); g.add(jaw);
        // a helix round the place, closing in and rising, then hanging over it as it breathes
        return { g, step(u, t) {
          for (let k = 0; k < segs.length; k++) {
            const tt = t * 1.6 - k * 0.16, r = 5 - 2.2 * Math.min(1, u * 1.6);
            segs[k].position.set(Math.cos(tt) * r, Math.sin(tt) * r, 4 + Math.sin(tt * 2) * 0.8 + k * 0.05);
          }
          const h = segs[0].position, n = segs[1].position;
          jaw.position.copy(h); jaw.lookAt(n); jaw.rotateX(-Math.PI / 2);
        } };
      },
    };
    MAKE.being = function (tr, p) {
      const mats = [];
      const mat = (c, o) => { const m = new THREE.MeshBasicMaterial(add(c)); m.userData.o = o; mats.push(m); return m; };
      const B = BEINGS[tr.being](mat), yaw = C ? C.yaw : 0, back = tr.back != null ? tr.back : 3.2;
      // behind the place as the camera sees it, facing back at it
      B.g.position.set(p[0] + Math.cos(yaw) * back, p[1] + Math.sin(yaw) * back, p[2]);
      B.g.rotation.z = yaw + Math.PI / 2;
      let t = 0;
      return { obj: B.g, step(u, dt) {
        t += dt;
        // out of the ground and into being, its act, then dissolving upward
        const rise = easeOut(clamp01(u / 0.22)), fade = clamp01((u - 0.82) / 0.18);
        B.g.scale.setScalar(Math.max(0.01, 0.4 + 0.6 * rise));
        B.g.position.z = p[2] - 3 * (1 - rise) + 2 * fade;
        for (const m of mats) m.opacity = m.userData.o * rise * (1 - fade);
        B.step(u, t);
      } };
    };
    function particles(tr, p, rnd, rising) {
      const k = tr.n || 16, pos = new Float32Array(k * 3), vel = [];
      for (let i = 0; i < k; i++) {
        const a = rnd() * TAU, s = (tr.speed || 3) * (0.4 + rnd() * 0.8), e = rising ? 0.3 : 0.2 + rnd() * 0.9;
        vel.push(rising ? [Math.cos(a) * 0.3, Math.sin(a) * 0.3, s * (0.5 + rnd())] : [Math.cos(a) * s * (1 - e * 0.5), Math.sin(a) * s * (1 - e * 0.5), s * e]);
        pos[i * 3] = p[0] + (rising ? Math.cos(a) * 0.4 * rnd() : 0); pos[i * 3 + 1] = p[1] + (rising ? Math.sin(a) * 0.4 * rnd() : 0); pos[i * 3 + 2] = p[2] + (rising ? 0.1 : 0.8);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial(Object.assign(add(tr.color), { size: tr.size || 0.16, sizeAttenuation: true })));
      return { obj: pts, step(u, dt) {
        for (let i = 0; i < k; i++) {
          if (!rising) vel[i][2] -= 6 * dt;
          pos[i * 3] += vel[i][0] * dt; pos[i * 3 + 1] += vel[i][1] * dt; pos[i * 3 + 2] += vel[i][2] * dt;
        }
        geo.attributes.position.needsUpdate = true;
        pts.material.opacity = 1 - u;
      } };
    }

    // ── the light: dims gather (the darkest wins), the world's lights and sky eased to it and back ──────────────────
    const base = new Map();
    let sky = null;
    function light(f) {
      if (!scene) return;
      scene.traverse((o) => { if (o.isLight) { if (!base.has(o)) base.set(o, o.intensity); o.intensity = base.get(o) * f; } });
      if (scene.background && scene.background.isColor) { if (!sky) sky = scene.background.clone(); scene.background.copy(sky).multiplyScalar(f); }
      if (f >= 1) { base.clear(); sky = null; }
    }
    let flashEl = null;
    function flash(color, k) {
      if (typeof document === 'undefined') return;
      if (!flashEl) { flashEl = document.createElement('div'); flashEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:20;mix-blend-mode:screen;opacity:0'; document.body.appendChild(flashEl); }
      flashEl.style.background = color || '#ffffff';
      flashEl.style.opacity = String(k);
    }

    function play(id, ctx) {
      const P = PRESETS[id];
      if (!P) return null;
      const c = ctx || {}, at = c.at || c.from || [0, 0, 0];
      const E = { P, c: { from: c.from || at, at, targets: c.targets && c.targets.length ? c.targets : [at] }, t: 0, rnd: dice(hash((c.seed != null ? c.seed : 'fx') + ':' + id + ':' + n++)), tracks: P.tracks.map((tr) => ({ tr, on: false, off: false, pieces: [] })) };
      E.dur = Math.max.apply(null, P.tracks.map((tr) => (tr.t || 0) + tr.dur));
      live.push(E);
      return { land: P.land, dur: E.dur };
    }
    function start(E, T) {
      const tr = T.tr, pts = tr.at === 'at' ? [E.c.at] : tr.at === 'from' ? [E.c.from] : E.c.targets;
      if (tr.kind === 'shake') { if (CAM) CAM.shake(C, tr.k || 0.3, tr.dur); return; }
      if (tr.kind === 'orbit') { if (CAM) CAM.orbit(C, tr.rate || 0.6); return; }
      if (tr.kind === 'shot') { const p = pts[0]; if (CAM) CAM.shot(C, [p[0], p[1], p[2] + 1], { share: tr.share || 0.3, cut: !!tr.cut }); return; }
      if (tr.kind === 'dim' || tr.kind === 'flash') return;
      const make = MAKE[tr.kind];
      if (!make) return;
      for (const p of pts) { const piece = make(tr, p, E.rnd, E.c); root.add(piece.obj); T.pieces.push(piece); }
    }
    function stop(T) {
      if (T.tr.kind === 'orbit' && CAM) CAM.orbit(C, 0);
      if (T.tr.kind === 'shot' && CAM) CAM.unshot(C);
      for (const piece of T.pieces) {
        root.remove(piece.obj);
        piece.obj.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      }
      T.pieces = [];
    }
    function step(dt) {
      let dim = 1, fl = null;
      for (const E of live) {
        E.t += dt;
        for (const T of E.tracks) {
          const t0 = T.tr.t || 0, u = (E.t - t0) / T.tr.dur;
          if (!T.on && E.t >= t0) { T.on = true; start(E, T); }
          if (T.on && !T.off) {
            if (u >= 1) { T.off = true; stop(T); continue; }
            for (const piece of T.pieces) piece.step(clamp01(u), dt);
            if (T.tr.kind === 'dim') dim = Math.min(dim, 1 - (T.tr.k || 0.5) * envelope(clamp01(u), 0.2, 0.25));
            if (T.tr.kind === 'flash') fl = [T.tr.color, (1 - clamp01(u)) * 0.85];
          }
        }
      }
      for (let i = live.length - 1; i >= 0; i--) if (live[i].tracks.every((T) => T.off)) live.splice(i, 1);
      if (dim < 1 || base.size) light(dim);
      if (fl) flash(fl[0], fl[1]); else if (flashEl && flashEl.style.opacity !== '0') flashEl.style.opacity = '0';
    }
    function clear() {
      for (const E of live) for (const T of E.tracks) if (T.on && !T.off) { T.off = true; stop(T); }
      live.length = 0;
      if (base.size) light(1);
      if (flashEl) flashEl.style.opacity = '0';
    }
    return { play, step, clear, busy: () => live.length, pieces: () => live.reduce((m, E) => m + E.tracks.reduce((q, T) => q + T.pieces.length, 0), 0) };
  }

  return { PRESETS, ELEMENT_FX, fxOf, create, hash, dice };
}

const _fx = buildBoardFx();
export const BOARD_FX = _fx.PRESETS;
export const BOARD_ELEMENT_FX = _fx.ELEMENT_FX;
export const boardFxOf = _fx.fxOf;
export const boardFxCreate = _fx.create;

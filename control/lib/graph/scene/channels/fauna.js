import { safeJson } from '../emit-util.js';

// In-page script: a level's FIELD FAUNA (a biocube's `fauna`, era/biocube-fauna.js placeFauna): what lives there and is
// never in the way. Every kind is a closed form of the clock (window.__mojClock when a capture pins it), each animal's
// own numbers a hash of its index and the level's seed, so a pinned frame is the same frame every load. None collides,
// none is picked, none is a body, and none is footing (each opts out of raycasts: a ground probe passes through): the
// unit tier (a sheep that takes up room) is the entities', not this.
//   · GNATS: a cloud over each foot, its specks jittering fast round their places in a column that sways slowly. Dark
//     points in the world's soil, no glow.
//   · FIREFLIES: glowing specks drifting low round their homes, each blinking on its own beat over a faint ember: a hard
//     core and a soft halo of light round it (additive). The world's gold at its lightest.
//   · BUTTERFLIES: two wing cards each, beating, along a wandering loop round its home above the grass (a little over
//     life size, to read at a walk's distance), turned to where it goes. The world's gold, violet and fruit.
//   · BIRDS: a flock crossing high overhead every `every` s, a loose V, the wings beating and gliding by turns; between
//     passes the sky is empty. Each pass its own heading, its own height, its own count. The world's darkest rock.
//   · DUCKS: a little body, head and bill each, floating on a stream's water (its surface where the duck's home is),
//     paddling a slow loop that keeps inside the stream, bobbing, now and then tipping up tail-high to feed. Shaded in
//     their own colours by a fixed light, as a stage's baked faces are. The world's soil, foliage and gold.
//   · ROACHES and MICE (a room stage's): each along its room's wall line, still a while, then a dash to somewhere near
//     along the wall (a random place each turn of its own beat: it never strays far), turned the way it runs.
// Absent `fauna` (or a fauna with none of these) ⇒ NOT emitted.
// `cfg`: { seed, gnats?: { colour, per, clouds }, fireflies?: { colour, flies }, butterflies?: { colours, homes },
//          birds?: { colour, flock, every, height, centre, span }, ducks?: { colours: { body, head, bill }, ducks },
//          roaches?, mice?: { colour, size, runs } }
// `cast` (the live light's actor shadows, `shadows.actors`): the herds on the ground (ducks, roaches, mice) cast into the
// actors' map; swarms, butterflies and the high birds never do. Absent ⇒ the same bytes.
export function faunaScript(cfg, { cast = false } = {}) {
  return `
// --- fauna: the field's swarms and birds, a closed form of the clock ---
(function () {
  const F = ${safeJson(cfg)}, S = F.seed | 0, TAU = Math.PI * 2;
  const hh = (a, b) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(S, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const clock = () => (window.__mojClock != null ? window.__mojClock : performance.now()) / 1000;
  const steps = [];
  // (a colour of the world's ramps is sRGB, as the palette paints it)
  const rgb = (c) => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
  const speck = (hard) => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 32;
    const cx = cv.getContext('2d'), gr = cx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(hard ? 0.6 : 0.3, hard ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(cv);
  };
  const points = (n, mat) => {
    const g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const p = new THREE.Points(g, mat); p.frustumCulled = false; p.raycast = () => {}; scene.add(p);
    return { g, pos };
  };
  // a wing card hinged on the body's line (local +y forward, +x out along the wing), and its mirror
  const wing = (pts, side) => {
    const g = new THREE.BufferGeometry(), v = [];
    for (let k = 1; k + 1 < pts.length; k++) for (const q of [pts[0], pts[k], pts[k + 1]]) v.push(side * q[0], q[1], 0);
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
    return g;
  };
  const M4 = new THREE.Matrix4(), R = new THREE.Matrix4(), Q = new THREE.Matrix4();
  // a wing's matrix: at p, turned to the yaw, raised by the beat (side 1 the right wing, -1 the left)
  const pose = (m, i, p, yaw, beat, side) => { M4.makeTranslation(p[0], p[1], p[2]); R.makeRotationZ(yaw); Q.makeRotationY(-side * beat); M4.multiply(R).multiply(Q); m.setMatrixAt(i, M4); };

  if (F.gnats && F.gnats.clouds.length) {
    const G = F.gnats, per = G.per | 0, n = G.clouds.length * per;
    const mat = new THREE.PointsMaterial({ size: 0.035, map: speck(true), color: rgb(G.colour), sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false, fog: true });
    const P = points(n, mat), seat = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { const a = TAU * hh(i, 1), r = 0.4 * Math.sqrt(hh(i, 2)); seat[i * 4] = Math.cos(a) * r; seat[i * 4 + 1] = Math.sin(a) * r; seat[i * 4 + 2] = 0.7 + 1.3 * hh(i, 3); seat[i * 4 + 3] = TAU * hh(i, 4); }
    steps.push((t) => {
      for (let i = 0; i < n; i++) {
        const c = G.clouds[(i / per) | 0], ci = (i / per) | 0, ph = seat[i * 4 + 3], f = 3 + 4 * hh(i, 5);
        const sway = 0.25 * Math.sin(0.3 * t + ci * 1.7), j = 0.09;
        P.pos[i * 3] = c[0] + seat[i * 4] + sway + j * Math.sin(f * t + ph);
        P.pos[i * 3 + 1] = c[1] + seat[i * 4 + 1] + 0.6 * sway + j * Math.cos(f * 1.3 * t + ph * 1.9);
        P.pos[i * 3 + 2] = c[2] + seat[i * 4 + 2] + 0.12 * Math.sin(0.7 * t + ci) + j * 0.7 * Math.sin(f * 0.8 * t + ph * 2.7);
      }
      P.g.attributes.position.needsUpdate = true;
    });
  }

  if (F.fireflies && F.fireflies.flies.length) {
    const L = F.fireflies, n = L.flies.length, C = L.colour;
    // the light: a hard core and a soft halo round it, the same points drawn twice
    const lit = (size, hard, opacity) => new THREE.PointsMaterial({ size, map: speck(hard), vertexColors: true, sizeAttenuation: true, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const P = points(n, lit(0.2, true, 1)), col = new Float32Array(n * 3);
    P.g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const halo = new THREE.Points(P.g, lit(1.5, false, 0.6)); halo.frustumCulled = false; halo.raycast = () => {}; scene.add(halo);
    steps.push((t) => {
      for (let i = 0; i < n; i++) {
        const h = L.flies[i], r = 0.6 + hh(i, 11), s = 0.05 + 0.12 * hh(i, 12), ph = TAU * hh(i, 13);
        P.pos[i * 3] = h[0] + r * Math.sin(s * t * TAU + ph); P.pos[i * 3 + 1] = h[1] + r * Math.cos(s * 0.8 * t * TAU + ph * 1.3);
        P.pos[i * 3 + 2] = h[2] + 0.4 + 1.4 * hh(i, 14) + 0.3 * Math.sin(s * 0.6 * t * TAU + ph * 2.1);
        // the blink: a pulse on its own beat over an ember that never quite goes out
        const beat = 2.5 + 3.5 * hh(i, 15), b = 0.12 + 0.88 * Math.pow(Math.max(0, Math.sin(TAU * (t / beat + hh(i, 16)))), 3);
        col[i * 3] = C[0] * b; col[i * 3 + 1] = C[1] * b; col[i * 3 + 2] = C[2] * b;
      }
      P.g.attributes.position.needsUpdate = true; P.g.attributes.color.needsUpdate = true;
    });
  }

  if (F.butterflies && F.butterflies.homes.length) {
    const B = F.butterflies, n = B.homes.length, shape = [[0, 0.008], [0.055, 0.09], [0.115, 0.055], [0.09, -0.02], [0.065, -0.08], [0.02, -0.055]];
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, fog: true });
    const wr = new THREE.InstancedMesh(wing(shape, 1), mat, n), wl = new THREE.InstancedMesh(wing(shape, -1), mat, n);
    for (let i = 0; i < n; i++) { const k = rgb(B.colours[i % B.colours.length]); wr.setColorAt(i, k); wl.setColorAt(i, k); }
    for (const w of [wr, wl]) { w.frustumCulled = false; w.raycast = () => {}; scene.add(w); }
    const at = (i, t) => {
      const h = B.homes[i], R = 1.2 + 2.2 * hh(i, 21), a = 0.13 + 0.1 * hh(i, 22), ph = TAU * hh(i, 23);
      return [h[0] + R * Math.sin(a * t + ph) + 0.4 * R * Math.sin(2.3 * a * t + ph * 1.7), h[1] + R * Math.cos(0.8 * a * t + ph * 1.3),
        h[2] + 1.1 + 0.4 * Math.sin(0.9 * a * t + ph * 2.2) + 0.06 * Math.sin(6 * t + ph)];
    };
    steps.push((t) => {
      for (let i = 0; i < n; i++) {
        const p = at(i, t), q = at(i, t + 0.1), yaw = Math.atan2(q[1] - p[1], q[0] - p[0]) - Math.PI / 2;
        const beat = 0.15 + 1.1 * Math.abs(Math.sin(TAU * (6 + 3 * hh(i, 24)) * t + TAU * hh(i, 25)));
        pose(wr, i, p, yaw, beat, 1); pose(wl, i, p, yaw, beat, -1);
      }
      wr.instanceMatrix.needsUpdate = true; wl.instanceMatrix.needsUpdate = true;
    });
  }

  if (F.birds) {
    const D = F.birds, most = D.flock[1] | 0, speed = 11, cross = D.span / speed, shape = [[0, 0.12], [0.6, 0.02], [0.62, -0.06], [0, -0.14]];
    // (a silhouette against the sky: no haze over it)
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color: rgb(D.colour), fog: false });
    const wr = new THREE.InstancedMesh(wing(shape, 1), mat, most), wl = new THREE.InstancedMesh(wing(shape, -1), mat, most);
    for (const w of [wr, wl]) { w.frustumCulled = false; w.raycast = () => {}; w.count = 0; scene.add(w); }
    steps.push((t) => {
      // the pass under way: its heading, its count, its height and where it crosses, all its own
      const k = Math.floor(t / D.every), u = t - k * D.every;
      if (u > cross) { wr.count = wl.count = 0; return; }
      const th = TAU * hh(k, 31), dx = Math.cos(th), dy = Math.sin(th), n = D.flock[0] + Math.floor(hh(k, 32) * (D.flock[1] - D.flock[0] + 1));
      const z = D.centre[2] + D.height[0] + (D.height[1] - D.height[0]) * hh(k, 33), off = (hh(k, 34) - 0.5) * 0.3 * D.span, along = -D.span / 2 + speed * u;
      const yaw = th - Math.PI / 2;
      for (let i = 0; i < n; i++) {
        // the V: the leader first, then each rank back and out to either side, swaying a little
        const rank = Math.ceil(i / 2), side = i % 2 ? 1 : -1, back = 1.8 * rank + 0.3 * Math.sin(0.7 * t + i), out = side * 1.5 * rank + off;
        const p = [D.centre[0] + dx * (along - back) - dy * out, D.centre[1] + dy * (along - back) + dx * out, z + 0.3 * Math.sin(0.5 * t + i * 1.3)];
        const glide = Math.sin(0.45 * t + i * 0.9) > 0.35, beat = glide ? 0.08 : 0.55 * Math.sin(TAU * 3 * t + i * 0.7);
        pose(wr, i, p, yaw, beat, 1); pose(wl, i, p, yaw, beat, -1);
      }
      wr.count = wl.count = n; wr.instanceMatrix.needsUpdate = true; wl.instanceMatrix.needsUpdate = true;
    });
  }

  // a small solid of scaled spheres and boxes, shaded by a fixed light into its vertex colours (no light in the scene
  // reaches a basic material: a stage's light is baked)
  const solid = (parts) => {
    const pos = [], col = [], L = new THREE.Vector3(0.35, -0.45, 0.82).normalize(), n = new THREE.Vector3();
    for (const P of parts) {
      const g = (P.box ? new THREE.BoxGeometry(1, 1, 1) : new THREE.IcosahedronGeometry(1, 1)).toNonIndexed();
      g.scale(P.s[0], P.s[1], P.s[2]); g.translate(P.at[0], P.at[1], P.at[2]); g.computeVertexNormals();
      const a = g.attributes.position.array, nn = g.attributes.normal.array;
      for (let i = 0; i < a.length; i += 3) {
        pos.push(a[i], a[i + 1], a[i + 2]); n.set(nn[i], nn[i + 1], nn[i + 2]);
        const k = 0.58 + 0.42 * Math.max(0, n.dot(L)); col.push(P.c[0] * k, P.c[1] * k, P.c[2] * k);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    const lin = new THREE.Color(), c = new Float32Array(col.length);
    for (let i = 0; i < col.length; i += 3) { lin.setRGB(col[i], col[i + 1], col[i + 2], THREE.SRGBColorSpace); c[i] = lin.r; c[i + 1] = lin.g; c[i + 2] = lin.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return g;
  };
  const herd = (geom, n) => { const m = new THREE.InstancedMesh(geom, new THREE.MeshBasicMaterial({ vertexColors: true, fog: true }), n); m.frustumCulled = false; m.raycast = () => {};${cast ? ' m.castShadow = true;' : ''} scene.add(m); return m; };
  const Rx = new THREE.Matrix4();

  if (F.ducks && F.ducks.ducks.length) {
    const D = F.ducks, n = D.ducks.length, C = D.colours;
    const m = herd(solid([{ at: [0, 0, 0.05], s: [0.1, 0.17, 0.07], c: C.body }, { at: [0, -0.15, 0.08], s: [0.05, 0.06, 0.04], c: C.body },
      { at: [0, 0.14, 0.15], s: [0.05, 0.05, 0.05], c: C.head }, { box: true, at: [0, 0.205, 0.14], s: [0.035, 0.05, 0.016], c: C.bill }]), n);
    const at = (i, t) => {
      const h = D.ducks[i], a = 0.05 + 0.05 * hh(i, 41), ph = TAU * hh(i, 42), lim = 0.6 * h[4];
      return [h[0] + 1.8 * Math.sin(a * t + ph), h[3] + Math.max(-lim, Math.min(lim, h[1] - h[3] + 0.3 * h[4] * Math.sin(1.7 * a * t + ph * 1.3))), h[2] + 0.012 * Math.sin(2.2 * t + ph)];
    };
    steps.push((t) => {
      for (let i = 0; i < n; i++) {
        const p = at(i, t), q = at(i, t + 0.2), yaw = Math.atan2(q[1] - p[1], q[0] - p[0]) - Math.PI / 2;
        // dabbling: tail up a moment on its own beat
        const beat = 7 + 6 * hh(i, 43), u = ((t / beat + hh(i, 44)) % 1 + 1) % 1, tip = u < 0.14 ? Math.sin(Math.PI * u / 0.14) : 0;
        M4.makeTranslation(p[0], p[1], p[2]); R.makeRotationZ(yaw); Rx.makeRotationX(-1.2 * tip); M4.multiply(R).multiply(Rx); m.setMatrixAt(i, M4);
      }
      m.instanceMatrix.needsUpdate = true;
    });
  }

  for (const kind of ['roaches', 'mice']) {
    const K = F[kind]; if (!K || !K.runs.length) continue;
    const n = K.runs.length, s = K.size, c = K.colour, mouse = kind === 'mice', salt = mouse ? 60 : 50;
    const m = herd(solid(mouse
      ? [{ at: [0, 0, 0.45 * s], s: [0.24 * s, 0.5 * s, 0.22 * s], c }, { at: [0, 0.5 * s, 0.4 * s], s: [0.15 * s, 0.2 * s, 0.14 * s], c }, { box: true, at: [0, -0.95 * s, 0.12 * s], s: [0.04 * s, 0.9 * s, 0.04 * s], c }]
      : [{ at: [0, 0, 0.2 * s], s: [0.28 * s, 0.5 * s, 0.14 * s], c }]), n);
    // a place s along a room's wall line (its rectangle, counter-clockwise) → [x, y], and the way the line runs there
    const along = (r, v) => {
      const w = r[2] - r[0], h = r[3] - r[1], L = 2 * (w + h); let d = ((v % L) + L) % L;
      if (d < w) return [r[0] + d, r[1], 0]; d -= w;
      if (d < h) return [r[2], r[1] + d, Math.PI / 2]; d -= h;
      if (d < w) return [r[2] - d, r[3], Math.PI]; d -= w;
      return [r[0], r[3] - d, -Math.PI / 2];
    };
    steps.push((t) => {
      for (let i = 0; i < n; i++) {
        const r = K.runs[i], T = (mouse ? 3 : 2.2) + 3 * hh(i, salt), range = mouse ? 4 : 2.5, hold = mouse ? 0.55 : 0.65;
        const x = t / T + hh(i, salt + 1), k = Math.floor(x), u = x - k;
        const v = (j) => r[4] + (hh(i * 977 + j, salt + 2) - 0.5) * range;
        const a = v(k), b = v(k + 1), e = Math.max(0, Math.min(1, (u - hold) / (1 - hold))), go = e * e * (3 - 2 * e);
        const dir = Math.sign((u > hold ? b - a : a - v(k - 1)) || 1), P = along(r, a + (b - a) * go);
        M4.makeTranslation(P[0], P[1], r[5]); R.makeRotationZ(P[2] + (dir > 0 ? -Math.PI / 2 : Math.PI / 2)); M4.multiply(R); m.setMatrixAt(i, M4);
      }
      m.instanceMatrix.needsUpdate = true;
    });
  }

  if (!steps.length) return;
  (function tick() { const t = clock(); for (const s of steps) s(t); requestAnimationFrame(tick); })();
})();
`;
}

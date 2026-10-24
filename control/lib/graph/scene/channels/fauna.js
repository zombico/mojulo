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
// Absent `fauna` (or a fauna with none of these) ⇒ NOT emitted.
// `cfg`: { seed, gnats?: { colour, per, clouds }, fireflies?: { colour, flies }, butterflies?: { colours, homes },
//          birds?: { colour, flock, every, height, centre, span } }
export function faunaScript(cfg) {
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

  if (!steps.length) return;
  (function tick() { const t = clock(); for (const s of steps) s(t); requestAnimationFrame(tick); })();
})();
`;
}

import { onionPetals, spikeTips, auraBands } from '../../playscape/elements/aura.js';

/**
 * The page's side of an AURA (playscape/elements/aura.js: spirit onions and rings of spikes), shared by the channels
 * that draw one (the moment channel's blasts, the status channel's looks). An expression: each channel binds it to a name
 * of its own (`const __moAU = ${AURA_SRC};`), and the page builds it once (window.__mojAura).
 *
 *   make(A, rgb)                 the meshes: a flat petal per petal of every onion, a ring's spikes in one mesh each
 *   step(G, cc, t, k, show, a)   laid at t s round foot cc, grown to k (0..1), at opacity a: each petal shaded flat by how
 *                                it faces the eye (light, mid, shade), each spike a blade in the mid band, its core light
 *   drop(G)
 */
export const AURA_SRC = `(window.__mojAura || (window.__mojAura = (() => {
  const petals = ${onionPetals.toString()};
  const spikes = ${spikeTips.toString()};
  const bands = ${auraBands.toString()};
  const N = 10, mat = (m) => { m.userData.__fire = true; return m; };
  function make(A, rgb) {
    const B = bands(A.color || rgb), G = { A, B, onions: [], rings: [] };
    for (const O of A.onions) {
      const list = [];
      for (let j = 0; j < O.petals; j++) {
        const g = new THREE.BufferGeometry(), idx = [];
        for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 6), 3)); g.setIndex(idx);
        const m = new THREE.Mesh(g, mat(new THREE.MeshBasicMaterial({ color: new THREE.Color(B[1][0], B[1][1], B[1][2]), side: THREE.DoubleSide, transparent: true, depthWrite: false, opacity: 0.92 })));
        m.frustumCulled = false; m.raycast = function () {}; m.renderOrder = 6; m.visible = false; scene.add(m); list.push(m);
      }
      G.onions.push(list);
    }
    for (const S of A.spikes) {
      const g = new THREE.BufferGeometry(), col = new Float32Array(S.count * 18);
      for (let j = 0; j < S.count; j++) for (let v = 0; v < 6; v++) col.set(v < 3 ? B[1] : B[0], (j * 6 + v) * 3);
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(S.count * 18), 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const m = new THREE.Mesh(g, mat(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, depthWrite: false, opacity: 0.95 })));
      m.frustumCulled = false; m.raycast = function () {}; m.renderOrder = 7; m.visible = false; scene.add(m); G.rings.push(m);
    }
    return G;
  }
  const V = new THREE.Vector3(), D = new THREE.Vector3(), Sd = new THREE.Vector3();
  function step(G, cc, t, k, show, a) {
    const on = show && k > 0.01 && a > 0.01, ex = camera.position.x - cc[0], ey = camera.position.y - cc[1], el = Math.hypot(ex, ey) || 1;
    G.A.onions.forEach((O, oi) => {
      const ps = on ? petals(O, cc, t, k) : null;
      G.onions[oi].forEach((m, j) => {
        m.visible = on; if (!on) return;
        const P = ps[j], arr = m.geometry.attributes.position.array;
        for (let i = 0; i <= N; i++) arr.set([...P.L[i], ...P.R[i]], i * 6);
        m.geometry.attributes.position.needsUpdate = true;
        // flat cel bands by how the petal faces the eye: toward it light (and faint, so the body shows through the aura
        // round it), side-on the colour, away the shade (solid: the aura's silhouette behind the body)
        const d = (Math.cos(P.a) * ex + Math.sin(P.a) * ey) / el, c = d > 0.35 ? G.B[0] : d > -0.25 ? G.B[1] : G.B[2];
        m.material.color.setRGB(c[0], c[1], c[2]); m.material.opacity = (d > 0.35 ? 0.28 : d > -0.25 ? 0.8 : 0.95) * a;
      });
    });
    G.A.spikes.forEach((S, si) => {
      const m = G.rings[si]; m.visible = on; if (!on) return;
      const arr = m.geometry.attributes.position.array;
      spikes(S, cc, t, k).forEach((q, j) => {
        // a blade facing the eye: its base as wide as the ring says, its tip a point; a lighter core inside it
        D.set(q.tip[0] - q.b[0], q.tip[1] - q.b[1], q.tip[2] - q.b[2]); V.set(camera.position.x - q.b[0], camera.position.y - q.b[1], camera.position.z - q.b[2]);
        Sd.crossVectors(D, V).normalize().multiplyScalar((S.width * k) / 2);
        const b = q.b, tip = q.tip, mid = [b[0] + D.x * 0.75, b[1] + D.y * 0.75, b[2] + D.z * 0.75];
        arr.set([b[0] - Sd.x, b[1] - Sd.y, b[2] - Sd.z, b[0] + Sd.x, b[1] + Sd.y, b[2] + Sd.z, ...tip,
          b[0] - Sd.x * 0.4, b[1] - Sd.y * 0.4, b[2] - Sd.z * 0.4, b[0] + Sd.x * 0.4, b[1] + Sd.y * 0.4, b[2] + Sd.z * 0.4, ...mid], j * 18);
      });
      m.geometry.attributes.position.needsUpdate = true; m.material.opacity = 0.95 * a;
    });
  }
  function drop(G) { for (const m of [...G.onions.flat(), ...G.rings]) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); } }
  return { make, step, drop };
})()))`;

/**
 * versus fx (the World page's fight, its effects) — the cards of versus-fx.js drawn in the arena, in shaders (inlined
 * into the arena's block before versus-arena.client.js, never imported; the arena makes it under a register).
 *
 * Every part is a quad facing the camera in the lane's frame (x along the lane, z up, the camera at −y), drawn by one
 * shader that knows the parts by `uKind`: the white-hot CORE, a shock RING (or one snapping in), RAYS flung out, a
 * guard's shield ARC, a SHARD. The register's skin draws them its way: cel, hard bands round the white core and
 * on twos; material, a soft falloff and a glow round it standing in for bloom (the page has no bloom pass). A dark card
 * (a spark) is drawn over the picture, not added to it: black at its heart, its colour at its edge.
 * BOLTS are jagged ribbons, re-jagged every few frames so they crackle. The LIGHT is a real one at the contact for a
 * moment, so the blow lights the fighters by the rig they stand in. An IMPACT FRAME is a layer over the picture: a white
 * blink, or the picture turned negative (a blend of `difference`) for a spark's held moment.
 *
 * The FIGURE is coated, not drawn over (versus-arena.client.js bodyCoat: a fresnel rim on its own surface, the whole
 * figure or a portion of it): an ELEMENT's coat gathered round the limbs that carry it, flickering at its own rate and
 * flaring as the limb strikes; a BLOW's coat on the body it lands on, round where it landed or the whole figure, fading.
 *
 * The clock is the fight's: a part ages a frame a tick of the fight (its hitstop holds a spark at its peak, its slow
 * motion slows them all), so the effects flow with the play.
 *
 *   makeFightFx({ stage, skin, wrap, sparkStop }) → { onEvent(e, match, at?), tick(), draw(bodies, t) }
 *     bodies: per body { coat (its uniforms), points: { fistL, fistR, footL, footR } (lane-frame Vector3s), element,
 *     striking, toWorld }
 */

/* global THREE, FX_SKINS, FX_ELEMENTS, FX_LIMBS, fxCard, fxBolt */

// (the page's renderer keeps a logarithmic depth buffer: a part tested against the bodies writes its depth the same way)
const FX_VERT = '#include <common>\n#include <logdepthbuf_pars_vertex>\nvarying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n#include <logdepthbuf_vertex>\n}';
const FX_FRAG = `
#include <logdepthbuf_pars_fragment>
uniform float uT, uBands, uGlow, uSeed, uN, uKind, uDir, uTime, uDark, uOpacity;
uniform vec3 uColor, uTint, uEdge;
varying vec2 vUv;
float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float easeOut(float t) { return 1.0 - (1.0 - t) * (1.0 - t); }
void main() {
  #include <logdepthbuf_fragment>
  vec2 p = vUv - 0.5; float d = length(p) * 2.0, a = atan(p.y, p.x), I = 0.0, fade = 1.0 - uT;
  if (uKind < 0.5) {            // the core: white-hot, a glow round it (a dark core has none: it is drawn over the picture)
    I = (exp(-d * d * 7.0) + (uDark > 0.5 ? 0.0 : uGlow * 0.4 * exp(-d * d * 1.8))) * (1.0 - uT * uT);
  } else if (uKind < 1.5) {     // a ring thrown out (uDir < 0: snapping in)
    float r = (uDir < 0.0 ? 1.0 - easeOut(uT) : easeOut(uT)) * 0.92, w = mix(0.1, 0.02, uT);
    I = ((1.0 - smoothstep(0.0, w, abs(d - r))) + uGlow * 0.3 * (1.0 - smoothstep(0.0, w * 5.0, abs(d - r)))) * fade;
  } else if (uKind < 2.5) {     // rays flung out, each its own length
    float k = a / 6.2831853 * uN + uSeed, id = floor(k), L = 0.55 + 0.45 * h1(id + uSeed * 7.0);
    float line = 1.0 - smoothstep(0.0, 0.07 + 0.05 * (1.0 - d), abs(fract(k) - 0.5));
    float head = easeOut(uT) * L, tail = head - 0.4 * L * (1.0 - uT);
    I = line * smoothstep(tail, head, d) * step(d, head) * fade;
  } else if (uKind < 3.5) {     // a guard's shield: a bowed band facing the blow, striped, struck and fading
    vec2 c = vec2(uDir * 0.32, 0.0); float e = length(p - c), r = 0.4;
    float face = smoothstep(0.25, 0.65, dot(normalize(p - c + 1e-5), vec2(-uDir, 0.0)));
    float stripes = 0.6 + 0.4 * step(0.5, fract(p.y * 13.0 - uT * 3.0));
    I = ((1.0 - smoothstep(0.0, 0.05, abs(e - r))) * stripes + 0.3 * exp(-pow((e - r) / 0.1, 2.0))) * face * fade;
  } else {                      // a shard: a sliver of a pane, spinning off
    I = step(abs(p.x) * 2.2, 0.5 - p.y) * step(-0.5, p.y) * fade;
  }
  // (nothing reaches the quad's own edge: no part shows its square)
  I = clamp(I, 0.0, 1.0) * (1.0 - smoothstep(0.4, 0.5, max(abs(p.x), abs(p.y))));
  if (uBands > 0.5) I = floor(I * uBands + 0.3) / uBands;   // the cel's steps
  vec3 col;
  if (uDark > 0.5) {
    // drawn over the picture: black at the heart, the colour at the edge
    col = mix(uColor, uTint, smoothstep(0.25, 0.75, I));
    gl_FragColor = vec4(col, smoothstep(0.12, 0.6, I) * 0.9 * uOpacity);
  } else {
    col = mix(uEdge, uTint, smoothstep(0.0, 0.45, I));
    col = mix(col, uColor, smoothstep(0.55, 0.95, I));
    gl_FragColor = vec4(col, I * uOpacity);
  }
}`;
const FX_KIND = { core: 0, ring: 1, rays: 2, arc: 3, shard: 4 };

function makeFightFx({ stage, skin, wrap, sparkStop = 14 }) {
  const QUAD = new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2);   // in the lane's x–z plane, facing the camera
  const C = (hex) => new THREE.Color(hex);
  const pool = [], live = [], bolts = [], coats = [null, null], glow = [0, 0];
  // a quad of the shader, pooled (its material per quad: the uniforms are its own)
  function quad(kind, { color = '#ffffff', tint = '#ffffff', edge = null, dark = false, seed = 0, n = 0, dir = 1, depth = false } = {}) {
    let q = pool.pop();
    if (!q) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: FX_VERT, fragmentShader: FX_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { uT: { value: 0 }, uBands: { value: 0 }, uGlow: { value: 1 }, uSeed: { value: 0 }, uN: { value: 0 }, uKind: { value: 0 }, uDir: { value: 1 }, uTime: { value: 0 }, uDark: { value: 0 }, uOpacity: { value: 1 }, uColor: { value: new THREE.Color() }, uTint: { value: new THREE.Color() }, uEdge: { value: new THREE.Color() } },
      });
      q = new THREE.Mesh(QUAD, mat); q.frustumCulled = false; q.renderOrder = 9;
    }
    const u = q.material.uniforms;
    u.uKind.value = FX_KIND[kind]; u.uBands.value = skin.bands; u.uGlow.value = skin.glow; u.uSeed.value = seed; u.uN.value = n; u.uDir.value = dir;
    u.uDark.value = dark ? 1 : 0; u.uOpacity.value = 1; u.uT.value = 0;
    u.uColor.value.set(color); u.uTint.value.set(tint); u.uEdge.value.set(edge ?? tint);
    q.material.blending = dark ? THREE.NormalBlending : THREE.AdditiveBlending;
    q.material.depthTest = depth;
    q.visible = true; q.rotation.set(0, 0, 0); q.scale.set(1, 1, 1);
    stage.add(q);
    return q;
  }
  const free = (q) => { q.visible = false; stage.remove(q); pool.push(q); };

  // THE BOLTS: jagged ribbons (two passes: a fat edge, a thin core), re-jagged every few frames
  function ribbon() {
    const N = 12, geo = new THREE.BufferGeometry(), pos = new Float32Array((N + 1) * 2 * 3), idx = [];
    for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setIndex(idx); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 10;
    stage.add(m);
    return { m, N, pos };
  }
  const RIB = [];
  function lay(r, pts, y, w) {
    for (let i = 0; i <= r.N; i++) {
      // (a bolt of fewer points than the ribbon: the rest of the ribbon folds onto its last point)
      const last = pts.length - 1, at = (j) => pts[Math.max(0, Math.min(j, last))];
      const P = at(i), Q = at(i + 1), R0 = at(i - 1);
      const dx = Q[0] - R0[0], dz = Q[1] - R0[1], L = Math.hypot(dx, dz) || 1, nx = -dz / L * w, nz = dx / L * w, o = i * 6;
      r.pos[o] = P[0] + nx; r.pos[o + 1] = y; r.pos[o + 2] = P[1] + nz;
      r.pos[o + 3] = P[0] - nx; r.pos[o + 4] = y; r.pos[o + 5] = P[1] - nz;
    }
    r.m.geometry.attributes.position.needsUpdate = true;
  }
  let ribTop = 0;
  const ribbons = () => { if (ribTop >= RIB.length) RIB.push(ribbon()); return RIB[ribTop++]; };

  // THE LIGHT: two real lights at contacts, kept in the scene at none (a light added or taken recompiles every lit body)
  const LIGHTS = [0, 1].map(() => { const L = new THREE.PointLight(0xffffff, 0, 4.5, 2); stage.add(L); return { L, age: 0, life: 1, power: 0 }; });
  let nextLight = 0;
  function flash(at, power, life, color) {
    const s = LIGHTS[nextLight]; nextLight = (nextLight + 1) % LIGHTS.length;
    s.L.color.set(color); s.L.position.set(at[0], -0.45, at[1]); s.power = power; s.life = life; s.age = 0;
  }

  // THE IMPACT FRAMES: a white blink over the picture, and the picture turned negative
  const layer = (blend, bg) => { const el = document.createElement('div'); el.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:5;opacity:0;background:${bg};mix-blend-mode:${blend}`; wrap.appendChild(el); return el; };
  const BLINK = layer('screen', '#ffffff'), NEGATIVE = layer('difference', '#ffffff');
  let blink = 0, negative = 0;

  // an effect from a card: its parts, aged by the fight's ticks (a held one waits at its peak)
  function onEvent(e, match, at) {
    const card = fxCard(at ? { ...e, at } : e, e.p !== undefined && match.ctx.fighters[e.p] ? match.ctx.fighters[e.p].element ?? null : null);
    if (!card) return;
    const x = card.at[0] / 1000, z = card.at[1] / 1000, dir = match.s.p[e.p] ? match.s.p[e.p].face : 1, seed = (match.s.f % 97) + 1;
    const parts = [];
    const add = (kind, size, life, o = {}) => { const q = quad(kind, { color: card.color, tint: card.tint, dark: !!card.dark && kind !== 'rays' && kind !== 'ring', seed, dir: -dir, ...o }); q.position.set(x, -0.3, z); q.scale.set(size, 1, size); parts.push({ q, life, age: 0, size, ...(o.spin ? { spin: o.spin, vx: o.vx, vz: o.vz } : {}) }); };
    if (card.core) add('core', card.core.size * 2, card.core.life);
    if (card.ring) { add('ring', card.ring.size * 2, card.ring.life, card.ring.in ? { dir: -1 } : { dir: 1 }); if (card.ring.double) add('ring', card.ring.size * 1.4, card.ring.life + 4, { dir: 1 }); }
    if (card.rays) add('rays', card.rays.length * 2, card.rays.life, { n: card.rays.n });
    // (the shield bows toward the blow: its centre on the guarding side)
    if (card.arc) add('arc', card.arc.size * 2, card.arc.life, { dir, color: card.color, tint: card.tint });
    if (card.shards) for (let i = 0; i < card.shards.n; i++) {
      const ang = (i / card.shards.n) * Math.PI * 2 + seed, sp = 0.04 + 0.03 * ((i * 7) % 5) / 5;
      add('shard', card.shards.size, card.shards.life, { spin: (i % 2 ? 1 : -1) * 0.3, vx: Math.cos(ang) * sp, vz: Math.sin(ang) * sp + 0.02 });
    }
    // (the body it lands on coated, round where it landed or whole; held with the moment)
    // (an event names its striker, but a KO names the fallen and a parry the one who parried: theirs is the coat)
    const on = e.t === 'ko' || e.t === 'parry' ? e.p : 1 - e.p;
    if (card.coat && match.s.p[on]) coats[on] = { ...card.coat, at: [x, z], age: 0, hold: card.hold === 'stop' ? sparkStop : 0 };
    // (a card that holds waits at its peak through the fight's held moment: a spark's)
    const hold = card.hold === 'stop' ? sparkStop : 0;
    live.push({ parts, hold, age: 0 });
    if (card.bolts) bolts.push({ x, z, card: card.bolts, age: 0, life: card.bolts.life + hold, hold, seed });
    if (card.light) flash(card.at.map((v) => v / 1000), card.light.power, card.light.life + hold, card.light.color ?? card.tint);
    if (card.frame) { if (card.frame.kind === 'invert') negative = card.frame.n; else blink = Math.max(blink, card.frame.n); }
  }

  // a tick of the fight
  let clock = 0;
  function tick() {
    clock++;
    for (let i = live.length - 1; i >= 0; i--) {
      const E = live[i];
      E.age++;
      let done = true;
      for (const P of E.parts) {
        // (held at a sliver of its life while the moment holds, then it goes on)
        const age = Math.max(0, E.age - E.hold) + (E.hold && E.age <= E.hold ? Math.min(2, E.age) : 0);
        P.age = skin.twos ? age - (age % 2) : age;
        if (P.age < P.life) done = false;
      }
      if (done) { for (const P of E.parts) free(P.q); live.splice(i, 1); }
    }
    for (let i = bolts.length - 1; i >= 0; i--) if (++bolts[i].age >= bolts[i].life) bolts.splice(i, 1);
    for (const S of LIGHTS) S.age++;
    for (const c of coats) if (c) c.age++;
    if (blink > 0) blink--;
    if (negative > 0) negative--;
  }

  function draw(limbs, t) {
    ribTop = 0;
    for (const E of live) for (const P of E.parts) {
      const u = Math.min(1, P.age / P.life), U = P.q.material.uniforms;
      U.uT.value = u; U.uTime.value = t;
      if (P.spin !== undefined) { P.q.position.x += P.vx; P.q.position.z += P.vz; P.vz -= 0.003; P.q.rotation.y += P.spin; }
      // (a core swells as it strikes, then shrinks; the others hold their size and draw their own growth)
      if (U.uKind.value === 0) { const s = P.size * (0.6 + 0.6 * Math.min(1, u * 4)); P.q.scale.set(s, 1, s); }
    }
    // bolts: jagged, re-jagged every three frames (the spark's black ones crackle through its held moment)
    for (const B of bolts) {
      const live01 = 1 - Math.max(0, B.age - B.hold) / Math.max(1, B.life - B.hold), jag = Math.floor(B.age / 3);
      for (let k = 0; k < B.card.n; k++) {
        const ang = (k / B.card.n) * Math.PI * 2 + B.seed * 0.37 + jag * 0.21, reach = B.card.reach * (0.55 + 0.45 * Math.sin(k * 2.3 + jag));
        const pts = fxBolt(B.seed * 31 + k * 7 + jag * 101, [B.x, B.z], [B.x + Math.cos(ang) * reach, B.z + Math.sin(ang) * reach], 12, 0.22);
        const edge = ribbons(), core = ribbons();
        lay(edge, pts, -0.32, 0.022 * live01 + 0.004); lay(core, pts, -0.33, 0.008 * live01 + 0.002);
        edge.m.material.color.set(B.card.edge); edge.m.material.opacity = live01; edge.m.material.blending = THREE.AdditiveBlending;
        core.m.material.color.set(B.card.color); core.m.material.opacity = live01; core.m.material.blending = THREE.NormalBlending;
      }
    }
    // THE COATS: each body's element round the limbs that carry it (flaring as one strikes), and the last blow's on it
    limbs.forEach((L, i) => {
      if (!L || !L.coat) return;
      const U = L.coat;
      U.uCoatTime.value = t;
      const El = L.element && FX_ELEMENTS[L.element.kind];
      if (El) {
        const keys = FX_LIMBS[L.element.on], pts = Object.entries(L.points).filter(([name, P]) => P && keys.some((k) => name.startsWith(k)));
        glow[i] += ((L.striking && keys.some((k) => L.striking.startsWith(k)) ? El.strike : El.rest) - glow[i]) * 0.35;
        U.uElCol.value.set(El.rim); U.uElK.value = glow[i]; U.uElHz.value = El.flicker; U.uElDark.value = El.dark ? 1 : 0;
        // (the striking limb's reach grows with its flare)
        U.uElReach.value = El.reach * (0.8 + 0.35 * glow[i] / El.strike);
        for (let k = 0; k < 4; k++) { const P = pts[k] && pts[k][1]; if (P) U.uElPts.value[k].copy(L.toWorld(P)); else U.uElPts.value[k].set(0, 0, -99); }
      } else U.uElK.value = 0;
      const c = coats[i];
      if (c && c.age < c.life + c.hold) {
        const u = Math.max(0, c.age - c.hold) / c.life;
        U.uHitCol.value.set(c.color); U.uHitK.value = c.k * (1 - u) ** 1.4; U.uHitReach.value = c.reach; U.uHitDark.value = c.dark ? 1 : 0;
        U.uHitAt.value.copy(L.toWorld(new THREE.Vector3(c.at[0], 0, c.at[1])));
      } else U.uHitK.value = 0;
    });
    for (let i = ribTop; i < RIB.length; i++) RIB[i].m.visible = false;
    for (let i = 0; i < ribTop; i++) RIB[i].m.visible = true;
    for (const S of LIGHTS) S.L.intensity = S.age < S.life ? S.power * 5 * (1 - S.age / S.life) ** 1.5 : 0;
    BLINK.style.opacity = blink > 0 ? String(0.14 * blink) : '0';
    NEGATIVE.style.opacity = negative > 0 ? '1' : '0';
  }
  return { onEvent, tick, draw };
}

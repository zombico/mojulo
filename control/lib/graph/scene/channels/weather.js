import { safeJson } from '../emit-util.js';
import { STATES, FALL_BOX, IMPACT_LIFE, dice, draw, weatherAt, blendState, fallCount, fallPoints, impactPoints, impactCount, flashesIn } from '../../weather/weather.js';
import { GLYPHS_SRC } from './moment-channel.js';

// In-page script: the WORLD's WEATHER (opt-in `weather`: weather/weather.js). The sky's schedule is the module's own
// (weatherAt: one source, node and page), read off the world clock (window.__mojClock when a capture pins it), so the
// same seed is the same sky at every moment and a scrubbed frame needs no history.
//   · the air: scene.fog's density is the kit's own times the state's fog factor, its colour scaled by the state's veil
//     (the style's fog colour stays the hue; the weather only chooses its value); the background follows the fog.
//   · the light: a fixed overlay over the canvas (black for the light the state takes off, white for a flash); the
//     baked colours are never touched.
//   · the fall: one pool a state, fixed size, in a box the camera carries (fallPoints): rain as line segments that lean
//     with the wind, the rest as points in their glyph; a state in a blend shows its share of its pool. Landings
//     (impactPoints) are two instanced meshes (rings, discs) on the ground under the camera.
//   · lightning: a sheet flash lifts the fog and the overlay (flashesIn: a pure function of the clock).
// Absent `weather` ⇒ NOT emitted. `cfg`: { weather: a read weather, seed, fog?: { color, density }, radius, ground? }.
// window.__mojWeather = { W, seed, at(t) } is the page's probe (and the bus's, for a forced state).
// (fallCount and impactCount are arrows: named here; the rest are declarations that carry their names)
const LIB = [dice, draw, weatherAt, blendState, fallPoints, impactPoints, flashesIn].map((f) => f.toString()).concat(`const fallCount = ${fallCount.toString()};`, `const impactCount = ${impactCount.toString()};`).join('\n');

/** The states a weather can show: its climate's, its start, and any a cue forces (`extra`). */
export const weatherStates = (W, extra = []) => [...new Set([...Object.keys(W.climate), ...(W.start ? [W.start] : []), ...extra])];
/** The states a world's cues force (their lowered reactions set the weather var), in first-named order. */
export const weatherForces = (events) => [...new Set(((events && events.reactions) || []).filter((r) => r && r.do === 'set' && r.var === 'weather-force' && typeof r.to === 'string' && STATES[r.to]).map((r) => r.to))];

export function weatherScript(cfg) {
  const names = weatherStates(cfg.weather, cfg.forces), states = Object.fromEntries(names.map((n) => [n, STATES[n]]));
  return `
// --- weather: the world's sky, from its climate (weather/weather.js) ---
(function () {
  const CFG = ${safeJson(cfg)}, W = CFG.weather, SEED = CFG.seed, STATES = ${safeJson(states)};
  const FALL_BOX = ${safeJson(FALL_BOX)}, IMPACT_LIFE = ${safeJson(IMPACT_LIFE)};
  const r4 = (v) => Math.round(v * 1e4) / 1e4, smooth = (u) => u * u * (3 - 2 * u), lerp = (a, b, u) => a + (b - a) * u;
  ${LIB.replace(/\n/g, '\n  ')}
  const G = ${GLYPHS_SRC};
  const clock = () => (window.__mojClock != null ? window.__mojClock : performance.now()) / 1000;
  const at = (t) => { const a = weatherAt(W, SEED, t); return { ...a, state: blendState(STATES[a.is], STATES[a.next], a.mix) }; };
  // a look: the blended state and each pool's share of it. The schedule's at t; a forced state's; one look eased into
  // another (a cue forcing a state eases in from what was showing, and out again to the schedule where its clock is)
  const lookAt = (t) => { const a = at(t), sh = {}; sh[a.is] = 1 - a.mix; if (a.next !== a.is) sh[a.next] = a.mix; return { S: a.state, sh, is: a.is, next: a.next, mix: a.mix }; };
  const lookOf = (n) => ({ S: blendState(STATES[n], STATES[n], 0), sh: { [n]: 1 } });
  const ease = (A, B, u) => {
    const sh = {}; for (const k of Object.keys(A.sh)) sh[k] = (sh[k] || 0) + A.sh[k] * (1 - u); for (const k of Object.keys(B.sh)) sh[k] = (sh[k] || 0) + B.sh[k] * u;
    return { S: blendState(A.S, B.S, u), sh };
  };
  let last = lookAt(0), forced = null, freed = null, was = '';
  const busVar = (k) => { const b = window.__mojBus; return b && b.state && b.state.vars ? b.state.vars[k] : undefined; };
  function look(t) {
    // the bus's word: the state forced (a cue's weather effect) and how long the change takes
    const f = busVar('weather-force') || '', bl = busVar('weather-blend');
    if (f !== was) {
      const len = Number.isFinite(bl) && bl >= 0 ? bl : W.blend;
      if (f) { forced = { n: f, t0: t, from: last, len }; freed = null; }
      else if (forced) { freed = { t0: t, from: last, len: forced.len }; forced = null; }
      was = f;
    }
    let L;
    if (forced) L = ease(forced.from, lookOf(forced.n), forced.len > 0 ? smooth(Math.min(1, Math.max(0, (t - forced.t0) / forced.len))) : 1);
    else if (freed) { const u = freed.len > 0 ? (t - freed.t0) / freed.len : 1; if (u >= 1) { freed = null; L = lookAt(t); } else L = ease(freed.from, lookAt(t), smooth(Math.max(0, u))); }
    else L = lookAt(t);
    last = L; return L;
  }
  window.__mojWeather = { W, seed: SEED, at, look, cur: () => last, states: STATES, clock, flashes: (fl, t0, t1) => flashesIn(fl, SEED, t0, t1) };

  // the air: the kit's own fog (or one sized to the world), thickened and thinned
  const dark = (o) => { if (o.renderOrder < 0 && o.material) o.material.fog = false; };
  let fog = scene.fog;
  const baseColor = fog ? fog.color.clone() : new THREE.Color(CFG.fog ? CFG.fog.color : '#aab4c0');
  const baseDensity = fog ? fog.density : (CFG.fog ? CFG.fog.density : 1.2 / Math.max(10, CFG.radius || 40));
  if (!fog) { fog = scene.fog = new THREE.FogExp2(baseColor.clone(), baseDensity); scene.traverse(dark); }
  const CLEAR_VEIL = 0.75, tint = new THREE.Color(), white = new THREE.Color(1, 1, 1);

  // the light: an overlay above the canvas
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:1;opacity:0;background:#000';
  document.body.appendChild(ov);

  // the fall: a pool for each state that has one
  const camP = [0, 0, 0], heading = dice(SEED, 0, 99) * 6.283185307179586;
  const spot = (F) => { const c = new THREE.Color(baseColor); const v = F.value; return [c.r * 0.35 + v * 0.65, c.g * 0.35 + v * 0.65, c.b * 0.35 + v * 0.65]; };
  const pools = {};
  for (const n of Object.keys(STATES)) {
    const F = STATES[n].fall; if (!F) continue;
    const count = fallCount(F), streak = F.glyph === 'streak', g = G[F.glyph === 'petal' ? 'leaf' : F.glyph] || G.soft;
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(count * (streak ? 6 : 3)), col = new Float32Array(count * (streak ? 8 : 4));
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
    const rgb = spot(F), mat = streak
      ? new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false })
      : new THREE.PointsMaterial({ map: g.tex, size: Math.max(0.05, F.size * 3), sizeAttenuation: true, vertexColors: true, transparent: true, depthWrite: false, alphaTest: 0.01 });
    const o = streak ? new THREE.LineSegments(geo, mat) : new THREE.Points(geo, mat);
    o.frustumCulled = false; o.visible = false; o.raycast = function () {}; scene.add(o);
    pools[n] = { F, count, streak, o, pos, col, rgb, geo };
  }
  const camV = new THREE.Vector3();
  function fall(name, k, t) {
    const P = pools[name]; if (!P) return;
    const n = Math.min(P.count, Math.round(P.count * k));
    P.o.visible = n > 0; if (!n) return;
    const pts = fallPoints(P.F, camP, t, n, heading), a = P.F.length ? 1 : 0, op = P.streak ? 0.5 : 0.85;
    let i = 0;
    for (const q of pts) {
      const w = q.w * op;
      if (P.streak) {
        const sp = Math.hypot(q.v[0], q.v[1], q.v[2]) || 1, l = q.len;
        P.pos[i * 6] = q.p[0]; P.pos[i * 6 + 1] = q.p[1]; P.pos[i * 6 + 2] = q.p[2];
        P.pos[i * 6 + 3] = q.p[0] - q.v[0] / sp * l; P.pos[i * 6 + 4] = q.p[1] - q.v[1] / sp * l; P.pos[i * 6 + 5] = q.p[2] - q.v[2] / sp * l;
        for (let e = 0; e < 2; e++) { const b = i * 8 + e * 4; P.col[b] = P.rgb[0]; P.col[b + 1] = P.rgb[1]; P.col[b + 2] = P.rgb[2]; P.col[b + 3] = w * (e ? 0.2 : 1); }
      } else {
        P.pos[i * 3] = q.p[0]; P.pos[i * 3 + 1] = q.p[1]; P.pos[i * 3 + 2] = q.p[2];
        P.col[i * 4] = P.rgb[0]; P.col[i * 4 + 1] = P.rgb[1]; P.col[i * 4 + 2] = P.rgb[2]; P.col[i * 4 + 3] = w;
      }
      i++;
    }
    P.geo.setDrawRange(0, P.streak ? n * 2 : n);
    P.geo.attributes.position.needsUpdate = true; P.geo.attributes.color.needsUpdate = true;
  }

  // landings: rings on the ground, and discs (a puff, a settling flake or petal)
  const CAP = 320, dummy = new THREE.Object3D(), tmpC = new THREE.Color();
  const inst = (geo) => { const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), CAP); m.count = 0; m.frustumCulled = false; m.raycast = function () {}; m.setColorAt(0, tmpC.setRGB(0, 0, 0)); scene.add(m); return m; };
  const rings = inst(new THREE.RingGeometry(0.6, 1, 20)), discs = inst(new THREE.CircleGeometry(1, 14));
  const ground = (x, y) => (window.__mojGround ? window.__mojGround(x, y) : CFG.ground != null ? CFG.ground : camP[2] - 1.6);
  function land(name, k, t, used) {
    const P = pools[name]; if (!P || P.F.impact === 'none') return;
    const n = Math.round(impactCount(P.F) * k), pts = impactPoints(P.F, camP, t, n), im = P.F.impact, ring = im === 'rings' || im === 'crowns';
    const M = ring ? rings : discs, U = ring ? used.r : used.d;
    for (const q of pts) {
      if (U.n >= CAP) break;
      const u = q.u; let s, b;
      if (im === 'rings') { s = (0.05 + 0.32 * u) * q.s; b = (1 - u) * 0.55; }
      else if (im === 'crowns') { s = (0.04 + 0.24 * u) * q.s; b = (1 - u) * 0.8; }
      else if (im === 'puffs') { s = (0.1 + 0.55 * u) * q.s; b = (1 - u) * 0.3; }
      else { s = P.F.size * 2.4 * q.s; b = (u < 0.15 ? u / 0.15 : Math.max(0, 1 - (u - 0.15) / 0.85)) * 0.8; }
      dummy.position.set(q.p[0], q.p[1], ground(q.p[0], q.p[1]) + 0.02); dummy.scale.setScalar(Math.max(0.001, s)); dummy.updateMatrix();
      M.setMatrixAt(U.n, dummy.matrix); M.setColorAt(U.n, tmpC.setRGB(P.rgb[0] * b, P.rgb[1] * b, P.rgb[2] * b)); U.n++;
    }
  }

  function step() {
    const t = clock(), L = look(t), S = L.S;
    camP[0] = camera.position.x; camP[1] = camera.position.y; camP[2] = camera.position.z;
    // lightning: a sheet flash, a quick double pulse that dies
    let fl = 0;
    if (S.flash) for (const f of flashesIn(S.flash, SEED, Math.max(0, t - 0.9), t + 1e-6)) { const age = t - f.at, p = Math.exp(-age * 6) * (0.65 + 0.35 * Math.cos(age * 42) ** 2); fl = Math.max(fl, p * (f.near ? 1 : 0.55)); }
    fog.density = baseDensity * S.fog;
    const sc = S.veil / CLEAR_VEIL;
    tint.setRGB(Math.min(1, baseColor.r * sc), Math.min(1, baseColor.g * sc), Math.min(1, baseColor.b * sc)).lerp(white, fl * 0.5);
    fog.color.copy(tint); if (scene.background && scene.background.isColor) scene.background.copy(tint);
    // light off the world; white for a flash
    const off = Math.min(0.75, S.dim * 0.7 + Math.max(0, 0.85 - S.sky) * 0.4);
    if (fl > 0.02) { ov.style.background = '#fff'; ov.style.opacity = String(Math.min(0.6, fl * 0.55)); } else { ov.style.background = '#000'; ov.style.opacity = String(off); }
    // the fall and its landings, each state's pool at its share
    const used = { r: { n: 0 }, d: { n: 0 } };
    for (const n of Object.keys(pools)) { const k = L.sh[n] || 0; fall(n, k, t); if (k > 0) land(n, k, t, used); }
    rings.count = used.r.n; discs.count = used.d.n;
    for (const m of [rings, discs]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    requestAnimationFrame(step);
  }
  step();
})();
`;
}

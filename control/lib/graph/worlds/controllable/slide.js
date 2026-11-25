/**
 * slide.js — THE SLIDE: a body on a slick slope (scree, a tiled roof, a mud chute) is taken by it and slides down it,
 * gathering speed against a little friction; the stick steers it across the slope, never back up; a boulder in its way
 * bumps it aside and slows it; jump flings it off at its speed; at the slope's foot it goes off the lip level, at the
 * speed it reached (into the air: a ledge across a gap may catch it, ledge.js). The cinematic action game's run down a
 * scree slope or a collapsing roof. Its speed is the platform rule's drive (`e.drive`, a rule with `accel`) as it leaves,
 * so the air carries it as it carries a run's (a rule that steps directly moves at its own pace once off); the frame it
 * lets go it hands the body back, so the rule runs on with it at once.
 *
 *   spec.slides: [{ id, a: [x, y, z], b: [x, y, z], half? }]   a straight slope from its top `a` to its foot `b` (b lower),
 *                 `half` metres either side of its line (2)
 *   the slope   takes a platform body whose feet meet its surface (a little over it or under it: the stair a level lays
 *               under a slope for the camera stands a body just below it; not rising) inside it, unless
 *               the body has just left one; while it holds the body the body is grounded on it, faces down it, and plays
 *               `slide` (rules ask for nothing: a slope is the level's)
 *   rule.slide  the dials, optional ({ max, min, friction, steer, jump }): its top speed along the slope (14 m/s), the
 *               least it keeps (3), friction against gravity's pull down it (0.1), how fast the stick moves it across
 *               (3.5 m/s), the share of the body's jump a jump off it has (0.8)
 *
 * State: state.slides (the compiled slopes), on the body e.slide { id, u, off, v, was } while held (u metres along the
 * slope's plan, off across it, + to its left, v its speed along the slope), e._slideCool. The bus hears
 * `slide:<id>:start`, `slide:<id>:jump`, `slide:<id>:end` (off its foot) and `slide:<id>:bump` (castFacts, wrapped).
 *
 *   readSlides(raw) → the slopes, read (throws naming what it takes); outside the builder, never emitted
 *
 * A body owner (registerBodyOwner 'slide', before the ledge's). Import-free inside the builder (the page runs its source
 * via toString(), compose.js); emitted only into a page whose world has slopes, so every other page keeps every byte.
 * Pure: the same input slides the same way.
 */
export const SLIDES = Object.freeze({ most: 16, half: 2 });

const v3 = (p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);

/** A world's slopes, read (see the header). */
export function readSlides(raw) {
  if (raw === undefined || raw === null || raw === false) return null;
  if (!Array.isArray(raw) || !raw.length) throw new Error('slides: [{ id, a: [x, y, z], b: [x, y, z], half? }]');
  if (raw.length > SLIDES.most) throw new Error(`slides: at most ${SLIDES.most}`);
  const ids = new Set();
  return raw.map((S, i) => {
    const at = `slides[${i}]`;
    if (!S || typeof S.id !== 'string' || !S.id) throw new Error(`${at}: an id`);
    if (ids.has(S.id)) throw new Error(`${at}: '${S.id}' twice`);
    ids.add(S.id);
    if (!v3(S.a) || !v3(S.b)) throw new Error(`${at}: a and b are places [x, y, z], its top and its foot`);
    const run = Math.hypot(S.b[0] - S.a[0], S.b[1] - S.a[1]), drop = S.a[2] - S.b[2];
    if (run < 2) throw new Error(`${at}: a slope runs at least 2 m`);
    if (!(drop > 0) || drop / run > 2.75) throw new Error(`${at}: its foot is below its top, steeper than 70° never (a face is climbed)`);
    if (S.half != null && !(Number.isFinite(S.half) && S.half >= 0.6 && S.half <= 20)) throw new Error(`${at}: half is 0.6–20 m`);
    return { id: S.id, a: S.a.slice(), b: S.b.slice(), ...(S.half != null ? { half: S.half } : {}) };
  });
}

export function buildSlide(E) {
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const DEF = { max: 14, min: 3, friction: 0.1, steer: 3.5, jump: 0.8 }, G = 9.8, OVER = 0.35, UNDER = 0.8, COOL = 0.35;
  const dials = (r) => { const L = r.slide && typeof r.slide === 'object' ? r.slide : {}, o = {}; for (const k in DEF) o[k] = typeof L[k] === 'number' ? L[k] : DEF[k]; return o; };

  E.registerStateInit((state, spec) => {
    const L = spec && Array.isArray(spec.slides) ? spec.slides.filter((S) => S && S.id && Array.isArray(S.a) && Array.isArray(S.b)) : [];
    if (!L.length) return;
    state.slides = L.map((S) => {
      const dx = S.b[0] - S.a[0], dy = S.b[1] - S.a[1], run = Math.hypot(dx, dy), drop = S.a[2] - S.b[2], ang = Math.atan2(drop, run);
      return { id: S.id, a: S.a.slice(), run, drop, half: S.half || 2, t: [dx / run, dy / run], n: [-dy / run, dx / run], sin: Math.sin(ang), cos: Math.cos(ang) };
    });
  });

  // where a point stands over a slope: metres along its plan, across it (+ left), and its surface's height there
  const over = (S, x, y) => { const rx = x - S.a[0], ry = y - S.a[1], u = rx * S.t[0] + ry * S.t[1]; return { u, off: rx * S.n[0] + ry * S.n[1], z: S.a[2] - (S.drop * u) / S.run }; };
  const said = (state, type) => { (state._slideEv || (state._slideEv = [])).push(type); if (state._slideEv.length > 16) state._slideEv.shift(); };
  // the stick as the camera reads it (the chase line sets the camera's yaw on a set piece), across the slope
  function across(S, input, world, t) {
    const my = world && world.cameraYaw != null ? world.cameraYaw : t.heading;
    const fx = Math.cos(my), fy = Math.sin(my), rx = Math.sin(my), ry = -Math.cos(my);
    const side = clamp((input.strafe || 0) + (input.turn || 0), -1, 1), fwd = input.forward || 0;
    return clamp((fx * fwd + rx * side) * S.n[0] + (fy * fwd + ry * side) * S.n[1], -1, 1);
  }

  E.registerBodyOwner('slide', (e, input, dt, state, world) => {
    const r = e.rule, SL = state.slides;
    if (!SL || !r || r.type !== 'platform' || e.dormant || e.downed || e.isCamera || e.ledge) { if (e.slide) e.slide = null; return false; }
    const me = !state.pilotId || state.pilotId === e.id, inp = me && input ? input : {};
    const D = dials(r), t = e.transform, eye = r.eye || 0, R = r.collideRadius || 0.3;
    e._slideCool = Math.max(0, (e._slideCool || 0) - dt);
    if (!e.slide) {
      if (e._slideCool > 0 || (e.vel && e.vel[2] > 0.5)) return false;
      const feet = t.pos[2] - eye;
      for (const S of SL) {
        const o = over(S, t.pos[0], t.pos[1]);
        if (o.u < 0 || o.u >= S.run || Math.abs(o.off) > S.half || feet - o.z > OVER || feet - o.z < -UNDER) continue;
        // (taken at the speed it came in with, down the slope; never less than its least)
        const vin = e.vel ? e.vel[0] * S.t[0] + e.vel[1] * S.t[1] : 0;
        e.slide = { id: S.id, u: o.u, off: o.off, v: Math.max(D.min, vin), was: !!(inp.jump || inp.jumpHeld), bumpT: 0 };
        said(state, 'slide:' + S.id + ':start');
        break;
      }
      if (!e.slide) return false;
    }
    const L = e.slide, S = SL.find((x) => x.id === L.id);
    if (!S) { e.slide = null; return false; }
    // jump: flung off at its speed, up as its jump goes
    const jump = !!inp.jump && !L.was;
    L.was = !!(inp.jump || inp.jumpHeld);
    if (jump) {
      const vh = L.v * S.cos;
      e.vel = [S.t[0] * vh, S.t[1] * vh, (r.jumpSpeed || 7) * D.jump]; e.drive = [S.t[0] * vh, S.t[1] * vh];
      e.slide = null; e._slideCool = COOL; e.grounded = false; e.coyote = 1; e.jumpBuf = 0;
      said(state, 'slide:' + S.id + ':jump');
      // (handed back this very frame: a body an owner holds has its drive stopped, core.js drive-stop)
      return false;
    }
    // down it: gravity's pull along the slope against friction, held between its least and its top
    L.v = clamp(L.v + G * (S.sin - D.friction * S.cos) * dt, D.min, D.max);
    L.u += L.v * S.cos * dt;
    L.off = clamp(L.off + across(S, inp, world, t) * D.steer * dt, -S.half + R, S.half - R);
    L.bumpT = Math.max(0, L.bumpT - dt);
    // a boulder on the slope (a collider standing above its surface): bumped aside across it, slowed
    const px = S.a[0] + S.t[0] * L.u + S.n[0] * L.off, py = S.a[1] + S.t[1] * L.u + S.n[1] * L.off, z = S.a[2] - (S.drop * L.u) / S.run;
    for (const c of state.colliders || []) {
      if (c.max[2] < z + 0.3 || c.min[2] > z + 1.6) continue;
      if (px + R <= c.min[0] || px - R >= c.max[0] || py + R <= c.min[1] || py - R >= c.max[1]) continue;
      // (out across the slope to the boulder's nearer side)
      const cx = (c.min[0] + c.max[0]) / 2, cy = (c.min[1] + c.max[1]) / 2, co = (cx - S.a[0]) * S.n[0] + (cy - S.a[1]) * S.n[1];
      const w = Math.abs((c.max[0] - c.min[0]) / 2 * S.n[0]) + Math.abs((c.max[1] - c.min[1]) / 2 * S.n[1]);
      L.off = clamp(L.off >= co ? co + w + R : co - w - R, -S.half + R, S.half - R);
      if (L.bumpT <= 0) { L.v = Math.max(D.min, L.v * 0.6); L.bumpT = 0.4; said(state, 'slide:' + S.id + ':bump'); }
    }
    const at = Math.min(L.u, S.run), zs = S.a[2] - (S.drop * at) / S.run;
    t.pos = [S.a[0] + S.t[0] * at + S.n[0] * L.off, S.a[1] + S.t[1] * at + S.n[1] * L.off, zs + eye];
    t.heading = Math.atan2(S.t[1], S.t[0]);
    e.dashVel = null; e.coyote = 0; e.jumpBuf = 0;
    // off its foot: on into the air, level, at the speed it reached
    if (L.u >= S.run) {
      const vh = L.v * S.cos;
      e.vel = [S.t[0] * vh, S.t[1] * vh, 0]; e.drive = [S.t[0] * vh, S.t[1] * vh];
      e.slide = null; e._slideCool = COOL; e.grounded = false; e.coyote = 1;
      said(state, 'slide:' + S.id + ':end');
      return false;
    }
    e.vel = [S.t[0] * L.v * S.cos, S.t[1] * L.v * S.cos, -L.v * S.sin];
    e.grounded = true; e.locomotion = 'slide'; e.moving = true;
    e.gaitPhase = ((e.gaitPhase || 0) + 0.6 * dt) % 1;
    return true;
  }, 45);

  // the bus hears a slide start, a jump off it, its end and a bump
  const baseFacts = E.castFacts;
  E.castFacts = function castFacts(state, prev) {
    const out = baseFacts(state, prev);
    if (!state._slideEv || !state._slideEv.length) return out;
    for (const type of state._slideEv) out.events.push({ type });
    state._slideEv.length = 0;
    return out;
  };
}

/**
 * swing.js — THE GEAR (the city stalker): a line the hero casts to a building's face and moves on. Opt-in by the
 * rule's `gear: '<preset>' | { preset?, … }`; absent, nothing here runs and no state is written.
 *
 * A gear is a set of DIRECTION CONSTRAINTS on where its line may land and what it does there; a preset names one. The
 * SWINGER (the only preset built) casts to a face ABOVE and AHEAD and swings under it:
 *
 *   the anchor   found for the hero, never aimed: of every box face the hero stands outside of (and every box's
 *                underside over it: a ceiling, a beam, a catwalk), the point nearest the
 *                ideal one (`elev` above the heading, `ideal` × `reach` out), within `reach`, at least `minElev` up, inside
 *                the `cone` either side of the heading, with a clear line to it. None found, no line: an open plaza or a
 *                park is where a swinger runs. A box marked `hold: false` (a level's edge) takes no line.
 *   the swing    held (the gear's key, `boost` by default) in the air, cast again `cool` after a line is cut or met:
 *                an inextensible line, the body falling under the rule's gravity, its velocity kept off the line's
 *                stretch, steered by A / D (turning) and pumped by forward. It swings about a PIVOT, the anchor drawn
 *                `center` of the way in toward the hero's line across the ground (the genre's cheat: the line lands on
 *                the side wall, the arc runs down the street). The line's length is chosen so the arc's bottom clears
 *                the ground under the hero by `clear`, or a quarter of the room under the pivot where that is less (a
 *                warehouse's beams, a hall's ceiling); shorter than the cast, it reels the hero in at `reel`. It lets go when
 *                the key is let go, a jump is pressed (with a lift), a box crosses the line, the body meets a box (the
 *                wall then takes it, wall.js), or the ground; the body flies on with the swing's velocity (the platform
 *                rule's `dashVel`, to touchdown)
 *   the zip      the key pressed on the ground: a pull straight to the anchor at `zipSpeed`, arriving on the face (the
 *                wall holds it there when the rule has `wall`)
 *
 * Locomotion: swing, swing_release, zip (a figure without the clip plays its fallback: playscape/player.js
 * TRAVERSAL_FALLBACK). `e.swinging` is { anchor, pivot, L, face, v } while a line is out (the page draws it from the hand
 * to the anchor).
 * Lengths in the world's units; the defaults are metres × the rule's `metre`, as the wall's.
 *
 *   swinger: { reach 60 m, ideal 0.7, elev 55°, minElev 25°, cone 75°, center 0.75, clear 3 m, pump 6 m/s², steer 1.6 rad/s,
 *              maxSpeed 45 m/s, zipSpeed 28 m/s, reel 20 m/s, lift 0.6, cool 0.25 s, key 'boost' }
 */
export function buildSwing(E) {
  const { add, sub, scl, clamp, fwdXY } = E;
  const EPS = 0.05, DEG = Math.PI / 180;
  // the presets: the direction constraints a gear's line keeps (lengths in metres, × metre)
  const GEAR_PRESETS = {
    swinger: { reach: 60, ideal: 0.7, elev: 55, minElev: 25, cone: 75, center: 0.75, clear: 3, pump: 6, steer: 1.6, maxSpeed: 45, zipSpeed: 28, reel: 20, lift: 0.6, cool: 0.25, key: 'boost' },
  };
  const LENGTHS = ['reach', 'clear', 'pump', 'maxSpeed', 'zipSpeed', 'reel'];
  const gearOf = (r) => {
    const g = typeof r.gear === 'string' ? { preset: r.gear } : r.gear, P = GEAR_PRESETS[g.preset || 'swinger'];
    if (!P) return null;
    const m = r.metre ?? 1, out = {};
    for (const k of Object.keys(P)) out[k] = g[k] ?? (LENGTHS.includes(k) ? P[k] * m : P[k]);
    return out;
  };
  E.gearOf = gearOf;   // the gear's dials off a rule, for the reach (game/reach.js)
  const geared = (e) => !!(e.rule && e.rule.type === 'platform' && e.rule.gear && !e.rule.space && e.vel && !e.isCamera);
  const len = (v) => Math.hypot(v[0], v[1], v[2]);
  // the hand the line leaves from: high on the body
  const handOf = (e) => { const r = e.rule, H = r.collideHeight ?? 1.7 * (r.metre ?? 1), feet = e.transform.pos[2] - (r.eye ?? 0); return [e.transform.pos[0], e.transform.pos[1], feet + H * 0.9]; };

  // the anchor: the face point nearest the ideal, inside the gear's constraints, with a clear line
  function anchorFor(e, G, cs, { walls = false } = {}) {
    const hand = handOf(e), f = fwdXY(e.transform.heading), el = G.elev * DEG;
    const ideal = [hand[0] + f[0] * Math.cos(el) * G.reach * G.ideal, hand[1] + f[1] * Math.cos(el) * G.reach * G.ideal, hand[2] + Math.sin(el) * G.reach * G.ideal];
    const sinMin = Math.sin(G.minElev * DEG), cosCone = Math.cos(G.cone * DEG);
    let best = null;
    for (const c of cs) {
      if (c.hold === false) continue;
      for (const ax of [0, 1]) for (const s of [-1, 1]) {
        const at = s > 0 ? c.max[ax] : c.min[ax];
        if ((hand[ax] - at) * s <= 0) continue;   // the hero stands on this face's outer side
        const ta = 1 - ax, q = [0, 0, 0];
        q[ax] = at; q[ta] = clamp(ideal[ta], c.min[ta], c.max[ta]); q[2] = clamp(ideal[2], c.min[2], c.max[2] - EPS);
        const d = sub(q, hand), D = len(d);
        if (D > G.reach || D < EPS || d[2] / D < sinMin) continue;
        const h = Math.hypot(d[0], d[1]);
        if (h > EPS && (d[0] * f[0] + d[1] * f[1]) / h < cosCone) continue;
        const miss = len(sub(q, ideal));
        if (best && miss >= best.miss) continue;
        // the line clear of every box but the one it lands on (it ends on that box's face)
        const toward = sub(q, scl(d, EPS / D)), wt = E.nearestWallT(hand, toward, cs);
        if (wt != null && wt < 1 - 1e-6) continue;
        best = { miss, q, face: { ax, s, at } };
      }
      // the box's UNDERSIDE, over the hero (a ceiling's slab, a beam, a catwalk: indoors the line goes up); not for a zip,
      // which lands on a face the wall holds
      if (walls || hand[2] >= c.min[2] - EPS) continue;
      // aimed where the ideal ray meets the underside's plane (a ceiling is near, not `ideal` × `reach` out), and scored by
      // how far the point misses it
      const up = c.min[2] - hand[2], run = up / Math.tan(el), hit = [hand[0] + f[0] * run, hand[1] + f[1] * run, c.min[2]];
      const q = [clamp(hit[0], c.min[0], c.max[0]), clamp(hit[1], c.min[1], c.max[1]), c.min[2]];
      const d = sub(q, hand), D = len(d);
      if (D > G.reach || D < EPS || d[2] / D < sinMin) continue;
      const h = Math.hypot(d[0], d[1]);
      if (h > EPS && (d[0] * f[0] + d[1] * f[1]) / h < cosCone) continue;
      const miss = len(sub(q, hit));
      if (best && miss >= best.miss) continue;
      const toward = sub(q, scl(d, EPS / D)), wt = E.nearestWallT(hand, toward, cs);
      if (wt != null && wt < 1 - 1e-6) continue;
      best = { miss, q, face: { ax: 2, s: -1, at: c.min[2] } };
    }
    return best;
  }
  const inBox = (cs, p, feet, R, H) => cs.find((c) => p[0] > c.min[0] - R && p[0] < c.max[0] + R && p[1] > c.min[1] - R && p[1] < c.max[1] + R && feet < c.max[2] - EPS && feet + H > c.min[2] + EPS) || null;

  E.registerBodyOwner('swing', (e, input, dt, state, world) => {
    if (!geared(e)) return false;
    const r = e.rule, G = gearOf(r);
    if (!G) return false;
    const t = e.transform, prev = e._gearAt || t.pos;
    e._gearAt = [t.pos[0], t.pos[1], t.pos[2]];
    e._gearCool = Math.max(0, (e._gearCool || 0) - dt);
    e._gearRel = Math.max(0, (e._gearRel || 0) - dt);
    if (e.staggerT != null || e.dropping || e.dormant || e.downed || e.climbing || e.walling) { e.swinging = null; e.zipping = null; return false; }
    const cs = state.colliders;
    if (!cs) return false;
    const me = !state.pilotId || state.pilotId === e.id, inp = me ? input : {};
    const key = !!inp[G.key], pressed = key && !e._gearKey;
    e._gearKey = key;
    const eye = r.eye ?? 0, R = r.collideRadius ?? 0, H = r.collideHeight ?? 1.7 * (r.metre ?? 1), g = r.gravity ?? 20 * (r.metre ?? 1);
    const ground = (p) => (world && world.ground ? world.ground([p[0], p[1], p[2] - eye + (r.step ?? 0.35 * (r.metre ?? 1))]) : null);
    const release = (v, how) => {
      e.swinging = null; e.zipping = null; e._gearCool = G.cool; e._gearRel = how === 'release' ? 0.5 : 0;
      e.vel = [0, 0, v[2]]; e.dashVel = [v[0], v[1]]; e.grounded = false; e.coyote = 1; e.jumpBuf = 0;
      e.swung = { end: how };
      if (Math.hypot(v[0], v[1]) > EPS) t.heading = Math.atan2(v[1], v[0]);
    };

    // the ZIP: a pull straight to the anchor, arriving on its face
    if (e.zipping) {
      const Z = e.zipping, to = Z.to, d = sub(to, t.pos), D = len(d), step = G.zipSpeed * dt;
      if (D <= step) {
        t.pos = to; e.zipping = null; e._gearCool = G.cool; e.vel = [0, 0, 0]; e.dashVel = null; e.grounded = false; e.coyote = 1;
        e.swung = { end: 'zip' };
        if (r.wall) e.walling = { ax: Z.face.ax, s: Z.face.s, at: Z.face.at, hold: null, mantle: null, spent: true };
        t.heading = Math.atan2(-(Z.face.ax === 1 ? Z.face.s : 0), -(Z.face.ax === 0 ? Z.face.s : 0));
        e.locomotion = 'zip'; e.moving = false;
        return true;
      }
      t.pos = add(t.pos, scl(d, step / D));
      e.vel = [0, 0, 0]; e.dashVel = null; e.grounded = false; e.coyote = 1;
      t.heading = Math.atan2(d[1], d[0]); e.locomotion = 'zip'; e.moving = true; e.gaitPhase = (e.gaitPhase || 0) + dt * 2;
      return true;
    }

    if (!e.swinging) {
      // in the air the key held casts (again after `cool`, a line cut or met); on the ground a press zips
      if (e._gearCool > 0 || (e.grounded ? !pressed : !key)) return false;
      const A = anchorFor(e, G, cs, { walls: e.grounded });
      if (!A) return false;
      if (e.grounded) {
        // on the ground the key zips: to the face, a body's radius off it
        const to = [A.q[0], A.q[1], A.q[2] - H * 0.9 + eye];
        to[A.face.ax] = A.face.at + A.face.s * R;
        e.zipping = { to, face: A.face, anchor: A.q };
        e.swinging = null;
        return true;
      }
      // the PIVOT the body swings about: the anchor drawn `center` of the way in toward the hero's own line across the
      // ground (the line is drawn to the face; a swing about a point off to the side would carry the hero into it)
      const hand = handOf(e), f0 = fwdXY(t.heading), off = sub(A.q, hand), side = -off[0] * f0[1] + off[1] * f0[0];
      const pivot = [A.q[0] + f0[1] * side * G.center, A.q[1] - f0[0] * side * G.center, A.q[2]];
      // the line's length: the cast, or shorter so the arc's bottom clears the ground (the hero reeled in)
      const D = len(sub(pivot, hand)), gz = ground(t.pos) ?? 0;
      // (the clearance shrinks with the room under the pivot: a warehouse's beams are not a street's towers)
      const room = pivot[2] - gz - H * 0.9, clear = Math.min(G.clear, Math.max(0.1 * (r.metre ?? 1), room * 0.25));
      const L = Math.min(D, room - clear);
      // a line reeled to less than half its cast, or shorter than the hero is tall (a low room), is no swing
      if (L < D * 0.5 || L < H) { e.swung = { end: 'low' }; return false; }
      // the body's own velocity as the swing starts: its last step's travel
      const v0 = scl(sub(t.pos, prev), 1 / Math.max(dt, 1e-6));
      // the line starts at the cast's length and is REELED to its own at `reel` (never a snap across the gap)
      e.swinging = { anchor: A.q, pivot, L: D, to: L, face: A.face, v: [v0[0], v0[1], e.vel[2]] };
      e.launchedBy = null; e.launchLock = false;
    }

    const S = e.swinging;
    if (!key) { release(S.v, 'release'); return true; }
    if (inp.jump) { release([S.v[0], S.v[1], Math.max(S.v[2], 0) + (r.jumpSpeed ?? 8.5 * (r.metre ?? 1)) * G.lift], 'jump'); e.jumped = true; return true; }
    // steer (turn) and pump (forward along the heading), under gravity
    const turn = clamp((inp.turn || 0) + (inp.strafe || 0), -1, 1);
    t.heading -= turn * G.steer * dt;
    const f = fwdXY(t.heading);
    let v = [S.v[0], S.v[1], S.v[2] - g * dt];
    const pump = clamp(inp.forward || 0, 0, 1) * G.pump * dt;
    v = [v[0] + f[0] * pump, v[1] + f[1] * pump, v[2]];
    // a turn bends the swing's run toward the heading, keeping its speed across the ground
    const hs = Math.hypot(v[0], v[1]);
    if (hs > EPS && turn !== 0) { const k = Math.min(1, G.steer * dt * 2); const nx = v[0] / hs * (1 - k) + f[0] * k, ny = v[1] / hs * (1 - k) + f[1] * k, nl = Math.hypot(nx, ny) || 1; v = [nx / nl * hs, ny / nl * hs, v[2]]; }
    const sp = len(v);
    if (sp > G.maxSpeed) v = scl(v, G.maxSpeed / sp);
    if (S.to !== undefined && S.L > S.to) S.L = Math.max(S.to, S.L - G.reel * dt);
    // move, then hold the hand to the line: never further than L from the anchor, the stretch taken off the velocity
    let p = add(t.pos, scl(v, dt));
    const hOff = handOf(e)[2] - t.pos[2], hand = [p[0], p[1], p[2] + hOff], d = sub(hand, S.pivot), D = len(d);
    if (D > S.L) {
      const u = scl(d, 1 / D);
      p = add(S.pivot, scl(u, S.L)); p[2] -= hOff;
      const out = v[0] * u[0] + v[1] * u[1] + v[2] * u[2];
      if (out > 0) v = sub(v, scl(u, out));
    }
    // the line crossed by a box, the body met by one, or the ground under it: let go
    const feet = p[2] - eye, hit = inBox(cs, p, feet, R, H), gz = ground(p);
    const hp = [p[0], p[1], p[2] + hOff], toA = sub(S.anchor, hp), lineCut = E.nearestWallT(hp, sub(S.anchor, scl(toA, EPS / Math.max(EPS, len(toA)))), cs);
    if (hit) { e.swinging = null; e._gearCool = G.cool; e.vel = [0, 0, 0]; e.dashVel = null; e.swung = { end: 'met' }; return true; }
    if (gz != null && feet <= gz + EPS) { t.pos = [p[0], p[1], gz + eye]; release([v[0], v[1], 0], 'ground'); return true; }
    if (lineCut != null && lineCut < 1 - 1e-6) { t.pos = p; release(v, 'cut'); return true; }
    t.pos = p; S.v = v;
    if (Math.hypot(v[0], v[1]) > EPS) t.heading = Math.atan2(v[1], v[0]);
    e.vel = [0, 0, 0]; e.dashVel = null; e.grounded = false; e.coyote = 1; e.jumpBuf = 0;
    e.locomotion = 'swing'; e.moving = true; e.gaitPhase = clamp(0.5 + Math.atan2(d[0] * f[0] + d[1] * f[1], -d[2]) / Math.PI, 0, 0.999);
    return true;
  }, 57);

  // SWING RELEASE: the flight after a line is let go, until the body lands or holds again
  E.registerWorldPass('gear-pose', (state) => {
    for (const e of state.entities) if (geared(e) && !e.swinging && !e.zipping && !e.walling && !e.grounded && e._gearRel > 0) e.locomotion = 'swing_release';
  }, 27);
}

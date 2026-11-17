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
 *                an ELASTIC line, the body falling under the rule's gravity: past its length the line pulls the hand
 *                back toward the pivot (`spring`: the pull at a whole length of stretch, so a strain of load / spring),
 *                gives back `recoil` times what it took as it shortens again (over 1, the line throws the body: the
 *                bottom of the arc is a sling), and at `stretch` of its length is taut (the velocity kept off any more;
 *                a line low over the street is taut sooner, at what keeps the body off the ground).
 *                Let go while it is stretched, the line FLINGS the body: `fling` of what the stretch holds is added to
 *                its speed along its way (the low of the arc is where it is loaded: let go there for the most), never
 *                past `flingMax` × `maxSpeed`. `stretch: 0` is the inextensible line. Steered by A / D (turning) and
 *                pumped by forward. It swings about a PIVOT, the anchor drawn
 *                `center` of the way in toward the hero's line across the ground (the genre's cheat: the line lands on
 *                the side wall, the arc runs down the street). The line's length is chosen so the arc's bottom clears
 *                the ground under the hero by `clear`, or a quarter of the room under the pivot where that is less (a
 *                warehouse's beams, a hall's ceiling); shorter than the cast, it reels the hero in at `reel`. It lets go when
 *                the key is let go, a jump is pressed (with a lift), a box crosses the line, the body meets a box (the
 *                wall then takes it, wall.js), or the ground; the body flies on with the swing's velocity (the platform
 *                rule's `dashVel`, to touchdown)
 *   the zip      the key pressed on the ground, or TAPPED TWICE in the air (a line let go within `tapT` of its cast,
 *                the key pressed again within `tapWin`): a pull straight to the anchor at `zipSpeed`, arriving on the
 *                face (the wall holds it there when the rule has `wall`)
 *   the launch   a jump pressed on the way (THE POINT LAUNCH): the zip is carried to the face's top where that is in
 *                reach, and the body springs over the roof's edge, `pointLift` × the zip's speed up and `pointCarry` ×
 *                on over the roof, turning a somersault; a face too tall to top is run up from where the zip lands (the
 *                wall's run, wall.js), or sprung off where the rule has no wall
 *   the dive     the kneel key held in the air off a line: the body falls `dive` times as hard and as fast (the platform
 *                rule reads `e.diving`), head first, driven on along its way by `diveDrive`; a line cast out of a dive
 *                takes the fall's speed into the swing
 *
 *   the body     hangs along its line (`hang` of the way: a trapeze artist's body follows the rope, eased in as the line
 *                takes its weight), the clip's phase the arc's (0 behind the pivot, 1 ahead of it: arched at the back,
 *                long at the bottom, piked at the front). Let go in the air with room and speed, it turns `flips`
 *                somersaults the way the swing was carrying it (a back tuck off the front of the arc) over `flipTime`,
 *                opening upright; low or slow, it only rights itself. `e.tumble` carries both (the page turns the whole
 *                body about its middle); a new line, a wall or the ground ends it. `hang: 0, flips: 0` is the body upright
 *
 *   the hand     the line leaves the hand on the anchor's side of the body's way (`hand`: 'L' | 'R'), the other hand
 *                where the anchor stands dead ahead and the last line was this one's: lines alternate down a street.
 *                A left-hand line plays `swing_left` (the swing's mirror; a zip, `zip_left`)
 *
 * Locomotion: swing, swing_left, swing_release, zip, zip_left (a figure without the clip plays its fallback: playscape/player.js
 * TRAVERSAL_FALLBACK; a hero that starts with the line carries its own, player.js GEAR_CLIPS). `e.swinging` is { anchor, pivot, L, face, v } while a line is out (the page draws it from the hand
 * to the anchor).
 * Lengths in the world's units; the defaults are metres × the rule's `metre`, as the wall's.
 *
 *   swinger: { reach 60 m, ideal 0.7, elev 55°, minElev 25°, cone 75°, center 0.75, clear 3 m, pump 6 m/s², steer 1.6 rad/s,
 *              maxSpeed 45 m/s, zipSpeed 28 m/s, reel 20 m/s, lift 0.6, cool 0.25 s, stretch 0.22, spring 420 m/s²,
 *              recoil 1.8, fling 1.5, flingMax 1.35, hang 0.85, flips 1, flipTime 0.7 s, flipRoom 4 m, tapT 0.22 s, tapWin 0.4 s,
 *              pointLift 0.6, pointCarry 0.85, dive 2.2, diveDrive 6 m/s², diveLean 1.2 rad, key 'boost' }
 */
export function buildSwing(E) {
  const { add, sub, scl, clamp, fwdXY } = E;
  const EPS = 0.05, DEG = Math.PI / 180;
  // the presets: the direction constraints a gear's line keeps (lengths in metres, × metre)
  const GEAR_PRESETS = {
    swinger: { reach: 60, ideal: 0.7, elev: 55, minElev: 25, cone: 75, center: 0.75, clear: 3, pump: 6, steer: 1.6, maxSpeed: 45, zipSpeed: 28, reel: 20, lift: 0.6, cool: 0.25, stretch: 0.22, spring: 420, recoil: 1.8, fling: 1.5, flingMax: 1.35, hang: 0.85, flips: 1, flipTime: 0.7, flipRoom: 4, tapT: 0.22, tapWin: 0.4, pointLift: 0.6, pointCarry: 0.85, dive: 2.2, diveDrive: 6, diveLean: 1.2, key: 'boost' },
  };
  const LENGTHS = ['reach', 'clear', 'pump', 'maxSpeed', 'zipSpeed', 'reel', 'flipRoom', 'spring', 'diveDrive'];
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
  // which hand casts to an anchor: the one on its side of the body's way; dead ahead (within a body's width), the hand
  // the last line did not leave
  const handFor = (e, q) => {
    const t = e.transform, f = fwdXY(t.heading), side = -(q[0] - t.pos[0]) * f[1] + (q[1] - t.pos[1]) * f[0];
    const w = (e.rule.collideRadius ?? 0.3) * 2;
    const hand = side > w ? 'L' : side < -w ? 'R' : e._gearHand === 'R' ? 'L' : 'R';
    e._gearHand = hand;
    return hand;
  };
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
        best = { miss, q, face: { ax, s, at }, top: c.max[2] };
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
    // the body's turn (e.tumble: the hang along the line, the somersault off it) is the gear's own: anything that takes
    // the body from it (a blow, a wall, a drop) rights it
    const upright = () => { if (e._gearTurn) { e._gearTurn = null; e.tumble = null; } };
    // (the dive's own lean, apart from the gear's turn: eased in and out, never fought with a hang or a somersault)
    const lean = (to) => {
      const a0 = e._diveA || 0, a = e._gearTurn ? 0 : a0 + (to - a0) * Math.min(1, dt * 8);
      e._diveA = Math.abs(a) > 1e-3 ? a : 0;
      if (e._gearTurn) return;
      if (e._diveA) { const fd = fwdXY(e.transform.heading); e.tumble = { axis: [-fd[1], fd[0], 0], angle: e._diveA }; e._diveOn = true; }
      else if (e._diveOn) { e.tumble = null; e._diveOn = false; }
    };
    if (e.staggerT != null || e.dropping || e.dormant || e.downed || e.climbing || e.walling) { e.swinging = null; e.zipping = null; e.diving = 0; e._diveA = 0; if (e._diveOn) { e._diveOn = false; if (!e.walling) e.tumble = null; } upright(); return false; }
    // THE SOMERSAULT off a line let go (or the body righting itself): eased from the hang's angle to upright, `flips`
    // turns on the way; the ground ends it where it is
    if (e._gearTurn && e._gearTurn.flip) {
      const F = e._gearTurn.flip;
      if (e.grounded || e.zipping) upright();
      else {
        F.t += dt;
        const u = Math.min(1, F.t / F.dur), k = u * u * (3 - 2 * u);
        e._gearTurn.u = u;
        if (u >= 1) upright(); else e.tumble = { axis: F.axis, angle: F.from + (F.to - F.from) * k };
      }
    }
    const cs = state.colliders;
    if (!cs) return false;
    const me = !state.pilotId || state.pilotId === e.id || E.seated(state, e), inp = me ? input : {};
    const key = !!inp[G.key], pressed = key && !e._gearKey;
    e._gearKey = key;
    const eye = r.eye ?? 0, R = r.collideRadius ?? 0, H = r.collideHeight ?? 1.7 * (r.metre ?? 1), g = r.gravity ?? 20 * (r.metre ?? 1);
    const ground = (p) => (world && world.ground ? world.ground([p[0], p[1], p[2] - eye + (r.step ?? 0.35 * (r.metre ?? 1))]) : null);
    const release = (v0, how) => {
      // THE FLING: let go (the key, a jump) with the line stretched, what the stretch holds goes into the body's speed
      // along its way: ½ v² gains fling × ½ (spring / L) x²
      let v = v0;
      const S0 = e.swinging;
      if (S0 && S0.ext > 0 && G.fling > 0 && (how === 'release' || how === 'jump')) {
        const sp0 = len(v0), sp1 = Math.min(Math.max(sp0, G.maxSpeed * G.flingMax), Math.sqrt(sp0 * sp0 + G.fling * (G.spring / S0.L) * S0.ext * S0.ext));
        if (sp0 > EPS && sp1 > sp0) { v = scl(v0, sp1 / sp0); e.swungFling = sp1 - sp0; }
      }
      e.swinging = null; e.zipping = null; e._gearCool = G.cool; e._gearRel = how === 'release' ? 0.5 : 0;
      e.vel = [0, 0, v[2]]; e.dashVel = [v[0], v[1]]; e.grounded = false; e.coyote = 1; e.jumpBuf = 0;
      e.swung = { end: how };
      if (Math.hypot(v[0], v[1]) > EPS) t.heading = Math.atan2(v[1], v[0]);
      // let go in the air (the key, a jump): the body turns on the way the swing carried it, `flips` somersaults where
      // it has the room under it and the speed, and opens upright; anything else rights it at once
      const T = e._gearTurn, a0 = T ? T.angle : 0;
      if (T && (how === 'release' || how === 'jump') && (G.flips > 0 || Math.abs(a0) > 1e-3)) {
        const gz = ground(t.pos), room = gz == null ? Infinity : t.pos[2] - eye - gz;
        const turns = G.flips > 0 && room >= G.flipRoom && len(v) >= G.maxSpeed * 0.2 ? G.flips : 0;
        // (the swing's own way round: swinging forward the hang's angle falls, so the turn goes on falling)
        const dir = T.w < 0 ? -1 : 1, f1 = fwdXY(t.heading);
        e._gearTurn = { angle: a0, u: 0, flip: { t: 0, dur: turns ? G.flipTime * turns : 0.25, from: a0, to: dir * 2 * Math.PI * turns, axis: [-f1[1], f1[0], 0], turns } };
      } else upright();
    };

    // the ZIP: a pull straight to the anchor, arriving on its face
    if (e.zipping) {
      const Z = e.zipping;
      e.diving = 0; lean(0);
      // THE POINT LAUNCH: a jump pressed on the way arms it, and carries the zip to the face's top where that is in reach
      if (!Z.launch && (inp.jump || inp.jumpHeld)) {
        Z.launch = true;
        if (Z.face.ax !== 2 && Z.top != null && Z.top - (t.pos[2] - eye) <= G.reach * 1.2) {
          const lip = [Z.anchor[0], Z.anchor[1], Z.top + eye + 0.15 * (r.metre ?? 1)];
          lip[Z.face.ax] = Z.face.at + Z.face.s * R;
          Z.to = lip; Z.over = true; Z.anchor = [Z.anchor[0], Z.anchor[1], Z.top];
        }
      }
      const to = Z.to, d = sub(to, t.pos), D = len(d), step = G.zipSpeed * dt;
      if (D <= step && Z.launch) {
        const nx = Z.face.ax === 0 ? Z.face.s : 0, ny = Z.face.ax === 1 ? Z.face.s : 0;
        t.pos = to; e.zipping = null; e._gearCool = G.cool; e.grounded = false; e.coyote = 1; e.jumped = true;
        t.heading = Math.atan2(-ny, -nx);
        if (Z.over) {
          // over the roof's edge: up, and on over the roof, a somersault where the gear turns one
          e.vel = [0, 0, G.zipSpeed * G.pointLift]; e.dashVel = [-nx * G.zipSpeed * G.pointCarry, -ny * G.zipSpeed * G.pointCarry];
          if (G.flips > 0) e._gearTurn = { angle: 0, u: 0, flip: { t: 0, dur: G.flipTime, from: 0, to: 2 * Math.PI, axis: [ny, -nx, 0], turns: 1 } };
        } else if (r.wall && Z.face.ax !== 2) {
          // a face too tall to top: run up it from where the zip lands (wall.js reads the run)
          e.vel = [0, 0, 0]; e.dashVel = null;
          e.walling = { ax: Z.face.ax, s: Z.face.s, at: Z.face.at, hold: null, mantle: null, spent: true, run: { up: G.zipSpeed, vta: 0 } };
        } else { e.vel = [0, 0, G.zipSpeed * G.pointLift]; e.dashVel = [nx * G.zipSpeed * 0.3, ny * G.zipSpeed * 0.3]; }
        e.swung = { end: 'launch', over: !!Z.over };
        e.locomotion = 'leap'; e.moving = true;
        return true;
      }
      if (D <= step) {
        t.pos = to; e.zipping = null; e._gearCool = G.cool; e.vel = [0, 0, 0]; e.dashVel = null; e.grounded = false; e.coyote = 1;
        e.swung = { end: 'zip' };
        if (r.wall) e.walling = { ax: Z.face.ax, s: Z.face.s, at: Z.face.at, hold: null, mantle: null, spent: true };
        t.heading = Math.atan2(-(Z.face.ax === 1 ? Z.face.s : 0), -(Z.face.ax === 0 ? Z.face.s : 0));
        e.locomotion = Z.hand === 'L' ? 'zip_left' : 'zip'; e.moving = false;
        return true;
      }
      t.pos = add(t.pos, scl(d, step / D));
      e.vel = [0, 0, 0]; e.dashVel = null; e.grounded = false; e.coyote = 1;
      t.heading = Math.atan2(d[1], d[0]); e.locomotion = Z.hand === 'L' ? 'zip_left' : 'zip'; e.moving = true; e.gaitPhase = (e.gaitPhase || 0) + dt * 2;
      return true;
    }

    if (!e.swinging) {
      // THE DIVE: the kneel key held in the air, off a line: a harder, faster fall (the platform rule's, by `e.diving`),
      // driven on along the body's way, head first
      e._gearTap = Math.max(0, (e._gearTap || 0) - dt);
      const diving = G.dive > 1 && !e.grounded && !!inp.kneel && !key;
      e.diving = diving ? G.dive : 0;
      if (diving && e.dashVel) {
        const fd = fwdXY(t.heading), sp = Math.hypot(e.dashVel[0], e.dashVel[1]);
        if (sp < G.maxSpeed) e.dashVel = [e.dashVel[0] + fd[0] * G.diveDrive * dt, e.dashVel[1] + fd[1] * G.diveDrive * dt];
      }
      lean(diving ? G.diveLean : 0);
      // in the air the key held casts (again after `cool`, a line cut or met); on the ground a press zips, and in the
      // air a second tap does (the key pressed again within `tapWin` of a line let go as soon as it was cast)
      const tapZip = !e.grounded && pressed && e._gearTap > 0;
      if (!tapZip && (e._gearCool > 0 || (e.grounded ? !pressed : !key))) return false;
      const A = anchorFor(e, G, cs, { walls: e.grounded || tapZip });
      if (!A) return false;
      if (e.grounded || tapZip) {
        // the zip: to the face, a body's radius off it
        const to = [A.q[0], A.q[1], A.q[2] - H * 0.9 + eye];
        to[A.face.ax] = A.face.at + A.face.s * R;
        e.zipping = { to, face: A.face, anchor: A.q, top: A.top ?? null, hand: handFor(e, A.q) };
        e.swinging = null; e._gearTap = 0; e.diving = 0; upright();
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
      // (how far it may stretch: its share of its length, and never so far that the arc's bottom meets the street)
      e.swinging = { anchor: A.q, pivot, L: D, to: L, most: Math.max(L, Math.min(L * (1 + Math.max(0, G.stretch)), room - clear * 0.75)), face: A.face, v: [v0[0], v0[1], e.vel[2]], age: 0, hand: handFor(e, A.q) };
      e.diving = 0;
      e.launchedBy = null; e.launchLock = false;
    }

    const S = e.swinging;
    S.age = (S.age || 0) + dt;
    // (a line let go as soon as it is cast is a TAP: no fling, no turn, and the key again within `tapWin` zips)
    if (!key && S.age <= G.tapT) { e._gearTap = G.tapWin; S.ext = 0; release(S.v, 'tap'); e._gearCool = 0; return true; }
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
    S.ext = 0;
    if (D > S.L) {
      const u = scl(d, 1 / D), most = Math.max(S.L, S.most ?? S.L);
      S.ext = Math.min(D, most) - S.L;
      let out = v[0] * u[0] + v[1] * u[1] + v[2] * u[2];
      // THE STRETCH: the line pulls back by its strain, and throws harder shortening than it took lengthening
      if (G.stretch > 0) {
        const pull = G.spring * ((Math.min(D, most) - S.L) / S.L) * (out < 0 ? G.recoil : 1) * dt;
        v = sub(v, scl(u, pull)); out -= pull;
      }
      // taut at its full stretch: the hand held there, nothing more let out
      if (D > most) {
        p = add(S.pivot, scl(u, most)); p[2] -= hOff;
        if (out > 0) v = sub(v, scl(u, out));
      }
    }
    // the line crossed by a box, the body met by one, or the ground under it: let go
    const feet = p[2] - eye, hit = inBox(cs, p, feet, R, H), gz = ground(p);
    const hp = [p[0], p[1], p[2] + hOff], toA = sub(S.anchor, hp), lineCut = E.nearestWallT(hp, sub(S.anchor, scl(toA, EPS / Math.max(EPS, len(toA)))), cs);
    // (met by a box: the speed it came in at is carried to the wall, which runs with it where the rule has `wall`)
    if (hit) { e.swinging = null; e._gearCool = G.cool; e.vel = [0, 0, 0]; e.dashVel = null; e.swung = { end: 'met' }; e._carry = { v: [v[0], v[1], v[2]], t: 0.25 }; upright(); return true; }
    if (gz != null && feet <= gz + EPS) { t.pos = [p[0], p[1], gz + eye]; release([v[0], v[1], 0], 'ground'); return true; }
    if (lineCut != null && lineCut < 1 - 1e-6) { t.pos = p; release(v, 'cut'); return true; }
    t.pos = p; S.v = v;
    if (Math.hypot(v[0], v[1]) > EPS) t.heading = Math.atan2(v[1], v[0]);
    e.vel = [0, 0, 0]; e.dashVel = null; e.grounded = false; e.coyote = 1; e.jumpBuf = 0;
    const arc = Math.atan2(d[0] * f[0] + d[1] * f[1], -d[2]);
    e.locomotion = S.hand === 'L' ? 'swing_left' : 'swing'; e.moving = true; e.gaitPhase = clamp(0.5 + arc / Math.PI, 0, 0.999);
    // THE HANG: the body along its line (up toward the pivot), eased in over a quarter second as the line takes it (from
    // a somersault's angle where a line is cast in one); the turn about the body's left, so leaning back is negative
    if (G.hang > 0) {
      const T0 = e._gearTurn, want = -arc * G.hang;
      // (cast in a somersault, the line takes the body from where it is, brought within a half turn of upright)
      const now = e.tumble && e.tumble.angle ? Math.atan2(Math.sin(e.tumble.angle), Math.cos(e.tumble.angle)) : 0;
      const T = T0 && !T0.flip ? T0 : { base: T0 ? now : 0, in: 0, want };
      T.in = Math.min(1, T.in + dt / 0.25);
      T.w = (want - T.want) / Math.max(dt, 1e-6); T.want = want;
      T.angle = T.base * (1 - T.in) + want * T.in;
      e._gearTurn = T;
      e.tumble = Math.abs(T.angle) > 1e-4 ? { axis: [-f[1], f[0], 0], angle: T.angle } : null;
    }
    return true;
  }, 57);

  // SWING RELEASE: the flight after a line is let go, until the body lands or holds again
  E.registerWorldPass('gear-pose', (state) => {
    for (const e of state.entities) if (geared(e) && e.diving && !e.grounded && !e.swinging && !e.zipping && !e.walling) { e.locomotion = 'dive'; e.moving = true; }
    for (const e of state.entities) if (geared(e) && !e.swinging && !e.zipping && !e.walling && !e.grounded && (e._gearRel > 0 || (e._gearTurn && e._gearTurn.flip && e._gearTurn.flip.turns))) {
      e.locomotion = 'swing_release';
      // (a somersault's clip plays across the turn: the tuck in its middle, the body open as it rights)
      if (e._gearTurn && e._gearTurn.flip && e._gearTurn.flip.turns) { e.moving = true; e.gaitPhase = Math.min(0.999, e._gearTurn.u || 0); }
    }
  }, 27);
}

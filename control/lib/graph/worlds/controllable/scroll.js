/**
 * scroll.js — THE SCROLL STAGE'S RUNTIME (Blaze Gunner, a scrolling shooter; its frame gameworld/scroll-stage/frame.js):
 * a screen that scrolls on its own down a track, and a ship moved about it on the d-pad. Play is one plane, written in
 * SCREEN AXES (u along the scroll, ahead +u; v across it); the camera's `view` stands them in the world:
 *
 *   side   along +y (the screen's right), across +z (its up), the camera on +x: left to right, the side map's frame
 *   top    along +y (the screen's up), across −x (its left), the camera on +z looking down: bottom to top
 *
 *   the TRACK    the camera rule `scroll`: the screen's centre [u, v] carried down `track`, a list of legs run in order:
 *                { by: [du, dv], pace } moved by that much at `pace` m/s (a leg across is the stage turning: up a shaft,
 *                down a fall); { hold: s } held that many seconds; { hold: true, until: id } held until that body is
 *                down or gone (a boss). Past the last leg the screen stands (`scrollEnd`). Advanced in a pre-step, before
 *                any body moves, so a ship carried by it and the camera that frames it read the same centre the same
 *                frame; the camera is placed after them all (`cameraAt`: `dist` off the plane, looking square at it, its
 *                `up` the view's)
 *   the SHIP     the rule `scroll-ship`: moved by the d-pad's eight ways (the stick snapped to them: digital, no inertia,
 *                no flight model), the diagonals as fast as the straights, at its GEAR's speed (`gears`: shares of the
 *                screen across a second, Einhander's speed switch; `cycle` steps up through them and round). It stands
 *                at the screen's centre plus its offset, held inside the frame (half the screen less the edge kept,
 *                `margin` of the screen across, and half the ship, `size` [length, breadth]), so the scroll carries it
 *                and the frame's edges stop it. It faces ahead (+u) and tilts into a move across: pitched in the side
 *                view, banked in the top (`tilt`)
 *
 *   camera: { rule: 'scroll', target, view?: 'side' | 'top', dist, screen: [along, across], start?: [u, v], track: [leg] }
 *           (an interior's corridor?: [[u, lo, hi]] knots and walls?: [[u0, u1, v0, v1]] bulkheads, read by scroll-foes.js and
 *           scroll-pods.js: terrain, and what stops rounds)
 *   ship rule: { type: 'scroll-ship', frame?: camera id ('__camera'), gears?: [share…], gear?: index, size?: [l, b],
 *                margin?, tiltInto?, tiltRate?, deadzone?, lives?, hp?, respawn? (s, 1.5), reguard? (s, 2.5) }
 *   LIVES        down (its hp spent), blown apart and gone; `respawn` seconds on, a life spent, back home on the screen,
 *                whole, unhurt for `reguard` seconds; the last spent, the stage over (`state.scrollOver`)
 *
 * Field ownership: the camera's e._sc (the centre [u, v]), e._leg, e._legAt (metres or seconds into it), e._from (where a leg began), e.scrollVel
 * ([du, dv] m/s this frame), e.scrollEnd, e.frame ({ u0, u1, v0, v1 }), e.lookAt, e.up; the ship's e.off (its offset
 * [u, v] from the centre), e.screenAt ([u, v] on the plane), e.gear, e._cyclePrev, e.tilt, e.thrust, and the flight
 * facts (airspeed, airborne, locomotion, moving); its livesLeft, _downAt, and on a respawn its downed, gone, hp, _iT; the
 * world's scrollOver.
 *
 * Import-free (the page runs this source, compose.js): emitted only into a page whose camera is a scroll stage's, so
 * every other page keeps every byte.
 */

export function buildScroll(E) {
  const { clamp, RULES, registerPreStep, registerWorldPass } = E;
  // (the views' bases: gameworld/scroll-stage/frame.js SCROLL_VIEWS, carried here as source; a test holds them equal)
  const VIEWS = {
    side: { along: [0, 1, 0], across: [0, 0, 1], toward: [1, 0, 0], up: [0, 0, 1] },
    top: { along: [0, 1, 0], across: [-1, 0, 0], toward: [0, 0, 1], up: [0, 1, 0] },
  };
  const viewOf = (cam) => VIEWS[cam && cam.rule && cam.rule.view === 'top' ? 'top' : 'side'];
  const world3 = (B, u, v, d) => [B.along[0] * u + B.across[0] * v + B.toward[0] * d, B.along[1] * u + B.across[1] * v + B.toward[1] * d, B.along[2] * u + B.across[2] * v + B.toward[2] * d];
  const isDown = (b) => !b || b.gone || b.downed;

  // THE TRACK: the screen's centre carried leg by leg; what a leg leaves of the frame's time runs into the next
  function advance(c, dt, state) {
    const r = c.rule, T = Array.isArray(r.track) ? r.track : [];
    if (!c._sc) { c._sc = Array.isArray(r.start) ? [r.start[0], r.start[1]] : [0, 0]; c._leg = 0; c._legAt = 0; }
    const was = [c._sc[0], c._sc[1]];
    let left = dt;
    for (let guard = 0; left > 0 && c._leg < T.length && guard < 64; guard++) {
      const L = T[c._leg] || {};
      if (L.hold !== undefined) {
        if (L.until != null) { if (isDown(state.byId[L.until])) { c._leg++; c._legAt = 0; continue; } break; }
        const need = (Number(L.hold) || 0) - c._legAt;
        if (need > left) { c._legAt += left; left = 0; break; }
        left -= Math.max(0, need); c._leg++; c._legAt = 0; continue;
      }
      const by = Array.isArray(L.by) ? L.by : [0, 0], len = Math.hypot(by[0], by[1]), pace = L.pace > 0 ? L.pace : 0;
      if (!(len > 0) || !(pace > 0)) { c._leg++; c._legAt = 0; continue; }
      // (laid from where the leg began, its end exactly its `by` on: legs never gather a drift)
      if (c._legAt === 0 || !c._from) c._from = [c._sc[0], c._sc[1]];
      const go = Math.min(len - c._legAt, pace * left);
      c._legAt += go; left -= go / pace;
      const f = Math.min(1, c._legAt / len);
      c._sc[0] = c._from[0] + by[0] * f; c._sc[1] = c._from[1] + by[1] * f;
      if (c._legAt >= len - 1e-9) { c._sc[0] = c._from[0] + by[0]; c._sc[1] = c._from[1] + by[1]; c._leg++; c._legAt = 0; c._from = null; } else break;
    }
    c.scrollVel = dt > 0 ? [(c._sc[0] - was[0]) / dt, (c._sc[1] - was[1]) / dt] : [0, 0];
    c.scrollEnd = c._leg >= T.length;
  }
  registerPreStep('scroll-track', (state, input, dt) => {
    const c = state.camera;
    if (c && c.rule && c.rule.type === 'scroll') advance(c, dt, state);
    return null;
  }, 45);

  // THE CAMERA: placed square to the plane over the centre, after every body has moved
  function scroll(e) {
    const r = e.rule, B = viewOf(e);
    if (!e._sc) return;
    const W = (r.screen && r.screen[0]) || 0, H = (r.screen && r.screen[1]) || 0, u = e._sc[0], v = e._sc[1];
    e.frame = { u0: u - W / 2, u1: u + W / 2, v0: v - H / 2, v1: v + H / 2 };
    e.transform.pos = world3(B, u, v, r.dist > 0 ? r.dist : 100);
    e.lookAt = world3(B, u, v, 0);
    e.up = B.up.slice();
    e.transform.heading = Math.atan2(-B.toward[1], -B.toward[0]);
    e.transform.pitch = Math.asin(clamp(-B.toward[2], -1, 1));
  }

  // THE SHIP: the d-pad's eight ways at its gear's speed, about the centre, inside the frame
  const snap = (x, dz) => (x > dz ? 1 : x < -dz ? -1 : 0);
  function scrollShip(e, input, dt, world) {
    const r = e.rule, cam = world.byId[r.frame || '__camera'];
    if (!cam || !cam._sc || !cam.rule || cam.rule.type !== 'scroll' || e.gone) return;
    const B = viewOf(cam), top = B === VIEWS.top, scr = cam.rule.screen || [0, 0], SA = scr[0], SC = scr[1];
    // the gear: `cycle` steps up through them and round, on its press
    const G = Array.isArray(r.gears) && r.gears.length ? r.gears : [0.45, 0.65, 0.9];
    if (e.gear == null) e.gear = clamp(r.gear | 0, 0, G.length - 1);
    const cyc = input.cycle ? 1 : 0;
    if (cyc && !e._cyclePrev) e.gear = (e.gear + 1) % G.length;
    e._cyclePrev = cyc;
    // the d-pad: screen right (turn) and up (forward), snapped to the eight ways, as screen axes
    const dz = r.deadzone ?? 0.3, rx = snap(input.turn || 0, dz), ry = snap(input.forward || 0, dz);
    let du = top ? ry : rx, dv = top ? -rx : ry;
    if (du && dv) { du *= Math.SQRT1_2; dv *= Math.SQRT1_2; }
    const speed = G[e.gear] * SC;
    if (!e.off) e.off = Array.isArray(r.at) ? [r.at[0], r.at[1]] : [-SA / 4, 0];
    const size = Array.isArray(r.size) ? r.size : [0, 0], edge = (r.margin ?? 1 / 30) * SC;
    const hu = Math.max(0, SA / 2 - edge - size[0] / 2), hv = Math.max(0, SC / 2 - edge - size[1] / 2);
    e.off[0] = clamp(e.off[0] + du * speed * dt, -hu, hu);
    e.off[1] = clamp(e.off[1] + dv * speed * dt, -hv, hv);
    const u = cam._sc[0] + e.off[0], v = cam._sc[1] + e.off[1];
    e.screenAt = [u, v];
    e.transform.pos = world3(B, u, v, 0);
    // facing ahead, tilted into a move across: pitched in the side view, banked in the top
    e.transform.heading = Math.atan2(B.along[1], B.along[0]);
    const k = Math.min(1, (r.tiltRate ?? 10) * dt), want = dv * (r.tiltInto ?? 0.3), was = e.tilt || { pitch: 0, roll: 0 };
    const pitch = top ? 0 : was.pitch + (want - was.pitch) * k, roll = top ? was.roll + (-want - was.roll) * k : 0;
    e.transform.pitch = pitch;
    e.tilt = { pitch, roll };
    e.bank = roll;
    // the facts: its drive's burn (harder pressing ahead, eased back), and what a flight's readers take
    e.thrust = du > 0 ? 1 : du < 0 ? 0.35 : 0.6;
    const vel = cam.scrollVel || [0, 0];
    e.airspeed = Math.hypot(vel[0] + du * speed, vel[1] + dv * speed);
    e.airborne = true; e.locomotion = 'fly'; e.moving = true;
  }

  Object.assign(RULES, { scroll, 'scroll-ship': scrollShip });

  // LIVES: the ship down (its hp spent by the foes' fire) is blown apart by the death burst (combat-match.js, its body's
  // blast) and gone; `respawn` seconds later, a life spent, it is back at its home on the screen, whole, unhurt for
  // `reguard` seconds; the last life spent, the stage is over (`state.scrollOver`). A ship without `lives` keeps none.
  registerWorldPass('scroll-lives', (state) => {
    const ship = state.pilotId && state.byId[state.pilotId], r = ship && ship.rule;
    if (!r || r.type !== 'scroll-ship' || !(r.lives >= 0) || !ship.downed) return;
    if (ship.livesLeft == null) ship.livesLeft = r.lives;
    if (ship._downAt == null) ship._downAt = state.time;
    if (state.time - ship._downAt < (r.respawn ?? 1.5)) return;
    if (ship.livesLeft <= 0) { state.scrollOver = true; return; }
    ship.livesLeft -= 1; ship._downAt = null;
    ship.downed = false; ship.gone = false; ship.deathBurstDone = false; ship.deadAt = null;
    if (ship.body) ship.body.hp = r.hp || 10;
    ship._iT = r.reguard ?? 2.5;
    ship.off = Array.isArray(r.at) ? [r.at[0], r.at[1]] : null;
    ship.strikes = []; ship.beam = null; ship.orbit = null;
  }, 120);
}

/**
 * free-run.js — GETTING OVER THINGS: a body that runs at a low obstacle goes over it, and one that jumps at a taller one
 * climbs it. The runtime's half of the free-run library (polygonizer/hero-vault.js solves the clips; this carries the
 * body). Opt-in on the pilot's rule:
 *
 *   rule.freeRun: {
 *     vault?: 1.15,     the tallest thing gone over out of the run (metres over the feet: about the hip)
 *     climb?: 2.2,      the tallest thing climbed (a standing reach and a pull)
 *     depth?: 1.6,      the deepest thing vaulted across; a deeper one is climbed onto, or run round
 *     reach?: 0.7,      how far ahead of the body a thing is taken from
 *     speed?: 2,        the pace (m/s over the ground) a vault is taken at; under it the body stops at the thing
 *     clipH?: 0.5,      the box height the body's own vault clip was solved for (polygonizer/hero-vault.js): the clip
 *                       carries the body over a box that tall, so the body is lifted only by what the thing is taller
 *                       than that, and passes just over its top. Absent, the body is carried over on an arc of its own
 *     grab?: 2.15,      the highest edge the hands reach to take hold of (a standing reach on the toes): a climb's limit
 *     on?: 'push',      what climbs. 'push': nothing is pressed: the stick held into the thing for `hold` seconds climbs
 *                       it (and takes a low thing the body walked up to too slowly to vault). 'act': the action
 *                       (`input.act`). Absent, the jump
 *     hold?: 0.25,      the seconds of push a climb waits for
 *   }
 *
 *   A VAULT  the body moving at `speed` or more, on the ground, a box ahead within `reach` whose top is over a step and
 *            no higher than `vault`, no deeper than `depth`, and room to land beyond it: it goes over on an arc that
 *            clears the top, at the pace it came in with, and lands running. Nothing is pressed.
 *   A CLIMB  the jump (or the action, `on`) pressed facing a thing within `reach` whose top is over `vault`, where the
 *            hands REACH ITS EDGE (no higher than `grab`, and no higher than `climb`) and there is room to stand on it.
 *            It is solved from the hands: they take the edge and stay on it, and the body is wherever that puts it as
 *            the arms work (HANDS: the hands' height over the feet through the reach, the pull to the chest, the press
 *            to the hips and the step up), so the feet leave the ground only once the arms have drawn up to the edge,
 *            and it comes in over the lip as it presses, FROM THE SIDE: a leg onto the ledge first, the body rolled
 *            over it, so it stands a little to that side of where it took hold (the right, else the left). The jump is not taken. WHAT IS IN ITS HAND IS PUT AWAY for
 *            the climb (the body's `weapon` null through it, so nothing draws it in a hand that is on the edge), and
 *            is in hand again as it stands.
 *   Either is refused, and the body stops or jumps as it would, when another box stands where it would land or over
 *   the top it would cross.
 *
 * The page plays `e.locomotion`: `vault` over a vault, `mantle` up a climb (a figure without the clip plays its
 * fallback, playscape/player.js TRAVERSAL_FALLBACK), `e.gaitPhase` the share of the move done.
 * Field ownership: e.fr ({ kind, t, dur, from, to, top, over, gun, side }) while a move runs; e.frJump (the press's last
 * read), e.frPush (the seconds pushed), e.frV (its pace over the ground); the pilot's `weapon` through a climb.
 *
 * Wraps stepWorld (as gunplay.js does), so the pinned pipeline order is untouched. Import-free (the page runs this source
 * via toString(), compose.js); emitted only into a page whose world has a rule with `freeRun`, so every other page keeps
 * every byte.
 */
export function buildFreeRun(E) {
  const step = E.stepWorld;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const STEP = 0.35, CLEAR = 0.2, HEAD = 1.7, LAND = 0.45;
  // THE THING AHEAD of `p` along `d` within `reach`: the boxes the body's line meets, taken as ONE thing where they touch
  // (a wall laid in courses, crates stacked: each a box of its own): the first met, then every box that stands on it or
  // against it along the line. → { set, tin, tout, top, h } (h: its top over the feet), or null
  function ahead(boxes, p, d, rad, reach, feet, tall) {
    const hits = [];
    for (const b of boxes) {
      if (b.max[2] <= feet + STEP || b.min[2] > feet + tall) continue;
      let tin = -Infinity, tout = Infinity, out = false;
      for (let k = 0; k < 2; k++) {
        const lo = b.min[k] - rad, hi = b.max[k] + rad;
        if (Math.abs(d[k]) < 1e-9) { if (p[k] < lo || p[k] > hi) { out = true; break; } continue; }
        const a = (lo - p[k]) / d[k], c = (hi - p[k]) / d[k];
        tin = Math.max(tin, Math.min(a, c)); tout = Math.min(tout, Math.max(a, c));
      }
      if (out || tout < tin || tout < 0 || tin < -rad * 2) continue;
      hits.push({ b, tin, tout });
    }
    hits.sort((x, y) => x.tin - y.tin || x.b.min[2] - y.b.min[2]);
    // (the first thing met is one that stands in the body's way from the ground: over a step, under its head)
    const k0 = hits.findIndex((x) => x.tin <= reach && x.b.min[2] <= feet + STEP);
    if (k0 < 0) return null;
    const A = { set: [hits[k0].b], tin: hits[k0].tin, tout: hits[k0].tout, top: hits[k0].b.max[2] };
    for (let grew = true; grew;) {
      grew = false;
      for (const x of hits) {
        if (A.set.includes(x.b) || x.tin > A.tout + 0.05 || x.tout < A.tin - 0.05 || x.b.min[2] > A.top + 0.05) continue;
        A.set.push(x.b); A.tin = Math.min(A.tin, x.tin); A.tout = Math.max(A.tout, x.tout); A.top = Math.max(A.top, x.b.max[2]); grew = true;
      }
    }
    A.h = A.top - feet;
    return A;
  }
  // whether a body's hull at `q` (its feet at z) is clear of every box but the thing's own
  function free(boxes, q, z, rad, own) {
    for (const b of boxes) {
      if (own.includes(b)) continue;
      if (q[0] > b.min[0] - rad && q[0] < b.max[0] + rad && q[1] > b.min[1] - rad && q[1] < b.max[1] + rad && b.max[2] > z + STEP && b.min[2] < z + HEAD) return false;
    }
    return true;
  }
  function plan(state, e, input, hooks, jumped) {
    const F = e.rule.freeRun, boxes = state.colliders;
    if (!boxes || !e.grounded || e.downed || e.gone || e.swingT != null) return null;
    const t = e.transform, eye = e.rule.eye || 0, feet = t.pos[2] - eye, rad = e.rule.collideRadius ?? 0.3;
    const v = e.frV || [0, 0], pace = Math.hypot(v[0], v[1]);
    const d = pace > 0.5 ? [v[0] / pace, v[1] / pace] : [Math.cos(t.heading), Math.sin(t.heading)];
    const vaultH = F.vault ?? 1.15, climbH = F.climb ?? 2.2;
    const A = ahead(boxes, t.pos, d, rad, F.reach ?? 0.7, feet, HEAD + climbH);
    if (!A) return null;
    const deep = A.tout - A.tin - 2 * rad, top = A.top;
    const beyond = [t.pos[0] + d[0] * (A.tout + LAND), t.pos[1] + d[1] * (A.tout + LAND)];
    const groundAt = (q, from) => { const g = hooks && hooks.ground ? hooks.ground([q[0], q[1], from]) : null; return g == null ? feet : g; };
    const over = (kind, dur) => {
      const gz = groundAt(beyond, feet + STEP);
      if (!free(boxes, beyond, gz, rad, A.set) || gz > feet + STEP || gz < feet - 2.5) return null;
      // (nothing over the top it crosses)
      const mid = [t.pos[0] + d[0] * (A.tin + A.tout) / 2, t.pos[1] + d[1] * (A.tin + A.tout) / 2];
      if (!free(boxes, mid, top, rad, A.set)) return null;
      return { kind, t: 0, dur, from: [t.pos[0], t.pos[1], feet], to: [beyond[0], beyond[1], gz], top, over: true };
    };
    if (A.h <= vaultH && deep <= (F.depth ?? 1.6)) {
      if (pace < (F.speed ?? 2) && !jumped) return null;
      const far = A.tout + LAND;
      const M = over('vault', clamp(far / Math.max(pace, 3), 0.45, 0.95));
      if (M && F.clipH > 0) M.lift = Math.max(0, top - feet - F.clipH) + 0.04;
      return M;
    }
    // a climb: the hands must reach the edge, and there must be room to stand on the top
    if (!jumped || A.h > climbH || A.h > (F.grab ?? 2.15)) return null;
    // (FROM THE SIDE: a leg goes onto the ledge first and the body rolls over it, so it comes up a little to that side
    // of where it took hold: the right where there is room on the top there, else the left, else straight)
    const inn = A.tin + rad + Math.min(0.45, Math.max(0.1, deep / 2)), rt = [d[1], -d[0]];
    const onAt = (k) => [t.pos[0] + d[0] * inn + rt[0] * k, t.pos[1] + d[1] * inn + rt[1] * k];
    const under = (q) => boxes.some((b) => A.set.includes(b) && Math.abs(b.max[2] - top) < 0.05 && q[0] >= b.min[0] && q[0] <= b.max[0] && q[1] >= b.min[1] && q[1] <= b.max[1]);
    const side = [0.3, -0.3, 0].find((k) => under(onAt(k)) && free(boxes, onAt(k), top, rad, A.set));
    if (side === undefined) return null;
    const on = onAt(side);
    // (it is taken from the thing's face: the body steps in to it as the hands go up)
    const face = [t.pos[0] + d[0] * Math.max(0, A.tin - 0.02), t.pos[1] + d[1] * Math.max(0, A.tin - 0.02)];
    return { kind: 'climb', t: 0, dur: 1.0 + 0.5 * A.h, from: [t.pos[0], t.pos[1], feet], face, to: [on[0], on[1], top], top, over: false, side: Math.sign(side) };
  }
  // THE HANDS over the feet through a climb, as its clip plays them: the reach, the hang, the pull to the chest, the
  // press to the hips, the knee up, standing (the hands then at the feet's own height: on the top)
  // (the leg goes onto the ledge at the pull's top, about 0.55 through, the body low beside the edge as it does, then
  // rolls over the leg onto the top)
  const HANDS = [[0, 2.05], [0.2, 2.05], [0.4, 1.55], [0.58, 1.25], [0.8, 0.5], [1, 0]];
  const handsAt = (s) => { for (let k = 1; k < HANDS.length; k++) if (s <= HANDS[k][0]) { const a = HANDS[k - 1], b = HANDS[k], u = (s - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * u; } return 0; };
  // where the body is `s` of the way through its move
  function at(M, s) {
    if (M.kind === 'vault') {
      const base = M.from[2] + (M.to[2] - M.from[2]) * s, hi = Math.max(M.from[2], M.to[2]);
      // (with the clip's own height known, the body is lifted only by what the thing is taller than the clip's box)
      const lift = M.lift != null ? M.lift : Math.max(0, M.top + CLEAR - hi) + hi - base;
      return [M.from[0] + (M.to[0] - M.from[0]) * s, M.from[1] + (M.to[1] - M.from[1]) * s, base + lift * Math.sin(Math.PI * s)];
    }
    // a climb: in to the face as the hands go up; the feet where the hands on the edge put them; in over the lip from
    // the press on
    const a = clamp(s / 0.2, 0, 1), inn = clamp((s - 0.55) / 0.45, 0, 1), ka = a * a * (3 - 2 * a), ki = inn * inn * (3 - 2 * inn);
    const x = M.from[0] + (M.face[0] - M.from[0]) * ka + (M.to[0] - M.face[0]) * ki, y = M.from[1] + (M.face[1] - M.from[1]) * ka + (M.to[1] - M.face[1]) * ki;
    return [x, y, Math.max(M.from[2], M.top - handsAt(s))];

  }
  E.stepWorld = function stepWithFreeRun(state, input, dt, hooks) {
    const p = state.pilotId ? state.byId[state.pilotId] : null;
    if (!p || !p.rule || !p.rule.freeRun || !input) return step(state, input, dt, hooks);
    const F = p.rule.freeRun, push = F.on === 'push';
    const press = push ? false : F.on === 'act' ? !!input.act : !!input.jump, jumped = press && !p.frJump; p.frJump = press;
    if (!p.fr) {
      let M = input.aim ? null : plan(state, p, input, hooks, jumped);
      // (the push: the stick held into a thing it could climb, or a low one it came to too slowly, for `hold` seconds)
      if (!M && push && !input.aim && Math.abs(input.forward || 0) + Math.abs(input.strafe || 0) + Math.abs(input.turn || 0) > 0.5) {
        const C = plan(state, p, input, hooks, true);
        p.frPush = C ? (p.frPush || 0) + dt : 0;
        if (C && p.frPush >= (F.hold ?? 0.25)) M = C;
      } else if (push) p.frPush = 0;
      if (M) { p.fr = M; p.frPush = 0; if (M.kind === 'climb' && p.weapon) { M.gun = p.weapon; p.weapon = null; } }
    }
    const M = p.fr, eye = p.rule.eye || 0, before = [p.transform.pos[0], p.transform.pos[1]];
    if (!M) {
      const out = step(state, input, dt, hooks);
      p.frV = dt > 0 ? [(p.transform.pos[0] - before[0]) / dt, (p.transform.pos[1] - before[1]) / dt] : p.frV;
      return out;
    }
    // the move: the world steps with the body's hands and its jump held off, then the body is where the move puts it
    const out = step(state, { ...input, jump: 0, jumpHeld: 0, fire: 0, aim: 0, melee: 0 }, dt, hooks);
    M.t = Math.min(1, M.t + dt / M.dur);
    const q = at(M, M.t);
    p.transform.pos = [q[0], q[1], q[2] + eye];
    if (Math.hypot(M.to[0] - M.from[0], M.to[1] - M.from[1]) > 1e-3) p.transform.heading = Math.atan2(M.to[1] - M.from[1], M.to[0] - M.from[0]);
    if (p.vel) p.vel[2] = 0;
    p.locomotion = M.kind === 'vault' ? 'vault' : 'mantle'; p.gaitPhase = Math.min(M.t, 0.999); p.moving = true;
    p.grounded = M.t >= 1;
    if (M.t >= 1) {
      // (what was put away for the climb is in hand again, unless it was put away for good meanwhile: carry.js)
      if (M.gun && !p.weapon && !(p.carry && p.carry.holstered)) p.weapon = M.gun;
      p.fr = null; p.frV = [(M.to[0] - M.from[0]) / M.dur, (M.to[1] - M.from[1]) / M.dur];
    }
    return out;
  };
}

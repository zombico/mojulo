/**
 * runner.js — the ENDLESS RUNNER (mobile-genres.plan.md): the pilot runs on its own, and the world comes at it.
 *
 * A world whose spec carries `runner` runs its pilot straight down its spawn heading, held to one of `lanes` lanes
 * `laneW` apart: a left or right press (a swipe on a phone, A / D, the stick) steps a lane, eased across; down slides
 * (under a bar; in the air it drops); jump is the platform rule's own. The speed climbs from `speed` by `accel` a second
 * to `max`. Ahead of the pilot, rows are laid from the runner's own seed (mulberry32, carried in the state): a BLOCK
 * fills a lane (step round it), a HURDLE is low across the way (jump it), a BAR is high across it (slide under it),
 * COINS run in a lane; every row leaves a way through. Rows behind are dropped. A hit is judged in 3D: the lane, the
 * run's length and the pilot's height above the floor (its feet, or its slide). A hit ends the run.
 *
 * The bus hears it (castFacts, wrapped here): `runner:coin` for a coin, `runner:run` each ten metres, `runner:crash`
 * once. The runner mechanic (game/mechanics.js) scores them. Pure state over the seed: the same spec and the same input
 * run the same rows. Import-free (the page runs this source via toString(), compose.js); emitted only into a page
 * whose world has a runner, so every other page keeps every byte.
 */

export function buildRunner(E) {
  const KINDS = { block: { len: 1.4, top: 3 }, hurdle: { len: 0.7, top: 0.75 }, bar: { len: 0.7, under: 1.05, top: 2.6 }, coin: { len: 0.9, top: 2.2 } };
  const DEFAULTS = { lanes: 3, laneW: 2.6, speed: 9, accel: 0.18, max: 22, ahead: 110, behind: 24, clear: 36, seed: 1, slide: 0.75, jump: 7.5 };

  // mulberry32 as a pure step on the runner's own state (the core's dice are the world's; these are the rows')
  const roll = (R) => {
    R.rng = (R.rng + 0x6d2b79f5) >>> 0;
    let t = R.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  E.registerStateInit((state, spec) => {
    if (!spec || !spec.runner || !state.pilotId) return;
    const me = state.byId[state.pilotId];
    if (!me) return;
    const S = { ...DEFAULTS, ...spec.runner };
    const h = me.transform.heading || 0, f = [Math.cos(h), Math.sin(h)], r = [Math.sin(h), -Math.cos(h)];
    const mid = (S.lanes - 1) / 2;
    state.runner = {
      spec: S, origin: [me.transform.pos[0], me.transform.pos[1]], z0: me.transform.pos[2] - (me.rule.eye || 0), heading: h, f, r,
      // (the seed mixed, so neighbouring seeds lay unlike rows from the first)
      lane: Math.round(mid), mid, lateral: 0, s: 0, speed: S.speed, rng: (Math.imul((S.seed >>> 0) ^ 0x9e3779b9, 0x85ebca6b) >>> 0) || 1, nextS: S.clear, rows: 0,
      items: [], coins: 0, tens: 0, slideT: 0, jumpT: 0, crashed: false, crashedAt: null, prevTurn: 0, prevDown: 0, prevJump: 0, height: me.rule.collideHeight || 1.7,
    };
    // a runner's jump clears a hurdle at speed: the rule's own jump, taken higher
    me.rule.jumpSpeed = S.jump;
  });

  // INPUT: the runner owns the pilot's steering: a press left or right steps a lane, down slides, forward is always on
  E.registerPreStep('runner', (state, input) => {
    const R = state.runner;
    if (!R) return null;
    if (R.crashed) return { ...input, forward: 0, strafe: 0, turn: 0, jump: 0, jumpHeld: 0, kneel: 0 };
    const side = (input.turn || 0) + (input.strafe || 0), down = (input.forward || 0) < -0.5 || input.kneel ? 1 : 0;
    const dir = side > 0.5 ? 1 : side < -0.5 ? -1 : 0;
    if (dir && dir !== R.prevTurn) R.lane = Math.max(0, Math.min(R.spec.lanes - 1, R.lane + dir));
    R.prevTurn = dir;
    if (down && !R.prevDown) R.slideT = R.spec.slide;
    R.prevDown = down;
    // a jump is held through its rise, so a flick up jumps as high as a key held down
    const jumped = input.jump && !R.prevJump;
    R.prevJump = input.jump ? 1 : 0;
    if (jumped) R.jumpT = 0.35;
    return { ...input, forward: 1, strafe: 0, turn: 0, kneel: 0, ...(R.jumpT > 0 ? { jumpHeld: 1 } : {}) };
  }, 15);

  // the row a seed lays at distance s: one of the patterns, each with a way through
  function layRow(R, s) {
    const L = R.spec.lanes, lane = () => Math.floor(roll(R) * L), p = roll(R), out = [];
    const id = () => 'r' + (R.rows) + '-' + out.length;
    const coins = (ln, n) => { for (let k = 0; k < n; k++) out.push({ id: id(), kind: 'coin', lane: ln, s: s + k * 2.2 }); };
    if (p < 0.3) { const b = lane(); out.push({ id: id(), kind: 'block', lane: b, s }); coins((b + 1 + Math.floor(roll(R) * (L - 1))) % L, 4); }
    else if (p < 0.48) { const free = lane(); for (let k = 0; k < L; k++) if (k !== free) out.push({ id: id(), kind: 'block', lane: k, s }); coins(free, 3); }
    else if (p < 0.62) { out.push({ id: id(), kind: 'hurdle', lane: -1, s }); coins(lane(), 3); }
    else if (p < 0.76) { out.push({ id: id(), kind: 'bar', lane: -1, s }); }
    else if (p < 0.9) { coins(lane(), 6); }
    else { const b = lane(); out.push({ id: id(), kind: 'block', lane: b, s }, { id: id(), kind: 'hurdle', lane: (b + 1) % L, s }); }
    R.rows++;
    return out;
  }

  // does the pilot meet item it? (its lane, the run's length, its height above the floor)
  function meets(R, me, it) {
    const K = KINDS[it.kind], ds = Math.abs(R.s - it.s);
    if (ds > K.len / 2 + 0.45) return false;
    const inLane = it.lane < 0 || Math.abs(R.lateral - (it.lane - R.mid) * R.spec.laneW) < R.spec.laneW * 0.55;
    if (!inLane) return false;
    const feet = me.transform.pos[2] - (me.rule.eye || 0) - R.z0;
    if (it.kind === 'hurdle') return feet < K.top;
    if (it.kind === 'bar') return R.slideT <= 0 && feet < K.top && feet + R.height > K.under;
    return feet < K.top;
  }

  E.registerWorldPass('runner', (state, input, dt) => {
    const R = state.runner, me = R && state.byId[state.pilotId];
    if (!R || !me) return;
    const S = R.spec;
    if (R.crashed) { me.rule.speed = 0; me.transform.pos[0] = R.origin[0] + R.f[0] * R.s + R.r[0] * R.lateral; me.transform.pos[1] = R.origin[1] + R.f[1] * R.s + R.r[1] * R.lateral; return; }
    // the run is the runner's: its distance at its speed, on the ground or in the air (the rule keeps only the height);
    // the speed climbs; the lane is eased across (fast: a step reads as a dodge); the heading holds
    R.speed = Math.min(S.max, R.speed + S.accel * dt);
    me.rule.speed = R.speed;
    R.s += R.speed * dt;
    R.jumpT = Math.max(0, R.jumpT - dt);
    const target = (R.lane - R.mid) * S.laneW;
    R.lateral += (target - R.lateral) * Math.min(1, dt * 14);
    me.transform.pos[0] = R.origin[0] + R.f[0] * R.s + R.r[0] * R.lateral;
    me.transform.pos[1] = R.origin[1] + R.f[1] * R.s + R.r[1] * R.lateral;
    me.transform.heading = R.heading;
    // the slide: low for a moment (a drop in the air)
    if (R.slideT > 0) {
      R.slideT = Math.max(0, R.slideT - dt);
      if (me.vel && me.grounded === false && me.vel[2] > -12) me.vel[2] = -12;
    }
    me.sliding = R.slideT > 0;
    // rows ahead laid, rows behind dropped
    while (R.nextS < R.s + S.ahead) {
      R.items.push(...layRow(R, R.nextS));
      R.nextS += Math.max(12, R.speed * 1.15) + roll(R) * 10;
    }
    R.items = R.items.filter((it) => it.s > R.s - S.behind);
    for (const it of R.items) {
      if (it.gone || !meets(R, me, it)) continue;
      if (it.kind === 'coin') { it.gone = true; R.coins++; continue; }
      R.crashed = true; R.crashedAt = { s: R.s, kind: it.kind, id: it.id };
      me.rule.speed = 0;
      break;
    }
    R.tens = Math.max(R.tens, Math.floor(R.s / 10));
  }, 5);

  // the bus hears the run: a coin, each ten metres, the crash (the castFacts the events channel reads, wrapped)
  const baseFacts = E.castFacts;
  E.castFacts = function castFacts(state, prev) {
    const out = baseFacts(state, prev), R = state.runner;
    if (!R) return out;
    const was = (prev && prev.__runner) || null, cur = { c: R.coins, t: R.tens, x: R.crashed };
    out.prev.__runner = cur;
    if (!was) return out;
    const who = state.pilotId;
    for (let k = was.c; k < cur.c; k++) out.events.push({ type: 'runner:coin', entity: who });
    for (let k = was.t; k < cur.t; k++) out.events.push({ type: 'runner:run', entity: who, at: (k + 1) * 10 });
    if (cur.x && !was.x) out.events.push({ type: 'runner:crash', entity: who, at: Math.round(R.s), kind: R.crashedAt.kind });
    return out;
  };

  Object.assign(E, { RUNNER_KINDS: KINDS, RUNNER_DEFAULTS: DEFAULTS });
}

// ── the recipe's side (Node only; the builder above is what the page runs) ────────────────────────────────────────
const RUNNER_KEYS = { lanes: [2, 5, true], laneW: [1.5, 5], speed: [3, 30], accel: [0, 2], max: [3, 40], ahead: [40, 300], behind: [5, 80], clear: [10, 200], seed: [0, 4294967295, true], slide: [0.2, 2], jump: [4, 14] };
const PALETTE_KEYS = ['ground', 'lane', 'edge', 'block', 'hurdle', 'bar', 'coin', 'post'];

/** A level's `runner` as written → itself (checked), or throws naming what is wrong. `true` takes every default. */
export function readRunner(v, where = 'runner') {
  if (v === true) return {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`${where} is true or { ${[...Object.keys(RUNNER_KEYS), 'palette'].join('?, ')}? }`);
  for (const [k, x] of Object.entries(v)) {
    if (k === 'palette') {
      if (!x || typeof x !== 'object' || Array.isArray(x)) throw new Error(`${where}.palette is { ${PALETTE_KEYS.join('?, ')}? } as #rrggbb`);
      for (const [p, c] of Object.entries(x)) if (!PALETTE_KEYS.includes(p) || !/^#[0-9a-fA-F]{6}$/.test(String(c))) throw new Error(`${where}.palette.${p}: the palette is { ${PALETTE_KEYS.join(', ')} } as #rrggbb`);
      continue;
    }
    const R = RUNNER_KEYS[k];
    if (!R) throw new Error(`${where}.${k} is not a runner setting (${[...Object.keys(RUNNER_KEYS), 'palette'].join(', ')})`);
    if (!(Number.isFinite(x) && x >= R[0] && x <= R[1] && (!R[2] || Number.isInteger(x)))) throw new Error(`${where}.${k} is ${R[2] ? 'a whole number ' : ''}${R[0]} to ${R[1]}`);
  }
  if (v.speed !== undefined && v.max !== undefined && v.max < v.speed) throw new Error(`${where}.max is the top speed, at least speed`);
  return v;
}

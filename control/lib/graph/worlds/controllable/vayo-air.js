/**
 * vayo-air.js — a blast's AIR on the world's fires (rupa-vayo; an OPT-IN builder, compose.js EMISSION_OPT_IN.vayoAir:
 * emitted only into a page whose world is on the flow, `fxStyle: { flow: true }`, and has fires, so every other page
 * keeps its bytes). The flow (rupa/vayo.js) draws a blast as the air moves it; this is the same air felt by what burns.
 *
 *   THE BLAST'S WIND  a burst's charge W (kg of TNT: rupa's cube-root scaling of its splash radius, × the world's power)
 *               makes an overpressure at a distance d that falls with the scaled distance Z = d / W^⅓ (Kinney–Graham),
 *               and the air behind its front moves at u = 5p·c₀ / (7·Mₛ), Mₛ = √(1 + 6p/7) (Rankine–Hugoniot, γ 1.4,
 *               p the overpressure over the air's): a kilogram's is about 300 m/s at 2 m, 60 at 5, 23 at 10, 10 at 20.
 *               A wall between the burst and a fire shelters it: a third of the wind gets round (`SHADOW`).
 *   A FIRE'S LIMIT    the air that strips a flame from its fuel grows with the flame's size (a Damköhler number: the
 *               bigger the flame, the longer its gas stays in it), u_bo = 3 m/s · (D / 1.2 cm)^0.7 for a fuel bed D
 *               across: a candle 3 m/s, a torch 10, a campfire 43, a metre's block about 70.
 *   THREE ZONES       FANNED under half its limit: more air to its bed, it burns faster by the bellows' own law
 *               (fire/fire.js: × (1 + 0.07·u)), the bed stoked for a couple of seconds after a blast (`STOKE`);
 *               STRAINING from half to all of it: its flame lifts off its bed and gutters (drawn, `strain` 0–1);
 *               BLOWN OUT past it. Inside a burst's own fireball (its splash radius) the heat wins: rupa's blows light
 *               what it reaches, and no air is reckoned there.
 *
 * A VAYO MOVER's wake (vayo-move.js) is a source too: behind a body of radius R moving at v (its fiction's speed) the
 * air's deficit falls as v·(R/d)^⅔ (a three-dimensional wake, Tennekes & Lumley), so a dash past a torch fans it or puts
 * it out by the same zones.
 *
 * With destructible physics (rupa.js) a burning block blown out stops burning (`how: 'blowout'` on the hits), its plume
 * ends, and the blast's air cools its face to just under its ignition (`RELIGHT` below): a neighbour still burning
 * relights it within a second or two, and a lone one cools out. Its hot bed smoulders a wisp (a short fire smoke source at
 * a smoulder's heat, `SMOULDER` of its flame's, and a smoulder's soot yield). The world's wind fans and strains a block's
 * fire the same way, a few times a second, and a gale past its limit blows it out.
 *
 * On the page (scene/channels/fire.js, `cfg.air`) a fire's air is the wind and each recent blast's (`gustAt`: outward,
 * held for the eye over `HOLD` seconds, at most `LOOK` m/s), so a flame leans away and the bellows flares it; the page
 * reads `b.rupa.air` ({ base, fan, fanAt, strain, blown }) for the gutter, the quick death and the bed's glow, and blows
 * out a fire the physics does not hold (a torch, a candle) by the same law (`peakAt`).
 *
 *   blastWind(kg, d) → m/s · blowout(D) → m/s · fanOf(u, ubo) → × burn rate · strainOf(u, ubo) → 0–1
 *   E.vayoAir: { …those, gustAt(state, p) → [u, v, w], peakAt(state, g, p) → m/s }
 *
 * BUILDER CONTRACT (compose.js): import-free inside the function. State: `state.vayoAir = { gusts, seen, windAt }` when
 * the world spec says `vayoAir: true`; a block's own on `b.rupa.air`.
 */

export function buildVayoAir(E) {
  const C0 = 343, U_BO = 3, D_BO = 0.012, P_BO = 0.7, FAN = 0.07, STOKE = 2, SHADOW = 1 / 3, RELIGHT = 10, SMOULDER = 0.1, SMOULDER_YIELD = 0.1, WISP = 2.5;
  const HOLD = 0.5, LOOK = 20, GUST_LIFE = 3, GUSTS = 32, EPS = 0.05;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  // Kinney–Graham: a blast's overpressure over the air's at a scaled distance Z (m/kg^⅓)
  const overpressure = (Z) => { const z = Math.max(Z, 0.05); return (808 * (1 + (z / 4.5) ** 2)) / Math.sqrt((1 + (z / 0.048) ** 2) * (1 + (z / 0.32) ** 2) * (1 + (z / 1.35) ** 2)); };
  // the air behind the front (Rankine–Hugoniot, γ 1.4)
  const blastWind = (kg, d) => { if (!(kg > 0)) return 0; const p = overpressure(Math.max(0, d) / Math.cbrt(kg)); return (5 * p * C0) / (7 * Math.sqrt(1 + (6 * p) / 7)); };
  const blowout = (D) => U_BO * Math.pow(Math.max(D, 0.005) / D_BO, P_BO);
  const fanOf = (u, ubo) => 1 + FAN * Math.min(Math.max(0, u), 0.5 * ubo);
  const strainOf = (u, ubo) => clamp((u / ubo - 0.5) / 0.5, 0, 1);
  // a ray from a to b against the world's solid boxes (not those holding either end, nor `skip`): does one stand between?
  function blocked(state, a, b, skip) {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], inside = (c, p) => p[0] > c.min[0] && p[0] < c.max[0] && p[1] > c.min[1] && p[1] < c.max[1] && p[2] > c.min[2] && p[2] < c.max[2];
    for (const c of state.colliders || []) {
      if (!c || !c.min || !c.max || c === skip || inside(c, a) || inside(c, b)) continue;
      let t0 = 0, t1 = 1, ok = true;
      for (let k = 0; k < 3 && ok; k++) {
        if (Math.abs(d[k]) < 1e-9) { if (a[k] < c.min[k] || a[k] > c.max[k]) ok = false; continue; }
        const p = (c.min[k] - a[k]) / d[k], q = (c.max[k] - a[k]) / d[k];
        t0 = Math.max(t0, Math.min(p, q)); t1 = Math.min(t1, Math.max(p, q)); if (t0 > t1) ok = false;
      }
      if (ok) return true;
    }
    return false;
  }
  // a gust's peak wind at a point: none inside its fireball (its heat's: a box any of which it reaches, as rupa's blows
  // reckon it), sheltered behind a wall
  const boxDist = (b, p) => Math.hypot(...[0, 1, 2].map((k) => Math.max(b.min[k] - p[k], 0, p[k] - b.max[k])));
  function peakAt(state, g, p, skip = null) {
    const d = Math.hypot(p[0] - g.at[0], p[1] - g.at[1], p[2] - g.at[2]);
    // a mover's wake (vayo-move.js): the deficit behind a body of radius R at speed v falls as (R/d)^⅔ (a 3D wake)
    if (g.wake) return g.v * Math.min(1, Math.pow(g.R / Math.max(d, 1e-6), 2 / 3)) * (blocked(state, g.at, p, skip) ? SHADOW : 1);
    if ((skip && skip.min ? boxDist(skip, g.at) : d) <= g.r + EPS) return 0;
    return blastWind(g.kg, d) * (blocked(state, g.at, p, skip) ? SHADOW : 1);
  }
  // the air the page draws a flame in, from the blasts of the last few seconds: outward, held for the eye, capped for the
  // look (a shelter is asked once a gust and place: the page asks every frame)
  function gustAt(state, p) {
    const A = state.vayoAir, out = [0, 0, 0];
    if (!A || !A.gusts.length) return out;
    for (const g of A.gusts) {
      const tau = state.time - g.t; if (tau < 0 || tau > 4 * HOLD) continue;
      const dx = p[0] - g.at[0], dy = p[1] - g.at[1], dz = p[2] - g.at[2], d = Math.hypot(dx, dy, dz) || 1;
      const key = `${Math.round(p[0] * 2)},${Math.round(p[1] * 2)},${Math.round(p[2] * 2)}`;
      let u = g.seen[key];
      if (u === undefined) { u = Math.min(LOOK, peakAt(state, g, p)); g.seen[key] = u; }
      const s = u * Math.exp(-tau / HOLD) / d;
      out[0] += dx * s; out[1] += dy * s; out[2] += dz * s;
    }
    return out;
  }
  E.vayoAir = { blastWind, blowout, fanOf, strainOf, peakAt, gustAt, HOLD, SHADOW };
  if (!E.registerWorldPass) return;

  E.registerStateInit((state, spec) => { if (spec.vayoAir) state.vayoAir = { gusts: [], seen: -1, windAt: -1, pending: [] }; });
  const footD = (b) => Math.sqrt((4 * (b.max[0] - b.min[0]) * (b.max[1] - b.min[1])) / Math.PI);
  const flameAt = (b) => [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, b.max[2] + 0.2];
  // a block's air state (its burn rate as it was minted is its base)
  const airOf = (r) => r.air || (r.air = { base: r.burnRate, fan: 1, fanAt: -1, wind: 1, strain: 0, blast: 0, blastAt: -1, blown: null });
  function blowOut(state, b, by) {
    const R = state.rupa, r = b.rupa, A = airOf(r);
    r.burning = false;
    if (r.plume && r.plume.t1 == null) r.plume.t1 = state.time;
    r.T = Math.min(r.T, r.ignite - RELIGHT);   // its face cooled to just under its ignition: a neighbour's flame relights it
    r.burnRate = A.base; A.fan = 1; A.strain = 0;
    const again = A.blown != null && state.time - A.blown < WISP;
    A.blown = state.time;
    R.hits.push({ t: state.time, id: b.id, how: 'blowout', joules: 0, left: Math.max(0, Math.round(r.joules)), ...(by ? { by } : {}) });
    if (R.hits.length > 64) R.hits.shift();
    // the hot bed smoulders: a wisp at a smoulder's heat and soot yield (one a few seconds, however often it is blown out)
    if (again || !Array.isArray(R.smoke)) return;
    const heat = r.mass > 0 ? r.fuel / r.mass : 0, Q = SMOULDER * A.base;
    R.smoke.push({ seq: R.smokeSeq++, floor: state.breakFloor ?? 0, kind: 'fire', id: b.id, t0: state.time, t1: state.time + WISP, at: [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, b.max[2]], Q, fuel: heat > 0 ? Q / heat : 0, yield: SMOULDER_YIELD, radius: 0.3 * Math.min(b.max[0] - b.min[0], b.max[1] - b.min[1]), seed: R.smokeSeq + 1 });
    if (R.smoke.length > 128) R.smoke.shift();
  }
  // order 34.5: after rupa's blows (what a fireball reaches has caught), before the break count
  E.registerWorldPass('vayo-air', (state) => {
    const A = state.vayoAir;
    if (!A) return;
    const R = state.rupa, P = E.rupaPhysics, t = state.time;
    // the bursts since the last step, each a gust of the world's air
    const fresh = [];
    for (const u of state.bursts || []) {
      if (!(u.seq > A.seen)) continue;
      A.seen = u.seq;
      const kg = (P ? P.blastKg(u.radius || 0, R ? R.blastZ : 4) : Math.pow((u.radius || 0) / 4, 3)) * (R ? R.power : 1);
      const g = { t: u.t ?? t, at: [...u.pos], kg, r: u.radius || 0, seen: {} };
      A.gusts.push(g); fresh.push(g);
    }
    // a mover's wakes (vayo-move.js) this step
    if (A.pending && A.pending.length) { for (const w of A.pending) { const g = { ...w, seen: {} }; A.gusts.push(g); fresh.push(g); } A.pending.length = 0; }
    while (A.gusts.length && (A.gusts.length > GUSTS || t - A.gusts[0].t > GUST_LIFE)) A.gusts.shift();
    if (!R || !state.breakables) return;
    const steady = R.wind && P && t - A.windAt >= 0.25;
    if (steady) A.windAt = t;
    for (const b of state.breakables) {
      const r = b.rupa;
      if (!r || b.broken || r.ignite == null || !(r.burnRate > 0 || (r.air && r.air.base > 0))) continue;
      if (!r.burning) { if (r.air && r.burnRate !== r.air.base) r.burnRate = r.air.base; continue; }
      const S = airOf(r), D = footD(b), ubo = blowout(D), at = flameAt(b);
      // a blast's gust: past the fire's limit it goes out; under it, it is stoked and strained for a moment
      let out = null;
      for (const g of fresh) {
        const u = peakAt(state, g, at, b.collider || b);
        if (u >= ubo) { out = 'blast'; break; }
        if (u > 0) { S.fan = Math.max(S.fan * Math.exp(-(t - S.fanAt) / STOKE), fanOf(u, ubo)); S.fanAt = t; S.blast = Math.max(S.blast * Math.exp(-(t - S.blastAt) / HOLD), strainOf(u, ubo)); S.blastAt = t; }
      }
      // the world's wind, a few times a second
      if (!out && steady) {
        const w = P.windAt(R.wind, at, t), u = Math.hypot(w[0], w[1], w[2]);
        if (u >= ubo) out = 'wind';
        else { S.wind = fanOf(u, ubo); S.windStrain = strainOf(u, ubo); }
      }
      if (out) { blowOut(state, b, out); continue; }
      const fan = Math.max(S.wind, 1 + (S.fan - 1) * Math.exp(-(t - S.fanAt) / STOKE));
      r.burnRate = S.base * fan;
      S.strain = Math.max(S.windStrain || 0, S.blast * Math.exp(-(t - S.blastAt) / HOLD));
    }
  }, 34.5);
}

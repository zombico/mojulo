/**
 * group — N minds as one: a shared FOCUS (a target), an ANCHOR (its leader), SPACING, a PLAN of composable traversal
 * PATTERNS, and ATTACK TOKENS. One pre-step per frame gives every member a SLOT; the member's mind walks to its slot
 * instead of its own standoff and keeps its reflexes (dodge, flee, fire). Only a member holding a token presses in to
 * strike.
 *
 * Membership is authored on the member: `rule.mind.group` is a group id, or `{ id, plan, spacing, attackers, leader,
 * shareSight, travel }`; the first member (by id) carrying an object sets the group's settings.
 *
 * PATTERNS (pure: members → slots, around the anchor A and the focus F; u is the unit A→F, v its left normal):
 *   column   a file behind the leader            line     abreast of the leader
 *   wedge    a V behind the leader               hold     where each member stands
 *   fan-out  an arc facing F, spread by `arc`    encircle even angles round F at `radius`, shrinking by `close`/s
 *   pincer   two flanks at ±`angle` round F      close    encircle at striking range
 *   scatter  each member away from F along its own seeded bearing
 * A PLAN is a list of stages, each a pattern name or `{ pattern, when, ...params }`; a stage is entered once its
 * `when` holds: `{ dist }` (the anchor within `dist` of F), `{ t }` (seconds in the previous stage), `{ arrived }`
 * (that fraction of members within 2 of their slots). Named plans: `pack-hunt`, `squad`, `herd`.
 *
 * Coordination: `attackers` (K) members hold an attack token at a time, re-dealt every `tokenEvery` s (2) to the K
 * nearest F (ties by id); `shareSight` (default on): one member's sighting is the whole group's.
 *
 * BUILDER CONTRACT (compose.js): import-free; after the mind (it calls `E.mindPickTarget`); deterministic.
 */

export function buildGroup(E) {
  const { registerPreStep, TAU } = E;

  const PLANS = {
    'pack-hunt': ['fan-out', { pattern: 'encircle', when: { dist: 22 }, radius: 9, close: 1.2 }, { pattern: 'close', when: { t: 4 } }],
    squad: ['line', { pattern: 'pincer', when: { dist: 40 } }],
    herd: ['hold', { pattern: 'scatter', when: { dist: 30 } }],
  };
  const stagesOf = (plan) => (Array.isArray(plan) ? plan : PLANS[plan] || PLANS['pack-hunt']).map((s) => (typeof s === 'string' ? { pattern: s } : s));

  function hash01(id, n) {
    const s = String(id) + ':' + n;
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }

  // slots for n members: ctx { A, F, u, v, n, spacing, stageT, members, p (stage params) }
  const PATTERNS = {
    hold: (c) => c.members.map((m) => [m.transform.pos[0], m.transform.pos[1]]),
    column: (c) => c.members.map((_, i) => [c.A[0] - c.u[0] * i * c.spacing, c.A[1] - c.u[1] * i * c.spacing]),
    line: (c) => c.members.map((_, i) => { const k = i - (c.n - 1) / 2; return [c.A[0] + c.v[0] * k * c.spacing, c.A[1] + c.v[1] * k * c.spacing]; }),
    wedge: (c) => c.members.map((_, i) => {
      const k = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
      return [c.A[0] - c.u[0] * k * c.spacing + c.v[0] * side * k * c.spacing, c.A[1] - c.u[1] * k * c.spacing + c.v[1] * side * k * c.spacing];
    }),
    'fan-out': (c) => {
      const R = c.p.radius ?? Math.max(8, c.dist - c.spacing), base = c.base;
      const arc = Math.max(c.p.arc ?? 1.6, (c.spacing * (c.n - 1)) / Math.max(R, 1));
      return c.members.map((_, i) => { const a = base + (c.n > 1 ? (i / (c.n - 1) - 0.5) * arc : 0); return [c.F[0] + Math.cos(a) * R, c.F[1] + Math.sin(a) * R]; });
    },
    encircle: (c) => {
      const R0 = c.p.radius ?? Math.max(6, (c.spacing * c.n) / TAU);
      const R = Math.max(c.p.min ?? 2.5, R0 - (c.p.close || 0) * c.stageT), base = c.base;
      return c.members.map((_, i) => { const a = base + (i * TAU) / c.n; return [c.F[0] + Math.cos(a) * R, c.F[1] + Math.sin(a) * R]; });
    },
    close: (c) => PATTERNS.encircle({ ...c, p: { radius: c.p.radius ?? 2.5, min: c.p.min ?? 2 } }),
    pincer: (c) => {
      const R = c.p.radius ?? Math.max(8, c.dist * 0.6), base = c.base, ang = c.p.angle ?? 1.2;
      const half = Math.ceil(c.n / 2);
      return c.members.map((_, i) => {
        const left = i < half, k = left ? i : i - half, cnt = left ? half : c.n - half;
        const a = base + (left ? ang : -ang) + (cnt > 1 ? (k / (cnt - 1) - 0.5) * ((c.spacing * (cnt - 1)) / Math.max(R, 1)) : 0);
        return [c.F[0] + Math.cos(a) * R, c.F[1] + Math.sin(a) * R];
      });
    },
    scatter: (c) => c.members.map((m, i) => {
      const p = m.transform.pos, a = Math.atan2(p[1] - c.F[1], p[0] - c.F[0]) + (hash01(m.id, 7) - 0.5) * 1.4, d = c.p.dist ?? 30;
      return [p[0] + Math.cos(a) * d, p[1] + Math.sin(a) * d];
    }),
  };

  // stable slot assignment: keep a member's slot while the count holds; else greedy by id onto the nearest free slot
  function assign(g, members, slots) {
    if (g.assignN !== members.length || members.some((m) => g.assign[m.id] == null)) {
      g.assign = {}; const used = new Set();
      for (const m of members) {
        let best = -1, bd = Infinity;
        for (let k = 0; k < slots.length; k++) {
          if (used.has(k)) continue;
          const d = Math.hypot(slots[k][0] - m.transform.pos[0], slots[k][1] - m.transform.pos[1]);
          if (d < bd) { bd = d; best = k; }
        }
        used.add(best); g.assign[m.id] = best;
      }
      g.assignN = members.length;
    }
    for (const m of members) m.groupSlot = slots[g.assign[m.id]];
  }

  function stepGroups(state, dt) {
    if (!state.entities.some((e) => e.rule && e.rule.mind && e.rule.mind.group)) return;   // no groups: nothing at all
    const groups = state.groups || (state.groups = {});
    const byGroup = {};
    for (const e of state.entities) {
      const gm = e.rule && e.rule.mind && e.rule.mind.group;
      if (!gm || e.downed) continue;
      const id = typeof gm === 'string' ? gm : gm.id;
      (byGroup[id] || (byGroup[id] = [])).push(e);
    }
    for (const id of Object.keys(byGroup).sort()) {
      const members = byGroup[id].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      const cfgM = members.find((m) => typeof m.rule.mind.group === 'object');
      const cfg = cfgM ? cfgM.rule.mind.group : {};
      const g = groups[id] || (groups[id] = { id, stage: 0, stageT: 0, tokenT: 0, assign: {}, assignN: 0, seen: null });
      const leader = (cfg.leader && members.find((m) => m.id === cfg.leader)) || members[0];
      const spacing = cfg.spacing ?? 3;
      // the focus: the target of the first member willing to fight (the leader first): a passive member never picks
      // one, a defensive one only once hurt
      let focus = null;
      for (const m of [leader, ...members]) {
        const tm = m.rule.mind.aggressiveness;
        if (tm === 'passive' || (tm === 'defensive' && !(m.hpMax > 0 && m.body && m.body.hp < m.hpMax))) continue;
        focus = E.mindPickTarget ? E.mindPickTarget(m, state, m.rule.target) : null;
        if (focus && focus !== m) break;
        focus = null;
      }
      // shared sight: the freshest sighting of the focus by any member is the group's
      if (focus && cfg.shareSight !== false) {
        let best = null;
        for (const m of members) if (m.lastSeen && m.lastSeen.id === focus.id && (!best || m.lastSeen.t > best.t)) best = m.lastSeen;
        g.seen = best;
      } else g.seen = null;
      const A = [0, 0];
      if (focus) { for (const m of members) { A[0] += m.transform.pos[0] / members.length; A[1] += m.transform.pos[1] / members.length; } }
      else { A[0] = leader.transform.pos[0]; A[1] = leader.transform.pos[1]; }
      const known = focus && (!g.seen ? !members.some((m) => m.rule.mind.perception) : (state.time || 0) - g.seen.t < (cfg.memorySpan ?? 8));
      let F, stages;
      if (focus && known) { F = [focus.transform.pos[0], focus.transform.pos[1]]; stages = stagesOf(cfg.plan); }
      else {
        const hd = leader.transform.heading;
        F = [A[0] + Math.cos(hd) * 10, A[1] + Math.sin(hd) * 10];
        stages = [{ pattern: cfg.travel || 'column' }];
        if (g.engaged) { g.stage = 0; g.stageT = 0; g.base = null; }
      }
      if (!g.engaged && focus && known) g.base = null;
      g.engaged = !!(focus && known);
      const dist = Math.hypot(F[0] - A[0], F[1] - A[1]) || 1e-6;
      const u = [(F[0] - A[0]) / dist, (F[1] - A[1]) / dist], v = [-u[1], u[0]];
      // advance the plan on the next stage's trigger
      if (g.stage >= stages.length) g.stage = stages.length - 1;
      g.stageT += dt || 0;
      const next = stages[g.stage + 1];
      if (next && next.when) {
        const w = next.when;
        let go = true;
        if (w.dist != null && !(dist <= w.dist)) go = false;
        if (w.t != null && !(g.stageT >= w.t)) go = false;
        if (w.arrived != null) {
          const ok = members.filter((m) => m.groupSlot && Math.hypot(m.groupSlot[0] - m.transform.pos[0], m.groupSlot[1] - m.transform.pos[1]) < 2).length;
          if (ok / members.length < w.arrived) go = false;
        }
        if (go) { g.stage++; g.stageT = 0; g.base = null; }
      }
      const st = stages[g.stage];
      const travelAnchor = (st.pattern === 'column' || st.pattern === 'line' || st.pattern === 'wedge') ? [leader.transform.pos[0], leader.transform.pos[1]] : A;
      // the approach bearing (F → A) is fixed when a stage begins, so slots do not chase the group's own centre round
      if (g.base == null) g.base = Math.atan2(A[1] - F[1], A[0] - F[0]);
      const ctx = { A: travelAnchor, F, u, v, n: members.length, spacing, stageT: g.stageT, members, p: st, dist, base: g.base };
      const slots = (PATTERNS[st.pattern] || PATTERNS.hold)(ctx);
      assign(g, members, slots);
      if (st.pattern === 'column' || st.pattern === 'line' || st.pattern === 'wedge') leader.groupSlot = null;   // the leader leads
      // attack tokens: the K members nearest the focus, re-dealt every tokenEvery s
      const K = cfg.attackers ?? members.length;
      g.tokenT -= dt || 0;
      if (g.tokenT <= 0 || !g.tokens) {
        const order = members.slice().sort((a, b) => {
          const da = Math.hypot(a.transform.pos[0] - F[0], a.transform.pos[1] - F[1]), db = Math.hypot(b.transform.pos[0] - F[0], b.transform.pos[1] - F[1]);
          return da - db || (a.id < b.id ? -1 : 1);
        });
        g.tokens = order.slice(0, K).map((m) => m.id); g.tokenT = cfg.tokenEvery ?? 2;
      }
      for (const m of members) {
        m.groupId = id; m.groupToken = g.engaged && g.tokens.includes(m.id);
        m.groupFocus = g.engaged ? focus.id : null; m.groupPattern = st.pattern; m.groupSpacing = spacing;
        if (g.seen && m.rule.mind.perception && (!m.lastSeen || m.lastSeen.t < g.seen.t)) m.lastSeen = { ...g.seen, pos: g.seen.pos.slice() };
      }
    }
  }

  registerPreStep('groups', (state, input, dt) => { stepGroups(state, dt); }, 25);
  Object.assign(E, { GROUP_PATTERNS: Object.keys(PATTERNS), GROUP_PLANS: PLANS });
}

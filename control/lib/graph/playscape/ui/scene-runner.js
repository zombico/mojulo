/**
 * THE SCENE RUNNER — plays a level's scenes (scenes.js `sceneProgram`) over the bus and the camera. One self-contained
 * closure, referencing nothing outside itself: the page ships `buildSceneRunner.toString()`, and node runs the same code
 * in the tests (the bus's discipline).
 *
 *   const R = buildSceneRunner(), S = R.create(program)
 *   R.hear(S, types)          the bus event types since the last step (a scene starts on `scene:<id>`; an until waits on
 *                             its `scene-heard:<id>:<n>`)
 *   R.step(S, dt, ctl)        → { fire: [type], ops: [cast op], started: [id], ended: [id] }
 *                             ctl: { next (a press this frame), held (the advance key is down), skip (Esc this frame),
 *                             vars (the bus vars: a scene's `if` is read against them when its happening comes),
 *                             move (±1: the choice's highlight), pick (an option's index, taken at once) }.
 *                             A scene plays once (its `once`) counting plays, not happenings: one whose conditions
 *                             failed plays when its happening comes again and they hold.
 *                             `fire` goes to the bus (the beats' cues), `ops` to the cast (the camera's shot / unshot,
 *                             and `finish` when a scene is skipped: every walk lands where it was going)
 *   R.view(S)                 → { on, bars (0..1), line: { who, name, text (typed so far), full, expression? } | null,
 *                               choice: { options: [text], sel } | null }   (a choice shows its question as the line)
 *
 * A line types on at RATE characters a second; a press shows it whole, the next goes on. Holding the advance key for
 * HOLD seconds, or Esc, skips: the scene's remaining beats fire at once (their effects land), the walks finish, and the
 * camera is handed back. A choice waits for its answer, and a skip stops at it: the answer is the player's; the beats
 * before it land, and the camera takes the last shot passed. The answer fires its flags and plays its beats.
 * Deterministic in dt.
 */
export function buildSceneRunner() {
  const RATE = 40, HOLD = 0.6, BARS = 4;

  function create(program) {
    const byId = {};
    for (const sc of program || []) byId[sc.id] = sc;
    return { byId, active: null, heard: [], bars: 0, played: {} };
  }

  const CMP = { gte: (a, b) => a >= b, gt: (a, b) => a > b, lte: (a, b) => a <= b, lt: (a, b) => a < b, eq: (a, b) => a === b, ne: (a, b) => a !== b };
  function holds(sc, vars) {
    for (const c of sc.if || []) { const v = vars && vars[c.var] != null ? vars[c.var] : 0; if (!CMP[c.op](v, c.n)) return false; }
    return true;
  }

  function hear(S, types) { for (const t of types || []) if (typeof t === 'string') S.heard.push(t); }

  function end(S, out) {
    const A = S.active;
    out.ops.push({ op: 'unshot' });
    out.fire.push('scene-end:' + A.sc.id);
    out.ended.push(A.sc.id);
    S.active = null;
  }

  // run beats until one waits (a timer, an event, a click) or the scene ends
  function advance(S, out) {
    const A = S.active;
    for (;;) {
      if (A.line) A.said = A.line;
      A.i++; A.wait = null; A.line = null; A.t = 0;
      const b = A.sc.beats[A.i];
      if (!b) { end(S, out); return; }
      if (b.kind === 'shot') { out.ops.push({ op: 'shot', shot: b.shot }); if (b.for) { A.wait = { time: b.for }; return; } continue; }
      if (b.kind === 'fire') { out.fire.push(b.event); continue; }
      if (b.kind === 'until') { A.wait = { event: b.event }; return; }
      if (b.kind === 'wait') { A.wait = { time: b.wait }; return; }
      if (b.kind === 'line') { A.line = b; A.typed = 0; A.wait = { click: true }; return; }
      if (b.kind === 'choose') { choose(A, b); return; }
      if (b.kind === 'jump') { A.i = b.to - 1; continue; }
    }
  }

  // a choice: its question stays as the line (its own, or the last said), the answer waits
  function choose(A, b) {
    A.line = b.ask || A.said || null; A.typed = A.line ? A.line.text.length : 0;
    A.choice = b; A.sel = 0; A.wait = { choice: true };
  }
  function answer(S, out, k) {
    const A = S.active, o = A.choice.options[k];
    for (const t of o.fire) out.fire.push(t);
    A.choice = null;
    A.i = o.to - 1;
    advance(S, out);
  }

  // a skip: what is left fires at once, the walks land, the camera comes back; up to a choice, which stays the player's
  function skip(S, out) {
    const A = S.active;
    if (A.choice) return;
    let shot = null;
    for (let j = A.i + 1; j < A.sc.beats.length; j++) {
      const b = A.sc.beats[j];
      if (b.kind === 'fire') out.fire.push(b.event);
      else if (b.kind === 'shot') shot = b.shot;
      else if (b.kind === 'line') A.said = b;
      else if (b.kind === 'jump') j = b.to - 1;
      else if (b.kind === 'choose') {
        out.ops.push({ op: 'finish' });
        if (shot) out.ops.push({ op: 'shot', shot });
        A.i = j; A.t = 0; A.holdT = 0;
        choose(A, b);
        return;
      }
    }
    out.ops.push({ op: 'finish' });
    end(S, out);
  }

  function step(S, dt, ctl) {
    const out = { fire: [], ops: [], started: [], ended: [] }, c = ctl || {};
    const heard = S.heard;
    S.heard = [];
    if (!S.active) {
      for (const t of heard) {
        if (t.indexOf('scene:') !== 0) continue;
        const sc = S.byId[t.slice(6)];
        if (!sc || (sc.once !== false && S.played[sc.id]) || !holds(sc, c.vars)) continue;
        S.played[sc.id] = (S.played[sc.id] || 0) + 1;
        S.active = { sc, i: -1, wait: null, line: null, t: 0, typed: 0, holdT: 0, said: null, choice: null, sel: 0 };
        out.started.push(sc.id);
        advance(S, out);
        break;
      }
    } else {
      const A = S.active;
      A.holdT = c.held && !A.choice ? A.holdT + dt : 0;   // a choice waits for its answer: no skipping past it
      if (!A.choice && (c.skip || A.holdT >= HOLD)) skip(S, out);
      else {
        const w = A.wait;
        let go = !w;
        if (w && w.time != null) { A.t += dt; go = A.t >= w.time; }
        else if (w && w.event) go = heard.indexOf(w.event) >= 0;
        else if (w && w.choice) {
          const n = A.choice.options.length;
          if (c.move) A.sel = (A.sel + (c.move > 0 ? 1 : -1) + n) % n;
          const k = Number.isInteger(c.pick) && c.pick >= 0 && c.pick < n ? c.pick : c.next ? A.sel : -1;
          if (k >= 0) answer(S, out, k);
        }
        else if (w && w.click) {
          A.typed += dt * RATE;
          if (c.next) { if (A.typed < A.line.text.length) A.typed = A.line.text.length; else go = true; }
        }
        if (go) advance(S, out);
      }
    }
    const want = S.active ? 1 : 0;
    S.bars += Math.max(-dt * BARS, Math.min(dt * BARS, want - S.bars));
    return out;
  }

  function view(S) {
    const A = S.active, L = A && A.line;
    return {
      on: !!A,
      bars: S.bars,
      line: L ? { who: L.who, name: L.name, text: L.text.slice(0, Math.floor(A.typed)), full: A.typed >= L.text.length, ...(L.expression ? { expression: L.expression } : {}) } : null,
      choice: A && A.choice ? { options: A.choice.options.map((o) => o.text), sel: A.sel } : null,
    };
  }

  return { create, hear, step, view, RATE, HOLD };
}

/**
 * THE SCENE RUNNER — plays a level's scenes (scenes.js `sceneProgram`) over the bus and the camera. One self-contained
 * closure, referencing nothing outside itself: the page ships `buildSceneRunner.toString()`, and node runs the same code
 * in the tests (the bus's discipline).
 *
 *   const R = buildSceneRunner(), S = R.create(program)
 *   R.hear(S, types)          the bus event types since the last step (a scene starts on `scene:<id>`; an until waits on
 *                             its `scene-heard:<id>:<n>`)
 *   R.step(S, dt, ctl)        → { fire: [type], ops: [cast op], started: [id], ended: [id] }
 *                             ctl: { next (a press this frame), held (the advance key is down), skip (Esc this frame) }.
 *                             `fire` goes to the bus (the beats' cues), `ops` to the cast (the camera's shot / unshot,
 *                             and `finish` when a scene is skipped: every walk lands where it was going)
 *   R.view(S)                 → { on, bars (0..1), line: { who, name, text (typed so far), full, expression? } | null }
 *
 * A line types on at RATE characters a second; a press shows it whole, the next goes on. Holding the advance key for
 * HOLD seconds, or Esc, skips: the scene's remaining beats fire at once (their effects land), the walks finish, and the
 * camera is handed back. Deterministic in dt.
 */
export function buildSceneRunner() {
  const RATE = 40, HOLD = 0.6, BARS = 4;

  function create(program) {
    const byId = {};
    for (const sc of program || []) byId[sc.id] = sc;
    return { byId, active: null, heard: [], bars: 0 };
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
      A.i++; A.wait = null; A.line = null; A.t = 0;
      const b = A.sc.beats[A.i];
      if (!b) { end(S, out); return; }
      if (b.kind === 'shot') { out.ops.push({ op: 'shot', shot: b.shot }); if (b.for) { A.wait = { time: b.for }; return; } continue; }
      if (b.kind === 'fire') { out.fire.push(b.event); continue; }
      if (b.kind === 'until') { A.wait = { event: b.event }; return; }
      if (b.kind === 'wait') { A.wait = { time: b.wait }; return; }
      if (b.kind === 'line') { A.line = b; A.typed = 0; A.wait = { click: true }; return; }
    }
  }

  // a skip: what is left fires at once, the walks land, the camera comes back
  function skip(S, out) {
    const A = S.active;
    for (let j = A.i + 1; j < A.sc.beats.length; j++) if (A.sc.beats[j].kind === 'fire') out.fire.push(A.sc.beats[j].event);
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
        if (!sc) continue;
        S.active = { sc, i: -1, wait: null, line: null, t: 0, typed: 0, holdT: 0 };
        out.started.push(sc.id);
        advance(S, out);
        break;
      }
    } else {
      const A = S.active;
      A.holdT = c.held ? A.holdT + dt : 0;
      if (c.skip || A.holdT >= HOLD) skip(S, out);
      else {
        const w = A.wait;
        let go = !w;
        if (w && w.time != null) { A.t += dt; go = A.t >= w.time; }
        else if (w && w.event) go = heard.indexOf(w.event) >= 0;
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
    };
  }

  return { create, hear, step, view, RATE, HOLD };
}

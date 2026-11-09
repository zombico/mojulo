/**
 * mana-host — the controls layer's side of the game UI: the page's input owner connecting its devices to a mana-ui
 * runtime (control/lib/mana-ui/). mana-ui is a view that takes intents; this reads the devices, through the control
 * schemes as resolved for it (mana-controls.js manaControls), and hands it those intents, the device in hand and the
 * seat that spoke. One input paradigm on a page: the schemes, their drivers and the seats are the controls layer's.
 *
 * SINGLE SOURCE OF TRUTH, the controls kernel's discipline: everything lives inside `buildManaHost()`, a closure that
 * references nothing outside itself, so a page runs the same code by emitting `buildManaHost.toString()`
 * (mana-controls.js manaHostSource). Node imports the live instance for tests.
 *
 *   connect(rt, view, { keys, pad, padLayout, seatOf?, drivers?, listen?, loop?, repeat?, now? }) → { key(ev), poll(), stop() }
 *     rt, view    a mana-ui runtime and its mount (view.paint after an intent)
 *     keys, pad   the menu scheme resolved (code → action; per printed layout, buttons and half axes → action)
 *     padLayout   the kernel's reader of a pad's printed layout (controls-kernel.js padLayout)
 *     seatOf      (controller) → the 0-based seat it plays ('keyboard', 'pad:<index>', a driver's name), or null for
 *                 none: the seats kernel's answer on a couch page (seats-kernel.js seatOf); without it, the keyboard and
 *                 the first pad are the first seat and pad n the nth
 *     drivers     [() → { <action>: 1 } | { name?, input?, actions }]: any other device (a headset, a wheel)
 *     listen      false: the page routes its keydowns to key(ev) itself;  loop: false: it calls poll() itself
 *     repeat      a direction held on a pad or a driver repeats, as a key held does: { delay, rate } in seconds
 *                 (0.38 then every 0.075 by default, estimates to tune by hand), false for none; now() the clock it is
 *                 timed on (the page's by default)
 *   While a screen is up the menu holds the input: a key it knows is taken in the capture phase (the game's own
 *   listeners never see it), and every pad and driver acts on its press edges, what was held as the screen opened not
 *   acting in it. With no screen up, nothing is taken: play has the devices.
 */
export function buildManaHost() {
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

  function connect(rt, view, opts) {
    const o = opts || {}, keys = o.keys || {}, pad = o.pad || null;
    const seat = (controller, fallback) => { const s = o.seatOf ? o.seatOf(controller) : fallback; return s === null || s === undefined ? null : s; };
    const paint = () => { if (view && view.paint) view.paint(); };
    const act = (a, mode, layout, controller, fallback) => {
      const n = seat(controller, fallback);
      if (n === null) return false;
      rt.input(mode, layout);
      if (!rt.press(a, n)) rt.press(a, 0);
      return true;
    };

    function key(ev) {
      // no screen up: the key is play's; the HUD's prompts still learn the player is on the keys
      if (!rt.state().screen) { if (rt.state().input !== 'keys') { rt.input('keys'); paint(); } return false; }
      if (ev.stopPropagation) ev.stopPropagation();
      const a = keys[ev.code];
      if (!a) return false;
      if (ev.preventDefault) ev.preventDefault();
      act(a, 'keys', null, 'keyboard', 0);
      paint();
      return true;
    }

    const prev = new Map();
    // a held direction repeats (a long list, a slider): after the delay, at the rate; keys repeat by the system's own
    const REPEATS = ['up', 'down', 'left', 'right'];
    const R = o.repeat === false ? null : { delay: 0.38, rate: 0.075, ...(isObj(o.repeat) ? o.repeat : {}) };
    const clock = () => (o.now ? o.now() : typeof performance !== 'undefined' ? performance.now() / 1000 : 0);
    const due = new Map();
    let shown = rt.state().screen;
    const edges = (id, now, mode, layout, controller, fallback) => {
      const was = prev.get(id) || {}, t = R ? clock() : 0, next = due.get(id) || {};
      prev.set(id, now);
      due.set(id, next);
      let did = false;
      for (const a in now) {
        if (now[a] && !was[a]) { did = act(a, mode, layout, controller, fallback) || did; if (R && REPEATS.includes(a)) next[a] = t + R.delay; }
        else if (now[a] && next[a] !== undefined && t >= next[a]) { did = act(a, mode, layout, controller, fallback) || did; next[a] = t + R.rate; }
      }
      for (const a in next) if (!now[a]) delete next[a];
      return did;
    };
    function poll() {
      const now = rt.state().screen, opened = now !== shown;
      shown = now;
      let did = false;
      const pads = pad && typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
      if (!now) {
        // no screen up: the pads are play's; a press only tells the HUD's prompts which pad is in hand
        prev.clear(); due.clear();
        for (const g of pads) if (g && g.connected && g.buttons.some((x) => x && x.pressed)) { const L = o.padLayout ? o.padLayout(g.id) : 'xbox'; if (rt.state().input !== 'pad' || rt.state().layout !== L) { rt.input('pad', L); paint(); } break; }
        return opened;
      }
      for (let i = 0; i < pads.length; i++) {
        const g = pads[i];
        if (!g || !g.connected) continue;
        const L = o.padLayout ? o.padLayout(g.id) : 'xbox', P = pad[L] || pad.xbox, held = {};
        if (!P) continue;
        for (const b in P.b) { const x = g.buttons[b]; if (x && (x.pressed || x.value > 0.5)) held[P.b[b]] = 1; }
        for (const [ax, sg, a] of P.a) if ((g.axes[ax] || 0) * sg > 0.6) held[a] = 1;
        const id = 'pad:' + (g.index === undefined ? i : g.index);
        if (opened) prev.set(id, held); else did = edges(id, held, 'pad', L, id, i) || did;
      }
      (o.drivers || []).forEach((fn, i) => {
        const r = fn() || {}, held = isObj(r.actions) ? r.actions : r, id = r.name || 'driver:' + i;
        if (opened) prev.set(id, held); else did = edges(id, held, r.input || 'pad', null, id, 0) || did;
      });
      if (did) paint();
      return did || opened;
    }

    let live = true;
    if (o.listen !== false && typeof window !== 'undefined') window.addEventListener('keydown', key, true);
    if (o.loop !== false && typeof requestAnimationFrame === 'function') { const loop = () => { if (!live) return; poll(); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
    return { key, poll, stop: () => { live = false; if (o.listen !== false && typeof window !== 'undefined' && window.removeEventListener) window.removeEventListener('keydown', key, true); } };
  }

  return { connect };
}

export const manaHost = buildManaHost();

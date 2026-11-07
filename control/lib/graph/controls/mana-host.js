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
 *   connect(rt, view, { keys, pad, padLayout, seatOf?, drivers?, listen?, loop? }) → { key(ev), poll(), drive(fn), stop() }
 *     rt, view    a mana-ui runtime and its mount (view.paint after an intent)
 *     keys, pad   the menu scheme resolved (code → action; per printed layout, buttons and half axes → action)
 *     padLayout   the kernel's reader of a pad's printed layout (controls-kernel.js padLayout)
 *     seatOf      (controller) → the 0-based seat it plays ('keyboard', 'pad:<index>', a driver's name), or null for
 *                 none: the seats kernel's answer on a couch page (seats-kernel.js seatOf); without it, the keyboard and
 *                 the first pad are the first seat and pad n the nth
 *     drivers     [() → { <action>: 1 } | { name?, input?, actions }]: any other device (a headset, a wheel); one that
 *                 comes later (a headset's session starting) joins with the handle's drive(fn) → its removal
 *     listen      false: the page routes its keydowns to key(ev) itself;  loop: false: it calls poll() itself
 *     repeat      a held stick or d-pad's move repeated: { delay: 400, every: 100 } ms by default, false for none
 *     now         () → ms, the clock the repeat is timed on (performance.now by default)
 *   While a screen is up the menu holds the input: a key it knows is taken in the capture phase (the game's own
 *   listeners never see it), and every pad and driver acts on its press edges, what was held as the screen opened not
 *   acting in it. With no screen up, nothing is taken: play has the devices.
 *   The sane defaults: the keyboard takes the scheme's slots and its `also` (the keypad, Tab and Shift+Tab, the Page
 *   keys); a held key (as the browser repeats it), stick or d-pad (as `repeat` times it) repeats a move and never a pick
 *   or a back; a chord (Ctrl, Alt, Meta) stays the browser's; and with a text entry in focus the keys type into it
 *   (rt.type), Backspace and Delete erase, Enter is done.
 */
export function buildManaHost() {
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

  function connect(rt, view, opts) {
    const o = opts || {}, keys = o.keys || {}, pad = o.pad || null;
    const seat = (controller, fallback) => { const s = o.seatOf ? o.seatOf(controller) : fallback; return s === null || s === undefined ? null : s; };
    const paint = () => { if (view && view.paint) view.paint(); };
    // a held key, stick or d-pad repeats a move (a long list scrolls, a slider runs), never a pick or a back: a held
    // Enter buys once, a held Esc leaves one screen
    const REPEATS = { up: 1, down: 1, left: 1, right: 1 };
    const act = (a, mode, layout, controller, fallback) => {
      const n = seat(controller, fallback);
      if (n === null) return false;
      rt.input(mode, layout);
      if (!rt.press(a, n)) rt.press(a, 0);
      return true;
    };

    const take = (ev) => { if (ev.preventDefault) ev.preventDefault(); return true; };
    // a text entry in the keyboard's focus: what is typed goes into it (a pad types from its grid), Backspace and Delete
    // erase, Enter is done; the arrows, Esc and Tab still move and back out
    function typed(ev, n) {
      const k = ev.key;
      if (k === 'Backspace' || k === 'Delete') { rt.erase(n); return take(ev); }
      if (k === 'Enter') { if (!ev.repeat) rt.submit(n); return take(ev); }
      if (typeof k === 'string' && [...k].length === 1) { rt.type(k, n); return take(ev); }
      return false;
    }
    function key(ev) {
      // no screen up: the key is play's; the HUD's prompts still learn the player is on the keys
      if (!rt.state().screen) { if (rt.state().input !== 'keys') { rt.input('keys'); paint(); } return false; }
      if (ev.stopPropagation) ev.stopPropagation();
      // a chord (Ctrl, Alt or Meta held) is the browser's and the system's: a reload, a tab switch, a copy
      if (ev.ctrlKey || ev.altKey || ev.metaKey) return false;
      const n = seat('keyboard', 0);
      if (n !== null && rt.typing(n) && typed(ev, n)) { rt.input('keys'); paint(); return true; }
      const a = (ev.shiftKey && keys['Shift+' + ev.code]) || keys[ev.code];
      if (!a) return false;
      take(ev);
      if (ev.repeat && !REPEATS[a]) return true;
      act(a, 'keys', null, 'keyboard', 0);
      paint();
      return true;
    }

    // a held stick or d-pad repeats its move as a held key does (a long list scrolls, a slider runs): after `delay` ms, then
    // every `every` ms; a pick or a back never repeats, and what was held as a screen opened does not repeat in it
    const rep = o.repeat === false ? null : { delay: 400, every: 100, ...(isObj(o.repeat) ? o.repeat : {}) };
    const clock = typeof o.now === 'function' ? o.now : () => (typeof performance !== 'undefined' ? performance.now() : 0);
    const prev = new Map(), due = new Map(), drivers = (o.drivers || []).slice();
    // a device that comes after the connection (a headset's session): its driver joins, and leaves with what it held
    const drive = (fn) => { drivers.push(fn); return () => { const i = drivers.indexOf(fn); if (i >= 0) drivers.splice(i, 1); }; };
    let shown = rt.state().screen;
    const edges = (id, now, mode, layout, controller, fallback) => {
      const was = prev.get(id) || {}, D = due.get(id) || {}, t = clock();
      prev.set(id, now);
      due.set(id, D);
      let did = false;
      for (const a in D) if (!now[a]) delete D[a];
      for (const a in now) {
        if (!now[a]) continue;
        if (!was[a]) { did = act(a, mode, layout, controller, fallback) || did; if (rep && REPEATS[a]) D[a] = t + rep.delay; }
        else if (D[a] !== undefined && t >= D[a]) { did = act(a, mode, layout, controller, fallback) || did; D[a] = t + rep.every; }
      }
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
        if (opened) { prev.set(id, held); due.delete(id); } else did = edges(id, held, 'pad', L, id, i) || did;
      }
      drivers.forEach((fn, i) => {
        const r = fn() || {}, held = isObj(r.actions) ? r.actions : r, id = r.name || 'driver:' + i;
        if (opened) { prev.set(id, held); due.delete(id); } else did = edges(id, held, r.input || 'pad', null, id, 0) || did;
      });
      if (did) paint();
      return did || opened;
    }

    let live = true;
    if (o.listen !== false && typeof window !== 'undefined') window.addEventListener('keydown', key, true);
    if (o.loop !== false && typeof requestAnimationFrame === 'function') { const loop = () => { if (!live) return; poll(); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
    return { key, poll, drive, stop: () => { live = false; if (o.listen !== false && typeof window !== 'undefined' && window.removeEventListener) window.removeEventListener('keydown', key, true); } };
  }

  return { connect };
}

export const manaHost = buildManaHost();

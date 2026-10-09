/**
 * controls-kernel — read a control scheme (schemes.js) through any device family (devices.js), and say it back.
 *
 * SINGLE SOURCE OF TRUTH, the store-kernel discipline: everything lives inside `buildControlsKernel()`,
 * a closure that references nothing outside itself, so a page runs the same code by emitting
 * `buildControlsKernel.toString()`. Node imports the live instance for tests and design-time checks.
 *
 * The kernel never touches a device. A page's DRIVER for a family hands it `read(control)`: the raw value of one
 * control (a key code, 'south', 'leftY', 'right.trigger', 'steering'), a boolean or a number in [-1, 1]. The
 * kernel takes the sign off a half axis ('leftY-' is the stick pushed up) and either side of a modifier key.
 *
 *   resolve(scheme, D, over?, opts?)   → B { scheme, layout, bind: { family: { id: [control] } } }; over is the same
 *                                        shape; a role ('confirm') lands on its position for opts.layout
 *   padLayout(id)                      → 'xbox' | 'playstation' | 'nintendo', read off a Gamepad id
 *   value(B, id, fam, read, quiet?)    → 0..1, the strongest bound control (quiet: controls a held chord silences)
 *   held(B, id, fam, read, quiet?)     → value ≥ 0.5
 *   axis(B, pos, neg, fam, read)       → -1..1, slot by slot: the first slot pressing a direction wins
 *   is(B, id, fam, control) / actionOf(B, fam, control, order?) / codeMap(B, fam)   → for press-driven pages
 *   gamepadRead(g, D, analog?)         → the reference driver: a standard-mapping Gamepad → read; a button reads
 *                                        1 once the browser calls it pressed, or its raw travel when `analog`
 *   label(D, fam, control, layout?)    → what a legend prints ('W', 'A' / '✕', 'left stick ↑', 'right trigger')
 *   valid(D, fam, control)             → is this a control of that family
 *   legend(scheme, B, D, ctx)          → [[controls, meaning]]: keyboard rows, then each family in ctx.active
 *   conflicts(scheme, B)               → [{ family, context, control, actions }] where one control means two things at once
 *   capture(fam, control)              → the control a remap stores for a press (either Shift → 'Shift')
 */

export function buildControlsKernel() {
  // a keyboard control may name a modifier without its side; it matches either physical key
  const SIDES = { Shift: ['ShiftLeft', 'ShiftRight'], Control: ['ControlLeft', 'ControlRight'], Alt: ['AltLeft', 'AltRight'], Meta: ['MetaLeft', 'MetaRight'] };
  const sidesOf = (c) => SIDES[c] || [c];
  // '<hand>.<name><sign>' — hand only for a two-handed family, sign only on a half axis
  const parse = (c) => {
    const m = /^(?:(left|right)\.)?([A-Za-z0-9]+)([+-])?$/.exec(c || '');
    return m ? { hand: m[1] || null, name: m[2], sign: m[3] || null, base: (m[1] ? m[1] + '.' : '') + m[2] } : null;
  };

  function controlValue(fam, c, read, quiet) {
    if (!c || (quiet && quiet.indexOf(c) >= 0)) return 0;
    if (fam === 'keyboard') {
      const cs = sidesOf(c);
      for (let i = 0; i < cs.length; i++) if (read(cs[i])) return 1;
      return 0;
    }
    const p = parse(c);
    if (!p) return 0;
    const raw = +read(p.base) || 0;
    if (p.sign) return Math.max(0, p.sign === '-' ? -raw : raw);
    return Math.max(0, Math.min(1, raw));
  }

  const listOf = (B, fam, id) => (B.bind[fam] && B.bind[fam][id]) || [];

  function value(B, id, fam, read, quiet) {
    const s = listOf(B, fam, id);
    let v = 0;
    for (let i = 0; i < s.length; i++) v = Math.max(v, controlValue(fam, s[i], read, quiet));
    return v;
  }
  const held = (B, id, fam, read, quiet) => value(B, id, fam, read, quiet) >= 0.5;

  function axis(B, pos, neg, fam, read) {
    const P = listOf(B, fam, pos), N = listOf(B, fam, neg);
    const n = Math.max(P.length, N.length);
    for (let i = 0; i < n; i++) {
      const v = controlValue(fam, P[i], read) - controlValue(fam, N[i], read);
      if (v) return v;
    }
    return 0;
  }

  const matches = (fam, slot, control) => slot === control || (fam === 'keyboard' && sidesOf(slot).indexOf(control) >= 0);
  const is = (B, id, fam, control) => listOf(B, fam, id).some((s) => matches(fam, s, control));
  function actionOf(B, fam, control, order) {
    const ids = order || Object.keys(B.bind[fam] || {});
    for (let i = 0; i < ids.length; i++) if (is(B, ids[i], fam, control)) return ids[i];
    return null;
  }
  function codeMap(B, fam) {
    const f = fam || 'keyboard', out = {};
    for (const id of Object.keys(B.bind[f] || {})) for (const s of B.bind[f][id]) for (const c of (f === 'keyboard' ? sidesOf(s) : [s])) if (!out[c]) out[c] = id;
    return out;
  }

  // the reference driver: W3C standard mapping, axes raw (dead zones are the page's)
  function gamepadRead(g, D, analog) {
    const G = D.gamepad;
    return (name) => {
      if (G.buttons[name] !== undefined) {
        const b = g.buttons[G.buttons[name]];
        if (!b) return 0;
        return analog ? b.value || 0 : (b.pressed ? 1 : b.value || 0);
      }
      if (G.axes[name] !== undefined) return g.axes[G.axes[name]] || 0;
      return 0;
    };
  }

  const has = (set, name) => !!set && (Array.isArray(set) ? set.indexOf(name) >= 0 : Object.prototype.hasOwnProperty.call(set, name));
  function valid(D, fam, c) {
    const F = D[fam];
    if (!F || typeof c !== 'string' || !c) return false;
    if (F.open) return /^[A-Za-z0-9]+$/.test(c);
    const p = parse(c);
    if (!p || (!!F.hands !== !!p.hand) || (p.hand && F.hands.indexOf(p.hand) < 0)) return false;
    return p.sign ? has(F.axes, p.name) : (has(F.buttons, p.name) || has(F.axes, p.name) || has(F.roles, p.name));
  }

  function resolve(scheme, D, over, opts) {
    const o = over || {};
    const layout = (opts && opts.layout) || 'xbox';
    const B = { scheme: scheme.id, layout, bind: {} };
    for (const fam of Object.keys(D)) {
      const fb = {}, roles = D[fam].roles || {};
      for (const a of scheme.actions) {
        const mine = o[fam] && Array.isArray(o[fam][a.id]) ? o[fam][a.id] : ((a.bind && a.bind[fam]) || []);
        fb[a.id] = mine.filter((c) => valid(D, fam, c)).map((c) => (roles[c] ? roles[c][layout] || roles[c].xbox : c)).slice(0, 2);
      }
      B.bind[fam] = fb;
    }
    return B;
  }

  // Sony pads name themselves; 'Wireless Controller' alone is a DualShock, but Xbox pads say 'Xbox Wireless Controller'
  function padLayout(id) {
    const s = id || '';
    if (/054c|sony|dual\s?shock|dual\s?sense/i.test(s) || (/wireless controller/i.test(s) && !/xbox|045e/i.test(s))) return 'playstation';
    if (/057e|nintendo|pro controller|joy-?con/i.test(s)) return 'nintendo';
    return 'xbox';
  }

  const KEY_WORDS = {
    Space: 'Space', Enter: 'Enter', Escape: 'Esc', Tab: 'Tab', Backspace: 'Backspace',
    Shift: 'Shift', Control: 'Ctrl', Alt: 'Alt', Meta: 'Meta',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    BracketLeft: '[', BracketRight: ']', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'",
    Minus: '-', Equal: '=', Backquote: '`', Backslash: '\\',
  };
  function keyLabel(code) {
    if (!code) return '';
    if (KEY_WORDS[code]) return KEY_WORDS[code];
    let m = /^Key([A-Z])$/.exec(code); if (m) return m[1];
    m = /^Digit(\d)$/.exec(code); if (m) return m[1];
    m = /^Numpad(\d)$/.exec(code); if (m) return 'Num ' + m[1];
    m = /^(Shift|Control|Alt|Meta)(Left|Right)$/.exec(code); if (m) return KEY_WORDS[m[1]];
    return code;
  }

  // a half axis prints its stick and the way it is pushed
  const ARROW = { 'X-': '←', 'X+': '→', 'Y-': '↑', 'Y+': '↓' };
  const arrowOf = (name, sign) => ARROW[(/Y$/.test(name) || name === 'elevator' ? 'Y' : 'X') + sign];
  function stickOf(F, name) {
    for (const k of Object.keys(F.sticks || {})) if (F.sticks[k].indexOf(name) >= 0) return k;
    return null;
  }
  function label(D, fam, c, layout) {
    const F = D[fam];
    if (!F || !c) return '';
    if (F.open) return keyLabel(c);
    const p = parse(c);
    if (!p) return c;
    const words = (fam === 'gamepad' ? F.layouts[layout] || F.layouts.xbox : F.labels) || {};
    const hand = p.hand ? p.hand + ' ' : '';
    if (p.sign) {
      const st = stickOf(F, p.name);
      const w = st ? (words[st + '_stick'] || st + ' stick') : (words[p.name] || p.name);
      return hand + w + ' ' + arrowOf(p.name, p.sign);
    }
    const w = words[p.name];
    if (w && typeof w === 'object') return w[p.hand] || p.name;   // a per-hand print (A on the right hand, X on the left) needs no hand word
    return hand + (w || (F.dpad && F.dpad[p.name]) || p.name);
  }

  const pick = (v, ctx) => {
    if (v == null || typeof v === 'string') return v || '';
    for (const k of Object.keys(v)) if (k !== '_' && ctx[k]) return v[k];
    return v._ || '';
  };
  const live = (row, ctx) => (!row.when || !!ctx[row.when]) && (!row.unless || !ctx[row.unless]);
  const join = (xs, sep) => xs.filter(Boolean).join(sep);

  // four directions: one stick ("left stick"), the arrow keys ("arrows"), or the four keys ("W A S D"), per slot
  function quad(B, D, fam, ids, layout) {
    const n = Math.max(...ids.map((id) => listOf(B, fam, id).length));
    const out = [];
    for (let s = 0; s < n; s++) {
      const cs = ids.map((id) => listOf(B, fam, id)[s]);
      if (cs.some((c) => !c)) continue;
      if (fam === 'keyboard') { out.push(cs.every((c) => /^Arrow/.test(c)) ? 'arrows' : cs.map(keyLabel).join(' ')); continue; }
      const ps = cs.map(parse), F = D[fam];
      const st = ps.every((p) => p && p.sign && p.hand === ps[0].hand) ? ps.map((p) => stickOf(F, p.name)) : [];
      if (st.length && st.every((x) => x && x === st[0])) {
        const words = (fam === 'gamepad' ? F.layouts[layout] || F.layouts.xbox : F.labels) || {};
        out.push((ps[0].hand ? ps[0].hand + ' ' : '') + (words[st[0] + '_stick'] || st[0] + ' stick'));
      } else out.push(cs.map((c) => label(D, fam, c, layout)).join(' '));
    }
    return out.join(' / ');
  }

  // two halves of one axis read as one control: 'right thumbstick ← / right thumbstick →' → 'right thumbstick ↔'
  function pairText(B, D, fam, ids, layout, sep) {
    const cs = ids.map((id) => listOf(B, fam, id)[0]);
    if (fam !== 'keyboard' && cs.length === 2 && cs[0] && cs[1]) {
      const a = parse(cs[0]), b = parse(cs[1]);
      if (a && b && a.base === b.base && a.sign && b.sign && a.sign !== b.sign) return label(D, fam, cs[0], layout).replace(/ [←→↑↓]$/, ' ' + (/[↑↓]$/.test(label(D, fam, cs[0], layout)) ? '↕' : '↔'));
    }
    return join(cs.map((c) => label(D, fam, c, layout)), sep || ' / ');
  }

  function rowText(row, B, D, fam, layout) {
    if (row.chord) {
      const c = listOf(B, fam, row.chord)[0];
      return c ? label(D, fam, c, layout) + ' + ' + row.faces.map((f) => label(D, fam, f, layout)).join(' / ') : '';
    }
    const f = row.dev || fam;
    let t = row.quad ? quad(B, D, f, row.quad, layout)
      : row.all ? join([].concat(...row.all.map((id) => listOf(B, f, id).map((c) => label(D, f, c, layout)))), ' / ')
      : row.ids ? pairText(B, D, f, row.ids, layout, row.sep) : '';
    if (row.range) {
      const ls = row.range.map((id) => label(D, f, listOf(B, f, id)[0], layout)).filter(Boolean);
      const run = ls.length > 2 && ls.every((l, i) => /^\d$/.test(l) && (i === 0 || +l === +ls[i - 1] + 1));
      t = join([t, run ? ls[0] + '–' + ls[ls.length - 1] : ls.join(' ')], ' · ');
    }
    if (row.with) t = join([t, join(row.ids.map((id) => label(D, row.with, listOf(B, row.with, id)[0], layout)), ' / ')], ' / ');
    return t;
  }

  function legend(scheme, B, D, ctx) {
    const c = ctx || {};
    const L = scheme.legend || {};
    const fams = ['keyboard'].concat(Object.keys(L).filter((f) => f !== 'keyboard' && c.active && c.active[f]));
    const rows = [];
    for (const fam of fams) {
      for (const row of L[fam] || []) {
        if (!live(row, c)) continue;
        let k = row.text ? pick(row.text, c) : rowText(row, B, D, fam, c.layout);
        if (!k) continue;
        const one = row.ids && row.ids.length === 1 && !row.range && !row.with && !row.dev && fam === 'keyboard';
        if (one && scheme.actions.some((a) => a.id === row.ids[0] && a.hold)) k += ' (hold)';
        rows.push([(row.prefix || '') + k, pick(row.label, c)]);
      }
    }
    return rows;
  }

  function conflicts(scheme, B) {
    const out = [];
    for (const fam of Object.keys(B.bind)) {
      for (const ctx of scheme.contexts) {
        const by = {};
        for (const a of scheme.actions) {
          if (a.in.indexOf(ctx) < 0) continue;
          for (const s of B.bind[fam][a.id] || []) {
            for (const code of (fam === 'keyboard' ? sidesOf(s) : [s])) {
              const ids = by[code] || (by[code] = []);
              if (ids.indexOf(a.id) < 0) ids.push(a.id);
            }
          }
        }
        for (const code of Object.keys(by)) if (by[code].length > 1) out.push({ family: fam, context: ctx, control: code, actions: by[code] });
      }
    }
    return out;
  }

  const capture = (fam, c) => {
    if (fam !== 'keyboard') return c;
    const m = /^(Shift|Control|Alt|Meta)(Left|Right)$/.exec(c || '');
    return m ? m[1] : c;
  };

  return { resolve, padLayout, value, held, axis, is, actionOf, codeMap, gamepadRead, valid, keyLabel, label, legend, conflicts, capture };
}

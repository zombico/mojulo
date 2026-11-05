/**
 * MANA-UI — the game UI runtime (internal name; the agent reads plain words: `use`, `props`, `on`). Playscape says what
 * a game's UI is; this is the one runtime it runs on, so a screen is built once and not game by game.
 *
 * SINGLE SOURCE OF TRUTH, the controls-kernel discipline: everything lives inside `buildManaUi()`, a closure that
 * references nothing outside itself, so a page runs the same code by emitting `buildManaUi.toString()`
 * (`manaUiSource()`). Node imports the live instance for tests and design-time checks. Pure and seeded by nothing: no
 * clock, no dice, no DOM until `mount`.
 *
 * THE MODEL — state, form and function, props passed down (React's principles, none of its code):
 *   A NODE (data, what a recipe writes): { use: '<component | def>', id?, props?: { … }, on?: { <verb>: effect(s) },
 *     children?: [node] }
 *   PROPS flow down: a literal, or a BINDING read at render: { bind: '<path>' } (the game's state, through the host),
 *     { item: '<field>' } (the row a list draws), { pick: '<list id>.<field>' } (the row a list has selected, on any
 *     screen of the stack), { format: 'Lv {level}' } (the row's fields in words), { input: true } (the value an input
 *     now holds, in a change's effects). Props are typed closed words; a style prop throws: the theme dresses (context,
 *     never a prop), a closed `variant` is all a node may say about its look.
 *   STATE has three owners. The GAME's is read through bindings and never copied. The SCREEN's (focus, the open tab, a
 *     list's selected row, the stack) is this runtime's. The APPEARANCE (shown, focus, active, disabled) is derived from
 *     the two, as `data-st`.
 *   FORM is a tree as data: [tag, attrs, …children] (`toHtml` writes it), so one tree can be drawn by another backend.
 *   FUNCTION is effects, never callbacks (a recipe is JSON): the cue effects playscape speaks. This runtime does three
 *     itself, { open: '<screen>' }, { close: true } and { back: true }; every other effect goes to the host's `act`.
 *   DEFS are compositions as data: { <name>: { params: [name…], node } }, used like a component, `{ param: '<name>' }`
 *     inside replaced by what the use passes. Components are code (the closed set below); compositions are the agent's.
 *
 *   COMPONENTS                    name → { about, props: { <prop>: [type, default?, required?] }, children?, verbs? }
 *   readNode(node, defs?, where?) → the node with its defs expanded, or throws, teaching
 *   readSpec(spec)                → { screens, start } a spec read: { screens: { <id>: node }, defs?, start? }
 *   runtime(spec, host)           → the running UI. host: { read(path) → value, act(effect, from) }
 *     .open(id) .close() .press(action) .focusAt(n) .tab(n) .tick() → re-rendered? .view() → html .tree() .state()
 *     actions (the controls kernel's `menu` scheme): up, down, left, right, accept, back, tabNext, tabPrev
 *   toHtml(tree)                  → the tree as HTML (escaped, deterministic)
 *   readPath(obj, path)           → a dot path into a plain object (a host for tests and previews)
 *   mount(el, rt, { keys?, auto? }) → the DOM backend: draws the top screen into el, keys and pointer in, a frame tick
 */
export function buildManaUi() {
  const ROLES = ['title', 'heading', 'body', 'label', 'caption', 'numeral'];
  // what only the theme decides: a node that tries to carry one is pointed at it
  const STYLE_KEYS = ['style', 'class', 'className', 'color', 'colour', 'font', 'css', 'border', 'theme', 'skin', 'tokens', 'register'];
  const ACTIONS = ['up', 'down', 'left', 'right', 'accept', 'back', 'tabNext', 'tabPrev'];
  const ID = /^[a-z][a-z0-9-]*$/;
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const listOf = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

  // [type, default, required]; a type is 'text' | 'num' | 'bool' | 'list' | 'node' | an enum (an array of words)
  const COMPONENTS = {
    screen: { about: 'a screen on the stack: what one press of back leaves', props: { title: ['text'], layer: [['overlay', 'modal'], 'modal'], place: [['center', 'left', 'right', 'full'], 'center'] }, children: true, verbs: ['back'] },
    window: { about: 'a framed panel', props: { title: ['text'], variant: [['plain', 'inset'], 'plain'] }, children: true },
    stack: { about: 'children in a column or a row', props: { dir: [['column', 'row'], 'column'], gap: [['tight', 'normal', 'loose'], 'normal'], align: [['stretch', 'start', 'center', 'end', 'apart'], 'stretch'] }, children: true },
    split: { about: 'a list beside its detail: the first child narrow', props: { ratio: [['narrow', 'even'], 'narrow'] }, children: true },
    tabs: { about: 'tabs: one open, [ and ] turn them', props: {}, children: 'tab' },
    tab: { about: 'one tab of tabs', props: { label: ['text', undefined, true] }, children: true },
    text: { about: 'words in a type role', props: { value: ['text', '', true], role: [ROLES, 'body'] } },
    stat: { about: 'a label and its number (tabular figures)', props: { label: ['text', '', true], value: ['text', '', true], max: ['text'] } },
    bar: { about: 'a value against its max', props: { value: ['num', 0, true], max: ['num', 1, true], variant: [['plain', 'hp', 'mp', 'xp'], 'plain'], label: ['text'] } },
    compare: { about: 'before → after, better or worse told by a shape (▲ ▼ =), never by colour alone', props: { label: ['text', '', true], from: ['num', 0, true], to: ['num', 0, true], better: [['up', 'down'], 'up'] } },
    list: { about: 'rows to move through and pick: accept does the list\'s accept with the row as item', props: { rows: ['list', [], true], row: ['node'], empty: ['text', 'Nothing here'] }, verbs: ['accept'] },
    button: { about: 'a thing to press', props: { label: ['text', '', true], disabled: ['bool', false] }, verbs: ['accept'] },
    toggle: { about: 'on or off: accept flips it (a bound value is set on the host, never held here)', props: { label: ['text', '', true], value: ['bool', false, true] }, verbs: ['change'] },
    cycler: { about: '◀ a value ▶ from its options: left and right turn it (a bound value is set on the host)', props: { label: ['text', '', true], options: ['list', [], true], value: ['text', '', true] }, verbs: ['change'] },
  };
  const NAMES = Object.keys(COMPONENTS);
  const BINDS = ['bind', 'item', 'pick', 'format', 'input', 'param'];
  const isBinding = (v) => isObj(v) && Object.keys(v).length === 1 && BINDS.includes(Object.keys(v)[0]);

  // ── reading: shapes checked, defs expanded, errors that teach ─────────────────────────────────────────────────────
  const subst = (v, args) => {
    if (isObj(v) && Object.keys(v).length === 1 && typeof v.param === 'string') return args[v.param];
    if (Array.isArray(v)) return v.map((x) => subst(x, args));
    if (isObj(v)) { const o = {}; for (const k in v) { const x = subst(v[k], args); if (x !== undefined) o[k] = x; } return o; }
    return v;
  };
  function checkType(t, v, where) {
    if (v === undefined || isBinding(v)) return;
    const ok = Array.isArray(t) ? t.includes(v) : t === 'text' ? typeof v === 'string' || typeof v === 'number' : t === 'num' ? typeof v === 'number' && isFinite(v)
      : t === 'bool' ? typeof v === 'boolean' : t === 'list' ? Array.isArray(v) : t === 'node' ? isObj(v) : true;
    if (!ok) throw new Error(`${where} is ${Array.isArray(t) ? `one of: ${t.join(', ')}` : t === 'node' ? 'a node { use, props? }' : t}, or a binding ({ ${BINDS.filter((b) => b !== 'param').join(' | ')} })`);
  }
  function readNode(node, defs = {}, where = 'node', depth = 0) {
    if (depth > 24) throw new Error(`${where}: defs nest past 24 deep (a def that uses itself?)`);
    if (!isObj(node)) throw new Error(`${where} is a node { use, id?, props?, on?, children? }`);
    const styled = STYLE_KEYS.filter((k) => node[k] !== undefined || (isObj(node.props) && node.props[k] !== undefined));
    if (styled.length) throw new Error(`${where}.${styled[0]}: a node has no look of its own; the theme dresses it (a closed variant is all a node may say)`);
    if (typeof node.use !== 'string') throw new Error(`${where}.use names a component (${NAMES.join(', ')}) or a def`);
    if (node.id !== undefined && (typeof node.id !== 'string' || !ID.test(node.id))) throw new Error(`${where}.id '${node.id}' is a lower-case word`);
    if (node.props !== undefined && !isObj(node.props)) throw new Error(`${where}.props is { <prop>: value | binding }`);
    const def = defs[node.use];
    if (def && !COMPONENTS[node.use]) {
      const args = node.props || {}, params = def.params || [];
      for (const k in args) if (!params.includes(k)) throw new Error(`${where}.props.${k}: ${node.use} takes ${params.join(', ') || 'no props'}`);
      const out = subst(def.node, args);
      if (node.id) out.id = node.id;
      if (node.on) out.on = { ...(out.on || {}), ...node.on };
      return readNode(out, defs, `${where} (${node.use})`, depth + 1);
    }
    const C = COMPONENTS[node.use];
    if (!C) throw new Error(`${where}.use '${node.use}' is a component (${NAMES.join(', ')}) or a def (${Object.keys(defs).join(', ') || 'none given'})`);
    const props = node.props || {};
    for (const k in props) if (!C.props[k]) throw new Error(`${where}.props.${k}: ${node.use} takes ${Object.keys(C.props).join(', ') || 'no props'}`);
    for (const k in C.props) {
      const [t, , req] = C.props[k];
      if (req && props[k] === undefined) throw new Error(`${where}.props.${k} is needed (${node.use}: ${C.about})`);
      checkType(t, props[k], `${where}.props.${k}`);
    }
    const on = node.on || {};
    if (!isObj(on)) throw new Error(`${where}.on is { <verb>: effect | [effect] }`);
    for (const v in on) if (!(C.verbs || []).includes(v)) throw new Error(`${where}.on.${v}: ${node.use} answers ${(C.verbs || []).join(', ') || 'no verb'}`);
    const kids = listOf(node.children);
    if (kids.length && !C.children) throw new Error(`${where}: ${node.use} holds no children`);
    const children = kids.map((k, i) => readNode(k, defs, `${where}.children[${i}]`, depth));
    if (C.children === 'tab') children.forEach((k, i) => { if (k.use !== 'tab') throw new Error(`${where}.children[${i}] is a tab { use: 'tab', props: { label } }`); });
    const row = props.row && !isBinding(props.row) ? readNode(props.row, defs, `${where}.props.row`, depth) : props.row;
    return { use: node.use, ...(node.id ? { id: node.id } : {}), props: row ? { ...props, row } : props, on, children };
  }
  function readSpec(spec) {
    if (!isObj(spec) || !isObj(spec.screens)) throw new Error('a mana-ui spec is { screens: { <id>: node }, defs?, start? }');
    const defs = spec.defs || {};
    for (const d in defs) {
      if (COMPONENTS[d]) throw new Error(`defs.${d}: a def may not take a component's name`);
      if (!isObj(defs[d]) || !isObj(defs[d].node)) throw new Error(`defs.${d} is { params?: [name], node }`);
    }
    const screens = {};
    for (const id in spec.screens) {
      if (!ID.test(id)) throw new Error(`screens.${id}: a screen id is a lower-case word`);
      const n = readNode(spec.screens[id], defs, `screens.${id}`);
      if (n.use !== 'screen') throw new Error(`screens.${id} is a screen { use: 'screen', … } (it is ${n.use})`);
      screens[id] = n;
    }
    const start = spec.start === undefined ? null : spec.start;
    if (start !== null && !screens[start]) throw new Error(`start '${start}' is one of the screens: ${Object.keys(screens).join(', ')}`);
    return { screens, start };
  }

  // ── form: the tree as HTML ────────────────────────────────────────────────────────────────────────────────────────
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);
  function toHtml(t) {
    if (t === null || t === undefined || t === false) return '';
    if (!Array.isArray(t)) return esc(t);
    const [tag, attrs, ...kids] = t;
    let a = '';
    for (const k of Object.keys(attrs || {}).sort()) if (attrs[k] !== undefined && attrs[k] !== null && attrs[k] !== false) a += ` ${k}="${esc(attrs[k])}"`;
    return `<${tag}${a}>${kids.map(toHtml).join('')}</${tag}>`;
  }
  function readPath(obj, path) {
    if (typeof path !== 'string' || !path) return undefined;
    return path.split('.').reduce((v, k) => (v === null || v === undefined ? undefined : v[k]), obj);
  }

  // ── the runtime ───────────────────────────────────────────────────────────────────────────────────────────────────
  function runtime(spec, host) {
    const { screens, start } = readSpec(spec);
    const H = host || {};
    const S = { stack: [], ui: {}, picks: {} };
    let last = null;
    const uiOf = (id) => (S.ui[id] = S.ui[id] || { focus: 0, tabs: {}, vals: {} });
    const top = () => S.stack[S.stack.length - 1] || null;

    // a binding, read: the game's through the host, the rest from the scope or the screen's own state
    function resolve(v, scope, ctx) {
      if (!isBinding(v)) return v;
      const [k] = Object.keys(v), a = v[k];
      if (k === 'bind') { const x = H.read ? H.read(a) : undefined; ctx.reads.set(a, JSON.stringify(x === undefined ? null : x)); return x; }
      if (k === 'item') return a === '' || a === '.' ? scope.item : readPath(scope.item, a);
      if (k === 'input') return scope.input;
      if (k === 'format') return String(a).replace(/\{([a-zA-Z0-9_.]+)\}/g, (_, f) => { const x = readPath(scope.item, f); return x === undefined || x === null ? '' : String(x); });
      if (k === 'pick') {
        const dot = String(a).indexOf('.'), list = dot < 0 ? a : a.slice(0, dot), field = dot < 0 ? '' : a.slice(dot + 1), P = S.picks[list];
        if (!P) return undefined;
        const rows = listOf(resolve(P.rows, P.scope || {}, ctx)), row = rows[Math.min(P.i, rows.length - 1)];
        return field ? readPath(row, field) : row;
      }
      return undefined;
    }
    // effects with their bindings read (an effect may itself be a binding: a row's `then`)
    function effectsOf(v, scope, ctx) {
      const r = (x) => (isBinding(x) ? resolve(x, scope, ctx) : Array.isArray(x) ? x.map(r) : isObj(x) ? Object.fromEntries(Object.entries(x).map(([k, y]) => [k, r(y)])) : x);
      return listOf(r(v)).flat().filter(isObj);
    }
    function propsOf(n, scope, ctx) {
      const C = COMPONENTS[n.use], p = {}, src = {};
      for (const k in C.props) {
        const raw = n.props[k], [t, d] = C.props[k];
        if (isObj(raw) && typeof raw.bind === 'string' && Object.keys(raw).length === 1) src[k] = raw.bind;
        let v = k === 'row' ? raw : resolve(raw, scope, ctx);
        if (v === undefined || v === null) v = d;
        if (t === 'num') v = Number(v) || 0;
        else if (t === 'text' && v !== undefined) v = String(v);
        else if (t === 'list') v = listOf(v);
        else if (t === 'bool') v = !!v;
        p[k] = v;
      }
      return { p, src };
    }

    function render() {
      const id = top();
      const ctx = { reads: new Map(), focus: [], tabs: [], screen: id };
      if (!id) { last = { tree: ['div', { class: 'mana-root', 'data-open': 'none' }], ...ctx }; return last; }
      const U = uiOf(id);
      const st = (fi, base = 'shown') => (fi === U.focus ? 'focus' : base);
      const draw = (n, key, scope) => {
        const { p, src } = propsOf(n, scope, ctx), kids = (k) => n.children.map((c, i) => draw(c, `${key}.${c.id || i}`, scope));
        const cls = `mana-${n.use}`;
        switch (n.use) {
          case 'screen': return ['section', { class: cls, 'data-layer': p.layer, 'data-place': p.place }, p.title ? ['h2', { class: 'mana-title' }, p.title] : null, ...kids()];
          case 'window': return ['div', { class: cls, 'data-variant': p.variant }, p.title ? ['h3', { class: 'mana-heading' }, p.title] : null, ...kids()];
          case 'stack': return ['div', { class: cls, 'data-dir': p.dir, 'data-gap': p.gap, 'data-align': p.align }, ...kids()];
          case 'split': return ['div', { class: cls, 'data-ratio': p.ratio }, ...kids()];
          case 'tab': return ['div', { class: cls }, ...kids()];
          case 'tabs': {
            const open = Math.min(U.tabs[key] || 0, Math.max(0, n.children.length - 1));
            ctx.tabs.push({ key, n: n.children.length });
            const strip = ['div', { class: 'mana-tabstrip' }, ...n.children.map((c, i) => ['span', { class: 'mana-tablabel', 'data-st': i === open ? 'active' : 'shown', 'data-tab': `${ctx.tabs.length - 1}:${i}` }, String(resolve(c.props.label, scope, ctx))])];
            return ['div', { class: cls }, strip, n.children.length ? draw(n.children[open], `${key}.${open}`, scope) : null];
          }
          case 'text': return ['span', { class: cls, 'data-role': p.role }, p.value];
          case 'stat': return ['div', { class: cls }, ['span', { class: 'mana-label' }, p.label], ['span', { class: 'mana-num' }, p.value, p.max !== undefined ? ['span', { class: 'mana-max' }, ` / ${p.max}`] : null]];
          case 'bar': {
            const r = p.max > 0 ? Math.max(0, Math.min(1, p.value / p.max)) : 0;
            return ['div', { class: cls, 'data-variant': p.variant, 'data-low': r <= 0.25 ? 'yes' : null }, p.label ? ['span', { class: 'mana-label' }, p.label] : null,
              ['span', { class: 'mana-track' }, ['i', { style: `--r:${Math.round(r * 1000) / 1000}` }]], ['span', { class: 'mana-num' }, `${p.value}/${p.max}`]];
          }
          case 'compare': {
            const d = p.to - p.from, good = p.better === 'up' ? d > 0 : d < 0, mark = d === 0 ? '=' : good ? '▲' : '▼';
            return ['div', { class: cls, 'data-way': d === 0 ? 'same' : good ? 'better' : 'worse' }, ['span', { class: 'mana-label' }, p.label], ['span', { class: 'mana-num' }, String(p.from)], ['span', { class: 'mana-mark' }, mark], ['span', { class: 'mana-num' }, String(p.to)]];
          }
          case 'list': {
            if (n.id) { const P = S.picks[n.id]; S.picks[n.id] = { rows: n.props.rows, scope, i: P ? P.i : 0, touched: !!(P && P.touched) }; }
            // the active row (a detail reads it) shows once the list has held the focus
            const sel = n.id && S.picks[n.id].touched ? S.picks[n.id].i : -1;
            if (!p.rows.length) return ['div', { class: cls, 'data-empty': 'yes' }, ['span', { class: 'mana-text', 'data-role': 'caption' }, p.empty]];
            return ['div', { class: cls }, ...p.rows.map((item, i) => {
              const fi = ctx.focus.length, sc = { ...scope, item }, off = isObj(item) && !!item.disabled;
              ctx.focus.push({ kind: 'row', n, key, i, scope: sc, off });
              const body = n.props.row ? draw(n.props.row, `${key}.${i}`, sc) : ['span', { class: 'mana-text' }, isObj(item) ? String(item.label ?? item.name ?? item.id ?? '') : String(item)];
              return ['div', { class: 'mana-row', 'data-k': fi, 'data-st': off && fi !== U.focus ? 'disabled' : st(fi, i === sel ? 'active' : 'shown') }, body];
            })];
          }
          case 'button': {
            const fi = ctx.focus.length;
            ctx.focus.push({ kind: 'button', n, key, scope, off: p.disabled });
            return ['div', { class: cls, 'data-k': fi, 'data-st': p.disabled && fi !== U.focus ? 'disabled' : st(fi) }, p.label];
          }
          case 'toggle': case 'cycler': {
            const fi = ctx.focus.length, held = key in U.vals ? U.vals[key] : p.value, now = src.value ? p.value : held;
            ctx.focus.push({ kind: n.use, n, key, scope, src: src.value, value: now, options: p.options });
            const shown = n.use === 'toggle' ? (now ? 'On' : 'Off') : String(now);
            return ['div', { class: cls, 'data-k': fi, 'data-st': st(fi), 'data-on': n.use === 'toggle' ? (now ? 'yes' : 'no') : null }, ['span', { class: 'mana-label' }, p.label],
              ['span', { class: 'mana-value' }, n.use === 'cycler' ? ['span', { class: 'mana-mark' }, '◀ '] : null, shown, n.use === 'cycler' ? ['span', { class: 'mana-mark' }, ' ▶'] : null]];
          }
        }
        return null;
      };
      const tree = ['div', { class: 'mana-root', 'data-open': id }, draw(screens[id], id, {})];
      if (ctx.focus.length && U.focus >= ctx.focus.length) { U.focus = ctx.focus.length - 1; return render(); }
      last = { tree, ...ctx };
      return last;
    }

    const from = (f, verb) => ({ screen: top(), key: f ? f.key : top(), verb });
    function run(effects, f, verb) {
      for (const e of effects) {
        if (typeof e.open === 'string' && screens[e.open]) open(e.open);
        else if (e.close === true) close();
        else if (e.back === true) back();
        else if (H.act) H.act(e, from(f, verb));
      }
    }
    function open(id) {
      if (!screens[id]) throw new Error(`no screen '${id}' (screens: ${Object.keys(screens).join(', ')})`);
      if (top() !== id) S.stack.push(id);
      uiOf(id);
      render();
    }
    function close() {
      S.stack.length = 0;
      if (H.act) H.act({ emit: 'mana:closed' }, { screen: null, key: null, verb: 'close' });
      render();
    }
    function back() {
      const id = S.stack.pop();
      if (!S.stack.length && H.act) H.act({ emit: 'mana:closed' }, { screen: id, key: id, verb: 'back' });
      render();
    }
    // the row or input in focus: a list remembers its row (the active row a detail reads)
    function noteFocus() {
      const f = last && last.focus[uiOf(top()).focus];
      if (f && f.kind === 'row' && f.n.id) { S.picks[f.n.id].i = f.i; S.picks[f.n.id].touched = true; }
    }
    function change(f, dir) {
      let v;
      if (f.kind === 'toggle') v = !f.value;
      else { const o = f.options.map(String), i = o.indexOf(String(f.value)); v = o.length ? o[((i < 0 ? 0 : i + dir) % o.length + o.length) % o.length] : f.value; }
      if (f.src) { if (H.act) H.act({ set: f.src, to: f.kind === 'toggle' ? (v ? 1 : 0) : v }, from(f, 'change')); }
      else uiOf(top()).vals[f.key] = v;
      if (f.n.on.change) run(effectsOf(f.n.on.change, { ...f.scope, input: v }, last), f, 'change');
    }
    function press(action) {
      if (!ACTIONS.includes(action)) throw new Error(`press: an action is one of ${ACTIONS.join(', ')}`);
      if (!top()) return false;
      if (!last || last.screen !== top()) render();
      const U = uiOf(top()), n = last.focus.length, f = last.focus[U.focus];
      if (action === 'up' || action === 'down') { if (n) U.focus = (U.focus + (action === 'down' ? 1 : -1) + n) % n; render(); noteFocus(); }
      else if (action === 'left' || action === 'right') { if (f && f.kind === 'cycler') change(f, action === 'right' ? 1 : -1); }
      else if (action === 'tabNext' || action === 'tabPrev') {
        const T = last.tabs[0];
        if (T) { U.tabs[T.key] = ((U.tabs[T.key] || 0) + (action === 'tabNext' ? 1 : -1) + T.n) % T.n; }
      } else if (action === 'accept') {
        if (f && !f.off) {
          if (f.kind === 'toggle') change(f, 1);
          else if (f.kind === 'cycler') change(f, 1);
          else if (f.n.on.accept) run(effectsOf(f.n.on.accept, f.scope, last), f, 'accept');
        }
      } else if (action === 'back') {
        const on = screens[top()].on.back;
        if (on) run(effectsOf(on, {}, last), null, 'back'); else back();
      }
      render();
      return true;
    }
    function focusAt(k) { if (!top()) return; if (!last) render(); if (k >= 0 && k < last.focus.length) { uiOf(top()).focus = k; render(); noteFocus(); } }
    function tab(t, i) { if (!last) return; const T = last.tabs[t]; if (T && i >= 0 && i < T.n) { uiOf(top()).tabs[T.key] = i; render(); } }
    // a frame: re-render when a value the screen read has changed (the game's state is read, never copied)
    function tick() {
      if (!last || !top()) return false;
      for (const [path, was] of last.reads) { const x = H.read ? H.read(path) : undefined; if (JSON.stringify(x === undefined ? null : x) !== was) { render(); return true; } }
      return false;
    }
    if (start) open(start); else render();
    return {
      open, close, press, focusAt, tab, tick,
      view: () => toHtml((last || render()).tree),
      tree: () => (last || render()).tree,
      state: () => ({ stack: S.stack.slice(), screen: top(), focus: top() ? uiOf(top()).focus : -1, focusables: last ? last.focus.length : 0, picks: Object.fromEntries(Object.entries(S.picks).map(([k, v]) => [k, v.i])) }),
    };
  }

  // ── the DOM backend ───────────────────────────────────────────────────────────────────────────────────────────────
  const KEYS = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Enter: 'accept', Space: 'accept', KeyE: 'accept', Escape: 'back', Backspace: 'back', BracketRight: 'tabNext', BracketLeft: 'tabPrev' };
  function mount(el, rt, opts) {
    const o = opts || {}, keys = o.keys || KEYS;
    let html = '';
    const paint = () => { const h = rt.view(); if (h !== html) { html = h; el.innerHTML = h; } };
    el.addEventListener('click', (ev) => {
      const t = ev.target && ev.target.closest ? ev.target.closest('[data-k],[data-tab]') : null;
      if (!t) return;
      if (t.dataset.tab) { const [a, b] = t.dataset.tab.split(':').map(Number); rt.tab(a, b); }
      else { const k = Number(t.dataset.k); const was = rt.state().focus; rt.focusAt(k); if (was === k) rt.press('accept'); }
      paint();
    });
    if (o.keyboard !== false && typeof window !== 'undefined') window.addEventListener('keydown', (ev) => {
      const a = keys[ev.code];
      if (!a || !rt.state().screen) return;
      ev.preventDefault();
      rt.press(a);
      paint();
    });
    if (o.auto && typeof requestAnimationFrame === 'function') { const loop = () => { if (rt.tick()) paint(); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
    paint();
    return { paint };
  }

  return { COMPONENTS, ROLES, ACTIONS, KEYS, readNode, readSpec, runtime, toHtml, readPath, mount };
}

export const manaUi = buildManaUi();
/** The kernel as page source: an expression a page assigns (`const manaUi = ${manaUiSource()};`). */
export const manaUiSource = () => `(${buildManaUi.toString()})()`;

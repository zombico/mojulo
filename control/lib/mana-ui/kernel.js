/**
 * MANA-UI — the game UI runtime (internal name; the agent reads plain words: `use`, `props`, `on`). Playscape says what
 * a game's UI is; this is the one runtime it runs on, so a screen is built once and not game by game.
 *
 * SINGLE SOURCE OF TRUTH, the controls-kernel discipline: everything lives inside `buildManaUi()`, a closure that
 * references nothing outside itself, so a page runs the same code by emitting `buildManaUi.toString()`
 * (`manaUiSource()`). Node imports the live instance for tests and design-time checks. No clock, no dice, no DOM until
 * `mount`: the same spec over the same state draws the same HTML.
 *
 * THE MODEL — state, form and function, props passed down (React's principles, none of its code):
 *   A NODE (data, what a recipe writes): { use: '<component | def>', id?, props?, on?: { <verb>: effect(s) },
 *     children?, when?, unless? } (`when` / `unless`: drawn only while a value, or a binding, is truthy / falsy)
 *   PROPS flow down: a literal, or a BINDING read at render:
 *     { bind: '<path>' }            the game's state, through the host (the path may itself be a binding: a row's var)
 *     { item: '<field>' }           the row a list, a grid, a tree, an anchor or a page is drawing ('' the row itself)
 *     { pick: '<id>.<field>' }      the row a list, grid, tree or carousel with that id has selected (its own screen's
 *                                   first, else the last screen that drew one); '<id>@<n>.<field>' the row seat n is on
 *                                   (couch play: a detail per player); the path may itself be a binding ({ format })
 *     { format: 'Lv {level}' }      the row's fields in words
 *     { input: true }               the value an input now holds (in a change's or a confirm's effects)
 *     { seat: true }                the seat that pressed (couch play: in an effect, who picked)
 *     Props are typed closed words; a style prop throws: the theme dresses (context, never a prop), and a closed
 *     `variant` is all a node may say about its look.
 *   STATE has three owners. The GAME's is read through bindings and never copied: a bound input asks the host to `set`.
 *     The SCREEN's (each seat's focus, the open tab, a list's selected row and scroll, a draft: an allocation, a name)
 *     is this runtime's. The APPEARANCE (shown, focus, active, disabled) is derived from the two, as `data-st`.
 *   FORM is a tree as data: [tag, attrs, …children] (`toHtml` writes it), so another backend can draw the same tree.
 *   FUNCTION is effects, never callbacks (a recipe is JSON): the cue effects playscape speaks. This runtime does
 *     { open: '<screen>' }, { close: true } and { back: true }; every other effect goes to the host's `act`.
 *   DEFS are compositions as data: { <name>: { params: [name…], node } }, `{ param: '<name>' }` inside.
 *
 *   A SPEC: { screens: { <id>: node (a screen) }, hud?: node (a hud, drawn under the stack), defs?, start? }
 *   SIDES: a row, a cell, a table's row or a badge whose data carries `side` (0..7: a team, a seat, a lane) draws a chip
 *   in that side's colour (the theme's sides, a kit); its name still says whose it is (values first).
 *
 *   COMPONENTS / COMPONENT_IDS    name → { about, group, props: { <prop>: [type, default?, required?] }, children?, verbs? }
 *   REGIONS · AWARENESS · MARKERS · PIP_SHAPES   the closed words some components take
 *   readNode(node, defs?, where?) → the node with its defs expanded, or throws, teaching
 *   readSpec(spec)                → { screens, hud, start }
 *   runtime(spec, host)           → the running UI. host: { read(path) → value, act(effect, from) }
 *     .open(id) .close() .press(action, seat?) .focusAt(n, seat?) .tab(t, i) .tick() → re-rendered?
 *     .input(mode, layout?)  what the player is using: keys | pad | xr (the focus shows as a cursor) | touch | mouse (it
 *                         does not: what is tapped is selected, and a touch screen's lists scroll and its targets grow);
 *                         a pad's printed layout (xbox | playstation | nintendo) picks its glyphs
 *     .glyphs(table)      what each action's control is called, per family: { keys: { <action>: 'Enter' }, pad: {
 *                         <layout>: { <action>: 'A' } }, xr?: { … }, touch?: { … } } (controls/mana-controls.js builds
 *                         it from the control schemes); a prompt and a legend print the one the player is holding
 *     .point(n, x, seat?) a tap or a click on focusable n at x across it (0..1): a slider takes the value under it, the
 *                         ends of a ◀ ▶ input turn it, anything else is done at once; a row with a detail beside it (in
 *                         a split) is selected first and done on a second tap
 *     .hudTap(n)          a tap on the HUD's tappable part n (a button or a slot with `on.accept`: pause, a skill)
 *     .view() → html .tree() .state()
 *     actions (the controls kernel's `menu` scheme): up, down, left, right, accept, back, tabNext, tabPrev
 *   toHtml(tree) · readPath(obj, path)
 *   mount(el, rt, { controls?, drivers?, keyboard?, auto? }) → the DOM backend: draws into el; in: the keys, the pads,
 *     the pointer and any driver; out: the frame, the page's hold, and the touch pad's controls
 *     controls  the control scheme resolved (controls/mana-controls.js manaControls): { keys: { <code>: <action> },
 *               pad: { <layout>: { b: { <button>: <action> }, a: [[axis, sign, action]] } }, padLayout(id) → layout }:
 *               each connected pad is read every frame on its press edges, pad n driving seat n (else the first)
 *     drivers   [() → { <action>: 1 } | { seat?, input?, actions }]: any other device (a headset, a wheel) the same way
 *     poll      false: the host reads the pads itself, calling poll() (a page of several runtimes reads one at a time)
 *     returns   { paint, key, poll, read(control) }: read is the drawn touch pad as the `touch` family's driver (devices.js:
 *               it speaks the gamepad's controls, south, east, leftX …), for the page's own controls kernel
 */
export function buildManaUi() {
  const ROLES = ['display', 'title', 'heading', 'body', 'label', 'caption', 'numeral'];
  const REGIONS = ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'];
  // an enemy's awareness, each a SHAPE (never a colour alone): what it knows of you
  const AWARENESS = { unaware: '–', suspicious: '?', searching: '??', alert: '!', combat: '!!', fleeing: '»', down: '✕' };
  const MARKERS = { self: '▲', ally: '●', foe: '✕', goal: '★', item: '◆', poi: '○' };
  const PIP_SHAPES = { pip: ['●', '○'], heart: ['♥', '♡'], square: ['■', '□'], diamond: ['◆', '◇'] };
  const RETICLES = { cross: '+', dot: '·', circle: '◯', bracket: '[ ]' };
  const STYLE_KEYS = ['style', 'class', 'className', 'color', 'colour', 'font', 'css', 'border', 'theme', 'skin', 'tokens', 'register'];
  const ACTIONS = ['up', 'down', 'left', 'right', 'accept', 'back', 'tabNext', 'tabPrev'];
  const INPUTS = ['keys', 'pad', 'xr', 'touch', 'mouse'];
  // a drawn pad's buttons, where a gamepad has them (the face buttons by their Xbox print)
  const PAD_FACES = { A: 'south', B: 'east', X: 'west', Y: 'north' };
  const ID = /^[a-z][a-z0-9-]*$/;
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const listOf = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // [type, default, required]; a type is 'text' | 'num' | 'bool' | 'list' | 'node' | 'any' | an enum (an array of words)
  const T = 'text', N = 'num', B = 'bool', L = 'list', ND = 'node', A = 'any';
  const COMPONENTS = {
    // layout
    screen: { group: 'layout', about: 'a screen on the stack: what one back leaves; `seats` > 1 gives each couch seat its own cursor', props: { title: [T], layer: [['overlay', 'modal'], 'modal'], place: [['center', 'left', 'right', 'full', 'top', 'bottom', 'sheet'], 'center'], seats: [N, 1] }, children: true, verbs: ['back'] },
    window: { group: 'layout', about: 'a framed panel', props: { title: [T], variant: [['plain', 'inset', 'ghost'], 'plain'] }, children: true },
    stack: { group: 'layout', about: 'children in a column or a row; `fill` a row that takes its place\'s width, its children sharing it (two fighters\' bars)', props: { dir: [['column', 'row'], 'column'], gap: [['tight', 'normal', 'loose'], 'normal'], align: [['stretch', 'start', 'center', 'end', 'apart'], 'stretch'], fill: [B, false] }, children: true },
    split: { group: 'layout', about: 'two panes: the first a list, the second its detail', props: { ratio: [['narrow', 'even', 'wide'], 'narrow'] }, children: true },
    tabs: { group: 'layout', about: 'tabs, one open, [ and ] turn them: tab children, or `pages` (a list) drawn by `page` and named by their `label` field', props: { pages: [L], page: [ND], label: [T, 'label'] }, children: 'tab' },
    tab: { group: 'layout', about: 'one tab of tabs', props: { label: [T, undefined, true] }, children: true },
    each: { group: 'layout', about: 'a `row` drawn for each item, not itself focusable (the stats in a detail, the fields of an options page)', props: { rows: [L, [], true], row: [ND, undefined, true], dir: [['column', 'row'], 'column'] } },
    divider: { group: 'layout', about: 'a rule between groups, with an optional label', props: { label: [T] } },
    // in-game: the HUD's places
    hud: { group: 'hud', about: 'the in-game layer under the stack: its children are regions and the layers (anchors, edges, threat, letterbox)', props: {}, children: 'hud' },
    region: { group: 'hud', about: 'one of the nine screen places; parts stack inside it (in a hud, or laid out over a screen)', props: { at: [REGIONS, 'top-left'] }, children: true },
    anchors: { group: 'hud', layer: true, about: 'one `row` drawn over each thing in the world at its screen place (x, y from 0 to 1): nameplates, damage numbers', props: { rows: [L, [], true], row: [ND, undefined, true], x: [T, 'x'], y: [T, 'y'] } },
    edges: { group: 'hud', layer: true, about: 'what is off screen, held at the screen\'s edge with an arrow toward it (x, y outside 0..1): an objective, a foe behind you', props: { markers: [L, [], true] } },
    threat: { group: 'hud', layer: true, about: 'where harm came from: a mark on a ring round the centre for each bearing (degrees from where you face)', props: { markers: [L, [], true] } },
    letterbox: { group: 'hud', layer: true, about: 'the cinema bars of a cutscene', props: {} },
    touchpad: { group: 'hud', about: 'the controls a touch screen draws, a driver of the gamepad\'s own controls: a stick (the left stick) and round buttons (a word, or { label, control: south | east | west | north | rb … })', props: { stick: [B, true], buttons: [L, ['A', 'B']] } },
    legend: { group: 'value', about: 'what the buttons do here (a row: { action | actions: [..], label }), each with the glyph of the control the player is holding (keys, an Xbox, a PlayStation or a Nintendo pad); a finger needs none, so a touch screen draws none', props: { rows: [L, [], true] } },
    // values
    text: { group: 'value', about: 'words in a type role', props: { value: [T, '', true], role: [ROLES, 'body'] } },
    stat: { group: 'value', about: 'a label and its number', props: { label: [T, '', true], value: [T, '', true], max: [T] } },
    bar: { group: 'value', about: 'a value against its max; segments mark phases or chunks; `ghost` the value before the last hit (drawn hatched, the chip a fighting game shows); rtl fills from the right (the second fighter)', props: { value: [N, 0, true], max: [N, 1, true], variant: [['plain', 'hp', 'mp', 'xp', 'stamina', 'shield', 'boss'], 'plain'], label: [T], segments: [N, 0], ghost: [N, 0], dir: [['ltr', 'rtl'], 'ltr'] } },
    pips: { group: 'value', about: 'a count as marks: hearts, pips', props: { value: [N, 0, true], max: [N, 3, true], shape: [Object.keys(PIP_SHAPES), 'pip'], label: [T] } },
    counter: { group: 'value', about: 'an icon and a count (ammo, coins, keys)', props: { label: [T, '', true], value: [T, '', true], max: [T], icon: [T] } },
    timer: { group: 'value', about: 'seconds as a clock', props: { seconds: [N, 0, true], format: [['mmss', 'ss', 'hmmss'], 'mmss'], label: [T] } },
    compare: { group: 'value', about: 'before → after, better or worse told by a shape (▲ ▼ =)', props: { label: [T, '', true], from: [N, 0, true], to: [N, 0, true], better: [['up', 'down'], 'up'] } },
    icon: { group: 'value', about: 'an icon\'s place, named', props: { name: [T, '', true], size: [['s', 'm', 'l'], 'm'] } },
    portrait: { group: 'value', about: 'a face\'s place, named', props: { name: [T, ''], size: [['s', 'm', 'l'], 'm'] } },
    image: { group: 'value', about: 'a picture\'s place (a logo, an arena\'s preview, key art)', props: { label: [T, ''], ratio: [['wide', 'square', 'tall', 'banner'], 'wide'] } },
    badge: { group: 'value', about: 'a small mark: new, a count, a rank, a score; `side` its side\'s chip', props: { value: [T, '', true], variant: [['plain', 'strong', 'muted'], 'plain'], side: [A] } },
    table: { group: 'value', about: 'rows under columns (a scoreboard, a forecast, a stat panel): the row whose `mark` field is true is yours, a row\'s `lead` names the column that leads it (marked ▲), a row\'s `side` its chip', props: { columns: [L, [], true], rows: [L, [], true], mark: [T, 'self'] } },
    gauge: { group: 'value', about: 'a value on a dial (a speedometer, a pressure, a charge)', props: { value: [N, 0, true], max: [N, 1, true], label: [T], unit: [T] } },
    slot: { group: 'value', about: 'an action or a hotbar slot: what is in it, its key, a cooldown left (0..1), a count; active when it is the one in hand; with `on.accept` a touch screen taps it', props: { name: [T, ''], key: [T], cooldown: [N, 0], count: [T], active: [B, false] }, verbs: ['accept'] },
    prompt: { group: 'value', about: 'what a button does here: [E] Talk (the glyph is the host\'s legend, else the action)', props: { action: [T, 'accept'], label: [T, '', true], glyph: [T] } },
    // in-game: aim, maps, the feed, moments
    reticle: { group: 'hud', about: 'the aim; a hit adds a hitmarker shape', props: { shape: [Object.keys(RETICLES), 'cross'], hit: [B, false] } },
    minimap: { group: 'hud', about: 'the map in a corner: markers at x, y from 0 to 1, each kind a shape', props: { markers: [L, []], shape: [['square', 'round'], 'square'], label: [T] } },
    compass: { group: 'hud', about: 'a heading strip with the bearings of markers', props: { heading: [N, 0, true], markers: [L, []] } },
    feed: { group: 'hud', about: 'the last few lines of a log (kills, pickups, chat from the world)', props: { rows: [L, [], true], field: [T, 'text'], max: [N, 4] } },
    toast: { group: 'hud', about: 'a passing word', props: { value: [T, '', true] } },
    banner: { group: 'hud', about: 'the moment, centred: a title and its line', props: { value: [T, '', true], sub: [T] } },
    // enemies
    awareness: { group: 'enemy', about: `what an enemy knows of you, as a shape: ${Object.entries(AWARENESS).map(([k, v]) => `${k} ${v}`).join(', ')}`, props: { state: [Object.keys(AWARENESS), 'unaware', true], label: [B, true] } },
    statuses: { group: 'enemy', about: 'the statuses on someone (a word, or { name, turns })', props: { rows: [L, [], true] } },
    // inputs and collections
    list: { group: 'input', about: 'rows to move through and pick; `visible` scrolls a long list', props: { rows: [L, [], true], row: [ND], empty: [T, 'Nothing here'], visible: [N, 0] }, verbs: ['accept'] },
    grid: { group: 'input', about: 'cells in columns, moved through in two directions (an inventory, a roster)', props: { cells: [L, [], true], cell: [ND], columns: [N, 4], empty: [T, 'Nothing here'] }, verbs: ['accept'] },
    tree: { group: 'input', about: 'nodes laid in tiers by what they require (a skill or tech tree): { id, requires?, state: learned | available | locked }', props: { nodes: [L, [], true], node: [ND], label: [T, 'name'] }, verbs: ['accept'] },
    carousel: { group: 'input', about: 'one item at a time, left and right turn it (a bound value is set by the item\'s id)', props: { items: [L, [], true], item: [ND], value: [A] }, verbs: ['accept', 'change'] },
    button: { group: 'input', about: 'a thing to press', props: { label: [T, '', true], disabled: [B, false] }, verbs: ['accept'] },
    toggle: { group: 'input', about: 'on or off (a bound value is set on the host, never held here)', props: { label: [T, '', true], value: [B, false, true] }, verbs: ['change'] },
    cycler: { group: 'input', about: '◀ a value ▶ from its options', props: { label: [T, '', true], options: [L, [], true], value: [A, '', true] }, verbs: ['change'] },
    slider: { group: 'input', about: 'a number between min and max, by step', props: { label: [T, '', true], value: [N, 0, true], min: [N, 0], max: [N, 10], step: [N, 1] }, verbs: ['change'] },
    keybind: { group: 'input', about: 'an action and what it is bound to; accept asks the host to capture a new one; `conflict` when another action in the same context shares a control', props: { label: [T, '', true], keys: [L, []], conflict: [B, false] }, verbs: ['accept'] },
    field: { group: 'input', about: 'an input chosen by data (an options row): kind toggle | cycler | slider | keybind', props: { kind: [['toggle', 'cycler', 'slider', 'keybind'], undefined, true], label: [T, '', true], value: [A], options: [L, []], min: [N, 0], max: [N, 10], step: [N, 1], keys: [L, []] }, verbs: ['change', 'accept'] },
    allocator: { group: 'input', about: 'points spent across rows (level up): a draft until confirm, never past the points or a row\'s max', props: { rows: [L, [], true], points: [N, 0, true] }, verbs: ['confirm', 'change'] },
    textentry: { group: 'input', about: 'a name typed from a grid of letters (a pad can type): a draft until done', props: { label: [T], value: [T, ''], max: [N, 12], charset: [['letters', 'alnum'], 'letters'] }, verbs: ['done'] },
  };
  const COMPONENT_IDS = Object.keys(COMPONENTS);
  const BINDS = ['bind', 'item', 'pick', 'format', 'input', 'seat', 'param'];
  const isBinding = (v) => isObj(v) && Object.keys(v).length === 1 && BINDS.includes(Object.keys(v)[0]);
  const CHARSETS = { letters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ', alnum: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ' };

  // ── reading: shapes checked, defs expanded, errors that teach ─────────────────────────────────────────────────────
  const subst = (v, args) => {
    if (isObj(v) && Object.keys(v).length === 1 && typeof v.param === 'string') return args[v.param];
    if (Array.isArray(v)) return v.map((x) => subst(x, args));
    if (isObj(v)) { const o = {}; for (const k in v) { const x = subst(v[k], args); if (x !== undefined) o[k] = x; } return o; }
    return v;
  };
  function checkType(t, v, where) {
    if (v === undefined || isBinding(v) || t === A) return;
    const ok = Array.isArray(t) ? t.includes(v) : t === T ? typeof v === 'string' || typeof v === 'number' : t === N ? typeof v === 'number' && isFinite(v)
      : t === B ? typeof v === 'boolean' : t === L ? Array.isArray(v) : t === ND ? isObj(v) : true;
    if (!ok) throw new Error(`${where} is ${Array.isArray(t) ? `one of: ${t.join(', ')}` : t === ND ? 'a node { use, props? }' : t}, or a binding ({ ${BINDS.filter((b) => b !== 'param').join(' | ')} })`);
  }
  function readNode(node, defs = {}, where = 'node', depth = 0) {
    if (depth > 32) throw new Error(`${where}: defs nest past 32 deep (a def that uses itself?)`);
    if (!isObj(node)) throw new Error(`${where} is a node { use, id?, props?, on?, children?, when?, unless? }`);
    const styled = STYLE_KEYS.filter((k) => node[k] !== undefined || (isObj(node.props) && node.props[k] !== undefined));
    if (styled.length) throw new Error(`${where}.${styled[0]}: a node has no look of its own; the theme dresses it (a closed variant is all a node may say)`);
    if (typeof node.use !== 'string') throw new Error(`${where}.use names a component (${COMPONENT_IDS.join(', ')}) or a def`);
    if (node.id !== undefined && (typeof node.id !== 'string' || !ID.test(node.id))) throw new Error(`${where}.id '${node.id}' is a lower-case word`);
    if (node.props !== undefined && !isObj(node.props)) throw new Error(`${where}.props is { <prop>: value | binding }`);
    const def = defs[node.use];
    if (def && !COMPONENTS[node.use]) {
      const args = node.props || {}, params = def.params || [];
      for (const k in args) if (!params.includes(k)) throw new Error(`${where}.props.${k}: ${node.use} takes ${params.join(', ') || 'no props'}`);
      const out = subst(def.node, args);
      for (const k of ['id', 'when', 'unless']) if (node[k] !== undefined) out[k] = node[k];
      if (node.on) out.on = { ...(out.on || {}), ...node.on };
      return readNode(out, defs, `${where} (${node.use})`, depth + 1);
    }
    const C = COMPONENTS[node.use];
    if (!C) throw new Error(`${where}.use '${node.use}' is a component (${COMPONENT_IDS.join(', ')}) or a def (${Object.keys(defs).join(', ') || 'none given'})`);
    const props = { ...(node.props || {}) };
    for (const k in props) if (!C.props[k]) throw new Error(`${where}.props.${k}: ${node.use} takes ${Object.keys(C.props).join(', ') || 'no props'}`);
    for (const k in C.props) {
      const [t, , req] = C.props[k];
      if (req && props[k] === undefined) throw new Error(`${where}.props.${k} is needed (${node.use}: ${C.about})`);
      checkType(t, props[k], `${where}.props.${k}`);
      if (t === ND && isObj(props[k]) && !isBinding(props[k])) props[k] = readNode(props[k], defs, `${where}.props.${k}`, depth);
    }
    const on = node.on || {};
    if (!isObj(on)) throw new Error(`${where}.on is { <verb>: effect | [effect] }`);
    for (const v in on) if (!(C.verbs || []).includes(v)) throw new Error(`${where}.on.${v}: ${node.use} answers ${(C.verbs || []).join(', ') || 'no verb'}`);
    const kids = listOf(node.children);
    if (kids.length && !C.children) throw new Error(`${where}: ${node.use} holds no children`);
    const children = kids.map((k, i) => readNode(k, defs, `${where}.children[${i}]`, depth));
    if (C.children === 'tab') children.forEach((k, i) => { if (k.use !== 'tab') throw new Error(`${where}.children[${i}] is a tab { use: 'tab', props: { label } }`); });
    if (C.children === 'hud') children.forEach((k, i) => { if (k.use !== 'region' && !COMPONENTS[k.use].layer) throw new Error(`${where}.children[${i}] is a region { use: 'region', props: { at } } or a layer (${COMPONENT_IDS.filter((c) => COMPONENTS[c].layer).join(', ')}) (it is ${k.use})`); });
    const out = { use: node.use, props, on, children };
    for (const k of ['id', 'when', 'unless']) if (node[k] !== undefined) out[k] = node[k];
    return out;
  }
  function readSpec(spec) {
    if (!isObj(spec) || !isObj(spec.screens)) throw new Error('a mana-ui spec is { screens: { <id>: node }, hud?, defs?, start? }');
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
    const hud = spec.hud === undefined ? null : readNode(spec.hud, defs, 'hud');
    if (hud && hud.use !== 'hud') throw new Error(`hud is a hud { use: 'hud', children: [regions, anchors] } (it is ${hud.use})`);
    const start = spec.start === undefined ? null : spec.start;
    if (start !== null && !screens[start]) throw new Error(`start '${start}' is one of the screens: ${Object.keys(screens).join(', ')}`);
    return { screens, hud, start };
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
  const words = (v) => (v === undefined || v === null ? '' : String(v));
  const pct = (r) => `${Math.round(clamp(Number(r) || 0, 0, 1) * 1000) / 10}%`;
  const clock = (s, f) => {
    s = Math.max(0, Math.floor(Number(s) || 0));
    const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60, two = (n) => String(n).padStart(2, '0');
    return f === 'ss' ? String(s) : f === 'hmmss' ? `${h}:${two(m)}:${two(x)}` : `${two(Math.floor(s / 60))}:${two(x)}`;
  };
  // a side's chip: 0..7 (a team, a seat, a lane), or nothing
  const sideOf = (v) => { const n = Number(v); return v === undefined || v === null || v === '' || !isFinite(n) ? null : clamp(Math.floor(n), 0, 7); };
  const chip = (v) => { const k = sideOf(v); return k === null ? null : ['i', { class: 'mana-chip', 'data-side': k }]; };
  const initials = (s) => words(s).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
  // a tree's tiers: a node one past the deepest it requires
  function tiersOf(nodes) {
    const by = new Map(nodes.map((n) => [isObj(n) ? n.id : n, n])), memo = new Map();
    const tier = (id, seen) => {
      if (memo.has(id)) return memo.get(id);
      const n = by.get(id);
      if (!n || seen.has(id)) return 0;
      seen.add(id);
      const t = listOf(n.requires).filter((r) => by.has(r)).reduce((m, r) => Math.max(m, tier(r, seen) + 1), 0);
      memo.set(id, t);
      return t;
    };
    return nodes.map((n) => tier(isObj(n) ? n.id : n, new Set()));
  }

  // ── the runtime ───────────────────────────────────────────────────────────────────────────────────────────────────
  function runtime(spec, host) {
    const { screens, hud, start } = readSpec(spec);
    const H = host || {};
    const S = { stack: [], ui: {}, picks: {}, input: null, layout: 'xbox', glyphs: null };
    // what an action's control is called on the device in hand (null: nothing to say)
    const glyphOf = (action) => {
      const G = S.glyphs;
      if (!G || !action) return null;
      const t = S.input === 'pad' ? G.pad && (G.pad[S.layout] || G.pad.xbox) : S.input === 'xr' ? G.xr : S.input === 'touch' ? G.touch : G.keys;
      return t && t[action] ? String(t[action]) : null;
    };
    let last = null;
    const uiOf = (id) => (S.ui[id] = S.ui[id] || { at: { 0: 0 }, tabs: {}, sel: {}, seatSel: {}, top: {}, vals: {} });
    const top = () => S.stack[S.stack.length - 1] || null;
    const seatsOf = (id) => (id && screens[id] ? Math.max(1, Math.floor(Number(screens[id].props.seats) || 1)) : 1);

    function resolve(v, scope, ctx) {
      if (!isBinding(v)) return v;
      const [k] = Object.keys(v);
      let a = v[k];
      if (isBinding(a)) a = resolve(a, scope, ctx);
      if (k === 'bind') { const x = H.read ? H.read(a) : undefined; ctx.reads.set(a, JSON.stringify(x === undefined ? null : x)); return x; }
      if (k === 'item') return a === '' || a === '.' ? scope.item : readPath(scope.item, a);
      if (k === 'input') return scope.input;
      if (k === 'seat') return scope.seat === undefined ? 0 : scope.seat;
      if (k === 'format') return String(a).replace(/\{([a-zA-Z0-9_.]+)\}/g, (_, f) => words(readPath(scope.item, f)));
      if (k === 'pick') {
        const dot = String(a).indexOf('.'), head = dot < 0 ? String(a) : String(a).slice(0, dot), field = dot < 0 ? '' : String(a).slice(dot + 1);
        const at = head.indexOf('@'), list = at < 0 ? head : head.slice(0, at), seat = at < 0 ? -1 : Number(head.slice(at + 1)) - 1;
        const P = S.picks[`${ctx.root}:${list}`] || S.picks[list];
        if (!P) return undefined;
        const rows = listOf(resolve(P.rows, P.scope || {}, ctx));
        if (!rows.length) return undefined;
        const PU = uiOf(P.screen), mine = seat >= 0 && PU.seatSel[seat] ? PU.seatSel[seat][P.key] : undefined;
        // a seat that has not moved is on the row its cursor starts on, never the row another seat moved to
        const row = rows[clamp(mine !== undefined ? mine : seat >= 0 ? 0 : PU.sel[P.key] || 0, 0, rows.length - 1)];
        return field ? readPath(row, field) : row;
      }
      return undefined;
    }
    function effectsOf(v, scope, ctx) {
      const r = (x) => (isBinding(x) ? resolve(x, scope, ctx) : Array.isArray(x) ? x.map(r) : isObj(x) ? Object.fromEntries(Object.entries(x).map(([k, y]) => [k, r(y)])) : x);
      return listOf(r(v)).flat().filter(isObj);
    }
    function propsOf(n, scope, ctx) {
      const C = COMPONENTS[n.use], p = {}, src = {};
      for (const k in C.props) {
        const raw = n.props[k], [t, d] = C.props[k];
        if (isObj(raw) && Object.keys(raw).length === 1 && raw.bind !== undefined) { const path = isBinding(raw.bind) ? resolve(raw.bind, scope, ctx) : raw.bind; if (typeof path === 'string') src[k] = path; }
        let v = t === ND ? raw : resolve(raw, scope, ctx);
        if (v === undefined || v === null) v = d;
        if (t === N) v = Number(v) || 0;
        else if (t === T && v !== undefined) v = String(v);
        else if (t === L) v = listOf(v);
        else if (t === B) v = !!v;
        p[k] = v;
      }
      return { p, src };
    }

    function render() {
      const id = top();
      const ctx = { reads: new Map(), focus: [], tabs: [], taps: [], screen: id };
      const parts = [];
      if (hud) parts.push(drawIn(hud, '$hud', {}, ctx, uiOf('$hud'), false, 1));
      if (id) {
        const U = uiOf(id), seats = seatsOf(id);
        parts.push(drawIn(screens[id], id, {}, ctx, U, true, seats));
        let again = false;
        for (let s = 0; s < seats; s++) if (U.at[s] === undefined) { U.at[s] = 0; again = true; } else if (ctx.focus.length && U.at[s] >= ctx.focus.length) { U.at[s] = ctx.focus.length - 1; again = true; }
        if (again) return render();
      }
      const tree = ['div', { class: 'mana-root', 'data-open': id || 'none', 'data-hud': hud ? 'yes' : null, 'data-input': S.input, 'data-layout': S.input === 'pad' ? S.layout : null }, ...parts];
      last = { tree, ...ctx };
      return last;
    }

    // one tree drawn: U is its screen's state; `live` says whether it takes the focus (a HUD never does)
    function drawIn(root, rootKey, rootScope, ctx, U, live, seats) {
      const seatsAt = (fi) => { const s = []; for (let k = 0; k < seats; k++) if (U.at[k] === fi) s.push(k + 1); return s; };
      // a finger or a mouse moves no cursor: nothing shows selected on a screen until it has been tapped
      const cursorless = (S.input === 'touch' || S.input === 'mouse') && !U.pointed;
      const mark = (fi, base, off) => {
        const s = live && !cursorless ? seatsAt(fi) : [];
        return { 'data-k': live ? fi : null, 'data-st': s.length ? 'focus' : off ? 'disabled' : base, 'data-seats': seats > 1 && s.length ? s.join(' ') : null };
      };
      ctx.root = rootKey;
      let pane = null;   // the pane of a split being drawn: left and right cross between them
      const focusable = (f) => { if (!live) return -1; f.pane = pane; ctx.focus.push(f); return ctx.focus.length - 1; };
      // a HUD part a touch screen taps (it takes no focus): its index on data-tap
      const tappable = (n, key, scope) => (!live && n.on && n.on.accept ? ctx.taps.push({ n, key, scope }) - 1 : null);
      const register = (n, key, rowsRaw, scope) => { if (n.id) S.picks[`${rootKey}:${n.id}`] = S.picks[n.id] = { rows: rowsRaw, scope, screen: rootKey, key }; };
      const touched = (key) => !!U.vals[`$touched:${key}`];

      const draw = (n, key, scope) => {
        if (n.when !== undefined && !resolve(n.when, scope, ctx)) return null;
        if (n.unless !== undefined && resolve(n.unless, scope, ctx)) return null;
        const { p, src } = propsOf(n, scope, ctx), cls = `mana-${n.use}`;
        const kids = () => n.children.map((c, i) => draw(c, `${key}.${c.id || i}`, scope));
        switch (n.use) {
          case 'screen': return ['section', { class: cls, 'data-layer': p.layer, 'data-place': p.place }, p.title ? ['h2', { class: 'mana-title' }, p.title] : null, ...kids()];
          case 'window': return ['div', { class: cls, 'data-variant': p.variant }, p.title ? ['h3', { class: 'mana-heading' }, p.title] : null, ...kids()];
          case 'stack': return ['div', { class: cls, 'data-dir': p.dir, 'data-gap': p.gap, 'data-align': p.align, 'data-fill': p.fill ? 'yes' : null }, ...kids()];
          case 'split': return ['div', { class: cls, 'data-ratio': p.ratio }, ...n.children.map((c, i) => { const was = pane; pane = { split: key, i }; const t = draw(c, `${key}.${c.id || i}`, scope); pane = was; return t; })];
          case 'tab': case 'region': return ['div', { class: cls, 'data-at': n.use === 'region' ? p.at : null }, ...kids()];
          case 'each': return ['div', { class: cls, 'data-dir': p.dir }, ...p.rows.map((item, i) => draw(n.props.row, `${key}.${i}`, { ...scope, item }))];
          case 'divider': return ['div', { class: cls }, p.label ? ['span', { class: 'mana-label' }, p.label] : null];
          case 'tabs': {
            const dyn = !n.children.length, count = dyn ? p.pages.length : n.children.length, open = clamp(U.tabs[key] || 0, 0, Math.max(0, count - 1));
            ctx.tabs.push({ key, n: count });
            const labels = dyn ? p.pages.map((pg) => words(isObj(pg) ? pg[p.label] : pg)) : n.children.map((c) => words(resolve(c.props.label, scope, ctx)));
            const strip = ['div', { class: 'mana-tabstrip' }, ...labels.map((l, i) => ['span', { class: 'mana-tablabel', 'data-st': i === open ? 'active' : 'shown', 'data-tab': `${ctx.tabs.length - 1}:${i}` }, l])];
            const body = !count ? null : dyn ? (n.props.page ? draw(n.props.page, `${key}.${open}`, { ...scope, item: p.pages[open] }) : null) : draw(n.children[open], `${key}.${open}`, scope);
            return ['div', { class: cls }, strip, body];
          }
          case 'hud': {
            const by = {}, loose = [];
            n.children.forEach((c, i) => { const t = draw(c, `${key}.${c.id || i}`, scope); if (!t) return; if (c.use === 'region') { const at = REGIONS.includes(c.props.at) ? c.props.at : 'top-left'; (by[at] = by[at] || []).push(t); } else loose.push(t); });
            // what sits over the world (plates, numbers) draws under the HUD's own places
            return ['div', { class: cls }, ...loose, ...REGIONS.filter((r) => by[r]).map((r) => ['div', { class: 'mana-place', 'data-at': r }, ...by[r]])];
          }
          case 'anchors': return ['div', { class: cls }, ...p.rows.map((item, i) => {
            const x = Number(readPath(item, p.x)), y = Number(readPath(item, p.y));
            if (!isFinite(x) || !isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) return null; // off screen: not drawn
            return ['div', { class: 'mana-anchor', style: `left:${pct(x)};top:${pct(y)}` }, draw(n.props.row, `${key}.${i}`, { ...scope, item })];
          })];
          case 'text': return ['span', { class: cls, 'data-role': p.role }, p.value];
          case 'stat': return ['div', { class: cls }, ['span', { class: 'mana-label' }, p.label], ['span', { class: 'mana-num' }, p.value, p.max !== undefined ? ['span', { class: 'mana-max' }, ` / ${p.max}`] : null]];
          case 'bar': {
            const r = p.max > 0 ? clamp(p.value / p.max, 0, 1) : 0, seg = Math.max(0, Math.floor(p.segments));
            // low is a warning on what can run out (health, a shield, mana, stamina), never on a stat
            const warns = ['hp', 'boss', 'shield', 'mp', 'stamina'].includes(p.variant);
            const g = p.max > 0 ? clamp(p.ghost / p.max, 0, 1) : 0;
            return ['div', { class: cls, 'data-variant': p.variant, 'data-dir': p.dir === 'rtl' ? 'rtl' : null, 'data-low': warns && r <= 0.25 ? 'yes' : null }, ['span', { class: 'mana-label' }, p.label || ''],
              ['span', { class: 'mana-track' }, ['i', { style: `width:${pct(r)}` }], g > r ? ['u', { style: `left:${pct(r)};width:${pct(g - r)}` }] : null, ...Array.from({ length: seg > 1 ? seg - 1 : 0 }, (_, k) => ['b', { style: `left:${pct((k + 1) / seg)}` }])],
              ['span', { class: 'mana-num' }, `${p.value}/${p.max}`]];
          }
          case 'pips': {
            const [on, offc] = PIP_SHAPES[p.shape] || PIP_SHAPES.pip, max = clamp(Math.floor(p.max), 0, 40), v = clamp(Math.round(p.value), 0, max);
            return ['div', { class: cls, 'data-shape': p.shape }, p.label ? ['span', { class: 'mana-label' }, p.label] : null, ['span', { class: 'mana-glyphs' }, on.repeat(v) + offc.repeat(max - v)]];
          }
          case 'counter': return ['div', { class: cls }, p.icon ? ['span', { class: 'mana-icon', 'data-size': 's' }, initials(p.icon)] : null, ['span', { class: 'mana-label' }, p.label], ['span', { class: 'mana-num' }, p.value, p.max !== undefined ? ['span', { class: 'mana-max' }, `/${p.max}`] : null]];
          case 'timer': return ['div', { class: cls }, p.label ? ['span', { class: 'mana-label' }, p.label] : null, ['span', { class: 'mana-num' }, clock(p.seconds, p.format)]];
          case 'compare': {
            const d = p.to - p.from, good = p.better === 'up' ? d > 0 : d < 0;
            return ['div', { class: cls, 'data-way': d === 0 ? 'same' : good ? 'better' : 'worse' }, ['span', { class: 'mana-label' }, p.label], ['span', { class: 'mana-num' }, String(p.from)], ['span', { class: 'mana-mark' }, d === 0 ? '=' : good ? '▲' : '▼'], ['span', { class: 'mana-num' }, String(p.to)]];
          }
          case 'icon': return ['span', { class: cls, 'data-size': p.size, title: p.name }, initials(p.name)];
          case 'portrait': return ['div', { class: cls, 'data-size': p.size }, ['span', { class: 'mana-ph' }, initials(p.name)], p.name ? ['span', { class: 'mana-caption' }, p.name] : null];
          case 'image': return ['div', { class: cls, 'data-ratio': p.ratio }, ['span', { class: 'mana-caption' }, p.label || 'image']];
          case 'badge': return ['span', { class: cls, 'data-variant': p.variant === 'plain' ? null : p.variant }, chip(p.side), p.value];
          case 'table': {
            const cols = p.columns.map((c) => (isObj(c) ? { key: words(c.key), label: words(c.label ?? c.key), align: ['left', 'right', 'center'].includes(c.align) ? c.align : null } : { key: words(c), label: words(c), align: null }));
            return ['table', { class: cls }, ['thead', null, ['tr', null, ...cols.map((c) => ['th', { 'data-align': c.align }, c.label])]],
              ['tbody', null, ...p.rows.map((r) => ['tr', { 'data-mark': isObj(r) && r[p.mark] ? 'yes' : null }, ...cols.map((c, ci) => ['td', { 'data-align': c.align, 'data-lead': isObj(r) && r.lead !== undefined && r.lead !== null && words(r.lead) === c.key ? 'yes' : null }, ci === 0 && isObj(r) ? chip(r.side) : null, words(isObj(r) ? readPath(r, c.key) : r)])])]];
          }
          case 'gauge': {
            const r = p.max > 0 ? clamp(p.value / p.max, 0, 1) : 0;
            return ['div', { class: cls, style: `--r:${Math.round(r * 1000) / 1000}` }, ['span', { class: 'mana-dial' }, ['i', { style: `transform:rotate(${Math.round(-120 + 240 * r)}deg)` }], ['span', { class: 'mana-num' }, words(p.value)]], p.unit ? ['span', { class: 'mana-caption' }, p.unit] : null, p.label ? ['span', { class: 'mana-label' }, p.label] : null];
          }
          case 'slot': {
            const cd = clamp(p.cooldown, 0, 1);
            return ['div', { class: cls, 'data-active': p.active ? 'yes' : null, 'data-empty': p.name ? null : 'yes', 'data-cool': cd > 0 ? 'yes' : null, title: p.name || null, 'data-tap': tappable(n, key, scope) },
              p.name ? ['span', { class: 'mana-icon', 'data-size': 'l' }, initials(p.name)] : null, cd > 0 ? ['span', { class: 'mana-cool', style: `height:${pct(cd)}` }] : null,
              p.key !== undefined ? ['span', { class: 'mana-key' }, p.key] : null, p.count !== undefined && p.count !== '' ? ['span', { class: 'mana-count' }, p.count] : null];
          }
          case 'edges': return ['div', { class: cls }, ...p.markers.filter(isObj).map((m) => {
            const x = Number(m.x), y = Number(m.y);
            if (!isFinite(x) || !isFinite(y) || (x >= 0 && x <= 1 && y >= 0 && y <= 1)) return null;   // on screen: not an edge's
            const dx = x - 0.5, dy = y - 0.5, a = Math.round((Math.atan2(dy, dx) * 180) / Math.PI / 45) * 45;
            const arrow = { 0: '→', 45: '↘', 90: '↓', 135: '↙', 180: '←', '-180': '←', '-135': '↖', '-90': '↑', '-45': '↗' }[a];
            return ['span', { class: 'mana-edge', 'data-kind': MARKERS[m.kind] ? m.kind : 'poi', style: `left:${pct(clamp(x, 0.03, 0.97))};top:${pct(clamp(y, 0.05, 0.95))}` }, arrow, MARKERS[m.kind] || MARKERS.poi, m.label ? ['span', { class: 'mana-caption' }, ` ${words(m.label)}`] : null];
          })];
          case 'threat': return ['div', { class: cls }, ...p.markers.map((m) => {
            const b = Number(isObj(m) ? m.bearing : m);
            if (!isFinite(b)) return null;
            const t = (b * Math.PI) / 180;
            return ['span', { class: 'mana-arc', style: `left:${pct(0.5 + 0.45 * Math.sin(t))};top:${pct(0.5 - 0.45 * Math.cos(t))};transform:translate(-50%,-50%) rotate(${Math.round(b)}deg)` }, '▲'];
          })];
          case 'letterbox': return ['div', { class: cls }, ['i', null], ['i', null]];
          case 'touchpad': return ['div', { class: cls }, p.stick ? ['span', { class: 'mana-stick', 'data-stick': 'left' }, ['i', null]] : ['span', null], ['span', { class: 'mana-pads' }, ...p.buttons.map((b) => {
            const label = words(isObj(b) ? b.label : b), control = isObj(b) && b.control ? words(b.control) : PAD_FACES[label] || null;
            return ['span', { class: 'mana-pad', 'data-control': control }, label];
          })]];
          case 'prompt': return ['div', { class: cls }, ['span', { class: 'mana-key' }, p.glyph || glyphOf(p.action) || p.action], ['span', null, p.label]];
          case 'legend': {
            if (S.input === 'touch') return null;
            return ['div', { class: cls }, ...p.rows.map((r) => {
              // a row names an action, or several that share a word (left and right: change)
              const acts = isObj(r) && Array.isArray(r.actions) ? r.actions.map(words) : [isObj(r) ? words(r.action) : words(r)];
              const label = isObj(r) && r.label !== undefined ? words(r.label) : acts.join(' / ');
              return ['span', { class: 'mana-hint' }, ...acts.map((a) => ['span', { class: 'mana-key' }, glyphOf(a) || a]), ['span', null, label]];
            })];
          }
          case 'reticle': return ['div', { class: cls, 'data-shape': p.shape, 'data-hit': p.hit ? 'yes' : null }, ['span', null, RETICLES[p.shape] || '+'], p.hit ? ['span', { class: 'mana-hit' }, '✕'] : null];
          case 'minimap': return ['div', { class: cls, 'data-shape': p.shape }, ...p.markers.map((m) => {
            if (!isObj(m) || !isFinite(Number(m.x)) || !isFinite(Number(m.y))) return null;
            return ['span', { class: 'mana-marker', 'data-kind': MARKERS[m.kind] ? m.kind : 'poi', style: `left:${pct(m.x)};top:${pct(m.y)}`, title: m.label || null }, MARKERS[m.kind] || MARKERS.poi];
          }), p.label ? ['span', { class: 'mana-caption' }, p.label] : null];
          case 'compass': {
            const at = (b) => ((((Number(b) || 0) - p.heading) % 360) + 540) % 360 - 180;
            const marks = [['N', 0], ['E', 90], ['S', 180], ['W', 270]].map(([w, b]) => ({ w, d: at(b), cardinal: true })).concat(p.markers.filter(isObj).map((m) => ({ w: MARKERS[m.kind] || MARKERS.poi, d: at(m.bearing) })));
            return ['div', { class: cls }, ...marks.filter((m) => Math.abs(m.d) <= 90).map((m) => ['span', { class: m.cardinal ? 'mana-cardinal' : 'mana-marker', style: `left:${pct((m.d + 90) / 180)}` }, m.w]), ['span', { class: 'mana-needle' }, '▼']];
          }
          case 'feed': return ['div', { class: cls }, ...p.rows.slice(-Math.max(1, Math.floor(p.max))).map((r) => ['div', { class: 'mana-line' }, words(isObj(r) ? readPath(r, p.field) : r)])];
          case 'toast': return ['div', { class: cls }, p.value];
          case 'banner': return ['div', { class: cls }, ['span', { class: 'mana-text', 'data-role': 'display' }, p.value], p.sub ? ['span', { class: 'mana-text', 'data-role': 'label' }, p.sub] : null];
          case 'awareness': return ['span', { class: cls, 'data-state': p.state }, ['b', null, AWARENESS[p.state]], p.label ? ` ${p.state}` : null];
          case 'statuses': return ['span', { class: cls }, ...p.rows.map((r) => { const name = words(isObj(r) ? r.name : r), turns = isObj(r) && r.turns !== undefined ? r.turns : null; return ['span', { class: 'mana-status', title: name }, name.slice(0, 4).toUpperCase(), turns !== null ? ['sub', null, String(turns)] : null]; })];

          case 'list': {
            register(n, key, n.props.rows, scope);
            if (!p.rows.length) return ['div', { class: cls, 'data-empty': 'yes' }, ['span', { class: 'mana-text', 'data-role': 'caption' }, p.empty]];
            // on a touch screen a long list scrolls under the finger: every row is drawn
            const total = p.rows.length, sel = clamp(U.sel[key] || 0, 0, total - 1), v = S.input === 'touch' ? 0 : Math.floor(p.visible);
            let from = 0, to = total;
            if (v > 0 && v < total) { let t = clamp(U.top[key] || 0, 0, total - v); if (sel < t) t = sel; if (sel >= t + v) t = sel - v + 1; U.top[key] = t; from = t; to = t + v; }
            const rows = [];
            if (from > 0) rows.push(['div', { class: 'mana-more' }, `▲ ${from} more`]);
            for (let i = from; i < to; i++) {
              const item = p.rows[i], sc = { ...scope, item }, off = isObj(item) && !!item.disabled;
              const fi = focusable({ kind: 'row', n, key, i, total, win: v > 0 && v < total, scope: sc, off });
              const body = n.props.row ? draw(n.props.row, `${key}.${i}`, sc) : ['span', { class: 'mana-text' }, isObj(item) ? words(item.label ?? item.name ?? item.id) : words(item)];
              rows.push(['div', { class: 'mana-row', ...mark(fi, (i === sel && touched(key)) || (isObj(item) && item.active) ? 'active' : 'shown', off) }, isObj(item) ? chip(item.side) : null, body]);
            }
            if (to < total) rows.push(['div', { class: 'mana-more' }, `▼ ${total - to} more`]);
            return ['div', { class: cls }, ...rows];
          }
          case 'grid': {
            register(n, key, n.props.cells, scope);
            if (!p.cells.length) return ['div', { class: cls, 'data-empty': 'yes' }, ['span', { class: 'mana-text', 'data-role': 'caption' }, p.empty]];
            const cols = clamp(Math.floor(p.columns) || 1, 1, 16), sel = clamp(U.sel[key] || 0, 0, p.cells.length - 1);
            return ['div', { class: cls, style: `--cols:${cols}` }, ...p.cells.map((item, i) => {
              const sc = { ...scope, item }, off = isObj(item) && !!item.disabled;
              const fi = focusable({ kind: 'cell', n, key, i, g: { key, r: Math.floor(i / cols), c: i % cols }, scope: sc, off });
              const body = n.props.cell ? draw(n.props.cell, `${key}.${i}`, sc) : ['span', { class: 'mana-text' }, isObj(item) ? words(item.label ?? item.name ?? item.id) : words(item)];
              return ['div', { class: 'mana-cell', ...mark(fi, (i === sel && touched(key)) || (isObj(item) && item.active) ? 'active' : 'shown', off) }, isObj(item) ? chip(item.side) : null, body];
            })];
          }
          case 'tree': {
            register(n, key, n.props.nodes, scope);
            const tiers = tiersOf(p.nodes), cols = tiers.length ? Math.max(...tiers) + 1 : 0, names = new Map(p.nodes.map((x) => [isObj(x) ? x.id : x, isObj(x) ? words(x[p.label] ?? x.id) : words(x)]));
            const sel = clamp(U.sel[key] || 0, 0, Math.max(0, p.nodes.length - 1));
            const columns = Array.from({ length: cols }, () => []);
            p.nodes.forEach((item, i) => {
              const c = tiers[i], r = columns[c].length, sc = { ...scope, item }, state = isObj(item) && item.state ? String(item.state) : 'available', off = state === 'locked';
              const fi = focusable({ kind: 'node', n, key, i, g: { key, r, c }, scope: sc, off });
              const req = listOf(isObj(item) ? item.requires : []).filter((x) => names.has(x)).map((x) => names.get(x));
              const body = n.props.node ? draw(n.props.node, `${key}.${i}`, sc) : ['span', { class: 'mana-text' }, names.get(isObj(item) ? item.id : item)];
              columns[c].push(['div', { class: 'mana-node', 'data-state': state, ...mark(fi, (i === sel && touched(key)) || (isObj(item) && item.active) ? 'active' : 'shown', off) }, body, req.length ? ['span', { class: 'mana-req' }, `← ${req.join(', ')}`] : null]);
            });
            return ['div', { class: cls, style: `--cols:${cols}` }, ...columns.map((col, c) => ['div', { class: 'mana-tier', 'data-tier': c }, ...col])];
          }
          case 'carousel': {
            register(n, key, n.props.items, scope);
            const items = p.items, idOf = (it, i) => (isObj(it) && it.id !== undefined ? it.id : i);
            let i = src.value ? items.findIndex((it, k) => idOf(it, k) === p.value) : key in U.vals ? U.vals[key] : items.findIndex((it, k) => p.value !== undefined && idOf(it, k) === p.value);
            i = clamp(i < 0 ? 0 : i, 0, Math.max(0, items.length - 1));
            U.sel[key] = i;
            const item = items[i], sc = { ...scope, item };
            const fi = focusable({ kind: 'carousel', n, key, i, items, src: src.value, scope: sc });
            return ['div', { class: cls, ...mark(fi, 'shown') }, ['span', { class: 'mana-mark' }, '◀'],
              ['div', { class: 'mana-slide' }, item === undefined ? null : n.props.item ? draw(n.props.item, `${key}.${i}`, sc) : ['span', { class: 'mana-text' }, isObj(item) ? words(item.label ?? item.name ?? item.id) : words(item)]],
              ['span', { class: 'mana-mark' }, '▶'], ['span', { class: 'mana-dots' }, items.map((_, k) => (k === i ? '●' : '○')).join('')]];
          }
          case 'button': { const fi = focusable({ kind: 'button', n, key, scope, off: p.disabled }); return ['div', { class: cls, ...mark(fi, 'shown', p.disabled), 'data-tap': tappable(n, key, scope) }, p.label]; }
          case 'toggle': case 'cycler': case 'slider': case 'keybind': return input(n.use, n, key, scope, p, src);
          case 'field': return input(p.kind, n, key, scope, p, src);
          case 'allocator': {
            const draft = U.vals[key] || {}, spent = Object.values(draft).reduce((a, b) => a + b, 0), left = Math.max(0, Math.floor(p.points) - spent);
            const rows = p.rows.filter(isObj).map((r) => {
              const id = words(r.id), base = Number(r.value) || 0, add = draft[id] || 0;
              const fi = focusable({ kind: 'alloc-row', n, key, id, base, max: r.max === undefined ? Infinity : Number(r.max), points: Math.floor(p.points), scope });
              return ['div', { class: 'mana-alloc', ...mark(fi, add ? 'active' : 'shown') }, ['span', { class: 'mana-label' }, words(r.label ?? id)], ['span', { class: 'mana-num' }, String(base)], ['span', { class: 'mana-mark' }, add ? '→' : ''], ['span', { class: 'mana-num' }, add ? String(base + add) : ''], ['span', { class: 'mana-mark' }, '◀ ▶']];
            });
            const conf = focusable({ kind: 'alloc-confirm', n, key, scope, off: spent === 0 }), reset = focusable({ kind: 'alloc-reset', n, key, scope, off: spent === 0 });
            return ['div', { class: cls }, ['div', { class: 'mana-stat' }, ['span', { class: 'mana-label' }, 'Points'], ['span', { class: 'mana-num' }, `${left} / ${Math.floor(p.points)}`]], ...rows,
              ['div', { class: 'mana-stack', 'data-dir': 'row', 'data-gap': 'normal' }, ['div', { class: 'mana-button', ...mark(conf, 'shown', spent === 0) }, 'Confirm'], ['div', { class: 'mana-button', ...mark(reset, 'shown', spent === 0) }, 'Reset']]];
          }
          case 'textentry': {
            const draft = key in U.vals ? U.vals[key] : words(p.value).slice(0, p.max), chars = [...CHARSETS[p.charset]], cols = 10;
            const cells = chars.map((ch, i) => { const fi = focusable({ kind: 'char', n, key, ch, max: Math.floor(p.max), draft, g: { key, r: Math.floor(i / cols), c: i % cols }, scope }); return ['span', { class: 'mana-cell', ...mark(fi, 'shown') }, ch === ' ' ? '␣' : ch]; });
            const row = Math.ceil(chars.length / cols);
            const del = focusable({ kind: 'char-del', n, key, draft, g: { key, r: row, c: 0 }, scope }), done = focusable({ kind: 'char-done', n, key, draft, src: src.value, g: { key, r: row, c: 1 }, scope });
            return ['div', { class: cls }, p.label ? ['span', { class: 'mana-label' }, p.label] : null, ['div', { class: 'mana-draft' }, draft, ['span', { class: 'mana-caret' }, draft.length < p.max ? '_' : '']],
              ['div', { class: 'mana-grid', style: `--cols:${cols}` }, ...cells], ['div', { class: 'mana-stack', 'data-dir': 'row', 'data-gap': 'normal' }, ['div', { class: 'mana-button', ...mark(del, 'shown') }, 'Delete'], ['div', { class: 'mana-button', ...mark(done, 'shown') }, 'Done']]];
          }
        }
        return null;
      };
      // the inputs that hold a value: drawn the same alone or as a field
      const input = (kind, n, key, scope, p, src) => {
        const held = key in U.vals ? U.vals[key] : p.value, now = src.value ? p.value : held;
        if (kind === 'keybind') {
          const fi = focusable({ kind: 'keybind', n, key, scope });
          return ['div', { class: 'mana-keybind', ...mark(fi, 'shown'), 'data-conflict': p.conflict ? 'yes' : null }, ['span', { class: 'mana-label' }, p.label, p.conflict ? ['span', { class: 'mana-clash' }, ' ⚠ shared'] : null], ['span', { class: 'mana-keys' }, ...listOf(p.keys).map((k) => ['span', { class: 'mana-key' }, words(k)])]];
        }
        const f = { kind, n, key, scope, src: src.value, value: now, options: p.options, min: p.min, max: p.max, step: p.step };
        const fi = focusable(f);
        let shown;
        // a switch: the knob's side says it, the word beside it again (values first)
        if (kind === 'toggle') shown = [['span', { class: 'mana-switch' }, ['i', null]], ['span', { class: 'mana-caption' }, now ? 'On' : 'Off']];
        else if (kind === 'slider') { const lo = p.min, hi = p.max > p.min ? p.max : p.min + 1, v = clamp(Number(now) || 0, lo, hi); shown = [['span', { class: 'mana-track' }, ['i', { style: `width:${pct((v - lo) / (hi - lo))}` }]], ['span', { class: 'mana-num' }, String(v)]]; }
        else shown = [['span', { class: 'mana-step', 'data-way': 'back' }, '◀'], ['span', { class: 'mana-now' }, words(now)], ['span', { class: 'mana-step', 'data-way': 'on' }, '▶']];
        return ['div', { class: `mana-${kind}`, ...mark(fi, 'shown'), 'data-on': kind === 'toggle' ? (now ? 'yes' : 'no') : null }, ['span', { class: 'mana-label' }, p.label], ['span', { class: 'mana-value' }, ...listOf(shown)]];
      };
      return draw(root, rootKey, rootScope);
    }

    // ── what a press does ──────────────────────────────────────────────────────────────────────────────────────────
    const from = (f, verb, seat) => ({ screen: top(), key: f ? f.key : top(), verb, seat });
    function run(effects, f, verb, seat) {
      for (const e of effects) {
        if (typeof e.open === 'string' && screens[e.open]) open(e.open);
        else if (e.close === true) close();
        else if (e.back === true) back();
        else if (H.act) H.act(e, from(f, verb, seat));
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
      if (H.act) H.act({ emit: 'mana:closed' }, { screen: null, key: null, verb: 'close', seat: 0 });
      render();
    }
    function back() {
      const id = S.stack.pop();
      if (!S.stack.length && H.act) H.act({ emit: 'mana:closed' }, { screen: id, key: id, verb: 'back', seat: 0 });
      render();
    }
    const scopeOf = (f, seat, extra) => ({ ...(f ? f.scope : {}), seat, ...extra });
    // the focus set: a list, grid, tree remembers the row it is on (what a detail reads)
    function setAt(seat, k) {
      const U = uiOf(top());
      U.at[seat] = k;
      const f = last && last.focus[k];
      if (f && (f.kind === 'row' || f.kind === 'cell' || f.kind === 'node')) { U.sel[f.key] = f.i; (U.seatSel[seat] = U.seatSel[seat] || {})[f.key] = f.i; U.vals[`$touched:${f.key}`] = true; }
      render();
    }
    function nearest(cands, v, axis) {
      let best = null, d = Infinity;
      for (const [x, k] of cands) { const e = Math.abs(x.g[axis] - v); if (e < d) { d = e; best = k; } }
      return best;
    }
    function move(seat, dir) {
      const Lf = last.focus, U = uiOf(top()), cur = U.at[seat] || 0, f = Lf[cur], n = Lf.length;
      if (!n || !f) return;
      const vert = dir === 'up' || dir === 'down', d = dir === 'down' || dir === 'right' ? 1 : -1;
      // a scrolled list: past its last drawn row, the list scrolls and the focus stays on the row
      if (f.kind === 'row' && f.win && vert) {
        const j = f.i + d;
        if (j >= 0 && j < f.total && !Lf.some((x) => x.kind === 'row' && x.key === f.key && x.i === j)) {
          U.sel[f.key] = j; U.vals[`$touched:${f.key}`] = true; render();
          const k = last.focus.findIndex((x) => x.kind === 'row' && x.key === f.key && x.i === j);
          if (k >= 0) setAt(seat, k);
          return;
        }
      }
      if (f.g) {
        const same = Lf.map((x, k) => [x, k]).filter(([x]) => x.g && x.g.key === f.g.key);
        const best = vert ? nearest(same.filter(([x]) => x.g.r === f.g.r + d), f.g.c, 'c') : nearest(same.filter(([x]) => x.g.c === f.g.c + d), f.g.r, 'r');
        if (best !== null) return setAt(seat, best);
        if (!vert) return crossPane(seat, f, d);
        const ks = same.map(([, k]) => k), out = d > 0 ? Math.max(...ks) + 1 : Math.min(...ks) - 1;
        return setAt(seat, (out + n) % n);
      }
      if (!vert) { if (['toggle', 'cycler', 'slider', 'carousel', 'alloc-row'].includes(f.kind)) change(f, d, seat); else crossPane(seat, f, d); return; }
      setAt(seat, (cur + d + n) % n);
    }
    // left and right from the edge of a split's pane: into the next pane, onto its active row (else its first)
    function crossPane(seat, f, d) {
      if (!f.pane) return;
      const U = uiOf(top()), there = last.focus.map((x, k) => [x, k]).filter(([x]) => x.pane && x.pane.split === f.pane.split && x.pane.i === f.pane.i + d);
      if (!there.length) return;
      const active = there.find(([x]) => x.i !== undefined && (U.sel[x.key] || 0) === x.i && U.vals[`$touched:${x.key}`]);
      setAt(seat, (active || there[0])[1]);
    }
    function change(f, d, seat) {
      const U = uiOf(top());
      if (f.kind === 'alloc-row') {
        const draft = { ...(U.vals[f.key] || {}) }, spent = Object.values(draft).reduce((a, b) => a + b, 0), now = draft[f.id] || 0, next = now + d;
        if (next < 0 || (d > 0 && spent >= f.points) || f.base + next > f.max) return;
        draft[f.id] = next;
        if (!next) delete draft[f.id];
        U.vals[f.key] = draft;
        if (f.n.on.change) run(effectsOf(f.n.on.change, scopeOf(f, seat, { input: draft }), last), f, 'change', seat);
        return;
      }
      let v;
      if (f.kind === 'toggle') v = !f.value;
      else if (f.kind === 'slider') { const st = f.step > 0 ? f.step : 1, hi = f.max > f.min ? f.max : f.min + 1; v = clamp(Math.round(((Number(f.value) || 0) + d * st) / st) * st, f.min, hi); v = Math.round(v * 1e6) / 1e6; }
      else if (f.kind === 'carousel') { const n = f.items.length; if (!n) return; const i = ((f.i + d) % n + n) % n, it = f.items[i]; v = isObj(it) && it.id !== undefined ? it.id : i; if (!f.src) { U.vals[f.key] = i; U.sel[f.key] = i; } }
      else { const o = listOf(f.options), i = o.findIndex((x) => words(x) === words(f.value)); if (!o.length) return; v = o[((i < 0 ? 0 : i + d) % o.length + o.length) % o.length]; }
      commit(f, v, seat);
    }
    // a value an input now holds: set on the host when bound (the game's), else the screen's own
    function commit(f, v, seat) {
      const U = uiOf(top());
      if (f.src) { if (H.act) H.act({ set: f.src, to: f.kind === 'toggle' ? (v ? 1 : 0) : v }, from(f, 'change', seat)); }
      else if (f.kind !== 'carousel') U.vals[f.key] = v;
      if (f.n.on.change) run(effectsOf(f.n.on.change, scopeOf(f, seat, { input: v }), last), f, 'change', seat);
    }
    function accept(f, seat) {
      const U = uiOf(top()), on = f.n.on;
      if (f.off) return;
      switch (f.kind) {
        case 'toggle': case 'cycler': return change(f, 1, seat);
        case 'slider': return;
        case 'alloc-confirm': { const draft = U.vals[f.key] || {}; delete U.vals[f.key]; if (on.confirm) run(effectsOf(on.confirm, scopeOf(f, seat, { input: draft }), last), f, 'confirm', seat); return; }
        case 'alloc-reset': delete U.vals[f.key]; return;
        case 'char': if (f.draft.length < f.max) U.vals[f.key] = f.draft + f.ch; return;
        case 'char-del': U.vals[f.key] = f.draft.slice(0, -1); return;
        case 'char-done': {
          const v = f.draft.trim();
          if (f.src && H.act) H.act({ set: f.src, to: v }, from(f, 'done', seat));
          delete U.vals[f.key];
          if (on.done) run(effectsOf(on.done, scopeOf(f, seat, { input: v }), last), f, 'done', seat);
          return;
        }
        default: if (on.accept) run(effectsOf(on.accept, scopeOf(f, seat), last), f, 'accept', seat);
      }
    }
    function press(action, seat = 0) {
      if (!ACTIONS.includes(action)) throw new Error(`press: an action is one of ${ACTIONS.join(', ')}`);
      if (!top() || seat < 0 || seat >= seatsOf(top())) return false;
      if (!last || last.screen !== top()) render();
      const U = uiOf(top()), f = last.focus[U.at[seat] || 0];
      if (action === 'up' || action === 'down' || action === 'left' || action === 'right') move(seat, action);
      else if (action === 'tabNext' || action === 'tabPrev') { const Tb = last.tabs[0]; if (Tb && Tb.n) { U.tabs[Tb.key] = ((U.tabs[Tb.key] || 0) + (action === 'tabNext' ? 1 : -1) + Tb.n) % Tb.n; } }
      else if (action === 'accept') { if (f) accept(f, seat); }
      else if (action === 'back') { const on = screens[top()].on.back; if (on) run(effectsOf(on, { seat }, last), null, 'back', seat); else back(); }
      render();
      return true;
    }
    // a tap or a click: what is under it is selected and done (a row with a detail beside it: selected first)
    function point(k, x, seat = 0) {
      if (!top()) return false;
      if (!last || last.screen !== top()) render();
      const f0 = last.focus[k];
      if (!f0) return false;
      const U = uiOf(top()), again = U.pointed && (U.at[seat] || 0) === k;
      U.pointed = true;
      setAt(seat, k);
      const f = last.focus[k] || f0, rx = clamp(Number(x), 0, 1);
      if (f.kind === 'slider') {
        const lo = f.min, hi = f.max > f.min ? f.max : f.min + 1, st = f.step > 0 ? f.step : 1;
        commit(f, Math.round(clamp(Math.round((lo + rx * (hi - lo)) / st) * st, lo, hi) * 1e6) / 1e6, seat);
      } else if (['cycler', 'carousel', 'alloc-row'].includes(f.kind) && (rx < 0.34 || rx > 0.66)) change(f, rx < 0.34 ? -1 : 1, seat);
      else if (f.pane && (f.kind === 'row' || f.kind === 'cell' || f.kind === 'node') && !again) { /* selected: its detail shows */ }
      else accept(f, seat);
      render();
      return true;
    }
    function hudTap(i) {
      if (!last) render();
      const t = last.taps[i];
      if (!t) return false;
      run(effectsOf(t.n.on.accept, { ...t.scope, seat: 0 }, last), t, 'accept', 0);
      render();
      return true;
    }
    function input(mode, layout) {
      if (!INPUTS.includes(mode)) throw new Error(`input: a mode is one of ${INPUTS.join(', ')}`);
      const L = typeof layout === 'string' && layout ? layout : S.layout;
      if (S.input !== mode || S.layout !== L) { S.input = mode; S.layout = L; render(); }
    }
    function glyphs(table) {
      if (table !== null && !isObj(table)) throw new Error('glyphs: { keys?, pad?: { <layout>: { <action>: label } }, xr?, touch? }');
      S.glyphs = table;
      render();
    }
    function focusAt(k, seat = 0) { if (!top()) return; if (!last) render(); if (k >= 0 && k < last.focus.length) setAt(seat, k); }
    function tab(t, i) { if (!last) return; const Tb = last.tabs[t]; if (Tb && i >= 0 && i < Tb.n) { uiOf(top()).tabs[Tb.key] = i; render(); } }
    function tick() {
      if (!last) return false;
      for (const [path, was] of last.reads) { const x = H.read ? H.read(path) : undefined; if (JSON.stringify(x === undefined ? null : x) !== was) { render(); return true; } }
      return false;
    }
    if (start) open(start); else render();
    return {
      open, close, press, focusAt, tab, tick, point, hudTap, input, glyphs,
      view: () => toHtml((last || render()).tree),
      tree: () => (last || render()).tree,
      state: () => {
        const id = top(), U = id ? uiOf(id) : null;
        return { input: S.input, layout: S.layout, stack: S.stack.slice(), screen: id, focus: U ? U.at[0] || 0 : -1, seats: U ? Object.fromEntries(Object.entries(U.at)) : {}, focusables: last ? last.focus.length : 0, kind: U && last && last.focus[U.at[0] || 0] ? last.focus[U.at[0] || 0].kind : null };
      },
    };
  }

  // ── the DOM backend ───────────────────────────────────────────────────────────────────────────────────────────────
  const KEYS = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Enter: 'accept', Space: 'accept', KeyE: 'accept', Escape: 'back', Backspace: 'back', BracketRight: 'tabNext', BracketLeft: 'tabPrev' };
  function mount(el, rt, opts) {
    const o = opts || {}, C = o.controls || {}, keys = C.keys || o.keys || KEYS;
    let html = '';
    const paint = () => { const h = rt.view(); if (h !== html) { html = h; el.innerHTML = h; } hold(); };
    // the pointer: a tap is done where it lands, a drag on a slider sets it as it moves, a swipe turns a carousel under it
    // or the screen's tabs (left: the next); a pen is a finger
    const near = (ev, sel) => (ev.target && ev.target.closest ? ev.target.closest(sel) : null);
    // where across its target a pointer is, measured on the rect taken when the press began (a repaint replaces the
    // element under a drag)
    const across = (r, ev) => (r && r.width ? (ev.clientX - r.left) / r.width : 0.5);
    let down = null;
    // the drawn touch pad: its buttons and its stick held as the gamepad's controls (read, below), never a menu's
    const TP = {}, held = new Map();
    const stickAt = (r, ev) => { const R = r.width / 2, x = (ev.clientX - r.left - R) / R, y = (ev.clientY - r.top - R) / R, m = Math.hypot(x, y) || 1, k = Math.min(1, m) / m; TP.leftX = Math.round(x * k * 1000) / 1000; TP.leftY = Math.round(y * k * 1000) / 1000; };
    const padEnd = (ev) => { const h = held.get(ev.pointerId); if (!h) return false; held.delete(ev.pointerId); if (h.stick) { TP.leftX = 0; TP.leftY = 0; } else TP[h.control] = 0; return true; };
    el.addEventListener('pointerdown', (ev) => {
      const tp = near(ev, '.mana-pad[data-control],.mana-stick');
      if (tp) {
        rt.input('touch');
        if (tp.classList.contains('mana-stick')) { const r = tp.getBoundingClientRect(); held.set(ev.pointerId, { stick: true, r }); stickAt(r, ev); }
        else { held.set(ev.pointerId, { control: tp.dataset.control }); TP[tp.dataset.control] = 1; }
        if (tp.setPointerCapture) try { tp.setPointerCapture(ev.pointerId); } catch (e) { /* a synthetic pointer */ }
        return;
      }
      rt.input(ev.pointerType === 'mouse' ? 'mouse' : 'touch');
      const t = near(ev, '[data-k],[data-tab],[data-tap]');
      const ds = t ? { k: t.dataset.k, tab: t.dataset.tab, tap: t.dataset.tap } : null, cl = t && t.classList;
      const slide = !!(cl && cl.contains('mana-slider')), track = slide && t.querySelector ? t.querySelector('.mana-track') : null;
      // a slider is measured on its track (a finger on the bar means that point of the bar), anything else on itself
      down = { x: ev.clientX, y: ev.clientY, t: ds, rect: (track || t) ? (track || t).getBoundingClientRect() : null, slide, car: !!(cl && cl.contains('mana-carousel')) };
      if (down.slide) { rt.point(Number(ds.k), across(down.rect, ev)); paint(); }
    });
    el.addEventListener('pointermove', (ev) => { const h = held.get(ev.pointerId); if (h && h.stick) { stickAt(h.r, ev); return; } if (down && down.slide) { rt.point(Number(down.t.k), across(down.rect, ev)); paint(); } });
    el.addEventListener('pointerup', (ev) => {
      if (padEnd(ev)) return;
      const d = down; down = null;
      if (!d) return;
      const dx = ev.clientX - d.x, dy = ev.clientY - d.y;
      if (d.slide) return;
      if (Math.abs(dx) > 40 && Math.abs(dx) > 2 * Math.abs(dy)) {
        if (d.car) rt.point(Number(d.t.k), dx < 0 ? 1 : 0); else if (rt.state().screen) rt.press(dx < 0 ? 'tabNext' : 'tabPrev');
      } else if (d.t && Math.abs(dx) < 12 && Math.abs(dy) < 12) {
        if (d.t.tab) { const [a, b] = d.t.tab.split(':').map(Number); rt.tab(a, b); }
        else if (d.t.tap !== undefined) rt.hudTap(Number(d.t.tap));
        else rt.point(Number(d.t.k), across(d.rect, ev));
      }
      paint();
    });
    el.addEventListener('pointercancel', (ev) => { padEnd(ev); down = null; });
    // while a screen is up the menu holds the input: its keys are taken before the game's own listeners see them (the
    // capture phase), and the page's hold is set (window.__mojMenuOpen, the playscape menus' convention), so Enter on a
    // pause never also serves the ball
    const hold = () => { if (typeof window !== 'undefined') window.__mojMenuOpen = !!rt.state().screen; };
    const key = (ev) => {
      if (rt.state().input !== 'keys' && keys[ev.code]) rt.input('keys');
      hold();
      if (!rt.state().screen) return false;
      if (ev.stopPropagation) ev.stopPropagation();
      const a = keys[ev.code];
      if (!a) return false;
      ev.preventDefault(); rt.press(a); paint(); return true;
    };
    if (o.keyboard !== false && typeof window !== 'undefined') window.addEventListener('keydown', key, true);
    // THE PADS AND THE DRIVERS, read once a frame on their press edges: what is held as a screen opens does not act in
    // it; pad n drives seat n where the screen has one, else the first seat
    const prev = new Map();
    let shown = rt.state().screen;
    const edges = (id, now, mode, layout, seat) => {
      const was = prev.get(id) || {};
      prev.set(id, now);
      if (!rt.state().screen) return false;
      let did = false;
      for (const a in now) if (now[a] && !was[a]) { rt.input(mode, layout); if (!rt.press(a, seat)) rt.press(a, 0); did = true; }
      return did;
    };
    function poll() {
      const now = rt.state().screen, opened = now !== shown;
      shown = now;
      let did = false;
      const pads = C.pad && typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
      for (let i = 0; i < pads.length; i++) {
        const g = pads[i];
        if (!g || !g.connected) continue;
        const L = C.padLayout ? C.padLayout(g.id) : 'xbox', P = C.pad[L] || C.pad.xbox, act = {};
        if (!P) continue;
        for (const b in P.b) { const x = g.buttons[b]; if (x && (x.pressed || x.value > 0.5)) act[P.b[b]] = 1; }
        for (const [ax, sg, a] of P.a) if ((g.axes[ax] || 0) * sg > 0.6) act[a] = 1;
        if (opened) prev.set('pad' + i, act); else did = edges('pad' + i, act, 'pad', L, i) || did;
      }
      (o.drivers || []).forEach((fn, i) => {
        const r = fn() || {}, act = isObj(r.actions) ? r.actions : r;
        if (opened) prev.set('drv' + i, act); else did = edges('drv' + i, act, r.input || 'pad', null, r.seat || 0) || did;
      });
      return did || opened;
    }
    // a frame: the pads and drivers read, a value the screen read changed, or the game opened or closed a screen itself
    if (o.poll !== false && (o.auto || C.pad || o.drivers) && typeof requestAnimationFrame === 'function') { const loop = () => { if (poll() | rt.tick()) paint(); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
    paint();
    return { paint, key, poll, read: (control) => TP[control] || 0 };
  }

  return { COMPONENTS, COMPONENT_IDS, ROLES, REGIONS, AWARENESS, MARKERS, PIP_SHAPES, ACTIONS, INPUTS, KEYS, readNode, readSpec, runtime, toHtml, readPath, mount };
}

export const manaUi = buildManaUi();
/** The kernel as page source: an expression a page assigns (`const manaUi = ${manaUiSource()};`). */
export const manaUiSource = () => `(${buildManaUi.toString()})()`;

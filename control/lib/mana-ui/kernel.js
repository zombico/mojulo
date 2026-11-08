/**
 * MANA-UI — the game UI runtime (internal name; the agent reads plain words: `use`, `props`, `on`). Playscape says what
 * a game's UI is; this is the one runtime it runs on, so a screen is built once and not game by game.
 *
 * SINGLE SOURCE OF TRUTH, the controls-kernel discipline: everything lives inside `buildManaUi()`, a closure that
 * references nothing outside itself, so a page runs the same code by emitting `buildManaUi.toString()`
 * (`manaUiSource()`). Node imports the live instance for tests and design-time checks. No clock of its own, no dice, no
 * DOM until `mount`: the same spec over the same states, in the same order, draws the same HTML (time is the game's,
 * read through the host's `now`).
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
 *     { word: '<key>' }             one of the runtime's own words (WORDS), in the host's language (host.words); a
 *                                   format's {@key} the same
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
 *   A SPEC: { screens: { <id>: node (a screen) }, hud?: node (a hud, drawn under the stack), defs?, start?,
 *     languages?: { <code>: { <key>: word } }, language? } (a game in several languages: its words, and the runtime's,
 *     in each; { word: '<key>' } names one, rt.language(code) changes the language)
 *   SIDES: a row, a cell, a table's row or a badge whose data carries `side` (0..7: a team, a seat, a lane) draws a chip
 *   in that side's colour (the theme's sides, a kit); its name still says whose it is (values first).
 *   MOTION THAT MEANS SOMETHING (the broadcast's, taken): what changed says so, once. A number that rose or fell (a stat,
 *   a counter, a bar's, a badge's, a table's cell, a numeral) is marked `data-ch` up | down | new with a new `data-key`,
 *   its gain (+3) floating off a stat, a counter and a badge; a row of a list, grid or table whose `id` was not there
 *   before is `data-fresh`, a row the game marks `last: true` (the last move, the tile just laid) a ring that opens once,
 *   a row or a badge marked `turn: true` (whose turn it is) alight in its side's colour. A screen, its windows and its
 *   rows enter staggered. How it moves is the theme's (`motion`); prefers-reduced-motion, or rt.reduceMotion(true) from
 *   the game's options, keeps the fades and drops the travel; rt.hold(true) (a hit-stop, the game's clock held) holds
 *   the HUD's motion. Never on the first draw: what was there when a screen opened is not news.
 *
 *   COMPONENTS / COMPONENT_IDS    name → { about, group, props: { <prop>: [type, default?, required?] }, children?, verbs? }
 *   REGIONS · AWARENESS · MARKERS · PIP_SHAPES   the closed words some components take
 *   readNode(node, defs?, where?) → the node with its defs expanded, or throws, teaching
 *   readSpec(spec)                → { screens, hud, start }
 *   runtime(spec, host)           → the running UI. host: { read(path) → value, act(effect, from), now?() → the game's
 *                                   clock in seconds (held when the game is: a pause, a hit-stop), cues?: silent |
 *                                   ticks | full (the UI's sounds it wants as effects), countUp?: seconds (a changed
 *                                   number counts on the game's clock) }
 *     .open(id) .close() .press(action, seat?) .focusAt(n, seat?) .tab(t, i) .tick() → re-rendered?
 *     .hold(on)           the game's clock is held (a hit-stop, a freeze): the HUD's motion holds with it
 *     .reduceMotion(on)   the player asked for less motion (the game's option; the system's is read by the sheet)
 *     .reduceFlash(on)    the player asked for less flash (apart from less motion): no cover between screens, no
 *                         sheen, a change pops without flashing
 *     .language(code)     the game's language (one of its spec's `languages`, or en): every word said again in it;
 *                         .languages() the codes it ships
 *     .textScale(k)       the player's text size, 1 | 1.25 | 1.5 | 1.75 | 2 (× the theme's; XAG: text scales to 200%)
 *     .subtitlePlate(a)   the opacity of the plate behind the subtitles, 0..1 (null: the theme's), the player's (XAG 104)
 *   THE UI'S SOUNDS are effects: with host.cues ticks | full (a theme's `cues` word, the page passes it on) the runtime
 *     sends { sound: move | accept | back | open | close | tab | change | deny | toast | rare | tick | skip } to act as
 *     the cursor moves, a pick is made, a value turns, a screen opens or leaves, a tab turns, a disabled row is pressed,
 *     a moment comes up (rare: a rare one), a number counts and a count is skipped (ticks: the cursor's three); silent
 *     (the default) sends none.
 *   COUNTING: with host.countUp (seconds) and a clock, a number that changed counts to its new value, and a stat with
 *     `count` counts up from zero as it first shows (rows that start together one after another); accept on a screen
 *     still counting lands them all at once (a results board's skip). Without a clock, numbers land at once. A count
 *     moves only as the page calls tick() each frame (mount's `auto` does).
 *   THE COVER: as a screen opens or leaves, a .mana-transition is drawn over the stage with a new key (the theme's
 *     `transition` animates it; none draws nothing). The host owns the audio: mana-ui ships no sound and loads nothing.
 *     .input(mode, layout?)  what the player is using: keys | pad | xr (the focus shows as a cursor) | touch | mouse (it
 *                         does not: what is tapped is selected, and a touch screen's lists scroll and its targets grow);
 *                         a pad's printed layout (xbox | playstation | nintendo) picks its glyphs
 *     .glyphs(table)      what each action's control is called, per family: { keys: { <action>: 'Enter' }, pad: {
 *                         <layout>: { <action>: 'A' } }, xr?: { … }, touch?: { … } } (controls/mana-controls.js builds
 *                         it from the control schemes); a prompt and a legend print the one the player is holding
 *   THE RUNTIME TAKES INTENTS, NEVER DEVICES: press, input and glyphs are what the page's controls layer calls; mana-ui
 *   names no key, polls no pad and seats no player.
 *     .point(n, x, seat?) a tap or a click on focusable n at x across it (0..1): a slider takes the value under it, the
 *                         ends of a ◀ ▶ input turn it, anything else is done at once; a row with a detail beside it (in
 *                         a split) is selected first and done on a second tap
 *     .hudTap(n)          a tap on the HUD's tappable part n (a button or a slot with `on.accept`: pause, a skill)
 *     .view() → html .tree() .state()
 *     actions (the controls kernel's `menu` scheme): up, down, left, right, accept, back, tabNext, tabPrev
 *   toHtml(tree) · readPath(obj, path)
 *   mount(el, rt, { auto?, swipe? }) → { paint }: the DOM backend, a VIEW: it draws into el (patching what is there, by
 *     position: an element lives on while its tag and its data-key hold, so a transition runs and an entrance plays
 *     once; a new data-key is a new element), holds the page while a screen
 *     is up (window.__mojMenuOpen) and hit-tests its own widgets under a pointer. It reads no device: the controls layer
 *     (controls/mana-host.js) hands the runtime its intents, the device in hand and the glyphs. swipe: the host's
 *     classifier (controls/swipe.js swipeOf), a stand-in with its thresholds when none is given
 */
export function buildManaUi() {
  const ROLES = ['display', 'title', 'heading', 'body', 'label', 'caption', 'numeral'];
  const REGIONS = ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'];
  // an enemy's awareness, each a SHAPE (never a colour alone): what it knows of you
  const AWARENESS = { unaware: '–', suspicious: '?', searching: '??', alert: '!', combat: '!!', fleeing: '»', down: '✕' };
  const MARKERS = { self: '▲', ally: '●', foe: '✕', goal: '★', item: '◆', poi: '○' };
  const PIP_SHAPES = { pip: ['●', '○'], heart: ['♥', '♡'], square: ['■', '□'], diamond: ['◆', '◇'] };
  // a moment's weight: a number, or the words (the broadcast's tones, weightiest last)
  const WEIGHTS = { minor: 0, normal: 1, major: 2, decisive: 3 };
  const RETICLES = { cross: '+', dot: '·', circle: '◯', bracket: '[ ]' };
  const STYLE_KEYS = ['style', 'class', 'className', 'color', 'colour', 'font', 'css', 'border', 'theme', 'skin', 'tokens', 'register'];
  const ACTIONS = ['up', 'down', 'left', 'right', 'accept', 'back', 'tabNext', 'tabPrev'];
  const INPUTS = ['keys', 'pad', 'xr', 'touch', 'mouse'];
  // the UI's sounds, as effects ({ sound: <cue> }) the host plays: none, the cursor's, or every state change
  const CUES = { silent: [], ticks: ['move', 'accept', 'back'], full: ['move', 'accept', 'back', 'open', 'close', 'tab', 'change', 'deny', 'toast', 'rare', 'tick', 'skip', 'appear', 'vanish', 'shuffle'] };
  // what a number in words means (a blow's kind): a tone the theme colours, the word still saying it
  const TONES = ['plain', 'hit', 'crit', 'heal', 'miss', 'block'];
  // press start: the buttons that start (a face or a shoulder button; the d-pad moves, back still leaves)
  const ANY = ['accept', 'tabNext', 'tabPrev'];
  // the player's text size (XAG: text scales to 200%)
  const TEXT_SCALES = [1, 1.25, 1.5, 1.75, 2];
  // the inputs a left or a right turns
  const CHANGERS = ['toggle', 'cycler', 'slider', 'carousel', 'alloc-row', 'language'];
  // a language called by its own name, when its table does not say it (a game's languages: languageName)
  const AUTONYMS = { en: 'English', ja: '日本語', es: 'Español', fr: 'Français', de: 'Deutsch', it: 'Italiano', pt: 'Português', 'pt-BR': 'Português (Brasil)', ko: '한국어', zh: '中文', ru: 'Русский', ar: 'العربية', nl: 'Nederlands', pl: 'Polski', tr: 'Türkçe', sv: 'Svenska', uk: 'Українська', hi: 'हिन्दी', id: 'Bahasa Indonesia', th: 'ไทย', vi: 'Tiếng Việt' };
  // THE RUNTIME'S OWN WORDS, in English: what it and its idioms say that no game passes in (a legend, a heading, an
  // empty list). A GAME IN SEVERAL LANGUAGES says them, and its own, in the one it is set in: the spec's `languages`
  // ({ <code>: { <key>: word } }), `language` the one it starts in, rt.language(code) to change (an options screen's
  // language cycler). A node names a word with { word: '<key>' } and a format with {@key}; a word the language lacks
  // reads in English, a key no table holds as itself
  const WORDS = {
    select: 'Select', change: 'Change', tabs: 'Tabs', back: 'Back', start: 'Start', confirm: 'Confirm', reset: 'Reset', delete: 'Delete', done: 'Done',
    resume: 'Resume', rebind: 'Rebind', nextTab: 'Next tab', detail: 'Detail', language: 'Language',
    nothingHere: 'Nothing here', more: '{n} more', on: 'On', off: 'Off', points: 'Points',
    keyArt: 'key art', keyArtPlace: 'key art of the place', loading: 'Loading', progress: 'Progress', tip: 'Tip', tips: 'Tips', continue: 'Continue', gettingReady: 'Getting the world ready…', stillLoading: 'Still loading…', retry: 'Retry', quitToTitle: 'Quit to title',
    modes: 'Modes', players: 'Players', playersCount: 'players', roster: 'Roster', random: 'Random', resetDefaults: 'Reset to defaults', action: 'Action', keysPad: 'Keys · Pad', rank: 'Rank',
    party: 'Party', hp: 'HP', mp: 'MP', sp: 'SP', status: 'Status', attack: 'Attack', defence: 'Defence', magic: 'Magic', speed: 'Speed', equip: 'Equip', nothingWorn: 'Nothing worn', skills: 'Skills', noSkills: 'No skills yet',
    cost: 'Cost', levelUp: 'Level up', level: 'Level', weight: 'Weight', kg: 'kg', slots: 'Slots', swapFor: 'Swap for', nothingFits: 'Nothing fits this slot',
    gold: 'Gold', goldMark: 'G', held: 'Held', buy: 'Buy', sell: 'Sell', nothingToSell: 'Nothing to sell', quests: 'Quests', steps: 'Steps',
    ammo: 'Ammo', time: 'Time', score: 'Score', lv: 'Lv', range: 'Range', super: 'Super', hits: 'hits', pos: 'Pos', lap: 'Lap', best: 'Best',
    move: 'Move', atk: 'Atk', rng: 'Rng', forecast: 'Forecast', wave: 'Wave', lives: 'Lives', seen: 'Seen', map: 'Map', cancel: 'Cancel', headToHead: 'Head to head',
    turnOrder: 'Turn order', foes: 'Foes', command: 'Command', act: 'Act', close: 'Close', queue: 'Queue', orders: 'Orders',
  };
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
    screen: { group: 'layout', about: 'a screen on the stack: what one back leaves; `seats` > 1 gives each couch seat its own cursor; its legend bar is drawn from what it holds unless it names one (`legend: none` for none); `press: any` takes any face or shoulder button as accept (press start)', props: { title: [T], layer: [['overlay', 'modal'], 'modal'], place: [['center', 'left', 'right', 'full', 'top', 'bottom', 'sheet'], 'center'], seats: [N, 1], legend: [['auto', 'none'], 'auto'], press: [['focus', 'any'], 'focus'] }, children: true, verbs: ['back'] },
    window: { group: 'layout', about: 'a framed panel', props: { title: [T], variant: [['plain', 'inset', 'ghost'], 'plain'] }, children: true },
    stack: { group: 'layout', about: 'children in a column or a row; `fill` a row that takes its place\'s width, its children sharing it (two fighters\' bars)', props: { dir: [['column', 'row'], 'column'], gap: [['tight', 'normal', 'loose'], 'normal'], align: [['stretch', 'start', 'center', 'end', 'apart'], 'stretch'], fill: [B, false] }, children: true },
    split: { group: 'layout', about: 'two panes: the first a list, the second its detail', props: { ratio: [['narrow', 'even', 'wide'], 'narrow'] }, children: true },
    tabs: { group: 'layout', about: 'tabs, one open, [ and ] turn them: tab children, or `pages` (a list) drawn by `page` and named by their `label` field', props: { pages: [L], page: [ND], label: [T, 'label'] }, children: 'tab' },
    tab: { group: 'layout', about: 'one tab of tabs', props: { label: [T, undefined, true] }, children: true },
    each: { group: 'layout', about: 'a `row` drawn for each item, not itself focusable (the stats in a detail, the fields of an options page)', props: { rows: [L, [], true], row: [ND, undefined, true], dir: [['column', 'row'], 'column'] } },
    divider: { group: 'layout', about: 'a rule between groups, with an optional label', props: { label: [T] } },
    // in-game: the HUD's places
    hud: { group: 'hud', about: 'the in-game layer under the stack: its children are regions and the layers (anchors, edges, threat, letterbox)', props: {}, children: 'hud' },
    region: { group: 'hud', about: 'one of the nine screen places; parts stack inside it (in a hud, or laid out over a screen); `subtitles` sits on the subtitles\' plate (its opacity the player\'s)', props: { at: [REGIONS, 'top-left'], variant: [['plain', 'subtitles'], 'plain'] }, children: true },
    anchors: { group: 'hud', layer: true, about: 'one `row` drawn over each thing in the world at its screen place (x, y from 0 to 1): nameplates on a plate, damage numbers `bare` (a halo, no plate)', props: { rows: [L, [], true], row: [ND, undefined, true], x: [T, 'x'], y: [T, 'y'], variant: [['plate', 'bare'], 'plate'] } },
    edges: { group: 'hud', layer: true, about: 'what is off screen, held at the screen\'s edge with an arrow toward it (x, y outside 0..1): an objective, a foe behind you', props: { markers: [L, [], true] } },
    threat: { group: 'hud', layer: true, about: 'where harm came from: a mark on a ring round the centre for each bearing (degrees from where you face)', props: { markers: [L, [], true] } },
    letterbox: { group: 'hud', layer: true, about: 'the cinema bars of a cutscene', props: {} },
    touchpad: { group: 'hud', about: 'the look of a touch screen\'s virtual pad: a stick and round buttons, each named by the gamepad control it is (a word, or { label, control: south | east | west | north | rb … }); the touch driver (controllable/touch.js) reads it, never this runtime', props: { stick: [B, true], buttons: [L, ['A', 'B']] } },
    legend: { group: 'value', about: 'what the buttons do here (a row: { action | actions: [..], label }), each with the glyph of the control the player is holding (keys, an Xbox, a PlayStation or a Nintendo pad); a finger needs none, so a touch screen draws none', props: { rows: [L, [], true] } },
    // values
    text: { group: 'value', about: 'words in a type role; `tone` what a number means (a blow\'s kind: hit, crit, heal, miss, block), the theme\'s colour', props: { value: [T, '', true], role: [ROLES, 'body'], tone: [A, 'plain'] } },
    // a load: the unglamorous rules each game relearns (docs/mana-ui.md, loading)
    loader: { group: 'value', about: 'a load in progress, honest about it: the progress never goes back (null: not known, a sweep), an activity mark that moves even while the page is busy, the step it is on, a still-loading line once nothing has moved for `stall` seconds, tips that turn every `turn` seconds (left and right turn them too; `seed` mixes their order), a failure said with its words; `auto` goes on by itself once ready (after `least` seconds on screen, or at once if ready before `grace`), else it waits for the player (a press made in the first moment after ready is not an answer); on the game\'s clock (host.now)', props: { progress: [A], max: [N, 100], step: [T], tips: [L, []], tip: [T], ready: [B, false], error: [T], auto: [B, false], stall: [N, 10], turn: [N, 8], seed: [N, 0], least: [N, 1], grace: [N, 0.3] }, verbs: ['done'] },
    stat: { group: 'value', about: 'a label and its number; `count` counts it up from zero as it first shows (a results row, on the game\'s clock with host.countUp)', props: { label: [T, '', true], value: [T, '', true], max: [T], count: [B, false] } },
    bar: { group: 'value', about: 'a value against its max; segments mark phases or chunks; `ghost` the value before the last hit (drawn hatched, the chip a fighting game shows); rtl fills from the right (the second fighter)', props: { value: [N, 0, true], max: [N, 1, true], variant: [['plain', 'hp', 'mp', 'xp', 'stamina', 'shield', 'boss'], 'plain'], label: [T], segments: [N, 0], ghost: [N, 0], dir: [['ltr', 'rtl'], 'ltr'] } },
    pips: { group: 'value', about: 'a count as marks: hearts, pips', props: { value: [N, 0, true], max: [N, 3, true], shape: [Object.keys(PIP_SHAPES), 'pip'], label: [T] } },
    counter: { group: 'value', about: 'an icon and a count (ammo, coins, keys)', props: { label: [T, '', true], value: [T, '', true], max: [T], icon: [T] } },
    timer: { group: 'value', about: 'seconds as a clock', props: { seconds: [N, 0, true], format: [['mmss', 'ss', 'hmmss'], 'mmss'], label: [T] } },
    compare: { group: 'value', about: 'before → after, better or worse told by a shape (▲ ▼ =)', props: { label: [T, '', true], from: [N, 0, true], to: [N, 0, true], better: [['up', 'down'], 'up'] } },
    icon: { group: 'value', about: 'an icon\'s place, named', props: { name: [T, '', true], size: [['s', 'm', 'l'], 'm'] } },
    portrait: { group: 'value', about: 'a face\'s place, named', props: { name: [T, ''], size: [['s', 'm', 'l'], 'm'] } },
    image: { group: 'value', about: 'a picture\'s place (a logo, an arena\'s preview, key art); `backdrop` fills the screen behind what it holds', props: { label: [T, ''], ratio: [['wide', 'square', 'tall', 'banner', 'backdrop'], 'wide'] } },
    badge: { group: 'value', about: 'a small mark: new, a count, a rank, a score; `stamp` a rank stamped on as the screen settles; `side` its side\'s chip; `turn` alight while it is that side\'s turn', props: { value: [T, '', true], variant: [['plain', 'strong', 'muted', 'stamp'], 'plain'], side: [A], turn: [B, false] } },
    table: { group: 'value', about: 'rows under columns (a scoreboard, a forecast, a stat panel): the row whose `mark` field is true is yours, a row\'s `lead` names the column that leads it (marked ▲), a row\'s `side` its chip', props: { columns: [L, [], true], rows: [L, [], true], mark: [T, 'self'] } },
    gauge: { group: 'value', about: 'a value on a dial (a speedometer, a pressure, a charge)', props: { value: [N, 0, true], max: [N, 1, true], label: [T], unit: [T] } },
    slot: { group: 'value', about: 'an action or a hotbar slot: what is in it, its key, a cooldown left (0..1), a count; active when it is the one in hand; with `on.accept` a touch screen taps it', props: { name: [T, ''], key: [T], cooldown: [N, 0], count: [T], active: [B, false] }, verbs: ['accept'] },
    prompt: { group: 'value', about: 'what a button does here: [E] Talk (the glyph is the host\'s legend, else the action)', props: { action: [T, 'accept'], label: [T, '', true], glyph: [T] } },
    // in-game: aim, maps, the feed, moments
    reticle: { group: 'hud', about: 'the aim; a hit adds a hitmarker shape', props: { shape: [Object.keys(RETICLES), 'cross'], hit: [B, false] } },
    minimap: { group: 'hud', about: 'the map in a corner: markers at x, y from 0 to 1, each kind a shape', props: { markers: [L, []], shape: [['square', 'round'], 'square'], label: [T] } },
    compass: { group: 'hud', about: 'a heading strip with the bearings of markers', props: { heading: [N, 0, true], markers: [L, []] } },
    feed: { group: 'hud', about: 'the last few lines of a log (kills, pickups, chat from the world); a line said again in a row merges (×3)', props: { rows: [L, [], true], field: [T, 'text'], max: [N, 4] } },
    toast: { group: 'hud', about: 'a passing word', props: { value: [T, '', true] } },
    banner: { group: 'hud', about: 'the moment, centred: a title and its line', props: { value: [T, '', true], sub: [T] } },
    moments: { group: 'hud', about: 'the moments a game calls (a phase, a goal, a quest step), one on screen at a time by weight (the broadcast\'s rule): a weightier one takes the screen at once, an equal one once the one up has been read, a lighter one waits its turn; rows { id, text, sub?, weight?: 0..3 | minor | normal | major | decisive, side?, tier?: standard | rare (held longer, its own cue and ornament), icon? }, timed on the game\'s clock (host.now), else the weightiest the game still lists', props: { rows: [L, [], true], as: [['banner', 'toast'], 'banner'], hold: [N, 3], read: [N, 1.2] } },
    // enemies
    awareness: { group: 'enemy', about: `what an enemy knows of you, as a shape: ${Object.entries(AWARENESS).map(([k, v]) => `${k} ${v}`).join(', ')}`, props: { state: [Object.keys(AWARENESS), 'unaware', true], label: [B, true] } },
    statuses: { group: 'enemy', about: 'the statuses on someone (a word, or { name, turns })', props: { rows: [L, [], true] } },
    // inputs and collections
    list: { group: 'input', about: 'rows to move through and pick; `visible` scrolls a long list; `menu` sets its rows at a title\'s size (a title screen\'s, a hub\'s)', props: { rows: [L, [], true], row: [ND], empty: [T], visible: [N, 0], variant: [['plain', 'menu'], 'plain'] }, verbs: ['accept'] },
    grid: { group: 'input', about: 'cells in columns, moved through in two directions (an inventory, a roster)', props: { cells: [L, [], true], cell: [ND], columns: [N, 4], empty: [T] }, verbs: ['accept'] },
    tree: { group: 'input', about: 'nodes laid in tiers by what they require (a skill or tech tree): { id, requires?, state: learned | available | locked }', props: { nodes: [L, [], true], node: [ND], label: [T, 'name'] }, verbs: ['accept'] },
    carousel: { group: 'input', about: 'one item at a time, left and right turn it (a bound value is set by the item\'s id)', props: { items: [L, [], true], item: [ND], value: [A] }, verbs: ['accept', 'change'] },
    button: { group: 'input', about: 'a thing to press', props: { label: [T, '', true], disabled: [B, false] }, verbs: ['accept'] },
    toggle: { group: 'input', about: 'on or off (a bound value is set on the host, never held here)', props: { label: [T, '', true], value: [B, false, true] }, verbs: ['change'] },
    cycler: { group: 'input', about: '◀ a value ▶ from its options', props: { label: [T, '', true], options: [L, [], true], value: [A, '', true] }, verbs: ['change'] },
    slider: { group: 'input', about: 'a number between min and max, by step', props: { label: [T, '', true], value: [N, 0, true], min: [N, 0], max: [N, 10], step: [N, 1] }, verbs: ['change'] },
    language: { group: 'input', about: 'the game\'s language, picked: ◀ its own name ▶ over the languages the game ships (its spec\'s `languages`); changing it says every word again in it and tells the game ({ emit: language, to: <code> }, to keep it); a game in one language draws none', props: { label: [T] }, verbs: [] },
    keybind: { group: 'input', about: 'an action and what it is bound to; accept asks the host to capture a new one; `conflict` when another action in the same context shares a control', props: { label: [T, '', true], keys: [L, []], conflict: [B, false] }, verbs: ['accept'] },
    field: { group: 'input', about: 'an input chosen by data (an options row): kind toggle | cycler | slider | keybind', props: { kind: [['toggle', 'cycler', 'slider', 'keybind'], undefined, true], label: [T, '', true], value: [A], options: [L, []], min: [N, 0], max: [N, 10], step: [N, 1], keys: [L, []] }, verbs: ['change', 'accept'] },
    allocator: { group: 'input', about: 'points spent across rows (level up): a draft until confirm, never past the points or a row\'s max', props: { rows: [L, [], true], points: [N, 0, true] }, verbs: ['confirm', 'change'] },
    textentry: { group: 'input', about: 'a name typed from a grid of letters (a pad can type): a draft until done', props: { label: [T], value: [T, ''], max: [N, 12], charset: [['letters', 'alnum'], 'letters'] }, verbs: ['done'] },
  };
  const COMPONENT_IDS = Object.keys(COMPONENTS);
  const BINDS = ['bind', 'item', 'pick', 'format', 'input', 'seat', 'param', 'word'];
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
    if (!isObj(spec) || !isObj(spec.screens)) throw new Error('a mana-ui spec is { screens: { <id>: node }, hud?, defs?, start?, languages?, language? }');
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
    // the game's languages: each a table of words by key (its own keys and the runtime's), the one it starts in
    const languages = spec.languages === undefined ? {} : spec.languages;
    if (!isObj(languages)) throw new Error('languages is { <code>: { <key>: word } } (the game\'s words in each language it ships)');
    for (const code in languages) {
      if (!/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(code)) throw new Error(`languages.${code}: a language is a code like en, ja, pt-BR`);
      if (!isObj(languages[code])) throw new Error(`languages.${code} is { <key>: word }`);
      for (const k in languages[code]) if (typeof languages[code][k] !== 'string') throw new Error(`languages.${code}.${k} is a word (a string)`);
    }
    const language = spec.language === undefined ? (languages.en || !Object.keys(languages).length ? 'en' : Object.keys(languages)[0]) : spec.language;
    if (spec.language !== undefined && !languages[language]) throw new Error(`language '${language}' is one of the game's languages: ${Object.keys(languages).join(', ') || 'none given'}`);
    return { screens, hud, start, languages, language };
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
  // whose turn it is: a row's or a badge's `turn`, alight in its side's colour when it has one
  const turnOf = (on, side) => { if (!on) return null; const k = sideOf(side); return k === null ? 'yes' : k; };
  const numOf = (x) => (typeof x === 'number' && isFinite(x) ? x : typeof x === 'string' && x.trim() !== '' && isFinite(Number(x)) ? Number(x) : null);
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
    const { screens, hud, start, languages, language: startLanguage } = readSpec(spec);
    const H = host || {};
    if (H.cues !== undefined && !CUES[H.cues]) throw new Error(`host.cues is one of: ${Object.keys(CUES).join(', ')} (the UI's sounds the host plays)`);
    const heard = new Set(CUES[H.cues || 'silent']);
    if (H.words !== undefined && !isObj(H.words)) throw new Error('host.words is { <key>: word } (words the host says over the game\'s; a key left out reads in the game\'s language)');
    // a word: the host's, else the game's language's, else its English (the game's own, then the runtime's), else its key
    // the languages a game ships, English first when it has its words, and each one's own name
    const codesOf = () => { const c = Object.keys(languages); return c.length ? (c.includes('en') ? ['en', ...c.filter((x) => x !== 'en')] : c) : ['en']; };
    const nameOf = (code) => { const t = languages[code]; return (t && typeof t.languageName === 'string' && t.languageName) || AUTONYMS[code] || code; };
    const own = (code, k) => { const t = languages[code]; return t && typeof t[k] === 'string' && t[k] ? t[k] : null; };
    const W = (k, vars) => {
      const w = words((H.words && typeof H.words[k] === 'string' && H.words[k]) || own(S.language, k) || own('en', k) || WORDS[k] || k);
      return vars ? w.replace(/\{(\w+)\}/g, (_, x) => words(vars[x])) : w;
    };
    // a number that changed counts to its new value over countUp seconds of the game's clock (0: it lands at once)
    if (H.countUp !== undefined && !(typeof H.countUp === 'number' && H.countUp >= 0 && H.countUp <= 10)) throw new Error('host.countUp is the seconds a changed number counts for, 0 to 10 (0: at once)');
    const COUNT = H.now && H.countUp ? H.countUp : 0;
    const S = { stack: [], ui: {}, picks: {}, input: null, layout: 'xbox', glyphs: null, seen: new Map(), lists: new Map(), moments: new Map(), loads: new Map(), later: [], guard: -Infinity, held: false, calm: false, dim: false, text: 1, plate: null, nav: null, pressed: null, language: startLanguage, renders: 0, booting: true, counts: new Map(), queued: [], tx: 0, txWay: 'in' };
    // a sound the UI makes, if the host listens for it: an effect like any other, played by the host
    // (a cursor's sound says the way it went, a stepper's the step it took, so a sound set can pitch them)
    const cue = (name, seat = 0, more) => { if (!S.booting && heard.has(name) && H.act) H.act({ sound: name, ...(more || {}) }, { screen: top(), key: null, verb: 'cue', seat }); };
    // what changed since it was last drawn: { d: up | down | new, n: how many times, g: the gain } (null: nothing yet)
    const changeOf = (key, value) => {
      const now = JSON.stringify(value === undefined ? null : value), was = S.seen.get(key);
      if (!was) { S.seen.set(key, { v: now, raw: value, n: 0, d: null, g: null }); return null; }
      if (was.v !== now) {
        const a = numOf(was.raw), b = numOf(value);
        was.p = a !== null && b !== null && a !== b ? a : null;
        was.n += 1; was.d = a !== null && b !== null && a !== b ? (b > a ? 'up' : 'down') : 'new'; was.g = a !== null && b !== null && a !== b ? Math.round((b - a) * 100) / 100 : null;
        was.v = now; was.raw = value;
      }
      return was.n ? was : null;
    };
    const chOf = (c) => (c ? { 'data-ch': c.d, 'data-key': `ch${c.n}` } : {});
    // a number as shown while it counts (a change from its last value, or from zero as it first shows: `fresh`): eased
    // out on the game's clock, its tick heard as it moves; once there, the value itself
    const clockNow = () => Number(H.now());
    function counting(key, value, c, fresh) {
      const to = numOf(value);
      if (!COUNT || to === null) return value;
      let K = S.counts.get(key);
      const from = c && c.p !== undefined && c.p !== null ? c.p : !c && fresh && (!K || K.fresh) ? 0 : null;
      if (from === null && !(K && !K.done && K.to === to)) return value;
      if (!K || K.to !== to || (c && K.n !== c.n)) {
        // rows that start together count one after another (a results board's rows)
        K = { from, to, at: clockNow() + S.started++ * COUNT * 0.5, n: c ? c.n : 0, fresh: !c, shown: from, done: false };
        S.counts.set(key, K);
      }
      if (K.done) return value;
      const r = clamp((clockNow() - K.at) / COUNT, 0, 1), dec = Math.max(...[K.from, K.to].map((x) => (String(x).split('.')[1] || '').length));
      if (r >= 1) { K.done = true; return value; }
      const e = 1 - (1 - r) ** 3, shown = Math.round((K.from + (K.to - K.from) * e) * 10 ** dec) / 10 ** dec;
      // its tick, as the whole number moves, at most twenty a second
      if (Math.trunc(shown) !== Math.trunc(K.shown) && !(clockNow() - (K.heard ?? -1) < 0.05)) { K.heard = clockNow(); S.queued.push(['tick']); }
      K.shown = shown;
      return typeof value === 'string' ? String(shown) : shown;
    }
    const mineOf = (id) => (k) => k === id || k.startsWith(`${id}.`);
    const countingOn = (id) => [...S.counts.entries()].some(([k, K]) => !K.done && mineOf(id)(k));
    const gainOf = (c) => (c && c.g !== null ? ['s', { class: 'mana-gain' }, `${c.g > 0 ? '+' : '−'}${Math.abs(c.g)}`] : null);
    // a list's rows that are new since its ids last changed (none on its first draw)
    // what changed in a list since its ids last changed (none on its first draw): the rows that came, how many went, and
    // the rows the others moved past (up or down among the rows both orders hold: a shuffle, a rank changed). Each is
    // heard once (appear, vanish, shuffle, with how many) and drawn: a fresh row rings, a moved one says which way
    const freshOf = (key, rows) => {
      const ids = rows.map((r) => (isObj(r) && r.id !== undefined && r.id !== null ? String(r.id) : null)).filter((x) => x !== null), sig = ids.join('\u0001'), L = S.lists.get(key);
      if (!L) { const first = { sig, ids: new Set(ids), order: ids, fresh: new Set(), moved: new Map() }; S.lists.set(key, first); return first; }
      if (L.sig !== sig) {
        const now = new Set(ids), gone = [...L.ids].filter((x) => !now.has(x)).length;
        L.fresh = new Set(ids.filter((x) => !L.ids.has(x)));
        const keep = ids.filter((x) => L.ids.has(x)), before = L.order.filter((x) => now.has(x));
        L.moved = new Map();
        keep.forEach((x, i) => { const j = before.indexOf(x); if (j !== i) L.moved.set(x, j > i ? 'up' : 'down'); });
        if (L.fresh.size) S.queued.push(['appear', { count: L.fresh.size }]);
        if (gone) S.queued.push(['vanish', { count: gone }]);
        if (L.moved.size) S.queued.push(['shuffle', { count: L.moved.size }]);
        L.ids = now; L.sig = sig; L.order = ids;
      }
      return L;
    };
    // a row's identity (the view glides it from where it was to where it is) and what changed about it
    const rowMarks = (L, item) => {
      if (!isObj(item)) return {};
      const id = item.id !== undefined && item.id !== null ? String(item.id) : null;
      return { 'data-id': id, 'data-fresh': id !== null && L.fresh.has(id) ? 'yes' : null, 'data-moved': id !== null ? L.moved.get(id) || null : null, 'data-last': item.last ? 'yes' : null, 'data-turn': turnOf(item.turn, item.side) };
    };
    // the moment up: the broadcast's rule on the game's clock
    function momentOf(key, p) {
      const rows = p.rows.map((r, i) => { const o = isObj(r) ? r : { text: r }, text = words(o.text ?? o.value), w = typeof o.weight === 'number' && isFinite(o.weight) ? o.weight : WEIGHTS[o.weight] ?? 1; return { id: o.id !== undefined && o.id !== null ? `#${o.id}` : `${i}:${text}`, text, sub: o.sub === undefined || o.sub === null ? null : words(o.sub), w, side: o.side, rare: o.tier === 'rare', icon: o.icon === undefined || o.icon === null ? null : words(o.icon) }; }).filter((r) => r.text);
      const t = H.now ? Number(H.now()) : NaN;
      if (!isFinite(t)) { let best = null; for (const r of rows) if (!best || r.w >= best.w) best = r; return best ? { ...best, key: best.id } : null; }
      const hold = Math.max(0.2, p.hold), read = clamp(p.read, 0, hold);
      let M = S.moments.get(key);
      // first sight: only the latest is news
      if (!M) { M = { seen: new Set(rows.map((r) => r.id)), queue: rows.length ? [{ ...rows[rows.length - 1], q: t }] : [], up: null, n: 0, due: Infinity, drawn: 0 }; S.moments.set(key, M); }
      else { for (const r of rows) if (!M.seen.has(r.id)) M.queue.push({ ...r, q: t }); M.seen = new Set(rows.map((r) => r.id)); }
      M.drawn = S.renders;
      M.queue = M.queue.filter((x) => t - x.q <= hold * 3);   // a moment that waited three holds is stale
      // a rare one (an achievement's rarest, a legendary drop) is held longer
      const holdOf = (x) => (x.rare ? hold * 1.6 : hold);
      if (M.up && t - M.up.at >= holdOf(M.up)) M.up = null;
      const next = M.queue.reduce((b, x) => (!b || x.w > b.w ? x : b), null);   // the weightiest, the first among equals
      if (next && (!M.up || next.w > M.up.w || (next.w === M.up.w && t - M.up.at >= read))) { M.queue.splice(M.queue.indexOf(next), 1); M.up = { ...next, at: t, key: `m${++M.n}` }; S.queued.push([next.rare ? 'rare' : 'toast']); }
      M.due = M.up ? Math.min(M.up.at + holdOf(M.up), M.queue.some((x) => x.w === M.up.w) ? M.up.at + read : Infinity) : M.queue.length ? t : Infinity;
      return M.up;
    }
    // what an action's control is called on the device in hand (null: nothing to say)
    const glyphOf = (action) => {
      const G = S.glyphs;
      if (!G || !action) return null;
      const t = S.input === 'pad' ? G.pad && (G.pad[S.layout] || G.pad.xbox) : S.input === 'xr' ? G.xr : S.input === 'touch' ? G.touch : G.keys;
      return t && t[action] ? String(t[action]) : null;
    };
    // A LOAD on the game's clock: what it has shown (the best progress, never less), when it last moved, the tip up, when
    // it went ready; what it does next is due at a time (a tip turns, the still-loading line, going on by itself)
    const gcd = (a, b) => (b ? gcd(b, a % b) : a);
    // a mixed order with no dice: a stride through the tips that visits each once before any comes again
    const tipAt = (i, n, seed) => { if (!seed || n < 3) return i % n; let st = Math.max(1, Math.floor(n * 0.618)); while (gcd(st, n) !== 1) st += 1; return (Math.abs(Math.floor(seed)) + i * st) % n; };
    function loadOf(key, p, n, scope, ctx) {
      const t = H.now ? Number(H.now()) : NaN, timed = isFinite(t);
      let G = S.loads.get(key);
      if (!G) { G = { at: timed ? t : 0, best: null, moved: timed ? t : 0, tip: 0, turned: timed ? t : 0, ready: null, fired: false }; S.loads.set(key, G); }
      G.drawn = S.renders;
      const max = p.max > 0 ? p.max : 100, raw = p.progress === null || p.progress === undefined || p.progress === '' ? null : Number(p.progress), known = raw !== null && isFinite(raw);
      if (known) { const v = clamp(raw, 0, max); if (G.best === null || v > G.best) { G.best = v; G.moved = timed ? t : 0; } }
      const failed = !!p.error, tips = [...p.tips, ...(p.tip ? [p.tip] : [])].map(words).filter(Boolean);
      // ready: heard as it comes, and a press in its first moment is not an answer (a button held or mashed through the load)
      if (p.ready && !failed && G.ready === null) { G.ready = timed ? t : 0; S.queued.push(['appear']); if (timed) S.guard = t + 0.35; }
      if (!p.ready || failed) { G.ready = null; G.fired = false; }
      if (failed && !G.failed) S.queued.push(['deny']);
      // a failure cleared is a new attempt (a retry): its progress starts again
      if (!failed && G.failed) { G.best = known ? clamp(raw, 0, max) : null; G.moved = G.at = timed ? t : 0; }
      G.failed = failed;
      if (timed && tips.length > 1 && t - G.turned >= Math.max(2, p.turn)) { G.tip += 1; G.turned = t; }
      const graceUp = timed && G.ready === null && !failed && t - G.at < p.grace;
      const stalled = timed && G.ready === null && !failed && t - G.moved >= Math.max(1, p.stall);
      // going on by itself: once ready, after `least` on screen (at once if it was ready before anything showed)
      if (p.auto && G.ready !== null && !G.fired) {
        const go = !timed || G.ready - G.at < p.grace ? G.ready : Math.max(G.ready, G.at + p.least);
        if (!timed || t >= go) { G.fired = true; if (n.on && n.on.done) S.later.push([effectsOf(n.on.done, scope, ctx), { key, n, scope }, 'done', 0]); }
        else G.goAt = go;
      }
      const due = [tips.length > 1 ? G.turned + Math.max(2, p.turn) : Infinity, G.ready === null && !failed ? G.moved + Math.max(1, p.stall) : Infinity, graceUp ? G.at + p.grace : Infinity, !G.fired && G.goAt !== undefined ? G.goAt : Infinity];
      G.due = timed ? Math.min(...due.filter((d) => d > t), Infinity) : Infinity;
      ctx.loader = { key, tips: tips.length };
      return { G, max, known, failed, tips, graceUp, stalled, tip: tips.length ? tips[tipAt(G.tip, tips.length, p.seed)] : null };
    }
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
      if (k === 'word') return W(a);
      // a format's {field} reads the row, its {@key} the runtime's words
      if (k === 'format') return String(a).replace(/\{(@?)([a-zA-Z0-9_.]+)\}/g, (_, at, f) => (at ? W(f) : words(readPath(scope.item, f))));
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
      S.renders += 1;
      S.started = 0;
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
      // the player's options that are the sheet's: the text size, the subtitles' plate
      const own = [S.text !== 1 ? `--mana-text:${S.text}` : null, S.plate !== null ? `--mana-sub-plate:${S.plate}` : null].filter(Boolean).join(';');
      // the cover over the stage as one screen gives way to the next (a new key each time: the theme's transition plays)
      if (S.tx) parts.push(['div', { class: 'mana-transition', 'data-key': `tx${S.tx}`, 'data-way': S.txWay }]);
      const tree = ['div', { class: 'mana-root', 'data-open': id || 'none', 'data-hud': hud ? 'yes' : null, 'data-input': S.input, 'data-layout': S.input === 'pad' ? S.layout : null, 'data-clock': S.held ? 'held' : null, 'data-motion': S.calm ? 'reduced' : null, 'data-flash': S.dim ? 'reduced' : null, 'data-nav': id ? S.nav : null, style: own || null }, ...parts];
      last = { tree, ...ctx };
      // what this draw set going (a moment up, a number ticking) is heard once it is drawn
      // (one of each, the counts summed: a draw that brought three rows is one appear of three)
      const q = S.queued.splice(0), by = new Map();
      for (const [name, more] of q) { const was = by.get(name); if (!was) by.set(name, more ? { ...more } : undefined); else if (more && more.count) was.count = (was.count || 0) + more.count; }
      for (const [name, more] of by) cue(name, 0, more);
      // what this draw set going (a load that goes on by itself) is done once it is drawn
      const now = last;
      for (const [eff, f, verb, seat] of S.later.splice(0)) run(eff, f, verb, seat);
      return now;
    }

    // one tree drawn: U is its screen's state; `live` says whether it takes the focus (a HUD never does)
    function drawIn(root, rootKey, rootScope, ctx, U, live, seats) {
      const seatsAt = (fi) => { const s = []; for (let k = 0; k < seats; k++) if (U.at[k] === fi) s.push(k + 1); return s; };
      // a finger or a mouse moves no cursor: nothing shows selected on a screen until it has been tapped
      const cursorless = (S.input === 'touch' || S.input === 'mouse') && !U.pointed;
      const mark = (fi, base, off) => {
        const s = live && !cursorless ? seatsAt(fi) : [];
        // the item just pressed says so (confirm or deny; its two names alternate, so a second press plays again)
        const P = S.pressed, press = live && P && P.screen === rootKey && P.k === fi ? `${P.verb}-${P.n % 2 ? 'a' : 'b'}` : null;
        return { 'data-k': live ? fi : null, 'data-st': s.length ? 'focus' : off ? 'disabled' : base, 'data-seats': seats > 1 && s.length ? s.join(' ') : null, 'data-press': press };
      };
      ctx.root = rootKey;
      let pane = null;   // the pane of a split being drawn: left and right cross between them
      const focusable = (f) => { if (!live) return -1; f.pane = pane; ctx.focus.push(f); return ctx.focus.length - 1; };
      // a HUD part a touch screen taps (it takes no focus): its index on data-tap
      const tappable = (n, key, scope) => (!live && n.on && n.on.accept ? ctx.taps.push({ n, key, scope }) - 1 : null);
      const register = (n, key, rowsRaw, scope) => { if (n.id) S.picks[`${rootKey}:${n.id}`] = S.picks[n.id] = { rows: rowsRaw, scope, screen: rootKey, key }; };
      const touched = (key) => !!U.vals[`$touched:${key}`];
      // a legend: what the buttons do here, each beside the glyph of the control in hand; a finger needs none
      const legendOf = (rows) => {
        if (S.input === 'touch' || !rows.length) return null;
        return ['div', { class: 'mana-legend' }, ...rows.map((r) => {
          // a row names an action, or several that share a word (left and right: change)
          const acts = isObj(r) && Array.isArray(r.actions) ? r.actions.map(words) : [isObj(r) ? words(r.action) : words(r)];
          // a row's label: words, or one of the runtime's words ({ word }), so a legend speaks the game's language
          const label = isObj(r) && r.label !== undefined ? (isObj(r.label) && typeof r.label.word === 'string' ? W(r.label.word) : words(r.label)) : acts.join(' / ');
          return ['span', { class: 'mana-hint' }, ...acts.map((a) => ['span', { class: 'mana-key' }, glyphOf(a) || a]), ['span', null, label]];
        })];
      };
      // the legend a screen that names none gets, from what it drew: a pick, a value to change, tabs, and back where back
      // leaves something (a modal, a screen over another, a back of its own)
      const autoLegend = (n, p) => {
        const F = ctx.focus, out = [];
        if (F.some((f) => !CHANGERS.includes(f.kind))) out.push({ action: 'accept', label: p.press === 'any' ? W('start') : W('select') });
        if (F.some((f) => CHANGERS.includes(f.kind))) out.push({ actions: ['left', 'right'], label: W('change') });
        if (ctx.tabs.length) out.push({ actions: ['tabPrev', 'tabNext'], label: W('tabs') });
        if (ctx.loader && ctx.loader.tips > 1) out.push({ actions: ['left', 'right'], label: W('tips') });
        if ((p.layer === 'modal' || S.stack.length > 1 || (n.on && n.on.back)) && !(n.on && n.on.back && !effectsOf(n.on.back, {}, ctx).length)) out.push({ action: 'back', label: W('back') });
        return out;
      };

      const draw = (n, key, scope) => {
        if (n.when !== undefined && !resolve(n.when, scope, ctx)) return null;
        if (n.unless !== undefined && resolve(n.unless, scope, ctx)) return null;
        const { p, src } = propsOf(n, scope, ctx), cls = `mana-${n.use}`;
        const kids = () => n.children.map((c, i) => draw(c, `${key}.${c.id || i}`, scope));
        switch (n.use) {
          case 'screen': {
            const body = kids();
            // the legend bar: the screen's own, else what the buttons do here, read from what it drew
            const bar = live && p.legend === 'auto' && !n.children.some((c) => c.use === 'legend') ? legendOf(autoLegend(n, p)) : null;
            return ['section', { class: cls, 'data-layer': p.layer, 'data-place': p.place, 'data-press': p.press === 'any' ? 'any' : null, 'data-key': rootKey }, p.title ? ['h2', { class: 'mana-title', 'data-echo': p.title }, p.title] : null, ...body, bar];
          }
          // a window's layers, under what it holds: the plate, the thing it sits on, the crest over its edge (drawn when
          // the theme lays a window in layers; a ghost window, words over the world, has none)
          case 'window': return ['div', { class: cls, 'data-variant': p.variant }, p.variant === 'ghost' ? null : ['i', { class: 'mana-layers', 'aria-hidden': 'true' }, ['b', null]], p.title ? ['h3', { class: 'mana-heading' }, p.title] : null, ...kids()];
          case 'stack': return ['div', { class: cls, 'data-dir': p.dir, 'data-gap': p.gap, 'data-align': p.align, 'data-fill': p.fill ? 'yes' : null }, ...kids()];
          case 'split': return ['div', { class: cls, 'data-ratio': p.ratio }, ...n.children.map((c, i) => { const was = pane; pane = { split: key, i }; const t = draw(c, `${key}.${c.id || i}`, scope); pane = was; return t; })];
          case 'tab': case 'region': return ['div', { class: cls, 'data-at': n.use === 'region' ? p.at : null, 'data-variant': n.use === 'region' && p.variant !== 'plain' ? p.variant : null }, ...kids()];
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
          case 'anchors': return ['div', { class: cls, 'data-variant': p.variant === 'bare' ? 'bare' : null }, ...p.rows.map((item, i) => {
            const x = Number(readPath(item, p.x)), y = Number(readPath(item, p.y));
            if (!isFinite(x) || !isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) return null; // off screen: not drawn
            return ['div', { class: 'mana-anchor', style: `left:${pct(x)};top:${pct(y)}` }, draw(n.props.row, `${key}.${i}`, { ...scope, item })];
          })];
          case 'text': {
            const tone = TONES.includes(p.tone) && p.tone !== 'plain' ? p.tone : null;
            // a display's words carry their echo (a theme's breakout draws them again, huge and hollow, behind)
            if (p.role !== 'numeral') return ['span', { class: cls, 'data-role': p.role, 'data-tone': tone, 'data-echo': p.role === 'display' ? p.value : null }, p.value];
            const c = changeOf(key, p.value);
            return ['span', { class: cls, 'data-role': p.role, 'data-tone': tone, ...chOf(c) }, words(counting(key, p.value, c, false))];
          }
          case 'stat': { const c = changeOf(key, p.value); return ['div', { class: cls }, ['span', { class: 'mana-label' }, p.label], ['span', { class: 'mana-num', ...chOf(c) }, words(counting(key, p.value, c, p.count)), p.max !== undefined ? ['span', { class: 'mana-max' }, ` / ${p.max}`] : null, gainOf(c)]]; }
          case 'bar': {
            const r = p.max > 0 ? clamp(p.value / p.max, 0, 1) : 0, seg = Math.max(0, Math.floor(p.segments));
            // low is a warning on what can run out (health, a shield, mana, stamina), never on a stat
            const warns = ['hp', 'boss', 'shield', 'mp', 'stamina'].includes(p.variant);
            const g = p.max > 0 ? clamp(p.ghost / p.max, 0, 1) : 0;
            return ['div', { class: cls, 'data-variant': p.variant, 'data-dir': p.dir === 'rtl' ? 'rtl' : null, 'data-low': warns && r <= 0.25 ? 'yes' : null }, ['span', { class: 'mana-label' }, p.label || ''],
              ['span', { class: 'mana-track' }, ['i', { style: `width:${pct(r)}` }], g > r ? ['u', { style: `left:${pct(r)};width:${pct(g - r)}` }] : null, ...Array.from({ length: seg > 1 ? seg - 1 : 0 }, (_, k) => ['b', { style: `left:${pct((k + 1) / seg)}` }])],
              ['span', { class: 'mana-num', ...chOf(changeOf(key, p.value)) }, `${p.value}/${p.max}`]];
          }
          case 'pips': {
            const [on, offc] = PIP_SHAPES[p.shape] || PIP_SHAPES.pip, max = clamp(Math.floor(p.max), 0, 40), v = clamp(Math.round(p.value), 0, max);
            return ['div', { class: cls, 'data-shape': p.shape }, p.label ? ['span', { class: 'mana-label' }, p.label] : null, ['span', { class: 'mana-glyphs', ...chOf(changeOf(key, v)) }, on.repeat(v) + offc.repeat(max - v)]];
          }
          case 'counter': { const c = changeOf(key, p.value); return ['div', { class: cls }, p.icon ? ['span', { class: 'mana-icon', 'data-size': 's' }, initials(p.icon)] : null, ['span', { class: 'mana-label' }, p.label], ['span', { class: 'mana-num', ...chOf(c) }, words(counting(key, p.value, c, false)), p.max !== undefined ? ['span', { class: 'mana-max' }, `/${p.max}`] : null, gainOf(c)]]; }
          case 'timer': return ['div', { class: cls }, p.label ? ['span', { class: 'mana-label' }, p.label] : null, ['span', { class: 'mana-num' }, clock(p.seconds, p.format)]];
          case 'compare': {
            const d = p.to - p.from, good = p.better === 'up' ? d > 0 : d < 0;
            return ['div', { class: cls, 'data-way': d === 0 ? 'same' : good ? 'better' : 'worse' }, ['span', { class: 'mana-label' }, p.label], ['span', { class: 'mana-num' }, String(p.from)], ['span', { class: 'mana-mark' }, d === 0 ? '=' : good ? '▲' : '▼'], ['span', { class: 'mana-num' }, String(p.to)]];
          }
          case 'icon': return ['span', { class: cls, 'data-size': p.size, title: p.name }, initials(p.name)];
          case 'portrait': return ['div', { class: cls, 'data-size': p.size }, ['span', { class: 'mana-ph' }, initials(p.name)], p.name ? ['span', { class: 'mana-caption' }, p.name] : null];
          case 'loader': {
            const L = loadOf(key, p, n, scope, ctx), G = L.G, state = L.failed ? 'failed' : G.ready !== null ? 'ready' : 'loading';
            // ready is whole, whatever the game last said
            const full = state === 'ready', pctOf = full ? 100 : L.known && G.best !== null ? Math.floor((G.best / L.max) * 100) : null, filled = full || (L.known && G.best !== null);
            return ['div', { class: cls, 'data-state': state, 'data-grace': L.graceUp ? 'yes' : null, role: 'progressbar', 'aria-busy': state === 'loading' ? 'true' : 'false', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': pctOf === null ? null : String(pctOf), 'aria-valuetext': L.failed ? p.error : state === 'ready' ? W('continue') : p.step || W('loading') },
              ['div', { class: 'mana-loadline' },
                // the activity mark: it moves while the load runs, however the progress stands (drawn by the compositor, so it
                // moves even while the page is busy)
                state === 'loading' ? ['span', { class: 'mana-spin', 'aria-hidden': 'true' }] : null,
                ['span', { class: 'mana-label' }, p.step || ''],
                pctOf !== null ? ['span', { class: 'mana-num' }, `${pctOf}%`] : null],
              ['span', { class: 'mana-track', 'data-known': filled ? null : 'no' }, filled ? ['i', { style: `width:${pct(full ? 1 : G.best / L.max)}` }] : ['i', { class: 'mana-sweep' }]],
              ['div', { class: 'mana-loadsay', 'aria-live': 'polite' }, L.failed ? ['span', { class: 'mana-text', 'data-tone': 'harm' }, p.error] : L.stalled ? ['span', { class: 'mana-caption' }, W('stillLoading')] : null],
              L.tip ? ['p', { class: 'mana-tip', 'data-key': `tip${G.tip}` }, ['b', null, W('tip')], ' ', L.tip] : null];
          }
          case 'image': return ['div', { class: cls, 'data-ratio': p.ratio }, ['span', { class: 'mana-caption' }, p.label || 'image']];
          case 'badge': { const c = changeOf(key, p.value); return ['span', { class: cls, 'data-variant': p.variant === 'plain' ? null : p.variant, 'data-turn': turnOf(p.turn, p.side), ...chOf(c) }, chip(p.side), p.value, gainOf(c)]; }
          case 'table': {
            const cols = p.columns.map((c) => (isObj(c) ? { key: words(c.key), label: words(c.label ?? c.key), align: ['left', 'right', 'center'].includes(c.align) ? c.align : null } : { key: words(c), label: words(c), align: null }));
            const fresh = freshOf(key, p.rows), rk = (r, i) => (isObj(r) && r.id !== undefined && r.id !== null ? `#${r.id}` : i);
            return ['table', { class: cls }, ['thead', null, ['tr', null, ...cols.map((c) => ['th', { 'data-align': c.align }, c.label])]],
              ['tbody', null, ...p.rows.map((r, i) => ['tr', { 'data-mark': isObj(r) && r[p.mark] ? 'yes' : null, ...rowMarks(fresh, r) }, ...cols.map((c, ci) => {
                const x = isObj(r) ? readPath(r, c.key) : r;
                return ['td', { 'data-align': c.align, 'data-lead': isObj(r) && r.lead !== undefined && r.lead !== null && words(r.lead) === c.key ? 'yes' : null, ...(numOf(x) !== null ? chOf(changeOf(`${key}.${rk(r, i)}.${c.key}`, x)) : {}) }, ci === 0 && isObj(r) ? chip(r.side) : null, words(x)];
              })])]];
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
          case 'legend': return legendOf(p.rows);
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
          case 'feed': {
            // a line said again in a row merges into one (×3), so a stream of pickups does not push everything else off
            const merged = [];
            for (const r of p.rows) { const t = words(isObj(r) ? readPath(r, p.field) : r); const top = merged[merged.length - 1]; if (top && top.t === t) top.n += 1; else merged.push({ t, n: 1 }); }
            return ['div', { class: cls }, ...merged.slice(-Math.max(1, Math.floor(p.max))).map((m) => ['div', { class: 'mana-line' }, m.t, m.n > 1 ? ['b', { class: 'mana-times' }, ` ×${m.n}`] : null])];
          }
          case 'toast': return ['div', { class: cls }, p.value];
          case 'banner': return ['div', { class: cls }, ['span', { class: 'mana-text', 'data-role': 'display' }, p.value], p.sub ? ['span', { class: 'mana-text', 'data-role': 'label' }, p.sub] : null];
          case 'moments': {
            const m = momentOf(key, p);
            const tier = m && m.rare ? 'rare' : null, icon = m && m.icon ? ['span', { class: 'mana-icon', 'data-size': 'l' }, initials(m.icon)] : null;
            const body = !m ? null : p.as === 'toast' ? ['div', { class: 'mana-toast', 'data-key': m.key, 'data-weight': m.w, 'data-tier': tier }, icon, ['span', { class: 'mana-words' }, chip(m.side), m.text, m.sub ? ['span', { class: 'mana-caption' }, ` ${m.sub}`] : null]]
              : ['div', { class: 'mana-banner', 'data-key': m.key, 'data-weight': m.w, 'data-tier': tier }, ['span', { class: 'mana-text', 'data-role': 'display' }, chip(m.side), m.text], m.sub ? ['span', { class: 'mana-text', 'data-role': 'label' }, m.sub] : null];
            return ['div', { class: cls, 'data-as': p.as }, body];
          }
          case 'awareness': return ['span', { class: cls, 'data-state': p.state }, ['b', null, AWARENESS[p.state]], p.label ? ` ${p.state}` : null];
          case 'statuses': return ['span', { class: cls }, ...p.rows.map((r) => { const name = words(isObj(r) ? r.name : r), turns = isObj(r) && r.turns !== undefined ? r.turns : null; return ['span', { class: 'mana-status', title: name }, name.slice(0, 4).toUpperCase(), turns !== null ? ['sub', null, String(turns)] : null]; })];

          case 'list': {
            register(n, key, n.props.rows, scope);
            if (!p.rows.length) return ['div', { class: cls, 'data-empty': 'yes' }, ['span', { class: 'mana-text', 'data-role': 'caption' }, p.empty || W('nothingHere')]];
            // on a touch screen a long list scrolls under the finger: every row is drawn
            const total = p.rows.length, sel = clamp(U.sel[key] || 0, 0, total - 1), v = S.input === 'touch' ? 0 : Math.floor(p.visible), fresh = freshOf(key, p.rows);
            let from = 0, to = total;
            if (v > 0 && v < total) { let t = clamp(U.top[key] || 0, 0, total - v); if (sel < t) t = sel; if (sel >= t + v) t = sel - v + 1; U.top[key] = t; from = t; to = t + v; }
            const rows = [];
            if (from > 0) rows.push(['div', { class: 'mana-more' }, `▲ ${W('more', { n: from })}`]);
            for (let i = from; i < to; i++) {
              const item = p.rows[i], sc = { ...scope, item }, off = isObj(item) && !!item.disabled;
              const fi = focusable({ kind: 'row', n, key, i, total, win: v > 0 && v < total, scope: sc, off });
              const body = n.props.row ? draw(n.props.row, `${key}.${i}`, sc) : ['span', { class: 'mana-text' }, isObj(item) ? words(item.label ?? item.name ?? item.id) : words(item)];
              rows.push(['div', { class: 'mana-row', ...mark(fi, (i === sel && touched(key)) || (isObj(item) && item.active) ? 'active' : 'shown', off), ...rowMarks(fresh, item) }, isObj(item) ? chip(item.side) : null, body]);
            }
            if (to < total) rows.push(['div', { class: 'mana-more' }, `▼ ${W('more', { n: total - to })}`]);
            return ['div', { class: cls, 'data-variant': p.variant === 'menu' ? 'menu' : null }, ...rows];
          }
          case 'grid': {
            register(n, key, n.props.cells, scope);
            if (!p.cells.length) return ['div', { class: cls, 'data-empty': 'yes' }, ['span', { class: 'mana-text', 'data-role': 'caption' }, p.empty || W('nothingHere')]];
            const cols = clamp(Math.floor(p.columns) || 1, 1, 16), sel = clamp(U.sel[key] || 0, 0, p.cells.length - 1), fresh = freshOf(key, p.cells);
            return ['div', { class: cls, style: `--cols:${cols}` }, ...p.cells.map((item, i) => {
              const sc = { ...scope, item }, off = isObj(item) && !!item.disabled;
              const fi = focusable({ kind: 'cell', n, key, i, g: { key, r: Math.floor(i / cols), c: i % cols }, scope: sc, off });
              const body = n.props.cell ? draw(n.props.cell, `${key}.${i}`, sc) : ['span', { class: 'mana-text' }, isObj(item) ? words(item.label ?? item.name ?? item.id) : words(item)];
              return ['div', { class: 'mana-cell', ...mark(fi, (i === sel && touched(key)) || (isObj(item) && item.active) ? 'active' : 'shown', off), ...rowMarks(fresh, item) }, isObj(item) ? chip(item.side) : null, body];
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
              const nk = `${key}.${isObj(item) && item.id !== undefined ? `#${item.id}` : i}:state`;
              columns[c].push(['div', { class: 'mana-node', 'data-state': state, ...mark(fi, (i === sel && touched(key)) || (isObj(item) && item.active) ? 'active' : 'shown', off), ...chOf(changeOf(nk, state)) }, body, req.length ? ['span', { class: 'mana-req' }, `← ${req.join(', ')}`] : null]);
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
          case 'language': {
            const codes = codesOf();
            if (codes.length < 2) return null;
            const fi = focusable({ kind: 'language', n, key, scope });
            return ['div', { class: 'mana-cycler mana-language', ...mark(fi, 'shown') }, ['span', { class: 'mana-label' }, p.label || W('language')], ['span', { class: 'mana-value' }, ['span', { class: 'mana-step', 'data-way': 'back' }, '◀'], ['span', { class: 'mana-now', lang: S.language }, nameOf(S.language)], ['span', { class: 'mana-step', 'data-way': 'on' }, '▶']]];
          }
          case 'field': return input(p.kind, n, key, scope, p, src);
          case 'allocator': {
            const draft = U.vals[key] || {}, spent = Object.values(draft).reduce((a, b) => a + b, 0), left = Math.max(0, Math.floor(p.points) - spent);
            const rows = p.rows.filter(isObj).map((r) => {
              const id = words(r.id), base = Number(r.value) || 0, add = draft[id] || 0;
              const fi = focusable({ kind: 'alloc-row', n, key, id, base, max: r.max === undefined ? Infinity : Number(r.max), points: Math.floor(p.points), scope });
              return ['div', { class: 'mana-alloc', ...mark(fi, add ? 'active' : 'shown') }, ['span', { class: 'mana-label' }, words(r.label ?? id)], ['span', { class: 'mana-num' }, String(base)], ['span', { class: 'mana-mark' }, add ? '→' : ''], ['span', { class: 'mana-num' }, add ? String(base + add) : ''], ['span', { class: 'mana-mark' }, '◀ ▶']];
            });
            const conf = focusable({ kind: 'alloc-confirm', n, key, scope, off: spent === 0 }), reset = focusable({ kind: 'alloc-reset', n, key, scope, off: spent === 0 });
            return ['div', { class: cls }, ['div', { class: 'mana-stat' }, ['span', { class: 'mana-label' }, W('points')], ['span', { class: 'mana-num' }, `${left} / ${Math.floor(p.points)}`]], ...rows,
              ['div', { class: 'mana-stack', 'data-dir': 'row', 'data-gap': 'normal' }, ['div', { class: 'mana-button', ...mark(conf, 'shown', spent === 0) }, W('confirm')], ['div', { class: 'mana-button', ...mark(reset, 'shown', spent === 0) }, W('reset')]]];
          }
          case 'textentry': {
            const draft = key in U.vals ? U.vals[key] : words(p.value).slice(0, p.max), chars = [...CHARSETS[p.charset]], cols = 10;
            const cells = chars.map((ch, i) => { const fi = focusable({ kind: 'char', n, key, ch, max: Math.floor(p.max), draft, g: { key, r: Math.floor(i / cols), c: i % cols }, scope }); return ['span', { class: 'mana-cell', ...mark(fi, 'shown') }, ch === ' ' ? '␣' : ch]; });
            const row = Math.ceil(chars.length / cols);
            const del = focusable({ kind: 'char-del', n, key, draft, g: { key, r: row, c: 0 }, scope }), done = focusable({ kind: 'char-done', n, key, draft, src: src.value, g: { key, r: row, c: 1 }, scope });
            return ['div', { class: cls }, p.label ? ['span', { class: 'mana-label' }, p.label] : null, ['div', { class: 'mana-draft' }, draft, ['span', { class: 'mana-caret' }, draft.length < p.max ? '_' : '']],
              ['div', { class: 'mana-grid', style: `--cols:${cols}` }, ...cells], ['div', { class: 'mana-stack', 'data-dir': 'row', 'data-gap': 'normal' }, ['div', { class: 'mana-button', ...mark(del, 'shown') }, W('delete')], ['div', { class: 'mana-button', ...mark(done, 'shown') }, W('done')]]];
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
        if (kind === 'toggle') shown = [['span', { class: 'mana-switch' }, ['i', null]], ['span', { class: 'mana-caption' }, now ? W('on') : W('off')]];
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
      if (top() !== id) {
        S.stack.push(id);
        S.nav = null;
        if (!S.booting) { S.tx += 1; S.txWay = 'in'; }
        // a screen opened shows what is there now; only what changes while it is up is news
        const mine = (k) => k === id || k.startsWith(`${id}.`);
        for (const k of [...S.seen.keys()]) if (mine(k) || mine(k.split(':')[0])) S.seen.delete(k);
        for (const k of [...S.lists.keys()]) if (mine(k)) S.lists.delete(k);
        for (const k of [...S.counts.keys()]) if (mine(k)) S.counts.delete(k);
        for (const k of [...S.loads.keys()]) if (mine(k)) S.loads.delete(k);
        S.guard = -Infinity;
      }
      uiOf(id);
      const was = S.stack.length;
      render();
      // heard as it lands: the frame, and the rows it fills with (a page ripples a soft tick down them on its stagger)
      if (top() === id && was) cue('open', 0, { rows: Math.min(8, last.focus.filter((f) => f.kind === 'row' || f.kind === 'cell' || f.kind === 'node').length) });
    }
    function close() {
      if (S.stack.length) { cue('close'); S.tx += 1; S.txWay = 'out'; }
      S.stack.length = 0;
      if (H.act) H.act({ emit: 'mana:closed' }, { screen: null, key: null, verb: 'close', seat: 0 });
      render();
    }
    function back() {
      if (S.stack.length) { cue('back'); S.tx += 1; S.txWay = 'out'; }
      const id = S.stack.pop();
      if (!S.stack.length && H.act) H.act({ emit: 'mana:closed' }, { screen: id, key: id, verb: 'back', seat: 0 });
      render();
    }
    const scopeOf = (f, seat, extra) => ({ ...(f ? f.scope : {}), seat, ...extra });
    // the focus set: a list, grid, tree remembers the row it is on (what a detail reads)
    function setAt(seat, k) {
      const U = uiOf(top());
      if (S.pressed && U.at[seat] !== k) S.pressed = null;
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
      if (!vert) { if (CHANGERS.includes(f.kind)) change(f, d, seat); else crossPane(seat, f, d); return; }
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
      // the game's language turned: every word is said again in it, and the game is told (to keep it)
      if (f.kind === 'language') {
        const codes = codesOf(), i = codes.indexOf(S.language), next = codes[((i < 0 ? 0 : i + d) % codes.length + codes.length) % codes.length];
        cue('change', seat, { step: d });
        language(next);
        if (H.act) H.act({ emit: 'language', to: next }, from(f, 'change', seat));
        return;
      }
      if (f.kind === 'alloc-row') {
        const draft = { ...(U.vals[f.key] || {}) }, spent = Object.values(draft).reduce((a, b) => a + b, 0), now = draft[f.id] || 0, next = now + d;
        if (next < 0 || (d > 0 && spent >= f.points) || f.base + next > f.max) return;
        draft[f.id] = next;
        if (!next) delete draft[f.id];
        cue('change', seat, { step: d });
        U.vals[f.key] = draft;
        if (f.n.on.change) run(effectsOf(f.n.on.change, scopeOf(f, seat, { input: draft }), last), f, 'change', seat);
        return;
      }
      let v;
      if (f.kind === 'toggle') v = !f.value;
      else if (f.kind === 'slider') { const st = f.step > 0 ? f.step : 1, hi = f.max > f.min ? f.max : f.min + 1; v = clamp(Math.round(((Number(f.value) || 0) + d * st) / st) * st, f.min, hi); v = Math.round(v * 1e6) / 1e6; }
      else if (f.kind === 'carousel') { const n = f.items.length; if (!n) return; const i = ((f.i + d) % n + n) % n, it = f.items[i]; v = isObj(it) && it.id !== undefined ? it.id : i; if (!f.src) { U.vals[f.key] = i; U.sel[f.key] = i; } }
      else { const o = listOf(f.options), i = o.findIndex((x) => words(x) === words(f.value)); if (!o.length) return; v = o[((i < 0 ? 0 : i + d) % o.length + o.length) % o.length]; }
      commit(f, v, seat, d);
    }
    // a value an input now holds: set on the host when bound (the game's), else the screen's own
    function commit(f, v, seat, step = 1) {
      const U = uiOf(top());
      cue('change', seat, { step });
      if (f.src) { if (H.act) H.act({ set: f.src, to: f.kind === 'toggle' ? (v ? 1 : 0) : v }, from(f, 'change', seat)); }
      else if (f.kind !== 'carousel') U.vals[f.key] = v;
      if (f.n.on.change) run(effectsOf(f.n.on.change, scopeOf(f, seat, { input: v }), last), f, 'change', seat);
    }
    function accept(f, seat) {
      const U = uiOf(top()), on = f.n.on;
      // the press is seen on what was pressed, before anything it opens or closes is drawn (the view keeps it on a screen
      // that leaves)
      if (f.kind !== 'slider') S.pressed = { n: (S.pressed ? S.pressed.n : 0) + 1, screen: top(), k: last.focus.indexOf(f), verb: f.off ? 'deny' : 'accept' };
      if (f.off) { cue('deny', seat); return; }
      if (!['toggle', 'cycler', 'slider'].includes(f.kind)) cue('accept', seat);
      switch (f.kind) {
        case 'toggle': case 'cycler': case 'language': return change(f, 1, seat);
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
      // a screen still counting (a results board): accept lands every number at once, and does nothing else
      if (action === 'accept' && countingOn(top())) { const mine = mineOf(top()); for (const [k, K] of S.counts) if (mine(k)) K.done = true; cue('skip', seat); render(); return true; }
      // a press in the first moment after a load went ready was made before the player could see it: not an answer
      if (action === 'accept' && H.now && Number(H.now()) < S.guard) return true;
      // press start: a face or a shoulder button is accept on a screen that waits for any
      if (screens[top()].props.press === 'any' && ANY.includes(action)) { if (f) accept(f, seat); render(); return true; }
      // a load's tips turn with left and right where the cursor has nothing to turn
      if ((action === 'left' || action === 'right') && last.loader && last.loader.tips > 1 && (!f || f.kind === 'button')) {
        const G = S.loads.get(last.loader.key), d = action === 'right' ? 1 : -1;
        if (G) { G.tip = (G.tip + d + last.loader.tips) % last.loader.tips; G.turned = H.now ? Number(H.now()) : 0; cue('change', seat, { step: d }); render(); return true; }
      }
      if (action === 'up' || action === 'down' || action === 'left' || action === 'right') {
        // the cursor moved (or a long list scrolled under it): its tick; a value turned says so itself
        const was = `${U.at[seat] || 0}|${JSON.stringify(U.sel)}`;
        move(seat, action);
        // the way the cursor went: the item it lands on snaps in from that side (the root's data-nav)
        if (`${U.at[seat] || 0}|${JSON.stringify(U.sel)}` !== was) { S.nav = action; cue('move', seat, { way: action }); }
      }
      else if (action === 'tabNext' || action === 'tabPrev') { const Tb = last.tabs[0]; if (Tb && Tb.n) { U.tabs[Tb.key] = ((U.tabs[Tb.key] || 0) + (action === 'tabNext' ? 1 : -1) + Tb.n) % Tb.n; cue('tab', seat); } }
      else if (action === 'accept') { if (f) accept(f, seat); }
      else if (action === 'back') {
        const on = screens[top()].on.back;
        if (!on) back();
        // a back that names nothing to do (a load with no way out) does nothing, and says nothing
        else { const eff = effectsOf(on, { seat }, last); if (eff.length && !eff.some((e) => e.back === true || e.close === true)) cue('back', seat); run(eff, null, 'back', seat); }
      }
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
      } else if (['cycler', 'carousel', 'alloc-row', 'language'].includes(f.kind) && (rx < 0.34 || rx > 0.66)) change(f, rx < 0.34 ? -1 : 1, seat);
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
      // a moment's time is up, or one waiting may now take the screen (on the game's clock)
      if (H.now && S.moments.size) { const t = Number(H.now()); for (const M of S.moments.values()) if (M.drawn === S.renders && t >= M.due) { render(); return true; } }
      // a load's tip turns, its still-loading line shows, its grace ends or it goes on by itself (on the game's clock)
      if (H.now && S.loads.size) { const t = Number(H.now()); for (const G of S.loads.values()) if (G.drawn === S.renders && t >= G.due) { render(); return true; } }
      // a number still counting is drawn again each frame until it lands
      if (COUNT && [...S.counts.values()].some((K) => !K.done)) { render(); return true; }
      return false;
    }
    function hold(on) { const x = !!on; if (S.held !== x) { S.held = x; render(); } }
    function reduceMotion(on) { const x = !!on; if (S.calm !== x) { S.calm = x; render(); } }
    function reduceFlash(on) { const x = !!on; if (S.dim !== x) { S.dim = x; render(); } }
    // the game's language, changed (a player's option): every word the screen says is said again in it
    function language(code) {
      if (code !== 'en' && !languages[code]) throw new Error(`language '${code}' is one of the game's languages: ${['en', ...Object.keys(languages).filter((c) => c !== 'en')].join(', ')}`);
      if (S.language !== code) { S.language = code; render(); }
    }
    function textScale(k) {
      const x = Number(k);
      if (!TEXT_SCALES.includes(x)) throw new Error(`textScale: the player's text size is one of ${TEXT_SCALES.join(', ')} (× the theme's)`);
      if (S.text !== x) { S.text = x; render(); }
    }
    function subtitlePlate(a) {
      const x = a === null ? null : Number(a);
      if (x !== null && !(x >= 0 && x <= 1)) throw new Error('subtitlePlate: the plate behind the subtitles is an opacity from 0 to 1 (null: the theme\'s)');
      const r = x === null ? null : Math.round(x * 100) / 100;
      if (S.plate !== r) { S.plate = r; render(); }
    }
    if (start) open(start); else render();
    S.booting = false;
    return {
      open, close, press, focusAt, tab, tick, point, hudTap, input, glyphs, hold, reduceMotion, reduceFlash, textScale, subtitlePlate, language,
      languages: () => codesOf(),
      view: () => toHtml((last || render()).tree),
      tree: () => (last || render()).tree,
      state: () => {
        const id = top(), U = id ? uiOf(id) : null;
        return { input: S.input, layout: S.layout, held: S.held, reducedMotion: S.calm, reducedFlash: S.dim, language: S.language, pressed: S.pressed ? { ...S.pressed } : null, textScale: S.text, subtitlePlate: S.plate, stack: S.stack.slice(), screen: id, focus: U ? U.at[0] || 0 : -1, seats: U ? Object.fromEntries(Object.entries(U.at)) : {}, focusables: last ? last.focus.length : 0, kind: U && last && last.focus[U.at[0] || 0] ? last.focus[U.at[0] || 0].kind : null };
      },
    };
  }

  // ── the DOM backend: a view, never a controller ─────────────────────────────────────────────────────────────────────
  // It draws, holds the page while a screen is up (window.__mojMenuOpen: the page's input owner sends the menu its
  // intents instead of play), and hit-tests its own widgets under a pointer: a tap on a row, a drag along a slider, a
  // swipe across a carousel or the tabs (only the view knows where they are). The keys, the pads, a headset, the virtual
  // pad and who is which seat are the controls layer's (controls/: the schemes, their drivers, the seats kernel), which
  // hands this runtime intents (rt.press(action, seat)), the device in hand (rt.input) and the glyphs (rt.glyphs):
  // controls/mana-host.js connects the two.
  // a swipe or a tap from a pointer's travel and time, when the host hands none (controls/swipe.js swipeOf is the truth)
  const SWIPE_OF = (dx, dy, ms) => { const m = Math.hypot(dx, dy); if (m < 12) return ms <= 600 ? 'tap' : null; if (m < 24 || ms > 600) return null; return Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'); };
  function mount(el, rt, opts) {
    const o = opts || {}, swipe = typeof o.swipe === 'function' ? o.swipe : SWIPE_OF, clock = () => (typeof performance !== 'undefined' ? performance.now() : 0);
    let html = '';
    const hold = () => { if (typeof window !== 'undefined') window.__mojMenuOpen = !!rt.state().screen; };
    // the tree patched onto what is drawn, by position: an element lives on while its tag and its data-key hold (a
    // transition runs, an entrance plays once, a mark added starts its animation); a new data-key is a new element
    const doc = el.ownerDocument || document;
    const has = (x) => x !== null && x !== undefined && x !== false, live = (x) => has(x) && x !== '';   // as toHtml: an empty word draws no text
    const keyOf = (t) => (t[1] && has(t[1]['data-key']) ? String(t[1]['data-key']) : null);
    const make = (t) => {
      if (!Array.isArray(t)) return doc.createTextNode(words(t));
      const e = doc.createElement(t[0]), a = t[1] || {};
      for (const k in a) if (has(a[k])) e.setAttribute(k, String(a[k]));
      for (const c of t.slice(2)) if (live(c)) e.appendChild(make(c));
      return e;
    };
    // LEAVING: a screen, a toast or a banner that goes is kept where it was (data-leaving: the patch steps over it) until
    // its exit has played (its own animation's end, or a ceiling), so what leaves is seen to leave
    const LEAVERS = '.mana-screen,.mana-toast,.mana-banner';
    const leaving = (n) => n.nodeType === 1 && n.hasAttribute('data-leaving');
    const leaves = (n) => n && n.nodeType === 1 && !!n.matches && n.matches(LEAVERS);
    const leave = (n) => {
      const box = { left: n.offsetLeft, top: n.offsetTop, width: n.offsetWidth };
      n.setAttribute('data-leaving', 'yes');
      if (!n.classList.contains('mana-screen')) n.style.cssText += `;position:absolute;left:${box.left}px;top:${box.top}px;width:${box.width}px;margin:0`;
      let gone = false;
      const done = () => { if (!gone) { gone = true; if (n.parentNode) n.parentNode.removeChild(n); } };
      n.addEventListener('animationend', (ev) => { if (ev.target === n) done(); });
      setTimeout(done, 900);
    };
    const here = (parent) => [...parent.childNodes].filter((n) => !leaving(n));
    const patch = (parent, kids) => {
      const want = kids.filter(live);
      want.forEach((t, i) => {
        const node = here(parent)[i];
        if (!Array.isArray(t)) {
          const txt = words(t);
          if (node && node.nodeType === 3) { if (node.nodeValue !== txt) node.nodeValue = txt; } else if (node) parent.replaceChild(doc.createTextNode(txt), node); else parent.appendChild(doc.createTextNode(txt));
          return;
        }
        if (!node || node.nodeType !== 1 || node.tagName.toLowerCase() !== t[0] || node.getAttribute('data-key') !== keyOf(t)) {
          const e = make(t);
          if (!node) parent.appendChild(e);
          else if (leaves(node)) { parent.insertBefore(e, node); leave(node); } else parent.replaceChild(e, node);
          return;
        }
        const a = t[1] || {};
        for (const at of [...node.attributes]) if (!has(a[at.name])) node.removeAttribute(at.name);
        for (const k in a) if (has(a[k]) && node.getAttribute(k) !== String(a[k])) node.setAttribute(k, String(a[k]));
        patch(node, t.slice(2));
      });
      for (let cur = here(parent); cur.length > want.length; cur = here(parent)) { const n = cur[cur.length - 1]; if (leaves(n)) leave(n); else parent.removeChild(n); }
    };
    // SHUFFLES: a row with an identity (data-id) is glided from where it was drawn to where it is now, on the theme's
    // glide and curve (none under the greybox or less motion); the patch moves its content, this moves its place
    const seconds = (x) => { const m = /^\s*([\d.]+)(ms|s)\s*$/.exec(x || ''); return m ? Number(m[1]) * (m[2] === 'ms' ? 1 : 1000) : 0; };
    const places = () => { const out = new Map(); if (el.querySelectorAll) for (const n of el.querySelectorAll('[data-id]')) { if (leaving(n)) continue; const P = out.get(n.parentNode) || new Map(); P.set(n.getAttribute('data-id'), n.getBoundingClientRect()); out.set(n.parentNode, P); } return out; };
    const glide = (before) => {
      const root = el.querySelector && el.querySelector('.mana-root');
      if (!root || typeof getComputedStyle !== 'function') return;
      const cs = getComputedStyle(root), ms = seconds(cs.getPropertyValue('--mana-glide')), ease = cs.getPropertyValue('--mana-ease').trim() || 'ease-out';
      if (!ms) return;
      for (const n of el.querySelectorAll('[data-id]')) {
        const P = before.get(n.parentNode), was = P && P.get(n.getAttribute('data-id'));
        if (!was || typeof n.animate !== 'function') continue;
        const now = n.getBoundingClientRect(), k = n.offsetWidth ? now.width / n.offsetWidth : 1, dx = (was.left - now.left) / (k || 1), dy = (was.top - now.top) / (k || 1);
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) n.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }], { duration: ms, easing: ease });
      }
    };
    // a press whose screen is about to be replaced (a confirm that opens or closes) is marked on the screen still drawn,
    // so the screen that leaves carries it out
    let seenPress = 0;
    const pressMark = () => {
      const P = rt.state().pressed;
      if (!P || P.n === seenPress) return;
      seenPress = P.n;
      const scr = el.querySelector && [...el.querySelectorAll('.mana-screen')].find((n) => !leaving(n) && n.getAttribute('data-key') === P.screen);
      const item = scr && scr.querySelector(`[data-k="${P.k}"]`);
      if (item) item.setAttribute('data-press', `${P.verb}-${P.n % 2 ? 'a' : 'b'}`);
    };
    const paint = () => { const h = rt.view(); if (h !== html) { html = h; pressMark(); const before = places(); patch(el, [rt.tree()]); glide(before); } hold(); };
    const near = (ev, sel) => (ev.target && ev.target.closest ? ev.target.closest(sel) : null);
    // where across its target a pointer is, on the rect taken when the press began (a repaint replaces the element)
    const across = (r, ev) => (r && r.width ? (ev.clientX - r.left) / r.width : 0.5);
    let down = null;
    el.addEventListener('pointerdown', (ev) => {
      const t = near(ev, '[data-k],[data-tab],[data-tap]');
      if (!t) return;   // not a widget of this view (a drawn pad's buttons are the touch driver's)
      rt.input(ev.pointerType === 'mouse' ? 'mouse' : 'touch');
      const ds = { k: t.dataset.k, tab: t.dataset.tab, tap: t.dataset.tap }, cl = t.classList;
      const slide = !!(cl && cl.contains('mana-slider')), track = slide && t.querySelector ? t.querySelector('.mana-track') : null;
      // a slider is measured on its track (a finger on the bar means that point of the bar), anything else on itself; the
      // rect is taken now (what is under the finger may be redrawn)
      down = { x: ev.clientX, y: ev.clientY, at: clock(), t: ds, rect: (track || t).getBoundingClientRect(), slide, car: !!(cl && cl.contains('mana-carousel')) };
      if (down.slide) { rt.point(Number(ds.k), across(down.rect, ev)); paint(); }
    });
    el.addEventListener('pointermove', (ev) => { if (down && down.slide) { rt.point(Number(down.t.k), across(down.rect, ev)); paint(); } });
    el.addEventListener('pointerup', (ev) => {
      const d = down; down = null;
      if (!d || d.slide) return;
      const g = swipe(ev.clientX - d.x, ev.clientY - d.y, clock() - d.at);
      if (g === 'left' || g === 'right') { if (d.car) rt.point(Number(d.t.k), g === 'left' ? 1 : 0); else if (rt.state().screen) rt.press(g === 'left' ? 'tabNext' : 'tabPrev'); }
      else if (g === 'tap') {
        if (d.t.tab) { const [a, b] = d.t.tab.split(':').map(Number); rt.tab(a, b); }
        else if (d.t.tap !== undefined) rt.hudTap(Number(d.t.tap));
        else rt.point(Number(d.t.k), across(d.rect, ev));
      }
      paint();
    });
    el.addEventListener('pointercancel', () => { down = null; });
    // a frame: a value the screen read changed, or the game opened or closed a screen itself
    if (o.auto && typeof requestAnimationFrame === 'function') { let up = rt.state().screen; const loop = () => { const now = rt.state().screen; if (rt.tick() || now !== up) { up = now; paint(); } requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
    paint();
    return { paint };
  }

  return { WORDS, COMPONENTS, COMPONENT_IDS, ROLES, REGIONS, AWARENESS, MARKERS, PIP_SHAPES, ACTIONS, INPUTS, readNode, readSpec, runtime, toHtml, readPath, mount };
}

export const manaUi = buildManaUi();
/** The kernel as page source: an expression a page assigns (`const manaUi = ${manaUiSource()};`). */
export const manaUiSource = () => `(${buildManaUi.toString()})()`;

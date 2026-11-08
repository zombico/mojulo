/**
 * THE FRONT AND THE MENUS — the screens around play every game shares: the attract screen and the title, loading, mode,
 * character and arena select, pause, options, controls, a confirm, results and save slots. Each is a def (data) over
 * the components; its `example` binds into the sample state (samples.js). A row's `then` is its effect: the game says
 * what a pick does, the idiom only where it sits.
 */
const P = (name) => ({ param: name });
const I = (field) => ({ item: field });
const txt = (value, role) => ({ use: 'text', props: { value, ...(role ? { role } : {}) } });
const screen = (props, children, extra = {}) => ({ use: 'screen', props, children, ...extra });
const thenList = (rows, more = {}) => ({ use: 'list', props: { rows, ...more }, on: { accept: I('then') } });
const back = { use: 'button', props: { label: { word: 'back' } }, on: { accept: { back: true } } };
// what the buttons do here, printed in the glyphs of the controls in hand (the runtime's glyphs)
// (each label one of the runtime's words, so the legend is translated)
const LEGEND_WORD = { pick: 'select', back: 'back', resume: 'resume', rebind: 'rebind', change: 'change', tabs: 'tabs' };
const legend = (...rows) => ({ use: 'legend', props: { rows: rows.map(([action, label]) => { const w = { word: LEGEND_WORD[label] || label }; return Array.isArray(action) ? { actions: action, label: w } : { action, label: w }; }) } });

export const FRONT_IDIOMS = {
  'attract-screen': {
    kind: 'screen', about: 'before the title: the key art, the game\'s name and a press-start that breathes while it waits; any face or shoulder button starts, the seat that pressed in the effect (the player who binds)',
    reads: 'title, prompt; then: what pressing does', emits: 'then (usually { open: <the title screen> }, its seat the one that pressed)',
    params: ['title', 'prompt', 'then'],
    node: screen({ layer: 'overlay', place: 'center', press: 'any' }, [
      { use: 'image', props: { label: { word: 'keyArt' }, ratio: 'backdrop' } },
      { use: 'stack', props: { align: 'center', gap: 'loose' }, children: [
        txt(P('title'), 'display'),
        { use: 'button', props: { label: P('prompt') }, on: { accept: P('then') } },
      ] },
    ]),
    example: { title: { bind: 'game.title' }, prompt: 'Press start', then: { emit: 'start', seat: { seat: true } } },
  },
  'title-screen': {
    kind: 'screen', about: 'the title: the key art behind, the name and its line over the main menu in the left third (continue, new, load, options, quit), the build\'s version in the corner',
    reads: 'title, subtitle, items: [{ label, then, disabled? }], version', emits: 'each item\'s then',
    params: ['title', 'subtitle', 'items', 'version'],
    node: screen({ layer: 'overlay', place: 'left' }, [
      { use: 'image', props: { label: { word: 'keyArt' }, ratio: 'backdrop' } },
      { use: 'stack', props: { gap: 'loose', align: 'start' }, children: [
        { use: 'stack', props: { gap: 'tight', align: 'start' }, children: [txt(P('title'), 'display'), txt(P('subtitle'), 'label')] },
        { use: 'window', props: { variant: 'ghost' }, children: [thenList(P('items'), { variant: 'menu' })] },
      ] },
      { use: 'region', props: { at: 'bottom-left' }, children: [{ use: 'window', props: { variant: 'ghost' }, children: [txt(P('version'), 'caption')] }] },
    ]),
    example: { title: { bind: 'game.title' }, subtitle: { bind: 'game.subtitle' }, version: { bind: 'game.version' }, items: [{ label: 'Continue', then: { emit: 'continue' } }, { label: 'New game', then: { emit: 'new-game' } }, { label: 'Load', then: { open: 'load' } }, { label: 'Options', then: { open: 'options' } }, { label: 'Quit', then: { emit: 'quit' } }] },
  },
  'loading-screen': {
    kind: 'screen', waits: 'ready', about: 'loading: where you are going, the progress, a tip, and a continue once ready (nothing to press before)',
    reads: 'place, progress (0..100), tip, ready', emits: 'then once ready and pressed',
    params: ['place', 'progress', 'tip', 'ready', 'then'],
    node: screen({ layer: 'overlay', place: 'full' }, [{ use: 'stack', props: { gap: 'loose' }, children: [
      { use: 'image', props: { label: { word: 'keyArtPlace' }, ratio: 'banner' } },
      { use: 'stack', props: { gap: 'tight' }, children: [txt({ word: 'loading' }, 'heading'), txt(P('place'), 'title')] },
      { use: 'bar', props: { value: P('progress'), max: 100, label: { word: 'progress' } } },
      { use: 'stack', props: { dir: 'row', gap: 'normal' }, children: [txt({ word: 'tip' }, 'heading'), txt(P('tip'))] },
      { use: 'button', props: { label: { word: 'continue' } }, when: P('ready'), on: { accept: P('then') } },
      { use: 'text', props: { value: { word: 'gettingReady' }, role: 'caption' }, unless: P('ready') },
    ] }]),
    example: { place: { bind: 'load.place' }, progress: { bind: 'load.progress' }, tip: { bind: 'load.tip' }, ready: { bind: 'load.ready' }, then: { emit: 'enter' } },
  },
  'mode-select': {
    kind: 'screen', about: 'pick a way to play: the modes beside the one in focus (its art, words and players)',
    reads: 'modes: [{ id, name, about, players, then, disabled? }]', emits: 'the picked mode\'s then',
    params: ['title', 'modes'],
    node: screen({ title: P('title'), place: 'full' }, [{ use: 'split', children: [
      { use: 'window', props: { title: { word: 'modes' } }, children: [{ use: 'list', id: 'modes', props: { rows: P('modes'), row: { use: 'stack', props: { dir: 'row', align: 'apart' }, children: [txt(I('name'), 'heading'), { use: 'badge', props: { value: I('players') } }] } }, on: { accept: I('then') } }] },
      { use: 'window', children: [{ use: 'stack', children: [{ use: 'image', props: { label: { pick: 'modes.name' } } }, txt({ pick: 'modes.name' }, 'title'), txt({ pick: 'modes.about' }), { use: 'stat', props: { label: { word: 'players' }, value: { pick: 'modes.players' } } }] }] },
    ] }, back]),
    example: { title: 'Play', modes: { bind: 'modes' } },
  },
  'character-select': {
    kind: 'screen', about: 'pick a fighter: the roster as a grid, each couch seat with its own cursor (P1, P2…) and its own panel showing the fighter it is on',
    reads: 'roster: [{ id, name, role, stats: [{ label, value, max }] }], seats, players: [{ seat, label }] (a panel each)', emits: '{ emit: pick, seat, id } as a seat accepts',
    params: ['title', 'roster', 'seats', 'players'],
    node: screen({ title: P('title'), place: 'full', seats: P('seats') }, [{ use: 'split', props: { ratio: 'even' }, children: [
      { use: 'window', props: { title: { word: 'roster' } }, children: [{ use: 'grid', id: 'roster', props: { cells: P('roster'), columns: 3, cell: { use: 'stack', props: { align: 'center', gap: 'tight' }, children: [{ use: 'portrait', props: { name: I('name'), size: 'm' } }, txt(I('role'), 'caption')] } }, on: { accept: { emit: 'pick', seat: { seat: true }, id: I('id') } } }] },
      { use: 'each', props: { dir: 'row', rows: P('players'), row: { use: 'window', props: { title: I('label') }, children: [{ use: 'stack', children: [
        { use: 'portrait', props: { name: { pick: { format: 'roster@{seat}.name' } }, size: 'l' } }, txt({ pick: { format: 'roster@{seat}.role' } }, 'label'),
        { use: 'each', props: { rows: { pick: { format: 'roster@{seat}.stats' } }, row: { use: 'bar', props: { label: I('label'), value: I('value'), max: I('max') } } } },
      ] }] } } },
    ] }, legend(['accept', 'pick'], ['back', 'back'])]),
    example: { title: 'Choose your fighter', roster: { bind: 'roster' }, seats: 2, players: [{ seat: 1, label: 'Player 1' }, { seat: 2, label: 'Player 2' }] },
  },
  'arena-select': {
    kind: 'screen', about: 'pick where to play: one arena at a time (left and right), its preview and figures, or a random one',
    reads: 'arenas: [{ id, name, about, size, players, then }], value (the arena chosen, set by left and right)', emits: '{ set: <value>, to: id } as it turns; the arena\'s then on accept',
    params: ['title', 'arenas', 'value'],
    node: screen({ title: P('title'), place: 'center' }, [{ use: 'window', children: [{ use: 'stack', children: [
      { use: 'carousel', id: 'arena', props: { items: P('arenas'), value: P('value'), item: { use: 'stack', children: [
        { use: 'image', props: { label: I('name') } }, txt(I('name'), 'title'), txt(I('about')),
        { use: 'stack', props: { dir: 'row', gap: 'tight' }, children: [{ use: 'badge', props: { value: I('size') } }, { use: 'badge', props: { value: { format: '{players} {@playersCount}' } } }] },
      ] } }, on: { accept: I('then') } },
      { use: 'stack', props: { dir: 'row' }, children: [{ use: 'button', props: { label: { word: 'random' } }, on: { accept: { emit: 'arena:random' } } }, back] },
    ] }] }]),
    example: { title: 'Choose an arena', arenas: { bind: 'arenas' }, value: { bind: 'arena' } },
  },
  'pause-menu': {
    kind: 'screen', about: 'the pause over the held game: resume, then what the game offers (party, options, quit)',
    reads: 'items: [{ label, then, disabled? }]', emits: 'each item\'s then (back resumes: the stack closes)',
    params: ['title', 'items'],
    node: screen({ title: P('title'), layer: 'modal', place: 'center' }, [{ use: 'window', children: [{ use: 'list', id: 'pause', props: { rows: P('items'), variant: 'menu' }, on: { accept: I('then') } }] }, legend(['accept', 'pick'], ['back', 'resume'])]),
    example: { title: 'Paused', items: [{ label: 'Resume', then: { close: true } }, { label: 'Party', then: { open: 'party' } }, { label: 'Options', then: { open: 'options' } }, { label: 'Save', disabled: true }, { label: 'Quit to title', then: { emit: 'quit' } }] },
  },
  'options-screen': {
    kind: 'screen', about: 'options in sections (video, audio, controls, gameplay, accessibility): each field a toggle, cycler, slider or keybind bound to the var it sets; the game\'s language picked under them when it ships more than one',
    reads: 'sections: [{ label, fields: [{ kind, label, var, options?, min?, max?, step?, keys? }] }]', emits: '{ set: <var>, to } on each change; reset',
    params: ['title', 'sections'],
    node: screen({ title: P('title'), layer: 'modal', place: 'center' }, [{ use: 'window', children: [{ use: 'stack', children: [
      { use: 'tabs', props: { pages: P('sections'), page: { use: 'each', props: { rows: I('fields'), row: { use: 'field', props: { kind: I('kind'), label: I('label'), value: { bind: I('var') }, options: I('options'), min: I('min'), max: I('max'), step: I('step'), keys: I('keys') } } } } } },
      // the game's language, when it ships more than one (the picker draws nothing for one)
      { use: 'language' },
      { use: 'stack', props: { dir: 'row' }, children: [{ use: 'button', props: { label: { word: 'resetDefaults' } }, on: { accept: { emit: 'options:reset' } } }, back] },
    ] }] }, legend([['left', 'right'], 'change'], [['tabPrev', 'tabNext'], 'tabs'], ['back', 'back'])]),
    example: { title: 'Options', sections: [
      { label: 'Audio', fields: [{ kind: 'toggle', label: 'Sound', var: 'settings.sound' }, { kind: 'toggle', label: 'Music', var: 'settings.music' }, { kind: 'slider', label: 'Volume', var: 'settings.volume', min: 0, max: 10, step: 1 }] },
      { label: 'Video', fields: [{ kind: 'slider', label: 'Field of view', var: 'settings.fov', min: 60, max: 110, step: 5 }, { kind: 'toggle', label: 'Screen shake', var: 'settings.shake' }] },
      { label: 'Gameplay', fields: [{ kind: 'cycler', label: 'Difficulty', var: 'settings.difficulty', options: ['Easy', 'Normal', 'Hard'] }] },
      { label: 'Access', fields: [{ kind: 'toggle', label: 'Subtitles', var: 'settings.subtitles' }, { kind: 'cycler', label: 'Text size', var: 'settings.text', options: ['Small', 'Medium', 'Large'] }] },
    ] },
  },
  'controls-screen': {
    kind: 'screen', about: 'what each action is bound to, keys and pad, a clash marked; accept asks the host to capture a new binding',
    reads: 'actions: [{ action, label, keys, conflict? }] (controls/mana-controls.js controlsRows: a scheme as the controls kernel labels it)', emits: '{ remap: <action> } on accept; controls:reset',
    params: ['title', 'actions'],
    node: screen({ title: P('title'), layer: 'modal', place: 'center' }, [{ use: 'window', children: [{ use: 'stack', children: [
      { use: 'stack', props: { dir: 'row', align: 'apart' }, children: [txt({ word: 'action' }, 'heading'), txt({ word: 'keysPad' }, 'heading')] },
      { use: 'each', props: { rows: P('actions'), row: { use: 'keybind', props: { label: I('label'), keys: I('keys'), conflict: I('conflict') }, on: { accept: { remap: I('action') } } } } },
      { use: 'stack', props: { dir: 'row' }, children: [{ use: 'button', props: { label: { word: 'resetDefaults' } }, on: { accept: { emit: 'controls:reset' } } }, back] },
    ] }] }, legend(['accept', 'rebind'], ['back', 'back'])]),
    example: { title: 'Controls', actions: { bind: 'controls' } },
  },
  'confirm-dialog': {
    kind: 'screen', about: 'a question and its answers (quit without saving? overwrite?): a destructive answer is never the first',
    reads: 'ask, choices: [{ label, then }]', emits: 'the answer\'s then',
    params: ['title', 'ask', 'choices'],
    node: screen({ layer: 'modal', place: 'center' }, [{ use: 'window', props: { title: P('title') }, children: [{ use: 'stack', children: [txt(P('ask')), thenList(P('choices'))] }] }]),
    example: { title: 'Quit to title', ask: 'Progress since the last save will be lost.', choices: [{ label: 'Keep playing', then: { back: true } }, { label: 'Quit', then: { emit: 'quit' } }] },
  },
  'results-screen': {
    kind: 'screen', about: 'the end of a run (victory, defeat, a level cleared), in sequence: the outcome slams in, its figures rise and count up one after another, the rank is stamped on, then what next; accept while it counts lands every figure at once',
    reads: 'outcome, stats: [{ label, value }], rank, items: [{ label, then }]', emits: 'each item\'s then',
    params: ['outcome', 'stats', 'rank', 'items'],
    node: screen({ layer: 'modal', place: 'center' }, [{ use: 'stack', props: { align: 'center', gap: 'loose' }, children: [
      { use: 'banner', props: { value: P('outcome') } },
      { use: 'window', children: [{ use: 'stack', children: [{ use: 'each', props: { rows: P('stats'), row: { use: 'stat', props: { label: I('label'), value: I('value'), count: true } } } }, { use: 'divider' }, { use: 'stack', props: { dir: 'row', align: 'apart' }, children: [txt({ word: 'rank' }, 'heading'), { use: 'badge', props: { value: P('rank'), variant: 'stamp' } }] }] }] },
      { use: 'window', props: { variant: 'ghost' }, children: [thenList(P('items'), { variant: 'menu' })] },
    ] }]),
    example: { outcome: { bind: 'results.outcome' }, stats: { bind: 'results.stats' }, rank: { bind: 'results.rank' }, items: [{ label: 'Continue', then: { emit: 'continue' } }, { label: 'Retry', then: { emit: 'retry' } }, { label: 'Quit', then: { emit: 'quit' } }] },
  },
  'save-screen': {
    kind: 'screen', about: 'save or load slots: each slot\'s place, time played and level',
    reads: 'slots: [{ name, place, time, level, then }]', emits: 'the slot\'s then (save:<n> / load:<n>)',
    params: ['title', 'slots'],
    node: screen({ title: P('title'), layer: 'modal', place: 'center' }, [{ use: 'window', children: [{ use: 'stack', children: [
      { use: 'list', props: { rows: P('slots'), row: { use: 'stack', props: { dir: 'row', align: 'apart' }, children: [{ use: 'stack', props: { gap: 'tight' }, children: [txt(I('name'), 'heading'), txt({ format: '{place} · {time}' }, 'caption')] }, { use: 'badge', props: { value: { format: '{@lv} {level}' } } }] } }, on: { accept: I('then') } },
      back,
    ] }] }]),
    example: { title: 'Load', slots: { bind: 'saves' } },
  },
};

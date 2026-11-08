/**
 * THE LIVE GAME — what shows during play in each kind of game the studio makes, drawn by the same components, the same
 * sheet and the same themes as the menus (one style for a game, never a second one for its HUD). Each HUD part is a
 * region (one of the nine places) or a layer (over the world: anchors, edges, a threat ring, the cinema bars); each
 * menu that comes up mid-play is a screen whose parts sit in regions over the held game.
 *
 *   a fight      versus-bars (mirrored health with the chip of the last hit, rounds, the clock), super-meters, combo
 *   a race       race-standing (place, lap, lap and best times), speedometer
 *   a firefight  damage-direction, offscreen-markers, lock-on, ability-bar
 *   survival     hotbar, world-labels
 *   strategy     resource-bar, unit-card, combat-forecast, wave-status
 *   a match      score-bug, lower-third
 *   a cutscene   cinema-bars, subtitles
 *   stealth      stealth-meter
 *   quests       quest-toasts
 *   a phone      touch-controls, phone-buttons (pause and map as taps); action-sheet (a phone's menu from the foot)
 *   after play   match-results (a sport's end, after the broadcast's board: the score by side, the head to head the
 *                coverage counted, what next; its data from contest/contest-results.js contestResults)
 *   mid-play     battle-menu (a turn-based fight's commands, targets, turn order and party), tactics-menu (a unit's
 *                actions beside its forecast), scoreboard (held open), command-card (a strategy game's orders)
 */
const P = (name) => ({ param: name });
const I = (field) => ({ item: field });
const txt = (value, role) => ({ use: 'text', props: { value, ...(role ? { role } : {}) } });
const region = (at, children, extra = {}) => ({ use: 'region', props: { at }, children, ...extra });
const row = (children, align = 'center', gap = 'tight', fill = false) => ({ use: 'stack', props: { dir: 'row', gap, align, ...(fill ? { fill } : {}) }, children });
const col = (children, align) => ({ use: 'stack', props: { gap: 'tight', ...(align ? { align } : {}) }, children });
const screen = (props, children) => ({ use: 'screen', props, children });

export const LIVE_IDIOMS = {
  // a fight
  'versus-bars': {
    kind: 'hud', about: 'two fighters across the top: health mirrored (the second fills from the right), the chip of the last hit hatched, rounds won as pips, the round clock between',
    reads: 'p1, p2: { name, hp, hpMax, ghost, rounds }, time', emits: '—',
    params: ['p1name', 'p1hp', 'p1max', 'p1ghost', 'p1rounds', 'p2name', 'p2hp', 'p2max', 'p2ghost', 'p2rounds', 'time'],
    node: region('top', [row([
      col([row([txt(P('p1name'), 'heading'), { use: 'pips', props: { value: P('p1rounds'), max: 2 } }], 'apart'), { use: 'bar', props: { value: P('p1hp'), max: P('p1max'), ghost: P('p1ghost'), variant: 'hp' } }]),
      { use: 'timer', props: { seconds: P('time'), format: 'ss' } },
      col([row([{ use: 'pips', props: { value: P('p2rounds'), max: 2 } }, txt(P('p2name'), 'heading')], 'apart'), { use: 'bar', props: { value: P('p2hp'), max: P('p2max'), ghost: P('p2ghost'), variant: 'hp', dir: 'rtl' } }]),
    ], 'center', 'loose', true)]),
    example: { p1name: { bind: 'versus.p1.name' }, p1hp: { bind: 'versus.p1.hp' }, p1max: { bind: 'versus.p1.hpMax' }, p1ghost: { bind: 'versus.p1.ghost' }, p1rounds: { bind: 'versus.p1.rounds' }, p2name: { bind: 'versus.p2.name' }, p2hp: { bind: 'versus.p2.hp' }, p2max: { bind: 'versus.p2.hpMax' }, p2ghost: { bind: 'versus.p2.ghost' }, p2rounds: { bind: 'versus.p2.rounds' }, time: { bind: 'versus.time' } },
  },
  'super-meters': {
    kind: 'hud', about: 'each fighter\'s super meter along the bottom, in stocks',
    reads: 'p1super, p2super, max', emits: '—',
    params: ['p1super', 'p2super', 'max'],
    node: region('bottom', [row([col([{ use: 'bar', props: { label: 'Super', value: P('p1super'), max: P('max'), segments: P('max'), variant: 'xp' } }]), col([{ use: 'bar', props: { label: 'Super', value: P('p2super'), max: P('max'), segments: P('max'), variant: 'xp', dir: 'rtl' } }])], 'center', 'loose', true)]),
    example: { p1super: { bind: 'versus.p1.super' }, p2super: { bind: 'versus.p2.super' }, max: { bind: 'versus.p1.superMax' } },
  },
  'combo-counter': {
    kind: 'hud', about: 'the hits in a combo, while there is one (left)',
    reads: 'combo', emits: '—',
    params: ['combo'],
    node: region('left', [col([txt(P('combo'), 'display'), txt('hits', 'label')], 'center')], { when: P('combo') }),
    example: { combo: { bind: 'versus.combo' } },
  },
  // a race
  'race-standing': {
    kind: 'hud', about: 'where you are in the race: place, lap, this lap\'s time and the best (top left)',
    reads: 'position, lap, time, best', emits: '—',
    params: ['position', 'lap', 'time', 'best'],
    node: region('top-left', [col([row([{ use: 'counter', props: { label: 'Pos', value: P('position') } }, { use: 'counter', props: { label: 'Lap', value: P('lap') } }], 'center', 'loose'), { use: 'timer', props: { label: 'Lap', seconds: P('time') } }, { use: 'timer', props: { label: 'Best', seconds: P('best') } }])]),
    example: { position: { bind: 'race.position' }, lap: { bind: 'race.lap' }, time: { bind: 'race.time' }, best: { bind: 'race.best' } },
  },
  speedometer: {
    kind: 'hud', about: 'the speed on a dial (bottom right)',
    reads: 'speed, max, unit', emits: '—',
    params: ['speed', 'max', 'unit'],
    node: region('bottom-right', [{ use: 'gauge', props: { value: P('speed'), max: P('max'), unit: P('unit') } }]),
    example: { speed: { bind: 'race.speed' }, max: { bind: 'race.speedMax' }, unit: 'km/h' },
  },
  // a firefight
  'damage-direction': {
    kind: 'hud', about: 'where harm came from: a mark on a ring round the aim for each hit\'s bearing',
    reads: 'hits: [{ bearing }] (degrees from where you face)', emits: '—',
    params: ['hits'],
    node: { use: 'threat', props: { markers: P('hits') } },
    example: { hits: { bind: 'shooter.threats' } },
  },
  'offscreen-markers': {
    kind: 'hud', about: 'what matters off screen, held at the edge with an arrow toward it: an objective, a foe behind, an ally',
    reads: 'markers: [{ x, y (outside 0..1), kind, label? }]', emits: '—',
    params: ['markers'],
    node: { use: 'edges', props: { markers: P('markers') } },
    example: { markers: { bind: 'shooter.offscreen' } },
  },
  'lock-on': {
    kind: 'hud', about: 'brackets on what is locked, its name and range',
    reads: 'locks: [{ x, y, name, range }]', emits: '—',
    params: ['locks'],
    node: { use: 'anchors', props: { rows: P('locks'), row: col([{ use: 'reticle', props: { shape: 'bracket' } }, txt({ format: '{name} · {range}' }, 'caption')], 'center') } },
    example: { locks: { bind: 'shooter.locks' } },
  },
  'ability-bar': {
    kind: 'hud', about: 'the abilities on their keys, each with its cooldown left and its charges (bottom)',
    reads: 'abilities: [{ name, key, cooldown (0..1), count? }]', emits: '—',
    params: ['abilities'],
    node: region('bottom', [{ use: 'each', props: { dir: 'row', rows: P('abilities'), row: { use: 'slot', props: { name: I('name'), key: I('key'), cooldown: I('cooldown'), count: I('count') }, on: { accept: { emit: 'ability', name: I('name') } } } } }]),
    example: { abilities: { bind: 'abilities' } },
  },
  // survival
  hotbar: {
    kind: 'hud', about: 'the hotbar: what is on each number key, the one in hand marked (bottom)',
    reads: 'slots: [{ name, key, count?, active? }]', emits: '—',
    params: ['slots'],
    node: region('bottom', [{ use: 'each', props: { dir: 'row', rows: P('slots'), row: { use: 'slot', props: { name: I('name'), key: I('key'), count: I('count'), active: I('active') } } } }]),
    example: { slots: { bind: 'hotbar' } },
  },
  'world-labels': {
    kind: 'hud', about: 'names over things in the world: a pickup, a person, a door',
    reads: 'labels: [{ x, y, text }]', emits: '—',
    params: ['labels'],
    node: { use: 'anchors', props: { rows: P('labels'), row: txt(I('text'), 'caption') } },
    example: { labels: { bind: 'labels' } },
  },
  // strategy
  'resource-bar': {
    kind: 'hud', about: 'what you have to spend, along the top',
    reads: 'resources: [{ label, value, icon? }]', emits: '—',
    params: ['resources'],
    node: region('top', [{ use: 'each', props: { dir: 'row', rows: P('resources'), row: { use: 'counter', props: { label: I('label'), value: I('value'), icon: I('icon') } } } }]),
    example: { resources: { bind: 'resources' } },
  },
  'unit-card': {
    kind: 'hud', about: 'the unit in focus: its face, class, health and what it can do (bottom left)',
    reads: 'name, cls, hp, hpMax, move, atk, range', emits: '—',
    params: ['name', 'cls', 'hp', 'hpMax', 'move', 'atk', 'range'],
    node: region('bottom-left', [row([{ use: 'portrait', props: { name: P('name'), size: 'm' } }, col([txt(P('name'), 'heading'), txt(P('cls'), 'label'), { use: 'bar', props: { label: 'HP', value: P('hp'), max: P('hpMax'), variant: 'hp' } }, row([{ use: 'stat', props: { label: 'Move', value: P('move') } }, { use: 'stat', props: { label: 'Atk', value: P('atk') } }, { use: 'stat', props: { label: 'Rng', value: P('range') } }], 'center', 'loose')])], 'start', 'normal')]),
    example: { name: { bind: 'unit.name' }, cls: { bind: 'unit.cls' }, hp: { bind: 'unit.hp' }, hpMax: { bind: 'unit.hpMax' }, move: { bind: 'unit.move' }, atk: { bind: 'unit.atk' }, range: { bind: 'unit.range' } },
  },
  'combat-forecast': {
    kind: 'hud', about: 'what an attack will do before it is made: yours against theirs, row by row (right)',
    reads: 'rows: [{ what, you, them }]', emits: '—',
    params: ['rows'],
    node: region('right', [col([txt('Forecast', 'heading'), { use: 'table', props: { columns: [{ key: 'what', label: '' }, { key: 'you', label: 'You', align: 'right' }, { key: 'them', label: 'Them', align: 'right' }], rows: P('rows') } }])]),
    example: { rows: { bind: 'forecast' } },
  },
  'wave-status': {
    kind: 'hud', about: 'a defence\'s wave, lives and money (top right)',
    reads: 'wave, lives, livesMax, money', emits: '—',
    params: ['wave', 'lives', 'livesMax', 'money'],
    node: region('top-right', [col([{ use: 'counter', props: { label: 'Wave', value: P('wave') } }, { use: 'bar', props: { label: 'Lives', value: P('lives'), max: P('livesMax'), variant: 'hp' } }, { use: 'counter', props: { label: 'Gold', value: P('money'), icon: 'gold' } }])]),
    example: { wave: { bind: 'td.wave' }, lives: { bind: 'td.lives' }, livesMax: { bind: 'td.livesMax' }, money: { bind: 'td.money' } },
  },
  // a match
  'score-bug': {
    kind: 'hud', coverage: true, about: 'the match in a corner: the sides, the score, the clock and the period (top left)',
    reads: 'home, away, homeScore, awayScore, clock, period', emits: '—',
    params: ['home', 'away', 'homeScore', 'awayScore', 'clock', 'period'],
    node: region('top-left', [row([txt(P('home'), 'heading'), { use: 'badge', props: { value: P('homeScore'), variant: 'strong' } }, { use: 'badge', props: { value: P('awayScore'), variant: 'strong' } }, txt(P('away'), 'heading'), { use: 'timer', props: { seconds: P('clock') } }, { use: 'badge', props: { value: P('period') } }])]),
    example: { home: { bind: 'match.home' }, away: { bind: 'match.away' }, homeScore: { bind: 'match.homeScore' }, awayScore: { bind: 'match.awayScore' }, clock: { bind: 'match.clock' }, period: { bind: 'match.period' } },
  },
  'lower-third': {
    kind: 'hud', coverage: true, about: 'who is on screen and what they are, while it shows (bottom left)',
    reads: 'show, name, role', emits: '—',
    params: ['show', 'name', 'role'],
    node: region('bottom-left', [col([txt(P('name'), 'title'), txt(P('role'), 'label')])], { when: P('show') }),
    example: { show: { bind: 'lowerThird.show' }, name: { bind: 'lowerThird.name' }, role: { bind: 'lowerThird.role' } },
  },
  // a cutscene
  'cinema-bars': {
    kind: 'hud', about: 'the cinema bars while a cutscene plays',
    reads: 'show', emits: '—',
    params: ['show'],
    node: { use: 'letterbox', when: P('show') },
    example: { show: { bind: 'cutscene.show' } },
  },
  subtitles: {
    kind: 'hud', about: 'who speaks and what they say, and how to skip (bottom)',
    reads: 'show, who, line, skip', emits: '—',
    params: ['show', 'who', 'line', 'skip'],
    node: region('bottom', [col([txt(P('who'), 'heading'), txt(P('line')), txt(P('skip'), 'caption')], 'center')], { when: P('show'), props: { at: 'bottom', variant: 'subtitles' } }),
    example: { show: { bind: 'cutscene.show' }, who: { bind: 'cutscene.who' }, line: { bind: 'cutscene.line' }, skip: { bind: 'cutscene.skip' } },
  },
  // stealth, quests, a phone
  'stealth-meter': {
    kind: 'hud', about: 'how near you are to being found: the most aware enemy\'s state and the detection filling (top)',
    reads: 'state (awareness), level, max', emits: '—',
    params: ['state', 'level', 'max'],
    node: region('top', [row([{ use: 'awareness', props: { state: P('state') } }, { use: 'bar', props: { label: 'Seen', value: P('level'), max: P('max'), variant: 'stamina' } }])]),
    example: { state: { bind: 'stealth.state' }, level: { bind: 'stealth.level' }, max: { bind: 'stealth.max' } },
  },
  'quest-toasts': {
    kind: 'hud', about: 'a quest begun, a step done, a quest ended: passing words, one at a time by weight (a quest ended outweighs a step), sliding in (top right); a row\'s tier: rare holds longer, with its own sound',
    reads: 'toasts: [{ id, text, sub?, weight? }] (the game appends; host.now its clock)', emits: '—',
    params: ['toasts'],
    node: region('top-right', [{ use: 'moments', props: { rows: P('toasts'), as: 'toast', hold: 2.5, read: 1 } }]),
    example: { toasts: { bind: 'questToasts' } },
  },
  'achievement-toast': {
    kind: 'hud', about: 'an achievement unlocked: its icon, its name and its line, sliding in one at a time (bottom right); a rare one held longer, with its own sound and a sheen',
    reads: 'unlocks: [{ id, text, sub?, icon?, tier?: standard | rare, weight? }] (the game appends; host.now its clock)', emits: '—',
    params: ['unlocks'],
    node: region('bottom-right', [{ use: 'moments', props: { rows: P('unlocks'), as: 'toast', hold: 3.5, read: 1.5 } }]),
    example: { unlocks: { bind: 'achievements' } },
  },
  'phone-buttons': {
    kind: 'hud', about: 'the buttons a touch screen needs where a pad has keys: pause and the map, tapped (top right)',
    reads: '—', emits: '{ open: pause } on pause; { emit: map } on the map',
    params: ['pause'],
    node: region('top-right', [row([{ use: 'button', props: { label: 'Map' }, on: { accept: { emit: 'map' } } }, { use: 'button', props: { label: '❚❚' }, on: { accept: { open: P('pause') } } }])]),
    example: { pause: 'pause' },
  },
  'action-sheet': {
    kind: 'screen', about: 'a phone\'s menu, risen from the foot of the screen in reach of a thumb: big choices, a cancel at the end',
    reads: 'title, items: [{ label, then, disabled? }]', emits: 'each item\'s then; cancel closes it',
    params: ['title', 'items'],
    node: screen({ layer: 'modal', place: 'sheet' }, [{ use: 'window', props: { title: P('title') }, children: [col([
      { use: 'list', props: { rows: P('items') }, on: { accept: I('then') } },
      { use: 'button', props: { label: 'Cancel' }, on: { accept: { back: true } } },
    ])] }]),
    example: { title: 'Paused', items: [{ label: 'Resume', then: { close: true } }, { label: 'Party', then: { emit: 'open:party' } }, { label: 'Options', then: { emit: 'open:options' } }, { label: 'Quit to title', then: { emit: 'quit' } }] },
  },
  'touch-controls': {
    kind: 'hud', about: 'a phone\'s controls: the stick on the left, the buttons on the right (bottom)',
    reads: 'buttons', emits: '— (the host reads the touches)',
    params: ['buttons'],
    node: region('bottom', [{ use: 'touchpad', props: { buttons: P('buttons') } }]),
    example: { buttons: { bind: 'touch' } },
  },
  // after play
  'match-results': {
    kind: 'screen', about: 'a match\'s end, after the broadcast\'s board: won or lost, the score by side (each in its kit), the head to head the coverage counted with each row\'s lead marked, then what next',
    reads: 'outcome, scores: [{ name, value, side, self }], columns, rows: [{ words, c0, c1 …, lead }] (contest-results.js contestResults), items: [{ label, then }]', emits: 'each item\'s then',
    params: ['outcome', 'title', 'scores', 'columns', 'rows', 'items'],
    node: screen({ layer: 'modal', place: 'center' }, [col([
      txt(P('outcome'), 'display'), txt(P('title'), 'label'),
      { use: 'window', children: [{ use: 'table', props: { columns: [{ key: 'name', label: '' }, { key: 'value', label: 'Score', align: 'right' }], rows: P('scores') } }] },
      { use: 'window', props: { title: 'Head to head' }, children: [{ use: 'table', props: { columns: P('columns'), rows: P('rows') } }] },
      { use: 'window', props: { variant: 'ghost' }, children: [{ use: 'list', props: { rows: P('items') }, on: { accept: I('then') } }] },
    ], 'center')]),
    example: { outcome: { bind: 'match.result.outcome' }, title: 'Tennis · final', scores: { bind: 'match.result.scores' }, columns: { bind: 'match.result.columns' }, rows: { bind: 'match.result.rows' }, items: [{ label: 'Continue', then: { emit: 'continue' } }, { label: 'Rematch', then: { emit: 'rematch' } }, { label: 'Home', then: { emit: 'home' } }] },
  },
  // mid-play menus
  'battle-menu': {
    kind: 'screen', about: 'a turn-based fight: the message above, whose turn in order, the foes to aim at, the commands, and the party with the one acting marked',
    reads: 'message, turns: [{ name, variant: strong (now) | plain (party) | muted (foe), turn? (the one acting, alight) }], foes: [{ id, name, hp, hpMax, state }], commands: [{ label, then }], party: [{ name, hp, hpMax, mp, mpMax, active? }]', emits: 'a command\'s then; { emit: target, id } on a foe',
    params: ['message', 'turns', 'foes', 'commands', 'party'],
    node: screen({ layer: 'overlay', place: 'full' }, [
      region('top', [txt(P('message'))]),
      region('top-right', [col([txt('Turn order', 'heading'), { use: 'each', props: { dir: 'row', rows: P('turns'), row: { use: 'badge', props: { value: I('name'), variant: I('variant'), turn: I('turn') } } } }])]),
      region('left', [{ use: 'window', props: { title: 'Foes' }, children: [{ use: 'list', props: { rows: P('foes'), row: col([row([{ use: 'awareness', props: { state: I('state'), label: false } }, txt(I('name'))]), { use: 'bar', props: { value: I('hp'), max: I('hpMax'), variant: 'hp' } }]) }, on: { accept: { emit: 'target', id: I('id') } } }] }]),
      region('bottom-left', [{ use: 'window', props: { title: 'Command' }, children: [{ use: 'list', props: { rows: P('commands') }, on: { accept: I('then') } }] }]),
      region('bottom-right', [{ use: 'window', props: { title: 'Party' }, children: [{ use: 'list', props: { rows: P('party'), row: row([txt(I('name'), 'heading'), { use: 'bar', props: { label: 'HP', value: I('hp'), max: I('hpMax'), variant: 'hp' } }, { use: 'bar', props: { label: 'MP', value: I('mp'), max: I('mpMax'), variant: 'mp' } }], 'center', 'normal') } }] }]),
    ]),
    example: { message: { bind: 'battle.message' }, turns: { bind: 'battle.turns' }, foes: { bind: 'battle.foes' }, commands: { bind: 'battle.commands' }, party: { bind: 'battle.party' } },
  },
  'tactics-menu': {
    kind: 'screen', about: 'a unit\'s turn on a board: its actions beside it, the forecast of an attack, the unit itself',
    reads: 'actions: [{ label, then }], forecast rows, the unit', emits: 'an action\'s then',
    params: ['actions', 'forecast', 'name', 'cls', 'hp', 'hpMax'],
    node: screen({ layer: 'overlay', place: 'full' }, [
      region('left', [{ use: 'window', props: { title: 'Act' }, children: [{ use: 'list', props: { rows: P('actions') }, on: { accept: I('then') } }] }]),
      region('right', [{ use: 'window', props: { title: 'Forecast' }, children: [{ use: 'table', props: { columns: [{ key: 'what', label: '' }, { key: 'you', label: 'You', align: 'right' }, { key: 'them', label: 'Them', align: 'right' }], rows: P('forecast') } }] }]),
      region('bottom-left', [{ use: 'window', children: [row([{ use: 'portrait', props: { name: P('name'), size: 's' } }, col([txt(P('name'), 'heading'), txt(P('cls'), 'label')]), { use: 'bar', props: { label: 'HP', value: P('hp'), max: P('hpMax'), variant: 'hp' } }], 'center', 'normal')] }]),
    ]),
    example: { actions: { bind: 'actions' }, forecast: { bind: 'forecast' }, name: { bind: 'unit.name' }, cls: { bind: 'unit.cls' }, hp: { bind: 'unit.hp' }, hpMax: { bind: 'unit.hpMax' } },
  },
  scoreboard: {
    kind: 'screen', about: 'the match\'s table while it is held open: every player\'s score, kills and deaths, yours marked',
    reads: 'players: [{ id, name, team, score, kills, deaths, self?, side? }] (a score that changed flashes; a player who joined rings once)', emits: '— (back closes it)',
    params: ['title', 'players'],
    node: screen({ title: P('title'), layer: 'modal', place: 'center' }, [{ use: 'window', children: [col([
      { use: 'table', props: { columns: [{ key: 'name', label: 'Player' }, { key: 'team', label: 'Team' }, { key: 'score', label: 'Score', align: 'right' }, { key: 'kills', label: 'K', align: 'right' }, { key: 'deaths', label: 'D', align: 'right' }], rows: P('players') } },
      { use: 'button', props: { label: 'Close' }, on: { accept: { back: true } } },
    ])] }]),
    example: { title: 'Scoreboard', players: { bind: 'scoreboard' } },
  },
  'command-card': {
    kind: 'screen', about: 'a strategy game\'s orders for what is selected: a grid of commands on their keys, the selection and its queue',
    reads: 'commands: [{ name, key, then, disabled? }], selection: { name, hp, hpMax, queue: [{ name, progress }] }', emits: 'a command\'s then',
    params: ['commands', 'name', 'hp', 'hpMax', 'queue'],
    node: screen({ layer: 'overlay', place: 'full' }, [
      region('bottom-left', [{ use: 'window', props: { title: P('name') }, children: [col([{ use: 'bar', props: { label: 'HP', value: P('hp'), max: P('hpMax'), variant: 'hp' } }, txt('Queue', 'heading'), { use: 'each', props: { rows: P('queue'), row: { use: 'bar', props: { label: I('name'), value: I('progress'), max: 1, variant: 'xp' } } } }])] }]),
      region('bottom-right', [{ use: 'window', props: { title: 'Orders' }, children: [{ use: 'grid', props: { cells: P('commands'), columns: 4, cell: col([txt(I('name'), 'caption'), { use: 'badge', props: { value: I('key') } }], 'center') }, on: { accept: I('then') } }] }]),
    ]),
    example: { commands: { bind: 'commands' }, name: { bind: 'selection.name' }, hp: { bind: 'selection.hp' }, hpMax: { bind: 'selection.hpMax' }, queue: { bind: 'selection.queue' } },
  },
};

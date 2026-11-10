/**
 * IN-GAME — the HUD and the enemies' states, the parts that sit over play and never take the focus. Each is a region
 * (one of the nine screen places; playscape's region grid and its budgets) or an anchor layer (a part over each thing in
 * the world, placed by the screen x and y the game projects for it). A game's HUD is a `hud` holding the ones it uses:
 *
 *   hud: { use: 'hud', children: [{ use: 'vitals', props: {…} }, { use: 'enemy-plates', props: {…} }, …] }
 *
 * The enemies' states are words with shapes, never a colour alone (playscape's owners-apart law): what one knows of you
 * (`awareness`: unaware –, suspicious ?, searching ??, alert !, combat !!, fleeing », down ✕), its statuses, its health,
 * a boss's phases as ticks on its bar.
 */
const P = (name) => ({ param: name });
const I = (field) => ({ item: field });
const txt = (value, role) => ({ use: 'text', props: { value, ...(role ? { role } : {}) } });
const region = (at, children, extra = {}) => ({ use: 'region', props: { at }, children, ...extra });
const row = (children, align = 'start') => ({ use: 'stack', props: { dir: 'row', gap: 'tight', align }, children });
const col = (children) => ({ use: 'stack', props: { gap: 'tight' }, children });

export const HUD_IDIOMS = {
  vitals: {
    kind: 'hud', about: 'the player\'s own: name, health, mana (or stamina), lives as hearts (top left)',
    reads: 'name, hp, hpMax, mp, mpMax, lives, livesMax', emits: '—',
    params: ['name', 'hp', 'hpMax', 'mp', 'mpMax', 'lives', 'livesMax'],
    node: region('top-left', [col([
      txt(P('name'), 'heading'),
      { use: 'bar', props: { label: { word: 'hp' }, value: P('hp'), max: P('hpMax'), variant: 'hp' } },
      { use: 'bar', props: { label: { word: 'mp' }, value: P('mp'), max: P('mpMax'), variant: 'mp' } },
      { use: 'pips', props: { value: P('lives'), max: P('livesMax'), shape: 'heart' } },
    ])]),
    example: { name: { bind: 'player.name' }, hp: { bind: 'player.hp' }, hpMax: { bind: 'player.hpMax' }, mp: { bind: 'player.mp' }, mpMax: { bind: 'player.mpMax' }, lives: { bind: 'player.lives' }, livesMax: { bind: 'player.livesMax' } },
  },
  'objective-tracker': {
    kind: 'hud', about: 'what to do now: the objective and its steps (top)',
    reads: 'title, steps: [{ text, done }]', emits: '—',
    params: ['title', 'steps'],
    node: region('top', [col([txt(P('title'), 'heading'), { use: 'each', props: { rows: P('steps'), row: row([{ use: 'text', props: { value: '☑' }, when: I('done') }, { use: 'text', props: { value: '☐' }, unless: I('done') }, txt(I('text'), 'label')]) } }])]),
    example: { title: { bind: 'objective.title' }, steps: { bind: 'objective.steps' } },
  },
  'compass-strip': {
    kind: 'hud', about: 'the heading and the bearings of what matters (top)',
    reads: 'heading (degrees), markers: [{ bearing, kind }]', emits: '—',
    params: ['heading', 'markers'],
    node: region('top', [{ use: 'compass', props: { heading: P('heading'), markers: P('markers') } }]),
    example: { heading: { bind: 'player.heading' }, markers: { bind: 'bearings' } },
  },
  'minimap-corner': {
    kind: 'hud', about: 'the map in a corner: you, foes, the goal, items, each a shape (top right)',
    reads: 'markers: [{ x, y, kind: self | ally | foe | goal | item | poi, label? }]', emits: '—',
    params: ['markers', 'label'],
    node: region('top-right', [{ use: 'minimap', props: { markers: P('markers'), label: P('label') } }]),
    example: { markers: { bind: 'map' }, label: 'Lower Vale' },
  },
  'ammo-counter': {
    kind: 'hud', about: 'the weapon in hand and its ammunition (bottom right)',
    reads: 'weapon, ammo, reserve', emits: '—',
    params: ['weapon', 'ammo', 'reserve'],
    node: region('bottom-right', [col([txt(P('weapon'), 'heading'), { use: 'counter', props: { label: { word: 'ammo' }, value: P('ammo'), max: P('reserve'), icon: 'ammo' } }])]),
    example: { weapon: { bind: 'player.weapon' }, ammo: { bind: 'player.ammo' }, reserve: { bind: 'player.reserve' } },
  },
  'score-timer': {
    kind: 'hud', about: 'the run\'s clock and score (top right)',
    reads: 'seconds, score', emits: '—',
    params: ['seconds', 'score'],
    node: region('top-right', [row([{ use: 'timer', props: { seconds: P('seconds'), label: { word: 'time' } } }, { use: 'counter', props: { label: { word: 'score' }, value: P('score') } }])]),
    example: { seconds: { bind: 'player.seconds' }, score: { bind: 'player.score' } },
  },
  'interact-prompt': {
    kind: 'hud', about: 'what a button does here, shown while there is something to do (bottom)',
    reads: 'show, action (the glyph), label', emits: '—',
    params: ['show', 'action', 'label'],
    node: region('bottom', [{ use: 'prompt', props: { glyph: P('action'), label: P('label') } }], { when: P('show') }),
    example: { show: { bind: 'prompt.show' }, action: { bind: 'prompt.action' }, label: { bind: 'prompt.label' } },
  },
  'event-feed': {
    kind: 'hud', about: 'the last few happenings: pickups, level ups, being seen (right)',
    reads: 'rows: [{ text }]', emits: '—',
    params: ['rows'],
    node: region('right', [{ use: 'feed', props: { rows: P('rows'), max: 4 } }]),
    example: { rows: { bind: 'feed' } },
  },
  crosshair: {
    kind: 'hud', about: 'the aim in the centre; a hit adds its marker shape',
    reads: 'shape, hit', emits: '—',
    params: ['shape', 'hit'],
    node: region('center', [{ use: 'reticle', props: { shape: P('shape'), hit: P('hit') } }]),
    example: { shape: 'cross', hit: true },
  },
  'moment-banner': {
    kind: 'hud', coverage: true, about: 'a moment, centred and passing: a phase, a level\'s name, a victory; one at a time by weight (a weightier one takes the screen, an equal one once read, a lighter one waits), on the game\'s clock',
    reads: 'moments: [{ id, text, sub?, weight?: 0..3 | minor | normal | major | decisive }] (the game appends; host.now its clock)', emits: '—',
    params: ['moments'],
    node: region('center', [{ use: 'moments', props: { rows: P('moments'), as: 'banner' } }]),
    example: { moments: { bind: 'moments' } },
  },
  'party-strip': {
    kind: 'hud', about: 'the party\'s health and mana at a glance (bottom left); what changed flashes',
    reads: 'party: [{ name, hp, hpMax, mp, mpMax }]', emits: '—',
    params: ['party'],
    node: region('bottom-left', [{ use: 'each', props: { rows: P('party'), row: { use: 'stack', props: { dir: 'row', gap: 'tight', align: 'center' }, children: [txt(I('name'), 'label'), { use: 'bar', props: { value: I('hp'), max: I('hpMax'), variant: 'hp' } }, { use: 'bar', props: { value: I('mp'), max: I('mpMax'), variant: 'mp' } }] } } }]),
    example: { party: { bind: 'party' } },
  },
  // the enemies
  'enemy-plates': {
    kind: 'hud', about: 'a plate over each enemy on screen: what it knows of you, its name and level, its health, its statuses',
    reads: 'foes: [{ name, level, hp, hpMax, state, statuses, x, y }] (x, y on the screen, 0..1; off screen, not drawn)', emits: '—',
    params: ['foes'],
    node: { use: 'anchors', props: { rows: P('foes'), row: col([
      row([{ use: 'awareness', props: { state: I('state'), label: false } }, txt(I('name'), 'label'), txt({ format: '{@lv} {level}' }, 'caption')], 'center'),
      { use: 'bar', props: { value: I('hp'), max: I('hpMax'), variant: 'hp' } },
      { use: 'statuses', props: { rows: I('statuses') } },
    ]) } },
    example: { foes: { bind: 'foes' } },
  },
  'boss-bar': {
    kind: 'hud', about: 'the boss across the top: its name, its health with a tick between phases, its statuses',
    reads: 'name, hp, hpMax, phases, statuses', emits: '—',
    params: ['name', 'hp', 'hpMax', 'phases', 'statuses'],
    node: region('top', [col([row([txt(P('name'), 'heading'), { use: 'statuses', props: { rows: P('statuses') } }], 'apart'), { use: 'bar', props: { value: P('hp'), max: P('hpMax'), variant: 'boss', segments: P('phases') } }])]),
    example: { name: { bind: 'boss.name' }, hp: { bind: 'boss.hp' }, hpMax: { bind: 'boss.hpMax' }, phases: { bind: 'boss.phases' }, statuses: { bind: 'boss.statuses' } },
  },
  'target-frame': {
    kind: 'hud', about: 'the enemy locked on: its awareness, name, level, health and distance (top right)',
    reads: 'name, level, hp, hpMax, state, distance', emits: '—',
    params: ['name', 'level', 'hp', 'hpMax', 'state', 'distance'],
    node: region('top-right', [col([row([{ use: 'awareness', props: { state: P('state') } }, txt(P('name'), 'heading')], 'center'), { use: 'bar', props: { value: P('hp'), max: P('hpMax'), variant: 'hp' } }, row([{ use: 'stat', props: { label: { word: 'lv' }, value: P('level') } }, { use: 'stat', props: { label: { word: 'range' }, value: P('distance') } }], 'apart')])]),
    example: { name: { bind: 'target.name' }, level: { bind: 'target.level' }, hp: { bind: 'target.hp' }, hpMax: { bind: 'target.hpMax' }, state: { bind: 'target.state' }, distance: { bind: 'target.distance' } },
  },
  'damage-numbers': {
    kind: 'hud', about: 'numbers popping where blows land and rising off, bare over the world with a halo: hit, crit (larger), heal, miss, block told by their word and their tone',
    reads: 'pops: [{ id, x, y, value, kind }] (each id its own number: a new one rises again; the game drops a pop once it has risen)', emits: '—',
    params: ['pops'],
    node: { use: 'anchors', props: { variant: 'bare', rows: P('pops'), pass: true, row: row([{ use: 'text', props: { value: I('value'), role: 'numeral', tone: I('kind') } }, txt(I('kind'), 'caption')], 'center') } },
    example: { pops: { bind: 'pops' } },
  },
};

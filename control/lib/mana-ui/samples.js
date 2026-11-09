/**
 * MANA-UI's SAMPLE STATE — one small game's state, as a host would give it, that every idiom's `example` binds into. It
 * is what the wireframe board draws and what the idioms' sweep runs; a real game's bridge hands the same shapes from
 * its kernels and its store. Plain data, no names of anyone's game.
 *
 *   SAMPLE_STATE
 */
const stats = (atk, def, mag, spd) => ({ atk, def, mag, spd });

export const SAMPLE_STATE = Object.freeze({
  game: { title: 'Ashen Vale', subtitle: 'A greybox adventure', version: 'v0.1 greybox' },
  load: { progress: 64, ready: false, place: 'The Lower Vale', step: 'Raising the gatehouse', tips: ['Guarding halves the next blow.', 'A lantern keeps the hounds at bay.', 'Rest at a shrine to keep what you carry.'] },
  settings: { sound: 1, music: 0, subtitles: 1, volume: 7, fov: 90, difficulty: 'Normal', shake: 1, text: 'Medium' },
  player: { name: 'Ayla', hp: 64, hpMax: 80, mp: 10, mpMax: 20, lives: 2, livesMax: 3, gold: 240, weapon: 'Carbine', ammo: 12, reserve: 90, heading: 30, score: 1450, seconds: 312 },
  party: [
    { id: 'ayla', name: 'Ayla', cls: 'Knight', level: 7, hp: 64, hpMax: 80, mp: 10, mpMax: 20, stats: stats(21, 18, 4, 9), gear: [{ slot: 'Weapon', name: 'Iron Sword' }, { slot: 'Armor', name: 'Chain Mail' }, { slot: 'Accessory', name: '—' }], skills: [{ name: 'Guard Break', mp: 4 }, { name: 'Provoke', mp: 2 }] },
    { id: 'rook', name: 'Rook', cls: 'Mage', level: 6, hp: 12, hpMax: 52, mp: 40, mpMax: 44, stats: stats(8, 9, 24, 11), gear: [{ slot: 'Weapon', name: 'Ash Staff' }], skills: [{ name: 'Fire', mp: 6 }, { name: 'Frost', mp: 6 }, { name: 'Bolt', mp: 8 }] },
    { id: 'wren', name: 'Wren', cls: 'Thief', level: 6, hp: 47, hpMax: 58, mp: 8, mpMax: 16, stats: stats(15, 11, 6, 22), gear: [], skills: [{ name: 'Steal', mp: 0 }] },
  ],
  // enemies as the world places them this frame: x, y on the screen (0..1), what each knows of you
  foes: [
    { id: 'g1', name: 'Warden', level: 5, hp: 30, hpMax: 40, state: 'alert', statuses: [{ name: 'burn', turns: 2 }], x: 0.36, y: 0.46 },
    { id: 'g2', name: 'Warden', level: 5, hp: 40, hpMax: 40, state: 'suspicious', statuses: [], x: 0.62, y: 0.42 },
    { id: 'g3', name: 'Hound', level: 3, hp: 8, hpMax: 22, state: 'combat', statuses: ['poison', 'slow'], x: 0.5, y: 0.6 },
    { id: 'g4', name: 'Lookout', level: 4, hp: 20, hpMax: 20, state: 'unaware', statuses: [], x: 0.8, y: 0.34 },
  ],
  boss: { name: 'The Hollow King', hp: 2100, hpMax: 3600, phases: 3, statuses: ['enraged'] },
  target: { name: 'Hound', level: 3, hp: 8, hpMax: 22, state: 'combat', distance: '12 m' },
  pops: [{ x: 0.5, y: 0.52, value: 14, kind: 'hit' }, { x: 0.37, y: 0.38, value: 38, kind: 'crit' }, { x: 0.22, y: 0.7, value: 9, kind: 'heal' }],
  map: [{ x: 0.5, y: 0.5, kind: 'self' }, { x: 0.3, y: 0.4, kind: 'foe' }, { x: 0.7, y: 0.6, kind: 'foe' }, { x: 0.8, y: 0.2, kind: 'goal', label: 'Gate' }, { x: 0.2, y: 0.8, kind: 'item' }],
  bearings: [{ bearing: 60, kind: 'goal' }, { bearing: 350, kind: 'foe' }],
  objective: { title: 'Reach the gatehouse', steps: [{ text: 'Find the crest key', done: true }, { text: 'Open the east gate', done: false }] },
  feed: [{ text: 'Picked up 3 arrows' }, { text: 'Ayla reached level 7' }, { text: 'Picked up a tonic' }, { text: 'Picked up a tonic' }, { text: 'Warden spotted you' }],
  prompt: { show: true, action: 'E', label: 'Open the gate' },
  moments: [{ id: 'm1', text: 'Phase 2', sub: 'The Hollow King rises', weight: 'major' }],
  modes: [
    { id: 'story', name: 'Story', about: 'The campaign, chapter by chapter.', players: '1', then: { emit: 'mode:story' } },
    { id: 'versus', name: 'Versus', about: 'Two to four on one screen.', players: '2–4', then: { emit: 'mode:versus' } },
    { id: 'trials', name: 'Trials', about: 'Timed runs through cleared levels.', players: '1', then: { emit: 'mode:trials' } },
    { id: 'online', name: 'Online', about: 'Not in this game.', players: '—', disabled: true },
  ],
  roster: [
    { id: 'ayla', name: 'Ayla', role: 'Knight', stats: [{ label: 'Power', value: 4, max: 5 }, { label: 'Speed', value: 2, max: 5 }, { label: 'Range', value: 1, max: 5 }] },
    { id: 'rook', name: 'Rook', role: 'Mage', stats: [{ label: 'Power', value: 3, max: 5 }, { label: 'Speed', value: 2, max: 5 }, { label: 'Range', value: 5, max: 5 }] },
    { id: 'wren', name: 'Wren', role: 'Thief', stats: [{ label: 'Power', value: 2, max: 5 }, { label: 'Speed', value: 5, max: 5 }, { label: 'Range', value: 2, max: 5 }] },
    { id: 'bram', name: 'Bram', role: 'Brute', stats: [{ label: 'Power', value: 5, max: 5 }, { label: 'Speed', value: 1, max: 5 }, { label: 'Range', value: 1, max: 5 }] },
    { id: 'isa', name: 'Isa', role: 'Ranger', stats: [{ label: 'Power', value: 3, max: 5 }, { label: 'Speed', value: 4, max: 5 }, { label: 'Range', value: 4, max: 5 }] },
    { id: 'random', name: 'Random', role: '?', stats: [] },
  ],
  arenas: [
    { id: 'quarry', name: 'The Quarry', about: 'Ledges over a pit.', size: 'Medium', players: '2–4', then: { emit: 'arena:quarry' } },
    { id: 'bridge', name: 'Rope Bridge', about: 'A long span, no rails.', size: 'Small', players: '2', then: { emit: 'arena:bridge' } },
    { id: 'hall', name: 'Great Hall', about: 'Pillars and a balcony.', size: 'Large', players: '2–4', then: { emit: 'arena:hall' } },
  ],
  arena: 'bridge',
  controls: [
    { action: 'jump', label: 'Jump', keys: ['Space', 'A'], conflict: true },
    { action: 'attack', label: 'Attack', keys: ['J', 'X'] },
    { action: 'guard', label: 'Guard', keys: ['K', 'LB'] },
    { action: 'interact', label: 'Interact', keys: ['E', 'Y'] },
    { action: 'map', label: 'Map', keys: ['M', 'Back'] },
    { action: 'dash', label: 'Dash', keys: ['Space', 'B'], conflict: true },
  ],
  saves: [
    { name: 'Slot 1', place: 'Lower Vale', time: '3h 12m', level: 7, then: { emit: 'load:1' } },
    { name: 'Slot 2', place: 'Gatehouse', time: '5h 40m', level: 9, then: { emit: 'load:2' } },
    { name: 'Empty slot', place: '—', time: '—', level: '—', then: { emit: 'save:3' } },
  ],
  results: { outcome: 'Victory', rank: 'A', stats: [{ label: 'Time', value: '05:12' }, { label: 'Foes', value: '23' }, { label: 'Damage taken', value: '140' }, { label: 'Gold', value: '+85' }] },
  skills: [
    { id: 'slash', name: 'Slash', cost: 1, state: 'learned', about: 'A quick cut.' },
    { id: 'guard', name: 'Guard', cost: 1, state: 'learned', about: 'Halve the next blow.' },
    { id: 'cleave', name: 'Cleave', cost: 2, state: 'available', requires: ['slash'], about: 'Hit all foes in front.' },
    { id: 'riposte', name: 'Riposte', cost: 2, state: 'available', requires: ['guard'], about: 'Answer a guarded blow.' },
    { id: 'bulwark', name: 'Bulwark', cost: 3, state: 'locked', requires: ['guard', 'riposte'], about: 'Guard the whole party.' },
    { id: 'whirl', name: 'Whirlwind', cost: 4, state: 'locked', requires: ['cleave'], about: 'A full turn of the blade.' },
    { id: 'sunder', name: 'Sunder', cost: 5, state: 'locked', requires: ['whirl', 'bulwark'], about: 'Break any guard.' },
  ],
  sp: 3,
  levelup: { who: 'Ayla', level: 8, points: 3, stats: [{ id: 'atk', label: 'Attack', value: 21 }, { id: 'def', label: 'Defence', value: 18 }, { id: 'mag', label: 'Magic', value: 4, max: 6 }, { id: 'spd', label: 'Speed', value: 9 }] },
  loadout: {
    weight: 34, weightMax: 50,
    slots: [
      { slot: 'Primary', name: 'Carbine', can: [{ id: 'rifle', name: 'Long Rifle', weight: 9, delta: [{ label: 'Damage', from: 22, to: 40 }, { label: 'Rate', from: 8, to: 2 }] }, { id: 'smg', name: 'Sub-gun', weight: 4, delta: [{ label: 'Damage', from: 22, to: 14 }, { label: 'Rate', from: 8, to: 14 }] }] },
      { slot: 'Sidearm', name: 'Pistol', can: [{ id: 'revolver', name: 'Revolver', weight: 2, delta: [{ label: 'Damage', from: 12, to: 20 }] }] },
      { slot: 'Gadget', name: 'Smoke', can: [] },
    ],
  },
  bag: [
    { label: 'Items', items: [{ id: 'tonic', name: 'Tonic', kind: 'consumable', count: 4, about: 'Restores 30 HP.', then: { emit: 'use:tonic' } }, { id: 'ether', name: 'Ether', kind: 'consumable', count: 1, about: 'Restores 10 MP.', then: { emit: 'use:ether' } }, { id: 'bomb', name: 'Fire Bomb', kind: 'consumable', count: 2, about: 'Burns a group.' }] },
    { label: 'Gear', items: [{ id: 'iron-sword', name: 'Iron Sword', kind: 'weapon', count: 1, about: 'Attack +6.' }, { id: 'chain-mail', name: 'Chain Mail', kind: 'armor', count: 1, about: 'Defence +5.' }] },
    { label: 'Key', items: [{ id: 'crest', name: 'Crest Key', kind: 'key', count: 1, about: 'Opens the east gate.' }] },
  ],
  shop: {
    buy: [{ id: 'tonic', name: 'Tonic', price: 12, about: 'Restores 30 HP.', delta: [] }, { id: 'steel-sword', name: 'Steel Sword', price: 180, about: 'A better blade.', delta: [{ label: 'Attack', from: 6, to: 11 }] }, { id: 'plate', name: 'Plate', price: 400, about: 'Heavy and slow.', delta: [{ label: 'Defence', from: 5, to: 12 }, { label: 'Speed', from: 0, to: -3 }], disabled: true }],
    sell: [{ id: 'bomb', name: 'Fire Bomb', price: 15 }, { id: 'ether', name: 'Ether', price: 20 }],
  },
  quests: [
    { id: 'gate', name: 'The East Gate', state: 'on', about: 'The gatehouse holds the way out of the vale.', steps: [{ text: 'Find the crest key', done: true }, { text: 'Open the east gate', done: false }] },
    { id: 'hound', name: 'A Hound Loose', state: 'on', about: 'A farmer\'s hound ran into the quarry.', steps: [{ text: 'Search the quarry', done: false }] },
    { id: 'well', name: 'The Old Well', state: 'done', about: 'Water again in the square.', steps: [{ text: 'Clear the well', done: true }] },
  ],
  // the live game, across the kinds of game: a fight, a race, a firefight, a field, a match, a cutscene
  versus: { p1: { name: 'Ayla', hp: 620, hpMax: 1000, ghost: 780, rounds: 1, super: 2, superMax: 3 }, p2: { name: 'Bram', hp: 410, hpMax: 1000, ghost: 410, rounds: 1, super: 1, superMax: 3 }, time: 47, combo: 7 },
  // a fighting game's (idioms-fight.js): the two sides, the round, the callouts and the announcer, training, the roster,
  // the command list and the match's end
  fight: {
    p1: { tag: 'P1', name: 'Ayla', style: 'Rushdown', hp: 620, hpMax: 1000, ghost: 780, rounds: 1, super: 2.4, stock: 2, guard: 640, burst: 1, combo: 7, comboDamage: 238,
      calls: [{ id: 'c1', text: 'Counter', sub: '+62', weight: 'normal' }, { id: 'c2', text: 'Spark', sub: '+141', weight: 'major', tier: 'rare' }] },
    p2: { tag: 'P2', name: 'Bram', style: 'Grappler', hp: 410, hpMax: 1000, ghost: 410, rounds: 1, super: 1.3, stock: 1, guard: 1000, burst: 0, combo: 0, comboDamage: 0, calls: [{ id: 'c3', text: 'Reversal', weight: 'normal' }] },
    time: 47, round: 3, toWin: 2, stocks: 3, guardMax: 1000, arena: 'Training ground',
    announcer: [{ id: 'r3', text: 'Final round', weight: 'decisive' }, { id: 'go', text: 'Fight!', weight: 'decisive' }],
    pausedBy: { tag: 'P1', side: 0 },
    roster: [
      { id: 'ayla', name: 'Ayla', style: 'Rushdown', stats: [{ label: 'Speed', value: 5, max: 5 }, { label: 'Power', value: 3, max: 5 }, { label: 'Reach', value: 2, max: 5 }] },
      { id: 'bram', name: 'Bram', style: 'Grappler', stats: [{ label: 'Speed', value: 2, max: 5 }, { label: 'Power', value: 5, max: 5 }, { label: 'Reach', value: 3, max: 5 }] },
      { id: 'kesh', name: 'Kesh', style: 'Zoner', stats: [{ label: 'Speed', value: 3, max: 5 }, { label: 'Power', value: 3, max: 5 }, { label: 'Reach', value: 5, max: 5 }] },
      { id: 'mira', name: 'Mira', style: 'All-rounder', stats: [{ label: 'Speed', value: 4, max: 5 }, { label: 'Power', value: 4, max: 5 }, { label: 'Reach', value: 3, max: 5 }] },
    ],
    moves: [
      { label: 'Normals', moves: [
        { name: 'Jab', input: 'LP', about: 'The fastest button: it interrupts pressure.', data: [{ what: 'Startup', value: 4 }, { what: 'Active', value: 2 }, { what: 'Recovery', value: 7 }, { what: 'On hit', value: '+4' }, { what: 'On block', value: '+1' }, { what: 'Damage', value: 30 }] },
        { name: 'Sweep', input: '↓ HK', about: 'A low that knocks down; punished on block.', data: [{ what: 'Startup', value: 9 }, { what: 'Active', value: 3 }, { what: 'Recovery', value: 20 }, { what: 'On hit', value: 'KD' }, { what: 'On block', value: '-12' }, { what: 'Damage', value: 90 }] },
      ] },
      { label: 'Specials', moves: [
        { name: 'Rising strike', input: '→↓↘ P', about: 'The invincible reversal: it beats everything but a block.', data: [{ what: 'Startup', value: 3 }, { what: 'Active', value: 8 }, { what: 'Recovery', value: 'land' }, { what: 'On block', value: '-34' }, { what: 'Damage', value: 90 }] },
      ] },
    ],
    training: {
      inputs: [{ text: '→↓↘ + HP' }, { text: '↓ + LK' }, { text: '← (12f)' }],
      frames: [{ value: '1', variant: 'muted' }, { value: '2', variant: 'muted' }, { value: '3', variant: 'muted' }, { value: '4', variant: 'strong' }, { value: '5', variant: 'strong' }, { value: '6', variant: 'plain' }, { value: '7', variant: 'plain' }],
      advantage: '+1', stats: [{ label: 'Damage', value: 238 }, { label: 'Hits', value: 7 }, { label: 'Max combo', value: 312 }],
      dummy: 'Stand', block: 'After first hit', counter: false, boxes: true, meter: true,
      settings: [
        { kind: 'cycler', label: 'Dummy', var: 'fight.training.dummy', options: ['Stand', 'Crouch', 'Jump', 'CPU', 'Record'] },
        { kind: 'cycler', label: 'Guard', var: 'fight.training.block', options: ['None', 'All', 'After first hit', 'Random'] },
        { kind: 'toggle', label: 'Counter hits', var: 'fight.training.counter' },
        { kind: 'toggle', label: 'Hitboxes', var: 'fight.training.boxes' },
        { kind: 'toggle', label: 'Frame meter', var: 'fight.training.meter' },
      ],
    },
    results: { outcome: 'Ayla wins', winner: 'Ayla', tag: 'P1', side: 0, quote: 'You blinked first.', stats: [{ label: 'Damage', value: 1000 }, { label: 'Max combo', value: 312 }, { label: 'Counters', value: 4 }, { label: 'Sparks', value: 1 }] },
  },
  race: { position: '3/8', lap: '2/3', speed: 142, speedMax: 240, time: 83, best: 79 },
  shooter: {
    threats: [{ bearing: 130 }, { bearing: 250 }],
    offscreen: [{ x: 1.25, y: 0.4, kind: 'goal', label: 'Extract' }, { x: -0.15, y: 0.75, kind: 'foe' }, { x: 0.5, y: -0.3, kind: 'ally', label: 'Isa' }],
    locks: [{ x: 0.64, y: 0.38, name: 'Drone', range: '40 m' }],
  },
  scoreboard: [
    { id: 'ayla', name: 'Ayla', team: 'Red', score: 1450, kills: 12, deaths: 3, self: true, side: 0 }, { id: 'bram', name: 'Bram', team: 'Red', score: 1210, kills: 9, deaths: 5, side: 0 },
    { id: 'isa', name: 'Isa', team: 'Blue', score: 1380, kills: 11, deaths: 4, side: 1 }, { id: 'rook', name: 'Rook', team: 'Blue', score: 990, kills: 6, deaths: 7, side: 1 },
  ],
  abilities: [{ name: 'Dash', key: 'Q', cooldown: 0 }, { name: 'Fire Bolt', key: 'E', cooldown: 0.6 }, { name: 'Ward', key: 'R', cooldown: 0, count: '2' }, { name: 'Ultimate', key: 'F', cooldown: 1 }],
  hotbar: [{ name: 'Pickaxe', key: '1', active: true }, { name: 'Torch', key: '2', count: '12' }, { name: 'Bread', key: '3', count: '4' }, { name: 'Rope', key: '4' }, { name: '', key: '5' }, { name: '', key: '6' }],
  resources: [{ label: 'Wood', value: 320, icon: 'wood' }, { label: 'Stone', value: 140, icon: 'stone' }, { label: 'Gold', value: 85, icon: 'gold' }, { label: 'Pop', value: '14/20', icon: 'people' }],
  unit: { name: 'Isa', cls: 'Ranger', hp: 18, hpMax: 24, move: 5, atk: 7, range: 3 },
  forecast: [{ what: 'Damage', you: 9, them: 4 }, { what: 'Hit %', you: 82, them: 61 }, { what: 'Crit %', you: 7, them: 2 }, { what: 'Counters', you: '—', them: 'yes' }],
  actions: [{ label: 'Move', then: { emit: 'act:move' } }, { label: 'Attack', then: { emit: 'act:attack' } }, { label: 'Skill', then: { emit: 'act:skill' } }, { label: 'Item', then: { emit: 'act:item' } }, { label: 'Wait', then: { emit: 'act:wait' } }],
  commands: [
    { name: 'Build', key: 'B', then: { emit: 'cmd:build' } }, { name: 'Train', key: 'T', then: { emit: 'cmd:train' } }, { name: 'Gather', key: 'G', then: { emit: 'cmd:gather' } },
    { name: 'Patrol', key: 'P', then: { emit: 'cmd:patrol' } }, { name: 'Hold', key: 'H', then: { emit: 'cmd:hold' } }, { name: 'Stop', key: 'S', then: { emit: 'cmd:stop' } },
    { name: 'Upgrade', key: 'U', disabled: true }, { name: 'Rally', key: 'R', then: { emit: 'cmd:rally' } },
  ],
  selection: { name: 'Barracks', hp: 800, hpMax: 1000, queue: [{ name: 'Spear', progress: 0.6 }, { name: 'Spear', progress: 0 }] },
  td: { wave: '7/20', lives: 14, livesMax: 20, money: 260 },
  lowerThird: { show: true, name: 'Isa', role: 'Ranger · 12 points' },
  cutscene: { show: true, who: 'Keeper', line: 'The gate has not opened in a hundred years.', skip: 'Hold to skip' },
  questToasts: [{ id: 'q1', text: 'Quest begun: The East Gate', weight: 'major' }, { id: 'q2', text: 'Step done: Find the crest key' }],
  achievements: [{ id: 'a1', text: 'First Blood', sub: 'Achievement unlocked', icon: 'Sword' }, { id: 'a2', text: 'Untouchable', sub: 'Rare achievement', icon: 'Shield', tier: 'rare', weight: 'major' }],
  labels: [{ x: 0.3, y: 0.58, text: 'Crest Key' }, { x: 0.72, y: 0.5, text: 'Keeper' }, { x: 0.5, y: 0.34, text: 'East Gate' }],
  stealth: { state: 'searching', level: 62, max: 100 },
  touch: ['A', 'B', 'X', 'Y'],
  // a match's end as contest-results.js contestResults hands it on (a tennis match: the points won first)
  match: { home: 'North', away: 'South', homeScore: '2', awayScore: '1', clock: 1325, period: 'Q3', result: {
    outcome: 'Won',
    scores: [{ name: 'Ayla', value: '52', side: 0, self: true }, { name: 'Bram', value: '41', side: 1, self: false }],
    columns: [{ key: 'words', label: '' }, { key: 'c0', label: 'Ayla', align: 'right' }, { key: 'c1', label: 'Bram', align: 'right' }],
    rows: [{ words: 'points won', c0: '52', c1: '41', lead: 'c0' }, { words: 'aces', c0: '6', c1: '6', lead: null }, { words: 'double faults', c0: '1', c1: '4', lead: 'c0' }, { words: '1st serve in', c0: '64%', c1: '58%', lead: 'c0' }, { words: 'fastest serve', c0: '178 km/h', c1: '191 km/h', lead: 'c1' }],
  } },
  battle: {
    message: 'The Warden draws its blade.',
    commands: [{ label: 'Attack', then: { emit: 'cmd:attack' } }, { label: 'Skill', then: { emit: 'cmd:skill' } }, { label: 'Item', then: { emit: 'cmd:item' } }, { label: 'Guard', then: { emit: 'cmd:guard' } }, { label: 'Flee', then: { emit: 'cmd:flee' } }],
    turns: [{ name: 'Ayla', variant: 'strong', turn: true }, { name: 'Warden', variant: 'muted' }, { name: 'Rook', variant: 'plain' }, { name: 'Hound', variant: 'muted' }, { name: 'Wren', variant: 'plain' }],
    party: [{ name: 'Ayla', hp: 64, hpMax: 80, mp: 10, mpMax: 20, active: true }, { name: 'Rook', hp: 12, hpMax: 52, mp: 40, mpMax: 44 }, { name: 'Wren', hp: 47, hpMax: 58, mp: 8, mpMax: 16 }],
    foes: [{ id: 'g1', name: 'Warden', hp: 30, hpMax: 40, state: 'combat' }, { id: 'g3', name: 'Hound', hp: 8, hpMax: 22, state: 'combat' }],
  },
  talk: { who: 'Keeper', text: 'You came by the garden gate. Few do. What brings you to the vale?', choices: [{ label: 'The east gate.', then: { emit: 'talk:gate' } }, { label: 'Who lives here?', then: { emit: 'talk:who' } }, { label: 'Goodbye.', then: { close: true } }] },
});

// A GAME IN THREE LANGUAGES (a spec's `languages`), for the board's frames: each its own name and some of the runtime's
// words; a word one lacks reads in English, so the board shows the fallback too
export const SAMPLE_LANGUAGES = Object.freeze({
  en: { languageName: 'English' },
  ja: { languageName: '日本語', select: '決定', back: '戻る', change: '変更', tabs: 'タブ', resume: '再開', language: '言語', resetDefaults: '初期設定に戻す', loading: 'ロード中', tip: 'ヒント', tips: 'ヒント', stillLoading: 'まだ読み込んでいます…', retry: 'もう一度', continue: 'つづける', rank: 'ランク', party: 'パーティー', status: 'ステータス', equip: 'そうび', skills: 'スキル', nothingHere: '何もありません', more: 'ほか{n}件', on: 'オン', off: 'オフ' },
  es: { languageName: 'Español', select: 'Seleccionar', back: 'Atrás', change: 'Cambiar', tabs: 'Pestañas', resume: 'Reanudar', language: 'Idioma', resetDefaults: 'Restablecer', loading: 'Cargando', tip: 'Consejo', tips: 'Consejos', stillLoading: 'Sigue cargando…', retry: 'Reintentar', continue: 'Continuar', rank: 'Rango', party: 'Grupo', nothingHere: 'Aquí no hay nada', more: '{n} más', on: 'Sí', off: 'No' },
});

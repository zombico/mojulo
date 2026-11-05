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
  load: { progress: 64, ready: false, place: 'The Lower Vale', tip: 'Guarding halves the next blow.' },
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
  feed: [{ text: 'Picked up 3 arrows' }, { text: 'Ayla reached level 7' }, { text: 'Warden spotted you' }],
  prompt: { show: true, action: 'E', label: 'Open the gate' },
  banner: { show: true, title: 'Phase 2', sub: 'The Hollow King rises' },
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
    { action: 'jump', label: 'Jump', keys: ['Space', 'A'] },
    { action: 'attack', label: 'Attack', keys: ['J', 'X'] },
    { action: 'guard', label: 'Guard', keys: ['K', 'LB'] },
    { action: 'interact', label: 'Interact', keys: ['E', 'Y'] },
    { action: 'map', label: 'Map', keys: ['M', 'Back'] },
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
  talk: { who: 'Keeper', text: 'You came by the garden gate. Few do. What brings you to the vale?', choices: [{ label: 'The east gate.', then: { emit: 'talk:gate' } }, { label: 'Who lives here?', then: { emit: 'talk:who' } }, { label: 'Goodbye.', then: { close: true } }] },
});

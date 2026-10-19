/**
 * schemes.js — the control schemes: what a player means, and the controls of each device that say it.
 *
 * A SCHEME is one paradigm of play (a 3D pilot, a falling-block board, a grid puzzle, a point-and-click
 * scene, a menu). Its ACTIONS are intents ("jump", "rotate clockwise"), never keys; the runtime reads the
 * intent and the scheme says which controls serve it. Defaults follow the conventions each genre's players
 * already carry (WASD + mouse, the guideline falling-block layout, arrows + Enter + Esc for menus, left stick
 * moves and right stick turns in VR), so a new game asks nothing of its player the genre has not taught them.
 *
 * Plain data, JSON all the way down: the page embeds a scheme as is (controls-kernel.js reads it in the
 * browser and in Node alike), and a remap is an override over the same ids.
 *
 *   action: {
 *     id, label,                 // the intent and how a menu names it
 *     group,                     // the remap menu's section
 *     bind: { <family>: [primary, secondary] },   // controls of each device family (devices.js), at most two
 *     hold?: true,               // read held, not on the press edge (the legend says "(hold)")
 *     in: [context],             // where it is live; two actions may share a control only in different contexts
 *   }
 *
 * A family missing from `bind` simply cannot do that action; adding a device family is a devices.js entry plus
 * bindings here, never a new field. `legend` holds the pause sheet's rows per family, read off the live
 * bindings (controls-kernel.js#legend), so a remapped control relabels itself.
 */

const MOVE = ['ground', 'space', 'glide', 'vehicle'];
const ARMED = ['ground', 'space'];

// a move row of four directions, used by every family's legend
const MOVE4 = ['moveForward', 'turnLeft', 'moveBack', 'turnRight'];
const LOOK4 = ['lookUp', 'lookLeft', 'lookDown', 'lookRight'];

const PILOT = {
  id: 'pilot',
  label: '3D pilot: walk, platform, suit, glide, drive, fly',
  // `reach`: standing somewhere usable (a cue's use place); an overlay on the others, where interact takes its controls
  contexts: ['ground', 'space', 'glide', 'vehicle', 'spectate', 'reach'],
  actions: [
    // a pad's left stick X turns in a tank-turn world and strafes under a mouselook camera (the runtime picks);
    // in VR the left thumbstick walks and strafes and the right one turns, the comfort convention
    { id: 'moveForward', label: 'forward', group: 'move', in: [...MOVE, 'spectate'],
      bind: { keyboard: ['KeyW', 'ArrowUp'], gamepad: ['leftY-'], xr: ['left.thumbstickY-'], sim: ['accelerator'] } },
    { id: 'moveBack', label: 'back', group: 'move', in: [...MOVE, 'spectate'],
      bind: { keyboard: ['KeyS', 'ArrowDown'], gamepad: ['leftY+'], xr: ['left.thumbstickY+'], sim: ['brake'] } },
    { id: 'turnLeft', label: 'turn left', group: 'move', in: [...MOVE, 'spectate'],
      bind: { keyboard: ['KeyA', 'ArrowLeft'], gamepad: ['leftX-'], xr: ['right.thumbstickX-'], sim: ['steering-'] } },
    { id: 'turnRight', label: 'turn right', group: 'move', in: [...MOVE, 'spectate'],
      bind: { keyboard: ['KeyD', 'ArrowRight'], gamepad: ['leftX+'], xr: ['right.thumbstickX+'], sim: ['steering+'] } },
    { id: 'strafeLeft', label: 'strafe left', group: 'move', in: MOVE, bind: { keyboard: ['KeyQ'], xr: ['left.thumbstickX-'] } },
    { id: 'strafeRight', label: 'strafe right', group: 'move', in: MOVE, bind: { keyboard: ['KeyE'], xr: ['left.thumbstickX+'] } },
    // look keys are unbound by default (the mouse looks); binding them gives a keyboard-only player the camera
    { id: 'lookUp', label: 'look up', group: 'camera', in: [...MOVE, 'spectate'], bind: { keyboard: [], gamepad: ['rightY-'] } },
    { id: 'lookDown', label: 'look down', group: 'camera', in: [...MOVE, 'spectate'], bind: { keyboard: [], gamepad: ['rightY+'] } },
    { id: 'lookLeft', label: 'look left', group: 'camera', in: [...MOVE, 'spectate'], bind: { keyboard: [], gamepad: ['rightX-'] } },
    { id: 'lookRight', label: 'look right', group: 'camera', in: [...MOVE, 'spectate'], bind: { keyboard: [], gamepad: ['rightX+'] } },
    { id: 'jump', label: 'jump / ascend', group: 'move', in: MOVE, bind: { keyboard: ['Space'], gamepad: ['south'], xr: ['right.primary'] } },
    { id: 'descend', label: 'descend (glide)', group: 'move', in: ['glide'], bind: { keyboard: ['Shift'] } },
    { id: 'kneel', label: 'kneel / descend', group: 'move', hold: true, in: ARMED, bind: { keyboard: ['KeyX'], gamepad: ['east', 'lb'], xr: ['right.secondary'] } },
    { id: 'boost', label: 'boost thrusters', group: 'move', hold: true, in: ARMED, bind: { keyboard: ['KeyF'], gamepad: ['lt'], xr: ['left.trigger'] } },
    { id: 'tackle', label: 'tackle', group: 'combat', in: ['ground'], bind: { keyboard: ['Shift'], gamepad: ['north'], xr: ['left.primary'] } },
    { id: 'fire', label: 'fire', group: 'combat', hold: true, in: ARMED, bind: { mouse: ['left'], gamepad: ['rt'], xr: ['right.trigger'], sim: ['button1'] } },
    { id: 'cycleWeapon', label: 'next weapon', group: 'combat', in: ARMED, bind: { keyboard: ['KeyR'], gamepad: ['rb'], xr: ['right.squeeze'] } },
    { id: 'weapon1', label: 'weapon 1', group: 'combat', in: ARMED, bind: { keyboard: ['Digit1'] } },
    { id: 'weapon2', label: 'weapon 2', group: 'combat', in: ARMED, bind: { keyboard: ['Digit2'] } },
    { id: 'weapon3', label: 'weapon 3', group: 'combat', in: ARMED, bind: { keyboard: ['Digit3'] } },
    { id: 'weapon4', label: 'weapon 4', group: 'combat', in: ARMED, bind: { keyboard: ['Digit4'] } },
    { id: 'weapon5', label: 'weapon 5', group: 'combat', in: ARMED, bind: { keyboard: ['Digit5'] } },
    // a craft's (the fly rule's missiles: combat-ranged.js stepMissiles): a homing missile on the lock, a flare to break one
    { id: 'missile', label: 'missile', group: 'combat', in: ['vehicle'], bind: { keyboard: ['KeyR'], mouse: ['right'], gamepad: ['rb'] } },
    { id: 'flare', label: 'flare', group: 'combat', in: ['vehicle'], bind: { keyboard: ['KeyX'], gamepad: ['lb'] } },
    { id: 'lock', label: 'target lock', group: 'combat', in: ARMED, bind: { keyboard: ['KeyC'], mouse: ['middle'], gamepad: ['rs'], xr: ['right.thumbstick'] } },
    { id: 'swapSuit', label: 'switch suit', group: 'world', in: MOVE, bind: { keyboard: ['KeyT'], gamepad: ['up'], xr: ['left.secondary'] } },
    // a body with forms (controllable/forms.js): robot ↔ vehicle, on the press
    { id: 'transform', label: 'transform', group: 'move', in: MOVE, bind: { keyboard: ['KeyB'], gamepad: ['ls'] } },
    { id: 'aiToggle', label: 'AI attack on / off', group: 'world', in: MOVE, bind: { keyboard: ['KeyG'], gamepad: ['select'] } },
    { id: 'reverseView', label: 'reverse view', group: 'camera', in: MOVE, bind: { keyboard: ['KeyV'] } },
    { id: 'spectateNext', label: 'watch next fighter', group: 'camera', in: ['spectate'], bind: { keyboard: ['Tab'] } },
    { id: 'spectateLock', label: 'lock / free camera', group: 'camera', in: ['spectate'], bind: { keyboard: ['KeyF'] } },
    { id: 'pause', label: 'pause', group: 'system', in: [...MOVE, 'spectate'], bind: { keyboard: ['Escape'], gamepad: ['start'] } },
    // use / talk / open, live only in reach: E strafes anywhere else, and the runtime keeps it from strafing in reach
    { id: 'interact', label: 'use / talk', group: 'world', in: ['reach'], bind: { keyboard: ['KeyE'], gamepad: ['west'], xr: ['left.squeeze'] } },
  ],
  // the pause sheet, one row list per family (keyboard always, the others once that device has spoken).
  // `ids` joins each action's primary control with ' / ' (or `sep`); `dev` reads another family (the mouse)
  // and `with` appends one; `quad` reads four directions (W A S D, "arrows", "left stick"); `range` reads a
  // run of digits as 1–5; `chord` is a held button with the face buttons it deals; `text` is a fixed word.
  // `label` may vary by live flag ({ _, space, vehicle }); `when` / `unless` name live world flags.
  legend: {
    keyboard: [
      { quad: MOVE4, label: { _: 'move & turn', space: 'thrust & turn', vehicle: 'throttle & steer' } },
      { text: { _: 'mouse drag', mouselook: 'mouse · click to capture' }, label: 'look / aim' },
      { ids: ['strafeRight', 'strafeLeft'], label: 'strafe' },
      { ids: ['jump', 'kneel'], label: 'ascend / descend', when: 'space' },
      { ids: ['jump'], label: 'jump', unless: 'space' },
      { ids: ['boost'], label: 'boost thrusters' },
      { ids: ['kneel'], label: 'kneel', when: 'kneel', unless: 'space' },
      { ids: ['tackle'], label: 'tackle', when: 'tackle', unless: 'space' },
      { ids: ['fire'], dev: 'mouse', label: 'fire', when: 'armed' },
      { ids: ['cycleWeapon'], range: ['weapon1', 'weapon2', 'weapon3', 'weapon4', 'weapon5'], label: 'cycle · select weapon', when: 'armed' },
      { ids: ['lock'], with: 'mouse', label: 'target lock', when: 'lock' },
      { ids: ['transform'], label: 'transform', when: 'forms' },
      { ids: ['swapSuit'], label: 'switch suit', when: 'suits' },
      { ids: ['aiToggle'], label: 'AI attack on / off', when: 'ai' },
      { ids: ['reverseView'], label: 'reverse view', when: 'follow' },
      { ids: ['interact'], label: 'use / talk', when: 'interact' },
    ],
    gamepad: [
      { quad: MOVE4, prefix: '🎮 ', label: { _: 'move', space: 'thrust & strafe', vehicle: 'steer' } },
      { quad: LOOK4, label: 'look / aim' },
      { ids: ['fire', 'boost'], label: { _: 'fire / boost (tap-tap: dodge)', vehicle: 'throttle / brake' } },
      { ids: ['cycleWeapon'], label: 'tap: next weapon · hold: selector', when: 'armed' },
      { chord: 'cycleWeapon', faces: ['west', 'north'], label: 'main weapon / main melee', when: 'armed' },
      { ids: ['jump', 'kneel'], label: 'ascend / descend', when: 'space' },
      { ids: ['jump', 'tackle'], sep: ' · ', label: 'jump · tackle', unless: 'space' },
      { ids: ['swapSuit', 'aiToggle'], sep: ' · ', label: 'switch suit · AI toggle' },
      { ids: ['lock'], label: 'target lock', when: 'lock' },
      { ids: ['transform'], label: 'transform', when: 'forms' },
      { ids: ['interact'], label: 'use / talk', when: 'interact' },
      { ids: ['pause'], label: 'pause' },
    ],
    xr: [
      { quad: ['moveForward', 'strafeLeft', 'moveBack', 'strafeRight'], label: 'move' },
      { ids: ['turnLeft', 'turnRight'], label: 'turn' },
      { ids: ['jump', 'kneel'], sep: ' · ', label: 'jump · kneel' },
      { ids: ['fire'], label: 'fire', when: 'armed' },
      { ids: ['cycleWeapon'], label: 'next weapon', when: 'armed' },
    ],
    sim: [
      { ids: ['moveForward', 'moveBack'], label: 'throttle / brake', when: 'vehicle' },
      { ids: ['turnLeft', 'turnRight'], label: 'steer', when: 'vehicle' },
    ],
  },
};

// The guideline layout every falling-block player knows: arrows move and soft-drop, Up / X rotate
// clockwise, Z / Ctrl counter-clockwise, Space hard-drops, C / Shift hold.
const FALLING_BLOCK = {
  id: 'falling-block',
  label: 'falling-block board',
  contexts: ['play'],
  actions: [
    { id: 'left', label: 'move left', group: 'move', in: ['play'], bind: { keyboard: ['ArrowLeft'], gamepad: ['left', 'leftX-'] } },
    { id: 'right', label: 'move right', group: 'move', in: ['play'], bind: { keyboard: ['ArrowRight'], gamepad: ['right', 'leftX+'] } },
    { id: 'softDrop', label: 'soft drop', group: 'move', in: ['play'], bind: { keyboard: ['ArrowDown'], gamepad: ['down', 'leftY+'] } },
    { id: 'hardDrop', label: 'hard drop', group: 'move', in: ['play'], bind: { keyboard: ['Space'], gamepad: ['up'] } },
    { id: 'cw', label: 'rotate clockwise', group: 'rotate', in: ['play'], bind: { keyboard: ['ArrowUp', 'KeyX'], gamepad: ['east'] } },
    { id: 'ccw', label: 'rotate counter-clockwise', group: 'rotate', in: ['play'], bind: { keyboard: ['KeyZ', 'Control'], gamepad: ['south'] } },
    { id: 'hold', label: 'hold piece', group: 'rotate', in: ['play'], bind: { keyboard: ['KeyC', 'Shift'], gamepad: ['lb', 'rb'] } },
    { id: 'restart', label: 'restart', group: 'system', in: ['play'], bind: { keyboard: ['Enter'], gamepad: ['start'] } },
  ],
  legend: {
    keyboard: [
      { ids: ['left', 'right'], label: 'move' },
      { ids: ['softDrop'], label: 'soft drop' },
      { ids: ['hardDrop'], label: 'hard drop' },
      { all: ['ccw', 'cw'], label: 'rotate' },
      { ids: ['hold'], label: 'hold' },
      { ids: ['restart'], label: 'restart' },
    ],
    gamepad: [
      { ids: ['left', 'right'], label: 'move' },
      { ids: ['softDrop', 'hardDrop'], label: 'soft / hard drop' },
      { ids: ['ccw', 'cw'], label: 'rotate' },
      { ids: ['hold'], label: 'hold' },
      { ids: ['restart'], label: 'restart' },
    ],
  },
};

// Grid and turn-based puzzles: one step per press, confirm and back, undo.
const GRID = {
  id: 'grid',
  label: 'grid / turn-based puzzle',
  contexts: ['play'],
  actions: [
    { id: 'up', label: 'up', group: 'move', in: ['play'], bind: { keyboard: ['ArrowUp', 'KeyW'], gamepad: ['up', 'leftY-'] } },
    { id: 'down', label: 'down', group: 'move', in: ['play'], bind: { keyboard: ['ArrowDown', 'KeyS'], gamepad: ['down', 'leftY+'] } },
    { id: 'left', label: 'left', group: 'move', in: ['play'], bind: { keyboard: ['ArrowLeft', 'KeyA'], gamepad: ['left', 'leftX-'] } },
    { id: 'right', label: 'right', group: 'move', in: ['play'], bind: { keyboard: ['ArrowRight', 'KeyD'], gamepad: ['right', 'leftX+'] } },
    { id: 'confirm', label: 'select / act', group: 'act', in: ['play'], bind: { keyboard: ['Enter', 'Space'], mouse: ['left'], gamepad: ['confirm'], xr: ['right.trigger'] } },
    { id: 'back', label: 'back / cancel', group: 'act', in: ['play'], bind: { keyboard: ['Escape', 'Backspace'], mouse: ['right'], gamepad: ['cancel'], xr: ['right.secondary'] } },
    { id: 'undo', label: 'undo', group: 'act', in: ['play'], bind: { keyboard: ['KeyZ', 'KeyU'], gamepad: ['west'] } },
    { id: 'restart', label: 'restart', group: 'system', in: ['play'], bind: { keyboard: ['KeyR'], gamepad: ['select'] } },
  ],
  legend: {
    keyboard: [
      { quad: ['up', 'left', 'down', 'right'], label: 'move' },
      { ids: ['confirm'], label: 'select' },
      { ids: ['back'], label: 'back' },
      { ids: ['undo'], label: 'undo' },
      { ids: ['restart'], label: 'restart' },
    ],
    gamepad: [
      { quad: ['up', 'left', 'down', 'right'], label: 'move' },
      { ids: ['confirm', 'back'], label: 'select / back' },
      { ids: ['undo'], label: 'undo' },
    ],
  },
};

// Point-and-click and fixed-camera (walkmesh) scenes: the pointer is the verb, the keyboard walks the
// hotspots in order so nothing is pointer-only; in VR the pointer is the controller's ray.
const POINT = {
  id: 'point',
  label: 'point-and-click / fixed camera',
  contexts: ['play'],
  actions: [
    { id: 'interact', label: 'walk to / interact', group: 'act', in: ['play'], bind: { keyboard: ['Enter', 'Space'], mouse: ['left'], gamepad: ['confirm'], xr: ['right.trigger', 'left.trigger'] } },
    { id: 'nextHotspot', label: 'next hotspot', group: 'act', in: ['play'], bind: { keyboard: ['Tab'], gamepad: ['rb'] } },
    { id: 'prevHotspot', label: 'previous hotspot', group: 'act', in: ['play'], bind: { keyboard: [], gamepad: ['lb'] } },
    { id: 'back', label: 'back / cancel', group: 'act', in: ['play'], bind: { keyboard: ['Escape'], mouse: ['right'], gamepad: ['cancel'], xr: ['right.secondary'] } },
    { id: 'inventory', label: 'inventory', group: 'act', in: ['play'], bind: { keyboard: ['KeyI'], gamepad: ['north'], xr: ['left.secondary'] } },
  ],
  legend: {
    keyboard: [
      { ids: ['interact'], with: 'mouse', label: 'walk to / interact' },
      { text: { _: 'Tab / Shift+Tab' }, label: 'next / previous hotspot' },
      { ids: ['back'], label: 'back' },
      { ids: ['inventory'], label: 'inventory' },
    ],
    gamepad: [
      { ids: ['interact', 'back'], label: 'interact / back' },
      { ids: ['nextHotspot', 'prevHotspot'], label: 'next / previous hotspot' },
    ],
  },
};

// Menus everywhere: arrows (or W A S D) or Tab to move, Enter / Space to accept, Esc to go back. On a pad accept and back
// are roles, not positions: the bottom button accepts on Xbox and PlayStation, A on the right does on Nintendo.
const MENU = {
  id: 'menu',
  label: 'menus and overlays',
  contexts: ['menu'],
  actions: [
    { id: 'up', label: 'up', group: 'navigate', in: ['menu'], bind: { keyboard: ['ArrowUp', 'KeyW'], gamepad: ['up', 'leftY-'], xr: ['right.thumbstickY-'] } },
    { id: 'down', label: 'down', group: 'navigate', in: ['menu'], bind: { keyboard: ['ArrowDown', 'KeyS'], gamepad: ['down', 'leftY+'], xr: ['right.thumbstickY+'] } },
    { id: 'left', label: 'left', group: 'navigate', in: ['menu'], bind: { keyboard: ['ArrowLeft', 'KeyA'], gamepad: ['left', 'leftX-'], xr: ['right.thumbstickX-'] } },
    { id: 'right', label: 'right', group: 'navigate', in: ['menu'], bind: { keyboard: ['ArrowRight', 'KeyD'], gamepad: ['right', 'leftX+'], xr: ['right.thumbstickX+'] } },
    { id: 'accept', label: 'accept', group: 'navigate', in: ['menu'], bind: { keyboard: ['Enter', 'Space'], gamepad: ['confirm'], xr: ['right.trigger'] } },
    { id: 'back', label: 'back', group: 'navigate', in: ['menu'], bind: { keyboard: ['Escape', 'Backspace'], gamepad: ['cancel'], xr: ['right.secondary'] } },
    { id: 'tabNext', label: 'next tab', group: 'navigate', in: ['menu'], bind: { keyboard: ['BracketRight'], gamepad: ['rb'] } },
    { id: 'tabPrev', label: 'previous tab', group: 'navigate', in: ['menu'], bind: { keyboard: ['BracketLeft'], gamepad: ['lb'] } },
  ],
  legend: {
    keyboard: [
      { text: { _: 'arrows / Tab' }, label: 'move' },
      { ids: ['accept'], label: 'accept' },
      { ids: ['back'], label: 'back' },
    ],
    gamepad: [
      { ids: ['accept', 'back'], label: 'accept / back' },
    ],
  },
};

// The game shell around every level: its own system actions, read by the shell page itself. Keys belong to the
// level frame (it has focus while a level runs), so the shell binds the pad only.
const SHELL = {
  id: 'shell',
  label: 'game shell',
  contexts: ['level'],
  actions: [
    { id: 'pause', label: 'pause / resume', group: 'system', in: ['level'], bind: { gamepad: ['start'] } },
  ],
  legend: { gamepad: [{ ids: ['pause'], label: 'pause' }] },
};

export const SCHEMES = { pilot: PILOT, 'falling-block': FALLING_BLOCK, grid: GRID, point: POINT, menu: MENU, shell: SHELL };
export const SCHEME_IDS = Object.keys(SCHEMES);

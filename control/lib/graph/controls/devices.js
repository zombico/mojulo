/**
 * devices.js — the input device families a control scheme can bind, each named after the standard it follows.
 *
 * The model is OpenXR's action system (also Unity's Input System and Godot's InputMap): a scheme is an action set,
 * a device family is an interaction profile, and a scheme's `bind` lists suggested bindings per family. A binding
 * is a CONTROL of one family: a key code, a button name, a half axis (`leftY-` is the left stick pushed up), or for
 * a two-handed family, `<hand>.<control>`.
 *
 * A DRIVER is what turns a device into control values: (raw device state) → read(control) → number in [-1, 1]
 * (a button reads 0..1, an axis -1..1; the kernel takes the sign off a half axis). The kernel never touches a
 * device; it reads controls through whatever driver the page has. A family whose `driver` is null is declared
 * (its controls can be bound, labelled and remapped today) and waits for its driver.
 *
 * Plain data, JSON all the way down: a page embeds the families it reads.
 */

// the W3C Gamepad "standard" mapping, by position; the names are positional so every layout shares them
const GAMEPAD_BUTTONS = ['south', 'east', 'west', 'north', 'lb', 'rb', 'lt', 'rt', 'select', 'start', 'ls', 'rs', 'up', 'down', 'left', 'right', 'home'];

export const DEVICES = {
  keyboard: {
    standard: 'UI Events KeyboardEvent.code (physical position, layout-independent)',
    driver: 'dom-keyboard',
    open: true,   // any KeyboardEvent.code; 'Shift' / 'Control' / 'Alt' / 'Meta' name either side
  },

  mouse: {
    standard: 'UI Events MouseEvent.button',
    driver: 'dom-mouse',
    buttons: { left: 0, middle: 1, right: 2, back: 3, forward: 4 },
    labels: { left: 'left mouse', middle: 'middle mouse', right: 'right mouse', back: 'mouse back', forward: 'mouse forward' },
  },

  gamepad: {
    standard: 'W3C Gamepad API, "standard" mapping (Godot and SDL use the same positional layout)',
    driver: 'gamepad-standard',
    buttons: Object.fromEntries(GAMEPAD_BUTTONS.map((n, i) => [n, i])),
    axes: { leftX: 0, leftY: 1, rightX: 2, rightY: 3 },
    sticks: { left: ['leftX', 'leftY'], right: ['rightX', 'rightY'] },
    faces: ['south', 'east', 'west', 'north'],
    // one positional name, three printed layouts (a Nintendo pad prints B where Xbox prints A)
    layouts: {
      xbox: { south: 'A', east: 'B', west: 'X', north: 'Y', lb: 'LB', rb: 'RB', lt: 'LT', rt: 'RT', select: 'select', start: 'start', ls: 'L3', rs: 'R3', home: 'home', left_stick: 'left stick', right_stick: 'right stick' },
      playstation: { south: '✕', east: '◯', west: '□', north: '△', lb: 'L1', rb: 'R1', lt: 'L2', rt: 'R2', select: 'share', start: 'options', ls: 'L3', rs: 'R3', home: 'PS', left_stick: 'left stick', right_stick: 'right stick' },
      nintendo: { south: 'B', east: 'A', west: 'Y', north: 'X', lb: 'L', rb: 'R', lt: 'ZL', rt: 'ZR', select: '−', start: '+', ls: 'L3', rs: 'R3', home: 'home', left_stick: 'left stick', right_stick: 'right stick' },
    },
    dpad: { up: 'D-pad ↑', down: 'D-pad ↓', left: 'D-pad ←', right: 'D-pad →' },
    // roles a scheme may bind instead of a position: confirm sits where the layout's players expect it
    // (the bottom button on Xbox and PlayStation, A on the right of a Nintendo pad), cancel opposite
    roles: {
      confirm: { xbox: 'south', playstation: 'south', nintendo: 'east' },
      cancel: { xbox: 'east', playstation: 'east', nintendo: 'south' },
    },
  },

  xr: {
    standard: 'WebXR Gamepads Module, "xr-standard" mapping per hand; buttons past the thumbstick follow the WebXR Input Profiles registry',
    driver: null,
    hands: ['left', 'right'],
    buttons: { trigger: 0, squeeze: 1, touchpad: 2, thumbstick: 3, primary: 4, secondary: 5 },
    axes: { touchpadX: 0, touchpadY: 1, thumbstickX: 2, thumbstickY: 3 },
    sticks: { thumbstick: ['thumbstickX', 'thumbstickY'], touchpad: ['touchpadX', 'touchpadY'] },
    // primary / secondary print per hand as the profile names them (Touch: A B on the right hand, X Y on the left)
    labels: { trigger: 'trigger', squeeze: 'grip', touchpad: 'touchpad', thumbstick: 'thumbstick click', primary: { left: 'X', right: 'A' }, secondary: { left: 'Y', right: 'B' }, thumbstick_stick: 'thumbstick', touchpad_stick: 'touchpad' },
  },

  sim: {
    standard: 'USB HID Usage Tables: Simulation Controls page (0x02), Button page (0x09), Generic Desktop hat switch (0x39)',
    driver: null,   // WebHID reports usages directly; a Gamepad API wheel ("" mapping) needs a per-device axis profile
    usages: {
      steering: 0xC8, accelerator: 0xC4, brake: 0xC5, clutch: 0xC6,
      throttle: 0xBB, rudder: 0xBA, aileron: 0xB0, elevator: 0xB8, toeBrake: 0xBF,
    },
    // a driver reports these by name (pedals read 0..1, the wheel and the stick -1..1), whatever indices the device uses
    axes: ['steering', 'accelerator', 'brake', 'clutch', 'throttle', 'rudder', 'aileron', 'elevator', 'toeBrake'],
    buttons: [...Array.from({ length: 32 }, (_, i) => 'button' + (i + 1)), 'hatUp', 'hatDown', 'hatLeft', 'hatRight'],
    labels: { steering: 'wheel', accelerator: 'accelerator', brake: 'brake', clutch: 'clutch', throttle: 'throttle', rudder: 'rudder pedals', aileron: 'stick ↔', elevator: 'stick ↕', toeBrake: 'toe brake', hatUp: 'hat ↑', hatDown: 'hat ↓', hatLeft: 'hat ←', hatRight: 'hat →' },
  },
};

export const DEVICE_IDS = Object.keys(DEVICES);

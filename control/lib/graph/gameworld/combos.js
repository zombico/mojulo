/**
 * THE COMBO MANIFEST — an action game's attacks and the strings that chain them, composed in the practice room
 * (scripts/spikes/practice-room/) and handed to the game's director: every combo the game has, each a list of beats.
 *
 * A MOVE is an attack primitive:
 *   swing    the runtime's swing it plays (worlds/controllable/combat-melee.js `swing_<dir>`, a held weapon's: neutral the
 *            hero's own cut, forward the thrust, back the two-handed cleave, left and right the rising cuts); or
 *   strike   a body's strike the hero's motion solves (hero-strike.js jab, cross; hero-box.js hook, uppercut), its clip
 *            baked on the figure by name (world-scene.js `moves`): the fist's
 *   contact  [from, to] the blow's window as shares of its length (absent: the swing's, where the hero was baked to land)
 *   role     opener (starts a string), filler (carries it on), finisher (ends it, the hardest blow), launcher (throws the
 *            foe up)
 *   frames   its length at 60 fps, wind-up to rest; its blow lands where the hero's swing was baked to land (the rule's
 *            contact window, a share of the length)
 *   cancel   the frame from which the next beat chains into the next move (absent: the move plays out; a finisher's)
 *   travel   how it covers ground: none (it stays in place), step (an advance before the blow: the lead foot, then the
 *            rear; at most 0.4 m), lunge (the lead foot driven out to land with the blow, the rear leg extending behind,
 *            then the rear foot recovering forward after it; at most 0.7 m, one stride); `m` metres
 *   damage   × the held weapon's; impact (the blow's shove: its hitstop grows with it), topple (knocks down), launch
 *   cooldown frames after it ends before it opens a string again (a heavy's: no spamming it); a press inside it is
 *            held when the wait is inside the buffer, else dropped and said
 *
 * A COMBO is { id, name, beats, moves }: `beats` the presses, L (light), H (heavy), S (special) and `.` (a pause:
 * the next press held back until the last move has ended and a breath has passed), one move a press. Combos share their
 * openings: L L L and L L H are one tree that forks at the third beat; `.` forks a string on its timing.
 *
 * THE TIMING, with forgiveness (frames): `blend` one move blends into the next this long (its travel waits it out, so no
 * foot slides: hero-swing-body.js moveClip); `buffer` a press early is remembered this long and taken at the cancel; `late`
 * a press after a move has ended still chains this long; a pause beat is a press between `pause[0]` and `pause[1]` after
 * the move ended; `rest` the frames after a FINISHER before any string opens again (the string spent: no running it
 * straight back). Held and mashed beats are named for later and refused today.
 *
 *   BASIC_COMBOS              the starter: L L L (two cuts and the cleave), H (the thrust)
 *   BASIC_ARSENAL             the starter's weapons, stepped through: the sword (BASIC_COMBOS) and the fist (L L L the
 *                             jab, the cross and the hook; H the uppercut); a weapon's `figure` is the hero it shows
 *                             (drawn: the blade in hand; sheathed: on the back)
 *   readArsenal(A) / lowerArsenal(A)   → the platform rule's `weapons`: [{ id, name, figure, reach?, damage?, moveset }],
 *                             stepped through on the weapon cycle (R, a pad's right shoulder, the mouse's back button)
 *   strikesOf(A)              → the body strikes its moves play (the figure's `moves`)
 *   readCombos(C)             → C, or throws what is wrong in words
 *   lowerCombos(C)            → the platform rule's `moveset` (seconds and shares; a tree a beat a level)
 *   comboList(C)              → [{ id, name, beats, moves: [{ id, role, swing, travel }] }] the director's list
 * Pure.
 */
export const ROLES = Object.freeze(['opener', 'filler', 'finisher', 'launcher']);
export const TRAVEL = Object.freeze(['none', 'step', 'lunge']);
export const SWINGS = Object.freeze(['neutral', 'forward', 'back', 'left', 'right']);
/** the body strikes a move may play (hero-strike.js STRIKES, hero-box.js BOX_STRIKES): the fist's */
export const STRIKES = Object.freeze(['jab', 'cross', 'hook', 'uppercut']);
// (bH: back + heavy, the heavy pressed with the stick pulled away from where the hero faces: the launcher's beat)
export const BEATS = Object.freeze(['L', 'H', 'S', 'bH', '.']);
/** beats named and not yet played: a held press (a charge) and a mashed one */
export const LATER_BEATS = Object.freeze({ 'L+': 'a held light', 'H+': 'a held heavy', 'L*': 'a mashed light', 'H*': 'a mashed heavy' });
const FPS = 60;
const r4 = (v) => Math.round(v * 1e4) / 1e4;

export const BASIC_COMBOS = Object.freeze({
  timing: { buffer: 12, late: 14, pause: [16, 50], blend: 4, rest: 30 },
  moves: {
    'cut-1': { swing: 'neutral', role: 'opener', frames: 24, cancel: 15, travel: { kind: 'step', m: 0.25 }, damage: 1 },
    'cut-2': { swing: 'left', role: 'filler', frames: 24, cancel: 15, travel: { kind: 'step', m: 0.25 }, damage: 1 },
    cleave: { swing: 'back', role: 'finisher', frames: 44, travel: { kind: 'lunge', m: 0.5 }, damage: 2, impact: 3, topple: true },
    thrust: { swing: 'forward', role: 'opener', frames: 32, travel: { kind: 'lunge', m: 0.6 }, damage: 1.5, impact: 1.5, cooldown: 40 },
    // the LAUNCHER (back + heavy): a rising cut throwing the foe up; the heavy held through it, the hero rises with it
    launcher: { swing: 'right', role: 'launcher', frames: 36, damage: 1, launch: 9, rise: true, cooldown: 30 },
    // the AIR STRING: two cuts in the air, the hero held aloft by each, and the overhead slam driving the foe down
    'air-1': { swing: 'neutral', role: 'opener', frames: 22, cancel: 13, damage: 1, air: true },
    'air-2': { swing: 'left', role: 'filler', frames: 22, cancel: 13, damage: 1, air: true },
    'air-slam': { swing: 'back', role: 'finisher', frames: 34, damage: 2, impact: 3, topple: true, slam: 16, air: true },
  },
  combos: [
    { id: 'three-cuts', name: 'Three cuts', beats: ['L', 'L', 'L'], moves: ['cut-1', 'cut-2', 'cleave'] },
    { id: 'thrust', name: 'Thrust', beats: ['H'], moves: ['thrust'] },
    { id: 'launcher', name: 'Launcher', beats: ['bH'], moves: ['launcher'] },
    { id: 'aerial-rave', name: 'Aerial rave', air: true, beats: ['L', 'L', 'L'], moves: ['air-1', 'air-2', 'air-slam'] },
  ],
});

const no = (m) => { throw new Error(`combos: ${m}`); };
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const num = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;

export function readCombos(C) {
  if (!isObj(C)) no('a combo manifest is { timing?, moves, combos }');
  for (const k of Object.keys(C)) if (!['timing', 'moves', 'combos'].includes(k)) no(`'${k}' is not part of a combo manifest (timing, moves, combos)`);
  const T = C.timing ?? {};
  if (!isObj(T)) no('timing is { buffer, late, pause: [from, to] } in frames');
  if (T.buffer !== undefined && !num(T.buffer, 0, 60)) no('timing.buffer is the frames a press is remembered early, 0 to 60');
  if (T.late !== undefined && !num(T.late, 0, 60)) no('timing.late is the frames a press after a move still chains, 0 to 60');
  if (T.blend !== undefined && !num(T.blend, 1, 20)) no('timing.blend is the frames one move blends into the next, 1 to 20');
  if (T.rest !== undefined && !num(T.rest, 0, 300)) no('timing.rest is the frames after a finisher before a string opens again, 0 to 300');
  if (T.pause !== undefined && !(Array.isArray(T.pause) && T.pause.length === 2 && num(T.pause[0], 1, 120) && num(T.pause[1], T.pause[0], 240))) no('timing.pause is [from, to] frames after a move has ended');
  if (!isObj(C.moves) || !Object.keys(C.moves).length) no('moves is { <id>: a move }, one at least');
  for (const [id, m] of Object.entries(C.moves)) {
    const at = `moves.${id}`;
    if (!isObj(m)) no(`${at} is { swing | strike, role, frames, cancel?, contact?, travel?, damage?, impact?, topple?, launch?, cooldown? }`);
    for (const k of Object.keys(m)) if (!['swing', 'strike', 'role', 'frames', 'cancel', 'contact', 'travel', 'damage', 'impact', 'topple', 'launch', 'cooldown', 'air', 'slam', 'rise'].includes(k)) no(`${at}.${k} is not part of a move`);
    if (m.air !== undefined && typeof m.air !== 'boolean') no(`${at}.air is true (a move made in the air) or false`);
    if (m.slam !== undefined && !(num(m.slam, 0, 40) && m.air)) no(`${at}.slam is the foe's speed down (m/s) an air move drives it into the ground at`);
    if (m.rise !== undefined && !(typeof m.rise === 'boolean' && m.launch > 0)) no(`${at}.rise is true on a launching move: the hero rising with the foe while the button is held`);
    if (m.cooldown !== undefined && !num(m.cooldown, 0, 300)) no(`${at}.cooldown is the frames after it ends before it opens a string again, 0 to 300`);
    if ((m.swing === undefined) === (m.strike === undefined)) no(`${at} plays a swing (${SWINGS.join(', ')}) or a strike (${STRIKES.join(', ')}), one`);
    if (m.swing !== undefined && !SWINGS.includes(m.swing)) no(`${at}.swing is the swing it plays: ${SWINGS.join(', ')}`);
    if (m.strike !== undefined && !STRIKES.includes(m.strike)) no(`${at}.strike is the body's strike it plays: ${STRIKES.join(', ')}`);
    if (m.contact !== undefined && !(Array.isArray(m.contact) && m.contact.length === 2 && num(m.contact[0], 0.05, 0.95) && num(m.contact[1], m.contact[0], 0.98))) no(`${at}.contact is [from, to], shares of its length`);
    if (!ROLES.includes(m.role)) no(`${at}.role is ${ROLES.join(', ')}`);
    if (!num(m.frames, 6, 180)) no(`${at}.frames is its length at 60 fps, 6 to 180`);
    if (m.cancel !== undefined && !num(m.cancel, 1, m.frames - 1)) no(`${at}.cancel is the frame the next beat chains from, inside its ${m.frames}`);
    if (m.travel !== undefined) {
      if (!isObj(m.travel) || !TRAVEL.includes(m.travel.kind)) no(`${at}.travel is { kind: ${TRAVEL.join(' | ')}, m }`);
      if (m.travel.kind !== 'none' && !num(m.travel.m, 0, 6)) no(`${at}.travel.m is the metres it covers, 0 to 6`);
      // (one stride: a step is an advance, the lead foot then the rear; a lunge the lead foot driven out, the rear recovering)
      if (m.travel.kind === 'step' && m.travel.m > 0.4) no(`${at}: a step covers at most 0.4 m (an advance: the lead foot, then the rear)`);
      if (m.travel.kind === 'lunge' && m.travel.m > 0.7) no(`${at}: a lunge covers at most 0.7 m (one stride, the lead foot driven out and the rear recovering)`);
    }
    for (const k of ['damage', 'impact']) if (m[k] !== undefined && !num(m[k], 0, 20)) no(`${at}.${k} is a number 0 to 20`);
    if (m.launch !== undefined && !num(m.launch, 0, 20)) no(`${at}.launch is the foe's speed up (m/s)`);
    if (m.topple !== undefined && typeof m.topple !== 'boolean') no(`${at}.topple is true or false`);
  }
  if (!Array.isArray(C.combos) || !C.combos.length) no('combos is a list, one at least');
  const ids = new Set(), paths = new Map();
  for (const [i, c] of C.combos.entries()) {
    const at = `combos[${i}]`;
    if (!isObj(c) || typeof c.id !== 'string' || !c.id) no(`${at} is { id, name?, air?, beats, moves }`);
    if (c.air !== undefined && typeof c.air !== 'boolean') no(`${at}.air is true (a string made in the air, from a jump or a launch) or false`);
    if (ids.has(c.id)) no(`${at}: '${c.id}' is named twice`);
    ids.add(c.id);
    if (!Array.isArray(c.beats) || !c.beats.length) no(`${at}.beats is a list of presses (${BEATS.join(' ')})`);
    for (const b of c.beats) {
      if (LATER_BEATS[b]) no(`${at}: '${b}' (${LATER_BEATS[b]}) is not played yet`);
      if (!BEATS.includes(b)) no(`${at}: '${b}' is no beat (${BEATS.join(', ')})`);
    }
    if (c.beats[0] === '.' || c.beats[c.beats.length - 1] === '.') no(`${at}: a pause stands between two presses`);
    if (c.beats.some((b, k) => b === '.' && c.beats[k + 1] === '.')) no(`${at}: one pause between two presses`);
    const presses = c.beats.filter((b) => b !== '.');
    if (!Array.isArray(c.moves) || c.moves.length !== presses.length) no(`${at}.moves is one move a press (${presses.length})`);
    for (const m of c.moves) if (!C.moves[m]) no(`${at}: no move '${m}'`);
    // (an air string is made of air moves, a ground string of ground moves)
    for (const m of c.moves) if (!!C.moves[m].air !== !!c.air) no(`${at}: '${m}' is ${C.moves[m].air ? 'an air move' : 'a ground move'} in ${c.air ? 'an air string' : 'a ground string'}`);
    // (two combos on the same beats are one string: they must play the same moves on their shared beats; the air's apart)
    let key = c.air ? 'air:' : '';
    let p = 0;
    for (const b of c.beats) {
      key += b;
      if (b === '.') continue;
      const had = paths.get(key);
      if (had && had.move !== c.moves[p]) no(`${at}: its beats ${key.split('').join(' ')} play '${c.moves[p]}' where '${had.id}' plays '${had.move}'`);
      if (!had) paths.set(key, { id: c.id, move: c.moves[p] });
      p++;
    }
  }
  return C;
}

/** The platform rule's moveset: each move in seconds and shares of its length, the tree of beats, the timing in seconds. */
export function lowerCombos(C0, { prefix = '' } = {}) {
  const C = readCombos(C0), T = { ...BASIC_COMBOS.timing, ...(C.timing ?? {}) };
  const moves = Object.fromEntries(Object.entries(C.moves).map(([id, m]) => [id, {
    // (its own clip, `mv_<id>`: its footwork baked on the figure, world-scene.js; `mv_<id>_still` the same move in place)
    clip: `mv_${prefix}${id}`, ...(m.swing ? { swing: m.swing } : { strike: m.strike }), role: m.role, dur: r4(m.frames / FPS), ...(m.contact ? { contact: [...m.contact] } : {}), cancel: m.cancel != null ? r4(m.cancel / m.frames) : 1,
    // (a travel waits out the blend into the move: the body moves once the two poses' feet are one, the footwork)
    travel: m.travel && m.travel.kind !== 'none' ? { kind: m.travel.kind, m: m.travel.m, wait: r4(T.blend / m.frames) } : null,
    damage: m.damage ?? 1, ...(m.impact != null ? { impact: m.impact } : {}), ...(m.topple ? { topple: true } : {}), ...(m.launch ? { launch: m.launch } : {}),
    ...(m.cooldown > 0 ? { cooldown: r4(m.cooldown / FPS) } : {}),
    ...(m.air ? { air: true } : {}), ...(m.slam > 0 ? { slam: m.slam } : {}), ...(m.rise ? { rise: true } : {}),
  }]));
  // (the ground's tree and the air's: a string made in the air opens from a jump or a launch, the ground's from the feet)
  const tree = {}, airTree = {};
  for (const c of C.combos) {
    let level = c.air ? airTree : tree, node = null, k = 0, pause = false;
    for (const b of c.beats) {
      if (b === '.') { pause = true; continue; }
      const into = node ? (pause ? (node.pause ??= {}) : (node.next ??= {})) : level;
      node = into[b] ??= { move: c.moves[k], depth: k + 1, combos: [] };
      node.combos.push(c.id);
      pause = false; k++;
    }
    if (node) node.ends = [...(node.ends ?? []), c.id];
  }
  // (`ready`: the fighting stance its moves start and end in, the hero's idle in combat with this moveset)
  return { moves, tree, ...(Object.keys(airTree).length ? { airTree } : {}), ready: `mv_${prefix}ready`, buffer: r4(T.buffer / FPS), late: r4(T.late / FPS), pause: [r4(T.pause[0] / FPS), r4(T.pause[1] / FPS)], blend: r4(T.blend / FPS), ...(T.rest > 0 ? { rest: r4(T.rest / FPS) } : {}) };
}

/** The director's list: each combo's beats and its moves, read whole. */
export function comboList(C0) {
  const C = readCombos(C0);
  return C.combos.map((c) => ({ id: c.id, name: c.name ?? c.id, ...(c.air ? { air: true } : {}), beats: c.beats.join(' '),
    moves: c.moves.map((id) => ({ id, role: C.moves[id].role, ...(C.moves[id].swing ? { swing: C.moves[id].swing } : { strike: C.moves[id].strike }), travel: C.moves[id].travel?.kind ?? 'none', frames: C.moves[id].frames })) }));
}

// ─── the arsenal: the weapons a hero steps through, each its own moves and strings ───
export const BASIC_ARSENAL = Object.freeze({
  timing: BASIC_COMBOS.timing,
  weapons: [
    { id: 'sword', name: 'Sword', figure: 'drawn', moves: BASIC_COMBOS.moves, combos: BASIC_COMBOS.combos },
    { id: 'fist', name: 'Fist', figure: 'sheathed', reach: 0.95, damage: 0.5,
      moves: {
        // (each move's window where its solver lands its blow: the jab at 0.44 of its clip, the cross 0.46, the hook 0.49, the
        // uppercut 0.68)
        jab: { strike: 'jab', role: 'opener', frames: 22, cancel: 13, contact: [0.4, 0.5], travel: { kind: 'step', m: 0.15 }, damage: 1 },
        cross: { strike: 'cross', role: 'filler', frames: 26, cancel: 16, contact: [0.42, 0.52], travel: { kind: 'step', m: 0.2 }, damage: 1.2 },
        hook: { strike: 'hook', role: 'finisher', frames: 34, contact: [0.46, 0.58], travel: { kind: 'lunge', m: 0.35 }, damage: 2, impact: 2.5, topple: true },
        uppercut: { strike: 'uppercut', role: 'opener', frames: 32, contact: [0.64, 0.76], travel: { kind: 'step', m: 0.2 }, damage: 1.6, impact: 1.5, cooldown: 40 },
        'rising-uppercut': { strike: 'uppercut', role: 'launcher', frames: 32, contact: [0.64, 0.76], damage: 1.4, launch: 8.5, rise: true, cooldown: 30 },
        'air-jab': { strike: 'jab', role: 'opener', frames: 20, cancel: 12, contact: [0.4, 0.5], damage: 1, air: true },
        'air-cross': { strike: 'cross', role: 'filler', frames: 24, cancel: 15, contact: [0.42, 0.52], damage: 1.2, air: true },
        'air-hammer': { strike: 'hook', role: 'finisher', frames: 32, contact: [0.46, 0.58], damage: 2, impact: 2.5, topple: true, slam: 14, air: true },
      },
      combos: [
        { id: 'one-two-hook', name: 'One, two, hook', beats: ['L', 'L', 'L'], moves: ['jab', 'cross', 'hook'] },
        { id: 'uppercut', name: 'Uppercut', beats: ['H'], moves: ['uppercut'] },
        { id: 'rising-uppercut', name: 'Rising uppercut', beats: ['bH'], moves: ['rising-uppercut'] },
        { id: 'air-flurry', name: 'Air flurry', air: true, beats: ['L', 'L', 'L'], moves: ['air-jab', 'air-cross', 'air-hammer'] },
      ] },
  ],
  // THE JUGGLE (the foe's side of a launch, and the hero's hang): see JUGGLE
  juggle: { hitstun: { base: 40, decay: 0.85, min: 12 }, launch: 9, hitLift: 3.5, gravity: 1.06, g: 20, max: 8, recover: true, hang: 0.15, kick: 1.2 },
  // the sidearm on S, the loadout's one, whatever is in hand: the action-adventure's bow (held, it draws; let go once
  // drawn, it looses; let go early, nothing)
  ranged: [
    { id: 'bow', name: 'Bow', mode: 'draw', draw: 0.45, early: 'none', speed: 45, drop: 9, damage: 3, impact: 30, quiver: 30, nock: 0.3, hand: 'left' },
  ],
});
/**
 * THE SIDEARM (an arsenal's `ranged`: one, on S, every weapon's: the weapon cycle never changes it; a weapon's own `sidearm: false` carries none), in the designer's words, lowered to the
 * runtime's ranged weapon (worlds/controllable/combat-ranged.js initWeapon):
 *   auto   held, it fires at `rof` rounds a second (hitscan) until the magazine is dry and reloads (`magazine`, `reload`),
 *          or never runs dry (`infinite`: a stylish game's pistols, weak to match); `damage`, `impact`, `range` (m),
 *          `dual` (two guns taking turns)
 *   draw   held, it draws for `draw` seconds and is ready; let go once ready, it looses its round (an arrow: `speed` m/s,
 *          `drop` m/s² of gravity, `damage`, `impact`); let go before, `early`: none (a bow: nothing) or tap (a charge
 *          shot's pellet: `tap { damage, impact }`); `quiver` arrows (absent: endless), `nock` seconds to the next
 *   hand   the hand it is held in (right | left): where its round leaves from
 */
export const SIDEARM_MODES = Object.freeze(['auto', 'draw']);
const SIDEARM_KEYS = Object.freeze({ auto: ['rof', 'damage', 'impact', 'range', 'infinite', 'magazine', 'reload', 'hand', 'dual'], draw: ['draw', 'early', 'tap', 'speed', 'drop', 'damage', 'impact', 'quiver', 'nock', 'hand'] });
function readSidearm(G, at) {
  if (!isObj(G) || typeof G.id !== 'string' || !G.id) no(`${at} is { id, name?, mode: auto | draw, … }`);
  if (!SIDEARM_MODES.includes(G.mode)) no(`${at}.mode is auto (held, it fires at its rate) or draw (held, it draws; let go once drawn, it looses)`);
  for (const k of Object.keys(G)) if (!['id', 'name', 'mode', ...SIDEARM_KEYS[G.mode]].includes(k)) no(`${at}.${k} is not part of a ${G.mode} sidearm (${SIDEARM_KEYS[G.mode].join(', ')})`);
  const pos = (k, lo, hi) => { if (G[k] !== undefined && !num(G[k], lo, hi)) no(`${at}.${k} is a number, ${lo} to ${hi}`); };
  pos('damage', 0, 50); pos('impact', 0, 500); pos('range', 1, 400); pos('rof', 0.5, 30); pos('magazine', 1, 999); pos('reload', 0, 10);
  pos('draw', 0.05, 3); pos('speed', 5, 200); pos('drop', 0, 50); pos('quiver', 0, 999); pos('nock', 0, 5);
  if (G.hand !== undefined && !['right', 'left'].includes(G.hand)) no(`${at}.hand is right or left`);
  if (G.early !== undefined && !['none', 'tap'].includes(G.early)) no(`${at}.early is none (a bow: nothing loosed) or tap (a charge shot: its pellet)`);
  return G;
}
/** a sidearm's runtime weapon (initWeapon's config) */
export function lowerSidearm(G) {
  const eye = 1.25, hand = G.hand ?? 'right';   // (the round leaves at the chest: a level shot meets a body's middle)
  if (G.mode === 'auto') return { fireClass: 'sight', auto: true, rof: G.rof ?? 8, magazine: G.magazine ?? 60, reload: G.reload ?? 1.2, damage: G.damage ?? 0.5, impact: G.impact ?? 4, range: G.range ?? 30, coreAngle: 3, eye, hand, fxScale: 0.15, fxColor: 0xffd27a, ...(G.infinite ? { infinite: true } : {}), ...(G.dual ? { muzzleAlt: true } : {}) };
  return { fireClass: 'lob', auto: false, chargeTime: G.draw ?? 0.45, ...(G.early === 'tap' ? {} : { early: 'none' }), magazine: 1, reload: G.nock ?? 0.3, ...(Number.isFinite(G.quiver) ? { reserve: G.quiver } : {}),
    projectileSpeed: G.speed ?? 45, projectileGravity: G.drop ?? 9, lobAngle: 1, projRadius: 0.12, splashRadius: 0, armTime: 0.04, fuse: 3, smokeTrail: false, cooldown: 0.1, eye, hand,
    damage: G.tap?.damage ?? 0, impact: G.tap?.impact ?? 0, chargedDamage: G.damage ?? 3, chargedImpact: G.impact ?? 30, chargedRangeMul: 1 };
}
/**
 * THE JUGGLE RULES (an arsenal's `juggle`, frames and metres): how long a launched foe stays in the air for the hero's
 * blows, and how the hero hangs there with it. HITSTUN is the budget: each blow stuns the foe `base` frames, every later
 * blow `decay` of the last (never under `min`), and the air pulls it down harder each blow (`gravity` × per blow, from
 * `g` m/s²); an air blow lifts it `hitLift` m/s (the AIR STICKINESS), up to `max` blows. When the stun runs out in the air
 * the foe RECOVERS (`recover`: an invincible flip, landing on its feet, the combo spent); slammed down, or landing still
 * stunned, it is KNOCKED DOWN (the topple, its getup's wake guard after). `launch` the launcher's speed up when a move
 * names none. The HERO's hang: an air move holds it aloft, its gravity `hang` of its own while the move plays and a
 * `kick` m/s up as each begins.
 */
export const JUGGLE_KEYS = Object.freeze(['hitstun', 'launch', 'hitLift', 'gravity', 'g', 'max', 'recover', 'hang', 'kick', 'scaling']);
export function readJuggle(J, at = 'juggle') {
  if (!isObj(J)) no(`${at} is { ${JUGGLE_KEYS.join(', ')} }`);
  for (const k of Object.keys(J)) if (!JUGGLE_KEYS.includes(k)) no(`${at}.${k} is not part of the juggle (${JUGGLE_KEYS.join(', ')})`);
  const H = J.hitstun ?? {};
  if (!isObj(H) || (H.base !== undefined && !num(H.base, 1, 240)) || (H.decay !== undefined && !num(H.decay, 0.3, 1)) || (H.min !== undefined && !num(H.min, 0, 120))) no(`${at}.hitstun is { base: frames, decay: 0.3 to 1, min: frames }`);
  for (const [k, lo, hi] of [['launch', 1, 30], ['hitLift', 0, 20], ['gravity', 1, 2], ['g', 5, 60], ['max', 1, 30], ['hang', 0, 1], ['kick', 0, 10]]) if (J[k] !== undefined && !num(J[k], lo, hi)) no(`${at}.${k} is ${lo} to ${hi}`);
  if (J.recover !== undefined && typeof J.recover !== 'boolean') no(`${at}.recover is true (the foe flips out when its stun runs out in the air) or false`);
  if (J.scaling !== undefined && !(isObj(J.scaling) && num(J.scaling.perHit, 0.3, 1) && num(J.scaling.floor ?? 0.3, 0, 1))) no(`${at}.scaling is { perHit: 0.3 to 1, floor? }`);
  return J;
}
/** the juggle lowered: `combo`, a foe body's (worlds/controllable/combat-hit.js normalizeCombo, seconds), and `air`, the
 * hero's hang (each weapon's moveset) */
export function lowerJuggle(J0) {
  const J = readJuggle(J0), H = J.hitstun ?? {};
  return {
    combo: { hitstun: { base: r4((H.base ?? 40) / FPS), decay: H.decay ?? 0.85, min: r4((H.min ?? 12) / FPS) },
      juggle: { launch: J.launch ?? 9, lift: 0.7, hitLift: J.hitLift ?? 3.5, gravity: J.gravity ?? 1, g: J.g ?? 20, max: J.max ?? 8, land: 'knockdown', recover: J.recover !== false },
      ...(J.scaling ? { scaling: { perHit: J.scaling.perHit, floor: J.scaling.floor ?? 0.3 } } : { scaling: false }), reset: 0.3 },
    air: { hang: J.hang ?? 0.15, kick: J.kick ?? 1.2 },
  };
}
export function readArsenal(A) {
  if (!isObj(A)) no('an arsenal is { timing?, weapons: [{ id, name?, figure?, sidearm?, reach?, damage?, moves, combos }], ranged?: [one sidearm] }');
  for (const k of Object.keys(A)) if (!['timing', 'weapons', 'ranged', 'juggle'].includes(k)) no(`'${k}' is not part of an arsenal (timing, weapons, ranged, juggle)`);
  if (A.juggle !== undefined) readJuggle(A.juggle);
  if (A.ranged !== undefined && !Array.isArray(A.ranged)) no('ranged is a list of sidearms');
  // (ONE sidearm a loadout: the weapon cycle steps the blades and the fists, never the ranged weapon, so every weapon
  // carries the same one, its quiver kept across the cycle)
  if ((A.ranged ?? []).length > 1) no(`ranged is the loadout's one sidearm (not ${A.ranged.length}): the weapon cycle steps the melee weapons, never the ranged one`);
  const sidearms = new Set((A.ranged ?? []).map((G, i) => readSidearm(G, `ranged[${i}]`).id));
  if (!Array.isArray(A.weapons) || !A.weapons.length) no('weapons is a list, one at least');
  const ids = new Set();
  for (const [i, W] of A.weapons.entries()) {
    const at = `weapons[${i}]`;
    if (!isObj(W) || typeof W.id !== 'string' || !W.id) no(`${at} is { id, name?, figure?, reach?, damage?, moves, combos }`);
    if (ids.has(W.id)) no(`${at}: '${W.id}' twice`);
    ids.add(W.id);
    for (const k of Object.keys(W)) if (!['id', 'name', 'figure', 'sidearm', 'guard', 'reach', 'damage', 'moves', 'combos'].includes(k)) no(`${at}.${k} is not part of a weapon`);
    if (W.guard !== undefined && W.guard !== false && !GUARDS.includes(W.guard)) no(`${at}.guard is how the weapon guards (${GUARDS.join(', ')}), or false: none`);
    if (W.sidearm !== undefined && W.sidearm !== false && !sidearms.has(W.sidearm)) no(`${at}.sidearm '${W.sidearm}' is not the arsenal's ranged (${[...sidearms].join(', ') || 'none'}); false: none in this hand`);
    if (W.figure !== undefined && !['drawn', 'sheathed'].includes(W.figure)) no(`${at}.figure is drawn (in hand) or sheathed (on the back)`);
    if (W.reach !== undefined && !num(W.reach, 0.3, 6)) no(`${at}.reach is metres, 0.3 to 6`);
    if (W.damage !== undefined && !num(W.damage, 0, 20)) no(`${at}.damage is × the held weapon's, 0 to 20`);
    try { readCombos({ ...(A.timing ? { timing: A.timing } : {}), moves: W.moves, combos: W.combos }); } catch (e) { no(`${at} (${W.id}): ${e.message.replace(/^combos: /, '')}`); }
  }
  return A;
}
/** how a weapon guards (hero-swing-body.js AIM_POSES' guards): `shield` the blade's (a shield on the off arm), `cover` the
 * fist's (both fists up); a weapon's own `guard`, else by the figure it shows (drawn: the shield; sheathed: the cover) */
export const GUARDS = Object.freeze(['shield', 'cover']);
const guardOf = (W) => (W.guard === false ? null : W.guard ?? ((W.figure ?? 'drawn') === 'sheathed' ? 'cover' : 'shield'));
/** the aim each kind of sidearm is held in (hero-swing-body.js AIM_POSES) */
export const AIM_OF = Object.freeze({ draw: 'archer', auto: 'gunslinger' });
export function lowerArsenal(A0) {
  const A = readArsenal(A0);
  const G = Object.fromEntries((A.ranged ?? []).map((g) => [g.id, g]));
  // (every weapon carries the loadout's sidearm, the same one: the cycle never changes it; `sidearm: false`, none)
  const sidOf = (W) => (W.sidearm === false ? null : W.sidearm ?? A.ranged?.[0]?.id ?? null);
  const sideOf = (id) => ({ id, name: G[id].name ?? id, mode: G[id].mode, weapon: lowerSidearm(G[id]), aim: `mv_aim_${id}`, pose: AIM_OF[G[id].mode], hand: G[id].hand ?? (G[id].mode === 'draw' ? 'left' : 'right'), ...(G[id].dual ? { dual: true } : {}) });
  return A.weapons.map((W) => ({ id: W.id, name: W.name ?? W.id, figure: W.figure ?? 'drawn', ...(W.reach != null ? { reach: W.reach } : {}), ...(W.damage != null ? { damage: W.damage } : {}),
    // (its sidearm on S, lowered to the runtime's ranged weapon, and the aim the hero holds it in: its clip `mv_aim_<id>`,
    // a draw's the archer's, an auto's the gunslinger's, hero-swing-body.js aimClip)
    // (its GUARD's pose while the guard is up, `mv_guard_<weapon>`: a blade's the shield, the fist's the cover; false none)
    ...(guardOf(W) ? { guard: { clip: `mv_guard_${W.id}`, pose: guardOf(W), ...(guardOf(W) === 'shield' ? { prop: 'shield' } : {}) } } : {}),
    ...(sidOf(W) ? { sidearm: sideOf(sidOf(W)) } : {}),
    // (each weapon's clips its own: mv_<weapon>_<move>, its stance mv_<weapon>_ready)
    moveset: { ...lowerCombos({ ...(A.timing ? { timing: A.timing } : {}), moves: W.moves, combos: W.combos }, { prefix: `${W.id}_` }), ...(A.juggle ? { air: lowerJuggle(A.juggle).air } : {}) } }));
}
export const strikesOf = (A) => [...new Set(readArsenal(A).weapons.flatMap((W) => Object.values(W.moves).filter((m) => m.strike).map((m) => m.strike)))];

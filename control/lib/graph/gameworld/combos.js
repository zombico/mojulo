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
 *
 * A COMBO is { id, name, beats, moves }: `beats` the presses, L (light), H (heavy), S (special) and `.` (a pause:
 * the next press held back until the last move has ended and a breath has passed), one move a press. Combos share their
 * openings: L L L and L L H are one tree that forks at the third beat; `.` forks a string on its timing.
 *
 * THE TIMING, with forgiveness (frames): `blend` one move blends into the next this long (its travel waits it out, so no
 * foot slides: hero-swing-body.js moveClip); `buffer` a press early is remembered this long and taken at the cancel; `late`
 * a press after a move has ended still chains this long; a pause beat is a press between `pause[0]` and `pause[1]` after
 * the move ended. Held and mashed beats are named for later and refused today.
 *
 *   BASIC_COMBOS              the starter: L L L (two cuts and the cleave), H (the thrust)
 *   BASIC_ARSENAL             the starter's weapons, stepped through: the sword (BASIC_COMBOS) and the fist (L L L the
 *                             jab, the cross and the hook; H the uppercut); a weapon's `figure` is the hero it shows
 *                             (drawn: the blade in hand; sheathed: on the back)
 *   readArsenal(A) / lowerArsenal(A)   → the platform rule's `weapons`: [{ id, name, figure, reach?, moveset }]
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
export const BEATS = Object.freeze(['L', 'H', 'S', '.']);
/** beats named and not yet played: a held press (a charge) and a mashed one */
export const LATER_BEATS = Object.freeze({ 'L+': 'a held light', 'H+': 'a held heavy', 'L*': 'a mashed light', 'H*': 'a mashed heavy' });
const FPS = 60;
const r4 = (v) => Math.round(v * 1e4) / 1e4;

export const BASIC_COMBOS = Object.freeze({
  timing: { buffer: 12, late: 14, pause: [16, 50], blend: 4 },
  moves: {
    'cut-1': { swing: 'neutral', role: 'opener', frames: 24, cancel: 15, travel: { kind: 'step', m: 0.25 }, damage: 1 },
    'cut-2': { swing: 'left', role: 'filler', frames: 24, cancel: 15, travel: { kind: 'step', m: 0.25 }, damage: 1 },
    cleave: { swing: 'back', role: 'finisher', frames: 44, travel: { kind: 'lunge', m: 0.5 }, damage: 2, impact: 3, topple: true },
    thrust: { swing: 'forward', role: 'opener', frames: 32, travel: { kind: 'lunge', m: 0.6 }, damage: 1.5, impact: 1.5 },
  },
  combos: [
    { id: 'three-cuts', name: 'Three cuts', beats: ['L', 'L', 'L'], moves: ['cut-1', 'cut-2', 'cleave'] },
    { id: 'thrust', name: 'Thrust', beats: ['H'], moves: ['thrust'] },
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
  if (T.pause !== undefined && !(Array.isArray(T.pause) && T.pause.length === 2 && num(T.pause[0], 1, 120) && num(T.pause[1], T.pause[0], 240))) no('timing.pause is [from, to] frames after a move has ended');
  if (!isObj(C.moves) || !Object.keys(C.moves).length) no('moves is { <id>: a move }, one at least');
  for (const [id, m] of Object.entries(C.moves)) {
    const at = `moves.${id}`;
    if (!isObj(m)) no(`${at} is { swing | strike, role, frames, cancel?, contact?, travel?, damage?, impact?, topple?, launch? }`);
    for (const k of Object.keys(m)) if (!['swing', 'strike', 'role', 'frames', 'cancel', 'contact', 'travel', 'damage', 'impact', 'topple', 'launch'].includes(k)) no(`${at}.${k} is not part of a move`);
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
    if (!isObj(c) || typeof c.id !== 'string' || !c.id) no(`${at} is { id, name?, beats, moves }`);
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
    // (two combos on the same beats are one string: they must play the same moves on their shared beats)
    let key = '';
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
export function lowerCombos(C0) {
  const C = readCombos(C0), T = { ...BASIC_COMBOS.timing, ...(C.timing ?? {}) };
  const moves = Object.fromEntries(Object.entries(C.moves).map(([id, m]) => [id, {
    // (its own clip, `mv_<id>`: its footwork baked on the figure, world-scene.js; `mv_<id>_still` the same move in place)
    clip: `mv_${id}`, ...(m.swing ? { swing: m.swing } : { strike: m.strike }), role: m.role, dur: r4(m.frames / FPS), ...(m.contact ? { contact: [...m.contact] } : {}), cancel: m.cancel != null ? r4(m.cancel / m.frames) : 1,
    // (a travel waits out the blend into the move: the body moves once the two poses' feet are one, the footwork)
    travel: m.travel && m.travel.kind !== 'none' ? { kind: m.travel.kind, m: m.travel.m, wait: r4(T.blend / m.frames) } : null,
    damage: m.damage ?? 1, ...(m.impact != null ? { impact: m.impact } : {}), ...(m.topple ? { topple: true } : {}), ...(m.launch ? { launch: m.launch } : {}),
  }]));
  const tree = {};
  for (const c of C.combos) {
    let level = tree, node = null, k = 0, pause = false;
    for (const b of c.beats) {
      if (b === '.') { pause = true; continue; }
      const into = node ? (pause ? (node.pause ??= {}) : (node.next ??= {})) : level;
      node = into[b] ??= { move: c.moves[k], depth: k + 1, combos: [] };
      node.combos.push(c.id);
      pause = false; k++;
    }
    if (node) node.ends = [...(node.ends ?? []), c.id];
  }
  return { moves, tree, buffer: r4(T.buffer / FPS), late: r4(T.late / FPS), pause: [r4(T.pause[0] / FPS), r4(T.pause[1] / FPS)], blend: r4(T.blend / FPS) };
}

/** The director's list: each combo's beats and its moves, read whole. */
export function comboList(C0) {
  const C = readCombos(C0);
  return C.combos.map((c) => ({ id: c.id, name: c.name ?? c.id, beats: c.beats.join(' '),
    moves: c.moves.map((id) => ({ id, role: C.moves[id].role, ...(C.moves[id].swing ? { swing: C.moves[id].swing } : { strike: C.moves[id].strike }), travel: C.moves[id].travel?.kind ?? 'none', frames: C.moves[id].frames })) }));
}

// ─── the arsenal: the weapons a hero steps through, each its own moves and strings ───
export const BASIC_ARSENAL = Object.freeze({
  timing: BASIC_COMBOS.timing,
  weapons: [
    { id: 'sword', name: 'Sword', figure: 'drawn', moves: BASIC_COMBOS.moves, combos: BASIC_COMBOS.combos },
    { id: 'fist', name: 'Fist', figure: 'sheathed', reach: 0.95, damage: 0.5,
      moves: {
        jab: { strike: 'jab', role: 'opener', frames: 22, cancel: 13, contact: [0.4, 0.52], travel: { kind: 'step', m: 0.15 }, damage: 1 },
        cross: { strike: 'cross', role: 'filler', frames: 26, cancel: 16, contact: [0.42, 0.54], travel: { kind: 'step', m: 0.2 }, damage: 1.2 },
        hook: { strike: 'hook', role: 'finisher', frames: 34, contact: [0.45, 0.6], travel: { kind: 'lunge', m: 0.35 }, damage: 2, impact: 2.5, topple: true },
        uppercut: { strike: 'uppercut', role: 'opener', frames: 32, contact: [0.45, 0.6], travel: { kind: 'step', m: 0.2 }, damage: 1.6, impact: 1.5 },
      },
      combos: [
        { id: 'one-two-hook', name: 'One, two, hook', beats: ['L', 'L', 'L'], moves: ['jab', 'cross', 'hook'] },
        { id: 'uppercut', name: 'Uppercut', beats: ['H'], moves: ['uppercut'] },
      ] },
  ],
});
export function readArsenal(A) {
  if (!isObj(A)) no('an arsenal is { timing?, weapons: [{ id, name?, figure?, reach?, damage?, moves, combos }] }');
  for (const k of Object.keys(A)) if (!['timing', 'weapons'].includes(k)) no(`'${k}' is not part of an arsenal (timing, weapons)`);
  if (!Array.isArray(A.weapons) || !A.weapons.length) no('weapons is a list, one at least');
  const ids = new Set();
  for (const [i, W] of A.weapons.entries()) {
    const at = `weapons[${i}]`;
    if (!isObj(W) || typeof W.id !== 'string' || !W.id) no(`${at} is { id, name?, figure?, reach?, damage?, moves, combos }`);
    if (ids.has(W.id)) no(`${at}: '${W.id}' twice`);
    ids.add(W.id);
    for (const k of Object.keys(W)) if (!['id', 'name', 'figure', 'reach', 'damage', 'moves', 'combos'].includes(k)) no(`${at}.${k} is not part of a weapon`);
    if (W.figure !== undefined && !['drawn', 'sheathed'].includes(W.figure)) no(`${at}.figure is drawn (in hand) or sheathed (on the back)`);
    if (W.reach !== undefined && !num(W.reach, 0.3, 6)) no(`${at}.reach is metres, 0.3 to 6`);
    if (W.damage !== undefined && !num(W.damage, 0, 20)) no(`${at}.damage is × the held weapon's, 0 to 20`);
    try { readCombos({ ...(A.timing ? { timing: A.timing } : {}), moves: W.moves, combos: W.combos }); } catch (e) { no(`${at} (${W.id}): ${e.message.replace(/^combos: /, '')}`); }
  }
  return A;
}
export function lowerArsenal(A0) {
  const A = readArsenal(A0);
  return A.weapons.map((W) => ({ id: W.id, name: W.name ?? W.id, figure: W.figure ?? 'drawn', ...(W.reach != null ? { reach: W.reach } : {}), ...(W.damage != null ? { damage: W.damage } : {}),
    moveset: lowerCombos({ ...(A.timing ? { timing: A.timing } : {}), moves: W.moves, combos: W.combos }) }));
}
export const strikesOf = (A) => [...new Set(readArsenal(A).weapons.flatMap((W) => Object.values(W.moves).filter((m) => m.strike).map((m) => m.strike)))];

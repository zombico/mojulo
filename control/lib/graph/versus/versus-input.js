/**
 * versus input — buttons are not moves. A scheme reads a player's buttons into a command for a SLOT of the moveset
 * (a normal, a special at a direction, the throw, the super), so every character plays in every scheme and each
 * player picks their own.
 *
 *   raw input, one per player per frame: { x: -1 | 0 | 1, y: -1 | 0 | 1, b: bits }   (x screen-right, y up)
 *   bits: L 1, M 2, H 4, S 8 (special), T 16 (throw)
 *
 *   modern   L / M / H normals; S + direction a special (neutral, forward, back, down); S + H the super;
 *            T (or L + M) the throw. Specials come out at medium.
 *   classic  L / M / H normals; a motion + a button a special at that button's strength (236, 623, 214, 22, 41236);
 *            236236 + a button the super; T (or L + M) the throw.
 *   simple   one attack button (L): pressing it again while a normal connects runs the auto-combo (M → H → the
 *            back special); S + direction a special; S + L the super; T the throw.
 *   limbs    the four limbs (the 'limbs' system forces it on both players, never a menu's pick): L the lead hand, M the
 *            rear hand, H the lead leg, S the rear leg, a normal each at a ground stance (`stand.1` … `crouch.4`), in the
 *            air L / M / H; a motion + a limb a special (the hands at their strength, the legs heavy); 236236 + a limb
 *            the super; T (or L + M) the throw.
 *
 * The history is facing-relative numpad directions (6 is toward the opponent) with each frame's new presses,
 * newest last; a press is good for BUFFER frames, and acting on it consumes it.
 */

export const BTN = Object.freeze({ L: 1, M: 2, H: 4, S: 8, T: 16 });
export const SCHEMES = Object.freeze(['modern', 'classic', 'simple']);
export const BUFFER = 4;
export const HISTORY = 32;
// a motion's window (frames from its first direction to the press)
const MOTION_WINDOW = { 66: 10, 44: 10, 236: 12, 214: 12, 623: 14, 22: 14, 41236: 20, 63214: 20, 236236: 22 };

export const ZERO_PAD = Object.freeze({ x: 0, y: 0, b: 0 });

/** Screen input → facing-relative numpad direction. */
export const numpad = (x, y, face) => 5 + x * face + 3 * y;
const packEntry = (dir, press) => dir | (press << 4);
const entryDir = (e) => e & 15;
const entryPress = (e) => e >> 4;

/** Record a frame of input into a player's history (returns the new arrays; the old ones are not touched). */
export function recordInput(p, pad, face) {
  const press = pad.b & ~p.held;
  const hist = p.hist.length >= HISTORY ? p.hist.slice(1) : p.hist.slice();
  hist.push(packEntry(numpad(pad.x, pad.y, face), press));
  return { hist, held: pad.b };
}

/** Was any of `bits` pressed within the last `within` frames (not yet consumed)? → the bits seen, or 0. */
export function pressed(hist, bits, within = BUFFER) {
  let seen = 0;
  for (let i = hist.length - 1; i >= 0 && i >= hist.length - within; i--) seen |= entryPress(hist[i]) & bits;
  return seen;
}

/** Consume every press in the buffer window (an action was taken on it). */
export function consume(hist) {
  const out = hist.slice();
  for (let i = out.length - 1; i >= 0 && i >= out.length - BUFFER; i--) out[i] = entryDir(out[i]);
  return out;
}

export const downish = (d) => d === 1 || d === 2 || d === 3;
// a motion is numpad digits (a recipe's own special may write any, versus-compile readMotion): each matches itself
const DIGIT_OK = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [n, (d) => d === n]));

/** Did the history trace a motion (e.g. '236') ending near now? Each digit in order; the last within the buffer. */
export function traced(hist, motion) {
  const win = MOTION_WINDOW[motion] ?? Math.max(14, motion.length * 4);
  const digits = motion.split('').map(Number);
  let k = digits.length - 1;
  const start = Math.max(0, hist.length - win);
  for (let i = hist.length - 1; i >= start; i--) {
    const d = entryDir(hist[i]);
    if (k === digits.length - 1 && i < hist.length - BUFFER - 1) return false;
    if (DIGIT_OK[digits[k]](d)) {
      // a repeated digit must be separated by something else (22, 236236)
      if (k < digits.length - 1 && digits[k] === digits[k + 1] && sameRun(hist, i, digits[k])) continue;
      k--;
      if (k < 0) return true;
    }
  }
  return false;
}
// is hist[i] part of the same unbroken hold as the later occurrence of this digit?
function sameRun(hist, i, digit) {
  for (let j = i + 1; j < hist.length; j++) {
    const d = entryDir(hist[j]);
    if (!DIGIT_OK[digit](d)) return false;
  }
  return true;
}

const strengthOf = (bits) => (bits & BTN.H ? 'H' : bits & BTN.M ? 'M' : 'L');
const dirSlot = (d) => (d === 6 ? 'forward' : d === 4 ? 'back' : downish(d) ? 'down' : 'neutral');

/**
 * Read a command from a player's history for the moves the fighter has. `stance` is where the body is (stand,
 * crouch, air); `auto` is the simple scheme's auto-combo step (the next normal it would give). → { type, slot } or null.
 */
export function readCommand(hist, scheme, fighter, { stance, auto, hasShot, meter } = {}) {
  const now = entryDir(hist[hist.length - 1] ?? 5);
  const has = (slot) => !!fighter.moves[slot];
  const special = (dir, st) => (has(`special.${dir}.${st}`) && !(hasShot && fighter.moves[`special.${dir}.${st}`].projectile) ? { type: 'special', slot: `special.${dir}.${st}` } : null);
  const canSuper = has('super') && meter >= fighter.moves.super.cost && !(hasShot && fighter.moves.super.projectile);
  const grounded = stance !== 'air';
  const atk = pressed(hist, BTN.L | BTN.M | BTN.H);
  const sp = pressed(hist, BTN.S);
  const throwBtn = pressed(hist, BTN.T) || ((atk & BTN.L) && (atk & BTN.M) && scheme !== 'simple' ? 1 : 0);

  if (scheme === 'limbs') {
    const limb = pressed(hist, BTN.L | BTN.M | BTN.H | BTN.S);
    if (limb && grounded && canSuper && traced(hist, '236236')) return { type: 'super', slot: 'super' };
    if (limb && grounded) {
      const st = limb & BTN.L ? 'L' : limb & BTN.M ? 'M' : 'H';
      for (const dir of ['forward', 'down', 'back', 'neutral']) {
        const m = fighter.moves[`special.${dir}.${st}`];
        if (m && traced(hist, m.motion)) { const c = special(dir, st); if (c) return c; }
      }
    }
    if (throwBtn && grounded) return { type: 'throw', slot: 'throw', back: now === 4 || now === 7 || now === 1 };
    if (!limb) return null;
    const n = limb & BTN.L ? 1 : limb & BTN.M ? 2 : limb & BTN.H ? 3 : 4;
    if (!grounded) return { type: 'normal', slot: `air.${n === 1 ? 'L' : n === 2 ? 'M' : 'H'}` };
    const slot = `${downish(now) ? 'crouch' : 'stand'}.${n}`;
    return has(slot) ? { type: 'normal', slot } : null;
  }
  if (scheme === 'classic') {
    if (atk && grounded && canSuper && traced(hist, '236236')) return { type: 'super', slot: 'super' };
    if (atk && grounded) {
      const st = strengthOf(atk);
      for (const dir of ['forward', 'down', 'back', 'neutral']) {
        const m = fighter.moves[`special.${dir}.${st}`];
        if (m && traced(hist, m.motion)) { const c = special(dir, st); if (c) return c; }
      }
    }
  } else if (sp) {
    const superBtn = scheme === 'simple' ? BTN.L : BTN.H;
    if (grounded && canSuper && pressed(hist, superBtn)) return { type: 'super', slot: 'super' };
    if (grounded) { const c = special(dirSlot(now), 'M'); if (c) return c; }
  }
  if (throwBtn && grounded) return { type: 'throw', slot: 'throw', back: now === 4 || now === 7 || now === 1 };
  if (atk) {
    if (scheme === 'simple') {
      if (auto) return auto;
      return { type: 'normal', slot: `${grounded ? (downish(now) ? 'crouch' : 'stand') : 'air'}.M` };
    }
    const st = strengthOf(atk);
    return { type: 'normal', slot: `${grounded ? (downish(now) ? 'crouch' : 'stand') : 'air'}.${st}` };
  }
  return null;
}

/** The simple scheme's next link after a connected normal: M → H → the back special (or neutral). */
export function autoNext(fighter, slot) {
  const [stance, st] = slot.split('.');
  if (stance === 'air' || !st) return null;
  if (st === 'L' || st === 'M') return { type: 'normal', slot: `${stance}.${st === 'L' ? 'M' : 'H'}` };
  if (st === 'H') {
    for (const dir of ['back', 'neutral', 'forward']) if (fighter.moves[`special.${dir}.M`]) return { type: 'special', slot: `special.${dir}.M` };
  }
  return null;
}

/** The current facing-relative direction. */
export const currentDir = (hist) => entryDir(hist[hist.length - 1] ?? 5);

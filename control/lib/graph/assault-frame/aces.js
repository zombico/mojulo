/**
 * THE ACES — the frames a path ladders up to: a named enemy frame with its own build and paint, more armour than a line
 * frame, and PHASES its mind fights in as its armour falls. Each phase a style (how it fights), the reach it keeps, how
 * hard it presses, and what crossing into it does (its reserve called in, its stability steadier). Its strikes in a rush
 * are TOLD: its optics flare for `tell` s before it lunges, the window to make it whiff. A new ace is a row.
 *
 *   ACES                     the shelf
 *   ACE_STYLES               duel (keeps its reach, guns and missiles, quick boosts out of a shot) · rush (assault-boosts
 *                            in and lunges, the lunge told) · desperate (the duel, its braced cannon charged and fired, its
 *                            reserve in)
 *   readAce(id, at?)         → the ace's row, its phases falling from 1 (throws naming the fault)
 *   acePhase(ace, share)     → the phase it fights in at that share of its armour (0..1)
 *
 * Pure data and readers: worlds/controllable/rules-frame.js reads the phases off the mind (`mind.phases`), the operation
 * (gameworld/frame-goal.js) stands the ace and holds its reserve.
 */
import { STOCK, readBuild } from './assemble.js';

const f = Object.freeze;
export const ACE_STYLES = f(['duel', 'rush', 'desperate']);

export const ACES = f({
  // the warlord's ace: a light-medium duellist on reverse legs, a carbine and a blade, missiles and a plasma cannon;
  // it duels, then rushes with its blade, then, cornered, calls its pickets and braces its cannon
  vermilion: f({
    name: 'Vermilion', palette: 'vermilion',
    build: f({ from: 'raptor', head: 'hd-lancet', core: 'cr-raptor', arms: 'ar-standard', legs: 'lg-reverse', booster: 'bs-falcon', generator: 'gn-standard', fcs: 'fc-close', armR: 'rf-carbine', armL: 'bl-shear', backR: 'ms-hornet', backL: 'pc-arc' }),
    ap: 1.8,
    phases: f([
      f({ below: 1, style: 'duel', range: 150, aggression: 0.55, dodge: 0.75, say: 'Vermilion engages' }),
      f({ below: 0.6, style: 'rush', range: 70, aggression: 0.9, dodge: 0.5, tell: 0.55, rest: 2.2, say: 'Vermilion closes in' }),
      f({ below: 0.25, style: 'desperate', range: 110, aggression: 0.7, dodge: 0.9, regen: 1.6, adds: 'reserve', say: 'Vermilion calls its pickets' }),
    ]),
  }),
});

export function readAce(id, at = 'ace') {
  const A = ACES[id];
  if (!A) throw new Error(`${at} is an ace: ${Object.keys(ACES).join(', ')}`);
  readBuild(A.build, `${at}.build`);
  let last = Infinity;
  for (const [i, P] of A.phases.entries()) {
    if (!ACE_STYLES.includes(P.style)) throw new Error(`${at}.phases[${i}].style is ${ACE_STYLES.join(', ')}`);
    if (!(P.below > 0 && P.below <= 1 && P.below < last)) throw new Error(`${at}.phases[${i}].below falls from 1`);
    last = P.below;
  }
  if (A.phases[0].below !== 1) throw new Error(`${at}.phases[0].below is 1: the phase it starts in`);
  return A;
}

export function acePhase(ace, share) {
  let at = ace.phases[0];
  for (const P of ace.phases) if (share <= P.below) at = P;
  return at;
}

export { STOCK };

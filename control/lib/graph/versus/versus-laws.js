/**
 * versus laws — the loop, measured on a compiled fighter. They advise and stamp; none refuses.
 *
 *   throw-short      the throw reaches less than any grounded poke (so a strike beats a throw from range; an
 *                    anti-air normal hits upward and is not a poke)
 *   jab-fast         the fastest normal starts in 5 frames or fewer (something interrupts pressure)
 *   jump-answered    an invincible reversal, or an anti-air normal, answers a jump
 *   reversal-costs   an invincible move loses on block: the blocker punishes it with their fastest normal
 *   fireball-jumped  a jump at its apex clears the fireball (the loop's answer to it)
 *   fireball-minus   a fireball is not plus on block at point blank (it is not pressure for free)
 *   reach-costs      no normal that reaches further than the jab starts faster than it
 *
 * lawsFor(fighter) → [{ id, ok, says, measured }]
 */

const grounded = (m) => m.kind === 'normal' && m.stance !== 'air';

export function lawsFor(F) {
  const moves = Object.values(F.moves);
  const out = [];
  const law = (id, ok, says, measured) => out.push({ id, ok: !!ok, says, measured });

  const ground = moves.filter(grounded);
  const shortest = Math.min(...ground.filter((m) => !m.antiAir).map((m) => m.reach));
  law('throw-short', F.moves.throw.reach < shortest, 'the throw reaches less than any grounded normal', { throw: F.moves.throw.reach, shortestNormal: shortest });

  const fastest = Math.min(...ground.map((m) => m.startup));
  law('jab-fast', fastest <= 5, 'the fastest normal starts in 5 frames or fewer', { fastest });

  const invulnStart = (m) => m.invuln.some(([a, b, k]) => a === 1 && b >= m.startup && k === 'strike');
  const reversals = moves.filter((m) => (m.kind === 'special' || m.kind === 'super') && invulnStart(m) && !m.projectile && !m.throw);
  const antiAir = ground.filter((m) => m.antiAir);
  law('jump-answered', reversals.length || antiAir.length, 'an invincible reversal or an anti-air normal answers a jump',
    { reversals: [...new Set(reversals.map((m) => m.id))], antiAir: antiAir.map((m) => m.slot) });

  const specialsOnly = reversals.filter((m) => m.kind === 'special');
  const unsafe = specialsOnly.filter((m) => m.adv.block !== null && m.adv.block > -fastest);
  law('reversal-costs', !unsafe.length, 'an invincible special loses on block to the fastest normal',
    { fastest, safe: unsafe.map((m) => `${m.slot}.${m.strength}: ${m.adv.block}`), worst: specialsOnly.map((m) => m.adv.block) });

  const fireballs = moves.filter((m) => m.kind === 'special' && m.projectile);
  if (fireballs.length) {
    const apex = Math.floor((F.jump.vy * F.jump.vy) / (2 * F.jump.g));
    const tops = fireballs.map((m) => m.frames[m.startup].spawn[1] + m.projectile.y + m.projectile.h / 2);
    law('fireball-jumped', Math.max(...tops) < apex, 'a jump at its apex clears the fireball', { apex, top: Math.max(...tops) });
    const plus = fireballs.filter((m) => m.adv.block > 0);
    law('fireball-minus', !plus.length, 'a fireball is not plus on block at point blank', { block: fireballs.map((m) => m.adv.block) });
  }

  const jab = F.moves['stand.L'];
  const cheap = ground.filter((m) => m.reach > jab.reach && m.startup < jab.startup);
  law('reach-costs', !cheap.length, 'no normal that reaches further than the jab starts faster', { jab: [jab.startup, jab.reach], cheaper: cheap.map((m) => m.slot) });
  return out;
}

/** The laws' stamp: how many held, and the ids that did not. */
export function lawStamp(F) {
  const laws = lawsFor(F);
  return { held: laws.filter((l) => l.ok).length, of: laws.length, broken: laws.filter((l) => !l.ok).map((l) => l.id) };
}

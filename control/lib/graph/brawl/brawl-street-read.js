/**
 * brawl street read — what a street being fought down says of itself, for its screen (brawl-street.js) and for a probe:
 * pure, off the street's own state (brawl-crowd.js streetOf / stepStreet).
 *
 *   streetRead(street, hp0)  → { hp, hpMax, name, cleared, of, screen, left, boss: { on, name, hp, hpMax }, won, lost, f }
 *     hp0      each body's health as the street began (its bar's whole), by id
 *     cleared  how many of its held screens are beaten, `of` how many there are; `screen` the one being fought (1…)
 *     left     the crowd on the street now, still standing
 *     boss     the boss's bar, on while it is on the street and standing
 *     won      every held screen beaten; lost: every player down
 *
 * Pure: no clock, no dice.
 */
export function streetRead(street, hp0 = []) {
  const { s, ctx, mind } = street, belt = ctx.belt;
  const held = belt.screens.map((sc, i) => (sc.gate || sc.boss ? i : -1)).filter((i) => i >= 0);
  const cleared = held.filter((i) => s.cleared.includes(i)).length;
  const players = s.bodies.filter((b) => b.side === 'player'), me = players[0];
  const on = s.bodies.filter((b) => b.side === 'crowd' && !b.gone && !b.ko);
  const bossId = Object.keys(mind.bosses || {}).map(Number).find((id) => { const b = s.bodies[id]; return b && !b.gone; });
  const B = bossId === undefined ? null : s.bodies[bossId];
  return {
    hp: Math.max(0, me.hp), hpMax: hp0[me.id] || me.hp || 1, name: ctx.fighters[me.fi].name || '',
    cleared, of: held.length, screen: Math.min(held.length, cleared + 1), left: on.length,
    boss: B && !B.ko ? { on: true, name: mind.bosses[bossId].name, hp: Math.max(0, B.hp), hpMax: hp0[bossId] || B.hp || 1 } : { on: false, name: '', hp: 0, hpMax: 1 },
    won: held.length > 0 && cleared === held.length, lost: players.every((b) => b.ko), f: s.f,
  };
}

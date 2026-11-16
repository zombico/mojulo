/**
 * brawl street read — what a street being fought down says of itself, for its screen (brawl-street.js) and for a probe:
 * pure, off the street's own state (brawl-crowd.js streetOf / stepStreet).
 *
 *   streetRead(street, hp0)  → { hp, hpMax, name, cleared, of, screen, left, boss: { on, name, hp, hpMax }, won, lost, f, rank }
 *     hp0      each body's health as the street began (its bar's whole), by id
 *     cleared  how many of its held screens are beaten, `of` how many there are; `screen` the one being fought (1…)
 *     left     the crowd on the street now, still standing
 *     boss     the boss's bar, on while it is on the street and standing
 *     won      every held screen beaten; lost: every player down
 *
 * Pure: no clock, no dice.
 */
export const streetRank = (share) => (share >= 0.75 ? 'S' : share >= 0.5 ? 'A' : share >= 0.25 ? 'B' : 'C');
/** a gun's two letters for a seat's panel: its words' initials (Machine Gun → MG), or its first two letters (Spread → SP) */
export const gunCode = (G) => { const w = gunName(G).split(/\s+/).filter(Boolean); return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toUpperCase(); };
export const gunName = (G) => G.name ?? G.id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
/** A gunner's ROUNDS, tallied off a frame's events (the range's own count): `tally` { fired, landed } → the same, added to. */
export function tallyRounds(tally, events, players = 1) {
  let { fired, landed } = tally;
  for (const e of events) { if (e.t === 'fire' && e.p < players) fired += e.n; if (e.t === 'hit' && e.kind === 'round' && e.p < players) landed++; }
  return { fired, landed };
}
/** the share of its rounds that landed, as a whole per cent (none fired: null) */
export const accuracyOf = (tally) => (tally.fired > 0 ? Math.min(100, Math.round((tally.landed * 100) / tally.fired)) : null);
export function streetRead(street, hp0 = []) {
  const { s, ctx, mind } = street, belt = ctx.belt;
  const held = belt.screens.map((sc, i) => (sc.gate || sc.boss ? i : -1)).filter((i) => i >= 0);
  const cleared = held.filter((i) => s.cleared.includes(i)).length;
  // (a seat not yet taken is no one: it is not read, and does not hold the street's end)
  const players = s.bodies.filter((b) => b.side === 'player'), me = players[0], sat = players.filter((b) => !b.aw);
  const hpOf = (b) => hp0[b.id] || ctx.fighters[b.fb ?? b.fi].hp || 1;
  const on = s.bodies.filter((b) => b.side === 'crowd' && !b.gone && !b.ko);
  const bossId = Object.keys(mind.bosses || {}).map(Number).find((id) => { const b = s.bodies[id]; return b && !b.gone; });
  const B = bossId === undefined ? null : s.bodies[bossId];
  return {
    hp: Math.max(0, me.hp), hpMax: hp0[me.id] || me.hp || 1, name: ctx.fighters[me.fi].name || '',
    cleared, of: held.length, screen: Math.min(held.length, cleared + 1), left: on.length,
    boss: B && !B.ko ? { on: true, name: mind.bosses[bossId].name, hp: Math.max(0, B.hp), hpMax: hp0[bossId] || B.hp || 1 } : { on: false, name: '', hp: 0, hpMax: 1 },
    won: held.length > 0 && cleared === held.length, lost: sat.every((b) => b.ko) && (!mind.lives || mind.lives.falls >= mind.lives.of), f: s.f,
    // (its lives, where it has them: the falls left of those allowed)
    ...(mind.lives ? { lives: { left: Math.max(0, mind.lives.of - mind.lives.falls), of: mind.lives.of } } : {}),
    // (THE OTHER SEATS, two to four: each its name, its health, its gun where it holds one; `on` once it is taken)
    mates: players.slice(1).map((b) => ({ on: !b.aw, name: ctx.fighters[b.fb ?? b.fi].name || '', hp: Math.max(0, b.hp), hpMax: hpOf(b), ...(b.gn !== undefined ? { gun: gunName(ctx.guns[b.gn]), ammo: b.am === undefined ? '∞' : String(b.am) } : {}) })),
    // (a boss with phases: the one it is in, of how many)
    ...(B && !B.ko && mind.bosses[bossId].phases ? { phase: { at: (mind.phase?.[bossId] ?? 0) + 1, of: mind.bosses[bossId].phases.length + 1 } } : {}),
    // (a fighter boss in stages, brawl-crowd.js readStages: the one it is in)
    ...(B && !B.ko && mind.bosses[bossId].stages ? { phase: { at: (mind.bosses[bossId].stage ?? 0) + 1, of: mind.bosses[bossId].stages.length } } : {}),
    // a street's RANK, by the health it was cleared with: S three quarters or more, A a half, B a quarter, else C
    rank: streetRank(Math.max(0, me.hp) / (hp0[me.id] || me.hp || 1)),
    // (a gunner's: the gun held, its rounds left (null: never out), its grenades)
    ...(me.gn !== undefined ? { gun: { on: true, name: gunName(ctx.guns[me.gn]), ammo: me.am === undefined ? '∞' : String(me.am), grenades: me.gr ?? 0 } } : {}),
  };
}

/**
 * A STREET'S SESSION, from what the game's turn hands it (game/turn.js: the picks made before the level loaded, the
 * play shell's `params`): who plays and how hard the street fights. A street played on its own, or by a game that asks
 * nothing, plays as it is written.
 *   params.__picks.fighter   the roster entry (its id), or several (a seat each, to four), the player chose
 *   params.__picks.gun       a run & gun's starting gun (a street played `gun`): held first, where the street lists it
 *   params.difficulty        the engine's tier (easy | medium | max): STREET_DIFFICULTY's row
 *   streetSession(params, roster, players) → { players: [roster index…], difficulty: tier | null }
 * `roster` [{ id }] the street's roster as its page holds it; `players` the indices it was written with.
 */
export const STREET_DIFFICULTY = Object.freeze({
  easy: Object.freeze({ says: 'one at a time, slow to come back, fewer on the street; a boss on its easiest mind', crowd: Object.freeze({ tokens: 1, cool: Object.freeze([120, 220]), limit: 3 }), cpu: 'first' }),
  medium: Object.freeze({ says: 'one at a time, a breath between them', crowd: Object.freeze({ tokens: 1, cool: Object.freeze([90, 170]) }), cpu: null }),
  max: Object.freeze({ says: 'two at once, at the crowd\'s own pace; a boss on its sharpest mind', crowd: Object.freeze({ tokens: 2 }), cpu: 'last' }),
});
export function streetSession(params, roster, players) {
  const P = params && typeof params === 'object' ? params : {}, picks = P.__picks && typeof P.__picks === 'object' ? P.__picks : {};
  const asked = picks.fighter === undefined ? [] : Array.isArray(picks.fighter) ? picks.fighter : [picks.fighter];
  const chosen = asked.map((id) => roster.findIndex((r) => r && r.id === id)).filter((k) => k >= 0).slice(0, 4);
  // (a run & gun's starting gun, where its turn asks one: a brawl-guns.js row's name)
  return { players: chosen.length ? chosen : players.slice(0, 4), ...(typeof picks.gun === 'string' ? { gun: picks.gun } : {}), difficulty: typeof P.difficulty === 'string' && STREET_DIFFICULTY[P.difficulty] ? P.difficulty : null };
}

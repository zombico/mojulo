/**
 * BATTLES — turn-based fights (cosmos power.combat=turn-based), composed of what the play block already has: walking up
 * to a foe opens its battle (a talk menu: its hp and yours, Attack, Guard, Flee); a pick is the hero's turn, and a beat
 * later the foe answers (a cue on the pick's cue-end), the menu up again for the next turn; at no hp the foe falls.
 * The world freezes while a menu is up (the menus' hold), so the turns are the only time that passes.
 *
 *   play.battle: { hero?: { atk?: 2, hp?: 'hp' }, foes: [{ who, at: [x, y], name?, hp?: 6, atk?: 2 }], near?: 2.2 }
 *     hero.hp     the var the hero's hp is (a level's fail-on-death owns it: at 0 the level fails)
 *     guard       a turn guarding takes half the foe's blow (rounded up)
 *
 * Vars on the bus: `battle` (1 while a fight is up), `foe-hp-<who>` each foe's, `won` the fights won.
 *
 *   readBattle(play)       → { hero, foes, near } or null; throws, teaching
 *   battleCues(play) / battleMenus(play)
 *   withBattle(play)       → play with the battle's cues and menus appended (the same object without one)
 */
const ID = /^[a-z][a-z0-9_-]*$/i;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const err = (m) => new Error(`play.battle${m}`);
const BEAT = 0.9;   // seconds between the hero's turn and the foe's answer

export function readBattle(play) {
  const B = play && play.battle;
  if (B === undefined) return null;
  if (!isObj(B) || !Array.isArray(B.foes) || !B.foes.length) throw err(' is { hero?: { atk?, hp? }, foes: [{ who, at, name?, hp?, atk? }], near? }');
  for (const k of Object.keys(B)) if (!['hero', 'foes', 'near'].includes(k)) throw err(`.${k} is not part of a battle (hero, foes, near)`);
  const hero = { atk: 2, hp: 'hp', ...(isObj(B.hero) ? B.hero : {}) };
  if (!(Number.isFinite(hero.atk) && hero.atk > 0) || typeof hero.hp !== 'string') throw err('.hero is { atk: a number, hp: the var its hp is }');
  const seen = new Set();
  const foes = B.foes.map((f, i) => {
    const at = `.foes[${i}]`;
    if (!isObj(f) || typeof f.who !== 'string' || !ID.test(f.who)) throw err(`${at}.who is the foe's entity id`);
    if (seen.has(f.who)) throw err(`${at}.who '${f.who}' fights twice`);
    seen.add(f.who);
    if (!Array.isArray(f.at) || f.at.length < 2 || !f.at.every(Number.isFinite)) throw err(`${at}.at is where it stands [x, y]`);
    for (const k of ['hp', 'atk']) if (f[k] !== undefined && !(Number.isFinite(f[k]) && f[k] > 0)) throw err(`${at}.${k} is a number above 0`);
    return { who: f.who, at: [f.at[0], f.at[1]], name: typeof f.name === 'string' && f.name ? f.name : f.who, hp: f.hp ?? 6, atk: f.atk ?? 2 };
  });
  const near = Number.isFinite(B.near) && B.near > 0 ? B.near : 2.2;
  return { hero, foes, near };
}

export function battleMenus(play) {
  const B = readBattle(play);
  if (!B) return [];
  return B.foes.map((f) => ({
    id: `battle-${f.who}`, kind: 'talk', title: `Battle · ${f.name}`,
    lines: [`${f.name}: {foe-hp-${f.who}} hp`, `You: {${B.hero.hp}} hp`],
    choices: [{ say: 'Attack', then: { emit: `battle-attack-${f.who}` } }, { say: 'Guard', then: { emit: `battle-guard-${f.who}` } }, { say: 'Flee', then: { emit: `battle-flee-${f.who}` } }],
  }));
}

export function battleCues(play) {
  const B = readBattle(play);
  if (!B) return [];
  const H = B.hero, cues = [{ id: 'battle-setup', when: { start: true }, then: [{ set: 'battle', to: 0 }, { set: 'won', to: 0 }, ...B.foes.map((f) => ({ set: `foe-hp-${f.who}`, to: f.hp }))] }];
  for (const f of B.foes) {
    const hp = `foe-hp-${f.who}`, alive = { var: hp, gt: 0 }, menu = `battle-${f.who}`;
    cues.push(
      // walking up to it, out of a fight: the fight begins
      { id: `battle-meet-${f.who}`, when: { enter: { at: f.at, r: B.near } }, if: [alive, { var: 'battle', eq: 0 }], then: [{ set: 'battle', to: 1 }, { open: menu }] },
      // the hero's turn: a blow (or a guard), then the foe answers a beat later, if it still stands
      { id: `battle-hit-${f.who}`, when: { on: `battle-attack-${f.who}` }, then: [{ add: hp, by: -H.atk, min: 0 }, { puff: { who: f.who, is: 'smoke', shake: 0.3 } }], until: { ttl: BEAT } },
      { id: `battle-guard-${f.who}`, when: { on: `battle-guard-${f.who}` }, then: { say: 'You brace yourself', as: 'toast' }, until: { ttl: BEAT } },
      { id: `battle-answer-${f.who}`, when: { on: `cue-end:battle-hit-${f.who}` }, if: alive, then: [{ add: H.hp, by: -f.atk, min: 0 }, { shake: 0.4 }, { open: menu }] },
      { id: `battle-answer-g-${f.who}`, when: { on: `cue-end:battle-guard-${f.who}` }, if: alive, then: [{ add: H.hp, by: -Math.ceil(f.atk / 2), min: 0 }, { shake: 0.2 }, { open: menu }] },
      // its fall: the fight is won
      { id: `battle-won-${f.who}`, when: { var: hp, lte: 0 }, then: [{ kill: f.who }, { set: 'battle', to: 0 }, { add: 'won', by: 1 }, { say: `${f.name} falls`, as: 'banner' }] },
      // fleeing: the fight is off (walk up again to take it up)
      { id: `battle-flee-${f.who}`, when: { on: `battle-flee-${f.who}` }, then: [{ set: 'battle', to: 0 }, { say: 'You get away', as: 'toast' }] },
    );
  }
  return cues;
}

export function withBattle(play) {
  if (!play || play.battle === undefined) return play;
  return { ...play, cues: [...(play.cues || []), ...battleCues(play)], menus: [...(play.menus || []), ...battleMenus(play)] };
}

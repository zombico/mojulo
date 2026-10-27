import { describe, it, expect } from 'vitest';
import { tableCompile, tableStart, tableLegal, tableApply, tableAct, TABLE_RPG_STANDING } from './table-rpg-kernel.js';
import { systemOf } from './table-rpg-systems.js';
import { withCast, earOf, CAST_PARTS } from './table-rpg-cast.js';
import { readModule, refereePacket } from './table-rpg-module.js';
import { tableRpgBook } from './table-rpg-book.js';
import { factionMapSvg } from './table-rpg-maps.js';
import { SUNKEN_CHAPEL } from './fixtures/sunken-chapel.js';

// the smallest ground a factioned encounter needs: a gate, a hall held by a faction's guards and their captain
const HALL = (extra = {}) => ({
  seed: 3, system: systemOf('target'),
  party: [{ id: 'a', name: 'Ana', role: 'frontline' }, { id: 'b', name: 'Bel', role: 'support' }],
  world: { start: 'town', places: [{ id: 'town', dungeon: 'keep' }] },
  dungeons: { keep: { entry: 'gate', rooms: [{ id: 'gate' }, { id: 'hall', foes: ['guard', 'captain'] }], links: [{ a: 'gate', b: 'hall' }] } },
  foes: { guard: { name: 'Guard', rank: 1, faction: 'watch' }, captain: { name: 'Captain', rank: 2, faction: 'watch' } },
  factions: { watch: { name: 'the Watch', allies: ['guild'], rivals: ['thieves'] }, guild: { name: 'the Guild', allies: ['watch'] }, thieves: { name: 'the Thieves', rivals: ['watch'] } },
  items: { gem: { name: 'a gem', kind: 'treasure' }, crown: { name: 'the crown', kind: 'treasure' } },
  goal: { item: 'crown' },
  ...extra,
});
// into the hall, to the first member's turn (the foes may have struck first)
function atHall(K) {
  let { S } = tableStart(K);
  for (const c of ['enter', 'go hall']) S = tableAct(K, S, c).S;
  return S;
}
const D = systemOf('target').check.difficulty;
const talks = (K, S) => tableLegal(K, S).filter((m) => ['parley', 'threaten', 'bribe'].includes(m.verb)).map((m) => m.name);
// the seeds whose first talk lands in a band, found in code (small, the same every run)
function firstSeed(make, verb, want) {
  for (let seed = 1; seed < 80; seed++) {
    const K = tableCompile(make(seed)), S = atHall(K);
    if (!S.fight || S.over) continue;
    const r = tableAct(K, S, verb);
    if (want(r)) return { K, S0: S, ...r };
  }
  throw new Error(`no seed under 80 gives that ${verb}`);
}

describe('factions in the kernel: talk through the leader, standing that remembers', () => {
  it('refuses a faction it cannot read, teaching', () => {
    expect(() => tableCompile(HALL({ foes: { guard: { rank: 1, faction: 'navy' }, captain: { rank: 2 } } }))).toThrow(/belongs to 'navy', which is no faction/);
    expect(() => tableCompile(HALL({ factions: { watch: { standing: 3 } } }))).toThrow(/standing is −2 \(hostile\) to 2 \(allied\)/);
    expect(() => tableCompile(HALL({ factions: { watch: { rivals: ['watch'] } } }))).toThrow(/rivals names 'watch', which is no other faction/);
    expect(() => tableCompile(HALL({ foes: { guard: { rank: 1, faction: 'watch', heeds: ['flatter'] }, captain: { rank: 2, faction: 'watch' } } }))).toThrow(/heeds is some of parley, threaten, bribe/);
  });

  it('the standing sets the difficulty, a step for what the leader heeds or scorns; hostile will not hear', () => {
    const at = (standing, captain = {}) => {
      const K = tableCompile(HALL({ factions: { ...HALL().factions, watch: { ...HALL().factions.watch, standing } }, foes: { ...HALL().foes, captain: { ...HALL().foes.captain, ...captain } } }));
      const S = atHall(K);
      return { K, S, said: talks(K, S).includes('parley') ? tableAct(K, S, 'parley').lines[0] : null };
    };
    expect(at(0).said).toContain(`vs target ${D.medium}`);
    expect(at(1).said).toContain(`vs target ${D.easy}`);
    expect(at(-1).said).toContain(`vs target ${D.hard}`);
    expect(at(0, { heeds: ['parley'] }).said).toContain(`vs target ${D.easy}`);
    expect(at(0, { scorns: ['parley'] }).said).toContain(`vs target ${D.hard}`);
    expect(at(-1, { scorns: ['parley'] }).said).toBeNull();   // past hard: not heard
    const { K, S } = at(-2);
    expect(talks(K, S)).toEqual([]);
    // the leader is the highest rank standing: the captain's ear, not the guard's
    expect(at(0, { heeds: ['parley'] }).said).toContain('with Captain');
  });

  it('a parley that lands: the foes stand aside, the room passed, the faction a step warmer; once a fight', () => {
    const won = firstSeed((seed) => HALL({ seed }), 'parley', (r) => !r.S.fight && /stand aside/.test(r.lines.join('\n')) && !/at a cost/.test(r.lines[0]));
    expect(won.S.cleared['keep/hall']).toBe(1);
    expect(won.S.standing.watch).toBe(1);
    expect(won.lines.join('\n')).toContain(`Standing: the Watch ${TABLE_RPG_STANDING[3]} (+1).`);
    const lost = firstSeed((seed) => HALL({ seed }), 'parley', (r) => /hear no more/.test(r.lines.join('\n')));
    if (lost.S.fight) expect(talks(lost.K, lost.S)).toEqual([]);
  });

  it('a threat that lands lowers the standing it frightens', () => {
    const r = firstSeed((seed) => HALL({ seed }), 'threaten', (x) => !x.S.fight && /stand aside/.test(x.lines.join('\n')) && !/at a cost/.test(x.lines[0]));
    expect(r.S.standing.watch).toBe(-1);
  });

  it('a bribe offers a treasure, never the goal, and spends it when taken', () => {
    const K = tableCompile(HALL());
    let S = atHall(K);
    S = { ...S, bag: { gem: 1, crown: 1 } };
    expect(talks(K, S)).toContain('bribe gem');
    expect(talks(K, S)).not.toContain('bribe crown');
    for (let seed = 1; seed < 80; seed++) {
      const K2 = tableCompile(HALL({ seed })), S2 = atHall(K2);
      if (!S2.fight) continue;
      const out = tableApply(K2, { ...S2, bag: { gem: 1 } }, { verb: 'bribe', item: 'gem', by: S2.fight.order[S2.fight.turn].id });
      if (!out.S.fight && /changes hands/.test(out.lines.join('\n'))) { expect(out.S.bag.gem).toBe(0); return; }
    }
    throw new Error('no bribe landed under seed 80');
  });

  it('foes beaten: their faction and its allies a step colder, its rivals a step warmer', () => {
    for (let seed = 1; seed < 40; seed++) {
      const K = tableCompile(HALL({ seed }));
      let S = atHall(K);
      for (let n = 0; n < 60 && S.fight && !S.over; n++) S = tableApply(K, S, tableLegal(K, S).find((m) => m.verb === 'attack')).S;
      if (S.over || S.fight) continue;
      expect(S.standing).toEqual({ watch: -1, guild: -1, thieves: 1 });
      return;
    }
    throw new Error('no fight won under seed 40');
  });

  it('allied foes stand aside unasked; a module with no factions has no factions move', () => {
    const K = tableCompile(HALL({ factions: { ...HALL().factions, watch: { ...HALL().factions.watch, standing: 2 } } }));
    let { S } = tableStart(K);
    S = tableAct(K, S, 'enter').S;
    const r = tableAct(K, S, 'go hall');
    expect(r.S.fight).toBeNull();
    expect(r.lines.join('\n')).toContain('allied to you. They stand aside.');
    expect(r.S.cleared['keep/hall']).toBe(1);
    const bare = tableCompile({ ...HALL(), factions: undefined, foes: { guard: { rank: 1 }, captain: { rank: 2 } } });
    expect(tableLegal(bare, tableStart(bare).S).some((m) => m.verb === 'factions')).toBe(false);
  });
});

describe('the cast: the antagonists as a character graph on the egocube', () => {
  it('what a mind listens to: by whom it serves and by what rule', () => {
    expect(earOf({ motivation: 0.9, order: 0.5 })).toEqual({ heeds: ['bribe'], scorns: [] });
    expect(earOf({ motivation: 0.1, order: 0.1 })).toEqual({ heeds: ['parley'], scorns: ['bribe', 'threaten'] });
    expect(earOf({ motivation: 0.5, order: 0.9 })).toEqual({ heeds: ['threaten'], scorns: ['parley'] });
  });

  it('writes two rival factions and their people by rank, each a persona; the same seed the same cast', () => {
    const M = withCast({ seed: 5, cast: true, foes: {} });
    expect(Object.keys(M.factions)).toEqual(['mastermind', 'rival']);
    expect(M.factions.mastermind).toMatchObject({ standing: -1, rivals: ['rival'] });
    expect(M.factions.rival).toMatchObject({ standing: 0, rivals: ['mastermind'] });
    expect(CAST_PARTS.map((p) => M.foes[p].rank)).toEqual([5, 4, 1, 3, 1]);
    expect(CAST_PARTS.map((p) => M.foes[p].faction)).toEqual(['mastermind', 'mastermind', 'mastermind', 'rival', 'rival']);
    expect(M.foes.mastermind.persona).toMatchObject({ relation: 'mastermind' });
    expect(M.foes.troop.name).toMatch(new RegExp(`^${M.foes.mastermind.name}'s `));
    expect(M.cast).toBeUndefined();
    expect(withCast({ seed: 5, cast: true, foes: {} })).toEqual(M);
    expect(withCast({ seed: 6, cast: true, foes: {} }).foes.mastermind.name).not.toBe(M.foes.mastermind.name);
    expect(() => withCast({ cast: { as: { boss: 'x' } } })).toThrow(/cast.as.boss is not a part of the cast/);
  });

  it('as: the module\'s own foes take the parts, what the module wrote winning; a foe rolled alone', () => {
    const { K } = readModule({ ...SUNKEN_CHAPEL, cast: { as: { mastermind: 'barrow-wight', troop: 'ghoul' } }, foes: { ...SUNKEN_CHAPEL.foes, 'grave-rat': { ...SUNKEN_CHAPEL.foes['grave-rat'], egocube: true } } });
    expect(K.foes['barrow-wight']).toMatchObject({ name: 'Barrow Wight', rank: 3, faction: 'mastermind' });
    expect(K.foes.ghoul).toMatchObject({ name: 'Ghoul', rank: 2, faction: 'mastermind' });
    expect(K.foes['grave-rat'].persona.epithet).toMatch(/^the /);
    expect(K.foes['grave-rat'].faction).toBeUndefined();
  });

  it('a starter\'s boss leads the cast, its minions the troops, the road\'s bandits the rival\'s hands', () => {
    const { K } = readModule({ starter: { use: 'keep' }, cast: true });
    expect(K.foes.castellan.faction).toBe('mastermind');
    expect(K.foes['man-at-arms'].faction).toBe('mastermind');
    expect(K.foes.bandit.faction).toBe('rival');
  });
});

describe('the factions in print', () => {
  const cast = () => readModule({ ...SUNKEN_CHAPEL, cast: { as: { mastermind: 'barrow-wight', troop: 'ghoul', hand: 'footpad' } } }).K;
  it('a chapter: the diagram, the talk and its standing, each faction\'s people; none without factions', () => {
    const K = cast(), { html } = tableRpgBook(K);
    expect(html).toContain('id="factions"');
    for (const F of Object.values(K.factions)) expect(html).toContain(`id="faction-${F.id}"`);
    expect(html).toContain('<b>Barrow Wight</b>, rank 3');
    expect(html).toContain(`medium (${K.sys.check.difficulty.medium})`);
    expect(tableRpgBook(readModule(SUNKEN_CHAPEL).K).html).not.toContain('id="factions"');
    expect(factionMapSvg(K).match(/class="tie rivals"/g)).toHaveLength(1);
    expect(refereePacket(K)).toContain('## Factions');
  });
});

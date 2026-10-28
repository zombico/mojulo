import { describe, it, expect } from 'vitest';
import { buildTableRpg, tableRoll, tableParseDice, tableTape, tableSheet, tableResolve, tableCompile, tableStart, tableLegal, tableParse, tableApply, tableAct } from './table-rpg-kernel.js';
import { TABLE_RPG_SYSTEMS, CHECK_KINDS, systemOf } from './table-rpg-systems.js';
import { SUNKEN_CHAPEL } from './fixtures/sunken-chapel.js';

// one system per resolution procedure, picked off the catalog (a new system of a known procedure adds no case)
const BY_KIND = Object.fromEntries(CHECK_KINDS.map((k) => [k, Object.keys(TABLE_RPG_SYSTEMS).find((id) => TABLE_RPG_SYSTEMS[id].check.kind === k)]));
const compiled = (system, extra = {}) => tableCompile({ ...SUNKEN_CHAPEL, ...extra, system: systemOf(system) });

// the module's way to its goal, a party that fights what it meets and takes a tonic when someone is low
const ROUTE = ['travel standing-stones', 'travel barrow-hill', 'enter', 'go nave', 'go vestry', 'take iron-key', 'take tonic', 'go nave',
  'go gallery', 'go crypt-stair', 'unlock crypt', 'rest', 'go crypt', 'go reliquary', 'take saint-bell'];
function play(K, route = ROUTE, cap = 400) {
  let { S, lines } = tableStart(K);
  const said = [...lines];
  let i = 0;
  for (let n = 0; n < cap && !S.over; n++) {
    const L = tableLegal(K, S);
    let mv;
    if (S.fight) {
      const low = S.party.some((p) => p.hp > 0 && p.hp * 3 < p.maxHp);
      mv = (low && L.find((m) => m.verb === 'use')) || L.find((m) => m.verb === 'attack');
    } else {
      while (i < route.length && !L.some((m) => m.name === route[i])) i++;
      const want = route[i++];
      mv = L.find((m) => m.name === want);
    }
    if (!mv) break;
    said.push(`> ${mv.name}`);
    const r = tableApply(K, S, mv);
    S = r.S; said.push(...r.lines);
  }
  return { S, lines: said };
}

describe('the dice: notation, seeded, said in the open', () => {
  it('reads the notation: NdS, d%, dF, keep and drop, exploding, terms and flat numbers', () => {
    expect(tableParseDice('4d6kh3')).toMatchObject([{ n: 4, sides: 6, keep: { hi: 3 } }]);
    expect(tableParseDice('2d20kl1')).toMatchObject([{ n: 2, sides: 20, keep: { lo: 1 } }]);
    expect(tableParseDice('4d6dl1')).toMatchObject([{ keep: { hi: 3 } }]);
    expect(tableParseDice('d%')).toMatchObject([{ n: 1, sides: 100 }]);
    expect(tableParseDice('4dF')).toMatchObject([{ n: 4, sides: 'F' }]);
    expect(tableParseDice('1d6!+2-1')).toMatchObject([{ explode: true }, { s: 1, flat: 2 }, { s: -1, flat: 1 }]);
    for (const bad of ['', 'banana', '0d6', '3d1', '2d6kh3', '4dF!']) expect(() => tableParseDice(bad)).toThrow(/dice/);
  });

  it('rolls within the dice\'s span, keeps what it says it keeps, and the same state rolls the same', () => {
    const S = { r: 99 };
    for (let k = 0; k < 50; k++) {
      const r = tableRoll(S, '4d6kh3');
      expect(r.total).toBeGreaterThanOrEqual(3); expect(r.total).toBeLessThanOrEqual(18);
      expect(r.faces).toHaveLength(3);
      expect(r.total).toBe(r.faces.reduce((a, b) => a + b, 0));
      const f = tableRoll(S, '4dF').total;
      expect(f).toBeGreaterThanOrEqual(-4); expect(f).toBeLessThanOrEqual(4);
    }
    expect(tableRoll({ r: 5 }, '3d6+2')).toEqual(tableRoll({ r: 5 }, '3d6+2'));
    expect(tableRoll({ r: 5 }, '1d20').text).toMatch(/^1d20 → \[\d+\] = \d+$/);
    expect(tableRoll({ r: 5 }, '1d20').nat).toBe(tableRoll({ r: 5 }, '1d20').total);
  });

  it('a dice tape is the seed\'s, die by die', () => {
    expect(tableTape(7, 20, 12)).toEqual(tableTape(7, 20, 12));
    expect(tableTape(7, 20, 12)).not.toEqual(tableTape(8, 20, 12));
    expect(tableTape(7, 6, 40).every((v) => v >= 1 && v <= 6)).toBe(true);
  });
});

describe('a character sheet: rolled from the book, on its own stream', () => {
  const card = TABLE_RPG_SYSTEMS.target;
  it('each generation method: rolled and placed by the class, an array placed, points bought', () => {
    const rolled = tableSheet(card, { id: 'a', class: 'warrior' }, 1);
    const pr = card.classes.warrior.priority;
    for (let i = 1; i < pr.length; i++) expect(rolled.scores[pr[i - 1]]).toBeGreaterThanOrEqual(rolled.scores[pr[i]]);
    expect(rolled.maxHp).toBe(card.classes.warrior.hitDie + rolled.mods.con);
    expect(rolled.mods.str).toBe(Math.floor((rolled.scores.str - 10) / 2));
    const arr = tableSheet(card, { id: 'a', class: 'adept', method: 'array' }, 1);
    expect(arr.scores.int).toBe(15);
    expect(Object.values(arr.scores).sort((x, y) => y - x)).toEqual([...card.generate.methods.array.values]);
    const bought = tableSheet(card, { id: 'a', class: 'scout', method: 'pointbuy', scores: { str: 8, dex: 15, con: 14, int: 12, wis: 10, cha: 13 } }, 1);
    expect(bought.scores.dex).toBe(15);
    expect(() => tableSheet(card, { id: 'a', class: 'scout', method: 'pointbuy', scores: { str: 15, dex: 15, con: 15, int: 15, wis: 8, cha: 8 } }, 1)).toThrow(/budget is 30/);
  });

  it('three dice in order stay in order; a member\'s dice never move another\'s', () => {
    const classic = TABLE_RPG_SYSTEMS.under;
    const s = tableSheet(classic, { id: 'b', class: 'scout' }, 3);
    expect(s.rolls.slice(0, 6).map((t) => t.split(' ')[0])).toEqual(['Str', 'Dex', 'Con', 'Int', 'Wis', 'Cha']);
    const K1 = compiled('target', { party: [{ id: 'alys', role: 'frontline' }] });
    const K2 = compiled('target', { party: [{ id: 'wren', role: 'flanker' }, { id: 'alys', role: 'frontline' }] });
    expect(K2.party[1].scores).toEqual(K1.party[0].scores);
  });

  it('a role plays as the system\'s class that takes it; a level is the system\'s growth', () => {
    for (const id of Object.values(BY_KIND)) {
      const K = compiled(id);
      const sys = TABLE_RPG_SYSTEMS[id];
      expect(sys.classes[K.party[0].class].roles).toContain('frontline');
      const lv3 = tableSheet(sys, { id: 'alys', class: K.party[0].class, level: 3 }, 7);
      expect(lv3.level).toBe(3);
      if (sys.hp.kind === 'die') expect(lv3.maxHp).toBeGreaterThan(K.party[0].maxHp);
      else expect(Object.values(lv3.scores).reduce((a, b) => a + b, 0)).toBeGreaterThan(Object.values(K.party[0].scores).reduce((a, b) => a + b, 0));
    }
  });
});

describe('resolution: every procedure reads as one band', () => {
  it('each check kind, at each difficulty, answers a band and says its dice', () => {
    for (const [kind, id] of Object.entries(BY_KIND)) {
      const K = compiled(id), pc = { ...K.party[0], i: 0 };
      const S = { r: 11 };
      const bands = new Set();
      for (let k = 0; k < 200; k++) for (const d of ['easy', 'medium', 'hard']) {
        const r = tableResolve(K, S, pc, 'might', d);
        expect(['crit', 'success', 'partial', 'fail', 'fumble']).toContain(r.band);
        bands.add(r.band);
        expect(r.text).toMatch(/→/);
      }
      expect(bands.has('success') && bands.has('fail')).toBe(true);
      // the bands, shifts and challenge procedures have a middle band; target, under and percent do not
      expect(bands.has('partial')).toBe(['bands', 'shifts', 'challenge'].includes(kind));
    }
  });

  it('an easy check passes more often than a hard one, under every procedure', () => {
    for (const id of Object.values(BY_KIND)) {
      const K = compiled(id), pc = { ...K.party[0], i: 0 };
      const rate = (d) => { const S = { r: 3 }; let n = 0; for (let k = 0; k < 400; k++) if (['crit', 'success', 'partial'].includes(tableResolve(K, S, pc, 'wits', d).band)) n++; return n; };
      expect(rate('easy')).toBeGreaterThan(rate('hard'));
    }
  });

  it('a faculty is the system\'s ability; an unknown one is refused, teaching', () => {
    const K = compiled('challenge'), pc = { ...K.party[0], i: 0 };
    expect(tableResolve(K, { r: 1 }, pc, 'stealth', 'medium').text).toMatch(/Guile \(stealth\)/);
    expect(() => tableResolve(K, { r: 1 }, pc, 'luck', 'medium')).toThrow(/is a faculty/);
  });
});

describe('play in text: the module from its hook to its end', () => {
  it('is pure, and its source runs alone (a page emits it): the same commands are the same game', () => {
    const K = compiled('target');
    expect(play(K)).toEqual(play(K));
    const page = new Function(`return (${buildTableRpg.toString()})();`)();
    const Kp = page.compile({ ...SUNKEN_CHAPEL, system: TABLE_RPG_SYSTEMS.target });
    let a = page.start(Kp), b = tableStart(K);
    expect(a.lines).toEqual(b.lines);
    for (const c of ['travel standing-stones', 'look', 'roll 3d6', 'ask is anyone watching likely', 'check stealth hard']) {
      a = page.act(Kp, a.S, c); b = tableAct(K, b.S, c);
      expect(a.lines).toEqual(b.lines);
    }
  });

  it('under every resolution procedure, the party reaches the goal through the lock, the trap and the foes', () => {
    for (const id of Object.values(BY_KIND)) {
      const { S, lines } = play(compiled(id));
      expect(S.over, id).toBeTruthy();
      const text = lines.join('\n');
      expect(text).toMatch(/Foes! Ghoul/);
      expect(text).toMatch(/A step gives way/);
      expect(text).toMatch(/turns: the way to the Crypt is open/);
      // the test module is winnable by a plain party under every procedure (a balance check on the foe ranks)
      expect(S.over, id).toEqual({ won: true, reason: 'the goal is met' });
      expect(S.bag['saint-bell']).toBe(1);
    }
  });

  it('a lock holds without its key; a hidden way shows once searched for; a taken item leaves the room', () => {
    const K = compiled('target');
    let { S } = tableStart(K);
    for (const c of ['travel standing-stones', 'travel barrow-hill', 'enter']) S = tableAct(K, S, c).S;
    S = { ...S, at: { place: 'barrow-hill', dungeon: 'chapel', room: 'crypt-stair' }, cleared: { 'chapel/nave': 1 }, sprung: { 'chapel/crypt-stair': 1 } };
    const names = () => tableLegal(K, S).map((m) => m.name);
    expect(names()).not.toContain('go crypt');
    expect(names()).toContain('force crypt');
    expect(names()).not.toContain('unlock crypt');
    S = { ...S, at: { ...S.at, room: 'gallery' } };
    expect(names()).not.toContain('go ossuary');
    S = { ...S, found: { 'chapel/5': 1 } };
    expect(names()).toContain('go ossuary');
    S = { ...S, at: { ...S.at, room: 'vestry' } };
    expect(names()).toContain('take iron-key');
    S = tableAct(K, S, 'take the iron key').S;
    expect(S.bag['iron-key']).toBe(1);
    expect(tableLegal(K, S).map((m) => m.name)).not.toContain('take iron-key');
  });

  it('typed words: a room or a foe by name or id, a free check, a roll, the oracle; anything else lists the moves', () => {
    const K = compiled('bands');
    let { S } = tableStart(K);
    expect(tableParse(K, S, 'travel the standing stones')).toMatchObject({ verb: 'travel', to: 'standing-stones' });
    expect(tableParse(K, S, 'check presence easy by tamsin')).toMatchObject({ verb: 'check', faculty: 'presence', difficulty: 'easy', by: 'tamsin' });
    expect(tableParse(K, S, 'check grace 1')).toMatchObject({ faculty: 'grace', difficulty: 1 });
    expect(tableParse(K, S, 'roll 2d6+1')).toMatchObject({ verb: 'roll' });
    expect(tableParse(K, S, 'ask does the reeve lie unlikely')).toMatchObject({ verb: 'ask', odds: 'unlikely', question: 'does the reeve lie' });
    expect(tableParse(K, S, 'check luck')).toBeNull();
    const r = tableAct(K, S, 'dance');
    expect(r.lines[0]).toMatch(/is not a move now\. Moves: look · map · sheet · travel standing-stones/);
    expect(r.S).toBe(S);
    S = tableAct(K, S, 'ask is it raining').S;
    expect(S.turn).toBe(1);
  });

  it('the players roll every die: a foe hurts only on the bands the card says cost', () => {
    for (const id of [BY_KIND.bands, BY_KIND.challenge]) {
      const { lines } = play(compiled(id));
      const text = lines.join('\n');
      expect(text).not.toMatch(/strikes at|attacks Alys|attacks Wren|attacks Tamsin/);
      for (const m of text.matchAll(/strikes back\./g)) {
        const before = text.slice(0, m.index).split('\n').reverse().find((l) => / attacks .* with the /.test(l));
        expect(before).toMatch(TABLE_RPG_SYSTEMS[id].combat.costOn.includes('partial') ? /a success at a cost|a failure|a fumble/ : /a failure|a fumble/);
      }
    }
  });

  it('progression is the system\'s: experience from foes, marks from misses, levels at milestones', () => {
    const xp = play(compiled(BY_KIND.target)).lines.join('\n');
    expect(xp).toMatch(/The party earns \d+ experience/);
    const miss = play(compiled(BY_KIND.bands));
    expect(miss.S.party.some((p) => p.marks > 0 || p.level > 1)).toBe(true);
    const mile = play(compiled(BY_KIND.shifts)).lines.join('\n');
    expect(mile).toMatch(/reaches level 2/);
    expect(mile).not.toMatch(/experience/);
  });

  it('the party falls: the tale ends lost, and nothing moves after', () => {
    const K = compiled('target', { foes: { ...SUNKEN_CHAPEL.foes, ghoul: { name: 'Ghoul', rank: 5 } } });
    const { S, lines } = play(K, ROUTE.slice(0, 4));
    expect(S.over).toEqual({ won: false, reason: 'the party falls' });
    expect(lines.at(-1)).toBe('The party falls. The tale ends here.');
    expect(tableLegal(K, S).map((m) => m.name)).toEqual(['sheet']);
  });

  it('refuses a module that cannot play, saying what to write', () => {
    expect(() => compiled('target', { party: [] })).toThrow(/party is 1 to 6/);
    expect(() => compiled('target', { party: [{ id: 'x', role: 'dancer' }] })).toThrow(/a role a class takes/);
    expect(() => compiled('target', { goal: { item: 'grail' } })).toThrow(/goal.item 'grail' is no item/);
    const bad = JSON.parse(JSON.stringify(SUNKEN_CHAPEL));
    bad.dungeons.chapel.links.push({ a: 'nave', b: 'attic' });
    expect(() => compiled('target', bad)).toThrow(/names a room that is none/);
    bad.dungeons.chapel.links.pop();
    bad.dungeons.chapel.links.push({ a: 'nave', b: 'porch', kind: 'locked' });
    expect(() => compiled('target', bad)).toThrow(/needs a key or a force/);
  });
});

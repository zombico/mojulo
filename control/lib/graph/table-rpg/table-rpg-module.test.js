import { describe, it, expect } from 'vitest';
import { readModule, refereePacket, playScript, TABLE_RPG_KEYS } from './table-rpg-module.js';
import { checkDungeon } from './table-rpg-dungeon.js';
import { dungeonFromProgram } from './table-rpg-program.js';
import { checkWorld, toEpochMap } from './table-rpg-world.js';
import { withPersonas, toLiveParty } from './table-rpg-party.js';
import { TABLE_RPG_SYSTEMS } from './table-rpg-systems.js';
import { tableCompile, tableTape } from './table-rpg-kernel.js';
import { SUNKEN_CHAPEL } from './fixtures/sunken-chapel.js';
import { PROGRAMS } from '../era/programs.js';
import { readMapSpec } from '../board/board-map.js';
import { readRpg } from '../playscape/rpg/rpg.js';
import { rpgInit, rpgStart, rpgRound, rpgTargets } from '../playscape/rpg/kernel.js';

const chapel = () => JSON.parse(JSON.stringify(SUNKEN_CHAPEL.dungeons.chapel));

describe('the module: read, checked, said as text', () => {
  it('takes a starter by id (target when none) and refuses a key it does not know', () => {
    expect(readModule(SUNKEN_CHAPEL).K.sys.name).toBe('target');
    expect(readModule({ ...SUNKEN_CHAPEL, system: 'shifts' }).K.sys.check.kind).toBe('shifts');
    expect(() => readModule({ ...SUNKEN_CHAPEL, system: 'gurps' })).toThrow(/no starter 'gurps'.*written out as a card/);
    expect(() => readModule({ ...SUNKEN_CHAPEL, map: {} })).toThrow(new RegExp(`unknown key 'map' \\(keys: ${TABLE_RPG_KEYS.join(', ')}\\)`));
  });

  it('a rules card written out plays as a starter does, and a broken one is refused, teaching', () => {
    const own = { ...TABLE_RPG_SYSTEMS.bands, name: 'my hack' };
    expect(readModule({ ...SUNKEN_CHAPEL, system: own }).K.sys.name).toBe('my hack');
    expect(() => readModule({ ...SUNKEN_CHAPEL, system: { ...own, faculties: { ...own.faculties, stealth: 'luck' } } })).toThrow(/faculty 'stealth' names no ability/);
  });

  it('checks the world and every dungeon with the goal in it', () => {
    const { checks } = readModule(SUNKEN_CHAPEL);
    expect(checks.world).toMatchObject({ ok: true, reach: ['millbrook', 'standing-stones', 'barrow-hill'] });
    expect(checks.dungeons.chapel).toMatchObject({ ok: true, keys: ['iron-key'], loops: 1 });
    expect(checks.dungeons.chapel.reach.at(-1)).toBe('reliquary');
  });

  it('the referee packet: the rules, the attribution, the party as rolled, every room, the foes in the system\'s numbers, the tape', () => {
    for (const id of ['target', 'bands']) {
      const { K } = readModule({ ...SUNKEN_CHAPEL, system: id });
      const P = refereePacket(K, { tape: 8 });
      expect(P).toMatch(/^# The Sunken Chapel/);
      expect(P).toMatch(new RegExp(`## The rules: ${id}`));
      for (const R of SUNKEN_CHAPEL.dungeons.chapel.rooms) expect(P).toContain(`**${R.name}** (${R.id})`);
      expect(P).toContain(`- d20: ${tableTape(K.seed, 20, 8).join(' ')}`);
      expect(P).toMatch(/a silver ring \(hidden: a search finds it\)/);
    }
    const target = refereePacket(readModule(SUNKEN_CHAPEL).K);
    expect(target).not.toMatch(/^> /m);
    expect(refereePacket(readModule({ ...SUNKEN_CHAPEL, system: { ...TABLE_RPG_SYSTEMS.under, attribution: 'Rules by the table.' } }).K)).toContain('> Rules by the table.');
    expect(target).toMatch(/\*\*Barrow Wight\*\* \(rank 3, .*\): HP 22, defence 13/);
    expect(refereePacket(readModule({ ...SUNKEN_CHAPEL, system: 'bands' }).K)).toMatch(/\*\*Barrow Wight\*\* .*: harm track 6, deals 2 harm/);
  });

  it('a game played by its command list is the same game every time: the list is the save', () => {
    const { K } = readModule(SUNKEN_CHAPEL);
    const cmds = ['travel standing-stones', 'travel barrow-hill', 'enter', 'look', 'roll 2d6'];
    const a = playScript(K, cmds), b = playScript(K, cmds);
    expect(a).toEqual(b);
    expect(a.lines).toContain('> enter');
    expect(a.lines).toContain('Into the Sunken Chapel.');
    expect(playScript(K, cmds.slice(0, 2)).lines).toEqual(a.lines.slice(0, playScript(K, cmds.slice(0, 2)).lines.length));
  });
});

describe('dungeons: read for whether they play', () => {
  it('a sound dungeon: every room reached, the keys in the order found, its loop and dead ends', () => {
    const r = checkDungeon(chapel(), { items: SUNKEN_CHAPEL.items, goal: 'reliquary' });
    expect(r.ok).toBe(true);
    expect(r.findings).toEqual([]);
    expect(r.deadEnds).toEqual(['vestry', 'ossuary', 'reliquary']);
  });

  it('a key behind its own lock, a lock with no key, a room out of reach, a one-way room: each said', () => {
    const behind = chapel();
    behind.rooms.find((r) => r.id === 'vestry').items = ['tonic'];
    behind.rooms.find((r) => r.id === 'reliquary').items = ['saint-bell', 'iron-key'];
    behind.links.find((l) => l.kind === 'locked').force = undefined;
    const b = checkDungeon(behind, { items: SUNKEN_CHAPEL.items, goal: 'reliquary' });
    expect(b.ok).toBe(false);
    expect(b.findings.map((f) => f.text)).toEqual(expect.arrayContaining(['iron key lies behind the lock it opens (in reliquary)', 'crypt cannot be reached from porch', 'the goal, reliquary, cannot be reached']));
    const keyless = chapel();
    keyless.rooms.find((r) => r.id === 'vestry').items = [];
    expect(checkDungeon(keyless, { items: SUNKEN_CHAPEL.items }).findings).toEqual([{ level: 'advice', text: 'the lock between crypt stair and crypt wants iron key, which lies in no room (it can be forced)' }]);
    const oneway = chapel();
    oneway.links.find((l) => l.b === 'reliquary').oneWay = true;
    oneway.links.push({ a: 'reliquary', b: 'ossuary', kind: 'open', oneWay: true });
    expect(checkDungeon(oneway, { items: SUNKEN_CHAPEL.items }).findings.some((f) => /no way back/.test(f.text))).toBe(false);
    oneway.links.pop();
    expect(checkDungeon(oneway, { items: SUNKEN_CHAPEL.items }).findings).toContainEqual({ level: 'advice', text: 'from reliquary there is no way back to porch' });
  });

  it('a line of rooms is told to loop', () => {
    const line = { entry: 'a', rooms: ['a', 'b', 'c', 'd'].map((id) => ({ id })), links: [{ a: 'a', b: 'b' }, { a: 'b', b: 'c' }, { a: 'c', b: 'd' }] };
    const r = checkDungeon(line);
    expect(r).toMatchObject({ ok: true, loops: 0, deadEnds: ['d'] });
    expect(r.findings[0].text).toMatch(/no loop/);
  });

  it('a dungeon from a building\'s program: its rooms by role, a loop, the goal locked and its key reachable', () => {
    // one program per plan shape (chain, hub, stack), picked off the table
    const shapes = [...new Set(Object.values(PROGRAMS).map((P) => P.shape))];
    for (const shape of shapes) {
      const use = Object.keys(PROGRAMS).find((u) => PROGRAMS[u].shape === shape);
      const { dungeon, items } = dungeonFromProgram({ use, seed: 3, foes: { minion: 'grave-rat', boss: 'barrow-wight' } });
      expect(dungeon.program).toBe(use);
      const r = checkDungeon(dungeon, { items, goal: dungeon.goal });
      expect(r.ok, use).toBe(true);
      expect(r.keys).toEqual([`${use}-key`]);
      if (dungeon.rooms.length > 3) expect(r.loops, use).toBe(1);
      expect(dungeon.rooms.find((x) => x.id === dungeon.goal).foes).toEqual(['barrow-wight']);
      expect(dungeonFromProgram({ use, seed: 3 })).toEqual(dungeonFromProgram({ use, seed: 3 }));
      // and it plays: the kernel takes it as a module's dungeon
      const K = tableCompile({ ...SUNKEN_CHAPEL, system: TABLE_RPG_SYSTEMS.target, items: { ...SUNKEN_CHAPEL.items, ...items },
        dungeons: { chapel: dungeon }, goal: { room: `chapel/${dungeon.goal}` }, beats: [] });
      expect(Object.keys(K.D.chapel.rooms)).toHaveLength(dungeon.rooms.length);
    }
    expect(() => dungeonFromProgram({ use: 'castle' })).toThrow(/no program 'castle'/);
  });
});

describe('the world and the party, read by the rest of mojulo', () => {
  it('the world lowers to the epoch map board-map reads: a town a town, a dungeon a battle, the rest story', () => {
    const spec = toEpochMap(SUNKEN_CHAPEL.world);
    expect(readMapSpec(spec)).toBe(spec);
    expect(spec.dots.map((d) => d.kind)).toEqual(['town', 'story', 'battle']);
    expect(spec.roads).toEqual([['millbrook', 'standing-stones'], ['standing-stones', 'barrow-hill']]);
  });

  it('a world with a place no road reaches is said', () => {
    const w = { ...SUNKEN_CHAPEL.world, places: [...SUNKEN_CHAPEL.world.places, { id: 'isle', kind: 'wild' }] };
    expect(checkWorld(w, { dungeons: SUNKEN_CHAPEL.dungeons })).toMatchObject({ ok: false, findings: [{ level: 'error', text: 'no road reaches isle from millbrook' }] });
  });

  it('a persona from the egocube: who wears the sheet, and the class from its role when none is named', () => {
    const m = withPersonas({ ...SUNKEN_CHAPEL, party: [{ id: 'nell', egocube: true }, { id: 'odo', class: 'adept', egocube: { brief: 'a gentle old scholar' } }] });
    expect(m.party[0].role).toBe(m.party[0].persona.role);
    expect(m.party[0].egocube).toMatchObject({ seed: 7, path: 'party/nell' });
    expect(m.party[1].role).toBeUndefined();
    expect(typeof m.party[1].persona.reads).toBe('string');
    expect(withPersonas(m)).toEqual(withPersonas(m));
    const { K } = readModule({ ...SUNKEN_CHAPEL, party: [{ id: 'nell', egocube: true }] });
    expect(K.party[0].persona).toEqual(m.party[0].persona);
    expect(refereePacket(K)).toContain(m.party[0].persona.reads);
  });

  it('the party fights in the live RPG as rolled: its classes, its levels, its abilities as the live stats', () => {
    for (const id of ['target', 'challenge']) {
      const { K } = readModule({ ...SUNKEN_CHAPEL, system: id });
      const live = toLiveParty(K);
      expect(live.party.map((p) => p.class)).toEqual(K.party.map((p) => TABLE_RPG_SYSTEMS[id].classes[p.class].live));
      const cfg = readRpg({ rpg: { ...live, encounters: [{ id: 'pack', foes: ['slime'] }] } });
      expect(cfg.party.map((p) => p.id)).toEqual(['alys', 'wren', 'tamsin']);
      const R = rpgInit(cfg), v = {};
      expect(rpgStart(cfg, R, 'pack', v)[0].text).toMatch(/appear/);
      const picks = Object.fromEntries(R.b.ids.map((m) => [m, { act: 'attack', target: rpgTargets(cfg, R, { act: 'attack' })[0].id }]));
      expect(rpgRound(cfg, R, picks, v).length).toBeGreaterThan(0);
    }
    // a stronger arm reads as a stronger blow
    const { K } = readModule(SUNKEN_CHAPEL);
    const strong = { ...K, party: [{ ...K.party[0], scores: { ...K.party[0].scores, str: 18 } }] };
    const weak = { ...K, party: [{ ...K.party[0], scores: { ...K.party[0].scores, str: 3 } }] };
    expect(toLiveParty(strong).party[0].bonus.atk).toBeGreaterThan(toLiveParty(weak).party[0].bonus.atk);
  });
});

import { describe, it, expect } from 'vitest';
import { readGameworld } from '../gameworld/world.js';
import { HALDEN_REACH } from '../gameworld/examples.js';
import { rtsRoster, rtsWorth, RTS_ROLES } from './board-rts-tech.js';
import { buildBoardRts, readBoardRts, rtsStart, rtsTick, rtsMind, RTS_UNITS } from './board-rts.js';
import { boardOf } from './board-kernel.js';

// the example's two civilizations, and two more: one crafting what they do not (a flyer, siege, a scout, a fighting
// vehicle, a sword alone), one crafting nothing
const W = { ...HALDEN_REACH, civilizations: { ...HALDEN_REACH.civilizations,
  raiders: { name: 'Raiders', builds: 'timber longhouses', technology: { weapons: { sword: 'a sword', cannon: 'a bronze cannon' }, vehicles: { gunship: 'an armed attack helicopter', bike: 'a motorcycle', jeep: 'an armed jeep' } } },
  hermits: { name: 'Hermits', builds: 'stone huts' } } };
const G = readGameworld(W);
const CIVS = Object.keys(G.civilizations);
const crafted = (cid) => ['things', 'vehicles', 'structures', 'weapons'].flatMap((l) => Object.keys(G.civilizations[cid].technology?.[l] ?? {}).map((id) => `${l}/${id}`));
const roleOf = (r, role) => Object.entries(r.units).find(([, u]) => u.role === role);

describe('a civilization\'s technology read as a skirmish side', () => {
  it('says what each crafted thing fields as, or why it does not, once each; what it fields is in the roster', () => {
    for (const cid of CIVS) {
      const r = rtsRoster(G, cid);
      expect(r.ledger.filter((l) => l.of).map((l) => l.of).sort()).toEqual(crafted(cid).sort());
      for (const l of r.ledger.filter((x) => x.as)) expect(r.units[l.as] ?? r.buildings[l.as]).toBeDefined();
      // what trains is what it fields; the base trains its worker, the works only after a barracks
      expect(r.buildings.base.trains).toEqual([r.worker]);
      for (const b of Object.values(r.buildings)) for (const k of b.trains ?? []) expect(r.units[k]).toBeDefined();
      if (r.buildings.works) expect(r.buildings.works.needs).toBe('barracks');
    }
  });

  it('gives each thing its role by what it does and what it is', () => {
    const corps = rtsRoster(G, 'survey-corps'), growers = rtsRoster(G, 'dome-growers'), raiders = rtsRoster(G, 'raiders');
    // the worker is what moves and carries; a cargo one carries more a trip
    expect([corps.worker, growers.worker, growers.units[growers.worker].carry]).toEqual(['hauler', 'walker', 8]);
    // hand weapons arm infantry by their form; armour makes a vehicle heavy; a turret is a defence, a barrier a wall,
    // a thing that stores a depot, a thing that makes the works
    expect([corps.units.carbine.role, corps.units.shield.role, growers.units.lance.role, corps.units.walker.role]).toEqual(['ranged', 'guard', 'melee', 'heavy']);
    expect([corps.buildings.sentry.role, growers.buildings.wall.role, growers.buildings.cistern.role, corps.buildings.works.name]).toEqual(['defence', 'wall', 'depot', 'Fabricator']);
    // an armed flyer flies, a machine weapon is siege, a small or two-wheeled vehicle scouts, an armed one fights
    expect([raiders.units.gunship.fly, raiders.units.cannon.siege, raiders.units.bike.role, raiders.units.jeep.role]).toEqual([true, 3, 'scout', 'fighting']);
    // what has no place on the board says so: a vessel, an unarmed flyer
    expect(growers.ledger.find((l) => l.of === 'vehicles/barge').line).toMatch(/waiting for water/);
    expect(corps.ledger.find((l) => l.of === 'vehicles/lifter').line).toMatch(/unarmed flyer/);
    // dials move the stats: armour the hp, energy the strike, the showpiece more
    expect(corps.units.crawler.hp).toBeGreaterThan(Math.round(260 * 1.5) - 1);
    expect(corps.units.carbine.atk).toBe(RTS_UNITS.archer.atk * 1.25);
  });

  it('prices every fight by one formula, so no side buys more of it for its gold', () => {
    const K = 60 / Math.sqrt(80 * 8);
    for (const cid of CIVS) {
      const r = rtsRoster(G, cid);
      for (const l of r.ledger) {
        const U = l.as && r.units[l.as];
        if (!U || !l.of || U.role === 'worker') continue;
        expect(Math.abs(U.cost - K * rtsWorth(U))).toBeLessThanOrEqual(2.5);
      }
    }
    // every role a civilization can field has a base the formula knows
    expect(RTS_ROLES).toEqual(expect.arrayContaining(['worker', 'melee', 'ranged', 'guard', 'heavy', 'scout', 'fighting', 'flyer', 'siege']));
  });

  it('fills what a civilization lacks from the plain tables, saying so; one that crafts nothing plays them', () => {
    const raiders = rtsRoster(G, 'raiders');
    expect(raiders.units.archer).toEqual(RTS_UNITS.archer);
    expect(raiders.ledger.find((l) => l.as === 'archer').line).toMatch(/no bow, gun or staff/);
    const hermits = rtsRoster(G, 'hermits');
    expect(hermits.units).toEqual(RTS_UNITS);
    expect([hermits.army, hermits.builds, Object.keys(hermits.buildings)]).toEqual([['soldier', 'archer'], ['barracks'], ['base', 'barracks']]);
    expect(roleOf(hermits, 'flyer')).toBeUndefined();
    expect(() => rtsRoster(G, 'nobody')).toThrow(/'nobody' is not one of the world's civilizations/);
  });

  it('is the same roster for the same gameworld', () => {
    expect(rtsRoster(readGameworld(W), 'survey-corps')).toEqual(rtsRoster(G, 'survey-corps'));
  });
});

describe('two civilizations\' skirmish', () => {
  const B = boardOf(Array.from({ length: 12 }, () => Array(9).fill(0)));
  const duel = (p, e) => {
    const cfg = { ...readBoardRts(B, { ai: { wave: 4 } }), sides: { player: rtsRoster(G, p), enemy: rtsRoster(G, e) } };
    let R = rtsStart(B, cfg);
    for (let k = 0; k < 15000 && !R.over; k++) { if (k % 10 === 0) R = rtsMind(B, cfg, R, 'player'); R = rtsTick(B, cfg, R, 0.1).R; }
    return R;
  };

  it('ends, either way round, each side fielding its own', () => {
    for (const [p, e] of [['survey-corps', 'dome-growers'], ['dome-growers', 'survey-corps']]) {
      const R = duel(p, e);
      expect(R.over).not.toBeNull();
    }
  });

  it('runs from its own source with rosters, as the page runs it', () => {
    const page = new Function(`return (${buildBoardRts.toString()})();`)();
    const cfg = { ...readBoardRts(B, {}), sides: { player: rtsRoster(G, 'raiders'), enemy: rtsRoster(G, 'survey-corps') } };
    let a = rtsStart(B, cfg), b = page.start(B, cfg);
    for (let k = 0; k < 900; k++) {
      if (k % 10 === 0) { a = rtsMind(B, cfg, a, 'player'); b = page.mind(B, cfg, b, 'player'); }
      a = rtsTick(B, cfg, a, 0.1).R; b = page.tick(B, cfg, b, 0.1).R;
    }
    expect(b).toEqual(a);
    expect(a.units.some((u) => u.side === 'enemy' && u.kind === 'hauler')).toBe(true);
  });
});

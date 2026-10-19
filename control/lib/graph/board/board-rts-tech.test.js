import { describe, it, expect } from 'vitest';
import { readGameworld } from '../gameworld/world.js';
import { HALDEN_REACH } from '../gameworld/examples.js';
import { rtsRoster, rtsWorth, RTS_ROLES } from './board-rts-tech.js';
import { buildBoardRts, readBoardRts, rtsStart, rtsTick, rtsMind, rtsBuild, rtsTrain, rtsResearch, rtsTierOf, RTS_UNITS, RTS_DOCTRINES } from './board-rts.js';
import { boardOf, boardParse } from './board-kernel.js';

// the example's two civilizations, and two more: one crafting what they do not (a flyer, siege, a scout, a fighting
// vehicle, a sword alone), one crafting nothing
const W = { ...HALDEN_REACH, civilizations: { ...HALDEN_REACH.civilizations,
  raiders: { name: 'Raiders', builds: 'timber longhouses', technology: { weapons: { sword: 'a sword', cannon: 'a bronze cannon', sentry: 'a deployable sentry turret' }, vehicles: { gunship: 'an armed attack helicopter', bike: 'a motorcycle', jeep: 'an armed jeep' } } },
  hermits: { name: 'Hermits', builds: 'stone huts' },
  // what words give beyond a blow: stealth, a banner, berserk, poison, frost, a jammer
  ghosts: { name: 'Ghosts', technology: { weapons: { rifle: 'a stealth rifle', banner: 'a command banner sword', axe: 'a berserker axe', bow: 'a poisoned bow', spear: 'a frost spear' }, vehicles: { jammer: 'an armed jammer truck' } } } } };
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
    // a fighter without a weapon: the cargo helicopter carries units over anything
    expect(corps.units.lifter).toMatchObject({ role: 'transport', atk: 0, fly: true, carries: 4, tier: 2 });
    // transforms: siege deploys to fire; the base grows into its fort once machines are known; what is deployable
    // comes folded out of the works and is set up as its building
    expect(growers.units.launcher.modes.deployed).toMatchObject({ still: true, range: growers.units.launcher.range + 2 });
    expect(corps.buildings.base.upgrades).toMatchObject({ to: 'fort', tier: 2 });
    expect(corps.buildings.fort).toMatchObject({ name: 'Battered fort', role: 'base' });
    expect(raiders.units['sentry-kit']).toMatchObject({ deploys: 'sentry', tier: 2, atk: 0 });
    expect(raiders.buildings.works.trains).toContain('sentry-kit');
    // dials move the stats: armour the hp, energy the strike, the showpiece more
    expect(corps.units.crawler.hp).toBeGreaterThan(Math.round(260 * 1.5) - 1);
    expect(corps.units.carbine.atk).toBe(RTS_UNITS.archer.atk * 1.25);
  });

  it('reads abilities and effects from its technology: classes, splash, statuses, sight and stealth, auras, casts, upgrades', () => {
    const corps = rtsRoster(G, 'survey-corps'), growers = rtsRoster(G, 'dome-growers'), ghosts = rtsRoster(G, 'ghosts');
    // energy stuns on every fourth hit; a polearm pierces armour; siege bursts; a sensor sees what hides
    expect(corps.units.carbine.onHit).toEqual({ status: 'stun', time: 0.6, every: 4 });
    expect(growers.units.lance.bonus).toEqual({ armoured: 1.5 });
    expect(growers.units.launcher.splash).toBe(1.2);
    expect(corps.buildings.sentry.detects).toBe(6);
    // a dish beside the lab watches
    expect(corps.buildings.dish).toMatchObject({ role: 'sensor', detects: 8 });
    // words: stealth cloaks, a banner lifts its own, berserk stims, poison bites, frost slows, a jammer slows foes
    expect([ghosts.units.rifle.cloak, ghosts.units.banner.aura, ghosts.units.axe.abilities.stim.status, ghosts.units.bow.onHit.status, ghosts.units.spear.onHit.status, ghosts.units.jammer.aura.who])
      .toEqual([true, { r: 3, who: 'own', atk: 1.15 }, 'stim', 'poison', 'slow', 'foe']);
    // its upgrades: charged where its weapons are energy, plating in its finish, after its machines
    expect([corps.research.arms.name, corps.research.plating.name, growers.research.plating.name]).toEqual(['Charged weapons', 'Alloy plating', 'Composite plating']);
    expect(corps.research.arms).toMatchObject({ needs: 'tier2', gives: { buff: { who: 'fighters', atk: 1.15 } } });
  });

  it('takes the steps its technology writes: what each opens and follows, refused when it names what it does not field', () => {
    const own = (research) => readGameworld({ ...W, civilizations: { ...W.civilizations, 'survey-corps': { ...W.civilizations['survey-corps'], technology: { ...W.civilizations['survey-corps'].technology, research } } } });
    const R = rtsRoster(own({ servos: { name: 'Leg servos', opens: ['walker'], after: 'machines' }, overclock: { after: ['servos', 'mast'], buff: { atk: 1.2 }, cost: 90 } }), 'survey-corps');
    expect(R.research.servos).toMatchObject({ name: 'Leg servos', needs: ['tier2'], opens: ['walker'] });
    expect(R.units.walker.needs).toEqual(['servos']);
    expect(R.research.overclock).toMatchObject({ name: 'Overclock', cost: 90, needs: ['servos', 'mast'], gives: { buff: { who: 'fighters', atk: 1.2 } } });
    expect(R.study.indexOf('servos')).toBeGreaterThan(R.study.indexOf('tier2'));
    expect(R.ledger.some((l) => /its own step, Leg servos: opens Walker, after tier2/.test(l.line))).toBe(true);
    expect(() => rtsRoster(own({ wings: { opens: ['dragon'] } }), 'survey-corps')).toThrow(/research.wings.opens 'dragon' is not something it fields/);
    expect(() => rtsRoster(own({ wings: { after: ['nothing'] } }), 'survey-corps')).toThrow(/research.wings.after 'nothing' is neither a step/);
    expect(() => own({ wings: { power: 3 } })).toThrow(/research.wings.power is not part of a step/);
  });

  it('chooses among the doctrines its technology names, else every one; science makes its research quicker and cheaper', () => {
    expect(rtsRoster(G, 'survey-corps').doctrines).toEqual(Object.keys(RTS_DOCTRINES));
    const R = rtsRoster(readGameworld({ ...W, civilizations: { ...W.civilizations, 'survey-corps': { ...W.civilizations['survey-corps'], technology: { ...W.civilizations['survey-corps'].technology, doctrines: ['science', 'fortress'] } } } }), 'survey-corps');
    expect(R.doctrines).toEqual(['science', 'fortress']);
    expect(() => readGameworld({ ...W, civilizations: { ...W.civilizations, hermits: { name: 'H', technology: { doctrines: 'all' } } } })).toThrow(/technology.doctrines is a list/);
    const B = boardOf(Array.from({ length: 18 }, () => Array(9).fill(0))), cfg = { ...readBoardRts(B, { workers: 0, doctrine: { player: 'science' } }), sides: { player: R } };
    let S = { ...rtsStart(B, cfg), gold: { player: 999, enemy: 0 }, ore: { player: 999, enemy: 0 } };
    S = { ...S, buildings: S.buildings.concat([{ id: 'bm', side: 'player', kind: 'mast', at: 40, hp: 300, hpMax: 300, raising: 0, queue: [], rally: null }]) };
    S = rtsResearch(B, cfg, S, 'bm', 'tier2');
    expect([S.gold.player, S.buildings.find((b) => b.id === 'bm').study.left]).toEqual([999 - Math.round(150 * 0.85), 30 * 0.75]);
  });

  it('reads its economy: a second resource named for what powers it, machines and research costing some; supply taken and held', () => {
    const corps = rtsRoster(G, 'survey-corps'), hermits = rtsRoster(G, 'hermits');
    expect([corps.res2, hermits.res2]).toEqual(['Power', undefined]);
    expect([corps.units.skimmer.cost2, corps.units.walker.cost2, corps.units.carbine.cost2]).toEqual([25, 80, undefined]);
    expect(corps.research.tier2.cost2).toBe(60);
    expect(corps.research.relay.cost2).toBeUndefined();
    // a hauler takes one, a walker (heavy, a showpiece) four; the base holds 10, the fort 15, quarters 8
    expect([corps.units.hauler.supply, corps.units.walker.supply, corps.buildings.base.supplies, corps.buildings.fort.supplies, corps.buildings.quarters.supplies]).toEqual([1, 4, 10, 15, 8]);
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
    expect(raiders.units.archer).toMatchObject(RTS_UNITS.archer);
    expect(raiders.ledger.find((l) => l.as === 'archer').line).toMatch(/no bow, gun or staff/);
    const hermits = rtsRoster(G, 'hermits');
    // (the plain tables, each unit taking its supply; plain quarters to hold more; a hall to expand)
    expect(Object.fromEntries(Object.entries(hermits.units).map(([k, u]) => { const { supply, ...rest } = u; return [k, rest]; }))).toEqual(RTS_UNITS);
    expect([hermits.army, hermits.builds, Object.keys(hermits.buildings), hermits.res2]).toEqual([['soldier', 'archer'], ['barracks'], ['base', 'hall', 'barracks', 'quarters'], undefined]);
    expect(roleOf(hermits, 'flyer')).toBeUndefined();
    expect(hermits.research).toBeUndefined();
    expect(() => rtsRoster(G, 'nobody')).toThrow(/'nobody' is not one of the world's civilizations/);
  });

  it('is the same roster for the same gameworld', () => {
    expect(rtsRoster(readGameworld(W), 'survey-corps')).toEqual(rtsRoster(G, 'survey-corps'));
  });
});

describe('the ladder', () => {
  const flat = (cols, rows) => boardOf(Array.from({ length: rows }, () => Array(cols).fill(0)));
  it('reads tiers from technology: the machines, then the showpieces, researched where it signals; income steps from its power', () => {
    const corps = rtsRoster(G, 'survey-corps');
    expect([corps.units.skimmer.tier, corps.units.walker.tier, corps.units.carbine.tier]).toEqual([2, 3, undefined]);
    expect(corps.builds).toEqual(['barracks', 'mast', 'works']);
    expect(corps.research.tier2).toMatchObject({ at: 'mast', gives: { tier: 2 }, opens: ['skimmer', 'works'] });
    // past the machines the tree branches: flight opens what flies (the lifter needs both)
    expect(corps.research.flight).toMatchObject({ needs: 'tier2', opens: ['lifter'] });
    expect(corps.units.lifter.needs).toEqual(['flight']);
    expect(corps.research.arms2.needs).toEqual(['arms', 'tier3']);
    expect(corps.research.tier3).toMatchObject({ needs: 'tier2', gives: { tier: 3 }, opens: ['walker', 'crawler'] });
    expect(Object.values(corps.research).filter((r) => r.gives.income)).toHaveLength(2);
    expect(corps.study[0]).toBe('tier2');
    // nothing that signals, senses or lifts: a plain lab
    expect(rtsRoster(G, 'dome-growers').research.tier2.at).toBe('lab');
  });

  it('opens nothing of a tier before it is researched, a step at a time, at its building', () => {
    const B = flat(9, 18), at = (n) => boardParse(B, n), corps = rtsRoster(G, 'survey-corps');
    const cfg = { ...readBoardRts(B, { ai: { workers: 0, wave: 30 }, workers: 2, enemy: { workers: 0 } }), sides: { player: corps } };
    const go = (R, s) => { for (let k = 0; k * 0.1 < s; k++) R = rtsTick(B, cfg, R, 0.1).R; return R; };
    const up = (R) => { for (let k = 0; k < 1500 && R.buildings.some((b) => b.raising > 0); k++) R = rtsTick(B, cfg, R, 0.1).R; return R; };
    let R = { ...rtsStart(B, cfg), gold: { player: 9999, enemy: 0 }, ore: { player: 9999, enemy: 0 } };
    expect(() => rtsBuild(B, cfg, R, 'player', 'mast', at('B5'))).toThrow(/a Mast needs a Barracks standing first/);
    R = up(rtsBuild(B, cfg, R, 'player', 'barracks', at('B5')));
    R = up(rtsBuild(B, cfg, R, 'player', 'mast', at('H5')));
    const bar = R.buildings.find((b) => b.kind === 'barracks').id, mast = R.buildings.find((b) => b.kind === 'mast').id;
    expect(() => rtsBuild(B, cfg, R, 'player', 'works', at('E5'))).toThrow(/a Fabricator needs Machines researched first/);
    expect(() => rtsResearch(B, cfg, R, mast, 'tier3')).toThrow(/Showpieces needs Machines researched first/);
    expect(() => rtsResearch(B, cfg, R, bar, 'tier2')).toThrow(/Machines is researched at the Mast, not the Barracks/);
    R = rtsResearch(B, cfg, R, mast, 'tier2');
    expect(() => rtsResearch(B, cfg, R, mast, 'relay')).toThrow(/is researching Machines already/);
    expect(R.gold.player).toBe(9999 - 150 - 150 - corps.research.tier2.cost);
    R = go(R, corps.research.tier2.time + 0.2);
    expect(rtsTierOf(cfg, R, 'player')).toBe(2);
    R = up(rtsBuild(B, cfg, R, 'player', 'works', at('E5')));
    const works = R.buildings.find((b) => b.kind === 'works').id;
    expect(() => rtsTrain(B, cfg, R, works, 'skimmer')).not.toThrow();
    expect(() => rtsTrain(B, cfg, R, works, 'walker')).toThrow(/a Walker needs Showpieces researched first/);
  });

  it('pays more a trip for each income step known', () => {
    const B = flat(7, 16), corps = rtsRoster(G, 'survey-corps');
    const cfg = { ...readBoardRts(B, { workers: 1, ai: { workers: 0, wave: 30 } }), sides: { player: corps } };
    const trip = (known) => {
      let R = { ...rtsStart(B, cfg), known: { player: known, enemy: {} } };
      R = rtsMind(B, cfg, R, 'player');
      for (let k = 0; k < 600; k++) { const o = rtsTick(B, cfg, R, 0.1); R = o.R; const e = o.events.find((x) => x.kind === 'gathered' && x.side === 'player'); if (e) return [e.amount, e.paid]; }
      return null;
    };
    expect(trip({})).toEqual([5, 5]);
    expect(trip({ relay: true, array: true })).toEqual([5, 7]);
  });

  it('is the same game for the same orders at the same times, however the time is cut', () => {
    const B = flat(11, 16), cfg = { ...readBoardRts(B, {}), sides: { player: rtsRoster(G, 'dome-growers'), enemy: rtsRoster(G, 'survey-corps') } };
    const play = (dt) => {
      let R = rtsStart(B, cfg);
      for (let k = 0; k * dt < 240 && !R.over; k++) { if (Math.abs(k * dt - Math.round(k * dt)) < 1e-9) R = rtsMind(B, cfg, R, 'player'); R = rtsTick(B, cfg, R, dt).R; }
      return { over: R.over, gold: R.gold, n: R.n, known: R.known, units: R.units.map((u) => u.kind).sort() };
    };
    expect(play(0.2)).toEqual(play(0.1));
  });
});

describe('two civilizations\' skirmish', () => {
  const B = boardOf(Array.from({ length: 16 }, () => Array(11).fill(0)));
  const duel = (p, e) => {
    const cfg = { ...readBoardRts(B, { ai: { wave: 4 }, nodes2: 1 }), sides: { player: rtsRoster(G, p), enemy: rtsRoster(G, e) } }, made = [];
    let R = rtsStart(B, cfg);
    for (let k = 0; k < 15000 && !R.over; k++) {
      if (k % 10 === 0) R = rtsMind(B, cfg, R, 'player');
      const o = rtsTick(B, cfg, R, 0.1); R = o.R;
      for (const ev of o.events) if (ev.kind === 'trained') { const u = R.units.find((x) => x.id === ev.id); made.push([u.side === 'player' ? p : e, cfg.sides[u.side].units[u.kind].tier || 1]); }
    }
    return { R, made };
  };

  it('ends, either way round, each side climbing its ladder and fielding what it opens', () => {
    const made = [];
    for (const [p, e] of [['survey-corps', 'dome-growers'], ['dome-growers', 'survey-corps']]) {
      const D = duel(p, e);
      expect(D.R.over).not.toBeNull();
      expect(D.R.known.player.tier2 || D.R.known.enemy.tier2).toBe(true);
      made.push(...D.made);
    }
    // each civilization fields its machines; the showpieces come out
    for (const cid of ['survey-corps', 'dome-growers']) expect(made.some(([c, t]) => c === cid && t >= 2)).toBe(true);
    expect(made.some(([, t]) => t === 3)).toBe(true);
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

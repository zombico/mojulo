import { describe, it, expect } from 'vitest';
import { craftTech, craftDomain, craftKindOf, composeCraft, CRAFT_TRAITS, CRAFT_KINDS, CRAFT_KIND_IDS } from './tech-crafter.js';
import { readGameworld, resolveWorld, HALDEN_REACH, composeGameworld } from './index.js';
import { gameworldGraph } from './graph.js';
import { gameworldBibleHtml } from './bible-html.js';
import { buildBlock, blockLaws, readBlock, FUNCTION_IDS, TIERS } from '../era/blocks.js';
import { STARTER_BLOCKS } from '../era/tech-blocks.js';
import { TECH_TRAITS } from './tunnel-tech.js';

const INTENTS = {
  vehicle: ['an armoured personnel truck', 'a battle tank', 'a walker mech', 'a steam train', 'a hovercraft', 'an attack helicopter gunship', 'a biplane', 'a zeppelin airship', 'a war galley', 'a sailing frigate', 'a merchant cargo wagon', 'a colossal land-train'],
  structure: ['a lighthouse', 'a lattice radio mast', 'a radar gun tower', 'a city gate', 'a stargate portal', 'a steel truss bridge', 'an aqueduct', 'a windmill', 'a watermill', 'a nuclear cooling tower', 'a foundry with smokestacks', 'a radio telescope', 'a forcefield barrier', 'a rocket launch gantry'],
  weapon: ['a sword', 'a dagger', 'a halberd', 'a trident', 'a battleaxe', 'a longbow', 'a crossbow', 'a wizard staff', 'a laser rifle', 'a pulse pistol', 'an energy shield', 'a buckler', 'a field cannon', 'a mortar', 'a trebuchet', 'a catapult', 'a ballista', 'a missile launcher', 'a sentry gatling turret'],
};

describe('the technology crafter', () => {
  it('every form of every kind is named by its words, and a thing crafted from its first word holds every trait and law', () => {
    for (const kind of CRAFT_KIND_IDS) {
      const forms = new Set(Object.values(CRAFT_TRAITS[kind]).filter((t) => t.form).map((t) => t.form));
      expect([...forms].sort(), kind).toEqual([...CRAFT_KINDS[kind].forms].sort());
      for (const [id, t] of Object.entries(CRAFT_TRAITS[kind])) if (t.form && !t.generic) {
        const r = craftTech(kind, `a ${t.words[0]}`, { seed: 2 });
        expect(r.complete, `${kind} ${id}: ${JSON.stringify(r.passes.at(-1))}`).toBe(true);
        expect(r.plan).toMatchObject({ kind, form: t.form, variant: t.variant });
      }
    }
  }, 120000);

  it('dozens of intents hold over seeds; the plan is a block a library keeps, the same every time', () => {
    for (const [kind, list] of Object.entries(INTENTS)) for (const i of list) for (const seed of [1, 3]) {
      const r = craftTech(kind, i, { seed });
      expect(r.complete, `${kind} ${i} ${seed}: ${JSON.stringify(r.passes.at(-1))}`).toBe(true);
      expect(readBlock(r.plan.block, STARTER_BLOCKS)).toBe(r.plan.block);
    }
    expect(JSON.stringify(craftTech('vehicle', 'a war galley', { seed: 4 }))).toBe(JSON.stringify(craftTech('vehicle', 'a war galley', { seed: 4 })));
  }, 120000);

  it('the machines and the crafter between them name every function', () => {
    const named = new Set([...Object.values(TECH_TRAITS), ...CRAFT_KIND_IDS.flatMap((k) => Object.values(CRAFT_TRAITS[k]))].filter((t) => t.fn).map((t) => t.fn));
    for (const k of CRAFT_KIND_IDS) for (const i of INTENTS[k]) for (const f of craftTech(k, i).plan.block.functions) named.add(f);
    expect([...named].sort()).toEqual([...FUNCTION_IDS].sort());
  }, 60000);

  it('modifiers change how it looks doing it: plates, a gun, sail or oars, coils, barrels, a field', () => {
    const roles = (k, i) => craftTech(k, i).plan.block.parts.map((p) => p.role);
    const ids = (k, i) => craftTech(k, i).plan.block.parts.map((p) => p.id);
    expect(roles('vehicle', 'an armoured car')).toContain('armour');
    expect(craftTech('vehicle', 'a battle tank').plan.block.functions).toEqual(expect.arrayContaining(['move', 'guard', 'strike']));
    expect(ids('vehicle', 'a galley')).toContain('oars');
    expect(ids('vehicle', 'a sailing frigate')).toContain('sail');
    expect(ids('vehicle', 'a sailing frigate')).not.toContain('oars');
    expect(ids('weapon', 'a laser rifle')).toContain('coils');
    expect(craftTech('weapon', 'a twin cannon').built.b.parts.find((p) => p.id === 'barrel').n).toBe(2);
    expect(ids('structure', 'a forcefield gate')).toContain('leaf');
    expect(ids('structure', 'a city gate')).not.toContain('leaf');
    expect(craftTech('vehicle', 'a colossal land-train').plan.block.tier).toBe('vessel');
    expect(craftTech('weapon', 'a sentry turret').plan.block.functions).toContain('sense');
  }, 60000);

  it('one form: a general word gives way to a particular one, and of two the last named is the thing', () => {
    expect(craftTech('structure', 'a nuclear cooling tower').plan).toMatchObject({ form: 'stack', variant: 'cooling' });
    expect(craftTech('structure', 'a radar watchtower').plan.form).toBe('tower');
    expect(craftTech('weapon', 'a gun turret').plan.form).toBe('turret');
    const r = craftTech('structure', 'a forcefield gate');
    expect(r.plan.form).toBe('gate');
    expect(r.complete).toBe(true);
    expect(r.pulled.flatMap((p) => p.changed)).toContain('\'barrier\' gives way: the last form named is the thing');
  });

  it('a hand weapon is judged at arm\'s length and names its equipment class; a crewed one at near; a structure stands out', () => {
    const sword = craftTech('weapon', 'a sword');
    expect(sword.plan).toMatchObject({ carries: 'sword' });
    expect(sword.plan.block).toMatchObject({ tier: 'held', mounts: ['hand'] });
    expect(sword.built.b.reach).toBe(TIERS.held.reach);
    expect(sword.built.b.eye).toBeLessThan(0.05);
    expect(craftTech('weapon', 'a crossbow').plan.carries).toBeUndefined();
    expect(craftTech('weapon', 'a buckler').plan.carries).toBe('shield');
    const cannon = craftTech('weapon', 'a field cannon');
    expect(cannon.plan.block.ring).toBe('near');
    expect(cannon.built.b.reach).toBeUndefined();
    const tower = craftTech('structure', 'a lighthouse');
    expect(tower.built.laws.find((l) => l.law === 'stands-out')).toMatchObject({ ok: true });
    expect(Math.max(...tower.built.b.box.size)).toBeGreaterThanOrEqual(8);
  });

  it('a lost piece is thickened; a leader that does not lead is grown and its runner-up gives way', () => {
    const D = craftDomain('vehicle'), c = { ...D.start(1, { id: 'thin', read: 'a thin car' }), thick: { 'wheels-l': 0.4 } };
    const b = D.build(c, 1), lost = b.laws.find((l) => l.law === 'reads-at-ring');
    expect(lost.ok).toBe(false);
    const t = D.tweak(c, { traits: [], laws: [lost] }, 1, 1);
    expect(t.changed[0]).toMatch(/^wheels-l × 0\.5 \(reads at its ring\)$/);
    const lead = D.tweak(c, { traits: [], laws: [{ law: 'one-leads', ok: false, value: 'body 1 m² over cab 0.9 m²' }] }, 1, 1);
    expect(lead.changed).toEqual(['body × 1.15 (one leads)', 'cab × 0.85 (gives way)']);
    expect(composeCraft(lead.candidate).parts.find((p) => p.id === 'cab').size[0]).toBeLessThan(composeCraft(c).parts.find((p) => p.id === 'cab').size[0]);
  });

  it('the kind a clause names: its last form', () => {
    expect(craftKindOf('war galleys')).toBe('vehicle');
    expect(craftKindOf('a stargate')).toBe('structure');
    expect(craftKindOf('rifles')).toBe('weapon');
    expect(craftKindOf('a gun tower')).toBe('structure');
    expect(craftKindOf('rust plains')).toBe(null);
  });
});

describe('a civilization\'s technology, crafted', () => {
  it('reads vehicles, structures and weapons beside its machines; an id names one thing in its library', () => {
    const W = (technology) => ({ id: 'w', civilizations: { folk: { technology } }, levels: { a: { walk: { nodes: { t: { trail: true } } } } } });
    expect(() => readGameworld(W({ vehicles: { cart: 'a cart' }, weapons: { cart: 'a sword' } }))).toThrow(/'cart' is already named in vehicles/);
    expect(() => readGameworld(W({ gadgets: {} }))).toThrow(/gadgets is not a technology setting/);
    expect(() => readGameworld(W({ weapons: ['a sword'] }))).toThrow(/weapons is \{ <id>/);
    const G = readGameworld(W({ weapons: { blade: 'a plasma sword' } }));
    expect(G.civilizations.folk.technology.weapons.blade).toMatchObject({ intent: 'a plasma sword', form: 'blade', carries: 'sword', block: { tier: 'held' } });
    expect(G.civilizations.folk.technology.vehicles).toBeUndefined();
  });

  it('Halden Reach fields its vehicles, tech-structures and weapons; the graph reaches them; the bible draws them', () => {
    const { world: G } = resolveWorld(HALDEN_REACH);
    const S = G.civilizations['survey-corps'].technology, D = G.civilizations['dome-growers'].technology;
    for (const T of [S, D]) for (const k of ['vehicles', 'structures', 'weapons']) for (const [id, t] of Object.entries(T[k])) expect(t.tunnel.complete, `${k} ${id}`).toBe(true);
    expect(S.weapons.shield.carries).toBe('shield');
    const g = gameworldGraph(HALDEN_REACH), count = (kind) => g.edges.filter((e) => e.kind === kind).length;
    expect([count('makes'), count('drives'), count('erects'), count('wields')]).toEqual([8, 6, 5, 5]);
    expect(g.nodes.find((n) => n.id === 'weapon:survey-corps/carbine')).toMatchObject({ kind: 'weapon', form: 'gun', tier: 'held' });
    const a = gameworldBibleHtml(HALDEN_REACH);
    for (const id of ['civ-vehicles-survey-corps-crawler', 'civ-structures-dome-growers-cooler', 'civ-weapons-survey-corps-sentry']) expect(a).toContain(`<!--plate:${id}-->`);
    expect(a).toContain('Its tech-structures');
  }, 120000);

  it('autonomous: a clause naming no machine but a crafted form goes to the crafter', () => {
    const W = composeGameworld({ prompt: 'a steampunk frontier: steam trains, zeppelin airships, a great lighthouse, iron truss bridges, tracked haulers, rifles and field cannon', seed: 3 });
    const T = Object.values(W.civilizations)[0].technology;
    expect(T).toEqual({ things: { hauler: 'tracked haulers' }, vehicles: { train: 'steam trains', zeppelin: 'zeppelin airships' }, structures: { lighthouse: 'great lighthouse', bridge: 'iron truss bridges' }, weapons: { rifle: 'rifles', cannon: 'field cannon' }, direction: { motif: 'riveted', elements: { primary: 'iron' } } });
    expect(W.brief.tunnels).toMatchObject({ vehicles: ['train', 'zeppelin'], structures: ['lighthouse', 'bridge'], weapons: ['rifle', 'cannon'] });
  }, 60000);
});

describe('blocks: the crafter\'s vocabulary', () => {
  it('a held block is judged at its reach; asked for a ring, at the ring; the laws say which', () => {
    const B = { id: 'pin', read: 'a pin', tier: 'held', functions: ['strike'], mounts: ['hand'], parts: [{ id: 'blade', prim: 'box', role: 'weapon', size: [0.04, 0.04, 0.5] }, { id: 'grip', prim: 'box', role: 'grip', size: [0.04, 0.04, 0.1] }], sig: ['blade'] };
    const held = buildBlock(B), near = buildBlock(B, { ring: 'near' });
    expect(held.reach).toBe(1);
    expect(held.parts.find((p) => p.id === 'blade').shown).toBe('geometry');
    expect(near.parts.find((p) => p.id === 'blade').shown).toBe('tile');
    expect(blockLaws(B, held).find((l) => l.law === 'reads-at-ring').want).toMatch(/arm's length, 1 m/);
    expect(blockLaws(B, near).find((l) => l.law === 'reads-at-ring').ok).toBe(false);
  });
});

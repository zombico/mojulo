import { describe, it, expect } from 'vitest';
import { folkBodies, mintKey } from './bodies.js';
import { folkOfTown } from './folk.js';
import { settingOfGame, QUICK_FIGURES } from '../gameworld/cast-setting.js';
import { UNDERLAYERS } from '../gameworld/hero-looks.js';

// a lot per procedure: two houses, two counters (one uniform, two keepers), a workshop (its apprentice), the tower (its rank)
const lot = (use, s, band = [2, 3]) => ({ use, route: 'lane', side: 'left', s, band });
const LOTS = [lot('dwelling', 1), lot('shop', 8), lot('dwelling', 15), lot('shop', 22), lot('workshop', 30), lot('tower', 40)];
const KIT = 'isekai-meadow';
const made = (lots = LOTS, kit = KIT, folk = { domicile: 'D of F (P + C2)' }, pool) => {
  const setting = settingOfGame({ seed: 8, style: { kit } });
  const F = folkOfTown({ seed: 8, lots }, { setting, folk });
  return { F, B: folkBodies(F, { kit, setting, ...(pool ? { pool } : {}) }) };
};
const { F, B } = made();
const at = (path) => F.people.find((p) => p.path === path);
const mint = (B, key) => B.mints.find((m) => m.key === key);
const CLOTHES = ['outfit', 'detail', 'adorn', 'gear', 'stylism', 'paint', 'kit', 'palette'];
const face = (spec) => Object.fromEntries(Object.entries(spec).filter(([k]) => !CLOTHES.includes(k)));

describe('folk bodies: who gets one of their own', () => {
  it('gives a service\'s first person their own body and pools everyone else, every person wearing a mint', () => {
    for (const p of B.people) {
      const who = at(p.path);
      expect(p.tier).toBe(!who.parent && who.service ? 'own' : 'pooled');
      expect(mint(B, p.body)).toBeTruthy();
    }
    for (const p of B.people.filter((x) => x.tier === 'own')) expect(p.body).toBe(mintKey(p.path));
    expect(B.mints.length).toBeLessThan(B.people.length);
  });

  it('never lends a body across a uniform or from a grown person to a child', () => {
    const stage = (p) => (p.sheet.facets.age === 'child' ? 'child' : 'grown');
    for (const p of B.people.filter((x) => x.tier === 'pooled')) {
      const who = at(p.path), of = at(mint(B, p.body).of);
      expect(of.uniform).toBe(who.uniform);
      expect(stage(of)).toBe(stage(who));
    }
  });

  it('mints at most `pool` people of a pool as themselves', () => {
    const one = made(LOTS, KIT, undefined, 1).B, three = made(LOTS, KIT, undefined, 3).B;
    expect(one.mints.length).toBeLessThan(three.mints.length);
    expect(one.people.map((p) => p.path)).toEqual(three.people.map((p) => p.path));
  });
});

describe('folk bodies: the role\'s uniform, the culture\'s cloth', () => {
  it('dresses a uniform service\'s people in its first person\'s clothes, each on a face of their own', () => {
    const keepers = F.people.filter((p) => p.role === 'keeper').map((p) => mint(B, B.people.find((x) => x.path === p.path).body));
    expect(keepers.length).toBe(2);
    expect(B.uniforms.merchant).toBe(keepers[0].key);
    expect(keepers[1].spec.outfit).toEqual(keepers[0].spec.outfit);
    expect(keepers[1].spec.palette.Top).toBe(keepers[0].spec.palette.Top);
    expect(face(keepers[1].spec)).not.toEqual(face(keepers[0].spec));
  });

  it('leaves a keeper\'s household in its own clothes', () => {
    const keeper = F.people.find((p) => p.role === 'keeper'), partner = F.people.find((p) => p.parent === keeper.path && p.as === 'partner');
    const own = mint(B, B.people.find((x) => x.path === partner.path).body);
    expect(at(own.of).uniform).toBeNull();
  });

  it('arms the watch as the guard for the era', () => {
    const setting = settingOfGame({ seed: 8, style: { kit: KIT } });
    const captain = F.people.find((p) => p.role === 'captain');
    expect(mint(B, mintKey(captain.path)).spec.gear).toEqual(QUICK_FIGURES.guard.era?.[setting.era] ?? QUICK_FIGURES.guard.gear);
  });

  it('dresses the same role in two worlds two ways', () => {
    const other = Object.keys(UNDERLAYERS).find((k) => k !== KIT && UNDERLAYERS[k].style === UNDERLAYERS[KIT].style && JSON.stringify(UNDERLAYERS[k].language) !== JSON.stringify(UNDERLAYERS[KIT].language));
    const there = made(LOTS, other).B, keeper = F.people.find((p) => p.role === 'keeper').path;
    expect(mint(B, mintKey(keeper)).spec.outfit.language).toEqual(UNDERLAYERS[KIT].language);
    expect(mint(there, mintKey(keeper)).spec.outfit.language).toEqual(UNDERLAYERS[other].language);
  });
});

describe('folk bodies: the fractal', () => {
  it('is the same for the same town, byte for byte, and only grows', () => {
    expect(JSON.stringify(made().B)).toBe(JSON.stringify(B));
    const more = made([...LOTS, lot('dwelling', 50)]).B;
    expect(JSON.stringify(more.people.slice(0, B.people.length))).toBe(JSON.stringify(B.people));
    expect(JSON.stringify(more.mints.slice(0, B.mints.length))).toBe(JSON.stringify(B.mints));
  });
});

describe('folk bodies: one met in every town', () => {
  it('gives them a body of their own, the same face in every town, the town\'s cloth', () => {
    const at = (kit, s0) => {
      const setting = settingOfGame({ seed: 8, style: { kit } });
      const F2 = folkOfTown({ seed: s0, lots: [lot('shop', 1)] }, { setting, gameSeed: 3, folk: { recurring: { joy: { role: 'keeper' } } } });
      return folkBodies(F2, { kit, setting }).mints.find((m) => m.recurring === 'joy');
    };
    const a = at(KIT, 8), b = at(KIT, 21);
    const other = Object.keys(UNDERLAYERS).find((k) => k !== KIT && UNDERLAYERS[k].style === UNDERLAYERS[KIT].style && JSON.stringify(UNDERLAYERS[k].language) !== JSON.stringify(UNDERLAYERS[KIT].language));
    const c = at(other, 8);
    expect(a.tier).toBe('own');
    expect(b.spec).toEqual(a.spec);
    expect(face(c.spec)).toEqual(face(a.spec));
    expect(c.spec.outfit.language).toEqual(UNDERLAYERS[other].language);
  });
});


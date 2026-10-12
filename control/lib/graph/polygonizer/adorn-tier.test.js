process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { describe, it, expect } from 'vitest';
import { tierKit, MIN_TRIM_PX } from './adorn-tier.js';
import { dressContext, rangerKit } from './hero-dress.js';
import { expandArmor } from '../armor/expand.js';
import { SEEDED_ARMOR } from '../armor/styles.js';
import { readTarget, pxPerMetre } from '../era/target.js';
import { planHeight } from '../era/cast-density.js';
import { heroRecord, heroPlanOf } from '@/lib/mcp/tools/layered';

// the bare tiered figure the kits are worn on, and each seeded suit (and the ranger kit) as its author wrote it
const PLAN = heroPlanOf(heroRecord({ cast: 'female', form: 'tiered' }));
const ctx = dressContext(PLAN.style, 1, PLAN);
const KITS = { ...Object.fromEntries(Object.keys(SEEDED_ARMOR).map((style) => [style, expandArmor({ type: 'armor', style, dials: { ornament: 3 } }, ctx).kit])), ranger: rangerKit(ctx) };
const TARGETS = ['480p', '720p', '1080p', '4k', { resolution: '4k', framing: 'close' }];
const byId = (kit) => new Map(kit.map((A) => [A.id, A]));

describe('adorn-tier: a kit drawn for its target', () => {
  it('only takes away: no shell, disc, row of studs or lacing finer than its author wrote it', () => {
    for (const [name, kit] of Object.entries(KITS)) for (const t of TARGETS) {
      const was = byId(kit);
      for (const A of tierKit(kit, PLAN, t).kit) {
        const B = was.get(A.id);
        expect(B, `${name}@${JSON.stringify(t)}: ${A.id} is the author's`).toBeTruthy();
        if (B.nt != null) expect(A.nt).toBeLessThanOrEqual(B.nt);
        if (B.ns != null) expect(A.ns).toBeLessThanOrEqual(B.ns);
        if (B.signature?.m != null) expect(A.signature.m).toBeLessThanOrEqual(B.signature.m);
        if (B.signature?.count != null) expect(A.signature.count).toBeLessThanOrEqual(B.signature.count);
        if (B.signature?.cords != null) expect(A.signature.cords).toBeLessThanOrEqual(B.signature.cords);
      }
    }
  });

  it('a piece on a part with no radius (the hand\'s rings) stays as its author drew it', () => {
    const was = byId(KITS.knight), now = byId(tierKit(KITS.knight, PLAN, '480p').kit);
    expect(now.get('handR-gauntlet').nt).toBe(was.get('handR-gauntlet').nt);
  });

  it('a larger figure on screen never draws a shell coarser', () => {
    for (const [name, kit] of Object.entries(KITS)) {
      const tiers = TARGETS.map((t) => byId(tierKit(kit, PLAN, t).kit));
      for (const A of kit) if (A.nt != null) {
        const nts = tiers.map((m) => m.get(A.id)?.nt).filter((n) => n != null);
        for (let i = 1; i < nts.length; i++) expect(nts[i], `${name}: ${A.id}`).toBeGreaterThanOrEqual(nts[i - 1]);
      }
    }
  });

  it('never so few sides that the skin pokes between a wrapped shell\'s points (or as its author drew it, if fewer)', () => {
    for (const [name, kit] of Object.entries(KITS)) for (const A of tierKit(kit, PLAN, '480p').kit) {
      if (A.t !== 'wrap' || A.nt == null || !(A.mugen > 0)) continue;
      const seg = PLAN.segments.find((g) => g.name === A.part.replace(/L$/, 'R'));
      const r = seg && Math.max(0, ...[seg.rA, seg.rB, ...(seg.stations || []).map((s) => s.r)].flat(Infinity).filter(Number.isFinite));
      if (!(r > 0)) continue;   // a rings part (the hand) keeps its pieces as drawn
      const author = byId(kit).get(A.id).nt;
      if (Math.cos(Math.PI / author) < r / (r + A.mugen)) expect(A.nt, `${name}: ${A.id}`).toBe(author);
      else expect(Math.cos(Math.PI / A.nt), `${name}: ${A.id}`).toBeGreaterThanOrEqual(r / (r + A.mugen) - 1e-9);
    }
  });

  it('a rolled edge too narrow to draw is its plate\'s painted rim; wide enough, it stays', () => {
    const knight = KITS.knight, trims = knight.filter((A) => /-trim(Top)?$/.test(A.id));
    expect(trims.length).toBeGreaterThan(0);
    const ppm = (t) => pxPerMetre(readTarget(t), planHeight(PLAN));
    const low = tierKit(knight, PLAN, '720p');
    expect(trims.every((T) => T.width * ppm('720p') < MIN_TRIM_PX)).toBe(true);
    expect(low.kit.some((A) => /-trim(Top)?$/.test(A.id))).toBe(false);
    expect(low.trace.painted.length).toBe(trims.length);
    const anchor = byId(low.kit).get('torso-pauldronR');
    expect(anchor.rim).toEqual({ group: 'Trim', at: 'low' });
    const close = tierKit(knight, PLAN, { resolution: '4k', framing: 'close' });
    expect(close.kit.filter((A) => /-trim(Top)?$/.test(A.id)).length).toBe(trims.length);
  });

  it('lacing too fine to draw leaves its rows in the cord\'s colour, lacquer at the top edge', () => {
    const aka = KITS.aka, cords = aka.filter((A) => /o\d+c\d+$/.test(A.id));
    expect(cords.length).toBeGreaterThan(0);
    const low = tierKit(aka, PLAN, '720p'), m = byId(low.kit);
    expect(low.kit.some((A) => /o\d+c\d+$/.test(A.id))).toBe(false);
    const row = m.get(cords[0].id.replace(/o(\d+)c\d+$/, '$1'));
    expect(row.group).toBe('Odoshi');
    expect(row.rim.group).toBe('Lacquer');
    expect(tierKit(aka, PLAN, { resolution: '4k', framing: 'close' }).kit.filter((A) => /o\d+c\d+$/.test(A.id)).length).toBe(cords.length);
  });

  it('is deterministic', () => {
    for (const kit of Object.values(KITS)) expect(JSON.stringify(tierKit(kit, PLAN, '1080p'))).toBe(JSON.stringify(tierKit(kit, PLAN, '1080p')));
  });

  it('is the tiered form\'s alone: another hero wears its kit as written, at any target', () => {
    const adorn = { type: 'armor', style: 'knight' };
    const plain = heroPlanOf(heroRecord({ cast: 'female', adorn, target: '720p' }));
    const plainCtx = dressContext(plain.style, 1, plain);
    expect(plain.adorn.map((A) => [A.id, A.nt, A.ns])).toEqual(expandArmor(adorn, plainCtx).kit.map((A) => [A.id, A.nt, A.ns]));
    const tiered = heroPlanOf(heroRecord({ cast: 'female', form: 'tiered', adorn, target: '720p' }));
    expect(tiered.adorn.length).toBeLessThan(plain.adorn.length);
  });
});

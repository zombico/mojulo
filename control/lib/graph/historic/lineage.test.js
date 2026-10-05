import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { HISTORIC_CULTURES } from './cultures/index.js';
import { KINDS, PARTS, RECORD_KINDS, relationsOf, ancestry, lineageTree, drawable, briefText, yearOf } from './lineage.js';
import { entryCard, lineageCard, historicEntryCards } from './entries.js';

const layoutOf = (K) => K.layout || 'ring-canal';

describe('the lineage checklist: relations are history, held to time and to the registry', () => {
  for (const [id, K] of Object.entries(HISTORIC_CULTURES)) {
    it(`${id}'s relations are sound`, () => {
      for (const r of K.draws || []) {
        const S = HISTORIC_CULTURES[r.from];
        expect(S, `${id} draws on '${r.from}', which is not a registered culture`).toBeTruthy();
        expect(r.from, `${id} draws on itself`).not.toBe(id);
        expect(KINDS[r.kind], `${id} ← ${r.from}: kind '${r.kind}' is one of ${Object.keys(KINDS).join(', ')}`).toBeTruthy();
        for (const p of r.parts || []) expect(PARTS, `${id} ← ${r.from}: part '${p}'`).toContain(p);
        // a source cannot start after the culture drawing on it has ended; a continuation starts earlier
        expect(S.years[0], `${id} ← ${r.from}: the source begins after ${id} ends`).toBeLessThanOrEqual(K.years[1]);
        if (r.kind === 'continues') expect(S.years[0], `${id} continues ${r.from}, which begins later`).toBeLessThan(K.years[0]);
        if (r.kind === 'variant') expect(layoutOf(S), `${id} is a variant of ${r.from} on another layout`).toBe(layoutOf(K));
      }
    });
  }

  it('has no cycle: no culture is its own ancestor', () => {
    for (const id of Object.keys(HISTORIC_CULTURES)) expect(ancestry(id).map((a) => a.id), id).not.toContain(id);
  });
});

describe('reading the tree', () => {
  it('reads relations both ways', () => {
    expect(relationsOf('thebes').drawsOn.map((r) => [r.from, r.kind])).toEqual([['giza', 'continues']]);
    expect(relationsOf('giza').drawnOnBy).toEqual([{ by: 'thebes', kind: 'continues', parts: ['patterns', 'skins', 'record'] }]);
    expect(relationsOf('lindos').drawnOnBy.map((r) => r.by).sort()).toEqual(['forum', 'polis', 'pompeii']);
  });

  it('walks the ancestry, nearest first, through what each draws on', () => {
    expect(ancestry('forum').map((a) => a.id)).toEqual(['lindos', 'pompeii']);
    expect(ancestry('sumer')).toEqual([]);
  });

  it('lists every relation as an edge', () => {
    const edges = lineageTree();
    expect(edges).toContainEqual(expect.objectContaining({ from: 'giza', to: 'thebes', kind: 'continues' }));
    expect(edges.length).toBe(Object.values(HISTORIC_CULTURES).reduce((n, K) => n + (K.draws || []).length, 0));
  });
});

describe('the brief: what a new culture can draw on at its year', () => {
  it('offers only the parts a relation carries', () => {
    const [fromLindos] = drawable({ years: [-200, -100], draws: [{ from: 'lindos', kind: 'contact', parts: ['patterns'] }] });
    expect(fromLindos.patterns).toEqual(HISTORIC_CULTURES.lindos.patterns);
    expect(fromLindos).not.toHaveProperty('skins');
    expect(fromLindos).not.toHaveProperty('record');
  });

  it("carries the record entries in use at the new culture's year, by what the relation can carry", () => {
    const draft = (kind) => ({ readAt: 550, years: [527, 565], draws: [{ from: 'forum', kind, parts: ['record'] }] });
    const inherited = drawable(draft('inherits'))[0].record.inUse;
    expect(inherited.length).toBeGreaterThan(0);
    expect(inherited.every((e) => RECORD_KINDS.inherits.includes(e.kind))).toBe(true);   // a tradition: materials and methods
    const same = drawable({ readAt: -200, years: [-305, -30], draws: [{ from: 'thebes', kind: 'continues', parts: ['record'] }] })[0].record.inUse;
    expect(same.some((e) => e.kind === 'type')).toBe(true);   // the same ground: its buildings still stand
    // nothing begun after the year, nothing ended before it
    const at = drawable({ readAt: -2500, years: [-2600, -2400], draws: [{ from: 'thebes', kind: 'continues', parts: ['record'] }] })[0].record.inUse;
    expect(at.length).toBeLessThan(same.length);
  });

  it('labels drawn record entries as parallels, never as the basis', () => {
    const text = briefText({ readAt: -200, years: [-305, -30], draws: [{ from: 'thebes', kind: 'continues', parts: ['record', 'patterns'] }] });
    expect(text).toMatch(/PARALLELS to verify for this culture, never its basis/);
    expect(briefText({ years: [1, 2] })).toMatch(/Draws on no culture yet/);
  });

  it('reads a culture at its read-at year, or the middle of its span', () => {
    expect(yearOf({ readAt: -212, years: [-350, -206] })).toBe(-212);
    expect(yearOf({ readAt: null, years: [-4000, -2350] })).toBe(-3175);
  });
});

describe('lineage in the encyclopedia', () => {
  it("every entry says its lineage, and the lineage card holds every relation", () => {
    expect(entryCard('thebes').body).toMatch(/LINEAGE {4}continues giza; drawn on by —/);
    expect(entryCard('giza').body).toMatch(/LINEAGE {4}draws on no culture here; drawn on by thebes \(continues\)/);
    const card = lineageCard();
    for (const e of lineageTree()) expect(card.body).toContain(`${e.to} ← ${e.from} (${e.kind}`);
    expect(historicEntryCards().map((c) => c.id)).toContain('historic-lineage');
  });
});

describe('the scaffold draws on its relations (dry)', () => {
  const run = (...a) => execFileSync('node', ['scripts/new-culture.mjs', ...a], { encoding: 'utf8' });
  const base = ['ptolemaic', '--like', 'thebes', '--label', 'Ptolemaic Thebes', '--years', '-305,-30', '--read-at', '-200',
    '--period', 'Ptolemaic', '--place', 'Thebes, Upper Egypt', '--region', 'egypt', '--aliases', 'ptolemaic,ptolemy'];

  it('writes the relations, unions the patterns they carry, and puts the brief in the README', () => {
    const out = run(...base, '--draws', 'thebes:continues,lindos:contact', '--dry');
    expect(out).toMatch(/import \{ THEBES \} from '\.\/thebes\.js';\nimport \{ LINDOS \} from '\.\/lindos\.js';/);
    expect(out).toMatch(/\{ from: 'thebes', kind: 'continues', parts: \['patterns', 'skins', 'record'\] \}/);
    expect(out).toMatch(/patterns: \[\.\.\.new Set\(\[\.\.\.THEBES\.patterns, \.\.\.LINDOS\.patterns\]\)\]/);
    expect(out).toMatch(/## Draws on \(the brief\)[\s\S]*### From thebes \(continues[\s\S]*### From lindos \(contact/);
  });

  it('refuses a relation it cannot write', () => {
    const fails = (...a) => { try { run(...a); return null; } catch (e) { return String(e.stderr); } };
    expect(fails(...base, '--draws', 'atlantis:inherits', '--dry')).toMatch(/'atlantis' is not a culture/);
    expect(fails(...base, '--draws', 'thebes:borrows', '--dry')).toMatch(/the kind is one of continues, inherits/);
    expect(fails(...base, '--draws', 'thebes:continues:gold', '--dry')).toMatch(/part 'gold'/);
  });
});

// The scad ladder: the card opens at its first step with a menu of sections, `get_solid_vocab` reads a section on
// request, and a scad row's mint and edits return `next`, the steps open from the recipe as stored.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, expect, it } from 'vitest';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { loadOpenscad } from '@/lib/graph/scad/scad-render';
import { getSolidVocabCatalog, splitSections } from '@/lib/graph/solid-vocab/loader';
import { PROFILE_CARD_EDITS } from '@/lib/mcp/plugin-profile-cards';
import { getSolidVocabHandler } from './mint-solid.js';
import { createScadHandler } from './scad.js';
import { scadNext } from './scad-next.js';
import { updateSketchHandler } from './sketches.js';

const hasWasm = (await loadOpenscad()) != null;
const bytes = (s) => Buffer.byteLength(s, 'utf8');

describe('card sections — the loader', () => {
  it('a card with no marks gets only its body', () => {
    expect(splitSections('# a\n\nplain')).toEqual({ body: '# a\n\nplain' });
  });

  it('marks split the card: body without the marks, a stub in place, the section text', () => {
    const text = ['intro', '<!-- section: deep | The deep end | where it gets long -->', 'long text', '<!-- /section -->', 'outro'].join('\n');
    const { body, base, sections } = splitSections(text);
    expect(body).toBe('intro\nlong text\noutro');
    expect(base).toBe('intro\n- **The deep end** — where it gets long. Section `deep`, 0.0 KB.\noutro');
    expect(sections).toEqual({ deep: { title: 'The deep end', summary: 'where it gets long', body: 'long text' } });
  });

  it('a mark left open, nested or closed twice is a loader fault', () => {
    expect(() => splitSections('<!-- section: a | A | a -->\nx')).toThrow(/never closes/);
    expect(() => splitSections('<!-- section: a | A | a -->\n<!-- section: b | B | b -->')).toThrow(/opens inside/);
    expect(() => splitSections('x\n<!-- /section -->\n<!-- section: a | A | a -->')).toThrow(/never opened/);
  });

  it('no sectioned card carries plugin-profile body edits (the edits would miss the split text)', () => {
    for (const card of getSolidVocabCatalog().values()) {
      if (card.sections) expect(PROFILE_CARD_EDITS.solid_vocab?.[card.id]?.body, card.id).toBeUndefined();
    }
  });
});

describe('the scad card', () => {
  const card = getSolidVocabCatalog().get('scad');

  it('splits into a short base and the six deeper steps, losing no line', () => {
    expect(Object.keys(card.sections)).toEqual(['mechlib', 'standards', 'outputs', 'mechanism', 'dynamics', 'strength']);
    expect(bytes(card.base)).toBeLessThan(10_000);
    for (const [name, s] of Object.entries(card.sections)) expect(bytes(s.body), name).toBeLessThan(9_000);
    expect(card.body).not.toMatch(/<!--/);
    // every line of the body is in the base or in exactly one section, in order
    const stubbed = card.base.split('\n').flatMap((line) => {
      const m = line.match(/Section `([a-z-]+)`, [\d.]+ KB\.$/);
      return m ? card.sections[m[1]].body.split('\n') : [line];
    });
    expect(stubbed.join('\n').replace(/\n{2,}/g, '\n')).toBe(card.body.replace(/\n{2,}/g, '\n'));
  });

  it('opens at the base with a menu; a section, a list, an unknown name', async () => {
    const open = await getSolidVocabHandler({ id: 'scad' });
    expect(open.card.body).toBe(card.base);
    expect(open.card.sections.map((s) => s.name)).toEqual(Object.keys(card.sections));
    expect(open.card.sections[0]).toMatchObject({ title: 'Parts', bytes: bytes(card.sections.mechlib.body) });
    expect(open.card.base).toBeUndefined();
    const one = await getSolidVocabHandler({ id: 'scad', section: 'mechanism' });
    expect(one.sections).toEqual([{ name: 'mechanism', title: 'The mechanism contract', body: card.sections.mechanism.body }]);
    const two = await getSolidVocabHandler({ id: 'scad', section: ['dynamics', 'strength'] });
    expect(two.sections.map((s) => s.name)).toEqual(['dynamics', 'strength']);
    await expect(getSolidVocabHandler({ id: 'scad', section: 'gears' })).rejects.toThrow(/no section 'gears'.*mechlib, standards/);
  });

  it('a card without sections reads whole, and refuses a section', async () => {
    const wb = await getSolidVocabHandler({ id: 'workbench' });
    expect(wb.card.body).toBe(getSolidVocabCatalog().get('workbench').body);
    expect(wb.card.sections).toBeUndefined();
    await expect(getSolidVocabHandler({ id: 'workbench', section: 'x' })).rejects.toThrow(/has no sections/);
  });

  it('the index rows carry no base or sections', async () => {
    const list = await getSolidVocabHandler({});
    const scad = list.cards.find((c) => c.id === 'scad');
    expect(Object.keys(scad).sort()).toEqual(['entry', 'family', 'id', 'name', 'summary', 'when']);
  });
});

describe('scadNext', () => {
  const S = { kind: 'scad', source: 'cube(10);' };
  const names = (m) => scadNext(m).map((s) => s.add || s.measure || s.export);

  it('names nothing for another kind', () => {
    expect(scadNext({ kind: 'workbench' })).toBeUndefined();
    expect(scadNext(null)).toBeUndefined();
  });

  it('a lone part: will it hold, then print', () => {
    expect(scadNext(S)).toEqual([{ add: 'strength', card: 'scad', section: 'strength' }, { export: '3mf' }]);
  });

  it('two parts open the mechanism step; a mechanism opens dynamics and its reading', () => {
    expect(names({ ...S, parts: { a: 'a();', b: 'b();' } })).toEqual(['mechanism', 'strength', '3mf']);
    expect(names({ ...S, parts: { a: 'a();' } })).toEqual(['strength', '3mf']);
    const mech = { joints: {}, couplings: [], drive: { part: 'a' } };
    expect(names({ ...S, mechanism: mech })).toEqual(['mechanism.material', 'motion', 'strength', '3mf']);
    expect(names({ ...S, mechanism: { ...mech, material: 'petg' } })).toEqual(['motion', 'strength', '3mf']);
    expect(names({ ...S, mechanism: { ...mech, bodies: { a: { material: 'pla' } } } })).toEqual(['motion', 'strength', '3mf']);
  });

  it('strength: the reading, then a print as printed, then its coupon; a metal part needs neither', () => {
    expect(names({ ...S, strength: { material: 'pla', checks: [] } })).toEqual(['strength', 'strength.print', '3mf']);
    expect(names({ ...S, strength: { material: 'pla', print: {}, checks: [] } })).toEqual(['strength', 'strength.coupon', '3mf']);
    expect(names({ ...S, strength: { material: 'pla', print: {}, coupon: { break_n: 900 }, checks: [] } })).toEqual(['strength', '3mf']);
    expect(names({ ...S, strength: { material: 'al-6061', checks: [] } })).toEqual(['strength', '3mf']);
    expect(scadNext({ ...S, strength: { material: 'pla', checks: [] } })[0]).toEqual({ measure: 'strength', card: 'scad', section: 'strength' });
  });

  it('sheet metal opens the drawing', () => {
    expect(scadNext({ ...S, source: 'mj_sheet(1.5, 1, 40, [[30, 90], [20, 0]]);' }).at(-2)).toEqual({ export: 'dxf', card: 'scad', section: 'outputs' });
  });

  it('every section it names is one the card has', () => {
    const { sections } = getSolidVocabCatalog().get('scad');
    const all = [
      S, { ...S, parts: { a: '', b: '' } }, { ...S, mechanism: {}, strength: { material: 'pla' } },
      { ...S, strength: { material: 'pla', print: {} } }, { ...S, source: 'mj_sheet(1,1,1,[]);' },
    ].flatMap(scadNext);
    for (const s of all) if (s.section) expect(sections[s.section], s.section).toBeDefined();
  });
});

describe.skipIf(!hasWasm)('next on a scad row', () => {
  const SOURCE = 'module a() { cube([20, 30, 4]); }\nmodule b() { translate([22, 0, 0]) cube([20, 30, 4]); }';

  it('the mint and an edit return it; it is never stored', async () => {
    const m = await createScadHandler({ title: 'two slabs', ref: 'sk_ladder', source: SOURCE, parts: { a: 'a();', b: 'b();' } });
    expect(m.next.map((s) => s.add || s.export)).toEqual(['mechanism', 'strength', '3mf']);
    const r = await updateSketchHandler({ ref: 'sk_ladder', patch: [{ op: 'set', path: '/strength', value: { material: 'petg', checks: [{ element: 'cantilever', root: { at: [0, 15, 2], normal: [1, 0, 0] }, load: { at: [18, 15, 2], mass: 1 } }] } }] });
    expect(r.next.map((s) => s.add || s.measure || s.export)).toEqual(['mechanism', 'strength', 'strength.print', '3mf']);
    expect(SketchRepository.getByRef('sk_ladder').manifest.next).toBeUndefined();
  });

  it("every worked example in the card's base mints", async () => {
    const { base } = getSolidVocabCatalog().get('scad');
    const calls = [...base.matchAll(/```\n(mint_solid\(\{ kind: 'scad'[\s\S]*?)\n```/g)].map((x) => x[1]);
    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (const code of calls) {
      let spec;
      new Function('mint_solid', code)((o) => { spec = o.spec; });
      const r = await createScadHandler(spec);
      expect(r.ok).toBe(true);
    }
  }, 120_000);
});

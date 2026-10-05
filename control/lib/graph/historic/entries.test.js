import { describe, it, expect } from 'vitest';
import { historicEntryCards, entryCard, recordCard, hubCards, ENTRY_BODY_CEILING, RECORD_BODY_CEILING, REGIONS } from './entries.js';
import { HISTORIC_CULTURES } from './historic-city.js';
import { historicOptions } from './historic-kind.js';
import { PATTERNS } from './patterns.js';
import { WALL_SKINS } from './ground.js';
import { getViewVocabCatalog, _resetViewVocabCache } from '../views/view-vocab/loader.js';
import { getViewVocabHandler } from '../../mcp/tools/create-view.js';

const starterLines = (body) => body.split('\n').filter((l) => /^ {2}[^:]+: \{"kind":"historic"/.test(l)).map((l) => JSON.parse(l.slice(l.indexOf('{'))));

describe('historic entries: generated encyclopedia cards', () => {
  it('gives every culture an entry and a record, and a hub to every region with more than one', () => {
    const ids = historicEntryCards().map((c) => c.id);
    for (const id of Object.keys(HISTORIC_CULTURES)) {
      expect(ids).toContain(id);
      expect(ids).toContain(`${id}/record`);
    }
    expect(hubCards().map((c) => c.id).sort()).toEqual(['egypt', 'greece']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('a new culture card is an entry with no other edit', () => {
    HISTORIC_CULTURES.testland = { ...HISTORIC_CULTURES.qin, label: 'Testland', region: undefined, aliases: ['testland'] };
    try {
      const c = entryCard('testland');
      expect(c.name).toBe('Testland');
      expect(c.body).toMatch(/no record yet: read every part as CONJECTURAL/);
      expect(historicEntryCards().map((x) => x.id)).toContain('testland');
    } finally { delete HISTORIC_CULTURES.testland; }
  });

  it('keeps every entry body within its ceiling, and every record within its own', () => {
    for (const c of historicEntryCards()) {
      const ceiling = c.id.endsWith('/record') ? RECORD_BODY_CEILING : ENTRY_BODY_CEILING;
      expect(c.body.length, c.id).toBeLessThanOrEqual(ceiling);
    }
  });

  it('every starter is a manifest the historic kind accepts', () => {
    for (const id of Object.keys(HISTORIC_CULTURES)) {
      const starters = starterLines(entryCard(id).body);
      expect(starters.length, id).toBeGreaterThanOrEqual(2);
      for (const m of starters) {
        // a city view is the town's approach, which every city has; the rest is checked by the kind itself
        const { view, ...rest } = m;
        if (view) expect([m.scene, view]).toEqual(['city', 'approach']);
        expect(() => historicOptions(rest), JSON.stringify(m)).not.toThrow();
      }
    }
  });

  it('every part handle resolves to a real skin, pattern or asset', () => {
    for (const [id, K] of Object.entries(HISTORIC_CULTURES)) {
      const body = entryCard(id).body, line = (k) => body.split('\n').find((l) => l.startsWith(`  ${k} `)).slice(k.length + 3).trim();
      for (const s of line('skins').split(', ')) expect(WALL_SKINS[s], `${id} skin ${s}`).toBeTruthy();
      for (const p of line('patterns').split(', ').filter(Boolean)) expect(PATTERNS[p], `${id} pattern ${p}`).toBeTruthy();
      for (const a of line('assets').split(', ').filter(Boolean)) expect(K.assets[a], `${id} asset ${a}`).toBeTruthy();
    }
  });

  it('never claims more than the record: ATTESTED is the record\'s read entries, the plan is never ATTESTED', () => {
    const thebes = entryCard('thebes').body;
    expect(thebes).toMatch(/\d+ ATTESTED, \d+ RECONSTRUCTED, \d+ CONJECTURAL/);
    expect(thebes).toMatch(/town plan and placement are RECONSTRUCTED/);
    const rec = recordCard('thebes').body;
    const attested = rec.slice(rec.indexOf('ATTESTED (read):'), rec.indexOf('RECONSTRUCTED (secondary):'));
    for (const l of attested.split('\n').filter((x) => x.startsWith('- '))) expect(l, l).toMatch(/ — \S/);   // each one cites a source
  });

  it('says up front that it is a general depiction, with anachronisms to expect', () => {
    for (const id of Object.keys(HISTORIC_CULTURES)) expect(entryCard(id).body, id).toMatch(/SCOPE {6}a general depiction .* expect anachronisms/);
    for (const h of hubCards()) expect(h.body).toMatch(/general depiction of its period, with anachronisms/);
  });

  it('carries the caption as its summary and the words people use in its search line', () => {
    const c = entryCard('thebes');
    expect(c.summary).toMatch(/^New Kingdom Thebes · New Kingdom/);
    for (const w of ['egypt', 'egyptian', 'pharaoh', 'nile', 'luxor']) expect(c.when).toContain(`"${w}"`);
    expect(entryCard('sumer').when).toContain('"ziggurat"');
    expect(entryCard('sumer').when).toContain('"mesopotamia"');
    for (const r of Object.values(REGIONS)) expect(r.aliases.every((a) => a.length >= 3)).toBe(true);   // the lexical index reads 3+ characters
  });

  it('is deterministic', () => {
    expect(JSON.stringify(historicEntryCards())).toBe(JSON.stringify(historicEntryCards()));
  });
});

describe('historic entries in the view-vocab drawer', () => {
  it('are cards of family entry, read in full by id', async () => {
    _resetViewVocabCache();
    const cat = getViewVocabCatalog();
    expect(cat.get('thebes').family).toBe('entry');
    const one = await getViewVocabHandler({ id: 'thebes' });
    expect(one.card.body).toMatch(/STARTERS/);
    const rec = await getViewVocabHandler({ id: 'thebes/record' });
    expect(rec.card.body).toMatch(/ATTESTED \(read\)/);
  });

  it('list the entries and hubs one line each, the record cards left out', async () => {
    const list = await getViewVocabHandler({ family: 'entry' });
    const ids = list.cards.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['egypt', 'thebes', 'giza', 'sumer']));
    expect(ids.some((i) => i.endsWith('/record'))).toBe(false);
    for (const c of list.cards) expect(c).not.toHaveProperty('body');
  });
});

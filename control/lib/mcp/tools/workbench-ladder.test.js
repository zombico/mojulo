// The workbench ladder: the workbench card opens at what a first plain object needs (the spec, the quick start, the
// lathes, extrudes and sweeps, assembly, materials and the candlestick) with a menu of its deeper families, and
// `get_solid_vocab` reads one on request (a bookcase reads the base and `furniture`). The text moved; none was
// rewritten. The loader and the read contract are scad-ladder.test.js's; this holds the workbench card to them.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getSolidVocabCatalog } from '@/lib/graph/solid-vocab/loader';
import { profileEditMisses } from '@/lib/mcp/plugin-profile';
import { PROFILE_CARD_EDITS, profiledCard } from '@/lib/mcp/plugin-profile-cards';
import { getSolidVocabHandler, mintSolidHandler } from './mint-solid.js';

const bytes = (s) => Buffer.byteLength(s, 'utf8');
const card = getSolidVocabCatalog().get('workbench');
const BASE_CAP = 22_000;      // what a plain object reads; the card is ~75 KB
const SECTION_CAP = 8_000;
const MARK = /^<!-- (section: .*|\/section) -->$/;

describe('the workbench card', () => {
  it('moved its text and rewrote none: the body is the card as it was before the marks', () => {
    // The pre-ladder card (76,695 bytes after its frontmatter). An intended edit to the card's text re-pins this.
    // 76_695 at the ladder; 76_972 with the furniture-fittings merge (the stagger and lone-cam dowel lines, in `furniture`).
    expect(bytes(card.body)).toBe(76_972);
    expect(createHash('sha256').update(card.body).digest('hex').slice(0, 16)).toBe(BODY_SHA);
    // and the marks are the only lines the file adds
    const raw = readFileSync(join(process.cwd(), 'lib/graph/solid-vocab/workbench.md'), 'utf8');
    const text = raw.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '').trim();
    expect(text.split('\n').filter((l) => !MARK.test(l)).join('\n')).toBe(card.body);
    expect(card.body).not.toMatch(/<!--/);
  });

  it('splits into a short base and its deeper families, each line in exactly one place', () => {
    expect(Object.keys(card.sections)).toEqual([
      'lofts', 'fields', 'expr', 'rocks', 'crystals', 'light', 'domain-ops', 'frames', 'furniture', 'upholstery',
      'drapes', 'reliefs', 'shells', 'cuts', 'finishes', 'composition', 'movers',
    ]);
    expect(bytes(card.base)).toBeLessThan(BASE_CAP);
    expect(bytes(card.base)).toBeLessThan(bytes(card.body) / 3);
    for (const [name, s] of Object.entries(card.sections)) expect(bytes(s.body), name).toBeLessThan(SECTION_CAP);
    const stub = /^- \*\*.+\*\* — .+\. Section `([a-z-]+)`, [\d.]+ KB\.$/;
    const baseLines = card.base.split('\n');
    const stubs = baseLines.map((l) => l.match(stub)?.[1]).filter(Boolean);
    expect(stubs).toEqual(Object.keys(card.sections));
    // rebuilt in order from the base with each stub opened, it is the body (blank lines at a section's ends trimmed)
    const rebuilt = baseLines.flatMap((l) => { const m = l.match(stub); return m ? card.sections[m[1]].body.split('\n') : [l]; });
    expect(rebuilt.join('\n').replace(/\n{2,}/g, '\n')).toBe(card.body.replace(/\n{2,}/g, '\n'));
    // and no non-blank line is counted twice
    const nonBlank = (ls) => ls.filter((l) => l.trim()).length;
    const inSections = Object.values(card.sections).reduce((n, s) => n + nonBlank(s.body.split('\n')), 0);
    expect(nonBlank(baseLines) - stubs.length + inSections).toBe(nonBlank(card.body.split('\n')));
  });

  it('each stub names the asks its section answers', () => {
    const { sections } = card;
    expect(sections.furniture.summary).toMatch(/bookcase.*cabinet.*flat-pack/);
    expect(sections.upholstery.summary).toMatch(/sofa/);
    expect(sections.frames.summary).toMatch(/timber frame.*brick walls/);
    expect(sections.fields.summary).toMatch(/hole, bore, pocket/);
    expect(sections.shells.summary).toMatch(/geodesic dome, a d20, a soccer ball/);
    expect(sections.movers.summary).toMatch(/lid or door that opens/);
  });

  it('the base keeps what a first plain object needs', () => {
    for (const heading of ['## Spec shape', '### Quick start', '## Lathes', '## Extrudes', '## Sweeps', '## Assembly', '## Materials, units, framing', '## Worked example\n']) {
      expect(card.base, heading).toContain(heading);
    }
    expect(card.base).toMatch(/- `units` \(`'mm'`/);
    expect(card.sections.furniture.body).toMatch(/id: 'bookcase'/);
  });

  it('opens at the base with the menu; a bookcase reads the base and one section', async () => {
    const open = await getSolidVocabHandler({ id: 'workbench' });
    expect(open.card.body).toBe(card.base);
    expect(open.card.sections.map((s) => s.name)).toEqual(Object.keys(card.sections));
    const shelf = await getSolidVocabHandler({ id: 'workbench', section: 'furniture' });
    expect(shelf.sections).toEqual([{ name: 'furniture', title: 'Frames — furniture', body: card.sections.furniture.body }]);
    const two = await getSolidVocabHandler({ id: 'workbench', section: ['frames', 'furniture'] });
    expect(two.sections.map((s) => s.name)).toEqual(['frames', 'furniture']);
  });
});

describe('the other cards', () => {
  it('only scad and workbench are sectioned; every other card reads its body whole', async () => {
    const catalog = getSolidVocabCatalog();
    expect([...catalog.values()].filter((c) => c.sections).map((c) => c.id).sort()).toEqual(['scad', 'workbench']);
    for (const c of catalog.values()) {
      if (c.sections) continue;
      const r = await getSolidVocabHandler({ id: c.id });
      expect(r.card.body, c.id).toBe(c.body);
      expect(r.card.sections, c.id).toBeUndefined();
    }
  });
});

describe('the workbench card under the plugin profile', () => {
  afterEach(() => { delete process.env.MOJULO_DISTRIBUTION; });

  it('its body edits land in the base it serves, none in a section', async () => {
    const edits = PROFILE_CARD_EDITS.solid_vocab.workbench.body;
    for (const [from] of edits) {
      expect(card.base.includes(from), String(from)).toBe(true);
      for (const [name, s] of Object.entries(card.sections)) expect(s.body.includes(from), `${name}: ${from}`).toBe(false);
    }
    process.env.MOJULO_DISTRIBUTION = 'claude-plugin';
    const open = await getSolidVocabHandler({ id: 'workbench' });
    expect(open.card.body).not.toMatch(/outcomeRef/);
    expect(open.card.body).toBe(profiledCard('solid_vocab', card).base);
    const all = await getSolidVocabHandler({ id: 'workbench', section: Object.keys(card.sections) });
    for (const s of all.sections) expect(s.body, s.name).not.toMatch(/outcomeRef/);
    expect(profileEditMisses().filter((m) => m.includes('workbench'))).toEqual([]);
  });
});

// Every worked example on the card, in the base or in a section, mints as written. The blocks are the card's own JS
// literals: a whole `{ kind, title, spec }`, a JSON spec, or a `key: value, …` spec fragment.
const BLOCK = /```(json)?\n([\s\S]*?)\n```/g;
function examples(text) {
  const out = [];
  for (const [, json, src] of text.matchAll(BLOCK)) {
    if (json) { out.push(JSON.parse(src)); continue; }
    const t = src.trim();
    if (/^\{\s*lathes\?:/.test(t)) continue;                                            // the spec's shape, not an example
    if (/^\{ id: 'gyroid'/.test(t)) {                                                    // one term: the slab it cuts
      const term = new Function(`return (${t});`)();
      out.push({ units: 'cm', fields: [{ cells: 48, terms: [{ op: 'add', shape: { kind: 'box', center: [0, 0, 1], size: [2, 2, 2] } }, term] }] });
      continue;
    }
    if (/^\{\s*\n?\s*kind: 'workbench'/.test(t)) { out.push(new Function(`return (${t});`)().spec); continue; }
    // a fragment, or several one-line fragments (the sofa and the bench)
    const parts = /\n(?=units: )/.test(t) ? t.split(/\n(?=units: )/) : [t];
    for (const p of parts) {
      if (/\/\* .* \*\//.test(p)) continue;                                          // an elided sketch (the bench's members), not a recipe
      out.push(new Function(`return ({ ${p} });`)());
    }
  }
  return out;
}

describe('the worked examples', () => {
  it('the base carries the mug and the candlestick, and both mint', async () => {
    const specs = examples(card.base);
    expect(specs).toHaveLength(2);
    for (const [i, spec] of specs.entries()) {
      const r = await mintSolidHandler({ kind: 'workbench', title: `base example ${i}`, ref: `wb_base_${i}`, spec });
      expect(r.ok, `base example ${i}`).toBe(true);
    }
  }, 60_000);

  it('every section example mints', async () => {
    let n = 0;
    for (const [name, s] of Object.entries(card.sections)) {
      for (const [i, spec] of examples(s.body).entries()) {
        n += 1;
        const r = await mintSolidHandler({ kind: 'workbench', title: `${name} ${i}`, ref: `wb_${name}_${i}`, spec });
        expect(r.ok, `${name} example ${i}`).toBe(true);
      }
    }
    expect(n).toBe(13);
  }, 240_000);
});

// sha256 of the card's body: '8967727614d0f567' at the ladder (git show HEAD:…/workbench.md before it); re-pinned on
// merging 1006-furniture-collisions, whose furniture-section edits are the only change. Re-pin only on a deliberate text edit.
const BODY_SHA = '6f7ddbb5c1bd41c9';

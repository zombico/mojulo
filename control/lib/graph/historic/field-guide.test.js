// The field guide: a historic scene read back with the knob for each choice and the record behind it.
import { describe, it, expect } from 'vitest';
import { historicGuideHtml } from './field-guide.js';
import { FORMS } from './form/towns.js';
import { FORM_KEYS } from './form/schema.js';

describe('the historic field guide', () => {
  const id = Object.keys(FORMS).find((c) => Object.keys(FORMS[c].cites || {}).length), html = historicGuideHtml({ kind: 'historic', culture: id });
  it('is a page with the plan, the principles, the monuments, what its builders had, the laws and the views', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    for (const h of ['The plan', 'The principles', 'The monuments', 'What its builders had', 'The laws', 'Views and slices']) expect(html).toContain(h);
    expect(html).toContain('<svg');
  });
  it('names the `form` path of every value it shows, and every principle the form holds', () => {
    for (const k of FORM_KEYS.filter((k) => k !== 'label' && k !== 'cites' && FORMS[id][k] !== undefined)) expect(html, k).toContain(`<h3>${k}</h3>`);
    expect(html).toContain('form.streets.pattern');
    expect(html).toContain('form.armature.monument');
  });
  it('cites the record rows each principle stands on', () => {
    for (const keys of Object.values(FORMS[id].cites)) for (const k of keys) expect(html).toContain(k);
  });
  it('is the same page for the same manifest, and refuses one the kind refuses', () => {
    expect(historicGuideHtml({ kind: 'historic', culture: id })).toBe(html);
    expect(() => historicGuideHtml({ kind: 'historic', culture: 'atlantis' })).toThrow(/unknown culture/);
  });
});

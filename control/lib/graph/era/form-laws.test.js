// The form render's laws, measured (form-laws.js): the crypt in ashlar keeps every one; the crypt it is cut from, the
// sixth generation's, is told which of its numbers are that era's.
import { describe, it, expect } from 'vitest';
import { readFormKit, FORM_MEASURES } from './form-laws.js';
import { STAGE_KITS } from './stage.js';
import { LAWS, PRINCIPLE_LAWS, statedPrinciples } from './laws.js';

describe('the form render\'s laws, measured', () => {
  it('every law a kit is measured by is one of the seventh generation\'s', () => {
    for (const r of readFormKit(STAGE_KITS['gothic-ashlar']).rows) expect(LAWS[r.law]?.form, r.law).toBe(true);
  });

  it('the crypt in ashlar keeps them all; gothic-stone, the sixth generation\'s, is told which numbers are its era\'s', () => {
    const ash = readFormKit(STAGE_KITS['gothic-ashlar']), stone = readFormKit(STAGE_KITS['gothic-stone']);
    expect(ash.rows.filter((r) => !r.ok)).toEqual([]);
    expect(ash.ok).toBe(true);
    expect(stone.ok).toBe(false);
    const failed = new Set(stone.rows.filter((r) => !r.ok).map((r) => r.law));
    // (its blocks are drawn, each its own value, and its curves are faceted: the frame it was made for)
    for (const law of ['relief-is-material', 'value-by-light', 'true-curves']) expect(failed.has(law), law).toBe(true);
    // (a tall dark vault is the crypt's own principle in both eras)
    expect(stone.rows.find((r) => r.what === 'the vault\'s tint').ok).toBe(true);
    expect(ash.rows.find((r) => r.what === 'a wall\'s course (m)').value).toBeLessThanOrEqual(FORM_MEASURES.course[1]);
  });

  it('the form register states its own principles, each counted; the crypt\'s own are as they were', () => {
    const stated = statedPrinciples();
    expect(stated['crypt/form']).toHaveLength(PRINCIPLE_LAWS['crypt/form'].length);
    expect(PRINCIPLE_LAWS['crypt/form'].flat().some((l) => LAWS[l].form)).toBe(true);
    // (the motif principle holds in both: a small band; in the form register the light finds it)
    expect(STAGE_KITS['gothic-ashlar'].motif.on).toBe('cornice');
    expect(stated.crypt).toBe(STAGE_KITS['gothic-stone'].dress.principles);
  });
});

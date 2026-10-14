// The generated statue-slot table is the live plan, culture for culture. A failure means a culture, its form, its
// monuments or statues.js moved: run `node scripts/gen-historic-slots.mjs`.
import { describe, it, expect } from 'vitest';
import { HISTORIC_CULTURES } from './historic-city.js';
import { liveSlotText } from './entries.js';
import { SLOT_TABLE } from './slot-table.js';
import { FORMS } from './form/towns.js';

describe('SLOT_TABLE', () => {
  it('holds every culture and only those', () => {
    expect(Object.keys(SLOT_TABLE).sort()).toEqual(Object.keys(HISTORIC_CULTURES).sort());
  });
  it('equals the live plan, one culture per form (a culture on another\'s form is laid by it)', () => {
    const perForm = Object.values(Object.keys(HISTORIC_CULTURES).reduce((o, id) => { o[FORMS[id] ? id : HISTORIC_CULTURES[id].form] ??= id; return o; }, {}));
    expect(perForm.length).toBeGreaterThan(1);
    for (const id of perForm) expect(SLOT_TABLE[id], id).toBe(liveSlotText(id));
  });
});

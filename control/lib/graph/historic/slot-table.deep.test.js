// The generated statue-slot table is the live plan, culture for culture. A failure means a culture, its layout or
// statues.js moved: run `node scripts/gen-historic-slots.mjs`.
import { describe, it, expect } from 'vitest';
import { HISTORIC_CULTURES } from './historic-city.js';
import { liveSlotText } from './entries.js';
import { SLOT_TABLE } from './slot-table.js';

describe('SLOT_TABLE', () => {
  it('holds every culture and only those', () => {
    expect(Object.keys(SLOT_TABLE).sort()).toEqual(Object.keys(HISTORIC_CULTURES).sort());
  });
  it('equals the live plan, one culture per layout (a culture spread from another is laid by its layout)', () => {
    const perLayout = Object.values(Object.keys(HISTORIC_CULTURES).reduce((o, id) => { o[HISTORIC_CULTURES[id].layout || 'ring-canal'] ??= id; return o; }, {}));
    for (const id of perLayout) expect(SLOT_TABLE[id], id).toBe(liveSlotText(id));
  });
});

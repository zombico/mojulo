// The starters made through the real door: each mints, its tour and brief are taken by the world gate, and its audit
// finds nothing to warn of. Pompeii resolves a whole historic town with its people, so this is the e2e tier.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect } from 'vitest';
import { createExhibitHandler } from '@/lib/mcp/tools/create-exhibit';
import { makeStarter } from './starters.js';

describe('the starters through create_exhibit', () => {
  it('Pompeii: its tour lights named parts, its claims are cited, the sign-off is left to the expert', async () => {
    const { town } = await makeStarter('pompeii', createExhibitHandler);
    expect(town.tour_refused).toBeUndefined();
    expect(town.brief_refused).toBeUndefined();
    expect(town.audit.findings.filter((f) => f.level !== 'advice')).toEqual([]);
    expect(town.audit.accuracy.state).toBe('unsigned');
  }, 240000);

  it('hydro: five toured rooms, a states room and their gallery, none warned of', async () => {
    const made = await makeStarter('hydro', createExhibitHandler);
    for (const r of Object.values(made)) {
      expect(r.tour_refused).toBeUndefined();
      expect(r.audit.findings.filter((f) => f.level !== 'advice')).toEqual([]);
    }
    expect(made.wing.rooms).toBe(6);
  }, 240000);
});

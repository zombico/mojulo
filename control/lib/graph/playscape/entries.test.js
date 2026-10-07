import { describe, expect, it } from 'vitest';

import { playscapeEntryCards, ENTRY_CARD_BODY_CEILING } from './entries.js';
import { DOOR_VARIANT_IDS, DOOR_SKIN_IDS } from './objects/door.js';
import { resolveObject } from './objects/index.js';

describe('the playscape encyclopedia', () => {
  const [door] = playscapeEntryCards();

  it('has a door page naming every variant and skin, under its ceiling', () => {
    expect(door.id).toBe('entry/door');
    for (const v of DOOR_VARIANT_IDS) expect(door.body).toContain(`  - ${v}:`);
    for (const s of DOOR_SKIN_IDS) expect(door.body).toContain(s);
    expect(door.body.length).toBeLessThanOrEqual(ENTRY_CARD_BODY_CEILING);
    for (const f of ['id', 'name', 'summary', 'when', 'body']) expect(typeof door[f]).toBe('string');
  });

  it('every starter resolves (a fit stands in for the doorway anchor)', () => {
    const starters = door.body.split('\n').filter((l) => l.startsWith('  {')).map((l) => JSON.parse(l));
    expect(starters.map((s) => s.variant)).toEqual(DOOR_VARIANT_IDS);
    for (const { at, ...s } of starters) expect(() => resolveObject({ ...s, fit: { width: 1.2, height: 2.4 } })).not.toThrow();
  });

  it('has a platform and a lift page, each under the ceiling, every starter resolving', () => {
    const [, platform, lift] = playscapeEntryCards();
    for (const c of [platform, lift]) {
      expect(c.body.length).toBeLessThanOrEqual(ENTRY_CARD_BODY_CEILING);
      for (const line of c.body.split('\n').filter((l) => l.startsWith('  {'))) expect(() => resolveObject(JSON.parse(line))).not.toThrow();
    }
    expect(platform.body).toMatch(/1 m² too small · 2\.25 m² step · 4 m² step · 9 m² rest/);
    expect(lift.body).toMatch(/2\.1 m over the highest/);
  });

  it('reads its numbers off the mechanism', () => {
    expect(door.body).toMatch(/single: .*open, 1\.36 m clear; needs 1\.44 m clear in front/);
    expect(door.body).toMatch(/portcullis: .*needs 2\.6 m of headroom/);
  });
});

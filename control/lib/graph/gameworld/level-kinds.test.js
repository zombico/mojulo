import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { LEVEL_KINDS, LEVEL_KIND_STATUSES, levelKindsOf } from './level-kinds.js';
import { RAIL_IDS, railSheet } from './rails.js';
import { railCardById } from './gameworld-cards.js';

// LEVEL KINDS (level-kinds.js): a rail's primitives, each a kind of level picked by name with the laws that prove it.

const REPO = path.resolve(import.meta.dirname, '../../../..');

describe('level kinds', () => {
  it('each is a rail\'s, named once, its verbs, pressure and laws said, its status one of the three', () => {
    for (const [rail, kinds] of Object.entries(LEVEL_KINDS)) {
      expect(RAIL_IDS, rail).toContain(rail);
      expect(new Set(kinds.map((k) => k.id)).size).toBe(kinds.length);
      for (const k of kinds) {
        expect(k.name && k.shape && k.pressure, k.id).toBeTruthy();
        expect(k.teaches.length, k.id).toBeGreaterThan(0);
        expect(k.laws.length, k.id).toBeGreaterThan(0);
        expect(LEVEL_KIND_STATUSES, k.id).toContain(k.status);
      }
    }
  });

  it('a kind built or a spike shows where a level of it is made; a proposed one says what it waits on', () => {
    for (const kinds of Object.values(LEVEL_KINDS)) for (const k of kinds) {
      if (k.status === 'proposed') { expect(k.waits, k.id).toBeTruthy(); expect(k.example, k.id).toBeUndefined(); continue; }
      const file = k.example.split(' ')[0];
      expect(fs.existsSync(path.join(REPO, file)), `${k.id}: ${file}`).toBe(true);
    }
  });

  it('the rail\'s sheet carries its kinds and its card says each; a rail with none carries none', () => {
    const [rail] = Object.keys(LEVEL_KINDS), S = railSheet(rail), body = railCardById(`gameworld-rail-${rail}`).body;
    expect(S.kinds.map((k) => k.id)).toEqual(levelKindsOf(rail).map((k) => k.id));
    for (const k of S.kinds) { expect(body).toContain(k.name); for (const l of k.laws) expect(body).toContain(l); }
    const bare = RAIL_IDS.find((id) => !levelKindsOf(id).length);
    expect(railSheet(bare).kinds).toBeUndefined();
    expect(railCardById(`gameworld-rail-${bare}`).body).not.toContain('ITS LEVEL KINDS');
  });
});

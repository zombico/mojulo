import { describe, it, expect } from 'vitest';

import { getMechanicVocabCatalog, listMechanicVocab } from './loader.js';
import { MECHANIC_KINDS } from '../mechanics.js';

// ── M2: the mechanic vocabulary (game-mechanics.plan.md) ────────────────────────────────────────
// One card per shipped mechanic (+ the fall policy + a guide), discoverable so an agent finds a
// level verb by intent and reads its manual before composing a level.

describe('mechanic vocab cards', () => {
  it('every shipped mechanic has a card, and the fall policy + guide too', () => {
    const cat = getMechanicVocabCatalog();
    for (const kind of MECHANIC_KINDS) {
      expect(cat.has(kind), `missing card for mechanic '${kind}'`).toBe(true);
    }
    expect(cat.has('fall-policy')).toBe(true);
    expect(cat.has('mechanics-guide')).toBe(true);
  });

  it('no card describes a mechanic that does not exist (guide/fall-policy aside)', () => {
    const known = new Set([...MECHANIC_KINDS, 'fall-policy', 'mechanics-guide']);
    for (const id of getMechanicVocabCatalog().keys()) {
      expect(known.has(id), `card '${id}' has no matching mechanic`).toBe(true);
    }
  });

  it('cards carry substantive intent phrasing + a param manual', () => {
    for (const card of listMechanicVocab()) {
      expect(card.summary.length, card.id).toBeGreaterThan(20);
      expect(card.when.length, card.id).toBeGreaterThan(15);
    }
    // the reach-exit card names its params + lowering so authoring is self-serve
    const body = getMechanicVocabCatalog().get('reach-exit').body;
    expect(body).toMatch(/goal:reached/);
    expect(body).toMatch(/walkto/);
  });
});

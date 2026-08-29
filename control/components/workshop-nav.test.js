import { describe, it, expect } from 'vitest';

import { WORKSHOP_GROUPS, visibleWorkshopGroups } from '@/components/workshop-nav';

// The nav is where the 2.0 reposition is visible to a human: the making surface
// leads and is unconditional, the operational surface earns its place by having
// records. See mojulo-2.0-pure-creative.plan.md (Phase 1f).
describe('workshop nav — studio leads, ops is record-gated', () => {
  const keysOf = (groups) => groups.map((g) => g.key);
  const tileKeys = (groups, key) => groups.find((g) => g.key === key)?.tiles.map((t) => t.key) || [];

  it('studio is the first mode', () => {
    expect(WORKSHOP_GROUPS[0].key).toBe('studio');
  });

  it('every gated tile lives in operate; studio and ideate are unconditional', () => {
    for (const group of WORKSHOP_GROUPS) {
      for (const tile of group.tiles) {
        if (tile.presence) expect(group.key).toBe('operate');
      }
    }
    expect(WORKSHOP_GROUPS.find((g) => g.key === 'operate').tiles.every((t) => t.presence)).toBe(true);
  });

  it('diagrams sit in studio, so the kernel capability never vanishes with ops', () => {
    expect(tileKeys(WORKSHOP_GROUPS, 'studio')).toContain('sketch');
    expect(tileKeys(WORKSHOP_GROUPS, 'operate')).not.toContain('sketch');
    // and it survives the empty-workshop case
    expect(tileKeys(visibleWorkshopGroups({ bots: 0, apps: 0, services: 0 }), 'studio')).toContain('sketch');
  });

  it('a fresh host shows only the creative + ideate modes', () => {
    const groups = visibleWorkshopGroups({ bots: 0, apps: 0, services: 0 });
    expect(keysOf(groups)).toEqual(['studio', 'ideate']);
  });

  it('unloaded presence hides gated tiles (no flash of tiles that will not stay)', () => {
    expect(keysOf(visibleWorkshopGroups(undefined))).toEqual(['studio', 'ideate']);
  });

  it('records bring their own tile back, and only their own', () => {
    const groups = visibleWorkshopGroups({ bots: 2, apps: 0, services: 0 });
    expect(keysOf(groups)).toEqual(['studio', 'ideate', 'operate']);
    expect(tileKeys(groups, 'operate')).toEqual(['bots']);
  });

  it('a null bot count (chatbot pack absent) reads as no bots', () => {
    const groups = visibleWorkshopGroups({ bots: null, apps: 1, services: 0 });
    expect(tileKeys(groups, 'operate')).toEqual(['apps']);
  });

  it('a full host shows everything', () => {
    const groups = visibleWorkshopGroups({ bots: 3, apps: 1, services: 5 });
    expect(keysOf(groups)).toEqual(['studio', 'ideate', 'operate']);
    expect(tileKeys(groups, 'operate')).toEqual(['bots', 'mcpSkills', 'apps']);
  });
});

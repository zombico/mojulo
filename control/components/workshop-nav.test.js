import { describe, it, expect } from 'vitest';

import { WORKSHOP_GROUPS, visibleWorkshopGroups } from '@/components/workshop-nav';
import { LIBRARY_SHELVES, LEGACY_ROUTE_SHELVES } from '@/lib/graph/sketch/library-shelves';

// The nav is where the 2.0 reposition is visible to a human: the making surface
// leads and is unconditional, the operational surface earns its place by having
// records. See mojulo-2.0-pure-creative.plan.md (Phase 1f).
describe('workshop nav — studio leads, the office wing is gone', () => {
  const keysOf = (groups) => groups.map((g) => g.key);
  const tileKeys = (groups, key) => groups.find((g) => g.key === key)?.tiles.map((t) => t.key) || [];

  it('studio is the first mode', () => {
    expect(WORKSHOP_GROUPS[0].key).toBe('studio');
  });

  it('no door leads to the office wing, which left with its tools in 3.1.0', () => {
    for (const group of WORKSHOP_GROUPS) {
      expect(group.key).not.toBe('operate');
      for (const tile of group.tiles) {
        expect(tile.presence).toBeUndefined();
        expect(tile.href).not.toMatch(/^\/(apps|mcp-skills|map|graph)(\/|$)/);
      }
    }
    expect(tileKeys(visibleWorkshopGroups({ apps: 0, services: 0 }), 'studio')).toContain('library');
  });

  it('every studio tile points at a route that still exists after the Library fold', () => {
    const folded = Object.keys(LEGACY_ROUTE_SHELVES);
    for (const tile of WORKSHOP_GROUPS.find((g) => g.key === 'studio').tiles) {
      expect(folded, `${tile.key} → ${tile.href}`).not.toContain(tile.href);
    }
  });

  it('the Render Bay is a studio door, and /outputs is one too', () => {
    const studio = tileKeys(WORKSHOP_GROUPS, 'studio');
    expect(studio).toContain('renderBay');
    expect(studio).toContain('outputs');
  });

  it('a fresh host shows only the creative + ideate modes', () => {
    const groups = visibleWorkshopGroups({ apps: 0, services: 0 });
    expect(keysOf(groups)).toEqual(['studio', 'ideate']);
  });

  it('unloaded presence hides gated tiles (no flash of tiles that will not stay)', () => {
    expect(keysOf(visibleWorkshopGroups(undefined))).toEqual(['studio', 'ideate']);
  });

  it('records bring no door back: apps and services counts show the same two modes', () => {
    expect(keysOf(visibleWorkshopGroups({ apps: 2, services: 5 }))).toEqual(['studio', 'ideate']);
  });

  // 3.0: the chatbot factory is its own project, and its pages left the dashboard with it.
  // A host with bots deployed from 2.x still has deployment rows, so a bots count (from an
  // older presence route) must not bring a door back to a page that no longer exists.
  it('bots have no door: a bots count brings no tile back', () => {
    for (const group of WORKSHOP_GROUPS) {
      for (const tile of group.tiles) {
        expect(tile.key).not.toBe('bots');
        expect(tile.href).not.toMatch(/^\/(bots|bot-factory|chat-builder|data)(\/|$)/);
      }
    }
    expect(keysOf(visibleWorkshopGroups({ bots: 3, apps: 0, services: 0 }))).toEqual(['studio', 'ideate']);
  });

});

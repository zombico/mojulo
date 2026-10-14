import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

import { WORKSHOP_GROUPS, visibleWorkshopGroups, DOOR_ICONS } from '@/components/workshop-nav';
import { LIBRARY_SHELVES, LEGACY_ROUTE_SHELVES } from '@/lib/graph/sketch/library-shelves';
import { ICON_DOTS } from '@/lib/brand/icon-dots';

// The nav names what the agent makes by what it is, never by the tool that makes it. Make leads; every door lands on
// a page that exists; every door's face is baked; nothing leads to a wing that left.
const tiles = WORKSHOP_GROUPS.flatMap((g) => g.tiles);
const keysOf = (groups) => groups.map((g) => g.key);
const tileKeys = (key) => WORKSHOP_GROUPS.find((g) => g.key === key)?.tiles.map((t) => t.key) || [];
const APP = path.resolve(__dirname, '..', 'app');

describe('workshop nav — by rail type', () => {
  it('make leads, and its doors are what is made: worlds, places, characters, objects, then the whole library', () => {
    expect(keysOf(WORKSHOP_GROUPS)).toEqual(['make', 'media', 'play', 'ideate']);
    expect(tileKeys('make')).toEqual(['worlds', 'places', 'characters', 'objects', 'library']);
    expect(tileKeys('play')[0]).toBe('play');
  });

  it('every door lands on a page that exists, a shelf on a shelf the library has', () => {
    const shelves = LIBRARY_SHELVES.map((s) => s.key);
    for (const t of tiles) {
      const [route, query] = t.href.split('?');
      expect(existsSync(path.join(APP, route, 'page.jsx')), `${t.key} → ${route}`).toBe(true);
      if (query) expect(shelves, t.href).toContain(new URLSearchParams(query).get('shelf'));
      expect(Object.keys(LEGACY_ROUTE_SHELVES), t.href).not.toContain(route);
    }
  });

  it('every door\'s face is a component and a baked lattice', () => {
    for (const t of tiles) {
      expect(DOOR_ICONS[t.icon], t.icon).toBeTypeOf('function');
      expect(ICON_DOTS[t.icon], t.icon).toBeTruthy();
    }
  });

  it('no door is a tool or a wing that left: no game projects, no arcade, no office, no bots', () => {
    for (const t of tiles) {
      expect(['games', 'arcade', 'apps', 'mcpSkills', 'bots']).not.toContain(t.key);
      expect(t.href).not.toMatch(/^\/(apps|mcp-skills|map|graph|arcade|maker\/games|bots|bot-factory|chat-builder|data)(\/|$|\?)/);
      expect(t.presence).toBeUndefined();
    }
  });

  it('no door is gated: any presence shows every mode', () => {
    for (const p of [undefined, {}, { apps: 2, services: 5, bots: 3 }]) expect(keysOf(visibleWorkshopGroups(p))).toEqual(keysOf(WORKSHOP_GROUPS));
  });
});

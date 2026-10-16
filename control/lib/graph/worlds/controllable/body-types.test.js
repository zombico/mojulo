// The body-type list is the page's: every type the World page's body switch draws is on it, and every type on it is
// one the page draws, one world-scene lowers to one it draws (glyph), or one that is behaviour only (none, platform).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BODY_TYPES, BODY_TYPE_NAMES, bodyTypeErrors, heroRefError } from './body-types.js';

const channel = readFileSync(join(process.cwd(), 'lib/graph/scene/channels/controllable/index.js'), 'utf8');
const drawn = [...new Set([...channel.matchAll(/\bb\.type [!=]== '([a-z0-9-]+)'/g)].map((m) => m[1]))];

describe('BODY_TYPES', () => {
  it('holds every type the page draws, and nothing it neither draws, lowers nor uses', () => {
    expect(drawn.length).toBeGreaterThan(0);
    for (const t of drawn) expect(BODY_TYPE_NAMES, `the page draws '${t}'`).toContain(t);
    const notDrawn = BODY_TYPE_NAMES.filter((t) => !drawn.includes(t)).sort();
    expect(notDrawn).toEqual(['glyph', 'none', 'platform']);
    for (const t of BODY_TYPE_NAMES) expect(typeof BODY_TYPES[t]).toBe('string');
  });

  it('bodyTypeErrors passes every listed type and a typeless body, refuses the rest', () => {
    expect(bodyTypeErrors(BODY_TYPE_NAMES.map((type, i) => ({ id: `e${i}`, body: { type } })))).toEqual([]);
    expect(bodyTypeErrors([{ id: 'a' }, { id: 'b', body: {} }, null])).toEqual([]);
    expect(bodyTypeErrors(undefined)).toEqual([]);
    const errs = bodyTypeErrors([{ id: 'x', body: { type: 'zzzbogus' } }, { id: 'y', body: { type: 7 } }]);
    expect(errs).toHaveLength(2);
    expect(errs[0]).toContain(BODY_TYPE_NAMES.join(', '));
  });

  it('heroRefError takes a hero and a mascot, and names why anything else is not a pilot', () => {
    expect(heroRefError('h', 'r', { manifest: { kind: 'layered', hero: {} } })).toBeNull();
    expect(heroRefError('h', 'r', { manifest: { kind: 'layered', plan: { mascot: {}, clips: { run: {} } } } })).toBeNull();
    expect(heroRefError('h', 'r', { manifest: { kind: 'animal' } })).toMatch(/animal mascot/);
    expect(heroRefError('h', 'r', { manifest: { kind: 'layered', species: 'wolf' } })).toMatch(/animal mascot/);
    expect(heroRefError('h', 'r', { manifest: { kind: 'layered', plan: {} } })).toMatch(/not a stored hero or mascot/);
    expect(heroRefError('h', 'r', null)).toMatch(/not a stored sketch/);
  });
});

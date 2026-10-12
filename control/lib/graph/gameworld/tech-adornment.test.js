import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildAdorned, suggestAdornment, adornManifest, ADORNMENT_PIECES } from './tech-adornment.js';
import { chassisManifest } from './tech-chassis.js';
import { craftTech } from './tech-crafter.js';
import { ROLES } from '../era/blocks.js';

const thing = (kind, intent) => ({ ...craftTech(kind, intent).plan, intent });
const WALKER = thing('vehicle', 'an armoured walker'), MAST = thing('structure', 'a tall lattice relay tower beacon'), LIGHT = thing('structure', 'a lighthouse');

describe('the adornment', () => {
  it('its rules read sockets by face and mass, functions, rank and motif: no form, no socket by name', () => {
    const src = readFileSync(new URL('./tech-adornment.js', import.meta.url), 'utf8');
    expect(src).not.toMatch(/t\.form/);
    // ('turret' is a piece, a gun on a ring, as well as a form: the forms checked are the ones only a form is)
    for (const form of ['walker', 'tower', 'ship', 'gate', 'tracked', 'hover']) expect(src, form).not.toMatch(new RegExp(`'${form}'`));
    for (const name of ['side-l', 'deck-2', 'hip-b']) expect(src, name).not.toContain(name);
    for (const [id, p] of Object.entries(ADORNMENT_PIECES)) { expect(ROLES, id).toContain(p.role); expect(Array.isArray(p.serves), id).toBe(true); }
  });

  it('a proposal with its reasons: what was promised first, then the face of what moves, then its back; the motif adds its own', () => {
    const c = chassisManifest(WALKER, { kind: 'vehicle' });
    const smooth = suggestAdornment(c, WALKER, { motif: 'smooth', rank: 'focus' }), riveted = suggestAdornment(c, WALKER, { motif: 'riveted', rank: 'focus' });
    expect(smooth[0]).toMatchObject({ piece: 'plate', serves: ['guard'] });
    expect(smooth.map((p) => p.piece)).toEqual(expect.arrayContaining(['visor', 'eye', 'vents', 'pipes']));
    expect(riveted.map((p) => p.piece)).toContain('rivets');
    for (const p of smooth) expect(p.why).toBeTruthy();
    expect(suggestAdornment(c, WALKER, { motif: 'smooth', rank: 'prop' }).length).toBeLessThan(smooth.length);
    // a thing that does not move has no face to be read by
    const turret = thing('weapon', 'a turret'), ct = chassisManifest(turret, { kind: 'weapon' });
    expect(suggestAdornment(ct, turret, { rank: 'focus' }).map((p) => p.piece)).not.toContain('visor');
  });

  it('the walker keeps its promise and holds; the status light is the one accent', () => {
    const a = buildAdorned(WALKER, { kind: 'vehicle', direction: { motif: 'smooth' }, rank: 'focus' });
    expect(a.held, JSON.stringify(a.laws.filter((l) => !l.ok))).toBe(true);
    expect(a.functions).toEqual(expect.arrayContaining(['move', 'guard']));
    expect(new Set(a.faces.filter((f) => f.group === 'str:accent').map((f) => f.piece)).size).toBe(1);
  }, 30000);

  it('a lighthouse is crowned by its lantern at its topmost face; a relay mast hangs antennas from its crown mass', () => {
    const l = buildAdorned(LIGHT, { kind: 'structure', direction: { motif: 'ornate' }, rank: 'focus' });
    const top = Math.max(...l.sockets.filter((s) => s.face === 'top').map((s) => s.at[2]));
    expect(l.sockets.find((s) => s.id === l.picks.find((p) => p.piece === 'lantern').socket).at[2]).toBe(top);
    expect(l.functions).toContain('light');
    const m = buildAdorned(MAST, { kind: 'structure', direction: { motif: 'riveted' }, rank: 'focus' });
    expect(m.picks.filter((p) => p.piece === 'antenna').every((p) => p.socket.startsWith('deck-'))).toBe(true);
    for (const x of [l, m]) expect(x.held, JSON.stringify(x.laws.filter((y) => !y.ok))).toBe(true);
  }, 60000);

  it('a brief that cannot hold names its conflict and what would settle it, rather than swing', () => {
    const a = buildAdorned(thing('vehicle', 'a cargo walker'), { kind: 'vehicle', direction: { motif: 'smooth', camera: 'first-person' }, rank: 'interactable' });
    expect(a.held).toBe(false);
    expect(a.conflict).toMatchObject({ laws: ['facets', 'hero-leads'] });
    expect(a.conflict.proposal).toMatch(/a louder rank \(focus\)/);
  }, 30000);

  it('given picks are hung as given, and the same every time', () => {
    const c = chassisManifest(WALKER, { kind: 'vehicle' }), front = c.sockets.find((s) => s.mass === 'core' && s.face === 'front');
    const A = adornManifest(c, [{ piece: 'eye', socket: front.id, serves: ['sense'] }]);
    expect(A.lathes.map((x) => x.id)).toEqual([`eye-ring-${front.id}`, `eye-${front.id}`]);
    const side = c.sockets.find((s) => s.mass === 'core' && s.face === 'side');
    expect(buildAdorned(WALKER, { kind: 'vehicle', picks: [{ piece: 'plate', socket: side.id, serves: ['guard'] }] }).picks).toHaveLength(1);
    expect(JSON.stringify(buildAdorned(WALKER, { kind: 'vehicle' }))).toBe(JSON.stringify(buildAdorned(WALKER, { kind: 'vehicle' })));
  }, 30000);
});

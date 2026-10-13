import { describe, it, expect } from 'vitest';
import { buildAdorned, suggestAdornment, leadSide, adornManifest } from './tech-adornment.js';
import { chassisManifest } from './tech-chassis.js';
import { craftTech } from './tech-crafter.js';
import { readTechDirection, resolveTechDirection, ASYMMETRY_WORDS } from './tech-direction.js';
import { TECH_STYLES } from './tech-eras.js';
import { gearStyle } from './world-gear.js';
import { readGameworld } from './index.js';

const thing = (kind, intent) => ({ ...craftTech(kind, intent).plan, intent });
const W = (T) => ({ id: 'w', civilizations: { folk: { technology: T } }, levels: { a: { walk: { nodes: [{ id: 'n' }] } } }, start: 'a' });

describe('asymmetry: one flank carries more, the other its colours', () => {
  it('a direction says how lopsided, by number or word; the style says it otherwise', () => {
    expect(TECH_STYLES.wc3.asymmetry).toBe(0.4);
    expect(readTechDirection({ asymmetry: 'lopsided' })).toEqual({ asymmetry: ASYMMETRY_WORDS.lopsided });
    expect(readTechDirection({ asymmetry: 0 })).toEqual({ asymmetry: 0 });
    expect(() => readTechDirection({ asymmetry: 2 })).toThrow(/asymmetry is 0–1/);
  });

  it('a thing leans away from a weapon on its flank; else the same way its words always fall', () => {
    const t = thing('vehicle', 'a war chariot'), c = chassisManifest(t, { kind: 'vehicle', setting: { made: 'timber-and-rope', driven: 'muscle' } });
    const picks = suggestAdornment(c, t, { rank: 'focus' }), rack = picks.find((p) => p.piece === 'rack');
    const side = Math.sign(c.sockets.find((s) => s.id === rack.socket).normal[1]);
    expect(leadSide(c, picks, t.intent)).toMatchObject({ lead: -side, why: expect.stringMatching(/counterweight/) });
    const w = thing('vehicle', 'an armoured walker'), cw = chassisManifest(w, { kind: 'vehicle' });
    expect(leadSide(cw, [], w.intent)).toEqual(leadSide(cw, [], w.intent));
  });

  it('past half, the armour goes to one flank; the colour wraps the other: a sash, or a band all round when even', () => {
    const t = thing('vehicle', 'an armoured walker'), c = chassisManifest(t, { kind: 'vehicle' });
    const flanks = (a) => suggestAdornment(c, t, { rank: 'focus', asymmetry: a, lead: 1 }).filter((p) => p.piece === 'plate' && c.sockets.find((s) => s.id === p.socket).face === 'side');
    expect(flanks(0.2)).toHaveLength(2);
    expect(flanks(0.6)).toHaveLength(1);
    expect(Math.sign(c.sockets.find((s) => s.id === flanks(0.6)[0].socket).normal[1])).toBe(1);
    const liv = (a) => adornManifest(c, [{ piece: 'livery', socket: c.sockets.find((s) => s.face === 'top').id, serves: [] }], { asymmetry: a, lead: 1 }).extrudes[0].profile.points;
    // all round: the outline grown; lopsided: a crescent on the open flank (−y, away from the armour's lead)
    expect(Math.min(...liv(0).map((q) => q[0]))).toBeLessThan(0);
    expect(Math.max(...liv(0).map((q) => q[0]))).toBeGreaterThan(0);
    expect(Math.max(...liv(0.7).map((q) => q[0]))).toBeLessThan(Math.max(...liv(0).map((q) => q[0])) * 0.3);
  });

  it('every swept thing still holds at the style\'s lean; the result says how it leaned and why', () => {
    const a = buildAdorned(thing('vehicle', 'a battle tank'), { kind: 'vehicle', direction: { asymmetry: 0.8 }, rank: 'focus', use: 'driven' });
    expect(a.held).toBe(true);
    expect(a.asymmetry).toMatchObject({ amount: 0.8, lead: expect.stringMatching(/left|right/) });
    expect(a.picks.map((p) => p.piece)).toContain('livery');
  });

  it('a lopsided civilization\'s blades are single-edged', () => {
    const G = (a) => readGameworld(W({ direction: { asymmetry: a }, weapons: { blade: 'a sword' } }));
    expect(gearStyle(G(0.6), 'folk').card.edge.single).toBe(true);
    expect(gearStyle(G(0.1), 'folk').card.edge.single).toBeUndefined();
    expect(resolveTechDirection(G(0.6), 'folk').ledger).toContainEqual(expect.objectContaining({ key: 'asymmetry', local: 0.6 }));
  });
});

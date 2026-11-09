import { describe, it, expect } from 'vitest';
import { ORDNANCE, ORDNANCE_NAMES, measureOrdnance } from './ordnance.js';
import { strike, penetration, breachCharge, measureTerminal, terminalLaws, STANDS } from './terminal.js';

// THE MATTER ANSWERING (terminal.js): what each round does to each stand, from the round's numbers and the matter's,
// seen plausibly. One round per law's procedure, chosen from the table by what it is: a kinetic rod, a shaped charge, a
// direct blast shell, the indirect shell; each measured at its own bands from its flight on the runtime.
const pick = (f) => ORDNANCE_NAMES.find((n) => f(ORDNANCE[n]));
const rod = pick((o) => o.rod), jet = pick((o) => o.jet), blast = pick((o) => !o.rod && !o.jet && !o.indirect), high = pick((o) => o.indirect);

describe('the matter answering', () => {
  const by = Object.fromEntries([rod, jet, blast, high].map((w) => [w, measureTerminal(w, measureOrdnance(w, { mount: ORDNANCE[w].indirect ? 'howitzer' : 'battle-tank' }))]));
  it('every law holds over a rod, a jet, a blast shell and the indirect shell', () => {
    expect(terminalLaws(by).filter((l) => !l.ok).map((l) => `${l.name} ${JSON.stringify(l.info ?? '')}`)).toEqual([]);
  });
  it('a plate at an angle is its thickness over the angle\'s cosine; a shaped charge stopped by the slope that a square plate lets through', () => {
    const square = strike(jet, { v: 1000 }, { matter: 'armour-steel', thickness: 0.3 }), slope = strike(jet, { v: 1000 }, { matter: 'armour-steel', thickness: 0.3, angle: 60 });
    expect(square.perforated).toBe(true); expect(slope.perforated).toBe(false);
    expect(slope.effective).toBeCloseTo(0.6, 9);
  });
  it('the breaching charge grows as the cube of the wall and by its material; a shell breaches what its filler outweighs', () => {
    expect(breachCharge('brick', 0.6) / breachCharge('brick', 0.3)).toBeCloseTo(8, 9);
    expect(breachCharge('reinforced-concrete', 0.5)).toBeCloseTo(2 * breachCharge('concrete', 0.5), 9);
    const W = ORDNANCE[blast].filler, thin = 0.3048 * Math.cbrt(W / (0.4536 * 0.23 * 3.6)) * 0.9;
    expect(strike(blast, { v: 800 }, { matter: 'brick', thickness: thin }).effect).toBe('breach');
    expect(strike(blast, { v: 800 }, { matter: 'brick', thickness: thin * 1.3 }).effect).toBe('spall');
  });
  it('a long rod slows and cuts less; a jet cuts the same at any speed', () => {
    expect(penetration(rod, 'armour-steel', 1600)).toBeGreaterThan(penetration(rod, 'armour-steel', 1400));
    expect(penetration(jet, 'armour-steel', 1100)).toBe(penetration(jet, 'armour-steel', 600));
  });
  it('every stand is a matter rupa knows; a round or a matter it does not is named', () => {
    for (const s of STANDS) expect(() => strike(blast, { v: 800 }, s)).not.toThrow();
    expect(() => strike('nuke', { v: 1 }, STANDS[0])).toThrow(/no ordnance/);
    expect(() => strike(blast, { v: 1 }, { matter: 'adamantium', thickness: 1 })).toThrow(/no matter/);
  });
});

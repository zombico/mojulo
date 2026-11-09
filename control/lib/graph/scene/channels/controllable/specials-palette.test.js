import { describe, it, expect } from 'vitest';
import { specialsPaletteScript } from './specials-palette.js';
import { ARTESIA_ARSENAL, readArsenal, lowerArsenal } from '../../../gameworld/combos.js';

// THE SPECIALS PALETTE (specials-palette.js): the page's script run against a stubbed page (a document, a world whose hero
// plays a moveset, the input reader it wraps). Shown only while the modifier is held, each special with its buttons, its
// name and its MP; one the pool cannot pay dimmed, saying why; a hero with no specials shows nothing.
const page = (M, { mp = 100 } = {}) => {
  const els = [], document = { createElement: () => { const el = { style: {}, innerHTML: '' }; els.push(el); return el; }, body: { appendChild() {} } };
  const hero = { rule: { moveset: M }, mp, mv: {} }, world = { pilotId: 'p', time: 0, byId: { p: hero } };
  const window = { __mojCtrl: { label: (id) => ({ modifier: 'RT', light: 'X', heavy: 'Y', special: 'B' })[id] } };
  let held = 0;
  // eslint-disable-next-line no-new-func
  const read = new Function('document', 'window', '__world', 'base', `let __readInput = base;\n${specialsPaletteScript()}\nreturn () => __readInput();`)(document, window, world, () => ({ mod: held }));
  return { els, hero, step: (mod) => { held = mod; read(); } };
};
describe('the specials palette', () => {
  const M = lowerArsenal(readArsenal(ARTESIA_ARSENAL))[0].moveset;
  it('the moveset carries its specials: each root special beat\'s move, name and MP', () => {
    expect(M.specials).toEqual({ mL: { move: 'leap-strike', name: 'Leaping strike' }, mH: { move: 'rising-slash', name: 'Rising slash' }, mS: { move: 'fire-burst', name: 'Fire burst', mp: 50 } });
  });
  it('shows while the modifier is held, each special with its buttons, its name and its cost, and the pool; hides when let go', () => {
    const P = page(M);
    P.step(0);
    expect(P.els).toHaveLength(0);
    P.step(1);
    const el = P.els[0];
    expect(el.style.display).toBe('flex');
    for (const s of ['RT + X', 'Leaping strike', 'RT + Y', 'Rising slash', 'RT + B', 'Fire burst', '50 MP', 'free', 'MP <b>100</b> / 100']) expect(el.innerHTML).toContain(s);
    P.step(0);
    expect(el.style.display).toBe('none');
  });
  it('a special the pool cannot pay is dimmed and says why', () => {
    const P = page(M, { mp: 20 });
    P.step(1);
    expect(P.els[0].innerHTML).toContain('50 MP · MP 20 / 50');
    expect(P.els[0].innerHTML).toContain('opacity:0.55');
  });
  it('a hero with no specials draws nothing, the modifier held or not', () => {
    const { specials: _s, ...plain } = M;
    const P = page(plain);
    P.step(1);
    expect(P.els).toHaveLength(0);
  });
});

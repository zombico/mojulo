// The historic culture checklist: what every registered culture must hold, at whatever depth it is built, so a
// new one (scaffolded by scripts/new-culture.mjs, or a branch landing on the trunk) is wired before it ships.
// The entry's own contract (what a card must say) is in entries.test.js.
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { HISTORIC_CULTURES } from './cultures/index.js';
import { FORMS } from './form/towns.js';
import { HISTORIC_STYLES } from './style/index.js';
import { planHistoricCity } from './historic-city.js';
import { cultureDepth, depthText } from './depth.js';
import { entryCard } from './entries.js';


describe('the historic culture checklist', () => {
  it("every culture's town has a form: its own, or the one its card names", () => {
    for (const [id, K] of Object.entries(HISTORIC_CULTURES)) expect(!!FORMS[id] || !!FORMS[K.form], `${id}: no form in form/towns.js, and its card names none`).toBe(true);
  });

  it('every style card belongs to a registered culture', () => {
    for (const id of Object.keys(HISTORIC_STYLES)) expect(HISTORIC_CULTURES[id], `style card '${id}' has no culture`).toBeTruthy();
  });

  it('every culture has a depth, and its entry says it', () => {
    for (const id of Object.keys(HISTORIC_CULTURES)) {
      const d = cultureDepth(id);
      expect([0, 1, 2, 3], id).toContain(d.depth);
      expect(entryCard(id).body, id).toContain(`DEPTH      ${depthText(id)}`);
    }
  });

  it('finds depth, never claims it: the polis is Lindos’s record, kit and form under its own style card', () => {
    expect(cultureDepth('polis')).toEqual({ depth: 0, owns: ['style'], borrows: { record: 'lindos', assets: 'lindos', form: 'lindos' } });
    expect(cultureDepth('thebes').depth).toBe(3);
  });

  it('a card spread from a culture, naming its form, is laid out under a new id (depth 0 works on any of them)', () => {
    const like = Object.keys(FORMS)[0];
    HISTORIC_CULTURES.depth0 = { ...HISTORIC_CULTURES[like], form: like, label: 'Depth zero', record: null };
    try {
      const plan = planHistoricCity({ culture: 'depth0', seed: 3 });
      expect(plan.stats.culture).toBe('depth0');
      expect(plan.boxes.length).toBeGreaterThan(0);
      expect(cultureDepth('depth0').borrows.form).toBe(like);
    } finally { delete HISTORIC_CULTURES.depth0; }
  }, 120_000);

  it('refuses a card that names no form it can be laid out by', () => {
    HISTORIC_CULTURES.nowhere = { ...HISTORIC_CULTURES.polis, form: 'floating-islands' };
    try { expect(() => planHistoricCity({ culture: 'nowhere' })).toThrow(/nowhere has no form, and its card names none/); }
    finally { delete HISTORIC_CULTURES.nowhere; }
  });
});

describe('the scaffold (scripts/new-culture.mjs, dry)', () => {
  const run = (...a) => execFileSync('node', ['scripts/new-culture.mjs', ...a], { encoding: 'utf8' });
  it('writes a depth-0 card that names every contract line, and registers it', () => {
    const out = run('testland', '--like', 'polis', '--label', 'Testland', '--years', '-500,-300', '--period', 'Classical',
      '--place', 'Testland, the coast', '--region', 'greece', '--aliases', 'testland,test town', '--dry');
    expect(out).toMatch(/import \{ POLIS \} from '\.\/lindos\.js';/);
    expect(out).toMatch(/\.\.\.POLIS,/);
    for (const line of ['label:', 'years: \\[-500, -300\\]', 'readAt: null', "period: 'Classical'", 'place:', "region: 'greece'", 'aliases:', 'record: null', 'land: null', "form: POLIS.form \\?\\? 'polis'"])
      expect(out).toMatch(new RegExp(`\\n  ${line}`));
    expect(out).toMatch(/import \{ TESTLAND \} from '\.\/testland\.js';\n {2}testland: TESTLAND,/);
  });

  it('refuses what it cannot write honestly', () => {
    const fails = (...a) => { try { run(...a); return null; } catch (e) { return String(e.stderr); } };
    expect(fails('thebes', '--like', 'sumer')).toMatch(/already a culture/);
    expect(fails('x', '--like', 'atlantis')).toMatch(/one of sumer, thebes/);
    expect(fails('x', '--like', 'polis', '--label', 'X', '--years', '-1,-2', '--period', 'p', '--place', 'q', '--region', 'r', '--aliases', 'abc')).toMatch(/from ≤ to/);
    expect(fails('x', '--like', 'polis', '--label', 'X', '--years', '-2,-1', '--period', 'p', '--region', 'r', '--aliases', 'abc')).toMatch(/--place/);
  });
});

// Lost Nomad's template movie: three set-piece levels in order, Tariq its star, laid for a locked pitch on its rail
import { describe, it, expect } from 'vitest';
import { lostNomadWorld, lostNomadStart, REEL, TARIQ } from './lost-nomad.js';
import { readGameworld } from './index.js';
import { gameStages, stageLevelOrder } from './levels.js';
import { composeHero } from './hero-looks.js';
import { pitchStart } from './pitch-start.js';
import { validateHeroSpec } from '../../mcp/tools/layered.js';

describe('the template movie', () => {
  it('is a designed world of its reel\'s set pieces, in order, each line named for its level', () => {
    const W = lostNomadWorld(), G = readGameworld(W), stages = gameStages(W);
    expect(stages.map((s) => [s.level, s.section])).toEqual(REEL.map(([id]) => [id, 'stunt']));
    expect(G.links.map((l) => [l.from, l.to])).toEqual([['souk', 'tower'], ['tower', 'cliffs'], ['cliffs', 'convoy']]);
    stages.forEach((st, i) => {
      const O = stageLevelOrder(G, st, { ref: `lv_${i}`, heroRef: 'gw-hero' });
      expect(O.args.manifest.chase.lines[0].id).toBe(st.level);
      expect(O.laws.filter((l) => !l.ok), st.level).toEqual([]);
    });
  });

  it('stars Tariq: his looks compose into his spec, which the hero door takes', () => {
    const H = composeHero(readGameworld(lostNomadWorld()));
    expect(H.unread).toEqual([]);
    const { dials: _d, ...outfit } = H.spec.outfit;
    expect({ cast: H.spec.cast, form: H.spec.form, face: H.spec.face, hair: H.spec.hair.style, outfit }).toEqual({ cast: TARIQ.cast, form: TARIQ.form, face: TARIQ.face, hair: TARIQ.hair, outfit: TARIQ.outfit });
    expect(validateHeroSpec(JSON.parse(JSON.stringify(H.spec)))).toEqual([]);
  });

  it('is laid under a locked pitch on its rail, the person\'s own words winning; never over levels written', () => {
    const P = pitchStart({ name: 'Desert Run', rail: { from: 'lost-nomad', locked: true } });
    expect(P.laid).toMatchObject({ by: 'lost-nomad', levels: REEL.map(([id]) => id) });
    expect(P.world.name).toBe('Desert Run');
    expect(P.world.feel).toBe('lost-nomad');
    expect(lostNomadStart({ levels: { a: {} } })).toBeNull();
  });
});

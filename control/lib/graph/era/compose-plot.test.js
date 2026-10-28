// The light plot (compose-plot.js): the mood's ratio met at each room's focus, the fill thinned by the mood, a key only
// where the room's role asks one, in a colour of the plot's own; the mood read from the words, the darkest heard winning.
import { describe, expect, it } from 'vitest';
import { MOODS, MOOD_IDS, LIGHT_PLOT, plotLights } from './compose-plot.js';
import { readCompose } from './compose.js';
import { PLOTS } from './style/bay-axes.js';
import { assembleStageScene, planStage, buildStageGeometry, resolveStageLights } from './stage.js';

const SUITE = { kind: 'stage', kit: 'bay-military', rooms: [{ id: 'low', x: 0, y: 0, w: 6, d: 12, h: 3.5 }, { id: 'tall', x: -6, y: 12, w: 18, d: 30, h: 12 }], links: [{ from: 'low', to: 'tall' }] };
// (the plot over the stage's own placed lights, as the assemble lays it)
const scene = (compose) => { const plan = planStage({ ...SUITE, compose }), { lights, plot } = plotLights(plan, resolveStageLights(plan, buildStageGeometry(plan).seats)); return { lights, compose: { ...plan.compose, plot } }; };
const keyed = (S) => S.lights.filter((l) => l.fixture === 'key');

describe('the light plot', () => {
  it('each room\'s focus lit at its mood\'s ratio over the room, by its role\'s weight; a darker mood, a steeper ratio', () => {
    const ratios = MOOD_IDS.map((mood) => {
      const S = scene({ mood });
      for (const p of S.compose.plot.filter((x) => x.ratio !== null && !x.short)) {
        expect(p.target, `${mood} ${p.room}`).toBe(Math.max(1, MOODS[mood].ratio * LIGHT_PLOT.roles[p.role]));
        expect(Math.abs(p.ratio - p.target) / p.target, `${mood} ${p.room}`).toBeLessThan(0.01);
      }
      return S.compose.plot.find((p) => p.role === 'landmark').ratio;
    });
    expect([...ratios].sort((a, b) => a - b)).toEqual(ratios);
  });

  it('the fill thinned by the mood; a key only where a role asks one, in a colour of the plot\'s own', () => {
    const dark = MOOD_IDS.at(-1), S = scene({ mood: dark }), B = scene({ mood: MOOD_IDS[0] });
    const fill = (X) => X.lights.filter((l) => l.fixture !== 'key');
    expect(fill(S)[0].intensity / fill(B)[0].intensity).toBeCloseTo(MOODS[dark].fill / MOODS[MOOD_IDS[0]].fill, 3);
    expect(keyed(S).length).toBe(S.compose.plot.filter((p) => LIGHT_PLOT.roles[p.role] > 0).length);
    const colours = LIGHT_PLOT.colours.map((k) => PLOTS[S.compose.axes.plot].light[k]?.color);
    for (const k of keyed(S)) expect(colours).toContain(k.color);
    // a still room takes none
    const rest = scene({ mood: dark, roles: { tall: 'rest' } });
    expect(rest.compose.plot.find((p) => p.room === 'tall').ratio).toBeNull();
    expect(keyed(rest).length).toBe(keyed(S).length - 1);
  });

  it('a stage not composed is lit as it was; a composed one reports its plot', () => {
    const plan = planStage(SUITE), bare = assembleStageScene(SUITE, {});
    expect('compose' in bare).toBe(false);
    expect(bare.lights.length).toBe(resolveStageLights(plan, buildStageGeometry(plan).seats).length);
    expect(assembleStageScene({ ...SUITE, compose: 'a hangar' }, {}).compose.plot.length).toBe(SUITE.rooms.length);
  });
});

describe('the mood read from the words', () => {
  it('a mood\'s word names it; the darkest heard wins; none said is even; a pinned one is kept', () => {
    const [light, , dark] = MOOD_IDS;
    expect(readCompose(`a ${MOODS[dark].words[0]} lab`).resolved.mood).toBe(dark);
    expect(readCompose(`a ${MOODS[light].words[0]} but ${MOODS[dark].words[1]} lab`).resolved.mood).toBe(dark);
    expect(readCompose('a lab').resolved.mood).toBe('even');
    expect(readCompose({ words: `a ${MOODS[dark].words[0]} lab`, mood: light }).resolved.mood).toBe(light);
    expect(() => readCompose({ mood: 'grim' })).toThrow(/compose.mood is/);
  });
});

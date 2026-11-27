/**
 * The static world WHOLE in the hour's map (cast-shadows.js liveShadowScript `whole`, a city's: geocity/scene.js
 * SHADOW_FIT): a page shows its street's kit by tiles near the eye, so on the frame the hour's map is drawn every static
 * solid is shown, and hidden again after it; and the near vehicles cast into the actors' map (flow.js `cast`). Neither
 * adds a byte to a page that does not ask.
 */
import { describe, expect, it } from 'vitest';

import { liveShadowScript } from './cast-shadows.js';
import { flowChannelScript } from './flow.js';

const cfg = (o) => ({ mapSize: 1024, toLight: [-0.5, -0.5, 0.7], alpha: 0.38, span: 16, ...o });

describe('a city\'s things cast', () => {
  it('the hour\'s map holds every static solid, shown or not, on the frame it is drawn; none asked, not a byte', () => {
    const plain = liveShadowScript(cfg({ actors: true, hour: true })), whole = liveShadowScript(cfg({ actors: true, hour: true, whole: true }));
    expect(plain).not.toContain('__hrShown');
    expect(whole).toContain('if (__hrArmed && !__hrShown) { __hrShown = []; for (const o of __csStatic) if (!o.visible)');
    expect(whole).toContain('for (const o of __hrShown) o.visible = false;');
    // (its own depth bias, metres, where the page gives one)
    expect(liveShadowScript(cfg({ hour: true, hourBias: 0.6 }))).toContain('"hourBias":0.6');
  });
  it('the near vehicles cast into the actors\' map when the page has one; none, not a byte', () => {
    const flow = { T: {}, signals: [], near: 320, kinds: [{ model: 'box', len: 4.8 }], tints: [[0.5, 0.1, 0.1]], lanes: [], cars: [] };
    expect(flowChannelScript(flow)).not.toContain('castShadow');
    expect(flowChannelScript(flow, { cast: true })).toContain('im.castShadow = true;');
  });
});

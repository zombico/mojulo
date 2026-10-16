process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { describe, it, expect } from 'vitest';
import { heroMintArgs, heroRemakeOps } from './hero-mint.js';
import { mintSolidHandler } from './mint-solid.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { HALDEN_REACH, MEADOWMARK_HERO } from '@/lib/graph/gameworld/index.js';
import { runSteps } from '@/lib/graph/gameworld/runner.js';
import { quickWorld } from '@/lib/graph/gameworld/quick.js';

const OWN_GUARD = { cast: 'male', palette: { Top: '#3a4660' }, gear: { right: { item: 'sword' } } };
import { fingerprint } from '@/lib/graph/gameworld/review.js';

const book = { ...HALDEN_REACH, characters: MEADOWMARK_HERO.characters, equipment: MEADOWMARK_HERO.equipment };
const heroStep = () => runSteps(book, { ref: 'gw' }).find((s) => s.key === 'hero');

describe('hero-mint: the one way a run mints or remakes a hero', () => {
  it('the character light reaches the door: the book\'s anime hero is stored with it', async () => {
    const { order } = heroStep();
    expect(order.mint.toon).toEqual({ light: true });
    expect(heroMintArgs(order.mint).spec.toon).toEqual({ light: true });
    expect(heroMintArgs(order.mint).toon).toBeUndefined();
    await mintSolidHandler({ ...heroMintArgs(order.mint), ref: 'hm_anime' });
    expect(SketchRepository.getByRef('hm_anime').manifest.toon).toEqual({ light: true });
  }, 180_000);

  it('a remake keeps the stored walk of a figure with no motion page, and carries the light', () => {
    const walk = { walk: { seconds: 1.1 } };
    const order = { spec: { cast: 'male' }, mint: { kind: 'layered', via: 'hero', spec: { cast: 'male' } }, motion: null };
    const ops = heroRemakeOps(order, { hero: { cast: 'male', motion: walk } });
    expect(ops[0].value.motion).toEqual(walk);
    expect(ops).toHaveLength(1);
    // nothing stored to keep: the calibrated walk, as a mint gives it
    expect(heroRemakeOps(order, null)[0].value.motion.walk).toBeTruthy();
    // a motion page follows: the base is remade as a mint makes it, not from the old motion
    const paged = heroRemakeOps({ ...order, motion: [{ op: 'set', path: '/hero/motion', value: {} }] }, { hero: { cast: 'male', motion: { jog: true } } });
    expect(paged[0].value.motion.jog).toBeUndefined();
    expect(paged[0].value.motion.walk).toBeTruthy();
    const lit = heroRemakeOps({ ...order, mint: { ...order.mint, toon: { light: true } } }, null);
    expect(lit[1]).toEqual({ op: 'set', path: '/toon', value: { light: true } });
  });

  it('an order with a light prints anew (a run remakes it once, with its light); one without prints as before', () => {
    const s = heroStep();
    expect(s.print).not.toBe(fingerprint({ spec: s.order.spec, motion: s.order.motion, toon: s.order.mint.toon }));
    // the game's own guard, unlit, prints as before
    const guard = runSteps(quickWorld({ id: 'w', quick: { goal: 'sneak', guard: OWN_GUARD } }), { ref: 'q' }).find((x) => x.key === 'guard');
    expect(guard.order.spec).toEqual(OWN_GUARD);
    expect(guard.print).toBe(fingerprint({ spec: OWN_GUARD, toon: null }));
    // one rolled in an anime game's setting (cast-setting.js) carries the character light, and prints with it
    const rolled = runSteps(quickWorld({ id: 'w', quick: { goal: 'sneak' } }), { ref: 'q' }).find((x) => x.key === 'guard');
    expect(rolled.order.mint.toon).toEqual({ light: true });
    expect(rolled.print).toBe(fingerprint({ spec: rolled.order.spec, light: { light: true } }));
  }, 120_000);
});

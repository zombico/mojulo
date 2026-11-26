import { describe, expect, it } from 'vitest';

import { STRIKE_ZONES, zoneOf, zoneAim, zoneBand } from './zones.js';
import { HERO } from './vocab.js';
import { swingClipKeys } from '../polygonizer/hero-swing.js';
import { aimSwingKeys } from '../polygonizer/hero-swing-body.js';
import { composeLive } from '../worlds/controllable/compose.js';
import { FOE_CLASSES } from './index.js';
import { ATTACKS } from './vocab.js';
import { resolveFoe } from './resolve.js';

describe('the strike zone: where on the hero a foe\'s blow goes, by how tall it stands', () => {
  it('a body well under the hero goes for the legs, one its height the body, one well over it from above', () => {
    expect(zoneOf(HERO.height * 0.6)).toBe('legs');
    expect(zoneOf(HERO.height)).toBe('body');
    expect(zoneOf(HERO.height * 1.5)).toBe('high');
    expect(zoneBand('legs')[1]).toBeLessThan(zoneBand('body')[1]);
  });

  it('the legs are cut from one side then the other, stepping in, as a string', () => {
    const W = STRIKE_ZONES.legs.words;
    expect(W.left).not.toBe(W.right);
    expect(STRIKE_ZONES.legs.moves).toMatchObject({ combo: true });
    expect(STRIKE_ZONES.legs.moves.lunge).toBeGreaterThan(0);
  });

  it('a shorter body drops its arm less to reach the same legs; the aimed swing strikes at that angle, its shape kept', () => {
    const small = zoneAim(HERO.height * 0.55, HERO, 'legs'), mid = zoneAim(HERO.height * 0.75, HERO, 'legs');
    expect(small.drop).toBeLessThan(mid.drop);
    const keys = swingClipKeys('forehand', 'normal'), aimed = aimSwingKeys(keys, { pitch: 90 - mid.drop, sink: mid.sink, bend: mid.bend });
    const n = keys.length;
    expect(aimed[n - 3].shR.pitch).toBeCloseTo(90 - mid.drop, 6);
    expect(aimed[n - 3].shR.yaw).toBe(keys[n - 3].shR.yaw);
    expect(aimed[n - 3].crouch).toBeGreaterThan(keys[n - 3].crouch);
    expect(aimed[0]).toBe(keys[0]);
    expect(aimSwingKeys(keys, null)).toBe(keys);
  });

  it('its step in stops where its weapon connects (`strikeLungeStop`), never in the hero\'s lap; absent, at half its reach', () => {
    const E = composeLive(), DT = 1 / 60;
    // (one that swings and chases, picked in code: it closes on a hero who stands still and strikes)
    const c = Object.values(FOE_CLASSES).find((k) => ATTACKS[k.attack.kind].verb === 'melee' && k.move === 'chase'), f = resolveFoe({ class: c.id });
    const closest = (slot) => {
      const foe = { id: 'f', team: 'foes', rule: { ...f.entity.rule, eye: 0, collideRadius: 0.3, collideHeight: 1.1, speed: 3, loadout: [{ ...f.entity.rule.loadout[0], strikeReach: 1, strikeLunge: 1.6, ...slot }] }, body: { type: 'none', hittable: true, hp: 50 }, transform: { pos: [0, 0, 0], heading: 0 } };
      const hero = { id: 'p', pilotable: true, rule: { type: 'platform', speed: 0, eye: 0, collideRadius: 0.3, collideHeight: 1.7 }, body: { type: 'none', hittable: true, hp: 1e6 }, transform: { pos: [1.2, 0, 0], heading: Math.PI } };
      const st = E.createWorld({ entities: [foe, hero] });
      let min = Infinity, swung = false;
      for (let i = 0; i < 240; i++) { E.stepWorld(st, {}, DT, { ground: () => 0 }); const e = st.byId.f; if (e.swingT != null) { swung = true; min = Math.min(min, Math.hypot(e.transform.pos[0] - 1.2, e.transform.pos[1])); } }
      return { swung, min };
    };
    const stop = closest({ strikeLungeStop: 0.8 }), half = closest({});
    expect(stop.swung).toBe(true);
    expect(stop.min).toBeGreaterThan(0.78);
    expect(half.min).toBeLessThan(stop.min);
  });
});

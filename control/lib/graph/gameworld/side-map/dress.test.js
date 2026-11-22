// The side map's dress (side-map/dress.js): the design dealt over a layout. The concepts: a premise names its setting;
// two zones running into each other are never the same place; the closed parts are lighter than the void behind the
// play; play and place stand on opposite sides of the wheel; the boss's colour is unused before its lead-in and grows
// toward its room; a run's bays keep the walls' rule, a pillar between bays and a lamp an A bay; each zone's edge
// carries the next one's family and key; the thread runs unbroken zone to zone; a shaft's back wall draws its way; the
// subject is shown small, then large, then whole; an outdoor zone's backdrop knows its height; the same seed, the same dress.
import { describe, it, expect } from 'vitest';
import { dressSideMap, settingOf, SETTINGS } from './dress.js';
import { layoutSideMap } from './layout.js';
import { rhythmFaults } from '../../era/wall-rhythm.js';
import { reachOf } from '../feel/reach.js';
import { readFeel } from '../feel/lower.js';

const reach = reachOf(readFeel({ pole: 'galaxy-boy', takes: true }));
const STAGE = {
  premise: 'Galaxy Boy breaks into the reactor plant to stop the machine it builds',
  zones: [
    { run: 'across', screens: 3, teach: 'basic' },
    { run: 'across', screens: 4, teach: 'meet', spawners: 2 },
    { run: 'up', screens: 2, climb: 'chimney' },
    { run: 'across', screens: 2, beat: 'landing' },
    { run: 'down', screens: 2, drop: 'chute' },
    { run: 'across', screens: 3, teach: 'gauntlet', spawners: 3 },
    { room: [1, 1], teach: 'boss' },
  ],
};
const dress = (map = STAGE, seed = 7) => dressSideMap(layoutSideMap(map, { reach, stature: 1.67 }), map, { seed });
const lum = (h) => { const n = parseInt(h.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => v / 255); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const hue = (h) => {
  const n = parseInt(h.slice(1), 16), [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => v / 255), M = Math.max(r, g, b), m = Math.min(r, g, b), d = M - m;
  if (!d) return 0;
  const x = M === r ? ((g - b) / d) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (x * 60 + 360) % 360;
};
const apart = (a, b) => { const d = Math.abs(hue(a) - hue(b)) % 360; return Math.min(d, 360 - d); };

describe('the side map\'s dress', () => {
  it('a premise names its setting; none named is the plant', () => {
    const [k] = Object.keys(SETTINGS).filter((s) => s !== 'plant');
    expect(settingOf(`a climb up the ${SETTINGS[k].words[0]}`)).toBe(k);
    expect(settingOf('somewhere')).toBe('plant');
    expect(dress().setting).toBe('plant');
  });
  it('two zones running into each other are never the same place', () => {
    const D = dress();
    for (let i = 1; i < D.zones.length; i++) expect(D.zones[i].place).not.toBe(D.zones[i - 1].place);
  });
  it('the closed parts are lighter than the void; play and place on opposite sides of the wheel', () => {
    const D = dress();
    for (const z of D.zones) expect(lum(z.key)).toBeGreaterThan(lum(z.void) + 0.2);
    expect(apart(D.palette.play, D.palette.place)).toBeGreaterThan(150);
    for (const z of D.zones) expect(apart(z.key, D.palette.play)).toBeGreaterThan(120);
  });
  it('the boss\'s colour is unused before its lead-in, grows toward its room, and is its own hue', () => {
    const D = dress(), at = D.zones.length - 1;
    expect(D.zones[at].boss).toBe(1);
    expect(D.zones.slice(0, at - 2).every((z) => z.boss === 0)).toBe(true);
    expect(D.zones[at - 2].boss).toBeLessThan(D.zones[at - 1].boss);
    expect(D.zones[at].mark.kind).toBe('emblem');
    for (const z of D.zones) expect(apart(z.key, D.palette.boss)).toBeGreaterThan(30);
    expect(dress({ zones: STAGE.zones.slice(0, -1) }).zones.every((z) => z.boss === 0)).toBe(true);
  });
  it('a run\'s bays keep the walls\' rule, a pillar between bays, a lamp an A bay, a hatch a spawner', () => {
    const D = dress(), L = layoutSideMap(STAGE, { reach, stature: 1.67 });
    const runs = D.zones.filter((z) => z.bays);
    expect(runs.length).toBe(STAGE.zones.filter((z) => z.run === 'across').length);
    for (const z of runs) {
      expect(rhythmFaults(z.bays.join(''))).toEqual([]);
      expect(z.pillars).toHaveLength(z.bays.length - 1);
      expect(z.lamps).toHaveLength(z.bays.filter((b) => b === 'A').length);
      const [s0, s1] = L.zones[z.zone].rect;
      expect((s1 - s0) / z.bays.length).toBeGreaterThan(0.8 * L.screen.width);
      expect(z.hatches).toHaveLength(STAGE.zones[z.zone].spawners ?? 0);
    }
  });
  it('each zone\'s edge carries the next one\'s family and key; the thread runs unbroken', () => {
    const D = dress();
    D.zones.slice(0, -1).forEach((z, i) => expect(z.peek).toMatchObject({ family: D.zones[i + 1].family, key: D.zones[i + 1].key }));
    expect(D.zones.at(-1).peek).toBeUndefined();
    expect(D.threads.map((t) => [t.from, t.to])).toEqual(D.zones.slice(1).map((z) => [z.zone - 1, z.zone]));
  });
  it('a shaft\'s back wall draws its way and its top is lit; a chute is striped', () => {
    const D = dress();
    expect(D.zones[2]).toMatchObject({ mark: { kind: 'climbs' }, light: { at: 'top' } });
    expect(D.zones[4].mark.kind).toBe('stripes');
    expect(D.zones[4].place).toBe(SETTINGS.plant.places.down.at(-1).name);
  });
  it('the subject is shown small, then large, then whole', () => {
    const shown = dress().zones.filter((z) => z.foreshadow).map((z) => z.foreshadow.scale);
    expect(shown).toEqual(['small', 'large', 'whole']);
  });
  it('an outdoor zone\'s backdrop knows its height; inside there is none', () => {
    const map = { premise: 'up the volcano', zones: [{ run: 'across', screens: 2 }, { run: 'up', screens: 3, climb: 'ledges' }, { run: 'across', screens: 2 }] };
    const D = dress(map);
    expect(D.setting).toBe('mountain');
    expect(D.zones[0].backdrop).toBe('land');
    expect(D.zones[2].backdrop).toBe('sky');
    expect(D.zones[1].backdrop).toBeUndefined();
  });
  it('the same seed, the same dress', () => {
    expect(JSON.stringify(dress())).toBe(JSON.stringify(dress()));
  });
});

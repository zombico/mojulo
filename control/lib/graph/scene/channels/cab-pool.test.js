// THE CITY'S CARS AS BODIES: a cab whose mount names a pool is drawn from the page's pooled templates, and a spare may
// become a vehicle taken from the traffic. Emitted only with such a cab and a pool; the page parses; none adds no byte.
import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';
import { emitThreeWorld } from '../scene-three.js';

const quad = (z, hex, s = 1) => ({ corners: [[-s, -s, z], [s, -s, z], [s, s, z], [-s, s, z]], normal: [0, 0, 1], fill: hex });
const floor = { ...quad(0, '#777777', 200), group: 'ground' };
const pools = [{ group: 'v-paint', template: [quad(1, '#ffffff')], transforms: [], pool: 'sedan|paint' }, { group: 'v-trim', template: [quad(0.5, '#222222')], transforms: [], pool: 'sedan|trim' }];
const hero = { id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5 }, body: { type: 'none' }, transform: { pos: [0, 0, 0], heading: 0 } };
const cab = (extra) => ({ id: 'car-1', rule: { type: 'drive', horsepower: 140, mass: 1400, wheelbase: 2.7, wheelRadius: 0.33 }, body: { type: 'none' }, transform: { pos: [3, 0, 0], heading: 0 },
  mount: { cab: true, hull: [0.9, 2.2], reach: 3, stand: [-1.4, 0.2], mount: { s: 0.3 }, dismount: { s: 0.3 }, ...extra } });
const parses = (html) => {
  const src = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
  try { execFileSync(process.execPath, ['--input-type=module', '--check'], { input: src, stdio: ['pipe', 'pipe', 'pipe'] }); return null; } catch (e) { return String(e.stderr || e.message).slice(0, 400); }
};

describe('the cab pool channel', () => {
  it('is on a page with a pooled cab or a spare, and the page parses; the prompt offers a vehicle of the traffic\'s', () => {
    for (const extra of [{ pool: { model: 'sedan', tint: [0.2, 0.3, 0.4] } }, { spare: true }]) {
      const html = emitThreeWorld({ faces: [floor], repeats: pools, entities: [hero, cab(extra)] });
      for (const s of ['__POOLS[P.model + \'|paint\']', 'trafficOffer', '__mojTaken']) expect(html).toContain(s);
      expect(parses(html)).toBe(null);
    }
  });
  it('is on no page without one: a cab with a figure, a page with no pools', () => {
    expect(emitThreeWorld({ faces: [floor], repeats: pools, entities: [hero, cab({})] })).not.toContain('__mojTaken');
    expect(emitThreeWorld({ faces: [floor], entities: [hero, cab({ pool: { model: 'sedan', tint: [1, 1, 1] } })] })).not.toContain('__mojTaken');
  });
  it('a body that swings its tailgate (a driving job\'s garbage truck, `pool.gate`), the jobs\' piles beside it; the page parses; absent, not one byte of it', async () => {
    const { jobStopsOf } = await import('./job-stops.js');
    const gatePools = ['body-paint', 'body-trim', 'gate-paint', 'gate-trim'].map((k) => ({ group: `v-${k}`, template: [quad(1, '#ffffff')], transforms: [], pool: `sedan|${k}` }));
    const moving = cab({ pool: { model: 'sedan', tint: [0.2, 0.3, 0.4], gate: { pivot: [-3, 3.4], tip: -1.1 } } });
    const game = { mechanics: [{ kind: 'bag', slice: 'bag' }, { kind: 'shift', mode: 'collect', id: 'bins', depot: [0, 0, 0], cabs: ['car-1'], stops: [{ at: [20, 0, 0] }], load: 1 }] };
    const html = emitThreeWorld({ faces: [floor], repeats: [...pools, ...gatePools], entities: [hero, moving], jobStops: jobStopsOf({ game }) });
    for (const s of ["'|gate-paint'", 'e.tipAt', '__mojJobStops', 'shift:hold:']) expect(html).toContain(s);
    expect(parses(html)).toBe(null);
    const plain = emitThreeWorld({ faces: [floor], repeats: pools, entities: [hero, cab({ pool: { model: 'sedan', tint: [0.2, 0.3, 0.4] } })] });
    for (const s of ['e.tipAt', '__mojJobStops']) expect(plain).not.toContain(s);
  });
  it('an operated machine (a dig job\'s excavator, channels/operate.js): its parts and levers on the page, which parses; absent, not one byte of it', async () => {
    const { operateOf } = await import('./operate.js');
    const game = { mechanics: [{ kind: 'bag', slice: 'bag' }, { kind: 'shift', mode: 'dig', id: 'dig', machine: 'crawlerExcavator', cabs: ['car-1'], pile: { at: [7, 0, 0], radius: 2.6 }, bed: { at: [-7, 0, 1.6], half: [1.25, 2.4], heading: 0 }, loads: 3 }] };
    const html = emitThreeWorld({ faces: [floor], repeats: pools, entities: [hero, cab({})], operate: operateOf({ game }) });
    for (const s of ['__mojOperate', 'shift:scoop:', 'shift:tip:', "'ArrowUp'"]) expect(html).toContain(s);
    expect(parses(html)).toBe(null);
    expect(emitThreeWorld({ faces: [floor], repeats: pools, entities: [hero, cab({ pool: { model: 'sedan', tint: [1, 1, 1] } })] })).not.toContain('__mojOperate');
  }, 60000);
});

import { describe, it, expect } from 'vitest';
import { assembleStageScene } from './stage.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { collectFaceTextures } from '../landscape/surface-textures.js';
import { resolveWorldScene } from '../worlds/world-scene.js';

// live wind on a stage (`wind`): the dressing's hung cloth swings in the gust field on the page (scene/channels/stage-sway.js)
const NAVE = { kind: 'stage', reference: 'dmc3', kit: 'gothic-nave', rooms: [{ id: 'nave', x: 0, y: 0, w: 12, d: 24, h: 13 }] };
const PLAZA = { kind: 'stage', reference: 'sunshine', kit: 'delfino-plaza', rooms: [{ id: 'plaza', x: 0, y: 0, w: 26, d: 22, h: 12 }] };
const page = (p) => emitThreeWorld({ ...p, textures: collectFaceTextures(p.faces), inline: true });
const count = (p, g) => p.faces.filter((f) => f.group === g).length;

describe('a stage in the wind', () => {
  const still = assembleStageScene(PLAZA), windy = assembleStageScene({ ...PLAZA, wind: { speed: 6, dir: 120 } });

  it('the floor holds: without `wind` there is no sway and the page carries none of it', () => {
    expect('sway' in still).toBe(false);
    const html = page(still);
    expect(html).not.toContain('stage sway');
    expect(html).not.toContain('tm.userData.g');
  });

  it('the hung cards are cut into the style\'s grid, and nothing else changes count', () => {
    const [nu, nv] = [3, 4];
    for (const g of ['stage:laundry', 'stage:awning', 'stage:flowers']) expect(count(windy, g)).toBe(count(still, g) * nu * nv);
    for (const g of ['stage:wall', 'stage:floor', 'stage:balustrade']) expect(count(windy, g)).toBe(count(still, g));
    // the cells keep the card's uv: v still runs 0 at the foot to 1 at the head, so the page knows which edge is pinned
    const vs = windy.faces.filter((f) => f.group === 'stage:laundry').flatMap((f) => f.uv.map((q) => q[1]));
    expect(Math.min(...vs)).toBe(0);
    expect(Math.max(...vs)).toBe(1);
  });

  it('the sway carries the gust field (direction in radians) and the style\'s takers; the page tags and bends them', () => {
    expect(windy.sway.wind.speed).toBe(6);
    expect(windy.sway.wind.dir).toBeCloseTo((120 * Math.PI) / 180, 6);
    expect(Object.keys(windy.sway.groups).sort()).toEqual(['stage:awning', 'stage:flowers', 'stage:laundry']);
    expect(windy.sway.groups['stage:awning'].free).toBe(0.25);
    const html = page(windy);
    expect(html).toContain('stage sway (opt-in)');
    expect(html).toContain('tm.userData.g = grp.name');
    expect(html).toContain('mojWindAt');
  });

  it('indoors the wind is the draught through the doors: the nave\'s banners take a share of it', () => {
    const nave = assembleStageScene({ ...NAVE, wind: true });
    expect(nave.sway.wind.speed).toBeCloseTo(5 * 0.5, 6);
    expect(Object.keys(nave.sway.groups)).toContain('stage:banner');
    expect(count(nave, 'stage:banner')).toBe(count(assembleStageScene(NAVE), 'stage:banner') * 10);
  });

  it('reaches the page through the World route', async () => {
    const { payload } = await resolveWorldScene({ ref: 'stage-wind', render_mode: 'world', manifest: { ...PLAZA, wind: true } });
    expect(payload.sway.groups['stage:laundry'].pin).toBe('top');
  });
});

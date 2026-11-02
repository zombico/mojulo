import { describe, it, expect } from 'vitest';
import { FIRST_FRAME, dominantColour, bodyOf, eyeInside, heroOnScreen, judgeFrame, worse, drawnShare } from './first-frame.js';

// The opening-frame measures on synthetic pixel buffers and plain scene numbers: no browser.
const W = 64, H = 48;
const frame = (paint) => {
  const px = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [r, g, b] = paint(x, y), o = (y * W + x) * 4;
    px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
  }
  return px;
};
// one colour, with the faint shading a lit surface carries (it stays in one coarse bin)
const flat = frame((x, y) => [200 + (x % 3), 40 + (y % 2), 40]);
// a normal frame: sky over ground, a path and a figure
const normal = frame((x, y) => (y < 20 ? [120, 170, 230 - y] : x > 26 && x < 36 && y > 22 ? [30, 60, 160] : x > 20 && x < 44 ? [190, 160, 110] : [70, 150, 40]));

// a hero (radius 0.3, 1.7 tall) standing at the origin, its position its feet
const hero = { id: 'hero', pos: [0, 0, 0], eye: 0, collideRadius: 0.3, collideHeight: 1.7, bodyType: 'figure-rig' };
// a chase camera `d` behind it (along -x) and 2.4 up, looking at its chest
const chase = (d) => ({ eye: [-d, 0, 2.4], look: [0, 0, 1.1], vfov: 45, aspect: 4 / 3, heroId: 'hero', entities: [hero] });

describe('first frame: the measures', () => {
  it('one colour over the frame fails; a frame of sky, ground and a figure passes', () => {
    const one = dominantColour(flat);
    expect(one.share).toBe(1);
    expect(one.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(judgeFrame({ rgba: flat })).toMatchObject({ status: 'failed', says: [expect.stringMatching(/one colour .* covers 100% of the frame/)] });
    const ok = judgeFrame({ rgba: normal });
    expect(ok.colour.share).toBeLessThan(FIRST_FRAME.oneColour);
    expect(ok).toMatchObject({ status: 'pass', says: [] });
  });

  it("the hero's on-screen size: a chase camera reads; too far or too close warns", () => {
    const near = judgeFrame({ rgba: normal, scene: chase(5.5) });
    expect(near.hero.size).toBeGreaterThan(FIRST_FRAME.hero[0]);
    expect(near.hero.size).toBeLessThan(FIRST_FRAME.hero[1]);
    expect(near.status).toBe('pass');
    const far = judgeFrame({ rgba: normal, scene: chase(60) });
    expect(far).toMatchObject({ status: 'warn', says: [expect.stringMatching(/too far to read/)] });
    const close = judgeFrame({ rgba: normal, scene: { ...chase(0.9), eye: [-0.9, 0, 1.2] } });
    expect(close).toMatchObject({ status: 'warn', says: [expect.stringMatching(/too close/)] });
    // looking away: the hero is not in the frame
    expect(judgeFrame({ rgba: normal, scene: { ...chase(5.5), look: [-20, 0, 2.4] } }).says).toEqual([expect.stringMatching(/not in the frame/)]);
  });

  it("the eye inside a body fails; a first person's own body is never counted", () => {
    const inside = { ...chase(1), eye: [0.1, 0, 1.2] };
    expect(judgeFrame({ rgba: normal, scene: inside })).toMatchObject({ status: 'failed', eye_inside: 'hero' });
    const fp = judgeFrame({ rgba: normal, scene: { ...inside, firstPerson: true } });
    expect(fp).toMatchObject({ status: 'pass', eye_inside: null, hero: null });
    // a body with no volume (a first-person walker's `none`) is never one to be inside
    expect(bodyOf({ ...hero, bodyType: 'none' })).toBeNull();
    expect(eyeInside([0, 0, 1], [bodyOf(hero)])).toBe('hero');
    expect(eyeInside([0, 0, 2], [bodyOf(hero)])).toBeNull();
  });

  it('a body is read from what the runtime holds: its collision volume first, then the rule, then the body', () => {
    expect(bodyOf({ id: 'a', pos: [1, 2, 3], eye: 1.6, collideRadius: 0.3, collideHeight: 1.7 })).toEqual({ id: 'a', x: 1, y: 2, z0: 1.4, z1: 1.4 + 1.7, r: 0.3 });
    expect(bodyOf({ id: 'b', pos: [0, 0, 0], collideVol: { a: 2, c: 3 }, collideRadius: 0.3 })).toMatchObject({ r: 2, z1: 6 });
    expect(bodyOf({ id: 'c', pos: [0, 0, 0], size: [4, 2, 1.5] })).toMatchObject({ r: 2, z1: 1.5 });
    expect(bodyOf({ id: 'd', pos: [0, 0, 0] })).toBeNull();
  });

  it('the projection: straight ahead is centred, behind the camera is off screen', () => {
    const body = bodyOf(hero);
    const ahead = heroOnScreen({ eye: [-5, 0, 0.85], look: [0, 0, 0.85], vfov: 45, aspect: 1 }, body);
    expect(ahead.visible).toBe(true);
    expect(ahead.size).toBeCloseTo(Math.sqrt(ahead.area), 3);
    expect(heroOnScreen({ eye: [5, 0, 0.85], look: [10, 0, 0.85], vfov: 45, aspect: 1 }, body).visible).toBe(false);
    // a camera straight overhead still has a frame to project into
    expect(heroOnScreen({ eye: [0, 0, 14], look: [0, 0, 0], vfov: 45, aspect: 4 / 3 }, body).visible).toBe(true);
  });

  it('dark against the level\'s own look (2026-11-02): its own sky or a space level\'s black is the level; a backdrop showing through is no colour', () => {
    const black = frame(() => [8, 8, 8]);
    expect(judgeFrame({ rgba: black }).status).toBe('failed');
    // a space level whose background is black, the frame mostly space with a ship
    const space = frame((x, y) => (x > 24 && x < 40 && y > 16 && y < 32 ? [200, 200, 210] : [5, 5, 8]));   // a ship a twelfth of it
    expect(judgeFrame({ rgba: space, scene: { bg: '#000000' } })).toMatchObject({ status: 'pass', says: [] });
    // the same black on a level whose background is a blue sky: a wall in front of the camera
    expect(judgeFrame({ rgba: space, scene: { bg: '#7aa8e6' } }).status).toBe('failed');
    // nothing but the level's own sky: it sees none of the level
    expect(judgeFrame({ rgba: black, scene: { bg: '#000000' } })).toMatchObject({ status: 'warn', says: [expect.stringMatching(/own background/)] });
    // a transparent frame (an image backdrop) is no colour of the level's, said apart
    const clear = new Uint8Array(W * H * 4);
    expect(dominantColour(clear)).toMatchObject({ share: 0, clear: 1 });
    expect(judgeFrame({ rgba: clear })).toMatchObject({ status: 'warn', says: [expect.stringMatching(/backdrop/)] });
  });

  it('the hero drawn: its box against the frame without it; a game that asks a ride checks its pilot drives', () => {
    const scene = { ...chase(5.5), width: W, height: H };
    const seen = judgeFrame({ rgba: normal, scene }).hero;
    expect(seen.box).toBeUndefined();
    // a hero hidden changes its box: drawn; nothing changes: not drawn
    const without = frame((x, y) => (y < 20 ? [120, 170, 230 - y] : [70, 150, 40]));
    const box = heroOnScreen({ ...scene }, bodyOf(hero)).box;
    expect(drawnShare(normal, without, W, H, box)).toBeGreaterThan(0);
    expect(judgeFrame({ rgba: normal, scene: { ...scene, hidden: without } }).status).toBe('pass');
    expect(judgeFrame({ rgba: normal, scene: { ...scene, hidden: normal } })).toMatchObject({ status: 'failed', says: [expect.stringMatching(/nothing of it is drawn/)] });
    // a racer whose pilot walks: failed; one whose pilot drives: as before
    const walker = { ...hero, rule: 'platform' };
    expect(judgeFrame({ rgba: normal, scene: { ...scene, entities: [walker], expect: 'vehicle' } }).says).toEqual([expect.stringMatching(/asks a ride .* runs the platform rule, not drive/)]);
    expect(judgeFrame({ rgba: normal, scene: { ...scene, entities: [{ ...hero, rule: 'drive' }], expect: 'vehicle' } }).status).toBe('pass');
    expect(judgeFrame({ rgba: normal, scene: { ...scene, heroId: null, expect: 'aircraft' } }).says).toEqual([expect.stringMatching(/asks an aircraft and the camera watches no pilot/)]);
  });

  it('statuses order pass < warn < failed', () => {
    expect(worse('pass', 'warn')).toBe('warn');
    expect(worse('failed', 'warn')).toBe('failed');
    expect(worse('pass', 'pass')).toBe('pass');
  });
});

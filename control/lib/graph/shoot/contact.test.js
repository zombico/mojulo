import { describe, it, expect } from 'vitest';
import { contactFrames, AT, MAX_ROWS } from './contact.js';
import { normalizeShoot } from './plan.js';
import { composeContactSheet } from '../../motion/contact-sheet.js';
import sharp from 'sharp';

const walker = { id: 'walker:0', kind: 'walker', box: { len: 0.6, wid: 0.6, hgt: 1.75 }, at: (t) => ({ pos: [t, 0, 0], heading: 0 }) };
const subjects = new Map([[walker.id, walker]]);
const plan = (raw) => normalizeShoot(raw, { subjects }).plan;
const PUSH = { cameras: [{ id: 'push', keys: [{ t: 0, move: { kind: 'push_in', on: 'walker:0', from: 'ws', to: 'cu', for: 4 } }] }, { id: 'side', keys: [{ t: 0, frame: { on: 'walker:0', size: 'fs', side: 'profile-left', place: 'left' } }] }],
  shots: [{ camera: 'push', span: [0, 4] }, { camera: 'side', span: [4, 6] }] };

describe('the contact sheet\'s frames', () => {
  it('a row a shot, its start, middle and end, each the camera the sampler gives then', () => {
    const { rows } = contactFrames(plan(PUSH), { subjects });
    expect(rows.map((r) => r.shot)).toEqual(['push 1', 'side 2']);
    expect(rows[0].frames.map((f) => [f.at, f.world_t])).toEqual([['start', 0], ['middle', 2], ['end', 4]]);
    expect(rows[0].frames[0].framing).toHaveProperty('cameraPosition');
  });
  it('each frame reads its own size, so a move shows along its row; the row says the frame read\'s', () => {
    const { rows } = contactFrames(plan(PUSH), { subjects });
    expect(rows[0].frames.map((f) => f.size)).toEqual(['ws', expect.any(String), 'cu']);
    expect(rows[0].about).toBe('walker:0');
    expect(rows[1].notes).toContain('short-sided');   // a figure facing frame left placed on the left
  });
  it('takes one, two or three instants a shot, and at most MAX_ROWS shots', () => {
    expect(contactFrames(plan(PUSH), { subjects, per: 1 }).rows[0].frames.map((f) => f.at)).toEqual(AT[1]);
    expect(contactFrames(plan(PUSH), { subjects, per: 9 }).rows[0].frames).toHaveLength(3);
    const many = plan({ cameras: [{ id: 'a', keys: [{ t: 0, pos: [0, -5, 2], poi: [0, 0, 1] }, { t: 40, pos: [0, -5, 2], poi: [0, 0, 1] }] }], shots: Array.from({ length: MAX_ROWS + 3 }, (_, i) => ({ camera: 'a', span: [i, i + 1] })) });
    const sheet = contactFrames(many, { subjects });
    expect(sheet.rows).toHaveLength(MAX_ROWS);
    expect(sheet.cut).toMatch(new RegExp(`${MAX_ROWS + 3} shots`));
  });
});

describe('the contact sheet composed', () => {
  it('lays the frames a row a shot at the cell\'s width, the same bytes each time', async () => {
    const { rows } = contactFrames(plan(PUSH), { subjects, per: 2 });
    const frame = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#406080' } }).png().toBuffer();
    const pngs = rows.flatMap((r) => r.frames.map(() => frame));
    const a = await composeContactSheet(rows, pngs, { width: 64, height: 48, cell: 160 });
    const meta = await sharp(a).metadata();
    expect(meta.width).toBe(10 + 2 * (160 + 10));
    expect(meta.height).toBe(10 + rows.length * (26 + 120 + 20 + 10));
    expect((await composeContactSheet(rows, pngs, { width: 64, height: 48, cell: 160 })).equals(a)).toBe(true);
  });
});

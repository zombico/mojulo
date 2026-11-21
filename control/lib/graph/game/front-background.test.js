import { describe, it, expect, vi } from 'vitest';

// A START SCREEN'S PICTURE given as a file: design_game's patch files it into a stash and names the stash's item, as
// create_cover files its art. The stash and the storage are stood in for here; what is rewritten, and what is left, is
// tested.
vi.mock('../image-outcomes/cover-upload.js', () => ({
  readArtFile: (file) => ({ buffer: Buffer.from('x'), name: file.split('/').pop(), mime: 'image/png', width: 4, height: 4 }),
  fileArt: (picture, { label }) => ({ stash: `st_${label.replace(/\W/g, '')}`, item: 7 }),
  uploadedArt: async () => Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  pictureHeader: (b) => (b[0] === 0x89 ? { type: 'png', width: 4, height: 4 } : null),
}));
const { patchStageBackgrounds } = await import('./front-background.js');

describe('a start screen\'s picture filed from a patch', () => {
  const FILED = { stash: 'st_startscreen', item: 7 };
  it('at the background, the stage or the front: the path filed and the item named', () => {
    const at = (op) => patchStageBackgrounds([op]).patch[0].value;
    expect(at({ op: 'set', path: '/front/stage/background', value: { path: '/a/pic.png' } })).toEqual(FILED);
    expect(at({ op: 'set', path: '/front/stage', value: { composition: 'hero-pose', background: { path: '/a/pic.png' } } })).toEqual({ composition: 'hero-pose', background: FILED });
    expect(at({ op: 'add', path: '/front', value: { tagline: 't', stage: { composition: 'hero-pose', background: { path: '/a/pic.png' } } } }).stage.background).toEqual(FILED);
    expect(patchStageBackgrounds([{ op: 'set', path: '/front/stage/background', value: { path: '/a/pic.png' } }]).filed).toEqual([{ path: '/a/pic.png', ...FILED }]);
  });
  it('a stash item already named, another op, or no patch passes as it is', () => {
    const ops = [{ op: 'set', path: '/front/stage/background', value: FILED }, { op: 'set', path: '/feel', value: 'snappy' }, { op: 'remove', path: '/front/stage/background' }];
    expect(patchStageBackgrounds(ops)).toEqual({ patch: ops, filed: [] });
    expect(patchStageBackgrounds(undefined).patch).toBeUndefined();
  });
});

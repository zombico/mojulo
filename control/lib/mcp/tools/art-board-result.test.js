process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createSketchHandler, updateSketchHandler } from '@/lib/mcp/tools/sketches';
import { withArtBoard } from '@/lib/mcp/tools/art-board-result';
import { starter } from '@/lib/graph/era/entries.js';

beforeEach(() => { closeDb(); });
const create = withArtBoard(createSketchHandler), update = withArtBoard(updateSketchHandler);
const ROOMS = { ...starter('gothic-stone'), reference: 'gothic-night', rooms: starter('gothic-stone').rooms.slice(0, 2), links: starter('gothic-stone').links.slice(0, 1) };

describe('the art gate through create_sketch / update_sketch', () => {
  it("art: 'propose' mints a direction as numbers and answers with the board and the gate's next move", async () => {
    const r = await create({ title: 'tomb', manifest: { ...ROOMS, art: 'propose' }, ref: 'art-1' });
    expect(r.content[1].type).toBe('image');
    const body = JSON.parse(r.content[0].text);
    expect(body.art.pending).toEqual(['palette', 'materials', 'architecture', 'motifs', 'doodads', 'atmosphere', 'plan']);
    expect(body.next).toMatch(/\/art\/status\/<item>/);
    const stored = SketchRepository.getByRef('art-1').manifest;
    expect(Number.isInteger(stored.art.seed)).toBe(true);
    expect(stored.art.palette.stone).toHaveLength(5);
  }, 120000);

  it('approving an item and sending one back are patches; the stored row changes only where asked', async () => {
    await create({ title: 'tomb', manifest: { ...ROOMS, art: 'propose' }, ref: 'art-2' });
    const before = SketchRepository.getByRef('art-2').manifest.art;
    const r = await update({ ref: 'art-2', patch: [{ op: 'set', path: '/art/status/palette', value: 'approved' }, { op: 'set', path: '/art/motifs', value: 'reroll' }] });
    const after = SketchRepository.getByRef('art-2').manifest.art, body = JSON.parse(r.content[0].text);
    expect(after.status.palette).toBe('approved');
    expect(after.palette).toEqual(before.palette);
    expect(after.motifs).not.toEqual(before.motifs);
    expect(body.art.pending).not.toContain('palette');
  }, 120000);

  it('a stage without art answers as it always did', async () => {
    const r = await create({ title: 'plain', manifest: ROOMS, ref: 'art-3' });
    expect(r.content).toBeUndefined();
    expect(r.ref).toBe('art-3');
  }, 120000);
});

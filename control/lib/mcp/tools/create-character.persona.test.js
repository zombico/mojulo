process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { describe, it, expect } from 'vitest';
import { createCharacterHandler, updateCharacterHandler } from './create-character.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { SketchRevisionRepository } from '@/lib/db/repositories/sketch-revisions';
import { classifyBucket } from '@/lib/graph/sketch/sketch-manifest';
import { personaTakes, personaReads } from '@/lib/graph/persona/persona.js';
import { performanceErrors } from '@/lib/graph/face-acting/perform.js';

// a persona is its own record pointing at a hero: the door checks the refs and the words, keeps the scripts, and says
// each read in short. The heroes are stored rows (the door reads their words, never their mesh), so no mint is paid.
const realistic = SketchRepository.create({ title: 'Ada', ref: 'pp_ada', manifest: { kind: 'layered', hero: { name: 'Ada', form: 'realistic', head: 'relational' } } });
const tiered = SketchRepository.create({ title: 'Bo', ref: 'pp_bo', manifest: { kind: 'layered', hero: { name: 'Bo', form: 'tiered' } } });
SketchRepository.create({ title: 'a box', ref: 'pp_box', manifest: { kind: 'solid-turntable', shape: 'cube' } });
const NEWS = 'Good evening. The storm left 4,000 homes without power.\n\nIn sport, the Harbor Kings won 3-2.';

describe('create_character as a persona', () => {
  it('keeps the scripts, points at the hero, and says each read in short with where its face is drawn', async () => {
    const out = await createCharacterHandler({ as: 'persona', ref: 'pp_news', spec: { hero: realistic.ref, register: 'anchor', reads: { lead: { script: NEWS } } } });
    expect(out.ok).toBe(true);
    const row = SketchRepository.getByRef('pp_news');
    expect(row.manifest).toEqual({ kind: 'persona', persona: { hero: 'pp_ada', register: 'anchor', reads: { lead: { script: NEWS } } } });
    expect(row.title).toBe('persona · Ada');
    expect(classifyBucket(row.manifest)).toBe('object');
    const [lead] = out.persona.reads;
    expect(lead).toMatchObject({ id: 'lead', register: 'anchor', lines: 3 });
    expect(lead.stressed).toContain('4,000');
    expect(lead.captions).toBeGreaterThan(0);
    expect(out.persona.face).toMatch(/gen-7/);
    expect(out.next.tool).toBe('update_character');
    // (its reads are the hero's face takes, as the hero's door takes them)
    for (const P of Object.values(personaTakes(row.manifest.persona))) expect(performanceErrors(P)).toEqual([]);
  });

  it('a hero that is not the realistic head reads without a face: audio, captions and the body', async () => {
    const out = await createCharacterHandler({ as: 'persona', ref: 'pp_bo_reads', spec: { hero: tiered.ref, reads: { a: { script: 'Hello there.' } } } });
    expect(out.persona.face).toMatch(/no face take/);
    expect(out.persona.register).toBe('anchor');
  });

  it('refuses a hero that is no hero, a voice that is no voice, and words it does not take', async () => {
    await expect(createCharacterHandler({ as: 'persona', spec: { hero: 'pp_box' } })).rejects.toThrow(/a hero's ref.*solid-turntable/);
    await expect(createCharacterHandler({ as: 'persona', spec: { hero: 'pp_nobody' } })).rejects.toThrow(/no sketch/);
    await expect(createCharacterHandler({ as: 'persona', spec: { hero: 'pp_ada', voice: 'pp_box' } })).rejects.toThrow(/voice register/);
    await expect(createCharacterHandler({ as: 'persona', spec: { hero: 'pp_ada', register: 'crooner' } })).rejects.toThrow(/not a register/);
    await expect(createCharacterHandler({ as: 'persona', spec: { hero: 'pp_ada', reads: { 'two words': { script: 'Hi.' } } } })).rejects.toThrow(/a word/);
    await expect(createCharacterHandler({ as: 'persona', spec: { hero: 'pp_ada', mood: 'sad' } })).rejects.toThrow(/not mood/);
  });
});

describe('update_character on a persona', () => {
  it('merges reads by id, retunes a read, removes one with null, and keeps what it replaced as a revision', async () => {
    await createCharacterHandler({ as: 'persona', ref: 'pp_edit', spec: { hero: realistic.ref, reads: { lead: { script: NEWS }, old: { script: 'Bye.' } } } });
    const before = personaReads(SketchRepository.getByRef('pp_edit').manifest.persona).lead.seconds;
    const out = await updateCharacterHandler({ ref: 'pp_edit', spec: { reads: { lead: { register: 'play-by-play' }, old: null, sport: { script: 'He shoots, he scores!' } } } });
    expect(out.ok).toBe(true);
    const P = SketchRepository.getByRef('pp_edit').manifest.persona;
    expect(Object.keys(P.reads).sort()).toEqual(['lead', 'sport']);
    expect(P.reads.lead).toEqual({ script: NEWS, register: 'play-by-play' });
    expect(out.persona.reads.find((r) => r.id === 'lead').seconds).toBeLessThan(before);
    expect(SketchRevisionRepository.head('pp_edit')?.rev).toBeGreaterThanOrEqual(1);
  });

  it('refuses an edit that breaks it before anything is stored, and its hero\'s words', async () => {
    await createCharacterHandler({ as: 'persona', ref: 'pp_guard', spec: { hero: realistic.ref } });
    await expect(updateCharacterHandler({ ref: 'pp_guard', spec: { register: { from: 'anchor', rate: 9 } } })).rejects.toThrow(/rate/);
    await expect(updateCharacterHandler({ ref: 'pp_guard', spec: { hero: 'pp_box' } })).rejects.toThrow(/a hero's ref/);
    await expect(updateCharacterHandler({ ref: 'pp_guard', target: '1080p' })).rejects.toThrow(/its hero's/);
    expect(SketchRepository.getByRef('pp_guard').manifest.persona).toEqual({ hero: 'pp_ada', register: 'anchor', reads: {} });
  });
});

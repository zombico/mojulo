import { describe, it, expect } from 'vitest';
import { characterParts, characterState, approveCharacter, characterReady, reviewState, CHARACTER_PART_IDS, pinBase } from './index.js';
import { LOOKS } from '../playscape/elements/elements.js';

const look = Object.keys(LOOKS)[0];
const complete = { idiom: 'shonen-like', powers: [{ id: 'burst', verb: 'burn', look }], progression: [{ stage: 'early', gains: ['burst'] }, { stage: 'mid' }] };
const pin = pinBase({ ref: 'h1', rev: 1, manifest: { hero: { cast: 'female' } } });
const world = (hero, more = {}) => ({ id: 'w', seed: 8, levels: { a: { walk: { nodes: { t: { trail: true } } } } }, characters: { direction: { tradition: 'anime' }, hero }, ...more });
const stamp = (S, id) => S.find((s) => s.id === id);

describe('the character book\'s review', () => {
  it('a world without characters has no parts, no stamps, and nothing ready', () => {
    const w = { id: 'w', seed: 8, levels: { a: { walk: { nodes: { t: { trail: true } } } } } };
    expect(characterParts(w)).toEqual([]);
    expect(characterState(w)).toEqual([]);
    expect(characterReady(w).adornment.ready).toBe(false);
  });

  it('the parts are the direction, four looks pages, the base, the motion and the actions, each with a print', () => {
    const P = characterParts(world({}));
    expect(P.map((p) => p.id)).toEqual(CHARACTER_PART_IDS);
    expect(CHARACTER_PART_IDS).toEqual(['characters:direction', 'hero:body', 'hero:head', 'hero:hair', 'hero:colour', 'hero:base', 'hero:motion', 'hero:actions', 'hero:adornment', 'equipment']);
    for (const p of P) expect(p.print).toMatch(/^[0-9a-f]{8}$/);
    expect(JSON.stringify(characterParts(world({})))).toBe(JSON.stringify(characterParts(world({}))));
  });

  it('gated: every part waits; an approval keeps its print and goes stale when its page changes', () => {
    const w = world({ looks: { body: { cast: 'female' } } });
    expect(characterState(w).every((s) => s.status === 'proposed')).toBe(true);
    const review = approveCharacter(w, 'hero:body', 'good silhouette');
    expect(stamp(characterState({ ...w, review }), 'hero:body')).toMatchObject({ status: 'approved', note: 'good silhouette' });
    // another page changing does not move it; its own change does
    expect(stamp(characterState({ ...world({ looks: { body: { cast: 'female' }, hair: { length: 1 } } }), review }), 'hero:body').status).toBe('approved');
    expect(stamp(characterState({ ...world({ looks: { body: { cast: 'male' } } }), review }), 'hero:body').status).toBe('changed');
  });

  it('says what is wrong with a verdict, and with a part that is not one', () => {
    const w = world({});
    expect(() => characterState({ ...w, review: { 'hero:body': { status: 'great' } } })).toThrow(/review.hero:body.status is/);
    expect(() => characterState({ ...w, review: { 'hero:body': { status: 'approved' } } })).toThrow(/keeps the print/);
    expect(() => approveCharacter(w, 'hero:feet')).toThrow(/not a character part/);
  });

  it('the world\'s own review accepts the character parts beside its own, and still refuses a stranger', () => {
    const w = world({}, { review: { 'hero:body': { status: 'revise', note: 'broader' } } });
    expect(reviewState(w).map((s) => s.id)).toContain('world');
    expect(() => reviewState({ ...w, review: { 'hero:feet': { status: 'revise' } } })).toThrow(/is not a part/);
  });

  it('autonomous: a part whose machine gate holds is stamped auto, one that advises is sent back, none is approved', () => {
    const S = characterState(world({ looks: { base: pin }, motion: { vibe: ['cocky'] }, actions: complete }, { mode: 'autonomous' }));
    expect(stamp(S, 'hero:body').status).toBe('auto');
    expect(stamp(S, 'hero:base').status).toBe('auto');
    expect(stamp(S, 'hero:actions').status).toBe('auto');
    expect(S.some((s) => s.status === 'approved')).toBe(false);
    const T = characterState(world({}, { mode: 'autonomous' }));
    expect(stamp(T, 'hero:base')).toMatchObject({ status: 'revise', machine: ['no base is pinned'] });
    expect(stamp(T, 'hero:actions').status).toBe('revise');
    expect(stamp(T, 'hero:motion')).toMatchObject({ status: 'revise', machine: ['no motion is laid out yet'] });
  });

  it('a vibe word the lexicon does not know advises, and the page is read from the resolved motion', () => {
    const S = characterState(world({ motion: { vibe: ['cocky', 'unhinged'] } }, { mode: 'autonomous' }));
    expect(stamp(S, 'hero:motion')).toMatchObject({ status: 'revise', machine: ['unread vibe: unhinged'] });
    const a = characterParts(world({ motion: { vibe: ['cocky'] } })).find((p) => p.id === 'hero:motion');
    const b = characterParts(world({ motion: { vibe: ['bold'] } })).find((p) => p.id === 'hero:motion');
    expect(a.print).not.toBe(b.print);
    expect(stamp(characterState(world({ motion: { vibe: ['cocky'] } }, { mode: 'autonomous' })), 'hero:motion').status).toBe('auto');
  });

  it('the adornment and the equipment are parts: none laid out advises; a page with nothing open holds; a changed item goes stale', () => {
    const w = world({ actions: complete }, { mode: 'autonomous' });
    expect(stamp(characterState(w), 'hero:adornment')).toMatchObject({ status: 'revise', machine: ['no adornment is laid out yet'] });
    expect(stamp(characterState(w), 'equipment').machine).toEqual(['no class has a template yet']);
    const sword = { id: 'blade', slot: 'right', build: { item: 'sword' }, serves: ['burst'] };
    const kit = { items: [sword] };
    const S = characterState(world({ actions: complete, adornment: kit }, { mode: 'autonomous' }));
    expect(stamp(S, 'hero:adornment').status).toBe('auto');
    // the sword seeds its class; the empty classes are the creator's tasks, not faults
    expect(stamp(S, 'equipment')).toMatchObject({ status: 'auto', machine: [] });
    // an approval of the adornment goes stale when an item changes, and so does the equipment it seeds
    const gated = world({ actions: complete, adornment: kit });
    const review = { ...approveCharacter(gated, 'hero:adornment'), ...approveCharacter(gated, 'equipment') };
    expect(stamp(characterState({ ...gated, review }), 'hero:adornment').status).toBe('approved');
    const changed = world({ actions: complete, adornment: { items: [{ ...sword, build: { item: 'sword', dials: { mass: 1.5 } } }] } });
    expect(stamp(characterState({ ...changed, review }), 'hero:adornment').status).toBe('changed');
    expect(stamp(characterState({ ...changed, review }), 'equipment').status).toBe('changed');
  });

  it('a pinned base that has drifted advises, as measured through the lookup', () => {
    const w = world({ looks: { base: pin } }, { mode: 'autonomous' });
    expect(stamp(characterState(w, { lookup: () => ({ hero: { cast: 'female' } }) }), 'hero:base').status).toBe('auto');
    expect(stamp(characterState(w, { lookup: () => ({ hero: { cast: 'male' } }) }), 'hero:base')).toMatchObject({ status: 'revise', machine: ['the pinned base drifted'] });
    expect(stamp(characterState(w, { lookup: () => null }), 'hero:base').machine).toEqual(['the pinned base missing']);
  });

  it('adornment waits on the base and the actions; the systems wait on the motion too; nothing refuses', () => {
    const ready = (w, o) => characterReady(w, o);
    const w0 = world({});
    expect(ready(w0).adornment).toEqual({ ready: false, waiting: [{ id: 'hero:base', status: 'proposed' }, { id: 'hero:actions', status: 'proposed' }] });
    // approve the base and the actions, by the creator
    let review = approveCharacter(w0, 'hero:base');
    const w1 = { ...w0, review };
    review = approveCharacter(w1, 'hero:actions');
    const w2 = { ...w0, review };
    expect(ready(w2).adornment).toEqual({ ready: true, waiting: [] });
    expect(ready(w2).systems).toEqual({ ready: false, waiting: [{ id: 'hero:motion', status: 'proposed' }] });
    const w3 = { ...w0, review: approveCharacter(w2, 'hero:motion') };
    expect(ready(w3).systems.ready).toBe(true);
    // the equipment waits on the stats as well: `mechanics` is not built while it is reserved
    expect(ready(w3).equipment).toEqual({ ready: false, waiting: [{ id: 'mechanics', status: 'not built' }] });
    expect(ready(w0).equipment.waiting.map((x) => x.id)).toEqual(['hero:base', 'hero:actions', 'hero:motion', 'mechanics']);
    // the actions page changing after approval puts adornment back to waiting
    expect(ready({ ...w3, characters: { ...w3.characters, hero: { actions: complete } } }).adornment.waiting).toEqual([{ id: 'hero:actions', status: 'changed' }]);
  });
});

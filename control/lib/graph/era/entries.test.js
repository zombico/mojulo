import { describe, it, expect } from 'vitest';
import { stageEntryCards, kitCard, lookCard, stageHubCard, STAGE_CARD_BODY_CEILING } from './entries.js';
import { STAGE_KITS, planStage } from './stage.js';
import { SIXTH_GEN_REFERENCES } from './sixth-gen.js';
import { getViewVocabCatalog, _resetViewVocabCache } from '../views/view-vocab/loader.js';
import { getViewVocabHandler } from '../../mcp/tools/create-view.js';

const starterOf = (body) => JSON.parse(body.split('\n').find((l) => /^ {2}\{"kind":"stage"/.test(l)).trim());

describe('stage entries: generated kit and look cards', () => {
  it('gives the stage a hub, every kit a card and every reference a look', () => {
    const ids = stageEntryCards().map((c) => c.id);
    expect(ids[0]).toBe('stage');
    for (const k of Object.keys(STAGE_KITS)) expect(ids).toContain(`stage/${k}`);
    for (const r of Object.keys(SIXTH_GEN_REFERENCES)) expect(ids).toContain(`look/${r}`);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps every body within its ceiling', () => {
    for (const c of stageEntryCards()) expect(c.body.length, c.id).toBeLessThanOrEqual(STAGE_CARD_BODY_CEILING);
  });

  it('every room-kit starter plans, and every open-ground starter names its kit alone', () => {
    for (const k of Object.keys(STAGE_KITS)) {
      const m = starterOf(kitCard(k).body);
      expect(m.kit).toBe(k);
      if (m.rooms) expect(() => planStage(m), k).not.toThrow();
      else expect(['nature', 'jungle', 'isekai'], k).toContain(STAGE_KITS[k].shell);
    }
    for (const r of Object.keys(SIXTH_GEN_REFERENCES)) expect(() => planStage(starterOf(lookCard(r).body)), r).not.toThrow();
  });

  it('offers an option only where the kit takes it', () => {
    for (const k of Object.keys(STAGE_KITS)) {
      const m = starterOf(kitCard(k).body), body = kitCard(k).body;
      if (!m.rooms) continue;
      const night = () => planStage({ ...m, time: 'night' });
      if (body.includes('"time": "night"')) expect(night, k).not.toThrow(); else expect(night, k).toThrow(/night/);
    }
  });

  it('names an unbuilt kit as unbuilt, never as a card to open', () => {
    for (const [r, R] of Object.entries(SIXTH_GEN_REFERENCES)) {
      const body = lookCard(r).body;
      if (STAGE_KITS[R.kit]) expect(body).toContain(`card 'stage/${R.kit}'`);
      else expect(body).toMatch(/named but not built yet/);
    }
    expect(stageHubCard().body).toMatch(/Named, not built/);
  });

  it('is in the view-vocab catalog and its reader, under family world', async () => {
    _resetViewVocabCache();
    const cat = getViewVocabCatalog();
    for (const c of stageEntryCards()) expect(cat.get(c.id)?.family).toBe('world');
    const one = await getViewVocabHandler({ id: 'look/sunshine' });
    expect(one.ok).toBe(true);
    const rows = await getViewVocabHandler({ family: 'world' });
    expect(rows.cards.map((c) => c.id)).toEqual(expect.arrayContaining(['stage', 'stage/gothic-nave', 'look/dmc3']));
  });
});

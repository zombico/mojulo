import { describe, it, expect, beforeAll } from 'vitest';
import {
  SOLID_KINDS,
  EDIT_OPS,
  mintSolidHandler,
  editSolidHandler,
  getSolidVocabHandler,
} from '@/lib/mcp/tools/mint-solid';

// The names folded into mint_solid / edit_solid in 1.1.0. They were unlisted aliases for two majors and are gone:
// nothing registers them, so a stored plan naming one compiles back to a draft that names it.
const RETIRED = [
  'create_figure', 'emote_figure', 'create_manji_tree', 'sketch_polygomer',
  'create_polygonized_sketch', 'get_polygonizer_packet', 'submit_polygonizer_manifest',
  'create_workbench', 'create_assembler', 'create_carved_solid', 'create_solid_turntable',
  'create_edifice', 'preview_vehicle_instance', 'get_skin_packet', 'skin_polygomer',
];

describe('mint_solid consolidation', () => {
  let server;
  beforeAll(async () => {
    server = await import('@/lib/mcp/server');
    await server.ensureToolsRegistered();
  });

  it('registers mint_solid / edit_solid / get_solid_vocab as LISTED tools', () => {
    for (const name of ['mint_solid', 'edit_solid', 'get_solid_vocab']) {
      expect(server.isToolListed(name), `${name} listed`).toBe(true);
    }
  });

  it('the folded names are gone: none is registered', () => {
    for (const name of RETIRED) expect(server.hasRegisteredTool(name), `${name} registered`).toBe(false);
  });

  it('get_solid_vocab lists a card per kind + op, and reads one by id', async () => {
    const list = await getSolidVocabHandler({});
    const ids = list.cards.map((c) => c.id).sort();
    // one card per mint_solid kind + the two edit ops + fabricate_solid's manual + verify_machina's + the persona's
    // (create_character)
    expect(ids).toEqual(
      ['animal', 'assembler', 'carved-solid', 'code', 'edifice', 'emote', 'equipment', 'fabricate', 'figure', 'furniture', 'layered', 'machina', 'manji-tree', 'persona', 'scad', 'skin', 'solid-turntable', 'vehicle', 'workbench'].sort(),
    );
    const one = await getSolidVocabHandler({ id: 'figure' });
    expect(one.ok).toBe(true);
    expect(one.card.id).toBe('figure');
    expect(one.card.entry).toBe('mint_solid');
    await expect(getSolidVocabHandler({ id: 'nope' })).rejects.toThrow(/unknown card/);
  });

  // the npm package ships no docs/: a card that points at a repo-only docs script says so, and says what that script's
  // page fetches (the layered card's animations viewer loads three.js from jsdelivr)
  it('a card pointing at a repo-only docs script says it is source-checkout only, and what its page fetches', async () => {
    const { card } = await getSolidVocabHandler({ id: 'layered' });
    const at = card.body.indexOf('view-animations.mjs');
    expect(at).toBeGreaterThan(-1);
    const around = card.body.slice(Math.max(0, at - 200), at + 300).replace(/\s+/g, ' ');
    expect(around).toMatch(/In a source checkout \(`docs\/` is not in the npm package\)/);
    expect(around).toMatch(/loads three\.js from jsdelivr/);
  });

  it('every solid-vocab card id matches a mint_solid kind or edit_solid op (or is fabricate_solid\'s manual)', async () => {
    const list = await getSolidVocabHandler({});
    const known = new Set([...Object.keys(SOLID_KINDS), ...Object.keys(EDIT_OPS)]);
    for (const card of list.cards) {
      if (card.entry === 'fabricate_solid') { expect(card.id).toBe('fabricate'); continue; }
      if (card.entry === 'verify_machina') { expect(card.id).toBe('machina'); continue; }
      // (a persona is no solid: create_character's record of its own, persona/persona.js)
      if (card.id === 'persona') { expect(card.entry).toBe('create_character'); continue; }
      expect(known.has(card.id), `card ${card.id} maps to a kind/op`).toBe(true);
    }
  });

  it('unknown kind / op errors point at the vocab reader', async () => {
    await expect(mintSolidHandler({ kind: 'nope' })).rejects.toThrow(/unknown kind 'nope'/);
    await expect(editSolidHandler({ op: 'nope' })).rejects.toThrow(/unknown op 'nope'/);
  });

  it('mint_solid dispatches a kind', async () => {
    // solid-turntable is the cheapest kind (no LLM, deterministic recipe).
    const spec = { shape: 'sphere', color: '#5f86ad' };
    const viaMint = await mintSolidHandler({ kind: 'solid-turntable', title: 'mint_solid smoke', spec });
    expect(viaMint.ok).toBe(true);
    expect(viaMint.ref).toBeTruthy();
    const viaRegistry = await server.invokeRegisteredTool('mint_solid', { kind: 'solid-turntable', title: 'registry smoke', spec });
    expect(viaRegistry.ok).toBe(true);
  });
});

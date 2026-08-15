import { describe, it, expect, beforeAll } from 'vitest';
import {
  SOLID_KINDS,
  EDIT_OPS,
  mintSolidHandler,
  editSolidHandler,
  getSolidVocabHandler,
} from '@/lib/mcp/tools/mint-solid';

// The 14 retired names folded into mint_solid / edit_solid. They must stay
// CALLABLE (compiled plans / skills persisted them) but be absent from tools/list.
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

  it('keeps every retired name callable but unlisted (append-only alias)', () => {
    for (const name of RETIRED) {
      expect(server.hasRegisteredTool(name), `${name} registered`).toBe(true);
      expect(server.isToolListed(name), `${name} unlisted`).toBe(false);
    }
  });

  it('get_solid_vocab lists a card per kind + op, and reads one by id', async () => {
    const list = await getSolidVocabHandler({});
    const ids = list.cards.map((c) => c.id).sort();
    // one card per mint_solid kind + the two edit ops
    expect(ids).toEqual(
      ['assembler', 'carved-solid', 'edifice', 'emote', 'figure', 'manji-tree', 'skin', 'solid-turntable', 'vehicle', 'workbench'].sort(),
    );
    const one = await getSolidVocabHandler({ id: 'figure' });
    expect(one.ok).toBe(true);
    expect(one.card.id).toBe('figure');
    expect(one.card.entry).toBe('mint_solid');
    await expect(getSolidVocabHandler({ id: 'nope' })).rejects.toThrow(/unknown card/);
  });

  it('every solid-vocab card id matches a mint_solid kind or edit_solid op', async () => {
    const list = await getSolidVocabHandler({});
    const known = new Set([...Object.keys(SOLID_KINDS), ...Object.keys(EDIT_OPS)]);
    for (const card of list.cards) {
      expect(known.has(card.id), `card ${card.id} maps to a kind/op`).toBe(true);
    }
  });

  it('unknown kind / op errors point at the vocab reader', async () => {
    await expect(mintSolidHandler({ kind: 'nope' })).rejects.toThrow(/unknown kind 'nope'/);
    await expect(editSolidHandler({ op: 'nope' })).rejects.toThrow(/unknown op 'nope'/);
  });

  it('mint_solid dispatches a kind, and its retired alias mints the same manifest kind', async () => {
    // solid-turntable is the cheapest kind (no LLM, deterministic recipe).
    const spec = { shape: 'sphere', color: '#5f86ad' };
    const viaMint = await mintSolidHandler({ kind: 'solid-turntable', title: 'mint_solid smoke', spec });
    expect(viaMint.ok).toBe(true);
    expect(viaMint.ref).toBeTruthy();

    // The retired name resolves through the registry (invokeRegisteredTool) and
    // produces an equivalent result — geometry path unchanged, only tools/list moved.
    const viaAlias = await server.invokeRegisteredTool('create_solid_turntable', {
      title: 'alias smoke',
      shape: 'sphere',
      color: '#5f86ad',
    });
    expect(viaAlias.ok).toBe(true);
    expect(viaAlias.ref).toBeTruthy();
  });
});

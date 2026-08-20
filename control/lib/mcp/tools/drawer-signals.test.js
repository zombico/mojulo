// Isolate to in-memory SQLite — must run before any import that pulls in
// db/index.js. Same pattern as context.test.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect } from 'vitest';
import { DRAWER_TOOL_RE, DRAWER_MISS_ERROR_RE } from '@/lib/db/repositories/mcpToolCalls';
import { creativeToolsetHandler } from './context.js';
import { getSketchVocabHandler, getStyleVocabHandler } from './sketches.js';
import { getViewVocabHandler } from './create-view.js';
import { getSolidVocabHandler } from './mint-solid.js';
import { getMotionVocabHandler } from './motion.js';
import { getBeatsVocabHandler } from './beats.js';
import { getGameVocabHandler } from './create-game.js';
import { getVoiceVocabHandler } from './voice.js';

// ---------------------------------------------------------------------------
// Drawer-miss visibility convention (routing-context-weaving.plan.md E2).
//
// The orientation cut (McpToolCallRepository.orientationGaps) can only count a
// drawer miss it can SEE: either the handler attaches a soft-miss signal
// ({ id_requested: true, found: false }) or it throws an error whose message
// matches DRAWER_MISS_ERROR_RE. A drawer that rejects an unknown id any other
// way is invisible — get_sketch_vocab was exactly that hole until E1.
//
// This sweep pins the convention mechanically: every LISTED tool matching
// DRAWER_TOOL_RE must have a fixture entry below (adding a vocab drawer
// without one fails the coverage test), and each fixture entry's miss + index
// paths are exercised against the convention.
// ---------------------------------------------------------------------------

// tool name → { handler, missInput, indexInput }. `missInput` asks for an id
// that cannot exist; `indexInput` is the no-id index read.
const DRAWER_FIXTURES = {
  get_creative_toolset: {
    handler: creativeToolsetHandler,
    missInput: { form: '__no_such_form__' },
    indexInput: {},
  },
  get_sketch_vocab: {
    handler: getSketchVocabHandler,
    missInput: { id: '__no_such_card__' },
    indexInput: {},
  },
  get_style_vocab: {
    handler: getStyleVocabHandler,
    missInput: { id: '__no_such_card__' },
    indexInput: {},
  },
  get_view_vocab: {
    handler: getViewVocabHandler,
    missInput: { id: '__no_such_card__' },
    indexInput: {},
  },
  get_solid_vocab: {
    handler: getSolidVocabHandler,
    missInput: { id: '__no_such_card__' },
    indexInput: {},
  },
  get_motion_vocab: {
    handler: getMotionVocabHandler,
    missInput: { id: '__no_such_card__' },
    indexInput: {},
  },
  get_beats_vocab: {
    handler: getBeatsVocabHandler,
    missInput: { id: '__no_such_card__' },
    indexInput: {},
  },
  get_game_vocab: {
    handler: getGameVocabHandler,
    missInput: { id: '__no_such_card__' },
    indexInput: {},
  },
};

// Drawers with NO id parameter — the whole drawer is the only read, so no
// miss path exists and the convention doesn't apply.
const NO_ID_DRAWERS = new Set(['get_voice_vocab']);

describe('drawer-miss visibility convention — every vocab drawer is countable by the orientation cut', () => {
  it('every listed drawer tool has a fixture entry (or is an explicit no-id exemption)', async () => {
    const { ensureToolsRegistered, listTools } = await import('@/lib/mcp/server');
    await ensureToolsRegistered();
    // The orientation cut counts LISTED drawer tools — force flat so packs mode
    // (now the default) doesn't fold the vocab drawers off the connect surface.
    const prevPacks = process.env.MOJULO_TOOL_PACKS;
    process.env.MOJULO_TOOL_PACKS = 'off';
    const drawerTools = listTools()
      .map((t) => t.name)
      .filter((name) => DRAWER_TOOL_RE.test(name));
    if (prevPacks === undefined) delete process.env.MOJULO_TOOL_PACKS;
    else process.env.MOJULO_TOOL_PACKS = prevPacks;
    expect(drawerTools.length).toBeGreaterThan(0);
    const uncovered = drawerTools.filter(
      (name) => !(name in DRAWER_FIXTURES) && !NO_ID_DRAWERS.has(name),
    );
    expect(
      uncovered,
      'new drawer tool(s) missing from DRAWER_FIXTURES — add a fixture so misses stay visible to the orientation cut',
    ).toEqual([]);
  });

  for (const [tool, { handler, missInput }] of Object.entries(DRAWER_FIXTURES)) {
    it(`${tool}: an unknown id is visible — countable throw or soft-miss signal`, async () => {
      let result = null;
      let error = null;
      try {
        result = await handler(missInput);
      } catch (err) {
        error = err;
      }
      if (error) {
        expect(
          error.message,
          `${tool} threw on an unknown id but the message doesn't match DRAWER_MISS_ERROR_RE — the miss is invisible to orientationGaps`,
        ).toMatch(DRAWER_MISS_ERROR_RE);
      } else {
        expect(
          result?._telemetrySignal,
          `${tool} resolved on an unknown id without a soft-miss signal — the miss is invisible to orientationGaps`,
        ).toMatchObject({ id_requested: true, found: false });
      }
    });
  }

  for (const [tool, { handler, indexInput }] of Object.entries(DRAWER_FIXTURES)) {
    it(`${tool}: the index read carries a hit signal ({ id_requested: false, found: true })`, async () => {
      const result = await handler(indexInput);
      expect(result?._telemetrySignal).toMatchObject({ id_requested: false, found: true });
    });
  }

  it('no-id drawers resolve their whole-drawer read (exemption stays honest)', async () => {
    const result = await getVoiceVocabHandler();
    expect(result).toBeTruthy();
  });
});

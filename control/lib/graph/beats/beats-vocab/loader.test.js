import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { getBeatsVocabCard } from './loader.js';

// Every `get_beats_vocab({ id: '…' })` pointer the agent reads (tool errors, view cards, routing cards, the beats
// cards themselves) names a card that exists: a stale id sends the agent to an "unknown card" error.
const ROOTS = ['lib/mcp/tools', 'lib/mcp/routing-cards', 'lib/graph/views/view-vocab', 'lib/graph/beats'];
const POINTER = /get_beats_vocab\(\{ id: '([a-z0-9-]+)' \}\)/g;

function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(js|md)$/.test(f) && !/\.test\.js$/.test(f) && !/\.plan\.md$/.test(f) ? [p] : [];
  });
}

describe('beats vocab pointers', () => {
  it('every get_beats_vocab id named in tool text and cards is a card', () => {
    const stale = [];
    for (const root of ROOTS) {
      for (const f of files(root)) {
        for (const [, id] of readFileSync(f, 'utf8').matchAll(POINTER)) if (!getBeatsVocabCard(id)) stale.push(`${f}: ${id}`);
      }
    }
    expect(stale).toEqual([]);
  });

  it('the world audio channel has its card', () => {
    expect(getBeatsVocabCard('beats-world-audio')?.body).toContain('soundtrack');
  });
});

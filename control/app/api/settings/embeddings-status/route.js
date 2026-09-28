/**
 * GET /api/settings/embeddings-status
 *
 * Reports the embedding provider available to vector search. The local ONNX
 * model (`@huggingface/transformers`) is the opt-in `recall` install group
 * (lib/mcp/packs.js), so `hasEmbeddingsProvider` is the group's presence and
 * `install` names the line that adds it. Its 2.x caller, the bot wizard's
 * keyword/vector toggle, left with the chatbot factory in 3.0.0; the read
 * stays as the recall group's status.
 */

import { NextResponse } from 'next/server';
import {
  LOCAL_EMBEDDING_MODEL,
  recallInstallLine,
  embedderAvailable,
} from '@/lib/embedder/local';

export async function GET() {
  const available = embedderAvailable();
  return NextResponse.json({
    hasEmbeddingsProvider: available,
    provider: available ? 'local' : 'none',
    model: available ? LOCAL_EMBEDDING_MODEL : null,
    group: 'recall',
    ...(available ? {} : { install: recallInstallLine() }),
  });
}

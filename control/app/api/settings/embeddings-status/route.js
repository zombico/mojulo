/**
 * GET /api/settings/embeddings-status
 *
 * Reports the embedding provider available to vector RAG. The local ONNX
 * model (`@huggingface/transformers`) is the opt-in `recall` install group
 * (lib/mcp/packs.js), so `hasEmbeddingsProvider` is the group's presence and
 * `install` names the line that adds it. The wizard polls this to surface the
 * model name on the keyword/vector toggle card.
 */

import { NextResponse } from 'next/server';
import {
  LOCAL_EMBEDDING_MODEL,
  RECALL_INSTALL_LINE,
  embedderAvailable,
} from '@/lib/embedder/local';

export async function GET() {
  const available = embedderAvailable();
  return NextResponse.json({
    hasEmbeddingsProvider: available,
    provider: available ? 'local' : 'none',
    model: available ? LOCAL_EMBEDDING_MODEL : null,
    group: 'recall',
    ...(available ? {} : { install: RECALL_INSTALL_LINE }),
  });
}

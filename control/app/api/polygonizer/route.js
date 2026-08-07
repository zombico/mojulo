/**
 * POST /api/polygonizer — one-trip polygonizer prompt orchestration.
 *
 * Body:
 * {
 *   prompt: string,
 *   provider?, model?, apiKey?, apiKeyId?,
 *   repair?: "off" | "auto",
 *   mint?: boolean,
 *   ref?, title?
 * }
 */

import { NextResponse } from 'next/server';
import {
  polygonizePrompt,
  resolvePolygonizerModelConfig,
} from '@/lib/graph/polygonizer/index.js';
import { mintSketch } from '@/lib/mcp/tools/sketches.js';

function errorResponse(message, status = 400, extra = {}) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body');
  }

  const {
    prompt,
    provider,
    model,
    apiKey,
    apiKeyId,
    repair = 'off',
    mint = false,
    ref,
    title,
  } = body || {};

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return errorResponse('`prompt` is required');
  }
  if (repair !== 'off' && repair !== 'auto') {
    return errorResponse('`repair` must be "off" or "auto"');
  }

  let config;
  try {
    config = await resolvePolygonizerModelConfig({ provider, apiKey, apiKeyId, model });
  } catch (err) {
    return errorResponse(err.message);
  }

  try {
    const result = await polygonizePrompt({
      prompt,
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model,
      maxRepairs: repair === 'auto' ? 1 : 0,
    });

    const response = {
      ok: result.ok,
      attempts: result.attempts,
      provider: config.provider,
      model: config.model,
      manifest: result.manifest,
      expandedManifest: result.expandedManifest,
      errors: result.errors,
      repairPrompt: result.ok ? undefined : result.repairPrompt,
    };

    if (result.ok && mint) {
      const minted = mintSketch({
        title: title || result.manifest?.title || prompt,
        manifest: result.manifest,
        ref,
      });
      response.sketch = minted;
    }

    return NextResponse.json(response, { status: result.ok ? 200 : 422 });
  } catch (err) {
    console.error('[polygonizer] failed:', err);
    return errorResponse(err.message || 'Polygonizer failed', 500);
  }
}


/**
 * /api/agent-ui/respond — the reverse path for agent-routed chat decisions.
 *
 * When the fulfilling worker calls `request_chat_decision`, the open chat SSE
 * stream renders an inline decision card. The browser POSTs the operator's
 * answer here; we resolve the pending decision in the agent-ui signal bus,
 * which unblocks the worker's `request_chat_decision` long-poll.
 *
 * Browser-facing (same-origin, session-cookie auth via getCurrentUser), unlike
 * the bearer-gated agent-callable surface. Single-user control plane, so the
 * only additional guard is matching the decision's `sessionId`.
 *
 * See lite-template/integration/app-system/0528/agent-routed-chat-ui-signals.md
 */

import { getCurrentUser } from '@/lib/auth/service';
import { resolveDecision, getDecisionMeta } from '@/lib/agent-ui/signal-bus';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(request) {
  try {
    await getCurrentUser();

    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid JSON body' }, 400);

    const { session_id: sessionId, prompt_id: promptId, selected, text } = body;
    if (!promptId || typeof promptId !== 'string') {
      return json({ error: 'prompt_id is required' }, 400);
    }

    const meta = getDecisionMeta(promptId);
    if (!meta) {
      return json({ error: 'Unknown or already-settled prompt' }, 404);
    }
    if (sessionId && meta.sessionId !== sessionId) {
      return json({ error: 'Session does not own this prompt' }, 403);
    }

    const hasSelected = typeof selected === 'string' && selected.length > 0;
    const hasText = typeof text === 'string' && text.trim().length > 0;
    if (!hasSelected && !hasText) {
      return json({ error: 'Provide `selected` or `text`' }, 400);
    }

    const result = resolveDecision(promptId, {
      selected: hasSelected ? selected : null,
      text: hasText ? text : null,
    });
    if (!result.ok) {
      return json({ error: result.reason }, 409);
    }

    return json({ ok: true });
  } catch (err) {
    console.error('[agent-ui/respond] error:', err);
    return json({ error: err.message || 'Internal server error' }, 500);
  }
}

/**
 * Mojulo — Home agent chat (stateless, unfiltered).
 *
 * A porthole straight to the operator's local agent. Unlike /api/builder/stream
 * this creates NO BuilderSession and writes nothing to the DB — the browser
 * owns the conversation id + history and replays history each turn. "No
 * context" is literal: the server holds nothing between turns.
 *
 * Always agent-routed: it parks a `host_chat` task on the agent-tasks queue and
 * the local agent fulfills it (see lib/agent-chat/relay.js). It never runs a
 * control-plane Claude loop, so it needs no LLM-key gate and ignores the
 * builder driver mode. The difference from the builder chat is entirely the
 * worker brief the puller follows: run-host-chat-worker.md frames the agent as
 * itself, with no builder persona.
 *
 * See lite-template/integration/app-system/0528/home-agent-chat.md.
 */

import { getCurrentUser } from '@/lib/auth/service';
import { relayAgentTurn } from '@/lib/agent-chat/relay';
import { parseDocument } from '@/lib/document-parser';
import { checkRateLimit, RateLimitPresets } from '@/lib/rate-limiter';

const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function inferMime(file) {
  if (file.type) return file.type;
  const ext = (file.name || '').split('.').pop()?.toLowerCase();
  const byExt = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    pdf: 'application/pdf',
    txt: 'text/plain',
    md: 'text/markdown',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return byExt[ext] || 'application/octet-stream';
}

/**
 * Classify attachments without persisting anything. The first image rides the
 * queue's native image block; text-extractable docs are parsed inline and
 * appended to the turn text, then discarded. No DocumentRepository row.
 */
async function processHomeAttachments(files) {
  let image = null;
  const docTexts = [];
  for (const file of files) {
    if (!file?.base64) continue;
    const mime = inferMime(file);
    if (IMAGE_MIMES.has(mime)) {
      // Only the first image is forwarded (the queue carries one image block).
      if (!image) image = { base64: file.base64, mime };
      continue;
    }
    try {
      const buffer = Buffer.from(file.base64, 'base64');
      const content = await parseDocument(buffer, file.name);
      if (content) docTexts.push(`[Attached: ${file.name}]\n${content}`);
    } catch (err) {
      docTexts.push(`[Attached: ${file.name} — could not be read: ${err.message}]`);
    }
  }
  return { image, extraText: docTexts.join('\n\n') };
}

export async function POST(request) {
  const rateLimit = checkRateLimit(request, {
    ...RateLimitPresets.expensive,
    keyPrefix: 'agent-chat:stream',
  });
  if (!rateLimit.allowed) return rateLimit.response;

  try {
    await getCurrentUser();

    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid JSON body' }, 400);

    const { message, conversationId, history, files, locale } = body;
    if (!message || typeof message !== 'string') {
      return json({ error: 'message is required (string)' }, 400);
    }
    if (!conversationId || typeof conversationId !== 'string') {
      return json({ error: 'conversationId is required (string)' }, 400);
    }

    const safeHistory = Array.isArray(history)
      ? history
          .filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
          .map((m) => ({ role: m.role, content: m.content }))
      : [];

    const attachments = Array.isArray(files) && files.length > 0
      ? await processHomeAttachments(files)
      : { image: null, extraText: '' };

    const text = attachments.extraText
      ? `${message}\n\n${attachments.extraText}`
      : message;

    const extraInputs = {};
    if (attachments.image) {
      extraInputs.image_base64 = attachments.image.base64;
      extraInputs.image_mime = attachments.image.mime;
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // session event lets the client confirm the conversation id the
          // server is keying the signal bus + any decision prompts on.
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'session', conversationId, timestamp: Date.now() })}\n\n`,
            ),
          );

          // TEMPORARY: park as `chat_turn` (not `host_chat`) so the operator's
          // existing bot-builder worker — which long-polls `kinds: ['chat_turn']`
          // — claims and answers it immediately. Parking `host_chat` requires a
          // worker pulling that kind; until one is wired up, a `host_chat` turn
          // sits unclaimed and the SSE hangs until the submit timeout. The cost
          // of this fallback is persona: the builder worker answers with its
          // builder framing rather than as the unfiltered host agent. Restore
          // `host_chat` once a worker (or a both-kinds worker) pulls it — see
          // home-agent-chat.md "one worker or two?". caller_ref stays 'home_chat'
          // so the surface is still distinguishable in audit/history.
          await relayAgentTurn({
            taskKind: 'chat_turn',
            sessionId: conversationId,
            text,
            history: safeHistory,
            extraInputs,
            locale: typeof locale === 'string' ? locale : null,
            callerRef: { kind: 'home_chat', sessionId: conversationId },
            controller,
            encoder,
            doneFields: { conversationId },
          });

          controller.close();
        } catch (error) {
          console.error('[agent-chat/stream] Error:', error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', error: error.message, timestamp: Date.now() })}\n\n`,
            ),
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[agent-chat/stream] Error:', error);
    return json({ error: 'Internal server error' }, 500);
  }
}

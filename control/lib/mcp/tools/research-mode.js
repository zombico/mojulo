/**
 * MCP Ring 9 — research mode (the optional research drawer).
 *
 * The ACCRETIVE / exploratory counterpart to plan mode. Where a Plan pushes
 * toward an outcome, a Research session has no goal but to assist the user —
 * it accretes broad material (links, articles, summaries, screencaps, notes)
 * into a durable, book-like context. Starting a session auto-saves it. Its one
 * structured output is synthesize_abstract: a distilled thesis sent to plan
 * mojulo for evaluation, optionally forging a Draft plan.
 *
 * Deliberately a LOW-PROMINENCE drawer (posture-sibling to sketches): NOT woven
 * into forward_context, no quick-orientation rule. The agent enters research
 * mode only when the user explicitly asks to research / gather / look into
 * something — discovered via tools/list, primed by enter_research_mode.
 *
 * Tool surface:
 *   - enter_research_mode   — the light research brief (opposite of the
 *     four-lens plan discipline; trust the model's natural research strength).
 *   - start_research        — auto-save a session.
 *   - bind_research_item    — accrete a broad item.
 *   - synthesize_abstract   — distill the book; optionally evaluate via the
 *     research→plan bridge.
 *   - get_research          — read a full book (session + items + abstracts).
 *   - list_research         — list sessions.
 *
 * One-way coupling: research depends on plans (via lib/research/evaluate.js);
 * plans never import research. See
 * lite-template/integration/app-system/0528/research-mode.md.
 */

import { registerTool } from '@/lib/mcp/server';
import { ResearchRepository } from '@/lib/db/repositories/research';
import { evaluateAbstract } from '@/lib/research/evaluate';

// Broad but known item kinds. A book holds anything, but the bind tool gates
// on this set so a typo doesn't silently create a junk kind. Adding a kind is
// a one-line change here — the table column stays freeform on purpose.
const KNOWN_KINDS = new Set([
  'link',
  'article',
  'summary',
  'screencap',
  'note',
  'quote',
  'snippet',
]);

const RESEARCH_BRIEF = `# Research mode

You are in **research mode** — an optional drawer for gathering. Unlike plan mode, there is **no goal but to assist the user**, and no terminus. You are writing a durable book.

## What to do

- **Bind broadly.** Anything that helps: a \`link\`, an \`article\` (with its fetched text), a \`summary\` you wrote, a \`screencap\`, a \`note\`, a \`quote\`, a \`snippet\`. Bind summaries you generate as their own items so the book remembers what it concluded. The book holds anything.
- **Trust your natural strength.** Mojulo doesn't prescribe a research method — read, connect, summarize on demand. The substrate just gives you a durable place to write and a pipe to hand finished thoughts downstream.
- **Never force convergence.** A research session can outlive many plans. Don't push toward an outcome — that's plan mode's job.

## When a concept crystallizes

If, while gathering, a concept emerges that *could become work*, call \`synthesize_abstract\` — distill the book into a tight thesis (what concept emerged, why it matters, what it implies). With \`evaluate: true\`, the abstract is sent to **plan mojulo** for evaluation against the plans paradigm. Supply your own judgment: a \`suggested_lens\` (spike / segment_expansion / vertical_reinforcement / collider) and a \`recommendation\` — \`forge\` if there's a tractable spike here (plan mojulo will forge a Draft plan seeded from the abstract), or \`keep_researching\` with a \`missing\` list if the book isn't ripe yet. Forging a plan does nothing on its own; it just hands the baton to plan mode.

## Lifecycle

start_research (auto-saves) → bind_research_item (loop, broadly) → synthesize_abstract (distill → optionally evaluate). No compile, no execute. You decide if and when to synthesize.`;

// ---------------------------------------------------------------------------
// handlers
// ---------------------------------------------------------------------------

export async function enterResearchModeHandler(_input, _ctx) {
  return { brief: RESEARCH_BRIEF };
}

export async function startResearchHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('start_research requires an object with title');
  }
  const session = ResearchRepository.startSession({ title: input.title });
  return { ok: true, research_ref: session.researchRef, title: session.title, status: session.status };
}

export async function bindResearchItemHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('bind_research_item requires an object');
  }
  const { research_ref, kind, title, body, source_url, media_ref, metadata } = input;
  if (!research_ref || typeof research_ref !== 'string') {
    throw new Error('research_ref is required');
  }
  if (!kind || typeof kind !== 'string') {
    throw new Error('kind is required');
  }
  if (!KNOWN_KINDS.has(kind)) {
    throw new Error(
      `kind '${kind}' is not recognized. Known kinds: ${[...KNOWN_KINDS].join(', ')}.`,
    );
  }
  const item = ResearchRepository.bindItem({
    researchRef: research_ref,
    kind,
    title,
    body,
    sourceUrl: source_url,
    mediaRef: media_ref,
    metadata,
  });
  return { ok: true, item_id: item.id, research_ref: item.researchRef, kind: item.kind };
}

export async function synthesizeAbstractHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('synthesize_abstract requires an object with research_ref + abstract');
  }
  const {
    research_ref,
    abstract,
    evaluate,
    suggested_lens,
    recommendation,
    missing,
    plan_title,
  } = input;
  if (!research_ref || typeof research_ref !== 'string') {
    throw new Error('research_ref is required');
  }
  if (!abstract || typeof abstract !== 'string') {
    throw new Error('abstract is required (the distilled thesis text)');
  }
  const session = ResearchRepository.getSession(research_ref);
  if (!session) {
    throw new Error(`Research session '${research_ref}' not found.`);
  }

  const itemCount = ResearchRepository.countItems(research_ref);
  const row = ResearchRepository.insertAbstract({ researchRef: research_ref, body: abstract, itemCount });

  if (!evaluate) {
    return { ok: true, abstract_id: row.id, item_count: itemCount, evaluated: false };
  }

  // In-process short-circuit to the same evaluator the HTTP bridge wraps.
  const { assessment, planRef } = evaluateAbstract({
    researchRef: research_ref,
    abstract,
    suggestedLens: suggested_lens,
    recommendation,
    missing,
    planTitle: plan_title,
  });
  ResearchRepository.attachAbstractEvaluation(row.id, { planRef, assessment });

  return {
    ok: true,
    abstract_id: row.id,
    item_count: itemCount,
    evaluated: true,
    assessment,
    ...(planRef
      ? { plan_ref: planRef, message: `Abstract evaluated as tractable — forged Draft plan ${planRef}. Open plan mode to develop it.` }
      : { message: `Abstract recorded; plan mojulo recommends continued research${assessment.missing.length ? `: ${assessment.missing.join('; ')}` : '.'}` }),
  };
}

export async function getResearchHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('get_research requires an object with research_ref');
  }
  const { research_ref } = input;
  if (!research_ref || typeof research_ref !== 'string') {
    throw new Error('research_ref is required');
  }
  const book = ResearchRepository.getFullBook(research_ref);
  if (!book) {
    throw new Error(`Research session '${research_ref}' not found.`);
  }
  return {
    research_ref: book.session.researchRef,
    title: book.session.title,
    status: book.session.status,
    created_at: book.session.createdAt,
    updated_at: book.session.updatedAt,
    items: book.items.map((it) => ({
      item_id: it.id,
      kind: it.kind,
      title: it.title,
      body: it.body,
      source_url: it.sourceUrl,
      media_ref: it.mediaRef,
      metadata: it.metadata,
      created_at: it.createdAt,
    })),
    abstracts: book.abstracts.map((a) => ({
      abstract_id: a.id,
      body: a.body,
      item_count: a.itemCount,
      plan_ref: a.planRef,
      assessment: a.assessment,
      created_at: a.createdAt,
    })),
  };
}

export async function listResearchHandler(input, _ctx) {
  const { status } = input || {};
  const sessions = ResearchRepository.listSessions(status ? { status } : {});
  return {
    total: sessions.length,
    sessions: sessions.map((s) => ({
      research_ref: s.researchRef,
      title: s.title,
      status: s.status,
      created_at: s.createdAt,
      updated_at: s.updatedAt,
    })),
  };
}

// ---------------------------------------------------------------------------
// registration
// ---------------------------------------------------------------------------

export function registerResearchModeTools() {
  registerTool({
    name: 'enter_research_mode',
    description:
      "Ring 9 — OPTIONAL DRAWER (research mode). Returns the light research discipline: there is no goal but to assist; bind broadly (links, articles, summaries, screencaps, notes); trust your natural research strength; never force convergence. When a concept crystallizes, synthesize_abstract hands it to plan mojulo. Call ONLY when the user explicitly asks to research / gather / look into something — research mode is a drawer, not part of the main flow. Read-only.",
    inputSchema: { type: 'object', properties: {} },
    handler: enterResearchModeHandler,
  });

  registerTool({
    name: 'start_research',
    description:
      "Ring 9 — start (auto-save) a research session. Low-ceremony: the book exists the moment research begins. Returns { research_ref, title, status:'open' }. Bind items to it with bind_research_item.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short title for the research book (the topic).' },
      },
      required: ['title'],
    },
    handler: startResearchHandler,
  });

  registerTool({
    name: 'bind_research_item',
    description:
      "Ring 9 — bind a broad item to a research book. The core accretion verb; call it as many times as useful. `kind` is one of: link, article, summary, screencap, note, quote, snippet. Bind summaries you generate as their own items so the book remembers what it concluded. screencap items reference stored media via media_ref. Returns { item_id, research_ref, kind }.",
    inputSchema: {
      type: 'object',
      properties: {
        research_ref: { type: 'string', description: 'The research session to bind into.' },
        kind: {
          type: 'string',
          enum: ['link', 'article', 'summary', 'screencap', 'note', 'quote', 'snippet'],
          description: 'The kind of item.',
        },
        title: { type: 'string', description: 'Optional short title/label.' },
        body: { type: 'string', description: 'Markdown body — article text, the summary, the note, the quote, the snippet.' },
        source_url: { type: 'string', description: 'Optional source URL (for link / article / quote).' },
        media_ref: { type: 'string', description: 'Optional reference to stored media (for screencap).' },
        metadata: { type: 'object', description: 'Optional free-form metadata.' },
      },
      required: ['research_ref', 'kind'],
    },
    handler: bindResearchItemHandler,
  });

  registerTool({
    name: 'synthesize_abstract',
    description:
      "Ring 9 — distill the research book into a tight thesis (what concept emerged, why it matters, what it implies). Records the abstract (append-only history). With `evaluate: true`, sends the abstract to plan mojulo for evaluation against the plans paradigm: supply your own judgment via `suggested_lens` + `recommendation` (`forge` if there's a tractable spike — plan mojulo forges a Draft plan seeded from the abstract; `keep_researching` with a `missing` list otherwise). Returns { abstract_id, item_count, evaluated, assessment?, plan_ref? }. Forging a plan does nothing on its own — it hands the baton to plan mode.",
    inputSchema: {
      type: 'object',
      properties: {
        research_ref: { type: 'string', description: 'The research session to synthesize.' },
        abstract: { type: 'string', description: 'The distilled thesis text (markdown ok).' },
        evaluate: {
          type: 'boolean',
          description: 'When true, send the abstract to plan mojulo for evaluation (and possible Draft-plan forge).',
        },
        suggested_lens: {
          type: 'string',
          enum: ['spike', 'segment_expansion', 'vertical_reinforcement', 'collider'],
          description: 'Your judgment of which plan lens fits, if any (only used when evaluate is true).',
        },
        recommendation: {
          type: 'string',
          enum: ['forge', 'keep_researching'],
          description: "Your verdict. 'forge' = tractable spike, create a Draft plan. 'keep_researching' = not ripe yet. Defaults to keep_researching.",
        },
        missing: {
          type: 'array',
          items: { type: 'string' },
          description: 'What more research would sharpen the concept (guidance when keep_researching).',
        },
        plan_title: { type: 'string', description: 'Optional title for the forged Draft plan (defaults to the abstract first line).' },
      },
      required: ['research_ref', 'abstract'],
    },
    handler: synthesizeAbstractHandler,
  });

  registerTool({
    name: 'get_research',
    description:
      'Ring 9 — fetch a full research book: the session plus all bound items and all synthesized abstracts (with their plan_ref / assessment if evaluated). Returns the whole book.',
    inputSchema: {
      type: 'object',
      properties: {
        research_ref: { type: 'string', description: 'The research session to read.' },
      },
      required: ['research_ref'],
    },
    handler: getResearchHandler,
  });

  registerTool({
    name: 'list_research',
    description:
      "Ring 9 — list research sessions (optional `status` filter: open | archived). Returns { total, sessions: [{ research_ref, title, status, created_at, updated_at }] }, most-recently-active first.",
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['open', 'archived'], description: 'Filter by status.' },
      },
    },
    handler: listResearchHandler,
  });
}

// Test seam.
export const _internals = { KNOWN_KINDS, RESEARCH_BRIEF };

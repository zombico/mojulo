# The render handoff — a durable, drivable-cold render-worker seam

Status: proposed spike (2026-07-12). Builds the gated remainder of
image-outcomes.plan.md **I3** (the durable request queue) + the front of
**I4** (the accept/audit gate). Framed as a **bicycle** (see
[docs/bicycles.md](../../../../docs/bicycles.md)) — this is the render-worker
loop promoted from three improvised handoffs into one durable, self-
documenting, drivable-cold tool loop. Nothing here is built yet.

## Why now

mojulo designs pictures (scaffolds, meru guides, page grammar) but cannot
paint them. Every finished image needs a handoff to a worker that can. Today
there are **three** improvised handoffs, and none is durable:

- **Stills / comics** — `get_image_render_packet` (read) + `bind_image_render`
  (write). The worker returns the PNG *out of band*; binding *is* acceptance;
  no record that a render was requested; nothing survives a restart.
- **Character sheets** — `bind_character_sheet`, same out-of-band shape.
- **Keyframe cels** — the file-based keyframe bicycle (`bicycle.mjs`,
  `JOB.md`, `status.json`) — a real loop, but its state is loose files in a
  spike folder, not the substrate.

The image-outcomes plan already decided the fix (I3-durable + I4) and left it
**gated on operator review**. This spike un-gates the load-bearing half: a
DB-backed request → pull → submit → audit → accept loop that survives
restart and is driven cold by any image-capable worker.

## The load-bearing unknown (what the spike de-risks)

Not the painting — that is proven (K1 cels, the manga page, the front bank).
The unknown is the **seam**: does a durable, DB-backed handoff

1. survive a control-plane restart (a pending render is still pullable),
2. unify still / comic / cel under one request table and one worker loop,
3. drive cold — a worker with only the pull payload completes it — and
4. gate acceptance behind an audit the same worker cannot self-approve?

If those four hold on one real ref, the seam is proven and promotion to a
catalyst is mechanical.

## Precedent picked (grounded in the codebase)

- **Durability: mirror `beats_revisions`, NOT `mcp_jobs`.** The Ring 7
  agent-tasks queue (`mcp_jobs` + `lib/mcp/agent-tasks/queue`) is an
  *in-memory long-poll* — parks a typed HTTP request, resolves within a
  ~60s submit timeout, drops everything on restart. Correct for inference
  relays (something HTTP-blocks on the answer). **Wrong for renders** — a
  render takes minutes, nothing HTTP-blocks on it, and a pending render must
  outlive `npm run dev`. So the request lives in a **durable DB row**
  (the beats-sidecar pattern: table + repository + `created_at unixepoch()`).
- **Reuse the file store: `render-store.js`.** Submitted PNGs already have an
  append-only home — `nextRenderPath(ref, target)` → `render-<target>-<n>.png`
  in the outcome folder, `latestBoundRender` read by the I5 composite. The
  handoff writes through it unchanged; the DB row references the slot `n`.
- **Reuse the packet: `get_image_render_packet`.** The pull payload IS the
  packet body (instructions, scaffold URLs, workerProtocol, localParams) plus
  a `request_id`. No new packet logic — the pull just wraps it with row state.
- **Conventions: mirror `pull_agent_task` / per-kind submit.** Same worker
  vocabulary (pull → per-kind submit → cancel), same `submit_tool`-named-in-
  manifest dispatch — but backed by rows, long-lived, restart-proof.

## Design

### The durable row — `image_render_requests`

One table, request lifecycle + audit folded in (the I4 plan wants a separate
`image_outcome_renders` sidecar; for the spike ONE table proves the loop —
note the split for promotion):

```sql
CREATE TABLE IF NOT EXISTS image_render_requests (
  id             TEXT PRIMARY KEY,            -- irq_<rand> (render-event id)
  ref            TEXT NOT NULL,               -- the sketch ref (sk_…)
  target         TEXT NOT NULL,               -- 'page' | panel id | 'sheet' | 'key-N'
  kind           TEXT NOT NULL,               -- image-outcome | sequential-art | character-sheet | keyframe-cel
  manifest_hash  TEXT NOT NULL,               -- head-manifest hash at request time (idempotency + staleness)
  status         TEXT NOT NULL,               -- pending | in_flight | submitted | accepted | rejected | expired | cancelled
  render_n       INTEGER,                     -- render-store slot once submitted
  worker_audit   TEXT,                        -- JSON: what the worker claims at submit
  accept_audit   TEXT,                        -- JSON: what the accepting agent verifies
  source         TEXT,                        -- worker/harness id
  pulled_at      INTEGER,
  created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(ref, target, manifest_hash)          -- idempotent per (ref, target, head manifest)
);
CREATE INDEX IF NOT EXISTS idx_irq_status ON image_render_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_irq_ref ON image_render_requests(ref);
```

Repository beside `lib/db/repositories/beats.js`: `park`, `claimNext`,
`recordSubmit`, `recordAccept`, `recordReject`, `getById`, `listByRef`,
`listPending`.

### The tools (the bicycle's controls)

Four tools, each response naming the **next action** (self-documenting — the
bicycle property):

- **`request_image_render({ ref, target? })`** — parks a durable row per
  `renderTargets(manifest)` (the existing expansion rule shared with packet +
  bind + composite). Idempotent per `UNIQUE(ref, target, manifest_hash)` — a
  re-request against the same head manifest returns the existing rows.
  Response: the parked request ids + "workers now `pull_image_render`."
- **`pull_image_render({ ref?, kinds? })`** — claims the oldest `pending` row
  (→ `in_flight`, stamps `pulled_at`), returns the **packet** (reuse
  `get_image_render_packet`'s body) wrapped with `request_id` +
  `submit_tool: 'submit_image_render'` + the scaffold as a native image
  block. `ref` optional (a worker can target one artifact or drain the
  queue). *Spike note:* prototyped standalone to avoid destabilizing the
  in-memory inference `pull_agent_task`; converges into a durable-kind branch
  of `pull_agent_task` at promotion (the I3 plan's stated shape).
- **`submit_image_render({ request_id, image_path | image_base64, worker_audit })`**
  — copies the PNG through `render-store.nextRenderPath`, records `render_n`
  + `worker_audit` + `source`, status → `submitted`. The worker audit is
  wire-validated (per-kind submit schema, the Ring 7 pattern).
- **`accept_image_render({ request_id, accept_audit })` / `reject_image_render`**
  — the gate. Records `accept_audit`, status → `accepted` | `rejected`.
  **The same worker cannot self-accept** — accept is a distinct call with its
  own author. The I5 composite (`final.png`) reads only `accepted` renders;
  a page composites only when every target is accepted.

### The two-gate audit (kept small)

Audit only the **non-overlayable** surface — what a later SVG overlay cannot
re-impose. For the spike, two verdicts + notes:

- `worker_audit`: `{ conditioned: 'scaffold'|'prompt-only', invoked_generator: bool, scaffold_echo: bool, notes }`
  — catches the recorded failure modes (returned the wireframe / traced not
  generated). For **keyframe-cel** targets the worker audit carries the
  **deterministic meru numbers** (height ratio, ground delta) — the keyframe
  bicycle's machine gate, now a submit field.
- `accept_audit`: `{ beats_ok, forms_ok, bubble_zones_clear, identity_ok, notes }`
  — the rider's eyes gate. Recorded separately, its own author.

Full per-check schema + the deterministic edge-density check are I4 proper —
out of spike scope, noted.

### Unification (the payoff)

Still / comic panel / character sheet / **cel** all become `image_render`
requests over one table and one worker loop. The keyframe cels enter as
targets `key-0…key-N` with the meru audit as their `worker_audit` — the
file-based keyframe bicycle promotes into the durable seam, `status.json`
becoming the rows and `JOB.md` becoming the pull payload. (Wiring the cel
kind is the last spike step; the still/comic path proves the seam first.)

## Spike steps

1. **Table + repository** — migration in `lib/db/index.js` (beside
   `beats_annotations`), repository in `lib/db/repositories/`. `node --check`
   + a repo unit test (`park` idempotency, `claimNext` marks in_flight).
2. **Tools** — `request_image_render`, `pull_image_render`,
   `submit_image_render`, `accept_image_render` / `reject_image_render` in a
   new `lib/mcp/tools/render-handoff.js`, registered after the sketch tools.
   Reuse `get_image_render_packet` body + `render-store`. Routing rows in
   `TOOL_INDEX` only (forward_context stays thin).
3. **Restart-survival test** — park a request, drop the DB handle / restart,
   assert `pull_image_render` still returns it (the property `mcp_jobs`
   lacks). This is the spike's core proof.
4. **Drive it cold, once** — on a real minted image-outcome ref: request →
   pull → (paint out-of-band for the spike; a real worker generates) →
   submit → accept → `final.png` composites. Ledger the loop.
5. **Cel convergence (if time)** — one keyframe-cel ref driven through the
   same tools, meru numbers in the worker audit, `motion.gif` composited on
   accept.

**Exit:** a render request survives a restart and is pulled after it; a
worker completes request → submit → accept cold from the pull payload alone;
acceptance is refused without a distinct accept call; the loop's every
response names the next step (bicycle property 1). Retrospective section
added here, quoting what held — it gates promotion to a `render-worker`
catalyst (JOB→packet, status.json→rows, bicycle audit→submit audit).

## Out of scope (recorded)

- The separate `image_outcome_renders` sidecar table (I4) — folded into the
  request row for the spike; split at promotion.
- Full per-check acceptance schema + deterministic edge-density audit — I4.
- Converging `pull_image_render` into `pull_agent_task`'s durable-kind branch
  — promotion, once the standalone loop is proven.
- Dashboard surface (`/sketches/<ref>` render-history panel) — I4/I5.
- Multi-worker fairness / lease expiry beyond a simple `in_flight` + manual
  `cancel` — a reaper is promotion work.
</content>

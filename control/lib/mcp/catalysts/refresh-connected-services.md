---
{
  "id": "refresh-connected-services",
  "name": "Refresh connected services",
  "summary": "Audit sealed connected-service bindings for drift via meta_context_analyze, re-research the vendors that drifted, and produce a dated report + action plan.",
  "valueHook": "Turn one-time-created services into version-controlled ones — a scheduled job that catches a renamed or removed MCP tool before the service silently fails, and tells you exactly what to fix.",
  "version": 1,
  "category": "substrate",
  "requires": {
    "protocols": [],
    "writeTarget": "mojulo:meta_mcp_capabilities (on refresh) + optional report sink"
  },
  "parameters": [
    {
      "name": "refreshPolicy",
      "prompt": "When the audit flags a provider as drifted (a bound tool went missing, or its vendor knowledge aged out), should the job automatically re-run the research-mcp-vendor catalyst to refresh that provider's capability row, or only list it in the report for you to refresh by hand? Auto-research writes to mojulo's capability layer (superseding the old row); report-only writes nothing. Default: report-only.",
      "default": "report-only"
    },
    {
      "name": "reportSink",
      "prompt": "Optional MCP destination to write the drift report to each run — a document or channel MCP (e.g. a Google Doc, a Slack channel). If unset, the report is returned to you inline at the end of each run. Provide the destination's name if you want it persisted.",
      "default": null
    }
  ],
  "mcpTools": {
    "mojulo": [
      "meta_context_declare_inventory",
      "meta_context_analyze",
      "meta_context_brief",
      "get_mcp_capabilities",
      "record_mcp_capabilities"
    ],
    "destination": {
      "description": "Optional: a document- or channel-like MCP to persist the drift report to. Omit to report inline."
    }
  },
  "outputContract": {
    "report": {
      "auditedAt": "ISO timestamp of the run",
      "inventory": "{ declaredAt, ageSeconds, empty, stale } — freshness of the snapshot the audit ran against",
      "findings": "array of { severity, artifactRef, toolRef, provider, recommendation }, ranked most-actionable-first",
      "summary": "{ bySeverity, artifactsAffected, providersToRefresh }",
      "delta": "providers newly drifted since the last run (vs already-known drift)",
      "actionPlan": "ordered, operator-facing steps — which vendors to re-research, which services to re-bind or retire"
    }
  }
}
---

# Refresh connected services

Connected services — the Skills and mcp-orbit compositions the operator sealed once via
`meta_context_commit` — bind to installed MCP tools by name. Those tools drift: a vendor renames
`create_contact` to `create_object`, removes a tool, ships a new API version. Nothing re-checks a
sealed binding until it fails at runtime. This catalyst is the periodic re-check: it runs
mojulo's deterministic drift audit (`meta_context_analyze`), refreshes the vendor knowledge for
whatever drifted, and hands the operator a dated report with an action plan. It is the *reporting
and proposal* half of version control for one-time-created services — it never silently rewrites a
binding.

The audit itself is not the agent's job to reason out: `meta_context_analyze({lens:'stale-bindings'})`
does the graph join in-process and returns ranked findings. The agent's job is to run it against a
*fresh* inventory, act on the `providersToRefresh` list, and translate the findings into a plan a
human can act on.

## Materialization

Per the bound host adapter (artifact target, scheduling cadence, and dry-run encoding live there):

1. Ask the user the two `parameters` questions in one batched round. Both have safe defaults —
   `refreshPolicy: report-only` (writes nothing) and `reportSink: null` (report inline).
2. Establish the run loop the artifact will execute on each fire (see **Run loop** below). Keep it
   host-neutral; the adapter renders the schedule and the dry-run/promote affordance.
3. If `reportSink` is set, inspect that destination MCP's surface (its create/append tool + required
   fields) so the artifact can write the report there. If unset, skip — the report returns inline.
4. Hand the resolved run loop to the host adapter to materialize the runnable artifact. Name the
   artifact slug `refresh-connected-services` — one artifact per host, parameterized by scope, not
   one per service.

## Run loop (what the materialized artifact does each fire)

This is the load-bearing sequence. Order matters — step 0 is not optional.

0. **Re-declare inventory first.** `meta_context_declare_inventory` with the current MCP
   environment. Mojulo cannot introspect the connecting client, so the audit is only as fresh as
   the last declaration. Skipping this audits stale reality against stale bindings and either
   reports nothing or fires false `missing` verdicts. If the artifact runs in a context where the
   live tool list isn't available, it must at minimum surface `inventory.ageSeconds` from the
   audit output and warn the operator the verdicts may be stale — never present a `missing` as
   confirmed off a week-old snapshot.
1. **Run the audit.** `meta_context_analyze({ scope, lens: 'stale-bindings' })` — `scope` defaults
   to `{ kind: 'fleet' }`; pass `{ kind: 'artifact', ref }` to scope to one service. Read
   `findings`, `summary`, `inventory`, and `nudges` off the response.
2. **Compute the delta.** Compare `summary.providersToRefresh` against the previous run's list
   (the adapter's state store — a workspace file, an automation variable). Report *newly* drifted
   providers prominently; keep already-known drift in a quieter "still open" section. This is what
   keeps a weekly job from crying wolf about the same missing tool every week.
3. **Refresh the drifted vendors** — only when `refreshPolicy: auto-research`. For each provider in
   `providersToRefresh`, run the **research-mcp-vendor** catalyst (fetch it via
   `get_catalyst('research-mcp-vendor')` and follow its source discipline). That supersedes the
   provider's `meta_mcp_capabilities` row with freshly-researched knowledge. In `report-only` mode
   (the default), skip this — just name the providers in the action plan.
4. **Assemble the report + action plan** (see **Report shape** below), honoring the `outputContract`.
5. **Deliver.** Write to `reportSink` if set (with mojulo trace fields — see Pitfalls), else return
   inline.

## Mapping intent — findings to an action plan

The audit hands you typed severities; your value-add is turning them into ordered, specific
operator steps. Map each severity to its remedy:

- **`missing`** — a sealed service binds a tool no longer in inventory. Highest priority: this
  service is broken or about to be. Action: "Re-declare inventory to rule out a transient snapshot;
  if `<toolRef>` is still gone, the vendor likely renamed or removed it — re-research `<provider>`
  and re-bind `<artifactRef>` to the new tool, or retire the service." Name the exact `artifactRef`
  and `toolRef` from the finding.
- **`stale-capability`** — tool present, but mojulo's vendor knowledge for it aged past the
  freshness window. Medium priority: the surface *may* have drifted under a still-present tool
  name. Action: "Re-research `<provider>` to refresh its capability row, then diff the new surface
  against what `<artifactRef>` assumes."
- **`no-capability`** — tool present but never researched. Low priority, but it's why drift can't be
  tracked on this service yet. Action: "Run research-mcp-vendor for `<provider>` so future audits
  can detect drift here."
- **`unknown`** — inventory was never declared; the audit couldn't judge. Not a service problem —
  a data-freshness problem. Action: the re-declare nudge, nothing else.
- **`ok`** — no action. Don't list these individually; a count is enough.

When `refreshPolicy: auto-research` already refreshed a `stale-capability` provider this run, the
action plan should reflect the *post-refresh* state ("re-researched `<provider>`; compare the new
surface to `<artifactRef>`'s binding") rather than telling the operator to do what the job just did.

## Idempotency

- **The audit is a pure read** — re-running `meta_context_analyze` any number of times is free and
  side-effect-free. There is no cursor to advance for the audit itself.
- **Delta on `providersToRefresh`** is the anti-duplicate defense (step 2). Persist the prior run's
  list in the adapter's state store keyed by scope; a provider that was already flagged last run is
  "still open," not "newly drifted."
- **research-mcp-vendor supersession is its own safety net** — it has no dry-run; each research pass
  inserts a new capability row and auto-supersedes the prior current one. Re-researching the same
  provider twice is safe (you get two supersessions, full history preserved), but wasteful — gate
  it on the delta, not on every run.

## Pitfalls

- **Stale inventory produces false `missing` verdicts.** The single biggest failure mode. Step 0
  (re-declare) is the mitigation; the audit also self-reports `inventory.stale` and emits a
  re-declare nudge — surface both. Never promote a `missing` to "your service is broken" off a
  snapshot the audit flagged stale.
- **Do not auto-mutate bindings.** This job reports and proposes; the operator seals. The contextmap
  is append-only and cleanup is operator-driven — the artifact must never retire an edge, rewrite a
  binding, or delete a service. Even in `auto-research` mode, the only writes are capability-row
  supersessions (via research-mcp-vendor), never contextmap edits.
- **Don't spam the audit trail.** A periodic audit run is not a sealed structural decision, so it
  must NOT write `meta_context_commit` principles per run. "Reporting to itself" means superseding
  stale capability rows (real vendor knowledge) — not recording audit-run principles into the
  append-only graph. If you want run history, keep it in the adapter's state store, not the
  contextmap.
- **Alert fatigue.** Without the delta (step 2), a standing `missing` re-alerts every run and the
  operator learns to ignore the report. Lead with what changed since last run.
- **Auto-research cost.** `auto-research` fans out web research (via research-mcp-vendor) over every
  drifted provider — real LLM + fetch cost per provider. Default `report-only`; graduate to
  auto-research once the operator trusts the audit's precision.
- **Report provenance.** When writing to a `reportSink`, include mojulo trace fields (the run's
  `auditedAt`, the audit `scope`, `inventory.declaredAt`) so a reader can tell which environment
  snapshot the report reflects. A drift report with no snapshot timestamp is un-actionable.

## Behavior contract

- **Inputs:** `scope` (optional — `{ kind: 'fleet' }` default, or `{ kind: 'artifact', ref }`),
  `refreshPolicy` (`report-only` default | `auto-research`), `reportSink` (optional destination MCP),
  `dryRun` (default true — in dry-run, `auto-research` is downgraded to `report-only` and no
  `reportSink` write happens; the operator promotes to live explicitly).
- **Outputs:** the report object shaped by `outputContract` — findings ranked most-actionable-first,
  the severity summary, the delta vs last run, and the ordered action plan.
- **Side effects (live mode):** with `auto-research`, one or more INSERTs into
  `meta_mcp_capabilities` (supersession, via research-mcp-vendor) for each drifted provider; with a
  `reportSink`, one write to that destination MCP. No contextmap writes. No binding mutations.
- **Repeatability:** designed to be scheduled. Each run is a full-state audit plus a delta against
  the last; the substrate's capability chain records the refresh trajectory over time.

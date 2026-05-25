---
{
  "id": "research-mcp-vendor",
  "name": "Research an MCP vendor",
  "summary": "Research an MCP server end-to-end via primary web sources and record its capability body in mojulo's vendor knowledge layer (meta_mcp_capabilities).",
  "valueHook": "Replace stale curated vendor docs with first-hand agent research, timestamped at the moment it's true and re-runnable when the surface drifts.",
  "version": 1,
  "category": "substrate",
  "requires": {
    "protocols": [],
    "writeTarget": "mojulo:meta_mcp_capabilities"
  },
  "parameters": [
    {
      "name": "providerRef",
      "prompt": "Canonical lowercase name for the MCP vendor (e.g. 'notion', 'gmail', 'linear', 'google_drive'). This becomes the provider_ref key in the capabilities table. Single token, underscores for multi-word vendors. If unsure, prefer the vendor's brand name in lowercase."
    },
    {
      "name": "startingSource",
      "prompt": "Optional starting URL — the vendor's MCP server repo, the modelcontextprotocol/servers entry, or the vendor's developer docs root. If unset, web-search the providerRef plus 'mcp server' to find the canonical implementation.",
      "default": null
    },
    {
      "name": "officialVariant",
      "prompt": "Some vendors ship multiple official MCPs (remote vs local; hosted vs self-run). If you encounter variants, which one are you researching? Use a suffixed providerRef (e.g. 'notion-remote') and record each variant as a separate row.",
      "default": null
    }
  ],
  "mcpTools": {
    "mojulo": ["record_mcp_capabilities", "get_mcp_capabilities"]
  }
}
---

# Research an MCP vendor

Mojulo holds vendor knowledge in `meta_mcp_capabilities` — an append-with-supersession table keyed on `provider_ref`. This catalyst is how the agent populates and refreshes that table.

The premise: mojulo can't web-search in-band. You can. So vendor knowledge production lives where the affordance lives — on the agent's side, persisted into mojulo's substrate at the moment it's true, with citation provenance and supersession history so future readers can reconstruct what was known and when.

This catalyst replaces the curated `mcp/*.md` files that used to ship in mojulo's repo. Those bodies were LLM-authored at build time with no live verification — drift-prone, provenance-opaque. The research you do here is the durable substitute.

## Materialization

Per the bound host adapter:

1. Ask the user the three `parameters` questions in one batched round. `providerRef` is required; the other two are optional refinements.
2. Call `get_mcp_capabilities({provider_ref})` first. If a current row exists, surface its `version_tag` and `discovered_at` to the user before researching — they may not want to supersede a recent row. If they want to refresh anyway, proceed; the new row will auto-supersede.
3. Execute the **Source discipline** below to triangulate the canonical MCP server and its surface.
4. Extract the **What to extract** section's items into a structured working note.
5. Assemble the **Output body shape** body, applying the **Honesty rules**.
6. Call `record_mcp_capabilities({provider_ref, version_tag?, body_md, source_urls})` with the result.
7. Hand the resolved workflow to the host adapter so the artifact is re-runnable on future MCPs without re-reading this catalyst body.

When the adapter materializes the artifact, name the artifact slug `research-mcp-vendor` (singular — one artifact per host, parameterized by `providerRef`, not one artifact per MCP researched). Multiple researches share the same artifact; they differ only by argument.

## Source discipline

Priority order. Always start at the top and work down; stop at the first authoritative source that answers the question.

1. **The MCP server's own source code or README.** If the server is open source (most are), the tool definitions are in the repo (TypeScript / Python / Go). Tool names and input schemas come from here verbatim — never paraphrase.
2. **The official MCP servers monorepo** (`modelcontextprotocol/servers`) if the vendor is listed. Read the entry's README.
3. **The vendor's own developer documentation** (e.g. `developers.notion.com`, `developers.google.com/gmail/api`, `developers.linear.app`). Authoritative for the underlying API the MCP wraps.
4. **The MCP server's published package** (npm / PyPI page) for version metadata.
5. **The official MCP registry** at `registry.modelcontextprotocol.io/v0/servers?search=<providerRef>` for canonical install metadata.

**Out of scope as sources:** third-party tutorials, "awesome-mcp" list entries, marketing pages, blog posts, AI-generated summaries on aggregator sites. These can be useful as discovery hints (finding the repo URL) but never as authoritative claims about tool surfaces or pitfalls. If a tutorial says "Notion's MCP has a `delete_page` tool" and the repo doesn't, the tutorial is wrong.

**Triangulation rule.** Any non-trivial claim (a tool name, a schema field, a pitfall, a rate limit) needs to be backed by at least one priority-1 or priority-3 source. If you can only find it in priority-4 or worse, mark it `(unconfirmed)`.

## What to extract

Five concrete items, in order:

1. **Tool list with input schemas.** The exact tool names the server exposes. Pull these from the server's source code or README — not from your prior knowledge of the underlying API. For each tool, capture its input schema if the README or source declares it. Tool names vary between MCP implementations of the same underlying service; never assume.

2. **Affordances.** Three flags: `read`, `write`, `watch`. A vendor's MCP has `read: true` if it exposes search / fetch / list tools, `write: true` if it exposes create / update / send tools, `watch: true` if it exposes a push-based subscription tool. Most MCPs are read+write, no watch.

3. **Capabilities.** Structured metadata the composer uses:
   - `cursor`: does the read surface support a cursor? `cursorField`: what's it called (e.g. `history_id`, `last_edited_time`, `updated_at`)?
   - `pagination`: shape (`page_token`, `start_cursor`, `cursor_after`, `offset`).
   - `rateLimit`: posture (`requests-per-second`, `quota-units`, `unknown`). Include `rateLimitDetails` prose if specific.
   - `writeShapes`: array of write tool names or shape names (`create_issue`, `send_message`).
   - `readShapes`: array of read tool names or shape names.
   - `contentModel`: declare when the content model is non-flat (e.g. Notion's `block-tree`, Slack's `blocks`). Omit when the model is flat (e.g. Linear descriptions, Gmail bodies).
   - `requestLimits`: any per-request size/count caps the docs declare.
   - `supportsDelete`, `supportsDrafts`: whichever apply.
   - `apiVersion`: from the docs — exact string. Becomes the row's `version_tag`.

4. **Intent keywords.** Lowercase tokens the recommender uses to match operator natural-language intent against this MCP. Pick 5–10 that genuinely appear in operator framings: vendor name, the primary noun (e.g. "page", "issue", "thread"), the use-case category (e.g. "support", "wiki", "calendar"), synonyms operators actually say.

5. **Pitfalls.** This is the part registries cannot give you. Three to seven items, each one a load-bearing surprise the operator will not infer from the tool names. Pull from the docs' "common errors" sections, the repo's issue tracker (genuine drift / quirk reports), the API's known idiosyncrasies. Examples of the shape: history-id horizons, rate-limit cliffs, soft-delete retention, draft posture, label-vs-status confusion, API version drift. Pitfalls about the *workflow* (read-after-write loops, idempotency on this surface, dry-run posture) are also welcome — they're the wisdom layer's reason to exist.

## Output body shape

The `body_md` you pass to `record_mcp_capabilities` is markdown with JSON frontmatter. Match this shape exactly:

```markdown
---
{
  "requires": {
    "mcpInventoryCategory": "<email | knowledge_base | structured_record_store | document_store | calendar | crm | etc>",
    "inventoryServerHints": ["<alias-1>", "<alias-2>", "<host-namespaced-form>"]
  },
  "affordances": { "read": true, "write": true, "watch": false },
  "capabilities": {
    "cursor": true,
    "cursorField": "<...>",
    "pagination": "<...>",
    "rateLimit": "<...>",
    "writeShapes": [...],
    "readShapes": [...],
    "contentModel": "<...>",
    "supportsDelete": false,
    "supportsDrafts": false,
    "apiVersion": "<exact docs version>"
  },
  "intentKeywords": [...],
  "exposesKnobs": [
    {
      "name": "<knob-name>",
      "prompt": "<operator-facing prompt explaining what this knob controls>",
      "default": null
    }
  ]
}
---

# mcp: <Vendor Name>

<1-2 paragraph overview — what this MCP is, what its surface looks like, why it's multi-faceted if it is>

## Source-role surface (when `role: 'source'` in the composition)

- **Discovery calls.** <tool names + what they return>
- **Cursor.** <how incremental read works>
- **Watch surface.** <push-based options, if any; if not, say "polling only">
- **Rate limit.** <budget the operator should expect>

### Mapping intent for source role (load-bearing)

<3-5 bullets covering: natural primary key, required vs optional filter discipline, what NOT to use as a cursor and why, redaction posture>

## Destination-role surface (when `role: 'destination'` in the composition)

- **Discovery calls.** <write tools + what they require>
- **Required fields for write.** <minimum payload>
- **Dedupe surface.** <how to search-before-write>
- **Draft posture.** <if applicable: how dry-run maps onto this surface>

### Mapping intent for destination role (load-bearing)

<3-5 bullets>

## Watch-role usage (if applicable)

<one paragraph; omit the section entirely if affordances.watch is false>

## Pitfalls (apply across roles)

<5-7 bullets — see the **What to extract** §5 above>

<!-- sources
- <URL 1>
- <URL 2>
- <URL 3>
-->
```

The HTML comment at the bottom is load-bearing for provenance — every URL you read goes there, even ones that only contributed a single sentence. Future readers walking a supersession chain need to know what changed and why.

When you call `record_mcp_capabilities`, pass the URLs again as `source_urls` (JSON array) so they're queryable as a column, not just embedded in the body.

## Honesty rules

- **Mark unconfirmed claims.** Any non-trivial fact you couldn't back with a priority-1 or priority-3 source gets `(unconfirmed)` inline. "The cursor field is `last_edited_time` (unconfirmed — not declared in the repo's README, inferred from the underlying API)." Future readers can prioritize re-research on these.
- **Refuse to guess from training-data priors.** If you "know" Gmail's API has a tool called `messages.send`, but the MCP server doesn't expose it under that name, do not write that name. The training data is older than the surface.
- **When sources disagree, prefer the more recent.** Note the discrepancy explicitly. "API 2025-09-03 renamed `database` → `data_source`; older examples in third-party docs still use `database` and will fail."
- **Empty is honest.** If `watch` isn't supported, declare `affordances.watch: false` and omit the Watch-role section. Don't write "watch could theoretically be supported via..." — that's projection.
- **Cite even single-fact contributors.** A URL that contributed one sentence still goes in `<!-- sources -->` and `source_urls`. The cost of over-citing is zero; the cost of under-citing is unrecoverable provenance.

## Multi-server-per-vendor

Some vendors ship multiple official MCPs — Notion has a remote (OAuth, hosted) variant and a local (integration token, self-run) variant; some vendors have hosted-by-vendor and hosted-by-Anthropic forks; some have v1 and v2 lines that expose different tool names.

When the differences are material (different tool names, different auth surfaces, different rate limits), record them as **separate rows with distinct `provider_ref`** — `notion` and `notion-remote`, for example. The composer treats them as distinct; the operator picks based on what they have installed.

When the differences are cosmetic (same tool names, same surface, different distribution channel), use one `provider_ref` and mention the variants in the body's overview.

If you're unsure which variant to research, ask the user via the `officialVariant` parameter.

## Pitfalls — about the research process itself

- **One-shot fetches produce shape-correct but pitfalls-thin output.** The minimum for a usable body is ~5 fetches across canonical sources — the repo README, the vendor's developer docs root, a specific tool's reference page, the API's versioning/changelog page, and at least one schema-rich page. Less than that and the pitfalls section will be generic.
- **Tutorials are wrong more often than they're right.** They quote tool names from old MCP versions, conflate adjacent APIs, and propagate each other's errors. Primary sources or nothing.
- **Your prior knowledge of the underlying API is stale.** Most agent training data is months to years older than the API surfaces it describes. The fact that you can recite Gmail's REST API from memory does not mean the MCP exposes it under those names today.
- **Confident wrongness is the failure mode.** It's much better to write `(unconfirmed)` on twelve claims than to write twelve confident claims of which three are wrong. The supersession chain can repair gaps; it cannot repair confident lies.
- **The body length is not the deliverable.** A 60-line body backed by primary sources is more valuable than a 200-line body padded with plausible inferences. Length is the byproduct of how multi-faceted the MCP is, not a quality signal.

## Behavior contract

- **Inputs:** `providerRef` (required), `startingSource` (optional URL), `officialVariant` (optional disambiguator).
- **Outputs:** the new capability row's `id` and `discovered_at`, plus the `superseded_id` of any prior current row that was just superseded.
- **Side effects:** one INSERT into `meta_mcp_capabilities`, with auto-supersession of the prior current row if one existed. Provider row in `meta_mcp_providers` is upserted as a side effect — the agent never registers a provider directly.
- **Dry-run posture:** there is no dry-run for this catalyst. The write is the artifact; supersession is the safety net. If a research pass produces a body you don't trust, you can immediately re-research and supersede.
- **Repeatability:** this catalyst is designed to be re-run. The agent's worldmodel of an MCP improves with each pass; mojulo's chain records the trajectory.

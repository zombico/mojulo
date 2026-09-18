# Chatbot factory — docs for an optional pack

Everything in this directory documents the **chatbot factory**, which since 2.0 is
**not part of a default mojulo install**.

Mojulo is a 3D compiler for agents; the bot factory is one optional capability pack
beside it. These docs live together so they can travel together — when the factory
ships as its own package (`@mojulo/chatbot`, gated on the Phase 3 kernel ABI), this
directory goes with it rather than being untangled from the rest of `docs/`.

**Already-deployed bots are unaffected by any of this.** The bot image
(`ghcr.io/zombico/mojulo-bot`) is separately versioned on its own `bot-v*` tag line
and runs as its own process — it was never part of the workshop install.

![The bot builder's Build step — a configuration summary on the left, the live preview answering a product question from the uploaded document on the right, before anything is deployed](../images/bot-wizard-build.png)

<sub>The visual builder, mid-build: pick a model, compose capabilities, feed it documents, then watch the <b>real bot</b> — the same client code that ships — answer from your own document before you deploy it. The same bot can also be composed conversationally or driven by your own agent over MCP.</sub>

## Install and build one

```bash
mojulo install chatbot     # adds the bot factory (--remove takes it away)
```

A compiled bot calls an LLM to run, and the builder generates a few pieces
(form schema, identity, summary) server-side — so **bots** need at least one
provider key (via `init`, the dashboard's Settings, or the CLI):

```bash
npx -y -p mojulo mojulo-config set anthropic sk-ant-...
```

Then:

```
build me a triage bot for my dental practice
```

Mojulo's tools self-route — your agent picks the right entry point.

## What ships

- **Five protocols** — `knowledge` (in-process RAG), `formGathering` (structured field capture; PII bypasses the LLM), `appointments`, `triage` (cross-bot routing), `opticalRead` (vision-based extraction).
- **Hash-chained transcripts.** Every turn is content-hashed and chain-linked; `/verify/:id` walks the chain. Chains continue across triage handoffs, and image-extraction turns hash over the image bytes, so post-hoc edits to the source break the chain.
- **Multilingual vector RAG, offline at runtime.** `multilingual-e5-small` ONNX baked into the bot image — cross-language retrieval with no language detection and no embedding-API key.
- **PII bypass.** Locale-aware structured fields render client-side and submit through an endpoint that never calls the model; the transcript records only an opaque marker like `{contact_form_filled}`.
- **20-locale UI**, multiple LLM providers (OpenAI, Anthropic, local Ollama), an embeddable widget, Prometheus metrics, and form-submission webhooks.

Conversation data never leaves the bot — the control plane reads it through a proxy that doesn't copy.

![A deployed bot at its own URL — a French-language insurance assistant answering from a policy PDF on the left, and a Debug Mode panel on the right showing the retrieved RAG chunks with filenames and similarity scores plus the conversation's chain hash and a Verify button](../images/bot-deployed-debug.png)

<sub>The deployed bot narrating itself in real time: <b>rag</b> lists the chunks it actually retrieved — source file, chunk number, cosine score — so a wrong answer traces to the passage that caused it; <b>hash</b> shows the tip of the conversation's hash chain with a link that re-verifies the whole transcript from the bot's own database. Note the language — French question, French answer, English source PDF, one multilingual embedding space, no translation layer.</sub>

## Deploy options

Bots are the only thing mojulo makes with cloud deploy targets — everything else runs on your
machine.

Bots are the only bay with cloud deploy targets — the other bays run on your machine.

### Locally (default)

```bash
unzip my-bot-{id}.zip && cd my-bot-{id}
# paste LLM key into .env
docker compose up
```

### Fly.io

Configure a Fly token (paste in **Settings → Provider Keys** or `npx -y -p mojulo mojulo-config set fly fo1_...`), then deploy from the dashboard or ask your agent. Persistent volume, autostart on request, autostop when idle. No `flyctl` install required. Your Fly account, your bill.

### Air-gapped / your own registry

Set `MOJULO_OFFLINE_BUILD=1` on the control plane. The artifact bundles full source + Dockerfile and builds locally on the target machine.

To point the prebuilt path at your own registry:

```bash
BOT_IMAGE=ghcr.io/your-org/your-bot:0.1.0           # control plane local build
MOJULO_CLOUD_IMAGE=ghcr.io/your-org/your-bot:0.1.0  # Fly cloud deploy
```

---

## Audit chain posture

The per-turn hash chain (`content_hash` + `chain_hash`, walked by `/verify/:id`) is **tamper-evident, not tamper-proof**. It catches naive retroactive edits to the bot's SQLite — change one row, the chain breaks at every row after it. It does **not** stop a sophisticated operator with DB access from rebuilding a coherent forged history; there is no signing key and no external anchor.

If your threat model demands non-repudiation against the bot operator themselves, you need an external anchor (RFC 3161 timestamping, OpenTimestamps, an external witness server). None are shipped today; the federated-routing handoff is the existing surface where a pluggable witness sink would land. See [turn-hashing.md](turn-hashing.md).

---

## Reference

The deep-dives, grouped.

### Start here

- [mojulo-bots.md](mojulo-bots.md) — short orientation to the whole system.
- [AGENT-REFERENCE.md](AGENT-REFERENCE.md) — the dense agent-facing map for this pack
  (pack membership, deploy path, fleet aggregation, the runtime's LLM adapter, invariants).
  Sibling of the main-line [docs/AGENT-REFERENCE.md](../AGENT-REFERENCE.md), which no longer
  carries bot internals.
- [BOT-ARCHITECTURE.md](BOT-ARCHITECTURE.md) — source of truth for the factory flow:
  cartridge composition, vector baking, artifact layout, Fly deploy, Connect Bot proxy.

### Building a bot

- [chat-builder.md](chat-builder.md) — the conversational builder.
- [wizard-builder.md](wizard-builder.md) — the modular wizard. Both converge on
  `buildDeploymentConfig()`.
- [protocol-composition.md](protocol-composition.md) — how `instructions.txt` is
  composed at deploy time from stackable protocol cartridges.
- [form-collection.md](form-collection.md) — ghost forms: structured collection that
  bypasses the LLM entirely.
- [optical-read.md](optical-read.md) — pulling structured data out of an uploaded image.

### Running one

- [bot-frontend.md](bot-frontend.md) — the client, widget, and embed surfaces.
- [conversations-api.md](conversations-api.md) — reading conversations through the proxy.
- [conversation-events.md](conversation-events.md) — the append-only typed event log.
- [vector-rag.md](vector-rag.md) — in-process retrieval, no embedding API.

### Integrity

- [turn-hashing.md](turn-hashing.md) — content/chain hashes. Turn rows must go through
  the hashing helpers; this is a repo golden rule.
- [federated-routing.md](federated-routing.md) — per-bot chains under fleet-level reads.

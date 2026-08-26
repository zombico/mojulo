# Responsibility model

This document explains *why* [TERMS.md](../TERMS.md) places the entire question of intent, capability, suitability, and consequence on the operator. The answer is architectural, not merely legal: mojulo is built such that the maintainer literally cannot occupy the role of arbiter, even if they wanted to. The terms reflect the substrate; they do not invent a posture the substrate does not actually have.

If you're a user trying to understand what you signed up for, this is the longer-form companion to the terms. If you're an auditor, a reviewer, or a future maintainer trying to understand the design intent, this is the rationale.

## 1. The architectural facts

These are not aspirations. They are properties of the codebase, verifiable from the source tree.

### mojulo runs on your machine

The substrate is a Next.js app, a SQLite database, and a process supervisor. They live on your host. The npm package (`npx mojulo`) installs them locally. The Docker image runs locally. There is no hosted mojulo service.

This is enforced in the design, not just the deployment instructions:

- The MCP transport binds to localhost. The dashboard binds to localhost. ([CLAUDE.md](../CLAUDE.md), golden rules.)
- There is no telemetry, no phone-home, no analytics endpoint, no automatic update channel that calls out. (See README — "What stays on your machine.")
- The maintainer has no visibility into your installation. There is no instrumentation that would let them observe what you build, deploy, or run.

When the terms say "the maintainer does not have, and is not seeking, the ability to see, approve, modify, or revoke any of these decisions," that is a statement about the code, not a marketing claim.

### Inference happens on your credentials

mojulo does not host LLM inference. Every model call routed through mojulo is made using a provider key *you* pasted into the dashboard or set in the environment. The bill goes to your provider account. The provider's terms of service govern what you can ask the model to do.

This means the maintainer is not in the loop on:

- What you ask models to generate.
- What outputs the model returns.
- What policy violations (your provider's, not the maintainer's) those outputs might constitute.

The provider already has a content policy and an enforcement mechanism. mojulo is a client of theirs, not a re-publisher of their service.

### Third-party services are your relationships

When mojulo "connects to Gmail" or "reads from Drive" or "deploys to Fly," it is doing so via:

- Your authenticated MCP server (which you installed and which holds your OAuth tokens).
- Your Fly API token (which you pasted into the dashboard).
- Your container registry credentials.

The maintainer has no agreement with Google, Fly, or your CRM about your use of those services through mojulo. Your agreement with each vendor is the operative one. mojulo is just a client library by another name.

### The agent — not the substrate — decides what to do

mojulo's MCP tools are described in their `tools/list` so an agent can pick one. The agent that does the picking — Claude Code, Codex, or another MCP host — is one *you* connected, driven by prompts *you* wrote (or that you delegated to a routine you configured).

mojulo does not have an autonomous loop that wakes up and decides to compile a bot, send an email, or deploy a service. It executes what your agent tells it to, in response to what you told the agent.

When the terms say "intent belongs to you," that's because the intent literally never enters mojulo's process boundary. It lives in your prompt, gets translated by your agent, and arrives at mojulo as a tool call.

### Capability is compositional

mojulo ships primitives:

- A stash is a typed bucket.
- A cook materializes a publication from stashed inputs.
- A catalyst is a curated workflow recipe.
- An mcp-orbit composition chains MCP primitives.
- A bot scaffold compiles into a runnable artifact.
- An app scaffold supervises a local process with an MCP sidecar.

Combined with whichever MCPs you have installed and whichever models you have keys for, these primitives are broadly capable. The maintainer:

- Did not enumerate the legal combinations.
- Cannot enumerate the illegal combinations, because what is "illegal" depends on your jurisdiction, your industry, your contracts, and your data — none of which are visible to the substrate.
- Is not the right party to decide what you should be allowed to compose.

This is the architectural reason behind the terms' refusal to evaluate capability or intent on your behalf. There is no place in the system where such an evaluation could be performed with the necessary context.

## 2. What the operator owns

Given the architecture above, the operator owns:

| Decision | Why it lives with the operator |
| --- | --- |
| What to build | mojulo only acts on tool calls; tool calls come from your agent; your agent is driven by your prompts. |
| What inputs to feed it | Documents, conversation history, URLs, credentials — these enter the substrate from you, not from a curated catalog. |
| What MCPs to connect | Each MCP server is installed by the operator on the operator's host and authenticated with the operator's credentials. |
| What model to use | Provider keys are pasted in by the operator and stored encrypted in the operator's local database. |
| Where to deploy artifacts | Fly tokens, registry credentials, infrastructure choices are the operator's. |
| What the deployed artifact does | Compiled bots run with their own SQLite, their own provider keys, their own widget; mojulo does not proxy their inference. |
| Compliance with applicable law | The substrate does not know what jurisdiction you are in, what industry you operate in, or what regulations bind you. |
| Compliance with third-party ToS | The substrate is not party to those agreements. |
| Notice, consent, and data-handling obligations to end users of artifacts | The end users interact with artifacts the operator built and deployed on the operator's infrastructure. |

## 3. What the maintainer does not do

To be explicit, since negative claims often clarify positive ones:

- **No content policy enforcement.** mojulo does not classify your prompts, your stashed documents, or your generated outputs against an acceptable-use list. The LLM provider you use has one; that one applies. The maintainer does not add a second layer.
- **No intent inference.** mojulo's tools do not try to detect what category of work you are doing or refuse certain categories. `cook`, `start_new_bot`, `install_scaffold`, `bind_primitives` do not ask "what are you using this for?"
- **No capability gating by user identity.** There is no user identity by default. There is no account. There is no tier. The operator may enable the roles pack to delegate scoped access on their own control plane — but that is the operator's instrument pointed at the operator's own delegates: every key is operator-issued, operator-revocable, and the operator owns the consequences. The maintainer gates nothing. Every operator running the same release still has the same capabilities.
- **No remote kill switch.** The maintainer cannot disable a running mojulo installation, a deployed bot, or a generated artifact. There is no command-and-control channel.
- **No backchannel to the operator.** The maintainer is not notified when you do anything. There is no log shipped, no exception reported, no usage metric collected.
- **No vetting of generated artifacts.** A bot you compiled is a bot you compiled. The maintainer did not review it, sign it, or certify it.
- **No active maintenance promise.** This is a small solo-maintained project. Best-effort fixes; no SLA.

## 4. Suitability assessments the operator must make

These are not theoretical edge cases. They are the most common categories where someone might assume mojulo had vetted the use case, and where it has not:

- **Regulated industries.** Healthcare (HIPAA, equivalent regimes), financial services, legal services, education with minors, government contracting. None of mojulo's primitives are certified for these. If you build a bot for a dental practice, you are responsible for whatever data-handling regime governs that practice.
- **Data with restricted categories.** Health data, payment-card data, biometrics, child data, EU special-category personal data. The substrate stores what you put in it; it does not differentiate.
- **Safety-critical settings.** Anything where a wrong output materially harms a person. Bots are not safety systems; cooks are not certifications; sketches are not engineering drawings.
- **Autonomous high-stakes action.** The substrate can compose chains that take actions through MCPs. Anything that books, pays, sends, deploys, or executes against a third party is irreversible by mojulo once initiated. The operator owns the decision to wire such a chain and the consequences of running it.
- **Cross-border data flows.** mojulo does not know where your model provider's compute is, where your MCP server's backing service is, or where your end users are located. Data-residency obligations are yours to assess.

If a use case in this list applies to you and you choose to proceed, you are choosing to do so on your own assessment. The terms do not prevent it. They make clear who carries the assessment.

## 5. Where this leaves the maintainer

The maintainer's role is to:

- Publish source, an npm package, and a container image.
- Document what the primitives do.
- Receive vulnerability reports per [SECURITY.md](../SECURITY.md) and ship security fixes where feasible.
- Reject the role of arbiter over what operators build, because the substrate is not architected to play that role and the operator is the only party with the context to play it.

This is the same posture as Postgres, ffmpeg, or curl: tools of great capability published under permissive licenses, used by operators who own the consequences of how they wire them up.

## 6. Where this leaves the operator

You, the operator, are the responsible party. That responsibility is not a legal fiction imposed by the terms; it follows from the fact that you are the only party in the system with the credentials, the intent, the context, and the means to act.

The terms ask you to acknowledge this. The architecture makes it true.

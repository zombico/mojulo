# Security Policy

Mojulo is a solo-maintained, open-source, self-hosted project: a local MCP server and dashboard that run on the operator's own machine. This document says how to report a security issue and what falls inside or outside the project's threat model.

## Scope of this policy

This policy covers **the build the publisher ships**: the official `mojulo` package on npm and the source published in this repository. Apache-2.0 lets anyone fork the code or host it for other people; a modified build or a third-party hosted instance is that party's software under that party's policy, and reports about it belong with that party. The maintainer publishes no hosted mojulo today; if a mojulo cloud is ever offered it will be a separate product under its own security policy, and the open-source build stays open source and telemetry-free regardless (see [TERMS.md](TERMS.md)).

## Supported versions

Security fixes go to the **latest `2.x` minor** only. Older `2.x` minors and every `1.x` and `0.x` release are not patched; upgrade with `npx mojulo@latest init`.

## Reporting a vulnerability

Please use **GitHub's private vulnerability reporting** on this repository (Security tab → "Report a vulnerability"). It keeps the report private until a fix is available.

If you cannot use GitHub's private reporting, email the maintainer at `hello@mojulo.ai` with `[mojulo security]` in the subject.

**Please do not open public GitHub issues for security reports.**

### What to include

- A description of the issue and where it lives (file path, tool name, route, or component)
- Steps to reproduce, ideally with a minimal proof-of-concept
- Your assessment of impact
- Whether you intend to disclose publicly, and on what timeline

### Response expectations

This is a solo-maintained project. Expect best-effort acknowledgement within a few days, not hours. Fix timelines depend on severity and complexity. You will be credited in the release notes for the fix unless you ask not to be.

## Threat model

Mojulo has two components with different security postures:

- **The MCP server and dashboard** ([control/](control/)) — single operator, self-hosted, listening on `localhost`. The coding agent the operator already runs (Claude Code, Codex, any MCP host) drives it over stdio; the dashboard is the same state with a human face. Everything it makes — recipes, renders, exports — lands under `~/.mojulo/` on the operator's disk. It ships with an **opt-in HTTP login** (set `CONTROL_PLANE_USER` / `CONTROL_PLANE_PASSWORD`; sessions are HMAC-signed with the password itself, so rotating the password invalidates outstanding sessions). The login is a last-line-of-defense affordance, not a substitute for network isolation.
- **The chatbot pack's bot runtime** ([lite-template/](lite-template/)) — installed only by `mojulo install chatbot`, and designed to be exposed to end users. Conversation data stays in the bot's local SQLite and never leaves it.

These two postures shape what is in and out of scope below.

### In scope

Reports about the following are welcome and treated as security issues:

- **Path escape from the operator's data directory.** Any tool input, recipe field, or export that reads or writes outside `~/.mojulo/` (or the configured `MOJULO_HOME`) without the operator naming that path.
- **Artifact tampering.** Any way to inject code into a generated export — the self-contained HTML, a Godot project, an engine data pack, a Blender pack — that the operator did not put there through a tool call.
- **API key extraction.** Any way to read decrypted provider keys (stored by `mojulo-config` for the optional image, voice or chatbot paths) out of the control plane's `api_keys` table without filesystem access to the host.
- **Tamper-evident chain bypass** in the chatbot pack. Any way to insert, modify, or delete turn rows in a bot's SQLite without the `content_hash` / `chain_hash` chain detecting it, including attacks on the `/verify/:id` walker and on cross-bot triage handoffs.
- **Bot proxy auth bypass.** Any way to read or write through `/api/deployments/[id]/conversations*` or `/api/deployments/[id]/submissions*` without holding the deployment's `MOJULO_API_KEY`.
- **Cross-document RAG leakage.** Any input that causes a bot to surface chunks from documents the operator did not include in that bot's knowledge set.
- **Conversation data leaving the bot.** Any code path that copies conversation rows from a bot's SQLite back into the control plane's database, or to any third party other than the configured LLM provider.
- **Dependency vulnerabilities** with a clear exploit path against either component.

### Out of scope

These are known design constraints, not vulnerabilities:

- **Control plane exposed to the public internet.** The built-in login is not designed to withstand internet-facing traffic on its own (no MFA, no lockout, no audit trail of failed attempts). The control plane is meant to run locally or behind operator-controlled access (VPN, SSH tunnel, Tailscale, a reverse proxy with stronger auth). Reachability of port 3001 from the internet is the operator's responsibility, not a project bug.
- **Local filesystem attacks.** Issues that require an attacker to already have read or write access to the host's filesystem (reading the SQLite file under `~/.mojulo/` directly, reading `.env` files) are out of scope. The threat model assumes the host is trusted.
- **What the connecting agent decides to do.** Mojulo holds no credentials of its own and supplies no judgment; the coding agent chooses which tools to call with which inputs. Prompt injection that steers the agent into calling a mojulo tool is an agent-host concern unless the tool itself crosses a boundary above.
- **Denial of service against a single self-hosted instance.** Resource exhaustion of the control plane or a single bot is not treated as a security issue.
- **Issues in third-party providers or engines.** Bugs in Anthropic or OpenAI APIs, or in Godot, Blender, Unity, Unreal or a slicer that opens a mojulo export, belong with those vendors.
- **LLM output quality** — hallucination, jailbreak, or prompt-injection content that does not cross a security boundary. These are product-quality issues; open a regular GitHub issue.
- **Lack of rate limiting** and **missing security headers** on the control plane UI, since it is single-user on localhost. If you need brute-force resistance, front the control plane with a reverse proxy that rate-limits.

### Sensitive areas — extra care appreciated

If you are reviewing or fuzzing these areas, your reports are especially welcome:

- Export writers — the self-contained HTML bundle, the Godot project writer, the engine data packs — and any path derived from a recipe field.
- API key encryption and decryption paths in the control plane.
- Turn-hashing helpers and the `/verify/:id` walker — see [docs/chatbot/turn-hashing.md](docs/chatbot/turn-hashing.md).
- Federated routing and the cross-bot handoff flow — see [docs/chatbot/federated-routing.md](docs/chatbot/federated-routing.md).
- The bot proxy in [control/lib/deployers/bot-proxy.js](control/lib/deployers/bot-proxy.js) and the routes that forward through it.
- The artifact build pipeline in [control/lib/deployers/docker.js](control/lib/deployers/docker.js).

## Disclosure

After a fix ships, the maintainer will publish a release note describing the issue, affected versions, and the fix. Reporters are credited by name or handle unless they request otherwise.

There is no bug bounty.

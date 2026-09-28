# Security Policy

Mojulo is a solo-maintained, open-source, self-hosted project: a local MCP server and dashboard that run on the operator's own machine. This document says how to report a security issue and what falls inside or outside the project's threat model.

## Scope of this policy

This policy covers **the build the publisher ships**: the official `mojulo` package on npm and the source published in this repository. Apache-2.0 lets anyone fork the code or host it for other people; a modified build or a third-party hosted instance is that party's software under that party's policy, and reports about it belong with that party. The maintainer publishes no hosted mojulo today; if a mojulo cloud is ever offered it will be a separate product under its own security policy, and the open-source build stays open source and free of external telemetry regardless (see [TERMS.md](TERMS.md)).

## Supported versions

Security fixes go to the **latest `3.x` minor** only. Every `2.x`, `1.x` and `0.x` release is unmaintained: it gets no fixes, and the maintainer does not recommend running it. Upgrade with `npx mojulo@latest init`; if you run mojulo as the Claude plugin, update the plugin instead (it pins one version). Before you upgrade from 2.x, read "Upgrading from 2.x" in the [changelog](control/CHANGELOG.md#upgrading-from-2x).

### Known issues in 2.x

The chatbot factory is no longer part of mojulo as of 3.0 and is moving to its own project. Earlier 2.x versions that include it are unmaintained and have known security issues. No 2.x release will be patched. 2.1.0, the last one, and the bot image it deploys (`mojulo-bot` 0.5.1) have these; each is fixed in 3.0.0 or left mojulo with the chatbot factory:

- **An open relay on deployed bots.** The bot image's `POST /api/send-webhook` takes its target URL from the request body, with no API key and open CORS, so any visitor to a deployed bot can make it post to any address and read the answer.
- **SSRF in `upload_document_from_url`.** It fetches any http(s) URL from the operator's machine, following redirects, including loopback, LAN and cloud-metadata addresses.
- **Path traversal in the Office-document parser.** An uploaded document's file name reaches a temp file path, so a name containing `../` overwrites and then deletes a file the process can write.
- **Fly credentials in the machine environment.** Fly deploys put the operator's decrypted provider key and the bot's API key in the Fly machine's `env`, readable by anyone who can read the machine.
- **Dashboard DNS rebinding and cross-site writes.** With login off (the default), a web page in the operator's browser can reach the dashboard's API, write routes included, by rebinding its hostname to 127.0.0.1 or by posting cross-site.
- **A revoked delegate's dashboard session outlives the revocation.** With the roles pack on and login set, a delegate whose key is revoked with `revoke_role_key`, expires, or has its token epoch bumped keeps dashboard access until their 7-day session cookie runs out, though their MCP bearer has stopped working.

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

Mojulo has one component:

- **The MCP server and dashboard** ([control/](control/)) — single operator, self-hosted, listening on `localhost`. The coding agent the operator already runs (Claude Code, Codex, any MCP host) drives it over stdio; the dashboard is the same state with a human face. Everything it makes — recipes, renders, exports, caches — lands under `~/.mojulo/` on the operator's disk, apart from temporary work folders in the OS temp directory, a folder the operator names for `install_scaffold`, and the host configs `mojulo init` edits after a yes. It ships with an **opt-in HTTP login** (set `CONTROL_PLANE_USER` / `CONTROL_PLANE_PASSWORD`; sessions are HMAC-signed with the password itself, so rotating the password invalidates outstanding sessions). The login is a last-line-of-defense affordance, not a substitute for network isolation.

Since 3.0.0 the package has no Docker, Fly, GHCR, webhook or uploaded-document code path: the chatbot factory that had them is no longer part of mojulo (see [Known issues in 2.x](#known-issues-in-2x)).

That posture shapes what is in and out of scope below.

### Code that runs with the operator's privileges

Two features run JavaScript that did not ship in the package, inside the mojulo process, with the operator's user privileges. This is how they work, not a boundary mojulo claims to enforce:

- **Recipes that carry a `program`** (the code door: `mint_solid` with `kind: 'code'`, or a workbench recipe's `program`). The program runs when the recipe is rendered or exported. It runs in a `node:vm` context, which keeps it deterministic but is **not a sandbox**: a program can reach the host process, the filesystem and the network. A recipe you did not write that carries a `program` is code; read it before you render it, as you would a script.
- **Recipe books** (`MOJULO_RECIPE_BOOK`). A book's Door-2 `builder.js` files are imported when mojulo starts, like a dependency. Point it only at a book you trust. The cookbook `save_recipe` writes is recipes only; a builder there is skipped.

Reports that a `program` or a book builder can do what any local script can do are expected behavior. Reports that code runs *without* one of these doors (a recipe with no `program`, a cookbook entry, a stored row read or listed rather than rendered) are in scope.

### In scope

Reports about the following are welcome and treated as security issues:

- **Path escape from the operator's data directory.** Any tool input, recipe field (other than a `program`, above), or export that reads or writes outside `~/.mojulo/` (or the configured `MOJULO_HOME`) without the operator naming that path.
- **Artifact tampering.** Any way to inject code into a generated export — the self-contained HTML, a Godot project, an engine data pack, a Blender pack — that the operator did not put there through a tool call.
- **Undisclosed traffic or writes.** Any network request, spawned process, or write outside the places the plugin README's "What it installs, fetches, runs and writes" section and substrate fact 3 name.
- **API key extraction.** Any way to read decrypted provider keys (stored by `mojulo-config` for `mint_solid`'s optional `via:'prompt'` door) out of the control plane's `api_keys` table without filesystem access to the host.
- **Dependency vulnerabilities** with a clear exploit path against it.

### Out of scope

These are known design constraints, not vulnerabilities:

- **Control plane exposed to the public internet.** The built-in login is not designed to withstand internet-facing traffic on its own (no MFA, no lockout, no audit trail of failed attempts). The control plane is meant to run locally or behind operator-controlled access (VPN, SSH tunnel, Tailscale, a reverse proxy with stronger auth). The dashboard refuses a request whose Host is not a loopback name, so a proxy or tunnel that reaches it by another name needs that name in `MOJULO_UI_ALLOWED_HOSTS` (comma-separated; `MOJULO_UI_HOST` is the bind address). Reachability of port 3001 from the internet is the operator's responsibility, not a project bug.
- **Local filesystem attacks.** Issues that require an attacker to already have read or write access to the host's filesystem (reading the SQLite file under `~/.mojulo/` directly, reading `.env` files) are out of scope. The threat model assumes the host is trusted.
- **What the connecting agent decides to do.** Mojulo holds no credentials of its own and supplies no judgment; the coding agent chooses which tools to call with which inputs. Prompt injection that steers the agent into calling a mojulo tool is an agent-host concern unless the tool itself crosses a boundary above.
- **Denial of service against a single self-hosted instance.** Resource exhaustion of the control plane is not treated as a security issue.
- **Issues in third-party providers or engines.** Bugs in Anthropic or OpenAI APIs, or in Godot, Blender, Unity, Unreal or a slicer that opens a mojulo export, belong with those vendors.
- **LLM output quality** — hallucination, jailbreak, or prompt-injection content that does not cross a security boundary. These are product-quality issues; open a regular GitHub issue.
- **Lack of rate limiting** and **missing security headers** on the control plane UI, since it is single-user on localhost. If you need brute-force resistance, front the control plane with a reverse proxy that rate-limits.

### Sensitive areas — extra care appreciated

If you are reviewing or fuzzing these areas, your reports are especially welcome:

- Export writers — the self-contained HTML bundle, the Godot project writer, the engine data packs — and any path derived from a recipe field.
- API key encryption and decryption paths in the control plane.

## Disclosure

After a fix ships, the maintainer will publish a release note describing the issue, affected versions, and the fix. Reporters are credited by name or handle unless they request otherwise.

There is no bug bounty.

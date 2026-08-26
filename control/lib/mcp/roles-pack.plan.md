# Roles pack — operator-owned delegation over capability bays

Status: DESIGN (2026-08-25, nothing landed). Full assessment done: ancestor RBAC
(`~/Documents/mojulo-prime/dragbot-control`, lib/auth + lib/billing) researched, every
current gating/identity/session surface mapped. This plan is the write-up of that
review: the doctrine delta, the role model, the grant vocabulary, the 1:1 inference
rule, the schema, the enforcement stitches, and the phased build order. Off by
default; a fresh install is byte-identical in behavior to today.

## What this is (and is not)

The roles pack lets the operator issue **scoped keys** to other humans and agents on
their own control plane: a `users` table, two role units (`admin`, `privileged`),
workshop-spaces, and RBAC composed on the capability-bay (pack) axis that
[packs.js](packs.js) already declares.

It is **operator-owned delegation, NOT multi-tenancy**. Multi-tenancy is a hotel:
mutually-distrusting strangers, the platform as referee, isolation as a contractual
guarantee between tenants. This is a house with keys the owner cut: there is exactly
one owner (the admin = the operator), everything in the substrate remains theirs, and
other users hold revocable keys that open some doors and not others. The threat model
is **trusted-but-scoped** — "my collaborator (or my cron agent) must not touch deploys
or read every bot's conversations" — never "an adversary shares my control plane."
If someone needs hostile-tenant isolation, that is mojulo-prime's job (it exists),
not lite's.

Stated honestly, the perimeter does not move: anyone with shell access to the host
can open the SQLite file directly. The roles pack enforces delegation rules **at the
API surface**; the host machine remains the actual security boundary, exactly as
today. The localhost invariant is untouched — roles create no tunnel, no public
surface. "Issuing a key to a remote collaborator" still means giving them access to
the machine, which is a bigger decision than any role.

## Doctrine delta (Phase 0 — this ships FIRST, as text)

Single-user is currently doctrine, not just implementation:
[responsibility-model.md](../../../docs/responsibility-model.md) ("No capability
gating by user identity. There is no user identity."),
[CLAUDE.md](../../../CLAUDE.md) golden rule ("single-user … do not introduce
multi-tenant assumptions"), [MCP-ARCHITECTURE.md](../../../docs/MCP-ARCHITECTURE.md)
§5, README, [TERMS.md](../../../TERMS.md), and the `server.js` header comment.

The reframe that makes this compatible rather than contradictory: the responsibility
model forbids **mojulo-the-vendor gating the operator**. The roles pack is the
inverse — **an instrument the operator points at their own delegates**. Access-rights
decisions become one more thing the operator owns, which *strengthens* the
"assessments belong to the operator" posture. The invariant lines amend to:

> There is no user identity **by default**. The operator may enable the roles pack to
> delegate scoped access; every key is operator-issued, operator-revocable, and the
> operator owns the consequences. Every operator running the same release still has
> the same capabilities.

This is the cheapest diff in the plan and the one that changes what mojulo claims to
be — it gets reviewed first and hardest. Files to amend: responsibility-model.md,
CLAUDE.md golden rules, MCP-ARCHITECTURE §5, README posture lines, mcp-integration.md
("one token, one user" becomes "one token per user"), TERMS.md unchanged (still no
account *we* operate).

## Role model

Two units, per the original framing:

- **admin** — the operator. Unbounded. Only admins administer roles, and several
  surfaces are admin-only structurally (deny-list below). The existing
  `CONTROL_PLANE_USER`/`PASSWORD` credential migrates to the first admin row.
- **privileged** — a delegate (human or agent). A privileged key is a **bundle of
  boundaries**: `{ pack grants } + { workshop-space } + { flags: proposeOnly?,
  outward?, lifecycle?, houseKeys? } + { expiry }`.

Named roles are **presets over that vocabulary**, not new machinery — e.g. a
*builder* (creative + bot-build packs, own space, propose-only on deploys), an
*analyst* (fleet pack granted eyes-open, no space), an *automation agent* (one pack,
30-day key, no cross-cutting reads). The most realistic near-term privileged user is
**a second agent, not a second human** — a scoped bearer key for a cron/trigger agent
that can read fleet rollups but cannot touch env, deploys, or secrets. Agent keys are
the MVP framing; human dashboard logins are second.

## The third axis on packs (why bays = packs)

[packs.js](packs.js) already carries two orthogonal axes; authorization becomes the
third, enforced at the same chokepoints with the same advisory idiom:

| Axis | Question | Mechanism |
|---|---|---|
| Install | Is this capability physically present? | `WING_INSTALL`, disk probe (exists) |
| Presentation | Is this schema in context? | packs mode / SPINE (exists) |
| **Authorization** | May **this caller** execute it? | pack grants per user (**new**) |

Candidate units considered and rejected: **wings** (2 — too coarse), **rings**
(documentation taxonomy, no runtime field on tools, cross-cuts the wing axis —
wrong), **tools** (~181 — too fine, unmanageable grant lists). **Packs** (~24, each
already a data object with a `members` array and an O(1) `homePackForTool()` lookup)
are the bay unit. A grant list is a list of pack ids.

Enforcement points (the same funnels the install gate uses):

- `handleToolCall` and `invokeRegisteredTool` in [server.js](server.js), and the pack
  dispatcher in [tools/packs-tools.js](tools/packs-tools.js) — insert an
  `authNotice(name, ctx)` check beside the existing `installNotice(name)` check. Same
  shape: a **wing-level/pack-level terminal advisory** telling the model the caller's
  key does not carry this bay and to stop retrying. Execution integrity, not
  information hiding (the iron-wall doctrine of
  [install-capabilities.md](../../../docs/install-capabilities.md) applies verbatim).
- `listTools` in [server.js](server.js) — filter to granted packs alongside
  `isToolInstalled`, so a privileged caller's `tools/list` simply shows their bays.
- SPINE stays listed for everyone (orientation is not a secret); its *mutating*
  members are nil, so this is safe — verify at review that every SPINE member is
  read-only.

## The boundary vocabulary

What a privileged key can be bounded by, strongest/cheapest first:

1. **Pack grants** — which bays execute. The core boundary; genuinely enforceable
   because execution funnels through three code paths.
2. **The hard deny-list** — never grantable regardless of role, checked separately so
   a misconfigured grant table cannot expose it: secrets/env surfaces (`api_keys`
   CRUD, `set_env`/`delete_env`/`list_env`, `inspect_bot_env`), roles administration,
   settings, cloud-deploy credentials, daemon control (`start/stop/restart_daemon`).
3. **Propose-vs-seal** — mojulo's most native boundary. A `proposeOnly` key can forge
   plans (Ring 8), draft compositions, sketch research — but `execute_plan`,
   `meta_context_commit`, and actual deploys stay admin. The delegate's whole output
   is a reviewable plan instead of a changed reality ("Claude proposes, user
   disposes" promoted to an access boundary). Zero data changes — it is a grant
   distinction over tools that already exist.
4. **Workshop-spaces** — which rooms their artifacts live in (see schema). Honest
   strength: a room divider, not a wall — keeps their sandbox out of the production
   fleet and prevents accidental access; correctness rides on the scoped-query sweep.
5. **Outward / lifecycle tags** — two action classes gated independently of packs:
   things that *leave the host* (Fly deploys, anything that spends or publishes) and
   things that *start/stop processes* (Ring 7 apps, daemons, bot containers). A
   handful of tools get an `outward`/`lifecycle` tag; the flags on the key gate them.
6. **Cross-cutting read denial** — fleet SQL ([../fleet/scoped-sql.js](../fleet/scoped-sql.js)),
   `semantic_search`, telemetry reads, contextmap briefs, and Ring 3 bot-proxy
   conversation reads see across everything **by design**. v1 boundary is binary:
   these packs are deniable, never row-filtered. Granting an analyst the fleet pack
   is an explicit eyes-open operator decision, not a leak.
7. **Key shape** — revocation (delete the row), expiry (TTL in the token; ideal for
   agent keys), attribution (a `user_id` column on `mcp_tool_calls` via the
   [telemetry.js](telemetry.js) seam gives a per-key audit trail for free).
8. **Quantity caps** — deferred. No billing here; if a real delegate ever needs a
   blast-radius cap (max N deployed bots), it is one count-check at the creation
   chokepoint.

## The 1:1 inference rule

**Every unit of inference the substrate mediates is attributable to exactly one
account's own credential; subscription credentials never enter the substrate.**

The scenario this exists to prevent: one Claude Max plan behind the control plane,
N users logging in, everyone's inference riding that one consumer subscription —
textbook subscription sharing, the pattern providers detect and ban, and the account
that dies is the operator's. Mojulo-as-designed never holds a subscription (they
authenticate the *agent*, outside the control plane); with multiple users there are
exactly two side doors where the multiplexer could silently re-form, and this rule
closes both:

- **Side door 1 — a shared fulfiller on the agent-task queue.** The admin leaves a
  Max-authed Claude Code running as house fulfiller; every delegate's app/trigger
  inference now rides the admin's subscription. Fix: **per-user task lanes as the
  default.** Parked tasks and trigger firings
  ([agent-tasks/queue.js](agent-tasks/queue.js), `parkRequest` /
  `parkRequestForTrigger`) carry the originating `user_id`; a connected agent pulls
  only its own user's tasks. **No silent fallback**: if a delegate's agent is not
  connected, their task waits and expires *visibly* — it never drifts to whoever else
  is online, because that drift is the multiplexer. Starvation must be loud.
- **Side door 2 — a subscription token masquerading as an API key.** One
  shape-validation check at the `api_keys` write path refuses OAuth/subscription-
  shaped credentials (real Anthropic API keys have the `sk-ant-` form) with a plain
  "subscriptions authenticate agents, not the control plane" message.

Plus the structural leg: **BYOK per account.** `api_keys` gains an `owner` column;
the two key-resolution funnels — the builder-session preload in
[session-binding.js](session-binding.js) and `buildDeploymentConfig()` in
[../config-builder.js](../config-builder.js) — resolve only the caller's keys. A
keyless delegate hits the *existing* "no LLM key configured" refusal, now pointing at
their own settings. Their deployed bots carry their key; revoking the delegate means
their bots stop (their key, their bots — the correct off-boarding semantics).

Deliberate exceptions, so nobody "fixes" them later:

- **House-key toggle** (`houseKeys` flag, admin-granted, default off, API keys only)
  — team API-key sharing is the provider-anticipated pattern (an account holder's key
  powering an application used by their people); the operator flips it deliberately.
- **Local inference exemption** — Ollama and the local workers have no provider
  account; a shared local model violates nothing. The rule governs credentials, not
  compute.

Doctrine note: this is **shape, not policing**. The responsibility model forbids
enforcement layers duplicating provider policy — so mojulo never *judges* usage; it
simply does not contain a machine that aggregates N identities onto one consumer
credential. Attribution on `mcp_tool_calls` makes the 1:1 property demonstrable from
telemetry, not just asserted.

## Schema (additive migration in [../db/index.js](../db/index.js))

- `users` — `id`, `name`, `role` (`admin`|`privileged`), `token_hash`, `token_epoch`,
  `expires_at`, `created_at`, `revoked_at`.
- `user_grants` — `user_id` FK, `pack_id` (validated against the PACKS manifest at
  write time), plus flag columns or a `flags_json` (`propose_only`, `outward`,
  `lifecycle`, `house_keys`).
- `workshop_spaces` — `id`, `name`, `created_by` FK. `space_members` deferred —
  v1 is one space per privileged user; a members table arrives only if two delegates
  ever need to share a room.
- Owner/scope columns: `api_keys.owner_user_id`; `workshop_space_id` (nullable) on
  `deployments`, `documents`, `sketches`, `plans` — **null = the admin's default
  space**, so every existing row is already correct. Ancestor lesson: real FKs, never
  a free-text org string.
- `mcp_tool_calls.user_id` — attribution at the telemetry seam.
- `agent task lanes` — `user_id` on parked tasks (in-memory queue field + the
  trigger-artifact owner for `parkRequestForTrigger`).

Denial semantics (lifted from the ancestor): resource-level denials return **404, not
403** — do not leak existence of artifacts outside the caller's scope.

## Identity minting + dashboard

- **One mint.** Caller context originates in exactly one place — `buildContext()` in
  [../../app/api/mcp/route.js](../../app/api/mcp/route.js), today hardcoding
  `userId:'local'`. It learns to resolve the presented bearer against `users`
  (`CONTROL_PLANE_MCP_KEY` remains the admin god-key for back-compat). Everything
  downstream already threads `userId`; repositories already accept and ignore it.
- **Dashboard wrinkle.** [../../middleware.js](../../middleware.js) is Edge runtime
  (Web Crypto only, no better-sqlite3) — which is *why* the current scheme is a
  stateless HMAC against an env password. Per-user sessions keep the token stateless
  but embed claims (`userId`, `role`, `epoch`, `exp`) signed with a server secret;
  the edge layer verifies signature + expiry only, and **revocation is checked
  lazily in the Node-runtime layer** (compare token `epoch` to `users.token_epoch` —
  bump the epoch to kill all of a user's sessions). Reworks
  [../auth/session.js](../auth/session.js); [../auth/service.js](../auth/service.js)
  stops returning the unconditional `LOCAL_USER` when roles are enabled.
- The dashboard stays a render-state surface (golden rule unchanged); a privileged
  login sees their space's pages and their granted bays' affordances.

## Sidecar ledger (how deep this cuts)

- **Pure sidecar (new files, additive tables):** users/grants/spaces tables, key
  mint/revoke module, roles-admin tools (a new admin-only pack), `authNotice()` +
  deny-list data in packs.js, credential-shape guard.
- **Stitches (~a dozen lines across five existing seams):** `buildContext()`; the
  three execution chokepoints; `listTools` filtering; `instrumentedInvoke`
  attribution; the two key-resolution funnels; queue park/pull lanes.
- **The one deep cut — scoped data (Phase 4):** repositories currently ignore
  `userId` by design ("Single-user mode" stubs, the vestigial always-null
  `botSpaceId` seam in [session-binding.js](session-binding.js) /
  [../db/repositories/botSpaces.js](../db/repositories/botSpaces.js)). Space-scoping
  means columns + threaded scope params + every `list()` being right (one miss = a
  leak). **The deny-first lever bounds it:** every cross-cutting surface denied by
  pack instead of row-filtered moves from the deep cut to the sidecar column. v1
  scopes only the four tables where delegates create things (deployments, documents,
  sketches, plans) — a trench through ~20–30 repository methods, not an excavation.
  Creative stores (stashes, beats, game_projects, research) stay unscoped until a
  real delegate needs them.
- **Check at review:** the single-writer serialization queue in [server.js](server.js)
  assumes single-user in comments only — multiple concurrent sessions already exist
  today; confirm nothing else does.

## Ancestor report (mojulo-prime), and the k8s verdict

What it was: three orthogonal axes that never merged — global role
(`user`/`admin` on `user_profiles`), per-workspace ACL (`bot_spaces` +
`bot_space_members`, `read`/`write`/`admin` ranked 1/2/3, creator implicitly admin;
access = owner ∨ space-creator ∨ ranked member), and org-scoped plan entitlements
(3 quota dimensions + a 15-key feature list). ~1,350 lines, ~11 tables, NextAuth +
bcrypt.

**Lift:** the two-role global unit; ranked "at-least" access levels if space sharing
ever arrives; 404-on-denial; creator-implicit-admin.
**Anti-patterns to not repeat:** per-route imperative enforcement drifted (a
`requireAuth()` helper existed; 61 of 72 routes hand-rolled the check anyway —
chokepoint enforcement is the entire reason this plan is cheap); org membership as a
free-text string; three unfused axes composed ad hoc at call sites (here, pack grants
*are* the entitlement vocabulary — one axis).
**Skip entirely:** billing/quotas, NextAuth (the extended HMAC scheme suffices),
invitations/email.
**Kubernetes: not worth it, with confidence.** Zero k8s references anywhere in the
ancestor's auth/billing layer — k8s was only the deploy target. Nothing in RBAC
needs it, and it would violate half the posture (self-hosted, localhost, SQLite).

## Activation + defaults

Off = today, exactly. The roles pack is **activation-gated, not disk-gated** (pure
code, no heavy dep to probe — the `MOJULO_TRIGGER_RUNTIME=enabled` pattern, not a
`WING_INSTALL` marker): `MOJULO_ROLES=enabled` + at least one admin row. Disabled ⇒
`buildContext` mints `userId:'local'`, `service.js` returns `LOCAL_USER`, zero new
checks fire, posture docs' default-install claims stay literally true.

## Build order

- **Phase 0 — doctrine.** Amend the posture docs (delta above). Text only; hardest
  review.
- **Phase 1 — identity.** `users` table, key mint/revoke/expiry, `buildContext`
  resolution, telemetry attribution, roles-admin tools. No enforcement yet beyond
  admin-only on the new tools.
- **Phase 2 — capability enforcement.** Grants + deny-list + `authNotice()` at the
  three chokepoints + `listTools` filtering + propose-vs-seal and outward/lifecycle
  flags. *After this phase the pack is already "more than a facade" for execution
  rights.*
- **Phase 3 — the 1:1 inference rule.** `api_keys.owner` + scoped resolution funnels
  + house-key toggle + agent-task lanes with loud starvation + credential-shape
  guard.
- **Phase 4 — workshop-spaces.** The bounded four-table scoping sweep + dashboard
  per-user sessions (the Edge-token rework can land here or in Phase 1).
- **Deferred, explicitly:** true tenancy (per-space secrets, scoped contextmap,
  row-filtered cross-cutting reads), quantity caps, space sharing (`space_members`),
  invitations.

## Open questions (operator decides)

1. Does a privileged key ever get Ring 3 conversation reads for **bots in its own
   space**? (Would pull bot-proxy into the Phase 4 sweep — the one cross-cutting
   surface where per-space filtering might pay early.)
2. SPINE audit: confirm every always-listed tool is read-only/orientational before
   exempting SPINE from grants.
3. Should `mint_diagram` (kernel) be implicitly granted to every key, as the
   kernel-floor gesture?
4. First consumer: which real delegate (a human collaborator, or a scheduled agent
   key for the trigger runtime) drives the acceptance test for Phase 2?

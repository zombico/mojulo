# Terms of Use

mojulo is software you install on your own machine. There is no hosted mojulo service. There is no account you sign up for, no server we operate on your behalf, no data we receive about how you use it. The maintainer ("we") publishes source code, an npm package, and a container image; everything else — what you do with it, what you build with it, what runs on your hardware — is yours.

This document describes how to think about that responsibility split. It supplements (and does not replace) the [Apache License 2.0](LICENSE) that governs the code itself, and the threat model in [SECURITY.md](SECURITY.md).

For the architectural reasons these terms look the way they do, see [docs/responsibility-model.md](docs/responsibility-model.md).

## 1. What mojulo is

mojulo is a **substrate**: a local SQLite database, a process supervisor, a set of MCP tools, and a dashboard. It does not perform inference. It does not call third-party services on its own initiative. It does not autonomously decide what to build or run.

Every action mojulo takes is one of:

1. **Initiated by you**, directly, through the dashboard or CLI; or
2. **Initiated by an MCP-speaking agent you connected to it** (e.g. Claude Code, Codex), which is itself driven by your prompts and your provider credentials.

mojulo is the workshop. You and your agent are the operator.

## 2. You direct every action

By installing and running mojulo, you accept that:

- **You choose what to build.** Bots, apps, connected services, cooks, sketches, plans, research — every artifact mojulo produces is something you (or your agent acting on your prompt) asked it to produce.
- **You choose what inputs to give it.** Documents, URLs, conversation history, MCP tool outputs, credentials — mojulo stores and composes what you put in front of it. It does not curate the inputs for you.
- **You choose what external systems it touches.** Any MCP server you connect (Gmail, Drive, Linear, your CRM, your own), any LLM provider key you paste in, any cloud deploy target (Fly, your registry) is a connection *you* established with *your* credentials, subject to *your* agreement with that vendor.
- **You choose what to do with the outputs.** Generated bots, generated documents, generated plans, generated code — once mojulo has materialized them on your disk, they are your artifacts. Publishing, deploying, sharing, selling, or deleting them is your decision.

The maintainer does not have, and is not seeking, the ability to see, approve, modify, or revoke any of these decisions.

## 3. Capability is compositional; intent is yours

mojulo ships a set of primitives — stashes, cooks, catalysts, mcp-orbit chains, bot scaffolds, app scaffolds, the polygonizer, the planner. Composed, those primitives are broadly capable. The maintainer does not enumerate, vet, predict, or restrict the combinations you and your agent can assemble from them.

That means:

- **Capability questions belong to you.** "Can mojulo do X?" usually resolves to "can the primitives, plus your MCPs, plus your agent, be composed to do X?" Whether they should be, in your context, for your purposes, on your data, is your judgment to make.
- **Intent questions belong to you.** mojulo does not infer what you are trying to accomplish, does not classify your goals as legitimate or illegitimate, and does not gate functionality on intent. If a particular use of mojulo is restricted by law, by a third-party agreement you hold, by a regulatory regime you operate under, or by your own ethics — recognizing and honoring that restriction is your responsibility.
- **Suitability questions belong to you.** mojulo is published "as-is." It is not certified for, and is explicitly not represented as suitable for: medical advice, legal advice, financial advice, safety-critical control, regulated data handling (HIPAA, PCI, GDPR-restricted categories, etc.), high-stakes autonomous decision-making, or any setting where a wrong output could materially harm a person. If you choose to use it in such a setting, the suitability assessment is yours.

The maintainer cannot evaluate your context. You can.

## 4. Third-party services

Anything mojulo connects to on your behalf — LLM providers, MCP servers, cloud hosts, image registries, vector stores — is a service you have your own relationship with. mojulo is a client; you are the customer.

You are responsible for:

- Complying with the terms of service of every LLM provider whose key you paste into mojulo, including their acceptable-use policies.
- Complying with the terms of service of every MCP server you connect to mojulo, including any rate limits, data-handling obligations, and authorized-use scopes.
- Complying with the terms of service of every deploy target (Fly, your own registry, your own infrastructure) you use to host artifacts mojulo generated.
- All costs incurred against those services. mojulo does not host inference; the bill goes to your provider, not to us.

The maintainer is not a party to those relationships and has no visibility into them.

## 5. Generated artifacts are your work product

When you or your agent direct mojulo to compile a bot, scaffold an app, render a cook, mint a sketch, or write a plan, the resulting artifact is yours. mojulo provided the workshop; you provided the intent, the inputs, and the prompts.

This means:

- **You own what you make.** Subject to the licenses of any third-party content you fed in and any provider-specific terms about model output, the artifacts are yours to keep, modify, deploy, distribute, or destroy.
- **You are responsible for what it does.** If a bot you compiled gives a bad answer, leaks data through a misconfiguration, or violates a regulation in the jurisdiction you deployed it in, that is your bot. The maintainer did not write it; you and your agent did.
- **You are responsible for what it processes.** Conversation data, uploaded documents, form submissions — these flow through bots you compiled, on infrastructure you chose. The maintainer does not see them. Any obligations you have to the people whose data passes through (notice, consent, retention limits, deletion requests) are yours.

## 6. No warranty, no fitness for purpose

The Apache 2.0 license already disclaims warranty and liability. Restating in plain language:

- mojulo is provided **as-is**, with no warranty of merchantability, fitness for a particular purpose, non-infringement, or uninterrupted operation.
- The maintainer does not warrant that mojulo will be free of bugs, security defects, or unexpected behavior.
- The maintainer does not warrant that any artifact mojulo helps you produce will be correct, complete, lawful in your jurisdiction, or fit for the use you have in mind.
- The maintainer does not warrant the behavior, availability, accuracy, or policy compliance of any third-party LLM, MCP server, or hosting provider you connect to mojulo.

If mojulo is unsuitable for your purposes, the remedy is to stop using it.

## 7. Limitation of liability

To the maximum extent permitted by law, the maintainer is not liable for any direct, indirect, incidental, consequential, special, exemplary, or punitive damages arising out of your use of mojulo. This includes loss of data, loss of revenue, loss of reputation, regulatory penalties, claims by third parties (including users of bots you built and people whose data those bots processed), and costs of substitute software or services.

If a court finds this limitation unenforceable in your jurisdiction, the maintainer's aggregate liability is capped at the amount you paid for mojulo, which is zero.

## 8. Indemnification

You agree to indemnify and hold harmless the maintainer from any claim, demand, loss, or expense (including reasonable legal fees) arising out of:

- Your use of mojulo, including any bots, apps, services, or other artifacts you produced with it.
- Your violation of any law, regulation, or third-party agreement (including LLM-provider, MCP-provider, and hosting-provider terms) in connection with that use.
- Any data you fed into mojulo or that flowed through artifacts you built with it.
- Any claim by a user of an artifact you built or deployed with mojulo.

## 9. Changes to mojulo

The maintainer may change, remove, or rename any feature of mojulo at any time, with no obligation to preserve compatibility, migrate state, or notify you. Pin the version you depend on. The roadmap is not a commitment.

## 10. Changes to these terms

These terms may be updated. The version that applies to your use of mojulo is the version in the source tree of the release you installed. There is no separate ToS server you check against; the document in the repository at the tag you pulled is the document that governs.

## 11. Governing law

These terms are interpreted under the laws of the jurisdiction in which the maintainer resides, without reference to its conflict-of-laws rules. Nothing in this document waives mandatory consumer-protection rights you have under the laws of your own jurisdiction.

## 12. Severability

If any provision of these terms is held unenforceable, the remaining provisions remain in effect. The unenforceable provision is interpreted narrowly to give effect to the maximum extent permitted.

---

If you do not accept these terms, do not install or run mojulo.

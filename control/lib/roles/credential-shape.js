/**
 * Credential-shape guard — Phase 3 of the roles pack, the 1:1 inference
 * rule's side door 2 (lib/mcp/roles-pack.plan.md): a subscription token
 * masquerading as an API key. Subscriptions authenticate AGENTS (outside the
 * control plane); the substrate stores provider API keys only. This is shape,
 * not policing — mojulo never judges usage; it simply does not contain a
 * machine that puts a consumer subscription credential behind N users.
 *
 * Unconditional (not gated on MOJULO_ROLES): storing a subscription/OAuth
 * token as an API key is a misconfiguration in single-operator mode too — it
 * would never authenticate an API call.
 */

// OAuth access/refresh tokens from the Claude subscription flow.
const ANTHROPIC_OAUTH_RE = /^sk-ant-oat/i;
// Three dot-separated base64url segments starting with an `eyJ` JSON header —
// a JWT (session/identity token), never a provider API key.
const JWT_RE = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/;

/**
 * A refusal message when `secret` is subscription/OAuth-shaped, else null.
 * Providers whose credential slot is not a secret (ollama holds an endpoint
 * URL) are exempt at the call site, not here.
 */
export function subscriptionCredentialNotice(secret) {
  if (typeof secret !== 'string') return null;
  const s = secret.trim();
  if (ANTHROPIC_OAUTH_RE.test(s)) {
    return (
      'This looks like a Claude subscription OAuth token, not an API key. Subscriptions authenticate ' +
      'agents, not the control plane — the substrate never holds one (the 1:1 inference rule). ' +
      'Paste a provider API key instead (Anthropic API keys look like sk-ant-api…).'
    );
  }
  if (JWT_RE.test(s)) {
    return (
      'This looks like a session/identity token (JWT), not a provider API key. Subscriptions and ' +
      'logins authenticate agents, not the control plane — paste the provider API key instead.'
    );
  }
  return null;
}

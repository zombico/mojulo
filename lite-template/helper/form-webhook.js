/**
 * Form-completion webhook.
 *
 * The operator sets one URL in the bot config (`formCompletionWebhook`). The
 * bot posts each completed form there itself, from /api/submit-form. The URL
 * comes from config only, never from a request body, so a visitor cannot use
 * a deployed bot to POST to an address of their choosing.
 */

const WEBHOOK_TIMEOUT_MS = 10000;

// Form-relay settings the bot uses server-side only. They stay out of the
// config the public page and /context expose: a webhook URL is often a secret
// in itself (catch-hook URLs carry their token in the path).
const SERVER_ONLY_CONFIG_KEYS = ['formCompletionWebhook', 'formSendHomeUrl', 'formSendHomeApiKey'];

/** A copy of the bot's `config` section without the server-only keys. */
function publicConfig(section) {
    const copy = { ...section };
    for (const key of SERVER_ONLY_CONFIG_KEYS) delete copy[key];
    return copy;
}

/**
 * The configured webhook URL, or null when none is set or it is not http(s).
 * @param {Object} config - Bot config object ({ config: { formCompletionWebhook } })
 */
function resolveWebhookUrl(config) {
    const raw = config?.config?.formCompletionWebhook;
    if (typeof raw !== 'string' || !raw.trim()) return null;
    let parsed;
    try {
        parsed = new URL(raw.trim());
    } catch {
        return null;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.href;
}

/**
 * POST a JSON payload to the configured webhook. The target's response body
 * stays in the server log; callers only get the status back.
 * @returns {Promise<{ success: boolean, status?: number, error?: string }>}
 */
async function postFormWebhook(url, payload, { fetchImpl = fetch, timeoutMs = WEBHOOK_TIMEOUT_MS } = {}) {
    try {
        const response = await fetchImpl(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(timeoutMs),
        });
        if (response.ok) {
            return { success: true, status: response.status };
        }
        const detail = await response.text().catch(() => '');
        console.error(`Form webhook failed: ${response.status} ${detail.slice(0, 500)}`);
        return { success: false, status: response.status, error: `HTTP ${response.status}` };
    } catch (error) {
        console.error('Form webhook error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Handler for POST /api/send-webhook: the operator re-sends a payload to the
 * configured webhook (for example to test it). Mount it behind the API-key
 * check. A body `webhookUrl` is accepted only when it equals the configured
 * URL, so older callers that still send it keep working.
 * @param {{ getWebhookUrl: () => string|null, post?: Function }} deps
 */
function createSendWebhookHandler({ getWebhookUrl, post = postFormWebhook }) {
    return async function sendWebhook(req, res) {
        const { webhookUrl, data } = req.body || {};
        const configured = getWebhookUrl();
        if (!configured) {
            return res.status(409).json({ error: 'This bot has no formCompletionWebhook configured' });
        }
        if (webhookUrl !== undefined && webhookUrl !== configured) {
            return res.status(400).json({
                error: 'webhookUrl must match the configured formCompletionWebhook; the bot posts nowhere else',
            });
        }
        if (!data || typeof data !== 'object') {
            return res.status(400).json({ error: 'data is required' });
        }
        const result = await post(configured, data);
        if (result.success) {
            return res.json({ success: true, status: result.status });
        }
        return res.status(502).json({ error: `Webhook failed: ${result.error}` });
    };
}

module.exports = {
    publicConfig,
    resolveWebhookUrl,
    postFormWebhook,
    createSendWebhookHandler,
};

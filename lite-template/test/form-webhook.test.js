// The form-completion webhook must post only to the operator-configured URL.
// Before bot 0.5.2, POST /api/send-webhook took the target from the request
// body with no API key and open CORS, so any visitor could make a deployed
// bot POST to any address and read back the response.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    publicConfig,
    resolveWebhookUrl,
    postFormWebhook,
    createSendWebhookHandler,
} = require('../helper/form-webhook.js');

function fakeRes() {
    return {
        statusCode: 200,
        body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
    };
}

function recordingPost() {
    const calls = [];
    const post = async (url, data) => { calls.push({ url, data }); return { success: true, status: 200 }; };
    return { calls, post };
}

const CONFIGURED = 'https://hooks.example.com/catch/abc';

test('resolveWebhookUrl reads only http(s) URLs from config', () => {
    assert.equal(resolveWebhookUrl({ config: { formCompletionWebhook: CONFIGURED } }), CONFIGURED);
    assert.equal(resolveWebhookUrl({ config: { formCompletionWebhook: '' } }), null);
    assert.equal(resolveWebhookUrl({ config: { formCompletionWebhook: 'file:///etc/passwd' } }), null);
    assert.equal(resolveWebhookUrl({ config: { formCompletionWebhook: 'not a url' } }), null);
    assert.equal(resolveWebhookUrl(null), null);
});

test('send-webhook posts to the configured URL, never to a body URL', async () => {
    const { calls, post } = recordingPost();
    const handler = createSendWebhookHandler({ getWebhookUrl: () => CONFIGURED, post });

    const res = fakeRes();
    await handler({ body: { webhookUrl: 'http://169.254.169.254/latest/meta-data', data: { a: 1 } } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(calls.length, 0);

    const ok = fakeRes();
    await handler({ body: { data: { a: 1 } } }, ok);
    assert.equal(ok.statusCode, 200);
    assert.deepEqual(calls, [{ url: CONFIGURED, data: { a: 1 } }]);

    // Older callers that echo the configured URL still work.
    const echo = fakeRes();
    await handler({ body: { webhookUrl: CONFIGURED, data: { b: 2 } } }, echo);
    assert.equal(echo.statusCode, 200);
    assert.equal(calls[1].url, CONFIGURED);
});

test('send-webhook refuses when no webhook is configured', async () => {
    const { calls, post } = recordingPost();
    const handler = createSendWebhookHandler({ getWebhookUrl: () => null, post });
    const res = fakeRes();
    await handler({ body: { webhookUrl: 'https://attacker.example/', data: { a: 1 } } }, res);
    assert.equal(res.statusCode, 409);
    assert.equal(calls.length, 0);
});

test('send-webhook does not echo the target response body', async () => {
    const handler = createSendWebhookHandler({
        getWebhookUrl: () => CONFIGURED,
        post: async () => ({ success: false, status: 500, error: 'HTTP 500' }),
    });
    const res = fakeRes();
    await handler({ body: { data: { a: 1 } } }, res);
    assert.equal(res.statusCode, 502);
    assert.deepEqual(Object.keys(res.body), ['error']);
});

test('postFormWebhook sends JSON and reports only the status', async () => {
    const seen = [];
    const fetchImpl = async (url, init) => {
        seen.push({ url, init });
        return { ok: false, status: 403, text: async () => 'internal detail' };
    };
    const result = await postFormWebhook(CONFIGURED, { x: 1 }, { fetchImpl });
    assert.equal(seen[0].url, CONFIGURED);
    assert.equal(seen[0].init.method, 'POST');
    assert.equal(seen[0].init.body, '{"x":1}');
    assert.deepEqual(result, { success: false, status: 403, error: 'HTTP 403' });
});

test('publicConfig keeps relay targets out of what visitors see', () => {
    const section = {
        name: 'Bot',
        formCompletionWebhook: CONFIGURED,
        formSendHome: true,
        formSendHomeUrl: 'https://control.example/api/forms',
    };
    const visible = publicConfig(section);
    assert.equal(visible.name, 'Bot');
    assert.equal(visible.formSendHome, true);
    assert.equal('formCompletionWebhook' in visible, false);
    assert.equal('formSendHomeUrl' in visible, false);
    assert.equal(section.formCompletionWebhook, CONFIGURED);
});

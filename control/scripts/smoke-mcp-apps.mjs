#!/usr/bin/env node
// Browser bridge smoke against fixtures emitted by apps/preview.test.js.
// MOJULO_CHROMIUM=/path/to/chrome node scripts/smoke-mcp-apps.mjs --fixture-dir /absolute/dir
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const [flag, dir] = process.argv.slice(2);
if (flag !== '--fixture-dir' || !path.isAbsolute(dir || '') || !process.env.MOJULO_CHROMIUM) throw new Error('Provide --fixture-dir /absolute/dir and MOJULO_CHROMIUM');
const html = fs.readFileSync(path.join(dir, 'preview.html'));
const results = JSON.parse(fs.readFileSync(path.join(dir, 'results.json')));
const parent = `<!doctype html><html><body style="margin:0"><iframe title="Mojulo" sandbox="allow-scripts" style="width:100%;height:540px;border:0" src="/widget"></iframe><script>
const frame=document.querySelector('iframe');window.calls=[];
window.addEventListener('message',async event=>{
 if(event.source!==frame.contentWindow||event.data?.jsonrpc!=='2.0')return;
 const m=event.data;window.calls.push(m);let result;
 if(m.method==='ui/initialize')result={protocolVersion:'2026-01-26',hostInfo:{name:'local-test-host',version:'1'},hostCapabilities:{}};
 else if(m.method==='ui/notifications/initialized'){const r=await fetch('/result/0').then(r=>r.json());frame.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:r},'*');return;}
 else if(m.method==='tools/call'){if(m.params.name!=='preview_world'||m.params.arguments.ref!=='apps_city')throw Error('Wrong refresh target');result=await fetch('/result/1').then(r=>r.json());}
 else return;
 frame.contentWindow.postMessage({jsonrpc:'2.0',id:m.id,result},'*');
});</script></body></html>`;
const server = http.createServer((req, res) => {
  if (req.url === '/widget') {
    res.setHeader('Content-Type', 'text/html');
    // Exercise no external fetches and an opaque iframe origin, like an app sandbox.
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline' data: blob:; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; frame-src 'none'");
    return res.end(html);
  }
  if (req.url?.startsWith('/result/')) { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(results[req.url.endsWith('1') ? 1 : 0])); }
  res.setHeader('Content-Type', 'text/html'); res.end(parent);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await puppeteer.launch({ executablePath: process.env.MOJULO_CHROMIUM, headless: true, args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage(); await page.setViewport({ width: 1000, height: 650 });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const frame = await (await page.$('iframe')).contentFrame();
  await frame.waitForFunction(() => document.querySelector('#status').textContent.includes('Mesh snapshot'), { timeout: 30000 });
  assert.equal(await frame.$eval('#label', e => e.textContent), 'Preview city');
  await page.screenshot({ path: path.join(dir, 'preview-before.png') });
  await frame.click('#refresh');
  await frame.waitForFunction(() => !document.querySelector('#refresh').disabled && document.querySelector('#status').textContent.includes('Mesh snapshot'));
  await page.screenshot({ path: path.join(dir, 'preview-after.png') });
  assert.notDeepEqual(fs.readFileSync(path.join(dir, 'preview-before.png')), fs.readFileSync(path.join(dir, 'preview-after.png')));
  const calls = await page.evaluate(() => window.calls);
  assert(calls.some(c => c.method === 'tools/call' && c.params.arguments.ref === 'apps_city'));
  const canvas = await frame.$('canvas'), box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 35, { steps: 12 }); await page.mouse.up();
  await page.screenshot({ path: path.join(dir, 'preview-orbit.png') });
  assert.notDeepEqual(fs.readFileSync(path.join(dir, 'preview-after.png')), fs.readFileSync(path.join(dir, 'preview-orbit.png')));
  await frame.click('#reset');
  assert.deepEqual(errors, []);
  const report = { ok: true, checks: ['opaque sandbox and offline CSP', 'bridge initialize and tool result', 'WebGL mesh display', 'same-ref refresh', 'orbit and reset controls'], chatgptFieldTest: false };
  fs.writeFileSync(path.join(dir, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }

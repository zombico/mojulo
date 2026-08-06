#!/usr/bin/env node
// Screenshot a LIVE world served by the dev server (localhost:3001) — proves the
// stored recipe renders in the real runtime. Usage:
//   node scripts/shoot-world.mjs <ref> [outPng] [--settle 2500]
import { writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { resolveChromium, CHROMIUM_WEBGL_ARGS } from '../lib/graph/scene/chromium.js';

const argv = process.argv.slice(2);
const ref = argv.find((a) => !a.startsWith('--'));
const out = argv.filter((a) => !a.startsWith('--'))[1] || `/tmp/${ref}.png`;
const settle = Number((argv.find((a) => a.startsWith('--settle')) || '').split('=')[1] || argv[argv.indexOf('--settle') + 1] || 2500);
const url = `http://127.0.0.1:3001/api/sketches/${encodeURIComponent(ref)}/world`;

const executablePath = await resolveChromium();
const browser = await puppeteer.launch({ executablePath, headless: true, args: CHROMIUM_WEBGL_ARGS });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 });
  const resp = await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  console.error(`GET ${url} → ${resp.status()}`);
  await new Promise((r) => setTimeout(r, settle));
  const buf = await page.screenshot({ type: 'png' });
  writeFileSync(out, buf);
  console.log(out);
} finally { await browser.close(); }

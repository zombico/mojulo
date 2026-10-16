import {it,expect} from 'vitest';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {compileSupercarSurface} from './vehicle-odm-surface.js';
import {emitVehicleReview} from './vehicle-review.js';
import {resolveChromium,launchChromium,CHROMIUM_WEBGL_ARGS} from '../scene/chromium.js';

it('renders the budgeted material mesh offline without shader errors and exposes wireframe inspection',async()=>{
  const puppeteer=(await import(pathToFileURL(createRequire(import.meta.url).resolve('puppeteer-core')).href)).default;
  const browser=await launchChromium({executablePath:await resolveChromium({allowFetch:false}),headless:true,args:CHROMIUM_WEBGL_ARGS}, {launch:o=>puppeteer.launch(o)});
  try {
    const page=await browser.newPage(),errors=[],network=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.setRequestInterception(true);
    page.on('request',req=>{if(/^https?:/.test(req.url())){network.push(req.url());req.abort();}else req.continue();});
    await page.setViewport({width:960,height:600,deviceScaleFactor:1});
    const c=compileSupercarSurface({seed:1014},{quality:'game'});
    await page.setContent(emitVehicleReview(c,{cameraPosition:[3.2,-5,1.9]}),{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__supercarReview?.ready&&window.__supercarReview.frame>=4,{timeout:30000});
    const result=await page.evaluate(()=>window.__supercarReview);
    expect(result.errors).toEqual([]);
    expect(errors).toEqual([]);
    expect(network).toEqual([]);
    expect(result.stats.triangles).toBe(c.census.triangles);
    expect(result.renderInfo.triangles).toBe(c.census.triangles+2);
    expect(result.renderInfo.calls).toBe(c.census.materialGroups+1);
    expect(result.stats.gpuVertices).toBeLessThan(c.census.triangles*3);
    await page.click('#wireframe');
    expect(await page.$eval('#wireframe',el=>el.getAttribute('aria-pressed'))).toBe('true');
    await page.waitForFunction(frame=>window.__supercarReview.frame>frame+1,{},result.frame);
    expect(await page.evaluate(()=>window.__supercarReview.errors)).toEqual([]);
  } finally {await browser.close();}
},60000);

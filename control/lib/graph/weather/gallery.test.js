import { describe, it, expect } from 'vitest';
import { weatherGallery, GALLERY_STYLES } from './gallery.js';
import { STATE_NAMES, CLIMATE_NAMES } from './weather.js';

describe('the weather gallery', () => {
  const files = weatherGallery({ seed: 4 });
  it('is one page a style and an index that reaches every state and every climate', () => {
    expect(Object.keys(files).sort()).toEqual([...GALLERY_STYLES.map(([id]) => `${id}.html`), 'index.html'].sort());
    for (const n of STATE_NAMES) expect(files['index.html']).toContain(`data-wx="${n}"`);
    for (const n of CLIMATE_NAMES) expect(files['index.html']).toContain(`data-climate="${n}"`);
  });
  it('each page holds the pools of every state, every climate, and reads its sky off the address', () => {
    for (const [id] of GALLERY_STYLES) {
      const h = files[`${id}.html`];
      expect(h).toContain('window.__mojWeather');
      expect(h).toContain("GQ.get('wx')");
      for (const n of CLIMATE_NAMES) expect(h, `${id} ${n}`).toContain(`"${n}":{"climate"`);
      for (const n of STATE_NAMES) expect(h, `${id} ${n}`).toContain(`"${n}":{"family"`);
    }
  });
  it('the styles differ in the air they draw in: banded, smooth, dithered', () => {
    expect(files['cel.html']).toContain('"body":"banded"');
    expect(files['painted.html']).toContain('"body":"smooth"');
    expect(files['pixel.html']).toContain('"body":"dithered"');
  });
  it('a page not in the gallery carries none of it', async () => {
    const { weatherScript } = await import('../scene/channels/weather.js');
    const { readWeather } = await import('./weather.js');
    expect(weatherScript({ weather: readWeather('temperate'), seed: 1 })).not.toContain('GQ');
  });
});

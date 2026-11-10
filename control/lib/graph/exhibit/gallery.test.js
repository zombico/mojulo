// The gallery: exhibits joined as rooms by ref, checked against the store; its page a lobby, framed rooms and a kiosk.
import { describe, it, expect } from 'vitest';
import { galleryManifest, galleryRooms, galleryHtml, isGalleryKind, KIOSK_IDLE, GALLERY_LIMITS } from './gallery.js';

const store = {
  sk_cell: { ref: 'sk_cell', title: 'Cell', manifest: { kind: 'cellular-view', tour: { title: 'Inside a cell', stops: [{ caption: 'A city in a membrane.', camera: 'angle' }, { caption: 'Power.', camera: 'top' }] } } },
  sk_dam: { ref: 'sk_dam', title: 'Dam', manifest: { kind: 'hydro-view' } },
  sk_chart: { ref: 'sk_chart', title: 'A chart', manifest: { title: 'boxes', stations: [] } },
};
const get = (r) => store[r] ?? null;

describe('a gallery recipe', () => {
  it('keeps refs, a room\'s own title, its intro and its kiosk', () => {
    const m = galleryManifest({ kind: 'gallery', title: 'Energy', intro: 'Small and large.', rooms: ['sk_cell', { ref: 'sk_dam', title: 'The dam' }], kiosk: { idle: 30 } }, get);
    expect(m).toEqual({ kind: 'gallery', title: 'Energy', intro: 'Small and large.', rooms: ['sk_cell', { ref: 'sk_dam', title: 'The dam' }], kiosk: { idle: 30 } });
    expect(galleryManifest({ kind: 'gallery', rooms: ['sk_cell'], kiosk: true }, get).kiosk).toBe(true);
    expect(galleryManifest({ kind: 'gallery', rooms: ['sk_cell'], kiosk: {} }, get).kiosk).toBe(true);
    expect(isGalleryKind('gallery')).toBe(true);
  });

  it('refuses what is not a room, saying why', () => {
    const at = (m) => () => galleryManifest({ kind: 'gallery', ...m }, get);
    expect(at({ rooms: [] })).toThrow(/rooms is a list of one made exhibit or more/);
    expect(at({ rooms: ['sk_nope'] })).toThrow(/rooms\[0\]\.ref names no sketch 'sk_nope'/);
    expect(at({ rooms: ['sk_chart'] })).toThrow(/'sk_chart' is a sketch, not an exhibit or a world/);
    expect(at({ rooms: ['sk_cell', 'sk_cell'] })).toThrow(/repeats 'sk_cell'/);
    expect(at({ rooms: [{ ref: 'sk_cell', stops: 3 }] })).toThrow(/has 'stops' \(a room takes ref and title\)/);
    expect(at({ rooms: ['sk_cell'], kiosk: { idle: 5 } })).toThrow(new RegExp(`kiosk is true or \\{ idle: seconds, ${GALLERY_LIMITS.idleMin}`));
    expect(at({ rooms: ['sk_cell'], music: 'x' })).toThrow(/'music' is not a gallery key/);
  });
});

describe('the gallery page', () => {
  const m = galleryManifest({ kind: 'gallery', title: 'Energy <small>', rooms: ['sk_cell', 'sk_dam'] }, get);
  const rooms = galleryRooms(m, get, { describe: (s) => (s.ref === 'sk_cell' ? 'Life' : null) });

  it('reads each room as it is now: its tour\'s title, stops and first caption, its label', () => {
    expect(rooms).toEqual([
      { ref: 'sk_cell', title: 'Inside a cell', label: 'Life', stops: 2, lead: 'A city in a membrane.' },
      { ref: 'sk_dam', title: 'Dam', label: null, stops: 0, lead: null },
    ]);
  });

  it('is one self-contained document: rooms framed by the src it is given, titles escaped, nothing fetched', () => {
    const html = galleryHtml({ title: m.title, rooms }, { src: (r) => `rooms/${r.ref}.html` });
    expect(html).toContain('"src":"rooms/sk_cell.html"');
    expect(html).toContain('Energy &lt;small&gt;');
    expect(html).not.toMatch(/<script[^>]+src=|<link[^>]+href=|https?:\/\//);
    // the same rooms, the same page
    expect(galleryHtml({ title: m.title, rooms }, { src: (r) => `rooms/${r.ref}.html` })).toBe(html);
  });

  it('is a kiosk when the recipe says (its idle) or the address does (the default idle)', () => {
    expect(galleryHtml({ rooms, kiosk: { idle: 30 } }, { src: (r) => r.ref })).toContain('const IDLE = 30 * 1000 ||');
    expect(galleryHtml({ rooms, kiosk: true }, { src: (r) => r.ref })).toContain(`const IDLE = ${KIOSK_IDLE} * 1000 ||`);
    expect(galleryHtml({ rooms }, { src: (r) => r.ref })).toContain(`const IDLE = 0 * 1000 || (/[?&]kiosk=(?!0)/.test(location.search) ? ${KIOSK_IDLE * 1000} : 0)`);
  });
});

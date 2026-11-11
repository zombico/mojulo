// Where an exhibit is seen: the web form when every page fits a web page host, else a download, and the words that
// tell the person which, so the download is never opened on a web page and taken for broken.
import { describe, it, expect } from 'vitest';
import { exhibitWhere, WEB_PAGE_BYTES } from './where.js';

const MB = 1024 * 1024;

describe('where an exhibit is seen', () => {
  it('is the web when every web page fits, and says the download is for a computer', () => {
    const w = exhibitWhere({ pages: [{ file: 'a', bytes: 10 * MB }], web: [{ file: 'b', bytes: 9 * MB }], entry: 'gallery/index.html', webEntry: 'gallery-cdn/index.html' });
    expect(w).toMatchObject({ form: 'web', fits: true, largest: 9 * MB, budget: WEB_PAGE_BYTES });
    expect(w.tell).toMatch(/show gallery-cdn\/index\.html/);
    expect(w.tell).toMatch(/gallery\/index\.html is the download/);
  });

  it('is a download when a page is over the host\'s limit, said before the person opens it', () => {
    const w = exhibitWhere({ pages: [{ file: 'a', bytes: 41 * MB }], web: [{ file: 'b', bytes: 40 * MB }], budget: 16 * MB, against: 'Claude Code on the web page limit', entry: 'world.html', webEntry: 'world.cdn.html' });
    expect(w).toMatchObject({ form: 'download', fits: false });
    expect(w.tell).toMatch(/too big to show as a web page .*40\.0 MB.*16\.0 MB.*open world\.html from your computer/);
    expect(w.why).toMatch(/Claude Code on the web page limit/);
  });

  it('is a download in a build that never fetches from the CDN, whatever its size', () => {
    const w = exhibitWhere({ pages: [{ file: 'a', bytes: MB }], plugin: true, entry: 'world.html' });
    expect(w.form).toBe('download');
    expect(w.tell).toMatch(/open world\.html from your computer/);
  });

  it('asked for the web form alone, names only it, and says how to get a download when it is too big', () => {
    expect(exhibitWhere({ web: [{ file: 'b', bytes: MB }], webEntry: 'gallery-cdn/index.html' }).tell).not.toMatch(/is the download/);
    expect(exhibitWhere({ web: [{ file: 'b', bytes: 20 * MB }], webEntry: 'x' }).tell).toMatch(/export it as a download \(without cdn\)/);
  });
});

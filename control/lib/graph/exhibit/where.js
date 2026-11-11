/**
 * WHERE AN EXHIBIT IS SEEN: the web or a download, decided at export and said to the person, so nobody opens the wrong
 * form and thinks the exhibit is broken.
 *
 *   web       every page fits a web page host's limit: the web form (three.js fetched from the CDN) is written beside the
 *             download and is the one to show; a page host that refuses code built into the page (an artifact host)
 *             runs it.
 *   download  a page is over that limit, or this build writes only the self-contained form (the Claude plugin's): the
 *             person saves it and opens it from their own computer. Shown on a web page host, it would draw only its
 *             background, so they are told before they open it.
 *
 * Pure: the export measures the pages and hands them in.
 */

/** The page limit a web host is measured against when the host is not known: an artifact's, 16 MiB a page. */
export const WEB_PAGE_BYTES = 16 * 1024 * 1024;

const mb = (n) => `${(n / (1024 * 1024)).toFixed(1)} MB`;

/**
 * pages: the download form's pages [{ file, bytes }]; web: the web form's pages, when it was written; budget: the host's
 * page limit (null: not known, measured against WEB_PAGE_BYTES); entry / webEntry: what the person opens.
 * → { form: 'web' | 'download', fits, largest, budget, against, why?, tell }
 */
export function exhibitWhere({ pages = [], web = null, budget = null, against = null, plugin = false, entry, webEntry = null }) {
  const limit = budget ?? WEB_PAGE_BYTES, on = against ?? 'a web page host (an artifact: 16 MB a page)';
  const measured = web ?? pages, largest = measured.reduce((m, p) => Math.max(m, p.bytes), 0);
  const fits = largest <= limit;
  const base = { fits, largest, budget: limit, against: on };
  if (plugin) {
    return { ...base, form: 'download', why: 'this build writes only the self-contained form',
      tell: `This is a download: save it and open ${entry} from your computer. It does not run as a web page here, where it would show only its background.` };
  }
  if (!fits) {
    return { ...base, form: 'download', why: `its largest page is ${mb(largest)}, over the ${mb(limit)} limit of ${on}`,
      tell: entry
        ? `This one is too big to show as a web page (its largest page is ${mb(largest)}; the limit is ${mb(limit)}), so it is a download: save it and open ${entry} from your computer. On a web page it would show only its background.`
        : `This one is too big to show as a web page (its largest page is ${mb(largest)}; the limit is ${mb(limit)}): export it as a download (without cdn), to save and open from a computer.` };
  }
  return { ...base, form: 'web',
    tell: `This fits on the web: show ${webEntry}, which runs in a browser and fetches its 3D engine from the internet.${entry ? ` ${entry} is the download, for a kiosk or a computer with no internet: it opens from disk, and on a web page it would show only its background.` : ''}` };
}

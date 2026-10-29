// THE CHANGELOG'S UNRELEASED THEMES (control/changelog/README.md): one file a theme under control/changelog/<MMYY>/<MMDD>/,
// so branches in flight never edit the same lines; this reads them as one Unreleased section and folds them into
// CHANGELOG.md at a release.
//
//   node scripts/changelog.mjs                         print what is unreleased: CHANGELOG.md's Unreleased, then the themes
//   node scripts/changelog.mjs --check                 every theme file well formed (exit 1 and the reasons if not)
//   node scripts/changelog.mjs --release X.Y.Z [--date YYYY-MM-DD]
//                                                      write ## [X.Y.Z] - date under Unreleased, everything unreleased in it,
//                                                      and delete the theme files
//
// Run from control/. Themes are ordered by month (its year, then its month), day, then name.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CONTROL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const THEMES_DIR = path.join(CONTROL, 'changelog');
const MONTH = /^(0[1-9]|1[0-2])(\d\d)$/, DAY = /^(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/, NAME = /^[a-z0-9]+(-[a-z0-9]+)*\.md$/;
const dirs = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : []);
const files = (d) => fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name);

/** The theme files under `dir`, in order: [{ month, day, name, file, text }]; and `problems`, what is not well formed. */
export function readThemes(dir = THEMES_DIR) {
  const themes = [], problems = [];
  for (const month of dirs(dir)) {
    const m = MONTH.exec(month);
    if (!m) { problems.push(`${month}/: a month folder is MMYY (1026 is October 2026)`); continue; }
    for (const e of fs.readdirSync(path.join(dir, month), { withFileTypes: true })) if (e.isFile()) problems.push(`${month}/${e.name}: a theme file goes in a day folder, ${month}/<MMDD>/`);
    for (const day of dirs(path.join(dir, month))) {
      const d = DAY.exec(day);
      if (!d) { problems.push(`${month}/${day}/: a day folder is MMDD (1027 is October 27th)`); continue; }
      if (d[1] !== m[1]) problems.push(`${month}/${day}/: the day's month (${d[1]}) is not its folder's (${m[1]})`);
      for (const name of files(path.join(dir, month, day))) {
        const file = path.join(dir, month, day, name), text = fs.readFileSync(file, 'utf8');
        if (!NAME.test(name)) problems.push(`${month}/${day}/${name}: a theme file is named in kebab case, <theme>.md`);
        else if (!/^### \S/.test(text)) problems.push(`${month}/${day}/${name}: its first line is the theme's heading, ### <title>`);
        else themes.push({ month, day, name, file, text: text.trim() });
      }
    }
  }
  // (by year, then month, then day, then name: MMYY is not in order as text across a year's turn)
  const key = (t) => `${t.month.slice(2)}${t.month.slice(0, 2)}${t.day}${t.name}`;
  themes.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
  return { themes, problems };
}

// CHANGELOG.md split round its Unreleased section: what is before it (through its heading), its body, and what follows
function split(changelog) {
  const at = changelog.indexOf('## [Unreleased]');
  if (at < 0) throw new Error('changelog: CHANGELOG.md has no ## [Unreleased] section');
  const bodyAt = changelog.indexOf('\n', at) + 1, next = changelog.slice(bodyAt).search(/^## \[/m);
  const end = next < 0 ? changelog.length : bodyAt + next;
  return { head: changelog.slice(0, bodyAt), body: changelog.slice(bodyAt, end).trim(), tail: changelog.slice(end) };
}

/** What is unreleased: CHANGELOG.md's Unreleased body, then each theme's file. */
export function unreleased(changelog, themes) {
  return [split(changelog).body, ...themes.map((t) => t.text)].filter(Boolean).join('\n\n');
}

/** CHANGELOG.md with a release: `## [version] - date` under an empty Unreleased, everything unreleased in it. */
export function fold(changelog, themes, version, date) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`changelog: '${version}' is not a version (X.Y.Z)`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`changelog: '${date}' is not a date (YYYY-MM-DD)`);
  if (changelog.includes(`## [${version}]`)) throw new Error(`changelog: ${version} is already released`);
  const { head, tail } = split(changelog), notes = unreleased(changelog, themes);
  if (!notes) throw new Error('changelog: nothing is unreleased');
  return `${head}\n## [${version}] - ${date}\n\n${notes}\n\n${tail}`;
}

const main = () => {
  const args = process.argv.slice(2), arg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const file = path.join(CONTROL, 'CHANGELOG.md'), changelog = fs.readFileSync(file, 'utf8'), { themes, problems } = readThemes();
  if (args.includes('--check') || args.includes('--release')) {
    if (problems.length) { console.error(`changelog: ${problems.length} theme file${problems.length === 1 ? '' : 's'} not well formed (control/changelog/README.md):\n- ${problems.join('\n- ')}`); process.exit(1); }
    if (args.includes('--check')) { console.log(`changelog: ${themes.length} theme file${themes.length === 1 ? '' : 's'}, all well formed`); return; }
  }
  if (args.includes('--release')) {
    const version = arg('--release'), date = arg('--date') ?? new Date().toISOString().slice(0, 10);
    fs.writeFileSync(file, fold(changelog, themes, version, date));
    for (const t of themes) fs.rmSync(t.file);
    // (the emptied day and month folders go with them; the README stays)
    for (const month of dirs(THEMES_DIR)) { for (const day of dirs(path.join(THEMES_DIR, month))) if (!fs.readdirSync(path.join(THEMES_DIR, month, day)).length) fs.rmdirSync(path.join(THEMES_DIR, month, day)); if (!fs.readdirSync(path.join(THEMES_DIR, month)).length) fs.rmdirSync(path.join(THEMES_DIR, month)); }
    console.log(`changelog: ${version} - ${date} written, ${themes.length} theme file${themes.length === 1 ? '' : 's'} folded in`);
    return;
  }
  if (problems.length) console.error(`(not well formed, left out: ${problems.join('; ')})`);
  console.log(`## [Unreleased]\n\n${unreleased(changelog, themes)}`);
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

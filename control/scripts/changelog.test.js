import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readThemes, unreleased, fold, THEMES_DIR } from './changelog.mjs';

const tree = (files) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'changelog-'));
  for (const [f, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); }
  return dir;
};
const CL = '# Changelog\n\nintro\n\n## [Unreleased]\n\n### Old theme\n\nwritten before\n\n## [3.1.1] - 2026-10-16\n\nreleased\n';

describe('the changelog\'s unreleased themes', () => {
  it('reads one file a theme, by month (its year first), day and name', () => {
    const dir = tree({ '0127/0103/a.md': '### January\n', '1226/1230/b.md': '### December\n', '1026/1028/z.md': '### Late\n', '1026/1027/m.md': '### Early\n', 'README.md': 'not a theme' });
    const { themes, problems } = readThemes(dir);
    expect(problems).toEqual([]);
    expect(themes.map((t) => t.text)).toEqual(['### Early', '### Late', '### December', '### January']);
  });

  it('names what is not well formed: a month or day that is not one, a day in the wrong month, a name, a heading', () => {
    const dir = tree({ '2026/1027/a.md': '### x\n', '1026/1127/b.md': '### x\n', '1026/1027/Bad_Name.md': '### x\n', '1026/1027/no-head.md': 'text\n', '1026/stray.md': '### x\n' });
    const { problems } = readThemes(dir);
    expect(problems.join('\n')).toMatch(/2026\/: a month folder is MMYY/);
    expect(problems.join('\n')).toMatch(/1127\/: the day's month/);
    expect(problems.join('\n')).toMatch(/Bad_Name\.md: a theme file is named in kebab case/);
    expect(problems.join('\n')).toMatch(/no-head\.md: its first line is the theme's heading/);
    expect(problems.join('\n')).toMatch(/stray\.md: a theme file goes in a day folder/);
  });

  it('is one Unreleased section, and folds into a release under an empty one', () => {
    const { themes } = readThemes(tree({ '1026/1027/new-theme.md': '### New theme\n\nwritten after\n' }));
    expect(unreleased(CL, themes)).toBe('### Old theme\n\nwritten before\n\n### New theme\n\nwritten after');
    const out = fold(CL, themes, '3.2.0', '2026-11-02');
    expect(out).toMatch(/## \[Unreleased\]\n\n## \[3\.2\.0\] - 2026-11-02\n\n### Old theme\n\nwritten before\n\n### New theme\n\nwritten after\n\n## \[3\.1\.1\] - 2026-10-16/);
    expect(() => fold(out, [], '3.2.0', '2026-11-02')).toThrow(/already released/);
    expect(() => fold(out, [], '3.3.0', '2026-11-02')).toThrow(/nothing is unreleased/);
  });

  it('the repo\'s own theme files are well formed', () => {
    expect(readThemes(THEMES_DIR).problems).toEqual([]);
  });
});

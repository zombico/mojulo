# The changelog's unreleased themes

Each theme of unreleased work is its own file, so branches in flight never edit the same lines (the head of
`CHANGELOG.md`'s Unreleased section was a merge conflict on every branch).

```
control/changelog/<MMYY>/<MMDD>/<theme>.md
```

- `<MMYY>`: the month, month then year, two digits each (`1026` is October 2026, `0127` January 2027).
- `<MMDD>`: the day inside it, month then day (`1027` is October 27th, `0101` January 1st): the day the branch is named
  for (`1027-racing-arenas` writes into `1026/1027/`).
- `<theme>.md`: one file a theme, named for its plan in kebab case (`gen7-trail-flora.md`). Its first line is the
  theme's heading, `### <title>`, and the rest is what the theme's section in Unreleased would have held. A theme that
  grows over several days keeps its first day's file.
- Edit only your own theme's file. A theme from another branch is that branch's.

Read the whole of what is unreleased (`CHANGELOG.md`'s Unreleased section, then these files by month and day; the script
orders the months by year, so a January follows the December before it):

```bash
cd control && node scripts/changelog.mjs
node scripts/changelog.mjs --check      # every file well formed: a valid month and day, a kebab-case name, a ### heading
```

At a release, `node scripts/changelog.mjs --release X.Y.Z` writes `## [X.Y.Z] - <today>` under Unreleased with
everything unreleased in it (`--date YYYY-MM-DD` for another day) and deletes these files; the release workflow reads that
section as it always has.

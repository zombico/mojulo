/**
 * cookbook — the operator's OWN recipe book (recipe-book.plan.md, Phase 5):
 * the write path that turns the book architecture from a distribution channel
 * into the workshop's memory. `save_recipe` promotes a minted-and-tuned
 * sketch into a named, intent-recallable catalog entry here.
 *
 * Location: beside the instance's data (cards.js/cookbookDir — repo-dev:
 * control/data/cookbook; CLI: ~/.mojulo/data/cookbook). Same format as the
 * upstream book — same manifest.json, same card.md + recipe.json — which is
 * what makes sharing free: a cookbook IS a valid book (a friend clones yours
 * as THEIR upstream; contributing to the community catalog is copying a
 * folder into a PR).
 *
 * Git posture: the cookbook is its own git repo with NO REMOTE. This module
 * makes LOCAL commits only — an inspectable ledger of kept recipes. Pushing
 * or sharing is the OPERATOR's act with their own git, never mojulo's
 * (loopback posture). Git is best-effort: absent a git binary the cookbook
 * still works as a plain folder, saves just aren't ledgered.
 *
 * Door-1 ONLY: this module writes recipe entries (pure data). The loader
 * refuses cookbook builder entries by design — see the Phase-5 scope guard.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cookbookDir, controlVersion } from './cards.js';

function git(dir, args) {
  try {
    execFileSync('git', args, { cwd: dir, stdio: 'pipe', timeout: 10_000 });
    return true;
  } catch { return false; }
}

/**
 * Create the cookbook skeleton if absent (dir + manifest + local git repo).
 * Idempotent. Returns { dir, created, git }.
 */
export function ensureCookbook(dirOverride) {
  const dir = cookbookDir(dirOverride);
  const manifestPath = join(dir, 'manifest.json');
  const created = !existsSync(manifestPath);
  if (created) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(manifestPath, JSON.stringify({
      book: 'cookbook',
      bookVersion: '0.0.0',
      // stamped at creation so a cookbook carried to an OLDER mojulo gates
      // cleanly like any book; save_recipe never raises it afterwards.
      requiresMojulo: `>=${controlVersion()}`,
      chapters: [],
      entries: [],
    }, null, 2) + '\n');
  }
  let gitOk = existsSync(join(dir, '.git'));
  if (!gitOk) {
    gitOk = git(dir, ['init', '-q'])
      && git(dir, ['add', '-A'])
      && git(dir, ['commit', '-q', '-m', 'cookbook: init']);
  }
  return { dir, created, git: gitOk };
}

/**
 * Write one Door-1 recipe entry (chapters/<chapter>/<id>/{card.md,
 * recipe.json}), append it to the manifest, and ledger the save with a local
 * commit. The caller (save_recipe) has already validated ids and drafted the
 * card. Returns { dir, entryDir, committed }.
 */
export function saveRecipeEntry({ id, chapter, cardText, recipe, dirOverride }) {
  const { dir } = ensureCookbook(dirOverride);
  const manifestPath = join(dir, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  if ((manifest.entries || []).some((e) => e.id === id)) {
    throw new Error(`cookbook already has an entry '${id}' — pick another id or delete chapters/…/${id} first`);
  }

  const entryDir = join(dir, 'chapters', chapter, id);
  mkdirSync(entryDir, { recursive: true });
  writeFileSync(join(entryDir, 'card.md'), cardText);
  writeFileSync(join(entryDir, 'recipe.json'), JSON.stringify(recipe, null, 2) + '\n');

  manifest.entries = [...(manifest.entries || []), { type: 'recipe', chapter, dir: id, id, since: manifest.bookVersion || '0.0.0' }];
  if (!Array.isArray(manifest.chapters)) manifest.chapters = [];
  if (!manifest.chapters.includes(chapter)) manifest.chapters.push(chapter);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  const committed = git(dir, ['add', '-A']) && git(dir, ['commit', '-q', '-m', `save recipe: ${id}`]);
  return { dir, entryDir, committed };
}

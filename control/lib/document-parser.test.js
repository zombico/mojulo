import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename, relative, isAbsolute } from 'node:path';

// officeparser needs a real file path; record the one it is handed and what
// was written there, instead of parsing.
const seen = vi.hoisted(() => ({ paths: [], contents: [] }));
vi.mock('officeparser', async () => {
  const { readFileSync: read } = await import('node:fs');
  return {
    default: {
      parseOfficeAsync: async (filePath) => {
        seen.paths.push(filePath);
        seen.contents.push(read(filePath, 'utf8'));
        return 'extracted text';
      },
    },
  };
});

const { parseDocument, safeTempExtension } = await import('./document-parser.js');

let sandbox;
let victim;

beforeEach(() => {
  seen.paths.length = 0;
  seen.contents.length = 0;
  sandbox = mkdtempSync(join(tmpdir(), 'doc-parser-test-'));
  // .docx so parseDocument routes it to officeparser (txt/md skip the temp file).
  victim = join(sandbox, 'victim.docx');
  writeFileSync(victim, 'keep me');
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe('parseDocument temp file (upload names are untrusted)', () => {
  it('a ../ file name cannot overwrite or delete a file outside the temp dir', async () => {
    // The old path was join(tmpdir(), `temp-<ms>-${fileName}`), which path.join
    // normalised straight onto the victim: written, parsed, then unlinked.
    const traversal = `x/${'../'.repeat(40)}${victim.replace(/^\//, '')}`;
    const text = await parseDocument(Buffer.from('payload'), traversal);

    expect(text).toBe('extracted text');
    expect(readFileSync(victim, 'utf8')).toBe('keep me');
    expect(seen.paths).toHaveLength(1);
    const used = seen.paths[0];
    const rel = relative(tmpdir(), used);
    expect(rel.startsWith('..') || isAbsolute(rel)).toBe(false);
    expect(basename(dirname(used))).toMatch(/^mojulo-doc-/);
    expect(basename(used)).toBe('upload.docx');
    expect(seen.contents[0]).toBe('payload');
  });

  it('an extensionless traversal target is safe too', async () => {
    const dotfile = join(sandbox, '.profile');
    writeFileSync(dotfile, 'keep me too');
    await parseDocument(Buffer.from('payload'), `${'../'.repeat(40)}${dotfile.replace(/^\//, '')}`);
    expect(readFileSync(dotfile, 'utf8')).toBe('keep me too');
    expect(basename(seen.paths[0])).toBe('upload.profile');
  });

  it('keeps the extension officeparser needs and cleans up after itself', async () => {
    await parseDocument(Buffer.from('docx bytes'), 'Quarterly Report.DOCX');
    const used = seen.paths[0];
    expect(basename(used)).toBe('upload.docx');
    expect(existsSync(used)).toBe(false);
    expect(existsSync(dirname(used))).toBe(false);
  });

  it('gives every parse its own directory', async () => {
    await parseDocument(Buffer.from('a'), 'a.pptx');
    await parseDocument(Buffer.from('b'), 'a.pptx');
    expect(dirname(seen.paths[0])).not.toBe(dirname(seen.paths[1]));
  });
});

describe('safeTempExtension', () => {
  it('keeps a plain extension, lowercased', () => {
    expect(safeTempExtension('deck.PPTX')).toBe('.pptx');
    expect(safeTempExtension('a.b.xlsx')).toBe('.xlsx');
  });

  it('drops anything that is not a plain extension', () => {
    expect(safeTempExtension('../../etc/passwd')).toBe('');
    expect(safeTempExtension('evil.docx/../../x')).toBe('');
    expect(safeTempExtension('name.do cx')).toBe('');
    expect(safeTempExtension('noext')).toBe('');
    expect(safeTempExtension(undefined)).toBe('');
  });
});

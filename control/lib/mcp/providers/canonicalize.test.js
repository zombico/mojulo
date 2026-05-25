import { describe, it, expect } from 'vitest';
import { canonicalizeServerName, _internals } from './canonicalize.js';

describe('canonicalizeServerName: example cases from the plan', () => {
  it('claude_ai_Gmail → gmail', () => {
    expect(canonicalizeServerName('claude_ai_Gmail')).toBe('gmail');
  });

  it('claude_ai_Google_Drive → google_drive', () => {
    expect(canonicalizeServerName('claude_ai_Google_Drive')).toBe('google_drive');
  });

  it('@notionhq/notion-mcp-server → notion', () => {
    expect(canonicalizeServerName('@notionhq/notion-mcp-server')).toBe('notion');
  });

  it('notion-mcp-server → notion', () => {
    expect(canonicalizeServerName('notion-mcp-server')).toBe('notion');
  });

  it('linear → linear', () => {
    expect(canonicalizeServerName('linear')).toBe('linear');
  });
});

describe('canonicalizeServerName: lowercase normalization', () => {
  it('all-uppercase input is lowercased', () => {
    expect(canonicalizeServerName('LINEAR')).toBe('linear');
  });

  it('mixed-case input is lowercased', () => {
    expect(canonicalizeServerName('Notion')).toBe('notion');
  });

  it('uppercase prefix is recognized after lowercase', () => {
    expect(canonicalizeServerName('CLAUDE_AI_Gmail')).toBe('gmail');
  });
});

describe('canonicalizeServerName: leading host prefixes', () => {
  it('strips claude_ai_', () => {
    expect(canonicalizeServerName('claude_ai_notion')).toBe('notion');
  });

  it('strips claude- (dashed variant)', () => {
    expect(canonicalizeServerName('claude-foo')).toBe('foo');
  });

  it('strips @vendor/ scope', () => {
    expect(canonicalizeServerName('@anthropic/some-mcp-server')).toBe('some');
  });

  it('only one leading prefix is stripped (claude_ai_claude-foo → claude-foo → claude_foo)', () => {
    expect(canonicalizeServerName('claude_ai_claude-foo')).toBe('claude_foo');
  });

  it('@vendor/ and claude_ai_ are mutually exclusive — @ wins if present', () => {
    expect(canonicalizeServerName('@notionhq/claude_ai_notion')).toBe('claude_ai_notion');
  });

  it('lone @ with no slash leaves the name untouched aside from lowercase', () => {
    expect(canonicalizeServerName('@notion')).toBe('@notion');
  });
});

describe('canonicalizeServerName: trailing mcp suffixes', () => {
  it('strips -mcp-server (longest match wins)', () => {
    expect(canonicalizeServerName('foo-mcp-server')).toBe('foo');
  });

  it('strips _mcp_server', () => {
    expect(canonicalizeServerName('foo_mcp_server')).toBe('foo');
  });

  it('strips bare -mcp', () => {
    expect(canonicalizeServerName('foo-mcp')).toBe('foo');
  });

  it('strips bare _mcp', () => {
    expect(canonicalizeServerName('foo_mcp')).toBe('foo');
  });

  it('-mcp-server is preferred over -mcp on overlapping match', () => {
    // If we matched -mcp first, this would become "foo-server".
    expect(canonicalizeServerName('foo-mcp-server')).toBe('foo');
  });

  it('only one trailing suffix is stripped', () => {
    expect(canonicalizeServerName('foo-mcp-mcp')).toBe('foo_mcp');
  });
});

describe('canonicalizeServerName: separator normalization', () => {
  it('dashes become underscores', () => {
    expect(canonicalizeServerName('foo-bar-baz')).toBe('foo_bar_baz');
  });

  it('underscores stay underscores', () => {
    expect(canonicalizeServerName('foo_bar_baz')).toBe('foo_bar_baz');
  });

  it('mixed separators normalize to underscores', () => {
    expect(canonicalizeServerName('foo-bar_baz')).toBe('foo_bar_baz');
  });
});

describe('canonicalizeServerName: error cases', () => {
  it('throws on null', () => {
    expect(() => canonicalizeServerName(null)).toThrow(/non-empty string/);
  });

  it('throws on undefined', () => {
    expect(() => canonicalizeServerName(undefined)).toThrow(/non-empty string/);
  });

  it('throws on empty string', () => {
    expect(() => canonicalizeServerName('')).toThrow(/non-empty string/);
  });

  it('throws on non-string input', () => {
    expect(() => canonicalizeServerName(42)).toThrow(/non-empty string/);
  });

  it('throws when canonicalization produces an empty string', () => {
    expect(() => canonicalizeServerName('claude_ai_')).toThrow(/empty result/);
  });
});

describe('canonicalizeServerName: idempotency', () => {
  it('canonical output is a fixed point', () => {
    const samples = ['gmail', 'notion', 'google_drive', 'linear', 'foo_bar'];
    for (const s of samples) {
      expect(canonicalizeServerName(s)).toBe(s);
    }
  });
});

describe('_internals rule tables', () => {
  it('exposes the leading prefix list', () => {
    expect(_internals.LEADING_HOST_PREFIXES).toContain('claude_ai_');
    expect(_internals.LEADING_HOST_PREFIXES).toContain('claude-');
  });

  it('exposes the trailing suffix list', () => {
    expect(_internals.TRAILING_MCP_SUFFIXES).toEqual(
      expect.arrayContaining(['-mcp-server', '_mcp_server', '-mcp', '_mcp'])
    );
  });

  it('trailing suffix list orders longer entries first (load-bearing for correctness)', () => {
    const suffixes = _internals.TRAILING_MCP_SUFFIXES;
    for (let i = 0; i < suffixes.length; i++) {
      for (let j = i + 1; j < suffixes.length; j++) {
        // No suffix later in the list should be a strict suffix of an earlier
        // one (otherwise the loop's first-match-wins would skip the longer
        // one). The "longest first" invariant is what makes -mcp-server win
        // over -mcp.
        expect(suffixes[i].endsWith(suffixes[j])).toBe(false);
      }
    }
  });
});

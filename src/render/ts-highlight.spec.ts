import { describe, expect, it } from 'vitest';
import { tokenizeCode } from './ts-highlight';

describe('tokenizeCode', () => {
  it('classifies keywords, fn calls, types, numbers, punctuation, and plain identifiers', () => {
    const tokens = tokenizeCode('let sub = carbon$.subscribe(value => Diamond(3));');

    expect(tokens).toContainEqual({ text: 'let', kind: 'keyword' });
    expect(tokens).toContainEqual({ text: 'subscribe', kind: 'fn' });
    expect(tokens).toContainEqual({ text: 'Diamond', kind: 'type' });
    expect(tokens).toContainEqual({ text: '3', kind: 'number' });
    expect(tokens).toContainEqual({ text: 'value', kind: 'plain' });
    expect(tokens).toContainEqual({ text: '(', kind: 'punct' });
  });

  it('classifies a whole-line comment as a single comment token', () => {
    const tokens = tokenizeCode('sub.unsubscribe(); // done');

    expect(tokens).toContainEqual({ text: '// done', kind: 'comment' });
  });

  it('preserves whitespace, including newlines, as plain tokens so layout survives round-tripping', () => {
    const tokens = tokenizeCode('a\n  b');

    const rejoined = tokens.map((t) => t.text).join('');
    expect(rejoined).toBe('a\n  b');
  });

  it('treats $-suffixed identifiers as plain, not punctuation', () => {
    const tokens = tokenizeCode('carbon$');

    expect(tokens).toEqual([{ text: 'carbon$', kind: 'plain' }]);
  });
});

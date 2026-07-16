import { describe, expect, it } from 'vitest';
import { renderMiniMarkdown } from './mini-markdown';

describe('renderMiniMarkdown', () => {
  it('passes plain text through unchanged', () => {
    expect(renderMiniMarkdown('Packets are moving now.')).toBe('Packets are moving now.');
  });

  it('renders backtick spans as code', () => {
    expect(renderMiniMarkdown('Call `unsubscribe()` to stop it.')).toBe(
      'Call <code>unsubscribe()</code> to stop it.',
    );
  });

  it('renders double-asterisk spans as bold', () => {
    expect(renderMiniMarkdown('This is **important**.')).toBe(
      'This is <strong>important</strong>.',
    );
  });

  it('renders both code and bold in the same string', () => {
    expect(renderMiniMarkdown('**map** applies `recipe` to every packet.')).toBe(
      '<strong>map</strong> applies <code>recipe</code> to every packet.',
    );
  });

  it('escapes HTML-significant characters before applying markdown', () => {
    expect(renderMiniMarkdown('a <script>alert(1)</script> & `b`')).toBe(
      'a &lt;script&gt;alert(1)&lt;/script&gt; &amp; <code>b</code>',
    );
  });
});

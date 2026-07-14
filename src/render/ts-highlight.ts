export type CodeTokenKind = 'keyword' | 'fn' | 'type' | 'number' | 'comment' | 'punct' | 'plain';

export interface CodeToken {
  text: string;
  kind: CodeTokenKind;
}

const KEYWORDS = new Set(['const', 'let', 'new']);
const FUNCTIONS = new Set([
  'from',
  'pipe',
  'subscribe',
  'unsubscribe',
  'map',
  'filter',
  'take',
  'instanceof',
  'some',
]);

const TOKEN_PATTERN = /(\/\/[^\n]*)|([A-Za-z_$][\w$]*)|(\d+)|(\s+)|(.)/gsu;

export function tokenizeCode(code: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  for (const [, comment, word, number, space, punct] of code.matchAll(TOKEN_PATTERN)) {
    if (comment) tokens.push({ text: comment, kind: 'comment' });
    else if (word) tokens.push({ text: word, kind: wordKind(word) });
    else if (number) tokens.push({ text: number, kind: 'number' });
    else if (space) tokens.push({ text: space, kind: 'plain' });
    else if (punct) tokens.push({ text: punct, kind: 'punct' });
  }
  return tokens;
}

function wordKind(word: string): CodeTokenKind {
  if (KEYWORDS.has(word)) return 'keyword';
  if (FUNCTIONS.has(word)) return 'fn';
  if (/^[A-Z]/.test(word)) return 'type';
  return 'plain';
}

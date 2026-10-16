import { normalizeKeyword, normalizeText } from './text-normalizer';

export interface KeywordMatchResult {
  /** Keywords (as given) that occurred in the text, in input order. */
  keywords: string[];
  /** Short excerpt around the first occurrence. */
  snippet: string;
}

const SNIPPET_RADIUS = 80;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A keyword matches when it starts at a word boundary; anything may follow it. So Turkish
 * suffixes ("alanya'da", "alanyada", "alanyalı") and hashtags ("#alanya", "#alanyabeach")
 * match, while "kalanya" does not. Multi-word keywords tolerate any whitespace in between.
 */
function buildPattern(normalizedKeyword: string): RegExp {
  const body = normalizedKeyword.split(' ').map(escapeRegExp).join('\\s+');
  return new RegExp(`(?<![\\p{L}\\p{N}_])${body}`, 'u');
}

export function matchKeywords(
  text: string | null | undefined,
  keywords: readonly string[],
): KeywordMatchResult | null {
  if (!text || keywords.length === 0) return null;

  const original = text.normalize('NFC');
  const haystack = normalizeText(original);

  const found: string[] = [];
  let firstIndex = Number.POSITIVE_INFINITY;
  for (const keyword of keywords) {
    const normalizedKeyword = normalizeKeyword(keyword);
    if (!normalizedKeyword) continue;
    const m = buildPattern(normalizedKeyword).exec(haystack);
    if (m) {
      if (!found.includes(keyword)) found.push(keyword);
      firstIndex = Math.min(firstIndex, m.index);
    }
  }
  if (found.length === 0) return null;

  // Cut the snippet from the original text when indices line up (the usual case).
  const snippetSource = haystack.length === original.length ? original : haystack;
  return { keywords: found, snippet: makeSnippet(snippetSource, firstIndex) };
}

function makeSnippet(text: string, index: number): string {
  const start = Math.max(0, index - SNIPPET_RADIUS);
  const end = Math.min(text.length, index + SNIPPET_RADIUS);
  const body = text.slice(start, end).replace(/\s+/g, ' ').trim();
  return `${start > 0 ? '…' : ''}${body}${end < text.length ? '…' : ''}`;
}

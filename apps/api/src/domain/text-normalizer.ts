const APOSTROPHES = /[‘’ʼʻ`´′]/g;

/**
 * Turkish-aware normalization: NFC (so "I" + combining dot becomes "İ"), Turkish
 * lowercasing ("İ"→"i", "I"→"ı") and typographic apostrophes → "'".
 * Whitespace characters are mapped 1:1 to spaces (not collapsed) so indices stay aligned
 * with the NFC input whenever lowercasing keeps the length.
 */
export function normalizeText(input: string): string {
  return input
    .normalize('NFC')
    .toLocaleLowerCase('tr')
    .replace(APOSTROPHES, "'")
    .replace(/\s/g, ' ');
}

/** Normalized form used to store and compare keywords. */
export function normalizeKeyword(input: string): string {
  return normalizeText(input).replace(/ +/g, ' ').trim();
}

import { matchKeywords } from './keyword-matcher';
import { normalizeKeyword } from './text-normalizer';

describe('matchKeywords', () => {
  it('matches case-insensitively with Turkish lowercasing', () => {
    expect(matchKeywords('ALANYA sahilinde gün batımı', ['alanya'])?.keywords).toEqual(['alanya']);
    expect(matchKeywords('Alanya', ['ALANYA'])?.keywords).toEqual(['ALANYA']);
  });

  it('handles dotted/dotless I correctly (İ→i, I→ı)', () => {
    expect(matchKeywords('İSTANBUL boğazı', ['istanbul'])).not.toBeNull();
    expect(matchKeywords('ISPARTA gülleri', ['ısparta'])).not.toBeNull();
    // Turkish rules: "I" lowercases to "ı", so it must not be confused with "i".
    expect(matchKeywords('ISPARTA', ['isparta'])).toBeNull();
    // Keyword typed in capitals is normalized the same way as the caption.
    expect(matchKeywords('ISPARTA', ['Isparta'])).not.toBeNull();
  });

  it('handles Turkish characters ç ğ ö ş ü', () => {
    expect(matchKeywords('ÇEŞME ve GÜMÜŞLÜK', ['çeşme', 'gümüşlük'])?.keywords).toEqual([
      'çeşme',
      'gümüşlük',
    ]);
    expect(matchKeywords('Muğla’da tatil', ['muğla'])).not.toBeNull();
  });

  it('treats a decomposed İ (I + combining dot) the same as precomposed', () => {
    expect(matchKeywords('İSTANBUL', ['istanbul'])).not.toBeNull();
  });

  it('matches hashtags and suffixed forms', () => {
    for (const text of [
      '#alanya',
      "Alanya'da bir gün",
      'Alanya’dan selamlar',
      'alanyada',
      'Alanyalı dostlar',
      '#AlanyaBeach',
    ]) {
      expect(matchKeywords(text, ['alanya'])).not.toBeNull();
    }
  });

  it('does not match inside another word', () => {
    expect(matchKeywords('kalanyazı', ['alanya'])).toBeNull();
    expect(matchKeywords('balanya', ['alanya'])).toBeNull();
    expect(matchKeywords('x_alanya', ['alanya'])).toBeNull();
  });

  it('returns every matching keyword (multiple keywords) and ignores the rest', () => {
    const r = matchKeywords('Alanya ve Side turu, #antalya', [
      'side',
      'kemer',
      'alanya',
      'antalya',
    ]);
    expect(r?.keywords).toEqual(['side', 'alanya', 'antalya']);
  });

  it('matches multi-word keywords across arbitrary whitespace', () => {
    expect(matchKeywords('Kleopatra\n  Plajı harika', ['kleopatra plajı'])).not.toBeNull();
  });

  it('escapes regex characters in keywords', () => {
    expect(matchKeywords('fiyat 1+1 kampanya', ['1+1'])).not.toBeNull();
    expect(matchKeywords('fiyat 11 kampanya', ['1+1'])).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(matchKeywords(null, ['alanya'])).toBeNull();
    expect(matchKeywords('', ['alanya'])).toBeNull();
    expect(matchKeywords('alanya', [])).toBeNull();
  });

  it('builds a snippet around the first occurrence from the original text', () => {
    const caption = `${'lorem ipsum '.repeat(20)}Bugün ALANYA'da harika bir gün ${'dolor sit '.repeat(20)}`;
    const r = matchKeywords(caption, ['alanya'])!;
    expect(r.snippet).toContain("ALANYA'da");
    expect(r.snippet.startsWith('…')).toBe(true);
    expect(r.snippet.endsWith('…')).toBe(true);
    expect(r.snippet.length).toBeLessThan(200);
  });
});

describe('normalizeKeyword', () => {
  it('lowercases with tr rules, unifies apostrophes and trims', () => {
    expect(normalizeKeyword('  İzmir’de  ')).toBe("izmir'de");
    expect(normalizeKeyword('KLEOPATRA   PLAJI')).toBe('kleopatra plajı');
  });
});

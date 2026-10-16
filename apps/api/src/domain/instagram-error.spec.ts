import { classifyGraphError, InstagramApiError } from './instagram-error';

describe('Graph API error classification', () => {
  it.each([
    [4, 'rate_limit'],
    [17, 'rate_limit'],
    [32, 'rate_limit'],
    [613, 'rate_limit'],
    [100, 'account_inaccessible'],
    [110, 'account_inaccessible'],
    [190, 'auth'],
    [10, 'auth'],
    [1, 'other'],
    [undefined, 'other'],
  ])('code %p → %s', (code, kind) => {
    expect(classifyGraphError(code)).toBe(kind);
  });

  it('builds an error from a Graph error body', () => {
    const e = InstagramApiError.fromGraphError(
      { code: 4, message: '(#4) Application request limit reached' },
      400,
    );
    expect(e.kind).toBe('rate_limit');
    expect(e.code).toBe(4);
    expect(e.httpStatus).toBe(400);
    expect(e.message).toContain('(#4)');
  });
});

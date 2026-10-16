import { loadEnv } from './env';

const base = {
  DATABASE_URL: 'postgres://u:p@db:5432/ig',
  REDIS_URL: 'redis://redis:6379/0',
  FB_APP_ID: '1',
  FB_APP_SECRET: 's',
  PANEL_PASSWORD: '123456',
};

describe('loadEnv', () => {
  it('treats empty strings from compose (${VAR:-}) as unset', () => {
    const env = loadEnv({
      ...base,
      SESSION_SECRET: '',
      COOKIE_SECURE: '',
      DATABASE_SSL: '',
      TELEGRAM_BOT_TOKEN: '',
      IG_USER_ID: '',
      IG_ACCESS_TOKEN: '',
    });
    expect(env.SESSION_SECRET).toBeUndefined();
    expect(env.COOKIE_SECURE).toBe(false);
    expect(env.DATABASE_SSL).toBe(false);
    expect(env.TELEGRAM_BOT_TOKEN).toBeUndefined();
    expect(env.IG_USER_ID).toBeUndefined();
    expect(env.GRAPH_API_VERSION).toBe('v21.0');
  });

  it('parses booleans and validates values that are set', () => {
    expect(loadEnv({ ...base, COOKIE_SECURE: 'true' }).COOKIE_SECURE).toBe(true);
    expect(() => loadEnv({ ...base, SESSION_SECRET: 'short' })).toThrow(/SESSION_SECRET/);
    expect(() => loadEnv({ ...base, IG_USER_ID: 'abc' })).toThrow(/IG_USER_ID/);
  });
});

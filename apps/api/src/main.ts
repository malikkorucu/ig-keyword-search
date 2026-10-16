import 'dotenv/config';
import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { RedisStore } from 'connect-redis';
import session from 'express-session';
import { createClient } from 'redis';
import { AppModule } from './app.module';
import { ENV, type Env } from './config/env';

process.env.TZ = 'UTC';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const env = app.get<Env>(ENV);

  const redis = createClient({ url: env.REDIS_URL });
  redis.on('error', (e: Error) => Logger.error(`session redis: ${e.message}`, 'Bootstrap'));
  await redis.connect();

  app.set('trust proxy', 1);
  app.use(
    session({
      store: new RedisStore({ client: redis, prefix: 'igw:sess:' }),
      name: 'igw.sid',
      secret:
        env.SESSION_SECRET ??
        createHash('sha256').update(`igw-session:${env.PANEL_PASSWORD}`).digest('hex'),
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: { httpOnly: true, sameSite: 'lax', secure: env.COOKIE_SECURE, maxAge: WEEK_MS },
    }),
  );
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  await app.listen(env.PORT, '0.0.0.0');
  Logger.log(`API listening on :${env.PORT}`, 'Bootstrap');

  const close = () => void redis.quit().catch(() => undefined);
  process.once('SIGTERM', close);
  process.once('SIGINT', close);
}

bootstrap().catch((error: unknown) => {
  Logger.error(
    error instanceof Error ? (error.stack ?? error.message) : String(error),
    'Bootstrap',
  );
  process.exit(1);
});

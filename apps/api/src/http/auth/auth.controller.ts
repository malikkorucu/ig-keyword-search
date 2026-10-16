import { createHash, timingSafeEqual } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { type LoginInput, loginSchema, type SessionDto } from '@igw/shared';
import type { Request } from 'express';
import { ENV, type Env } from '../../config/env';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { Public } from './public.decorator';

const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 15 * 60_000;

const digest = (v: string) => createHash('sha256').update(v).digest();

@Controller('auth')
export class AuthController {
  private readonly failures = new Map<string, { count: number; first: number }>();

  constructor(@Inject(ENV) private readonly env: Env) {}

  @Public()
  @Get('session')
  session(@Req() req: Request): SessionDto {
    return { authenticated: req.session.authenticated === true };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Req() req: Request,
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
  ): Promise<SessionDto> {
    const key = req.ip ?? 'unknown';
    const entry = this.failures.get(key);
    if (entry && Date.now() - entry.first < FAILURE_WINDOW_MS && entry.count >= MAX_FAILURES) {
      throw new HttpException(
        'Çok fazla hatalı deneme, biraz sonra tekrar deneyin',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!timingSafeEqual(digest(body.password), digest(this.env.PANEL_PASSWORD))) {
      const fresh = !entry || Date.now() - entry.first >= FAILURE_WINDOW_MS;
      this.failures.set(
        key,
        fresh ? { count: 1, first: Date.now() } : { ...entry, count: entry.count + 1 },
      );
      throw new UnauthorizedException('Parola hatalı');
    }

    this.failures.delete(key);
    await new Promise<void>((resolve, reject) =>
      req.session.regenerate((e) => (e ? reject(e) : resolve())),
    );
    req.session.authenticated = true;
    await new Promise<void>((resolve, reject) =>
      req.session.save((e) => (e ? reject(e) : resolve())),
    );
    return { authenticated: true };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request): Promise<SessionDto> {
    await new Promise<void>((resolve) => req.session.destroy(() => resolve()));
    return { authenticated: false };
  }
}

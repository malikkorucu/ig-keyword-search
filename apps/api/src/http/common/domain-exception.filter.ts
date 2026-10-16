import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { DuplicateError } from '../../application/errors';
import { AccountNotFoundError } from '../../application/use-cases/verify-account.use-case';

@Catch(DuplicateError, AccountNotFoundError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(error: Error, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const status = error instanceof DuplicateError ? HttpStatus.CONFLICT : HttpStatus.NOT_FOUND;
    res.status(status).json({ statusCode: status, message: error.message || 'Bulunamadı' });
  }
}

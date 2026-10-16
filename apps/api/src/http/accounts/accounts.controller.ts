import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  type AccountDto,
  type CreateAccountInput,
  createAccountSchema,
  type UpdateAccountInput,
  updateAccountSchema,
  type VerifyAccountResultDto,
} from '@igw/shared';
import { AccountRepository } from '../../application/ports';
import { VerifyAccountUseCase } from '../../application/use-cases/verify-account.use-case';
import { presentAccount } from '../common/presenters';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly verifyAccount: VerifyAccountUseCase,
  ) {}

  @Get()
  async list(): Promise<AccountDto[]> {
    return (await this.accounts.list()).map(presentAccount);
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(createAccountSchema)) body: CreateAccountInput,
  ): Promise<AccountDto> {
    return presentAccount(await this.accounts.create(body));
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateAccountSchema)) body: UpdateAccountInput,
  ): Promise<AccountDto> {
    const account = await this.accounts.setActive(id, body.active);
    if (!account) throw new NotFoundException('Hesap bulunamadı');
    return presentAccount(account);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    if (!(await this.accounts.delete(id))) throw new NotFoundException('Hesap bulunamadı');
  }

  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  async verify(@Param('id', ParseUUIDPipe) id: string): Promise<VerifyAccountResultDto> {
    const result = await this.verifyAccount.execute(id);
    return { ...result, account: presentAccount(result.account) };
  }
}

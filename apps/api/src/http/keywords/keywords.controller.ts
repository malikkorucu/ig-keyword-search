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
  type CreateKeywordInput,
  createKeywordSchema,
  type KeywordDto,
  type UpdateKeywordInput,
  updateKeywordSchema,
} from '@igw/shared';
import { KeywordRepository } from '../../application/ports';
import { presentKeyword } from '../common/presenters';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

@Controller('keywords')
export class KeywordsController {
  constructor(private readonly keywords: KeywordRepository) {}

  @Get()
  async list(): Promise<KeywordDto[]> {
    return (await this.keywords.list()).map(presentKeyword);
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(createKeywordSchema)) body: CreateKeywordInput,
  ): Promise<KeywordDto> {
    return presentKeyword(await this.keywords.create(body.value));
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateKeywordSchema)) body: UpdateKeywordInput,
  ): Promise<KeywordDto> {
    const keyword = await this.keywords.setActive(id, body.active);
    if (!keyword) throw new NotFoundException('Anahtar kelime bulunamadı');
    return presentKeyword(keyword);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    if (!(await this.keywords.delete(id))) throw new NotFoundException('Anahtar kelime bulunamadı');
  }
}

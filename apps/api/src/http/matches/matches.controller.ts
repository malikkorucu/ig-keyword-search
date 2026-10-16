import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  type MatchDto,
  type MatchesQuery,
  matchesQuerySchema,
  type Paginated,
  type UpdateMatchStatusInput,
  updateMatchStatusSchema,
} from '@igw/shared';
import { MatchRepository } from '../../application/ports';
import { presentMatch } from '../common/presenters';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

@Controller('matches')
export class MatchesController {
  constructor(private readonly matches: MatchRepository) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(matchesQuerySchema)) query: MatchesQuery,
  ): Promise<Paginated<MatchDto>> {
    const page = await this.matches.list(query);
    return { ...page, items: page.items.map(presentMatch) };
  }

  @Patch(':id')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateMatchStatusSchema)) body: UpdateMatchStatusInput,
  ): Promise<MatchDto> {
    const match = await this.matches.updateStatus(id, body.status);
    if (!match) throw new NotFoundException('Eşleşme bulunamadı');
    return presentMatch(match);
  }
}

import { Controller, Get, Query } from '@nestjs/common';
import {
  type Paginated,
  type PollRunDto,
  type PollRunsQuery,
  pollRunsQuerySchema,
} from '@igw/shared';
import { PollRunRepository } from '../../application/ports';
import { presentPollRun } from '../common/presenters';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

@Controller('poll-runs')
export class PollRunsController {
  constructor(private readonly pollRuns: PollRunRepository) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(pollRunsQuerySchema)) query: PollRunsQuery,
  ): Promise<Paginated<PollRunDto>> {
    const page = await this.pollRuns.list(query);
    return { ...page, items: page.items.map(presentPollRun) };
  }
}

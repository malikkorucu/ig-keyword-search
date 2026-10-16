import { Module } from '@nestjs/common';
import { KeywordRepository, OcrPort, ProcessedPostRepository } from './application/ports';
import { ProcessOcrUseCase } from './application/use-cases/process-ocr.use-case';
import { RecordMatchService } from './application/use-cases/record-match.service';
import { CoreModule } from './core.module';
import { TesseractOcrAdapter } from './infrastructure/ocr/tesseract-ocr.adapter';
import { QueueWorkersService } from './infrastructure/queue/queue-workers.service';

@Module({
  imports: [CoreModule.forRoot({ runMigrations: false })],
  providers: [
    { provide: OcrPort, useClass: TesseractOcrAdapter },
    {
      provide: ProcessOcrUseCase,
      useFactory: (
        ocr: OcrPort,
        k: KeywordRepository,
        p: ProcessedPostRepository,
        r: RecordMatchService,
      ) => new ProcessOcrUseCase(ocr, k, p, r),
      inject: [OcrPort, KeywordRepository, ProcessedPostRepository, RecordMatchService],
    },
    QueueWorkersService,
  ],
})
export class WorkerModule {}

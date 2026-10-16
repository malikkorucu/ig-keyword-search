import { mkdirSync } from 'node:fs';
import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { createWorker, type Worker } from 'tesseract.js';
import { OcrPort } from '../../application/ports';
import { ENV, type Env } from '../../config/env';
import { preprocessForOcr } from './image-preprocessor';

const DOWNLOAD_TIMEOUT_MS = 20_000;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const LANGUAGES = 'tur+eng';

/** Downloads an image into memory, preprocesses it with sharp and OCRs it with tesseract.js. */
@Injectable()
export class TesseractOcrAdapter extends OcrPort implements OnModuleDestroy {
  private readonly logger = new Logger(TesseractOcrAdapter.name);
  private worker: Promise<Worker> | null = null;

  constructor(@Inject(ENV) private readonly env: Env) {
    super();
  }

  async recognizeFromUrl(imageUrl: string): Promise<string> {
    const raw = await this.download(imageUrl);
    const prepared = await preprocessForOcr(raw);
    const worker = await this.getWorker();
    const { data } = await worker.recognize(prepared);
    return data.text.replace(/[ \t]+\n/g, '\n').trim();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) await (await this.worker).terminate().catch(() => undefined);
  }

  private getWorker(): Promise<Worker> {
    if (!this.worker) {
      mkdirSync(this.env.TESSERACT_CACHE_DIR, { recursive: true });
      this.logger.log(
        `Starting tesseract worker (${LANGUAGES}), cache: ${this.env.TESSERACT_CACHE_DIR}`,
      );
      this.worker = createWorker(LANGUAGES, 1, { cachePath: this.env.TESSERACT_CACHE_DIR }).catch(
        (error) => {
          this.worker = null;
          throw error;
        },
      );
    }
    return this.worker;
  }

  private async download(url: string): Promise<Buffer> {
    const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`Görsel indirilemedi (HTTP ${response.status})`);
    const length = Number(response.headers.get('content-length') ?? 0);
    if (length > MAX_IMAGE_BYTES) throw new Error(`Görsel çok büyük (${length} bayt)`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX_IMAGE_BYTES)
      throw new Error(`Görsel çok büyük (${buffer.byteLength} bayt)`);
    return buffer;
  }
}

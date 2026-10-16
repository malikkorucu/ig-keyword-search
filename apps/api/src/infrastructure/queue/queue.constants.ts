export const POLL_QUEUE = 'poll';
export const OCR_QUEUE = 'ocr';
/** ioredis connection shared by BullMQ queues/workers in a process. */
export const REDIS_CONNECTION = Symbol('REDIS_CONNECTION');

export const OCR_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 30_000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 1000 },
};

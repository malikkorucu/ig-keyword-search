export abstract class ClockPort {
  abstract now(): Date;
}

export class SystemClock extends ClockPort {
  now(): Date {
    return new Date();
  }
}

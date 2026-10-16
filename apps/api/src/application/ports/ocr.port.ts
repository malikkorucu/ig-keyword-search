export abstract class OcrPort {
  /** Downloads the (short-lived) image, preprocesses and OCRs it in memory. Nothing is persisted. */
  abstract recognizeFromUrl(imageUrl: string): Promise<string>;
}

import type { IgMedia, IgMediaChild } from './models';

function imageUrlOf(
  item: Pick<IgMediaChild, 'mediaType' | 'mediaUrl' | 'thumbnailUrl'>,
): string | null {
  if (item.mediaType === 'VIDEO') return item.thumbnailUrl ?? null;
  return item.mediaUrl ?? item.thumbnailUrl ?? null;
}

/**
 * Images to OCR for a post: carousel → every child (video children → their thumbnail),
 * video → thumbnail_url, photo → media_url. Duplicates and missing URLs are dropped.
 */
export function extractImageUrls(media: IgMedia): string[] {
  const urls =
    media.mediaType === 'CAROUSEL_ALBUM'
      ? media.children.length > 0
        ? media.children.map(imageUrlOf)
        : [imageUrlOf(media)]
      : [imageUrlOf(media)];
  return [...new Set(urls.filter((u): u is string => typeof u === 'string' && u.length > 0))];
}

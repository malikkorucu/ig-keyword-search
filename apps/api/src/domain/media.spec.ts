import { makeMedia } from '../../test/fakes';
import { extractImageUrls } from './media';

describe('extractImageUrls', () => {
  it('uses media_url for photos', () => {
    expect(extractImageUrls(makeMedia('1', { mediaUrl: 'https://a/1.jpg' }))).toEqual([
      'https://a/1.jpg',
    ]);
  });

  it('uses thumbnail_url for videos', () => {
    const media = makeMedia('2', {
      mediaType: 'VIDEO',
      mediaUrl: 'https://a/2.mp4',
      thumbnailUrl: 'https://a/2.jpg',
    });
    expect(extractImageUrls(media)).toEqual(['https://a/2.jpg']);
  });

  it('uses every child for carousels (video child → thumbnail) and drops missing URLs', () => {
    const media = makeMedia('3', {
      mediaType: 'CAROUSEL_ALBUM',
      mediaUrl: 'https://a/cover.jpg',
      children: [
        { mediaType: 'IMAGE', mediaUrl: 'https://a/c1.jpg', thumbnailUrl: null },
        { mediaType: 'VIDEO', mediaUrl: 'https://a/c2.mp4', thumbnailUrl: 'https://a/c2.jpg' },
        { mediaType: 'VIDEO', mediaUrl: 'https://a/c3.mp4', thumbnailUrl: null },
        { mediaType: 'IMAGE', mediaUrl: 'https://a/c1.jpg', thumbnailUrl: null },
      ],
    });
    expect(extractImageUrls(media)).toEqual(['https://a/c1.jpg', 'https://a/c2.jpg']);
  });

  it('falls back to the cover when a carousel has no children data', () => {
    const media = makeMedia('4', { mediaType: 'CAROUSEL_ALBUM', mediaUrl: 'https://a/cover.jpg' });
    expect(extractImageUrls(media)).toEqual(['https://a/cover.jpg']);
  });
});

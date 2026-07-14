import { describe, expect, it } from 'vitest';
import { TileThumbnailService } from './tile-thumbnail.service';

describe('TileThumbnailService', () => {
  it('starts empty and stores thumbnails by key', () => {
    const service = new TileThumbnailService();
    expect(service.thumbnails()).toEqual({});

    service.set('conveyor', 'data:image/png;base64,AAA');
    service.set('map', 'data:image/png;base64,BBB');

    expect(service.thumbnails()).toEqual({
      conveyor: 'data:image/png;base64,AAA',
      map: 'data:image/png;base64,BBB',
    });
  });
});

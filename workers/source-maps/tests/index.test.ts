/**
 * Tests for Source Maps Worker
 */
import {SourcemapCollectedData} from '../types/source-maps-event-worker-task';
import MockBundle from './create-mock-bundle';
import SourceMapsWorker from '../src/index';
import {SourcemapDataExtended} from '../types/source-maps-record';

describe('SourceMaps Worker', () => {
  /**
   * Testing bundle of a mock application from './mock/src/'
   */
  let mockBundle: MockBundle = new MockBundle();

  /**
   * Create webpack bundle and source map for Mock App
   */
  beforeAll(async () => {
    await mockBundle.build();
  });

  /**
   * Clear webpack bundle
   */
  afterAll(async () => {
    await mockBundle.clear();
  });

  test('should correctly extract original file name from source map', async () => {
    /**
     * Get a bundle
     */
    const map = await mockBundle.getSourceMap();
    const workerInstance = new SourceMapsWorker();

    const extendedInfo: SourcemapDataExtended[] = workerInstance['extendReleaseInfo']([{
      name: 'main.js.map',
      payload: map
    }] as SourcemapCollectedData[]);

    /**
     * Maps should be array
     */
    await expect(extendedInfo).toBeInstanceOf(Array);

    const currentMapData = extendedInfo.pop();

    /**
     * Check for extended properties
     */
    await expect(currentMapData).toHaveProperty('mapFileName', 'main.js.map');
    await expect(currentMapData).toHaveProperty('originFileName', 'main.js');
    await expect(currentMapData).toHaveProperty('content');
  });

  /**
   * @todo add test for case with several source maps in a single release
   */
});

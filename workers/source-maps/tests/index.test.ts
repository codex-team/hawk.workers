/* tslint:disable:no-string-literal */
/**
 * Tests for Source Maps Worker
 */
import SourceMapsWorker from '../src/index';
import { SourcemapCollectedData } from '../types/source-maps-event-worker-task';
import { SourceMapDataExtended } from '../types/source-maps-record';
import MockBundle from './create-mock-bundle';
import '../../../env-test';

describe('SourceMaps Worker', () => {
  /**
   * Testing bundle of a mock application from './mock/src/'
   */
  const mockBundle: MockBundle = new MockBundle();

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

    const extendedInfo: SourceMapDataExtended[] = workerInstance['extendReleaseInfo']([ {
      name: 'main.js.map',
      payload: map,
    } ] as SourcemapCollectedData[]);

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

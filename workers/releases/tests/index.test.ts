/* tslint:disable:no-string-literal */
import { Collection, Db, MongoClient } from 'mongodb';
import { ProjectDBScheme } from 'hawk.types';

/**
 * Tests for Source Maps Worker
 */
import ReleasesWorker from '../src/index';
import { SourcemapCollectedData, SourceMapDataExtended } from '../types';
import MockBundle from './create-mock-bundle';
import '../../../env-test';

describe('Release Worker', () => {
  let connection: MongoClient;
  let db: Db;
  let releasesCollection: Collection<ProjectDBScheme>;

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
    const workerInstance = new ReleasesWorker();

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

  test('should save release if it does not exists', async () => {
    const workerInstance = new ReleasesWorker();

    workerInstance.handle({
      type: 'add-release',
      payload: {
        projectId: '5e4ff518628a6c714515f844',
        release: 'Dapper Dragon',
        commits: [],
      },

      // connection = await MongoClient.connect(process.env.MONGO_ACCOUNTS_DATABASE_URI, {
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
      // });
      // db = await connection.db('hawk');
      // projectCollection = db.collection<ProjectDBScheme>('projects');
    });
  });

  /**
   * @todo add test for case with several source maps in a single release
   */
});

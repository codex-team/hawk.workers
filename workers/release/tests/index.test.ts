/* tslint:disable:no-string-literal */
import { Db, MongoClient } from 'mongodb';

/**
 * Tests for Source Maps Worker
 */
import ReleaseWorker from '../src/index';
import { SourcemapCollectedData, SourceMapDataExtended, ReleaseWorkerAddReleasePayload } from '../types';
import MockBundle from './create-mock-bundle';
import '../../../env-test';

const commits = [
  {
    hash: '599575d00e62924d08b031defe0a6b10133a75fc',
    author: 'geekan@codex.so',
    title: 'Hot fix',
    date: 'Fri, 23 Apr 2021 10:54:01 GMT',
  }, {
    hash: '0f9575d00e62924d08b031defe0a6b10133a88bb',
    author: 'geekan@codex.so',
    title: 'Add some features',
    date: 'Fri, 23 Apr 2021 10:50:00 GMT',
  },
];

const projectId = '5e4ff518628a6c714515f844';

const releasePayload: ReleaseWorkerAddReleasePayload = {
  release: 'Dapper Dragon',
  catcherType: 'errors/javascript',
  commits: [ {
    hash: '599575d00e62924d08b031defe0a6b10133a75fc',
    author: 'geekan@codex.so',
    title: 'Hot fix',
    date: 'Fri, 23 Apr 2021 10:54:01 GMT',
  } ],
};

describe('Release Worker', () => {
  const worker = new ReleaseWorker();
  let connection: MongoClient;
  let db: Db;
  let collection;

  /**
   * Testing bundle of a mock application from './mock/src/'
   */
  const mockBundle: MockBundle = new MockBundle();

  /**
   * Create webpack bundle and source map for Mock App
   */
  beforeAll(async () => {
    await worker.start();

    connection = await MongoClient.connect(process.env.MONGO_ACCOUNTS_DATABASE_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    db = await connection.db('hawk');
    collection = await db.collection('releases');

    await mockBundle.build();
  });

  /**
   * Clear webpack bundle
   */
  afterAll(async () => {
    await collection.deleteMany({});
    await db.collection('releases.chunks').deleteMany({});
    await db.collection('releases.files').deleteMany({});

    await worker.finish();
    connection.close();
    await mockBundle.clear();
  });

  beforeEach(async () => {
    await collection.deleteMany({});
    await db.collection('releases.chunks').deleteMany({});
    await db.collection('releases.files').deleteMany({});
  });

  test('should correctly extract original file name from source map', async () => {
    /**
     * Get a bundle
     */
    const map = await mockBundle.getSourceMap();
    const workerInstance = new ReleaseWorker();

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
    await worker.handle({
      projectId,
      type: 'add-release',
      payload: {
        ...releasePayload,
      },
    });

    const release = await collection.findOne({
      projectId: projectId,
      release: releasePayload.release,
    });

    await expect(release).toMatchObject(releasePayload);
  });

  test('should correctly save release with javascript source maps', async () => {
    const map = await mockBundle.getSourceMap();
    const collectedData = [ {
      name: 'main.js.map',
      payload: map,
    } ] as SourcemapCollectedData[];

    await worker.handle({
      projectId,
      type: 'add-release',
      payload: {
        ...releasePayload,
        files: collectedData,
      },
    });

    const release = await collection.findOne({
      projectId: projectId,
      release: releasePayload.release,
    });

    await expect(release).toMatchObject(releasePayload);
  });

  test('should update a release if it is already exists', async () => {
    await worker.handle({
      projectId,
      type: 'add-release',
      payload: releasePayload,
    });

    await worker.handle({
      projectId,
      type: 'add-release',
      payload: {
        ...releasePayload,
        commits,
      },
    });

    const count = await collection.countDocuments();

    await expect(count).toEqual(1);
  });

  /**
   * @todo add test for case with several source maps in a single release
   */
});

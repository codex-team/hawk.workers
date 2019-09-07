/**
 * Tests for Source Maps Worker
 */
import {SourceMapsEventWorkerTask} from '../types/source-maps-event-worker-task';

import mockApp from './mock/src/index';
import * as path from 'path';
import * as fs from 'fs';
import MockBundle from './create-mock-bundle';




const workerTaskMock: SourceMapsEventWorkerTask = {
  projectId: '5d206f7f9aaf7c0071d64596',
  release: '12345',
  files: [{
    name: 'main.min.js',
    payload: ''
  }]
};

describe('SourceMaps Worker', () => {
  /**
   * Testing bundle of a mock application from './mock/src/'
   */
  let mockBundle: MockBundle = new MockBundle();

  /**
   * Create webpack bundle
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

  test('should return correct worker type', async () => {
    /**
     * Create a minified version and source map from Mock App
     */
    console.log('\n\n\nStart building Mock App');

    const bundle = await mockBundle.getBundle();
    
    console.log('bundle', bundle);





  });
});

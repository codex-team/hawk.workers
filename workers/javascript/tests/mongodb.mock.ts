/* eslint-disable @typescript-eslint/no-explicit-any */
import { ObjectId } from 'mongodb';
import { GroupedEventDBScheme } from 'hawk.types';

export const releasesJsQueryMock = jest.fn(() => ({
  _id: new ObjectId('5e3eef0679fa3700a0198a49'),
  projectId: new ObjectId('5f91e73c40bcf7002341f18d'),
  release: '3fa0f290c014',
  files: [
    {
      mapFileName: 'main.js.map',
      originFileName: 'main.js',
      _id: new ObjectId('5f91e73c40bcf7102341f18d'),
    },
  ],
}));

export const eventsQueryMock = jest.fn(() => ({
  totalCount: 10,
  payload: {
    title: 'New event',
    timestamp: Date.now(),
    backtrace: [ {
      file: 'file',
      line: 1,
      sourceCode: [ {
        line: 1,
        content: 'code',
      } ],
    } ],
  },
} as GroupedEventDBScheme));
export const dailyEventsQueryMock = jest.fn(() => 1);

export const dbCollectionMock = jest.fn((collection: string) => {
  switch (true) {
    case collection.startsWith('releases'):
      return {
        findOne: releasesJsQueryMock,
      };

    case collection.startsWith('events'):
      return {
        findOne: eventsQueryMock,
      };

    case collection.startsWith('dailyEvents'):
      return {
        countDocuments: dailyEventsQueryMock,
      };
  }

  return ({
    findOne: releasesJsQueryMock,
    countDocuments: releasesJsQueryMock,
  });
});

export const dbConnectionMock = jest.fn(() => {
  return {
    collection: dbCollectionMock,
  };
});

export const dbConnectMock = jest.fn();
export const dbCloseMock = jest.fn();

/**
 * Mock
 */
export class MockDBController {
  /**
   * Mock
   *
   * @param args - connection args
   */
  public connect(...args: unknown[]): any {
    return dbConnectMock(...args);
  }

  /**
   * Mock
   */
  public getConnection(): any {
    return dbConnectionMock();
  }

  /**
   * Mock
   */
  public createGridFsBucket(): any {
    return jest.fn();
  }

  /**
   * Mock
   */
  public close(): any {
    dbCloseMock();
  }
}
